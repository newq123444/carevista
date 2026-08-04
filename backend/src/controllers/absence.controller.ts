import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';

export async function recordAbsence(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { staffId, absenceType, startDate, endDate, totalDays, reason, selfCertified, fitNoteReceived } = req.body;

    const trimmedStaffId = typeof staffId === 'string' ? staffId.trim() : staffId;
    const trimmedAbsenceType = typeof absenceType === 'string' ? absenceType.trim() : absenceType;
    const trimmedStartDate = typeof startDate === 'string' ? startDate.trim() : startDate;

    if (!trimmedStaffId || !trimmedAbsenceType || !trimmedStartDate) {
      return res.status(400).json({ error: 'staffId, absenceType and startDate are required' });
    }

    const { rows: [absence] } = await query(
      `INSERT INTO absence_records (care_home_id, staff_id, absence_type, start_date, end_date, total_days, reason, self_certified, fit_note_received, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [careHomeId, trimmedStaffId, trimmedAbsenceType, trimmedStartDate, endDate, totalDays, reason, selfCertified || false, fitNoteReceived || false, req.user!.id]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'ABSENCE_RECORDED', entityType: 'absence_record', entityId: absence.id,
      afterData: { staffId, absenceType, startDate, endDate, totalDays }, ip: req.ip,
    });
    res.status(201).json(absence);
  } catch (err) { next(err); }
}

export async function listAbsences(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { staffId, absenceType } = req.query;
    let where = 'WHERE ar.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (staffId) { where += ` AND ar.staff_id = $${p++}`; params.push(staffId); }
    if (absenceType) { where += ` AND ar.absence_type = $${p++}`; params.push(absenceType); }

    const { rows } = await query(
      `SELECT ar.*, u.first_name || ' ' || u.last_name AS staff_name
       FROM absence_records ar
       JOIN users u ON u.id = ar.staff_id
       ${where}
       ORDER BY ar.start_date DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function calculateBradfordScore(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { staffId, periodStart, periodEnd } = req.body;

    if (!staffId || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'staffId, periodStart, and periodEnd are required' });
    }

    // Bradford Factor = S x S x D (S = number of spells, D = total days)
    const { rows: [result] } = await query(
      `SELECT COUNT(*)::int AS spells, COALESCE(SUM(total_days), 0)::int AS total_days
       FROM absence_records
       WHERE care_home_id = $1 AND staff_id = $2 AND start_date >= $3 AND start_date <= $4`,
      [careHomeId, staffId, periodStart, periodEnd]
    );

    const spells = result.spells;
    const totalDays = result.total_days;
    const score = spells * spells * totalDays;

    // Store the calculated score
    const { rows: [bradford] } = await query(
      `INSERT INTO bradford_scores (care_home_id, staff_id, calculated_date, score, spells, total_days, period_start, period_end)
       VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7) RETURNING *`,
      [careHomeId, staffId, score, spells, totalDays, periodStart, periodEnd]
    );

    res.status(201).json(bradford);
  } catch (err) { next(err); }
}

export async function getBradfordScores(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { staffId } = req.query;
    let where = 'WHERE bs.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (staffId) { where += ` AND bs.staff_id = $${p++}`; params.push(staffId); }

    const { rows } = await query(
      `SELECT bs.*, u.first_name || ' ' || u.last_name AS staff_name
       FROM bradford_scores bs
       JOIN users u ON u.id = bs.staff_id
       ${where}
       ORDER BY bs.calculated_date DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function getAbsencePatterns(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { staffId } = req.query;
    let where = 'WHERE care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (staffId) { where += ` AND staff_id = $${p++}`; params.push(staffId); }

    // Detect day-of-week patterns
    const { rows: dayPatterns } = await query(
      `SELECT EXTRACT(DOW FROM start_date)::int AS day_of_week, COUNT(*)::int AS count
       FROM absence_records ${where}
       GROUP BY EXTRACT(DOW FROM start_date)
       ORDER BY count DESC`,
      params
    );

    // Monthly pattern
    const { rows: monthPatterns } = await query(
      `SELECT EXTRACT(MONTH FROM start_date)::int AS month, COUNT(*)::int AS count
       FROM absence_records ${where}
       GROUP BY EXTRACT(MONTH FROM start_date)
       ORDER BY count DESC`,
      params
    );

    // Type breakdown
    const { rows: typeBreakdown } = await query(
      `SELECT absence_type, COUNT(*)::int AS count, COALESCE(SUM(total_days), 0)::numeric AS total_days
       FROM absence_records ${where}
       GROUP BY absence_type
       ORDER BY count DESC`,
      params
    );

    res.json({ dayPatterns, monthPatterns, typeBreakdown });
  } catch (err) { next(err); }
}

export async function getReturnToWorkDue(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT ar.*, u.first_name || ' ' || u.last_name AS staff_name
       FROM absence_records ar
       JOIN users u ON u.id = ar.staff_id
       WHERE ar.care_home_id = $1
         AND ar.end_date IS NOT NULL
         AND ar.end_date <= CURRENT_DATE
         AND ar.return_to_work_completed = false
       ORDER BY ar.end_date ASC`,
      [careHomeId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function completeReturnToWork(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { returnToWorkDate, returnToWorkNotes } = req.body;

    const { rows: [absence] } = await query(
      `UPDATE absence_records SET
        return_to_work_date = $1,
        return_to_work_completed = true,
        return_to_work_notes = $2
       WHERE id = $3 AND care_home_id = $4 RETURNING *`,
      [returnToWorkDate || new Date().toISOString().slice(0, 10), returnToWorkNotes, id, careHomeId]
    );
    if (!absence) throw new AppError(404, 'Absence record not found');

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'RETURN_TO_WORK_COMPLETED', entityType: 'absence_record', entityId: id,
      afterData: { returnToWorkDate, returnToWorkNotes }, ip: req.ip,
    });
    res.json(absence);
  } catch (err) { next(err); }
}

export async function getAbsenceDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows: [summary] } = await query(
      `SELECT
        COUNT(*) FILTER (WHERE end_date IS NULL OR end_date >= CURRENT_DATE)::int AS currently_absent,
        COUNT(*) FILTER (WHERE start_date >= CURRENT_DATE - INTERVAL '30 days')::int AS absences_last_30_days,
        COALESCE(SUM(total_days) FILTER (WHERE start_date >= CURRENT_DATE - INTERVAL '30 days'), 0)::numeric AS days_lost_last_30,
        COUNT(*) FILTER (WHERE end_date IS NOT NULL AND end_date <= CURRENT_DATE AND return_to_work_completed = false)::int AS rtw_due
       FROM absence_records WHERE care_home_id = $1`,
      [careHomeId]
    );

    // Top Bradford scores
    const { rows: topBradford } = await query(
      `SELECT DISTINCT ON (bs.staff_id) bs.*, u.first_name || ' ' || u.last_name AS staff_name
       FROM bradford_scores bs
       JOIN users u ON u.id = bs.staff_id
       WHERE bs.care_home_id = $1
       ORDER BY bs.staff_id, bs.calculated_date DESC`,
      [careHomeId]
    );

    res.json({ summary, topBradford: topBradford.sort((a: { score: number }, b: { score: number }) => b.score - a.score).slice(0, 10) });
  } catch (err) { next(err); }
}
