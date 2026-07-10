# CBIMPORT — Business-Logic Specification (extracted)

*Source: `aws-samples/aws-mainframe-modernization-carddemo`, `app/cbl/CBIMPORT.cbl`. This document is the plain-language spec Devin extracts as step 1 of the modernization workflow.*

## Purpose

Batch program that ingests a **branch-migration export file** — a single
sequential file of fixed 500-byte multi-record structures (`CVEXPORT.cpy`,
`EXPORT-RECORD`) — and **demultiplexes** it. Each record carries a one-byte
`EXPORT-REC-TYPE`; based on that type the record is re-mapped into one of five
normalized CardDemo target files (CUSTOMER / ACCOUNT / CARD-XREF / TRANSACTION /
CARD). Records with an unrecognized type are written to an ERROR report. At the
end it DISPLAYs per-type counters.

## Inputs

| Logical file (DD) | Organization (mainframe) | Record | Copybook |
|---|---|---|---|
| `EXPFILE` | Indexed (KSDS), key = `EXPORT-SEQUENCE-NUM` | 500 bytes | `CVEXPORT` (`EXPORT-RECORD`) |

The program reads `EXPORT-INPUT` **sequentially only** (it never does a keyed
read), so off-platform it is read as a flat SEQUENTIAL file — see
[Off-platform shims](#off-platform-shims).

### `EXPORT-RECORD` header (`CVEXPORT`, RECLN 500)

| Field | Picture / usage | Bytes (offset) | Notes |
|---|---|---|---|
| `EXPORT-REC-TYPE` | `X(1)` | 0 | `C`/`A`/`X`/`T`/`D`; anything else → ERROR |
| `EXPORT-TIMESTAMP` | `X(26)` | 1 | export metadata (not copied to targets) |
| `EXPORT-SEQUENCE-NUM` | `9(9) COMP` | 27 (4 bytes) | big-endian binary |
| `EXPORT-BRANCH-ID` | `X(4)` | 31 | |
| `EXPORT-REGION-CODE` | `X(5)` | 35 | |
| `EXPORT-RECORD-DATA` | `X(460)` | 40 | REDEFINEd per record type (below) |

The 460-byte payload is `REDEFINES`d into five type-specific layouts. Numeric
fields use mixed usages — **`COMP`** (big-endian binary), **`COMP-3`** (packed
decimal), and **`DISPLAY`** (zoned) — noted per field. Offsets below are
relative to the start of the 460-byte payload (add 40 for absolute).

**Type `C` — `EXPORT-CUSTOMER-DATA`** → CUSTOMER (`CVCUS01Y`, 500 bytes)

| Export field | usage | rel off | → target field | target pic |
|---|---|---|---|---|
| `EXP-CUST-ID` | `9(9) COMP` (4) | 0 | `CUST-ID` | `9(9)` |
| `EXP-CUST-FIRST/MIDDLE/LAST-NAME` | `X(25)` ×3 | 4/29/54 | same | `X(25)` |
| `EXP-CUST-ADDR-LINE(1..3)` | `X(50)` ×3 | 79/129/179 | `CUST-ADDR-LINE-1..3` | `X(50)` |
| `EXP-CUST-ADDR-STATE-CD` | `X(2)` | 229 | same | `X(2)` |
| `EXP-CUST-ADDR-COUNTRY-CD` | `X(3)` | 231 | same | `X(3)` |
| `EXP-CUST-ADDR-ZIP` | `X(10)` | 234 | same | `X(10)` |
| `EXP-CUST-PHONE-NUM(1..2)` | `X(15)` ×2 | 244/259 | `CUST-PHONE-NUM-1..2` | `X(15)` |
| `EXP-CUST-SSN` | `9(9) DISPLAY` | 274 | `CUST-SSN` | `9(9)` |
| `EXP-CUST-GOVT-ISSUED-ID` | `X(20)` | 283 | same | `X(20)` |
| `EXP-CUST-DOB-YYYY-MM-DD` | `X(10)` | 303 | same | `X(10)` |
| `EXP-CUST-EFT-ACCOUNT-ID` | `X(10)` | 313 | same | `X(10)` |
| `EXP-CUST-PRI-CARD-HOLDER-IND` | `X(1)` | 323 | same | `X(1)` |
| `EXP-CUST-FICO-CREDIT-SCORE` | `9(3) COMP-3` (2) | 324 | `CUST-FICO-CREDIT-SCORE` | `9(3)` |

**Type `A` — `EXPORT-ACCOUNT-DATA`** → ACCOUNT (`CVACT01Y`, 300 bytes)

| Export field | usage | rel off | → target | target pic |
|---|---|---|---|---|
| `EXP-ACCT-ID` | `9(11) DISPLAY` | 0 | `ACCT-ID` | `9(11)` |
| `EXP-ACCT-ACTIVE-STATUS` | `X(1)` | 11 | same | `X(1)` |
| `EXP-ACCT-CURR-BAL` | `S9(10)V99 COMP-3` (7) | 12 | `ACCT-CURR-BAL` | `S9(10)V99` |
| `EXP-ACCT-CREDIT-LIMIT` | `S9(10)V99 DISPLAY` (12) | 19 | `ACCT-CREDIT-LIMIT` | `S9(10)V99` |
| `EXP-ACCT-CASH-CREDIT-LIMIT` | `S9(10)V99 COMP-3` (7) | 31 | `ACCT-CASH-CREDIT-LIMIT` | `S9(10)V99` |
| `EXP-ACCT-OPEN/EXPIRAION/REISSUE-DATE` | `X(10)` ×3 | 38/48/58 | same | `X(10)` |
| `EXP-ACCT-CURR-CYC-CREDIT` | `S9(10)V99 DISPLAY` (12) | 68 | `ACCT-CURR-CYC-CREDIT` | `S9(10)V99` |
| `EXP-ACCT-CURR-CYC-DEBIT` | `S9(10)V99 COMP` (6) | 80 | `ACCT-CURR-CYC-DEBIT` | `S9(10)V99` |
| `EXP-ACCT-ADDR-ZIP` | `X(10)` | 86 | same | `X(10)` |
| `EXP-ACCT-GROUP-ID` | `X(10)` | 96 | same | `X(10)` |

**Type `X` — `EXPORT-CARD-XREF-DATA`** → CARD-XREF (`CVACT03Y`, 50 bytes)

| Export field | usage | rel off | → target | target pic |
|---|---|---|---|---|
| `EXP-XREF-CARD-NUM` | `X(16)` | 0 | `XREF-CARD-NUM` | `X(16)` |
| `EXP-XREF-CUST-ID` | `9(9) DISPLAY` | 16 | `XREF-CUST-ID` | `9(9)` |
| `EXP-XREF-ACCT-ID` | `9(11) COMP` (5) | 25 | `XREF-ACCT-ID` | `9(11)` |

**Type `T` — `EXPORT-TRANSACTION-DATA`** → TRANSACTION (`CVTRA05Y`, 350 bytes)

| Export field | usage | rel off | → target | target pic |
|---|---|---|---|---|
| `EXP-TRAN-ID` | `X(16)` | 0 | `TRAN-ID` | `X(16)` |
| `EXP-TRAN-TYPE-CD` | `X(2)` | 16 | same | `X(2)` |
| `EXP-TRAN-CAT-CD` | `9(4) DISPLAY` | 18 | `TRAN-CAT-CD` | `9(4)` |
| `EXP-TRAN-SOURCE` | `X(10)` | 22 | same | `X(10)` |
| `EXP-TRAN-DESC` | `X(100)` | 32 | same | `X(100)` |
| `EXP-TRAN-AMT` | `S9(9)V99 COMP-3` (6) | 132 | `TRAN-AMT` | `S9(9)V99` |
| `EXP-TRAN-MERCHANT-ID` | `9(9) COMP` (4) | 138 | `TRAN-MERCHANT-ID` | `9(9)` |
| `EXP-TRAN-MERCHANT-NAME/CITY` | `X(50)` ×2 | 142/192 | same | `X(50)` |
| `EXP-TRAN-MERCHANT-ZIP` | `X(10)` | 242 | same | `X(10)` |
| `EXP-TRAN-CARD-NUM` | `X(16)` | 252 | same | `X(16)` |
| `EXP-TRAN-ORIG-TS/PROC-TS` | `X(26)` ×2 | 268/294 | same | `X(26)` |

**Type `D` — `EXPORT-CARD-DATA`** → CARD (`CVACT02Y`, 150 bytes)

| Export field | usage | rel off | → target | target pic |
|---|---|---|---|---|
| `EXP-CARD-NUM` | `X(16)` | 0 | `CARD-NUM` | `X(16)` |
| `EXP-CARD-ACCT-ID` | `9(11) COMP` (5) | 16 | `CARD-ACCT-ID` | `9(11)` |
| `EXP-CARD-CVV-CD` | `9(3) COMP` (2) | 21 | `CARD-CVV-CD` | `9(3)` |
| `EXP-CARD-EMBOSSED-NAME` | `X(50)` | 23 | same | `X(50)` |
| `EXP-CARD-EXPIRAION-DATE` | `X(10)` | 73 | same | `X(10)` |
| `EXP-CARD-ACTIVE-STATUS` | `X(1)` | 83 | same | `X(1)` |

## Outputs

| DD | Copybook | RECLN | Written when |
|---|---|---|---|
| `CUSTOUT` | `CVCUS01Y` `CUSTOMER-RECORD` | 500 | `REC-TYPE = 'C'` |
| `ACCTOUT` | `CVACT01Y` `ACCOUNT-RECORD` | 300 | `REC-TYPE = 'A'` |
| `XREFOUT` | `CVACT03Y` `CARD-XREF-RECORD` | 50 | `REC-TYPE = 'X'` |
| `TRNXOUT` | `CVTRA05Y` `TRAN-RECORD` | 350 | `REC-TYPE = 'T'` |
| `CARDOUT` | `CVACT02Y` `CARD-RECORD` | 150 | `REC-TYPE = 'D'` |
| `ERROUT` | `WS-ERROR-RECORD` | 132 | unknown `REC-TYPE` |

Program also DISPLAYs a start banner, import date/time (`FUNCTION
CURRENT-DATE` — **non-deterministic**), and per-type counters. Those stdout
lines are *not* part of the parity baseline; the golden baseline is assembled
from the six **output files** only (see `legacy/run_cbimport.sh`).

## Key behaviors that must be preserved (parity-critical)

- **Per-record: `INITIALIZE` then MOVEs then `WRITE`.** `INITIALIZE` sets each
  *named* elementary item (spaces for `X`, zeros for `9`) but **leaves `FILLER`
  untouched** at the record's initial binary zero. Every named field is then
  overwritten by a MOVE, so the net observable output is: mapped fields carry
  their value (space/zero padded to the field width), and the **trailing
  `FILLER` region stays NUL (`0x00`)**.
- **`COMP` (binary) decode.** Big-endian. Signed fields (`EXP-ACCT-CURR-CYC-DEBIT`,
  `S9(10)V99 COMP`, 6 bytes) are two's-complement; unsigned fields
  (`EXP-CUST-ID`, `EXP-XREF-ACCT-ID`, `EXP-CARD-ACCT-ID`, `EXP-CARD-CVV-CD`,
  `EXP-TRAN-MERCHANT-ID`) are plain. Byte widths follow the MicroFocus table
  (9 digits → 4 bytes, 11 → 5, 12 → 6).
- **`COMP-3` (packed decimal) decode.** Two digits per byte; the final low
  nibble is the sign (`0xD`/`0xB` = negative, `0xC`/`0xF`/`0xA`/`0xE` =
  positive).
- **Signed zoned re-render (GnuCOBOL ASCII trailing sign).** When a numeric
  value lands in a `S9(n)V99` DISPLAY target, GnuCOBOL renders a **positive**
  value with a plain trailing digit and a **negative** value by replacing the
  last digit `D` with the byte `0x70+D` (`'0'→'p'`, …, `'9'→'y'`). This is
  **not** the EBCDIC `{..I / }..R` overpunch used by the checked-in
  `acctdata.txt` fixture for CBACT01C — the difference matters because CBIMPORT
  targets are produced by the GnuCOBOL runtime on an ASCII platform.
- **Value conversion across usages.** A COMP/COMP-3 source moved to a DISPLAY
  target is decoded to its numeric value and re-encoded in the target
  picture; magnitudes are right-justified zero-filled, sign applied per above.
- **Demux order is stream order.** Records are appended to each output file in
  the order they appear in the input; e.g. two `A` records emit two ACCOUNT
  records in input order.

## External CALLs / dependencies

- `CEE3ABD` — LE abend service (called by `9999-ABEND-PROGRAM` on a fatal file
  error). Reused from the shared CardDemo stub (`legacy/CEE3ABD.cob`); never
  invoked on the clean fixture.
- No date-conversion CALL (`COBDATFT` not used); `FUNCTION CURRENT-DATE` is the
  only time source and only affects stdout / the (unused) ERROR record.

## Off-platform shims

Purely I/O / build-time; **PROCEDURE DIVISION / business logic is unchanged**:

1. **`ORGANIZATION SEQUENTIAL`.** The mainframe FD declares `EXPFILE` as
   INDEXED keyed on `EXPORT-SEQUENCE-NUM`, but that key lives in
   `WORKING-STORAGE` (via `COPY CVEXPORT`), not in the FD record, so GnuCOBOL
   cannot resolve it. Since the program only ever reads sequentially, the
   `SELECT` is read as a flat SEQUENTIAL file.
2. **`-fassign-clause=external`.** Compiled with this flag so every
   `ASSIGN TO <name>` resolves from the environment variable of that name
   (mainframe DD → local file). Under `-std=mf`'s default *dynamic* assignment
   the assign-name aliases a shared scratch field that the `CURRENT-DATE`
   MOVEs in `1000-INITIALIZE` clobber *before* the files are OPENed, producing
   a bogus filename and `OPEN` status 35. `external` binds the DD name
   statically and sidesteps that codegen quirk.

See `legacy/run_cbimport.sh` for the exact compile/run/assemble steps and
`modern/src/cbimport.ts` for the TypeScript reimplementation.
