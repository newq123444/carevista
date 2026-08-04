import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Record Observation ────────────────────────────────────────────────────

export async function recordObservation(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId, observedWith, interactionType, context, qualityScore } = req.body;

    if (!residentId || !observedWith || !interactionType) {
      return res.status(400).json({ error: 'residentId, observedWith, and interactionType are required' });
    }

    const { rows: [obs] } = await query(
      `INSERT INTO friendship_observations (care_home_id, resident_id, observed_with, interaction_type, context, quality_score, observed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [careHomeId, residentId, observedWith, interactionType, context, qualityScore, userId]
    );

    // Auto-update or create friendship connection
    const { rows: existing } = await query(
      `SELECT id, strength FROM friendship_connections
       WHERE care_home_id = $1
         AND ((resident_a = $2 AND resident_b = $3) OR (resident_a = $3 AND resident_b = $2))`,
      [careHomeId, residentId, observedWith]
    );

    if (existing.length > 0) {
      const newStrength = Math.min(10, existing[0].strength + 1);
      await query(
        `UPDATE friendship_connections SET strength = $1, last_interaction = NOW(), updated_at = NOW() WHERE id = $2`,
        [newStrength, existing[0].id]
      );
    } else {
      await query(
        `INSERT INTO friendship_connections (care_home_id, resident_a, resident_b, strength, last_interaction)
         VALUES ($1, $2, $3, $4, NOW())`,
        [careHomeId, residentId, observedWith, qualityScore || 1]
      );
    }

    res.status(201).json(obs);
  } catch (err) { next(err); }
}

// ── Get Resident Connections ──────────────────────────────────────────────

export async function getResidentConnections(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT fc.*,
         CASE WHEN fc.resident_a = $1 THEN r2.first_name || ' ' || r2.last_name
              ELSE r1.first_name || ' ' || r1.last_name END AS friend_name,
         CASE WHEN fc.resident_a = $1 THEN fc.resident_b ELSE fc.resident_a END AS friend_id
       FROM friendship_connections fc
       JOIN residents r1 ON r1.id = fc.resident_a
       JOIN residents r2 ON r2.id = fc.resident_b
       WHERE fc.care_home_id = $2
         AND (fc.resident_a = $1 OR fc.resident_b = $1)
       ORDER BY fc.strength DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Network Graph ─────────────────────────────────────────────────────

export async function getNetworkGraph(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows: connections } = await query(
      `SELECT fc.*,
         r1.first_name || ' ' || r1.last_name AS resident_a_name,
         r2.first_name || ' ' || r2.last_name AS resident_b_name
       FROM friendship_connections fc
       JOIN residents r1 ON r1.id = fc.resident_a
       JOIN residents r2 ON r2.id = fc.resident_b
       WHERE fc.care_home_id = $1
       ORDER BY fc.strength DESC`,
      [careHomeId]
    );

    const { rows: residents } = await query(
      `SELECT id, first_name || ' ' || last_name AS name, room_number
       FROM residents WHERE care_home_id = $1 AND active = TRUE`,
      [careHomeId]
    );

    res.json({ nodes: residents, edges: connections });
  } catch (err) { next(err); }
}

// ── Get Seating Suggestions ───────────────────────────────────────────────

export async function getSeatingSuggestions(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT ss.*, 
         r.first_name || ' ' || r.last_name AS resident_name
       FROM seating_suggestions ss
       LEFT JOIN residents r ON r.id = (ss.suggestion->>'resident_id')::uuid
       WHERE ss.care_home_id = $1
       ORDER BY ss.created_at DESC LIMIT 20`,
      [careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Isolated Residents ────────────────────────────────────────────────

export async function getIsolatedResidents(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT r.id, r.first_name || ' ' || r.last_name AS name, r.room_number,
         COUNT(fc.id) AS connection_count,
         MAX(fc.last_interaction) AS last_social_interaction
       FROM residents r
       LEFT JOIN friendship_connections fc
         ON (fc.resident_a = r.id OR fc.resident_b = r.id) AND fc.care_home_id = $1
       WHERE r.care_home_id = $1 AND r.active = TRUE
       GROUP BY r.id, r.first_name, r.last_name, r.room_number
       HAVING COUNT(fc.id) < 2
       ORDER BY connection_count ASC, last_social_interaction ASC NULLS FIRST`,
      [careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}
