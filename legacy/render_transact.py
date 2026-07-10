#!/usr/bin/env python3
"""Render the fixed-length 350-byte CBACT04C TRANSACT output file as text.

CBACT04C writes record-sequential (unblocked, fixed 350-byte) transaction
records. The two DB2 timestamp fields (TRAN-ORIG-TS at bytes 278..304 and
TRAN-PROC-TS at 304..330) are derived from FUNCTION CURRENT-DATE; their
sub-second component is non-deterministic, so we normalise both to a fixed
value. Every other byte (including the zoned-decimal TRAN-AMT interest
amount, which keeps its trailing overpunch sign) is emitted verbatim, one
record per line, so the modern port can be compared byte-for-byte.
"""
import sys

RECLN = 350
TS = b"2022-07-18-00.00.00.000000"  # normalised 26-byte DB2 timestamp
ORIG_TS = (278, 304)
PROC_TS = (304, 330)


def main() -> None:
    src, dst = sys.argv[1], sys.argv[2]
    with open(src, "rb") as f:
        data = f.read()
    assert len(data) % RECLN == 0, f"TRANSACT length {len(data)} not a multiple of {RECLN}"
    out = []
    for i in range(0, len(data), RECLN):
        rec = bytearray(data[i:i + RECLN])
        rec[ORIG_TS[0]:ORIG_TS[1]] = TS
        rec[PROC_TS[0]:PROC_TS[1]] = TS
        out.append(bytes(rec))
    with open(dst, "wb") as f:
        for rec in out:
            f.write(rec + b"\n")


if __name__ == "__main__":
    main()
