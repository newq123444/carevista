// ────────────────────────────────────────────────────────────────────────────
// Which tasks belong in "Start my round", right now.
//
// The first version showed everything not yet recorded. At ten in the morning
// that included last night's 02:00 checks — they were "missed", so they looked
// outstanding — and a day carer would be asked to record night care they never
// gave. Worse, the easy thing to do with a card you can't act on is swipe it.
//
// So the round is built around the clock on the phone in the carer's hand:
//
//   • NOW      due from a little earlier up to a little ahead — the deck
//   • EARLIER  due earlier THIS shift and still unrecorded — visible, one tap
//              away, never silently dropped (missed care must not vanish)
//   • LATER    due later this shift — not shown, so nobody records care early
//
// Anything belonging to a different shift is left out entirely. Night tasks
// never appear on a day round, and day tasks never appear at night.
//
// Nights cross midnight, which is the awkward part: at 01:00 the night shift
// began yesterday at 20:00, so yesterday's 22:00 tasks are still "this shift".
// The caller fetches both dates and this sorts them out by real time.
//
// Times are LOCAL to the device. The server's notion of time is deliberately
// not trusted here — see the release notes on the server timezone.
// ────────────────────────────────────────────────────────────────────────────

export interface RoundTaskLike {
  id: string;
  status: string;
  due_time?: string | null;
  task_date?: string | null;
  /** The date the task list was fetched for. More reliable than task_date. */
  fetched_date?: string;
}

export interface RoundOptions {
  /** How far back still counts as "now". */
  lookbackMins: number;
  /** How far ahead a carer may reasonably start a task. */
  lookaheadMins: number;
  /** Hour the day shift starts (local, 0–23). */
  dayStartHour: number;
  /** Hour the night shift starts (local, 0–23). */
  nightStartHour: number;
}

export const DEFAULT_ROUND: RoundOptions = {
  lookbackMins: 120,
  lookaheadMins: 30,
  dayStartHour: 7,
  nightStartHour: 20,
};

/** Recorded already, one way or another — never part of a round. */
export const SETTLED = new Set(['done', 'deferred', 'na']);

/** YYYY-MM-DD in the device's own timezone. toISOString() is UTC and is wrong
 *  for the first hour after midnight all summer. */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + n));
}

export interface Shift {
  name: 'day' | 'night';
  start: Date;
  end: Date;
}

export function shiftAt(now: Date, opts: RoundOptions = DEFAULT_ROUND): Shift {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate(), h = now.getHours();
  const { dayStartHour: ds, nightStartHour: ns } = opts;
  if (h >= ds && h < ns) {
    return { name: 'day', start: new Date(y, m, d, ds), end: new Date(y, m, d, ns) };
  }
  if (h >= ns) {
    return { name: 'night', start: new Date(y, m, d, ns), end: new Date(y, m, d + 1, ds) };
  }
  return { name: 'night', start: new Date(y, m, d - 1, ns), end: new Date(y, m, d, ds) };
}

/** The task-list dates that can contain tasks for the current shift. */
export function datesForShift(now: Date, opts: RoundOptions = DEFAULT_ROUND): string[] {
  const s = shiftAt(now, opts);
  const a = localDate(s.start);
  const b = localDate(new Date(s.end.getTime() - 1));
  return a === b ? [a] : [a, b];
}

/** When a task is due, in local time. Null when it has no set time. */
export function dueAt(task: RoundTaskLike): Date | null {
  const dateStr = task.fetched_date || (task.task_date ? String(task.task_date).slice(0, 10) : null);
  if (!dateStr || !task.due_time) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = String(task.due_time).split(':').map(Number);
  if ([y, m, d, hh].some(n => Number.isNaN(n))) return null;
  return new Date(y, m - 1, d, hh, mm || 0);
}

export interface Round<T> {
  /** Due from a little earlier to a little ahead, oldest first. The deck. */
  now: T[];
  /** Due earlier this shift and still not recorded. */
  earlier: T[];
  /** Due later this shift. Not shown in the deck. */
  later: T[];
  /** Unrecorded tasks from before this shift began — for handover, not the deck. */
  previousShift: T[];
  shift: Shift;
}

export function buildRound<T extends RoundTaskLike>(
  tasks: T[], now: Date, opts: RoundOptions = DEFAULT_ROUND,
): Round<T> {
  const shift = shiftAt(now, opts);
  const from = now.getTime() - opts.lookbackMins * 60_000;
  const to = now.getTime() + opts.lookaheadMins * 60_000;

  const out: Round<T> = { now: [], earlier: [], later: [], previousShift: [], shift };
  const seen = new Set<string>();
  const untimed: T[] = [];

  for (const t of tasks) {
    if (seen.has(t.id)) continue;          // the same task can arrive from both dates
    seen.add(t.id);
    if (SETTLED.has(t.status)) continue;

    const due = dueAt(t);
    if (!due) {
      // No set time means "some time today". Only offer it on the shift whose
      // date it belongs to, and after the timed tasks.
      const date = t.fetched_date || String(t.task_date || '').slice(0, 10);
      if (date === localDate(now)) untimed.push(t);
      continue;
    }

    const at = due.getTime();
    if (at < shift.start.getTime()) { out.previousShift.push(t); continue; }
    if (at >= shift.end.getTime()) continue;            // next shift's work

    // Someone has started it: it is current, whatever the clock says.
    if (t.status === 'in_progress') { out.now.push(t); continue; }

    if (at < from) out.earlier.push(t);
    else if (at <= to) out.now.push(t);
    else out.later.push(t);
  }

  const byDue = (a: T, b: T) => (dueAt(a)?.getTime() ?? 0) - (dueAt(b)?.getTime() ?? 0);
  out.now.sort(byDue).push(...untimed);
  out.earlier.sort(byDue);
  out.later.sort(byDue);
  out.previousShift.sort(byDue);
  return out;
}
