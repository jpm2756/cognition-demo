#!/usr/bin/env bash
# Build and run the (essentially unmodified) CardDemo CBIMPORT batch
# program under GnuCOBOL (no mainframe), producing the golden baseline.
#
# CBIMPORT reads a multi-record branch-migration export file and splits
# it into normalized target files (CUSTOMER / ACCOUNT / CARD-XREF /
# TRANSACTION / CARD) plus an error report. The deterministic export
# fixture is rebuilt from source by EXPTGEN (so nothing is trusted from a
# checked-in binary), then CBIMPORT is run and its OUTPUT FILES are
# assembled into out/cbimport.golden.txt -- the source of truth.
set -euo pipefail
cd "$(dirname "$0")"

OUT=out
mkdir -p "$OUT"
rm -f "$OUT"/*.dat "$OUT"/cbimport "$OUT"/exptgen "$OUT"/*.so expdata.dat

# -fassign-clause=external: resolve every "ASSIGN TO <name>" from the
# environment variable of that name (mainframe DD -> local file), instead
# of GnuCOBOL's -std=mf default "dynamic" assignment. Under "dynamic" the
# assign name aliases a shared scratch field that intrinsic MOVEs (the
# CURRENT-DATE calls in 1000-INITIALIZE) clobber before the files are
# OPENed, yielding a bogus filename and OPEN status 35. This is purely a
# file-mapping shim; PROCEDURE DIVISION / business logic is untouched.
echo "== compiling fixture generator + abend stub + CBIMPORT =="
cobc -x -std=mf -fassign-clause=external -I cpy EXPTGEN.cob  -o "$OUT/exptgen"
cobc -m -std=mf -fassign-clause=external -I cpy CEE3ABD.cob  -o "$OUT/CEE3ABD.so"
cobc -x -std=mf -fassign-clause=external -I cpy CBIMPORT.cbl -o "$OUT/cbimport"

echo "== generating deterministic export fixture (expdata.dat) =="
"$OUT/exptgen"

# Map the mainframe DD names to local files.
export EXPFILE="$PWD/expdata.dat"
export CUSTOUT="$PWD/$OUT/CUSTOUT.dat"
export ACCTOUT="$PWD/$OUT/ACCTOUT.dat"
export XREFOUT="$PWD/$OUT/XREFOUT.dat"
export TRNXOUT="$PWD/$OUT/TRNXOUT.dat"
export CARDOUT="$PWD/$OUT/CARDOUT.dat"
export ERROUT="$PWD/$OUT/ERROUT.dat"
export COB_LIBRARY_PATH="$PWD/$OUT"

echo "== running CBIMPORT (unmodified business logic) =="
"$OUT/cbimport"

echo "== assembling golden baseline from CBIMPORT output files =="
python3 - "$OUT" > "$OUT/cbimport.golden.txt" <<'PY'
import sys, os
out = sys.argv[1]
# (label, filename, record length) in the fixed order the golden lists them
sections = [
    ("CUSTOMER",    "CUSTOUT.dat", 500),
    ("ACCOUNT",     "ACCTOUT.dat", 300),
    ("CARD-XREF",   "XREFOUT.dat", 50),
    ("TRANSACTION", "TRNXOUT.dat", 350),
    ("CARD",        "CARDOUT.dat", 150),
    ("ERROR",       "ERROUT.dat",  132),
]
lines = []
for label, fname, reclen in sections:
    path = os.path.join(out, fname)
    data = b""
    if os.path.exists(path):
        with open(path, "rb") as f:
            data = f.read()
    # CBIMPORT writes ORGANIZATION SEQUENTIAL fixed-length records with no
    # delimiters; split back into reclen-byte records for a readable,
    # byte-comparable baseline.
    count = len(data) // reclen if reclen else 0
    lines.append("===== %s (reclen=%d, records=%d) =====" % (label, reclen, count))
    for i in range(count):
        rec = data[i*reclen:(i+1)*reclen]
        lines.append(rec.decode("latin1"))
sys.stdout.write("\n".join(lines) + "\n")
PY

echo "== golden baseline written to $OUT/cbimport.golden.txt =="
wc -l "$OUT/cbimport.golden.txt"
