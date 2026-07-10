#!/usr/bin/env bash
# Build and run the unmodified CardDemo CBCUS01C batch program under
# GnuCOBOL (no mainframe), producing the golden baseline output.
set -euo pipefail
cd "$(dirname "$0")"

OUT=out
mkdir -p "$OUT"
rm -f "$OUT"/cbcus01c* CUSTFILE

echo "== compiling loader + stubs + CBCUS01C =="
cobc -x -std=mf -I cpy CUSTLOAD.cob -o "$OUT/custload"
cobc -m -std=mf -I cpy CEE3ABD.cob  -o "$OUT/CEE3ABD.so"
cobc -x -std=mf -I cpy CBCUS01C.cbl -o "$OUT/cbcus01c"

# Map the mainframe DD names to local files.
export DD_CUSTFILE="$PWD/CUSTFILE"
export CUSTFILE="$PWD/CUSTFILE"
export COB_LIBRARY_PATH="$PWD/$OUT"

echo "== loading customer data into indexed CUSTFILE =="
"$OUT/custload"

echo "== running CBCUS01C (unmodified) =="
"$OUT/cbcus01c" | tee "$OUT/cbcus01c.golden.txt"

echo "== golden baseline written to $OUT/cbcus01c.golden.txt =="
