// Tests for records kept on the phone while offline.
import assert from 'node:assert';
const Q = await import('./offlinequeue.impl.mjs');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); } };
const item = (id, extra = {}) => ({ id, userId: 'u1', method: 'post', url: '/care-notes', body: {}, clientRecordedAt: new Date().toISOString(), label: id, ...extra });
const build = (...items) => items.reduce((l, i) => Q.enqueue(l, i), []);

t('records are sent in the order they were made', () => {
  let l = build(item('a'), item('b'), item('c'));
  const order = [];
  for (let x; (x = Q.nextToSend(l, 'u1')); ) { order.push(x.id); l = Q.applyResult(l, x.id, { kind: 'sent' }); }
  assert.deepStrictEqual(order, ['a', 'b', 'c']);
  assert.strictEqual(l.length, 0);
});
t('a dropped connection keeps the record, at the front, and counts the attempt', () => {
  let l = build(item('a'), item('b'));
  l = Q.applyResult(l, 'a', Q.classify(undefined));
  assert.strictEqual(Q.nextToSend(l, 'u1').id, 'a');
  assert.strictEqual(l[0].attempts, 1);
});
t('server down (5xx), timeouts and rate limits are retried, not refused', () => {
  for (const s of [500, 502, 503, 504, 408, 429, 0]) assert.strictEqual(Q.classify(s).kind, 'retry', String(s));
});
t('signed out mid-way (401) is kept for after sign-in, not thrown away', () => {
  assert.strictEqual(Q.classify(401).kind, 'retry');
});
t('a refusal is shown, not retried for ever, and not silently dropped', () => {
  let l = build(item('a'), item('b'));
  l = Q.applyResult(l, 'a', Q.classify(400, { error: 'Content is required' }));
  assert.strictEqual(l.find(x => x.id === 'a').state, 'failed');
  assert.strictEqual(l.find(x => x.id === 'a').error, 'Content is required');
  assert.strictEqual(Q.nextToSend(l, 'u1').id, 'b', 'independent records still go');
  assert.deepStrictEqual(Q.summary(l, 'u1'), { waiting: 1, failed: 1, others: 0 });
});
t('if the note is refused, the task it completes is held back too', () => {
  let l = build(item('note'), item('task', { url: '/tasks/T1/complete', dependsOn: 'note' }), item('other'));
  l = Q.applyResult(l, 'note', Q.classify(422, { error: 'nope' }));
  assert.strictEqual(l.find(x => x.id === 'task').state, 'failed');
  assert.strictEqual(Q.nextToSend(l, 'u1').id, 'other');
});
t('"send anyway" puts it and what depended on it back, with the extra flag', () => {
  let l = build(item('note'), item('task', { dependsOn: 'note' }));
  l = Q.applyResult(l, 'note', Q.classify(409, { conflict: 'possible_duplicate', error: 'Maybe a duplicate' }));
  l = Q.retryFailed(l, 'note', { confirmDuplicate: true });
  assert.strictEqual(l.find(x => x.id === 'note').state, 'waiting');
  assert.strictEqual(l.find(x => x.id === 'note').body.confirmDuplicate, true);
  assert.strictEqual(l.find(x => x.id === 'task').state, 'waiting');
});
t('discarding a note discards the task completion that depended on it', () => {
  let l = build(item('note'), item('task', { dependsOn: 'note' }), item('x'));
  l = Q.discard(l, 'note');
  assert.deepStrictEqual(l.map(x => x.id), ['x']);
});
t('already recorded by someone else: dropped, with the reason', () => {
  const r = Q.classify(409, { conflict: 'already_completed', error: 'Done by Sam at 10:02' });
  assert.strictEqual(r.kind, 'already');
  assert.match(r.message, /Sam/);
  assert.strictEqual(Q.applyResult(build(item('a')), 'a', r).length, 0);
});
t('records are only ever sent as the person who made them', () => {
  const l = build(item('a', { userId: 'someone-else' }), item('b'));
  assert.strictEqual(Q.nextToSend(l, 'u1').id, 'b');
  assert.strictEqual(Q.nextToSend(l, 'nobody'), null);
  assert.strictEqual(Q.summary(l, 'u1').others, 1);
});
t('the same record queued twice is kept once', () => {
  assert.strictEqual(Q.enqueue(build(item('a')), item('a')).length, 1);
});
t('tasks done offline are not offered again in the round', () => {
  const l = build(item('n'), item('c', { url: '/tasks/abc-1/complete' }), item('d', { url: '/tasks/abc-2/defer' }), item('z', { url: '/tasks/abc-3/complete', userId: 'u2' }));
  assert.deepStrictEqual([...Q.pendingTaskIds(l, 'u1')].sort(), ['abc-1', 'abc-2']);
});
t('records older than 72 hours are found, to be written as late entries instead', () => {
  const now = new Date();
  const old = item('old', { clientRecordedAt: new Date(now.getTime() - 73 * 3600_000).toISOString() });
  assert.deepStrictEqual(Q.stale(build(old, item('new')), now).map(x => x.id), ['old']);
});
t('v89b: a task someone else finished, with our note attached, is kept to send anyway — never dropped', () => {
  const r = Q.classify(409, { conflict: 'already_completed', hadNote: true, error: 'Ana already completed it' });
  assert.strictEqual(r.kind, 'refused'); assert.strictEqual(r.conflict, 'already_completed');
  let l = Q.enqueue([], { id: 'a', userId: 'u', method: 'post', url: '/tasks/1/complete', body: {}, clientRecordedAt: new Date().toISOString(), label: 'x' });
  l = Q.applyResult(l, 'a', r);
  assert.strictEqual(l[0].state, 'failed'); assert.strictEqual(l[0].conflict, 'already_completed');
  l = Q.retryFailed(l, 'a', { confirmDuplicate: true });
  assert.strictEqual(l[0].state, 'waiting'); assert.strictEqual(l[0].body.confirmDuplicate, true);
});
t('v89b: a possible duplicate keeps its conflict, so the screen can offer "send anyway"', () => {
  let l = Q.enqueue([], { id: 'n', userId: 'u', method: 'post', url: '/care-notes', body: {}, clientRecordedAt: new Date().toISOString(), label: 'x' });
  l = Q.applyResult(l, 'n', Q.classify(409, { conflict: 'possible_duplicate', error: 'Ana already recorded a personal care note' }));
  assert.strictEqual(l[0].conflict, 'possible_duplicate');
});
console.log(`\noffline queue: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
