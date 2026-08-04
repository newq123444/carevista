import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Create Care Plan ──────────────────────────────────────────────────────

export async function createCarePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const {
      residentId, preferredPlaceOfDeath, dnacprInPlace, advanceDecision,
      lastingPowerOfAttorney, spiritualNeeds, preferredPriorities, comfortMeasures
    } = req.body;

    if (!residentId) {
      return res.status(400).json({ error: 'residentId is required' });
    }

    const { rows: [plan] } = await query(
      `INSERT INTO palliative_care_plans
       (care_home_id, resident_id, preferred_place_of_death, dnacpr_in_place, advance_decision,
        lasting_power_of_attorney, spiritual_needs, preferred_priorities, comfort_measures, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10) RETURNING *`,
      [careHomeId, residentId, preferredPlaceOfDeath, dnacprInPlace, advanceDecision,
       lastingPowerOfAttorney, spiritualNeeds, preferredPriorities, comfortMeasures, userId]
    );

    res.status(201).json(plan);
  } catch (err) { next(err); }
}

// ── Get Care Plan ─────────────────────────────────────────────────────────

export async function getCarePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [plan] } = await query(
      `SELECT pcp.*, u.first_name || ' ' || u.last_name AS created_by_name
       FROM palliative_care_plans pcp
       LEFT JOIN users u ON u.id = pcp.created_by
       WHERE pcp.resident_id = $1 AND pcp.care_home_id = $2 AND pcp.status = 'active'
       ORDER BY pcp.created_at DESC LIMIT 1`,
      [residentId, careHomeId]
    );

    if (!plan) throw new AppError(404, 'Palliative care plan not found');
    res.json(plan);
  } catch (err) { next(err); }
}

// ── Update Care Plan ──────────────────────────────────────────────────────

export async function updateCarePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const {
      preferredPlaceOfDeath, dnacprInPlace, advanceDecision,
      lastingPowerOfAttorney, spiritualNeeds, preferredPriorities, comfortMeasures, status
    } = req.body;

    const { rows: [plan] } = await query(
      `UPDATE palliative_care_plans SET
         preferred_place_of_death = COALESCE($1, preferred_place_of_death),
         dnacpr_in_place = COALESCE($2, dnacpr_in_place),
         advance_decision = COALESCE($3, advance_decision),
         lasting_power_of_attorney = COALESCE($4, lasting_power_of_attorney),
         spiritual_needs = COALESCE($5, spiritual_needs),
         preferred_priorities = COALESCE($6, preferred_priorities),
         comfort_measures = COALESCE($7, comfort_measures),
         status = COALESCE($8, status),
         updated_at = NOW()
       WHERE id = $9 AND care_home_id = $10 RETURNING *`,
      [preferredPlaceOfDeath, dnacprInPlace, advanceDecision,
       lastingPowerOfAttorney, spiritualNeeds, preferredPriorities, comfortMeasures, status, id, careHomeId]
    );

    if (!plan) throw new AppError(404, 'Palliative care plan not found');
    res.json(plan);
  } catch (err) { next(err); }
}

// ── Schedule Comfort Round ────────────────────────────────────────────────

export async function scheduleComfortRound(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, scheduledTime } = req.body;

    if (!residentId || !scheduledTime) {
      return res.status(400).json({ error: 'residentId and scheduledTime are required' });
    }

    const { rows: [round] } = await query(
      `INSERT INTO comfort_rounds (care_home_id, resident_id, scheduled_time)
       VALUES ($1, $2, $3) RETURNING *`,
      [careHomeId, residentId, scheduledTime]
    );

    res.status(201).json(round);
  } catch (err) { next(err); }
}

// ── Complete Comfort Round ────────────────────────────────────────────────

export async function completeComfortRound(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { painScore, comfortNotes, repositioned, fluidsOffered, mouthCare } = req.body;

    const { rows: [round] } = await query(
      `UPDATE comfort_rounds SET
         completed_time = NOW(), completed_by = $1,
         pain_score = $2, comfort_notes = $3, repositioned = $4,
         fluids_offered = $5, mouth_care = $6
       WHERE id = $7 AND care_home_id = $8
       RETURNING *`,
      [userId, painScore, comfortNotes, repositioned, fluidsOffered, mouthCare, id, careHomeId]
    );

    if (!round) throw new AppError(404, 'Comfort round not found');
    res.json(round);
  } catch (err) { next(err); }
}

// ── Get Comfort Rounds ────────────────────────────────────────────────────

export async function getComfortRounds(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT cr.*, u.first_name || ' ' || u.last_name AS completed_by_name
       FROM comfort_rounds cr
       LEFT JOIN users u ON u.id = cr.completed_by
       WHERE cr.resident_id = $1 AND cr.care_home_id = $2
       ORDER BY cr.scheduled_time DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Add Anticipatory Med ──────────────────────────────────────────────────

export async function addAnticipatoryMed(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const {
      residentId, medicationName, indication, dose, route,
      locationStored, prescribedBy, prescribedDate, notes
    } = req.body;

    if (!residentId || !medicationName) {
      return res.status(400).json({ error: 'residentId and medicationName are required' });
    }

    const { rows: [med] } = await query(
      `INSERT INTO anticipatory_medications
       (care_home_id, resident_id, medication_name, indication, dose, route, location_stored, prescribed_by, prescribed_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [careHomeId, residentId, medicationName, indication, dose, route, locationStored, prescribedBy, prescribedDate, notes]
    );

    res.status(201).json(med);
  } catch (err) { next(err); }
}

// ── Get Anticipatory Meds ─────────────────────────────────────────────────

export async function getAnticipatoryMeds(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT am.*, u.first_name || ' ' || u.last_name AS administered_by_name
       FROM anticipatory_medications am
       LEFT JOIN users u ON u.id = am.administered_by
       WHERE am.resident_id = $1 AND am.care_home_id = $2
       ORDER BY am.prescribed_date DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Administer Anticipatory Med ───────────────────────────────────────────

export async function administerAnticipatoryMed(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { notes } = req.body;

    const { rows: [med] } = await query(
      `UPDATE anticipatory_medications
       SET administered_at = NOW(), administered_by = $1, notes = COALESCE($2, notes)
       WHERE id = $3 AND care_home_id = $4 AND administered_at IS NULL
       RETURNING *`,
      [userId, notes, id, careHomeId]
    );

    if (!med) throw new AppError(404, 'Medication not found or already administered');
    res.json(med);
  } catch (err) { next(err); }
}

// ── Log Family Communication ──────────────────────────────────────────────

export async function logFamilyCommunication(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const staffId = req.user!.id;
    const {
      residentId, contactName, contactRelationship, communicationType,
      summary, communicationDate, followUpNeeded, followUpNotes
    } = req.body;

    if (!residentId || !contactName || !communicationType) {
      return res.status(400).json({ error: 'residentId, contactName, and communicationType are required' });
    }

    const { rows: [log] } = await query(
      `INSERT INTO family_communication_log
       (care_home_id, resident_id, contact_name, contact_relationship, communication_type,
        summary, staff_id, communication_date, follow_up_needed, follow_up_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [careHomeId, residentId, contactName, contactRelationship, communicationType,
       summary, staffId, communicationDate, followUpNeeded || false, followUpNotes]
    );

    res.status(201).json(log);
  } catch (err) { next(err); }
}

// ── Get Family Communications ─────────────────────────────────────────────

export async function getFamilyCommunications(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT fcl.*, u.first_name || ' ' || u.last_name AS staff_name
       FROM family_communication_log fcl
       JOIN users u ON u.id = fcl.staff_id
       WHERE fcl.resident_id = $1 AND fcl.care_home_id = $2
       ORDER BY fcl.communication_date DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}
