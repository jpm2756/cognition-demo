/**
 * Cloud-native reimplementation of CardDemo batch program CBCUS01C.
 *
 * Legacy behavior (app/cbl/CBCUS01C.cbl): read the customer master file
 * (CUSTFILE) sequentially and, for every record, print the raw 500-byte
 * CUSTOMER-RECORD. The record is DISPLAYed TWICE per read: once inside
 * 1000-CUSTFILE-GET-NEXT (right after a status-'00' read) and once in the
 * main PERFORM loop. This port reproduces that behavior exactly so its
 * stdout matches the GnuCOBOL baseline byte-for-byte (differential/parity
 * testing).
 *
 * The legacy program reads an indexed (KSDS) CUSTFILE; here we read the
 * same fixed-length 500-byte records from the ASCII extract that seeds it.
 * CUSTOMER-RECORD has no signed/zoned-decimal fields (all numeric fields
 * are unsigned PIC 9), so DISPLAY of the group echoes the raw bytes with
 * no overpunch normalization.
 */
import { readFileSync } from "fs";

const RECLN = 500;

export interface Customer {
  id: string; // CUST-ID                  PIC 9(09)
  firstName: string; // CUST-FIRST-NAME    PIC X(25)
  middleName: string; // CUST-MIDDLE-NAME  PIC X(25)
  lastName: string; // CUST-LAST-NAME      PIC X(25)
  addrLine1: string; // CUST-ADDR-LINE-1   PIC X(50)
  addrLine2: string; // CUST-ADDR-LINE-2   PIC X(50)
  addrLine3: string; // CUST-ADDR-LINE-3   PIC X(50)
  addrStateCd: string; // CUST-ADDR-STATE-CD    PIC X(02)
  addrCountryCd: string; // CUST-ADDR-COUNTRY-CD  PIC X(03)
  addrZip: string; // CUST-ADDR-ZIP        PIC X(10)
  phoneNum1: string; // CUST-PHONE-NUM-1   PIC X(15)
  phoneNum2: string; // CUST-PHONE-NUM-2   PIC X(15)
  ssn: string; // CUST-SSN                 PIC 9(09)
  govtIssuedId: string; // CUST-GOVT-ISSUED-ID  PIC X(20)
  dob: string; // CUST-DOB-YYYY-MM-DD      PIC X(10)
  eftAccountId: string; // CUST-EFT-ACCOUNT-ID  PIC X(10)
  priCardHolderInd: string; // CUST-PRI-CARD-HOLDER-IND  PIC X(01)
  ficoScore: string; // CUST-FICO-CREDIT-SCORE    PIC 9(03)
  filler: string; // FILLER                 PIC X(168)
  raw: string; // full 500-byte record
}

/** Parse a fixed 500-byte CUSTOMER-RECORD (CVCUS01Y layout). */
export function parseRecord(rec: string): Customer {
  const r = rec.padEnd(RECLN, " ");
  return {
    id: r.slice(0, 9),
    firstName: r.slice(9, 34),
    middleName: r.slice(34, 59),
    lastName: r.slice(59, 84),
    addrLine1: r.slice(84, 134),
    addrLine2: r.slice(134, 184),
    addrLine3: r.slice(184, 234),
    addrStateCd: r.slice(234, 236),
    addrCountryCd: r.slice(236, 239),
    addrZip: r.slice(239, 249),
    phoneNum1: r.slice(249, 264),
    phoneNum2: r.slice(264, 279),
    ssn: r.slice(279, 288),
    govtIssuedId: r.slice(288, 308),
    dob: r.slice(308, 318),
    eftAccountId: r.slice(318, 328),
    priCardHolderInd: r.slice(328, 329),
    ficoScore: r.slice(329, 332),
    filler: r.slice(332, 500),
    raw: r,
  };
}

/**
 * Reconstruct the 500-byte CUSTOMER-RECORD as COBOL DISPLAYs it. All fields
 * are alphanumeric or unsigned numeric, so the group DISPLAY is a straight
 * byte echo (no overpunch/sign normalization) — but we rebuild from parsed
 * fields to mirror the modernization technique and guarantee field widths.
 */
export function renderRecord(c: Customer): string {
  const rec =
    c.id +
    c.firstName +
    c.middleName +
    c.lastName +
    c.addrLine1 +
    c.addrLine2 +
    c.addrLine3 +
    c.addrStateCd +
    c.addrCountryCd +
    c.addrZip +
    c.phoneNum1 +
    c.phoneNum2 +
    c.ssn +
    c.govtIssuedId +
    c.dob +
    c.eftAccountId +
    c.priCardHolderInd +
    c.ficoScore +
    c.filler;
  return rec.padEnd(RECLN, " ");
}

export function processCustomer(c: Customer): string[] {
  // The legacy program DISPLAYs CUSTOMER-RECORD twice per record:
  //   1) inside 1000-CUSTFILE-GET-NEXT after a successful READ
  //   2) in the main PERFORM loop (END-OF-FILE = 'N')
  const line = renderRecord(c);
  return [line, line];
}

export function run(dataPath: string): string[] {
  const text = readFileSync(dataPath, "latin1");
  const lines = text.split("\n").filter((l) => l.length > 0);
  const out: string[] = ["START OF EXECUTION OF PROGRAM CBCUS01C"];
  for (const line of lines) {
    out.push(...processCustomer(parseRecord(line)));
  }
  out.push("END OF EXECUTION OF PROGRAM CBCUS01C");
  return out;
}

if (require.main === module) {
  const dataPath = process.argv[2] ?? "../legacy/custdata.txt";
  process.stdout.write(run(dataPath).join("\n") + "\n");
}
