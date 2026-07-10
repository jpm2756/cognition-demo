# CBEXPORT — Business-Logic Specification (extracted)

*Source: `aws-samples/aws-mainframe-modernization-carddemo`, `app/cbl/CBEXPORT.cbl` (582 lines). This document is the plain-language spec extracted as step 1 of the modernization workflow.*

## Purpose

Batch program that performs a **branch-migration export**: it reads five CardDemo master files (customers, accounts, card cross-references, transactions, cards) and writes a single **multi-record export/extract file** for data migration. Every source record becomes one 500-byte export record tagged with a record-type byte, a shared timestamp, an ascending sequence number, and a fixed branch id / region code, followed by a per-type data area.

## Inputs

| Logical file (DD) | Organization | Key | Record | Copybook |
|---|---|---|---|---|
| `CUSTFILE` | Indexed (KSDS) | `CUST-ID` | 500 | `CVCUS01Y` (`CUSTOMER-RECORD`) |
| `ACCTFILE` | Indexed (KSDS) | `ACCT-ID` | 300 | `CVACT01Y` (`ACCOUNT-RECORD`) |
| `XREFFILE` | Indexed (KSDS) | `XREF-CARD-NUM` | 50 | `CVACT03Y` (`CARD-XREF-RECORD`) |
| `TRANSACT` | Indexed (KSDS) | `TRAN-ID` | 350 | `CVTRA05Y` (`TRAN-RECORD`) |
| `CARDFILE` | Indexed (KSDS) | `CARD-NUM` | 150 | `CVACT02Y` (`CARD-RECORD`) |

Each input file is read sequentially in key order until EOF.

## Output

| Logical file (DD) | Organization | Record | Copybook |
|---|---|---|---|
| `EXPFILE` | KSDS on the mainframe (see shim below) | fixed 500 | `CVEXPORT` (`EXPORT-RECORD`) |

The export file is the golden baseline. Records are written in processing order — all customers (type `C`), then accounts (`A`), cross-references (`X`), transactions (`T`), cards (`D`) — each with a monotonically increasing `EXPORT-SEQUENCE-NUM` starting at 1.

### Export record layout (`CVEXPORT`, 500 bytes)

Common header (offsets 0-based):

| Field | Picture | Offset | Bytes | Notes |
|---|---|---|---|---|
| `EXPORT-REC-TYPE` | `X(1)` | 0 | 1 | `C`/`A`/`X`/`T`/`D` |
| `EXPORT-TIMESTAMP` | `X(26)` | 1 | 26 | `YYYY-MM-DD HH:MM:SS.00` + spaces |
| `EXPORT-SEQUENCE-NUM` | `9(9) COMP` | 27 | 4 | big-endian binary |
| `EXPORT-BRANCH-ID` | `X(4)` | 31 | 4 | literal `0001` |
| `EXPORT-REGION-CODE` | `X(5)` | 35 | 5 | literal `NORTH` |
| `EXPORT-RECORD-DATA` | `X(460)` | 40 | 460 | per-type, `REDEFINES` |

Per-type data areas (offsets relative to byte 40) — see `CVEXPORT.cpy` for the full field lists. Representative parity-critical fields:

- **Customer (`C`)**: `EXP-CUST-ID 9(9) COMP` (4 bytes), name/address text, `EXP-CUST-SSN 9(9)` DISPLAY, `EXP-CUST-FICO-CREDIT-SCORE 9(3) COMP-3` (2 bytes).
- **Account (`A`)**: `EXP-ACCT-ID 9(11)` DISPLAY, `EXP-ACCT-CURR-BAL S9(10)V99 COMP-3` (7 bytes), `EXP-ACCT-CREDIT-LIMIT S9(10)V99` DISPLAY (12 bytes, zoned), `EXP-ACCT-CASH-CREDIT-LIMIT S9(10)V99 COMP-3` (7 bytes), `EXP-ACCT-CURR-CYC-CREDIT S9(10)V99` DISPLAY (zoned), `EXP-ACCT-CURR-CYC-DEBIT S9(10)V99 COMP` (6 bytes binary).
- **Cross-reference (`X`)**: `EXP-XREF-CARD-NUM X(16)`, `EXP-XREF-CUST-ID 9(9)` DISPLAY, `EXP-XREF-ACCT-ID 9(11) COMP` (5 bytes).
- **Transaction (`T`)**: text fields, `EXP-TRAN-AMT S9(9)V99 COMP-3` (6 bytes), `EXP-TRAN-MERCHANT-ID 9(9) COMP` (4 bytes), timestamps.
- **Card (`D`)**: `EXP-CARD-NUM X(16)`, `EXP-CARD-ACCT-ID 9(11) COMP` (5 bytes), `EXP-CARD-CVV-CD 9(3) COMP` (2 bytes), embossed name, expiration, status.

## Key behaviors that must be preserved (parity-critical)

- **COMP (binary), GnuCOBOL `-std=mf` `binary-size 1--8`.** Big-endian; the byte width is the minimum that holds the declared digit count: 3-4 digits→2, 7-9→4, 10-11→5, 12-14→6. Signed values use two's complement. (E.g. `9(9)`→4 bytes, `9(11)`→5, `S9(10)V99`→6.)
- **COMP-3 (packed decimal).** Two digits per byte, trailing sign nibble `0xC` (positive) / `0xD` (negative) / `0xF` (unsigned `PIC 9`), high-order zero pad to a whole byte.
- **Zoned → numeric decode.** When a zoned `S9(n)V99` DISPLAY field is `MOVE`d into a COMP/COMP-3 item, GnuCOBOL `-std=mf` decodes the trailing byte as: `'0'..'9'` → that digit, positive; `'p'..'y'` → digit `0..9`, negative; **any other byte** (`'{'`, `'A'..'R'`, `'}'`, …) → digit `0`, positive. This differs from the classic `{`=+0…`I`=+9 overpunch and is reproduced exactly by the modern port.
- **Zoned → zoned MOVE (same PIC).** DISPLAY-to-DISPLAY moves of identical picture are a **verbatim byte copy** — the source overpunch byte is preserved unchanged (e.g. `EXP-ACCT-CREDIT-LIMIT` keeps a trailing `'{'`).
- **Deterministic timestamp.** The program stamps every record from `ACCEPT ... FROM DATE / TIME`. For a reproducible baseline the clock is pinned with GnuCOBOL's `COB_CURRENT_DATE` (no logic change); the modern port uses the same fixed value.

## External dependencies (stubbed off-platform)

- `CEE3ABD` — z/OS Language Environment abend service; reuses the shared COBOL stub (`legacy/CEE3ABD.cob`) that surfaces the code and exits non-zero. Only invoked on I/O errors (not in the happy path).

## Off-platform I/O shim

The mainframe declares `EXPORT-OUTPUT` as a KSDS with `RECORD KEY IS EXPORT-SEQUENCE-NUM` — but that key lives in `WORKING-STORAGE` (copybook `CVEXPORT`), not in the file record, so no off-platform compiler accepts it. Off-platform the file is written as a fixed 500-byte **record-sequential** file instead. Records are emitted in ascending sequence order, so the byte stream is identical to a sequential unload of the KSDS. The 500-byte record content and all business logic are unchanged (see the comment in `legacy/CBEXPORT.cbl`).

## Running off-mainframe

`legacy/run_cbexport.sh` compiles the unmodified program + the `CEE3ABD` stub + a loader (`CBEXPLOAD.cob`) under GnuCOBOL, stages the small deterministic fixtures in `legacy/cbexport_data/` into the five indexed input files, pins the clock, runs `CBEXPORT`, and emits `legacy/out/cbexport.golden.txt` (the golden baseline).

## Modernization

Reimplemented in TypeScript (`modern/src/cbexport.ts`). Behavioral parity is enforced by `modern/test/cbexport.parity.test.ts`, which asserts the modern export bytes match the GnuCOBOL golden baseline **byte-for-byte**, plus focused unit tests for the COMP-3 / COMP / zoned-decode edge cases. CI (`.github/workflows/cbexport-parity.yml`) rebuilds the COBOL baseline with GnuCOBOL and re-runs parity on every push/PR.
