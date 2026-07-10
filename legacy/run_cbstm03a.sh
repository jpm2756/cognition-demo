#!/usr/bin/env bash
# Build and run the unmodified CardDemo CBSTM03A statement-print program
# (driver CBSTM03A.CBL + file-processing subprogram CBSTM03B.CBL) under
# GnuCOBOL (no mainframe), producing the golden baseline output.
#
# CBSTM03A begins with a z/OS control-block walk (PSA -> TCB -> TIOT) that
# only DISPLAYs the running JCL job/step and DD names. That storage is
# supplied by the operating system on a mainframe and is unallocated
# off-platform, so the walk cannot run under GnuCOBOL. It has NO effect on
# the statements produced (the business output). We therefore compile a
# baseline variant that neutralizes ONLY that mainframe-only prolog (a local
# shim, per the modernization playbook) and leave the business logic
# untouched. The COBOL sources checked into legacy/ are byte-for-byte the
# unmodified upstream files; the shim is applied here at build time and the
# baseline is always rebuilt from those sources (never a checked-in copy).
set -euo pipefail
cd "$(dirname "$0")"

OUT=out
mkdir -p "$OUT"
rm -f "$OUT"/TRNXFILE* "$OUT"/XREFFILE* "$OUT"/CUSTFILE* "$OUT"/ACCTFILE* \
      "$OUT"/STMTFILE.dat "$OUT"/HTMLFILE.dat "$OUT"/cbstm03a.golden.txt \
      "$OUT"/CBSTM03A.runtime.cbl "$OUT"/cbstm03a "$OUT"/*.so 2>/dev/null || true

# --- shim: drop ONLY the mainframe PSA/TCB/TIOT introspection prolog ---
# Delete the contiguous block from 'SET ADDRESS OF PSA-BLOCK' up to (but not
# including) 'OPEN OUTPUT STMT-FILE HTML-FILE'. Anchored on stable source
# text, not line numbers, so it survives incidental reformatting.
awk '
  /SET ADDRESS OF PSA-BLOCK/ {skip=1}
  /OPEN OUTPUT STMT-FILE HTML-FILE/ {skip=0}
  skip==0 {print}
' CBSTM03A.CBL > "$OUT/CBSTM03A.runtime.cbl"

echo "== compiling loader + subprogram + stubs + CBSTM03A =="
# tab-width=1 lets the tab-indented upstream copybook CUSTREC.cpy parse in
# fixed format without touching the copybook bytes.
COBFLAGS="-std=mf -ftab-width=1 -I cpy"
cobc -x $COBFLAGS CBSTM03LOAD.cob      -o "$OUT/cbstm03load"
cobc -m $COBFLAGS CBSTM03B.CBL         -o "$OUT/CBSTM03B.so"
cobc -m $COBFLAGS CEE3ABD.cob          -o "$OUT/CEE3ABD.so"
cobc -x $COBFLAGS "$OUT/CBSTM03A.runtime.cbl" -o "$OUT/cbstm03a"

# Map the mainframe DD names to local files.
export TRNXFILE="$PWD/$OUT/TRNXFILE"
export XREFFILE="$PWD/$OUT/XREFFILE"
export CUSTFILE="$PWD/$OUT/CUSTFILE"
export ACCTFILE="$PWD/$OUT/ACCTFILE"
export STMTFILE="$PWD/$OUT/STMTFILE.dat"
export HTMLFILE="$PWD/$OUT/HTMLFILE.dat"
export COB_LIBRARY_PATH="$PWD/$OUT"
export COB_FILE_FORMAT=mf

echo "== staging fixture extracts into indexed files =="
"$OUT/cbstm03load"

echo "== running CBSTM03A (unmodified business logic) =="
"$OUT/cbstm03a"

# The observable output is the printed statement (STMTFILE, fixed PIC X(80)
# records) immediately followed by the HTML rendering (HTMLFILE, fixed
# PIC X(100) records). GnuCOBOL writes record-sequential files as fixed
# records with no delimiters, so the golden baseline is simply the raw bytes
# of STMTFILE.dat concatenated with the raw bytes of HTMLFILE.dat.
cat "$OUT/STMTFILE.dat" "$OUT/HTMLFILE.dat" > "$OUT/cbstm03a.golden.txt"

echo "== golden baseline written to $OUT/cbstm03a.golden.txt =="
wc -c "$OUT/cbstm03a.golden.txt"
