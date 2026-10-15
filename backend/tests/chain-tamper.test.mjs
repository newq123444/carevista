// End-to-end tamper detection, against a fake database.
//
// The whole product claim is "if a record changes, we can tell". A test suite
// that never actually tampers with anything has not tested that claim.
import assert from 'node:assert';
const { canonicalise, digest, hashPair, recordDigest, ZERO_HASH } = await import('./canonical.impl.mjs');
const { merkleRoot, inclusionProof, verifyInclusion } = await import('./merkle.impl.mjs');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}

// ── A miniature of the real chain, using the same primitives the app uses ──
const FIELDS = ['id', 'resident_id', 'author_id', 'content',
                { name: 'created_at', type: 'time' }];

function makeHome() {
  return { records: new Map(), chain: [] };
}
function append(home, row) {
  home.records.set(row.id, { ...row });
  const entryHash = recordDigest(row, FIELDS);
  const prev = home.chain.length ? home.chain[home.chain.length - 1].chainHash : ZERO_HASH;
  home.chain.push({
    seq: home.chain.length + 1, entityId: row.id,
    entryHash, prevHash: prev, chainHash: hashPair(prev, entryHash),
  });
}
/** The same replay verifyChain() performs, in miniature. */
function verify(home) {
  const breaks = [];
  let expectedPrev = null;
  const latest = new Map();
  for (const e of home.chain) latest.set(e.entityId, e.seq);

  for (const e of home.chain) {
    if (expectedPrev !== null && e.prevHash !== expectedPrev) {
      breaks.push({ seq: e.seq, problem: 'chain_broken' });
    }
    if (e.chainHash !== hashPair(e.prevHash, e.entryHash)) {
      breaks.push({ seq: e.seq, problem: 'chain_broken' });
    }
    expectedPrev = e.chainHash;

    if (latest.get(e.entityId) !== e.seq) continue;   // superseded version
    const live = home.records.get(e.entityId);
    if (!live) { breaks.push({ seq: e.seq, problem: 'record_missing' }); continue; }
    if (recordDigest(live, FIELDS) !== e.entryHash) {
      breaks.push({ seq: e.seq, problem: 'record_altered' });
    }
  }
  return breaks;
}

const note = (i, content = 'Assisted with a wash.') => ({
  id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
  resident_id: `res-${i % 5}`, author_id: 'carer-1', content,
  created_at: new Date(2026, 2, 1, 8 + (i % 10), 0, 0),
});

function seeded(n = 20) {
  const home = makeHome();
  for (let i = 1; i <= n; i++) append(home, note(i));
  return home;
}

// ── Baseline ──────────────────────────────────────────────────────────────
t('an untouched chain verifies clean', () => {
  assert.deepStrictEqual(verify(seeded()), []);
});

// ── The attacks ───────────────────────────────────────────────────────────
t('editing a note is detected', () => {
  const home = seeded();
  const target = home.records.get(note(7).id);
  target.content = 'Resident refused all care.';
  const breaks = verify(home);
  assert.strictEqual(breaks.length, 1);
  assert.strictEqual(breaks[0].problem, 'record_altered');
  assert.strictEqual(breaks[0].seq, 7);
});
t('a one-character edit is detected', () => {
  const home = seeded();
  home.records.get(note(3).id).content = 'Assisted with a wash!';
  assert.strictEqual(verify(home).filter(b => b.problem === 'record_altered').length, 1);
});
t('changing WHO gave the care is detected', () => {
  const home = seeded();
  home.records.get(note(5).id).author_id = 'carer-2';
  assert.strictEqual(verify(home)[0].problem, 'record_altered');
});
t('back-dating a record is detected', () => {
  const home = seeded();
  home.records.get(note(9).id).created_at = new Date(2026, 2, 1, 2, 0, 0);
  assert.strictEqual(verify(home)[0].problem, 'record_altered');
});
t('deleting a record is detected', () => {
  const home = seeded();
  home.records.delete(note(11).id);
  const breaks = verify(home);
  assert.strictEqual(breaks.length, 1);
  assert.strictEqual(breaks[0].problem, 'record_missing');
});
t('deleting the chain entry too still breaks the chain', () => {
  // The obvious next move: remove the evidence as well.
  const home = seeded();
  home.records.delete(note(11).id);
  home.chain = home.chain.filter(e => e.entityId !== note(11).id);
  const breaks = verify(home);
  assert.ok(breaks.length > 0, 'removing the link must not produce a clean chain');
  assert.strictEqual(breaks[0].problem, 'chain_broken');
});
t('editing a record AND its chain entry still breaks everything after it', () => {
  // A more determined attacker recomputes the one entry they touched.
  const home = seeded();
  const target = home.records.get(note(6).id);
  target.content = 'Everything was fine.';
  const e = home.chain[5];
  e.entryHash = recordDigest(target, FIELDS);
  e.chainHash = hashPair(e.prevHash, e.entryHash);
  const breaks = verify(home);
  assert.ok(breaks.length > 0, 'the following entries must no longer line up');
  assert.strictEqual(breaks[0].problem, 'chain_broken');
  assert.strictEqual(breaks[0].seq, 7, 'the break should surface at the next entry');
});
t('rewriting the WHOLE chain forward is NOT detected without an external seal', () => {
  // This is the limit the threat model states plainly. Someone with full write
  // access can recompute everything. The defence is a seal published somewhere
  // they do not control — which is why the UI refuses to claim otherwise while
  // sealing is local only.
  const home = seeded();
  home.records.get(note(4).id).content = 'Everything was fine.';
  let prev = ZERO_HASH;
  for (const e of home.chain) {
    e.entryHash = recordDigest(home.records.get(e.entityId), FIELDS);
    e.prevHash = prev;
    e.chainHash = hashPair(prev, e.entryHash);
    prev = e.chainHash;
  }
  assert.deepStrictEqual(verify(home), [],
    'documented limitation: a full rewrite verifies clean without external anchoring');
});
t('but a published seal catches exactly that rewrite', () => {
  const home = seeded();
  // Yesterday's root, as published to a third party.
  const publishedRoot = merkleRoot(home.chain.map(e => e.entryHash));

  home.records.get(note(4).id).content = 'Everything was fine.';
  let prev = ZERO_HASH;
  for (const e of home.chain) {
    e.entryHash = recordDigest(home.records.get(e.entityId), FIELDS);
    e.prevHash = prev;
    e.chainHash = hashPair(prev, e.entryHash);
    prev = e.chainHash;
  }
  assert.deepStrictEqual(verify(home), [], 'internally consistent, as above');
  assert.notStrictEqual(merkleRoot(home.chain.map(e => e.entryHash)), publishedRoot,
    'the recomputed root must not match the one already published');
});
t('reordering entries is detected', () => {
  const home = seeded();
  [home.chain[2], home.chain[3]] = [home.chain[3], home.chain[2]];
  assert.ok(verify(home).some(b => b.problem === 'chain_broken'));
});
t('inserting a fabricated record is detected', () => {
  const home = seeded();
  const fake = note(999, 'Medication given at 22:00.');
  home.records.set(fake.id, fake);
  const eh = recordDigest(fake, FIELDS);
  home.chain.splice(10, 0, { seq: 10.5, entityId: fake.id, entryHash: eh,
                             prevHash: home.chain[9].chainHash,
                             chainHash: hashPair(home.chain[9].chainHash, eh) });
  assert.ok(verify(home).some(b => b.problem === 'chain_broken'),
    'an inserted entry must not slot in unnoticed');
});

// ── Legitimate activity must NOT be flagged ───────────────────────────────
t('a legitimate amendment does NOT look like tampering', () => {
  // The failure that would sink the whole feature: flagging honest corrections.
  const home = seeded();
  const id = note(8).id;
  const amended = { ...home.records.get(id), content: 'Assisted with a wash. Correction: shower, not bath.' };
  append(home, amended);
  assert.deepStrictEqual(verify(home), [],
    'an amendment appends a new entry and must verify clean');
});
t('the superseded version stays in the history', () => {
  const home = seeded();
  const id = note(8).id;
  const before = home.chain.filter(e => e.entityId === id).length;
  append(home, { ...home.records.get(id), content: 'Corrected.' });
  const after = home.chain.filter(e => e.entityId === id).length;
  assert.strictEqual(after, before + 1, 'the earlier version must not be overwritten');
});
t('many amendments in a row still verify', () => {
  const home = seeded();
  const id = note(2).id;
  for (let i = 0; i < 5; i++) append(home, { ...home.records.get(id), content: `Revision ${i}` });
  assert.deepStrictEqual(verify(home), []);
});

// ── Proofs over the sealed day ────────────────────────────────────────────
t('one record can be proved without revealing the others', () => {
  const home = seeded(30);
  const hashes = home.chain.map(e => e.entryHash);
  const root = merkleRoot(hashes);
  const proof = inclusionProof(hashes, 12);
  assert.ok(verifyInclusion(hashes[12], proof, root));
  assert.ok(proof.length <= 5, 'a proof should reveal a handful of hashes, not 30 records');
});
t('a proof fails once the record is altered', () => {
  const home = seeded(30);
  const hashes = home.chain.map(e => e.entryHash);
  const root = merkleRoot(hashes);
  const proof = inclusionProof(hashes, 12);
  const altered = { ...home.records.get(home.chain[12].entityId), content: 'Changed.' };
  assert.ok(!verifyInclusion(recordDigest(altered, FIELDS), proof, root));
});

t('a busy home of 5000 records verifies in reasonable time', () => {
  const home = seeded(5000);
  const start = Date.now();
  const breaks = verify(home);
  const ms = Date.now() - start;
  assert.deepStrictEqual(breaks, []);
  assert.ok(ms < 8000, `took ${ms}ms`);
});

console.log(`\nchain tamper: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
