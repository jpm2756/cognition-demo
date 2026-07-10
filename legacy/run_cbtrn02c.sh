#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

OUT=out
WORK="$OUT/cbtrn02c"
mkdir -p "$WORK"
rm -f "$OUT/cbtrn02c.golden.txt" \
      "$WORK"/ACCTFILE* "$WORK"/XREFFILE* "$WORK"/TCATBALF* \
      "$WORK"/TRANFILE* "$WORK"/DALYREJS*

echo "== compiling CBTRN02C loader + stub + legacy program =="
cobc -x -std=mf -I cpy CBTRN02CLOAD.cob -o "$WORK/cbtrn02cload"
cobc -m -std=mf -I cpy CEE3ABD.cob -o "$WORK/CEE3ABD.so"
cobc -x -std=mf -I cpy CBTRN02C.cbl -o "$WORK/cbtrn02c"

export DD_ACCTFILE="$PWD/$WORK/ACCTFILE"
export DD_XREFFILE="$PWD/$WORK/XREFFILE"
export DD_TCATBALF="$PWD/$WORK/TCATBALF"
tr -d '\r\n' < cbtrn02c_dailytran.txt > "$WORK/DALYTRAN"
export DD_DALYTRAN="$PWD/$WORK/DALYTRAN"
export DD_TRANFILE="$PWD/$WORK/TRANFILE"
export DD_DALYREJS="$PWD/$WORK/DALYREJS"
export ACCTFILE="$DD_ACCTFILE"
export XREFFILE="$DD_XREFFILE"
export TCATBALF="$DD_TCATBALF"
export DALYTRAN="$DD_DALYTRAN"
export TRANFILE="$DD_TRANFILE"
export DALYREJS="$DD_DALYREJS"
export COB_LIBRARY_PATH="$PWD/$WORK"

echo "== staging indexed CBTRN02C fixture data =="
"$WORK/cbtrn02cload"

echo "== running CBTRN02C (unmodified) =="
"$WORK/cbtrn02c" | tee "$OUT/cbtrn02c.golden.txt"

echo "== golden baseline written to $OUT/cbtrn02c.golden.txt =="
