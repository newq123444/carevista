import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Create Signoff ────────────────────────────────────────────────────────

export async function createSignoff(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const assessorId = req.user!.id;
    const { staffId, competencyId, observationDate, outcome, evidenceNotes, furtherTrainingNeeded } = req.body;

    if (!staffId || !competencyId) {
      return res.status(400).json({ error: 'staffId and competencyId are required' });
    }

    const { rows: [signoff] } = await query(
      `INSERT INTO competency_signoffs
       (care_home_id, staff_id, competency_id, assessor_id, observation_date, outcome, evidence_notes, further_training_needed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [careHomeId, staffId, competencyId, assessorId, observationDate, outcome, evidenceNotes, furtherTrainingNeeded]
    );

    res.status(201).json(signoff);
  } catch (err) { next(err); }
}

// ── List Signoffs ─────────────────────────────────────────────────────────

export async function listSignoffs(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { staffId, outcome, competencyId } = req.query;

    let where = 'WHERE cs.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;

    if (staffId) { where += ` AND cs.staff_id = $${p++}`; params.push(staffId); }
    if (outcome) { where += ` AND cs.outcome = $${p++}`; params.push(outcome); }
    if (competencyId) { where += ` AND cs.competency_id = $${p++}`; params.push(competencyId); }

    const { rows } = await query(
      `SELECT cs.*,
         u.first_name || ' ' || u.last_name AS staff_name,
         a.first_name || ' ' || a.last_name AS assessor_name
       FROM competency_signoffs cs
       JOIN users u ON u.id = cs.staff_id
       JOIN users a ON a.id = cs.assessor_id
       ${where}
       ORDER BY cs.observation_date DESC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Signoff ───────────────────────────────────────────────────────────

export async function getSignoff(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [signoff] } = await query(
      `SELECT cs.*,
         u.first_name || ' ' || u.last_name AS staff_name,
         a.first_name || ' ' || a.last_name AS assessor_name
       FROM competency_signoffs cs
       JOIN users u ON u.id = cs.staff_id
       JOIN users a ON a.id = cs.assessor_id
       WHERE cs.id = $1 AND cs.care_home_id = $2`,
      [id, careHomeId]
    );

    if (!signoff) throw new AppError(404, 'Signoff not found');
    res.json(signoff);
  } catch (err) { next(err); }
}

// ── Update Signoff ────────────────────────────────────────────────────────

export async function updateSignoff(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { outcome, evidenceNotes, furtherTrainingNeeded, signedOff } = req.body;

    const { rows: [signoff] } = await query(
      `UPDATE competency_signoffs SET
         outcome = COALESCE($1, outcome),
         evidence_notes = COALESCE($2, evidence_notes),
         further_training_needed = COALESCE($3, further_training_needed),
         signed_off = COALESCE($4, signed_off),
         signed_off_at = CASE WHEN $4 = TRUE THEN NOW() ELSE signed_off_at END
       WHERE id = $5 AND care_home_id = $6 RETURNING *`,
      [outcome, evidenceNotes, furtherTrainingNeeded, signedOff, id, careHomeId]
    );

    if (!signoff) throw new AppError(404, 'Signoff not found');
    res.json(signoff);
  } catch (err) { next(err); }
}

// ── Get Staff Signoffs ────────────────────────────────────────────────────

export async function getStaffSignoffs(req: Request, res: Response, next: NextFunction) {
  try {
    const { staffId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT cs.*,
         a.first_name || ' ' || a.last_name AS assessor_name
       FROM competency_signoffs cs
       JOIN users a ON a.id = cs.assessor_id
       WHERE cs.staff_id = $1 AND cs.care_home_id = $2
       ORDER BY cs.observation_date DESC`,
      [staffId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}
