// ────────────────────────────────────────────────────────────────────────────
// Home safety checks (v89): the building, not the person. Same rules as the
// resident assessments — the server scores, a saved check is final, a new one
// supersedes, and each is on the record chain.
// ────────────────────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';
import { appendToChain } from '../services/recordChain';
import { HOME_TOOLS, HOME_TOOL_ORDER, isHomeToolKey, cleanHomeAnswers, evaluateHome, type HomeContext } from '../services/homeSafetyTools';

function addDaysIso(days: number): string {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}

/** What the residents' own records say, for checks that depend on them. */
export async function loadHomeContext(careHomeId: string): Promise<HomeContext> {
  const { rows: [r] } = await query(
    `SELECT COUNT(*)::int AS residents FROM residents WHERE care_home_id = $1 AND active = TRUE AND discharge_date IS NULL`, [careHomeId]);
  const { rows: peeps } = await query(
    `SELECT ra.result->'plan'->'details' AS d
       FROM risk_assessments ra JOIN residents res ON res.id = ra.resident_id
      WHERE ra.care_home_id = $1 AND ra.assessment_type = 'peep' AND ra.status = 'current' AND ra.tool_version IS NOT NULL
        AND res.active = TRUE AND res.discharge_date IS NULL`, [careHomeId]);
  const { rows: fire } = await query(
    `SELECT ra.answers FROM risk_assessments ra JOIN residents res ON res.id = ra.resident_id
      WHERE ra.care_home_id = $1 AND ra.assessment_type = 'personal_fire' AND ra.status = 'current'
        AND res.active = TRUE AND res.discharge_date IS NULL`, [careHomeId]);
  let red = 0, amber = 0, maxNight = 0, equip = 0;
  for (const p of peeps) {
    const d = p.d || {};
    if (d.peepCategory === 'red') red++;
    if (d.peepCategory === 'amber') amber++;
    maxNight = Math.max(maxNight, Number(d.peepStaffNight) || 0, Number(d.peepStaffDay) || 0);
    if (Array.isArray(d.peepEquipment) && d.peepEquipment.some((e: string) => !/wheelchair/i.test(e))) equip++;
  }
  return {
    residents: r.residents, noPeep: Math.max(0, r.residents - peeps.length), peepRed: red, peepAmber: amber,
    maxNightStaffForOne: maxNight || undefined, needEquipment: equip,
    oxygenUsers: fire.filter((f: any) => f.answers?.oxygen === 'yes').length,
    emollientFireRisk: fire.filter((f: any) => ['some', 'large'].includes(f.answers?.emollients)).length,
    smokers: fire.filter((f: any) => f.answers?.smokes === 'cigarettes').length,
  };
}

export async function getHomeContext(req: Request, res: Response, next: NextFunction) {
  try { res.json(await loadHomeContext(req.user!.care_home_id)); } catch (err) { next(err); }
}

export async function getHomeSafety(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT id, check_type, level, failures, next_due, completed_at, assessor_name, result->>'headline' AS headline
         FROM premises_assessments WHERE care_home_id = $1 AND status = 'current'`, [chId]);
    const today = new Date().toISOString().slice(0, 10);
    const soon = addDaysIso(7);
    const checks = HOME_TOOL_ORDER.map(k => {
      const r = rows.find((x: any) => x.check_type === k);
      const due = r ? new Date(r.next_due).toISOString().slice(0, 10) : null;
      return {
        type: k, name: HOME_TOOLS[k].name, shortName: HOME_TOOLS[k].shortName, everyDays: HOME_TOOLS[k].everyDays,
        current: r ? { id: r.id, level: r.level, failures: r.failures, headline: r.headline, nextDue: due, completedAt: r.completed_at, assessorName: r.assessor_name } : null,
        state: !r ? 'never' : due! < today ? 'overdue' : due! <= soon ? 'due_soon' : 'ok',
      };
    });
    const counts = {
      never: checks.filter(c => c.state === 'never').length,
      overdue: checks.filter(c => c.state === 'overdue').length,
      critical: checks.filter(c => c.current?.level === 'high').length,
    };
    res.json({ checks, counts, context: await loadHomeContext(chId) });
  } catch (err) { next(err); }
}

export async function getHomeCheckHistory(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isHomeToolKey(req.params.type)) throw new AppError(400, 'Unknown check');
    const { rows } = await query(
      `SELECT * FROM premises_assessments WHERE care_home_id = $1 AND check_type = $2 ORDER BY completed_at DESC LIMIT 100`,
      [req.user!.care_home_id, req.params.type]);
    res.json(rows.map((r: any) => ({
      id: r.id, type: r.check_type, level: r.level, failures: r.failures, result: r.result, answers: r.answers, notes: r.notes,
      area: r.area, status: r.status, nextDue: r.next_due, completedAt: r.completed_at, assessorName: r.assessor_name, toolVersion: r.tool_version,
    })));
  } catch (err) { next(err); }
}

export async function createHomeCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    if (!isHomeToolKey(b.type)) throw new AppError(400, 'Unknown check');
    const answers = cleanHomeAnswers(b.type, b.answers);
    const ctx = await loadHomeContext(chId);
    const result = evaluateHome(b.type, answers, ctx);
    if (!result.complete) return res.status(422).json({ error: 'Some questions are not answered yet.', missing: result.missing, result });
    const tool = HOME_TOOLS[b.type as keyof typeof HOME_TOOLS];
    const name = `${req.user!.first_name} ${req.user!.last_name}`;
    const row = await withTransaction(async (client) => {
      const { rows: [prev] } = await client.query(
        `SELECT id FROM premises_assessments WHERE care_home_id = $1 AND check_type = $2 AND status = 'current' FOR UPDATE`, [chId, b.type]);
      if (prev) await client.query(`UPDATE premises_assessments SET status = 'superseded', updated_at = NOW() WHERE id = $1`, [prev.id]);
      const { rows: [created] } = await client.query(
        `INSERT INTO premises_assessments (care_home_id, check_type, area, answers, result, level, failures, tool_version, notes,
                                           supersedes_id, next_due, assessed_by, assessor_name, assessor_role)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
        [chId, b.type, typeof b.area === 'string' ? b.area.slice(0, 120) || null : null, JSON.stringify(answers), JSON.stringify(result),
         result.level, result.storedScore, tool.version, typeof b.notes === 'string' ? b.notes.slice(0, 4000) || null : null,
         prev ? prev.id : null, addDaysIso(result.reviewDays), req.user!.id, name, req.user!.role]);
      await appendToChain(client, {
        careHomeId: chId, entityType: 'premises_assessment', entityId: created.id, action: 'completed',
        row: created, recordedBy: req.user!.id, eventAt: created.completed_at,
      });
      return created;
    });
    await auditLog({
      careHomeId: chId, actorId: req.user!.id, actorName: name, action: 'HOME_SAFETY_CHECK_COMPLETED',
      entityType: 'premises_assessment', entityId: row.id, afterData: { type: b.type, level: result.level, failures: result.storedScore }, ip: req.ip,
    });
    res.status(201).json({ id: row.id, type: row.check_type, level: row.level, result, nextDue: row.next_due });
  } catch (err: any) {
    if (err?.code === '23505' && /uq_premises_current/.test(err?.message || '')) {
      return res.status(409).json({ error: 'Someone else has just saved this check. Reload to see it.' });
    }
    next(err);
  }
}
