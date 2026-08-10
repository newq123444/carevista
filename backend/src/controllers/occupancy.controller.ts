import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';


// Live occupancy derived from the actual resident record — the single source of
// truth. Manual occupancy_records are snapshots for history/forecasting.
async function liveOccupancy(careHomeId: string) {
  const { rows: [row] } = await query(
    `SELECT (SELECT COUNT(*)::int FROM residents WHERE care_home_id = $1 AND active = TRUE) AS occupied_beds,
            (SELECT COALESCE(registered_beds, 0)::int FROM care_homes WHERE id = $1) AS total_beds`,
    [careHomeId]
  );
  const totalBeds = row?.total_beds || 0;
  const occupiedBeds = row?.occupied_beds || 0;
  return {
    totalBeds, occupiedBeds,
    vacantBeds: Math.max(0, totalBeds - occupiedBeds),
    occupancyPct: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 1000) / 10 : 0,
  };
}

export async function recordOccupancy(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const b = req.body;
    const live = await liveOccupancy(careHomeId);
    const recordDate = b.recordDate || b.record_date || new Date().toISOString().slice(0, 10);
    const totalBeds = b.totalBeds ?? b.total_beds ?? live.totalBeds;
    const occupiedBeds = b.occupiedBeds ?? b.occupied_beds ?? live.occupiedBeds;
    const revenuePerBedPence = b.revenuePerBedPence ?? b.revenue_per_bed_pence ?? null;
    const notes = b.notes ?? null;

    if (!totalBeds) {
      return res.status(400).json({ error: 'This home has no registered bed count set. Add it in Home Settings first.' });
    }

    const occupancyPct = totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(2) : '0';

    const { rows: [record] } = await query(
      `INSERT INTO occupancy_records (care_home_id, record_date, total_beds, occupied_beds, occupancy_pct, revenue_per_bed_pence, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (care_home_id, record_date) DO UPDATE SET
         total_beds = EXCLUDED.total_beds, occupied_beds = EXCLUDED.occupied_beds,
         occupancy_pct = EXCLUDED.occupancy_pct,
         revenue_per_bed_pence = COALESCE(EXCLUDED.revenue_per_bed_pence, occupancy_records.revenue_per_bed_pence),
         notes = COALESCE(EXCLUDED.notes, occupancy_records.notes)
       RETURNING *`,
      [careHomeId, recordDate, totalBeds, occupiedBeds, occupancyPct, revenuePerBedPence, notes]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'OCCUPANCY_RECORDED', entityType: 'occupancy_record', entityId: record.id,
      afterData: { recordDate, totalBeds, occupiedBeds, occupancyPct }, ip: req.ip,
    });
    res.status(201).json(record);
  } catch (err) { next(err); }
}

export async function getOccupancyHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { startDate, endDate, limit = '90' } = req.query;
    let where = 'WHERE care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (startDate) { where += ` AND record_date >= $${p++}`; params.push(startDate); }
    if (endDate) { where += ` AND record_date <= $${p++}`; params.push(endDate); }

    const { rows } = await query(
      `SELECT * FROM occupancy_records ${where} ORDER BY record_date DESC LIMIT $${p}`,
      [...params, parseInt(limit as string)]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function generateForecast(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { forecastDate, predictedOccupancyPct, predictedVacancies, revenueImpactPence, confidenceLevel, suggestedActions } = req.body;

    if (!forecastDate || !predictedOccupancyPct) {
      return res.status(400).json({ error: 'forecastDate and predictedOccupancyPct are required' });
    }

    const { rows: [forecast] } = await query(
      `INSERT INTO occupancy_forecasts (care_home_id, forecast_date, predicted_occupancy_pct, predicted_vacancies, revenue_impact_pence, confidence_level, suggested_actions)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [careHomeId, forecastDate, predictedOccupancyPct, predictedVacancies, revenueImpactPence, confidenceLevel, suggestedActions ? JSON.stringify(suggestedActions) : null]
    );

    res.status(201).json(forecast);
  } catch (err) { next(err); }
}

export async function getForecasts(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT * FROM occupancy_forecasts WHERE care_home_id = $1 ORDER BY forecast_date DESC LIMIT 30`,
      [careHomeId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function getOccupancyDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Current occupancy (latest record)
    const { rows: [current] } = await query(
      `SELECT * FROM occupancy_records WHERE care_home_id = $1 ORDER BY record_date DESC LIMIT 1`,
      [careHomeId]
    );

    // Trend over last 30 days
    const { rows: trend } = await query(
      `SELECT record_date, occupancy_pct, occupied_beds, total_beds
       FROM occupancy_records WHERE care_home_id = $1
       ORDER BY record_date DESC LIMIT 30`,
      [careHomeId]
    );

    // Revenue impact (sum of revenue per bed for occupied beds in last 30 days)
    const { rows: [revenue] } = await query(
      `SELECT COALESCE(AVG(revenue_per_bed_pence * occupied_beds), 0)::int AS avg_daily_revenue_pence
       FROM occupancy_records WHERE care_home_id = $1 AND record_date >= CURRENT_DATE - INTERVAL '30 days'`,
      [careHomeId]
    );

    // Latest forecast
    const { rows: [latestForecast] } = await query(
      `SELECT * FROM occupancy_forecasts WHERE care_home_id = $1 ORDER BY forecast_date DESC LIMIT 1`,
      [careHomeId]
    );

    const live = await liveOccupancy(careHomeId);
    const inSync = !current
      || (Number(current.occupied_beds) === live.occupiedBeds && Number(current.total_beds) === live.totalBeds
          && String(current.record_date).slice(0, 10) === new Date().toISOString().slice(0, 10));

    res.json({ current, trend, revenue, latestForecast, live, inSync });
  } catch (err) { next(err); }
}
