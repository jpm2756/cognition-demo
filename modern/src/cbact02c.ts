/**
 * Cloud-native reimplementation of CardDemo batch program CBACT02C.
 *
 * Legacy behavior (app/cbl/CBACT02C.cbl): open the indexed (KSDS) CARDFILE,
 * read every record in key (CARD-NUM) order and `DISPLAY CARD-RECORD` — i.e.
 * echo the whole 150-byte card record — bracketed by START/END banner lines.
 * This port reproduces that behavior exactly so its stdout matches the
 * GnuCOBOL baseline byte-for-byte (differential/parity testing).
 *
 * The legacy program reads an indexed CARDFILE; here we read the same
 * fixed-length 150-byte records from the ASCII extract that seeds it. Because
 * every field in CARD-RECORD is USAGE DISPLAY (no signed/COMP-3 fields),
 * `DISPLAY CARD-RECORD` emits the record bytes unchanged; we still parse and
 * re-render the record from its fields to make the field layout explicit and
 * to exercise the encoding in unit tests.
 */
import { readFileSync } from "fs";

const RECLN = 150;

export interface Card {
  cardNum: string; // CARD-NUM            PIC X(16)
  acctId: string; // CARD-ACCT-ID        PIC 9(11)
  cvvCd: string; // CARD-CVV-CD         PIC 9(03)
  embossedName: string; // CARD-EMBOSSED-NAME  PIC X(50)
  expirationDate: string; // CARD-EXPIRAION-DATE PIC X(10)
  activeStatus: string; // CARD-ACTIVE-STATUS  PIC X(01)
  filler: string; // FILLER              PIC X(59)
  raw: string; // full 150-byte record
}

export function parseRecord(rec: string): Card {
  const r = rec.padEnd(RECLN, " ");
  return {
    cardNum: r.slice(0, 16),
    acctId: r.slice(16, 27),
    cvvCd: r.slice(27, 30),
    embossedName: r.slice(30, 80),
    expirationDate: r.slice(80, 90),
    activeStatus: r.slice(90, 91),
    filler: r.slice(91, 150),
    raw: r,
  };
}

/**
 * Reconstruct the 150-byte CARD-RECORD as COBOL `DISPLAY CARD-RECORD` renders
 * it. All fields are USAGE DISPLAY, so the group renders as the concatenation
 * of its fields (unsigned PIC 9 zoned digits are plain ASCII digits).
 */
export function renderRecord(c: Card): string {
  const rec =
    c.cardNum +
    c.acctId +
    c.cvvCd +
    c.embossedName +
    c.expirationDate +
    c.activeStatus +
    c.filler;
  return rec.padEnd(RECLN, " ");
}

export function processCard(c: Card): string[] {
  // Main loop: DISPLAY CARD-RECORD (one line per card record).
  return [renderRecord(c)];
}

export function run(dataPath: string): string[] {
  const text = readFileSync(dataPath, "latin1");
  const lines = text.split("\n").filter((l) => l.length > 0);
  const cards = lines.map(parseRecord);
  // The legacy program reads the KSDS sequentially, i.e. in ascending
  // RECORD KEY (CARD-NUM) order. Mirror that ordering for parity.
  cards.sort((a, b) => (a.cardNum < b.cardNum ? -1 : a.cardNum > b.cardNum ? 1 : 0));
  const out: string[] = ["START OF EXECUTION OF PROGRAM CBACT02C"];
  for (const c of cards) {
    out.push(...processCard(c));
  }
  out.push("END OF EXECUTION OF PROGRAM CBACT02C");
  return out;
}

if (require.main === module) {
  const dataPath = process.argv[2] ?? "../legacy/carddata.txt";
  process.stdout.write(run(dataPath).join("\n") + "\n");
}
