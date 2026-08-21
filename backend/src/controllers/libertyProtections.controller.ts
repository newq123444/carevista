import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { auditLog } from '../services/audit.service';

// DoLS authorisations and the restrictions register.
//
// Two related things a care home must be able to produce on demand:
//  1. Every Deprivation of Liberty Safeguards authorisation — applied, urgent,
//     granted, expiring — with its conditions and the person's representative.
//  2. Every restriction placed on a resident: bed rails, lap belts, locked
//     doors, covert medication, sensor mats, 1:1 supervision. Each needs a
//     reason, evidence that a less restrictive option was considered, and a
//     lawful basis (consent, best interests, DoLS or court order).
//
// An expired DoLS is an unlawful deprivation of liberty. The expiry tracking
// below is the point of this module.

const RESTRICTION_LABELS: Record<string,string> = {
  bed_rails: 'Bed rails', lap_belt: 'Lap belt', locked_door: 'Locked door',
  covert_medication: 'Covert medication', sensor_mat: 'Sensor mat',
  door_sensor: 'Door sensor', restricted_access: 'Restricted access to areas',
  supervision_1to1: '1:1 supervision', chemical_restraint: 'Medication used to calm',
  physical_intervention: 'Physical intervention', financial_control: 'Control of finances',
  other: 'Other',
};
const DOLS_STATUSES = ['not_applied','urgent_in_place','standard_applied','granted','expired','refused','withdrawn'];
const CONSENT_BASES = ['resident_consent','best_interests','dols_authorised','court_authorised','lpa_consent'];

function shape(r: any) {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const until = r.granted_until ? new Date(r.granted_until) : null;
  const review = r.next_review_date ? new Date(r.next_review_date) : null;
  const urgent = r.urgent_expiry ? new Date(r.urgent_expiry) : null;
  return {
    id: r.id,
    residentId: r.resident_id,
    residentName: `${r.first_name} ${r.last_name}`,
    roomNumber: r.room_number,
    recordType: r.record_type,
    dolsStatus: r.dols_status,
    appliedDate: r.applied_date,
    urgentExpiry: r.urgent_expiry,
    grantedFrom: r.granted_from,
    grantedUntil: r.granted_until,
    supervisoryBody: r.supervisory_body,
    referenceNumber: r.reference_number,
    conditions: r.conditions,
    representativeName: r.representative_name,
    representativeContact: r.representative_contact,
    restrictionType: r.restriction_type,
    restrictionLabel: r.restriction_type ? (RESTRICTION_LABELS[r.restriction_type] || r.restriction_type) : null,
    description: r.description,
    reason: r.reason,
    lessRestrictiveConsidered: r.less_restrictive_considered,
    consentBasis: r.consent_basis,
    authorisedBy: r.authorised_by,
    familyConsulted: r.family_consulted,
    gpConsulted: r.gp_consulted,
    startDate: r.start_date,
    endDate: r.end_date,
    nextReviewDate: r.next_review_date,
    lastReviewedAt: r.last_reviewed_at,
    reviewNotes: r.review_notes,
    active: r.active,
    createdAt: r.created_at,
    // Derived flags — these are what makes the register useful rather than a list.
    authorisationExpired: !!(r.active && until && until < today),
    expiringSoon: !!(r.active && until && until >= today &&
      (until.getTime() - today.getTime()) / 86400000 <= 28),
    urgentExpiring: !!(r.active && urgent && (urgent.getTime() - today.getTime()) / 86400000 <= 2),
    reviewOverdue: !!(r.active && review && review < today),
    // A restriction with no lawful basis recorded is the single biggest risk here.
    missingLawfulBasis: r.record_type === 'restriction' && !r.consent_basis,
  };
}

export async function listProtections(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const params: any[] = [chId];
    const where = ['l.care_home_id = $1'];
    if (req.query.residentId) { params.push(req.query.residentId); where.push(`l.resident_id = $${params.length}`); }
    if (req.query.recordType) { params.push(req.query.recordType); where.push(`l.record_type = $${params.length}`); }
    if (String(req.query.includeInactive) !== 'true') where.push('l.active = TRUE');

    const { rows } = await query(
      `SELECT l.*, r.first_name, r.last_name, r.room_number
       FROM liberty_protections l
       JOIN residents r ON r.id = l.resident_id
       WHERE ${where.join(' AND ')}
       ORDER BY l.active DESC, l.granted_until NULLS LAST, l.start_date DESC LIMIT 300`, params);
    res.json(rows.map(shape));
  } catch (err) { next(err); }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [s] } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE record_type = 'dols' AND active AND dols_status = 'granted')::int AS dols_in_force,
         COUNT(*) FILTER (WHERE record_type = 'dols' AND active AND dols_status IN ('standard_applied','urgent_in_place'))::int AS dols_awaiting,
         COUNT(*) FILTER (WHERE record_type = 'dols' AND active AND granted_until IS NOT NULL AND granted_until < CURRENT_DATE)::int AS dols_expired,
         COUNT(*) FILTER (WHERE record_type = 'dols' AND active AND granted_until BETWEEN CURRENT_DATE AND CURRENT_DATE + 28)::int AS dols_expiring,
         COUNT(*) FILTER (WHERE record_type = 'restriction' AND active)::int AS restrictions_active,
         COUNT(*) FILTER (WHERE record_type = 'restriction' AND active AND consent_basis IS NULL)::int AS restrictions_no_basis,
         COUNT(*) FILTER (WHERE active AND next_review_date IS NOT NULL AND next_review_date < CURRENT_DATE)::int AS reviews_overdue
       FROM liberty_protections WHERE care_home_id = $1`, [chId]);

    const { rows: byType } = await query(
      `SELECT restriction_type, COUNT(*)::int AS n FROM liberty_protections
       WHERE care_home_id = $1 AND active AND restriction_type IS NOT NULL
       GROUP BY restriction_type ORDER BY n DESC`, [chId]);

    res.json({
      dolsInForce: s?.dols_in_force || 0,
      dolsAwaiting: s?.dols_awaiting || 0,
      dolsExpired: s?.dols_expired || 0,
      dolsExpiring: s?.dols_expiring || 0,
      restrictionsActive: s?.restrictions_active || 0,
      restrictionsWithoutLawfulBasis: s?.restrictions_no_basis || 0,
      reviewsOverdue: s?.reviews_overdue || 0,
      byRestrictionType: byType.map(t => ({
        type: t.restriction_type,
        label: RESTRICTION_LABELS[t.restriction_type] || t.restriction_type,
        count: t.n,
      })),
      restrictionTypes: Object.entries(RESTRICTION_LABELS).map(([value, label]) => ({ value, label })),
    });
  } catch (err) { next(err); }
}

export async function createProtection(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const residentId = b.residentId || b.resident_id;
    if (!residentId) return res.status(400).json({ error: 'A resident is required' });

    const recordType = b.recordType || b.record_type || 'restriction';
    if (!['dols','restriction','court_order'].includes(recordType)) {
      return res.status(400).json({ error: 'Unknown record type' });
    }

    if (recordType === 'restriction') {
      if (!(b.restrictionType || b.restriction_type)) {
        return res.status(400).json({ error: 'Say what the restriction is' });
      }
      if (!(b.reason || '').trim()) {
        return res.status(400).json({ error: 'A restriction must have a recorded reason' });
      }
    }
    const dolsStatus = b.dolsStatus || b.dols_status || (recordType === 'dols' ? 'not_applied' : null);
    if (dolsStatus && !DOLS_STATUSES.includes(dolsStatus)) {
      return res.status(400).json({ error: 'Unknown DoLS status' });
    }
    const consentBasis = b.consentBasis || b.consent_basis || null;
    if (consentBasis && !CONSENT_BASES.includes(consentBasis)) {
      return res.status(400).json({ error: 'Unknown lawful basis' });
    }

    const { rows: [own] } = await query(
      `SELECT id FROM residents WHERE id = $1 AND care_home_id = $2`, [residentId, chId]);
    if (!own) return res.status(404).json({ error: 'Resident not found' });

    const freq = Number(b.reviewFrequencyDays || b.review_frequency_days) || 90;
    const { rows: [row] } = await query(
      `INSERT INTO liberty_protections
         (care_home_id, resident_id, record_type, dols_status, applied_date, urgent_expiry,
          granted_from, granted_until, supervisory_body, reference_number, conditions,
          representative_name, representative_contact, restriction_type, description, reason,
          less_restrictive_considered, consent_basis, capacity_assessment_id, authorised_by,
          family_consulted, gp_consulted, start_date, end_date, review_frequency_days,
          next_review_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,
               COALESCE($23::date, CURRENT_DATE), $24, $25,
               COALESCE($26::date, COALESCE($23::date, CURRENT_DATE) + $25), $27)
       RETURNING id`,
      [chId, residentId, recordType, dolsStatus,
       b.appliedDate || b.applied_date || null, b.urgentExpiry || b.urgent_expiry || null,
       b.grantedFrom || b.granted_from || null, b.grantedUntil || b.granted_until || null,
       b.supervisoryBody || b.supervisory_body || null,
       b.referenceNumber || b.reference_number || null, b.conditions || null,
       b.representativeName || b.representative_name || null,
       b.representativeContact || b.representative_contact || null,
       b.restrictionType || b.restriction_type || null, b.description || null, b.reason || null,
       b.lessRestrictiveConsidered || b.less_restrictive_considered || null,
       consentBasis, b.capacityAssessmentId || b.capacity_assessment_id || null,
       b.authorisedBy || b.authorised_by || null,
       b.familyConsulted === true, b.gpConsulted === true,
       b.startDate || b.start_date || null, b.endDate || b.end_date || null, freq,
       b.nextReviewDate || b.next_review_date || null, req.user!.id]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: recordType === 'dols' ? 'DOLS_RECORD_CREATED' : 'RESTRICTION_RECORDED',
      entityType: 'liberty_protection', entityId: row.id,
      afterData: { residentId, recordType, restrictionType: b.restrictionType || b.restriction_type },
    });
    res.status(201).json({ id: row.id });
  } catch (err) { next(err); }
}

export async function updateProtection(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const { rows: [existing] } = await query(
      `SELECT * FROM liberty_protections WHERE id = $1 AND care_home_id = $2`, [req.params.id, chId]);
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    const dolsStatus = b.dolsStatus || b.dols_status || null;
    if (dolsStatus && !DOLS_STATUSES.includes(dolsStatus)) {
      return res.status(400).json({ error: 'Unknown DoLS status' });
    }
    const consentBasis = b.consentBasis || b.consent_basis || null;
    if (consentBasis && !CONSENT_BASES.includes(consentBasis)) {
      return res.status(400).json({ error: 'Unknown lawful basis' });
    }
    // Ending a restriction should say why, so the register shows the decision.
    if (b.active === false && !(b.reviewNotes || b.review_notes || '').trim()) {
      return res.status(400).json({ error: 'Record why this is being removed' });
    }

    const reviewing = b.recordReview === true;
    await query(
      `UPDATE liberty_protections SET
         dols_status = COALESCE($1, dols_status),
         applied_date = COALESCE($2, applied_date),
         urgent_expiry = COALESCE($3, urgent_expiry),
         granted_from = COALESCE($4, granted_from),
         granted_until = COALESCE($5, granted_until),
         supervisory_body = COALESCE($6, supervisory_body),
         reference_number = COALESCE($7, reference_number),
         conditions = COALESCE($8, conditions),
         representative_name = COALESCE($9, representative_name),
         representative_contact = COALESCE($10, representative_contact),
         description = COALESCE($11, description),
         reason = COALESCE($12, reason),
         less_restrictive_considered = COALESCE($13, less_restrictive_considered),
         consent_basis = COALESCE($14, consent_basis),
         authorised_by = COALESCE($15, authorised_by),
         family_consulted = COALESCE($16, family_consulted),
         gp_consulted = COALESCE($17, gp_consulted),
         end_date = COALESCE($18, end_date),
         review_notes = COALESCE($19, review_notes),
         last_reviewed_at = CASE WHEN $20 THEN NOW() ELSE last_reviewed_at END,
         next_review_date = COALESCE($21::date,
           CASE WHEN $20 THEN CURRENT_DATE + review_frequency_days ELSE next_review_date END),
         active = COALESCE($22, active),
         updated_at = NOW()
       WHERE id = $23 AND care_home_id = $24`,
      [dolsStatus, b.appliedDate || b.applied_date || null,
       b.urgentExpiry || b.urgent_expiry || null,
       b.grantedFrom || b.granted_from || null, b.grantedUntil || b.granted_until || null,
       b.supervisoryBody || b.supervisory_body || null,
       b.referenceNumber || b.reference_number || null, b.conditions || null,
       b.representativeName || b.representative_name || null,
       b.representativeContact || b.representative_contact || null,
       b.description || null, b.reason || null,
       b.lessRestrictiveConsidered || b.less_restrictive_considered || null,
       consentBasis, b.authorisedBy || b.authorised_by || null,
       b.familyConsulted === undefined ? null : b.familyConsulted === true,
       b.gpConsulted === undefined ? null : b.gpConsulted === true,
       b.endDate || b.end_date || null,
       b.reviewNotes || b.review_notes || null,
       reviewing, b.nextReviewDate || b.next_review_date || null,
       b.active === undefined ? null : b.active === true,
       req.params.id, chId]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'LIBERTY_PROTECTION_UPDATED', entityType: 'liberty_protection', entityId: req.params.id,
      afterData: { dolsStatus, active: b.active, reviewed: reviewing },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
