#!/usr/bin/env python3
"""Generate the small deterministic CBSTM03A fixture flat files.

Emits fixed-width ASCII extracts (one record per line) matching the CardDemo
copybook layouts, which legacy/CBSTM03LOAD.cob then stages into the indexed
(KSDS) files CBSTM03A/CBSTM03B read. Kept tiny and deterministic so the
golden baseline and CI stay fast and repeatable.
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def X(s, n):
    s = "" if s is None else str(s)
    assert len(s) <= n, f"{s!r} longer than {n}"
    return s.ljust(n)


def N(v, n):
    return str(int(v)).rjust(n, "0")


def zoned(value_cents, digits):
    """S9(d-2)V99 zoned decimal, GnuCOBOL ASCII trailing-sign convention.

    Positive values keep a plain trailing digit ('0'-'9'). Negative values
    encode the trailing digit as 0x70+digit ('p'-'y'), which is exactly how
    GnuCOBOL's default ASCII runtime stores/reads a trailing SIGN on a
    DISPLAY (zoned) numeric field.
    """
    neg = value_cents < 0
    body = str(abs(value_cents)).rjust(digits, "0")
    assert len(body) == digits, f"{value_cents} overflows {digits} digits"
    if not neg:
        return body
    head, last = body[:-1], body[-1]
    return head + chr(0x70 + int(last))


def acct_rec(acct_id, active, bal, credit, cash, open_d, exp_d, reissue_d,
             cyc_credit, cyc_debit, zip_, group):
    r = (N(acct_id, 11) + X(active, 1)
         + zoned(bal, 12) + zoned(credit, 12) + zoned(cash, 12)
         + X(open_d, 10) + X(exp_d, 10) + X(reissue_d, 10)
         + zoned(cyc_credit, 12) + zoned(cyc_debit, 12)
         + X(zip_, 10) + X(group, 10) + X("", 178))
    assert len(r) == 300, len(r)
    return r


def cust_rec(cust_id, first, middle, last, a1, a2, a3, state, country, zip_,
             ph1, ph2, ssn, govt, dob, eft, pri, fico):
    r = (N(cust_id, 9) + X(first, 25) + X(middle, 25) + X(last, 25)
         + X(a1, 50) + X(a2, 50) + X(a3, 50) + X(state, 2) + X(country, 3)
         + X(zip_, 10) + X(ph1, 15) + X(ph2, 15) + N(ssn, 9) + X(govt, 20)
         + X(dob, 10) + X(eft, 10) + X(pri, 1) + N(fico, 3) + X("", 168))
    assert len(r) == 500, len(r)
    return r


def xref_rec(card, cust_id, acct_id):
    r = X(card, 16) + N(cust_id, 9) + N(acct_id, 11) + X("", 14)
    assert len(r) == 50, len(r)
    return r


def trnx_rec(card, tid, type_cd, cat_cd, source, desc, amt_cents, merch_id,
             merch_name, merch_city, merch_zip, orig_ts, proc_ts):
    r = (X(card, 16) + X(tid, 16) + X(type_cd, 2) + N(cat_cd, 4)
         + X(source, 10) + X(desc, 100) + zoned(amt_cents, 11)
         + N(merch_id, 9) + X(merch_name, 50) + X(merch_city, 50)
         + X(merch_zip, 10) + X(orig_ts, 26) + X(proc_ts, 26) + X("", 20))
    assert len(r) == 350, len(r)
    return r


CARD_A = "4111111111111111"
CARD_B = "4222222222222222"

accts = [
    acct_rec(11, "Y", 19400, 500000, 100000, "2014-11-20", "2025-05-20",
             "2025-05-20", 0, 0, "62704", "GROUP00001"),
    acct_rec(22, "Y", -2550, 300000, 50000, "2016-03-15", "2026-03-15",
             "2026-03-15", 0, 0, "97201", "GROUP00002"),
]

custs = [
    cust_rec(1, "JOHN", "Q", "PUBLIC", "123 MAIN ST", "APT 4", "SPRINGFIELD",
             "IL", "USA", "62704", "555-100-2000", "", 123456789,
             "DL-IL-0001", "1980-01-15", "", "Y", 750),
    cust_rec(2, "JANE", "A", "DOE", "456 OAK AVE", "", "PORTLAND",
             "OR", "USA", "97201", "555-300-4000", "", 987654321,
             "DL-OR-0002", "1975-07-30", "", "Y", 680),
]

xrefs = [
    xref_rec(CARD_A, 1, 11),
    xref_rec(CARD_B, 2, 22),
]

trnxs = [
    trnx_rec(CARD_A, "0000000000000001", "01", 1, "POS", "GROCERY STORE",
             5000, 100001, "FRESH MART", "SPRINGFIELD", "62704",
             "2025-05-01-10.00.00.000000", "2025-05-01-10.00.05.000000"),
    trnx_rec(CARD_A, "0000000000000002", "01", 2, "ONLINE", "ELECTRONICS SHOP",
             12550, 100002, "TECH BYTES", "PORTLAND", "97201",
             "2025-05-03-14.30.00.000000", "2025-05-03-14.30.02.000000"),
    trnx_rec(CARD_B, "0000000000000003", "02", 3, "POS", "COFFEE SHOP",
             999, 100003, "BEAN THERE", "PORTLAND", "97201",
             "2025-05-04-08.15.00.000000", "2025-05-04-08.15.01.000000"),
]


def write(name, rows):
    path = os.path.join(HERE, name)
    with open(path, "w", newline="\n") as f:
        for r in rows:
            f.write(r + "\n")
    print(f"wrote {name}: {len(rows)} records")


if __name__ == "__main__":
    write("cbstm03a_acct.txt", accts)
    write("cbstm03a_cust.txt", custs)
    write("cbstm03a_xref.txt", xrefs)
    write("cbstm03a_trnx.txt", trnxs)
