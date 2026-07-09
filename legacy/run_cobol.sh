#!/usr/bin/env bash
# Build and run the unmodified CardDemo CBACT01C batch program under
# GnuCOBOL (no mainframe), producing the golden baseline output.
set -euo pipefail
cd "$(dirname "$0")"

OUT=out
mkdir -p "$OUT"
rm -f "$OUT"/* ACCTFILE

echo "== compiling loader + stubs + CBACT01C =="
cobc -x -std=mf -I cpy ACCTLOAD.cob -o "$OUT/acctload"
cobc -m -std=mf -I cpy COBDATFT.cob -o "$OUT/COBDATFT.so"
cobc -m -std=mf -I cpy CEE3ABD.cob  -o "$OUT/CEE3ABD.so"
cobc -x -std=mf -I cpy CBACT01C.cbl -o "$OUT/cbact01c"

# Map the mainframe DD names to local files.
export DD_ACCTFILE="$PWD/ACCTFILE"
export DD_OUTFILE="$PWD/$OUT/OUTFILE.dat"
export DD_ARRYFILE="$PWD/$OUT/ARRYFILE.dat"
export DD_VBRCFILE="$PWD/$OUT/VBRCFILE.dat"
export ACCTFILE="$PWD/ACCTFILE"
export OUTFILE="$PWD/$OUT/OUTFILE.dat"
export ARRYFILE="$PWD/$OUT/ARRYFILE.dat"
export VBRCFILE="$PWD/$OUT/VBRCFILE.dat"
export COB_LIBRARY_PATH="$PWD/$OUT"

echo "== loading account data into indexed ACCTFILE =="
"$OUT/acctload"

echo "== running CBACT01C (unmodified) =="
"$OUT/cbact01c" | tee "$OUT/cbact01c.golden.txt"

echo "== golden baseline written to $OUT/cbact01c.golden.txt =="
