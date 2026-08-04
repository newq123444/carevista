// ============================================================
// src/controllers/activities.controller.ts
// Activities scheduling with mobility-based filtering
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// Mobility hierarchy: higher number = more mobile
const MOBILITY_LEVELS: Record<string, number> = {
  bed_bound: 0,
  wheelchair: 1,
  walking_aid: 2,
  independent: 3,
};

// Checks if a resident's mobility meets the activity requirement
function mobilityMeetsRequirement(residentMobility: string, requiredLevel: string): boolean {
  if (requiredLevel === 'any') return true;
  const resLevel = MOBILITY_LEVELS[residentMobility] ?? 0;
  switch (requiredLevel) {
    case 'independent_only':
      return resLevel >= 3; // only independent
    case 'walking_aid_or_better':
      return resLevel >= 2; // independent + walking_aid
    case 'wheelchair_or_better':
      return resLevel >= 1; // independent + walking_aid + wheelchair
    default:
      return true;
  }
}

function getMobilityDescription(requiredLevel: string): string {
  switch (requiredLevel) {
    case 'independent_only': return 'independently mobile residents only';
    case 'walking_aid_or_better': return 'residents who can walk (with or without aids)';
    case 'wheelchair_or_better': return 'residents who are not bed-bound';
    case 'any': return 'all residents regardless of mobility';
    default: return 'unknown mobility requirement';
  }
}

// ── List Activities ──────────────────────────────────────────────────────
export async function listActivities(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { category, mobility_level } = req.query;
    let sql = `SELECT * FROM activities WHERE care_home_id = $1`;
    const params: any[] = [careHomeId];
    if (category) {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }
    if (mobility_level) {
      params.push(mobility_level);
      sql += ` AND required_mobility_level = $${params.length}`;
    }
    sql += ` ORDER BY name ASC`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Activity ─────────────────────────────────────────────────────────
export async function getActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { rows: [activity] } = await query(
      `SELECT * FROM activities WHERE id = $1 AND care_home_id = $2`,
      [id, careHomeId]
    );
    if (!activity) return next(new AppError(404, 'Activity not found'));
    res.json(activity);
  } catch (err) { next(err); }
}

// ── Create Activity ──────────────────────────────────────────────────────
export async function createActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { name, description, activity_type, required_mobility_level, duration_minutes,
            max_participants, location, facilitator, recurring, recurrence_pattern,
            category, sensory_friendly, cognitive_level, notes } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const { rows: [activity] } = await query(
      `INSERT INTO activities (
        care_home_id, name, description, activity_type, required_mobility_level,
        duration_minutes, max_participants, location, facilitator, recurring,
        recurrence_pattern, category, sensory_friendly, cognitive_level, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [careHomeId, name, description, activity_type || 'social',
       required_mobility_level || 'any', duration_minutes || 60,
       max_participants || 12, location, facilitator, recurring || false,
       recurrence_pattern, category || 'social', sensory_friendly || false,
       cognitive_level || 'any', notes]
    );
    res.status(201).json(activity);
  } catch (err) { next(err); }
}

// ── Update Activity ──────────────────────────────────────────────────────
export async function updateActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { name, description, activity_type, required_mobility_level, duration_minutes,
            max_participants, location, facilitator, recurring, recurrence_pattern,
            category, sensory_friendly, cognitive_level, notes } = req.body;
    const { rows: [activity] } = await query(
      `UPDATE activities SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        activity_type = COALESCE($3, activity_type),
        required_mobility_level = COALESCE($4, required_mobility_level),
        duration_minutes = COALESCE($5, duration_minutes),
        max_participants = COALESCE($6, max_participants),
        location = COALESCE($7, location),
        facilitator = COALESCE($8, facilitator),
        recurring = COALESCE($9, recurring),
        recurrence_pattern = COALESCE($10, recurrence_pattern),
        category = COALESCE($11, category),
        sensory_friendly = COALESCE($12, sensory_friendly),
        cognitive_level = COALESCE($13, cognitive_level),
        notes = COALESCE($14, notes),
        updated_at = NOW()
      WHERE id = $15 AND care_home_id = $16 RETURNING *`,
      [name, description, activity_type, required_mobility_level, duration_minutes,
       max_participants, location, facilitator, recurring, recurrence_pattern,
       category, sensory_friendly, cognitive_level, notes, id, careHomeId]
    );
    if (!activity) return next(new AppError(404, 'Activity not found'));
    res.json(activity);
  } catch (err) { next(err); }
}

// ── Delete Activity ──────────────────────────────────────────────────────
export async function deleteActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { rowCount } = await query(
      `DELETE FROM activities WHERE id = $1 AND care_home_id = $2`,
      [id, careHomeId]
    );
    if (rowCount === 0) return next(new AppError(404, 'Activity not found'));
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ── List Sessions ────────────────────────────────────────────────────────
export async function listSessions(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { start_date, end_date, activity_id } = req.query;
    let sql = `SELECT s.*, a.name AS activity_name, a.category, a.required_mobility_level,
                      a.location, a.duration_minutes, a.sensory_friendly,
                      u.first_name || ' ' || u.last_name AS facilitator_name,
                      (SELECT COUNT(*) FROM activity_participants p WHERE p.session_id = s.id) AS participant_count
               FROM activity_sessions s
               JOIN activities a ON a.id = s.activity_id
               LEFT JOIN users u ON u.id = s.facilitator_id
               WHERE s.care_home_id = $1`;
    const params: any[] = [careHomeId];
    if (start_date) {
      params.push(start_date);
      sql += ` AND s.session_date >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      sql += ` AND s.session_date <= $${params.length}`;
    }
    if (activity_id) {
      params.push(activity_id);
      sql += ` AND s.activity_id = $${params.length}`;
    }
    sql += ` ORDER BY s.session_date ASC, s.start_time ASC`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Create Session ───────────────────────────────────────────────────────
export async function createSession(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { activity_id, session_date, start_time, end_time, facilitator_id, notes } = req.body;

    if (!activity_id || !session_date || !start_time) {
      return res.status(400).json({ error: 'activity_id, session_date, and start_time are required' });
    }

    // Verify activity exists
    const { rows: [activity] } = await query(
      `SELECT id FROM activities WHERE id = $1 AND care_home_id = $2`,
      [activity_id, careHomeId]
    );
    if (!activity) return next(new AppError(404, 'Activity not found'));
    const { rows: [session] } = await query(
      `INSERT INTO activity_sessions (care_home_id, activity_id, session_date, start_time, end_time, facilitator_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [careHomeId, activity_id, session_date, start_time, end_time, facilitator_id || null, notes]
    );
    res.status(201).json(session);
  } catch (err) { next(err); }
}

// ── Get Session Participants ─────────────────────────────────────────────
export async function getSessionParticipants(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { rows } = await query(
      `SELECT p.*, r.first_name, r.last_name, r.room_number, r.mobility_status, r.photo_url
       FROM activity_participants p
       JOIN residents r ON r.id = p.resident_id
       JOIN activity_sessions s ON s.id = p.session_id
       WHERE p.session_id = $1 AND s.care_home_id = $2
       ORDER BY r.last_name, r.first_name`,
      [id, careHomeId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Add Participant (with mobility check) ────────────────────────────────
export async function addParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id: sessionId } = req.params;
    const { resident_id } = req.body;

    if (!resident_id) {
      return res.status(400).json({ error: 'resident_id is required' });
    }

    // Get session with activity details
    const { rows: [session] } = await query(
      `SELECT s.*, a.required_mobility_level, a.name AS activity_name, a.max_participants
       FROM activity_sessions s
       JOIN activities a ON a.id = s.activity_id
       WHERE s.id = $1 AND s.care_home_id = $2`,
      [sessionId, careHomeId]
    );
    if (!session) return next(new AppError(404, 'Session not found'));

    // Get resident
    const { rows: [resident] } = await query(
      `SELECT id, first_name, last_name, mobility_status FROM residents WHERE id = $1 AND care_home_id = $2`,
      [resident_id, careHomeId]
    );
    if (!resident) return next(new AppError(404, 'Resident not found'));

    // Mobility check
    if (!mobilityMeetsRequirement(resident.mobility_status, session.required_mobility_level)) {
      return res.status(400).json({
        error: 'Mobility restriction',
        message: `${resident.first_name} ${resident.last_name} cannot participate in "${session.activity_name}". ` +
                 `This activity requires ${getMobilityDescription(session.required_mobility_level)}, ` +
                 `but ${resident.first_name} has mobility status: ${resident.mobility_status.replace('_', ' ')}.`,
        resident_mobility: resident.mobility_status,
        required_level: session.required_mobility_level,
      });
    }

    // Check max participants
    const { rows: [{ count }] } = await query(
      `SELECT COUNT(*) FROM activity_participants WHERE session_id = $1`,
      [sessionId]
    );
    if (session.max_participants && parseInt(count) >= session.max_participants) {
      return res.status(400).json({
        error: 'Session full',
        message: `This session has reached its maximum of ${session.max_participants} participants.`
      });
    }

    // Add participant
    const { rows: [participant] } = await query(
      `INSERT INTO activity_participants (session_id, resident_id)
       VALUES ($1, $2)
       ON CONFLICT (session_id, resident_id) DO NOTHING
       RETURNING *`,
      [sessionId, resident_id]
    );
    if (!participant) {
      return res.status(409).json({ error: 'Already registered', message: 'This resident is already registered for this session.' });
    }
    res.status(201).json(participant);
  } catch (err) { next(err); }
}

// ── Update Participant ───────────────────────────────────────────────────
export async function updateParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { sessionId, residentId } = req.params;
    const { attendance, engagement_level, mood_before, mood_after, notes } = req.body;

    const { rows: [participant] } = await query(
      `UPDATE activity_participants SET
        attendance = COALESCE($1, attendance),
        engagement_level = COALESCE($2, engagement_level),
        mood_before = COALESCE($3, mood_before),
        mood_after = COALESCE($4, mood_after),
        notes = COALESCE($5, notes)
       FROM activity_sessions s
       WHERE activity_participants.session_id = $6
         AND activity_participants.resident_id = $7
         AND s.id = activity_participants.session_id
         AND s.care_home_id = $8
       RETURNING activity_participants.*`,
      [attendance, engagement_level, mood_before, mood_after, notes, sessionId, residentId, careHomeId]
    );
    if (!participant) return next(new AppError(404, 'Participant not found'));
    res.json(participant);
  } catch (err) { next(err); }
}

// ── Remove Participant ───────────────────────────────────────────────────
export async function removeParticipant(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { sessionId, residentId } = req.params;
    const { rowCount } = await query(
      `DELETE FROM activity_participants
       WHERE session_id = $1 AND resident_id = $2
         AND session_id IN (SELECT id FROM activity_sessions WHERE care_home_id = $3)`,
      [sessionId, residentId, careHomeId]
    );
    if (rowCount === 0) return next(new AppError(404, 'Participant not found'));
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ── Get Eligible Residents ───────────────────────────────────────────────
export async function getEligibleResidents(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id: activityId } = req.params;

    // Get activity's mobility requirement
    const { rows: [activity] } = await query(
      `SELECT required_mobility_level FROM activities WHERE id = $1 AND care_home_id = $2`,
      [activityId, careHomeId]
    );
    if (!activity) return next(new AppError(404, 'Activity not found'));

    // Build mobility filter using parameterized array
    let allowedStatuses: string[];
    switch (activity.required_mobility_level) {
      case 'independent_only':
        allowedStatuses = ['independent'];
        break;
      case 'walking_aid_or_better':
        allowedStatuses = ['independent', 'walking_aid'];
        break;
      case 'wheelchair_or_better':
        allowedStatuses = ['independent', 'walking_aid', 'wheelchair'];
        break;
      default: // 'any'
        allowedStatuses = ['independent', 'walking_aid', 'wheelchair', 'bed_bound'];
        break;
    }

    const { rows } = await query(
      `SELECT id, first_name, last_name, room_number, mobility_status, interests, wellbeing_score, photo_url
       FROM residents
       WHERE care_home_id = $1 AND active = TRUE AND mobility_status = ANY($2)
       ORDER BY last_name, first_name`,
      [careHomeId, allowedStatuses]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Resident Activity History ────────────────────────────────────────
export async function getResidentActivityHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id: residentId } = req.params;
    const { rows } = await query(
      `SELECT p.*, s.session_date, s.start_time, s.end_time, s.status AS session_status,
              a.name AS activity_name, a.category, a.activity_type
       FROM activity_participants p
       JOIN activity_sessions s ON s.id = p.session_id
       JOIN activities a ON a.id = s.activity_id
       WHERE p.resident_id = $1 AND s.care_home_id = $2
       ORDER BY s.session_date DESC, s.start_time DESC
       LIMIT 100`,
      [residentId, careHomeId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Wellbeing Dashboard ──────────────────────────────────────────────────
export async function getWellbeingDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Overall participation stats
    const { rows: [stats] } = await query(
      `SELECT
        COUNT(DISTINCT p.resident_id) AS unique_participants,
        COUNT(p.id) AS total_participations,
        COUNT(CASE WHEN p.attendance = 'attended' THEN 1 END) AS total_attended,
        COUNT(CASE WHEN p.engagement_level = 'high' THEN 1 END) AS high_engagement,
        COUNT(CASE WHEN p.engagement_level = 'medium' THEN 1 END) AS medium_engagement,
        COUNT(CASE WHEN p.engagement_level = 'low' THEN 1 END) AS low_engagement,
        ROUND(AVG(CASE WHEN p.attendance = 'attended' THEN 1.0 ELSE 0.0 END) * 100, 1) AS attendance_rate
       FROM activity_participants p
       JOIN activity_sessions s ON s.id = p.session_id
       WHERE s.care_home_id = $1 AND s.session_date >= CURRENT_DATE - INTERVAL '30 days'`,
      [careHomeId]
    );

    // Most popular activities
    const { rows: popular } = await query(
      `SELECT a.name, a.category, COUNT(p.id) AS participant_count
       FROM activities a
       JOIN activity_sessions s ON s.activity_id = a.id
       JOIN activity_participants p ON p.session_id = s.id
       WHERE a.care_home_id = $1 AND s.session_date >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY a.id, a.name, a.category
       ORDER BY participant_count DESC
       LIMIT 5`,
      [careHomeId]
    );

    // Residents who haven't participated in 3+ days
    const { rows: inactive } = await query(
      `SELECT r.id, r.first_name, r.last_name, r.room_number, r.mobility_status,
              MAX(s.session_date) AS last_activity_date
       FROM residents r
       LEFT JOIN activity_participants p ON p.resident_id = r.id AND p.attendance = 'attended'
       LEFT JOIN activity_sessions s ON s.id = p.session_id
       WHERE r.care_home_id = $1 AND r.active = TRUE
       GROUP BY r.id, r.first_name, r.last_name, r.room_number, r.mobility_status
       HAVING MAX(s.session_date) < CURRENT_DATE - INTERVAL '3 days' OR MAX(s.session_date) IS NULL
       ORDER BY MAX(s.session_date) ASC NULLS FIRST`,
      [careHomeId]
    );

    // Sessions this week
    const { rows: [weekStats] } = await query(
      `SELECT
        COUNT(*) AS sessions_this_week,
        COUNT(CASE WHEN s.status = 'completed' THEN 1 END) AS completed,
        COUNT(CASE WHEN s.status = 'scheduled' THEN 1 END) AS upcoming
       FROM activity_sessions s
       WHERE s.care_home_id = $1
         AND s.session_date >= CURRENT_DATE - INTERVAL '7 days'
         AND s.session_date <= CURRENT_DATE + INTERVAL '7 days'`,
      [careHomeId]
    );

    res.json({
      stats,
      popular_activities: popular,
      inactive_residents: inactive,
      week_stats: weekStats,
    });
  } catch (err) { next(err); }
}
