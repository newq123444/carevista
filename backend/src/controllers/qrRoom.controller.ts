import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Generate QR Code ──────────────────────────────────────────────────────

export async function generateQrCode(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, roomNumber } = req.body;

    if (!residentId || !roomNumber) {
      return res.status(400).json({ error: 'residentId and roomNumber are required' });
    }

    // Generate a unique QR code data string
    const qrCodeData = `carevista:room:${careHomeId}:${roomNumber}:${Date.now()}`;

    const { rows: [qr] } = await query(
      `INSERT INTO qr_room_codes (care_home_id, resident_id, room_number, qr_code_data, active)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING *`,
      [careHomeId, residentId, roomNumber, qrCodeData]
    );

    res.status(201).json(qr);
  } catch (err) { next(err); }
}

// ── Get QR Codes ──────────────────────────────────────────────────────────

export async function getQrCodes(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { active } = req.query;

    let where = 'WHERE qrc.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;

    if (active !== undefined) { where += ` AND qrc.active = $${p++}`; params.push(active === 'true'); }

    const { rows } = await query(
      `SELECT qrc.*, r.first_name || ' ' || r.last_name AS resident_name
       FROM qr_room_codes qrc
       LEFT JOIN residents r ON r.id = qrc.resident_id
       ${where}
       ORDER BY qrc.room_number`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Scan QR Code ──────────────────────────────────────────────────────────

export async function scanQrCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [qr] } = await query(
      `SELECT qrc.*, r.first_name || ' ' || r.last_name AS resident_name
       FROM qr_room_codes qrc
       LEFT JOIN residents r ON r.id = qrc.resident_id
       WHERE qrc.qr_code_data = $1 AND qrc.care_home_id = $2 AND qrc.active = TRUE`,
      [code, careHomeId]
    );

    if (!qr) throw new AppError(404, 'QR code not found or inactive');

    // Get care plan summary if resident linked
    let carePlan = null;
    let todaysTasks: unknown[] = [];
    let latestVitals = null;

    if (qr.resident_id) {
      const { rows: [plan] } = await query(
        `SELECT * FROM care_plans WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [qr.resident_id]
      );
      carePlan = plan || null;

      const { rows: tasks } = await query(
        `SELECT * FROM care_tasks
         WHERE resident_id = $1 AND task_date = CURRENT_DATE
         ORDER BY due_time ASC`,
        [qr.resident_id]
      );
      todaysTasks = tasks;

      const { rows: [vitals] } = await query(
        `SELECT * FROM care_notes
         WHERE resident_id = $1
           AND (vital_bp_systolic IS NOT NULL OR vital_heart_rate IS NOT NULL
                OR vital_temp IS NOT NULL OR vital_spo2 IS NOT NULL)
         ORDER BY created_at DESC LIMIT 1`,
        [qr.resident_id]
      );
      latestVitals = vitals || null;
    }

    res.json({ qrCode: qr, carePlan, todaysTasks, latestVitals });
  } catch (err) { next(err); }
}

// ── Deactivate QR Code ────────────────────────────────────────────────────

export async function deactivateQrCode(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [qr] } = await query(
      `UPDATE qr_room_codes SET active = FALSE
       WHERE id = $1 AND care_home_id = $2 RETURNING *`,
      [id, careHomeId]
    );

    if (!qr) throw new AppError(404, 'QR code not found');
    res.json(qr);
  } catch (err) { next(err); }
}
