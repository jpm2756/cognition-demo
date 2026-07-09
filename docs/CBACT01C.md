# CBACT01C — Business-Logic Specification (extracted)

*Source: `aws-samples/aws-mainframe-modernization-carddemo`, `app/cbl/CBACT01C.cbl` (430 lines). This document is the plain-language spec Devin extracts as step 1 of the modernization workflow.*

## Purpose

Batch program that reads the **account master file** and, for every account, prints its fields, prints the raw record, and derives two variable-length report records (`VBRC-REC1`, `VBRC-REC2`). It is the canonical "read the account file" batch job in CardDemo.

## Inputs

| Logical file (DD) | Organization | Record | Copybook |
|---|---|---|---|
| `ACCTFILE` | Indexed (KSDS), key = `ACCT-ID` | 300 bytes | `CVACT01Y` (`ACCOUNT-RECORD`) |

`ACCOUNT-RECORD` layout (`CVACT01Y`, RECLN 300):

| Field | Picture | Notes |
|---|---|---|
| `ACCT-ID` | `9(11)` | key |
| `ACCT-ACTIVE-STATUS` | `X(01)` | Y/N |
| `ACCT-CURR-BAL` | `S9(10)V99` | zoned, trailing overpunch sign |
| `ACCT-CREDIT-LIMIT` | `S9(10)V99` | |
| `ACCT-CASH-CREDIT-LIMIT` | `S9(10)V99` | |
| `ACCT-OPEN-DATE` | `X(10)` | `YYYY-MM-DD` |
| `ACCT-EXPIRAION-DATE` | `X(10)` | |
| `ACCT-REISSUE-DATE` | `X(10)` | |
| `ACCT-CURR-CYC-CREDIT` | `S9(10)V99` | |
| `ACCT-CURR-CYC-DEBIT` | `S9(10)V99` | |
| `ACCT-ADDR-ZIP` | `X(10)` | |
| `ACCT-GROUP-ID` | `X(10)` | |
| `FILLER` | `X(178)` | |

## Outputs

1. **stdout (DISPLAY):** per account — one labeled line per field, a separator, then `VBRC-REC1:` and `VBRC-REC2:` lines, then the re-rendered 300-byte record. Bookended by `START/END OF EXECUTION OF PROGRAM CBACT01C`.
2. `OUTFILE`, `ARRYFILE`, `VBRCFILE` — derived flat files (out of scope for the stdout parity slice; the same technique extends to them).

## Key behaviors that must be preserved (parity-critical)

- **Zoned-decimal / overpunch decoding.** Signed `S9(10)V99` fields store the sign in the last byte (`{`=+0…`I`=+9, `}`=-0…`R`=-9). Displayed as `±NNNNNNNNNN.NN`.
- **Record re-rendering.** When the program `DISPLAY`s the whole `ACCOUNT-RECORD`, GnuCOBOL **normalizes** the trailing overpunch of each numeric field to a plain digit — so the printed raw record differs from the input file bytes. The modern port reconstructs the record from parsed fields to match.
- **`VBRC-REC2`** = `ACCT-ID` + normalized `ACCT-CURR-BAL` + normalized `ACCT-CREDIT-LIMIT` + `ACCT-REISSUE-DATE` year.

## External dependencies (stubbed off-platform)

- `COBDATFT` — assembler date formatter (`asm/COBDATFT.asm`). Reimplemented as a COBOL stub (`legacy/COBDATFT.cob`) with identical YYYY-MM-DD ↔ YYYYMMDD behavior.
- `CEE3ABD` — z/OS Language Environment abend service; stubbed to surface the code and exit non-zero.

## Modernization

Reimplemented in TypeScript (`modern/src/cbact01c.ts`). Behavioral parity is enforced by `modern/test/parity.test.ts`, which asserts the modern stdout matches the GnuCOBOL golden baseline **byte-for-byte**, plus unit tests for the overpunch decoder edge cases. CI (`.github/workflows/parity.yml`) rebuilds the COBOL baseline with GnuCOBOL and re-runs parity on every push/PR.
