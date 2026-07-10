# CBTRN01C — Business-Logic Specification (extracted)

*Source: `aws-samples/aws-mainframe-modernization-carddemo`, `app/cbl/CBTRN01C.cbl` (494 lines). This document is the plain-language spec Devin extracts as step 1 of the modernization workflow.*

## Purpose

Batch program that reads the **daily transaction file** and performs the *validation pass* of daily-transaction posting: for every transaction it prints the raw record, verifies the card number against the **card cross-reference** (`XREFFILE`), and — when the card resolves — reads the referenced **account master** (`ACCTFILE`) to confirm the account exists. Transactions whose card cannot be verified are reported and skipped. It is the first stage of CardDemo's daily-posting pipeline (CBTRN02C performs the balance updates).

## Inputs

| Logical file (DD) | Organization | Access | Key | Record | Copybook |
|---|---|---|---|---|---|
| `DALYTRAN` | Sequential | Sequential | — | 350 bytes | `CVTRA06Y` (`DALYTRAN-RECORD`) |
| `XREFFILE` | Indexed (KSDS) | Random | `XREF-CARD-NUM` X(16) | 50 bytes | `CVACT03Y` (`CARD-XREF-RECORD`) |
| `ACCTFILE` | Indexed (KSDS) | Random | `ACCT-ID` 9(11) | 300 bytes | `CVACT01Y` (`ACCOUNT-RECORD`) |
| `CUSTFILE` | Indexed (KSDS) | Random | `CUST-ID` 9(09) | 500 bytes | `CVCUS01Y` (`CUSTOMER-RECORD`) |
| `CARDFILE` | Indexed (KSDS) | Random | `CARD-NUM` X(16) | 150 bytes | `CVACT02Y` (`CARD-RECORD`) |
| `TRANFILE` | Indexed (KSDS) | Random | `TRAN-ID` X(16) | 350 bytes | `CVTRA05Y` (`TRAN-RECORD`) |

`CUSTFILE`, `CARDFILE` and `TRANFILE` are **opened and closed but never read** in the main loop, so they do not affect stdout (they must merely open successfully).

`DALYTRAN-RECORD` layout (`CVTRA06Y`, RECLN 350) — key fields:

| Field | Picture | Offset (0-based) | Notes |
|---|---|---|---|
| `DALYTRAN-ID` | `X(16)` | 0 | transaction id |
| `DALYTRAN-TYPE-CD` | `X(02)` | 16 | |
| `DALYTRAN-CAT-CD` | `9(04)` | 18 | |
| `DALYTRAN-SOURCE` | `X(10)` | 22 | |
| `DALYTRAN-DESC` | `X(100)` | 32 | |
| `DALYTRAN-AMT` | `S9(09)V99` | 132 | zoned, **trailing overpunch sign** (11 bytes) |
| `DALYTRAN-MERCHANT-ID` | `9(09)` | 143 | |
| `DALYTRAN-MERCHANT-NAME` | `X(50)` | 152 | |
| `DALYTRAN-MERCHANT-CITY` | `X(50)` | 202 | |
| `DALYTRAN-MERCHANT-ZIP` | `X(10)` | 252 | |
| `DALYTRAN-CARD-NUM` | `X(16)` | 262 | lookup key into `XREFFILE` |
| `DALYTRAN-ORIG-TS` | `X(26)` | 278 | |
| `DALYTRAN-PROC-TS` | `X(26)` | 304 | |
| `FILLER` | `X(20)` | 330 | |

`CARD-XREF-RECORD` (`CVACT03Y`): `XREF-CARD-NUM` X(16) · `XREF-CUST-ID` 9(09) · `XREF-ACCT-ID` 9(11) · `FILLER` X(14).

## Processing

`MAIN-PARA`: open all six files, then loop until end-of-file on `DALYTRAN`:

1. `1000-DALYTRAN-GET-NEXT` — `READ DALYTRAN-FILE INTO DALYTRAN-RECORD`. On status `10` set EOF; on non-`00`/`10` display the error and abend.
2. If not EOF, `DISPLAY DALYTRAN-RECORD` (the raw 350-byte record).
3. `2000-LOOKUP-XREF` — `MOVE DALYTRAN-CARD-NUM TO XREF-CARD-NUM`, then random `READ XREF-FILE KEY IS FD-XREF-CARD-NUM`:
   - **NOT INVALID KEY:** display `SUCCESSFUL READ OF XREF`, `CARD NUMBER: `, `ACCOUNT ID : `, `CUSTOMER ID: ` (xref fields); set read-status 0.
   - **INVALID KEY:** display `INVALID CARD NUMBER FOR XREF`; set read-status 4.
4. If xref read-status = 0: `3000-READ-ACCOUNT` — `MOVE XREF-ACCT-ID TO ACCT-ID`, random `READ ACCOUNT-FILE KEY IS FD-ACCT-ID`:
   - **NOT INVALID KEY:** display `SUCCESSFUL READ OF ACCOUNT FILE`.
   - **INVALID KEY:** display `INVALID ACCOUNT NUMBER FOUND`; then, since account read-status ≠ 0, the caller displays `ACCOUNT <ACCT-ID> NOT FOUND`.
   Else (xref failed): display `CARD NUMBER <n> COULD NOT BE VERIFIED. SKIPPING TRANSACTION ID-<id>`.

Output is bookended by `START/END OF EXECUTION OF PROGRAM CBTRN01C`.

## Key behaviors that must be preserved (parity-critical)

- **Raw record echo — overpunch NOT normalized.** `DISPLAY DALYTRAN-RECORD` follows a `READ ... INTO` group move, so the record is emitted as raw bytes. The signed `DALYTRAN-AMT` keeps its trailing overpunch character (`G`, `}`, `{`, …) in the printed line — unlike CBACT01C, where the displayed group is reconstructed. The modern port echoes the raw record verbatim.
- **End-of-file leftover lookup (duplicate output).** `READ ... INTO` does **not** modify `DALYTRAN-RECORD` on `AT END`. The main loop's card-verification block runs on the EOF iteration too, so the program performs **one extra xref lookup** using the *previous* transaction's leftover `DALYTRAN-CARD-NUM`, duplicating that transaction's lookup output line(s). The port reproduces this exactly.
- **Number formatting in messages.** `XREF-ACCT-ID` / `ACCT-ID` (`9(11)`) and `XREF-CUST-ID` (`9(09)`) are displayed zero-padded to their full width; `X(16)` card/id fields are displayed as stored.
- **Zoned-decimal / overpunch decoding** (for any consumer that must interpret `DALYTRAN-AMT`): sign in the last byte, `{`=+0…`I`=+9, `}`=-0…`R`=-9.

## External dependencies (stubbed off-platform)

- `CEE3ABD` — z/OS Language Environment abend service; reused from the shared COBOL stub (`legacy/CEE3ABD.cob`), surfaces the code and exits non-zero. (No `COBDATFT` date routine is used by this program.)
- Off-platform staging: `legacy/CBTR1LOAD.cob` loads the small ASCII fixtures into the indexed (KSDS) files (replacing the mainframe IDCAMS REPRO). `DALYTRAN` is a plain sequential file read directly.

## Modernization

Reimplemented in TypeScript (`modern/src/cbtrn01c.ts`). Behavioral parity is enforced by `modern/test/cbtrn01c.parity.test.ts`, which asserts the modern stdout matches the GnuCOBOL golden baseline **byte-for-byte**, plus unit tests for the overpunch decoder and record parsing. CI (`.github/workflows/cbtrn01c-parity.yml`) rebuilds the COBOL baseline with GnuCOBOL and re-runs parity on every push/PR.
