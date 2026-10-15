// Tests for weight trend and MUST steps 1 and 2.
import assert from 'node:assert';
const { weightTrend, bmiScore, lossScore } = await import('./weighttrend.impl.mjs');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); } };
const NOW = new Date('2026-10-11T12:00:00Z');
const ago = days => new Date(NOW.getTime() - days * 86400000).toISOString();
const w = (kg, days) => ({ weight_kg: kg, created_at: ago(days) });

// ── The published thresholds, at their edges ──────────────────────────────
t('BMI score: >20 is 0, 18.5–20 is 1, <18.5 is 2 (edges included as BAPEN states)', () => {
  assert.strictEqual(bmiScore(20.1), 0);
  assert.strictEqual(bmiScore(20.0), 1);
  assert.strictEqual(bmiScore(18.5), 1);
  assert.strictEqual(bmiScore(18.4), 2);
  assert.strictEqual(bmiScore(35), 0);
  assert.strictEqual(bmiScore(null), null);
});
t('weight-loss score: <5% is 0, 5–10% is 1, >10% is 2', () => {
  assert.strictEqual(lossScore(4.9), 0);
  assert.strictEqual(lossScore(5.0), 1);
  assert.strictEqual(lossScore(10.0), 1);
  assert.strictEqual(lossScore(10.1), 2);
  assert.strictEqual(lossScore(null), null);
});
t('rounding: 4.96% is reported as 5.0% and scored as 5.0%, not silently 0', () => {
  assert.strictEqual(lossScore(4.96), 1);
});

// ── Trend over 3–6 months, not just since last time ───────────────────────
t('a slow loss each month adds up — the old screen compared only with last time', () => {
  // 70 → 68.5 → 67 → 65.5 → 64: never more than 2.3% between readings, 8.6% overall.
  const r = weightTrend([w(64, 1), w(65.5, 31), w(67, 61), w(68.5, 92), w(70, 122)], 165, NOW);
  assert.strictEqual(r.changePct, 8.6);
  assert.strictEqual(r.lossScore, 1);
  assert.strictEqual(r.reference.kg, 70);
  assert.match(r.concerns.join(' '), /Down 8\.6%.*MUST weight-loss score 1/);
});
t('more than 10% in six months scores 2 and asks for action', () => {
  const r = weightTrend([w(56, 2), w(63, 150)], 165, NOW);
  assert.strictEqual(r.lossScore, 2);
  assert.strictEqual(r.level, 'act');
});
t('compared with the HIGHEST weight in six months, not the oldest', () => {
  const r = weightTrend([w(60, 1), w(66, 60), w(62, 170)], 165, NOW);
  assert.strictEqual(r.reference.kg, 66);
  assert.strictEqual(r.changePct, 9.1);
});
t('weights older than six months before the latest are ignored', () => {
  const r = weightTrend([w(60, 1), w(80, 200)], 165, NOW);
  assert.strictEqual(r.reference, null);
  assert.strictEqual(r.lossScore, null);
  assert.ok(r.notes.some(n => /no trend yet/.test(n)));
});
t('weight gain is not a loss', () => {
  const r = weightTrend([w(66, 1), w(60, 90)], 165, NOW);
  assert.ok(r.changePct < 0);
  assert.strictEqual(r.lossScore, 0);
});

// ── BMI ───────────────────────────────────────────────────────────────────
t('BMI from height: 50 kg at 165 cm is 18.4 → score 2', () => {
  const r = weightTrend([w(50, 1), w(50.5, 30)], 165, NOW);
  assert.strictEqual(r.bmi, 18.4);
  assert.strictEqual(r.bmiScore, 2);
  assert.strictEqual(r.mustFloor, 2);
  assert.strictEqual(r.level, 'act');
});
t('no height: no BMI, and it says why — never a made-up height', () => {
  const r = weightTrend([w(50, 1)], null, NOW);
  assert.strictEqual(r.bmi, null);
  assert.strictEqual(r.mustFloor, null);
  assert.ok(r.notes.some(n => /No height/.test(n)));
});
t('heights entered in metres or nonsense are not used', () => {
  assert.strictEqual(weightTrend([w(60, 1)], 1.65, NOW).bmi, null);
  assert.strictEqual(weightTrend([w(60, 1)], 'abc', NOW).bmi, null);
});
t('decimal strings from Postgres are read as numbers', () => {
  const r = weightTrend([{ weight_kg: '64.0', created_at: ago(1) }, { weight_kg: '70.0', created_at: ago(100) }], '165.0', NOW);
  assert.strictEqual(r.changePct, 8.6);
  assert.strictEqual(r.bmi, 23.5);
});

// ── Overdue, never weighed, suspicious readings ───────────────────────────
t('never weighed is a concern, not "fine"', () => {
  const r = weightTrend([], 165, NOW);
  assert.strictEqual(r.level, 'watch');
  assert.deepStrictEqual(r.concerns, ['No weight recorded.']);
});
t('not weighed for over a month is flagged; within a month is not', () => {
  assert.ok(weightTrend([w(60, 40)], 165, NOW).overdue);
  assert.ok(!weightTrend([w(60, 20)], 165, NOW).overdue);
  assert.match(weightTrend([w(60, 40)], 165, NOW).concerns.join(' '), /Not weighed for 40 days/);
});
t('the interval can be set by the home', () => {
  assert.ok(weightTrend([w(60, 10)], 165, NOW, { intervalDays: 7 }).overdue);
});
t('a 10% jump within a week asks for a re-weigh before anyone acts', () => {
  const r = weightTrend([w(54, 0), w(61, 5)], 165, NOW);
  assert.ok(r.suspectReading);
  assert.match(r.concerns[0], /Re-weigh/);
  assert.strictEqual(r.level, 'watch');
});
t('typing slips (6.5 kg, 650 kg) are dropped rather than scored', () => {
  const r = weightTrend([w(6.5, 1), w(65, 30), w(650, 60)], 165, NOW);
  assert.strictEqual(r.count, 1);
  assert.strictEqual(r.latest.kg, 65);
});
t('a stable, recently weighed resident is ok with no concerns', () => {
  const r = weightTrend([w(65, 3), w(65.4, 33), w(64.8, 63)], 165, NOW);
  assert.strictEqual(r.level, 'ok');
  assert.deepStrictEqual(r.concerns, []);
});
t('never calls itself a MUST score — step 3 and "unplanned" need a nurse', () => {
  const r = weightTrend([w(56, 2), w(63, 150)], 165, NOW);
  assert.ok(r.notes.some(n => /step 3/.test(n) && /full MUST screen/.test(n)));
  assert.match(r.concerns.join(' '), /if unplanned/);
});

console.log(`\nweight trend: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
