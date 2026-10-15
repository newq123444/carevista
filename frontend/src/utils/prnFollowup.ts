// ────────────────────────────────────────────────────────────────────────────
// When to check whether an "as required" (PRN) dose worked.
//
// An hour after the dose is a sensible default for most PRN medicines given
// in care homes (pain relief, anxiety, nausea); the check can be recorded
// earlier if the effect is already clear. After two hours it is late, and
// says so. Pure — tested in backend/tests/prnfollowup.test.mjs.
// ────────────────────────────────────────────────────────────────────────────
export const PRN_CHECK_AFTER_MIN = 60;
export const PRN_LATE_AFTER_MIN = 120;

export type PrnState = 'waiting' | 'due' | 'late';

export function prnState(givenAt: Date | string, now: Date = new Date()) {
  const given = new Date(givenAt);
  const mins = Math.floor((now.getTime() - given.getTime()) / 60000);
  const dueAt = new Date(given.getTime() + PRN_CHECK_AFTER_MIN * 60000);
  const state: PrnState = mins < PRN_CHECK_AFTER_MIN ? 'waiting' : mins < PRN_LATE_AFTER_MIN ? 'due' : 'late';
  return { state, dueAt, minutesSinceDose: Math.max(0, mins), minutesUntilDue: Math.max(0, PRN_CHECK_AFTER_MIN - mins) };
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** One line for the card: "Check from 14:35", "Due now", "Late — given 3 hours ago". */
export function prnStateText(givenAt: Date | string, now: Date = new Date()): string {
  const s = prnState(givenAt, now);
  if (s.state === 'waiting') return `Check from ${hhmm(s.dueAt)}`;
  if (s.state === 'due') return 'Check now';
  const h = Math.floor(s.minutesSinceDose / 60);
  return `Late — given ${h} hour${h === 1 ? '' : 's'} ago`;
}

/** Sort: late first, then due, then waiting; oldest dose first within each. */
export function sortFollowups<T extends { created_at: string }>(rows: T[], now: Date = new Date()): T[] {
  const rank: Record<PrnState, number> = { late: 0, due: 1, waiting: 2 };
  return [...rows].sort((a, b) =>
    (rank[prnState(a.created_at, now).state] - rank[prnState(b.created_at, now).state])
    || a.created_at.localeCompare(b.created_at));
}
