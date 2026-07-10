# CBTRN03C — Business-Logic Specification

*Source: `aws-samples/aws-mainframe-modernization-carddemo`, `app/cbl/CBTRN03C.cbl` (649 lines).*

## Purpose

`CBTRN03C` prints the fixed-width daily transaction detail report. It enriches each processed transaction with an account ID, transaction-type description, and transaction-category description, then writes page headers, per-account control totals, page totals, and a grand total.

## Inputs

| DD name | Organization | Record | Key |
|---|---|---|---|
| `TRANFILE` | Sequential | 350-byte `TRAN-RECORD` (`CVTRA05Y`) | Pre-sorted by `TRAN-CARD-NUM` |
| `CARDXREF` | Indexed | 50-byte `CARD-XREF-RECORD` (`CVACT03Y`) | `XREF-CARD-NUM`, `X(16)` |
| `TRANTYPE` | Indexed | 60-byte `TRAN-TYPE-RECORD` (`CVTRA03Y`) | `TRAN-TYPE`, `X(02)` |
| `TRANCATG` | Indexed | 60-byte `TRAN-CAT-RECORD` (`CVTRA04Y`) | type/category composite, `X(02)` + `9(04)` |
| `DATEPARM` | Sequential | 80 bytes; start date, one space, end date | Dates are `X(10)`, `YYYY-MM-DD` |

Parity uses 18 deterministic records staged from upstream `app/data/ASCII/dailytran.txt`. The staging step copies each original timestamp into `TRAN-PROC-TS`, sorts by card number as the `TRANREPT.jcl` SORT step does, and selects three six-transaction card groups. The upstream lookup extracts are loaded into local indexed files by `CBTRN03LOAD.cob`.

### Transaction fields used

| Field | Picture | Position / behavior |
|---|---|---|
| `TRAN-ID` | `X(16)` | Report transaction ID |
| `TRAN-TYPE-CD` | `X(02)` | Type lookup key |
| `TRAN-CAT-CD` | `9(04)` | Category lookup key |
| `TRAN-SOURCE` | `X(10)` | Printed in detail |
| `TRAN-AMT` | `S9(09)V99` | 11-byte zoned amount; arithmetic and edited output |
| `TRAN-CARD-NUM` | `X(16)` | Sort/control-break and account lookup key |
| `TRAN-PROC-TS` | `X(26)` | First ten bytes are compared to the date range |

## Output

`TRANREPT` is a sequential report of contiguous 133-byte records defined by `CVTRA07Y`:

- report name and date-range header;
- blank line and two transaction column-header records;
- transaction details;
- `Account Total` at card-number changes;
- `Page Total` when the internal line counter reaches a multiple of 20;
- final page and grand totals.

`legacy/run_cbtrn03c.sh` copies the raw `TRANREPT` bytes to `legacy/out/cbtrn03c.golden.txt`. The golden file intentionally has no line delimiters: its 35 fixed records total 4,655 bytes.

## Parity-critical semantics

- Input must be grouped by `TRAN-CARD-NUM`; the program detects control breaks but does not sort.
- Type descriptions are truncated to 15 bytes and category descriptions to 29 bytes by the report layout.
- `PIC -ZZZ,ZZZ,ZZZ.ZZ` prints a leading blank for positive detail amounts. Total fields use `PIC +ZZZ,ZZZ,ZZZ.ZZ` and always show a sign.
- Under GnuCOBOL `-std=mf`, ASCII overpunch letters in the final byte of `S9(09)V99` are interpreted as a positive zero digit during arithmetic. For example, `0000001838H` becomes `183.80`, and `0000000478Q` becomes `47.80`. The TypeScript port preserves this observed off-platform behavior exactly.
- Headers count toward the 20-line page size. Account-total records also increment the same counter, so a control break can immediately cause a page break.
- The unmodified program's EOF path retains the last transaction record, adds its amount to the page/account totals a second time, writes the final page total, and then writes the grand total. It does not emit a final account-total record. These quirks are observable output and are therefore mirrored rather than corrected.
- Totals use integer implied cents; no floating-point rounding is involved.

## External dependencies

- `CEE3ABD` — z/OS Language Environment abend service, supplied by the existing local `legacy/CEE3ABD.cob` stub.
- `TRANREPT.jcl` — upstream orchestration that filters by processing date and sorts by card number before invoking `CBTRN03C`.
- Copybooks: `CVTRA05Y`, `CVACT03Y`, `CVTRA03Y`, `CVTRA04Y`, and `CVTRA07Y`. None contain nested `COPY` statements.

## Modernization

`modern/src/cbtrn03c.ts` parses the same fixed layouts, performs the same lookups and control breaks, and emits a byte buffer of 133-byte report records. `modern/test/cbtrn03c.parity.test.ts` compares that buffer directly with the independently rebuilt COBOL golden baseline and includes focused tests for zoned/overpunch interpretation and edited numeric formatting.
