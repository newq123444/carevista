import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Get Genre Library ─────────────────────────────────────────────────────

export async function getGenreLibrary(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT * FROM music_genres WHERE care_home_id = $1 ORDER BY name`,
      [careHomeId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Resident Preferences ──────────────────────────────────────────────

export async function getResidentPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT mp.*, mg.name AS genre_name
       FROM music_preferences mp
       LEFT JOIN music_genres mg ON mg.id = mp.genre_id
       WHERE mp.resident_id = $1 AND mp.care_home_id = $2
       ORDER BY mp.created_at DESC`,
      [residentId, careHomeId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Update Resident Preferences ───────────────────────────────────────────

export async function updateResidentPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, genreId, preferredArtists, preferredEra, tempoPreference, notes } = req.body;

    if (!residentId) {
      return res.status(400).json({ error: 'residentId is required' });
    }

    const { rows: [pref] } = await query(
      `INSERT INTO music_preferences (care_home_id, resident_id, genre_id, preferred_artists, preferred_era, tempo_preference, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [careHomeId, residentId, genreId || null, preferredArtists, preferredEra, tempoPreference, notes]
    );

    res.status(201).json(pref);
  } catch (err) { next(err); }
}

// ── Start Session ─────────────────────────────────────────────────────────

export async function startSession(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId, moodBefore, notes } = req.body;

    if (!residentId) {
      return res.status(400).json({ error: 'residentId is required' });
    }

    const { rows: [session] } = await query(
      `INSERT INTO music_sessions (care_home_id, resident_id, mood_before, notes, facilitated_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [careHomeId, residentId, moodBefore, notes, userId]
    );

    res.status(201).json(session);
  } catch (err) { next(err); }
}

// ── End Session ───────────────────────────────────────────────────────────

export async function endSession(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { moodAfter, effectiveness, notes } = req.body;

    const { rows: [session] } = await query(
      `UPDATE music_sessions
       SET ended_at = NOW(), mood_after = $1, effectiveness = $2, notes = COALESCE($3, notes)
       WHERE id = $4 AND care_home_id = $5
       RETURNING *`,
      [moodAfter, effectiveness, notes, id, careHomeId]
    );

    if (!session) throw new AppError(404, 'Session not found');
    res.json(session);
  } catch (err) { next(err); }
}

// ── Get Session History ───────────────────────────────────────────────────

export async function getSessionHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT ms.*, u.first_name || ' ' || u.last_name AS facilitated_by_name
       FROM music_sessions ms
       LEFT JOIN users u ON u.id = ms.facilitated_by
       WHERE ms.resident_id = $1 AND ms.care_home_id = $2
       ORDER BY ms.started_at DESC`,
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

    let where = 'WHERE ms.care_home_id = $1 AND ms.ended_at IS NOT NULL';
    const params: unknown[] = [careHomeId];

    if (residentId) {
      where += ' AND ms.resident_id = $2';
      params.push(residentId);
    }

    const { rows } = await query(
      `SELECT
         ms.resident_id,
         r.first_name || ' ' || r.last_name AS resident_name,
         COUNT(*) AS total_sessions,
         AVG(ms.mood_after - ms.mood_before) AS avg_mood_improvement,
         AVG(ms.effectiveness) AS avg_effectiveness
       FROM music_sessions ms
       JOIN residents r ON r.id = ms.resident_id
       ${where}
       GROUP BY ms.resident_id, r.first_name, r.last_name
       ORDER BY avg_mood_improvement DESC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}
