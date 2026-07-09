/**
 * Cloud-native reimplementation of CardDemo batch program CBACT01C.
 *
 * Legacy behavior (app/cbl/CBACT01C.cbl): read the account master file
 * and, for every record, (1) print each field, (2) print the raw record,
 * and (3) derive VBRC-REC1 / VBRC-REC2 report lines. This port reproduces
 * that behavior exactly so its stdout matches the GnuCOBOL baseline
 * byte-for-byte (differential/parity testing).
 *
 * The legacy program reads an indexed (KSDS) ACCTFILE; here we read the
 * same fixed-length 300-byte records from the ASCII extract that seeds it.
 */
import { readFileSync } from "fs";

const RECLN = 300;

export interface Account {
  id: string; // ACCT-ID  PIC 9(11)
  activeStatus: string; // ACCT-ACTIVE-STATUS X(01)
  currBal: string; // S9(10)V99 zoned
  creditLimit: string; // S9(10)V99 zoned
  cashCreditLimit: string; // S9(10)V99 zoned
  openDate: string; // X(10)
  expirationDate: string; // X(10)
  reissueDate: string; // X(10)
  currCycCredit: string; // S9(10)V99 zoned
  currCycDebit: string; // S9(10)V99 zoned
  addrZip: string; // X(10)
  groupId: string; // X(10)
  raw: string; // full 300-byte record
}

/** Decode a 12-char zoned-decimal S9(10)V99 field with trailing overpunch. */
export function decodeZoned(field: string): { sign: 1 | -1; digits: string } {
  const body = field.slice(0, 11);
  const last = field[11];
  const posMap: Record<string, string> = {
    "{": "0", A: "1", B: "2", C: "3", D: "4", E: "5", F: "6", G: "7", H: "8", I: "9",
  };
  const negMap: Record<string, string> = {
    "}": "0", J: "1", K: "2", L: "3", M: "4", N: "5", O: "6", P: "7", Q: "8", R: "9",
  };
  if (last in posMap) return { sign: 1, digits: body + posMap[last] };
  if (last in negMap) return { sign: -1, digits: body + negMap[last] };
  return { sign: 1, digits: body + last }; // plain digit -> positive
}

/** Format a zoned field as COBOL DISPLAY of S9(10)V99: e.g. +0000000194.00 */
export function displaySigned(field: string): string {
  const { sign, digits } = decodeZoned(field);
  const intPart = digits.slice(0, 10);
  const decPart = digits.slice(10, 12);
  return `${sign < 0 ? "-" : "+"}${intPart}.${decPart}`;
}

/** Render a zoned field as it appears inside an alphanumeric report group. */
function normalizedZoned(field: string): string {
  const { digits } = decodeZoned(field);
  return digits; // positive normalization: trailing sign digit as plain digit
}

export function parseRecord(rec: string): Account {
  const r = rec.padEnd(RECLN, " ");
  return {
    id: r.slice(0, 11),
    activeStatus: r.slice(11, 12),
    currBal: r.slice(12, 24),
    creditLimit: r.slice(24, 36),
    cashCreditLimit: r.slice(36, 48),
    openDate: r.slice(48, 58),
    expirationDate: r.slice(58, 68),
    reissueDate: r.slice(68, 78),
    currCycCredit: r.slice(78, 90),
    currCycDebit: r.slice(90, 102),
    addrZip: r.slice(102, 112),
    groupId: r.slice(112, 122),
    raw: r,
  };
}

function displayField(label: string, value: string): string {
  // COBOL: DISPLAY 'LABEL      :' VALUE  -> label padded to 24 then value
  return `${label.padEnd(24, " ")}:${value}`;
}

/** Reconstruct the 300-byte ACCOUNT-RECORD as COBOL DISPLAYs it. */
function renderRecord(a: Account): string {
  const rec =
    a.id +
    a.activeStatus +
    normalizedZoned(a.currBal) +
    normalizedZoned(a.creditLimit) +
    normalizedZoned(a.cashCreditLimit) +
    a.openDate +
    a.expirationDate +
    a.reissueDate +
    normalizedZoned(a.currCycCredit) +
    normalizedZoned(a.currCycDebit) +
    a.addrZip +
    a.groupId;
  return rec.padEnd(RECLN, " ");
}

export function processAccount(a: Account): string[] {
  const out: string[] = [];
  // 1100-DISPLAY-ACCT-RECORD
  out.push(displayField("ACCT-ID", a.id));
  out.push(displayField("ACCT-ACTIVE-STATUS", a.activeStatus));
  out.push(displayField("ACCT-CURR-BAL", displaySigned(a.currBal)));
  out.push(displayField("ACCT-CREDIT-LIMIT", displaySigned(a.creditLimit)));
  out.push(displayField("ACCT-CASH-CREDIT-LIMIT", displaySigned(a.cashCreditLimit)));
  out.push(displayField("ACCT-OPEN-DATE", a.openDate));
  out.push(displayField("ACCT-EXPIRAION-DATE", a.expirationDate));
  out.push(displayField("ACCT-REISSUE-DATE", a.reissueDate));
  out.push(displayField("ACCT-CURR-CYC-CREDIT", displaySigned(a.currCycCredit)));
  out.push(displayField("ACCT-CURR-CYC-DEBIT", displaySigned(a.currCycDebit)));
  out.push(displayField("ACCT-GROUP-ID", a.groupId));
  out.push("-------------------------------------------------");
  // 1500-POPUL-VBRC-RECORD DISPLAYs
  const vb1 = a.id + a.activeStatus;
  const reissueYyyy = a.reissueDate.slice(0, 4);
  const vb2 = a.id + normalizedZoned(a.currBal) + normalizedZoned(a.creditLimit) + reissueYyyy;
  out.push(`VBRC-REC1:${vb1}`);
  out.push(`VBRC-REC2:${vb2}`);
  // main loop: DISPLAY ACCOUNT-RECORD. The signed numeric fields are
  // re-rendered from their numeric value (trailing overpunch normalized).
  out.push(renderRecord(a));
  return out;
}

export function run(dataPath: string): string[] {
  const text = readFileSync(dataPath, "latin1");
  const lines = text.split("\n").filter((l) => l.length > 0);
  const out: string[] = ["START OF EXECUTION OF PROGRAM CBACT01C"];
  for (const line of lines) {
    out.push(...processAccount(parseRecord(line)));
  }
  out.push("END OF EXECUTION OF PROGRAM CBACT01C");
  return out;
}

if (require.main === module) {
  const dataPath = process.argv[2] ?? "acctdata.txt";
  process.stdout.write(run(dataPath).join("\n") + "\n");
}
