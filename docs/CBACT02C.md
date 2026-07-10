# CBACT02C — Business-Logic Specification (extracted)

*Source: `aws-samples/aws-mainframe-modernization-carddemo`, `app/cbl/CBACT02C.cbl` (178 lines). This document is the plain-language spec Devin extracts as step 1 of the modernization workflow.*

## Purpose

Batch program that reads the **card data file** (`CARDFILE`) sequentially and prints every card record. It is the canonical "read & print the card file" batch job in CardDemo — the card-master analogue of `CBACT01C` (account master), but with no derived/report output.

## Inputs

| Logical file (DD) | Organization | Record | Copybook |
|---|---|---|---|
| `CARDFILE` | Indexed (KSDS), key = `CARD-NUM` | 150 bytes | `CVACT02Y` (`CARD-RECORD`) |

`CARD-RECORD` layout (`CVACT02Y`, RECLN 150):

| Field | Picture | Offset (0-based) | Notes |
|---|---|---|---|
| `CARD-NUM` | `X(16)` | 0–15 | RECORD KEY |
| `CARD-ACCT-ID` | `9(11)` | 16–26 | unsigned zoned (plain digits) |
| `CARD-CVV-CD` | `9(03)` | 27–29 | unsigned zoned (plain digits) |
| `CARD-EMBOSSED-NAME` | `X(50)` | 30–79 | space-padded |
| `CARD-EXPIRAION-DATE` | `X(10)` | 80–89 | `YYYY-MM-DD` |
| `CARD-ACTIVE-STATUS` | `X(01)` | 90 | `Y`/`N` |
| `FILLER` | `X(59)` | 91–149 | spaces |

The `FD-CARDFILE-REC` in the program declares the record as `FD-CARD-NUM PIC X(16)` + `FD-CARD-DATA PIC X(134)` (150 bytes total); the record is `READ ... INTO CARD-RECORD` and interpreted via the `CVACT02Y` copybook above.

## Outputs

`stdout` only (no derived files, unlike `CBACT01C`):

1. Banner line: `START OF EXECUTION OF PROGRAM CBACT02C`.
2. For each card record read in ascending `CARD-NUM` order: `DISPLAY CARD-RECORD` — the whole 150-byte record.
3. Banner line: `END OF EXECUTION OF PROGRAM CBACT02C`.

On an I/O error the program `DISPLAY`s an error message, prints the file status via `9910-DISPLAY-IO-STATUS`, and abends through `CEE3ABD`.

## Control flow

```
DISPLAY 'START OF EXECUTION OF PROGRAM CBACT02C'
0000-CARDFILE-OPEN            (OPEN INPUT CARDFILE)
PERFORM UNTIL END-OF-FILE = 'Y'
    1000-CARDFILE-GET-NEXT    (READ ... INTO CARD-RECORD)
    IF not EOF: DISPLAY CARD-RECORD
9000-CARDFILE-CLOSE
DISPLAY 'END OF EXECUTION OF PROGRAM CBACT02C'
GOBACK
```

File-status handling mirrors `CBACT01C`: status `00` → OK, `10` → EOF (`APPL-EOF`, stop loop), anything else → error → abend.

## Non-obvious semantics

- **No signed / COMP-3 / overpunch fields.** Every field in `CARD-RECORD` is `USAGE DISPLAY`; the two numeric fields (`CARD-ACCT-ID 9(11)`, `CARD-CVV-CD 9(03)`) are *unsigned*, so their zoned representation is just plain ASCII digits. `DISPLAY CARD-RECORD` therefore emits the record's bytes unchanged — no numeric re-rendering / sign normalization is required (contrast `CBACT01C`, which normalizes trailing overpunch signs). The modern port still parses fields and re-renders (`renderRecord`), which is a pure byte round-trip here.
- **Record order = RECORD KEY order.** `CARDFILE` is a KSDS read `SEQUENTIAL`, i.e. ascending `CARD-NUM`. The modern port sorts input rows by `CARD-NUM` before emitting to reproduce that ordering regardless of input file order.
- **DISPLAY width = 150.** Each printed line is exactly the 150-byte record (trailing `FILLER` spaces preserved), followed by a newline.
- **No date routine.** Unlike `CBACT01C`, `CBACT02C` does **not** call `COBDATFT`; `CARD-EXPIRAION-DATE` is passed through as-is.

## External CALLs / dependencies

| Dependency | Role |
|---|---|
| `CEE3ABD` | z/OS LE abnormal-termination (abend) service. Stubbed off-platform (`legacy/CEE3ABD.cob`, shared with `CBACT01C`). |

No other subprograms are called. Copybook: `CVACT02Y` (card record layout).

## Off-mainframe run (this repo)

- `legacy/CARDLOAD.cob` stages the flat ASCII extract (`legacy/carddata.txt`, 50 fixed 150-byte records from upstream `app/data/ASCII/carddata.txt`) into an indexed `CARDFILE` (KSDS), replacing the mainframe IDCAMS REPRO step — mirroring `ACCTLOAD.cob`.
- `legacy/run_cbact02c.sh` compiles `CARDLOAD`, the shared `CEE3ABD` stub, and the **unmodified** `CBACT02C.cbl` under GnuCOBOL (`cobc -std=mf`), maps the `CARDFILE` DD name to a local file via env var, loads the data, and runs the program — emitting the golden baseline `legacy/out/cbact02c.golden.txt`.
- The modern reimplementation (`modern/src/cbact02c.ts`) and the differential parity test (`modern/test/cbact02c.parity.test.ts`) assert the modern stdout equals that baseline byte-for-byte.
