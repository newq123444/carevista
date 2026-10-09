// ────────────────────────────────────────────────────────────────────────────
// Today's fluids, food and bowels for the whole home, summarised on the device.
//
// The window is the device's own local day. The server is asked for exactly
// those instants and does no judging of its own — see intakeSummary.ts.
// ────────────────────────────────────────────────────────────────────────────
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { monitoringApi } from '../services/api';
import { useNow } from './useShiftTasks';
import { summariseDay, type ResidentDay } from '../utils/intakeSummary';
import { localDate } from '../utils/roundWindow';

export function useIntakeToday(enabled = true) {
  const now = useNow();
  const day = localDate(now);
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const q = useQuery({
    queryKey: ['intake-today', day],
    queryFn: () => monitoringApi.today(from.toISOString(), to.toISOString()).then(r => r.data),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled,
  });

  const days: ResidentDay[] = useMemo(() => {
    const d: any = q.data;
    if (!d) return [];
    return summariseDay({
      residents: (d.residents || []).map((r: any) => ({ id: r.id, name: r.name, room: r.room, away: r.away })),
      todaysNotes: (d.notes || []).map((n: any) => ({
        residentId: n.resident_id,
        at: new Date(n.created_at),
        fluidMl: n.fluid_ml == null ? null : Number(n.fluid_ml),
        foodPct: n.food_pct == null ? null : Number(n.food_pct),
        bowelsOpened: n.bowels_opened,
        stoolType: n.stool_type,
        by: n.by,
      })),
      targets: (d.targets || []).map((t: any) => ({
        residentId: t.resident_id,
        monitorFluids: !!t.monitor_fluids,
        fluidTargetMl: t.fluid_target_ml == null ? null : Number(t.fluid_target_ml),
        fluidMinimumMl: t.fluid_minimum_ml == null ? null : Number(t.fluid_minimum_ml),
        monitorFood: !!t.monitor_food,
        foodMinimumPercent: t.food_minimum_percent == null ? null : Number(t.food_minimum_percent),
        monitorBowels: !!t.monitor_bowels,
        bowelAlertDays: t.bowel_alert_days == null ? null : Number(t.bowel_alert_days),
      })),
      lastOpened: new Map((d.lastOpened || []).map((l: any) => [l.resident_id, new Date(l.last_opened_at)])),
      now,
    });
  }, [q.data, now]);

  const red = days.filter(x => x.concerns.some(c => c.level === 'red')).length;
  const amber = days.filter(x => !x.concerns.some(c => c.level === 'red') && x.concerns.some(c => c.level === 'amber')).length;

  return { days, red, amber, now, isLoading: q.isLoading, isError: q.isError, refetch: q.refetch, updatedAt: (q as any).dataUpdatedAt };
}
