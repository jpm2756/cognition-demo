/**
 * Cloud-native reimplementation of CardDemo batch program CBACT04C
 * (the interest calculator).
 *
 * Legacy behavior (app/cbl/CBACT04C.cbl): read the transaction-category
 * balance file (TCATBALF) in key order and, for every record:
 *   1. DISPLAY the raw 50-byte TRAN-CAT-BAL-RECORD to stdout;
 *   2. on an account change, load the account (ACCTFILE) and its card
 *      cross-reference (XREFFILE);
 *   3. look up the disclosure-group interest rate (DISCGRP) for
 *      (account-group-id, tran-type, tran-cat);
 *   4. if the rate is non-zero, compute one month's interest
 *      = (TRAN-CAT-BAL * DIS-INT-RATE) / 1200 and WRITE an interest
 *      TRANSACT record (TRAN-AMT = the interest), stamping each with a
 *      DB2-format timestamp; the account balance is also rolled up and
 *      rewritten (internal to ACCTFILE, not part of the parity slice).
 *
 * This port reproduces the two observable outputs byte-for-byte: the
 * program stdout and the rendered TRANSACT file (see run_cbact04c.sh /
 * render_transact.py). Parity-critical details:
 *   - The stdout dump echoes the raw record bytes (READ INTO copies the
 *     zoned fields verbatim, so the input {}-overpunch is preserved).
 *   - Interest is fixed-point: integer cents, truncated toward zero,
 *     exactly like a COBOL COMPUTE into S9(09)V99 without ROUNDED.
 *   - TRAN-AMT is written to the file as a GnuCOBOL zoned decimal:
 *     positive values keep plain trailing digits, negative values carry
 *     the ASCII 0x70..0x79 overpunch (p..y) that GnuCOBOL emits.
 */
import { readFileSync } from "fs";
import { join } from "path";

export const TRAN_RECLN = 350;
/** Fixed 26-byte DB2 timestamp; sub-second digits are non-deterministic so
 *  both the golden baseline and this port pin them to a known value. */
export const FIXED_TS = "2022-07-18-00.00.00.000000";
/** Run date supplied on the mainframe via JCL PARM (INTCALC.jcl). */
export const PARM_DATE = "2022071800";

/** Decode a zoned-decimal field that uses the CardDemo {}-overpunch
 *  convention (as stored in the ASCII fixtures / read by GnuCOBOL). Also
 *  tolerates plain trailing digits. Returns a signed integer scaled to the
 *  field's implied decimals (i.e. all digits as an integer). */
export function decodeZonedInput(field: string): number {
  const body = field.slice(0, -1);
  const last = field[field.length - 1];
  const pos: Record<string, string> = {
    "{": "0", A: "1", B: "2", C: "3", D: "4", E: "5", F: "6", G: "7", H: "8", I: "9",
  };
  const neg: Record<string, string> = {
    "}": "0", J: "1", K: "2", L: "3", M: "4", N: "5", O: "6", P: "7", Q: "8", R: "9",
  };
  let sign = 1;
  let lastDigit: string;
  if (last in pos) {
    lastDigit = pos[last];
  } else if (last in neg) {
    sign = -1;
    lastDigit = neg[last];
  } else {
    const code = last.charCodeAt(0);
    if (code >= 0x70 && code <= 0x79) {
      sign = -1;
      lastDigit = String(code - 0x70);
    } else {
      lastDigit = last;
    }
  }
  return sign * Number(body + lastDigit);
}

/** Encode a signed integer as a GnuCOBOL zoned-decimal string of `width`
 *  bytes, matching how GnuCOBOL writes a computed USAGE DISPLAY numeric to a
 *  file: positive -> plain digits, negative -> last byte = 0x70 + last digit. */
export function encodeZonedOutput(value: number, width: number): string {
  const digits = Math.abs(value).toString().padStart(width, "0");
  if (digits.length > width) throw new Error(`overflow: ${value} in ${width}`);
  if (value >= 0) return digits;
  const body = digits.slice(0, -1);
  const lastDigit = digits.charCodeAt(digits.length - 1) - 0x30;
  return body + String.fromCharCode(0x70 + lastDigit);
}

/** One month's interest, in cents, truncated toward zero — matches a COBOL
 *  COMPUTE WS-MONTHLY-INT = (TRAN-CAT-BAL * DIS-INT-RATE) / 1200 into an
 *  S9(09)V99 receiver (no ROUNDED). balCents and the result are cents;
 *  rateHundredths is the rate scaled to two decimals. */
export function computeMonthlyInterestCents(balCents: number, rateHundredths: number): number {
  const num = balCents * rateHundredths;
  const q = Math.trunc(num / 120000);
  return q;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

interface AccountRec { groupId: string; }
interface TranCatBal { acctId: string; typeCd: string; catCd: string; balCents: number; raw: string; }

function readLines(path: string): string[] {
  return readFileSync(path, "latin1").split("\n").filter((l) => l.length > 0);
}

export interface Fixtures {
  tcatbal: TranCatBal[];
  accounts: Map<string, AccountRec>;
  xrefByAcct: Map<string, string>; // acctId -> card number
  discRate: Map<string, number>; // key group+type+cat -> rate (hundredths, signed)
}

export function loadFixtures(dir: string): Fixtures {
  const tcatbal: TranCatBal[] = readLines(join(dir, "cbact04c_tcatbal.txt")).map((r) => {
    const rec = pad(r, 50);
    return {
      acctId: rec.slice(0, 11),
      typeCd: rec.slice(11, 13),
      catCd: rec.slice(13, 17),
      balCents: decodeZonedInput(rec.slice(17, 28)),
      raw: rec,
    };
  });
  const accounts = new Map<string, AccountRec>();
  for (const r of readLines(join(dir, "cbact04c_acct.txt"))) {
    const rec = pad(r, 300);
    accounts.set(rec.slice(0, 11), { groupId: rec.slice(112, 122) });
  }
  const xrefByAcct = new Map<string, string>();
  for (const r of readLines(join(dir, "cbact04c_xref.txt"))) {
    const rec = pad(r, 50);
    xrefByAcct.set(rec.slice(25, 36), rec.slice(0, 16));
  }
  const discRate = new Map<string, number>();
  for (const r of readLines(join(dir, "cbact04c_discgrp.txt"))) {
    const rec = pad(r, 50);
    const key = rec.slice(0, 10) + rec.slice(10, 12) + rec.slice(12, 16);
    discRate.set(key, decodeZonedInput(rec.slice(16, 22)));
  }
  return { tcatbal, accounts, xrefByAcct, discRate };
}

function discKey(groupId: string, typeCd: string, catCd: string): string {
  return pad(groupId, 10) + pad(typeCd, 2) + catCd;
}

/** Build one 350-byte TRANSACT record exactly as CBACT04C WRITEs it
 *  (with the DB2 timestamps already normalised to FIXED_TS). */
export function renderTransaction(
  tranId: string,
  acctId: string,
  interestCents: number,
  cardNum: string
): string {
  const rec =
    pad(tranId, 16) +
    "01" + // TRAN-TYPE-CD
    "0005" + // TRAN-CAT-CD (MOVE '05')
    pad("System", 10) + // TRAN-SOURCE
    pad("Int. for a/c " + acctId, 100) + // TRAN-DESC
    encodeZonedOutput(interestCents, 11) + // TRAN-AMT S9(09)V99
    "000000000" + // TRAN-MERCHANT-ID (0)
    pad("", 50) + // TRAN-MERCHANT-NAME
    pad("", 50) + // TRAN-MERCHANT-CITY
    pad("", 10) + // TRAN-MERCHANT-ZIP
    pad(cardNum, 16) + // TRAN-CARD-NUM
    FIXED_TS + // TRAN-ORIG-TS
    FIXED_TS + // TRAN-PROC-TS
    pad("", 20); // FILLER
  if (rec.length !== TRAN_RECLN) throw new Error(`bad tran length ${rec.length}`);
  return rec;
}

export function run(dir: string): string[] {
  const fx = loadFixtures(dir);
  // Two separate streams, mirroring the mainframe: program stdout and the
  // TRANSACT output file. The golden baseline concatenates stdout then the
  // rendered TRANSACT file, so we keep them apart and join at the end.
  const stdout: string[] = ["START OF EXECUTION OF PROGRAM CBACT04C"];
  const trans: string[] = [];

  let lastAcct = "";
  let suffix = 0;
  let curGroupId = "";
  let curCard = "";

  for (const t of fx.tcatbal) {
    // DISPLAY TRAN-CAT-BAL-RECORD (raw bytes, overpunch preserved)
    stdout.push(t.raw);

    if (t.acctId !== lastAcct) {
      lastAcct = t.acctId;
      const acct = fx.accounts.get(t.acctId);
      if (!acct) {
        stdout.push("ACCOUNT NOT FOUND: " + t.acctId);
        curGroupId = "";
      } else {
        curGroupId = acct.groupId;
      }
      const card = fx.xrefByAcct.get(t.acctId);
      if (card === undefined) {
        stdout.push("ACCOUNT NOT FOUND: " + t.acctId);
        curCard = "";
      } else {
        curCard = card;
      }
    }

    let rate = fx.discRate.get(discKey(curGroupId, t.typeCd, t.catCd));
    if (rate === undefined) {
      stdout.push("DISCLOSURE GROUP RECORD MISSING");
      stdout.push("TRY WITH DEFAULT GROUP CODE");
      rate = fx.discRate.get(discKey("DEFAULT", t.typeCd, t.catCd));
    }

    if (rate !== undefined && rate !== 0) {
      const interest = computeMonthlyInterestCents(t.balCents, rate);
      suffix += 1;
      const tranId = PARM_DATE + String(suffix).padStart(6, "0");
      trans.push(renderTransaction(tranId, t.acctId, interest, curCard));
    }
  }

  stdout.push("END OF EXECUTION OF PROGRAM CBACT04C");
  return [...stdout, ...trans];
}

if (require.main === module) {
  const dir = process.argv[2] ?? join(__dirname, "..", "..", "legacy");
  process.stdout.write(run(dir).join("\n") + "\n");
}
