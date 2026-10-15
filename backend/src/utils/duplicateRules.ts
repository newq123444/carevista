// ────────────────────────────────────────────────────────────────────────────
// When is a new care note probably the same care as one already recorded?
//
// Two carers on the same floor, neither knowing the other has been in, is the
// commonest way a care record goes wrong: the resident is offered the same
// care twice, or the record says it happened twice when it happened once —
// and a doubled drink makes a fluid chart look fine when it is not.
//
// The rules, all relative to WHEN THE CARE HAPPENED (the phone's time for a
// note made offline), not when it reached the server:
//   • Same kind of care for the same person within the window → probably the
//     same care. Ask before saving; never silently refuse — sometimes two is
//     right.
//   • A meal and a drink are different kinds, even though both are "eating
//     and drinking" notes. Two drinks are only the same drink if the amount
//     matches and they are within 10 minutes.
//   • Observations, behaviour, incidents and medicine notes legitimately
//     repeat within minutes: 5-minute window.
// Pure; tested in backend/tests/duplicaterules.test.mjs.
// ────────────────────────────────────────────────────────────────────────────

export interface NoteLike {
  noteType: string;
  fluidIntakeMl?: number | null;
  foodEatenPercent?: number | null;
}

const QUICK_REPEAT_IS_NORMAL = new Set(['nursing_observation', 'incident_note', 'behaviour', 'medication_note']);

/** The kind of care, for duplicate purposes. */
export function duplicateKind(n: NoteLike): string {
  if (n.noteType === 'nutrition') {
    const hasFood = n.foodEatenPercent !== null && n.foodEatenPercent !== undefined;
    const hasDrink = n.fluidIntakeMl !== null && n.fluidIntakeMl !== undefined;
    return hasDrink && !hasFood ? 'nutrition:drink' : 'nutrition:meal';
  }
  return n.noteType;
}

export function duplicateWindowMinutes(kind: string): number {
  if (kind === 'nutrition:drink') return 10;
  return QUICK_REPEAT_IS_NORMAL.has(kind) ? 5 : 20;
}

/** Is `existing` (made `minutesApart` minutes from the new one) probably the same care? */
export function isLikelyDuplicate(fresh: NoteLike, existing: NoteLike, minutesApart: number): boolean {
  const k = duplicateKind(fresh);
  if (duplicateKind(existing) !== k) return false;
  if (Math.abs(minutesApart) > duplicateWindowMinutes(k)) return false;
  if (k === 'nutrition:drink') {
    const a = fresh.fluidIntakeMl ?? null, b = existing.fluidIntakeMl ?? null;
    return a === null || b === null ? true : Number(a) === Number(b);
  }
  return true;
}

/** The widest window any kind uses — what to fetch candidates over. */
export const MAX_WINDOW_MINUTES = 20;

export function describeDuplicate(existing: { authorName?: string | null; byMe: boolean; minutesAgo: number; noteType: string }): string {
  const who = existing.byMe ? 'You' : (existing.authorName || 'Another member of staff');
  const m = Math.max(0, Math.round(existing.minutesAgo));
  const when = m < 1 ? 'less than a minute ago' : m === 1 ? '1 minute ago' : `${m} minutes ago`;
  return `${who} already recorded a ${existing.noteType.replace(/_/g, ' ')} note for this resident ${when}. Check it is not the same care before saving another.`;
}
