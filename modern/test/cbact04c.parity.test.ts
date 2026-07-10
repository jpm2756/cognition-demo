/**
 * Differential (parity) test for the modernized CBACT04C interest
 * calculator. The modern port must reproduce the legacy GnuCOBOL baseline
 * byte-for-byte for the sample fixtures.
 *
 * The baseline (legacy/out/cbact04c.golden.txt) is produced by compiling
 * and running the UNMODIFIED CardDemo COBOL program under GnuCOBOL and
 * concatenating its stdout with the rendered TRANSACT output file
 * (see legacy/run_cbact04c.sh). CI regenerates it from source; locally it
 * is read from disk.
 */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "fs";
import { join } from "path";
import {
  run,
  decodeZonedInput,
  encodeZonedOutput,
  computeMonthlyInterestCents,
} from "../src/cbact04c";

const legacyDir = join(__dirname, "..", "..", "legacy");
const goldenPath = join(legacyDir, "out", "cbact04c.golden.txt");

test("modern output matches the COBOL golden baseline byte-for-byte", () => {
  const golden = readFileSync(goldenPath, "latin1").replace(/\n$/, "");
  const modern = run(legacyDir).join("\n");
  assert.strictEqual(modern, golden);
});

test("decodeZonedInput handles the CardDemo {}-overpunch", () => {
  assert.strictEqual(decodeZonedInput("0000005000{"), 50000); // +500.00 scaled to cents
  assert.strictEqual(decodeZonedInput("0000005000A"), 50001);
  assert.strictEqual(decodeZonedInput("0000005000}"), -50000);
  assert.strictEqual(decodeZonedInput("0000005000J"), -50001);
});

test("decodeZonedInput tolerates plain and 0x70 (GnuCOBOL) sign bytes", () => {
  assert.strictEqual(decodeZonedInput("00000000500"), 500);
  assert.strictEqual(decodeZonedInput("0000000050p"), -500); // 0x70 -> negative 0
  assert.strictEqual(decodeZonedInput("0000000065s"), -653); // 0x73 -> negative 3
});

test("encodeZonedOutput matches GnuCOBOL's written zoned decimal", () => {
  // positive -> plain trailing digits
  assert.strictEqual(encodeZonedOutput(500, 11), "00000000500");
  assert.strictEqual(encodeZonedOutput(600, 11), "00000000600");
  assert.strictEqual(encodeZonedOutput(0, 11), "00000000000");
  // negative -> ASCII 0x70..0x79 overpunch (p..y) on the last byte
  assert.strictEqual(encodeZonedOutput(-500, 11), "0000000050p");
  assert.strictEqual(encodeZonedOutput(-653, 11), "0000000065s");
});

test("computeMonthlyInterestCents = (bal * rate)/1200, truncated toward zero", () => {
  assert.strictEqual(computeMonthlyInterestCents(50000, 1200), 500); // 500.00 @12.00% -> 5.00
  assert.strictEqual(computeMonthlyInterestCents(30000, 2400), 600); // 300.00 @24.00% -> 6.00
  assert.strictEqual(computeMonthlyInterestCents(100000, 600), 500); // 1000.00 @6.00% -> 5.00
  // truncation (no rounding): 100.01 @ 13.00% = 1.0834... -> 1.08
  assert.strictEqual(computeMonthlyInterestCents(10001, 1300), 108);
  // negative balance -> negative interest, truncated toward zero
  assert.strictEqual(computeMonthlyInterestCents(-10001, 1300), -108);
});
