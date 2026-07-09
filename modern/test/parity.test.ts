/**
 * Differential (parity) test: the modernized CBACT01C must reproduce the
 * legacy GnuCOBOL baseline output byte-for-byte for the sample account data.
 *
 * The baseline (legacy/out/cbact01c.golden.txt) is produced by compiling and
 * running the UNMODIFIED CardDemo COBOL program under GnuCOBOL. CI regenerates
 * it (see .github/workflows/parity.yml); locally it is read from disk.
 */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "fs";
import { join } from "path";
import { run, decodeZoned, displaySigned } from "../src/cbact01c";

const legacyDir = join(__dirname, "..", "..", "legacy");
const dataPath = join(legacyDir, "acctdata.txt");
const goldenPath = join(legacyDir, "out", "cbact01c.golden.txt");

test("modern output matches the COBOL golden baseline byte-for-byte", () => {
  const golden = readFileSync(goldenPath, "latin1").replace(/\n$/, "");
  const modern = run(dataPath).join("\n");
  assert.strictEqual(modern, golden);
});

test("decodeZoned handles positive overpunch ({ .. I)", () => {
  assert.deepStrictEqual(decodeZoned("00000001940{"), { sign: 1, digits: "000000019400" });
  assert.deepStrictEqual(decodeZoned("00000001940A"), { sign: 1, digits: "000000019401" });
});

test("decodeZoned handles negative overpunch (} .. R)", () => {
  assert.deepStrictEqual(decodeZoned("00000001940}"), { sign: -1, digits: "000000019400" });
  assert.deepStrictEqual(decodeZoned("00000001940J"), { sign: -1, digits: "000000019401" });
});

test("displaySigned formats S9(10)V99 with sign and implied decimal", () => {
  assert.strictEqual(displaySigned("00000001940{"), "+0000000194.00");
  assert.strictEqual(displaySigned("00000001940}"), "-0000000194.00");
});
