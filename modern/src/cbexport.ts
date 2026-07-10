/**
 * Cloud-native reimplementation of CardDemo batch program CBEXPORT.
 *
 * Legacy behavior (app/cbl/CBEXPORT.cbl): read five CardDemo master files
 * (customers, accounts, card cross-references, transactions and cards) and
 * write a single 500-byte multi-record export/extract file for branch
 * migration. Each source record becomes one export record tagged with a
 * record-type byte (C/A/X/T/D), a shared timestamp, an ascending sequence
 * number, and a fixed branch id / region code, followed by a per-type data
 * area laid out by copybook CVEXPORT (a mix of DISPLAY, zoned-decimal,
 * packed-decimal COMP-3 and binary COMP fields).
 *
 * This port reproduces the exported bytes exactly so its output matches the
 * GnuCOBOL baseline byte-for-byte (differential/parity testing). The legacy
 * program reads INDEXED (KSDS) files; here we read the same fixed-length
 * records from the ASCII extracts that seed them.
 *
 * Parity-critical encodings reproduced here:
 *  - COMP (binary): big-endian, GnuCOBOL -std=mf "binary-size 1--8" widths
 *    (e.g. 9 digits -> 4 bytes, 11 -> 5, 12 -> 6). Signed uses two's
 *    complement.
 *  - COMP-3 (packed decimal): 2 nibbles/byte, trailing sign nibble
 *    (0xC positive, 0xD negative, 0xF unsigned), high-order zero pad.
 *  - Zoned S9(n)V99 -> numeric: GnuCOBOL's -std=mf trailing-sign decode:
 *    last byte '0'..'9' => that digit (+), 'p'..'y' => digit 0..9 (-),
 *    any other byte (e.g. '{','A'..'R','}') => digit 0 (+).
 *  - Zoned -> zoned (same PIC): verbatim byte copy (overpunch preserved).
 */
import { readFileSync } from "fs";
import { join } from "path";

const RECLEN = 500;
const DATA_OFF = 40; // record-data area starts here
const DATA_LEN = 460;

/** Fixed clock used for the golden baseline (COB_CURRENT_DATE=20250115103045). */
export const EXPORT_TIMESTAMP = "2025-01-15 10:30:45.00";
const BRANCH_ID = "0001";
const REGION_CODE = "NORTH";

/** GnuCOBOL -std=mf "binary-size 1--8": bytes needed to hold N decimal digits. */
export function bytesForDigits(nDigits: number): number {
  if (nDigits <= 2) return 1;
  if (nDigits <= 4) return 2;
  if (nDigits <= 6) return 3;
  if (nDigits <= 9) return 4;
  if (nDigits <= 11) return 5;
  if (nDigits <= 14) return 6;
  if (nDigits <= 16) return 7;
  return 8;
}

/**
 * Decode a zoned S9(...) DISPLAY field the way GnuCOBOL -std=mf does when
 * moving it into a numeric (COMP/COMP-3) item. Returns the full digit string
 * (implied decimals included) and the sign.
 */
export function gnuDecodeZoned(field: string): { negative: boolean; digits: string } {
  const lead = field.slice(0, -1);
  const last = field.charCodeAt(field.length - 1);
  let digit = 0;
  let negative = false;
  if (last >= 0x30 && last <= 0x39) {
    digit = last - 0x30; // '0'..'9' -> positive digit
  } else if (last >= 0x70 && last <= 0x79) {
    digit = last - 0x70; // 'p'..'y' -> negative digit 0..9
    negative = true;
  } else {
    digit = 0; // any other overpunch byte -> 0, positive
  }
  return { negative, digits: lead + String(digit) };
}

/** Pack a decimal digit string as COBOL COMP-3 (packed decimal). */
export function packComp3(digits: string, opts: { signed: boolean; negative: boolean }): Buffer {
  const signNibble = opts.signed ? (opts.negative ? "d" : "c") : "f";
  let nibs = digits + signNibble;
  if (nibs.length % 2 === 1) nibs = "0" + nibs;
  const out = Buffer.alloc(nibs.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(nibs.substr(i * 2, 2), 16);
  }
  return out;
}

/** Encode an integer value as COBOL COMP (binary), big-endian, two's complement. */
export function packCompBinary(value: bigint, nDigits: number, signed: boolean): Buffer {
  const size = bytesForDigits(nDigits);
  const out = Buffer.alloc(size);
  let v = value;
  if (v < 0n) v = (1n << BigInt(size * 8)) + v; // two's complement
  for (let i = size - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

// --- source record parsing (fixed offsets from CardDemo copybooks) ---

function field(rec: string, start: number, len: number): string {
  return rec.slice(start, start + len);
}

export interface Customer { raw: string; }
export interface AccountRec { raw: string; }
export interface Xref { raw: string; }
export interface Tran { raw: string; }
export interface Card { raw: string; }

function padRec(line: string, len: number): string {
  return line.length >= len ? line.slice(0, len) : line.padEnd(len, " ");
}

// --- data-area writers ---

class DataArea {
  buf: Buffer;
  constructor() {
    this.buf = Buffer.alloc(DATA_LEN, 0x20); // INITIALIZE -> spaces
  }
  text(off: number, len: number, value: string): void {
    const s = value.length >= len ? value.slice(0, len) : value.padEnd(len, " ");
    this.buf.write(s, off, len, "latin1");
  }
  bytes(off: number, b: Buffer): void {
    b.copy(this.buf, off);
  }
}

/** Build a full 500-byte export record: header + data area. */
function buildRecord(recType: string, seq: number, data: DataArea): Buffer {
  const rec = Buffer.alloc(RECLEN, 0x20);
  rec.write(recType, 0, 1, "latin1");
  rec.write(EXPORT_TIMESTAMP.padEnd(26, " "), 1, 26, "latin1");
  packCompBinary(BigInt(seq), 9, false).copy(rec, 27); // EXPORT-SEQUENCE-NUM 9(9) COMP
  rec.write(BRANCH_ID, 31, 4, "latin1");
  rec.write(REGION_CODE, 35, 5, "latin1");
  data.buf.copy(rec, DATA_OFF);
  return rec;
}

// CVCUS01Y (500)
function customerRecord(rec: string, seq: number): Buffer {
  const d = new DataArea();
  const custId = field(rec, 0, 9);
  d.bytes(0, packCompBinary(BigInt(custId), 9, false)); // EXP-CUST-ID 9(9) COMP
  d.text(4, 25, field(rec, 9, 25)); // first
  d.text(29, 25, field(rec, 34, 25)); // middle
  d.text(54, 25, field(rec, 59, 25)); // last
  d.text(79, 50, field(rec, 84, 50)); // addr1
  d.text(129, 50, field(rec, 134, 50)); // addr2
  d.text(179, 50, field(rec, 184, 50)); // addr3
  d.text(229, 2, field(rec, 234, 2)); // state
  d.text(231, 3, field(rec, 236, 3)); // country
  d.text(234, 10, field(rec, 239, 10)); // zip
  d.text(244, 15, field(rec, 249, 15)); // phone1
  d.text(259, 15, field(rec, 264, 15)); // phone2
  d.text(274, 9, field(rec, 279, 9)); // ssn 9(9) DISPLAY
  d.text(283, 20, field(rec, 288, 20)); // govt id
  d.text(303, 10, field(rec, 308, 10)); // dob
  d.text(313, 10, field(rec, 318, 10)); // eft acct id
  d.text(323, 1, field(rec, 328, 1)); // pri card holder ind
  const fico = field(rec, 329, 3);
  d.bytes(324, packComp3(fico, { signed: false, negative: false })); // FICO 9(3) COMP-3
  return buildRecord("C", seq, d);
}

// CVACT01Y (300)
function accountRecord(rec: string, seq: number): Buffer {
  const d = new DataArea();
  d.text(0, 11, field(rec, 0, 11)); // acct id 9(11) DISPLAY
  d.text(11, 1, field(rec, 11, 1)); // active status
  const currBal = gnuDecodeZoned(field(rec, 12, 12));
  d.bytes(12, packComp3(currBal.digits, { signed: true, negative: currBal.negative })); // COMP-3
  d.text(19, 12, field(rec, 24, 12)); // credit limit zoned -> zoned (verbatim)
  const cash = gnuDecodeZoned(field(rec, 36, 12));
  d.bytes(31, packComp3(cash.digits, { signed: true, negative: cash.negative })); // COMP-3
  d.text(38, 10, field(rec, 48, 10)); // open date
  d.text(48, 10, field(rec, 58, 10)); // expiration date
  d.text(58, 10, field(rec, 68, 10)); // reissue date
  d.text(68, 12, field(rec, 78, 12)); // curr cyc credit zoned -> zoned (verbatim)
  const cycDebit = gnuDecodeZoned(field(rec, 90, 12));
  const cycVal = (cycDebit.negative ? -1n : 1n) * BigInt(cycDebit.digits);
  d.bytes(80, packCompBinary(cycVal, 12, true)); // S9(10)V99 COMP (6 bytes)
  d.text(86, 10, field(rec, 102, 10)); // addr zip
  d.text(96, 10, field(rec, 112, 10)); // group id
  return buildRecord("A", seq, d);
}

// CVACT03Y (50)
function xrefRecord(rec: string, seq: number): Buffer {
  const d = new DataArea();
  d.text(0, 16, field(rec, 0, 16)); // xref card num
  d.text(16, 9, field(rec, 16, 9)); // xref cust id 9(9) DISPLAY
  d.bytes(25, packCompBinary(BigInt(field(rec, 25, 11)), 11, false)); // xref acct id 9(11) COMP (5 bytes)
  return buildRecord("X", seq, d);
}

// CVTRA05Y (350)
function tranRecord(rec: string, seq: number): Buffer {
  const d = new DataArea();
  d.text(0, 16, field(rec, 0, 16)); // tran id
  d.text(16, 2, field(rec, 16, 2)); // type cd
  d.text(18, 4, field(rec, 18, 4)); // cat cd 9(4) DISPLAY
  d.text(22, 10, field(rec, 22, 10)); // source
  d.text(32, 100, field(rec, 32, 100)); // desc
  const amt = gnuDecodeZoned(field(rec, 132, 11)); // S9(9)V99
  d.bytes(132, packComp3(amt.digits, { signed: true, negative: amt.negative })); // COMP-3 (6 bytes)
  d.bytes(138, packCompBinary(BigInt(field(rec, 143, 9)), 9, false)); // merchant id 9(9) COMP (4 bytes)
  d.text(142, 50, field(rec, 152, 50)); // merchant name
  d.text(192, 50, field(rec, 202, 50)); // merchant city
  d.text(242, 10, field(rec, 252, 10)); // merchant zip
  d.text(252, 16, field(rec, 262, 16)); // card num
  d.text(268, 26, field(rec, 278, 26)); // orig ts
  d.text(294, 26, field(rec, 304, 26)); // proc ts
  return buildRecord("T", seq, d);
}

// CVACT02Y (150)
function cardRecord(rec: string, seq: number): Buffer {
  const d = new DataArea();
  d.text(0, 16, field(rec, 0, 16)); // card num
  d.bytes(16, packCompBinary(BigInt(field(rec, 16, 11)), 11, false)); // card acct id 9(11) COMP (5 bytes)
  d.bytes(21, packCompBinary(BigInt(field(rec, 27, 3)), 3, false)); // cvv 9(3) COMP (2 bytes)
  d.text(23, 50, field(rec, 30, 50)); // embossed name
  d.text(73, 10, field(rec, 80, 10)); // expiration date
  d.text(83, 1, field(rec, 90, 1)); // active status
  return buildRecord("D", seq, d);
}

function readLines(path: string, len: number): string[] {
  const text = readFileSync(path, "latin1");
  return text
    .split("\n")
    .filter((l) => l.replace(/\r$/, "").length > 0)
    .map((l) => padRec(l.replace(/\r$/, ""), len));
}

/**
 * Run the export against the fixture directory, returning the concatenated
 * 500-byte export records (customers, then accounts, xrefs, transactions,
 * cards), matching the order and sequence numbering of the legacy program.
 */
export function run(dataDir: string): Buffer {
  const parts: Buffer[] = [];
  let seq = 0;
  for (const rec of readLines(join(dataDir, "custdata.txt"), 500)) parts.push(customerRecord(rec, ++seq));
  for (const rec of readLines(join(dataDir, "acctdata.txt"), 300)) parts.push(accountRecord(rec, ++seq));
  for (const rec of readLines(join(dataDir, "cardxref.txt"), 50)) parts.push(xrefRecord(rec, ++seq));
  for (const rec of readLines(join(dataDir, "trandata.txt"), 350)) parts.push(tranRecord(rec, ++seq));
  for (const rec of readLines(join(dataDir, "carddata.txt"), 150)) parts.push(cardRecord(rec, ++seq));
  return Buffer.concat(parts);
}

if (require.main === module) {
  const dataDir = process.argv[2] ?? join(__dirname, "..", "..", "legacy", "cbexport_data");
  process.stdout.write(run(dataDir));
}
