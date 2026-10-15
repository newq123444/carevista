// ────────────────────────────────────────────────────────────────────────────
// Canonical serialisation for the record integrity chain.
//
// Verification recomputes a record's digest from the live row and compares it
// with the digest stored when the record was written. If serialisation is not
// perfectly deterministic, verification reports tampering that never happened.
//
// That failure mode is worse than having no chain at all: a system that cries
// wolf gets switched off, and a switched-off system protects nobody. So this
// file is deliberately fussy, and every rule below exists because there is a
// real way for the same record to serialise two different ways:
//
//   • Postgres does not promise column order, and JS object key order follows
//     insertion order — so keys are sorted.
//   • A missing property and an explicit null are the same fact about a care
//     record ("nothing was recorded here") — so they normalise together.
//   • node-postgres returns DECIMAL as a string but INTEGER as a number, and
//     0.1 + 0.2 !== 0.3 — so numbers never go in as floats.
//   • A timestamp read back through a different server timezone is the same
//     instant — so everything is UTC with fixed precision.
//   • "café" can be one code point or two (é vs e + combining accent). A carer
//     typing on an iPad and one typing on Android can produce both — so text is
//     NFC normalised.
//
// See compliance/RECORD_INTEGRITY_THREAT_MODEL.md §5.
// ────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';

export type Canonical = string;

/**
 * Fixed representation for a value already known to be numeric.
 *
 * Deliberately NOT applied to every string. Unifying the text "36.5" with the
 * number 36.5 inside the serialiser would make {a:"1"} and {a:1} collide, and a
 * digest scheme whose collisions are reachable from ordinary data is not worth
 * having. The driver-type problem it was meant to solve — node-postgres hands
 * back DECIMAL as a string and INTEGER as a number — is solved instead in
 * recordDigest(), which knows the column's declared type. Type coercion belongs
 * where the type is known.
 */
function canonicalNumber(v: number | string): string {
  if (typeof v === 'string') {
    const s = v.trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) {
      throw new Error('Field declared numeric but value is not a number: ' + JSON.stringify(v));
    }
    return trimNumeric(s);
  }
  if (!Number.isFinite(v)) {
    throw new Error('Refusing to hash a non-finite number: ' + String(v));
  }
  if (Number.isInteger(v)) return String(v);
  // A float in a care record is always a measurement that came from a DECIMAL
  // column or a bounded input (temperature, weight). Fixing the precision keeps
  // it stable; going through the float twice would not.
  return trimNumeric(v.toFixed(6));
}

function trimNumeric(s: string): string {
  if (!s.includes('.')) return normaliseZero(s);
  let out = s.replace(/0+$/, '');
  if (out.endsWith('.')) out = out.slice(0, -1);
  return normaliseZero(out);
}

/** -0 and 0 are the same quantity; JSON would otherwise render them apart. */
function normaliseZero(s: string): string {
  return /^-0(\.0*)?$/.test(s) ? '0' : s;
}

/** Always UTC, always millisecond precision, always the same shape. */
function canonicalDate(d: Date): string {
  if (Number.isNaN(d.getTime())) throw new Error('Refusing to hash an invalid Date');
  return d.toISOString().replace(/\.(\d{3})\d*Z$/, '.$1Z');
}

/**
 * Turn a record into a byte-for-byte reproducible string.
 *
 * Not JSON.stringify with sorted keys — that would keep JS number formatting,
 * lose the absent/null distinction inconsistently, and accept NaN.
 */
export function canonicalise(value: unknown): Canonical {
  return encode(value, new WeakSet());
}

function encode(v: unknown, seen: WeakSet<object>): string {
  // A missing field and an explicitly null field say the same thing about a
  // care record. Normalising them together means adding a column to a table
  // does not change the digest of rows written before it existed.
  if (v === null || v === undefined) return 'null';

  const t = typeof v;
  if (t === 'boolean') return v ? 'true' : 'false';
  if (t === 'number') return canonicalNumber(v as number);
  if (t === 'bigint') return (v as bigint).toString();
  if (t === 'string') return JSON.stringify((v as string).normalize('NFC'));

  if (v instanceof Date) return JSON.stringify(canonicalDate(v));
  if (Buffer.isBuffer(v)) return JSON.stringify('b64:' + v.toString('base64'));

  if (Array.isArray(v)) {
    guard(v, seen);
    const out = '[' + v.map(x => encode(x, seen)).join(',') + ']';
    seen.delete(v);
    return out;
  }

  if (t === 'object') {
    const o = v as Record<string, unknown>;
    guard(o, seen);
    // Sort by UTF-16 code unit, which is what Array#sort does by default and is
    // stable across every JS engine. Locale-aware sorting is NOT used: it would
    // order keys differently depending on the server's locale.
    const keys = Object.keys(o).sort();
    const parts: string[] = [];
    for (const k of keys) {
      const val = o[k];
      // Skip absent/null entirely rather than emitting "key":null, so that a
      // record written before a column existed hashes the same as one written
      // after it where the column is empty.
      if (val === null || val === undefined) continue;
      parts.push(JSON.stringify(k.normalize('NFC')) + ':' + encode(val, seen));
    }
    seen.delete(o);
    return '{' + parts.join(',') + '}';
  }

  throw new Error('Refusing to hash unsupported type: ' + t);
}

function guard(o: object, seen: WeakSet<object>) {
  if (seen.has(o)) throw new Error('Refusing to hash a circular structure');
  seen.add(o);
}

/** SHA-256 of the canonical form, lowercase hex. */
export function digest(value: unknown): string {
  return createHash('sha256').update(canonicalise(value), 'utf8').digest('hex');
}

/** SHA-256 over already-hex hashes, used to link and to build Merkle nodes. */
export function hashPair(left: string, right: string): string {
  return createHash('sha256')
    .update(Buffer.from(left, 'hex'))
    .update(Buffer.from(right, 'hex'))
    .digest('hex');
}

export const ZERO_HASH = '0'.repeat(64);

/**
 * How a column should be normalised before hashing. Declaring the type is what
 * keeps a digest stable when the database driver, or a later migration, changes
 * the JavaScript type a column arrives as.
 *
 *   'numeric' — INTEGER, DECIMAL, NUMERIC, REAL. Arrives as number OR string
 *               depending on the column; normalised to one fixed form, so
 *               NUMERIC(4,1) '36.50' and INTEGER 36.5 agree.
 *   'time'    — TIMESTAMPTZ. Arrives as Date or ISO string; normalised to UTC
 *               with millisecond precision.
 *   'date'    — DATE. node-postgres builds a Date at *local* midnight, so
 *               reading it back through UTC would shift the day if the server's
 *               timezone changed and every historic digest would break at once.
 *               Only the calendar day is hashed, read in the same local frame
 *               the driver used to construct it.
 *   'bool'    — BOOLEAN. Postgres can yield true/false or 't'/'f'.
 *   'text'    — everything else. Passed through NFC normalisation only.
 */
export type FieldType = 'numeric' | 'time' | 'date' | 'bool' | 'text';
export type FieldSpec = string | { name: string; type: FieldType };

function coerce(value: unknown, type: FieldType): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case 'numeric':
      // Emitted as a canonical string so that the number/string distinction the
      // driver happens to make cannot reach the digest at all.
      return 'n:' + canonicalNumber(value as number | string);
    case 'time': {
      const d = value instanceof Date ? value : new Date(String(value));
      if (Number.isNaN(d.getTime())) throw new Error('Field declared time but value is not a date: ' + String(value));
      return d;
    }
    case 'date': {
      if (typeof value === 'string') {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
        if (!m) throw new Error('Field declared date but value is not a date: ' + value);
        return 'd:' + m[1] + '-' + m[2] + '-' + m[3];
      }
      if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) throw new Error('Field declared date but value is an invalid Date');
        const y = String(value.getFullYear()).padStart(4, '0');
        const mo = String(value.getMonth() + 1).padStart(2, '0');
        const da = String(value.getDate()).padStart(2, '0');
        return 'd:' + y + '-' + mo + '-' + da;
      }
      throw new Error('Field declared date but value is not a date: ' + String(value));
    }
    case 'bool':
      if (typeof value === 'boolean') return value;
      if (value === 't' || value === 'true' || value === 1 || value === '1') return true;
      if (value === 'f' || value === 'false' || value === 0 || value === '0') return false;
      throw new Error('Field declared bool but value is not a boolean: ' + String(value));
    default:
      return value;
  }
}

/**
 * The digest of one record, over an explicit, typed field list.
 *
 * The field list is stored alongside the chain entry, so adding a column in a
 * later migration cannot invalidate entries written before it existed.
 */
export function recordDigest(row: Record<string, unknown>, fields: readonly FieldSpec[]): string {
  const subset: Record<string, unknown> = {};
  for (const f of fields) {
    if (typeof f === 'string') subset[f] = row[f] ?? null;
    else subset[f.name] = coerce(row[f.name], f.type);
  }
  return digest(subset);
}

/** The field names of a spec list, in the order given — for storing with the entry. */
export function fieldNames(fields: readonly FieldSpec[]): string[] {
  return fields.map(f => (typeof f === 'string' ? f : f.name));
}
