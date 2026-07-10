# CBACT04C — Business-Logic Specification (extracted)

*Source: `aws-samples/aws-mainframe-modernization-carddemo`, `app/cbl/CBACT04C.cbl` (652 lines), driven by `app/jcl/INTCALC.jcl`. This document is the plain-language spec Devin extracts as step 1 of the modernization workflow.*

## Purpose

Batch **interest calculator**. It walks the transaction-category balance file (`TCATBALF`) in key order, and for every category balance it computes one month's interest from the account's disclosure-group rate, posts an interest **transaction** to the `TRANSACT` file, and rolls the interest into the account balance (rewriting `ACCTFILE`). It is the canonical "compute and post interest" batch job in CardDemo. Fee computation (`1400-COMPUTE-FEES`) is a stub in the upstream source ("To be implemented").

## Inputs

| Logical file (DD) | Organization | Access | Key | Record | Copybook |
|---|---|---|---|---|---|
| `TCATBALF` | Indexed (KSDS) | sequential | `TRAN-CAT-KEY` (acct+type+cat, 17) | 50 | `CVTRA01Y` (`TRAN-CAT-BAL-RECORD`) |
| `XREFFILE` | Indexed (KSDS) | random, **alt key = acct-id** | `XREF-CARD-NUM` (16), alt `XREF-ACCT-ID` | 50 | `CVACT03Y` (`CARD-XREF-RECORD`) |
| `ACCTFILE` | Indexed (KSDS) | random, **I-O** (rewritten) | `ACCT-ID` (11) | 300 | `CVACT01Y` (`ACCOUNT-RECORD`) |
| `DISCGRP` | Indexed (KSDS) | random | `DIS-GROUP-KEY` (group+type+cat, 16) | 50 | `CVTRA02Y` (`DIS-GROUP-RECORD`) |
| `TRANSACT` | Sequential | output | — | 350 | `CVTRA05Y` (`TRAN-RECORD`) |

A run-date is supplied on the mainframe via the JCL `PARM='2022071800'` (10 chars), received through the `LINKAGE` group `EXTERNAL-PARMS` (halfword `PARM-LENGTH` + `PARM-DATE X(10)`).

Key record layouts (pictures):

- **`TRAN-CAT-BAL-RECORD`** (`CVTRA01Y`, 50): `TRANCAT-ACCT-ID 9(11)`, `TRANCAT-TYPE-CD X(2)`, `TRANCAT-CD 9(4)`, `TRAN-CAT-BAL S9(9)V99` (zoned), `FILLER X(22)`.
- **`DIS-GROUP-RECORD`** (`CVTRA02Y`, 50): `DIS-ACCT-GROUP-ID X(10)`, `DIS-TRAN-TYPE-CD X(2)`, `DIS-TRAN-CAT-CD 9(4)`, `DIS-INT-RATE S9(4)V99` (zoned), `FILLER X(28)`.
- **`CARD-XREF-RECORD`** (`CVACT03Y`, 50): `XREF-CARD-NUM X(16)`, `XREF-CUST-ID 9(9)`, `XREF-ACCT-ID 9(11)`, `FILLER X(14)`.
- **`TRAN-RECORD`** (`CVTRA05Y`, 350): `TRAN-ID X(16)`, `TRAN-TYPE-CD X(2)`, `TRAN-CAT-CD 9(4)`, `TRAN-SOURCE X(10)`, `TRAN-DESC X(100)`, `TRAN-AMT S9(9)V99` (zoned), `TRAN-MERCHANT-ID 9(9)`, `TRAN-MERCHANT-NAME X(50)`, `TRAN-MERCHANT-CITY X(50)`, `TRAN-MERCHANT-ZIP X(10)`, `TRAN-CARD-NUM X(16)`, `TRAN-ORIG-TS X(26)`, `TRAN-PROC-TS X(26)`, `FILLER X(20)`.

## Processing (control flow)

1. Open all files; `DISPLAY 'START OF EXECUTION OF PROGRAM CBACT04C'`.
2. Read `TCATBALF` sequentially. For each record: `ADD 1 TO WS-RECORD-COUNT`, then **`DISPLAY TRAN-CAT-BAL-RECORD`** (the raw 50 bytes).
3. **Account control break** — when `TRANCAT-ACCT-ID` changes: if not the first account, `1050-UPDATE-ACCOUNT` (roll `WS-TOTAL-INT` into `ACCT-CURR-BAL`, zero the cycle credit/debit, `REWRITE` `ACCTFILE`); reset `WS-TOTAL-INT`; read the account (`1100`) and the card xref by acct-id (`1110`).
4. Build the disclosure key from `ACCT-GROUP-ID` + `TRANCAT-TYPE-CD` + `TRANCAT-CD`; read `DISCGRP` (`1200`). On `INVALID KEY`/status `23` it prints `DISCLOSURE GROUP RECORD MISSING` / `TRY WITH DEFAULT GROUP CODE`, sets group to `DEFAULT`, and re-reads (`1200-A`).
5. If `DIS-INT-RATE ≠ 0`: `1300-COMPUTE-INTEREST` — `COMPUTE WS-MONTHLY-INT = (TRAN-CAT-BAL * DIS-INT-RATE) / 1200`, add to `WS-TOTAL-INT`, and `1300-B-WRITE-TX` writes a `TRANSACT` record. `1400-COMPUTE-FEES` is a no-op stub.
6. At EOF, a final `1050-UPDATE-ACCOUNT` flushes the last account; close files; `DISPLAY 'END OF EXECUTION OF PROGRAM CBACT04C'`.

The posted transaction (`1300-B-WRITE-TX`): `TRAN-ID = PARM-DATE(10) || WS-TRANID-SUFFIX 9(6)` (a global counter, 1-based); `TRAN-TYPE-CD='01'`; `TRAN-CAT-CD='05'→0005`; `TRAN-SOURCE='System'`; `TRAN-DESC='Int. for a/c ' || ACCT-ID`; `TRAN-AMT = WS-MONTHLY-INT`; merchant fields zero/blank; `TRAN-CARD-NUM = XREF-CARD-NUM`; both timestamps = a DB2-format timestamp from `FUNCTION CURRENT-DATE`.

## Outputs (parity slice)

1. **stdout (DISPLAY):** `START…`, one raw `TRAN-CAT-BAL-RECORD` line per category balance, any disclosure/lookup diagnostics, `END…`.
2. **`TRANSACT` file:** one 350-byte interest transaction per non-zero rate.

`ACCTFILE` rewrites are internal (indexed file) and out of scope for the stdout/TRANSACT parity slice; the same technique extends to them.

## Key behaviors that must be preserved (parity-critical)

- **Two different zoned-decimal sign conventions.**
  - *Input* fields (`TRAN-CAT-BAL`, `DIS-INT-RATE`) use the CardDemo/EBCDIC-style trailing **overpunch** (`{`=+0…`I`=+9, `}`=-0…`R`=-9) in the ASCII fixtures; GnuCOBOL reads them as signed numerics.
  - *Computed output* (`TRAN-AMT`) is written by GnuCOBOL as an **ASCII** zoned decimal: positive keeps plain trailing digits (`0`–`9`), negative carries a `0x70`–`0x79` overpunch (`p`–`y`) on the last byte. The modern port encodes exactly this.
- **stdout dump echoes raw bytes.** `DISPLAY TRAN-CAT-BAL-RECORD` prints the record `READ INTO` verbatim, so the input overpunch (`…{`) is preserved — it is *not* normalized (unlike CBACT01C's re-rendered record).
- **Fixed-point interest.** `(bal * rate) / 1200` is truncated toward zero into `S9(9)V99` (no `ROUNDED`). The port computes in integer cents.
- **Global transaction sequence.** `WS-TRANID-SUFFIX` increments once per posted transaction across all accounts.
- **Non-deterministic timestamps.** `TRAN-ORIG-TS` / `TRAN-PROC-TS` derive from `FUNCTION CURRENT-DATE`; the baseline pins the clock (`COB_CURRENT_DATE`) and normalizes the sub-second digits to a fixed value, which the port mirrors.

## External dependencies (stubbed / shimmed off-platform)

- `CEE3ABD` — z/OS Language Environment abend service; reused shared COBOL stub (`legacy/CEE3ABD.cob`), only invoked on I/O errors (not in the happy path). CBACT04C does **not** use `COBDATFT`.
- `FUNCTION CURRENT-DATE` — pinned via GnuCOBOL `COB_CURRENT_DATE` and normalized (see above).
- **JCL PARM** — supplied off-platform by a thin driver `legacy/CB4RUN.cob` (GnuCOBOL rejects a `PROCEDURE DIVISION USING` program as a main entry point). It does not alter business logic.
- **VSAM loads** — `legacy/CB4LOAD.cob` stages the ASCII fixtures into the four indexed files (replacing the IDCAMS REPRO steps), including the `XREFFILE` alternate index on acct-id.

## Modernization

Reimplemented in TypeScript (`modern/src/cbact04c.ts`). Behavioral parity is enforced by `modern/test/cbact04c.parity.test.ts`, which asserts the modern output (stdout + rendered TRANSACT) matches the GnuCOBOL golden baseline **byte-for-byte**, plus focused unit tests for the two overpunch conventions and the fixed-point interest math. CI (`.github/workflows/cbact04c-parity.yml`) rebuilds the COBOL baseline from the unmodified source with GnuCOBOL and re-runs parity on every push/PR.
