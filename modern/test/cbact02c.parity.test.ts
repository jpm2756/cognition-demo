/**
 * Differential (parity) test: the modernized CBACT02C must reproduce the
 * legacy GnuCOBOL baseline output byte-for-byte for the sample card data.
 *
 * The baseline (legacy/out/cbact02c.golden.txt) is produced by compiling and
 * running the UNMODIFIED CardDemo COBOL program under GnuCOBOL. CI regenerates
 * it (see .github/workflows/cbact02c-parity.yml); locally it is read from disk.
 */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "fs";
import { join } from "path";
import { run, parseRecord, renderRecord } from "../src/cbact02c";

const legacyDir = join(__dirname, "..", "..", "legacy");
const dataPath = join(legacyDir, "carddata.txt");
const goldenPath = join(legacyDir, "out", "cbact02c.golden.txt");

test("modern output matches the COBOL golden baseline byte-for-byte", () => {
  const golden = readFileSync(goldenPath, "latin1").replace(/\n$/, "");
  const modern = run(dataPath).join("\n");
  assert.strictEqual(modern, golden);
});

test("parseRecord splits CARD-RECORD into its fixed-width fields", () => {
  // Build a deterministic 150-byte record explicitly.
  const built =
    "0500024453765740" + // CARD-NUM (16)
    "00000000005" + // CARD-ACCT-ID 9(11)
    "747" + // CARD-CVV-CD 9(03)
    "Aniya Von".padEnd(50, " ") + // CARD-EMBOSSED-NAME X(50)
    "2023-03-09" + // CARD-EXPIRAION-DATE X(10)
    "Y" + // CARD-ACTIVE-STATUS X(01)
    "".padEnd(59, " "); // FILLER X(59)
  const c = parseRecord(built);
  assert.strictEqual(c.cardNum, "0500024453765740");
  assert.strictEqual(c.acctId, "00000000005");
  assert.strictEqual(c.cvvCd, "747");
  assert.strictEqual(c.embossedName, "Aniya Von".padEnd(50, " "));
  assert.strictEqual(c.expirationDate, "2023-03-09");
  assert.strictEqual(c.activeStatus, "Y");
  assert.strictEqual(c.filler.length, 59);
});

test("renderRecord round-trips a 150-byte record byte-for-byte", () => {
  const built =
    "0500024453765740" +
    "00000000005" +
    "747" +
    "Aniya Von".padEnd(50, " ") +
    "2023-03-09" +
    "Y" +
    "".padEnd(59, " ");
  assert.strictEqual(built.length, 150);
  assert.strictEqual(renderRecord(parseRecord(built)), built);
});

test("short records are right-padded to the 150-byte record length", () => {
  const c = parseRecord("1234567890123456");
  assert.strictEqual(c.raw.length, 150);
  assert.strictEqual(renderRecord(c).length, 150);
});
