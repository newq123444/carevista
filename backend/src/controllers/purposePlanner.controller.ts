import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── List Roles ────────────────────────────────────────────────────────────

export async function listRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT pr.*,
         COUNT(pra.id) FILTER (WHERE pra.status = 'active') AS active_assignments
       FROM purpose_roles pr
       LEFT JOIN purpose_role_assignments pra ON pra.role_id = pr.id
       WHERE pr.care_home_id = $1 AND pr.active = TRUE
       GROUP BY pr.id
       ORDER BY pr.name`,
      [careHomeId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Create Role ───────────────────────────────────────────────────────────

export async function createRole(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { name, description, category, skillsRequired } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const { rows: [role] } = await query(
      `INSERT INTO purpose_roles (care_home_id, name, description, category, skills_required)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [careHomeId, name, description, category, skillsRequired]
    );

    res.status(201).json(role);
  } catch (err) { next(err); }
}

// ── Assign Role ───────────────────────────────────────────────────────────

export async function assignRole(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, roleId, notes } = req.body;

    if (!residentId || !roleId) {
      return res.status(400).json({ error: 'residentId and roleId are required' });
    }

    const { rows: [assignment] } = await query(
      `INSERT INTO purpose_role_assignments (care_home_id, resident_id, role_id, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [careHomeId, residentId, roleId, notes]
    );

    res.status(201).json(assignment);
  } catch (err) { next(err); }
}

// ── Get Resident Roles ────────────────────────────────────────────────────

export async function getResidentRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT pra.*, pr.name AS role_name, pr.description AS role_description, pr.category
       FROM purpose_role_assignments pra
       JOIN purpose_roles pr ON pr.id = pra.role_id
       WHERE pra.resident_id = $1 AND pra.care_home_id = $2
       ORDER BY pra.assigned_at DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Log Engagement ────────────────────────────────────────────────────────

export async function logEngagement(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { assignmentId, residentId, engagementDate, durationMins, satisfaction, notes } = req.body;

    if (!assignmentId || !residentId) {
      return res.status(400).json({ error: 'assignmentId and residentId are required' });
    }

    const { rows: [log] } = await query(
      `INSERT INTO purpose_engagement_logs (care_home_id, assignment_id, resident_id, engagement_date, duration_mins, satisfaction, notes, logged_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [careHomeId, assignmentId, residentId, engagementDate, durationMins, satisfaction, notes, userId]
    );

    res.status(201).json(log);
  } catch (err) { next(err); }
}

// ── Get Engagement Report ─────────────────────────────────────────────────

export async function getEngagementReport(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.query;

    let where = 'WHERE pel.care_home_id = $1';
    const params: unknown[] = [careHomeId];

    if (residentId) {
      where += ' AND pel.resident_id = $2';
      params.push(residentId);
    }

    const { rows } = await query(
      `SELECT
         pel.resident_id,
         r.first_name || ' ' || r.last_name AS resident_name,
         pr.name AS role_name,
         COUNT(*) AS engagement_count,
         AVG(pel.satisfaction) AS avg_satisfaction,
         SUM(pel.duration_mins) AS total_minutes
       FROM purpose_engagement_logs pel
       JOIN residents r ON r.id = pel.resident_id
       JOIN purpose_role_assignments pra ON pra.id = pel.assignment_id
       JOIN purpose_roles pr ON pr.id = pra.role_id
       ${where}
       GROUP BY pel.resident_id, r.first_name, r.last_name, pr.name
       ORDER BY avg_satisfaction DESC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Suggest New Roles ─────────────────────────────────────────────────────

export async function suggestNewRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    // Find roles the resident is NOT currently assigned to that have high satisfaction among peers
    const { rows } = await query(
      `SELECT pr.*, AVG(pel.satisfaction) AS peer_avg_satisfaction
       FROM purpose_roles pr
       JOIN purpose_role_assignments pra ON pra.role_id = pr.id AND pra.status = 'active'
       JOIN purpose_engagement_logs pel ON pel.assignment_id = pra.id
       WHERE pr.care_home_id = $1 AND pr.active = TRUE
         AND pr.id NOT IN (
           SELECT role_id FROM purpose_role_assignments
           WHERE resident_id = $2 AND status = 'active'
         )
       GROUP BY pr.id
       HAVING AVG(pel.satisfaction) >= 3
       ORDER BY peer_avg_satisfaction DESC
       LIMIT 5`,
      [careHomeId, residentId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}
