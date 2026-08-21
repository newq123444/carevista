import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { auditLog } from '../services/audit.service';

// Staff supervision and appraisal — CQC Regulation 18.
// Providers must ensure staff receive "such appropriate support, training,
// professional development, supervision and appraisal as is necessary".
// In practice inspectors want to see a supervision matrix: who is due, who is
// overdue, and what was discussed. The overdue view below is the whole point.

const TYPES = ['supervision','appraisal','probation_review','return_to_work',
  'competency_review','disciplinary_support'];
const STATUSES = ['scheduled','completed','missed','cancelled'];

export const SESSION_TYPE_LABELS: Record<string,string> = {
  supervision: 'Supervision', appraisal: 'Annual appraisal',
  probation_review: 'Probation review', return_to_work: 'Return to work',
  competency_review: 'Competency review', disciplinary_support: 'Support meeting',
};

function shape(s: any) {
  return {
    id: s.id,
    staffId: s.staff_id,
    staffName: `${s.staff_first} ${s.staff_last}`,
    staffRole: s.staff_role,
    supervisorId: s.supervisor_id,
    supervisorName: s.sup_first ? `${s.sup_first} ${s.sup_last}` : null,
    sessionType: s.session_type,
    sessionTypeLabel: SESSION_TYPE_LABELS[s.session_type] || s.session_type,
    sessionDate: s.session_date,
    status: s.status,
    whatIsGoingWell: s.what_is_going_well,
    areasToDevelop: s.areas_to_develop,
    trainingIdentified: s.training_identified,
    wellbeingCheck: s.wellbeing_check,
    concernsRaised: s.concerns_raised,
    agreedActions: s.agreed_actions,
    staffComments: s.staff_comments,
    staffSigned: s.staff_signed,
    supervisorSigned: s.supervisor_signed,
    nextSessionDue: s.next_session_due,
    createdAt: s.created_at,
  };
}

export async function listSupervisions(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const params: any[] = [chId];
    const where = ['s.care_home_id = $1'];
    if (req.query.staffId) { params.push(req.query.staffId); where.push(`s.staff_id = $${params.length}`); }
    if (req.query.status)  { params.push(req.query.status);  where.push(`s.status = $${params.length}`); }

    const { rows } = await query(
      `SELECT s.*, st.first_name AS staff_first, st.last_name AS staff_last, st.role AS staff_role,
              su.first_name AS sup_first, su.last_name AS sup_last
       FROM staff_supervisions s
       JOIN users st ON st.id = s.staff_id
       LEFT JOIN users su ON su.id = s.supervisor_id
       WHERE ${where.join(' AND ')}
       ORDER BY s.session_date DESC LIMIT 300`, params);
    res.json(rows.map(shape));
  } catch (err) { next(err); }
}

// The matrix: every active member of staff, when they were last supervised,
// and whether that is acceptable. Care homes typically target every 8-12 weeks.
export async function getMatrix(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const targetDays = Number(req.query.targetDays) || 90;

    const { rows } = await query(
      `SELECT u.id, u.first_name, u.last_name, u.role, u.created_at AS started_at,
              last.session_date AS last_session,
              last.session_type AS last_type,
              nxt.next_session_due,
              (SELECT COUNT(*)::int FROM staff_supervisions x
                WHERE x.staff_id = u.id AND x.status = 'completed'
                  AND x.session_date > CURRENT_DATE - 365) AS sessions_12m,
              (SELECT COUNT(*)::int FROM staff_supervisions x
                WHERE x.staff_id = u.id AND x.status = 'completed'
                  AND x.session_type = 'appraisal' AND x.session_date > CURRENT_DATE - 365) AS appraisals_12m
       FROM users u
       LEFT JOIN LATERAL (
         SELECT s.session_date, s.session_type FROM staff_supervisions s
         WHERE s.staff_id = u.id AND s.status = 'completed'
         ORDER BY s.session_date DESC LIMIT 1) last ON TRUE
       LEFT JOIN LATERAL (
         SELECT s.next_session_due FROM staff_supervisions s
         WHERE s.staff_id = u.id AND s.next_session_due IS NOT NULL
         ORDER BY s.next_session_due DESC LIMIT 1) nxt ON TRUE
       WHERE u.care_home_id = $1 AND u.active = TRUE AND u.role <> 'family'
       ORDER BY last.session_date NULLS FIRST, u.last_name`, [chId]);

    const today = new Date(new Date().toISOString().slice(0, 10));
    const staff = rows.map(r => {
      const last = r.last_session ? new Date(r.last_session) : null;
      const daysSince = last ? Math.round((today.getTime() - last.getTime()) / 86400000) : null;
      return {
        staffId: r.id,
        staffName: `${r.first_name} ${r.last_name}`,
        role: r.role,
        lastSession: r.last_session,
        lastType: r.last_type,
        daysSinceLast: daysSince,
        nextSessionDue: r.next_session_due,
        sessions12m: r.sessions_12m,
        appraisals12m: r.appraisals_12m,
        neverSupervised: !last,
        overdue: !last || (daysSince !== null && daysSince > targetDays),
        appraisalOverdue: r.appraisals_12m === 0,
      };
    });

    res.json({
      targetDays,
      staff,
      totalStaff: staff.length,
      overdue: staff.filter(s => s.overdue).length,
      neverSupervised: staff.filter(s => s.neverSupervised).length,
      appraisalOverdue: staff.filter(s => s.appraisalOverdue).length,
      compliancePercent: staff.length
        ? Math.round((staff.filter(s => !s.overdue).length / staff.length) * 100) : null,
      sessionTypes: TYPES.map(t => ({ value: t, label: SESSION_TYPE_LABELS[t] || t })),
    });
  } catch (err) { next(err); }
}

export async function createSupervision(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const staffId = b.staffId || b.staff_id;
    if (!staffId) return res.status(400).json({ error: 'A member of staff is required' });

    const type = b.sessionType || b.session_type || 'supervision';
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'Unknown session type' });
    const status = b.status || 'completed';
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });

    const { rows: [own] } = await query(
      `SELECT id FROM users WHERE id = $1 AND care_home_id = $2`, [staffId, chId]);
    if (!own) return res.status(404).json({ error: 'Staff member not found' });

    // A completed session with nothing written down is not a record.
    if (status === 'completed') {
      const filled = [b.whatIsGoingWell, b.areasToDevelop, b.agreedActions, b.wellbeingCheck]
        .some(v => (v || '').trim());
      if (!filled) {
        return res.status(400).json({ error: 'Record what was discussed before marking the session completed' });
      }
    }

    const { rows: [row] } = await query(
      `INSERT INTO staff_supervisions
         (care_home_id, staff_id, supervisor_id, session_type, session_date, status,
          what_is_going_well, areas_to_develop, training_identified, wellbeing_check,
          concerns_raised, agreed_actions, staff_comments,
          supervisor_signed, supervisor_signed_at, next_session_due, created_by)
       VALUES ($1,$2,$3,$4, COALESCE($5::date, CURRENT_DATE), $6,$7,$8,$9,$10,$11,$12,$13,
               $14, CASE WHEN $14 THEN NOW() ELSE NULL END,
               COALESCE($15::date, CASE WHEN $6 = 'completed'
                                        THEN COALESCE($5::date, CURRENT_DATE) + 90 ELSE NULL END),
               $16)
       RETURNING id`,
      [chId, staffId, b.supervisorId || b.supervisor_id || req.user!.id, type,
       b.sessionDate || b.session_date || null, status,
       b.whatIsGoingWell || b.what_is_going_well || null,
       b.areasToDevelop || b.areas_to_develop || null,
       b.trainingIdentified || b.training_identified || null,
       b.wellbeingCheck || b.wellbeing_check || null,
       b.concernsRaised || b.concerns_raised || null,
       b.agreedActions || b.agreed_actions || null,
       b.staffComments || b.staff_comments || null,
       status === 'completed',
       b.nextSessionDue || b.next_session_due || null, req.user!.id]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'SUPERVISION_RECORDED', entityType: 'supervision', entityId: row.id,
      afterData: { staffId, type, status },
    });
    res.status(201).json({ id: row.id });
  } catch (err) { next(err); }
}

export async function updateSupervision(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const { rows: [existing] } = await query(
      `SELECT * FROM staff_supervisions WHERE id = $1 AND care_home_id = $2`, [req.params.id, chId]);
    if (!existing) return res.status(404).json({ error: 'Session not found' });

    // Staff sign their own record. Nobody signs on their behalf.
    const staffSigning = b.staffSign === true;
    if (staffSigning && existing.staff_id !== req.user!.id) {
      return res.status(403).json({ error: 'Only the member of staff can sign their own supervision record' });
    }
    const status = b.status || existing.status;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });

    await query(
      `UPDATE staff_supervisions SET
         session_type = COALESCE($1, session_type),
         session_date = COALESCE($2, session_date),
         status = $3,
         what_is_going_well = COALESCE($4, what_is_going_well),
         areas_to_develop = COALESCE($5, areas_to_develop),
         training_identified = COALESCE($6, training_identified),
         wellbeing_check = COALESCE($7, wellbeing_check),
         concerns_raised = COALESCE($8, concerns_raised),
         agreed_actions = COALESCE($9, agreed_actions),
         staff_comments = COALESCE($10, staff_comments),
         staff_signed = CASE WHEN $11 THEN TRUE ELSE staff_signed END,
         staff_signed_at = CASE WHEN $11 THEN NOW() ELSE staff_signed_at END,
         supervisor_signed = CASE WHEN $12 THEN TRUE ELSE supervisor_signed END,
         supervisor_signed_at = CASE WHEN $12 THEN NOW() ELSE supervisor_signed_at END,
         next_session_due = COALESCE($13, next_session_due),
         updated_at = NOW()
       WHERE id = $14 AND care_home_id = $15`,
      [b.sessionType || b.session_type || null, b.sessionDate || b.session_date || null, status,
       b.whatIsGoingWell || b.what_is_going_well || null,
       b.areasToDevelop || b.areas_to_develop || null,
       b.trainingIdentified || b.training_identified || null,
       b.wellbeingCheck || b.wellbeing_check || null,
       b.concernsRaised || b.concerns_raised || null,
       b.agreedActions || b.agreed_actions || null,
       b.staffComments || b.staff_comments || null,
       staffSigning, b.supervisorSign === true,
       b.nextSessionDue || b.next_session_due || null,
       req.params.id, chId]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'SUPERVISION_UPDATED', entityType: 'supervision', entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// A member of staff can always see their own record.
export async function mySupervisions(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT s.*, st.first_name AS staff_first, st.last_name AS staff_last, st.role AS staff_role,
              su.first_name AS sup_first, su.last_name AS sup_last
       FROM staff_supervisions s
       JOIN users st ON st.id = s.staff_id
       LEFT JOIN users su ON su.id = s.supervisor_id
       WHERE s.staff_id = $1 AND s.care_home_id = $2
       ORDER BY s.session_date DESC LIMIT 50`, [req.user!.id, req.user!.care_home_id]);
    res.json(rows.map(shape));
  } catch (err) { next(err); }
}
