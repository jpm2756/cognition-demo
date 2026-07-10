#!/usr/bin/env bash
# Build and run the unmodified CardDemo CBACT03C batch program under
# GnuCOBOL (no mainframe), producing the golden baseline output.
set -euo pipefail
cd "$(dirname "$0")"

OUT=out
mkdir -p "$OUT"
rm -f "$OUT"/cbact03c* "$OUT"/XREFFILE*

echo "== compiling loader + stubs + CBACT03C =="
cobc -x -std=mf -I cpy XREFLOAD.cob -o "$OUT/xrefload"
cobc -m -std=mf -I cpy CEE3ABD.cob  -o "$OUT/CEE3ABD.so"
cobc -x -std=mf -I cpy CBACT03C.cbl -o "$OUT/cbact03c"

# Map the mainframe DD names to local files (kept under out/, git-ignored).
export DD_XREFFILE="$PWD/$OUT/XREFFILE"
export XREFFILE="$PWD/$OUT/XREFFILE"
export COB_LIBRARY_PATH="$PWD/$OUT"

echo "== loading card xref data into indexed XREFFILE =="
"$OUT/xrefload"

echo "== running CBACT03C (unmodified) =="
"$OUT/cbact03c" | tee "$OUT/cbact03c.golden.txt"

echo "== golden baseline written to $OUT/cbact03c.golden.txt =="
