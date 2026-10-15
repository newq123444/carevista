// Turning "reposition at 14:00" from a care plan section into a task the round
// understands: which note it writes, which shift it sits on, how long the
// window is. Pure; tested in backend/tests/planschedule.test.mjs.

const DOMAIN_TASK: Record<string, { noteType: string; category: string }> = {
  personal_care:           { noteType: 'personal_care',       category: 'personal_care' },
  mobility_transfers:      { noteType: 'personal_care',       category: 'mobility' },
  nutrition_hydration:     { noteType: 'nutrition',           category: 'nutrition' },
  continence:              { noteType: 'continence',          category: 'continence' },
  skin_integrity:          { noteType: 'repositioning',       category: 'skin' },
  pain:                    { noteType: 'nursing_observation', category: 'observation' },
  breathing_circulation:   { noteType: 'nursing_observation', category: 'observation' },
  communication_sensory:   { noteType: 'social_wellbeing',    category: 'wellbeing' },
  cognition_mental_health: { noteType: 'social_wellbeing',    category: 'wellbeing' },
  behaviour_support:       { noteType: 'behaviour',           category: 'wellbeing' },
  social_emotional:        { noteType: 'social_wellbeing',    category: 'wellbeing' },
  night_care:              { noteType: 'sleep',               category: 'observation' },
  safety_risk:             { noteType: 'fall_observation',    category: 'observation' },
  end_of_life:             { noteType: 'end_of_life',         category: 'personal_care' },
};

export interface ScheduleShape {
  name: string; icon: string; category: string; noteType: string; shift: 'day' | 'night';
  dueTime: string; windowMins: number; frequency: 'daily' | 'weekly'; dayOfWeek: number | null;
}

export function scheduleTaskShape(input: { domain: string; time: unknown; what: unknown; dayOfWeek?: unknown; noteType?: string }): ScheduleShape | { error: string } {
  if (input.domain === 'medication') {
    return { error: 'Medicines are scheduled on the MAR chart, where they are signed for — not as care tasks.' };
  }
  // The home's own sections (v90) say which note the round writes.
  const map = DOMAIN_TASK[input.domain]
    || (/^custom_[a-z0-9]{8,24}$/.test(input.domain) ? { noteType: input.noteType || 'personal_care', category: 'personal_care' } : undefined);
  if (!map) return { error: 'Unknown care plan section' };
  const t = String(input.time || '').trim();
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(t);
  if (!m) return { error: 'Give a time like 08:30' };
  const what = String(input.what || '').trim().replace(/\s+/g, ' ');
  if (what.length < 3) return { error: 'Say what should be done' };
  if (what.length > 120) return { error: 'Keep it short (120 characters) — detail belongs in the plan itself' };
  let day: number | null = null;
  if (input.dayOfWeek !== null && input.dayOfWeek !== undefined && input.dayOfWeek !== '') {
    const d = Number(input.dayOfWeek);
    if (!Number.isInteger(d) || d < 0 || d > 6) return { error: 'Day must be 0 (Sunday) to 6 (Saturday)' };
    day = d;
  }
  const hh = Number(m[1]);
  return {
    name: what.charAt(0).toUpperCase() + what.slice(1),
    icon: '📋',
    category: map.category,
    noteType: map.noteType,
    // Matches the round's shift boundaries (07:00 and 20:00).
    shift: hh >= 7 && hh < 20 ? 'day' : 'night',
    dueTime: `${String(hh).padStart(2, '0')}:${m[2]}`,
    windowMins: 60,
    frequency: day === null ? 'daily' : 'weekly',
    dayOfWeek: day,
  };
}

/** "Every 2 hours from 08:00 to 20:00" → ['08:00','10:00',…,'20:00']. */
export function everyNHours(from: string, to: string, hours: number): string[] {
  const p = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  if (!(hours >= 1 && hours <= 12)) return [];
  const a = p(from), b = p(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return [];
  const out: string[] = [];
  // Wraps past midnight for night-time regimes (22:00 → 06:00).
  const end = b >= a ? b : b + 24 * 60;
  for (let t = a; t <= end && out.length < 24; t += hours * 60) {
    const mm = t % (24 * 60);
    out.push(`${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`);
  }
  return out;
}
