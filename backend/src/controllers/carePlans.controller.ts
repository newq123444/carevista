import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { auditLog } from '../services/audit.service';
import { cleanDetails, mergeDetails, safetyFacts } from '../services/careDetails';
import { TOOLS, type ToolKey } from '../services/assessmentTools';
import { sectionTypes, customDetailFields, publishedCustomTools } from './customisation.controller';

// ─────────────────────────────────────────────────────────────────────────────
// The person-centred care plan (CQC Regulation 9).
//
// A plan is a set of domain sections. Each section answers four questions:
//   what can this person do and not do  (assessed_need)
//   what does good look like for them   (desired_outcome)
//   what exactly do staff do            (interventions)
//   how will we know it is working      (measure_of_success)
//
// Everything else here exists to keep that honest: versioning so an inspector
// can see what the plan said on the day of an incident, a review cycle so it
// does not silently go stale, and a named sign-off so it is somebody's plan.
// ─────────────────────────────────────────────────────────────────────────────

export const CARE_PLAN_DOMAINS = [
  { key: 'personal_care',           label: '🛁 Personal care & appearance',       order: 1,  hint: 'Washing, dressing, oral care, grooming. What they do themselves, what they need help with, and how they prefer it done.' },
  { key: 'mobility_transfers',      label: '🚶 Mobility & transfers',             order: 2,  hint: 'Walking, transfers, equipment, number of staff, falls history.' },
  { key: 'nutrition_hydration',     label: '🍽 Eating & drinking',                order: 3,  hint: 'Diet type, texture (IDDSI), allergies, likes and dislikes, assistance needed, MUST score.' },
  { key: 'continence',              label: '🚽 Continence',                       order: 4,  hint: 'Continence status, products used, toileting routine, dignity considerations.' },
  { key: 'skin_integrity',          label: '🩹 Skin integrity & pressure care',   order: 5,  hint: 'Waterlow score, pressure areas, repositioning interval, mattress and cushion settings.' },
  { key: 'medication',              label: '💊 Medication',                       order: 6,  hint: 'How they take medicines, swallowing, PRN protocols, covert arrangements, who administers.' },
  { key: 'pain',                    label: '💢 Pain & comfort',                   order: 7,  hint: 'How this person shows pain, what helps, pain tool used (e.g. Abbey for non-verbal).' },
  { key: 'breathing_circulation',   label: '🫁 Breathing & circulation',          order: 8,  hint: 'Oxygen, inhalers, oedema, positioning, baseline observations.' },
  { key: 'communication_sensory',   label: '💬 Communication, sight & hearing',   order: 9,  hint: 'Preferred language, hearing aids, glasses, how they make needs known, what helps them understand.' },
  { key: 'cognition_mental_health', label: '🧠 Memory, mood & mental health',     order: 10, hint: 'Diagnosis, orientation, capacity, low mood or anxiety, what reassures them.' },
  { key: 'behaviour_support',       label: '🤲 Behaviour & distress',             order: 11, hint: 'What distress looks like, known triggers, what helps early, least restrictive responses.' },
  { key: 'social_emotional',        label: '👥 Social life, relationships & purpose', order: 12, hint: 'Who matters to them, what they enjoy, faith, routines that give the day meaning.' },
  { key: 'night_care',              label: '🌙 Night-time care',                  order: 13, hint: 'Usual bedtime, how they settle, checks needed and why, what to do if they wake.' },
  { key: 'safety_risk',             label: '⚠️ Safety & risk',                    order: 14, hint: 'Falls, choking, leaving unaccompanied, smoking, bed rails. Link to the risk assessment.' },
  { key: 'end_of_life',             label: '🕊 Wishes for the future',            order: 15, hint: 'DNACPR / ReSPECT, preferred place of care, advance decisions, funeral wishes. Only if discussed.' },
];

const DOMAIN_KEYS = CARE_PLAN_DOMAINS.map(d => d.key);

/** Which assessment tools inform which area of care (v88). */
export const ASSESSMENT_FOR: Record<string, string[]> = {
  skin_integrity: ['waterlow'],
  nutrition_hydration: ['must', 'eating_drinking', 'hydration'],
  mobility_transfers: ['moving_handling', 'wheelchair_belt'],
  safety_risk: ['falls', 'peep', 'personal_fire', 'leaving_building', 'seizure'],
  pain: ['abbey_pain'],
  personal_care: ['oral_health'],
  night_care: ['bed_rails'],
  // v89
  cognition_mental_health: ['delirium_4at', 'mood_gds15', 'emotional_safety'],
  behaviour_support: ['behaviour_support'],
  medication: ['self_medication'],
  continence: ['bowel', 'catheter'],
};

function addDays(date: Date, days: number) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// A section counts as complete only when a carer could act on it.
const COMPLETE_SQL = `
  (s.applicable = FALSE
   OR (COALESCE(TRIM(s.assessed_need),'') <> ''
       AND COALESCE(TRIM(s.desired_outcome),'') <> ''
       AND COALESCE(TRIM(s.interventions),'') <> ''))`;

async function snapshot(planId: string, careHomeId: string, version: number, reason: string, userId: string) {
  const { rows: [plan] } = await query(`SELECT * FROM care_plans WHERE id = $1`, [planId]);
  if (!plan) return;
  const { rows: sections } = await query(
    `SELECT * FROM care_plan_sections WHERE care_plan_id = $1 ORDER BY sort_order`, [planId]);
  await query(
    `INSERT INTO care_plan_versions (care_plan_id, care_home_id, version, snapshot, reason, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [planId, careHomeId, version, JSON.stringify({ plan, sections }), reason, userId]);
}

// ── Overview: the manager's "who has no plan / whose plan is stale" view ─────
export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [stats] } = await query(
      `SELECT
         (SELECT COUNT(*)::int FROM residents r
           WHERE r.care_home_id = $1 AND r.active = TRUE AND r.discharge_date IS NULL) AS total_residents,
         (SELECT COUNT(*)::int FROM care_plans p
           WHERE p.care_home_id = $1 AND p.status = 'active') AS active_plans,
         (SELECT COUNT(*)::int FROM care_plans p
           WHERE p.care_home_id = $1 AND p.status = 'draft') AS draft_plans,
         (SELECT COUNT(*)::int FROM care_plans p
           WHERE p.care_home_id = $1 AND p.status IN ('active','under_review')
             AND p.next_review_date IS NOT NULL AND p.next_review_date < CURRENT_DATE) AS overdue_reviews,
         (SELECT COUNT(*)::int FROM care_plans p
           WHERE p.care_home_id = $1 AND p.status IN ('active','under_review')
             AND p.next_review_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7) AS reviews_due_week`,
      [chId]);

    // Residents with no live plan at all — the number that matters most.
    const { rows: missing } = await query(
      `SELECT r.id, r.first_name, r.last_name, r.room_number, r.admission_date,
              (CURRENT_DATE - r.admission_date)::int AS days_since_admission
       FROM residents r
       WHERE r.care_home_id = $1 AND r.active = TRUE AND r.discharge_date IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM care_plans p
           WHERE p.resident_id = r.id AND p.status IN ('draft','active','under_review'))
       ORDER BY r.admission_date DESC`, [chId]);

    const total = stats?.total_residents || 0;
    const withPlan = (stats?.active_plans || 0) + (stats?.draft_plans || 0);

    res.json({
      totalResidents: total,
      activePlans: stats?.active_plans || 0,
      draftPlans: stats?.draft_plans || 0,
      overdueReviews: stats?.overdue_reviews || 0,
      reviewsDueWeek: stats?.reviews_due_week || 0,
      residentsWithoutPlan: missing.length,
      coveragePercent: total > 0 ? Math.round((withPlan / total) * 100) : null,
      missing: missing.map(m => ({
        residentId: m.id,
        residentName: `${m.first_name} ${m.last_name}`,
        roomNumber: m.room_number,
        admissionDate: m.admission_date,
        daysSinceAdmission: m.days_since_admission,
      })),
      domains: CARE_PLAN_DOMAINS,
    });
  } catch (err) { next(err); }
}

// ── List every plan with completeness and review state ──────────────────────
export async function listPlans(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const status = String(req.query.status || '').trim();
    const params: any[] = [chId];
    let filter = '';
    if (status && ['draft', 'active', 'under_review', 'archived'].includes(status)) {
      params.push(status);
      filter = `AND p.status = $${params.length}`;
    } else {
      filter = `AND p.status <> 'archived'`;
    }

    const { rows } = await query(
      `SELECT p.id, p.resident_id, p.status, p.version, p.next_review_date,
              p.last_reviewed_at, p.approved_at, p.effective_from,
              r.first_name, r.last_name, r.room_number, r.risk_level,
              u.first_name || ' ' || u.last_name AS approved_by_name,
              (SELECT COUNT(*)::int FROM care_plan_sections s WHERE s.care_plan_id = p.id) AS section_count,
              (SELECT COUNT(*)::int FROM care_plan_sections s
                WHERE s.care_plan_id = p.id AND ${COMPLETE_SQL}) AS complete_count,
              (SELECT COUNT(*)::int FROM care_plan_sections s
                WHERE s.care_plan_id = p.id AND s.status = 'needs_change') AS needs_change_count
       FROM care_plans p
       JOIN residents r ON r.id = p.resident_id
       LEFT JOIN users u ON u.id = p.approved_by
       WHERE p.care_home_id = $1 ${filter}
       ORDER BY (p.next_review_date IS NOT NULL AND p.next_review_date < CURRENT_DATE) DESC,
                p.next_review_date NULLS LAST, r.last_name`,
      params);

    res.json(rows.map(p => {
      const due = p.next_review_date ? new Date(p.next_review_date) : null;
      const today = new Date(new Date().toISOString().slice(0, 10));
      return {
        id: p.id,
        residentId: p.resident_id,
        residentName: `${p.first_name} ${p.last_name}`,
        roomNumber: p.room_number,
        riskLevel: p.risk_level,
        status: p.status,
        version: p.version,
        effectiveFrom: p.effective_from,
        nextReviewDate: p.next_review_date,
        lastReviewedAt: p.last_reviewed_at,
        approvedAt: p.approved_at,
        approvedByName: p.approved_by_name,
        sectionCount: p.section_count,
        completeCount: p.complete_count,
        completenessPercent: p.section_count > 0
          ? Math.round((p.complete_count / p.section_count) * 100) : 0,
        needsChangeCount: p.needs_change_count,
        reviewOverdue: !!(due && due < today),
        daysUntilReview: due ? Math.round((due.getTime() - today.getTime()) / 86400000) : null,
      };
    }));
  } catch (err) { next(err); }
}

// ── One plan in full ────────────────────────────────────────────────────────
async function loadPlan(planId: string, chId: string) {
  const { rows: [plan] } = await query(
    `SELECT p.*, r.first_name, r.last_name, r.preferred_name, r.room_number,
            r.date_of_birth, r.nhs_number, r.risk_level, r.dnacpr, r.allergies,
            r.gp_name, r.gp_practice,
            cb.first_name || ' ' || cb.last_name AS created_by_name,
            ub.first_name || ' ' || ub.last_name AS updated_by_name,
            ab.first_name || ' ' || ab.last_name AS approved_by_name
     FROM care_plans p
     JOIN residents r ON r.id = p.resident_id
     LEFT JOIN users cb ON cb.id = p.created_by
     LEFT JOIN users ub ON ub.id = p.updated_by
     LEFT JOIN users ab ON ab.id = p.approved_by
     WHERE p.id = $1 AND p.care_home_id = $2`, [planId, chId]);
  if (!plan) return null;

  const { rows: sections } = await query(
    `SELECT s.*, u.first_name || ' ' || u.last_name AS updated_by_name
     FROM care_plan_sections s
     LEFT JOIN users u ON u.id = s.updated_by
     WHERE s.care_plan_id = $1 ORDER BY s.sort_order`, [planId]);

  // The care day: timed items from each section (v87).
  const { rows: schedule } = await query(
    `SELECT id, section_id, to_char(due_time, 'HH24:MI') AS time, day_of_week, what, template_id
       FROM care_plan_schedule WHERE care_plan_id = $1 AND active ORDER BY due_time`, [planId]).catch(() => ({ rows: [] as any[] }));
  // The current assessment(s) for each section (v88: nine tools, current only).
  const { rows: assessments } = await query(
    `SELECT id, assessment_type, custom_family_id, total_score, risk_level, created_at, next_review_date, tool_version,
            result->>'headline' AS headline
       FROM risk_assessments WHERE resident_id = $1 AND care_home_id = $2 AND status = 'current'
      ORDER BY created_at DESC`, [plan.resident_id, chId]).catch(() => ({ rows: [] as any[] }));
  // The home's own sections, fields and assessments (v90).
  const types = await sectionTypes(chId, false);
  const typeOf = new Map(types.map((t: any) => [t.domain_key, t]));
  const custom = await customDetailFields(chId);
  const customs = await publishedCustomTools(chId);
  const customDomain = new Map(customs.map(c => [c.familyId, c.def.domain]));
  const customName = new Map(customs.map(c => [c.familyId, c.def.shortName]));
  const belongs = (a: any, domain: string) => a.assessment_type === 'custom'
    ? customDomain.get(a.custom_family_id) === domain
    : (ASSESSMENT_FOR[domain] || []).includes(a.assessment_type);
  // Records kept on other screens that belong with an area of the plan.
  const one = async (sql: string) => (await query(sql, [plan.resident_id, chId]).catch(() => ({ rows: [] as any[] }))).rows[0];
  const news2 = await one(`SELECT total_score, created_at FROM news2_assessments WHERE resident_id = $1 AND care_home_id = $2 ORDER BY created_at DESC LIMIT 1`);
  const wounds = await one(`SELECT COUNT(*)::int AS n FROM wound_assessments WHERE resident_id = $1 AND care_home_id = $2 AND status IN ('active','worsening')`);
  const mcaRow = await one(`SELECT COUNT(*)::int AS n, MIN(review_date) AS next_review FROM mca_assessments WHERE resident_id = $1 AND care_home_id = $2 AND status = 'completed'`);
  const dolsRow = await one(`SELECT dols_status, granted_until FROM liberty_protections WHERE resident_id = $1 AND care_home_id = $2 AND record_type = 'dols' AND active = TRUE ORDER BY created_at DESC LIMIT 1`);
  const contRow = await one(`SELECT created_at FROM continence_assessments WHERE resident_id = $1 AND care_home_id = $2 ORDER BY created_at DESC LIMIT 1`);
  const LINKED: Record<string, any[]> = {
    skin_integrity: wounds?.n ? [{ kind: 'wounds', n: wounds?.n, text: `${wounds.n} open wound${wounds.n === 1 ? '' : 's'}`, to: '/wounds', tone: 'amber' }] : [],
    breathing_circulation: news2 ? [{ kind: 'news2', n: news2?.total_score, text: `NEWS2 ${news2.total_score}`, at: news2.created_at, to: '/news2', tone: news2.total_score >= 5 ? 'red' : 'grey' }] : [],
    cognition_mental_health: mcaRow?.n ? [{ kind: 'mca', n: mcaRow?.n, text: `${mcaRow.n} capacity assessment${mcaRow.n === 1 ? '' : 's'}`, at: mcaRow.next_review, to: '/mca', tone: 'grey' }] : [],
    safety_risk: dolsRow ? [{ kind: 'dols', status: dolsRow?.dols_status, text: `DoLS: ${String(dolsRow.dols_status).replace(/_/g, ' ')}`, at: dolsRow.granted_until, to: '/dols', tone: ['expired', 'refused'].includes(dolsRow.dols_status) ? 'red' : 'grey' }] : [],
    continence: contRow ? [{ kind: 'continence', text: 'Continence assessment', at: contRow.created_at, to: '/continence', tone: 'grey' }] : [],
  };
  // Each need's evaluations, newest first (v88).
  const { rows: evaluations } = await query(
    `SELECT id, section_id, progress, note, still_right, evaluator_name, created_at
       FROM care_plan_evaluations WHERE care_plan_id = $1 ORDER BY created_at DESC`, [planId]).catch(() => ({ rows: [] as any[] }));
  const today0 = new Date().toISOString().slice(0, 10);
  const shapeAssessment = (a: any) => ({
    id: a.id, assessment_type: a.assessment_type,
    type: a.assessment_type === 'custom' ? `custom:${a.custom_family_id}` : a.assessment_type,
    custom: a.assessment_type === 'custom',
    name: a.assessment_type === 'custom' ? (customName.get(a.custom_family_id) || 'Home assessment') : TOOLS[a.assessment_type as ToolKey]?.shortName || a.assessment_type,
    total_score: a.total_score, risk_level: a.risk_level, headline: a.headline, created_at: a.created_at,
    next_review_date: a.next_review_date, legacy: !a.tool_version,
    overdue: !!a.next_review_date && new Date(a.next_review_date).toISOString().slice(0, 10) < today0,
  });

  const meta = new Map(CARE_PLAN_DOMAINS.map(d => [d.key, d]));
  const shaped = sections.map(s => ({
    id: s.id,
    domain: s.domain,
    // Labels without their leading emoji: the screens draw their own icons.
    domainLabel: typeOf.get(s.domain)?.label || (meta.get(s.domain)?.label || s.domain).replace(/^[^A-Za-z]+/, ''),
    custom: typeOf.has(s.domain),
    icon: typeOf.get(s.domain)?.icon || null,
    customFields: custom.defs[s.domain] || [],
    linked: LINKED[s.domain] || [],
    schedule: schedule.filter((x: any) => x.section_id === s.id),
    // Every current assessment whose tool belongs to this area of care.
    assessments: assessments.filter((a: any) => belongs(a, s.domain)).map(shapeAssessment),
    assessment: (() => { const a = assessments.find((x: any) => belongs(x, s.domain)); return a ? shapeAssessment(a) : null; })(),
    suggestedTools: [...(ASSESSMENT_FOR[s.domain] || []), ...customs.filter(c => c.def.domain === s.domain).map(c => c.key)],
    details: s.details || {},
    evaluations: evaluations.filter((e: any) => e.section_id === s.id).slice(0, 6).map((e: any) => ({
      id: e.id, progress: e.progress, note: e.note, stillRight: e.still_right, by: e.evaluator_name, at: e.created_at,
    })),
    hint: typeOf.get(s.domain)?.hint || meta.get(s.domain)?.hint || '',
    applicable: s.applicable,
    notApplicableReason: s.not_applicable_reason,
    assessedNeed: s.assessed_need,
    desiredOutcome: s.desired_outcome,
    interventions: s.interventions,
    residentView: s.resident_view,
    equipment: s.equipment,
    staffRequired: s.staff_required,
    frequency: s.frequency,
    measureOfSuccess: s.measure_of_success,
    riskLevel: s.risk_level,
    linkedRiskAssessmentId: s.linked_risk_assessment_id,
    status: s.status,
    sortOrder: s.sort_order,
    updatedByName: s.updated_by_name,
    updatedAt: s.updated_at,
    complete: !s.applicable || !!(
      (s.assessed_need || '').trim() && (s.desired_outcome || '').trim() && (s.interventions || '').trim()),
  }));

  const completeCount = shaped.filter(s => s.complete).length;
  const today = new Date(new Date().toISOString().slice(0, 10));
  const due = plan.next_review_date ? new Date(plan.next_review_date) : null;

  return {
    id: plan.id,
    residentId: plan.resident_id,
    residentName: `${plan.first_name} ${plan.last_name}`,
    preferredName: plan.preferred_name,
    roomNumber: plan.room_number,
    dateOfBirth: plan.date_of_birth,
    nhsNumber: plan.nhs_number,
    riskLevel: plan.risk_level,
    dnacpr: plan.dnacpr,
    allergies: plan.allergies,
    gpName: plan.gp_name,
    gpPractice: plan.gp_practice,
    status: plan.status,
    version: plan.version,
    title: plan.title,
    whatMattersToMe: plan.what_matters_to_me,
    howToSupportMeBest: plan.how_to_support_me_best,
    whatUpsetsMe: plan.what_upsets_me,
    myRoutine: plan.my_routine,
    communicationPreferences: plan.communication_preferences,
    culturalSpiritualNeeds: plan.cultural_spiritual_needs,
    peopleWhoMatter: plan.people_who_matter,
    howITakeMyMedication: plan.how_i_take_my_medication,
    sensoryMobilitySupport: plan.sensory_mobility_support,
    whatMakesMeAnxious: plan.what_makes_me_anxious,
    myStrengths: plan.my_strengths,
    pleaseDoNot: plan.please_do_not,
    residentInvolved: plan.resident_involved,
    residentInvolvementNotes: plan.resident_involvement_notes,
    familyInvolved: plan.family_involved,
    familyInvolvementNotes: plan.family_involvement_notes,
    advocateName: plan.advocate_name,
    capacityAssessmentId: plan.capacity_assessment_id,
    bestInterestsDecision: plan.best_interests_decision,
    effectiveFrom: plan.effective_from,
    reviewFrequencyDays: plan.review_frequency_days,
    nextReviewDate: plan.next_review_date,
    lastReviewedAt: plan.last_reviewed_at,
    approvedAt: plan.approved_at,
    approvedByName: plan.approved_by_name,
    approvedRole: plan.approved_role,
    createdByName: plan.created_by_name,
    updatedByName: plan.updated_by_name,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
    sections: shaped,
    // What a carer must know before helping, from this plan's details (v88).
    facts: safetyFacts({ allergies: plan.allergies, dnacpr: plan.dnacpr, sections: shaped, extraFields: custom.byDomain }),
    // An area marked "not applicable" while a current assessment for it shows
    // risk: the risk would be hidden from carers, so say so (v90).
    warnings: shaped.filter(s => !s.applicable).flatMap(s => s.assessments
      .filter((a: any) => ['high', 'very_high', 'severe'].includes(a.risk_level))
      .map((a: any) => ({ sectionId: s.id, domainLabel: s.domainLabel, assessment: a.name, headline: a.headline || String(a.risk_level).replace(/_/g, ' '), at: a.created_at }))),
    // The home's own assessments and sections, so the screens can run and add them.
    customTools: customs.map(c => ({ key: c.key, version: c.version, definition: c.def })),
    availableSections: types.filter((t: any) => t.active && !shaped.some(s => s.domain === t.domain_key)).map((t: any) => ({ key: t.domain_key, label: t.label, hint: t.hint })),
    completeCount,
    completenessPercent: shaped.length > 0 ? Math.round((completeCount / shaped.length) * 100) : 0,
    reviewOverdue: !!(due && due < today),
  };
}

export async function getPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const plan = await loadPlan(req.params.id, req.user!.care_home_id);
    if (!plan) return res.status(404).json({ error: 'Care plan not found' });
    res.json(plan);
  } catch (err) { next(err); }
}

// Used by the resident record — returns null rather than 404 so the UI can
// offer "start a care plan" instead of showing an error.
export async function getResidentPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [row] } = await query(
      `SELECT id FROM care_plans
       WHERE resident_id = $1 AND care_home_id = $2 AND status IN ('draft','active','under_review')
       LIMIT 1`, [req.params.residentId, chId]);
    if (!row) return res.json(null);
    res.json(await loadPlan(row.id, chId));
  } catch (err) { next(err); }
}

// ── Create ──────────────────────────────────────────────────────────────────
export async function createPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const residentId = b.residentId || b.resident_id;
    if (!residentId) return res.status(400).json({ error: 'A resident is required' });

    const { rows: [resident] } = await query(
      `SELECT id, first_name, last_name FROM residents WHERE id = $1 AND care_home_id = $2`,
      [residentId, chId]);
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    const { rows: [existing] } = await query(
      `SELECT id FROM care_plans WHERE resident_id = $1 AND status IN ('draft','active','under_review')`,
      [residentId]);
    if (existing) {
      return res.status(409).json({
        error: 'This resident already has a care plan. Open it to make changes.',
        planId: existing.id,
      });
    }

    const freq = Number(b.reviewFrequencyDays || b.review_frequency_days) || 30;
    const { rows: [plan] } = await query(
      `INSERT INTO care_plans
         (care_home_id, resident_id, status, title, review_frequency_days,
          next_review_date, created_by, updated_by)
       VALUES ($1,$2,'draft',$3,$4,$5,$6,$6) RETURNING *`,
      [chId, residentId, b.title || 'Person-centred care plan', freq,
       addDays(new Date(), freq), req.user!.id]);

    // Seed every domain so nothing is silently omitted. Staff mark the ones
    // that do not apply rather than leaving them blank.
    for (const d of CARE_PLAN_DOMAINS) {
      await query(
        `INSERT INTO care_plan_sections (care_plan_id, care_home_id, domain, sort_order)
         VALUES ($1,$2,$3,$4) ON CONFLICT (care_plan_id, domain) DO NOTHING`,
        [plan.id, chId, d.key, d.order]);
    }
    // And the home's own sections marked "add to every new plan" (v90).
    let extraOrder = 100;
    for (const t of (await sectionTypes(chId)).filter((x: any) => x.add_to_new_plans)) {
      await query(
        `INSERT INTO care_plan_sections (care_plan_id, care_home_id, domain, sort_order)
         VALUES ($1,$2,$3,$4) ON CONFLICT (care_plan_id, domain) DO NOTHING`,
        [plan.id, chId, t.domain_key, extraOrder++]);
    }

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_PLAN_CREATED', entityType: 'care_plan', entityId: plan.id,
      afterData: { residentId, resident: `${resident.first_name} ${resident.last_name}` },
    });

    res.status(201).json(await loadPlan(plan.id, chId));
  } catch (err) { next(err); }
}

// ── Update the person-centred header ────────────────────────────────────────
const PLAN_FIELDS: Record<string, string> = {
  title: 'title',
  whatMattersToMe: 'what_matters_to_me',
  howToSupportMeBest: 'how_to_support_me_best',
  whatUpsetsMe: 'what_upsets_me',
  myRoutine: 'my_routine',
  communicationPreferences: 'communication_preferences',
  culturalSpiritualNeeds: 'cultural_spiritual_needs',
  peopleWhoMatter: 'people_who_matter',
  howITakeMyMedication: 'how_i_take_my_medication',
  sensoryMobilitySupport: 'sensory_mobility_support',
  whatMakesMeAnxious: 'what_makes_me_anxious',
  myStrengths: 'my_strengths',
  pleaseDoNot: 'please_do_not',
  residentInvolved: 'resident_involved',
  residentInvolvementNotes: 'resident_involvement_notes',
  familyInvolved: 'family_involved',
  familyInvolvementNotes: 'family_involvement_notes',
  advocateName: 'advocate_name',
  bestInterestsDecision: 'best_interests_decision',
  capacityAssessmentId: 'capacity_assessment_id',
  effectiveFrom: 'effective_from',
  reviewFrequencyDays: 'review_frequency_days',
  nextReviewDate: 'next_review_date',
};

export async function updatePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const { rows: [current] } = await query(
      `SELECT * FROM care_plans WHERE id = $1 AND care_home_id = $2`, [req.params.id, chId]);
    if (!current) return res.status(404).json({ error: 'Care plan not found' });
    if (current.status === 'archived') {
      return res.status(409).json({ error: 'This plan is archived and cannot be edited' });
    }

    const sets: string[] = [];
    const params: any[] = [];
    for (const [camel, col] of Object.entries(PLAN_FIELDS)) {
      const snake = col;
      const val = b[camel] !== undefined ? b[camel] : b[snake];
      if (val === undefined) continue;
      params.push(val === '' ? null : val);
      sets.push(`${col} = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    params.push(req.user!.id);
    sets.push(`updated_by = $${params.length}`);
    params.push(req.params.id, chId);

    await query(
      `UPDATE care_plans SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length - 1} AND care_home_id = $${params.length}`, params);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_PLAN_UPDATED', entityType: 'care_plan', entityId: req.params.id,
    });

    res.json(await loadPlan(req.params.id, chId));
  } catch (err) { next(err); }
}

// ── Update one domain section ───────────────────────────────────────────────
const SECTION_FIELDS: Record<string, string> = {
  applicable: 'applicable',
  notApplicableReason: 'not_applicable_reason',
  assessedNeed: 'assessed_need',
  desiredOutcome: 'desired_outcome',
  interventions: 'interventions',
  residentView: 'resident_view',
  equipment: 'equipment',
  staffRequired: 'staff_required',
  frequency: 'frequency',
  measureOfSuccess: 'measure_of_success',
  riskLevel: 'risk_level',
  linkedRiskAssessmentId: 'linked_risk_assessment_id',
  status: 'status',
};

export async function updateSection(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const { rows: [section] } = await query(
      `SELECT s.*, p.status AS plan_status FROM care_plan_sections s
       JOIN care_plans p ON p.id = s.care_plan_id
       WHERE s.id = $1 AND s.care_home_id = $2 AND s.care_plan_id = $3`,
      [req.params.sectionId, chId, req.params.id]);
    if (!section) return res.status(404).json({ error: 'Care plan section not found' });
    if (section.plan_status === 'archived') {
      return res.status(409).json({ error: 'This plan is archived and cannot be edited' });
    }

    if (b.riskLevel !== undefined && b.riskLevel !== null &&
        !['low', 'medium', 'high'].includes(b.riskLevel)) {
      return res.status(400).json({ error: 'Risk level must be low, medium or high' });
    }
    if (b.status !== undefined && b.status !== null &&
        !['not_started', 'in_place', 'needs_change'].includes(b.status)) {
      return res.status(400).json({ error: 'Section status must be not_started, in_place or needs_change' });
    }

    const sets: string[] = [];
    const params: any[] = [];
    // Structured details (v88): validated against the area of care, merged.
    if (b.details !== undefined && b.details !== null) {
      const { details, errors } = cleanDetails(section.domain, b.details, (await customDetailFields(chId)).byDomain[section.domain] || []);
      if (errors.length) return res.status(400).json({ error: errors[0], errors });
      params.push(JSON.stringify(mergeDetails(section.details, details)));
      sets.push(`details = $${params.length}`);
    }
    for (const [camel, col] of Object.entries(SECTION_FIELDS)) {
      const val = b[camel] !== undefined ? b[camel] : b[col];
      if (val === undefined) continue;
      params.push(val === '' ? null : val);
      sets.push(`${col} = $${params.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    params.push(req.user!.id);
    sets.push(`updated_by = $${params.length}`);
    params.push(req.params.sectionId);

    await query(
      `UPDATE care_plan_sections SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length}`, params);

    // A live plan that changes materially becomes "under review" until a nurse
    // re-signs it. Silent edits to a signed plan are the thing inspectors hate.
    if (section.plan_status === 'active') {
      await query(
        `UPDATE care_plans SET status = 'under_review', updated_by = $1, updated_at = NOW()
         WHERE id = $2`, [req.user!.id, req.params.id]);
    }
    await query(`UPDATE care_plans SET updated_by = $1, updated_at = NOW() WHERE id = $2`,
      [req.user!.id, req.params.id]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_PLAN_SECTION_UPDATED', entityType: 'care_plan', entityId: req.params.id,
      beforeData: { domain: section.domain, assessedNeed: section.assessed_need,
                    desiredOutcome: section.desired_outcome, interventions: section.interventions },
      afterData: { domain: section.domain, ...b },
    });

    res.json(await loadPlan(req.params.id, chId));
  } catch (err) { next(err); }
}

// ── Sign off ────────────────────────────────────────────────────────────────
export async function approvePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [plan] } = await query(
      `SELECT * FROM care_plans WHERE id = $1 AND care_home_id = $2`, [req.params.id, chId]);
    if (!plan) return res.status(404).json({ error: 'Care plan not found' });
    if (plan.status === 'archived') return res.status(409).json({ error: 'This plan is archived' });

    // Refuse to sign off a plan with unfilled applicable sections. A signature
    // on an incomplete plan is worse than no signature.
    const { rows: [gaps] } = await query(
      `SELECT COUNT(*)::int AS n,
              STRING_AGG(s.domain, ',') AS domains
       FROM care_plan_sections s
       WHERE s.care_plan_id = $1 AND NOT (${COMPLETE_SQL})`, [req.params.id]);
    if (gaps && gaps.n > 0 && req.body?.force !== true) {
      const labels = String(gaps.domains || '').split(',')
        .map(d => CARE_PLAN_DOMAINS.find(x => x.key === d)?.label || d);
      return res.status(422).json({
        error: `${gaps.n} section${gaps.n === 1 ? '' : 's'} still incomplete. Complete them, or mark them not applicable, before signing off.`,
        incompleteDomains: labels,
      });
    }

    const nextVersion = plan.version + 1;
    await snapshot(req.params.id, chId, plan.version, 'Signed off', req.user!.id);

    const freq = plan.review_frequency_days || 30;
    await query(
      `UPDATE care_plans
       SET status = 'active', version = $1, approved_by = $2, approved_at = NOW(),
           approved_role = $3, next_review_date = $4, updated_by = $2, updated_at = NOW()
       WHERE id = $5`,
      [nextVersion, req.user!.id, req.user!.role, addDays(new Date(), freq), req.params.id]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_PLAN_APPROVED', entityType: 'care_plan', entityId: req.params.id,
      afterData: { version: nextVersion, role: req.user!.role },
    });

    res.json(await loadPlan(req.params.id, chId));
  } catch (err) { next(err); }
}

// ── Reviews ─────────────────────────────────────────────────────────────────
export async function listReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT rv.*, u.first_name || ' ' || u.last_name AS reviewed_by_name
       FROM care_plan_reviews rv
       LEFT JOIN users u ON u.id = rv.reviewed_by
       WHERE rv.care_plan_id = $1 AND rv.care_home_id = $2
       ORDER BY rv.review_date DESC, rv.created_at DESC`,
      [req.params.id, req.user!.care_home_id]);
    res.json(rows.map(r => ({
      id: r.id,
      reviewDate: r.review_date,
      reviewType: r.review_type,
      whatIsWorking: r.what_is_working,
      whatIsNotWorking: r.what_is_not_working,
      whatChanged: r.what_changed,
      outcome: r.outcome,
      residentPresent: r.resident_present,
      familyPresent: r.family_present,
      othersPresent: r.others_present,
      nextReviewDate: r.next_review_date,
      reviewedByName: r.reviewed_by_name,
      versionAtReview: r.version_at_review,
      createdAt: r.created_at,
    })));
  } catch (err) { next(err); }
}

export async function createReview(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const { rows: [plan] } = await query(
      `SELECT * FROM care_plans WHERE id = $1 AND care_home_id = $2`, [req.params.id, chId]);
    if (!plan) return res.status(404).json({ error: 'Care plan not found' });

    const working = (b.whatIsWorking || b.what_is_working || '').trim();
    const notWorking = (b.whatIsNotWorking || b.what_is_not_working || '').trim();
    if (!working && !notWorking) {
      return res.status(400).json({
        error: 'Record what is working or what is not working — a review with neither says nothing.',
      });
    }
    const outcome = b.outcome || 'no_change';
    if (!['no_change', 'updated', 'escalated'].includes(outcome)) {
      return res.status(400).json({ error: 'Outcome must be no_change, updated or escalated' });
    }

    const freq = plan.review_frequency_days || 30;
    const nextDate = b.nextReviewDate || b.next_review_date || addDays(new Date(), freq);

    const { rows: [review] } = await query(
      `INSERT INTO care_plan_reviews
         (care_plan_id, care_home_id, resident_id, review_date, review_type,
          what_is_working, what_is_not_working, what_changed, outcome,
          resident_present, family_present, others_present,
          next_review_date, reviewed_by, version_at_review)
       VALUES ($1,$2,$3, COALESCE($4::date, CURRENT_DATE), $5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [req.params.id, chId, plan.resident_id,
       b.reviewDate || b.review_date || null, b.reviewType || b.review_type || 'routine',
       working || null, notWorking || null, b.whatChanged || b.what_changed || null, outcome,
       b.residentPresent === true, b.familyPresent === true,
       b.othersPresent || b.others_present || null,
       nextDate, req.user!.id, plan.version]);

    await snapshot(req.params.id, chId, plan.version, `Review: ${b.reviewType || 'routine'}`, req.user!.id);

    await query(
      `UPDATE care_plans SET last_reviewed_at = NOW(), next_review_date = $1,
              status = CASE WHEN status = 'archived' THEN status
                            WHEN $2 = 'no_change' THEN 'active' ELSE 'under_review' END,
              updated_by = $3, updated_at = NOW()
       WHERE id = $4`, [nextDate, outcome, req.user!.id, req.params.id]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_PLAN_REVIEWED', entityType: 'care_plan', entityId: req.params.id,
      afterData: { outcome, reviewType: b.reviewType || 'routine' },
    });

    res.status(201).json({ id: review.id, nextReviewDate: nextDate, outcome });
  } catch (err) { next(err); }
}

// ── Version history ─────────────────────────────────────────────────────────
export async function listVersions(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT v.id, v.version, v.reason, v.created_at,
              u.first_name || ' ' || u.last_name AS created_by_name
       FROM care_plan_versions v
       LEFT JOIN users u ON u.id = v.created_by
       WHERE v.care_plan_id = $1 AND v.care_home_id = $2
       ORDER BY v.created_at DESC`,
      [req.params.id, req.user!.care_home_id]);
    res.json(rows.map(v => ({
      id: v.id, version: v.version, reason: v.reason,
      createdAt: v.created_at, createdByName: v.created_by_name,
    })));
  } catch (err) { next(err); }
}

export async function getVersion(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows: [v] } = await query(
      `SELECT v.*, u.first_name || ' ' || u.last_name AS created_by_name
       FROM care_plan_versions v
       LEFT JOIN users u ON u.id = v.created_by
       WHERE v.id = $1 AND v.care_home_id = $2`,
      [req.params.versionId, req.user!.care_home_id]);
    if (!v) return res.status(404).json({ error: 'Version not found' });

    const snap = typeof v.snapshot === 'string' ? JSON.parse(v.snapshot) : v.snapshot;
    const meta = new Map(CARE_PLAN_DOMAINS.map(d => [d.key, d.label]));
    res.json({
      id: v.id, version: v.version, reason: v.reason,
      createdAt: v.created_at, createdByName: v.created_by_name,
      plan: snap?.plan || null,
      sections: (snap?.sections || []).map((s: any) => ({
        ...s, domainLabel: meta.get(s.domain) || s.domain,
      })),
    });
  } catch (err) { next(err); }
}

// ── Archive (e.g. on discharge, or replaced by a new plan) ──────────────────
export async function archivePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const reason = (req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'A reason for archiving is required' });

    const { rows: [plan] } = await query(
      `SELECT * FROM care_plans WHERE id = $1 AND care_home_id = $2`, [req.params.id, chId]);
    if (!plan) return res.status(404).json({ error: 'Care plan not found' });
    if (plan.status === 'archived') return res.status(409).json({ error: 'Already archived' });

    await snapshot(req.params.id, chId, plan.version, `Archived: ${reason}`, req.user!.id);
    await query(
      `UPDATE care_plans SET status = 'archived', archived_at = NOW(), archived_reason = $1,
              updated_by = $2, updated_at = NOW() WHERE id = $3`,
      [reason, req.user!.id, req.params.id]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_PLAN_ARCHIVED', entityType: 'care_plan', entityId: req.params.id,
      afterData: { reason },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── Import an AI draft into the real plan ───────────────────────────────────
// The AI writer produces a draft. Until now that draft lived on its own and
// nobody maintained it. This pulls it into the structured plan as a starting
// point that a nurse then edits and signs — which is the only safe way to use
// generated text in a clinical record.
export async function importAiDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [plan] } = await query(
      `SELECT * FROM care_plans WHERE id = $1 AND care_home_id = $2`, [req.params.id, chId]);
    if (!plan) return res.status(404).json({ error: 'Care plan not found' });
    if (plan.status === 'archived') return res.status(409).json({ error: 'This plan is archived' });

    const aiPlanId = req.body?.aiPlanId || req.body?.ai_plan_id || req.params.aiPlanId;
    const { rows: [ai] } = await query(
      aiPlanId
        ? `SELECT * FROM ai_care_plans WHERE id = $1 AND care_home_id = $2`
        : `SELECT * FROM ai_care_plans WHERE resident_id = $1 AND care_home_id = $2
           ORDER BY created_at DESC LIMIT 1`,
      aiPlanId ? [aiPlanId, chId] : [plan.resident_id, chId]);
    if (!ai) return res.status(404).json({ error: 'No AI draft found for this resident' });

    const content = typeof ai.content === 'string' ? JSON.parse(ai.content) : (ai.content || {});
    const overwrite = req.body?.overwrite === true;
    let filled = 0;

    for (const d of CARE_PLAN_DOMAINS) {
      const block = content[d.key] || content[d.label] || null;
      if (!block) continue;
      const need = typeof block === 'string' ? block : (block.assessedNeed || block.need || null);
      const outcome = typeof block === 'string' ? null : (block.desiredOutcome || block.outcome || null);
      const interventions = typeof block === 'string' ? null
        : (Array.isArray(block.interventions) ? block.interventions.join('\n') : block.interventions || null);
      if (!need && !outcome && !interventions) continue;

      const { rowCount } = await query(
        `UPDATE care_plan_sections SET
           assessed_need   = CASE WHEN $1 OR COALESCE(TRIM(assessed_need),'') = ''   THEN COALESCE($2, assessed_need)   ELSE assessed_need END,
           desired_outcome = CASE WHEN $1 OR COALESCE(TRIM(desired_outcome),'') = '' THEN COALESCE($3, desired_outcome) ELSE desired_outcome END,
           interventions   = CASE WHEN $1 OR COALESCE(TRIM(interventions),'') = ''   THEN COALESCE($4, interventions)   ELSE interventions END,
           updated_by = $5, updated_at = NOW()
         WHERE care_plan_id = $6 AND domain = $7`,
        [overwrite, need, outcome, interventions, req.user!.id, req.params.id, d.key]);
      if (rowCount) filled++;
    }

    await query(`UPDATE ai_care_plans SET imported_to_plan_id = $1 WHERE id = $2`, [req.params.id, ai.id]);
    await query(`UPDATE care_plans SET source_ai_plan_id = $1, updated_by = $2, updated_at = NOW()
                 WHERE id = $3`, [ai.id, req.user!.id, req.params.id]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_PLAN_AI_DRAFT_IMPORTED', entityType: 'care_plan', entityId: req.params.id,
      afterData: { aiPlanId: ai.id, sectionsFilled: filled },
    });

    res.json({
      sectionsFilled: filled,
      message: filled === 0
        ? 'The AI draft did not contain content matching any care plan domain. Nothing was changed.'
        : `${filled} section${filled === 1 ? '' : 's'} pre-filled from the AI draft. Every one still needs a nurse to check and sign it.`,
      plan: await loadPlan(req.params.id, chId),
    });
  } catch (err) { next(err); }
}

// ── Evaluations: is this part of the plan working? (v88) ───────────────────
const PROGRESS = ['better', 'same', 'worse', 'met'];
export async function addEvaluation(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    if (!PROGRESS.includes(b.progress)) return res.status(400).json({ error: 'Choose how things are going' });
    const note = typeof b.note === 'string' ? b.note.trim() : '';
    if (note.length < 10) return res.status(400).json({ error: 'Write what you saw — at least a sentence' });
    if (typeof b.stillRight !== 'boolean') return res.status(400).json({ error: 'Say whether the plan is still right' });
    const { rows: [sec] } = await query(
      `SELECT s.id, s.domain, p.id AS plan_id, p.resident_id, p.status FROM care_plan_sections s JOIN care_plans p ON p.id = s.care_plan_id
        WHERE s.id = $1 AND p.id = $2 AND p.care_home_id = $3`, [req.params.sectionId, req.params.id, chId]);
    if (!sec) return res.status(404).json({ error: 'Care plan section not found' });
    if (sec.status === 'archived') return res.status(409).json({ error: 'This plan is archived' });
    const name = `${req.user!.first_name} ${req.user!.last_name}`;
    const { rows: [row] } = await query(
      `INSERT INTO care_plan_evaluations (care_home_id, care_plan_id, section_id, resident_id, progress, note, still_right, evaluated_by, evaluator_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [chId, sec.plan_id, sec.id, sec.resident_id, b.progress, note.slice(0, 4000), b.stillRight, req.user!.id, name]);
    // "The plan is not right any more" flags the need for change.
    if (!b.stillRight) {
      await query(`UPDATE care_plan_sections SET status = 'needs_change', updated_by = $1, updated_at = NOW() WHERE id = $2`, [req.user!.id, sec.id]);
    }
    await auditLog({
      careHomeId: chId, actorId: req.user!.id, actorName: name,
      action: 'CARE_PLAN_EVALUATED', entityType: 'care_plan', entityId: sec.plan_id,
      afterData: { domain: sec.domain, progress: b.progress, stillRight: b.stillRight }, ip: req.ip,
    });
    res.status(201).json(row);
  } catch (err) { next(err); }
}

/**
 * "Know before you help" for one resident: from their care plan's details,
 * plus allergies and DNACPR. If they have no plan yet, from their current
 * assessments, marked as such.
 */
export async function getResidentFacts(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [r] } = await query(
      `SELECT id, allergies, dnacpr FROM residents WHERE id = $1 AND care_home_id = $2`, [req.params.residentId, chId]);
    if (!r) return res.status(404).json({ error: 'Resident not found' });
    const { rows: [plan] } = await query(
      `SELECT id, status FROM care_plans WHERE resident_id = $1 AND care_home_id = $2 AND status IN ('draft','active','under_review')
        ORDER BY (status = 'active') DESC, updated_at DESC LIMIT 1`, [r.id, chId]);
    if (plan) {
      const { rows: sections } = await query(
        `SELECT domain, applicable, details FROM care_plan_sections WHERE care_plan_id = $1 ORDER BY sort_order`, [plan.id]);
      return res.json({ source: 'plan', planId: plan.id, planStatus: plan.status,
        facts: safetyFacts({ allergies: r.allergies, dnacpr: r.dnacpr, sections, extraFields: (await customDetailFields(chId)).byDomain }) });
    }
    const { rows: current } = await query(
      `SELECT result FROM risk_assessments WHERE resident_id = $1 AND care_home_id = $2 AND status = 'current' AND tool_version IS NOT NULL`, [r.id, chId]);
    const base = safetyFacts({ allergies: r.allergies, dnacpr: r.dnacpr, sections: [] });
    const seen = new Set(base.map(f => f.text));
    for (const a of current) for (const f of (a.result?.facts || [])) if (!seen.has(f)) { seen.add(f); base.push({ text: f, tone: 'info', domain: a.result?.plan?.domain || '' }); }
    res.json({ source: 'assessments', facts: base });
  } catch (err) { next(err); }
}

// ── Add one of the home's own sections to a plan (v90) ─────────────────────
export async function addSection(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const domain = String(req.body?.domain || '');
    const { rows: [plan] } = await query(`SELECT id, status FROM care_plans WHERE id = $1 AND care_home_id = $2`, [req.params.id, chId]);
    if (!plan) return res.status(404).json({ error: 'Care plan not found' });
    if (plan.status === 'archived') return res.status(409).json({ error: 'This plan is archived' });
    const type = (await sectionTypes(chId)).find((t: any) => t.domain_key === domain);
    if (!type) return res.status(400).json({ error: 'Choose one of the home\'s own sections.' });
    const { rows: [{ n }] } = await query(`SELECT COALESCE(MAX(sort_order), 99)::int + 1 AS n FROM care_plan_sections WHERE care_plan_id = $1`, [plan.id]);
    const { rowCount } = await query(
      `INSERT INTO care_plan_sections (care_plan_id, care_home_id, domain, sort_order) VALUES ($1,$2,$3,$4)
       ON CONFLICT (care_plan_id, domain) DO NOTHING`, [plan.id, chId, domain, Math.max(100, n)]);
    if (!rowCount) return res.status(409).json({ error: 'This plan already has that section.' });
    if (plan.status === 'active') {
      await query(`UPDATE care_plans SET status = 'under_review', updated_by = $1, updated_at = NOW() WHERE id = $2`, [req.user!.id, plan.id]);
    }
    await auditLog({
      careHomeId: chId, actorId: req.user!.id, actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_PLAN_SECTION_ADDED', entityType: 'care_plan', entityId: plan.id, afterData: { domain, label: type.label },
    });
    res.status(201).json(await loadPlan(plan.id, chId));
  } catch (err) { next(err); }
}

export { DOMAIN_KEYS };
