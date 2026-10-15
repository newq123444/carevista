// When a carer records care from a resident's page instead of the round, the
// matching task on the round should be ticked off too — otherwise the round
// still shows "Morning personal care: overdue" for something already written
// down, and the next carer does it twice. Pure; tested in recordmatch.test.mjs.
import { specForTask, specForType, type RecordType } from './quickOptions';

const CLOSED = new Set(['done', 'deferred', 'na']);
const DRINK = /\b(drink|drinks|fluid|fluids|hydration)\b/i;

export function matchingTask<T extends { resident_id: string; status: string; task_name?: string | null; note_type?: string | null; category?: string | null; handled_in?: string | null; due_time?: string | null }>(
  tasks: T[], residentId: string, type: RecordType,
): T | null {
  const noteType = specForType(type).noteType;
  const open = tasks.filter(t => t.resident_id === residentId && !CLOSED.has(t.status) && t.handled_in !== 'emar');
  const fits = open.filter(t => {
    const isDrink = DRINK.test(t.task_name || '');
    if (type === 'fluids') return isDrink;
    if (type === 'nutrition' && isDrink) return false;
    const spec = specForTask(t);
    return (t.note_type === noteType) || (!!spec && spec.noteType === noteType);
  });
  // Tasks arrive earlier-first; keep that order so overdue care is closed first.
  return fits[0] ?? null;
}
