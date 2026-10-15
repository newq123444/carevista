import assert from 'node:assert';
const { matchingTask } = await import('./recordmatch.impl.mjs');
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; } catch (e) { fail++; console.error(`FAIL  ${n}\n      ${e.message}`); } };
const task = (id, o = {}) => ({ id, resident_id: 'r1', status: 'due', task_name: 'Morning Personal Care', note_type: 'personal_care', handled_in: 'care_note', ...o });
t('personal care recorded from the resident ticks off their personal-care task', () => {
  assert.strictEqual(matchingTask([task('a')], 'r1', 'personal_care').id, 'a');
});
t('never another resident\'s task', () => assert.strictEqual(matchingTask([task('a', { resident_id: 'r2' })], 'r1', 'personal_care'), null));
t('never a task already done, deferred or not applicable', () => {
  for (const status of ['done', 'deferred', 'na']) assert.strictEqual(matchingTask([task('a', { status })], 'r1', 'personal_care'), null);
});
t('never a medicines task (signed on the MAR)', () => assert.strictEqual(matchingTask([task('a', { handled_in: 'emar', note_type: null })], 'r1', 'personal_care'), null));
t('a drink closes the drinks round, not lunch', () => {
  const tasks = [task('lunch', { task_name: 'Lunch', note_type: 'nutrition' }), task('drink', { task_name: 'Fluid & Snack Check', note_type: 'nutrition' })];
  assert.strictEqual(matchingTask(tasks, 'r1', 'fluids').id, 'drink');
  assert.strictEqual(matchingTask(tasks, 'r1', 'nutrition').id, 'lunch');
});
t('the earliest (overdue) one is closed first', () => {
  assert.strictEqual(matchingTask([task('early', { status: 'overdue' }), task('now')], 'r1', 'personal_care').id, 'early');
});
t('no matching care → nothing ticked', () => assert.strictEqual(matchingTask([task('a')], 'r1', 'sleep'), null));
console.log(`\nrecord match: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
