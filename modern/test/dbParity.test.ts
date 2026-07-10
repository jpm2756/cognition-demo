/**
 * Database-parity test: lift the byte-for-byte proof into Postgres.
 *
 * Loads the COBOL golden baseline and the modern service output into two
 * tables and asserts (a) equal row counts, (b) zero divergent rows/columns,
 * and (c) SUM(curr_bal) reconciling to the cent.
 *
 * Requires a reachable Postgres via DATABASE_URL. When DATABASE_URL is unset
 * the DB-dependent test is skipped so the pure-parsing tests still run
 * everywhere. CI provisions a Postgres service and sets DATABASE_URL.
 */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "fs";
import { join } from "path";
import { run } from "../src/cbact01c";
import { parseReport, parseMoney, runParity } from "../db/parityDb";

const legacyDir = join(__dirname, "..", "..", "legacy");
const dataPath = join(legacyDir, "acctdata.txt");
const goldenPath = join(legacyDir, "out", "cbact01c.golden.txt");

test("parseMoney strips sign and leading zeros to a decimal string", () => {
  assert.strictEqual(parseMoney("+0000000194.00"), "194.00");
  assert.strictEqual(parseMoney("-0000000005.50"), "-5.50");
  assert.strictEqual(parseMoney("+0000000000.00"), "0.00");
});

test("parseReport extracts one structured row per account", () => {
  const golden = readFileSync(goldenPath, "latin1");
  const rows = parseReport(golden);
  const accounts = readFileSync(dataPath, "latin1").split("\n").filter((l) => l.length > 0);
  assert.strictEqual(rows.length, accounts.length);
  assert.strictEqual(rows[0].acct_id, "00000000001");
  assert.strictEqual(rows[0].curr_bal, "194.00");
});

test(
  "golden and modern reports produce identical structured rows",
  { skip: !process.env.DATABASE_URL ? "DATABASE_URL not set" : false },
  async () => {
    const modernPath = join(__dirname, "..", "..", "legacy", "out", "cbact01c.modern.txt");
    // Materialize the modern service output next to the golden baseline.
    const { writeFileSync } = await import("fs");
    writeFileSync(modernPath, run(dataPath).join("\n") + "\n", "latin1");

    const code = await runParity(goldenPath, modernPath);
    assert.strictEqual(code, 0, "database parity harness reported a mismatch");
  },
);
