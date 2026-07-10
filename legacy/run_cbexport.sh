#!/usr/bin/env bash
# Build and run the unmodified* CardDemo CBEXPORT batch program under
# GnuCOBOL (no mainframe). CBEXPORT reads five INDEXED (KSDS) files
# (customers, accounts, xrefs, transactions, cards) and writes a 500-byte
# export/extract file for branch migration. That export file is the golden
# baseline the parity test compares against byte-for-byte.
#
# *The only change to the program is an off-platform I/O shim: the export
# file is written record-sequential instead of KSDS (identical record
# bytes). See legacy/CBEXPORT.cbl and docs/CBEXPORT.md.
#
# The export records embed a timestamp taken from ACCEPT ... FROM DATE /
# TIME. To keep the baseline deterministic we pin the clock with
# GnuCOBOL's COB_CURRENT_DATE (no change to the program's logic).
set -euo pipefail
cd "$(dirname "$0")"

OUT=out
DATA=cbexport_data
mkdir -p "$OUT"
rm -f "$OUT"/CUSTFILE* "$OUT"/ACCTIDX* "$OUT"/XREFFILE* \
      "$OUT"/TRANSACT* "$OUT"/CARDFILE* \
      "$OUT"/cbexport.golden.txt "$OUT"/cbexport "$OUT"/cbexpload \
      "$OUT"/CEE3ABD.so 2>/dev/null || true

echo "== compiling stub + loader + CBEXPORT =="
cobc -m -std=mf -I cpy CEE3ABD.cob    -o "$OUT/CEE3ABD.so"
cobc -x -std=mf -I cpy CBEXPLOAD.cob  -o "$OUT/cbexpload"
cobc -x -std=mf -I cpy CBEXPORT.cbl   -o "$OUT/cbexport"

# Deterministic clock: 2025-01-15 10:30:45 (YYYYMMDDHHMMSS).
export COB_CURRENT_DATE="20250115103045"

# Map mainframe DD names to local (BDB indexed input / flat output) files.
export CUSTFILE="$PWD/$OUT/CUSTFILE"
export ACCTFILE="$PWD/$OUT/ACCTIDX"
export XREFFILE="$PWD/$OUT/XREFFILE"
export TRANSACT="$PWD/$OUT/TRANSACT"
export CARDFILE="$PWD/$OUT/CARDFILE"
export EXPFILE="$PWD/$OUT/cbexport.golden.txt"
export COB_LIBRARY_PATH="$PWD/$OUT"

echo "== staging fixtures into indexed input files =="
( cd "$DATA" && "$PWD/../$OUT/cbexpload" )

echo "== running CBEXPORT (unmodified business logic) =="
"$OUT/cbexport"

echo "== golden baseline written to $OUT/cbexport.golden.txt =="
ls -l "$OUT/cbexport.golden.txt"
