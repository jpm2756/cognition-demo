# CBCUS01C — Business-Logic Specification (extracted)

*Source: `aws-samples/aws-mainframe-modernization-carddemo`, `app/cbl/CBCUS01C.cbl`. This document is the plain-language spec Devin extracts as step 1 of the modernization workflow.*

## Purpose

Batch program that reads the **customer master file** (`CUSTFILE`) sequentially and, for every customer, prints the raw fixed-length `CUSTOMER-RECORD`. It is the canonical "read the customer file" batch job in CardDemo — the customer-tier analogue of `CBACT01C` (account file).

## Inputs

| Logical file (DD) | Organization | Record | Copybook |
|---|---|---|---|
| `CUSTFILE` | Indexed (KSDS), key = `CUST-ID` | 500 bytes | `CVCUS01Y` (`CUSTOMER-RECORD`) |

`CUSTOMER-RECORD` layout (`CVCUS01Y`, RECLN 500):

| Field | Picture | Offset (0-based) | Notes |
|---|---|---|---|
| `CUST-ID` | `9(09)` | 0–9 | key (unsigned) |
| `CUST-FIRST-NAME` | `X(25)` | 9–34 | |
| `CUST-MIDDLE-NAME` | `X(25)` | 34–59 | |
| `CUST-LAST-NAME` | `X(25)` | 59–84 | |
| `CUST-ADDR-LINE-1` | `X(50)` | 84–134 | |
| `CUST-ADDR-LINE-2` | `X(50)` | 134–184 | |
| `CUST-ADDR-LINE-3` | `X(50)` | 184–234 | |
| `CUST-ADDR-STATE-CD` | `X(02)` | 234–236 | |
| `CUST-ADDR-COUNTRY-CD` | `X(03)` | 236–239 | |
| `CUST-ADDR-ZIP` | `X(10)` | 239–249 | |
| `CUST-PHONE-NUM-1` | `X(15)` | 249–264 | |
| `CUST-PHONE-NUM-2` | `X(15)` | 264–279 | |
| `CUST-SSN` | `9(09)` | 279–288 | unsigned |
| `CUST-GOVT-ISSUED-ID` | `X(20)` | 288–308 | |
| `CUST-DOB-YYYY-MM-DD` | `X(10)` | 308–318 | `YYYY-MM-DD` |
| `CUST-EFT-ACCOUNT-ID` | `X(10)` | 318–328 | |
| `CUST-PRI-CARD-HOLDER-IND` | `X(01)` | 328–329 | |
| `CUST-FICO-CREDIT-SCORE` | `9(03)` | 329–332 | unsigned |
| `FILLER` | `X(168)` | 332–500 | |

## Outputs

**stdout (DISPLAY):** bookended by `START/END OF EXECUTION OF PROGRAM CBCUS01C`. For every customer record the raw 500-byte `CUSTOMER-RECORD` is printed **twice** (see below). No derived flat files are produced (CBCUS01C is a pure read-and-print job — unlike `CBACT01C`, it has no `OUTFILE`/`ARRYFILE`/`VBRCFILE`).

## Key behaviors that must be preserved (parity-critical)

- **Each record is DISPLAYed twice.** `1000-CUSTFILE-GET-NEXT` performs the `READ … INTO CUSTOMER-RECORD` and, on file status `'00'`, `DISPLAY CUSTOMER-RECORD`. Control returns to the main `PERFORM` loop, which — while `END-OF-FILE = 'N'` — issues a second `DISPLAY CUSTOMER-RECORD`. So the golden output contains two identical consecutive lines per record.
- **No signed/zoned-decimal fields.** Every numeric field (`CUST-ID`, `CUST-SSN`, `CUST-FICO-CREDIT-SCORE`) is *unsigned* `PIC 9`, so the group `DISPLAY` is a straight byte echo — there is **no overpunch/sign normalization** as there is in `CBACT01C`. The modern port still reconstructs the record from parsed fields to enforce field widths and mirror the technique.
- **Fixed 500-byte record, trailing spaces preserved.** Records are space-padded to 500 bytes; the trailing `FILLER` blanks appear verbatim in the output.

## External dependencies (stubbed off-platform)

- `CEE3ABD` — z/OS Language Environment abend service; only invoked on an I/O error. Reused from the shared COBOL stub (`legacy/CEE3ABD.cob`), which surfaces the abend code and exits non-zero. (CBCUS01C does **not** call `COBDATFT`.)

## Modernization

Reimplemented in TypeScript (`modern/src/cbcus01c.ts`). Behavioral parity is enforced by `modern/test/cbcus01c.parity.test.ts`, which asserts the modern stdout matches the GnuCOBOL golden baseline **byte-for-byte**, plus focused unit tests for the fixed-width field slicing, byte-exact re-rendering, and the twice-per-record display. CI (`.github/workflows/cbcus01c-parity.yml`) rebuilds the COBOL baseline with GnuCOBOL from the unmodified source and re-runs parity on every push/PR.

## Off-mainframe run

```bash
cd legacy && ./run_cbcus01c.sh          # -> legacy/out/cbcus01c.golden.txt
cd ../modern && npm install
node --require ts-node/register --test test/cbcus01c.parity.test.ts
```

`legacy/CUSTLOAD.cob` stages the ASCII extract (`legacy/custdata.txt`, a small deterministic fixture of the first 5 CardDemo customer records) into the indexed `CUSTFILE` that the unmodified `CBCUS01C` reads — the off-platform replacement for the mainframe IDCAMS REPRO step. DD name `CUSTFILE` is mapped to a local file via an environment variable in `run_cbcus01c.sh`.
