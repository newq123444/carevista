// src/controllers/infections.controller.ts
// Infection Outbreak Tracker - monitoring and containment
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Create Outbreak ───────────────────────────────────────────────────────
export async function createOutbreak(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const reportedBy = req.user!.id;
    const { outbreakType, startDate, isolationProtocol, notes } = req.body;

    if (!outbreakType || !startDate) {
      throw new AppError(400, 'outbreakType and startDate are required');
    }

    const { rows: [outbreak] } = await query(
      `INSERT INTO infection_outbreaks (
        care_home_id, outbreak_type, start_date,
        isolation_protocol, notes, reported_by, status, affected_count
      ) VALUES ($1,$2,$3,$4,$5,$6,'active',0)
      RETURNING *`,
      [careHomeId, outbreakType, startDate, isolationProtocol || null, notes || null, reportedBy]
    );

    res.status(201).json(outbreak);
  } catch (err) { next(err); }
}

// ── List Outbreaks ────────────────────────────────────────────────────────
export async function listOutbreaks(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { status } = req.query;

    let where = 'WHERE io.care_home_id = $1';
    const params: any[] = [careHomeId];
    let p = 2;

    if (status) {
      where += ` AND io.status = $${p++}`;
      params.push(status);
    }

    const { rows } = await query(
      `SELECT io.*,
        u.first_name || ' ' || u.last_name AS reporter_name,
        (SELECT COUNT(*) FROM infection_cases ic WHERE ic.outbreak_id = io.id) AS case_count
       FROM infection_outbreaks io
       JOIN users u ON u.id = io.reported_by
       ${where}
       ORDER BY io.start_date DESC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Outbreak Details ──────────────────────────────────────────────────
export async function getOutbreakDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;

    const { rows: [outbreak] } = await query(
      `SELECT io.*,
        u.first_name || ' ' || u.last_name AS reporter_name
       FROM infection_outbreaks io
       JOIN users u ON u.id = io.reported_by
       WHERE io.id = $1 AND io.care_home_id = $2`,
      [id, careHomeId]
    );

    if (!outbreak) {
      throw new AppError(404, 'Outbreak not found');
    }

    const { rows: cases } = await query(
      `SELECT ic.*,
        r.first_name || ' ' || r.last_name AS resident_name,
        r.room_number
       FROM infection_cases ic
       JOIN residents r ON r.id = ic.resident_id
       WHERE ic.outbreak_id = $1 AND ic.care_home_id = $2
       ORDER BY ic.onset_date ASC`,
      [id, careHomeId]
    );

    res.json({ ...outbreak, cases });
  } catch (err) { next(err); }
}

// ── Add Infection Case ────────────────────────────────────────────────────
export async function addInfectionCase(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { outbreakId } = req.params;
    const { residentId, symptoms, onsetDate, isolationStart } = req.body;

    if (!residentId || !symptoms || !onsetDate) {
      throw new AppError(400, 'residentId, symptoms, and onsetDate are required');
    }

    // Verify outbreak exists and belongs to this care home
    const { rows: [outbreak] } = await query(
      'SELECT id FROM infection_outbreaks WHERE id = $1 AND care_home_id = $2',
      [outbreakId, careHomeId]
    );
    if (!outbreak) {
      throw new AppError(404, 'Outbreak not found');
    }

    const { rows: [infectionCase] } = await query(
      `INSERT INTO infection_cases (
        care_home_id, outbreak_id, resident_id,
        symptoms, onset_date, isolation_start, status
      ) VALUES ($1,$2,$3,$4,$5,$6,'active')
      RETURNING *`,
      [careHomeId, outbreakId, residentId, symptoms, onsetDate, isolationStart || null]
    );

    // Increment affected_count on the outbreak
    await query(
      `UPDATE infection_outbreaks SET affected_count = affected_count + 1, updated_at = NOW()
       WHERE id = $1`,
      [outbreakId]
    );

    res.status(201).json(infectionCase);
  } catch (err) { next(err); }
}

// ── Update Case Status ────────────────────────────────────────────────────
export async function updateCaseStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { status, isolationEnd, notes } = req.body;

    // If status is resolved, set isolation_end
    const endDate = status === 'resolved' ? (isolationEnd || new Date().toISOString()) : isolationEnd;

    const { rows: [infectionCase] } = await query(
      `UPDATE infection_cases
       SET status = COALESCE($1, status),
           isolation_end = COALESCE($2, isolation_end),
           notes = COALESCE($3, notes)
       WHERE id = $4 AND care_home_id = $5
       RETURNING *`,
      [status || null, endDate || null, notes || null, id, careHomeId]
    );

    if (!infectionCase) {
      throw new AppError(404, 'Infection case not found');
    }

    res.json(infectionCase);
  } catch (err) { next(err); }
}

// ── Update Outbreak Status ────────────────────────────────────────────────
export async function updateOutbreakStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { status, endDate, notes } = req.body;

    const { rows: [outbreak] } = await query(
      `UPDATE infection_outbreaks
       SET status = COALESCE($1, status),
           end_date = COALESCE($2, end_date),
           notes = COALESCE($3, notes),
           updated_at = NOW()
       WHERE id = $4 AND care_home_id = $5
       RETURNING *`,
      [status || null, endDate || null, notes || null, id, careHomeId]
    );

    if (!outbreak) {
      throw new AppError(404, 'Outbreak not found');
    }

    res.json(outbreak);
  } catch (err) { next(err); }
}

// ── Get Outbreak Timeline ─────────────────────────────────────────────────
export async function getOutbreakTimeline(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;

    // Verify outbreak exists
    const { rows: [outbreak] } = await query(
      'SELECT id, outbreak_type, start_date, status FROM infection_outbreaks WHERE id = $1 AND care_home_id = $2',
      [id, careHomeId]
    );
    if (!outbreak) {
      throw new AppError(404, 'Outbreak not found');
    }

    // Get all cases as timeline events
    const { rows: cases } = await query(
      `SELECT
        ic.id,
        'case_added' AS event_type,
        ic.onset_date AS event_date,
        r.first_name || ' ' || r.last_name AS resident_name,
        r.room_number,
        ic.symptoms,
        ic.status AS case_status,
        ic.created_at
       FROM infection_cases ic
       JOIN residents r ON r.id = ic.resident_id
       WHERE ic.outbreak_id = $1 AND ic.care_home_id = $2
       ORDER BY ic.onset_date ASC`,
      [id, careHomeId]
    );

    // Build timeline combining outbreak creation and cases
    const timeline = [
      {
        event_type: 'outbreak_started',
        event_date: outbreak.start_date,
        description: `${outbreak.outbreak_type} outbreak reported`,
      },
      ...cases.map((c: any) => ({
        event_type: c.event_type,
        event_date: c.event_date,
        description: `${c.resident_name} (Room ${c.room_number}) - ${c.symptoms}`,
        case_status: c.case_status,
      })),
    ];

    res.json({ outbreak, timeline });
  } catch (err) { next(err); }
}
