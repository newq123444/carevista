// Tests for the home's clock. These must give the same answers whatever the
// server's own TZ is, so the file re-runs itself under several zones.
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (!process.env.HOMETIME_CHILD) {
  let bad = 0;
  for (const tz of ['UTC', 'Europe/London', 'America/New_York', 'Asia/Kolkata', 'Pacific/Auckland']) {
    try {
      execFileSync(process.execPath, [fileURLToPath(import.meta.url)],
        { stdio: 'inherit', env: { ...process.env, TZ: tz, HOMETIME_CHILD: tz } });
    } catch { bad++; }
  }
  if (bad) process.exit(1);
  process.exit(0);
}

const { homeToday, homeInstant, offsetMinutes, addDays, HOME_TODAY_SQL } = await import('./hometime.impl.mjs');
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.error(`FAIL [TZ=${process.env.TZ}] ${name}\n      ${e.message}`); } };
const iso = d => d.toISOString().slice(0, 16) + 'Z';

// ── "Today" ───────────────────────────────────────────────────────────────
t('00:30 BST is already tomorrow in the home (server says yesterday)', () => {
  assert.strictEqual(homeToday(new Date('2026-07-01T23:30:00Z')), '2026-07-02');
});
t('23:30 GMT in winter is still today', () => {
  assert.strictEqual(homeToday(new Date('2026-01-15T23:30:00Z')), '2026-01-15');
});
t('midday is the same date everywhere it matters', () => {
  assert.strictEqual(homeToday(new Date('2026-10-11T12:00:00Z')), '2026-10-11');
});

// ── Due times ─────────────────────────────────────────────────────────────
t('08:00 in summer is 07:00 UTC (the bug: it was read as 08:00 UTC)', () => {
  assert.strictEqual(iso(homeInstant('2026-07-01', '08:00')), '2026-07-01T07:00Z');
});
t('08:00 in winter is 08:00 UTC', () => {
  assert.strictEqual(iso(homeInstant('2026-01-15', '08:00')), '2026-01-15T08:00Z');
});
t('accepts HH:MM:SS from Postgres', () => {
  assert.strictEqual(iso(homeInstant('2026-07-01', '22:00:00')), '2026-07-01T21:00Z');
});
t('accepts a full timestamp as the date', () => {
  assert.strictEqual(iso(homeInstant('2026-07-01T00:00:00.000Z', '09:30')), '2026-07-01T08:30Z');
});

// ── Clock changes (2026: forward 29 March, back 25 October) ───────────────
t('the day the clocks go forward: 00:30 is GMT, 03:00 is BST', () => {
  assert.strictEqual(iso(homeInstant('2026-03-29', '00:30')), '2026-03-29T00:30Z');
  assert.strictEqual(iso(homeInstant('2026-03-29', '03:00')), '2026-03-29T02:00Z');
});
t('a time the clocks skip (01:30) lands an hour on, not an hour back', () => {
  assert.strictEqual(iso(homeInstant('2026-03-29', '01:30')), '2026-03-29T01:30Z');
});
t('the day the clocks go back: 01:30 happens twice, the first (BST) is used', () => {
  assert.strictEqual(iso(homeInstant('2026-10-25', '01:30')), '2026-10-25T00:30Z');
});
t('the day the clocks go back: 08:00 is GMT', () => {
  assert.strictEqual(iso(homeInstant('2026-10-25', '08:00')), '2026-10-25T08:00Z');
});
t('the night before the clocks go back: 22:00 is BST', () => {
  assert.strictEqual(iso(homeInstant('2026-10-24', '22:00')), '2026-10-24T21:00Z');
});
t('offset is 60 in summer, 0 in winter', () => {
  assert.strictEqual(offsetMinutes(new Date('2026-07-01T12:00:00Z')), 60);
  assert.strictEqual(offsetMinutes(new Date('2026-12-01T12:00:00Z')), 0);
});

// ── Round trip: every quarter hour of the two change days ─────────────────
t('every quarter hour around both clock changes round-trips', () => {
  for (const day of ['2026-03-28', '2026-03-29', '2026-03-30', '2026-10-24', '2026-10-25', '2026-10-26']) {
    for (let m = 0; m < 24 * 60; m += 15) {
      const hh = String(Math.floor(m / 60)).padStart(2, '0'), mm = String(m % 60).padStart(2, '0');
      if (day === '2026-03-29' && hh === '01') continue; // does not exist
      const inst = homeInstant(day, `${hh}:${mm}`);
      assert.strictEqual(homeToday(inst), day, `${day} ${hh}:${mm} → ${inst.toISOString()}`);
      const wall = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(inst);
      assert.strictEqual(wall, `${hh}:${mm}`, `${day} ${hh}:${mm} came back as ${wall}`);
    }
  }
});

// ── Small things ──────────────────────────────────────────────────────────
t('addDays crosses months and years', () => {
  assert.strictEqual(addDays('2026-12-31', 1), '2027-01-01');
  assert.strictEqual(addDays('2026-03-01', -1), '2026-02-28');
});
t('SQL for today does not depend on the session time zone', () => {
  assert.match(HOME_TODAY_SQL, /^\(NOW\(\) AT TIME ZONE 'Europe\/London'\)::date$/);
});

if (process.env.HOMETIME_CHILD === 'UTC') console.log(`\nhome time: ${pass} passed, ${fail} failed (and again under 4 other server time zones)`);
if (fail) process.exit(1);
