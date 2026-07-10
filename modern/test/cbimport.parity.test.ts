/**
 * Differential (parity) test: the modernized CBIMPORT must reproduce the
 * legacy GnuCOBOL baseline output byte-for-byte for the sample export data.
 *
 * The baseline (legacy/out/cbimport.golden.txt) is produced by compiling and
 * running the UNMODIFIED CardDemo COBOL program under GnuCOBOL and assembling
 * its output files (see legacy/run_cbimport.sh). CI regenerates it
 * (.github/workflows/cbimport-parity.yml); locally it is read from disk.
 */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "fs";
import { join } from "path";
import {
  run,
  decodeComp3,
  decodeCompSigned,
  decodeCompUnsigned,
  decodeZonedInput,
  encZonedSigned,
  encUnsigned,
} from "../src/cbimport";

const legacyDir = join(__dirname, "..", "..", "legacy");
const dataPath = join(legacyDir, "expdata.dat");
const goldenPath = join(legacyDir, "out", "cbimport.golden.txt");

test("modern output matches the COBOL golden baseline byte-for-byte", () => {
  const golden = readFileSync(goldenPath, "latin1").replace(/\n$/, "");
  const modern = run(dataPath);
  assert.strictEqual(modern, golden);
});

test("decodeComp3 unpacks packed-decimal with sign nibble", () => {
  // +1234.56 as S9(10)V99 COMP-3 (7 bytes): 00 00 00 01 23 45 6C
  const pos = Buffer.from([0x00, 0x00, 0x00, 0x01, 0x23, 0x45, 0x6c]);
  assert.deepStrictEqual(decodeComp3(pos, 0, 7), { neg: false, digits: "123456" });
  // -1500.00 -> ... 15 00 00 D
  const neg = Buffer.from([0x00, 0x00, 0x00, 0x01, 0x50, 0x00, 0x0d]);
  assert.deepStrictEqual(decodeComp3(neg, 0, 7), { neg: true, digits: "150000" });
});

test("decodeCompSigned reads big-endian two's complement", () => {
  // +200.00 -> 20000 = 0x4E20 in 6 bytes big-endian
  const pos = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x4e, 0x20]);
  assert.deepStrictEqual(decodeCompSigned(pos, 0, 6), { neg: false, digits: "20000" });
  // -300.00 -> -30000 (two's complement, 6 bytes)
  const neg = Buffer.alloc(6);
  neg.writeIntBE(-30000, 0, 6);
  assert.deepStrictEqual(decodeCompSigned(neg, 0, 6), { neg: true, digits: "30000" });
});

test("decodeCompUnsigned reads big-endian unsigned", () => {
  // 900000001 = 0x35A4E901 in 4 bytes
  const b = Buffer.from([0x35, 0xa4, 0xe9, 0x01]);
  assert.deepStrictEqual(decodeCompUnsigned(b, 0, 4), { neg: false, digits: "900000001" });
});

test("encZonedSigned uses GnuCOBOL ASCII trailing sign (pos plain / neg 0x70+d)", () => {
  assert.strictEqual(encZonedSigned({ neg: false, digits: "123456" }, 12), "000000123456");
  // -1500.00 -> digits 150000 -> width 12, last '0' -> 'p' (0x70)
  assert.strictEqual(encZonedSigned({ neg: true, digits: "150000" }, 12), "00000015000p");
  // -7525 -> last '5' -> 'u' (0x75)
  assert.strictEqual(encZonedSigned({ neg: true, digits: "7525" }, 12), "00000000752u");
});

test("encUnsigned right-justifies zero-filled", () => {
  assert.strictEqual(encUnsigned({ neg: false, digits: "750" }, 3), "750");
  assert.strictEqual(encUnsigned({ neg: false, digits: "900000001" }, 11), "00900000001");
});

test("decodeZonedInput reads ASCII trailing sign", () => {
  assert.deepStrictEqual(decodeZonedInput("00000015000p"), { neg: true, digits: "150000" });
  assert.deepStrictEqual(decodeZonedInput("000000100000"), { neg: false, digits: "100000" });
});
