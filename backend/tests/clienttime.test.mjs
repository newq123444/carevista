import assert from 'node:assert';
import { readFileSync } from 'node:fs';
const { clientRecordedAt, clientRef } = await import('./clienttime.impl.mjs');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); } };
const NOW = new Date('2026-10-11T12:00:00Z');
const at = mins => new Date(NOW.getTime() + mins * 60000).toISOString();

t('not sent → null (an ordinary online record)', () => {
  assert.strictEqual(clientRecordedAt(undefined, NOW), null);
  assert.strictEqual(clientRecordedAt('', NOW), null);
});
t('a record made 40 minutes ago with no signal is accepted as made then', () => {
  assert.strictEqual(clientRecordedAt(at(-40), NOW).toISOString(), at(-40));
});
t('up to 5 minutes ahead is clock drift, and accepted', () => {
  assert.ok(clientRecordedAt(at(4), NOW));
});
t('more than 5 minutes ahead is refused, with a reason a carer can act on', () => {
  assert.throws(() => clientRecordedAt(at(6), NOW), /clock is ahead/);
});
t('older than 72 hours is refused: write it as a late entry', () => {
  assert.ok(clientRecordedAt(at(-71 * 60), NOW));
  assert.throws(() => clientRecordedAt(at(-73 * 60), NOW), /late entry/);
});
t('nonsense is refused', () => {
  assert.throws(() => clientRecordedAt('yesterday-ish', NOW), /not a valid time/);
});
t('the bounds match the database constraint in migration 038', () => {
  const sql = readFileSync(new URL('../migrations/038_offline_capture.sql', import.meta.url), 'utf8');
  assert.match(sql, /INTERVAL '5 minutes'/);
  assert.match(sql, /INTERVAL '72 hours'/);
});
t('clientRef: only a real UUID is used', () => {
  assert.strictEqual(clientRef('3f2b8c1e-9d4a-4c7b-8e2f-1a2b3c4d5e6f'), '3f2b8c1e-9d4a-4c7b-8e2f-1a2b3c4d5e6f');
  assert.strictEqual(clientRef("x'; drop table"), null);
  assert.strictEqual(clientRef(42), null);
});
console.log(`\nclient time: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
