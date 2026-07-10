/**
 * Differential (parity) test: the modernized CBSTM03A/CBSTM03B must reproduce
 * the legacy GnuCOBOL baseline output byte-for-byte for the sample data.
 *
 * The baseline (legacy/out/cbstm03a.golden.txt) is produced by compiling and
 * running the UNMODIFIED CardDemo COBOL programs under GnuCOBOL. CI
 * regenerates it (see .github/workflows/cbstm03a-parity.yml); locally it is
 * read from disk.
 */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "fs";
import { join } from "path";
import {
  run,
  decodeZoned,
  zonedToCents,
  pic9v99Minus,
  picZ9v99Minus,
} from "../src/cbstm03a";

const legacyDir = join(__dirname, "..", "..", "legacy");
const goldenPath = join(legacyDir, "out", "cbstm03a.golden.txt");

test("modern output matches the COBOL golden baseline byte-for-byte", () => {
  const golden = readFileSync(goldenPath, "latin1");
  const modern = run(legacyDir);
  assert.strictEqual(modern, golden);
});

test("decodeZoned: positive keeps a plain trailing digit", () => {
  assert.deepStrictEqual(decodeZoned("00000000999"), { sign: 1, digits: "00000000999" });
  assert.deepStrictEqual(decodeZoned("00000005000"), { sign: 1, digits: "00000005000" });
});

test("decodeZoned: negative uses GnuCOBOL ASCII 0x70+digit ('p'-'y')", () => {
  // -25.50 in S9(9)V99 -> digits 00000002550, trailing 0 -> 'p'
  assert.deepStrictEqual(decodeZoned("0000000255p"), { sign: -1, digits: "00000002550" });
  // trailing 9 negative -> 'y'
  assert.deepStrictEqual(decodeZoned("0000000255y"), { sign: -1, digits: "00000002559" });
});

test("zonedToCents decodes sign and magnitude", () => {
  assert.strictEqual(zonedToCents("00000000999"), 999);
  assert.strictEqual(zonedToCents("0000000255p"), -2550);
});

test("pic9v99Minus formats S9(10)V99 as 9(9).99- (leading zeros kept)", () => {
  assert.strictEqual(pic9v99Minus("000000019400"), "000000194.00 ");
  assert.strictEqual(pic9v99Minus("00000000255p"), "000000025.50-");
});

test("picZ9v99Minus blank-suppresses the integer part and shows sign", () => {
  assert.strictEqual(picZ9v99Minus(5000), "       50.00 ");
  assert.strictEqual(picZ9v99Minus(17550), "      175.50 ");
  assert.strictEqual(picZ9v99Minus(999), "        9.99 ");
  assert.strictEqual(picZ9v99Minus(-2550), "       25.50-");
});
