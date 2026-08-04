import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Log Sleep ─────────────────────────────────────────────────────────────

export async function logSleep(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId, sleepDate, bedtime, wakeTime, disturbances, disturbanceTypes, interventions, qualityRating, totalSleepHrs, notes } = req.body;

    if (!residentId || !sleepDate) {
      return res.status(400).json({ error: 'residentId and sleepDate are required' });
    }

    const { rows: [log] } = await query(
      `INSERT INTO sleep_logs (care_home_id, resident_id, sleep_date, bedtime, wake_time, disturbances, disturbance_types, interventions, quality_rating, total_sleep_hrs, notes, logged_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [careHomeId, residentId, sleepDate, bedtime, wakeTime, disturbances || 0, JSON.stringify(disturbanceTypes || []), JSON.stringify(interventions || []), qualityRating, totalSleepHrs, notes, userId]
    );

    res.status(201).json(log);
  } catch (err) { next(err); }
}

// ── Get Sleep History ─────────────────────────────────────────────────────

export async function getSleepHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT sl.*, u.first_name || ' ' || u.last_name AS logged_by_name
       FROM sleep_logs sl
       LEFT JOIN users u ON u.id = sl.logged_by
       WHERE sl.resident_id = $1 AND sl.care_home_id = $2
       ORDER BY sl.sleep_date DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Sleep Profile ─────────────────────────────────────────────────────

export async function getSleepProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    // Get or calculate the profile from last 30 days
    const { rows: [stats] } = await query(
      `SELECT
         AVG(quality_rating) AS avg_quality,
         AVG(disturbances) AS avg_disturbances,
         AVG(total_sleep_hrs) AS avg_sleep_hours,
         COUNT(*) AS total_logs,
         MIN(sleep_date) AS period_start,
         MAX(sleep_date) AS period_end
       FROM sleep_logs
       WHERE resident_id = $1 AND care_home_id = $2
         AND sleep_date >= CURRENT_DATE - INTERVAL '30 days'`,
      [residentId, careHomeId]
    );

    // Get existing profile
    const { rows: [profile] } = await query(
      `SELECT * FROM sleep_profiles WHERE resident_id = $1 AND care_home_id = $2`,
      [residentId, careHomeId]
    );

    res.json({
      profile: profile || null,
      recentStats: stats
    });
  } catch (err) { next(err); }
}

// ── Get Disturbance Patterns ──────────────────────────────────────────────

export async function getDisturbancePatterns(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT
         sleep_date,
         disturbances,
         disturbance_types,
         quality_rating,
         EXTRACT(DOW FROM sleep_date) AS day_of_week
       FROM sleep_logs
       WHERE resident_id = $1 AND care_home_id = $2
         AND sleep_date >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY sleep_date DESC`,
      [residentId, careHomeId]
    );

    // Aggregate disturbance types
    const typeFrequency: Record<string, number> = {};
    for (const row of rows) {
      if (Array.isArray(row.disturbance_types)) {
        for (const t of row.disturbance_types) {
          typeFrequency[t] = (typeFrequency[t] || 0) + 1;
        }
      }
    }

    res.json({
      logs: rows,
      disturbanceTypeFrequency: typeFrequency,
      totalDisturbances: rows.reduce((sum, r) => sum + (r.disturbances || 0), 0)
    });
  } catch (err) { next(err); }
}

// ── Get Sleep Suggestions ─────────────────────────────────────────────────

export async function getSleepSuggestions(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    // Find effective interventions from sleep logs
    const { rows } = await query(
      `SELECT
         interventions,
         AVG(quality_rating) AS avg_quality_with_intervention,
         COUNT(*) AS times_used
       FROM sleep_logs
       WHERE resident_id = $1 AND care_home_id = $2
         AND interventions != '[]'::jsonb
         AND quality_rating IS NOT NULL
         AND sleep_date >= CURRENT_DATE - INTERVAL '90 days'
       GROUP BY interventions
       ORDER BY avg_quality_with_intervention DESC
       LIMIT 10`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}
