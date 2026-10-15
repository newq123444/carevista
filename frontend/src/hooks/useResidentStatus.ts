// ────────────────────────────────────────────────────────────────────────────
// What a carer or nurse needs to know about each resident at a glance —
// gathered from the data the app already fetches, and reduced to at most a
// few short flags per person. The order is the order of urgency: someone
// raised as "not themselves" comes before someone behind on fluids, which
// comes before a review that is due.
// ────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useDeteriorationAlerts, useResidentAbsences, usePresence } from './index';
import { useIntakeToday } from './useIntakeToday';
import { useShiftTasks } from './useShiftTasks';
import type { IconName } from '../components/Icon';

export interface Flag { tone: 'red' | 'amber' | 'blue' | 'grey' | 'green'; label: string; icon?: IconName; count?: number; vars?: Record<string, string | number> }
export interface ResidentStatus { flags: Flag[]; dot: 'red' | 'amber' | null; away: string | null; dueNow: number; overdue: number }

const AREA_LABEL: Record<string, string> = { fluid: 'Behind on fluids', food: 'Eating less', bowels: 'Bowels' };
const AREA_ICON: Record<string, IconName> = { fluid: 'droplets', food: 'utensils', bowels: 'droplets' };

export function useResidentStatus() {
  const { data: absences } = useResidentAbsences(true);
  const { data: alerts } = useDeteriorationAlerts('open');
  const { days } = useIntakeToday();
  const { round } = useShiftTasks();
  const { data: presence } = usePresence();

  return useMemo(() => {
    const map = new Map<string, ResidentStatus>();
    const get = (id: string) => {
      let s = map.get(id);
      if (!s) { s = { flags: [], dot: null, away: null, dueNow: 0, overdue: 0 }; map.set(id, s); }
      return s;
    };
    for (const a of (Array.isArray(absences) ? absences : []) as any[]) {
      const s = get(a.resident_id);
      s.away = String(a.absence_type || 'away').replace(/_/g, ' ');
      s.flags.push({ tone: 'blue', label: a.absence_type === 'hospital' ? 'In hospital' : 'Away', icon: 'bed' });
    }
    for (const al of (Array.isArray(alerts) ? alerts : []) as any[]) {
      const s = get(al.resident_id);
      if (!s.flags.some(f => f.label === 'Not themselves' || f.label === 'Emergency signs')) {
        s.flags.push({ tone: 'red', label: al.emergency ? 'Emergency signs' : 'Not themselves', icon: 'siren' });
      }
    }
    for (const d of days) {
      const c = d.concerns.find(x => x.level === 'red') || d.concerns.find(x => x.level === 'amber');
      if (c) get(d.residentId).flags.push({ tone: c.level, label: AREA_LABEL[c.area] || 'Check intake', icon: AREA_ICON[c.area] });
    }
    // Someone else is with them right now (v89b): say who, so nobody doubles up.
    for (const p of (Array.isArray(presence) ? presence : []) as any[]) {
      if (p.mine) continue;
      get(p.residentId).flags.push({ tone: 'blue', label: 'With {name}', vars: { name: String(p.userName || '').split(' ')[0] }, icon: 'user-round' });
    }
    for (const t of round.now as any[]) get(t.resident_id).dueNow++;
    for (const t of round.earlier as any[]) get(t.resident_id).overdue++;
    for (const [, s] of map) {
      if (s.overdue > 0 && !s.away) s.flags.push({ tone: 'amber', label: '{n} not recorded', count: s.overdue, icon: 'clock' });
      const order = { red: 0, amber: 1, blue: 2, grey: 3, green: 4 } as const;
      s.flags.sort((a, b) => order[a.tone] - order[b.tone]);
      s.dot = s.away ? null : s.flags.some(f => f.tone === 'red') ? 'red' : s.flags.some(f => f.tone === 'amber') ? 'amber' : null;
    }
    return map;
  }, [absences, alerts, days, round, presence]);
}
