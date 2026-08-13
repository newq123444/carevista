// src/controllers/tasks.controller.ts
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
// SSE is optional - graceful fallback if not deployed
let sseManager: any = { broadcast: () => {}, addClient: () => {}, removeClient: () => {} };
try { sseManager = require('../utils/sse').sseManager; } catch { /* SSE not available */ }

// Default task templates — seeded once per care home
// applies_to values: 'all' = everyone, 'high_risk' = high risk_level only,
// or comma-separated mobility_status values (e.g. 'bed_bound,wheelchair')
const DEFAULT_TEMPLATES = [
  { name: 'Morning Personal Care',    icon: '🛁', category: 'personal_care',  shift: 'day',     due_time: '07:30', window_mins: 90,  sort_order: 1,  applies_to: 'all', frequency: 'daily',  day_of_week: null as number|null },
  { name: 'Breakfast',               icon: '🌅', category: 'nutrition',      shift: 'day',     due_time: '08:00', window_mins: 60,  sort_order: 2,  applies_to: 'all', frequency: 'daily',  day_of_week: null },
  { name: 'Morning Medications',     icon: '💊', category: 'medication',     shift: 'day',     due_time: '08:00', window_mins: 60,  sort_order: 3,  applies_to: 'all', frequency: 'daily',  day_of_week: null },
  { name: 'Skin & Pressure Check',   icon: '🩺', category: 'observation',    shift: 'day',     due_time: '08:30', window_mins: 120, sort_order: 4,  applies_to: 'high_risk', frequency: 'daily', day_of_week: null },
  { name: 'Fluid & Snack Check',     icon: '💧', category: 'nutrition',      shift: 'day',     due_time: '10:30', window_mins: 60,  sort_order: 6,  applies_to: 'all', frequency: 'daily',  day_of_week: null },
  { name: 'Repositioning Check',     icon: '🔄', category: 'repositioning',  shift: 'all',     due_time: '10:00', window_mins: 60,  sort_order: 7,  applies_to: 'bed_bound,wheelchair', frequency: 'daily', day_of_week: null },
  { name: 'Walking Exercise',        icon: '🚶', category: 'physical',       shift: 'day',     due_time: '11:00', window_mins: 60,  sort_order: 8,  applies_to: 'independent,walking_aid', frequency: 'daily', day_of_week: null },
  { name: 'Seated Exercise',         icon: '💪', category: 'physical',       shift: 'day',     due_time: '11:00', window_mins: 60,  sort_order: 9,  applies_to: 'wheelchair,bed_bound', frequency: 'daily', day_of_week: null },
  { name: 'Lunch',                   icon: '🍽', category: 'nutrition',      shift: 'day',     due_time: '12:00', window_mins: 60,  sort_order: 10, applies_to: 'all', frequency: 'daily',  day_of_week: null },
  { name: 'Afternoon Medications',   icon: '💊', category: 'medication',     shift: 'day',     due_time: '12:00', window_mins: 60,  sort_order: 11, applies_to: 'all', frequency: 'daily',  day_of_week: null },
  { name: 'Repositioning Check',     icon: '🔄', category: 'repositioning',  shift: 'all',     due_time: '14:00', window_mins: 60,  sort_order: 12, applies_to: 'bed_bound,wheelchair', frequency: 'daily', day_of_week: null },
  { name: 'Afternoon Tea & Snack',   icon: '☕', category: 'nutrition',      shift: 'day',     due_time: '15:00', window_mins: 60,  sort_order: 13, applies_to: 'all', frequency: 'daily',  day_of_week: null },
  { name: 'Skin Moisturising',       icon: '🧴', category: 'personal_care',  shift: 'day',     due_time: '10:30', window_mins: 120, sort_order: 14, applies_to: 'bed_bound', frequency: 'daily', day_of_week: null },
  { name: 'Continence Pad Check',    icon: '🩹', category: 'personal_care',  shift: 'all',     due_time: '10:00', window_mins: 120, sort_order: 15, applies_to: 'bed_bound,wheelchair', frequency: 'daily', day_of_week: null },
  { name: 'Sensory / Wellbeing Activity', icon: '🎵', category: 'social_wellbeing', shift: 'day', due_time: '14:30', window_mins: 90, sort_order: 16, applies_to: 'all', frequency: 'daily', day_of_week: null },
  { name: 'Evening Personal Care',  icon: '🚿', category: 'personal_care',  shift: 'evening', due_time: '17:00', window_mins: 90,  sort_order: 17, applies_to: 'all', frequency: 'daily',  day_of_week: null },
  { name: 'Supper',                  icon: '🌙', category: 'nutrition',      shift: 'evening', due_time: '18:00', window_mins: 60,  sort_order: 18, applies_to: 'all', frequency: 'daily',  day_of_week: null },
  { name: 'Evening Medications',     icon: '💊', category: 'medication',     shift: 'evening', due_time: '18:00', window_mins: 60,  sort_order: 19, applies_to: 'all', frequency: 'daily',  day_of_week: null },
  { name: 'Repositioning Check',     icon: '🔄', category: 'repositioning',  shift: 'all',     due_time: '20:00', window_mins: 60,  sort_order: 20, applies_to: 'bed_bound,wheelchair', frequency: 'daily', day_of_week: null },
  { name: 'Night Settle & Check',    icon: '😴', category: 'personal_care',  shift: 'evening', due_time: '21:00', window_mins: 90,  sort_order: 21, applies_to: 'all', frequency: 'daily',  day_of_week: null },
  { name: 'Night Medications',       icon: '💊', category: 'medication',     shift: 'night',   due_time: '22:00', window_mins: 60,  sort_order: 22, applies_to: 'all', frequency: 'daily',  day_of_week: null },
  { name: 'Night Observation',       icon: '🌛', category: 'observation',    shift: 'night',   due_time: '02:00', window_mins: 120, sort_order: 23, applies_to: 'all', frequency: 'daily',  day_of_week: null },
  { name: 'Bath / Shower',           icon: '🛀', category: 'personal_care',  shift: 'day',     due_time: '10:00', window_mins: 120, sort_order: 24, applies_to: 'all', frequency: 'weekly', day_of_week: 2 },
  { name: 'Hair Care & Grooming',    icon: '💇', category: 'personal_care',  shift: 'day',     due_time: '09:30', window_mins: 180, sort_order: 25, applies_to: 'all', frequency: 'weekly', day_of_week: 3 },
  { name: 'Nail Care Check',         icon: '💅', category: 'personal_care',  shift: 'day',     due_time: '10:00', window_mins: 180, sort_order: 26, applies_to: 'all', frequency: 'weekly', day_of_week: 1 },
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
          `INSERT INTO care_task_templates (care_home_id, name, icon, category, shift, due_time, window_mins, sort_order, applies_to, frequency, day_of_week)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [careHomeId, t.name, t.icon, t.category, t.shift, t.due_time, t.window_mins, t.sort_order, t.applies_to, t.frequency, t.day_of_week]
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
         (care_home_id, resident_id, template_id, task_date, task_name, icon, category, due_time, window_mins)
       SELECT
         r.care_home_id, r.id, ctt.id, $1::date,
         ctt.name, ctt.icon, ctt.category, ctt.due_time, ctt.window_mins
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
        `INSERT INTO care_task_templates (care_home_id, name, icon, category, shift, due_time, window_mins, sort_order, applies_to, frequency, day_of_week)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [careHomeId, t.name, t.icon, t.category, t.shift, t.due_time, t.window_mins, t.sort_order, t.applies_to, t.frequency, t.day_of_week]
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

    // Compute live status based on current time
    const now = new Date();
    const tasks = rows.map(t => {
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
export async function completeTask(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { notes } = req.body;

    const { rows: [task] } = await query(
      `UPDATE care_tasks
       SET status='done', completed_by=$1, completed_at=NOW(), notes=$2,
           in_progress_by=NULL, in_progress_since=NULL, in_progress_name=NULL
       WHERE id=$3 AND care_home_id=$4
       RETURNING *`,
      [req.user!.id, notes || null, id, careHomeId]
    );
    if (!task) throw new AppError(404, 'Task not found');

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
       WHERE id=$3 AND care_home_id=$4 RETURNING *`,
      [reason, req.user!.id, id, careHomeId]
    );
    if (!task) throw new AppError(404, 'Task not found');

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

    const { rows: [task] } = await query(
      `UPDATE care_tasks
       SET in_progress_by=$1, in_progress_since=NOW(), in_progress_name=$2
       WHERE id=$3 AND care_home_id=$4 AND status != 'done' RETURNING *`,
      [req.user!.id, staffName, id, careHomeId]
    );
    if (!task) throw new AppError(404, 'Task not found');

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
    res.json(row);
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
    res.json({ deactivated: true });
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

export async function setTaskExclusion(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const residentId = req.params.id;
    const { template_id, excluded } = req.body;
    if (excluded) {
      await query(
        `INSERT INTO care_task_exclusions (care_home_id, template_id, resident_id)
         VALUES ($1,$2,$3) ON CONFLICT (template_id, resident_id) DO NOTHING`,
        [careHomeId, template_id, residentId]);
    } else {
      await query('DELETE FROM care_task_exclusions WHERE template_id=$1 AND resident_id=$2', [template_id, residentId]);
    }
    res.json({ template_id, excluded: !!excluded });
  } catch (err) { next(err); }
}
