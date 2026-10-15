import assert from 'node:assert';
const { compare, SPECS, LIMITS, MIN_DENOMINATOR } = await import('./pilotmetrics.impl.mjs');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); } };
const zero = {
  tasksScheduled: 0, tasksDone: 0, tasksDeferred: 0, tasksTimely: 0, tasksLate: 0, medianDelayMin: null,
  fluidResidentDays: 0, fluidDays4Plus: 0, fluidDaysWithTarget: 0, fluidDaysTargetMet: 0,
  bowelResidentDays: 0, bowelDaysRecorded: 0, mcaCompleted: 0, mcaCurrentAtEnd: 0, mcaOverdueAtEnd: 0,
  prnGiven: 0, prnEffectRecorded: 0, prnEffectWithin2h: 0,
  softSignsRaised: 0, softSignsAcknowledged: 0, softSignsMedianAckMin: null, softSignsClosed: 0,
  residentsAtEnd: 0, residentsWeighed31d: 0,
};
const row = (rows, k) => rows.find(r => r.key === k);

t('timely recording up from 50% to 80% is +30 points, and better', () => {
  const rows = compare({ ...zero, tasksDone: 200, tasksTimely: 100 }, { ...zero, tasksDone: 200, tasksTimely: 160 });
  const r = row(rows, 'task_timely');
  assert.strictEqual(r.baseline.value, 50); assert.strictEqual(r.pilot.value, 80);
  assert.strictEqual(r.change, 30); assert.strictEqual(r.verdict, 'better');
});
t('late recording going UP is reported as worse — never spun', () => {
  const rows = compare({ ...zero, tasksDone: 100, tasksLate: 10 }, { ...zero, tasksDone: 100, tasksLate: 25 });
  assert.strictEqual(row(rows, 'task_late').verdict, 'worse');
});
t('fewer than 20 cases: no percentage, and it says why', () => {
  const rows = compare({ ...zero, prnGiven: 12, prnEffectRecorded: 3 }, { ...zero, prnGiven: 40, prnEffectRecorded: 30 });
  const r = row(rows, 'prn_effect');
  assert.strictEqual(r.baseline.value, null);
  assert.match(r.baseline.note, /only 12/);
  assert.strictEqual(r.verdict, 'unknown');
  assert.strictEqual(r.pilot.value, 75);
});
t('a paper-audit baseline replaces the computed one, and is labelled with its source', () => {
  const rows = compare(null, { ...zero, bowelResidentDays: 300, bowelDaysRecorded: 270 },
    { bowels_recorded: { value: 61.24, source: 'Paper audit, 20 files, March' } });
  const r = row(rows, 'bowels_recorded');
  assert.strictEqual(r.baseline.value, 61.2);
  assert.strictEqual(r.baseline.manual, 'Paper audit, 20 files, March');
  assert.strictEqual(r.change, 28.8);
});
t('no baseline period at all: shown as such, not as zero', () => {
  const r = row(compare(null, { ...zero, tasksScheduled: 50, tasksDone: 45 }), 'task_completion');
  assert.strictEqual(r.baseline.value, null);
  assert.strictEqual(r.baseline.note, 'no baseline period');
});
t('a change of under one point is "same", not a win', () => {
  const r = row(compare({ ...zero, tasksScheduled: 1000, tasksDone: 900 }, { ...zero, tasksScheduled: 1000, tasksDone: 905 }), 'task_completion');
  assert.strictEqual(r.verdict, 'same');
});
t('the numbers behind each percentage are kept, so anyone can check it', () => {
  const r = row(compare(null, { ...zero, fluidResidentDays: 90, fluidDays4Plus: 63 }), 'fluid_4plus');
  assert.strictEqual(r.pilot.numerator, 63); assert.strictEqual(r.pilot.denominator, 90);
});
t('every measure has a definition and a direction', () => {
  for (const s of SPECS) {
    assert.ok(s.definition.length > 40, s.key);
    assert.ok(['higher', 'lower'].includes(s.better), s.key);
  }
});
t('the limits are stated, including that this cannot prove cause', () => {
  assert.ok(LIMITS.some(l => /cannot prove/.test(l)));
  assert.strictEqual(MIN_DENOMINATOR, 20);
});
console.log(`\npilot metrics: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
