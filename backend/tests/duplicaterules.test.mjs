import assert from 'node:assert';
const { duplicateKind, duplicateWindowMinutes, isLikelyDuplicate, describeDuplicate, MAX_WINDOW_MINUTES } = await import('./duplicaterules.impl.mjs');
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; } catch (e) { fail++; console.error(`FAIL  ${n}\n      ${e.message}`); } };

t('a drink and a meal are different kinds of care', () => {
  assert.strictEqual(duplicateKind({ noteType: 'nutrition', fluidIntakeMl: 200 }), 'nutrition:drink');
  assert.strictEqual(duplicateKind({ noteType: 'nutrition', foodEatenPercent: 75 }), 'nutrition:meal');
  assert.strictEqual(duplicateKind({ noteType: 'nutrition', foodEatenPercent: 75, fluidIntakeMl: 150 }), 'nutrition:meal');
  assert.ok(!isLikelyDuplicate({ noteType: 'nutrition', fluidIntakeMl: 200 }, { noteType: 'nutrition', foodEatenPercent: 50 }, 2));
});
t('personal care twice within 20 minutes is probably the same care; at 21 it is not', () => {
  const pc = { noteType: 'personal_care' };
  assert.ok(isLikelyDuplicate(pc, pc, 0));
  assert.ok(isLikelyDuplicate(pc, pc, 20));
  assert.ok(!isLikelyDuplicate(pc, pc, 21));
  assert.ok(isLikelyDuplicate(pc, pc, -15), 'an offline note made before the existing one still counts');
});
t('observations, behaviour, incidents and medicine notes repeat legitimately: 5-minute window', () => {
  for (const k of ['nursing_observation', 'behaviour', 'incident_note', 'medication_note']) assert.strictEqual(duplicateWindowMinutes(k), 5, k);
  assert.ok(!isLikelyDuplicate({ noteType: 'behaviour' }, { noteType: 'behaviour' }, 6));
});
t('two drinks are the same drink only if the amount matches, within 10 minutes', () => {
  const d = ml => ({ noteType: 'nutrition', fluidIntakeMl: ml });
  assert.ok(isLikelyDuplicate(d(200), d(200), 3));
  assert.ok(!isLikelyDuplicate(d(200), d(150), 3), 'different cups are different drinks');
  assert.ok(!isLikelyDuplicate(d(200), d(200), 11));
});
t('different note types never match', () => {
  assert.ok(!isLikelyDuplicate({ noteType: 'continence' }, { noteType: 'personal_care' }, 1));
});
t('the candidate window covers the widest rule', () => {
  for (const k of ['personal_care', 'nutrition:drink', 'nutrition:meal', 'behaviour']) assert.ok(duplicateWindowMinutes(k) <= MAX_WINDOW_MINUTES);
});
t('the message says who and when', () => {
  assert.match(describeDuplicate({ authorName: 'Ana Silva', byMe: false, minutesAgo: 4.2, noteType: 'personal_care' }), /^Ana Silva already recorded a personal care note .* 4 minutes ago/);
  assert.match(describeDuplicate({ authorName: 'x', byMe: true, minutesAgo: 0.3, noteType: 'sleep' }), /^You .* less than a minute ago/);
});
console.log(`\nduplicate rules: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
