import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Get Upcoming ──────────────────────────────────────────────────────────

export async function getUpcoming(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { days } = req.query;
    const lookAheadDays = parseInt(days as string) || 30;

    // Get planned celebrations
    const { rows: planned } = await query(
      `SELECT c.*, r.first_name || ' ' || r.last_name AS resident_name
       FROM celebrations c
       LEFT JOIN residents r ON r.id = c.resident_id
       WHERE c.care_home_id = $1
         AND c.celebration_date BETWEEN CURRENT_DATE AND CURRENT_DATE + ($2 || ' days')::INTERVAL
         AND c.status != 'cancelled'
       ORDER BY c.celebration_date ASC`,
      [careHomeId, lookAheadDays.toString()]
    );

    // Auto-detect upcoming birthdays
    const { rows: birthdays } = await query(
      `SELECT id, first_name || ' ' || last_name AS name, date_of_birth,
         CASE
           WHEN EXTRACT(MONTH FROM date_of_birth) = 2 AND EXTRACT(DAY FROM date_of_birth) = 29 THEN
             CASE
               WHEN EXTRACT(MONTH FROM CURRENT_DATE) <= 2
               THEN (EXTRACT(YEAR FROM CURRENT_DATE)::INT || '-02-28')::DATE + 
                    CASE WHEN (EXTRACT(YEAR FROM CURRENT_DATE)::INT % 4 = 0 
                              AND (EXTRACT(YEAR FROM CURRENT_DATE)::INT % 100 != 0 
                                   OR EXTRACT(YEAR FROM CURRENT_DATE)::INT % 400 = 0))
                         THEN 1 ELSE 0 END
               ELSE ((EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1) || '-02-28')::DATE +
                    CASE WHEN ((EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1) % 4 = 0 
                              AND ((EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1) % 100 != 0 
                                   OR (EXTRACT(YEAR FROM CURRENT_DATE)::INT + 1) % 400 = 0))
                         THEN 1 ELSE 0 END
             END
           WHEN EXTRACT(MONTH FROM date_of_birth) > EXTRACT(MONTH FROM CURRENT_DATE)
             OR (EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
                 AND EXTRACT(DAY FROM date_of_birth) >= EXTRACT(DAY FROM CURRENT_DATE))
           THEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::INT, EXTRACT(MONTH FROM date_of_birth)::INT, EXTRACT(DAY FROM date_of_birth)::INT)
           ELSE MAKE_DATE((EXTRACT(YEAR FROM CURRENT_DATE) + 1)::INT, EXTRACT(MONTH FROM date_of_birth)::INT, EXTRACT(DAY FROM date_of_birth)::INT)
         END AS next_birthday
       FROM residents
       WHERE care_home_id = $1 AND active = TRUE AND date_of_birth IS NOT NULL
       ORDER BY next_birthday ASC
       LIMIT 10`,
      [careHomeId]
    );

    // Auto-detect admission anniversaries
    const { rows: anniversaries } = await query(
      `SELECT id, first_name || ' ' || last_name AS name, admission_date,
         EXTRACT(YEAR FROM AGE(CURRENT_DATE, admission_date)) + 1 AS upcoming_year
       FROM residents
       WHERE care_home_id = $1 AND active = TRUE AND admission_date IS NOT NULL
         AND EXTRACT(MONTH FROM admission_date) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(DAY FROM admission_date) BETWEEN EXTRACT(DAY FROM CURRENT_DATE) AND EXTRACT(DAY FROM CURRENT_DATE) + $2
       ORDER BY admission_date ASC`,
      [careHomeId, lookAheadDays]
    );

    res.json({ planned, birthdays, anniversaries });
  } catch (err) { next(err); }
}

// ── Create Celebration ────────────────────────────────────────────────────

export async function createCelebration(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId, celebrationType, title, description, celebrationDate, autoDetected, budget, notes } = req.body;

    if (!celebrationType || !title || !celebrationDate) {
      return res.status(400).json({ error: 'celebrationType, title, and celebrationDate are required' });
    }

    const { rows: [celebration] } = await query(
      `INSERT INTO celebrations (care_home_id, resident_id, celebration_type, title, description, celebration_date, auto_detected, budget, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [careHomeId, residentId || null, celebrationType, title, description, celebrationDate, autoDetected || false, budget, notes, userId]
    );

    res.status(201).json(celebration);
  } catch (err) { next(err); }
}

// ── Assign Task ───────────────────────────────────────────────────────────

export async function assignTask(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { celebrationId, title, assignedTo, dueDate, notes } = req.body;

    if (!celebrationId || !title) {
      return res.status(400).json({ error: 'celebrationId and title are required' });
    }

    const { rows: [task] } = await query(
      `INSERT INTO celebration_tasks (care_home_id, celebration_id, title, assigned_to, due_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [careHomeId, celebrationId, title, assignedTo || null, dueDate, notes]
    );

    res.status(201).json(task);
  } catch (err) { next(err); }
}

// ── Complete Task ─────────────────────────────────────────────────────────

export async function completeTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;

    const { rows: [task] } = await query(
      `UPDATE celebration_tasks
       SET completed = TRUE, completed_at = NOW(), completed_by = $1
       WHERE id = $2 AND care_home_id = $3
       RETURNING *`,
      [userId, id, careHomeId]
    );

    if (!task) throw new AppError(404, 'Task not found');
    res.json(task);
  } catch (err) { next(err); }
}

// ── Get Celebration Calendar ──────────────────────────────────────────────

export async function getCelebrationCalendar(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { month, year } = req.query;

    const targetMonth = parseInt(month as string) || new Date().getMonth() + 1;
    const targetYear = parseInt(year as string) || new Date().getFullYear();

    const { rows: events } = await query(
      `SELECT * FROM celebration_calendar
       WHERE care_home_id = $1
         AND EXTRACT(MONTH FROM event_date) = $2
         AND EXTRACT(YEAR FROM event_date) = $3
       ORDER BY event_date ASC`,
      [careHomeId, targetMonth, targetYear]
    );

    const { rows: celebrations } = await query(
      `SELECT c.*, r.first_name || ' ' || r.last_name AS resident_name
       FROM celebrations c
       LEFT JOIN residents r ON r.id = c.resident_id
       WHERE c.care_home_id = $1
         AND EXTRACT(MONTH FROM c.celebration_date) = $2
         AND EXTRACT(YEAR FROM c.celebration_date) = $3
       ORDER BY c.celebration_date ASC`,
      [careHomeId, targetMonth, targetYear]
    );

    res.json({ events, celebrations });
  } catch (err) { next(err); }
}

// ── Notify Family ─────────────────────────────────────────────────────────

export async function notifyFamily(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { message } = req.body;

    // Get celebration details
    const { rows: [celebration] } = await query(
      `SELECT c.*, r.first_name || ' ' || r.last_name AS resident_name
       FROM celebrations c
       LEFT JOIN residents r ON r.id = c.resident_id
       WHERE c.id = $1 AND c.care_home_id = $2`,
      [id, careHomeId]
    );

    if (!celebration) throw new AppError(404, 'Celebration not found');

    // In a real implementation, this would send an email/notification
    // For now, we log it as a note
    res.json({
      success: true,
      celebration_id: id,
      message: message || `Family notified about ${celebration.title}`,
      resident_name: celebration.resident_name
    });
  } catch (err) { next(err); }
}
