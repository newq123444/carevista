import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { auditLog } from '../services/audit.service';

// Complaints, concerns and compliments — CQC Regulation 16.
// A registered provider must have an accessible system for handling
// complaints, must investigate them, and must be able to show what changed as
// a result. Compliments belong in the same register: inspectors ask for both,
// and a home that only records failures learns nothing about what works.
//
// Statutory-ish timings baked in: acknowledge within 3 working days, respond
// within 28 calendar days. Those dates drive the overdue flags below.

const TYPES = ['complaint','concern','compliment','suggestion'];
const CATEGORIES = ['care_quality','staff_conduct','communication','food','environment',
  'laundry','medication','activities','billing','discrimination','safeguarding','other'];
const STATUSES = ['open','investigating','responded','closed','escalated'];
const VIA = ['verbal','email','letter','phone','survey','portal','in_person','anonymous'];

export const FEEDBACK_CATEGORY_LABELS: Record<string,string> = {
  care_quality: 'Quality of care', staff_conduct: 'Staff conduct',
  communication: 'Communication', food: 'Food & mealtimes', environment: 'Environment',
  laundry: 'Laundry & belongings', medication: 'Medication', activities: 'Activities',
  billing: 'Billing & fees', discrimination: 'Discrimination', safeguarding: 'Safeguarding',
  other: 'Other',
};

function shape(f: any) {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const due = f.response_due ? new Date(f.response_due) : null;
  const open = !['closed'].includes(f.status);
  return {
    id: f.id,
    reference: f.reference,
    feedbackType: f.feedback_type,
    receivedDate: f.received_date,
    receivedVia: f.received_via,
    raisedByName: f.anonymous ? 'Anonymous' : f.raised_by_name,
    raisedByRelationship: f.raised_by_relationship,
    raisedByContact: f.anonymous ? null : f.raised_by_contact,
    anonymous: f.anonymous,
    residentId: f.resident_id,
    residentName: f.first_name ? `${f.first_name} ${f.last_name}` : null,
    category: f.category,
    categoryLabel: FEEDBACK_CATEGORY_LABELS[f.category] || f.category,
    summary: f.summary,
    detail: f.detail,
    severity: f.severity,
    status: f.status,
    acknowledgedAt: f.acknowledged_at,
    acknowledgedByName: f.ack_name,
    investigatedByName: f.inv_name,
    investigationNotes: f.investigation_notes,
    responseDue: f.response_due,
    respondedAt: f.responded_at,
    responseSummary: f.response_summary,
    outcome: f.outcome,
    actionsTaken: f.actions_taken,
    lessonsLearned: f.lessons_learned,
    sharedWithTeam: f.shared_with_team,
    escalatedTo: f.escalated_to,
    cqcNotified: f.cqc_notified,
    safeguardingRaised: f.safeguarding_raised,
    linkedIncidentId: f.linked_incident_id,
    closedAt: f.closed_at,
    createdAt: f.created_at,
    // Derived: the two things a manager is actually judged on.
    acknowledgementOverdue: open && !f.acknowledged_at && f.feedback_type !== 'compliment' &&
      (today.getTime() - new Date(f.received_date).getTime()) / 86400000 > 3,
    responseOverdue: open && !f.responded_at && !!due && due < today,
    daysOpen: Math.max(0, Math.round((today.getTime() - new Date(f.received_date).getTime()) / 86400000)),
  };
}

export async function listFeedback(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const params: any[] = [chId];
    const where = ['f.care_home_id = $1'];
    if (req.query.type)   { params.push(req.query.type);   where.push(`f.feedback_type = $${params.length}`); }
    if (req.query.status) { params.push(req.query.status); where.push(`f.status = $${params.length}`); }
    if (String(req.query.openOnly) === 'true') where.push(`f.status <> 'closed'`);

    const { rows } = await query(
      `SELECT f.*, r.first_name, r.last_name,
              a.first_name || ' ' || a.last_name AS ack_name,
              i.first_name || ' ' || i.last_name AS inv_name
       FROM feedback_records f
       LEFT JOIN residents r ON r.id = f.resident_id
       LEFT JOIN users a ON a.id = f.acknowledged_by
       LEFT JOIN users i ON i.id = f.investigated_by
       WHERE ${where.join(' AND ')}
       ORDER BY (f.status <> 'closed') DESC, f.received_date DESC LIMIT 300`, params);
    res.json(rows.map(shape));
  } catch (err) { next(err); }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [s] } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE feedback_type = 'complaint' AND status <> 'closed')::int AS open_complaints,
         COUNT(*) FILTER (WHERE feedback_type = 'complaint' AND received_date > CURRENT_DATE - 365)::int AS complaints_12m,
         COUNT(*) FILTER (WHERE feedback_type = 'compliment' AND received_date > CURRENT_DATE - 365)::int AS compliments_12m,
         COUNT(*) FILTER (WHERE status <> 'closed' AND acknowledged_at IS NULL
                          AND feedback_type <> 'compliment'
                          AND received_date < CURRENT_DATE - 3)::int AS ack_overdue,
         COUNT(*) FILTER (WHERE status <> 'closed' AND responded_at IS NULL
                          AND response_due IS NOT NULL AND response_due < CURRENT_DATE)::int AS response_overdue,
         COUNT(*) FILTER (WHERE safeguarding_raised = TRUE AND received_date > CURRENT_DATE - 365)::int AS safeguarding_12m,
         ROUND(AVG(EXTRACT(EPOCH FROM (responded_at - received_date::timestamptz)) / 86400)
               FILTER (WHERE responded_at IS NOT NULL AND received_date > CURRENT_DATE - 365))::int AS avg_response_days
       FROM feedback_records WHERE care_home_id = $1`, [chId]);

    const { rows: byCat } = await query(
      `SELECT category, COUNT(*)::int AS n FROM feedback_records
       WHERE care_home_id = $1 AND feedback_type IN ('complaint','concern')
         AND received_date > CURRENT_DATE - 365 AND category IS NOT NULL
       GROUP BY category ORDER BY n DESC`, [chId]);

    res.json({
      openComplaints: s?.open_complaints || 0,
      complaints12m: s?.complaints_12m || 0,
      compliments12m: s?.compliments_12m || 0,
      acknowledgementOverdue: s?.ack_overdue || 0,
      responseOverdue: s?.response_overdue || 0,
      safeguarding12m: s?.safeguarding_12m || 0,
      avgResponseDays: s?.avg_response_days ?? null,
      themes: byCat.map(c => ({
        category: c.category,
        label: FEEDBACK_CATEGORY_LABELS[c.category] || c.category,
        count: c.n,
      })),
      categories: CATEGORIES.map(c => ({ value: c, label: FEEDBACK_CATEGORY_LABELS[c] || c })),
    });
  } catch (err) { next(err); }
}

export async function createFeedback(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const summary = (b.summary || '').trim();
    if (!summary) return res.status(400).json({ error: 'A short summary is required' });

    const type = b.feedbackType || b.feedback_type || 'complaint';
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'Unknown feedback type' });
    const via = b.receivedVia || b.received_via || 'verbal';
    if (!VIA.includes(via)) return res.status(400).json({ error: 'Unknown source' });
    const category = b.category || null;
    if (category && !CATEGORIES.includes(category)) return res.status(400).json({ error: 'Unknown category' });

    const received = b.receivedDate || b.received_date || null;
    // 28 calendar days to respond; compliments have no deadline.
    const responseDue = type === 'compliment' ? null : (b.responseDue || b.response_due || null);

    const { rows: [seq] } = await query(
      `SELECT COUNT(*)::int + 1 AS n FROM feedback_records
       WHERE care_home_id = $1 AND EXTRACT(YEAR FROM received_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [chId]);
    const reference = `${type === 'compliment' ? 'CMP' : 'CPL'}-${new Date().getFullYear()}-${String(seq?.n || 1).padStart(3, '0')}`;

    const { rows: [row] } = await query(
      `INSERT INTO feedback_records
         (care_home_id, reference, feedback_type, received_date, received_via,
          raised_by_name, raised_by_relationship, raised_by_contact, anonymous,
          resident_id, category, summary, detail, severity,
          response_due, safeguarding_raised, linked_incident_id, created_by)
       VALUES ($1,$2,$3, COALESCE($4::date, CURRENT_DATE), $5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
               COALESCE($15::date, CASE WHEN $3 = 'compliment' THEN NULL
                                        ELSE COALESCE($4::date, CURRENT_DATE) + 28 END),
               $16,$17,$18)
       RETURNING id, reference, response_due`,
      [chId, reference, type, received, via,
       b.raisedByName || b.raised_by_name || null,
       b.raisedByRelationship || b.raised_by_relationship || null,
       b.raisedByContact || b.raised_by_contact || null,
       b.anonymous === true,
       b.residentId || b.resident_id || null, category, summary,
       b.detail || null, b.severity || 'low', responseDue,
       b.safeguardingRaised === true,
       b.linkedIncidentId || b.linked_incident_id || null, req.user!.id]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'FEEDBACK_LOGGED', entityType: 'feedback', entityId: row.id,
      afterData: { reference: row.reference, type, category },
    });
    res.status(201).json({ id: row.id, reference: row.reference, responseDue: row.response_due });
  } catch (err) { next(err); }
}

export async function updateFeedback(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const { rows: [existing] } = await query(
      `SELECT * FROM feedback_records WHERE id = $1 AND care_home_id = $2`, [req.params.id, chId]);
    if (!existing) return res.status(404).json({ error: 'Record not found' });

    const status = b.status || existing.status;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });

    // Closing without recording what was done is how homes fail Reg 16.
    if (status === 'closed' && existing.feedback_type !== 'compliment') {
      const actions = b.actionsTaken ?? b.actions_taken ?? existing.actions_taken;
      const outcome = b.outcome ?? existing.outcome;
      if (!outcome) return res.status(400).json({ error: 'Record the outcome (upheld / partially upheld / not upheld) before closing' });
      if (!(actions || '').trim()) return res.status(400).json({ error: 'Record what action was taken before closing' });
    }

    const ack = b.acknowledge === true && !existing.acknowledged_at;
    const responded = b.markResponded === true && !existing.responded_at;

    await query(
      `UPDATE feedback_records SET
         category = COALESCE($1, category),
         severity = COALESCE($2, severity),
         status = $3,
         acknowledged_at = CASE WHEN $4 THEN NOW() ELSE acknowledged_at END,
         acknowledged_by = CASE WHEN $4 THEN $5 ELSE acknowledged_by END,
         investigated_by = COALESCE($6, investigated_by),
         investigation_notes = COALESCE($7, investigation_notes),
         responded_at = CASE WHEN $8 THEN NOW() ELSE responded_at END,
         response_summary = COALESCE($9, response_summary),
         outcome = COALESCE($10, outcome),
         actions_taken = COALESCE($11, actions_taken),
         lessons_learned = COALESCE($12, lessons_learned),
         shared_with_team = COALESCE($13, shared_with_team),
         escalated_to = COALESCE($14, escalated_to),
         cqc_notified = COALESCE($15, cqc_notified),
         safeguarding_raised = COALESCE($16, safeguarding_raised),
         closed_at = CASE WHEN $3 = 'closed' AND closed_at IS NULL THEN NOW() ELSE closed_at END,
         updated_at = NOW()
       WHERE id = $17 AND care_home_id = $18`,
      [b.category || null, b.severity || null, status,
       ack, req.user!.id,
       b.investigatedById || b.investigated_by || (b.claimInvestigation === true ? req.user!.id : null),
       b.investigationNotes || b.investigation_notes || null,
       responded, b.responseSummary || b.response_summary || null,
       b.outcome || null, b.actionsTaken || b.actions_taken || null,
       b.lessonsLearned || b.lessons_learned || null,
       b.sharedWithTeam === undefined ? null : b.sharedWithTeam === true,
       b.escalatedTo || b.escalated_to || null,
       b.cqcNotified === undefined ? null : b.cqcNotified === true,
       b.safeguardingRaised === undefined ? null : b.safeguardingRaised === true,
       req.params.id, chId]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'FEEDBACK_UPDATED', entityType: 'feedback', entityId: req.params.id,
      afterData: { status },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
