# CBSTM03A — Print Account Statements (with CBSTM03B I/O subprogram)

Business-logic spec for the CardDemo batch unit modernized in this PR. This
unit is **two tightly-coupled programs**:

- **CBSTM03A.CBL** — the driver. For every card, builds an account statement
  in two formats: plain text and HTML.
- **CBSTM03B.CBL** — the file-I/O subroutine the driver `CALL`s to open, read
  (sequential and keyed), and close the four input files.

Upstream source: `aws-samples/aws-mainframe-modernization-carddemo`
(`app/cbl/CBSTM03A.CBL`, `app/cbl/CBSTM03B.CBL`), Apache-2.0. Both COBOL
sources are vendored here **unmodified**.

## Purpose

Produce, per credit card in the cross-reference file, a printed account
statement listing the customer/account header, every transaction on that
card, and the total spend — emitted as an 80-column text report (`STMTFILE`)
and a 100-column HTML report (`HTMLFILE`).

## Inputs (DD names, record layouts, key fields)

CBSTM03B owns the `SELECT`s; all four are VSAM/KSDS indexed on the mainframe.

| DD name    | Copybook / layout          | RECLN | Key                                  | Access     |
|------------|----------------------------|-------|--------------------------------------|------------|
| `TRNXFILE` | `COSTM01` (`TRNX-RECORD`)  | 350   | `FD-TRNXS-ID` = card `X(16)` + tran `X(16)` (32) | Sequential |
| `XREFFILE` | `CVACT03Y` (`CARD-XREF-RECORD`) | 50 | `XREF-CARD-NUM` `X(16)`             | Sequential |
| `CUSTFILE` | `CUSTREC` (`CUSTOMER-RECORD`)   | 500 | `CUST-ID` `9(09)`                   | Random (keyed) |
| `ACCTFILE` | `CVACT01Y` (`ACCOUNT-RECORD`)   | 300 | `ACCT-ID` `9(11)`                   | Random (keyed) |

Key fields used to render the statement:

- `TRNX-RECORD`: `TRNX-CARD-NUM X(16)`, `TRNX-ID X(16)`, `TRNX-DESC X(100)`,
  `TRNX-AMT S9(9)V99`.
- `CARD-XREF-RECORD`: `XREF-CARD-NUM X(16)`, `XREF-CUST-ID 9(09)`,
  `XREF-ACCT-ID 9(11)`.
- `CUSTOMER-RECORD`: names `X(25)` each, `CUST-ADDR-LINE-1..3 X(50)`,
  `CUST-ADDR-STATE-CD X(02)`, `CUST-ADDR-COUNTRY-CD X(03)`,
  `CUST-ADDR-ZIP X(10)`, `CUST-FICO-CREDIT-SCORE 9(03)`.
- `ACCOUNT-RECORD`: `ACCT-ID 9(11)`, `ACCT-CURR-BAL S9(10)V99`.

## Outputs

- `STMTFILE` — `FD-STMTFILE-REC PIC X(80)`, record-sequential (fixed 80-byte
  records, no delimiter).
- `HTMLFILE` — `FD-HTMLFILE-REC PIC X(100)`, record-sequential (fixed 100).

The **golden baseline** (`legacy/out/cbstm03a.golden.txt`) is the raw
`STMTFILE` bytes immediately followed by the raw `HTMLFILE` bytes.

## Control flow

CBSTM03A is deliberately written to exercise legacy constructs (see its
header): `ALTER`/`GO TO`, a `POINTER`-based control-block walk, `COMP`/`COMP-3`
fields, and a 2-D table. The driver uses an `ALTER … GO TO 8100-FILE-OPEN`
dispatcher (`WS-FL-DD`) to sequence four phases:

1. **Load transactions into memory.** Open `TRNXFILE`, read it sequentially,
   and bucket rows into a 2-D table `WS-TRNX-TABLE` (`OCCURS 51` cards ×
   `OCCURS 10` transactions), counting transactions per card in
   `WS-TRN-TBL-CNTR`. Grouping relies on `TRNXFILE` being sorted by
   card + tran-id (the mainframe JCL `SORT` guarantees this).
2. **Open** `XREFFILE`, `CUSTFILE`, `ACCTFILE`.
3. **Main loop** (`1000-MAINLINE`): read each `XREFFILE` record; key-read the
   customer (`XREF-CUST-ID`) and account (`XREF-ACCT-ID`); `5000-CREATE-
   STATEMENT` writes the header (text + HTML); `4000-TRNXFILE-GET` walks the
   in-memory table for the matching card, writing one line per transaction
   (`6000-WRITE-TRANS`) and accumulating `WS-TOTAL-AMT`, then writes the
   total and end-of-statement trailer.
4. **Close** all files.

## Statement layout (text)

Per account: `START OF STATEMENT` banner; name; address lines 1–3; a
`Basic Details` block (`Account ID`, `Current Balance`, `FICO Score`); a
`TRANSACTION SUMMARY` block with a `Tran ID / Tran Details / Tran Amount`
header; one line per transaction; a `Total EXP:` line; `END OF STATEMENT`
banner. The HTML report renders the same data as a styled `<table>`.

## Non-obvious semantics

- **Name / address assembly (`STRING … DELIMITED BY ' '`).** `ST-NAME` and
  `ST-ADD3` are built by concatenating each subfield up to its first blank,
  separated by single spaces — e.g. `"JOHN" + " " + "Q" + " " + "PUBLIC" + " "`.
- **HTML `DELIMITED BY '  '` (two spaces).** The HTML name/address `<p>` lines
  copy the text only up to the first *double* space, then append two spaces —
  e.g. `<p>123 MAIN ST  </p>`. An empty field yields `<p>  </p>`.
- **Numeric editing.**
  - `Current Balance` uses `PIC 9(9).99-`: nine **zero-filled** integer
    digits, `.`, two decimals, then a trailing sign position (`-` if negative,
    blank if positive). The source is `S9(10)V99`, so the highest-order
    integer digit is truncated.
  - `Tran Amount` and `Total EXP` use `PIC Z(9).99-`: leading zeros are
    **blank-suppressed**, with the same trailing-sign convention. Each is
    preceded by a literal `$`.
- **Zoned-decimal sign (off-platform).** In flat ASCII input, a signed
  `DISPLAY` field carries its sign in the trailing byte using GnuCOBOL's
  default ASCII convention: positive → plain digit `'0'`–`'9'`; negative →
  `0x70+digit` (`'p'`–`'y'`). The modern port and the fixture generator both
  follow this exactly (see `decodeZoned`). *(Note: this differs from EBCDIC
  overpunch `{`/`A`–`I`/`}`/`J`–`R`, which GnuCOBOL 3.1 does not decode as
  signed digits in this mode.)*
- **Fixed records, no delimiters.** `WRITE … FROM` moves a group shorter than
  the FD record into the record area, space-padded to 80/100. Records are
  written back-to-back with no newline.

## External CALLs / dependencies

- `CALL 'CBSTM03B' USING WS-M03B-AREA` — all file I/O (open/read/keyed-read/
  close) is delegated to the subprogram via a shared command area
  (`WS-M03B-DD`, `WS-M03B-OPER`, `WS-M03B-RC`, `WS-M03B-KEY`,
  `WS-M03B-KEY-LN`, `WS-M03B-FLDT`).
- `CALL 'CEE3ABD'` — z/OS Language Environment abend service (error path
  only); reuses the shared off-platform stub `legacy/CEE3ABD.cob`.
- **Mainframe-only prolog (not business logic).** CBSTM03A opens by walking
  the z/OS control blocks PSA → TCB → TIOT to `DISPLAY` the running JCL
  job/step and the DD names. This storage is supplied by the OS on a
  mainframe and is unallocated off-platform, so the walk cannot run under
  GnuCOBOL; it has **no effect** on the generated statements. `run_cbstm03a.sh`
  therefore neutralizes only this prolog at build time (a local shim) and
  leaves the business logic untouched — see that script's header comment.

## Off-platform harness (this repo)

- `legacy/CBSTM03LOAD.cob` stages the small ASCII fixtures into the four
  indexed files (replacing the mainframe IDCAMS/SORT steps).
- `legacy/make_cbstm03a_fixture.py` generates the deterministic fixtures
  (`cbstm03a_{acct,cust,xref,trnx}.txt`): two cards/customers/accounts and
  three transactions.
- `legacy/run_cbstm03a.sh` compiles everything under GnuCOBOL
  (`-std=mf -ftab-width=1`; `-ftab-width=1` lets the tab-indented upstream
  `CUSTREC.cpy` parse without editing it), stages the fixtures, runs the
  program, and emits the golden baseline.
- `modern/src/cbstm03a.ts` reimplements the driver + subprogram logic in
  TypeScript; `modern/test/cbstm03a.parity.test.ts` asserts byte-for-byte
  parity plus focused unit tests for the numeric encodings.
