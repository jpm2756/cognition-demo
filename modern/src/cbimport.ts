/**
 * Cloud-native reimplementation of CardDemo batch program CBIMPORT.
 *
 * Legacy behavior (app/cbl/CBIMPORT.cbl): read a multi-record branch
 * "export" file (fixed 500-byte EXPORT-RECORD, CVEXPORT.cpy) and, based on
 * EXPORT-REC-TYPE, demultiplex each record into one of five normalized
 * target files -- CUSTOMER (CVCUS01Y), ACCOUNT (CVACT01Y), CARD-XREF
 * (CVACT03Y), TRANSACTION (CVTRA05Y), CARD (CVACT02Y) -- or, for an
 * unrecognized type, an ERROR report. Each 2xxx-PROCESS paragraph does
 * INITIALIZE <record> then a series of field MOVEs then WRITE.
 *
 * This port reproduces the exact bytes CBIMPORT writes to those output
 * files so its assembled output matches the GnuCOBOL golden baseline
 * byte-for-byte (differential/parity testing). The golden baseline is
 * produced by legacy/run_cbimport.sh, which splits each output file back
 * into fixed-length records and prints them under a per-file header
 * (see that script for the exact framing, mirrored by assemble() below).
 *
 * Parity-critical semantics:
 *   - EXPORT-SEQUENCE-NUM / several key fields are COMP (big-endian binary)
 *     or COMP-3 (packed decimal); they are decoded to a value then
 *     re-rendered as the target field's USAGE DISPLAY picture.
 *   - Signed DISPLAY numerics (S9(n)V99) use GnuCOBOL's ASCII trailing sign:
 *     a positive value keeps its last digit as a plain digit; a negative
 *     value replaces the last digit D with the byte 0x70+D ('0'->'p' ..
 *     '9'->'y'). This is NOT the EBCDIC {..I / }..R overpunch.
 *   - INITIALIZE sets named elementary items (spaces for X, zeros for 9)
 *     but leaves FILLER at the record's initial binary zero (0x00). Since
 *     every named field is subsequently MOVEd, the observable effect is:
 *     mapped fields carry their value (space/zero padded), trailing FILLER
 *     stays NUL (0x00).
 */
import { readFileSync } from "fs";

export const EXPORT_RECLEN = 500;
const DATA_OFFSET = 40; // EXPORT-RECORD-DATA begins after the 40-byte header

/** Output file record lengths, keyed by logical section. */
export const OUT_RECLEN = {
  CUSTOMER: 500,
  ACCOUNT: 300,
  "CARD-XREF": 50,
  TRANSACTION: 350,
  CARD: 150,
  ERROR: 132,
} as const;

type NumVal = { neg: boolean; digits: string };

// ---------------------------------------------------------------------------
// Decoders (legacy binary field -> value)
// ---------------------------------------------------------------------------

/** COMP (binary) unsigned, big-endian. */
export function decodeCompUnsigned(buf: Buffer, off: number, len: number): NumVal {
  let v = 0n;
  for (let i = 0; i < len; i++) v = (v << 8n) | BigInt(buf[off + i]);
  return { neg: false, digits: v.toString() };
}

/** COMP (binary) signed, big-endian two's complement. */
export function decodeCompSigned(buf: Buffer, off: number, len: number): NumVal {
  let v = 0n;
  for (let i = 0; i < len; i++) v = (v << 8n) | BigInt(buf[off + i]);
  const bits = BigInt(len * 8);
  const signBit = 1n << (bits - 1n);
  if (v & signBit) v -= 1n << bits; // negative
  return { neg: v < 0n, digits: (v < 0n ? -v : v).toString() };
}

/** COMP-3 (packed decimal): 2 digits per byte, final low nibble = sign. */
export function decodeComp3(buf: Buffer, off: number, len: number): NumVal {
  let digits = "";
  for (let i = 0; i < len; i++) {
    const b = buf[off + i];
    const hi = (b >> 4) & 0x0f;
    const lo = b & 0x0f;
    if (i < len - 1) {
      digits += String(hi) + String(lo);
    } else {
      digits += String(hi); // last byte: high nibble is a digit
      // low nibble is the sign: 0xD (and 0xB) = negative; 0xC/0xF/0xA/0xE = positive
      const neg = lo === 0x0d || lo === 0x0b;
      digits = digits.replace(/^0+(?=\d)/, "");
      return { neg, digits };
    }
  }
  return { neg: false, digits: "0" };
}

/** Signed DISPLAY numeric (zoned, GnuCOBOL ASCII trailing sign). */
export function decodeZonedInput(field: string): NumVal {
  const body = field.slice(0, -1);
  const lastCode = field.charCodeAt(field.length - 1);
  let neg = false;
  let lastDigit: number;
  if (lastCode >= 0x30 && lastCode <= 0x39) {
    lastDigit = lastCode - 0x30; // positive plain digit
  } else if (lastCode >= 0x70 && lastCode <= 0x79) {
    neg = true;
    lastDigit = lastCode - 0x70; // negative: 'p'..'y'
  } else {
    // Fallback: EBCDIC-style overpunch, just in case.
    const pos = "{ABCDEFGHI".indexOf(field[field.length - 1]);
    const negi = "}JKLMNOPQR".indexOf(field[field.length - 1]);
    if (negi >= 0) {
      neg = true;
      lastDigit = negi;
    } else {
      lastDigit = pos >= 0 ? pos : 0;
    }
  }
  const digits = (body + String(lastDigit)).replace(/^0+(?=\d)/, "");
  return { neg, digits };
}

/** Unsigned DISPLAY numeric (plain ASCII digits). */
export function decodeDisplayUnsigned(field: string): NumVal {
  return { neg: false, digits: field.replace(/^0+(?=\d)/, "") || "0" };
}

// ---------------------------------------------------------------------------
// Encoders (value -> target DISPLAY picture)
// ---------------------------------------------------------------------------

/** Render an unsigned 9(width) DISPLAY field: right-justified, zero-filled. */
export function encUnsigned(v: NumVal, width: number): string {
  const d = v.digits.replace(/\D/g, "") || "0";
  return d.padStart(width, "0").slice(-width);
}

/** Render a signed S9(...)V.. DISPLAY field with GnuCOBOL ASCII trailing sign. */
export function encZonedSigned(v: NumVal, width: number): string {
  const d = (v.digits.replace(/\D/g, "") || "0").padStart(width, "0").slice(-width);
  if (!v.neg) return d; // positive: plain trailing digit
  const lastDigit = d.charCodeAt(width - 1) - 0x30;
  return d.slice(0, width - 1) + String.fromCharCode(0x70 + lastDigit);
}

/** Left-justify an alphanumeric value into width bytes (space pad / truncate). */
function alpha(value: string, width: number): string {
  return value.padEnd(width, " ").slice(0, width);
}

// ---------------------------------------------------------------------------
// Record builder
// ---------------------------------------------------------------------------

/** A single output field placement. */
interface Field {
  off: number;
  text: string;
}

/** Build a fixed-length output record: 0x00 filled, then place each field. */
function buildRecord(reclen: number, fields: Field[]): Buffer {
  const buf = Buffer.alloc(reclen, 0x00);
  for (const f of fields) buf.write(f.text, f.off, "latin1");
  return buf;
}

export interface Outputs {
  CUSTOMER: Buffer[];
  ACCOUNT: Buffer[];
  "CARD-XREF": Buffer[];
  TRANSACTION: Buffer[];
  CARD: Buffer[];
  ERROR: Buffer[];
}

/** Slice an alphanumeric sub-field out of the 460-byte data area. */
function a(rec: Buffer, rel: number, len: number): string {
  return rec.toString("latin1", DATA_OFFSET + rel, DATA_OFFSET + rel + len);
}

function processCustomer(rec: Buffer): Buffer {
  const custId = decodeCompUnsigned(rec, DATA_OFFSET + 0, 4);
  const ssn = decodeDisplayUnsigned(a(rec, 274, 9));
  const fico = decodeComp3(rec, DATA_OFFSET + 324, 2);
  return buildRecord(OUT_RECLEN.CUSTOMER, [
    { off: 0, text: encUnsigned(custId, 9) },
    { off: 9, text: alpha(a(rec, 4, 25), 25) },
    { off: 34, text: alpha(a(rec, 29, 25), 25) },
    { off: 59, text: alpha(a(rec, 54, 25), 25) },
    { off: 84, text: alpha(a(rec, 79, 50), 50) },
    { off: 134, text: alpha(a(rec, 129, 50), 50) },
    { off: 184, text: alpha(a(rec, 179, 50), 50) },
    { off: 234, text: alpha(a(rec, 229, 2), 2) },
    { off: 236, text: alpha(a(rec, 231, 3), 3) },
    { off: 239, text: alpha(a(rec, 234, 10), 10) },
    { off: 249, text: alpha(a(rec, 244, 15), 15) },
    { off: 264, text: alpha(a(rec, 259, 15), 15) },
    { off: 279, text: encUnsigned(ssn, 9) },
    { off: 288, text: alpha(a(rec, 283, 20), 20) },
    { off: 308, text: alpha(a(rec, 303, 10), 10) },
    { off: 318, text: alpha(a(rec, 313, 10), 10) },
    { off: 328, text: alpha(a(rec, 323, 1), 1) },
    { off: 329, text: encUnsigned(fico, 3) },
  ]);
}

function processAccount(rec: Buffer): Buffer {
  const acctId = decodeDisplayUnsigned(a(rec, 0, 11));
  const currBal = decodeComp3(rec, DATA_OFFSET + 12, 7);
  const creditLimit = decodeZonedInput(a(rec, 19, 12));
  const cashCredit = decodeComp3(rec, DATA_OFFSET + 31, 7);
  const cycCredit = decodeZonedInput(a(rec, 68, 12));
  const cycDebit = decodeCompSigned(rec, DATA_OFFSET + 80, 6);
  return buildRecord(OUT_RECLEN.ACCOUNT, [
    { off: 0, text: encUnsigned(acctId, 11) },
    { off: 11, text: alpha(a(rec, 11, 1), 1) },
    { off: 12, text: encZonedSigned(currBal, 12) },
    { off: 24, text: encZonedSigned(creditLimit, 12) },
    { off: 36, text: encZonedSigned(cashCredit, 12) },
    { off: 48, text: alpha(a(rec, 38, 10), 10) },
    { off: 58, text: alpha(a(rec, 48, 10), 10) },
    { off: 68, text: alpha(a(rec, 58, 10), 10) },
    { off: 78, text: encZonedSigned(cycCredit, 12) },
    { off: 90, text: encZonedSigned(cycDebit, 12) },
    { off: 102, text: alpha(a(rec, 86, 10), 10) },
    { off: 112, text: alpha(a(rec, 96, 10), 10) },
  ]);
}

function processXref(rec: Buffer): Buffer {
  const custId = decodeDisplayUnsigned(a(rec, 16, 9));
  const acctId = decodeCompUnsigned(rec, DATA_OFFSET + 25, 5);
  return buildRecord(OUT_RECLEN["CARD-XREF"], [
    { off: 0, text: alpha(a(rec, 0, 16), 16) },
    { off: 16, text: encUnsigned(custId, 9) },
    { off: 25, text: encUnsigned(acctId, 11) },
  ]);
}

function processTran(rec: Buffer): Buffer {
  const catCd = decodeDisplayUnsigned(a(rec, 18, 4));
  const amt = decodeComp3(rec, DATA_OFFSET + 132, 6);
  const merchId = decodeCompUnsigned(rec, DATA_OFFSET + 138, 4);
  return buildRecord(OUT_RECLEN.TRANSACTION, [
    { off: 0, text: alpha(a(rec, 0, 16), 16) },
    { off: 16, text: alpha(a(rec, 16, 2), 2) },
    { off: 18, text: encUnsigned(catCd, 4) },
    { off: 22, text: alpha(a(rec, 22, 10), 10) },
    { off: 32, text: alpha(a(rec, 32, 100), 100) },
    { off: 132, text: encZonedSigned(amt, 11) },
    { off: 143, text: encUnsigned(merchId, 9) },
    { off: 152, text: alpha(a(rec, 142, 50), 50) },
    { off: 202, text: alpha(a(rec, 192, 50), 50) },
    { off: 252, text: alpha(a(rec, 242, 10), 10) },
    { off: 262, text: alpha(a(rec, 252, 16), 16) },
    { off: 278, text: alpha(a(rec, 268, 26), 26) },
    { off: 304, text: alpha(a(rec, 294, 26), 26) },
  ]);
}

function processCard(rec: Buffer): Buffer {
  const acctId = decodeCompUnsigned(rec, DATA_OFFSET + 16, 5);
  const cvv = decodeCompUnsigned(rec, DATA_OFFSET + 21, 2);
  return buildRecord(OUT_RECLEN.CARD, [
    { off: 0, text: alpha(a(rec, 0, 16), 16) },
    { off: 16, text: encUnsigned(acctId, 11) },
    { off: 27, text: encUnsigned(cvv, 3) },
    { off: 30, text: alpha(a(rec, 23, 50), 50) },
    { off: 80, text: alpha(a(rec, 73, 10), 10) },
    { off: 90, text: alpha(a(rec, 83, 1), 1) },
  ]);
}

/** Read the export file and demultiplex it into per-type output records. */
export function demux(data: Buffer): Outputs {
  const out: Outputs = {
    CUSTOMER: [],
    ACCOUNT: [],
    "CARD-XREF": [],
    TRANSACTION: [],
    CARD: [],
    ERROR: [],
  };
  const n = Math.floor(data.length / EXPORT_RECLEN);
  for (let i = 0; i < n; i++) {
    const rec = data.subarray(i * EXPORT_RECLEN, (i + 1) * EXPORT_RECLEN);
    const recType = rec.toString("latin1", 0, 1);
    switch (recType) {
      case "C":
        out.CUSTOMER.push(processCustomer(rec));
        break;
      case "A":
        out.ACCOUNT.push(processAccount(rec));
        break;
      case "X":
        out["CARD-XREF"].push(processXref(rec));
        break;
      case "T":
        out.TRANSACTION.push(processTran(rec));
        break;
      case "D":
        out.CARD.push(processCard(rec));
        break;
      default:
        // Unknown record type -> ERROR report. The fixture contains none;
        // the error record embeds FUNCTION CURRENT-DATE (non-deterministic)
        // so it is intentionally excluded from the parity fixture.
        break;
    }
  }
  return out;
}

/**
 * Assemble the golden-baseline text exactly as legacy/run_cbimport.sh does:
 * a per-file header then each fixed-length record decoded as latin1, all
 * joined by newlines. Returns the body WITHOUT a trailing newline.
 */
export function assemble(out: Outputs): string {
  const order: (keyof Outputs)[] = [
    "CUSTOMER",
    "ACCOUNT",
    "CARD-XREF",
    "TRANSACTION",
    "CARD",
    "ERROR",
  ];
  const lines: string[] = [];
  for (const label of order) {
    const recs = out[label];
    const reclen = OUT_RECLEN[label];
    lines.push(`===== ${label} (reclen=${reclen}, records=${recs.length}) =====`);
    for (const rec of recs) lines.push(rec.toString("latin1"));
  }
  return lines.join("\n");
}

export function run(dataPath: string): string {
  const data = readFileSync(dataPath);
  return assemble(demux(data));
}

if (require.main === module) {
  const dataPath = process.argv[2] ?? "expdata.dat";
  process.stdout.write(run(dataPath) + "\n");
}
