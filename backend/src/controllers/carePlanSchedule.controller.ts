// ────────────────────────────────────────────────────────────────────────────
// Plan the care day: one thing, at one time, from one section of the plan.
//
// Adding an item creates a task template for that resident, so the round
// shows it at that time and recording it ticks it off. Removing it switches
// the template off and clears today's not-yet-done rows. A record already
// made is never touched.
// ────────────────────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';
import { removeUnactionedTasks, restoreTasksForToday } from './tasks.controller';
import { scheduleTaskShape, type ScheduleShape } from '../services/planSchedule';
import type { PoolClient } from 'pg';

/**
 * One timed item: a resident task template plus the schedule row that points
 * at it. Used by "add a time" and by applying an assessment to the plan.
 * Runs inside the caller's transaction.
 */
export async function insertScheduleItem(client: PoolClient, p: {
  careHomeId: string; planId: string; sectionId: string; residentId: string; shape: ScheduleShape; userId: string;
}): Promise<any> {
  const { shape } = p;
  const { rows: [tpl] } = await client.query(
    `INSERT INTO care_task_templates
       (care_home_id, name, icon, category, shift, due_time, window_mins, sort_order, applies_to,
        frequency, day_of_week, resident_id, note_type, handled_in, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,50,'resident',$8,$9,$10,$11,'care_note',TRUE) RETURNING id`,
    [p.careHomeId, shape.name, shape.icon, shape.category, shape.shift, shape.dueTime, shape.windowMins,
     shape.frequency, shape.dayOfWeek, p.residentId, shape.noteType]);
  const { rows: [row] } = await client.query(
    `INSERT INTO care_plan_schedule (care_home_id, care_plan_id, section_id, resident_id, due_time, day_of_week, what, template_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [p.careHomeId, p.planId, p.sectionId, p.residentId, shape.dueTime, shape.dayOfWeek, shape.name, tpl.id, p.userId]);
  return row;
}

export async function addScheduleItem(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id: planId, sectionId } = req.params;
    const b = req.body || {};
    const { rows: [sec] } = await query(
      `SELECT s.id, s.domain, p.resident_id, p.status
         FROM care_plan_sections s JOIN care_plans p ON p.id = s.care_plan_id
        WHERE s.id = $1 AND p.id = $2 AND p.care_home_id = $3`, [sectionId, planId, careHomeId]);
    if (!sec) throw new AppError(404, 'Care plan section not found');
    if (sec.status === 'archived') throw new AppError(409, 'This plan is archived');

    const { rows: [ct] } = await query(`SELECT note_type FROM care_plan_section_types WHERE domain_key = $1 AND care_home_id = $2`, [sec.domain, careHomeId]).catch(() => ({ rows: [] as any[] }));
    const shape = scheduleTaskShape({ domain: sec.domain, time: b.time, what: b.what, dayOfWeek: b.dayOfWeek ?? null, noteType: ct?.note_type });
    if ('error' in shape) throw new AppError(400, shape.error);

    const item = await withTransaction(client => insertScheduleItem(client, {
      careHomeId, planId, sectionId, residentId: sec.resident_id, shape, userId: req.user!.id,
    }));

    // Today's round gets it straight away rather than tomorrow.
    if (item.template_id) await restoreTasksForToday(careHomeId, item.template_id, sec.resident_id).catch(() => undefined);

    await auditLog({
      careHomeId, actorId: req.user!.id, actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_PLAN_SCHEDULE_ADDED', entityType: 'care_plan', entityId: planId,
      afterData: { sectionId, time: shape.dueTime, what: shape.name }, ip: req.ip,
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function removeScheduleItem(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { rows: [row] } = await query(
      `UPDATE care_plan_schedule SET active = FALSE, removed_by = $1, removed_at = NOW()
        WHERE id = $2 AND care_home_id = $3 AND active RETURNING *`, [req.user!.id, req.params.itemId, careHomeId]);
    if (!row) throw new AppError(404, 'Not found, or already removed');
    let removed = 0;
    if (row.template_id) {
      await query(`UPDATE care_task_templates SET active = FALSE WHERE id = $1 AND care_home_id = $2`, [row.template_id, careHomeId]);
      removed = (await removeUnactionedTasks(careHomeId, row.template_id, row.resident_id)).removed;
    }
    await auditLog({
      careHomeId, actorId: req.user!.id, actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_PLAN_SCHEDULE_REMOVED', entityType: 'care_plan', entityId: row.care_plan_id,
      afterData: { itemId: row.id, what: row.what }, ip: req.ip,
    });
    res.json({ ok: true, removedFromToday: removed });
  } catch (err) { next(err); }
}
