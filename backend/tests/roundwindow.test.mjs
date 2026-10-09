// Tests for which tasks appear in "Start my round".
import assert from 'node:assert';
const { buildRound, shiftAt, datesForShift, dueAt, localDate, addDays } =
  await import('./roundwindow.impl.mjs');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}

const D = '2026-10-09', PREV = '2026-10-08', NEXT = '2026-10-10';
const at = (date, hh, mm = 0) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d, hh, mm); };
let n = 0;
const task = (date, time, status = 'due') => ({ id: `t${++n}`, status, due_time: time, fetched_date: date });
const ids = arr => arr.map(x => x.due_time + '@' + x.fetched_date);

// ── The bug that was reported ─────────────────────────────────────────────
t('night tasks never appear on a day round', () => {
  const tasks = [task(D, '02:00', 'missed'), task(D, '04:00', 'missed'), task(D, '10:00')];
  const r = buildRound(tasks, at(D, 10, 0));
  assert.deepStrictEqual(ids(r.now), ['10:00@' + D]);
  assert.strictEqual(r.earlier.length, 0, 'night tasks leaked into "earlier this shift"');
  assert.strictEqual(r.previousShift.length, 2, 'night tasks should be kept for handover, not lost');
});
t('evening and night tasks do not appear during the day', () => {
  const r = buildRound([task(D, '21:00', 'upcoming'), task(D, '23:30', 'upcoming')], at(D, 10));
  assert.strictEqual(r.now.length + r.earlier.length + r.later.length, 0);
});
t('day tasks never appear on a night round', () => {
  const r = buildRound([task(D, '08:00', 'missed'), task(D, '13:00', 'missed'), task(D, '21:00')], at(D, 21, 15));
  assert.deepStrictEqual(ids(r.now), ['21:00@' + D]);
  assert.strictEqual(r.earlier.length, 0);
});

// ── The window ────────────────────────────────────────────────────────────
t('due now is in the round', () => {
  assert.strictEqual(buildRound([task(D, '10:00')], at(D, 10, 0)).now.length, 1);
});
t('a little earlier is still in the round', () => {
  assert.strictEqual(buildRound([task(D, '08:30', 'overdue')], at(D, 10, 0)).now.length, 1);
  assert.strictEqual(buildRound([task(D, '08:00', 'overdue')], at(D, 10, 0)).now.length, 1, 'boundary is inclusive');
});
t('much earlier this shift goes to "earlier", not the deck', () => {
  const r = buildRound([task(D, '07:30', 'missed')], at(D, 10, 0));
  assert.strictEqual(r.now.length, 0);
  assert.strictEqual(r.earlier.length, 1, 'unrecorded care earlier this shift must stay visible');
});
t('a little ahead is in the round', () => {
  assert.strictEqual(buildRound([task(D, '10:30', 'upcoming')], at(D, 10, 0)).now.length, 1);
});
t('well ahead is held back', () => {
  const r = buildRound([task(D, '11:00', 'upcoming'), task(D, '17:00', 'upcoming')], at(D, 10, 0));
  assert.strictEqual(r.now.length, 0, 'recording care before it happens is exactly what to avoid');
  assert.strictEqual(r.later.length, 2);
});
t('the deck is in time order, oldest first', () => {
  const r = buildRound([task(D, '10:20'), task(D, '08:45'), task(D, '09:30')], at(D, 10, 0));
  assert.deepStrictEqual(r.now.map(x => x.due_time), ['08:45', '09:30', '10:20']);
});
t('recorded tasks never appear', () => {
  const r = buildRound([task(D, '10:00', 'done'), task(D, '10:00', 'deferred'), task(D, '10:00', 'na')], at(D, 10));
  assert.strictEqual(r.now.length + r.earlier.length + r.later.length + r.previousShift.length, 0);
});
t('a task someone has started is current whatever the time', () => {
  const r = buildRound([task(D, '07:15', 'in_progress')], at(D, 10, 0));
  assert.strictEqual(r.now.length, 1);
});
t('a task with no set time is offered after the timed ones', () => {
  const r = buildRound([{ id: 'x', status: 'due', due_time: null, fetched_date: D }, task(D, '10:00')], at(D, 10));
  assert.deepStrictEqual(r.now.map(x => x.id), [r.now[0].id, 'x']);
  assert.strictEqual(r.now[1].id, 'x');
});

// ── Nights cross midnight ─────────────────────────────────────────────────
t('at 01:00 the shift began yesterday evening', () => {
  const s = shiftAt(at(D, 1, 0));
  assert.strictEqual(s.name, 'night');
  assert.strictEqual(localDate(s.start), PREV);
  assert.strictEqual(s.start.getHours(), 20);
  assert.strictEqual(localDate(s.end), D);
});
t('at 01:00 yesterday\'s late tasks are still this shift', () => {
  const tasks = [task(PREV, '23:30', 'overdue'), task(D, '00:45', 'due'), task(PREV, '21:00', 'missed'),
                 task(PREV, '14:00', 'missed'), task(D, '08:00', 'upcoming')];
  const r = buildRound(tasks, at(D, 1, 0));
  assert.deepStrictEqual(ids(r.now), ['23:30@' + PREV, '00:45@' + D]);
  assert.deepStrictEqual(ids(r.earlier), ['21:00@' + PREV]);
  assert.deepStrictEqual(ids(r.previousShift), ['14:00@' + PREV], 'the day shift\'s work is handover, not the night round');
  assert.strictEqual(r.later.length, 0, '08:00 belongs to the next day shift');
});
t('at 23:45 just-after-midnight tasks are a little ahead', () => {
  const r = buildRound([task(NEXT, '00:10', 'upcoming'), task(D, '23:30')], at(D, 23, 45));
  assert.deepStrictEqual(ids(r.now), ['23:30@' + D, '00:10@' + NEXT]);
});
t('the right task lists are fetched for each shift', () => {
  assert.deepStrictEqual(datesForShift(at(D, 10)), [D]);
  assert.deepStrictEqual(datesForShift(at(D, 22)), [D, NEXT]);
  assert.deepStrictEqual(datesForShift(at(D, 1)), [PREV, D]);
});
t('the same task fetched twice appears once', () => {
  const a = task(D, '10:00');
  const r = buildRound([a, { ...a }], at(D, 10));
  assert.strictEqual(r.now.length, 1);
});

// ── Shift edges ───────────────────────────────────────────────────────────
t('07:00 is the day shift, 06:59 is still night', () => {
  assert.strictEqual(shiftAt(at(D, 7, 0)).name, 'day');
  assert.strictEqual(shiftAt(at(D, 6, 59)).name, 'night');
});
t('20:00 is night, 19:59 is still day', () => {
  assert.strictEqual(shiftAt(at(D, 20, 0)).name, 'night');
  assert.strictEqual(shiftAt(at(D, 19, 59)).name, 'day');
});
t('shift hours are configurable for homes on different patterns', () => {
  const opts = { lookbackMins: 120, lookaheadMins: 30, dayStartHour: 8, nightStartHour: 20 };
  assert.strictEqual(shiftAt(at(D, 7, 30), opts).name, 'night');
  assert.strictEqual(shiftAt(at(D, 8, 0), opts).name, 'day');
});

// ── Dates ─────────────────────────────────────────────────────────────────
t('localDate uses the device clock, not UTC', () => {
  assert.strictEqual(localDate(at(D, 0, 30)), D);
  assert.strictEqual(localDate(at(D, 23, 59)), D);
});
t('addDays crosses month and year ends', () => {
  assert.strictEqual(addDays('2026-10-31', 1), '2026-11-01');
  assert.strictEqual(addDays('2026-01-01', -1), '2025-12-31');
});
t('dueAt reads HH:MM and HH:MM:SS, and a server ISO date', () => {
  assert.strictEqual(dueAt({ id: 'a', status: 'due', due_time: '08:30', fetched_date: D }).getHours(), 8);
  assert.strictEqual(dueAt({ id: 'a', status: 'due', due_time: '08:30:00', fetched_date: D }).getMinutes(), 30);
  assert.strictEqual(localDate(dueAt({ id: 'a', status: 'due', due_time: '08:30', task_date: D + 'T00:00:00.000Z' })), D);
  assert.strictEqual(dueAt({ id: 'a', status: 'due', due_time: null, fetched_date: D }), null);
});

console.log(`\nround window: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
