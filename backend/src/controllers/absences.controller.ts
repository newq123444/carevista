import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { auditLog } from '../services/audit.service';

// Residents temporarily away (hospital, home leave) keep their bed and record,
// but care tasks and meals must not be generated for them.
export async function listAbsences(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const openOnly = String(req.query.open || '') === 'true';
    const { rows } = await query(
      `SELECT a.*, r.first_name, r.last_name, r.room_number,
              u.first_name || ' ' || u.last_name AS recorded_by_name,
              (CURRENT_DATE - a.start_date)::int AS days_away
       FROM resident_absences a
       JOIN residents r ON r.id = a.resident_id
       LEFT JOIN users u ON u.id = a.recorded_by
       WHERE a.care_home_id = $1 ${openOnly ? 'AND a.actual_return IS NULL' : ''}
       ORDER BY (a.actual_return IS NULL) DESC, a.start_date DESC LIMIT 200`, [chId]);
    res.json(rows);
  } catch (err) { next(err); }
}

export async function startAbsence(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body;
    const residentId = b.residentId || b.resident_id;
    if (!residentId) return res.status(400).json({ error: 'A resident is required' });

    const open = await query(
      `SELECT id FROM resident_absences WHERE resident_id = $1 AND actual_return IS NULL`, [residentId]);
    if (open.rows[0]) return res.status(409).json({ error: 'This resident is already recorded as away' });

    const { rows: [row] } = await query(
      `INSERT INTO resident_absences
        (care_home_id, resident_id, absence_type, start_date, expected_return, reason, destination, planned, recorded_by)
       VALUES ($1,$2,$3, COALESCE($4::date, CURRENT_DATE), $5,$6,$7,$8,$9) RETURNING *`,
      [chId, residentId, b.absenceType || b.absence_type || 'hospital',
       b.startDate || b.start_date || null, b.expectedReturn || b.expected_return || null,
       b.reason || null, b.destination || null, b.planned === true, req.user!.id]);

    // Remove undeliverable tasks from the absence start onward.
    const cleared = await query(
      `DELETE FROM care_tasks
       WHERE resident_id = $1 AND care_home_id = $2
         AND task_date >= COALESCE($3::date, CURRENT_DATE)
         AND status NOT IN ('done','deferred') RETURNING id`,
      [residentId, chId, b.startDate || b.start_date || null]);

    // Cancel upcoming meal orders so the kitchen doesn't cook for an empty room.
    await query(
      `UPDATE meal_orders SET status = 'cancelled', updated_at = NOW()
       WHERE resident_id = $1 AND care_home_id = $2 AND meal_date >= CURRENT_DATE
         AND status NOT IN ('served','cancelled')`, [residentId, chId]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'RESIDENT_ABSENCE_STARTED', entityType: 'resident', entityId: residentId,
      afterData: { absenceType: row.absence_type, startDate: row.start_date }, ip: req.ip,
    });

    res.status(201).json({ ...row, tasksCleared: cleared.rows.length });
  } catch (err) { next(err); }
}

export async function endAbsence(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body;
    const { rows: [row] } = await query(
      `UPDATE resident_absences
       SET actual_return = COALESCE($1::date, CURRENT_DATE),
           return_notes = COALESCE($2, return_notes),
           returned_by = $3, updated_at = NOW()
       WHERE id = $4 AND care_home_id = $5 AND actual_return IS NULL
       RETURNING *`,
      [b.actualReturn || b.actual_return || null, b.returnNotes || b.return_notes || null,
       req.user!.id, req.params.id, chId]);
    if (!row) return res.status(404).json({ error: 'No open absence found' });

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'RESIDENT_RETURNED', entityType: 'resident', entityId: row.resident_id,
      afterData: { actualReturn: row.actual_return }, ip: req.ip,
    });

    // Post-return prompts — best practice after a hospital stay.
    const prompts = row.absence_type === 'hospital'
      ? ['Complete a post-hospital review within 24 hours',
         'Record a NEWS2 baseline observation',
         'Reconcile medications against the discharge summary',
         'Reassess falls risk, skin integrity and MUST/nutrition',
         'Update the care plan and inform the family']
      : ['Check the resident has settled back in', 'Update the care plan if anything changed'];

    res.json({ ...row, prompts });
  } catch (err) { next(err); }
}
