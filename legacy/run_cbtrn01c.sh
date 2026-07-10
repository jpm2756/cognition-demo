#!/usr/bin/env bash
# Build and run the unmodified CardDemo CBTRN01C batch program under
# GnuCOBOL (no mainframe), producing the golden baseline output.
#
# CBTRN01C reads a daily transaction file (DALYTRAN, plain sequential),
# validates each transaction's card against the card cross-reference
# (XREFFILE) and account master (ACCTFILE), and also opens the customer,
# card and transaction files. The indexed (KSDS) files are staged from
# small ASCII fixtures by CBTR1LOAD (mirrors the mainframe IDCAMS REPRO).
set -euo pipefail
cd "$(dirname "$0")"

OUT=out
mkdir -p "$OUT"
rm -f "$OUT"/cbtrn01c* "$OUT"/CEE3ABD.so "$OUT"/CBTRN01C-*FILE

echo "== compiling loader + stub + CBTRN01C =="
cobc -x -std=mf -I cpy CBTR1LOAD.cob -o "$OUT/cbtr1load"
cobc -m -std=mf -I cpy CEE3ABD.cob   -o "$OUT/CEE3ABD.so"
cobc -x -std=mf -I cpy CBTRN01C.cbl  -o "$OUT/cbtrn01c"

# Map the mainframe DD names to local files. The indexed files use a
# program-unique prefix so this run never collides with sibling units.
export DALYTRAN="$PWD/cbtrn01c_dalytran.txt"
export XREFFILE="$PWD/$OUT/CBTRN01C-XREFFILE"
export ACCTFILE="$PWD/$OUT/CBTRN01C-ACCTFILE"
export CARDFILE="$PWD/$OUT/CBTRN01C-CARDFILE"
export CUSTFILE="$PWD/$OUT/CBTRN01C-CUSTFILE"
export TRANFILE="$PWD/$OUT/CBTRN01C-TRANFILE"
export COB_LIBRARY_PATH="$PWD/$OUT"
# Read DALYTRAN as fixed-length record-sequential (no newline delimiters).
export COB_FILE_FORMAT=mf

echo "== staging fixtures into indexed files =="
"$OUT/cbtr1load"

echo "== running CBTRN01C (unmodified) =="
"$OUT/cbtrn01c" | tee "$OUT/cbtrn01c.golden.txt"

echo "== golden baseline written to $OUT/cbtrn01c.golden.txt =="
