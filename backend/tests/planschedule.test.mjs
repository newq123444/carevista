import assert from 'node:assert';
const { scheduleTaskShape, everyNHours } = await import('./planschedule.impl.mjs');
let pass = 0, fail = 0;
const t = (n, f) => { try { f(); pass++; } catch (e) { fail++; console.error(`FAIL  ${n}\n      ${e.message}`); } };
t('a skin-care item becomes a repositioning task on the day shift', () => {
  const s = scheduleTaskShape({ domain: 'skin_integrity', time: '14:00', what: 'reposition, slide sheet, 2 carers' });
  assert.strictEqual(s.noteType, 'repositioning'); assert.strictEqual(s.shift, 'day'); assert.strictEqual(s.dueTime, '14:00');
  assert.strictEqual(s.name, 'Reposition, slide sheet, 2 carers'); assert.strictEqual(s.frequency, 'daily');
});
t('22:00 and 06:30 are night shift; 07:00 and 19:59 are day', () => {
  const sh = x => scheduleTaskShape({ domain: 'night_care', time: x, what: 'Check' }).shift;
  assert.deepStrictEqual(['22:00', '06:30', '07:00', '19:59', '20:00'].map(sh), ['night', 'night', 'day', 'day', 'night']);
});
t('medicines are refused — they belong on the MAR chart', () => {
  assert.match(scheduleTaskShape({ domain: 'medication', time: '08:00', what: 'Give paracetamol' }).error, /MAR/);
});
t('bad times and empty instructions are refused', () => {
  assert.ok(scheduleTaskShape({ domain: 'pain', time: '25:00', what: 'Abbey score' }).error);
  assert.ok(scheduleTaskShape({ domain: 'pain', time: '8am', what: 'Abbey score' }).error);
  assert.ok(scheduleTaskShape({ domain: 'pain', time: '08:00', what: '  ' }).error);
});
t('a weekly item keeps its day', () => {
  const s = scheduleTaskShape({ domain: 'personal_care', time: '10:00', what: 'Bath', dayOfWeek: 3 });
  assert.strictEqual(s.frequency, 'weekly'); assert.strictEqual(s.dayOfWeek, 3);
});
t('every 3 hours from 08:00 to 20:00', () => assert.deepStrictEqual(everyNHours('08:00', '20:00', 3), ['08:00', '11:00', '14:00', '17:00', '20:00']));
t('a night regime wraps past midnight', () => assert.deepStrictEqual(everyNHours('22:00', '06:00', 4), ['22:00', '02:00', '06:00']));
t('nonsense intervals give nothing rather than 1,440 tasks', () => assert.deepStrictEqual(everyNHours('08:00', '20:00', 0), []));
console.log(`\nplan schedule: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
