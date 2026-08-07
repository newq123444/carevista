import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Record Observation ────────────────────────────────────────────────────

export async function recordObservation(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const b = req.body;
    const residentId = b.residentId || b.resident_a_id || b.residentAId;
    const observedWith = b.observedWith || b.resident_b_id || b.residentBId;
    const interactionType = b.interactionType || b.interaction_type;
    const context = b.context;
    const quality = String(b.quality || '').toLowerCase();
    const qualityScore = b.qualityScore ?? (quality === 'positive' ? 2 : quality === 'negative' ? -1 : 1);

    if (!residentId || !observedWith || !interactionType) {
      return res.status(400).json({ error: 'Two residents and an interaction type are required' });
    }
    if (residentId === observedWith) {
      return res.status(400).json({ error: 'Please choose two different residents' });
    }

    const relFor = (st: number) => st >= 4 ? 'friend' : st <= 2 ? 'tension' : 'acquaintance';
    const { rows: [obs] } = await query(
      `INSERT INTO friendship_observations (care_home_id, resident_id, observed_with, interaction_type, context, quality_score, observed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [careHomeId, residentId, observedWith, interactionType, context, qualityScore, userId]
    );

    const { rows: existing } = await query(
      `SELECT id, strength FROM friendship_connections
       WHERE care_home_id = $1
         AND ((resident_a = $2 AND resident_b = $3) OR (resident_a = $3 AND resident_b = $2))`,
      [careHomeId, residentId, observedWith]
    );

    const delta = quality === 'negative' ? -1 : quality === 'neutral' ? 0 : 1;
    if (existing.length > 0) {
      const newStrength = Math.max(1, Math.min(10, existing[0].strength + delta));
      await query(
        `UPDATE friendship_connections SET strength = $1, relationship_type = $2, last_interaction = NOW(), updated_at = NOW() WHERE id = $3`,
        [newStrength, relFor(newStrength), existing[0].id]
      );
    } else {
      const initial = quality === 'negative' ? 2 : quality === 'positive' ? 4 : 3;
      await query(
        `INSERT INTO friendship_connections (care_home_id, resident_a, resident_b, strength, relationship_type, last_interaction)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [careHomeId, residentId, observedWith, initial, relFor(initial)]
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

    const tableSize = Math.max(2, Math.min(8, parseInt(String(req.query.tableSize || '4')) || 4));
    const { rows: residents } = await query(
      `SELECT id, first_name || ' ' || last_name AS name, room_number
       FROM residents WHERE care_home_id = $1 AND active = TRUE`, [careHomeId]);
    const { rows: conns } = await query(
      `SELECT resident_a, resident_b, strength, relationship_type
       FROM friendship_connections WHERE care_home_id = $1`, [careHomeId]);

    const nameById = new Map(residents.map((r: any) => [r.id, r.name]));
    const pos = new Map<string, { other: string; strength: number }[]>();
    const avoid = new Set<string>();
    const keepApart: { a: string; b: string }[] = [];
    for (const c of conns as any[]) {
      const key = [c.resident_a, c.resident_b].sort().join('|');
      const tense = c.strength <= 2 || (c.relationship_type && /tension|conflict|dislike/i.test(c.relationship_type));
      if (tense && !avoid.has(key)) {
        avoid.add(key);
        keepApart.push({ a: nameById.get(c.resident_a), b: nameById.get(c.resident_b) });
      }
      if (c.strength >= 4) {
        for (const [x, y] of [[c.resident_a, c.resident_b], [c.resident_b, c.resident_a]]) {
          if (!pos.has(x)) pos.set(x, []);
          pos.get(x)!.push({ other: y, strength: c.strength });
        }
      }
    }
    const assigned = new Set<string>();
    const order = residents.slice().sort((a: any, b: any) => (pos.get(b.id)?.length || 0) - (pos.get(a.id)?.length || 0));
    const tables: { residents: string[]; rationale: string }[] = [];
    for (const r of order as any[]) {
      if (assigned.has(r.id)) continue;
      const table = [r.id]; assigned.add(r.id);
      const companions = (pos.get(r.id) || []).slice().sort((a, b) => b.strength - a.strength);
      for (const comp of companions) {
        if (table.length >= tableSize) break;
        if (assigned.has(comp.other)) continue;
        if (table.some(m => avoid.has([m, comp.other].sort().join('|')))) continue;
        table.push(comp.other); assigned.add(comp.other);
      }
      const names = table.map(id => nameById.get(id));
      tables.push({ residents: names, rationale: names.length > 1 ? 'Grouped by positive interactions' : 'No strong connections yet — seat with a friendly companion' });
    }
    res.json({ tableSize, tables, keepApart, generatedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}

// ── Get Isolated Residents ────────────────────────────────────────────────

export async function getIsolatedResidents(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    let minConn = parseInt(String(req.query.minConnections || ''));
    if (!minConn || minConn < 1) {
      const st = await query(`SELECT (settings->>'isolation_min_connections')::int AS m FROM care_homes WHERE id = $1`, [careHomeId]);
      minConn = st.rows[0]?.m || 2;
    }
    const { rows } = await query(
      `SELECT r.id, r.first_name || ' ' || r.last_name AS name, r.room_number,
         COUNT(fc.id)::int AS connection_count,
         MAX(fc.last_interaction) AS last_social_interaction,
         FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(fc.last_interaction))) / 86400)::int AS days_since
       FROM residents r
       LEFT JOIN friendship_connections fc
         ON (fc.resident_a = r.id OR fc.resident_b = r.id) AND fc.care_home_id = $1
       WHERE r.care_home_id = $1 AND r.active = TRUE
       GROUP BY r.id, r.first_name, r.last_name, r.room_number
       HAVING COUNT(fc.id) < $2
       ORDER BY connection_count ASC, last_social_interaction ASC NULLS FIRST`,
      [careHomeId, minConn]
    );
    res.json(rows);
  } catch (err) { next(err); }
}
