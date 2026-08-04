import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Create Goal ───────────────────────────────────────────────────────────

export async function createGoal(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId, title, description, category, targetDate, priority } = req.body;

    if (!residentId || !title) {
      return res.status(400).json({ error: 'residentId and title are required' });
    }

    const { rows: [goal] } = await query(
      `INSERT INTO rehab_goals (care_home_id, resident_id, title, description, category, target_date, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [careHomeId, residentId, title, description, category, targetDate, priority || 'medium', userId]
    );

    res.status(201).json(goal);
  } catch (err) { next(err); }
}

// ── Get Resident Goals ────────────────────────────────────────────────────

export async function getResidentGoals(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT rg.*,
         u.first_name || ' ' || u.last_name AS created_by_name,
         COUNT(rm.id) AS total_milestones,
         COUNT(rm.id) FILTER (WHERE rm.completed = TRUE) AS completed_milestones
       FROM rehab_goals rg
       LEFT JOIN users u ON u.id = rg.created_by
       LEFT JOIN rehab_milestones rm ON rm.goal_id = rg.id
       WHERE rg.resident_id = $1 AND rg.care_home_id = $2
       GROUP BY rg.id, u.first_name, u.last_name
       ORDER BY rg.created_at DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Add Milestone ─────────────────────────────────────────────────────────

export async function addMilestone(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { goalId, title, description, targetDate, displayOrder } = req.body;

    if (!goalId || !title) {
      return res.status(400).json({ error: 'goalId and title are required' });
    }

    const { rows: [milestone] } = await query(
      `INSERT INTO rehab_milestones (care_home_id, goal_id, title, description, target_date, display_order)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [careHomeId, goalId, title, description, targetDate, displayOrder || 0]
    );

    res.status(201).json(milestone);
  } catch (err) { next(err); }
}

// ── Update Milestone Progress ─────────────────────────────────────────────

export async function updateMilestoneProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { completed } = req.body;

    const { rows: [milestone] } = await query(
      `UPDATE rehab_milestones
       SET completed = $1, completed_at = CASE WHEN $1 = TRUE THEN NOW() ELSE NULL END
       WHERE id = $2 AND care_home_id = $3
       RETURNING *`,
      [completed, id, careHomeId]
    );

    if (!milestone) throw new AppError(404, 'Milestone not found');
    res.json(milestone);
  } catch (err) { next(err); }
}

// ── Log Progress ──────────────────────────────────────────────────────────

export async function logProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { goalId, milestoneId, residentId, progressNotes, score, celebration, familyNotified } = req.body;

    if (!goalId || !residentId || !progressNotes) {
      return res.status(400).json({ error: 'goalId, residentId, and progressNotes are required' });
    }

    const { rows: [log] } = await query(
      `INSERT INTO rehab_progress_logs (care_home_id, goal_id, milestone_id, resident_id, progress_notes, score, celebration, family_notified, logged_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [careHomeId, goalId, milestoneId || null, residentId, progressNotes, score, celebration || false, familyNotified || false, userId]
    );

    res.status(201).json(log);
  } catch (err) { next(err); }
}

// ── Celebrate Achievement ─────────────────────────────────────────────────

export async function celebrateAchievement(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;

    // Mark the goal as achieved
    const { rows: [goal] } = await query(
      `UPDATE rehab_goals SET status = 'achieved', updated_at = NOW()
       WHERE id = $1 AND care_home_id = $2
       RETURNING *`,
      [id, careHomeId]
    );

    if (!goal) throw new AppError(404, 'Goal not found');

    // Log the celebration
    await query(
      `INSERT INTO rehab_progress_logs (care_home_id, goal_id, resident_id, progress_notes, celebration, family_notified, logged_by)
       VALUES ($1, $2, $3, $4, TRUE, TRUE, $5)`,
      [careHomeId, id, goal.resident_id, 'Goal achieved! Celebration milestone.', userId]
    );

    res.json(goal);
  } catch (err) { next(err); }
}

// ── Get Progress Report ───────────────────────────────────────────────────

export async function getProgressReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: goals } = await query(
      `SELECT rg.*,
         COUNT(DISTINCT rm.id) AS total_milestones,
         COUNT(DISTINCT rm.id) FILTER (WHERE rm.completed = TRUE) AS completed_milestones,
         COUNT(DISTINCT rpl.id) AS total_progress_logs,
         AVG(rpl.score) AS avg_score,
         MAX(rpl.logged_at) AS last_progress
       FROM rehab_goals rg
       LEFT JOIN rehab_milestones rm ON rm.goal_id = rg.id
       LEFT JOIN rehab_progress_logs rpl ON rpl.goal_id = rg.id
       WHERE rg.resident_id = $1 AND rg.care_home_id = $2
       GROUP BY rg.id
       ORDER BY rg.status = 'active' DESC, rg.created_at DESC`,
      [residentId, careHomeId]
    );

    res.json(goals);
  } catch (err) { next(err); }
}
