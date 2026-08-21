import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { auditLog } from '../services/audit.service';

// Fluid, food and repositioning charts.
//
// Care homes keep these as paper charts at the end of the bed. They are the
// records that catch dehydration, weight loss and pressure damage before they
// become harm — and the ones inspectors most often find incomplete.
//
// Deliberate design choice: staff already record fluid_intake_ml,
// food_eaten_percent and position on a care note. This module does NOT ask
// them to enter the same thing twice. It reads what is already there, compares
// it against a target set for that resident, and shows the shortfall. Adding a
// second place to record the same number is how paper-to-digital projects fail.

function toDateStr(d: Date) { return d.toISOString().slice(0, 10); }

export async function listTargets(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT t.*, r.first_name, r.last_name, r.room_number,
              u.first_name || ' ' || u.last_name AS set_by_name
       FROM resident_chart_targets t
       JOIN residents r ON r.id = t.resident_id
       LEFT JOIN users u ON u.id = t.set_by
       WHERE t.care_home_id = $1 AND t.active = TRUE
       ORDER BY r.last_name`, [chId]);
    res.json(rows.map(t => ({
      id: t.id,
      residentId: t.resident_id,
      residentName: `${t.first_name} ${t.last_name}`,
      roomNumber: t.room_number,
      monitorFluids: t.monitor_fluids,
      fluidTargetMl: t.fluid_target_ml,
      fluidMinimumMl: t.fluid_minimum_ml,
      monitorOutput: t.monitor_output,
      monitorFood: t.monitor_food,
      foodMinimumPercent: t.food_minimum_percent,
      monitorRepositioning: t.monitor_repositioning,
      repositionIntervalHours: t.reposition_interval_hours,
      monitorWeight: t.monitor_weight,
      monitorBowels: t.monitor_bowels,
      bowelAlertDays: t.bowel_alert_days,
      reason: t.reason,
      startedOn: t.started_on,
      reviewDate: t.review_date,
      setByName: t.set_by_name,
    })));
  } catch (err) { next(err); }
}

export async function setTarget(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const residentId = b.residentId || b.resident_id;
    if (!residentId) return res.status(400).json({ error: 'A resident is required' });

    const { rows: [own] } = await query(
      `SELECT id FROM residents WHERE id = $1 AND care_home_id = $2`, [residentId, chId]);
    if (!own) return res.status(404).json({ error: 'Resident not found' });

    const monitorFluids = b.monitorFluids === true || b.monitor_fluids === true;
    const monitorFood = b.monitorFood === true || b.monitor_food === true;
    const monitorRepo = b.monitorRepositioning === true || b.monitor_repositioning === true;
    const fluidTarget = b.fluidTargetMl ?? b.fluid_target_ml ?? null;
    const interval = b.repositionIntervalHours ?? b.reposition_interval_hours ?? null;

    if (monitorFluids && !fluidTarget) {
      return res.status(400).json({ error: 'Set a daily fluid target so the chart has something to measure against' });
    }
    if (monitorRepo && !interval) {
      return res.status(400).json({ error: 'Set how often this person should be repositioned' });
    }
    if (fluidTarget && (Number(fluidTarget) < 200 || Number(fluidTarget) > 5000)) {
      return res.status(400).json({ error: 'Fluid target should be between 200ml and 5000ml' });
    }
    if (interval && (Number(interval) < 1 || Number(interval) > 12)) {
      return res.status(400).json({ error: 'Repositioning interval should be between 1 and 12 hours' });
    }

    // One active target row per resident; a change supersedes the old one.
    await query(
      `UPDATE resident_chart_targets SET active = FALSE, updated_at = NOW()
       WHERE resident_id = $1 AND active = TRUE`, [residentId]);

    const anyMonitoring = monitorFluids || monitorFood || monitorRepo ||
      b.monitorWeight === true || b.monitorBowels === true || b.monitorOutput === true;
    if (!anyMonitoring) {
      await auditLog({
        careHomeId: chId, actorId: req.user!.id,
        actorName: `${req.user!.first_name} ${req.user!.last_name}`,
        action: 'MONITORING_STOPPED', entityType: 'resident', entityId: residentId,
      });
      return res.json({ ok: true, monitoring: false });
    }

    const { rows: [row] } = await query(
      `INSERT INTO resident_chart_targets
         (care_home_id, resident_id, monitor_fluids, fluid_target_ml, fluid_minimum_ml,
          monitor_output, monitor_food, food_minimum_percent, monitor_repositioning,
          reposition_interval_hours, monitor_weight, monitor_bowels, bowel_alert_days,
          reason, review_date, set_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
      [chId, residentId, monitorFluids, fluidTarget,
       b.fluidMinimumMl ?? b.fluid_minimum_ml ?? null,
       b.monitorOutput === true, monitorFood,
       b.foodMinimumPercent ?? b.food_minimum_percent ?? null,
       monitorRepo, interval,
       b.monitorWeight === true, b.monitorBowels === true,
       b.bowelAlertDays ?? b.bowel_alert_days ?? 3,
       b.reason || null, b.reviewDate || b.review_date || null, req.user!.id]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'MONITORING_STARTED', entityType: 'resident', entityId: residentId,
      afterData: { monitorFluids, monitorFood, monitorRepo, fluidTarget, interval },
    });
    res.status(201).json({ id: row.id, monitoring: true });
  } catch (err) { next(err); }
}

// One resident's chart for a given day, built from care notes already written.
export async function getChart(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const residentId = req.params.residentId;
    const date = String(req.query.date || toDateStr(new Date()));

    const { rows: [resident] } = await query(
      `SELECT id, first_name, last_name, room_number FROM residents
       WHERE id = $1 AND care_home_id = $2`, [residentId, chId]);
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    const { rows: [target] } = await query(
      `SELECT * FROM resident_chart_targets WHERE resident_id = $1 AND active = TRUE`, [residentId]);

    // Every entry that carries a chartable value, in time order.
    const { rows: entries } = await query(
      `SELECT n.id, n.created_at, n.note_type, n.content,
              n.fluid_intake_ml, n.fluid_output_ml, n.food_eaten_percent, n.position,
              u.first_name || ' ' || u.last_name AS recorded_by
       FROM care_notes n
       LEFT JOIN users u ON u.id = n.author_id
       WHERE n.resident_id = $1 AND n.care_home_id = $2 AND n.deleted_at IS NULL
         AND n.created_at >= $3::date AND n.created_at < $3::date + 1
         AND (n.fluid_intake_ml IS NOT NULL OR n.fluid_output_ml IS NOT NULL
              OR n.food_eaten_percent IS NOT NULL OR n.position IS NOT NULL)
       ORDER BY n.created_at`, [residentId, chId, date]);

    const fluidEntries = entries.filter(e => e.fluid_intake_ml != null);
    const outputEntries = entries.filter(e => e.fluid_output_ml != null);
    const foodEntries = entries.filter(e => e.food_eaten_percent != null);
    const repoEntries = entries.filter(e => e.position);

    const fluidTotal = fluidEntries.reduce((s, e) => s + Number(e.fluid_intake_ml || 0), 0);
    const outputTotal = outputEntries.reduce((s, e) => s + Number(e.fluid_output_ml || 0), 0);
    const foodAvg = foodEntries.length
      ? Math.round(foodEntries.reduce((s, e) => s + Number(e.food_eaten_percent || 0), 0) / foodEntries.length)
      : null;

    // Repositioning gaps: where the time between turns exceeded the interval.
    const intervalHours = target?.reposition_interval_hours || null;
    const gaps: any[] = [];
    if (intervalHours && repoEntries.length) {
      for (let i = 1; i < repoEntries.length; i++) {
        const prev = new Date(repoEntries[i - 1].created_at).getTime();
        const cur = new Date(repoEntries[i].created_at).getTime();
        const hrs = (cur - prev) / 3600000;
        if (hrs > intervalHours + 0.5) {
          gaps.push({
            from: repoEntries[i - 1].created_at,
            to: repoEntries[i].created_at,
            hours: Math.round(hrs * 10) / 10,
          });
        }
      }
    }

    const isToday = date === toDateStr(new Date());
    const hoursElapsed = isToday ? new Date().getHours() + new Date().getMinutes() / 60 : 24;
    const expectedByNow = target?.fluid_target_ml
      ? Math.round((Number(target.fluid_target_ml) * Math.min(hoursElapsed, 24)) / 24) : null;

    res.json({
      residentId,
      residentName: `${resident.first_name} ${resident.last_name}`,
      roomNumber: resident.room_number,
      date,
      monitoring: target ? {
        fluids: target.monitor_fluids,
        fluidTargetMl: target.fluid_target_ml,
        fluidMinimumMl: target.fluid_minimum_ml,
        output: target.monitor_output,
        food: target.monitor_food,
        foodMinimumPercent: target.food_minimum_percent,
        repositioning: target.monitor_repositioning,
        repositionIntervalHours: intervalHours,
        weight: target.monitor_weight,
        bowels: target.monitor_bowels,
        reason: target.reason,
      } : null,
      fluid: {
        totalMl: fluidTotal,
        targetMl: target?.fluid_target_ml ?? null,
        percentOfTarget: target?.fluid_target_ml
          ? Math.round((fluidTotal / Number(target.fluid_target_ml)) * 100) : null,
        expectedByNowMl: expectedByNow,
        behindSchedule: expectedByNow != null && fluidTotal < expectedByNow * 0.75,
        belowMinimum: target?.fluid_minimum_ml != null && !isToday &&
          fluidTotal < Number(target.fluid_minimum_ml),
        entries: fluidEntries.map(e => ({
          id: e.id, at: e.created_at, ml: e.fluid_intake_ml, recordedBy: e.recorded_by,
        })),
      },
      output: {
        totalMl: outputTotal,
        entries: outputEntries.map(e => ({
          id: e.id, at: e.created_at, ml: e.fluid_output_ml, recordedBy: e.recorded_by,
        })),
      },
      food: {
        averagePercent: foodAvg,
        mealsRecorded: foodEntries.length,
        belowMinimum: target?.food_minimum_percent != null && foodAvg != null &&
          foodAvg < Number(target.food_minimum_percent),
        entries: foodEntries.map(e => ({
          id: e.id, at: e.created_at, percent: e.food_eaten_percent,
          note: e.content, recordedBy: e.recorded_by,
        })),
      },
      repositioning: {
        count: repoEntries.length,
        expectedCount: intervalHours ? Math.floor(24 / intervalHours) : null,
        intervalHours,
        gaps,
        entries: repoEntries.map(e => ({
          id: e.id, at: e.created_at, position: e.position, recordedBy: e.recorded_by,
        })),
      },
      // If nothing was charted at all, say so plainly rather than showing zeros.
      noEntries: entries.length === 0,
    });
  } catch (err) { next(err); }
}

// Home-wide: who is falling short today. This is the shift-lead's screen.
export async function getAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT t.*, r.first_name, r.last_name, r.room_number,
              COALESCE(f.total_ml, 0)::int AS fluid_today,
              f.entries::int AS fluid_entries,
              fd.avg_percent::int AS food_today,
              rp.last_position_at,
              rp.reposition_count::int AS reposition_count
       FROM resident_chart_targets t
       JOIN residents r ON r.id = t.resident_id
       LEFT JOIN LATERAL (
         SELECT SUM(n.fluid_intake_ml) AS total_ml, COUNT(*) AS entries FROM care_notes n
         WHERE n.resident_id = t.resident_id AND n.deleted_at IS NULL
           AND n.fluid_intake_ml IS NOT NULL AND n.created_at::date = CURRENT_DATE) f ON TRUE
       LEFT JOIN LATERAL (
         SELECT AVG(n.food_eaten_percent) AS avg_percent FROM care_notes n
         WHERE n.resident_id = t.resident_id AND n.deleted_at IS NULL
           AND n.food_eaten_percent IS NOT NULL AND n.created_at::date = CURRENT_DATE) fd ON TRUE
       LEFT JOIN LATERAL (
         SELECT MAX(n.created_at) AS last_position_at, COUNT(*) AS reposition_count
         FROM care_notes n
         WHERE n.resident_id = t.resident_id AND n.deleted_at IS NULL
           AND n.position IS NOT NULL AND n.created_at > NOW() - INTERVAL '24 hours') rp ON TRUE
       WHERE t.care_home_id = $1 AND t.active = TRUE
         AND r.active = TRUE AND r.discharge_date IS NULL
         AND NOT EXISTS (SELECT 1 FROM resident_absences ab
                         WHERE ab.resident_id = r.id AND ab.actual_return IS NULL)
       ORDER BY r.last_name`, [chId]);

    const now = new Date();
    const hoursElapsed = now.getHours() + now.getMinutes() / 60;
    const alerts: any[] = [];

    for (const r of rows) {
      const name = `${r.first_name} ${r.last_name}`;
      if (r.monitor_fluids && r.fluid_target_ml) {
        const expected = (Number(r.fluid_target_ml) * Math.min(hoursElapsed, 24)) / 24;
        // Only meaningful after the morning has actually happened.
        if (hoursElapsed >= 10 && Number(r.fluid_today) < expected * 0.7) {
          alerts.push({
            residentId: r.resident_id, residentName: name, roomNumber: r.room_number,
            type: 'fluid',
            severity: Number(r.fluid_today) < expected * 0.4 ? 'high' : 'medium',
            message: `${r.fluid_today}ml of ${r.fluid_target_ml}ml target so far today`,
            detail: r.fluid_entries ? `${r.fluid_entries} drink${r.fluid_entries === 1 ? '' : 's'} recorded` : 'Nothing recorded today',
          });
        }
      }
      if (r.monitor_food && r.food_minimum_percent != null && r.food_today != null &&
          Number(r.food_today) < Number(r.food_minimum_percent)) {
        alerts.push({
          residentId: r.resident_id, residentName: name, roomNumber: r.room_number,
          type: 'food', severity: 'medium',
          message: `Eating ${r.food_today}% of meals (alert below ${r.food_minimum_percent}%)`,
          detail: null,
        });
      }
      if (r.monitor_repositioning && r.reposition_interval_hours) {
        const last = r.last_position_at ? new Date(r.last_position_at) : null;
        const hrs = last ? (now.getTime() - last.getTime()) / 3600000 : null;
        if (hrs == null) {
          alerts.push({
            residentId: r.resident_id, residentName: name, roomNumber: r.room_number,
            type: 'repositioning', severity: 'high',
            message: 'No repositioning recorded in the last 24 hours',
            detail: `Should be repositioned every ${r.reposition_interval_hours} hours`,
          });
        } else if (hrs > Number(r.reposition_interval_hours)) {
          alerts.push({
            residentId: r.resident_id, residentName: name, roomNumber: r.room_number,
            type: 'repositioning',
            severity: hrs > Number(r.reposition_interval_hours) * 1.5 ? 'high' : 'medium',
            message: `Last repositioned ${Math.round(hrs * 10) / 10} hours ago`,
            detail: `Interval is ${r.reposition_interval_hours} hours`,
          });
        }
      }
    }

    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

    res.json({
      residentsMonitored: rows.length,
      alerts,
      highCount: alerts.filter(a => a.severity === 'high').length,
      generatedAt: now.toISOString(),
    });
  } catch (err) { next(err); }
}
