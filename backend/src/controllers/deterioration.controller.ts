// ────────────────────────────────────────────────────────────────────────────
// Soft signs of deterioration: raise, acknowledge, close.
//
// Anyone who knows the resident can raise one. A nurse or senior acknowledges
// it ("I'm looking at this") and closes it with what they found and did.
// Raising one always says: this does not replace telling someone in person,
// and it never replaces 999.
// ────────────────────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';
import { appendQuietly } from '../services/recordChain';
import { createNotification } from './notifications.controller';
import { EMERGENCY_SIGN_LABELS, SOFT_SIGN_LABELS, DETERIORATION_OUTCOMES } from '../constants/softSigns';

const ALL_LABELS: Record<string, string> = { ...EMERGENCY_SIGN_LABELS, ...SOFT_SIGN_LABELS };

const LIST_SQL = `
  SELECT d.*,
         r.first_name || ' ' || r.last_name AS resident_name, r.room_number,
         ru.first_name || ' ' || ru.last_name AS raised_by_name, ru.role AS raised_by_role,
         au.first_name || ' ' || au.last_name AS acknowledged_by_name,
         cu.first_name || ' ' || cu.last_name AS closed_by_name
    FROM deterioration_alerts d
    JOIN residents r ON r.id = d.resident_id
    JOIN users ru ON ru.id = d.raised_by
    LEFT JOIN users au ON au.id = d.acknowledged_by
    LEFT JOIN users cu ON cu.id = d.closed_by`;

export async function listAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const status = String(req.query.status || 'open');
    const residentId = req.query.residentId as string | undefined;
    const params: any[] = [careHomeId];
    let where = 'WHERE d.care_home_id = $1';
    if (status === 'open') where += ` AND d.status <> 'closed'`;
    else if (status === 'closed') where += ` AND d.status = 'closed' AND d.closed_at > NOW() - INTERVAL '30 days'`;
    else where += ` AND d.raised_at > NOW() - INTERVAL '30 days'`;
    if (residentId) { params.push(residentId); where += ` AND d.resident_id = $${params.length}`; }
    const { rows } = await query(`${LIST_SQL} ${where} ORDER BY d.emergency DESC, d.raised_at DESC LIMIT 200`, params);
    res.json(rows);
  } catch (err) { next(err); }
}

export async function raiseAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, otherText, note } = req.body || {};
    const signs: string[] = Array.isArray(req.body?.signs) ? [...new Set(req.body.signs.map(String))] as string[] : [];
    const toldInPerson = req.body?.toldInPerson === true;

    if (!residentId) throw new AppError(400, 'Choose who this is about');
    if (signs.length === 0) throw new AppError(400, 'Choose at least one thing you have noticed');
    const unknown = signs.filter(s => !ALL_LABELS[s]);
    if (unknown.length) throw new AppError(400, `Unknown sign: ${unknown.join(', ')}`);
    if (signs.includes('other') && String(otherText || '').trim().length < 3) {
      throw new AppError(400, 'Say what else you have noticed');
    }
    const emergency = signs.some(s => EMERGENCY_SIGN_LABELS[s]);

    const { rows: [resident] } = await query(
      `SELECT first_name, last_name, room_number FROM residents WHERE id = $1 AND care_home_id = $2`,
      [residentId, careHomeId]);
    if (!resident) throw new AppError(404, 'Resident not found');

    const alert = await withTransaction(async (client) => {
      const { rows: [row] } = await client.query(
        `INSERT INTO deterioration_alerts (care_home_id, resident_id, raised_by, signs, other_text, note, told_in_person, emergency)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [careHomeId, residentId, req.user!.id, signs,
         String(otherText || '').trim().slice(0, 500) || null, String(note || '').trim().slice(0, 1000) || null,
         toldInPerson, emergency]);
      await appendQuietly(client, {
        careHomeId, entityType: 'deterioration_alert', entityId: row.id, action: 'raised',
        row, recordedBy: req.user!.id, eventAt: row.raised_at,
      });
      return row;
    });

    const who = `${resident.first_name} ${resident.last_name}${resident.room_number ? ` (room ${resident.room_number})` : ''}`;
    const listed = signs.map(s => (s === 'other' ? String(otherText).trim() : ALL_LABELS[s])).join('; ');
    await createNotification({
      careHomeId, type: emergency ? 'deterioration_emergency' : 'deterioration_soft_signs',
      priority: emergency ? 'urgent' : 'high',
      title: emergency ? `EMERGENCY signs — ${who}` : `Not themselves — ${who}`,
      body: `${req.user!.first_name} noticed: ${listed}.` +
            (toldInPerson ? ' They have told someone in person.' : ' They have NOT yet told anyone in person — go and see them.') +
            ' Please assess and record NEWS2.',
      entityType: 'deterioration_alert', entityId: alert.id,
    });

    await auditLog({
      careHomeId, actorId: req.user!.id, actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'DETERIORATION_RAISED', entityType: 'deterioration_alert', entityId: alert.id,
      afterData: { residentId, signs, emergency, toldInPerson }, ip: req.ip,
    });
    res.status(201).json(alert);
  } catch (err) { next(err); }
}

export async function acknowledgeAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows: [row] } = await query(
      `UPDATE deterioration_alerts SET status = 'acknowledged', acknowledged_by = $1, acknowledged_at = NOW()
        WHERE id = $2 AND care_home_id = $3 AND status = 'open' RETURNING *`,
      [req.user!.id, req.params.id, req.user!.care_home_id]);
    if (!row) throw new AppError(409, 'Already acknowledged or closed');
    res.json(row);
  } catch (err) { next(err); }
}

export async function closeAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const outcome = String(req.body?.outcome || '');
    const outcomeNote = String(req.body?.outcomeNote || '').trim();
    const rawScore = req.body?.news2Score;
    const news2 = rawScore === '' || rawScore == null ? null : Number(rawScore);
    if (!(DETERIORATION_OUTCOMES as readonly string[]).includes(outcome)) throw new AppError(400, 'Choose what happened');
    if (outcomeNote.length < 3) throw new AppError(400, 'Say what you found and did');
    if (news2 != null && (!Number.isInteger(news2) || news2 < 0 || news2 > 20)) throw new AppError(400, 'NEWS2 score must be 0–20');

    const row = await withTransaction(async (client) => {
      const { rows: [updated] } = await client.query(
        `UPDATE deterioration_alerts
            SET status = 'closed', outcome = $1, outcome_note = $2, news2_score = $3,
                closed_by = $4, closed_at = NOW(),
                acknowledged_by = COALESCE(acknowledged_by, $4), acknowledged_at = COALESCE(acknowledged_at, NOW())
          WHERE id = $5 AND care_home_id = $6 AND status <> 'closed' RETURNING *`,
        [outcome, outcomeNote.slice(0, 2000), news2, req.user!.id, req.params.id, careHomeId]);
      if (!updated) throw new AppError(409, 'Already closed');
      await appendQuietly(client, {
        careHomeId, entityType: 'deterioration_alert', entityId: updated.id, action: 'closed',
        row: updated, recordedBy: req.user!.id, eventAt: updated.closed_at,
      });
      return updated;
    });

    await auditLog({
      careHomeId, actorId: req.user!.id, actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'DETERIORATION_CLOSED', entityType: 'deterioration_alert', entityId: row.id,
      afterData: { outcome, news2 }, ip: req.ip,
    });
    res.json(row);
  } catch (err) { next(err); }
}
