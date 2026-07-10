#!/usr/bin/env bash
# Build and run the unmodified CardDemo CBACT02C batch program under
# GnuCOBOL (no mainframe), producing the golden baseline output.
set -euo pipefail
cd "$(dirname "$0")"

OUT=out
mkdir -p "$OUT"
rm -f "$OUT"/cbact02c* CARDFILE

echo "== compiling loader + stub + CBACT02C =="
cobc -x -std=mf -I cpy CARDLOAD.cob -o "$OUT/cardload"
cobc -m -std=mf -I cpy CEE3ABD.cob  -o "$OUT/CEE3ABD.so"
cobc -x -std=mf -I cpy CBACT02C.cbl -o "$OUT/cbact02c"

# Map the mainframe DD names to local files.
export DD_CARDFILE="$PWD/CARDFILE"
export CARDFILE="$PWD/CARDFILE"
export COB_LIBRARY_PATH="$PWD/$OUT"

echo "== loading card data into indexed CARDFILE =="
"$OUT/cardload"

echo "== running CBACT02C (unmodified) =="
"$OUT/cbact02c" | tee "$OUT/cbact02c.golden.txt"

echo "== golden baseline written to $OUT/cbact02c.golden.txt =="
