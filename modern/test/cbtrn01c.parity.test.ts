/**
 * Differential (parity) test: the modernized CBTRN01C must reproduce the
 * legacy GnuCOBOL baseline output byte-for-byte for the sample fixtures.
 *
 * The baseline (legacy/out/cbtrn01c.golden.txt) is produced by compiling and
 * running the UNMODIFIED CardDemo COBOL program under GnuCOBOL. CI regenerates
 * it (see .github/workflows/cbtrn01c-parity.yml); locally it is read from disk.
 */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "fs";
import { join } from "path";
import { run, decodeZoned, displayAmount, parseDalytran } from "../src/cbtrn01c";

const legacyDir = join(__dirname, "..", "..", "legacy");
const dalytranPath = join(legacyDir, "cbtrn01c_dalytran.txt");
const xrefPath = join(legacyDir, "cbtrn01c_xref.txt");
const acctPath = join(legacyDir, "cbtrn01c_acct.txt");
const goldenPath = join(legacyDir, "out", "cbtrn01c.golden.txt");

test("modern output matches the COBOL golden baseline byte-for-byte", () => {
  const golden = readFileSync(goldenPath, "latin1").replace(/\n$/, "");
  const modern = run(dalytranPath, xrefPath, acctPath).join("\n");
  assert.strictEqual(modern, golden);
});

test("decodeZoned handles positive overpunch ({ .. I)", () => {
  assert.deepStrictEqual(decodeZoned("0000005047G"), { sign: 1, digits: "00000050477" });
  assert.deepStrictEqual(decodeZoned("0000001000{"), { sign: 1, digits: "00000010000" });
});

test("decodeZoned handles negative overpunch (} .. R)", () => {
  assert.deepStrictEqual(decodeZoned("0000009190}"), { sign: -1, digits: "00000091900" });
  assert.deepStrictEqual(decodeZoned("0000009190J"), { sign: -1, digits: "00000091901" });
});

test("displayAmount formats S9(9)V99 with sign and implied decimal", () => {
  assert.strictEqual(displayAmount("0000005047G"), "504.77");
  assert.strictEqual(displayAmount("0000009190}"), "-919.00");
  assert.strictEqual(displayAmount("0000001000{"), "100.00");
});

test("parseDalytran extracts id, card number and raw amount field", () => {
  const rec = readFileSync(dalytranPath, "latin1").slice(0, 350);
  const t = parseDalytran(rec);
  assert.strictEqual(t.id, "TRAN000000000001");
  assert.strictEqual(t.cardNum, "4111111111111111");
  assert.strictEqual(t.amountField, "0000005047G");
});
