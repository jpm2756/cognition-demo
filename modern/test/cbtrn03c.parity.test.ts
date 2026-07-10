import assert from "node:assert";
import { readFileSync } from "fs";
import { join } from "path";
import { test } from "node:test";
import {
  decodeMfZonedAmount,
  formatEditedAmount,
  runCbtrn03c,
} from "../src/cbtrn03c";

const legacyDir = join(__dirname, "..", "..", "legacy");
const outDir = join(legacyDir, "out");

test("modern report matches the COBOL golden baseline byte-for-byte", () => {
  const golden = readFileSync(join(outDir, "cbtrn03c.golden.txt"));
  const modern = runCbtrn03c({
    transactionsPath: join(outDir, "cbtrn03c_transactions.txt"),
    cardXrefPath: join(legacyDir, "cbtrn03c_cardxref.txt"),
    transactionTypePath: join(legacyDir, "cbtrn03c_trantype.txt"),
    transactionCategoryPath: join(legacyDir, "cbtrn03c_trancatg.txt"),
    startDate: "2022-01-01",
    endDate: "2022-07-06",
  });

  assert.deepStrictEqual(modern, golden);
});

test("Micro Focus mode treats ASCII overpunch letters as a positive zero digit", () => {
  assert.strictEqual(decodeMfZonedAmount("0000001838H"), 18_380);
  assert.strictEqual(decodeMfZonedAmount("0000000478Q"), 4_780);
});

test("plain zoned digits retain the final cents digit", () => {
  assert.strictEqual(decodeMfZonedAmount("00000012345"), 12_345);
});

test("edited amount pictures preserve width, grouping, and signs", () => {
  assert.strictEqual(formatEditedAmount(154_930, "+"), "+      1,549.30");
  assert.strictEqual(formatEditedAmount(18_380, "-"), "         183.80");
  assert.strictEqual(formatEditedAmount(-18_380, "-"), "-        183.80");
});
