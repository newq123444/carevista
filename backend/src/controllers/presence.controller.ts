// ────────────────────────────────────────────────────────────────────────────
// Who is with which resident right now (v89b). Not a care record: a short-
// lived signal so a second carer does not start the same care. See
// migrations/042_care_presence.sql.
// ────────────────────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

const CARE_TYPES = new Set([
  'personal_care', 'nutrition', 'fluids', 'continence', 'repositioning', 'sleep', 'social_wellbeing', 'behaviour', 'task', 'other',
]);
// SSE is optional - graceful fallback if not deployed
let sseManager: any = { broadcast: () => {} };
try { sseManager = require('../utils/sse').sseManager; } catch { /* SSE not available */ }

export async function listPresence(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    await query(`DELETE FROM care_presence WHERE care_home_id = $1 AND expires_at < NOW()`, [chId]);
    const { rows } = await query(
      `SELECT resident_id, user_id, user_name, care_type, started_at,
              EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 AS minutes
         FROM care_presence WHERE care_home_id = $1 ORDER BY started_at`, [chId]);
    res.json(rows.map((r: any) => ({
      residentId: r.resident_id, userId: r.user_id, userName: r.user_name, careType: r.care_type,
      startedAt: r.started_at, minutes: Math.max(0, Math.round(Number(r.minutes))), mine: r.user_id === req.user!.id,
    })));
  } catch (err) { next(err); }
}

export async function startPresence(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const careType = CARE_TYPES.has(String(req.body?.careType)) ? String(req.body.careType) : 'other';
    const { rows: [resident] } = await query(`SELECT id FROM residents WHERE id = $1 AND care_home_id = $2`, [req.params.residentId, chId]);
    if (!resident) throw new AppError(404, 'Resident not found');
    const name = `${req.user!.first_name} ${req.user!.last_name}`;
    await query(
      `INSERT INTO care_presence (care_home_id, resident_id, user_id, user_name, care_type, started_at, expires_at)
       VALUES ($1,$2,$3,$4,$5,NOW(),NOW() + INTERVAL '15 minutes')
       ON CONFLICT (resident_id, user_id) DO UPDATE
         SET care_type = EXCLUDED.care_type, started_at = NOW(), expires_at = EXCLUDED.expires_at, user_name = EXCLUDED.user_name`,
      [chId, resident.id, req.user!.id, name, careType]);
    // Others on the same care, so the app can ask before carrying on.
    const { rows: others } = await query(
      `SELECT user_name, care_type, EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 AS minutes
         FROM care_presence WHERE resident_id = $1 AND user_id <> $2 AND expires_at > NOW()`, [resident.id, req.user!.id]);
    sseManager.broadcast(chId, { type: 'PRESENCE', residentId: resident.id });
    res.json({ ok: true, others: others.map((o: any) => ({ userName: o.user_name, careType: o.care_type, minutes: Math.round(Number(o.minutes)) })) });
  } catch (err) { next(err); }
}

export async function endPresence(req: Request, res: Response, next: NextFunction) {
  try {
    await query(`DELETE FROM care_presence WHERE resident_id = $1 AND user_id = $2 AND care_home_id = $3`,
      [req.params.residentId, req.user!.id, req.user!.care_home_id]);
    sseManager.broadcast(req.user!.care_home_id, { type: 'PRESENCE', residentId: req.params.residentId });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
