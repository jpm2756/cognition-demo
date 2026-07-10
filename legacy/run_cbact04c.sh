#!/usr/bin/env bash
# Build and run the UNMODIFIED CardDemo CBACT04C interest-calculator batch
# program under GnuCOBOL (no mainframe), producing the golden baseline.
#
# CBACT04C reads four indexed inputs (TCATBALF, XREFFILE, ACCTFILE, DISCGRP),
# computes monthly interest per transaction-category balance, writes an
# interest TRANSACT record for every non-zero disclosure rate, and rewrites
# the account balances. The golden baseline is the program's stdout followed
# by the rendered TRANSACT output file (the posted interest transactions).
#
# The two DB2 timestamp fields (TRAN-ORIG-TS / TRAN-PROC-TS) come from
# FUNCTION CURRENT-DATE and are inherently non-deterministic; we pin the
# clock with COB_CURRENT_DATE and normalise the sub-second digits to a
# fixed value so the baseline is reproducible. The modern port emits the
# identical normalised timestamp.
set -euo pipefail
cd "$(dirname "$0")"

OUT=out
mkdir -p "$OUT"
rm -f "$OUT"/* ACCTFILE.dat TCATBALF.dat DISCGRP.dat XREFFILE.dat \
      ACCTFILE.dat.* XREFFILE.dat.* 2>/dev/null || true

echo "== compiling loader + stub + CBACT04C + driver =="
cobc -x -std=mf -I cpy CB4LOAD.cob  -o "$OUT/cb4load"
cobc -m -std=mf -I cpy CEE3ABD.cob  -o "$OUT/CEE3ABD.so"
cobc -m -std=mf -I cpy CBACT04C.cbl -o "$OUT/CBACT04C.so"
cobc -x -std=mf -I cpy CB4RUN.cob   -o "$OUT/cb4run"

# Map the mainframe DD names to local files.
export ACCTFILE="$PWD/$OUT/ACCTFILE.dat"
export TCATBALF="$PWD/$OUT/TCATBALF.dat"
export DISCGRP="$PWD/$OUT/DISCGRP.dat"
export XREFFILE="$PWD/$OUT/XREFFILE.dat"
export TRANSACT="$PWD/$OUT/TRANSACT.dat"
export DD_ACCTFILE="$ACCTFILE" DD_TCATBALF="$TCATBALF" \
       DD_DISCGRP="$DISCGRP" DD_XREFFILE="$XREFFILE" DD_TRANSACT="$TRANSACT"
export COB_LIBRARY_PATH="$PWD/$OUT"
# Pin the clock so CURRENT-DATE-derived timestamps are reproducible.
export COB_CURRENT_DATE="20220718000000"

echo "== loading indexed fixtures =="
"$OUT/cb4load"

echo "== running CBACT04C (unmodified) via CB4RUN driver =="
"$OUT/cb4run" > "$OUT/cbact04c.stdout.txt"

echo "== rendering TRANSACT file (timestamps normalised) =="
python3 render_transact.py "$TRANSACT" "$OUT/cbact04c.transact.txt"

cat "$OUT/cbact04c.stdout.txt" "$OUT/cbact04c.transact.txt" \
    > "$OUT/cbact04c.golden.txt"

echo "== golden baseline written to $OUT/cbact04c.golden.txt =="
