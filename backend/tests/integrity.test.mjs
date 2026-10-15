// Tests for the implausible-record detector. Run via tests/run.mjs.
//
// The false-positive tests matter more than the true-positive ones. A detector
// that flags honest work gets switched off, and then it protects nobody.
import assert from 'node:assert';
const {
  runAllChecks, checkThroughput, checkLateEntry, checkOffShift,
  checkAbsentResident, checkEndOfShiftBurst, DEFAULT_THRESHOLDS,
} = await import('./integrity.impl.mjs');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}
const TH = DEFAULT_THRESHOLDS;
const at = (h, m = 0) => new Date(2026, 2, 1, h, m, 0);
let n = 0;
const rec = (o = {}) => ({
  id: `r${++n}`, residentId: 'res1', staffId: 'staff1',
  eventAt: at(9), recordedAt: at(9), kind: 'care_note', ...o,
});

// ── Throughput ────────────────────────────────────────────────────────────
t('six residents in four minutes is flagged', () => {
  const rows = ['a','b','c','d','e','f'].map((r, i) =>
    rec({ residentId: r, eventAt: at(9, i * 0.8), recordedAt: at(9, i * 0.8) }));
  const f = checkThroughput(rows, TH);
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].kind, 'throughput');
  assert.ok(f[0].evidence.residentsInWindow >= 5);
});
t('unhurried personal care is NOT flagged', () => {
  const rows = ['a','b','c','d','e'].map((r, i) =>
    rec({ residentId: r, eventAt: at(9, i * 15), recordedAt: at(9, i * 15) }));
  assert.deepStrictEqual(checkThroughput(rows, TH), []);
});
t('many records for ONE resident is not a throughput problem', () => {
  const rows = Array.from({ length: 10 }, (_, i) =>
    rec({ residentId: 'res1', eventAt: at(9, i), recordedAt: at(9, i) }));
  assert.deepStrictEqual(checkThroughput(rows, TH), []);
});
t('two residents close together is not enough to flag', () => {
  const rows = [rec({ residentId: 'a', eventAt: at(9, 0) }), rec({ residentId: 'b', eventAt: at(9, 1) })];
  assert.deepStrictEqual(checkThroughput(rows, TH), []);
});
t('two different carers working in parallel are not combined', () => {
  const rows = [
    rec({ staffId: 's1', residentId: 'a', eventAt: at(9, 0) }),
    rec({ staffId: 's2', residentId: 'b', eventAt: at(9, 0) }),
    rec({ staffId: 's1', residentId: 'c', eventAt: at(9, 1) }),
    rec({ staffId: 's2', residentId: 'd', eventAt: at(9, 1) }),
  ];
  assert.deepStrictEqual(checkThroughput(rows, TH), []);
});
t('the check can be switched off', () => {
  const rows = ['a','b','c','d'].map((r, i) => rec({ residentId: r, eventAt: at(9, i * 0.5) }));
  assert.deepStrictEqual(checkThroughput(rows, { ...TH, checkThroughput: false }), []);
});

// ── Late entry ────────────────────────────────────────────────────────────
t('care entered 8 hours later is flagged', () => {
  const f = checkLateEntry([rec({ eventAt: at(8), recordedAt: at(16) })], TH);
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].evidence.hoursLate, 8);
});
t('care entered promptly is not flagged', () => {
  assert.deepStrictEqual(checkLateEntry([rec({ eventAt: at(8), recordedAt: at(8, 20) })], TH), []);
});
t('a record entered slightly early is not flagged as late', () => {
  // Clock skew between tablet and server can make recordedAt precede eventAt.
  assert.deepStrictEqual(checkLateEntry([rec({ eventAt: at(9), recordedAt: at(8, 55) })], TH), []);
});
t('very late entry is escalated', () => {
  const f = checkLateEntry([rec({ eventAt: at(2), recordedAt: new Date(2026, 2, 2, 8) })], TH);
  assert.strictEqual(f[0].severity, 'notable');
});

// ── Off shift ─────────────────────────────────────────────────────────────
const shift = (s, e) => ({ staffId: 'staff1', start: at(s), end: at(e) });
t('off-shift is OFF by default, because rotas are often stale', () => {
  assert.strictEqual(TH.checkOffShift, false);
  assert.deepStrictEqual(checkOffShift([rec({ eventAt: at(3) })], [shift(8, 16)], TH), []);
});
t('when switched on, recording outside every shift is flagged', () => {
  const on = { ...TH, checkOffShift: true };
  const f = checkOffShift([rec({ eventAt: at(3) })], [shift(8, 16)], on);
  assert.strictEqual(f.length, 1);
});
t('recording inside a shift is not flagged', () => {
  const on = { ...TH, checkOffShift: true };
  assert.deepStrictEqual(checkOffShift([rec({ eventAt: at(10) })], [shift(8, 16)], on), []);
});
t('a 30 minute grace either side is allowed for handover', () => {
  const on = { ...TH, checkOffShift: true };
  assert.deepStrictEqual(checkOffShift([rec({ eventAt: at(7, 40) })], [shift(8, 16)], on), []);
  assert.deepStrictEqual(checkOffShift([rec({ eventAt: at(16, 20) })], [shift(8, 16)], on), []);
});
t('someone with NO rota at all is never flagged', () => {
  // An empty rota is a rota problem, not this person's doing. Flagging them
  // would blame a carer for an administrative gap.
  const on = { ...TH, checkOffShift: true };
  assert.deepStrictEqual(checkOffShift([rec({ eventAt: at(3) })], [], on), []);
});
t('a carer with two shifts that day is covered by either', () => {
  const on = { ...TH, checkOffShift: true };
  const shifts = [shift(6, 10), shift(18, 22)];
  assert.deepStrictEqual(checkOffShift([rec({ eventAt: at(19) })], shifts, on), []);
});

// ── Absent resident ───────────────────────────────────────────────────────
t('care recorded while the resident was in hospital is flagged', () => {
  const abs = [{ residentId: 'res1', from: at(6), to: at(20), reason: 'hospital' }];
  const f = checkAbsentResident([rec({ eventAt: at(12) })], abs, TH);
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].severity, 'notable');
});
t('care before the absence began is not flagged', () => {
  const abs = [{ residentId: 'res1', from: at(14), to: at(20), reason: 'hospital' }];
  assert.deepStrictEqual(checkAbsentResident([rec({ eventAt: at(9) })], abs, TH), []);
});
t('care after the resident returned is not flagged', () => {
  const abs = [{ residentId: 'res1', from: at(6), to: at(11), reason: 'hospital' }];
  assert.deepStrictEqual(checkAbsentResident([rec({ eventAt: at(15) })], abs, TH), []);
});
t('an open-ended absence still catches later care', () => {
  const abs = [{ residentId: 'res1', from: at(6), to: null, reason: 'hospital' }];
  assert.strictEqual(checkAbsentResident([rec({ eventAt: at(23) })], abs, TH).length, 1);
});
t('another resident being away does not implicate this one', () => {
  const abs = [{ residentId: 'other', from: at(6), to: at(20), reason: 'hospital' }];
  assert.deepStrictEqual(checkAbsentResident([rec({ eventAt: at(12) })], abs, TH), []);
});

// ── End of shift burst ────────────────────────────────────────────────────
t('a shift written up in one go is flagged', () => {
  const rows = Array.from({ length: 8 }, (_, i) =>
    rec({ residentId: `r${i}`, eventAt: at(8 + i), recordedAt: at(16, i * 0.4) }));
  const f = checkEndOfShiftBurst(rows, TH);
  assert.strictEqual(f.length, 1);
  assert.ok(f[0].evidence.careSpanHours >= 6);
  assert.strictEqual(f[0].severity, 'notable');
});
t('a finished round entered together is NOT flagged', () => {
  // Eight records about eight things that happened within the same half hour
  // is a carer completing a round. Flagging it would be pure noise.
  const rows = Array.from({ length: 8 }, (_, i) =>
    rec({ residentId: `r${i}`, eventAt: at(9, i * 4), recordedAt: at(9, 32 + i * 0.2) }));
  assert.deepStrictEqual(checkEndOfShiftBurst(rows, TH), []);
});
t('a few records entered together is below the threshold', () => {
  const rows = Array.from({ length: 3 }, (_, i) =>
    rec({ residentId: `r${i}`, eventAt: at(8 + i * 3), recordedAt: at(16, i * 0.3) }));
  assert.deepStrictEqual(checkEndOfShiftBurst(rows, TH), []);
});
t('records spread through the shift are not a burst', () => {
  const rows = Array.from({ length: 10 }, (_, i) =>
    rec({ residentId: `r${i}`, eventAt: at(8 + i), recordedAt: at(8 + i, 2) }));
  assert.deepStrictEqual(checkEndOfShiftBurst(rows, TH), []);
});

// ── Runner behaviour ──────────────────────────────────────────────────────
t('an ordinary day produces no findings at all', () => {
  const rows = Array.from({ length: 12 }, (_, i) =>
    rec({ residentId: `r${i % 6}`, eventAt: at(8 + i), recordedAt: at(8 + i, 3) }));
  const f = runAllChecks({ records: rows, shifts: [shift(8, 20)], absences: [] });
  assert.deepStrictEqual(f, [], 'a normal shift must be silent: ' + JSON.stringify(f.map(x => x.kind)));
});
t('re-running produces identical fingerprints, so nothing duplicates', () => {
  const rows = ['a','b','c','d','e'].map((r, i) =>
    rec({ id: `fixed${i}`, residentId: r, eventAt: at(9, i * 0.5), recordedAt: at(9, i * 0.5) }));
  const one = runAllChecks({ records: rows, shifts: [], absences: [] });
  const two = runAllChecks({ records: rows, shifts: [], absences: [] });
  assert.deepStrictEqual(one.map(f => f.fingerprint), two.map(f => f.fingerprint));
  assert.ok(one.length > 0);
});
t('findings are de-duplicated by fingerprint', () => {
  const rows = ['a','b','c','d','e'].map((r, i) =>
    rec({ id: `d${i}`, residentId: r, eventAt: at(9, i * 0.5), recordedAt: at(9, i * 0.5) }));
  const f = runAllChecks({ records: [...rows], shifts: [], absences: [] });
  assert.strictEqual(new Set(f.map(x => x.fingerprint)).size, f.length);
});
t('every finding carries its evidence and the records behind it', () => {
  const rows = ['a','b','c','d','e'].map((r, i) =>
    rec({ residentId: r, eventAt: at(9, i * 0.5), recordedAt: at(16, i) }));
  const f = runAllChecks({ records: rows, shifts: [], absences: [] });
  assert.ok(f.length > 0);
  for (const x of f) {
    assert.ok(x.summary.length > 30, 'summary must explain itself');
    assert.ok(Object.keys(x.evidence).length > 0, 'evidence must be shown');
    assert.ok(x.recordIds.length > 0, 'must point at the records');
    assert.ok(/^[0-9a-f]{64}$/.test(x.fingerprint));
    assert.ok(['review', 'notable', 'urgent'].includes(x.severity));
  }
});
t('no finding is worded as an accusation', () => {
  const rows = ['a','b','c','d','e','f'].map((r, i) =>
    rec({ residentId: r, eventAt: at(9, i * 0.4), recordedAt: at(18, i) }));
  const abs = [{ residentId: 'a', from: at(6), to: at(20), reason: 'hospital' }];
  const f = runAllChecks({ records: rows, shifts: [], absences: abs,
                           thresholds: { checkOffShift: true } });
  assert.ok(f.length > 0);
  const banned = /\b(falsif|fraud|lied?|lying|dishonest|fake|faked|misconduct|negligen)/i;
  for (const x of f) {
    assert.ok(!banned.test(x.summary), `accusatory wording in "${x.kind}": ${x.summary}`);
  }
});
t('an empty day is silent', () => {
  assert.deepStrictEqual(runAllChecks({ records: [], shifts: [], absences: [] }), []);
});
t('most serious findings sort first', () => {
  const rows = ['a','b','c'].map((r, i) => rec({ residentId: r, eventAt: at(12), recordedAt: at(23) }));
  const abs = [{ residentId: 'a', from: at(6), to: at(20), reason: 'hospital' }];
  const f = runAllChecks({ records: rows, shifts: [], absences: abs });
  const rank = { review: 0, notable: 1, urgent: 2 };
  for (let i = 1; i < f.length; i++) {
    assert.ok(rank[f[i - 1].severity] >= rank[f[i].severity], 'not sorted by severity');
  }
});
t('thresholds are honoured', () => {
  const rows = [rec({ eventAt: at(8), recordedAt: at(11) })]; // 3 hours
  assert.deepStrictEqual(checkLateEntry(rows, TH), [], 'under the 6h default');
  assert.strictEqual(checkLateEntry(rows, { ...TH, lateEntryHours: 2 }).length, 1);
});
t('a thousand records complete quickly', () => {
  const rows = Array.from({ length: 1000 }, (_, i) =>
    rec({ residentId: `r${i % 40}`, staffId: `s${i % 8}`,
          eventAt: new Date(2026, 2, 1, 6 + (i % 14), i % 60),
          recordedAt: new Date(2026, 2, 1, 6 + (i % 14), i % 60) }));
  const start = Date.now();
  runAllChecks({ records: rows, shifts: [], absences: [] });
  const ms = Date.now() - start;
  assert.ok(ms < 3000, `took ${ms}ms — too slow to run nightly over a year`);
});

// ── Records sent later from a phone with no signal (v86) ──────────────────
t('records sent when the signal came back are not mistaken for a shift written up at the end', () => {
  const rows = Array.from({ length: 8 }, (_, i) =>
    rec({ residentId: `r${i}`, eventAt: at(8 + i), recordedAt: at(16, i * 0.4), offline: true }));
  assert.deepStrictEqual(checkEndOfShiftBurst(rows, TH), []);
});
t('the same burst typed in at the end of a shift is still flagged', () => {
  const rows = Array.from({ length: 8 }, (_, i) =>
    rec({ residentId: `r${i}`, eventAt: at(8 + i), recordedAt: at(16, i * 0.4), offline: false }));
  assert.strictEqual(checkEndOfShiftBurst(rows, TH).length, 1);
});
t('a phone that was offline for hours still shows as late, and says the time is the phone\'s', () => {
  const f = checkLateEntry([rec({ eventAt: at(8), recordedAt: at(16), offline: true })], TH);
  assert.strictEqual(f.length, 1);
  assert.match(f[0].summary, /no signal/);
  assert.match(f[0].summary, /not verified/);
  assert.strictEqual(f[0].evidence.eventTimeSource, 'device clock, not verified');
});

console.log(`\nintegrity: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
