/**
 * Differential (parity) test: the modernized CBEXPORT must reproduce the
 * legacy GnuCOBOL export file byte-for-byte for the sample fixtures.
 *
 * The baseline (legacy/out/cbexport.golden.txt) is produced by compiling and
 * running the UNMODIFIED CardDemo COBOL program under GnuCOBOL. CI regenerates
 * it (see .github/workflows/cbexport-parity.yml); locally it is read from disk.
 */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "fs";
import { join } from "path";
import {
  run,
  gnuDecodeZoned,
  packComp3,
  packCompBinary,
  bytesForDigits,
} from "../src/cbexport";

const legacyDir = join(__dirname, "..", "..", "legacy");
const dataDir = join(legacyDir, "cbexport_data");
const goldenPath = join(legacyDir, "out", "cbexport.golden.txt");

test("modern export matches the COBOL golden baseline byte-for-byte", () => {
  const golden = readFileSync(goldenPath);
  const modern = run(dataDir);
  assert.strictEqual(modern.length, golden.length, "record byte count differs");
  assert.ok(modern.equals(golden), "export bytes differ from golden baseline");
});

test("bytesForDigits mirrors GnuCOBOL -std=mf binary-size 1--8", () => {
  assert.strictEqual(bytesForDigits(3), 2);
  assert.strictEqual(bytesForDigits(9), 4);
  assert.strictEqual(bytesForDigits(11), 5);
  assert.strictEqual(bytesForDigits(12), 6);
});

test("gnuDecodeZoned handles GnuCOBOL trailing-sign overpunch", () => {
  // plain digit -> positive
  assert.deepStrictEqual(gnuDecodeZoned("0000005047"), { negative: false, digits: "0000005047" });
  // 'p'..'y' -> negative digit 0..9
  assert.deepStrictEqual(gnuDecodeZoned("000000504q"), { negative: true, digits: "0000005041" });
  // '{' / letters treated as digit 0, positive (matches -std=mf)
  assert.deepStrictEqual(gnuDecodeZoned("00000001940{"), { negative: false, digits: "000000019400" });
  assert.deepStrictEqual(gnuDecodeZoned("0000005047G"), { negative: false, digits: "00000050470" });
  assert.deepStrictEqual(gnuDecodeZoned("0000009190}"), { negative: false, digits: "00000091900" });
});

test("packComp3 packs signed/unsigned packed-decimal correctly", () => {
  // S9(10)V99 = 194.00 positive -> 7 bytes, sign 0xC
  assert.strictEqual(
    packComp3("000000019400", { signed: true, negative: false }).toString("hex"),
    "0000000019400c",
  );
  // 9(3) FICO = 274 unsigned -> 2 bytes, sign 0xF
  assert.strictEqual(packComp3("274", { signed: false, negative: false }).toString("hex"), "274f");
  // S9(9)V99 = 504.70 positive -> 6 bytes
  assert.strictEqual(
    packComp3("00000050470", { signed: true, negative: false }).toString("hex"),
    "00000050470c",
  );
});

test("packCompBinary encodes big-endian COMP with mf widths", () => {
  assert.strictEqual(packCompBinary(1n, 9, false).toString("hex"), "00000001"); // 4 bytes
  assert.strictEqual(packCompBinary(50n, 11, false).toString("hex"), "0000000032"); // 5 bytes
  assert.strictEqual(packCompBinary(747n, 3, false).toString("hex"), "02eb"); // 2 bytes
  assert.strictEqual(packCompBinary(0n, 12, true).toString("hex"), "000000000000"); // 6 bytes
});
