import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "fs";
import { join } from "path";
import {
  decodeZoned,
  encodeZoned,
  fixturePaths,
  run,
} from "../src/cbtrn02c";

const legacyDir = join(__dirname, "..", "..", "legacy");
const goldenPath = join(legacyDir, "out", "cbtrn02c.golden.txt");

test("CBTRN02C output matches the COBOL golden baseline byte-for-byte", () => {
  const golden = readFileSync(goldenPath, "latin1").replace(/\n$/, "");
  const modern = run(fixturePaths(legacyDir), new Date("2026-01-02T03:04:05.670Z"));
  assert.strictEqual(modern.lines.join("\n"), golden);
});

test("zoned-decimal codecs preserve positive and negative overpunch", () => {
  assert.strictEqual(decodeZoned("0000005047G"), 50477);
  assert.strictEqual(decodeZoned("0000009190}"), -91900);
  assert.strictEqual(encodeZoned(50477, 11), "0000005047G");
  assert.strictEqual(encodeZoned(-91900, 11), "0000009190}");
  assert.strictEqual(decodeZoned("00000000000{"), 0);
  assert.strictEqual(decodeZoned("00000000000}"), 0);
});

test("posting updates account and transaction-category balances in integer cents", () => {
  const result = run(fixturePaths(legacyDir), new Date("2026-01-02T03:04:05.670Z"));

  const account7 = result.accounts.get("00000000007");
  const account20 = result.accounts.get("00000000020");
  const account5 = result.accounts.get("00000000005");
  assert.ok(account7);
  assert.ok(account20);
  assert.ok(account5);
  assert.strictEqual(account7.currentBalance, 69777);
  assert.strictEqual(account7.currentCycleCredit, 50477);
  assert.strictEqual(account20.currentBalance, -55000);
  assert.strictEqual(account20.currentCycleDebit, -91900);
  assert.strictEqual(account5.currentBalance, 41288);
  assert.strictEqual(account5.currentCycleCredit, 6788);

  assert.strictEqual(result.categoryBalances.get("00000000007010001")?.balance, 50477);
  assert.strictEqual(result.categoryBalances.get("00000000020030001")?.balance, -91900);
  assert.strictEqual(result.categoryBalances.get("00000000005010001")?.balance, 6788);
  assert.strictEqual(result.transactionRecords.length, 3);
  assert.strictEqual(result.rejectRecords.length, 0);
});
