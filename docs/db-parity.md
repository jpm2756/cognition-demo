# Database-parity harness (CBACT01C)

The stdout parity test (`modern/test/parity.test.ts`) proves the modern service
reproduces the COBOL report **byte-for-byte**. The database-parity harness lifts
that same proof into Postgres so it can be demonstrated the way an auditor thinks
about it — as rows, columns, and a reconciled ledger total.

## What it does

1. **Parse** the GnuCOBOL golden baseline (`legacy/out/cbact01c.golden.txt`) and
   the modern service output into structured account rows
   (`db/parityDb.ts` → `parseReport`).
2. **Load** them into two structurally-identical tables — `legacy_accounts` and
   `modern_accounts` (`db/schema.sql`).
3. **Diff & reconcile:**
   - a `FULL OUTER JOIN` on `acct_id` with an `IS DISTINCT FROM` comparison across
     every column → **0 mismatched rows** means record/column-level parity;
   - `SUM(curr_bal)` on each table → the balances **reconcile to the cent**.

Because the two datasets are derived independently (COBOL vs. TypeScript), a clean
diff is real evidence of equivalence, not a tautology.

## Run it

```bash
cd legacy && ./run_cobol.sh                 # produce the golden baseline
cd ../modern && npm install
export DATABASE_URL=postgres://user:pass@host:5432/carddemo
npm run test:db                             # parsing tests + the DB parity assertion
# or, directly:
npx ts-node src/cbact01c.ts ../legacy/acctdata.txt > ../legacy/out/cbact01c.modern.txt
npx ts-node db/parityDb.ts ../legacy/out/cbact01c.golden.txt ../legacy/out/cbact01c.modern.txt
```

Expected output:

```
== CBACT01C database parity ==
legacy_accounts rows : 50
modern_accounts rows : 50
legacy SUM(curr_bal) : 12269.00
modern SUM(curr_bal) : 12269.00
mismatched rows      : 0
RESULT: PARITY OK (0 mismatched rows, balances reconcile to the cent)
```

The pure-parsing tests run everywhere; the DB assertion is skipped automatically
when `DATABASE_URL` is unset. CI provisions a Postgres service container and sets
`DATABASE_URL` (see `.github/workflows/parity.yml`).

## Why a database (not just the file diff)

- **Auditor-native evidence:** finance/mainframe reviewers reason in tables and
  totals — "0 mismatched rows across all accounts" and "balances tie to the cent"
  is more convincing than a passing unit test.
- **Scales to volume:** the same query answers parity over 50 or 5,000,000 rows.
- **Extensible:** the tables are the seam for a live migration dashboard
  (records/programs cut over vs. remaining) and downstream reconciliation checks.
