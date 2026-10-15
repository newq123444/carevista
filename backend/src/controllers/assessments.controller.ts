// ────────────────────────────────────────────────────────────────────────────
// Clinical assessments (v88): nine tools, answered by a named person, scored
// by the server, final once saved, on the record chain, and able to write
// what they found into the care plan — with a nurse choosing what goes in.
//
// The scoring lives in services/assessmentTools.ts (shared with the app).
// This file only stores, supersedes, chains, and applies.
// ────────────────────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';
import { appendToChain } from '../services/recordChain';
import { TOOLS, TOOL_ORDER, isToolKey, cleanAnswers, evaluate, lossPct, type Context, type ToolKey } from '../services/assessmentTools';
import { cleanDetails, mergeDetails } from '../services/careDetails';
import { cleanAnswersFor, type Tool } from '../services/assessmentTools';
import { publishedCustomTools, customToolVersion, customDetailFields } from './customisation.controller';
import { scheduleTaskShape } from '../services/planSchedule';
import { insertScheduleItem } from './carePlanSchedule.controller';
import { restoreTasksForToday } from './tasks.controller';

const REASONS = ['admission', 'scheduled', 'change', 'after_fall', 'after_hospital', 'other'] as const;

function addDaysIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** What the record already knows, so the assessor confirms rather than retypes. */
export async function loadContext(residentId: string, careHomeId: string): Promise<Context | null> {
  const { rows: [r] } = await query(
    `SELECT id, date_of_birth, gender, height_cm, room_number FROM residents WHERE id = $1 AND care_home_id = $2`,
    [residentId, careHomeId]);
  if (!r) return null;
  const dob = r.date_of_birth ? new Date(r.date_of_birth) : null;
  let age: number | null = null;
  if (dob && !Number.isNaN(dob.getTime())) {
    const now = new Date();
    age = now.getFullYear() - dob.getFullYear() - (now < new Date(now.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0);
  }
  const { rows: [latest] } = await query(
    `SELECT weight_kg, created_at FROM resident_weights WHERE resident_id = $1 AND care_home_id = $2 AND weight_kg IS NOT NULL
      ORDER BY created_at DESC LIMIT 1`, [residentId, careHomeId]);
  // MUST step 2 compares with 3–6 months ago: the weight nearest to 4½ months
  // before the latest one, inside that window.
  const { rows: [past] } = latest ? await query(
    `SELECT weight_kg, created_at FROM resident_weights
      WHERE resident_id = $1 AND care_home_id = $2 AND weight_kg IS NOT NULL
        AND created_at BETWEEN $3::timestamptz - INTERVAL '6 months' AND $3::timestamptz - INTERVAL '3 months'
      ORDER BY abs(extract(epoch FROM ($3::timestamptz - INTERVAL '135 days') - created_at)) LIMIT 1`,
    [residentId, careHomeId, latest.created_at]) : { rows: [] as any[] };
  const { rows: meds } = await query(
    `SELECT name FROM medications WHERE resident_id = $1 AND care_home_id = $2 AND active = TRUE ORDER BY name`,
    [residentId, careHomeId]).catch(() => ({ rows: [] as any[] }));
  // v89: last bowel action from care notes, and DoLS status from the register.
  const { rows: [bowel] } = await query(
    `SELECT GREATEST(0, (CURRENT_DATE - MAX(created_at)::date))::int AS days FROM care_notes
      WHERE resident_id = $1 AND care_home_id = $2 AND bowels_opened = TRUE`, [residentId, careHomeId]).catch(() => ({ rows: [] as any[] }));
  const { rows: [dols] } = await query(
    `SELECT dols_status FROM liberty_protections WHERE resident_id = $1 AND care_home_id = $2 AND record_type = 'dols' AND active = TRUE
      ORDER BY created_at DESC LIMIT 1`, [residentId, careHomeId]).catch(() => ({ rows: [] as any[] }));
  return {
    ageYears: age,
    sex: r.gender || null,
    heightCm: r.height_cm !== null && r.height_cm !== undefined ? Number(r.height_cm) : null,
    weightKg: latest ? Number(latest.weight_kg) : null,
    pastWeightKg: past ? Number(past.weight_kg) : null,
    pastWeightDate: past ? new Date(past.created_at).toISOString().slice(0, 10) : null,
    roomNumber: r.room_number || null,
    medicines: meds.map((m: any) => m.name),
    lastBowelOpenedDays: bowel && bowel.days !== null && bowel.days !== undefined ? Number(bowel.days) : null,
    dolsStatus: dols?.dols_status || null,
  };
}

export async function getContext(req: Request, res: Response, next: NextFunction) {
  try {
    const ctx = await loadContext(req.params.residentId, req.user!.care_home_id);
    if (!ctx) throw new AppError(404, 'Resident not found');
    const weightLossPct = lossPct(ctx.weightKg, ctx.pastWeightKg);
    res.json({ ...ctx, weightLossPct });
  } catch (err) { next(err); }
}

// ── Create ───────────────────────────────────────────────────────────────────
export async function createAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const b = req.body || {};
    // The home's own assessment (v90): type "custom:<family>", scored with
    // the live published version.
    let custom: { familyId: string; id: string; tool: Tool } | null = null;
    if (typeof b.type === 'string' && b.type.startsWith('custom:')) {
      const live = (await publishedCustomTools(careHomeId)).find(t => t.key === b.type);
      if (!live) throw new AppError(400, 'This assessment is not published, or has been retired.');
      custom = { familyId: live.familyId, id: live.id, tool: live.tool };
    } else if (!isToolKey(b.type)) throw new AppError(400, 'Unknown assessment type');
    const type: ToolKey = (custom ? 'custom' : b.type) as ToolKey;
    if (!b.residentId) throw new AppError(400, 'residentId is required');
    const reason = b.reason && (REASONS as readonly string[]).includes(b.reason) ? b.reason : null;
    if (!reason) throw new AppError(400, 'Say why this assessment is being done');
    const involvement = typeof b.involvement === 'string' ? b.involvement.trim().slice(0, 1000) : '';
    const notes = typeof b.notes === 'string' ? b.notes.trim().slice(0, 4000) : '';

    const ctx = await loadContext(b.residentId, careHomeId);
    if (!ctx) throw new AppError(404, 'Resident not found');

    // The server's own score, from the server's own copy of the tool.
    const answers = custom ? cleanAnswersFor(custom.tool, b.answers) : cleanAnswers(type, b.answers);
    const result = custom ? custom.tool.evaluate(answers, ctx) : evaluate(type, answers, ctx);
    if (!result.complete) {
      return res.status(422).json({ error: 'Some questions are not answered yet.', missing: result.missing, result });
    }
    if (result.errors.length) {
      return res.status(422).json({ error: result.errors[0], errors: result.errors, result });
    }
    // The person's voice is part of a person-centred assessment (CQC Reg 9).
    if (involvement.length < 3) throw new AppError(400, 'Say how the person (or someone who knows them) was involved');

    const tool = custom ? custom.tool : TOOLS[type];
    const assessor = `${req.user!.first_name} ${req.user!.last_name}`;
    const row = await withTransaction(async (client) => {
      const { rows: [prev] } = await client.query(
        `SELECT id FROM risk_assessments WHERE resident_id = $1 AND care_home_id = $2 AND assessment_type = $3 AND status = 'current'
            AND custom_family_id IS NOT DISTINCT FROM $4
          FOR UPDATE`, [b.residentId, careHomeId, type, custom ? custom.familyId : null]);
      if (prev) {
        await client.query(`UPDATE risk_assessments SET status = 'superseded', updated_at = NOW() WHERE id = $1`, [prev.id]);
      }
      const { rows: [created] } = await client.query(
        `INSERT INTO risk_assessments
           (care_home_id, resident_id, assessed_by, assessment_type, total_score, risk_level, factors, auto_populated,
            next_review_date, status, notes, answers, result, tool_version, reason, involvement, supersedes_id,
            assessor_name, assessor_role, completed_at, custom_tool_id, custom_family_id)
         VALUES ($1,$2,$3,$4,$5,$6,'{}',FALSE,$7,'current',$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),$17,$18)
         RETURNING *`,
        [careHomeId, b.residentId, req.user!.id, type, result.storedScore, result.level, addDaysIso(result.reviewDays),
         notes || null, JSON.stringify(answers), JSON.stringify(result), tool.version, reason, involvement,
         prev ? prev.id : null, assessor, req.user!.role, custom ? custom.id : null, custom ? custom.familyId : null]);
      await appendToChain(client, {
        careHomeId, entityType: 'risk_assessment', entityId: created.id, action: 'completed',
        row: created, recordedBy: req.user!.id, eventAt: created.completed_at,
      });
      return created;
    });

    await auditLog({
      careHomeId, actorId: req.user!.id, actorName: assessor,
      action: 'ASSESSMENT_COMPLETED', entityType: 'risk_assessment', entityId: row.id,
      afterData: { type, residentId: b.residentId, level: result.level, score: result.score, toolVersion: tool.version },
      ip: req.ip,
    });
    res.status(201).json(shape(row));
  } catch (err: any) {
    // Two people saving the same tool for the same person at the same moment.
    if (err?.code === '23505' && /uq_risk_assessment_current/.test(err?.message || '')) {
      return res.status(409).json({ error: 'Someone else has just saved this assessment for this person. Reload to see it.' });
    }
    next(err);
  }
}

function shape(r: any) {
  return {
    // The home's own assessments are keyed by their family (v90).
    id: r.id, residentId: r.resident_id, type: r.assessment_type === 'custom' ? `custom:${r.custom_family_id}` : r.assessment_type,
    custom: r.assessment_type === 'custom', customToolId: r.custom_tool_id || null, score: r.total_score, level: r.risk_level,
    status: r.status, nextReviewDate: r.next_review_date, createdAt: r.created_at, completedAt: r.completed_at,
    assessorName: r.assessor_name || r.assessed_by_name || null, assessorRole: r.assessor_role, reason: r.reason,
    involvement: r.involvement, notes: r.notes, answers: r.answers, result: r.result, toolVersion: r.tool_version,
    legacy: !r.tool_version, appliedToPlanAt: r.applied_to_plan_at, supersedesId: r.supersedes_id,
  };
}

// ── Read ─────────────────────────────────────────────────────────────────────
export async function getResidentAssessments(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT ra.*, u.first_name || ' ' || u.last_name AS assessed_by_name
         FROM risk_assessments ra LEFT JOIN users u ON u.id = ra.assessed_by
        WHERE ra.resident_id = $1 AND ra.care_home_id = $2
        ORDER BY ra.created_at DESC LIMIT 300`, [req.params.residentId, req.user!.care_home_id]);
    const all = rows.map(shape);
    const current: Record<string, any> = {};
    for (const a of all) if (a.status === 'current' && !current[a.type]) current[a.type] = a;
    // v89: what is kept on other screens, so the resident's assessments are in one place.
    const rid = req.params.residentId, ch = req.user!.care_home_id;
    const one = async (sql: string) => (await query(sql, [rid, ch]).catch(() => ({ rows: [] as any[] }))).rows[0];
    const news2 = await one(`SELECT total_score, created_at FROM news2_assessments WHERE resident_id = $1 AND care_home_id = $2 ORDER BY created_at DESC LIMIT 1`);
    const wounds = await one(`SELECT COUNT(*)::int AS n FROM wound_assessments WHERE resident_id = $1 AND care_home_id = $2 AND status IN ('active','worsening')`);
    const cont = await one(`SELECT created_at, review_date FROM continence_assessments WHERE resident_id = $1 AND care_home_id = $2 ORDER BY created_at DESC LIMIT 1`);
    const mca = await one(`SELECT COUNT(*)::int AS n FROM mca_assessments WHERE resident_id = $1 AND care_home_id = $2 AND status = 'completed'`);
    const dols = await one(`SELECT dols_status, granted_until FROM liberty_protections WHERE resident_id = $1 AND care_home_id = $2 AND record_type = 'dols' AND active = TRUE ORDER BY created_at DESC LIMIT 1`);
    const linked = {
      news2: news2 ? { score: news2.total_score, at: news2.created_at } : null,
      wounds: wounds?.n || 0,
      continence: cont ? { at: cont.created_at, reviewDate: cont.review_date } : null,
      mca: mca?.n ? { count: mca.n } : null,
      dols: dols ? { status: dols.dols_status, grantedUntil: dols.granted_until } : null,
    };
    const customs = await publishedCustomTools(ch);
    res.json({ current, history: all, linked, custom: customs.map(c => ({ key: c.key, version: c.version, definition: c.def })) });
  } catch (err) { next(err); }
}

export async function getAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows: [row] } = await query(
      `SELECT ra.*, u.first_name || ' ' || u.last_name AS assessed_by_name, r.first_name || ' ' || r.last_name AS resident_name, r.room_number
         FROM risk_assessments ra
         JOIN residents r ON r.id = ra.resident_id
         LEFT JOIN users u ON u.id = ra.assessed_by
        WHERE ra.id = $1 AND ra.care_home_id = $2`, [req.params.id, req.user!.care_home_id]);
    if (!row) throw new AppError(404, 'Assessment not found');
    // A custom assessment comes back with the exact version it was scored with.
    const v = row.custom_tool_id ? await customToolVersion(req.user!.care_home_id, row.custom_tool_id) : null;
    res.json({ ...shape(row), residentName: row.resident_name, roomNumber: row.room_number,
      customDefinition: v ? v.definition : undefined, customVersion: v ? v.version : undefined });
  } catch (err) { next(err); }
}

/** The home-wide register: every resident × every tool, with what is due. */
export async function getRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { rows: residents } = await query(
      `SELECT id, first_name, last_name, preferred_name, room_number, photo_url, admission_date
         FROM residents WHERE care_home_id = $1 AND active = TRUE AND discharge_date IS NULL
        ORDER BY room_number, last_name`, [careHomeId]);
    const { rows: current } = await query(
      `SELECT id, resident_id, assessment_type, custom_family_id, total_score, risk_level, next_review_date, created_at, tool_version,
              result->>'headline' AS headline, result->'plan'->'details'->>'peepCategory' AS peep_category
         FROM risk_assessments WHERE care_home_id = $1 AND status = 'current'`, [careHomeId]);
    const today = new Date().toISOString().slice(0, 10);
    const soon = addDaysIso(7);
    const byRes = new Map<string, Record<string, any>>();
    for (const a of current) {
      const due = a.next_review_date ? new Date(a.next_review_date).toISOString().slice(0, 10) : null;
      const m = byRes.get(a.resident_id) || {};
      m[a.assessment_type === 'custom' ? `custom:${a.custom_family_id}` : a.assessment_type] = {
        id: a.id, score: a.total_score, level: a.risk_level, headline: a.headline, nextReviewDate: due,
        legacy: !a.tool_version, peepCategory: a.peep_category || null,
        state: !a.tool_version ? 'legacy' : due && due < today ? 'overdue' : due && due <= soon ? 'due_soon' : 'ok',
      };
      byRes.set(a.resident_id, m);
    }
    const out = residents.map((r: any) => ({
      residentId: r.id, name: `${r.first_name} ${r.last_name}`, preferredName: r.preferred_name, room: r.room_number,
      photoUrl: r.photo_url, assessments: byRes.get(r.id) || {},
    }));
    // v89: the records kept elsewhere that belong with assessments.
    const linked = new Map<string, any>();
    const put = (id: string, k: string, v: unknown) => { const m = linked.get(id) || {}; m[k] = v; linked.set(id, m); };
    const safe = async (sql: string) => (await query(sql, [careHomeId]).catch(() => ({ rows: [] as any[] }))).rows;
    for (const x of await safe(`SELECT DISTINCT ON (resident_id) resident_id, total_score, risk_level, created_at FROM news2_assessments WHERE care_home_id = $1 ORDER BY resident_id, created_at DESC`))
      put(x.resident_id, 'news2', { score: x.total_score, level: x.risk_level, at: x.created_at });
    for (const x of await safe(`SELECT resident_id, COUNT(*)::int AS n FROM wound_assessments WHERE care_home_id = $1 AND status IN ('active','worsening') GROUP BY resident_id`))
      put(x.resident_id, 'wounds', x.n);
    for (const x of await safe(`SELECT DISTINCT ON (resident_id) resident_id, review_date, created_at FROM continence_assessments WHERE care_home_id = $1 ORDER BY resident_id, created_at DESC`))
      put(x.resident_id, 'continence', { reviewDate: x.review_date, at: x.created_at });
    for (const x of await safe(`SELECT resident_id, COUNT(*)::int AS n, MIN(review_date) AS next_review FROM mca_assessments WHERE care_home_id = $1 AND status = 'completed' GROUP BY resident_id`))
      put(x.resident_id, 'mca', { count: x.n, nextReview: x.next_review });
    for (const x of await safe(`SELECT DISTINCT ON (resident_id) resident_id, dols_status, granted_until FROM liberty_protections WHERE care_home_id = $1 AND record_type = 'dols' AND active = TRUE ORDER BY resident_id, created_at DESC`))
      put(x.resident_id, 'dols', { status: x.dols_status, grantedUntil: x.granted_until });
    for (const r of out) (r as any).linked = linked.get(r.residentId) || {};

    const counts = { overdue: 0, dueSoon: 0, missing: 0, legacy: 0, high: 0 };
    for (const r of out) for (const k of TOOL_ORDER) {
      const a = r.assessments[k];
      // "Never done" counts only the tools everyone needs.
      if (!a) { if (!TOOLS[k].whenNeeded) counts.missing++; continue; }
      if (a.state === 'overdue') counts.overdue++;
      if (a.state === 'due_soon') counts.dueSoon++;
      if (a.state === 'legacy') counts.legacy++;
      if (['high', 'very_high', 'severe'].includes(a.level)) counts.high++;
    }
    // The home's own published assessments, after the built-in ones (v90).
    const customs = await publishedCustomTools(careHomeId);
    for (const r of out) for (const c of customs) {
      if (!r.assessments[c.key] && !c.def.whenNeeded) counts.missing++;
    }
    res.json({
      tools: [...TOOL_ORDER, ...customs.map(c => c.key)],
      whenNeeded: [...TOOL_ORDER.filter(k => !!TOOLS[k].whenNeeded), ...customs.filter(c => !!c.def.whenNeeded).map(c => c.key)],
      custom: customs.map(c => ({ key: c.key, version: c.version, definition: c.def })),
      residents: out, counts,
    });
  } catch (err) { next(err); }
}

// ── Apply to the care plan ───────────────────────────────────────────────────
// The nurse chooses which parts go in. Text is appended (never overwrites what
// a person wrote); details are merged; schedule items become tasks on the round.
export async function applyToPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const b = req.body || {};
    const { rows: [a] } = await query(
      `SELECT * FROM risk_assessments WHERE id = $1 AND care_home_id = $2`, [req.params.id, careHomeId]);
    if (!a) throw new AppError(404, 'Assessment not found');
    if (!a.tool_version || !a.result) throw new AppError(409, 'Older automatic scores cannot be applied. Complete a new assessment.');
    if (a.status !== 'current') throw new AppError(409, 'Only the current assessment can be applied to the plan.');
    const plan = a.result.plan || {};
    const domain = String(plan.domain || '');

    const { rows: [sec] } = await query(
      `SELECT s.*, p.id AS plan_id, p.status AS plan_status
         FROM care_plans p JOIN care_plan_sections s ON s.care_plan_id = p.id
        WHERE p.resident_id = $1 AND p.care_home_id = $2 AND p.status IN ('draft','active','under_review') AND s.domain = $3
        LIMIT 1`, [a.resident_id, careHomeId, domain]);
    if (!sec) {
      const { rows: [p] } = await query(`SELECT id FROM care_plans WHERE resident_id = $1 AND care_home_id = $2 AND status IN ('draft','active','under_review')`, [a.resident_id, careHomeId]);
      throw new AppError(409, p ? 'This assessment belongs to a section their care plan does not have yet. Add that section to the plan, then try again.'
        : 'This person has no care plan yet. Start their care plan, then apply the assessment.');
    }

    const label = `${a.assessment_type === 'custom' ? (a.result?.plan?.need || 'Assessment').split(':')[0] : TOOLS[a.assessment_type as ToolKey]?.shortName || a.assessment_type}, ${new Date(a.completed_at || a.created_at).toISOString().slice(0, 10)}`;
    const appendLines = (existing: string | null, lines: string[]) => {
      const have = (existing || '').toLowerCase();
      const fresh = lines.map(l => String(l).trim()).filter(l => l && !have.includes(l.toLowerCase()));
      if (!fresh.length) return existing;
      return `${existing ? existing.trimEnd() + '\n\n' : ''}From ${label}:\n${fresh.map(l => `• ${l}`).join('\n')}`;
    };

    const sets: string[] = [];
    const params: any[] = [];
    const set = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
    const applied: string[] = [];

    if (b.need !== false && plan.need) {
      const v = appendLines(sec.assessed_need, [plan.need]);
      if (v !== sec.assessed_need) { set('assessed_need', v); applied.push('need'); }
    }
    if (b.outcome !== false && plan.outcome && !(sec.desired_outcome || '').trim()) { set('desired_outcome', plan.outcome); applied.push('outcome'); }
    if (b.interventions !== false && Array.isArray(plan.interventions) && plan.interventions.length) {
      const chosen: string[] = Array.isArray(b.interventionIdx) ? plan.interventions.filter((_: string, i: number) => b.interventionIdx.includes(i)) : plan.interventions;
      const v = appendLines(sec.interventions, chosen);
      if (v !== sec.interventions) { set('interventions', v); applied.push('interventions'); }
    }
    if (b.equipment !== false && Array.isArray(plan.equipment) && plan.equipment.length) {
      const have = (sec.equipment || '').toLowerCase();
      const fresh = plan.equipment.filter((e: string) => !have.includes(String(e).toLowerCase()));
      if (fresh.length) { set('equipment', [sec.equipment, ...fresh].filter(Boolean).join('; ')); applied.push('equipment'); }
    }
    if (b.staff !== false && plan.staff) { set('staff_required', plan.staff); applied.push('staff'); }
    if (b.riskLevel !== false && plan.riskLevel && ['low', 'medium', 'high'].includes(plan.riskLevel)) { set('risk_level', plan.riskLevel); applied.push('risk level'); }
    if (b.details !== false && plan.details) {
      const { details, errors } = cleanDetails(domain, plan.details, (await customDetailFields(careHomeId)).byDomain[domain] || []);
      if (errors.length) throw new AppError(422, errors[0]);
      set('details', JSON.stringify(mergeDetails(sec.details, details))); applied.push('details');
    }
    set('linked_risk_assessment_id', a.id);
    set('status', 'in_place');

    // Schedule items the nurse ticked (by index into the suggestion list).
    const schedIdx: number[] = Array.isArray(b.scheduleIdx) ? b.scheduleIdx.map(Number).filter((n: number) => Number.isInteger(n)) : [];
    const suggestions: any[] = Array.isArray(plan.schedule) ? plan.schedule : [];
    const shapes = schedIdx.map(i => suggestions[i]).filter(Boolean).map(s => scheduleTaskShape({ domain, time: s.time, what: s.what, dayOfWeek: s.dayOfWeek ?? null }));
    // (Custom assessments suggest no timed items; built-in ones target built-in sections.)
    const bad = shapes.find(s => 'error' in s);
    if (bad && 'error' in bad) throw new AppError(400, bad.error);

    const created = await withTransaction(async (client) => {
      params.push(req.user!.id); sets.push(`updated_by = $${params.length}`);
      params.push(sec.id);
      await client.query(`UPDATE care_plan_sections SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params);
      if (sec.plan_status === 'active') {
        await client.query(`UPDATE care_plans SET status = 'under_review', updated_by = $1, updated_at = NOW() WHERE id = $2`, [req.user!.id, sec.plan_id]);
      } else {
        await client.query(`UPDATE care_plans SET updated_by = $1, updated_at = NOW() WHERE id = $2`, [req.user!.id, sec.plan_id]);
      }
      const items: any[] = [];
      for (const s of shapes) {
        if ('error' in s) continue;
        // Skip a time that is already on their day for this section.
        const { rows: [dup] } = await client.query(
          `SELECT 1 FROM care_plan_schedule WHERE section_id = $1 AND active AND due_time = $2::time AND lower(what) = lower($3)
             AND day_of_week IS NOT DISTINCT FROM $4`, [sec.id, s.dueTime, s.name, s.dayOfWeek]);
        if (dup) continue;
        items.push(await insertScheduleItem(client, { careHomeId, planId: sec.plan_id, sectionId: sec.id, residentId: a.resident_id, shape: s, userId: req.user!.id }));
      }
      await client.query(`UPDATE risk_assessments SET applied_to_plan_at = NOW() WHERE id = $1 AND applied_to_plan_at IS NULL`, [a.id]);
      return items;
    });
    for (const it of created) if (it.template_id) await restoreTasksForToday(careHomeId, it.template_id, a.resident_id).catch(() => undefined);
    if (created.length) applied.push(`${created.length} time${created.length === 1 ? '' : 's'} on their day`);

    await auditLog({
      careHomeId, actorId: req.user!.id, actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'ASSESSMENT_APPLIED_TO_PLAN', entityType: 'care_plan', entityId: sec.plan_id,
      afterData: { assessmentId: a.id, type: a.assessment_type, domain, applied }, ip: req.ip,
    });
    res.json({ ok: true, planId: sec.plan_id, sectionId: sec.id, applied, planNeedsSigning: sec.plan_status === 'active' });
  } catch (err) { next(err); }
}

/** The fire grab sheet: every resident's PEEP, by floor and room. */
export async function getPeepRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT r.id, r.first_name, r.last_name, r.preferred_name, r.room_number,
              ra.id AS assessment_id, ra.created_at, ra.next_review_date, ra.answers, ra.result
         FROM residents r
         LEFT JOIN risk_assessments ra ON ra.resident_id = r.id AND ra.assessment_type = 'peep' AND ra.status = 'current'
        WHERE r.care_home_id = $1 AND r.active = TRUE AND r.discharge_date IS NULL
        ORDER BY r.room_number`, [careHomeId]);
    const { rows: [home] } = await query(`SELECT name FROM care_homes WHERE id = $1`, [careHomeId]);
    const { rows: away } = await query(
      `SELECT resident_id FROM resident_absences WHERE care_home_id = $1 AND actual_return IS NULL`, [careHomeId]).catch(() => ({ rows: [] as any[] }));
    const awaySet = new Set(away.map((x: any) => x.resident_id));
    res.json({
      homeName: home?.name || '',
      printedAt: new Date().toISOString(),
      residents: rows.map((r: any) => {
        const d = r.result?.plan?.details || {};
        return {
          residentId: r.id, name: `${r.first_name} ${r.last_name}`, preferredName: r.preferred_name, room: r.room_number,
          away: awaySet.has(r.id),
          hasPeep: !!r.assessment_id,
          category: d.peepCategory || null, floor: r.answers?.floor || null,
          staffDay: d.peepStaffDay ?? null, staffNight: d.peepStaffNight ?? null,
          equipment: d.peepEquipment || [], route: d.peepRoute || null,
          hears: r.answers?.hears || null, understands: r.answers?.understands || null,
          medical: r.answers?.medical || [], notes: r.answers?.notes || null,
          assessedAt: r.created_at, nextReviewDate: r.next_review_date,
          overdue: r.next_review_date ? new Date(r.next_review_date) < new Date(new Date().toISOString().slice(0, 10)) : false,
        };
      }),
    });
  } catch (err) { next(err); }
}
