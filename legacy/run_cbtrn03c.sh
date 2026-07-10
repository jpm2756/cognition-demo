#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

OUT=out
mkdir -p "$OUT"
cleanup() {
  rm -f \
    CBTRN03_TRANFILE CBTRN03_CARDXREF CBTRN03_TRANTYPE CBTRN03_TRANCATG \
    CBTRN03_TRANREPT
}
trap cleanup EXIT
rm -f \
  "$OUT/cbtrn03c" \
  "$OUT/cbtrn03load" \
  "$OUT/cbtrn03c.golden.txt" \
  "$OUT/cbtrn03c.execution.txt" \
  "$OUT/cbtrn03c_transactions.txt" \
  "$OUT/cbtrn03c_transactions.sorted.txt" \
  "$OUT/CEE3ABD.so" \
  CBTRN03_TRANFILE CBTRN03_CARDXREF CBTRN03_TRANTYPE CBTRN03_TRANCATG \
  CBTRN03_TRANREPT

awk '{
  print substr($0, 1, 304) substr($0, 279, 26) substr($0, 331)
}' cbtrn03c_dailytran.txt \
  | LC_ALL=C sort -k1.263,1.278 > "$OUT/cbtrn03c_transactions.sorted.txt"
head -n 18 "$OUT/cbtrn03c_transactions.sorted.txt" \
  > "$OUT/cbtrn03c_transactions.txt"
printf '%-80s' '2022-01-01 2022-07-06' > "$OUT/cbtrn03c_dateparm.txt"

echo "== compiling loader + stub + CBTRN03C =="
cobc -x -std=mf CBTRN03LOAD.cob -o "$OUT/cbtrn03load"
cobc -m -std=mf -I cpy CEE3ABD.cob -o "$OUT/CEE3ABD.so"
cobc -x -std=mf -I cpy CBTRN03C.cbl -o "$OUT/cbtrn03c"

export CBTRN03IN="$PWD/$OUT/cbtrn03c_transactions.txt"
export CBTRN03XREFIN="$PWD/cbtrn03c_cardxref.txt"
export CBTRN03TYPEIN="$PWD/cbtrn03c_trantype.txt"
export CBTRN03CATGIN="$PWD/cbtrn03c_trancatg.txt"
export TRANFILE="$PWD/CBTRN03_TRANFILE"
export CARDXREF="$PWD/CBTRN03_CARDXREF"
export TRANTYPE="$PWD/CBTRN03_TRANTYPE"
export TRANCATG="$PWD/CBTRN03_TRANCATG"
export TRANREPT="$PWD/CBTRN03_TRANREPT"
export DATEPARM="$PWD/$OUT/cbtrn03c_dateparm.txt"
export DD_TRANFILE="$TRANFILE"
export DD_CARDXREF="$CARDXREF"
export DD_TRANTYPE="$TRANTYPE"
export DD_TRANCATG="$TRANCATG"
export DD_TRANREPT="$TRANREPT"
export DD_DATEPARM="$DATEPARM"
export COB_LIBRARY_PATH="$PWD/$OUT"

echo "== staging transaction and lookup files =="
"$OUT/cbtrn03load"

echo "== running CBTRN03C (unmodified) =="
"$OUT/cbtrn03c" | tee "$OUT/cbtrn03c.execution.txt"
cp "$TRANREPT" "$OUT/cbtrn03c.golden.txt"

echo "== golden baseline written to $OUT/cbtrn03c.golden.txt =="
