// Tests for the Merkle tree. Run via tests/run.mjs.
import assert from 'node:assert';
import { createHash } from 'node:crypto';
const { merkleRoot, inclusionProof, verifyInclusion, leafHash, EMPTY_ROOT, timingSafeEqualHex }
  = await import('./merkle.impl.mjs');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}
const h = n => createHash('sha256').update(String(n)).digest('hex');
const many = n => Array.from({ length: n }, (_, i) => h(i));

t('an empty day still has a root', () => {
  assert.strictEqual(merkleRoot([]), EMPTY_ROOT);
  assert.ok(/^[0-9a-f]{64}$/.test(EMPTY_ROOT));
});
t('a single entry roots to its leaf hash', () => {
  assert.strictEqual(merkleRoot([h(1)]), leafHash(h(1)));
});
t('the root changes if any entry changes', () => {
  const a = many(9);
  for (let i = 0; i < a.length; i++) {
    const b = [...a]; b[i] = h('changed');
    assert.notStrictEqual(merkleRoot(a), merkleRoot(b), `entry ${i} did not affect the root`);
  }
});
t('the root changes if entries are reordered', () => {
  const a = many(5);
  const b = [a[1], a[0], ...a.slice(2)];
  assert.notStrictEqual(merkleRoot(a), merkleRoot(b));
});
t('the root changes if an entry is removed', () => {
  const a = many(6);
  assert.notStrictEqual(merkleRoot(a), merkleRoot(a.slice(0, 5)));
});
t('the root changes if an entry is added', () => {
  const a = many(6);
  assert.notStrictEqual(merkleRoot(a), merkleRoot([...a, h('extra')]));
});

// Every size from 1..64 — odd sizes are where promotion logic goes wrong.
t('every entry in every tree size 1..64 proves', () => {
  for (let n = 1; n <= 64; n++) {
    const entries = many(n);
    const root = merkleRoot(entries);
    for (let i = 0; i < n; i++) {
      const proof = inclusionProof(entries, i);
      assert.ok(verifyInclusion(entries[i], proof, root),
        `size ${n}, index ${i} failed to verify`);
    }
  }
});
t('a proof is logarithmic, not the whole day', () => {
  const entries = many(1000);
  const proof = inclusionProof(entries, 500);
  assert.ok(proof.length <= 10, `proof was ${proof.length} steps for 1000 entries`);
  // The privacy claim: a proof reveals far fewer hashes than there are records.
  assert.ok(proof.length < entries.length / 50);
});
t('a proof for one record does not verify another record', () => {
  const entries = many(16);
  const root = merkleRoot(entries);
  const proof = inclusionProof(entries, 3);
  assert.ok(verifyInclusion(entries[3], proof, root));
  assert.ok(!verifyInclusion(entries[4], proof, root),
    'a proof must not verify a record it was not made for');
});
t('a record not in the tree cannot be proved', () => {
  const entries = many(16);
  const root = merkleRoot(entries);
  const proof = inclusionProof(entries, 3);
  assert.ok(!verifyInclusion(h('never recorded'), proof, root));
});
t('a tampered proof step fails', () => {
  const entries = many(16);
  const root = merkleRoot(entries);
  for (let s = 0; s < 4; s++) {
    const proof = inclusionProof(entries, 5);
    proof[s] = { ...proof[s], hash: h('forged') };
    assert.ok(!verifyInclusion(entries[5], proof, root), `step ${s} tamper not caught`);
  }
});
t('a flipped proof side fails', () => {
  const entries = many(8);
  const root = merkleRoot(entries);
  const proof = inclusionProof(entries, 2);
  proof[0] = { ...proof[0], side: proof[0].side === 'left' ? 'right' : 'left' };
  assert.ok(!verifyInclusion(entries[2], proof, root));
});
t('an out of range index is refused', () => {
  assert.throws(() => inclusionProof(many(4), 4), /outside/);
  assert.throws(() => inclusionProof(many(4), -1), /outside/);
});

// ── The two classic Merkle attacks ────────────────────────────────────────
t('an internal node cannot be passed off as a leaf (second preimage)', () => {
  // Without 0x00/0x01 domain separation, the hash of an internal node could be
  // presented as a leaf and a proof forged for a record never anchored.
  const entries = many(4);
  const root = merkleRoot(entries);
  // Reconstruct what the first internal node would be under a naive scheme.
  const naiveInternal = createHash('sha256')
    .update(Buffer.from(leafHash(entries[0]), 'hex'))
    .update(Buffer.from(leafHash(entries[1]), 'hex'))
    .digest('hex');
  const proof = inclusionProof(entries, 0);
  assert.ok(!verifyInclusion(naiveInternal, proof, root));
  // And the domain prefixes must actually differ.
  assert.notStrictEqual(
    leafHash(entries[0]),
    createHash('sha256').update(Buffer.from(entries[0], 'hex')).digest('hex'));
});
t('duplicating the last entry does not forge the same root (CVE-2012-2459)', () => {
  // A tree that duplicates an odd trailing node lets [a,b,c] and [a,b,c,c]
  // share a root, so someone could claim an extra record was anchored.
  const three = many(3);
  const four = [...three, three[2]];
  assert.notStrictEqual(merkleRoot(three), merkleRoot(four),
    'odd-node promotion must not collide with duplication');
});

t('hex comparison is length safe', () => {
  assert.ok(timingSafeEqualHex('abcd', 'abcd'));
  assert.ok(!timingSafeEqualHex('abcd', 'abce'));
  assert.ok(!timingSafeEqualHex('abcd', 'abcde'));
});
t('roots are deterministic', () => {
  const e = many(37);
  const first = merkleRoot(e);
  for (let i = 0; i < 200; i++) assert.strictEqual(merkleRoot(e), first);
});

console.log(`\nmerkle: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
