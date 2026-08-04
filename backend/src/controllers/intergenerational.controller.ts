import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Create Programme ──────────────────────────────────────────────────────

export async function createProgramme(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { name, description, partnerOrganisation, ageGroup, frequency, safeguardingRequirements, dbsRequired, riskAssessment } = req.body;

    if (!name || !partnerOrganisation) {
      return res.status(400).json({ error: 'name and partnerOrganisation are required' });
    }

    const { rows: [programme] } = await query(
      `INSERT INTO intergenerational_programmes (care_home_id, name, description, partner_organisation, age_group, frequency, safeguarding_requirements, dbs_required, risk_assessment, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [careHomeId, name, description, partnerOrganisation, ageGroup, frequency, JSON.stringify(safeguardingRequirements || []), dbsRequired !== false, riskAssessment, userId]
    );

    res.status(201).json(programme);
  } catch (err) { next(err); }
}

// ── List Programmes ───────────────────────────────────────────────────────

export async function listProgrammes(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { status } = req.query;

    let where = 'WHERE ip.care_home_id = $1';
    const params: unknown[] = [careHomeId];

    if (status) {
      where += ' AND ip.status = $2';
      params.push(status);
    }

    const { rows } = await query(
      `SELECT ip.*,
         COUNT(DISTINCT iv.id) AS total_visits,
         COUNT(DISTINCT iv.id) FILTER (WHERE iv.status = 'completed') AS completed_visits
       FROM intergenerational_programmes ip
       LEFT JOIN intergenerational_visits iv ON iv.programme_id = ip.id
       ${where}
       GROUP BY ip.id
       ORDER BY ip.created_at DESC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Create Visit ──────────────────────────────────────────────────────────

export async function createVisit(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { programmeId, visitDate, startTime, endTime, visitorCount, activityDescription, notes } = req.body;

    if (!programmeId || !visitDate) {
      return res.status(400).json({ error: 'programmeId and visitDate are required' });
    }

    const { rows: [visit] } = await query(
      `INSERT INTO intergenerational_visits (care_home_id, programme_id, visit_date, start_time, end_time, visitor_count, activity_description, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [careHomeId, programmeId, visitDate, startTime, endTime, visitorCount, activityDescription, notes, userId]
    );

    res.status(201).json(visit);
  } catch (err) { next(err); }
}

// ── List Visits ───────────────────────────────────────────────────────────

export async function listVisits(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { programmeId } = req.query;

    let where = 'WHERE iv.care_home_id = $1';
    const params: unknown[] = [careHomeId];

    if (programmeId) {
      where += ' AND iv.programme_id = $2';
      params.push(programmeId);
    }

    const { rows } = await query(
      `SELECT iv.*, ip.name AS programme_name,
         COUNT(igp.id) AS participant_count
       FROM intergenerational_visits iv
       JOIN intergenerational_programmes ip ON ip.id = iv.programme_id
       LEFT JOIN intergenerational_participants igp ON igp.visit_id = iv.id
       ${where}
       GROUP BY iv.id, ip.name
       ORDER BY iv.visit_date DESC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Add Participant ───────────────────────────────────────────────────────

export async function addParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { visitId, residentId, engagementScore, wellbeingScore, notes } = req.body;

    if (!visitId || !residentId) {
      return res.status(400).json({ error: 'visitId and residentId are required' });
    }

    const { rows: [participant] } = await query(
      `INSERT INTO intergenerational_participants (care_home_id, visit_id, resident_id, engagement_score, wellbeing_score, notes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [careHomeId, visitId, residentId, engagementScore, wellbeingScore, notes]
    );

    res.status(201).json(participant);
  } catch (err) { next(err); }
}

// ── Log Outcome ───────────────────────────────────────────────────────────

export async function logOutcome(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { safeguardingCheckDone, notes, status } = req.body;

    const { rows: [visit] } = await query(
      `UPDATE intergenerational_visits
       SET safeguarding_check_done = COALESCE($1, safeguarding_check_done),
           notes = COALESCE($2, notes),
           status = COALESCE($3, status)
       WHERE id = $4 AND care_home_id = $5
       RETURNING *`,
      [safeguardingCheckDone, notes, status, id, careHomeId]
    );

    if (!visit) throw new AppError(404, 'Visit not found');
    res.json(visit);
  } catch (err) { next(err); }
}

// ── Get Safeguarding Requirements ─────────────────────────────────────────

export async function getSafeguardingRequirements(req: Request, res: Response, next: NextFunction) {
  try {
    const { programmeId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [programme] } = await query(
      `SELECT id, name, safeguarding_requirements, dbs_required, risk_assessment
       FROM intergenerational_programmes
       WHERE id = $1 AND care_home_id = $2`,
      [programmeId, careHomeId]
    );

    if (!programme) throw new AppError(404, 'Programme not found');
    res.json(programme);
  } catch (err) { next(err); }
}

// ── Get Wellbeing Impact ──────────────────────────────────────────────────

export async function getWellbeingImpact(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { programmeId } = req.query;

    let where = 'WHERE igp.care_home_id = $1';
    const params: unknown[] = [careHomeId];

    if (programmeId) {
      where += ' AND iv.programme_id = $2';
      params.push(programmeId);
    }

    const { rows } = await query(
      `SELECT
         r.id AS resident_id,
         r.first_name || ' ' || r.last_name AS resident_name,
         COUNT(*) AS visits_attended,
         AVG(igp.engagement_score) AS avg_engagement,
         AVG(igp.wellbeing_score) AS avg_wellbeing
       FROM intergenerational_participants igp
       JOIN intergenerational_visits iv ON iv.id = igp.visit_id
       JOIN residents r ON r.id = igp.resident_id
       ${where}
       GROUP BY r.id, r.first_name, r.last_name
       ORDER BY avg_wellbeing DESC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}
