// ────────────────────────────────────────────────────────────────────────────
// The tasks for the shift on now, sorted into now / earlier / later.
//
// One hook so the deck, the simple home screen and handover all agree on what
// "now" means. If they disagreed, a carer could see "3 to do now" on the home
// screen and find five cards in the round.
//
// Re-evaluates every minute: a task due at 10:30 should slide into the round at
// 10:00 without anybody refreshing.
// ────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { useTasks } from './index';
import { buildRound, datesForShift, DEFAULT_ROUND, type Round } from '../utils/roundWindow';

export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useShiftTasks() {
  const now = useNow();
  const dates = datesForShift(now, DEFAULT_ROUND);

  // A night shift spans two task lists. When the shift sits within one date the
  // second query has the same key as the first, so react-query serves it from
  // the same request rather than fetching twice.
  const first = useTasks({ date: dates[0] });
  const second = useTasks({ date: dates[1] ?? dates[0] });

  const all = useMemo(() => {
    const tag = (rows: any, date: string) =>
      (Array.isArray(rows) ? rows : []).map((t: any) => ({ ...t, fetched_date: date }));
    const merged = [...tag(first.data, dates[0])];
    if (dates[1]) merged.push(...tag(second.data, dates[1]));
    return merged;
  }, [first.data, second.data, dates[0], dates[1]]);

  const round: Round<any> = useMemo(() => buildRound(all, now, DEFAULT_ROUND), [all, now]);

  const doneThisShift = useMemo(() => all.filter((t: any) => {
    if (t.status !== 'done' || !t.completed_at) return false;
    const at = new Date(t.completed_at).getTime();
    return at >= round.shift.start.getTime() && at < round.shift.end.getTime();
  }).length, [all, round.shift]);

  return {
    now,
    all,
    round,
    doneThisShift,
    isLoading: first.isLoading || (!!dates[1] && second.isLoading),
  };
}
