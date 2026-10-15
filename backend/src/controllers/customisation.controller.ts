// ────────────────────────────────────────────────────────────────────────────
// The home's own care plan sections, care plan fields and assessments (v90).
// Managers build them here; everything else (care plans, the runner, the
// register, the record chain) uses them through the helpers at the bottom.
// ────────────────────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { query, withTransaction } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';
import { validateCustomTool, validateCustomField, customFieldToDetail, customToTool, type CustomToolDef, type CustomFieldDef } from '../services/customAssessments';
import type { DetailField } from '../services/careDetails';
import type { Tool } from '../services/assessmentCore';

const NOTE_TYPES = ['personal_care', 'nutrition', 'continence', 'repositioning', 'sleep', 'social_wellbeing', 'behaviour',
  'nursing_observation', 'wound_care', 'activities', 'end_of_life', 'medication_note'];
const ICONS = ['clipboard-list', 'heart-pulse', 'droplets', 'bandage', 'pill', 'users', 'hand-heart', 'sun', 'moon', 'book-open',
  'smile', 'brain', 'activity', 'shield-check', 'utensils', 'bath', 'footprints', 'message-square', 'house', 'target'];

// The fifteen built-in areas (as in carePlans.controller.ts CARE_PLAN_DOMAINS).
const BUILTIN_DOMAINS = ['personal_care', 'mobility_transfers', 'nutrition_hydration', 'continence', 'skin_integrity', 'medication', 'pain',
  'breathing_circulation', 'communication_sensory', 'cognition_mental_health', 'behaviour_support', 'social_emotional', 'night_care',
  'safety_risk', 'end_of_life'];

const actor = (req: Request) => `${req.user!.first_name} ${req.user!.last_name}`;
const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'field';

// ── helpers used across the app ─────────────────────────────────────────────

export async function sectionTypes(careHomeId: string, activeOnly = true): Promise<any[]> {
  const { rows } = await query(
    `SELECT * FROM care_plan_section_types WHERE care_home_id = $1 ${activeOnly ? 'AND active' : ''} ORDER BY label`, [careHomeId])
    .catch(() => ({ rows: [] as any[] }));
  return rows;
}

/** Built-in areas, plus the home's own active sections. */
export async function knownDomains(careHomeId: string): Promise<string[]> {
  return [...BUILTIN_DOMAINS, ...(await sectionTypes(careHomeId)).map(t => t.domain_key)];
}

/** The home's own fields, by care plan area, ready for cleanDetails and safetyFacts. */
export async function customDetailFields(careHomeId: string): Promise<{ byDomain: Record<string, DetailField[]>; defs: Record<string, CustomFieldDef[]> }> {
  const { rows } = await query(
    `SELECT domain, definition FROM care_detail_fields WHERE care_home_id = $1 AND active ORDER BY sort_order, created_at`, [careHomeId])
    .catch(() => ({ rows: [] as any[] }));
  const byDomain: Record<string, DetailField[]> = {}, defs: Record<string, CustomFieldDef[]> = {};
  for (const r of rows) {
    (byDomain[r.domain] ||= []).push(customFieldToDetail(r.definition));
    (defs[r.domain] ||= []).push(r.definition);
  }
  return { byDomain, defs };
}

/** Published custom assessments, as Tools keyed "custom:<family>". */
export async function publishedCustomTools(careHomeId: string): Promise<{ key: string; familyId: string; id: string; version: number; def: CustomToolDef; tool: Tool }[]> {
  const { rows } = await query(
    `SELECT id, family_id, version, definition FROM custom_assessment_tools WHERE care_home_id = $1 AND status = 'published' ORDER BY definition->>'name'`,
    [careHomeId]).catch(() => ({ rows: [] as any[] }));
  return rows.map((r: any) => {
    const key = `custom:${r.family_id}`;
    return { key, familyId: r.family_id, id: r.id, version: r.version, def: r.definition, tool: customToTool(r.definition, { key, version: r.version }) };
  });
}

/** One exact version, for showing an old completed assessment as it was. */
export async function customToolVersion(careHomeId: string, id: string) {
  const { rows: [r] } = await query(`SELECT * FROM custom_assessment_tools WHERE id = $1 AND care_home_id = $2`, [id, careHomeId]);
  return r ? { ...r, tool: customToTool(r.definition, { key: `custom:${r.family_id}`, version: r.version }) } : null;
}

// ── Sections ────────────────────────────────────────────────────────────────

export async function listSectionTypes(req: Request, res: Response, next: NextFunction) {
  try { res.json({ types: await sectionTypes(req.user!.care_home_id, false), icons: ICONS, noteTypes: NOTE_TYPES }); } catch (err) { next(err); }
}

function sectionBody(b: any) {
  const label = typeof b.label === 'string' ? b.label.trim() : '';
  if (label.length < 2 || label.length > 80) throw new AppError(400, 'Give the section a name (2–80 characters).');
  return {
    label, hint: typeof b.hint === 'string' ? b.hint.trim().slice(0, 400) || null : null,
    icon: ICONS.includes(b.icon) ? b.icon : 'clipboard-list',
    noteType: NOTE_TYPES.includes(b.noteType) ? b.noteType : 'personal_care',
    addToNewPlans: b.addToNewPlans === true,
  };
}

export async function createSectionType(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const v = sectionBody(req.body || {});
    const key = `custom_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const { rows: [row] } = await query(
      `INSERT INTO care_plan_section_types (care_home_id, domain_key, label, hint, icon, note_type, add_to_new_plans, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [chId, key, v.label, v.hint, v.icon, v.noteType, v.addToNewPlans, req.user!.id])
      .catch((e: any) => { if (e.code === '23505') throw new AppError(409, 'There is already a section with that name.'); throw e; });
    await auditLog({ careHomeId: chId, actorId: req.user!.id, actorName: actor(req), action: 'CARE_PLAN_SECTION_TYPE_CREATED', entityType: 'care_plan_section_type', entityId: row.id, afterData: { label: v.label } });
    res.status(201).json(row);
  } catch (err) { next(err); }
}

export async function updateSectionType(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const v = sectionBody(req.body || {});
    const { rows: [row] } = await query(
      `UPDATE care_plan_section_types SET label=$1, hint=$2, icon=$3, note_type=$4, add_to_new_plans=$5,
              active = COALESCE($6, active), updated_at = NOW()
        WHERE id = $7 AND care_home_id = $8 RETURNING *`,
      [v.label, v.hint, v.icon, v.noteType, v.addToNewPlans, typeof req.body?.active === 'boolean' ? req.body.active : null, req.params.id, chId])
      .catch((e: any) => { if (e.code === '23505') throw new AppError(409, 'There is already a section with that name.'); throw e; });
    if (!row) throw new AppError(404, 'Section not found');
    await auditLog({ careHomeId: chId, actorId: req.user!.id, actorName: actor(req), action: 'CARE_PLAN_SECTION_TYPE_UPDATED', entityType: 'care_plan_section_type', entityId: row.id, afterData: { label: v.label, active: row.active } });
    res.json(row);
  } catch (err) { next(err); }
}

// ── Fields ──────────────────────────────────────────────────────────────────

export async function listFields(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(`SELECT * FROM care_detail_fields WHERE care_home_id = $1 ORDER BY domain, sort_order, created_at`, [req.user!.care_home_id]);
    res.json(rows.map((r: any) => ({ id: r.id, domain: r.domain, key: r.field_key, active: r.active, definition: r.definition })));
  } catch (err) { next(err); }
}

function fieldDef(b: any, key: string): CustomFieldDef {
  const d = b?.definition || {};
  const def: CustomFieldDef = {
    key, label: String(d.label || '').trim(), type: d.type,
    options: d.type === 'select' ? (Array.isArray(d.options) ? d.options : String(d.options || '').split('\n')).map((x: any) => String(x).trim()).filter(Boolean) : undefined,
    unit: d.unit ? String(d.unit).slice(0, 20) : undefined,
    min: d.min !== undefined && d.min !== '' && d.min !== null ? Number(d.min) : undefined,
    max: d.max !== undefined && d.max !== '' && d.max !== null ? Number(d.max) : undefined,
    hint: d.hint ? String(d.hint).slice(0, 160) : undefined,
    fact: d.fact === true, tone: ['red', 'amber', 'info'].includes(d.tone) ? d.tone : undefined,
  };
  const errors = validateCustomField(def);
  if (errors.length) throw new AppError(400, errors[0]);
  return def;
}

export async function createField(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const domain = String(req.body?.domain || '');
    if (!(await knownDomains(chId)).includes(domain)) throw new AppError(400, 'Choose the area of the care plan for this field.');
    const base = `x_${slug(String(req.body?.definition?.label || ''))}`;
    const { rows: taken } = await query(`SELECT field_key FROM care_detail_fields WHERE care_home_id = $1 AND domain = $2`, [chId, domain]);
    let key = base, i = 2;
    while (taken.some((t: any) => t.field_key === key)) key = `${base}_${i++}`;
    const def = fieldDef(req.body, key);
    const { rows: [row] } = await query(
      `INSERT INTO care_detail_fields (care_home_id, domain, field_key, definition, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [chId, domain, key, JSON.stringify(def), req.user!.id]);
    await auditLog({ careHomeId: chId, actorId: req.user!.id, actorName: actor(req), action: 'CARE_PLAN_FIELD_CREATED', entityType: 'care_detail_field', entityId: row.id, afterData: { domain, label: def.label } });
    res.status(201).json({ id: row.id, domain, key, active: true, definition: def });
  } catch (err) { next(err); }
}

export async function updateField(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [cur] } = await query(`SELECT * FROM care_detail_fields WHERE id = $1 AND care_home_id = $2`, [req.params.id, chId]);
    if (!cur) throw new AppError(404, 'Field not found');
    const def = fieldDef(req.body, cur.field_key);
    // Values already recorded must stay meaningful: the kind of answer is fixed, and choices can only be added.
    if (def.type !== cur.definition.type) throw new AppError(409, 'The kind of answer cannot change once the field exists. Make a new field instead.');
    if (def.type === 'select') {
      const removed = (cur.definition.options || []).filter((o: string) => !(def.options || []).includes(o));
      if (removed.length) throw new AppError(409, `Choices already in use cannot be removed (${removed.join(', ')}). Add new ones instead.`);
    }
    const { rows: [row] } = await query(
      `UPDATE care_detail_fields SET definition = $1, active = COALESCE($2, active), updated_at = NOW() WHERE id = $3 RETURNING *`,
      [JSON.stringify(def), typeof req.body?.active === 'boolean' ? req.body.active : null, cur.id]);
    await auditLog({ careHomeId: chId, actorId: req.user!.id, actorName: actor(req), action: 'CARE_PLAN_FIELD_UPDATED', entityType: 'care_detail_field', entityId: row.id, afterData: { label: def.label, active: row.active } });
    res.json({ id: row.id, domain: row.domain, key: row.field_key, active: row.active, definition: def });
  } catch (err) { next(err); }
}

// ── Assessments ─────────────────────────────────────────────────────────────

export async function listCustomTools(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT t.*, u.first_name || ' ' || u.last_name AS published_by_name,
              (SELECT COUNT(*)::int FROM risk_assessments ra WHERE ra.custom_tool_id = t.id) AS used
         FROM custom_assessment_tools t LEFT JOIN users u ON u.id = t.published_by
        WHERE t.care_home_id = $1 ORDER BY t.family_id, t.version DESC`, [req.user!.care_home_id]);
    const families = new Map<string, any[]>();
    for (const r of rows) families.set(r.family_id, [...(families.get(r.family_id) || []), r]);
    res.json({
      domains: await knownDomains(req.user!.care_home_id),
      sectionTypes: (await sectionTypes(req.user!.care_home_id)).map(t => ({ key: t.domain_key, label: t.label })),
      families: [...families.entries()].map(([familyId, versions]) => ({
        familyId,
        name: versions[0].definition?.name,
        live: versions.find(v => v.status === 'published') ? shapeTool(versions.find(v => v.status === 'published')) : null,
        draft: versions.find(v => v.status === 'draft') ? shapeTool(versions.find(v => v.status === 'draft')) : null,
        versions: versions.map(shapeTool),
      })),
    });
  } catch (err) { next(err); }
}
const shapeTool = (r: any) => ({
  id: r.id, familyId: r.family_id, version: r.version, status: r.status, definition: r.definition,
  publishedAt: r.published_at, publishedByName: r.published_by_name || null, used: r.used ?? 0, updatedAt: r.updated_at,
});

function readDef(b: any): CustomToolDef {
  const d = b?.definition;
  if (!d || typeof d !== 'object') throw new AppError(400, 'The assessment definition is missing.');
  const s = JSON.stringify(d);
  if (s.length > 200_000) throw new AppError(413, 'This assessment is too large.');
  return JSON.parse(s);
}

export async function createCustomTool(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const def = readDef(req.body);
    const { rows: [row] } = await query(
      `INSERT INTO custom_assessment_tools (care_home_id, family_id, version, status, definition, created_by)
       VALUES ($1,$2,1,'draft',$3,$4) RETURNING *`, [chId, randomUUID(), JSON.stringify(def), req.user!.id]);
    res.status(201).json({ ...shapeTool(row), problems: validateCustomTool(def, await knownDomains(chId)) });
  } catch (err) { next(err); }
}

export async function updateCustomTool(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const def = readDef(req.body);
    const { rows: [row] } = await query(
      `UPDATE custom_assessment_tools SET definition = $1, updated_at = NOW() WHERE id = $2 AND care_home_id = $3 AND status = 'draft' RETURNING *`,
      [JSON.stringify(def), req.params.id, chId]);
    if (!row) throw new AppError(409, 'Only a draft can be changed. Make a new version to edit a published assessment.');
    res.json({ ...shapeTool(row), problems: validateCustomTool(def, await knownDomains(chId)) });
  } catch (err) { next(err); }
}

export async function publishCustomTool(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const out = await withTransaction(async (client) => {
      const { rows: [d] } = await client.query(`SELECT * FROM custom_assessment_tools WHERE id = $1 AND care_home_id = $2 FOR UPDATE`, [req.params.id, chId]);
      if (!d) return { status: 404, body: { error: 'Not found' } };
      if (d.status !== 'draft') return { status: 409, body: { error: 'Only a draft can be published.' } };
      const problems = validateCustomTool(d.definition, await knownDomains(chId));
      if (problems.length) return { status: 422, body: { error: 'This assessment is not ready yet.', problems } };
      await client.query(`UPDATE custom_assessment_tools SET status = 'retired', updated_at = NOW() WHERE family_id = $1 AND status = 'published'`, [d.family_id]);
      const { rows: [p] } = await client.query(
        `UPDATE custom_assessment_tools SET status = 'published', published_by = $1, published_at = NOW(), updated_at = NOW() WHERE id = $2 RETURNING *`,
        [req.user!.id, d.id]);
      return { status: 200, body: shapeTool(p) };
    });
    if (out.status === 200) {
      await auditLog({ careHomeId: chId, actorId: req.user!.id, actorName: actor(req), action: 'CUSTOM_ASSESSMENT_PUBLISHED', entityType: 'custom_assessment_tool', entityId: req.params.id, afterData: { name: (out.body as any).definition?.name, version: (out.body as any).version } });
    }
    res.status(out.status).json(out.body);
  } catch (err) { next(err); }
}

export async function newCustomToolVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [src] } = await query(`SELECT * FROM custom_assessment_tools WHERE id = $1 AND care_home_id = $2`, [req.params.id, chId]);
    if (!src) throw new AppError(404, 'Not found');
    const { rows: [draft] } = await query(`SELECT id FROM custom_assessment_tools WHERE family_id = $1 AND status = 'draft'`, [src.family_id]);
    if (draft) return res.status(409).json({ error: 'There is already a draft of this assessment — edit that one.', draftId: draft.id });
    const { rows: [{ v }] } = await query(`SELECT MAX(version)::int AS v FROM custom_assessment_tools WHERE family_id = $1`, [src.family_id]);
    const { rows: [row] } = await query(
      `INSERT INTO custom_assessment_tools (care_home_id, family_id, version, status, definition, created_by)
       VALUES ($1,$2,$3,'draft',$4,$5) RETURNING *`, [chId, src.family_id, v + 1, JSON.stringify(src.definition), req.user!.id]);
    res.status(201).json(shapeTool(row));
  } catch (err) { next(err); }
}

export async function retireCustomTool(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [row] } = await query(
      `UPDATE custom_assessment_tools SET status = 'retired', updated_at = NOW() WHERE id = $1 AND care_home_id = $2 AND status = 'published' RETURNING *`,
      [req.params.id, chId]);
    if (!row) throw new AppError(409, 'Only the live version can be retired.');
    await auditLog({ careHomeId: chId, actorId: req.user!.id, actorName: actor(req), action: 'CUSTOM_ASSESSMENT_RETIRED', entityType: 'custom_assessment_tool', entityId: row.id, afterData: { name: row.definition?.name } });
    res.json(shapeTool(row));
  } catch (err) { next(err); }
}

export async function deleteCustomDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const { rowCount } = await query(`DELETE FROM custom_assessment_tools WHERE id = $1 AND care_home_id = $2 AND status = 'draft'`, [req.params.id, req.user!.care_home_id]);
    if (!rowCount) throw new AppError(409, 'Only a draft can be deleted.');
    res.json({ ok: true });
  } catch (err) { next(err); }
}
