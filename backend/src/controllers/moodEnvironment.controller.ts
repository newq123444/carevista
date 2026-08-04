import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Get Intervention Suggestions ──────────────────────────────────────────

export async function getInterventionSuggestions(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { currentMood } = req.query;

    // Find interventions that worked well for this resident based on effectiveness scores
    const { rows } = await query(
      `SELECT mi.id, mi.name, mi.category, mi.description,
         AVG(mih.effectiveness) AS avg_effectiveness,
         AVG(mih.mood_after - mih.mood_before) AS avg_mood_improvement,
         COUNT(*) AS times_used
       FROM mood_interventions mi
       JOIN mood_intervention_history mih ON mih.intervention_id = mi.id
       WHERE mih.care_home_id = $1 AND mih.resident_id = $2
         AND mi.active = TRUE
         AND mih.effectiveness IS NOT NULL
       GROUP BY mi.id, mi.name, mi.category, mi.description
       HAVING AVG(mih.effectiveness) >= 3
       ORDER BY avg_effectiveness DESC, avg_mood_improvement DESC
       LIMIT 10`,
      [careHomeId, residentId]
    );

    // If no personalized data, suggest general interventions
    if (rows.length === 0) {
      const { rows: general } = await query(
        `SELECT * FROM mood_interventions
         WHERE care_home_id = $1 AND active = TRUE
         ORDER BY created_at DESC LIMIT 10`,
        [careHomeId]
      );
      return res.json(general);
    }

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Record Intervention ───────────────────────────────────────────────────

export async function recordIntervention(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId, interventionId, moodBefore, moodAfter, effectiveness, notes } = req.body;

    if (!residentId || !interventionId) {
      return res.status(400).json({ error: 'residentId and interventionId are required' });
    }

    const { rows: [record] } = await query(
      `INSERT INTO mood_intervention_history (care_home_id, resident_id, intervention_id, mood_before, mood_after, effectiveness, notes, administered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [careHomeId, residentId, interventionId, moodBefore, moodAfter, effectiveness, notes, userId]
    );

    res.status(201).json(record);
  } catch (err) { next(err); }
}

// ── Get Intervention History ──────────────────────────────────────────────

export async function getInterventionHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT mih.*, mi.name AS intervention_name, mi.category,
         u.first_name || ' ' || u.last_name AS administered_by_name
       FROM mood_intervention_history mih
       JOIN mood_interventions mi ON mi.id = mih.intervention_id
       LEFT JOIN users u ON u.id = mih.administered_by
       WHERE mih.resident_id = $1 AND mih.care_home_id = $2
       ORDER BY mih.administered_at DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Effectiveness Report ──────────────────────────────────────────────

export async function getEffectivenessReport(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.query;

    let where = 'WHERE mih.care_home_id = $1';
    const params: unknown[] = [careHomeId];

    if (residentId) {
      where += ' AND mih.resident_id = $2';
      params.push(residentId);
    }

    const { rows } = await query(
      `SELECT
         mi.id AS intervention_id,
         mi.name AS intervention_name,
         mi.category,
         COUNT(*) AS total_uses,
         AVG(mih.effectiveness) AS avg_effectiveness,
         AVG(mih.mood_after - mih.mood_before) AS avg_mood_change,
         COUNT(*) FILTER (WHERE mih.mood_after > mih.mood_before) AS improved_count,
         COUNT(*) FILTER (WHERE mih.mood_after <= mih.mood_before) AS not_improved_count
       FROM mood_intervention_history mih
       JOIN mood_interventions mi ON mi.id = mih.intervention_id
       ${where}
       GROUP BY mi.id, mi.name, mi.category
       ORDER BY avg_effectiveness DESC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}
