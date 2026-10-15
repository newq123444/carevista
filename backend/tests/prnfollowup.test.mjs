import assert from 'node:assert';
const { prnState, prnStateText, sortFollowups } = await import('./prnfollowup.impl.mjs');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); } };
const NOW = new Date(2026, 9, 11, 15, 0);
const ago = m => new Date(NOW.getTime() - m * 60000).toISOString();

t('within the hour it is waiting, and says when to check', () => {
  assert.strictEqual(prnState(ago(25), NOW).state, 'waiting');
  assert.strictEqual(prnStateText(ago(25), NOW), 'Check from 15:35');
});
t('from one hour it is due', () => {
  assert.strictEqual(prnState(ago(60), NOW).state, 'due');
  assert.strictEqual(prnStateText(ago(90), NOW), 'Check now');
});
t('from two hours it is late, and says how late', () => {
  assert.strictEqual(prnState(ago(120), NOW).state, 'late');
  assert.strictEqual(prnStateText(ago(185), NOW), 'Late — given 3 hours ago');
  assert.strictEqual(prnStateText(ago(125), NOW), 'Late — given 2 hours ago');
});
t('late ones come first, then due, then waiting', () => {
  const rows = [{ id: 'w', created_at: ago(10) }, { id: 'd', created_at: ago(70) }, { id: 'l', created_at: ago(200) }];
  assert.deepStrictEqual(sortFollowups(rows, NOW).map(r => r.id), ['l', 'd', 'w']);
});
t('a dose recorded with a clock slightly ahead never shows negative minutes', () => {
  const s = prnState(new Date(NOW.getTime() + 120000).toISOString(), NOW);
  assert.strictEqual(s.minutesSinceDose, 0);
  assert.strictEqual(s.state, 'waiting');
});
console.log(`\nprn follow-up: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
