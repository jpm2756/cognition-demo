/**
 * Database-parity harness for CBACT01C.
 *
 * The stdout parity test proves the modern service reproduces the COBOL
 * report byte-for-byte. This harness lifts that proof into a database so it
 * can be demonstrated the way an auditor thinks about it:
 *
 *   1. Parse the GnuCOBOL golden baseline report into structured rows and
 *      load them into `legacy_accounts`.
 *   2. Parse the modern TypeScript service's report into `modern_accounts`.
 *   3. Run a full-outer-join diff (0 mismatched rows == parity) and a
 *      cent-level SUM(curr_bal) reconciliation.
 *
 * Connection: set DATABASE_URL (e.g. postgres://user:pass@host:5432/db).
 *
 * Usage:
 *   ts-node db/parityDb.ts <golden-report> <modern-report>
 * Exits non-zero if the two datasets diverge in any row or column.
 */
import { readFileSync } from "fs";
import { Client } from "pg";

const MONEY_FIELDS = [
  "curr_bal",
  "credit_limit",
  "cash_credit_limit",
  "curr_cyc_credit",
  "curr_cyc_debit",
] as const;

const COLUMNS = [
  "acct_id",
  "active_status",
  "curr_bal",
  "credit_limit",
  "cash_credit_limit",
  "open_date",
  "expiration_date",
  "reissue_date",
  "curr_cyc_credit",
  "curr_cyc_debit",
  "group_id",
] as const;

type Column = (typeof COLUMNS)[number];

export interface AccountRow {
  acct_id: string;
  active_status: string;
  curr_bal: string;
  credit_limit: string;
  cash_credit_limit: string;
  open_date: string;
  expiration_date: string;
  reissue_date: string;
  curr_cyc_credit: string;
  curr_cyc_debit: string;
  group_id: string;
}

const LABEL_TO_COLUMN: Record<string, Column> = {
  "ACCT-ID": "acct_id",
  "ACCT-ACTIVE-STATUS": "active_status",
  "ACCT-CURR-BAL": "curr_bal",
  "ACCT-CREDIT-LIMIT": "credit_limit",
  "ACCT-CASH-CREDIT-LIMIT": "cash_credit_limit",
  "ACCT-OPEN-DATE": "open_date",
  "ACCT-EXPIRAION-DATE": "expiration_date",
  "ACCT-REISSUE-DATE": "reissue_date",
  "ACCT-CURR-CYC-CREDIT": "curr_cyc_credit",
  "ACCT-CURR-CYC-DEBIT": "curr_cyc_debit",
  "ACCT-GROUP-ID": "group_id",
};

/** "+0000000194.00" -> "194.00"; "-0000000005.50" -> "-5.50". */
export function parseMoney(display: string): string {
  const s = display.trim();
  const sign = s.startsWith("-") ? "-" : "";
  const [intPart, decPart = "00"] = s.replace(/^[-+]/, "").split(".");
  const intClean = intPart.replace(/^0+/, "") || "0";
  return `${sign}${intClean}.${decPart}`;
}

/**
 * Parse a CBACT01C report (golden or modern) into structured account rows.
 * Each account block is a run of `LABEL...:value` lines terminated by the
 * dashed separator; VBRC lines and the raw record are ignored here.
 */
export function parseReport(text: string): AccountRow[] {
  const rows: AccountRow[] = [];
  let current: Partial<AccountRow> | null = null;

  for (const line of text.split("\n")) {
    if (line.startsWith("ACCT-ID")) current = {};
    if (current) {
      const idx = line.indexOf(":");
      if (idx !== -1) {
        const label = line.slice(0, idx).trim();
        const value = line.slice(idx + 1);
        const column = LABEL_TO_COLUMN[label];
        if (column) {
          current[column] = (MONEY_FIELDS as readonly string[]).includes(column)
            ? parseMoney(value)
            : column === "acct_id"
              ? value.trim()
              : value.replace(/\s+$/, "");
        }
      }
      if (line.startsWith("-----")) {
        rows.push(current as AccountRow);
        current = null;
      }
    }
  }
  return rows;
}

async function loadTable(client: Client, table: string, rows: AccountRow[]): Promise<void> {
  await client.query(`TRUNCATE ${table}`);
  const cols = COLUMNS.join(", ");
  for (const row of rows) {
    const placeholders = COLUMNS.map((_, i) => `$${i + 1}`).join(", ");
    const values = COLUMNS.map((c) => row[c]);
    await client.query(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`, values);
  }
}

export async function runParity(goldenPath: string, modernPath: string): Promise<number> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const schema = readFileSync(new URL("./schema.sql", `file://${__dirname}/`), "utf8");
    await client.query(schema);

    const legacy = parseReport(readFileSync(goldenPath, "latin1"));
    const modern = parseReport(readFileSync(modernPath, "latin1"));
    await loadTable(client, "legacy_accounts", legacy);
    await loadTable(client, "modern_accounts", modern);

    const distinct = COLUMNS.map((c) => `l.${c} IS DISTINCT FROM m.${c}`).join(" OR ");
    const diff = await client.query(
      `SELECT COALESCE(l.acct_id, m.acct_id) AS acct_id
         FROM legacy_accounts l
         FULL OUTER JOIN modern_accounts m ON l.acct_id = m.acct_id
        WHERE l.acct_id IS NULL OR m.acct_id IS NULL OR ${distinct}
        ORDER BY acct_id`,
    );

    const recon = await client.query(
      `SELECT (SELECT COUNT(*) FROM legacy_accounts)          AS legacy_rows,
              (SELECT COUNT(*) FROM modern_accounts)          AS modern_rows,
              (SELECT SUM(curr_bal) FROM legacy_accounts)     AS legacy_balance,
              (SELECT SUM(curr_bal) FROM modern_accounts)     AS modern_balance`,
    );
    const r = recon.rows[0];

    console.log("== CBACT01C database parity ==");
    console.log(`legacy_accounts rows : ${r.legacy_rows}`);
    console.log(`modern_accounts rows : ${r.modern_rows}`);
    console.log(`legacy SUM(curr_bal) : ${r.legacy_balance}`);
    console.log(`modern SUM(curr_bal) : ${r.modern_balance}`);
    console.log(`mismatched rows      : ${diff.rowCount}`);

    if (diff.rowCount === 0 && r.legacy_balance === r.modern_balance) {
      console.log("RESULT: PARITY OK (0 mismatched rows, balances reconcile to the cent)");
      return 0;
    }
    if (diff.rowCount && diff.rowCount > 0) {
      console.error("RESULT: PARITY FAILED — divergent account IDs:");
      console.error(diff.rows.map((x) => x.acct_id).join(", "));
    } else {
      console.error("RESULT: PARITY FAILED — balances do not reconcile");
    }
    return 1;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const golden = process.argv[2] ?? "../legacy/out/cbact01c.golden.txt";
  const modern = process.argv[3];
  if (!modern) {
    console.error("usage: ts-node db/parityDb.ts <golden-report> <modern-report>");
    process.exit(2);
  }
  runParity(golden, modern)
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
