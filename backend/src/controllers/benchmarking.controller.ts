import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Get Dashboard ─────────────────────────────────────────────────────────

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Get latest KPIs with national averages
    const { rows } = await query(
      `SELECT DISTINCT ON (metric_name) *
       FROM benchmarking_kpis
       WHERE care_home_id = $1
       ORDER BY metric_name, period_end DESC`,
      [careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Calculate KPIs ────────────────────────────────────────────────────────

export async function calculateKpis(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { periodStart, periodEnd } = req.body;

    // Calculate key metrics from care home data
    const { rows: [residentStats] } = await query(
      `SELECT COUNT(*) AS total_residents,
         COUNT(*) FILTER (WHERE active) AS active_residents
       FROM residents WHERE care_home_id = $1`,
      [careHomeId]
    );

    const { rows: [incidentStats] } = await query(
      `SELECT COUNT(*) AS total_incidents,
         COUNT(*) FILTER (WHERE severity = 'high') AS high_severity
       FROM incidents
       WHERE care_home_id = $1 AND created_at BETWEEN $2 AND $3`,
      [careHomeId, periodStart, periodEnd]
    );

    const metrics = [
      { metricName: 'occupancy_rate', metricValue: residentStats.active_residents / Math.max(residentStats.total_residents, 1) * 100 },
      { metricName: 'incidents_per_resident', metricValue: incidentStats.total_incidents / Math.max(residentStats.active_residents, 1) },
      { metricName: 'high_severity_incidents', metricValue: incidentStats.high_severity },
    ];

    const results = [];
    for (const m of metrics) {
      const { rows: [kpi] } = await query(
        `INSERT INTO benchmarking_kpis (care_home_id, period_start, period_end, metric_name, metric_value)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [careHomeId, periodStart, periodEnd, m.metricName, m.metricValue]
      );
      results.push(kpi);
    }

    res.status(201).json(results);
  } catch (err) { next(err); }
}

// ── Get Metric History ────────────────────────────────────────────────────

export async function getMetricHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { metricName } = req.params;

    const { rows } = await query(
      `SELECT * FROM benchmarking_kpis
       WHERE care_home_id = $1 AND metric_name = $2
       ORDER BY period_start ASC`,
      [careHomeId, metricName]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get National Averages ─────────────────────────────────────────────────

export async function getNationalAverages(req: Request, res: Response, next: NextFunction) {
  try {
    // Return reference data for national averages
    const { rows } = await query(
      `SELECT metric_name, AVG(national_average) AS national_average, AVG(peer_average) AS peer_average
       FROM benchmarking_kpis
       WHERE national_average IS NOT NULL
       GROUP BY metric_name
       ORDER BY metric_name`,
      []
    );

    res.json(rows);
  } catch (err) { next(err); }
}
