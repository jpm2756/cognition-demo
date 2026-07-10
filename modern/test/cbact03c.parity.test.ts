/**
 * Differential (parity) test: the modernized CBACT03C must reproduce the
 * legacy GnuCOBOL baseline output byte-for-byte for the sample card xref data.
 *
 * The baseline (legacy/out/cbact03c.golden.txt) is produced by compiling and
 * running the UNMODIFIED CardDemo COBOL program under GnuCOBOL. CI regenerates
 * it (see .github/workflows/cbact03c-parity.yml); locally it is read from disk.
 */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "fs";
import { join } from "path";
import { run, parseRecord, renderRecord, RECLN } from "../src/cbact03c";

const legacyDir = join(__dirname, "..", "..", "legacy");
const dataPath = join(legacyDir, "cardxref.txt");
const goldenPath = join(legacyDir, "out", "cbact03c.golden.txt");

test("modern output matches the COBOL golden baseline byte-for-byte", () => {
  const golden = readFileSync(goldenPath, "latin1").replace(/\n$/, "");
  const modern = run(dataPath).join("\n");
  assert.strictEqual(modern, golden);
});

test("each record is displayed twice (get-next + main loop)", () => {
  const lines = run(dataPath);
  // START + 2 lines per record + END
  const dataLines = lines.length - 2;
  assert.strictEqual(dataLines % 2, 0);
  assert.strictEqual(lines[1], lines[2]);
});

test("parseRecord splits the 50-byte record at the copybook boundaries", () => {
  const raw = "050002445376574000000005000000000050"; // 36 chars, no filler
  const x = parseRecord(raw);
  assert.strictEqual(x.cardNum, "0500024453765740");
  assert.strictEqual(x.custId, "000000050");
  assert.strictEqual(x.acctId, "00000000050");
  assert.strictEqual(x.filler, "              "); // 14 spaces
});

test("renderRecord pads the record to 50 bytes with trailing spaces", () => {
  const raw = "050002445376574000000005000000000050";
  const rendered = renderRecord(parseRecord(raw));
  assert.strictEqual(rendered.length, RECLN);
  assert.strictEqual(rendered, raw.padEnd(RECLN, " "));
});
