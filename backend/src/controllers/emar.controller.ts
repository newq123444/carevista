import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';


// Routes carers are permitted to administer (delegated tasks)
const CARER_ROUTES = ['topical','cream','ointment','gel','patch','transdermal',
  'eye_drops','ear_drops','nasal','mouth_care','moisturiser'];

// ── List medications for a care home / resident ───────────────────────────
export async function listMedications(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, active = 'true' } = req.query;

    let where = 'WHERE m.care_home_id = $1';
    const params: any[] = [careHomeId];
    let p = 2;
    if (residentId) { where += ` AND m.resident_id = $${p++}`; params.push(residentId); }
    if (active !== 'all') { where += ` AND m.active = $${p++}`; params.push(active === 'true'); }

    const { rows } = await query(
      `SELECT m.*,
        r.first_name || ' ' || r.last_name AS resident_name, r.room_number
       FROM medications m
       JOIN residents r ON r.id = m.resident_id
       ${where}
       ORDER BY r.last_name, r.first_name, m.name`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get eMAR for a date ───────────────────────────────────────────────────
export async function getEmar(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { date = new Date().toISOString().slice(0, 10), round } = req.query;

    const { rows: medications } = await query(
      `SELECT m.*, r.first_name || ' ' || r.last_name AS resident_name, r.room_number
       FROM medications m
       JOIN residents r ON r.id = m.resident_id
       WHERE m.care_home_id = $1 AND m.active = TRUE AND r.active = TRUE
       ORDER BY r.room_number::integer NULLS LAST, m.name`,
      [careHomeId]
    );

    const { rows: administrations } = await query(
      `SELECT ma.*,
        u.first_name || ' ' || u.last_name AS administered_by_name,
        w.first_name || ' ' || w.last_name AS witnessed_by_name
       FROM med_administrations ma
       JOIN users u ON u.id = ma.administered_by
       LEFT JOIN users w ON w.id = ma.witnessed_by
       WHERE ma.care_home_id = $1 AND ma.administration_date = $2`,
      [careHomeId, date]
    );

    // Build indexed map for O(1) lookup
    const adminMap: Record<string, any> = {};
    for (const a of administrations) {
      // Normalise DB TIME type '08:00:00' → '08:00' to match administration_times array
      const timeKey = String(a.scheduled_time || '').slice(0, 5);
      adminMap[`${a.medication_id}:${timeKey}`] = a;
    }

    const emarData = medications.map(med => ({
      ...med,
      rounds: (med.administration_times as string[]).map(rawTime => {
        const time = String(rawTime || '').slice(0, 5); // normalise HH:MM:SS → HH:MM
        return {
          time,
          administration: adminMap[`${med.id}:${time}`] || null,
          status: adminMap[`${med.id}:${time}`]?.status || 'pending',
        };
      }),
    }));

    // Summary stats
    const totalDoses = emarData.reduce((acc, m) => acc + m.rounds.length, 0);
    const given = administrations.filter(a => a.status === 'given').length;
    const missed = administrations.filter(a => a.status === 'missed').length;
    const refused = administrations.filter(a => a.status === 'refused').length;

    res.json({
      date,
      medications: emarData,
      summary: { totalDoses, given, missed, refused, pending: totalDoses - administrations.length },
    });
  } catch (err) { next(err); }
}

// ── Record administration (the core eMAR action) ──────────────────────────
export async function recordAdministration(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const {
      medicationId, residentId, administrationDate, scheduledTime,
      status, actualTime, doseGiven, notes, refusalReason,
      omissionReason, witnessedById, isPrn, prnReason, prnEffect
    } = req.body;

    if (!medicationId || !residentId || !administrationDate || !scheduledTime || !status) {
      return res.status(400).json({ error: 'medicationId, residentId, administrationDate, scheduledTime, and status are required' });
    }

    // Verify medication belongs to this care home and resident
    const { rows: [med] } = await query(
      'SELECT * FROM medications WHERE id = $1 AND care_home_id = $2 AND resident_id = $3',
      [medicationId, careHomeId, residentId]
    );
    if (!med) throw new AppError(404, 'Medication not found');

    // Role-based route restriction: carers can only administer topicals/creams/patches
    const role = req.user!.role;
    const isCarer = role === 'carer' || role === 'activities';
    const isSeniorOrAbove = ['senior_carer','registered_nurse','home_manager','deputy_manager','super_admin','group_admin'].includes(role);
    const routeLower = (med.route || '').toLowerCase();
    const isCarerRoute = CARER_ROUTES.some(r => routeLower.includes(r));

    if (isCarer && !isCarerRoute) {
      throw new AppError(403, `This medication (${med.route}) must be administered by a senior carer or nurse. Please ask a senior member of staff.`);
    }

    // Validate: refused/missed must have a reason
    if (status === 'refused' && !refusalReason && !notes) {
      throw new AppError(400, 'Reason required for refused medication');
    }
    if (status === 'omitted' && !omissionReason && !notes) {
      throw new AppError(400, 'Reason required for omitted medication');
    }

    // Upsert (handles re-recording)
    const { rows: [admin] } = await query(
      `INSERT INTO med_administrations (
        care_home_id, medication_id, resident_id, administered_by, witnessed_by,
        administration_date, scheduled_time, actual_time, status, dose_given,
        notes, refusal_reason, omission_reason, is_prn, prn_reason, prn_effect
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      ON CONFLICT (medication_id, administration_date, scheduled_time)
      DO UPDATE SET
        status = EXCLUDED.status,
        administered_by = EXCLUDED.administered_by,
        witnessed_by = EXCLUDED.witnessed_by,
        actual_time = EXCLUDED.actual_time,
        dose_given = EXCLUDED.dose_given,
        notes = EXCLUDED.notes,
        refusal_reason = EXCLUDED.refusal_reason,
        omission_reason = EXCLUDED.omission_reason
      RETURNING *`,
      [careHomeId, medicationId, residentId, req.user!.id, witnessedById,
       administrationDate, scheduledTime, actualTime || scheduledTime, status, doseGiven || med.dose,
       notes, refusalReason, omissionReason, isPrn || false, prnReason, prnEffect]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'MED_ADMIN_RECORDED',
      entityType: 'med_administration', entityId: admin.id,
      afterData: { medicationId, residentId, status, scheduledTime, administrationDate },
      ip: req.ip,
    });

    res.status(201).json(admin);
  } catch (err) { next(err); }
}

// ── Add new medication prescription ──────────────────────────────────────
export async function createMedication(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const {
      residentId, name, genericName, dose, route, frequency,
      administrationTimes, startDate, endDate, prescribedBy,
      indication, specialInstructions, isPrn, isControlled
    } = req.body;

    if (!residentId || !name || !dose || !route || !frequency || !administrationTimes || !startDate) {
      return res.status(400).json({ error: 'residentId, name, dose, route, frequency, administrationTimes, and startDate are required' });
    }

    const { rows: [med] } = await query(
      `INSERT INTO medications (
        care_home_id, resident_id, name, generic_name, dose, route, frequency,
        administration_times, start_date, end_date, prescribed_by,
        indication, special_instructions, is_prn, is_controlled, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [careHomeId, residentId, name, genericName, dose, route, frequency,
       administrationTimes, startDate, endDate, prescribedBy,
       indication, specialInstructions, isPrn || false, isControlled || false, req.user!.id]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'MEDICATION_ADDED',
      entityType: 'medication', entityId: med.id,
      afterData: { name, residentId, dose }, ip: req.ip,
    });

    res.status(201).json(med);
  } catch (err) { next(err); }
}

// ── Discontinue medication ─────────────────────────────────────────────────
export async function discontinueMedication(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { endDate, reason } = req.body;

    const { rows: [med] } = await query(
      `UPDATE medications SET active = FALSE, end_date = $1,
        special_instructions = COALESCE(special_instructions, '') || $2
       WHERE id = $3 AND care_home_id = $4 RETURNING *`,
      [endDate || new Date(), `\n[DISCONTINUED: ${reason || 'No reason given'}]`, id, careHomeId]
    );
    if (!med) throw new AppError(404, 'Medication not found');

    // Role-based route restriction: carers can only administer topicals/creams/patches
    const role = req.user!.role;
    const isCarer = role === 'carer' || role === 'activities';
    const isSeniorOrAbove = ['senior_carer','registered_nurse','home_manager','deputy_manager','super_admin','group_admin'].includes(role);
    const routeLower = (med.route || '').toLowerCase();
    const isCarerRoute = CARER_ROUTES.some(r => routeLower.includes(r));

    if (isCarer && !isCarerRoute) {
      throw new AppError(403, `This medication (${med.route}) must be administered by a senior carer or nurse. Please ask a senior member of staff.`);
    }

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'MEDICATION_DISCONTINUED', entityType: 'medication', entityId: id,
      afterData: { reason, endDate }, ip: req.ip,
    });

    res.json(med);
  } catch (err) { next(err); }
}

// ── Missed dose report ─────────────────────────────────────────────────────
export async function getMissedDosesReport(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { startDate, endDate } = req.query;

    const { rows } = await query(
      `SELECT ma.*,
        m.name AS medication_name, m.dose,
        r.first_name || ' ' || r.last_name AS resident_name, r.room_number,
        u.first_name || ' ' || u.last_name AS recorded_by
       FROM med_administrations ma
       JOIN medications m ON m.id = ma.medication_id
       JOIN residents r ON r.id = ma.resident_id
       JOIN users u ON u.id = ma.administered_by
       WHERE ma.care_home_id = $1
         AND ma.status IN ('missed', 'refused')
         AND ma.administration_date BETWEEN $2 AND $3
       ORDER BY ma.administration_date DESC, ma.scheduled_time`,
      [careHomeId, startDate, endDate]
    );

    res.json(rows);
  } catch (err) { next(err); }
}
