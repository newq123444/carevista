import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';
import { appendQuietly } from '../services/recordChain';
import { createNotification } from './notifications.controller';
import { homeToday } from '../utils/homeTime';


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
    // Today in the home, not UTC (which is yesterday from midnight to 1am in summer).
    const { date = homeToday(), round } = req.query;

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
      // PRN doses are not tied to a round; list every one given that day.
      prn_doses: med.is_prn
        ? administrations.filter(a => a.medication_id === med.id && a.status === 'given')
            .map(a => ({ id: a.id, time: String(a.actual_time || a.scheduled_time || '').slice(0, 5),
                         reason: a.prn_reason, effect: a.prn_effect, by: a.administered_by_name }))
            .sort((x, y) => x.time.localeCompare(y.time))
        : undefined,
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
      omissionReason, witnessedById, prnReason, prnEffect
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

    // PRN is a property of the prescription, not something the screen decides.
    // NICE SC1: record why an "as required" dose was given, then whether it worked.
    const prn = !!med.is_prn;
    if (prn && status === 'given' && !String(prnReason || '').trim()) {
      throw new AppError(400, 'Say why this "as required" dose is needed');
    }

    // A second PRN dose on the same day must not overwrite the first. If the
    // round slot already holds a given dose, file this one under its own time.
    let slot = scheduledTime;
    if (prn && status === 'given') {
      const { rows: [taken] } = await query(
        `SELECT actual_time FROM med_administrations
          WHERE medication_id = $1 AND administration_date = $2 AND scheduled_time = $3 AND status = 'given'`,
        [medicationId, administrationDate, scheduledTime]);
      if (taken) {
        slot = actualTime || scheduledTime;
        if (String(slot).slice(0, 5) === String(scheduledTime).slice(0, 5)) {
          throw new AppError(409, `A dose of ${med.name} is already recorded at ${String(taken.actual_time || scheduledTime).slice(0, 5)}. Enter the actual time of this dose.`);
        }
        const { rows: [clash] } = await query(
          `SELECT 1 FROM med_administrations WHERE medication_id = $1 AND administration_date = $2 AND scheduled_time = $3`,
          [medicationId, administrationDate, slot]);
        if (clash) throw new AppError(409, `A dose of ${med.name} is already recorded at ${String(slot).slice(0, 5)}.`);
      }
    }

    // Validate: refused/missed must have a reason
    if (status === 'refused' && !refusalReason && !notes) {
      throw new AppError(400, 'Reason required for refused medication');
    }
    if (status === 'omitted' && !omissionReason && !notes) {
      throw new AppError(400, 'Reason required for omitted medication');
    }

    // Upsert (handles re-recording). The medication record and its chain entry
    // are written together — a medication signature that cannot be proved is
    // exactly the record that matters most in an investigation.
    const admin = await withTransaction(async (client) => {
      const { rows: [row] } = await client.query(
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
       administrationDate, slot, actualTime || scheduledTime, status, doseGiven || med.dose,
       notes, refusalReason, omissionReason, prn, prn ? (prnReason || null) : null, prn ? (prnEffect || null) : null]
      );

      // The upsert means a second signature for the same dose amends the first.
      // Recording that as an amendment keeps both versions in the history.
      await appendQuietly(client, {
        careHomeId,
        entityType: 'med_administration',
        entityId: row.id,
        action: 'recorded',
        row,
        recordedBy: req.user!.id,
        eventAt: row.created_at,
      });

      return row;
    });

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

// ── PRN follow-up ─────────────────────────────────────────────────────────
// Doses of "as required" medicines given in the last day with no outcome yet.
// When each is due (an hour after the dose) is worked out on the device, so
// the list is the same on every screen.
export async function listPrnFollowups(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT ma.id, ma.resident_id, ma.medication_id, ma.dose_given, ma.prn_reason, ma.created_at,
              ma.administration_date, ma.actual_time,
              m.name AS medication_name,
              r.first_name || ' ' || r.last_name AS resident_name, r.room_number,
              u.first_name || ' ' || u.last_name AS given_by_name, ma.administered_by
         FROM med_administrations ma
         JOIN medications m ON m.id = ma.medication_id
         JOIN residents r ON r.id = ma.resident_id
         JOIN users u ON u.id = ma.administered_by
        WHERE ma.care_home_id = $1 AND ma.is_prn = TRUE AND ma.status = 'given'
          AND ma.prn_effect IS NULL
          AND ma.created_at > NOW() - INTERVAL '24 hours'
        ORDER BY ma.created_at`,
      [req.user!.care_home_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

const PRN_OUTCOMES: Record<string, string> = {
  effective: 'Effective',
  partly_effective: 'Partly effective',
  not_effective: 'Not effective',
  unable_to_assess: 'Unable to assess',
};

export async function recordPrnEffect(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const outcome = String(req.body?.outcome || '');
    const note = String(req.body?.note || '').trim().slice(0, 500);
    if (!PRN_OUTCOMES[outcome]) throw new AppError(400, 'Choose whether the dose worked');
    if ((outcome === 'not_effective' || outcome === 'unable_to_assess') && note.length < 3) {
      throw new AppError(400, outcome === 'not_effective'
        ? 'Say what you saw, and what you have done about it'
        : 'Say why it could not be assessed');
    }
    const effect = PRN_OUTCOMES[outcome] + (note ? ` — ${note}` : '');

    const row = await withTransaction(async (client) => {
      const { rows: [updated] } = await client.query(
        `UPDATE med_administrations
            SET prn_effect = $1, prn_effect_at = NOW(), prn_effect_by = $2
          WHERE id = $3 AND care_home_id = $4 AND is_prn = TRUE AND status = 'given' AND prn_effect IS NULL
          RETURNING *`,
        [effect, req.user!.id, id, careHomeId]);
      if (!updated) {
        const { rows: [existing] } = await client.query(
          `SELECT prn_effect, is_prn FROM med_administrations WHERE id = $1 AND care_home_id = $2`, [id, careHomeId]);
        if (!existing) throw new AppError(404, 'Dose not found');
        if (!existing.is_prn) throw new AppError(400, 'This was not an "as required" dose');
        throw new AppError(409, `Already recorded: ${existing.prn_effect}`);
      }
      // The effect is a hashed field, so the chain gets the amended record.
      await appendQuietly(client, {
        careHomeId, entityType: 'med_administration', entityId: updated.id,
        action: 'prn_effect_recorded', row: updated, recordedBy: req.user!.id, eventAt: new Date(),
      });
      return updated;
    });

    if (outcome === 'not_effective') {
      const { rows: [ctx] } = await query(
        `SELECT m.name, r.first_name || ' ' || r.last_name AS resident
           FROM medications m JOIN residents r ON r.id = m.resident_id WHERE m.id = $1`, [row.medication_id]);
      await createNotification({
        careHomeId, type: 'prn_not_effective', priority: 'high',
        title: `PRN not effective — ${ctx?.resident || 'resident'}`,
        body: `${ctx?.name || 'An as-required medicine'} given for "${row.prn_reason || 'not stated'}" did not work. ${note} ` +
              'A nurse should review: look for another cause, and contact the GP or 111 if needed.',
        entityType: 'resident', entityId: row.resident_id,
      });
    }

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'PRN_EFFECT_RECORDED', entityType: 'med_administration', entityId: row.id,
      afterData: { outcome }, ip: req.ip,
    });
    res.json(row);
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
