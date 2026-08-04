import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Get Team Metrics ──────────────────────────────────────────────────────

export async function getTeamMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { periodStart, periodEnd } = req.query;

    let where = 'WHERE spm.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;

    if (periodStart) { where += ` AND spm.period_start >= $${p++}`; params.push(periodStart); }
    if (periodEnd) { where += ` AND spm.period_end <= $${p++}`; params.push(periodEnd); }

    const { rows } = await query(
      `SELECT
         AVG(spm.task_completion_rate) AS avg_task_completion_rate,
         AVG(spm.care_note_quality_score) AS avg_care_note_quality,
         AVG(spm.avg_response_time_minutes) AS avg_response_time,
         AVG(spm.training_completion_pct) AS avg_training_completion,
         SUM(spm.notes_count) AS total_notes,
         SUM(spm.tasks_completed) AS total_tasks_completed,
         SUM(spm.tasks_assigned) AS total_tasks_assigned,
         COUNT(DISTINCT spm.staff_id) AS staff_count
       FROM staff_performance_metrics spm
       ${where}`,
      params
    );

    res.json(rows[0]);
  } catch (err) { next(err); }
}

// ── Get Individual Metrics ────────────────────────────────────────────────

export async function getIndividualMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const { staffId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT spm.*, u.first_name || ' ' || u.last_name AS staff_name
       FROM staff_performance_metrics spm
       JOIN users u ON u.id = spm.staff_id
       WHERE spm.care_home_id = $1 AND spm.staff_id = $2
       ORDER BY spm.period_start DESC`,
      [careHomeId, staffId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Calculate Metrics ─────────────────────────────────────────────────────

export async function calculateMetrics(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { periodStart, periodEnd } = req.body;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: 'periodStart and periodEnd are required' });
    }

    // Get all active staff
    const { rows: staff } = await query(
      `SELECT sp.user_id AS staff_id
       FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.care_home_id = $1 AND u.active = TRUE`,
      [careHomeId]
    );

    const results = [];
    for (const s of staff) {
      // Calculate metrics for each staff member
      const { rows: [taskStats] } = await query(
        `SELECT COUNT(*) AS assigned, COUNT(*) FILTER (WHERE status = 'done') AS completed
         FROM care_tasks
         WHERE care_home_id = $1 AND completed_by = $2
           AND task_date BETWEEN $3 AND $4`,
        [careHomeId, s.staff_id, periodStart, periodEnd]
      );

      const { rows: [noteStats] } = await query(
        `SELECT COUNT(*) AS count
         FROM care_notes
         WHERE care_home_id = $1 AND author_id = $2
           AND created_at BETWEEN $3 AND $4`,
        [careHomeId, s.staff_id, periodStart, periodEnd]
      );

      const assigned = parseInt(taskStats.assigned) || 0;
      const completed = parseInt(taskStats.completed) || 0;
      const completionRate = assigned > 0 ? (completed / assigned) * 100 : 0;

      const { rows: [metric] } = await query(
        `INSERT INTO staff_performance_metrics
         (care_home_id, staff_id, period_start, period_end, task_completion_rate, notes_count, tasks_completed, tasks_assigned)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [careHomeId, s.staff_id, periodStart, periodEnd, completionRate, noteStats.count, completed, assigned]
      );
      results.push(metric);
    }

    res.status(201).json(results);
  } catch (err) { next(err); }
}

// ── Get Response Times ────────────────────────────────────────────────────

export async function getResponseTimes(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT staff_id, u.first_name || ' ' || u.last_name AS staff_name,
         AVG(avg_response_time_minutes) AS avg_response_time,
         MIN(avg_response_time_minutes) AS min_response_time,
         MAX(avg_response_time_minutes) AS max_response_time
       FROM staff_performance_metrics spm
       JOIN users u ON u.id = spm.staff_id
       WHERE spm.care_home_id = $1 AND spm.avg_response_time_minutes IS NOT NULL
       GROUP BY staff_id, u.first_name, u.last_name
       ORDER BY avg_response_time ASC`,
      [careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}
