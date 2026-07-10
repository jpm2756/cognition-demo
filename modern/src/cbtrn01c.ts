/**
 * Cloud-native reimplementation of CardDemo batch program CBTRN01C.
 *
 * Legacy behavior (app/cbl/CBTRN01C.cbl): read the daily transaction file
 * (DALYTRAN, plain sequential) and, for every transaction, (1) print the raw
 * transaction record, (2) look the card number up in the card cross-reference
 * (XREFFILE), printing the xref fields on success or a "could not be verified"
 * message on failure, and (3) when the xref resolves, read the referenced
 * account (ACCTFILE) and print success / "NOT FOUND". CUSTFILE, CARDFILE and
 * TRANFILE are opened but never read in the main loop, so they do not affect
 * stdout.
 *
 * This port reproduces that behavior exactly so its stdout matches the
 * GnuCOBOL baseline byte-for-byte (differential/parity testing), including two
 * non-obvious quirks:
 *   - DISPLAY of the whole DALYTRAN-RECORD echoes the raw record bytes (the
 *     signed DALYTRAN-AMT overpunch is NOT normalized).
 *   - On end-of-file, READ ... INTO leaves DALYTRAN-RECORD unchanged, so the
 *     program performs ONE extra xref lookup on the last transaction's leftover
 *     card number, duplicating that transaction's lookup output.
 */
import { readFileSync } from "fs";

const DALYTRAN_LEN = 350;

// DALYTRAN-RECORD field offsets (CVTRA06Y).
const OFF_ID = [0, 16] as const; // DALYTRAN-ID           X(16)
const OFF_AMT = [132, 143] as const; // DALYTRAN-AMT       S9(09)V99 (11 bytes)
const OFF_CARD = [262, 278] as const; // DALYTRAN-CARD-NUM X(16)

const POS_MAP: Record<string, string> = {
  "{": "0", A: "1", B: "2", C: "3", D: "4", E: "5", F: "6", G: "7", H: "8", I: "9",
};
const NEG_MAP: Record<string, string> = {
  "}": "0", J: "1", K: "2", L: "3", M: "4", N: "5", O: "6", P: "7", Q: "8", R: "9",
};

/** Decode a zoned-decimal field with a trailing overpunch sign into sign+digits. */
export function decodeZoned(field: string): { sign: 1 | -1; digits: string } {
  const body = field.slice(0, -1);
  const last = field[field.length - 1];
  if (last in POS_MAP) return { sign: 1, digits: body + POS_MAP[last] };
  if (last in NEG_MAP) return { sign: -1, digits: body + NEG_MAP[last] };
  return { sign: 1, digits: body + last };
}

/** Format a zoned S9(9)V99 amount as a signed decimal string, e.g. -0000009190} -> -919.00. */
export function displayAmount(field: string): string {
  const { sign, digits } = decodeZoned(field);
  const intPart = digits.slice(0, digits.length - 2).replace(/^0+(?=\d)/, "");
  const decPart = digits.slice(digits.length - 2);
  return `${sign < 0 ? "-" : ""}${intPart}.${decPart}`;
}

export interface DalyTran {
  raw: string; // full 350-byte record (as DISPLAYed)
  id: string; // DALYTRAN-ID       X(16)
  cardNum: string; // DALYTRAN-CARD-NUM X(16)
  amountField: string; // DALYTRAN-AMT raw 11-byte zoned field
}

export function parseDalytran(rec: string): DalyTran {
  const r = rec.padEnd(DALYTRAN_LEN, " ");
  return {
    raw: r,
    id: r.slice(OFF_ID[0], OFF_ID[1]),
    cardNum: r.slice(OFF_CARD[0], OFF_CARD[1]),
    amountField: r.slice(OFF_AMT[0], OFF_AMT[1]),
  };
}

export interface XrefRecord {
  cardNum: string; // XREF-CARD-NUM X(16)
  custId: string; // XREF-CUST-ID  9(09)
  acctId: string; // XREF-ACCT-ID  9(11)
}

/** Load the card cross-reference fixture into a map keyed by card number. */
export function loadXref(path: string): Map<string, XrefRecord> {
  const map = new Map<string, XrefRecord>();
  for (const line of readLines(path)) {
    const r = line.padEnd(50, " ");
    const cardNum = r.slice(0, 16);
    map.set(cardNum, { cardNum, custId: r.slice(16, 25), acctId: r.slice(25, 36) });
  }
  return map;
}

/** Load the account master fixture as the set of existing 11-digit account ids. */
export function loadAccounts(path: string): Set<string> {
  const set = new Set<string>();
  for (const line of readLines(path)) {
    set.add(line.padEnd(300, " ").slice(0, 11));
  }
  return set;
}

function readLines(path: string): string[] {
  return readFileSync(path, "latin1").split("\n").filter((l) => l.length > 0);
}

/** Read a fixed-length record-sequential file (no delimiters) into records. */
function readFixed(path: string, len: number): string[] {
  const text = readFileSync(path, "latin1").replace(/\n+$/, "");
  const out: string[] = [];
  for (let i = 0; i + len <= text.length; i += len) out.push(text.slice(i, i + len));
  return out;
}

export function run(dalytranPath: string, xrefPath: string, acctPath: string): string[] {
  const records = readFixed(dalytranPath, DALYTRAN_LEN);
  const xref = loadXref(xrefPath);
  const accounts = loadAccounts(acctPath);

  const out: string[] = ["START OF EXECUTION OF PROGRAM CBTRN01C"];
  let daly = parseDalytran(" ".repeat(DALYTRAN_LEN));
  let idx = 0;
  let endOfFile = false;

  while (!endOfFile) {
    // 1000-DALYTRAN-GET-NEXT: on EOF the READ INTO target is left unchanged.
    if (idx < records.length) {
      daly = parseDalytran(records[idx]);
      idx += 1;
      out.push(daly.raw); // DISPLAY DALYTRAN-RECORD (only when not EOF)
    } else {
      endOfFile = true;
    }

    // 2000-LOOKUP-XREF (runs every iteration, incl. the EOF iteration).
    const xrefRec = xref.get(daly.cardNum);
    if (xrefRec) {
      out.push("SUCCESSFUL READ OF XREF");
      out.push(`CARD NUMBER: ${xrefRec.cardNum}`);
      out.push(`ACCOUNT ID : ${xrefRec.acctId}`);
      out.push(`CUSTOMER ID: ${xrefRec.custId}`);
      // 3000-READ-ACCOUNT
      if (accounts.has(xrefRec.acctId)) {
        out.push("SUCCESSFUL READ OF ACCOUNT FILE");
      } else {
        out.push("INVALID ACCOUNT NUMBER FOUND");
        out.push(`ACCOUNT ${xrefRec.acctId} NOT FOUND`);
      }
    } else {
      out.push("INVALID CARD NUMBER FOR XREF");
      out.push(
        `CARD NUMBER ${daly.cardNum} COULD NOT BE VERIFIED. SKIPPING TRANSACTION ID-${daly.id}`
      );
    }
  }

  out.push("END OF EXECUTION OF PROGRAM CBTRN01C");
  return out;
}

if (require.main === module) {
  const [d, x, a] = process.argv.slice(2);
  const out = run(
    d ?? "../legacy/cbtrn01c_dalytran.txt",
    x ?? "../legacy/cbtrn01c_xref.txt",
    a ?? "../legacy/cbtrn01c_acct.txt"
  );
  process.stdout.write(out.join("\n") + "\n");
}
