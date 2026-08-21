import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { auditLog } from '../services/audit.service';

// Healthcare appointments and visiting professionals.
// Care homes co-ordinate GP rounds, district nurses, chiropody, dentists,
// opticians and hospital outpatients. Missing one is a common cause of
// avoidable deterioration, and "did not attend" records are asked for at
// inspection. This had no home in the app at all.

const TYPES = ['gp','district_nurse','hospital_outpatient','dentist','optician','chiropody',
  'physiotherapy','occupational_therapy','speech_language','mental_health','audiology',
  'tissue_viability','dietitian','social_worker','other'];
const LOCATIONS = ['in_home','clinic','hospital','video','telephone'];
const STATUSES = ['scheduled','attended','did_not_attend','cancelled','rescheduled'];

export const APPOINTMENT_TYPE_LABELS: Record<string,string> = {
  gp: 'GP', district_nurse: 'District nurse', hospital_outpatient: 'Hospital outpatient',
  dentist: 'Dentist', optician: 'Optician', chiropody: 'Chiropody / podiatry',
  physiotherapy: 'Physiotherapy', occupational_therapy: 'Occupational therapy',
  speech_language: 'Speech & language therapy', mental_health: 'Mental health',
  audiology: 'Audiology', tissue_viability: 'Tissue viability', dietitian: 'Dietitian',
  social_worker: 'Social worker', other: 'Other',
};

function shape(a: any) {
  return {
    id: a.id,
    residentId: a.resident_id,
    residentName: a.first_name ? `${a.first_name} ${a.last_name}` : null,
    roomNumber: a.room_number,
    appointmentType: a.appointment_type,
    appointmentTypeLabel: APPOINTMENT_TYPE_LABELS[a.appointment_type] || a.appointment_type,
    professionalName: a.professional_name,
    organisation: a.organisation,
    scheduledAt: a.scheduled_at,
    location: a.location,
    reason: a.reason,
    status: a.status,
    escortRequired: a.escort_required,
    escortStaffId: a.escort_staff_id,
    escortStaffName: a.escort_name,
    transportNotes: a.transport_notes,
    outcome: a.outcome,
    actionsRequired: a.actions_required,
    medicationChanged: a.medication_changed,
    followUpDate: a.follow_up_date,
    completedAt: a.completed_at,
    recordedByName: a.recorded_name,
    createdAt: a.created_at,
  };
}

export async function listAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const params: any[] = [chId];
    const where: string[] = ['a.care_home_id = $1'];

    if (req.query.residentId) { params.push(req.query.residentId); where.push(`a.resident_id = $${params.length}`); }
    if (req.query.status)     { params.push(req.query.status);     where.push(`a.status = $${params.length}`); }
    const scope = String(req.query.scope || 'upcoming');
    if (scope === 'upcoming')      where.push(`a.scheduled_at >= NOW() - INTERVAL '1 day' AND a.status = 'scheduled'`);
    else if (scope === 'past')     where.push(`a.scheduled_at < NOW()`);
    else if (scope === 'needs_outcome') where.push(`a.scheduled_at < NOW() AND a.status = 'scheduled'`);

    const { rows } = await query(
      `SELECT a.*, r.first_name, r.last_name, r.room_number,
              e.first_name || ' ' || e.last_name AS escort_name,
              rec.first_name || ' ' || rec.last_name AS recorded_name
       FROM healthcare_appointments a
       JOIN residents r ON r.id = a.resident_id
       LEFT JOIN users e ON e.id = a.escort_staff_id
       LEFT JOIN users rec ON rec.id = a.recorded_by
       WHERE ${where.join(' AND ')}
       ORDER BY a.scheduled_at ${scope === 'upcoming' ? 'ASC' : 'DESC'} LIMIT 300`, params);
    res.json(rows.map(shape));
  } catch (err) { next(err); }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [s] } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_at::date = CURRENT_DATE)::int AS today,
         COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_at::date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)::int AS next_7_days,
         COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_at < NOW() - INTERVAL '1 day')::int AS awaiting_outcome,
         COUNT(*) FILTER (WHERE status = 'did_not_attend' AND scheduled_at > NOW() - INTERVAL '90 days')::int AS dna_90_days,
         COUNT(*) FILTER (WHERE follow_up_date IS NOT NULL AND follow_up_date <= CURRENT_DATE + 14 AND follow_up_date >= CURRENT_DATE)::int AS follow_ups_due
       FROM healthcare_appointments WHERE care_home_id = $1`, [chId]);
    const { rows: types } = await query(
      `SELECT appointment_type, COUNT(*)::int AS n FROM healthcare_appointments
       WHERE care_home_id = $1 AND scheduled_at > NOW() - INTERVAL '180 days'
       GROUP BY appointment_type ORDER BY n DESC`, [chId]);
    res.json({
      today: s?.today || 0,
      next7Days: s?.next_7_days || 0,
      awaitingOutcome: s?.awaiting_outcome || 0,
      dna90Days: s?.dna_90_days || 0,
      followUpsDue: s?.follow_ups_due || 0,
      byType: types.map(t => ({
        type: t.appointment_type,
        label: APPOINTMENT_TYPE_LABELS[t.appointment_type] || t.appointment_type,
        count: t.n,
      })),
      types: TYPES.map(t => ({ value: t, label: APPOINTMENT_TYPE_LABELS[t] || t })),
    });
  } catch (err) { next(err); }
}

export async function createAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const residentId = b.residentId || b.resident_id;
    const scheduledAt = b.scheduledAt || b.scheduled_at;
    if (!residentId)  return res.status(400).json({ error: 'A resident is required' });
    if (!scheduledAt) return res.status(400).json({ error: 'A date and time is required' });

    const type = b.appointmentType || b.appointment_type || 'gp';
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'Unknown appointment type' });
    const location = b.location || 'in_home';
    if (!LOCATIONS.includes(location)) return res.status(400).json({ error: 'Unknown location' });

    const { rows: [own] } = await query(
      `SELECT id FROM residents WHERE id = $1 AND care_home_id = $2`, [residentId, chId]);
    if (!own) return res.status(404).json({ error: 'Resident not found' });

    const { rows: [row] } = await query(
      `INSERT INTO healthcare_appointments
         (care_home_id, resident_id, appointment_type, professional_name, organisation,
          scheduled_at, location, reason, escort_required, escort_staff_id, transport_notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [chId, residentId, type, b.professionalName || b.professional_name || null,
       b.organisation || null, scheduledAt, location, b.reason || null,
       b.escortRequired === true, b.escortStaffId || b.escort_staff_id || null,
       b.transportNotes || b.transport_notes || null, req.user!.id]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'APPOINTMENT_CREATED', entityType: 'appointment', entityId: row.id,
      afterData: { residentId, type, scheduledAt },
    });
    res.status(201).json({ id: row.id });
  } catch (err) { next(err); }
}

export async function updateAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body || {};
    const { rows: [existing] } = await query(
      `SELECT * FROM healthcare_appointments WHERE id = $1 AND care_home_id = $2`,
      [req.params.id, chId]);
    if (!existing) return res.status(404).json({ error: 'Appointment not found' });

    const status = b.status || existing.status;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });
    // Recording an outcome without saying what happened is not a record.
    const outcome = b.outcome !== undefined ? b.outcome : existing.outcome;
    if (status === 'attended' && !(outcome || '').trim()) {
      return res.status(400).json({ error: 'Record what came out of the appointment before marking it attended' });
    }

    const completing = status !== 'scheduled' && existing.status === 'scheduled';
    await query(
      `UPDATE healthcare_appointments SET
         appointment_type = COALESCE($1, appointment_type),
         professional_name = COALESCE($2, professional_name),
         organisation = COALESCE($3, organisation),
         scheduled_at = COALESCE($4, scheduled_at),
         location = COALESCE($5, location),
         reason = COALESCE($6, reason),
         status = $7,
         escort_required = COALESCE($8, escort_required),
         escort_staff_id = COALESCE($9, escort_staff_id),
         transport_notes = COALESCE($10, transport_notes),
         outcome = COALESCE($11, outcome),
         actions_required = COALESCE($12, actions_required),
         medication_changed = COALESCE($13, medication_changed),
         follow_up_date = COALESCE($14, follow_up_date),
         recorded_by = CASE WHEN $15 THEN $16 ELSE recorded_by END,
         completed_at = CASE WHEN $15 THEN NOW() ELSE completed_at END,
         updated_at = NOW()
       WHERE id = $17 AND care_home_id = $18`,
      [b.appointmentType || b.appointment_type || null,
       b.professionalName || b.professional_name || null, b.organisation || null,
       b.scheduledAt || b.scheduled_at || null, b.location || null, b.reason || null,
       status,
       b.escortRequired === undefined ? null : b.escortRequired === true,
       b.escortStaffId || b.escort_staff_id || null,
       b.transportNotes || b.transport_notes || null,
       b.outcome || null, b.actionsRequired || b.actions_required || null,
       b.medicationChanged === undefined ? null : b.medicationChanged === true,
       b.followUpDate || b.follow_up_date || null,
       completing, req.user!.id, req.params.id, chId]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'APPOINTMENT_UPDATED', entityType: 'appointment', entityId: req.params.id,
      afterData: { status },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

export async function deleteAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rowCount } = await query(
      `DELETE FROM healthcare_appointments WHERE id = $1 AND care_home_id = $2 AND status = 'scheduled'`,
      [req.params.id, chId]);
    if (!rowCount) return res.status(404).json({ error: 'Only a scheduled appointment can be deleted. Cancel it instead to keep the record.' });
    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'APPOINTMENT_DELETED', entityType: 'appointment', entityId: req.params.id,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
