// Tests for the canonical serialiser. Run: node tests/canonical.test.mjs
// These are adversarial on purpose: every case here is a way the same care
// record could serialise two different ways and produce a false tamper alert.
import { createHash } from 'node:crypto';
import assert from 'node:assert';

// Mirror of src/utils/canonical.ts, kept in sync by tests/verify-canonical-sync.mjs
const { canonicalise, digest, hashPair, recordDigest, ZERO_HASH } = await import('./canonical.impl.mjs');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}
const eq = (a, b, m) => assert.strictEqual(a, b, m);

// ── Key order ─────────────────────────────────────────────────────────────
t('key order does not matter', () => {
  eq(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 }));
});
t('nested key order does not matter', () => {
  eq(digest({ x: { p: 1, q: 2 }, y: 3 }), digest({ y: 3, x: { q: 2, p: 1 } }));
});
t('key order is not locale dependent', () => {
  // Turkish locale lowercases I to dotless i; a locale-aware sort would differ.
  eq(digest({ I: 1, i: 2 }), digest({ i: 2, I: 1 }));
});

// ── Absent vs null ────────────────────────────────────────────────────────
t('absent and null are the same', () => {
  eq(digest({ a: 1, b: null }), digest({ a: 1 }));
});
t('undefined and null are the same', () => {
  eq(digest({ a: 1, b: undefined }), digest({ a: 1, b: null }));
});
t('a new column left empty does not change an old digest', () => {
  const before = digest({ note: 'settled', mood: 'calm' });
  const after  = digest({ note: 'settled', mood: 'calm', pain_score: null });
  eq(before, after, 'adding an empty column must not break historic entries');
});
t('but a populated new column DOES change the digest', () => {
  assert.notStrictEqual(
    digest({ note: 'settled' }),
    digest({ note: 'settled', pain_score: 3 }));
});

// ── Numbers ───────────────────────────────────────────────────────────────
// The serialiser is strictly type-honest: "1" is text and 1 is a number, so
// that {a:"1"} and {a:1} cannot collide. Reconciling the two forms that
// node-postgres hands back for the same column is recordDigest's job, because
// that is where the column's declared type is known. See the typed-field tests
// below.
const N = v => ({ name: 'v', type: 'numeric' });
t('the serialiser keeps text and numbers apart', () => {
  assert.notStrictEqual(digest({ v: '36.5' }), digest({ v: 36.5 }));
});
t('a numeric field agrees whether the driver gives string or number', () => {
  eq(recordDigest({ v: '36.5' }, [N()]), recordDigest({ v: 36.5 }, [N()]));
});
t('trailing zeros do not matter for a numeric field', () => {
  eq(recordDigest({ v: '36.50' }, [N()]), recordDigest({ v: '36.5' }, [N()]));
  eq(recordDigest({ v: '72.000' }, [N()]), recordDigest({ v: 72 }, [N()]));
});
t('integer as string and as number agree for a numeric field', () => {
  eq(recordDigest({ v: '78' }, [N()]), recordDigest({ v: 78 }, [N()]));
});
t('minus zero equals zero', () => {
  eq(digest({ v: -0 }), digest({ v: 0 }));
  eq(recordDigest({ v: '-0.00' }, [N()]), recordDigest({ v: 0 }, [N()]));
});
t('a numeric field refuses text rather than hashing it as text', () => {
  assert.throws(() => recordDigest({ v: 'N/A' }, [N()]), /declared numeric/);
});
t('a time field agrees whether the driver gives Date or ISO string', () => {
  const T = [{ name: 'at', type: 'time' }];
  eq(recordDigest({ at: new Date('2026-03-01T09:00:00Z') }, T),
     recordDigest({ at: '2026-03-01T09:00:00.000Z' }, T));
  eq(recordDigest({ at: '2026-03-01T09:00:00Z' }, T),
     recordDigest({ at: '2026-03-01T10:00:00+01:00' }, T));
});
t('a bool field agrees whether the driver gives boolean or t/f', () => {
  const B = [{ name: 'b', type: 'bool' }];
  eq(recordDigest({ b: true }, B), recordDigest({ b: 't' }, B));
  eq(recordDigest({ b: false }, B), recordDigest({ b: 'f' }, B));
  assert.notStrictEqual(recordDigest({ b: true }, B), recordDigest({ b: false }, B));
});
t('a typed field still detects a real change', () => {
  assert.notStrictEqual(recordDigest({ v: 36.5 }, [N()]), recordDigest({ v: 38.9 }, [N()]));
});
t('a date field is stable across server timezone changes', () => {
  // node-postgres builds a DATE at LOCAL midnight. Reading it back through UTC
  // would move the calendar day in a negative-offset timezone, breaking every
  // historic digest the day someone changed TZ on the server.
  const D = [{ name: 'd', type: 'date' }];
  eq(recordDigest({ d: new Date(2026, 2, 1, 0, 0, 0) }, D),
     recordDigest({ d: '2026-03-01' }, D));
  eq(recordDigest({ d: '2026-03-01' }, D),
     recordDigest({ d: '2026-03-01T00:00:00.000Z' }, D));
});
t('a date field ignores the time of day', () => {
  const D = [{ name: 'd', type: 'date' }];
  eq(recordDigest({ d: new Date(2026, 2, 1, 0, 0, 0) }, D),
     recordDigest({ d: new Date(2026, 2, 1, 23, 59, 59) }, D));
});
t('a date field still detects a different day', () => {
  const D = [{ name: 'd', type: 'date' }];
  assert.notStrictEqual(recordDigest({ d: '2026-03-01' }, D),
                        recordDigest({ d: '2026-03-02' }, D));
});
t('a date field refuses nonsense', () => {
  assert.throws(() => recordDigest({ d: 'last Tuesday' }, [{ name: 'd', type: 'date' }]), /declared date/);
});
t('date and time types do not collide', () => {
  assert.notStrictEqual(
    recordDigest({ v: '2026-03-01' }, [{ name: 'v', type: 'date' }]),
    recordDigest({ v: '2026-03-01' }, [{ name: 'v', type: 'time' }]));
});
t('float addition artefacts do not leak in', () => {
  eq(digest({ v: 0.1 + 0.2 }), digest({ v: 0.3 }),
     '0.30000000000000004 must normalise to 0.3');
});
t('non-finite numbers are refused, not silently hashed', () => {
  assert.throws(() => digest({ v: NaN }), /non-finite/);
  assert.throws(() => digest({ v: Infinity }), /non-finite/);
});
t('big integers survive', () => {
  eq(canonicalise({ v: 9007199254740993n }), '{"v":9007199254740993}');
});

// ── Timestamps ────────────────────────────────────────────────────────────
t('same instant in different zones is the same digest', () => {
  eq(digest({ at: new Date('2026-03-01T09:00:00Z') }),
     digest({ at: new Date('2026-03-01T10:00:00+01:00') }));
});
t('timestamp precision is fixed', () => {
  eq(canonicalise({ at: new Date('2026-03-01T09:00:00.120Z') }),
     '{"at":"2026-03-01T09:00:00.120Z"}');
});
t('an invalid Date is refused', () => {
  assert.throws(() => digest({ at: new Date('nonsense') }), /invalid Date/);
});
t('a different instant is a different digest', () => {
  assert.notStrictEqual(
    digest({ at: new Date('2026-03-01T09:00:00Z') }),
    digest({ at: new Date('2026-03-01T09:00:01Z') }));
});

// ── Text ──────────────────────────────────────────────────────────────────
t('unicode composition does not matter', () => {
  const composed   = 'café';        // é as one code point
  const decomposed = 'café';       // e + combining acute
  assert.notStrictEqual(composed, decomposed, 'inputs must actually differ');
  eq(digest({ n: composed }), digest({ n: decomposed }));
});
t('unicode keys are normalised too', () => {
  eq(digest({ ['café']: 1 }), digest({ ['café']: 1 }));
});
t('real content changes are detected', () => {
  assert.notStrictEqual(digest({ n: 'ate all lunch' }), digest({ n: 'ate no lunch' }));
});
t('whitespace changes are detected', () => {
  assert.notStrictEqual(digest({ n: 'settled' }), digest({ n: 'settled ' }));
});
t('quotes and newlines survive', () => {
  const s = 'She said "I\'m fine"\nthen slept.\t\\';
  eq(JSON.parse(canonicalise(s)), s.normalize('NFC'));
});
t('an emoji in a note is stable', () => {
  eq(digest({ n: '👍' }), digest({ n: '\u{1F44D}' }));
});

// ── Booleans and structure ────────────────────────────────────────────────
t('booleans are not numbers', () => {
  assert.notStrictEqual(digest({ v: true }), digest({ v: 1 }));
  assert.notStrictEqual(digest({ v: false }), digest({ v: 0 }));
  assert.notStrictEqual(digest({ v: true }), digest({ v: 'true' }));
});
t('array order matters', () => {
  assert.notStrictEqual(digest({ a: [1, 2] }), digest({ a: [2, 1] }));
});
t('nulls inside arrays are kept positional', () => {
  eq(canonicalise([1, null, 2]), '[1,null,2]');
});
t('empty object and empty array differ', () => {
  assert.notStrictEqual(digest({}), digest([]));
});
t('a buffer is hashed by content', () => {
  eq(digest(Buffer.from('abc')), digest(Buffer.from('abc')));
  assert.notStrictEqual(digest(Buffer.from('abc')), digest(Buffer.from('abd')));
});
t('circular structures are refused, not hung on', () => {
  const a = { name: 'x' }; a.self = a;
  assert.throws(() => digest(a), /circular/);
});
t('a function is refused rather than silently dropped', () => {
  assert.throws(() => digest({ f: () => 1 }), /unsupported type/);
});

// ── The property that actually matters ────────────────────────────────────
t('structurally different records never collide', () => {
  // {a:"1"} vs {a:1} — a naive concatenation scheme collides here.
  assert.notStrictEqual(digest({ a: '1' }), digest({ a: 1 }));
  // {ab:1} vs {a:"b1"} — another classic concatenation collision.
  assert.notStrictEqual(digest({ ab: 1 }), digest({ a: 'b1' }));
  // nested vs flat
  assert.notStrictEqual(digest({ a: { b: 1 } }), digest({ 'a.b': 1 }));
});

// ── recordDigest over an explicit field list ──────────────────────────────
t('recordDigest ignores fields outside the list', () => {
  const row = { id: 'x', content: 'settled', updated_at: new Date() };
  eq(recordDigest(row, ['id', 'content']),
     recordDigest({ ...row, updated_at: new Date(0), extra: 'noise' }, ['id', 'content']));
});
t('recordDigest detects a change inside the list', () => {
  assert.notStrictEqual(
    recordDigest({ id: 'x', content: 'settled' }, ['id', 'content']),
    recordDigest({ id: 'x', content: 'agitated' }, ['id', 'content']));
});
t('recordDigest treats a missing listed field as null', () => {
  eq(recordDigest({ id: 'x' }, ['id', 'content']),
     recordDigest({ id: 'x', content: null }, ['id', 'content']));
});

// ── hashPair ──────────────────────────────────────────────────────────────
t('hashPair is order sensitive', () => {
  const a = digest('a'), b = digest('b');
  assert.notStrictEqual(hashPair(a, b), hashPair(b, a));
});
t('hashPair hashes bytes, not hex text', () => {
  const a = digest('a'), b = digest('b');
  const expected = createHash('sha256')
    .update(Buffer.from(a, 'hex')).update(Buffer.from(b, 'hex')).digest('hex');
  eq(hashPair(a, b), expected);
});
t('ZERO_HASH is 64 hex characters', () => {
  eq(ZERO_HASH.length, 64);
  assert.ok(/^0+$/.test(ZERO_HASH));
});
t('digest output is 64 hex characters', () => {
  assert.ok(/^[0-9a-f]{64}$/.test(digest({ a: 1 })));
});

// ── Determinism across repeated runs ──────────────────────────────────────
t('the same input hashes the same 1000 times', () => {
  const row = { content: 'Assisted with a wash. Ate 75% of lunch.', temp: '36.8', at: new Date('2026-03-01T12:00:00Z') };
  const first = digest(row);
  for (let i = 0; i < 1000; i++) eq(digest(row), first);
});

console.log(`\ncanonical: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
