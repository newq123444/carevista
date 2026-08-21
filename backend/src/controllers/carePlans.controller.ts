import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { auditLog } from '../services/audit.service';

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
  { key: 'personal_care',           label: 'Personal care & appearance',       order: 1,  hint: 'Washing, dressing, oral care, grooming. What they do themselves, what they need help with, and how they prefer it done.' },
  { key: 'mobility_transfers',      label: 'Mobility & transfers',             order: 2,  hint: 'Walking, transfers, equipment, number of staff, falls history.' },
  { key: 'nutrition_hydration',     label: 'Eating & drinking',                order: 3,  hint: 'Diet type, texture (IDDSI), allergies, likes and dislikes, assistance needed, MUST score.' },
  { key: 'continence',              label: 'Continence',                       order: 4,  hint: 'Continence status, products used, toileting routine, dignity considerations.' },
  { key: 'skin_integrity',          label: 'Skin integrity & pressure care',   order: 5,  hint: 'Waterlow score, pressure areas, repositioning interval, mattress and cushion settings.' },
  { key: 'medication',              label: 'Medication',                       order: 6,  hint: 'How they take medicines, swallowing, PRN protocols, covert arrangements, who administers.' },
  { key: 'pain',                    label: 'Pain & comfort',                   order: 7,  hint: 'How this person shows pain, what helps, pain tool used (e.g. Abbey for non-verbal).' },
  { key: 'breathing_circulation',   label: 'Breathing & circulation',          order: 8,  hint: 'Oxygen, inhalers, oedema, positioning, baseline observations.' },
  { key: 'communication_sensory',   label: 'Communication, sight & hearing',   order: 9,  hint: 'Preferred language, hearing aids, glasses, how they make needs known, what helps them understand.' },
  { key: 'cognition_mental_health', label: 'Memory, mood & mental health',     order: 10, hint: 'Diagnosis, orientation, capacity, low mood or anxiety, what reassures them.' },
  { key: 'behaviour_support',       label: 'Behaviour & distress',             order: 11, hint: 'What distress looks like, known triggers, what helps early, least restrictive responses.' },
  { key: 'social_emotional',        label: 'Social life, relationships & purpose', order: 12, hint: 'Who matters to them, what they enjoy, faith, routines that give the day meaning.' },
  { key: 'night_care',              label: 'Night-time care',                  order: 13, hint: 'Usual bedtime, how they settle, checks needed and why, what to do if they wake.' },
  { key: 'safety_risk',             label: 'Safety & risk',                    order: 14, hint: 'Falls, choking, leaving unaccompanied, smoking, bed rails. Link to the risk assessment.' },
  { key: 'end_of_life',             label: 'Wishes for the future',            order: 15, hint: 'DNACPR / ReSPECT, preferred place of care, advance decisions, funeral wishes. Only if discussed.' },
];

const DOMAIN_KEYS = CARE_PLAN_DOMAINS.map(d => d.key);

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

  const meta = new Map(CARE_PLAN_DOMAINS.map(d => [d.key, d]));
  const shaped = sections.map(s => ({
    id: s.id,
    domain: s.domain,
    domainLabel: meta.get(s.domain)?.label || s.domain,
    hint: meta.get(s.domain)?.hint || '',
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

export { DOMAIN_KEYS };
