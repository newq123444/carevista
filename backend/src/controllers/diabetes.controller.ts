import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Log Glucose ───────────────────────────────────────────────────────────

export async function logGlucose(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId, readingValue, readingType, notes } = req.body;

    if (!residentId || readingValue == null || !readingType) {
      return res.status(400).json({ error: 'residentId, readingValue, and readingType are required' });
    }

    const { rows: [reading] } = await query(
      `INSERT INTO glucose_readings (care_home_id, resident_id, reading_value, reading_type, recorded_by, recorded_at, notes)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6) RETURNING *`,
      [careHomeId, residentId, readingValue, readingType, userId, notes]
    );

    // Auto-generate alert if hypo or hyper
    if (readingValue < 4.0) {
      await query(
        `INSERT INTO diabetes_alerts (care_home_id, resident_id, alert_type, glucose_value, triggered_at)
         VALUES ($1, $2, 'hypo', $3, NOW())`,
        [careHomeId, residentId, readingValue]
      );
    } else if (readingValue > 11.0) {
      await query(
        `INSERT INTO diabetes_alerts (care_home_id, resident_id, alert_type, glucose_value, triggered_at)
         VALUES ($1, $2, 'hyper', $3, NOW())`,
        [careHomeId, residentId, readingValue]
      );
    }

    res.status(201).json(reading);
  } catch (err) { next(err); }
}

// ── Get Glucose Readings ──────────────────────────────────────────────────

export async function getGlucoseReadings(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT gr.*, u.first_name || ' ' || u.last_name AS recorded_by_name
       FROM glucose_readings gr
       JOIN users u ON u.id = gr.recorded_by
       WHERE gr.resident_id = $1 AND gr.care_home_id = $2
       ORDER BY gr.recorded_at DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Log Insulin Dose ──────────────────────────────────────────────────────

export async function logInsulinDose(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId, insulinType, doseUnits, injectionSite, notes } = req.body;

    if (!residentId || !insulinType || doseUnits == null) {
      return res.status(400).json({ error: 'residentId, insulinType, and doseUnits are required' });
    }

    const { rows: [dose] } = await query(
      `INSERT INTO insulin_doses (care_home_id, resident_id, insulin_type, dose_units, injection_site, administered_by, administered_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7) RETURNING *`,
      [careHomeId, residentId, insulinType, doseUnits, injectionSite, userId, notes]
    );

    res.status(201).json(dose);
  } catch (err) { next(err); }
}

// ── Get Insulin Doses ─────────────────────────────────────────────────────

export async function getInsulinDoses(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT id.*, u.first_name || ' ' || u.last_name AS administered_by_name
       FROM insulin_doses id
       JOIN users u ON u.id = id.administered_by
       WHERE id.resident_id = $1 AND id.care_home_id = $2
       ORDER BY id.administered_at DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Record HbA1c ──────────────────────────────────────────────────────────

export async function recordHba1c(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId, value, testDate } = req.body;

    if (!residentId || value == null || !testDate) {
      return res.status(400).json({ error: 'residentId, value, and testDate are required' });
    }

    const { rows: [record] } = await query(
      `INSERT INTO hba1c_records (care_home_id, resident_id, value, test_date, recorded_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [careHomeId, residentId, value, testDate, userId]
    );

    res.status(201).json(record);
  } catch (err) { next(err); }
}

// ── Get HbA1c History ─────────────────────────────────────────────────────

export async function getHba1cHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT h.*, u.first_name || ' ' || u.last_name AS recorded_by_name
       FROM hba1c_records h
       JOIN users u ON u.id = h.recorded_by
       WHERE h.resident_id = $1 AND h.care_home_id = $2
       ORDER BY h.test_date DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Alerts ────────────────────────────────────────────────────────────

export async function getAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { acknowledged } = req.query;

    let where = 'WHERE da.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;

    if (acknowledged === 'false') {
      where += ` AND da.acknowledged_at IS NULL`;
    } else if (acknowledged === 'true') {
      where += ` AND da.acknowledged_at IS NOT NULL`;
    }

    const { rows } = await query(
      `SELECT da.*, r.first_name || ' ' || r.last_name AS resident_name, r.room_number
       FROM diabetes_alerts da
       JOIN residents r ON r.id = da.resident_id
       ${where}
       ORDER BY da.triggered_at DESC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Acknowledge Alert ─────────────────────────────────────────────────────

export async function acknowledgeAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { actionsTaken } = req.body;

    const { rows: [alert] } = await query(
      `UPDATE diabetes_alerts
       SET acknowledged_by = $1, acknowledged_at = NOW(), actions_taken = $2
       WHERE id = $3 AND care_home_id = $4 AND acknowledged_at IS NULL
       RETURNING *`,
      [userId, actionsTaken, id, careHomeId]
    );

    if (!alert) throw new AppError(404, 'Alert not found or already acknowledged');
    res.json(alert);
  } catch (err) { next(err); }
}

// ── Get Glucose Patterns ──────────────────────────────────────────────────

export async function getGlucosePatterns(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    // Get readings grouped by type for pattern analysis
    const { rows } = await query(
      `SELECT reading_type,
         AVG(reading_value) AS avg_value,
         MIN(reading_value) AS min_value,
         MAX(reading_value) AS max_value,
         COUNT(*) AS reading_count,
         STDDEV(reading_value) AS std_deviation
       FROM glucose_readings
       WHERE resident_id = $1 AND care_home_id = $2
         AND recorded_at >= NOW() - INTERVAL '30 days'
       GROUP BY reading_type
       ORDER BY reading_type`,
      [residentId, careHomeId]
    );

    // Get daily averages for trend
    const { rows: dailyTrend } = await query(
      `SELECT recorded_at::date AS date, AVG(reading_value) AS avg_value, COUNT(*) AS readings
       FROM glucose_readings
       WHERE resident_id = $1 AND care_home_id = $2
         AND recorded_at >= NOW() - INTERVAL '30 days'
       GROUP BY recorded_at::date
       ORDER BY date ASC`,
      [residentId, careHomeId]
    );

    res.json({ patterns: rows, dailyTrend });
  } catch (err) { next(err); }
}
