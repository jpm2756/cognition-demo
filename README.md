# CardDemo Modernization Factory — Demo

A runnable slice of the **ATLAS "modernization factory"** demo: take a *real* AWS CardDemo mainframe batch program, run it unmodified under open-source GnuCOBOL (no mainframe), then modernize it to a cloud-native TypeScript service and **prove parity** against the mainframe output — as a database diff an auditor can read.

Base app: [`aws-samples/aws-mainframe-modernization-carddemo`](https://github.com/aws-samples/aws-mainframe-modernization-carddemo) (Apache-2.0).

## Starting state (the "before")

This repo is the **demo starting point**: the forked legacy COBOL plus the
database-parity harness that specifies the target. The **modern port is not
written yet** — that happens live during the demo (assign the Jira ticket to
Devin), and the parity harness turns green when it does.

> Because there is no `modern/src/cbact01c.ts` yet, CI is **expected to be red**
> until the modernization is done. That red → green transition *is* the demo.

## What's here

| Path | What it is |
|---|---|
| `legacy/` | The **unmodified** COBOL program `CBACT01C.cbl` + copybooks, a loader (`ACCTLOAD.cob`) that stages the ASCII account extract into an indexed file, COBOL stubs for the `COBDATFT` assembler date routine and the `CEE3ABD` abend service, and `run_cobol.sh` which builds/runs it and emits the **golden baseline**. |
| `modern/db/` | The **database-parity harness** (`parityDb.ts` + `schema.sql`): loads the legacy baseline and the modern output into Postgres and proves parity with a `FULL OUTER JOIN` diff + a `SUM(curr_bal)` reconciliation. |
| `modern/test/dbParity.test.ts` | The parity test — the executable spec the live modernization must satisfy. |
| `docs/db-parity.md` | How the database-parity harness works and what it proves. |
| `docs/DEMO-SCRIPT.md` | The end-to-end demo script (Jira → PR/CI → DB parity → deploy → observability → Confluence). |
| `.github/workflows/parity.yml` | CI: install GnuCOBOL → build COBOL baseline → run the Postgres database-parity check. |

## Run it

```bash
# 1) legacy COBOL baseline (needs gnucobol: sudo apt-get install -y gnucobol)
cd legacy && ./run_cobol.sh          # -> legacy/out/cbact01c.golden.txt

# 2) database parity (needs a reachable Postgres; point DATABASE_URL at it)
cd ../modern && npm install
export DATABASE_URL=postgres://user:pass@localhost:5432/carddemo
npm run test:db                       # 0 mismatched rows + SUM(curr_bal) reconciles to the cent
```

Until the modern service (`modern/src/cbact01c.ts`) is written, step 2 fails by
design — that is the gate the modernization closes.

## Why this is the demo

- **Authentic:** a real industry mainframe app (COBOL/CICS/VSAM/DB2), not a tutorial.
- **Runnable without a mainframe:** the batch tier compiles/runs on plain Linux via GnuCOBOL.
- **Provable:** the DB-parity harness is certification-grade evidence — `0 mismatched rows` and balances reconciled to the cent.
- **Scales to a fleet:** CardDemo has ~12 batch programs — one Devin session each = the modernization factory in miniature.
