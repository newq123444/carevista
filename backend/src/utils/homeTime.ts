// ────────────────────────────────────────────────────────────────────────────
// The home's clock, whatever the server's clock says.
//
// The server runs in UTC. A care home runs on UK time, which is an hour ahead
// from late March to late October. Reading "08:00" as server time made every
// task on the board an hour late all summer, and "today" was yesterday from
// midnight to 1am.
//
// These helpers do the conversion explicitly, so they are right whatever TZ
// the process happens to have. They are deliberately narrow: the global fix
// (DATE columns as strings, then TZ=Europe/London for the whole process) needs
// a real database to test against and is not done here.
// ────────────────────────────────────────────────────────────────────────────

export const HOME_TIME_ZONE = process.env.HOME_TIMEZONE || 'Europe/London';

// SQL for "today" in the home's time zone, independent of the session's
// TimeZone setting. Use in place of CURRENT_DATE.
export const HOME_TODAY_SQL = `(NOW() AT TIME ZONE '${HOME_TIME_ZONE.replace(/'/g, "''")}')::date`;

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Wall-clock parts in the given zone at an instant. */
export function wallClock(at: Date, tz = HOME_TIME_ZONE) {
  const p: Record<string, number> = {};
  for (const part of fmt(tz).formatToParts(at)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  return { year: p.year, month: p.month, day: p.day, hour: p.hour % 24, minute: p.minute, second: p.second };
}

/** Offset of the zone from UTC at an instant, in minutes (60 in BST, 0 in GMT). */
export function offsetMinutes(at: Date, tz = HOME_TIME_ZONE): number {
  const w = wallClock(at, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Today's date in the home, as YYYY-MM-DD. */
export function homeToday(now = new Date(), tz = HOME_TIME_ZONE): string {
  const w = wallClock(now, tz);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/**
 * The instant a home wall-clock time happens. "2026-07-01", "08:00" → 07:00Z.
 *
 * Clock changes: a time that doesn't exist (01:30 on the spring-forward
 * Sunday) is read as the same moment an hour on (02:30 BST); a time that
 * happens twice (01:30 on the autumn Sunday) is the first one (BST).
 */
export function homeInstant(date: string, time: string, tz = HOME_TIME_ZONE): Date {
  const [y, mo, d] = date.slice(0, 10).split('-').map(Number);
  const [h, mi] = String(time || '00:00').slice(0, 5).split(':').map(Number);
  const naive = Date.UTC(y, mo - 1, d, h || 0, mi || 0, 0);
  // Try the offsets either side of the wall time and keep one that maps back.
  const before = offsetMinutes(new Date(naive - 12 * 3600_000), tz);
  const after  = offsetMinutes(new Date(naive + 12 * 3600_000), tz);
  const candidates = [...new Set([Math.max(before, after), before, after])];
  for (const off of candidates) {
    const t = new Date(naive - off * 60000);
    const w = wallClock(t, tz);
    if (w.year === y && w.month === mo && w.day === d && w.hour === (h || 0) && w.minute === (mi || 0)) return t;
  }
  // No match: the wall time was skipped by a spring-forward. Use the offset
  // in force before the change, which lands an hour later on the clock.
  return new Date(naive - before * 60000);
}

/** Add whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
