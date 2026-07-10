/**
 * Differential (parity) test: the modernized CBCUS01C must reproduce the
 * legacy GnuCOBOL baseline output byte-for-byte for the sample customer data.
 *
 * The baseline (legacy/out/cbcus01c.golden.txt) is produced by compiling and
 * running the UNMODIFIED CardDemo COBOL program under GnuCOBOL. CI regenerates
 * it (see .github/workflows/cbcus01c-parity.yml); locally it is read from disk.
 */
import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "fs";
import { join } from "path";
import { run, parseRecord, renderRecord, processCustomer } from "../src/cbcus01c";

const legacyDir = join(__dirname, "..", "..", "legacy");
const dataPath = join(legacyDir, "custdata.txt");
const goldenPath = join(legacyDir, "out", "cbcus01c.golden.txt");

test("modern output matches the COBOL golden baseline byte-for-byte", () => {
  const golden = readFileSync(goldenPath, "latin1").replace(/\n$/, "");
  const modern = run(dataPath).join("\n");
  assert.strictEqual(modern, golden);
});

test("parseRecord slices the CVCUS01Y fixed-width layout correctly", () => {
  const raw =
    "000000001" +
    "Immanuel".padEnd(25, " ") +
    "Madeline".padEnd(25, " ") +
    "Kessler".padEnd(25, " ");
  const c = parseRecord(raw);
  assert.strictEqual(c.id, "000000001");
  assert.strictEqual(c.firstName, "Immanuel".padEnd(25, " "));
  assert.strictEqual(c.middleName, "Madeline".padEnd(25, " "));
  assert.strictEqual(c.lastName, "Kessler".padEnd(25, " "));
  assert.strictEqual(c.raw.length, 500);
});

test("renderRecord reproduces a 500-byte record byte-for-byte (no normalization)", () => {
  const raw = "000000007" + "X".repeat(200);
  const rendered = renderRecord(parseRecord(raw));
  assert.strictEqual(rendered.length, 500);
  assert.strictEqual(rendered, raw.padEnd(500, " "));
});

test("processCustomer emits each record exactly twice (GET-NEXT + main loop)", () => {
  const raw = "000000009" + "Zoe".padEnd(200, " ");
  const lines = processCustomer(parseRecord(raw));
  assert.strictEqual(lines.length, 2);
  assert.strictEqual(lines[0], lines[1]);
  assert.strictEqual(lines[0], raw.padEnd(500, " "));
});
