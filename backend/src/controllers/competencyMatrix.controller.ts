import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';

// ── Competencies CRUD ─────────────────────────────────────────────────────

export async function listCompetencies(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { category } = req.query;
    let where = 'WHERE care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (category) { where += ` AND category = $${p++}`; params.push(category); }

    const { rows } = await query(
      `SELECT * FROM competencies ${where} ORDER BY category, name`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function createCompetency(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { name, category, description, requiresRenewal, renewalMonths } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'name and category are required' });
    }

    const { rows: [competency] } = await query(
      `INSERT INTO competencies (care_home_id, name, category, description, requires_renewal, renewal_months)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [careHomeId, name, category, description, requiresRenewal || false, renewalMonths]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'COMPETENCY_CREATED', entityType: 'competency', entityId: competency.id,
      afterData: { name, category }, ip: req.ip,
    });
    res.status(201).json(competency);
  } catch (err) { next(err); }
}

// ── Staff Competencies ────────────────────────────────────────────────────

export async function listStaffCompetencies(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { staffId, competencyId, status } = req.query;
    let where = 'WHERE sc.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (staffId) { where += ` AND sc.staff_id = $${p++}`; params.push(staffId); }
    if (competencyId) { where += ` AND sc.competency_id = $${p++}`; params.push(competencyId); }
    if (status) { where += ` AND sc.status = $${p++}`; params.push(status); }

    const { rows } = await query(
      `SELECT sc.*, c.name AS competency_name, c.category,
        u.first_name || ' ' || u.last_name AS staff_name
       FROM staff_competencies sc
       JOIN competencies c ON c.id = sc.competency_id
       JOIN users u ON u.id = sc.staff_id
       ${where}
       ORDER BY u.last_name, c.category, c.name`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function updateStaffCompetency(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { status, signedOffDate, expiryDate, evidenceNotes } = req.body;

    const { rows: [sc] } = await query(
      `UPDATE staff_competencies SET
        status = COALESCE($1, status),
        signed_off_by = CASE WHEN $1 = 'competent' THEN $2 ELSE signed_off_by END,
        signed_off_date = COALESCE($3, signed_off_date),
        expiry_date = COALESCE($4, expiry_date),
        evidence_notes = COALESCE($5, evidence_notes)
       WHERE id = $6 AND care_home_id = $7 RETURNING *`,
      [status, req.user!.id, signedOffDate, expiryDate, evidenceNotes, id, careHomeId]
    );
    if (!sc) throw new AppError(404, 'Staff competency not found');

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'STAFF_COMPETENCY_UPDATED', entityType: 'staff_competency', entityId: id,
      afterData: { status, signedOffDate }, ip: req.ip,
    });
    res.json(sc);
  } catch (err) { next(err); }
}

export async function assignStaffCompetency(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { staffId, competencyId, status, expiryDate, evidenceNotes } = req.body;

    if (!staffId || !competencyId) {
      return res.status(400).json({ error: 'staffId and competencyId are required' });
    }

    const { rows: [sc] } = await query(
      `INSERT INTO staff_competencies (care_home_id, staff_id, competency_id, status, expiry_date, evidence_notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [careHomeId, staffId, competencyId, status || 'not_started', expiryDate, evidenceNotes]
    );

    res.status(201).json(sc);
  } catch (err) { next(err); }
}

// ── Competency Matrix Grid ────────────────────────────────────────────────

export async function getCompetencyMatrix(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Get all competencies
    const { rows: competencies } = await query(
      `SELECT id, name, category FROM competencies WHERE care_home_id = $1 ORDER BY category, name`,
      [careHomeId]
    );

    // Get all staff with their competencies
    const { rows: staffCompetencies } = await query(
      `SELECT sc.staff_id, sc.competency_id, sc.status, sc.expiry_date,
        u.first_name || ' ' || u.last_name AS staff_name
       FROM staff_competencies sc
       JOIN users u ON u.id = sc.staff_id
       WHERE sc.care_home_id = $1`,
      [careHomeId]
    );

    // Get unique staff list
    const { rows: staff } = await query(
      `SELECT DISTINCT u.id, u.first_name || ' ' || u.last_name AS name
       FROM users u
       JOIN staff_profiles sp ON sp.user_id = u.id
       WHERE sp.care_home_id = $1 AND u.active = true
       ORDER BY name`,
      [careHomeId]
    );

    res.json({ competencies, staffCompetencies, staff });
  } catch (err) { next(err); }
}

// ── Expiring Competencies ─────────────────────────────────────────────────

export async function getExpiringCompetencies(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { days = '30' } = req.query;

    const { rows } = await query(
      `SELECT sc.*, c.name AS competency_name, c.category,
        u.first_name || ' ' || u.last_name AS staff_name
       FROM staff_competencies sc
       JOIN competencies c ON c.id = sc.competency_id
       JOIN users u ON u.id = sc.staff_id
       WHERE sc.care_home_id = $1
         AND sc.expiry_date IS NOT NULL
         AND sc.expiry_date <= CURRENT_DATE + ($2 || ' days')::interval
         AND sc.status = 'competent'
       ORDER BY sc.expiry_date ASC`,
      [careHomeId, days]
    );
    res.json(rows);
  } catch (err) { next(err); }
}
