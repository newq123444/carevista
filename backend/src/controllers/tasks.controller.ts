// src/controllers/tasks.controller.ts
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';
// SSE is optional - graceful fallback if not deployed
let sseManager: any = { broadcast: () => {}, addClient: () => {}, removeClient: () => {} };
try { sseManager = require('../utils/sse').sseManager; } catch { /* SSE not available */ }

// Default task templates — seeded once per care home
// applies_to values: 'all' = everyone, 'high_risk' = high risk_level only,
// or comma-separated mobility_status values (e.g. 'bed_bound,wheelchair')
const DEFAULT_TEMPLATES = [
  { name: 'Morning Personal Care',    icon: '🛁', category: 'personal_care',  shift: 'day',     due_time: '07:30', window_mins: 90,  sort_order: 1,  applies_to: 'all', frequency: 'daily',  day_of_week: null as number|null , note_type: 'personal_care', handled_in: 'care_note' },
  { name: 'Breakfast',               icon: '🌅', category: 'nutrition',      shift: 'day',     due_time: '08:00', window_mins: 60,  sort_order: 2,  applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'nutrition', handled_in: 'care_note' },
  { name: 'Morning Medications',     icon: '💊', category: 'medication',     shift: 'day',     due_time: '08:00', window_mins: 60,  sort_order: 3,  applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: null, handled_in: 'emar' },
  { name: 'Skin & Pressure Check',   icon: '🩺', category: 'observation',    shift: 'day',     due_time: '08:30', window_mins: 120, sort_order: 4,  applies_to: 'high_risk', frequency: 'daily', day_of_week: null , note_type: 'nursing_observation', handled_in: 'care_note' },
  { name: 'Fluid & Snack Check',     icon: '💧', category: 'nutrition',      shift: 'day',     due_time: '10:30', window_mins: 60,  sort_order: 6,  applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'nutrition', handled_in: 'care_note' },
  { name: 'Repositioning Check',     icon: '🔄', category: 'repositioning',  shift: 'all',     due_time: '10:00', window_mins: 60,  sort_order: 7,  applies_to: 'bed_bound,wheelchair', frequency: 'daily', day_of_week: null , note_type: 'repositioning', handled_in: 'care_note' },
  { name: 'Walking Exercise',        icon: '🚶', category: 'physical',       shift: 'day',     due_time: '11:00', window_mins: 60,  sort_order: 8,  applies_to: 'independent,walking_aid', frequency: 'daily', day_of_week: null , note_type: 'activities', handled_in: 'care_note' },
  { name: 'Seated Exercise',         icon: '💪', category: 'physical',       shift: 'day',     due_time: '11:00', window_mins: 60,  sort_order: 9,  applies_to: 'wheelchair,bed_bound', frequency: 'daily', day_of_week: null , note_type: 'activities', handled_in: 'care_note' },
  { name: 'Lunch',                   icon: '🍽', category: 'nutrition',      shift: 'day',     due_time: '12:00', window_mins: 60,  sort_order: 10, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'nutrition', handled_in: 'care_note' },
  { name: 'Afternoon Medications',   icon: '💊', category: 'medication',     shift: 'day',     due_time: '12:00', window_mins: 60,  sort_order: 11, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: null, handled_in: 'emar' },
  { name: 'Repositioning Check',     icon: '🔄', category: 'repositioning',  shift: 'all',     due_time: '14:00', window_mins: 60,  sort_order: 12, applies_to: 'bed_bound,wheelchair', frequency: 'daily', day_of_week: null , note_type: 'repositioning', handled_in: 'care_note' },
  { name: 'Afternoon Tea & Snack',   icon: '☕', category: 'nutrition',      shift: 'day',     due_time: '15:00', window_mins: 60,  sort_order: 13, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'nutrition', handled_in: 'care_note' },
  { name: 'Skin Moisturising',       icon: '🧴', category: 'personal_care',  shift: 'day',     due_time: '10:30', window_mins: 120, sort_order: 14, applies_to: 'bed_bound', frequency: 'daily', day_of_week: null , note_type: 'personal_care', handled_in: 'care_note' },
  { name: 'Continence Pad Check',    icon: '🩹', category: 'personal_care',  shift: 'all',     due_time: '10:00', window_mins: 120, sort_order: 15, applies_to: 'bed_bound,wheelchair', frequency: 'daily', day_of_week: null , note_type: 'continence', handled_in: 'care_note' },
  { name: 'Sensory / Wellbeing Activity', icon: '🎵', category: 'social_wellbeing', shift: 'day', due_time: '14:30', window_mins: 90, sort_order: 16, applies_to: 'all', frequency: 'daily', day_of_week: null , note_type: 'social_wellbeing', handled_in: 'care_note' },
  { name: 'Evening Personal Care',  icon: '🚿', category: 'personal_care',  shift: 'evening', due_time: '17:00', window_mins: 90,  sort_order: 17, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'personal_care', handled_in: 'care_note' },
  { name: 'Supper',                  icon: '🌙', category: 'nutrition',      shift: 'evening', due_time: '18:00', window_mins: 60,  sort_order: 18, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'nutrition', handled_in: 'care_note' },
  { name: 'Evening Medications',     icon: '💊', category: 'medication',     shift: 'evening', due_time: '18:00', window_mins: 60,  sort_order: 19, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: null, handled_in: 'emar' },
  { name: 'Repositioning Check',     icon: '🔄', category: 'repositioning',  shift: 'all',     due_time: '20:00', window_mins: 60,  sort_order: 20, applies_to: 'bed_bound,wheelchair', frequency: 'daily', day_of_week: null , note_type: 'repositioning', handled_in: 'care_note' },
  { name: 'Night Settle & Check',    icon: '😴', category: 'personal_care',  shift: 'evening', due_time: '21:00', window_mins: 90,  sort_order: 21, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'sleep', handled_in: 'care_note' },
  { name: 'Night Medications',       icon: '💊', category: 'medication',     shift: 'night',   due_time: '22:00', window_mins: 60,  sort_order: 22, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: null, handled_in: 'emar' },
  { name: 'Night Observation',       icon: '🌛', category: 'observation',    shift: 'night',   due_time: '02:00', window_mins: 120, sort_order: 23, applies_to: 'all', frequency: 'daily',  day_of_week: null , note_type: 'sleep', handled_in: 'care_note' },
  { name: 'Bath / Shower',           icon: '🛀', category: 'personal_care',  shift: 'day',     due_time: '10:00', window_mins: 120, sort_order: 24, applies_to: 'all', frequency: 'weekly', day_of_week: 2 , note_type: 'personal_care', handled_in: 'care_note' },
  { name: 'Hair Care & Grooming',    icon: '💇', category: 'personal_care',  shift: 'day',     due_time: '09:30', window_mins: 180, sort_order: 25, applies_to: 'all', frequency: 'weekly', day_of_week: 3 , note_type: 'personal_care', handled_in: 'care_note' },
  { name: 'Nail Care Check',         icon: '💅', category: 'personal_care',  shift: 'day',     due_time: '10:00', window_mins: 180, sort_order: 26, applies_to: 'all', frequency: 'weekly', day_of_week: 1 , note_type: 'personal_care', handled_in: 'care_note' },
];

// ── Generate today's tasks for all active residents ────────────────────────
export async function generateDailyTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    // Use provided date or today in local time (not UTC which can be off by 1 day)
    const date = (req.query.date as string) || (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    })();

    // Auto-seed default templates if none exist for this home
    const { rows: existingTmpl } = await query(
      'SELECT id FROM care_task_templates WHERE care_home_id = $1 LIMIT 1', [careHomeId]
    );
    if (existingTmpl.length === 0) {
      // Seed default templates inline
      for (const t of DEFAULT_TEMPLATES) {
        await query(
          `INSERT INTO care_task_templates (care_home_id, name, icon, category, shift, due_time, window_mins, sort_order, applies_to, frequency, day_of_week, note_type, handled_in)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [careHomeId, t.name, t.icon, t.category, t.shift, t.due_time, t.window_mins, t.sort_order, t.applies_to, t.frequency, t.day_of_week, (t as any).note_type ?? null, (t as any).handled_in ?? 'care_note']
        );
      }
    }

    // Get templates for this home
    const { rows: templates } = await query(
      `SELECT * FROM care_task_templates WHERE care_home_id = $1 AND active = TRUE ORDER BY sort_order`,
      [careHomeId]
    );

    // Get active residents
    const { rows: residents } = await query(
      `SELECT id, risk_level, mobility_status FROM residents WHERE care_home_id = $1 AND active = TRUE`,
      [careHomeId]
    );

    // Bulk INSERT with NOT EXISTS guard (works without unique index)
    // Mobility-aware filtering: applies_to can be 'all', 'high_risk', or comma-separated mobility values
    const { rowCount } = await query(
      `INSERT INTO care_tasks
         (care_home_id, resident_id, template_id, task_date, task_name, icon, category, due_time, window_mins, note_type, handled_in)
       SELECT
         r.care_home_id, r.id, ctt.id, $1::date,
         ctt.name, ctt.icon, ctt.category, ctt.due_time, ctt.window_mins,
         ctt.note_type, COALESCE(ctt.handled_in, 'care_note')
       FROM residents r
       JOIN care_task_templates ctt
         ON ctt.care_home_id = r.care_home_id
        AND (ctt.resident_id IS NULL OR ctt.resident_id = r.id)
       WHERE r.care_home_id = $2
         AND r.active = TRUE
         AND ctt.active = TRUE
         -- Skip residents temporarily away (hospital / home leave): their bed is
         -- held but care cannot be delivered, so generating tasks would create
         -- false "missed care" and distort completion metrics.
         AND NOT EXISTS (
           SELECT 1 FROM resident_absences ab
           WHERE ab.resident_id = r.id
             AND ab.start_date <= $1::date
             AND (ab.actual_return IS NULL OR ab.actual_return > $1::date))
         AND (ctt.frequency = 'daily' OR (ctt.frequency = 'weekly' AND EXTRACT(DOW FROM $1::date) = (abs(hashtext(r.id::text)) % 7)))
         AND (
           ctt.resident_id = r.id
           OR (ctt.resident_id IS NULL
               AND (
                 ctt.applies_to = 'all'
                 OR (ctt.applies_to = 'high_risk' AND r.risk_level = 'high')
                 OR (ctt.applies_to != 'all' AND ctt.applies_to != 'high_risk'
                     AND COALESCE(r.mobility_status, 'independent') = ANY(string_to_array(ctt.applies_to, ',')))
               )
               AND NOT EXISTS (SELECT 1 FROM care_task_exclusions ex WHERE ex.template_id = ctt.id AND ex.resident_id = r.id))
         )
         AND NOT EXISTS (
           SELECT 1 FROM care_tasks ct2
           WHERE ct2.resident_id = r.id
             AND ct2.template_id = ctt.id
             AND ct2.task_date   = $1::date
         )`,
      [date, careHomeId]
    );

    const created = rowCount ?? 0;
    res.json({ created, date, residents: residents.length, templates: templates.length });
  } catch (err) { next(err); }
}

// ── Seed default templates for a care home ────────────────────────────────
export async function seedTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    // Idempotent refresh: clear existing templates and today's/future un-actioned tasks, then reinsert the current set
    await query(
      `DELETE FROM care_tasks WHERE care_home_id = $1 AND task_date >= CURRENT_DATE
         AND status NOT IN ('done','deferred','in_progress')`,
      [careHomeId]
    );
    await query('DELETE FROM care_task_templates WHERE care_home_id = $1', [careHomeId]);
    for (const t of DEFAULT_TEMPLATES) {
      await query(
        `INSERT INTO care_task_templates (care_home_id, name, icon, category, shift, due_time, window_mins, sort_order, applies_to, frequency, day_of_week, note_type, handled_in)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [careHomeId, t.name, t.icon, t.category, t.shift, t.due_time, t.window_mins, t.sort_order, t.applies_to, t.frequency, t.day_of_week, (t as any).note_type ?? null, (t as any).handled_in ?? 'care_note']
      );
    }
    res.json({ seeded: DEFAULT_TEMPLATES.length, refreshed: true });
  } catch (err) { next(err); }
}

// ── List tasks for a date (all residents or one) ──────────────────────────
export async function listTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    // Use provided date or today in local time (not UTC which can be off by 1 day)
    const date = (req.query.date as string) || (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    })();
    const residentId = req.query.residentId as string | undefined;

    // Accept the date as-is but also check adjacent dates for timezone tolerance
    const where = residentId
      ? `ct.care_home_id=$1 AND ct.task_date=$2::date AND ct.resident_id=$3`
      : `ct.care_home_id=$1 AND ct.task_date=$2::date`;
    const params = residentId ? [careHomeId, date, residentId] : [careHomeId, date];

    const { rows } = await query(
      `SELECT
         ct.*,
         r.first_name || ' ' || r.last_name AS resident_name,
         r.room_number,
         r.risk_level,
         u.first_name || ' ' || u.last_name AS completed_by_name,
         ip.first_name || ' ' || ip.last_name AS in_progress_name_live
       FROM care_tasks ct
       JOIN residents r ON r.id = ct.resident_id
       LEFT JOIN users u ON u.id = ct.completed_by
       LEFT JOIN users ip ON ip.id = ct.in_progress_by
       WHERE ${where}
       ORDER BY r.room_number::text, ct.due_time`,
      params
    );

    // ── Medication rounds: the MAR chart is the record, this only reflects it ──
    // For every medication task, count the doses actually due in that round's
    // window and how many have been signed on the MAR. A resident with no
    // medicines due at that time gets 'na' rather than a permanent "missed",
    // which is what made the board show hundreds of false missed tasks.
    const emarRows = rows.filter(t => t.handled_in === 'emar');
    const medProgress = new Map<string, { given: number; scheduled: number }>();
    if (emarRows.length) {
      const residentIds = [...new Set(emarRows.map(t => t.resident_id))];
      const { rows: doses } = await query(
        `SELECT m.resident_id, t.time_str::time AS scheduled_time,
                EXISTS (
                  SELECT 1 FROM med_administrations ma
                  WHERE ma.medication_id = m.id
                    AND ma.administration_date = $2::date
                    AND ma.scheduled_time = t.time_str::time
                ) AS signed
         FROM medications m
         CROSS JOIN LATERAL unnest(m.administration_times) AS t(time_str)
         WHERE m.resident_id = ANY($1::uuid[])
           AND m.active = TRUE AND m.is_prn = FALSE
           AND t.time_str <> ''`,
        [residentIds, date]
      );

      for (const t of emarRows) {
        const timeStr = String(t.due_time || '00:00').slice(0, 5);
        const [dh, dm] = timeStr.split(':').map(Number);
        const dueMins = dh * 60 + dm;
        const win = t.window_mins || 60;
        let given = 0, scheduled = 0;
        for (const d of doses) {
          if (d.resident_id !== t.resident_id) continue;
          const sched = String(d.scheduled_time).slice(0, 5);
          const [sh, sm] = sched.split(':').map(Number);
          const mins = sh * 60 + sm;
          if (Math.abs(mins - dueMins) > win) continue;
          scheduled++;
          if (d.signed) given++;
        }
        medProgress.set(t.id, { given, scheduled });
      }
    }

    // Compute live status based on current time
    const now = new Date();
    const tasks = rows.map(t => {
      if (t.handled_in === 'emar') {
        const p = medProgress.get(t.id) || { given: 0, scheduled: 0 };
        const base = { ...t, med_given: p.given, med_scheduled: p.scheduled, read_only: true };
        // Nothing due at this round for this resident.
        if (p.scheduled === 0) return { ...base, status: 'na', na_reason: 'No medicines due at this time' };
        if (p.given >= p.scheduled) return { ...base, status: 'done', completed_by_name: 'Signed on MAR chart' };
        // Otherwise fall through to the normal time-based status below.
        const timeStr = String(t.due_time || '00:00').slice(0, 5);
        const due = new Date(`${date}T${timeStr}:00`);
        const windowEnd = new Date(due.getTime() + (t.window_mins || 60) * 60000);
        const missedCutoff = new Date(due.getTime() + (t.window_mins || 60) * 60000 * 2);
        const computed = now < due ? 'upcoming'
          : now <= windowEnd ? 'due'
          : now <= missedCutoff ? 'overdue' : 'missed';
        return { ...base, status: computed, due_time: timeStr };
      }

      if (t.status === 'done' || t.status === 'deferred' || t.status === 'na') return t;
      if (t.in_progress_by) return { ...t, status: 'in_progress' };

      // Parse due time — handle both HH:MM and HH:MM:SS from postgres
      const timeStr = String(t.due_time || '00:00').slice(0, 5);
      const [h, m] = timeStr.split(':').map(Number);
      const due = new Date(`${date}T${timeStr}:00`);
      const windowEnd = new Date(due.getTime() + (t.window_mins || 60) * 60000);
      const missedCutoff = new Date(due.getTime() + (t.window_mins || 60) * 60000 * 2);

      let computed: string;
      if (now < due)                           computed = 'upcoming';
      else if (now <= windowEnd)               computed = 'due';
      else if (now <= missedCutoff)            computed = 'overdue';
      else                                     computed = 'missed';

      return { ...t, status: computed, due_time: timeStr };
    });

    res.json(tasks);
  } catch (err) { next(err); }
}

// ── Complete a task ───────────────────────────────────────────────────────
// How long a claim on a task stays valid before it is treated as abandoned
// (carer closed the tab, phone locked, went to another resident).
const CLAIM_STALE_MINUTES = 15;

export async function completeTask(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { notes } = req.body;

    // Medicines are signed on the MAR chart by a competent person. A tick on
    // the task board is not a medicines record and must never stand in for one.
    const { rows: [routing] } = await query(
      `SELECT t.handled_in, t.task_name, t.resident_id,
              r.first_name || ' ' || r.last_name AS resident_name
       FROM care_tasks t JOIN residents r ON r.id = t.resident_id
       WHERE t.id = $1 AND t.care_home_id = $2`, [id, careHomeId]);
    if (routing?.handled_in === 'emar') {
      return res.status(409).json({
        error: `"${routing.task_name}" is recorded on ${routing.resident_name}'s MAR chart, not here. Open Medications to sign for it.`,
        conflict: 'handled_in_emar',
        residentId: routing.resident_id,
        residentName: routing.resident_name,
        taskName: routing.task_name,
        goTo: '/emar',
      });
    }

    // Only complete a task that is not already done. Without this guard two
    // carers can each finish the same task and each write a care note for it,
    // which means either the resident received the same care twice or the
    // record says something happened twice when it happened once. Both are
    // serious: the first distresses the resident, the second is a false record.
    const { rows: [task] } = await query(
      `UPDATE care_tasks
       SET status='done', completed_by=$1, completed_at=NOW(), notes=$2,
           in_progress_by=NULL, in_progress_since=NULL, in_progress_name=NULL
       WHERE id=$3 AND care_home_id=$4 AND status <> 'done'
       RETURNING *`,
      [req.user!.id, notes || null, id, careHomeId]
    );

    if (!task) {
      const { rows: [existing] } = await query(
        `SELECT t.*, u.first_name || ' ' || u.last_name AS completed_by_name,
                r.first_name || ' ' || r.last_name AS resident_name
         FROM care_tasks t
         LEFT JOIN users u ON u.id = t.completed_by
         LEFT JOIN residents r ON r.id = t.resident_id
         WHERE t.id = $1 AND t.care_home_id = $2`, [id, careHomeId]);
      if (!existing) throw new AppError(404, 'Task not found');

      const mins = existing.completed_at
        ? Math.max(0, Math.round((Date.now() - new Date(existing.completed_at).getTime()) / 60000))
        : null;
      const who = existing.completed_by_name || 'Another member of staff';
      const when = mins === null ? '' : mins < 1 ? ' just now' : mins === 1 ? ' 1 minute ago' : ` ${mins} minutes ago`;
      const mine = existing.completed_by === req.user!.id;

      return res.status(409).json({
        error: mine
          ? `You already completed "${existing.task_name}" for ${existing.resident_name}${when}.`
          : `${who} already completed "${existing.task_name}" for ${existing.resident_name}${when}. Check with them before recording it again.`,
        conflict: 'already_completed',
        taskId: existing.id,
        taskName: existing.task_name,
        residentName: existing.resident_name,
        completedByName: existing.completed_by_name,
        completedById: existing.completed_by,
        completedAt: existing.completed_at,
        minutesAgo: mins,
        byMe: mine,
      });
    }

    // SSE broadcast to all staff in this care home
    sseManager.broadcast(careHomeId, {
      type: 'TASK_COMPLETED',
      taskId: id,
      residentId: task.resident_id,
      completedBy: `${req.user!.first_name} ${req.user!.last_name}`,
      completedAt: new Date().toISOString(),
    });

    res.json(task);
  } catch (err) { next(err); }
}

// ── Defer a task ──────────────────────────────────────────────────────────
export async function deferTask(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason?.trim()) throw new AppError(400, 'Deferral reason is required');

    const { rows: [task] } = await query(
      `UPDATE care_tasks
       SET status='deferred', deferred_reason=$1, completed_by=$2, completed_at=NOW(),
           in_progress_by=NULL, in_progress_since=NULL, in_progress_name=NULL
       WHERE id=$3 AND care_home_id=$4 AND status <> 'done' RETURNING *`,
      [reason, req.user!.id, id, careHomeId]
    );
    if (!task) {
      const { rows: [existing] } = await query(
        `SELECT t.task_name, t.status, t.completed_at,
                u.first_name || ' ' || u.last_name AS completed_by_name
         FROM care_tasks t LEFT JOIN users u ON u.id = t.completed_by
         WHERE t.id = $1 AND t.care_home_id = $2`, [id, careHomeId]);
      if (!existing) throw new AppError(404, 'Task not found');
      return res.status(409).json({
        error: `"${existing.task_name}" was already completed by ${existing.completed_by_name || 'another member of staff'}. It cannot be deferred now.`,
        conflict: 'already_completed',
        completedByName: existing.completed_by_name,
        completedAt: existing.completed_at,
      });
    }

    sseManager.broadcast(careHomeId, {
      type: 'TASK_DEFERRED',
      taskId: id,
      residentId: task.resident_id,
      reason,
      deferredBy: `${req.user!.first_name} ${req.user!.last_name}`,
    });

    res.json(task);
  } catch (err) { next(err); }
}

// ── Mark in-progress (presence indicator) ────────────────────────────────
export async function startTask(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const staffName = `${req.user!.first_name} ${req.user!.last_name}`;

    // Look first: claiming a task somebody else is already doing is how two
    // carers end up in the same room. A claim older than CLAIM_STALE_MINUTES
    // is treated as abandoned and can be taken silently.
    const { rows: [current] } = await query(
      `SELECT t.*, u.first_name || ' ' || u.last_name AS holder_name,
              r.first_name || ' ' || r.last_name AS resident_name,
              EXTRACT(EPOCH FROM (NOW() - t.in_progress_since)) / 60 AS held_minutes,
              cu.first_name || ' ' || cu.last_name AS completed_by_name
       FROM care_tasks t
       LEFT JOIN users u ON u.id = t.in_progress_by
       LEFT JOIN users cu ON cu.id = t.completed_by
       LEFT JOIN residents r ON r.id = t.resident_id
       WHERE t.id = $1 AND t.care_home_id = $2`, [id, careHomeId]);
    if (!current) throw new AppError(404, 'Task not found');

    if (current.handled_in === 'emar') {
      return res.status(409).json({
        error: `"${current.task_name}" is signed on ${current.resident_name}'s MAR chart. Open Medications to record it.`,
        conflict: 'handled_in_emar',
        residentId: current.resident_id,
        residentName: current.resident_name,
        taskName: current.task_name,
        goTo: '/emar',
      });
    }

    if (current.status === 'done') {
      const mins = current.completed_at
        ? Math.max(0, Math.round((Date.now() - new Date(current.completed_at).getTime()) / 60000)) : null;
      return res.status(409).json({
        error: `${current.completed_by_name || 'Another member of staff'} already completed "${current.task_name}" for ${current.resident_name}${mins === null ? '' : mins < 1 ? ' just now' : ` ${mins} minute${mins === 1 ? '' : 's'} ago`}.`,
        conflict: 'already_completed',
        completedByName: current.completed_by_name,
        completedAt: current.completed_at,
        minutesAgo: mins,
      });
    }

    const heldByOther = current.in_progress_by && current.in_progress_by !== req.user!.id;
    const heldMinutes = current.held_minutes != null ? Math.round(Number(current.held_minutes)) : null;
    const stale = heldMinutes != null && heldMinutes >= CLAIM_STALE_MINUTES;

    if (heldByOther && !stale && req.body?.takeOver !== true) {
      return res.status(409).json({
        error: `${current.holder_name || 'Another member of staff'} is recording "${current.task_name}" for ${current.resident_name} right now${heldMinutes ? ` (started ${heldMinutes} minute${heldMinutes === 1 ? '' : 's'} ago)` : ''}. Check with them before taking over.`,
        conflict: 'in_progress',
        holderName: current.holder_name,
        holderId: current.in_progress_by,
        heldMinutes,
        taskName: current.task_name,
        residentName: current.resident_name,
        canTakeOver: true,
      });
    }

    const { rows: [task] } = await query(
      `UPDATE care_tasks
       SET in_progress_by=$1, in_progress_since=NOW(), in_progress_name=$2
       WHERE id=$3 AND care_home_id=$4 AND status != 'done' RETURNING *`,
      [req.user!.id, staffName, id, careHomeId]
    );
    if (!task) throw new AppError(404, 'Task not found');

    // If this was a deliberate take-over, tell the person who lost it.
    if (heldByOther) {
      sseManager.broadcast(careHomeId, {
        type: 'TASK_TAKEN_OVER',
        taskId: id,
        residentId: task.resident_id,
        taskName: task.task_name,
        previousHolderId: current.in_progress_by,
        previousHolderName: current.holder_name,
        staffName,
      });
    }

    sseManager.broadcast(careHomeId, {
      type: 'TASK_STARTED',
      taskId: id,
      residentId: task.resident_id,
      staffName,
      staffId: req.user!.id,
    });

    res.json(task);
  } catch (err) { next(err); }
}

// ── Release in-progress (user navigated away) ─────────────────────────────
export async function releaseTask(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;

    await query(
      `UPDATE care_tasks SET in_progress_by=NULL, in_progress_since=NULL, in_progress_name=NULL
       WHERE id=$1 AND care_home_id=$2 AND in_progress_by=$3`,
      [id, careHomeId, req.user!.id]
    );

    sseManager.broadcast(careHomeId, {
      type: 'TASK_RELEASED',
      taskId: id,
      staffId: req.user!.id,
    });

    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── SSE stream endpoint ───────────────────────────────────────────────────
export async function sseStream(req: Request, res: Response) {
  const careHomeId = req.user!.care_home_id;
  const userId     = req.user!.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial heartbeat
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', userId })}\n\n`);

  // Register connection
  sseManager.addClient(careHomeId, userId, res);

  // Heartbeat every 25s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'HEARTBEAT', ts: Date.now() })}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseManager.removeClient(careHomeId, userId);
  });
}

// ── Task template management (manager) ──────────────────────────────────────
export async function listTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT * FROM care_task_templates WHERE care_home_id = $1 ORDER BY sort_order, due_time`,
      [req.user!.care_home_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const b = req.body;
    const { rows: [row] } = await query(
      `INSERT INTO care_task_templates
         (care_home_id, name, icon, category, shift, due_time, window_mins, sort_order, applies_to, frequency, day_of_week, resident_id, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE) RETURNING *`,
      [req.user!.care_home_id, b.name, b.icon || '📋', b.category || 'personal_care', b.shift || 'day',
       b.due_time, b.window_mins ?? 120, b.sort_order ?? 99, b.applies_to || 'all',
       b.frequency || 'daily', b.frequency === 'weekly' ? (b.day_of_week ?? null) : null, b.resident_id || null]
    );
    res.status(201).json(row);
  } catch (err) { next(err); }
}

export async function updateTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const b = req.body;
    const { rows: [row] } = await query(
      `UPDATE care_task_templates SET
         name        = COALESCE($1, name),
         icon        = COALESCE($2, icon),
         category    = COALESCE($3, category),
         shift       = COALESCE($4, shift),
         due_time    = COALESCE($5, due_time),
         window_mins = COALESCE($6, window_mins),
         sort_order  = COALESCE($7, sort_order),
         applies_to  = COALESCE($8, applies_to),
         frequency   = COALESCE($9, frequency),
         day_of_week = $10,
         active      = COALESCE($11, active)
       WHERE id = $12 AND care_home_id = $13 RETURNING *`,
      [b.name, b.icon, b.category, b.shift, b.due_time, b.window_mins, b.sort_order, b.applies_to,
       b.frequency, b.frequency === 'weekly' ? (b.day_of_week ?? null) : null,
       b.active, req.params.id, req.user!.care_home_id]
    );
    if (!row) return res.status(404).json({ error: 'Task template not found' });

    // Bring today's board in line with the change. A manager who edits the
    // 17:00 personal care task expects tonight's list to change, not tomorrow's.
    const careHomeId = req.user!.care_home_id;
    let removed = 0, restored = 0;
    if (row.active === false) {
      ({ removed } = await removeUnactionedTasks(careHomeId, row.id));
    } else {
      // applies_to changes alter who the task belongs to, so rebuild rather
      // than patch: clear the un-actioned rows and re-evaluate eligibility.
      if (b.applies_to !== undefined) {
        ({ removed } = await removeUnactionedTasks(careHomeId, row.id));
      } else {
        await query(
          `UPDATE care_tasks SET task_name = $1, icon = $2, category = $3,
                  due_time = $4, window_mins = $5, note_type = $6,
                  handled_in = COALESCE($7, handled_in), updated_at = NOW()
           WHERE care_home_id = $8 AND template_id = $9
             AND task_date >= CURRENT_DATE
             AND status NOT IN ('done','deferred') AND in_progress_by IS NULL`,
          [row.name, row.icon, row.category, row.due_time, row.window_mins,
           row.note_type, row.handled_in, careHomeId, row.id]);
      }
      restored = await restoreTasksForToday(careHomeId, row.id);
    }

    sseManager.broadcast(careHomeId, { type: 'TASKS_CHANGED', templateId: row.id });
    res.json({ ...row, removedToday: removed, restoredToday: restored });
  } catch (err) { next(err); }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    // Soft-delete via active=false so historical tasks keep their link
    const { rows: [row] } = await query(
      `UPDATE care_task_templates SET active = FALSE WHERE id = $1 AND care_home_id = $2 RETURNING id`,
      [req.params.id, req.user!.care_home_id]
    );
    if (!row) return res.status(404).json({ error: 'Task template not found' });

    const careHomeId = req.user!.care_home_id;
    const { removed, keptActioned } = await removeUnactionedTasks(careHomeId, row.id);
    sseManager.broadcast(careHomeId, { type: 'TASKS_CHANGED', templateId: row.id });

    res.json({
      deactivated: true, removedToday: removed, keptActioned,
      message: keptActioned > 0
        ? `Removed from today onwards. ${keptActioned} already recorded ${keptActioned === 1 ? 'entry has' : 'entries have'} been kept.`
        : 'Removed from today onwards.',
    });
  } catch (err) { next(err); }
}


// ── Per-resident care plan (personalisation) ────────────────────────────────
export async function getResidentCarePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const residentId = req.params.id;
    const { rows: [r] } = await query('SELECT id, risk_level, mobility_status FROM residents WHERE id=$1 AND care_home_id=$2', [residentId, careHomeId]);
    if (!r) return res.status(404).json({ error: 'Resident not found' });
    const mob = r.mobility_status || 'independent';
    const applies = (a: string) => a === 'all' || (a === 'high_risk' && r.risk_level === 'high') || (a !== 'all' && a !== 'high_risk' && a.split(',').includes(mob));

    const { rows: home } = await query(
      `SELECT t.*, EXISTS(SELECT 1 FROM care_task_exclusions ex WHERE ex.template_id=t.id AND ex.resident_id=$2) AS excluded
       FROM care_task_templates t
       WHERE t.care_home_id=$1 AND t.resident_id IS NULL AND t.active=TRUE
       ORDER BY t.sort_order, t.due_time`, [careHomeId, residentId]);
    const { rows: specific } = await query(
      `SELECT * FROM care_task_templates WHERE resident_id=$1 AND active=TRUE ORDER BY sort_order, due_time`, [residentId]);

    res.json({ home: home.filter((t: any) => applies(t.applies_to)), specific });
  } catch (err) { next(err); }
}


// ─────────────────────────────────────────────────────────────────────────────
// Keeping today's board in step with the template settings.
//
// Switching a task off for a resident used to write an exclusion and stop
// there. Exclusions are only read when tasks are *generated*, so today's rows
// were already in the database and carers kept seeing a task the manager had
// removed — and kept being marked down for missing it.
//
// Anything already actioned is left alone. A completed or deferred task is a
// record of what happened; a settings change must never rewrite it.
// ─────────────────────────────────────────────────────────────────────────────

async function removeUnactionedTasks(careHomeId: string, templateId: string, residentId?: string) {
  const params: any[] = [careHomeId, templateId];
  let residentClause = '';
  if (residentId) { params.push(residentId); residentClause = `AND resident_id = $${params.length}`; }

  const { rows: kept } = await query(
    `SELECT COUNT(*)::int AS n FROM care_tasks
     WHERE care_home_id = $1 AND template_id = $2 ${residentClause}
       AND task_date >= CURRENT_DATE
       AND (status IN ('done','deferred') OR in_progress_by IS NOT NULL)`, params);

  const { rowCount } = await query(
    `DELETE FROM care_tasks
     WHERE care_home_id = $1 AND template_id = $2 ${residentClause}
       AND task_date >= CURRENT_DATE
       AND status NOT IN ('done','deferred')
       AND in_progress_by IS NULL`, params);

  return { removed: rowCount ?? 0, keptActioned: kept[0]?.n ?? 0 };
}

// Re-create today's row for a template that has just been switched back on.
// Mirrors the eligibility rules used by generateDailyTasks so a task switched
// on at 09:00 appears immediately rather than tomorrow.
async function restoreTasksForToday(careHomeId: string, templateId: string, residentId?: string) {
  const params: any[] = [careHomeId, templateId];
  let residentClause = '';
  if (residentId) { params.push(residentId); residentClause = `AND r.id = $${params.length}`; }

  const { rowCount } = await query(
    `INSERT INTO care_tasks
       (care_home_id, resident_id, template_id, task_date, task_name, icon, category,
        due_time, window_mins, note_type, handled_in)
     SELECT r.care_home_id, r.id, ctt.id, CURRENT_DATE,
            ctt.name, ctt.icon, ctt.category, ctt.due_time, ctt.window_mins,
            ctt.note_type, COALESCE(ctt.handled_in, 'care_note')
     FROM residents r
     JOIN care_task_templates ctt ON ctt.id = $2 AND ctt.care_home_id = $1
     WHERE r.care_home_id = $1 AND r.active = TRUE AND r.discharge_date IS NULL
       ${residentClause}
       AND ctt.active = TRUE
       AND (ctt.resident_id IS NULL OR ctt.resident_id = r.id)
       AND NOT EXISTS (
         SELECT 1 FROM resident_absences ab
         WHERE ab.resident_id = r.id AND ab.start_date <= CURRENT_DATE
           AND (ab.actual_return IS NULL OR ab.actual_return > CURRENT_DATE))
       AND (ctt.frequency = 'daily'
            OR (ctt.frequency = 'weekly' AND EXTRACT(DOW FROM CURRENT_DATE) = (abs(hashtext(r.id::text)) % 7)))
       AND (
         ctt.resident_id = r.id
         OR (ctt.resident_id IS NULL
             AND (ctt.applies_to = 'all'
                  OR (ctt.applies_to = 'high_risk' AND r.risk_level = 'high')
                  OR (ctt.applies_to NOT IN ('all','high_risk')
                      AND COALESCE(r.mobility_status,'independent') = ANY(string_to_array(ctt.applies_to, ','))))
             AND NOT EXISTS (SELECT 1 FROM care_task_exclusions ex
                             WHERE ex.template_id = ctt.id AND ex.resident_id = r.id))
       )
       AND NOT EXISTS (
         SELECT 1 FROM care_tasks ct2
         WHERE ct2.resident_id = r.id AND ct2.template_id = ctt.id
           AND ct2.task_date = CURRENT_DATE)`, params);

  return rowCount ?? 0;
}

export async function setTaskExclusion(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const residentId = req.params.id;
    const template_id = req.body.template_id || req.body.templateId;
    const excluded = req.body.excluded;
    if (!template_id) return res.status(400).json({ error: 'A task is required' });

    let removed = 0, keptActioned = 0, restored = 0;
    if (excluded) {
      await query(
        `INSERT INTO care_task_exclusions (care_home_id, template_id, resident_id)
         VALUES ($1,$2,$3) ON CONFLICT (template_id, resident_id) DO NOTHING`,
        [careHomeId, template_id, residentId]);
      ({ removed, keptActioned } = await removeUnactionedTasks(careHomeId, template_id, residentId));
    } else {
      await query('DELETE FROM care_task_exclusions WHERE template_id=$1 AND resident_id=$2', [template_id, residentId]);
      restored = await restoreTasksForToday(careHomeId, template_id, residentId);
    }

    // Push the change to every board that is open right now, so a carer is not
    // still looking at a task the manager removed a moment ago.
    sseManager.broadcast(careHomeId, { type: 'TASKS_CHANGED', residentId, templateId: template_id });

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: excluded ? 'CARE_TASK_SWITCHED_OFF' : 'CARE_TASK_SWITCHED_ON',
      entityType: 'resident', entityId: residentId,
      afterData: { templateId: template_id, removed, keptActioned, restored },
    });

    res.json({
      template_id, excluded: !!excluded, removedToday: removed, restoredToday: restored,
      keptActioned,
      message: excluded
        ? (keptActioned > 0
            ? `Removed from today onwards. ${keptActioned} already recorded ${keptActioned === 1 ? 'entry has' : 'entries have'} been kept.`
            : 'Removed from today onwards.')
        : (restored > 0 ? 'Added back, including today.' : 'Added back from tomorrow.'),
    });
  } catch (err) { next(err); }
}
