# CBACT03C — Business-Logic Specification (extracted)

*Source: `aws-samples/aws-mainframe-modernization-carddemo`, `app/cbl/CBACT03C.cbl`. This document is the plain-language spec Devin extracts as step 1 of the modernization workflow.*

## Purpose

Batch program that reads the **card cross-reference file** (`XREFFILE`) sequentially and, for every record, prints the whole `CARD-XREF-RECORD`. It is the canonical "read the card xref file" batch job in CardDemo — the analogue of `CBACT01C` for the card→customer→account cross-reference.

## Inputs

| Logical file (DD) | Organization | Record | Copybook |
|---|---|---|---|
| `XREFFILE` | Indexed (KSDS), key = `FD-XREF-CARD-NUM` (`X(16)`) | 50 bytes | `CVACT03Y` (`CARD-XREF-RECORD`) |

`CARD-XREF-RECORD` layout (`CVACT03Y`, RECLN 50):

| Field | Picture | Offset | Notes |
|---|---|---|---|
| `XREF-CARD-NUM` | `X(16)` | 0 | record key (card number) |
| `XREF-CUST-ID` | `9(09)` | 16 | unsigned zoned decimal (plain digits) |
| `XREF-ACCT-ID` | `9(11)` | 25 | unsigned zoned decimal (plain digits) |
| `FILLER` | `X(14)` | 36 | trailing spaces |

The FD (`FD-XREFFILE-REC`) describes the same 50 bytes as `FD-XREF-CARD-NUM PIC X(16)` + `FD-XREF-DATA PIC X(34)`; records are `READ ... INTO CARD-XREF-RECORD`.

## Outputs

**stdout (DISPLAY only)** — bookended by `START OF EXECUTION OF PROGRAM CBACT03C` and `END OF EXECUTION OF PROGRAM CBACT03C`. CBACT03C has **no output files**; its only product is the DISPLAY stream.

## Key behaviors that must be preserved (parity-critical)

- **Each record is displayed TWICE.** `1000-XREFFILE-GET-NEXT` does `READ ... INTO CARD-XREF-RECORD` and, on status `'00'`, `DISPLAY CARD-XREF-RECORD`; the main `PERFORM UNTIL` loop then `DISPLAY CARD-XREF-RECORD` again for the same record. So each of the N input records yields **2N** identical output lines.
- **Loop / EOF control.** The loop reads until file status `'10'` (EOF) sets `END-OF-FILE = 'Y'`; the record read at EOF is *not* displayed (guarded by `IF END-OF-FILE = 'N'`). Status other than `'00'`/`'10'` triggers `9910-DISPLAY-IO-STATUS` + `9999-ABEND-PROGRAM`.
- **No overpunch / sign normalization.** All fields are `X` or **unsigned** `9`, so the group `DISPLAY` emits the stored bytes verbatim (plain digits, no trailing overpunch). Unlike `CBACT01C`, there is no signed re-rendering — the displayed record equals the 50-byte input record (input padded to 50 with trailing spaces).
- **Fixed 50-byte width.** Each DISPLAY line is exactly 50 characters (36 data bytes + 14 space filler for the ASCII extract).

## External dependencies (stubbed off-platform)

- `CEE3ABD` — z/OS Language Environment abend service; reused shared stub (`legacy/CEE3ABD.cob`) that surfaces the code and exits non-zero. (Only reached on an I/O error; the golden path never abends.)
- No date routine: CBACT03C does **not** call `COBDATFT`.

## Off-platform harness

- `legacy/XREFLOAD.cob` — loader that stages the ASCII extract (`legacy/cardxref.txt`, 50-byte LINE SEQUENTIAL records) into the INDEXED `XREFFILE` KSDS the unmodified program expects (replaces the mainframe IDCAMS REPRO step). Mirrors `ACCTLOAD.cob`.
- `legacy/run_cbact03c.sh` — compiles the loader + `CEE3ABD` stub + `CBACT03C` under GnuCOBOL (`cobc -std=mf`), maps the `XREFFILE` DD name to a local file, loads the fixture, runs the unmodified program, and writes the golden baseline `legacy/out/cbact03c.golden.txt`.
- Fixture: `legacy/cardxref.txt` is the unmodified 50-record `app/data/ASCII/cardxref.txt` from upstream CardDemo.

## Modernization

Reimplemented in TypeScript (`modern/src/cbact03c.ts`). Behavioral parity is enforced by `modern/test/cbact03c.parity.test.ts`, which asserts the modern stdout matches the GnuCOBOL golden baseline **byte-for-byte**, plus unit tests for the field boundaries and the display-twice behavior. CI (`.github/workflows/cbact03c-parity.yml`) rebuilds the COBOL baseline with GnuCOBOL from the unmodified source and re-runs parity on every push/PR.
