/**
 * Cloud-native reimplementation of CardDemo batch program CBSTM03A
 * (driver) together with its file-processing subprogram CBSTM03B.
 *
 * Legacy behavior (app/cbl/CBSTM03A.CBL + CBSTM03B.CBL): for every card in
 * the cross-reference file, look up the owning customer and account, then
 * print an account statement in TWO formats — a fixed 80-column plain-text
 * statement (STMTFILE) and a 100-column HTML rendering (HTMLFILE) — listing
 * the card's transactions and their total. CBSTM03B is the I/O subroutine
 * that reads the indexed TRNX / XREF / CUST / ACCT files on the driver's
 * behalf.
 *
 * This port reproduces the exact observable output so its bytes match the
 * GnuCOBOL baseline byte-for-byte (differential/parity testing). The golden
 * baseline is the raw STMTFILE records (PIC X(80)) immediately followed by
 * the raw HTMLFILE records (PIC X(100)); see legacy/run_cbstm03a.sh.
 *
 * Off-platform note: the legacy driver opens with a z/OS control-block walk
 * (PSA -> TCB -> TIOT) that only DISPLAYs the JCL job/step and DD names to
 * the job log. That has no effect on the generated statements and cannot run
 * without a mainframe, so it is neither part of the parity surface nor
 * reproduced here (the baseline shims it out at build time).
 */
import { readFileSync } from "fs";
import { join } from "path";

const STMT_W = 80;
const HTML_W = 100;

/* ------------------------------------------------------------------ */
/* Fixed-width record layouts (byte offsets, 0-based half-open ranges) */
/* ------------------------------------------------------------------ */

export interface Xref {
  cardNum: string; // XREF-CARD-NUM  X(16)
  custId: string; // XREF-CUST-ID   9(09)
  acctId: string; // XREF-ACCT-ID   9(11)
}

export interface Customer {
  id: string; // CUST-ID 9(09)
  firstName: string; // X(25)
  middleName: string; // X(25)
  lastName: string; // X(25)
  addr1: string; // X(50)
  addr2: string; // X(50)
  addr3: string; // X(50)
  stateCd: string; // X(02)
  countryCd: string; // X(03)
  zip: string; // X(10)
  fico: string; // 9(03)
}

export interface Account {
  id: string; // ACCT-ID 9(11)
  currBal: string; // ACCT-CURR-BAL S9(10)V99 zoned (12 bytes)
}

export interface Transaction {
  cardNum: string; // TRNX-CARD-NUM X(16)
  id: string; // TRNX-ID X(16)
  desc: string; // TRNX-DESC X(100)
  amt: string; // TRNX-AMT S9(9)V99 zoned (11 bytes)
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s.padEnd(n, " ");
}

export function parseXref(rec: string): Xref {
  const r = pad(rec, 50);
  return { cardNum: r.slice(0, 16), custId: r.slice(16, 25), acctId: r.slice(25, 36) };
}

export function parseCustomer(rec: string): Customer {
  const r = pad(rec, 500);
  return {
    id: r.slice(0, 9),
    firstName: r.slice(9, 34),
    middleName: r.slice(34, 59),
    lastName: r.slice(59, 84),
    addr1: r.slice(84, 134),
    addr2: r.slice(134, 184),
    addr3: r.slice(184, 234),
    stateCd: r.slice(234, 236),
    countryCd: r.slice(236, 239),
    zip: r.slice(239, 249),
    fico: r.slice(329, 332),
  };
}

export function parseAccount(rec: string): Account {
  const r = pad(rec, 300);
  return { id: r.slice(0, 11), currBal: r.slice(12, 24) };
}

export function parseTransaction(rec: string): Transaction {
  const r = pad(rec, 350);
  const rest = r.slice(32, 350); // TRNX-REST
  return {
    cardNum: r.slice(0, 16),
    id: r.slice(16, 32),
    desc: rest.slice(16, 116),
    amt: rest.slice(116, 127),
  };
}

/* ------------------------------------------------------------------ */
/* Numeric encodings                                                   */
/* ------------------------------------------------------------------ */

/**
 * Decode a zoned-decimal field using GnuCOBOL's default ASCII trailing-sign
 * convention: a positive number keeps a plain trailing digit ('0'-'9'); a
 * negative number encodes the trailing digit as 0x70+digit ('p'-'y').
 * Returns the sign and the normalized all-digit string.
 */
export function decodeZoned(field: string): { sign: 1 | -1; digits: string } {
  const head = field.slice(0, -1);
  const code = field.charCodeAt(field.length - 1);
  if (code >= 0x30 && code <= 0x39) return { sign: 1, digits: head + String(code - 0x30) };
  if (code >= 0x70 && code <= 0x79) return { sign: -1, digits: head + String(code - 0x70) };
  return { sign: 1, digits: head + "0" };
}

/** Integer value (in implied-decimal units, i.e. cents) of a zoned field. */
export function zonedToCents(field: string): number {
  const { sign, digits } = decodeZoned(field);
  return sign * Number(digits);
}

/** Format S9(10)V99 as COBOL PIC 9(9).99- : 9 zero-filled int digits, sign. */
export function pic9v99Minus(field: string): string {
  const { sign, digits } = decodeZoned(field);
  const dec = digits.slice(-2);
  const int9 = digits.slice(0, -2).slice(-9);
  return `${int9}.${dec}${sign < 0 ? "-" : " "}`;
}

/** Format a signed cents value as COBOL PIC Z(9).99- : blank-suppressed int. */
export function picZ9v99Minus(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const intPart = Math.floor(abs / 100);
  const dec = String(abs % 100).padStart(2, "0");
  const intStr = intPart === 0 ? "" : String(intPart);
  return `${intStr.padStart(9, " ")}.${dec}${neg ? "-" : " "}`;
}

/** Emulate COBOL STRING ... DELIMITED BY ' ': text up to the first space. */
function upToSpace(s: string): string {
  const i = s.indexOf(" ");
  return i < 0 ? s : s.slice(0, i);
}

/** Emulate COBOL STRING ... DELIMITED BY '  ': text up to the first 2 spaces. */
function upToDoubleSpace(s: string): string {
  const i = s.indexOf("  ");
  return i < 0 ? s : s.slice(0, i);
}

/* ------------------------------------------------------------------ */
/* Constant report lines (data-independent)                            */
/* ------------------------------------------------------------------ */

const DASHES = "-".repeat(80);
const ST_LINE0 = "*".repeat(31) + "START OF STATEMENT" + "*".repeat(31);
const ST_LINE6 = " ".repeat(33) + pad("Basic Details", 14) + " ".repeat(33);
const ST_LINE11 = " ".repeat(30) + "TRANSACTION SUMMARY " + " ".repeat(30);
const ST_LINE13 = pad("Tran ID", 16) + pad("Tran Details", 51) + "  Tran Amount";
const ST_LINE15 = "*".repeat(32) + "END OF STATEMENT" + "*".repeat(32);

const H = {
  L01: "<!DOCTYPE html>",
  L02: '<html lang="en">',
  L03: "<head>",
  L04: '<meta charset="utf-8">',
  L05: "<title>HTML Table Layout</title>",
  L06: "</head>",
  L07: '<body style="margin:0px;">',
  L08: '<table  align="center" frame="box" style="width:70%; font:12px Segoe UI,sans-serif;">',
  TRS: "<tr>",
  TRE: "</tr>",
  TDE: "</td>",
  L10: '<td colspan="3" style="padding:0px 5px;background-color:#1d1d96b3;">',
  L15: '<td colspan="3" style="padding:0px 5px;background-color:#FFAF33;">',
  L16: '<p style="font-size:16px">Bank of XYZ</p>',
  L17: "<p>410 Terry Ave N</p>",
  L18: "<p>Seattle WA 99999</p>",
  L22: '<td colspan="3" style="padding:0px 5px;background-color:#f2f2f2;">',
  L30: '<td colspan="3" style="padding:0px 5px;background-color:#33FFD1; text-align:center;">',
  L31: '<p style="font-size:16px">Basic Details</p>',
  L43: '<p style="font-size:16px">Transaction Summary</p>',
  L47: '<td style="width:25%; padding:0px 5px; background-color:#33FF5E; text-align:left;">',
  L48: '<p style="font-size:16px">Tran ID</p>',
  L50: '<td style="width:55%; padding:0px 5px; background-color:#33FF5E; text-align:left;">',
  L51: '<p style="font-size:16px">Tran Details</p>',
  L53: '<td style="width:20%; padding:0px 5px; background-color:#33FF5E; text-align:right;">',
  L54: '<p style="font-size:16px">Amount</p>',
  L58: '<td style="width:25%; padding:0px 5px; background-color:#f2f2f2; text-align:left;">',
  L61: '<td style="width:55%; padding:0px 5px; background-color:#f2f2f2; text-align:left;">',
  L64: '<td style="width:20%; padding:0px 5px; background-color:#f2f2f2; text-align:right;">',
  L75: "<h3>End of Statement</h3>",
  L78: "</table>",
  L79: "</body>",
  L80: "</html>",
};

/* ------------------------------------------------------------------ */
/* Statement generation                                                */
/* ------------------------------------------------------------------ */

export interface Statement {
  stmt: string[]; // PIC X(80) records
  html: string[]; // PIC X(100) records
}

export function createStatement(
  cust: Customer,
  acct: Account,
  txns: Transaction[]
): Statement {
  const stmt: string[] = [];
  const html: string[] = [];
  const s = (line: string) => stmt.push(pad(line, STMT_W));
  const h = (line: string) => html.push(pad(line, HTML_W));

  // ST-NAME / ST-ADD* (COBOL STRING ... DELIMITED BY ' ')
  const stName = pad(
    `${upToSpace(cust.firstName)} ${upToSpace(cust.middleName)} ${upToSpace(cust.lastName)} `,
    75
  );
  const stAdd1 = pad(cust.addr1, 50);
  const stAdd2 = pad(cust.addr2, 50);
  const stAdd3 = pad(
    `${upToSpace(cust.addr3)} ${upToSpace(cust.stateCd)} ${upToSpace(cust.countryCd)} ${upToSpace(cust.zip)} `,
    80
  );
  const stAcctId = pad(acct.id, 20);
  const stCurrBal = pic9v99Minus(acct.currBal); // 13 chars
  const stFico = pad(cust.fico, 20);

  // 5000-CREATE-STATEMENT: ST-LINE0 first
  s(ST_LINE0);

  // 5100-WRITE-HTML-HEADER
  h(H.L01); h(H.L02); h(H.L03); h(H.L04); h(H.L05); h(H.L06); h(H.L07); h(H.L08);
  h(H.TRS); h(H.L10);
  h("<h3>Statement for Account Number: " + stAcctId + "</h3>");
  h(H.TDE); h(H.TRE);
  h(H.TRS); h(H.L15); h(H.L16); h(H.L17); h(H.L18); h(H.TDE); h(H.TRE);
  h(H.TRS); h(H.L22);

  // 5200-WRITE-HTML-NMADBS
  h('<p style="font-size:16px">' + upToDoubleSpace(pad(stName, 50)) + "  </p>");
  h("<p>" + upToDoubleSpace(stAdd1) + "  </p>");
  h("<p>" + upToDoubleSpace(stAdd2) + "  </p>");
  h("<p>" + upToDoubleSpace(stAdd3) + "  </p>");
  h(H.TDE); h(H.TRE);
  h(H.TRS); h(H.L30); h(H.L31); h(H.TDE); h(H.TRE);
  h(H.TRS); h(H.L22);
  h("<p>Account ID         : " + stAcctId + "</p>");
  h("<p>Current Balance    : " + stCurrBal + "</p>");
  h("<p>FICO Score         : " + stFico + "</p>");
  h(H.TDE); h(H.TRE);
  h(H.TRS); h(H.L30); h(H.L43); h(H.TDE); h(H.TRE);
  h(H.TRS); h(H.L47); h(H.L48); h(H.TDE);
  h(H.L50); h(H.L51); h(H.TDE);
  h(H.L53); h(H.L54); h(H.TDE); h(H.TRE);

  // 5000: text statement body
  s(stName);
  s(stAdd1);
  s(stAdd2);
  s(stAdd3);
  s(DASHES);
  s(ST_LINE6);
  s(DASHES);
  s("Account ID         :" + stAcctId);
  s("Current Balance    :" + stCurrBal);
  s("FICO Score         :" + stFico);
  s(DASHES);
  s(ST_LINE11);
  s(DASHES);
  s(ST_LINE13);
  s(DASHES);

  // 4000-TRNXFILE-GET: transactions + running total
  let totalCents = 0;
  for (const t of txns) {
    // 6000-WRITE-TRANS (text)
    const stTranId = pad(t.id, 16);
    const stTrandt = pad(t.desc, 49);
    const stTranAmt = picZ9v99Minus(zonedToCents(t.amt));
    s(stTranId + " " + stTrandt + "$" + stTranAmt);

    // 6000-WRITE-TRANS (html)
    h(H.TRS);
    h(H.L58); h("<p>" + stTranId + "</p>"); h(H.TDE);
    h(H.L61); h("<p>" + stTrandt + "</p>"); h(H.TDE);
    h(H.L64); h("<p>" + stTranAmt + "</p>"); h(H.TDE);
    h(H.TRE);

    totalCents += zonedToCents(t.amt);
  }

  // 4000: statement footer
  const stTotal = picZ9v99Minus(totalCents);
  s(DASHES);
  s(pad("Total EXP:", 10) + " ".repeat(56) + "$" + stTotal);
  s(ST_LINE15);

  // 4000: html footer
  h(H.TRS); h(H.L10); h(H.L75); h(H.TDE); h(H.TRE);
  h(H.L78); h(H.L79); h(H.L80);

  return { stmt, html };
}

/* ------------------------------------------------------------------ */
/* Driver                                                              */
/* ------------------------------------------------------------------ */

function readRecords(path: string): string[] {
  return readFileSync(path, "latin1")
    .split("\n")
    .filter((l) => l.length > 0);
}

export function run(dir: string): string {
  const xrefs = readRecords(join(dir, "cbstm03a_xref.txt")).map(parseXref);
  const custs = readRecords(join(dir, "cbstm03a_cust.txt")).map(parseCustomer);
  const accts = readRecords(join(dir, "cbstm03a_acct.txt")).map(parseAccount);
  const txns = readRecords(join(dir, "cbstm03a_trnx.txt")).map(parseTransaction);

  const custById = new Map(custs.map((c) => [c.id, c]));
  const acctById = new Map(accts.map((a) => [a.id, a]));
  const txnByCard = new Map<string, Transaction[]>();
  for (const t of txns) {
    const list = txnByCard.get(t.cardNum) ?? [];
    list.push(t);
    txnByCard.set(t.cardNum, list);
  }

  const stmt: string[] = [];
  const html: string[] = [];
  for (const x of xrefs) {
    const cust = custById.get(x.custId);
    const acct = acctById.get(x.acctId);
    if (!cust) throw new Error(`CUSTFILE miss for cust-id ${x.custId}`);
    if (!acct) throw new Error(`ACCTFILE miss for acct-id ${x.acctId}`);
    const out = createStatement(cust, acct, txnByCard.get(x.cardNum) ?? []);
    stmt.push(...out.stmt);
    html.push(...out.html);
  }

  return stmt.join("") + html.join("");
}

if (require.main === module) {
  const dir = process.argv[2] ?? join(__dirname, "..", "..", "legacy");
  process.stdout.write(run(dir));
}
