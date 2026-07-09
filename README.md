# CardDemo Modernization Factory — Demo

A runnable slice of the **ATLAS "modernization factory"** demo: take a *real* AWS CardDemo mainframe batch program, run it unmodified under open-source GnuCOBOL (no mainframe), modernize it to a cloud-native service, and **prove byte-for-byte behavioral parity** in CI.

Base app: [`aws-samples/aws-mainframe-modernization-carddemo`](https://github.com/aws-samples/aws-mainframe-modernization-carddemo) (Apache-2.0).

## What's here

| Path | What it is |
|---|---|
| `legacy/` | The **unmodified** COBOL program `CBACT01C.cbl` + copybooks, a loader (`ACCTLOAD.cob`) that stages the ASCII account extract into an indexed file, COBOL stubs for the `COBDATFT` assembler date routine and the `CEE3ABD` abend service, and `run_cobol.sh` which builds/runs it and emits the **golden baseline**. |
| `modern/` | Cloud-native TypeScript reimplementation (`src/cbact01c.ts`) + differential **parity tests** (`test/parity.test.ts`). |
| `modern/db/` | **Database-parity harness** (`parityDb.ts` + `schema.sql`): loads the legacy baseline and the modern output into Postgres and proves parity with a SQL diff + a `SUM(curr_bal)` reconciliation. |
| `docs/CBACT01C.md` | The extracted business-logic spec (workflow step 1). |
| `docs/db-parity.md` | How the database-parity harness works and what it proves. |
| `.github/workflows/parity.yml` | CI: install GnuCOBOL → build COBOL baseline → run modern parity tests → run the Postgres database-parity check. |

## Run it

```bash
# 1) legacy COBOL baseline (needs gnucobol: sudo apt-get install -y gnucobol)
cd legacy && ./run_cobol.sh          # -> legacy/out/cbact01c.golden.txt

# 2) modern service + parity tests
cd ../modern && npm install
npm run typecheck
npm test                              # asserts modern stdout == COBOL baseline, byte-for-byte

# 3) (optional) database parity: prove it as an auditor would, in SQL
#    needs a reachable Postgres; point DATABASE_URL at it.
export DATABASE_URL=postgres://user:pass@localhost:5432/carddemo
npm run test:db                       # 0 mismatched rows + SUM(curr_bal) reconciles to the cent
```

## Why this is the demo

- **Authentic:** a real industry mainframe app (COBOL/CICS/VSAM/DB2), not a tutorial.
- **Runnable without a mainframe:** the batch tier compiles/runs on plain Linux via GnuCOBOL.
- **Provable:** parity tests are the certification-grade evidence federal modernization needs.
- **Scales to a fleet:** CardDemo has ~12 batch programs — one Devin session each = the modernization factory in miniature.
