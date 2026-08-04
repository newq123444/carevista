import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

export async function getWeekRota(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { startDate, endDate } = req.query;

    const { rows: shifts } = await query(
      `SELECT s.*,
        u.first_name || ' ' || u.last_name AS staff_name,
        u.role AS staff_role,
        sp.job_title
       FROM shifts s
       JOIN staff_profiles sp ON sp.id = s.staff_id
       JOIN users u ON u.id = sp.user_id
       WHERE s.care_home_id = $1
         AND s.shift_date BETWEEN $2 AND $3
       ORDER BY s.shift_date, s.start_time NULLS LAST`,
      [careHomeId, startDate, endDate]
    );

    const { rows: staff } = await query(
      `SELECT sp.id, u.first_name, u.last_name, u.role, sp.job_title, sp.contract_hours
       FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.care_home_id = $1 AND u.active = TRUE AND u.deleted_at IS NULL
       ORDER BY u.last_name, u.first_name`,
      [careHomeId]
    );

    // Build matrix: staffId -> date -> shift
    const matrix: Record<string, Record<string, any>> = {};
    for (const sh of shifts) {
      if (!matrix[sh.staff_id]) matrix[sh.staff_id] = {};
      matrix[sh.staff_id][sh.shift_date.toISOString().slice(0, 10)] = sh;
    }

    // Coverage counts per day
    const { rows: coverage } = await query(
      `SELECT shift_date::text AS date, COUNT(*) AS total_working,
        COUNT(*) FILTER (WHERE shift_type = 'day') AS day_shifts,
        COUNT(*) FILTER (WHERE shift_type = 'night') AS night_shifts
       FROM shifts
       WHERE care_home_id = $1
         AND shift_date BETWEEN $2 AND $3
         AND shift_type NOT IN ('off', 'annual_leave', 'sick')
       GROUP BY shift_date ORDER BY shift_date`,
      [careHomeId, startDate, endDate]
    );

    res.json({ staff, shifts, matrix, coverage });
  } catch (err) { next(err); }
}

export async function upsertShift(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { staffId, shiftDate, shiftType, startTime, endTime, notes } = req.body;

    if (!staffId || !shiftDate || !shiftType) {
      return res.status(400).json({ error: 'staffId, shiftDate, and shiftType are required' });
    }

    const { rows: [shift] } = await query(
      `INSERT INTO shifts (care_home_id, staff_id, shift_date, shift_type, start_time, end_time, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (staff_id, shift_date)
       DO UPDATE SET shift_type = EXCLUDED.shift_type, start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time, notes = EXCLUDED.notes
       RETURNING *`,
      [careHomeId, staffId, shiftDate, shiftType, startTime, endTime, notes, req.user!.id]
    );
    res.json(shift);
  } catch (err) { next(err); }
}

export async function deleteShift(req: Request, res: Response, next: NextFunction) {
  try {
    const { staffId, date } = req.params;
    const careHomeId = req.user!.care_home_id;
    await query(
      'DELETE FROM shifts WHERE staff_id = $1 AND shift_date = $2 AND care_home_id = $3',
      [staffId, date, careHomeId]
    );
    res.json({ message: 'Shift removed' });
  } catch (err) { next(err); }
}
