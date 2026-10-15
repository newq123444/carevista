// ────────────────────────────────────────────────────────────────────────────
// Pilot evidence report — before and after, from the records themselves.
//
// GET /reports/pilot?pilotFrom=YYYY-MM-DD&pilotTo=…[&baselineFrom=…&baselineTo=…]
//
// Days are UK days. Every count is made by SQL over the live tables, so the
// report can be re-run by anyone with access and give the same answer.
// The rules for turning counts into findings are in services/pilotMetrics.ts.
// ────────────────────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { FLUID_SQL, BOWELS_SQL } from './monitoring.controller';
import { compare, LIMITS, MIN_DENOMINATOR, type PeriodCounts, type ManualBaseline } from '../services/pilotMetrics';

const TZ = `'Europe/London'`;
const START = `($2::date)::timestamp AT TIME ZONE ${TZ}`;
const END = `($3::date + 1)::timestamp AT TIME ZONE ${TZ}`;

function period(from: unknown, to: unknown, label: string): [string, string] | null {
  if (!from && !to) return null;
  const f = String(from || ''), t = String(to || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new AppError(400, `${label}: dates must be YYYY-MM-DD`);
  const days = (Date.parse(t) - Date.parse(f)) / 86_400_000;
  if (days < 0) throw new AppError(400, `${label}: the end is before the start`);
  if (days > 366) throw new AppError(400, `${label}: at most a year`);
  return [f, t];
}

export async function countsFor(careHomeId: string, from: string, to: string): Promise<PeriodCounts> {
  const p = [careHomeId, from, to];
  const [tasks, fluids, bowels, weights, mca, prn, soft] = await Promise.all([
    query<any>(`
      WITH t AS (
        SELECT status, completed_at, ((task_date + due_time) AT TIME ZONE ${TZ}) AS due
          FROM care_tasks
         WHERE care_home_id = $1 AND task_date BETWEEN $2::date AND $3::date
           AND status <> 'na' AND handled_in IS DISTINCT FROM 'emar')
      SELECT COUNT(*)::int AS scheduled,
             COUNT(*) FILTER (WHERE status = 'done')::int AS done,
             COUNT(*) FILTER (WHERE status = 'deferred')::int AS deferred,
             COUNT(*) FILTER (WHERE status = 'done' AND completed_at IS NOT NULL
                               AND abs(extract(epoch FROM completed_at - due)) <= 3600)::int AS timely,
             COUNT(*) FILTER (WHERE status = 'done' AND completed_at IS NOT NULL
                               AND completed_at - due > INTERVAL '2 hours')::int AS late,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM completed_at - due) / 60)
               FILTER (WHERE status = 'done' AND completed_at IS NOT NULL) AS median_delay
        FROM t`, p),
    query<any>(`
      WITH days AS (SELECT generate_series($2::date, $3::date, INTERVAL '1 day')::date AS d),
      mon AS (SELECT t.resident_id, t.fluid_target_ml, r.admission_date, r.discharge_date
                FROM resident_chart_targets t JOIN residents r ON r.id = t.resident_id
               WHERE t.care_home_id = $1 AND t.active = TRUE AND t.monitor_fluids = TRUE),
      f AS (SELECT n.resident_id, (n.created_at AT TIME ZONE ${TZ})::date AS d,
                   COUNT(*) AS drinks, SUM(${FLUID_SQL}) AS ml
              FROM care_notes n
             WHERE n.care_home_id = $1 AND n.deleted_at IS NULL AND (${FLUID_SQL}) IS NOT NULL
               AND n.created_at >= ${START} AND n.created_at < ${END}
             GROUP BY 1, 2)
      SELECT COUNT(*)::int AS resident_days,
             COUNT(*) FILTER (WHERE COALESCE(f.drinks, 0) >= 4)::int AS days_4plus,
             COUNT(*) FILTER (WHERE mon.fluid_target_ml IS NOT NULL)::int AS days_with_target,
             COUNT(*) FILTER (WHERE mon.fluid_target_ml IS NOT NULL AND COALESCE(f.ml, 0) >= mon.fluid_target_ml)::int AS days_target_met
        FROM mon CROSS JOIN days
        LEFT JOIN f ON f.resident_id = mon.resident_id AND f.d = days.d
       WHERE mon.admission_date <= days.d AND (mon.discharge_date IS NULL OR mon.discharge_date > days.d)`, p),
    query<any>(`
      WITH days AS (SELECT generate_series($2::date, $3::date, INTERVAL '1 day')::date AS d),
      res AS (SELECT id, admission_date, discharge_date FROM residents WHERE care_home_id = $1),
      b AS (SELECT DISTINCT n.resident_id, (n.created_at AT TIME ZONE ${TZ})::date AS d
              FROM care_notes n
             WHERE n.care_home_id = $1 AND n.deleted_at IS NULL AND (${BOWELS_SQL}) IS NOT NULL
               AND n.created_at >= ${START} AND n.created_at < ${END})
      SELECT COUNT(*)::int AS resident_days,
             COUNT(b.resident_id)::int AS days_recorded
        FROM res CROSS JOIN days
        LEFT JOIN b ON b.resident_id = res.id AND b.d = days.d
       WHERE res.admission_date <= days.d AND (res.discharge_date IS NULL OR res.discharge_date > days.d)`, p),
    query<any>(`
      SELECT COUNT(*)::int AS residents,
             COUNT(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM resident_weights w
                WHERE w.resident_id = r.id AND w.weight_kg IS NOT NULL
                  AND w.created_at < ${END} AND w.created_at >= ${END} - INTERVAL '31 days'))::int AS weighed
        FROM residents r
       WHERE r.care_home_id = $1 AND r.admission_date <= $3::date
         AND (r.discharge_date IS NULL OR r.discharge_date > $3::date)`, p),
    query<any>(`
      SELECT COUNT(*) FILTER (WHERE completed_at >= ${START} AND completed_at < ${END})::int AS completed,
             COUNT(*) FILTER (WHERE status = 'completed' AND completed_at < ${END})::int AS current_at_end,
             COUNT(*) FILTER (WHERE status = 'completed' AND completed_at < ${END}
                               AND review_date IS NOT NULL AND review_date < $3::date)::int AS overdue_at_end
        FROM mca_assessments WHERE care_home_id = $1`, p),
    query<any>(`
      SELECT COUNT(*)::int AS given,
             COUNT(*) FILTER (WHERE prn_effect IS NOT NULL)::int AS recorded,
             COUNT(*) FILTER (WHERE prn_effect_at IS NOT NULL AND prn_effect_at - created_at <= INTERVAL '2 hours')::int AS within_2h
        FROM med_administrations
       WHERE care_home_id = $1 AND is_prn = TRUE AND status = 'given'
         AND created_at >= ${START} AND created_at < ${END}`, p),
    query<any>(`
      SELECT COUNT(*)::int AS raised,
             COUNT(acknowledged_at)::int AS acknowledged,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM acknowledged_at - raised_at) / 60)
               FILTER (WHERE acknowledged_at IS NOT NULL) AS median_ack,
             COUNT(*) FILTER (WHERE status = 'closed')::int AS closed
        FROM deterioration_alerts
       WHERE care_home_id = $1 AND raised_at >= ${START} AND raised_at < ${END}`, p),
  ]);
  const T = tasks.rows[0], F = fluids.rows[0], B = bowels.rows[0], W = weights.rows[0], M = mca.rows[0], P = prn.rows[0], S = soft.rows[0];
  const num = (v: any) => (v == null ? null : Number(v));
  return {
    tasksScheduled: T.scheduled, tasksDone: T.done, tasksDeferred: T.deferred, tasksTimely: T.timely, tasksLate: T.late,
    medianDelayMin: num(T.median_delay),
    fluidResidentDays: F.resident_days, fluidDays4Plus: F.days_4plus, fluidDaysWithTarget: F.days_with_target, fluidDaysTargetMet: F.days_target_met,
    bowelResidentDays: B.resident_days, bowelDaysRecorded: B.days_recorded,
    mcaCompleted: M.completed, mcaCurrentAtEnd: M.current_at_end, mcaOverdueAtEnd: M.overdue_at_end,
    prnGiven: P.given, prnEffectRecorded: P.recorded, prnEffectWithin2h: P.within_2h,
    softSignsRaised: S.raised, softSignsAcknowledged: S.acknowledged, softSignsMedianAckMin: num(S.median_ack), softSignsClosed: S.closed,
    residentsAtEnd: W.residents, residentsWeighed31d: W.weighed,
  };
}

export async function pilotReport(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const pilot = period(req.query.pilotFrom, req.query.pilotTo, 'Pilot period');
    if (!pilot) throw new AppError(400, 'Choose the pilot period');
    const baseline = period(req.query.baselineFrom, req.query.baselineTo, 'Baseline period');

    const { rows: [home] } = await query<any>(`SELECT name, settings FROM care_homes WHERE id = $1`, [careHomeId]);
    const manual: Record<string, ManualBaseline> = home?.settings?.pilot?.manual || {};

    const [b, p] = await Promise.all([
      baseline ? countsFor(careHomeId, baseline[0], baseline[1]) : Promise.resolve(null),
      countsFor(careHomeId, pilot[0], pilot[1]),
    ]);

    res.json({
      home: home?.name,
      generatedAt: new Date().toISOString(),
      generatedBy: `${req.user!.first_name} ${req.user!.last_name}`,
      periods: { baseline, pilot },
      rows: compare(b, p, manual),
      counts: { baseline: b, pilot: p },
      limits: LIMITS,
      minDenominator: MIN_DENOMINATOR,
    });
  } catch (err) { next(err); }
}
