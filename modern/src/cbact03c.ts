/**
 * Cloud-native reimplementation of CardDemo batch program CBACT03C.
 *
 * Legacy behavior (app/cbl/CBACT03C.cbl): read the card cross-reference
 * file (XREFFILE) sequentially and, for every record, DISPLAY the whole
 * CARD-XREF-RECORD. The record is printed TWICE per read — once inside the
 * I/O paragraph 1000-XREFFILE-GET-NEXT and once in the main loop — so each
 * input record yields two identical output lines. Output is bookended by
 * START/END OF EXECUTION banners.
 *
 * This port reproduces that behavior exactly so its stdout matches the
 * GnuCOBOL baseline byte-for-byte (differential/parity testing).
 *
 * The legacy program reads an indexed (KSDS) XREFFILE; here we read the
 * same fixed-length 50-byte records from the ASCII extract that seeds it.
 */
import { readFileSync } from "fs";

/** CARD-XREF-RECORD (copybook CVACT03Y) is 50 bytes long. */
export const RECLN = 50;

export interface CardXref {
  cardNum: string; // XREF-CARD-NUM   PIC X(16)
  custId: string; // XREF-CUST-ID     PIC 9(09)
  acctId: string; // XREF-ACCT-ID     PIC 9(11)
  filler: string; // FILLER           PIC X(14)
}

/** Parse a raw line into the CARD-XREF-RECORD fields (padded to 50 bytes). */
export function parseRecord(rec: string): CardXref {
  const r = rec.padEnd(RECLN, " ");
  return {
    cardNum: r.slice(0, 16),
    custId: r.slice(16, 25),
    acctId: r.slice(25, 36),
    filler: r.slice(36, 50),
  };
}

/**
 * Reconstruct the 50-byte CARD-XREF-RECORD as COBOL DISPLAYs it.
 *
 * XREF-CUST-ID / XREF-ACCT-ID are unsigned PIC 9 (no overpunch sign), so
 * they render as their plain digits. Rebuilding from parsed fields (rather
 * than echoing raw bytes) mirrors the reference port and guarantees the
 * width/padding matches the COBOL group DISPLAY exactly.
 */
export function renderRecord(x: CardXref): string {
  const rec = x.cardNum + x.custId + x.acctId + x.filler;
  return rec.padEnd(RECLN, " ");
}

/** Emit the two identical DISPLAY lines the legacy program produces per record. */
export function processRecord(x: CardXref): string[] {
  const line = renderRecord(x);
  return [line, line];
}

export function run(dataPath: string): string[] {
  const text = readFileSync(dataPath, "latin1");
  const lines = text.split("\n").filter((l) => l.length > 0);
  const out: string[] = ["START OF EXECUTION OF PROGRAM CBACT03C"];
  for (const line of lines) {
    out.push(...processRecord(parseRecord(line)));
  }
  out.push("END OF EXECUTION OF PROGRAM CBACT03C");
  return out;
}

if (require.main === module) {
  const dataPath = process.argv[2] ?? "../legacy/cardxref.txt";
  process.stdout.write(run(dataPath).join("\n") + "\n");
}
