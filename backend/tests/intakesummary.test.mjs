// Tests for the fluids / food / bowels board. Every rule here decides whether a
// resident's name turns red on a nurse's phone.
import assert from 'node:assert';
const { summariseDay, expectedByNow, calendarDaysBetween } = await import('./intakesummary.impl.mjs');
const { bowelsFromLabels } = await import('./quickoptions.impl.mjs');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}
const at = (h, m = 0, dayOffset = 0) => new Date(2026, 9, 9 + dayOffset, h, m);
const R = (id, extra = {}) => ({ id, name: `Resident ${id}`, room: id, ...extra });
const drink = (rid, ml, h, m = 0) => ({ residentId: rid, at: at(h, m), fluidMl: ml, foodPct: null, bowelsOpened: null, stoolType: null });
const meal = (rid, pct, h) => ({ residentId: rid, at: at(h), fluidMl: null, foodPct: pct, bowelsOpened: null, stoolType: null });
const bowel = (rid, h, stool = 'normal') => ({ residentId: rid, at: at(h), fluidMl: null, foodPct: null, bowelsOpened: true, stoolType: stool });
const target = (rid, o = {}) => ({ residentId: rid, monitorFluids: true, fluidTargetMl: 1500, fluidMinimumMl: 1000,
  monitorFood: false, foodMinimumPercent: null, monitorBowels: false, bowelAlertDays: 3, ...o });
const run = (o) => summariseDay({ residents: [], todaysNotes: [], targets: [], lastOpened: new Map(), now: at(14), ...o });
const one = (o) => run(o)[0];

// ── Fluid ─────────────────────────────────────────────────────────────────
t('totals add up', () => {
  const d = one({ residents: [R('1')], todaysNotes: [drink('1', 120, 8), drink('1', 200, 10), drink('1', 150, 12)] });
  assert.strictEqual(d.fluid.totalMl, 470);
  assert.strictEqual(d.fluid.entries.length, 3);
});
t('no target is invented for someone not on a fluid chart', () => {
  const d = one({ residents: [R('1')], todaysNotes: [drink('1', 100, 8)] });
  assert.strictEqual(d.fluid.targetMl, null);
  assert.strictEqual(d.fluid.percentOfTarget, null);
  assert.deepStrictEqual(d.concerns, [], 'an unmonitored resident must not be flagged against a made-up target');
});
t('expected-by-now spreads the target across the waking day', () => {
  assert.strictEqual(expectedByNow(1500, at(7)), 0);
  assert.strictEqual(expectedByNow(1500, at(22)), 1500);
  assert.strictEqual(expectedByNow(1500, at(14, 30)), 750);
  assert.strictEqual(expectedByNow(1500, at(3)), 0, 'nobody is behind at 3am');
});
t('well behind is red, behind is amber, on track is clear', () => {
  const now = at(14, 30); // 750 expected
  const lvl = ml => one({ residents: [R('1')], targets: [target('1')], now,
    todaysNotes: ml ? [drink('1', ml, 14)] : [] }).concerns.filter(c => c.area === 'fluid').map(c => c.level);
  assert.ok(lvl(300).includes('red'));
  assert.ok(lvl(500).includes('amber'));
  assert.deepStrictEqual(lvl(700), []);
});
t('a monitored resident with nothing recorded is flagged as not recorded, not as zero', () => {
  const d = one({ residents: [R('1')], targets: [target('1')], now: at(11) });
  assert.strictEqual(d.fluid.recorded, false);
  assert.ok(d.concerns.some(c => /no drinks recorded/.test(c.text)), JSON.stringify(d.concerns));
});
t('a long gap since the last drink is flagged while awake', () => {
  const d = one({ residents: [R('1')], targets: [target('1', { fluidTargetMl: null })], now: at(15),
    todaysNotes: [drink('1', 200, 11)] });
  assert.ok(d.concerns.some(c => /No drink recorded for 4 hours/.test(c.text)), JSON.stringify(d.concerns));
});
t('no "no drink" alarm overnight', () => {
  const d = one({ residents: [R('1')], targets: [target('1', { fluidTargetMl: null })], now: at(2),
    todaysNotes: [] });
  assert.ok(!d.concerns.some(c => c.area === 'fluid'), JSON.stringify(d.concerns));
});

// ── Food ──────────────────────────────────────────────────────────────────
t('eating nothing at two meals is red', () => {
  const d = one({ residents: [R('1')], todaysNotes: [meal('1', 0, 8), meal('1', 0, 12)] });
  assert.ok(d.concerns.some(c => c.area === 'food' && c.level === 'red'));
});
t('two poor meals is amber for anyone', () => {
  const d = one({ residents: [R('1')], todaysNotes: [meal('1', 25, 8), meal('1', 0, 12), meal('1', 100, 17)] });
  assert.ok(d.concerns.some(c => c.area === 'food' && c.level === 'amber'));
  assert.strictEqual(d.food.lowMeals, 2);
});
t('one poor meal on its own is not a concern', () => {
  const d = one({ residents: [R('1')], todaysNotes: [meal('1', 25, 8), meal('1', 75, 12)] });
  assert.ok(!d.concerns.some(c => c.area === 'food'));
  assert.strictEqual(d.food.averagePercent, 50);
});
t('below a clinician-set food minimum is amber', () => {
  const d = one({ residents: [R('1')], targets: [target('1', { monitorFluids: false, monitorFood: true, foodMinimumPercent: 75 })],
    todaysNotes: [meal('1', 50, 8), meal('1', 75, 12)] });
  assert.ok(d.concerns.some(c => c.area === 'food' && /below the 75%/.test(c.text)));
});

// ── Bowels ────────────────────────────────────────────────────────────────
t('three days without opening is red', () => {
  const d = one({ residents: [R('1')], lastOpened: new Map([['1', at(9, 0, -3)]]) });
  assert.strictEqual(d.bowels.daysSince, 3);
  assert.ok(d.concerns.some(c => c.area === 'bowels' && c.level === 'red'));
});
t('two days is amber — check today', () => {
  const d = one({ residents: [R('1')], lastOpened: new Map([['1', at(20, 0, -2)]]) });
  assert.strictEqual(d.bowels.daysSince, 2);
  assert.ok(d.concerns.some(c => c.area === 'bowels' && c.level === 'amber' && /check today/.test(c.text)));
});
t('opened today clears it, whatever the history says', () => {
  const d = one({ residents: [R('1')], todaysNotes: [bowel('1', 9)], lastOpened: new Map([['1', at(9, 0, -5)]]) });
  assert.strictEqual(d.bowels.daysSince, 0);
  assert.ok(!d.concerns.some(c => c.area === 'bowels'));
});
t('days are calendar days, not 24-hour blocks', () => {
  // 23:00 yesterday to 09:00 today is one day, not zero.
  assert.strictEqual(calendarDaysBetween(at(23, 0, -1), at(9)), 1);
});
t('the alert threshold follows the resident\'s chart', () => {
  const d = one({ residents: [R('1')], targets: [target('1', { monitorFluids: false, bowelAlertDays: 2 })],
    lastOpened: new Map([['1', at(9, 0, -2)]]) });
  assert.ok(d.concerns.some(c => c.area === 'bowels' && c.level === 'red'));
});
t('three loose stools is red with an infection-control prompt', () => {
  const d = one({ residents: [R('1')], todaysNotes: [bowel('1', 8, 'loose'), bowel('1', 11, 'loose'), bowel('1', 13, 'loose')] });
  assert.ok(d.concerns.some(c => c.level === 'red' && /infection control/.test(c.text)));
});
t('no bowel record at all is only flagged if they are on a bowel chart', () => {
  assert.ok(!one({ residents: [R('1')] }).concerns.some(c => c.area === 'bowels'));
  const d = one({ residents: [R('1')], targets: [target('1', { monitorFluids: false, monitorBowels: true })] });
  assert.ok(d.concerns.some(c => c.area === 'bowels' && /no bowel record/.test(c.text)));
});

// ── Away, ordering ────────────────────────────────────────────────────────
t('someone in hospital is never flagged', () => {
  const d = one({ residents: [R('1', { away: 'hospital' })], targets: [target('1', { monitorBowels: true })],
    lastOpened: new Map([['1', at(9, 0, -6)]]) });
  assert.deepStrictEqual(d.concerns, []);
  assert.strictEqual(d.away, 'hospital');
});
t('most worrying residents come first', () => {
  const out = run({
    residents: [R('1'), R('2'), R('3')],
    targets: [target('3')],
    todaysNotes: [meal('2', 0, 8), meal('2', 0, 12)],
    lastOpened: new Map([['3', at(9, 0, -4)]]),
    now: at(14, 30),
  });
  assert.deepStrictEqual(out.map(d => d.residentId), ['3', '2', '1']);
});
t('rooms sort numerically, not alphabetically', () => {
  const out = run({ residents: [R('10'), R('2'), R('1')] });
  assert.deepStrictEqual(out.map(d => d.room), ['1', '2', '10']);
});
t('every concern explains itself', () => {
  const out = run({
    residents: [R('1')], targets: [target('1', { monitorBowels: true })],
    todaysNotes: [meal('1', 0, 8), meal('1', 0, 12)], now: at(15),
  });
  for (const c of out[0].concerns) assert.ok(c.text.length > 15 && /[.]$/.test(c.text), c.text);
});

// ── Reading bowels from the options chosen ────────────────────────────────
t('bowel options become data', () => {
  assert.deepStrictEqual(bowelsFromLabels(['Bowels opened (normal)']), { opened: true, stoolType: 'normal' });
  assert.deepStrictEqual(bowelsFromLabels(['Bowels opened (Bristol type 1–2 hard)']), { opened: true, stoolType: 'hard' });
  assert.deepStrictEqual(bowelsFromLabels(['Bowels opened (Bristol type 5–7 loose)']), { opened: true, stoolType: 'loose' });
  assert.deepStrictEqual(bowelsFromLabels(['Bowels not opened today']), { opened: false, stoolType: null });
  assert.deepStrictEqual(bowelsFromLabels(['Diarrhoea — reported to nurse']), { opened: true, stoolType: 'loose' });
});
t('ambiguous options are left unknown, not guessed', () => {
  assert.deepStrictEqual(bowelsFromLabels(['Constipated — reported to nurse']), { opened: null, stoolType: null });
  assert.deepStrictEqual(bowelsFromLabels([]), { opened: null, stoolType: null });
});
t('"opened" wins over "not opened" if both were tapped', () => {
  assert.strictEqual(bowelsFromLabels(['Bowels not opened today', 'Bowels opened (normal)']).opened, true);
});

console.log(`\nintake summary: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
