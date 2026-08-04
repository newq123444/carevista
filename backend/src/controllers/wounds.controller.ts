// src/controllers/wounds.controller.ts
// Wound Photography Timeline - tracking and body map visualization
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Create Wound Assessment ───────────────────────────────────────────────
export async function createWoundAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const assessedBy = req.user!.id;
    const {
      residentId,
      woundType,
      locationBodyArea,
      locationX,
      locationY,
      widthMm,
      heightMm,
      depthMm,
      woundBed,
      exudateLevel,
      exudateType,
      surroundingSkin,
      painLevel,
      notes,
      status,
    } = req.body;

    if (!residentId || !woundType || !locationBodyArea) {
      throw new AppError(400, 'residentId, woundType, and locationBodyArea are required');
    }

    // Get photo URL from uploaded file if present
    const file = (req as any).file;
    const photoUrl = file ? `/uploads/${file.filename}` : null;

    const { rows: [assessment] } = await query(
      `INSERT INTO wound_assessments (
        care_home_id, resident_id, assessed_by,
        wound_type, location_body_area, location_x, location_y,
        width_mm, height_mm, depth_mm,
        wound_bed, exudate_level, exudate_type,
        surrounding_skin, pain_level, photo_url,
        notes, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING *`,
      [
        careHomeId, residentId, assessedBy,
        woundType, locationBodyArea, locationX || null, locationY || null,
        widthMm || null, heightMm || null, depthMm || null,
        woundBed || null, exudateLevel || null, exudateType || null,
        surroundingSkin || null, painLevel || null, photoUrl,
        notes || null, status || 'active',
      ]
    );

    res.status(201).json(assessment);
  } catch (err) { next(err); }
}

// ── Get Wound Timeline ────────────────────────────────────────────────────
export async function getWoundTimeline(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;
    const { locationBodyArea } = req.query;

    let where = 'WHERE wa.care_home_id = $1 AND wa.resident_id = $2';
    const params: any[] = [careHomeId, residentId];
    let p = 3;

    if (locationBodyArea) {
      where += ` AND wa.location_body_area = $${p++}`;
      params.push(locationBodyArea);
    }

    const { rows } = await query(
      `SELECT wa.*,
        u.first_name || ' ' || u.last_name AS assessor_name
       FROM wound_assessments wa
       JOIN users u ON u.id = wa.assessed_by
       ${where}
       ORDER BY wa.created_at ASC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── List Active Wounds ────────────────────────────────────────────────────
export async function listActiveWounds(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT wa.*,
        r.first_name || ' ' || r.last_name AS resident_name,
        r.room_number
       FROM wound_assessments wa
       JOIN residents r ON r.id = wa.resident_id
       WHERE wa.care_home_id = $1
         AND wa.status IN ('active', 'healing', 'worsening')
       ORDER BY wa.created_at DESC`,
      [careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Update Wound Assessment ───────────────────────────────────────────────
export async function updateWoundAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { status, notes } = req.body;

    const { rows: [assessment] } = await query(
      `UPDATE wound_assessments
       SET status = COALESCE($1, status),
           notes = COALESCE($2, notes),
           updated_at = NOW()
       WHERE id = $3 AND care_home_id = $4
       RETURNING *`,
      [status || null, notes || null, id, careHomeId]
    );

    if (!assessment) {
      throw new AppError(404, 'Wound assessment not found');
    }

    res.json(assessment);
  } catch (err) { next(err); }
}

// ── Get Body Map Overview ─────────────────────────────────────────────────
export async function getBodyMapOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;

    const { rows } = await query(
      `SELECT
        location_body_area,
        location_x,
        location_y,
        status,
        MAX(created_at) AS latest_created_at
       FROM wound_assessments
       WHERE care_home_id = $1 AND resident_id = $2
         AND status IN ('active', 'healing', 'worsening')
       GROUP BY location_body_area, location_x, location_y, status
       ORDER BY latest_created_at DESC`,
      [careHomeId, residentId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}
