import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';

export async function signInVisitor(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { visitorName, visitorType, company, visitingResidentId, purpose, badgeNumber, carRegistration, dbsVerified, notes } = req.body;

    if (!visitorName || !visitorType || !purpose) {
      return res.status(400).json({ error: 'visitorName, visitorType, and purpose are required' });
    }

    // Check for safeguarding flags
    const { rows: flags } = await query(
      `SELECT * FROM visitor_safeguarding WHERE care_home_id = $1 AND visitor_name ILIKE $2 AND active = true`,
      [careHomeId, visitorName]
    );

    const safeguardingFlag = flags.length > 0;

    const { rows: [visitor] } = await query(
      `INSERT INTO visitor_records (care_home_id, visitor_name, visitor_type, company, visiting_resident_id, purpose, badge_number, car_registration, dbs_verified, safeguarding_flag, notes, sign_in_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()) RETURNING *`,
      [careHomeId, visitorName, visitorType, company, visitingResidentId, purpose, badgeNumber, carRegistration, dbsVerified || false, safeguardingFlag, notes]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'VISITOR_SIGNED_IN', entityType: 'visitor_record', entityId: visitor.id,
      afterData: { visitorName, visitorType, visitingResidentId, safeguardingFlag }, ip: req.ip,
    });
    res.status(201).json({ ...visitor, safeguardingAlerts: flags });
  } catch (err) { next(err); }
}

export async function signOutVisitor(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [visitor] } = await query(
      `UPDATE visitor_records SET sign_out_time = NOW()
       WHERE id = $1 AND care_home_id = $2 AND sign_out_time IS NULL RETURNING *`,
      [id, careHomeId]
    );
    if (!visitor) throw new AppError(404, 'Visitor record not found or already signed out');

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'VISITOR_SIGNED_OUT', entityType: 'visitor_record', entityId: id,
      afterData: { visitorName: visitor.visitor_name }, ip: req.ip,
    });
    res.json(visitor);
  } catch (err) { next(err); }
}

export async function listVisitors(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { date, signedIn } = req.query;
    let where = 'WHERE vr.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (date) { where += ` AND vr.sign_in_time::date = $${p++}`; params.push(date); }
    if (signedIn === 'true') { where += ' AND vr.sign_out_time IS NULL'; }

    const { rows } = await query(
      `SELECT vr.*, r.first_name || ' ' || r.last_name AS resident_name
       FROM visitor_records vr
       LEFT JOIN residents r ON r.id = vr.visiting_resident_id
       ${where}
       ORDER BY vr.sign_in_time DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function getVisitorHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;

    const { rows } = await query(
      `SELECT * FROM visitor_records WHERE care_home_id = $1 AND visiting_resident_id = $2
       ORDER BY sign_in_time DESC`,
      [careHomeId, residentId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function addSafeguardingFlag(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { visitorName, visitorType, restrictionType, reason, restrictedResidents } = req.body;

    if (!visitorName || !restrictionType || !reason) {
      return res.status(400).json({ error: 'visitorName, restrictionType, and reason are required' });
    }

    const { rows: [flag] } = await query(
      `INSERT INTO visitor_safeguarding (care_home_id, visitor_name, visitor_type, restriction_type, reason, restricted_residents, active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7) RETURNING *`,
      [careHomeId, visitorName, visitorType, restrictionType, reason, restrictedResidents ? JSON.stringify(restrictedResidents) : null, req.user!.id]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'SAFEGUARDING_FLAG_ADDED', entityType: 'visitor_safeguarding', entityId: flag.id,
      afterData: { visitorName, restrictionType, reason }, ip: req.ip,
    });
    res.status(201).json(flag);
  } catch (err) { next(err); }
}

export async function listSafeguardingFlags(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { active } = req.query;
    let where = 'WHERE care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (active !== undefined) { where += ` AND active = $${p++}`; params.push(active === 'true'); }

    const { rows } = await query(
      `SELECT * FROM visitor_safeguarding ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function getVisitorDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Currently signed in
    const { rows: currentVisitors } = await query(
      `SELECT vr.*, r.first_name || ' ' || r.last_name AS resident_name
       FROM visitor_records vr
       LEFT JOIN residents r ON r.id = vr.visiting_resident_id
       WHERE vr.care_home_id = $1 AND vr.sign_out_time IS NULL
       ORDER BY vr.sign_in_time DESC`,
      [careHomeId]
    );

    // Today's stats
    const { rows: [todayStats] } = await query(
      `SELECT
        COUNT(*)::int AS total_today,
        COUNT(*) FILTER (WHERE sign_out_time IS NULL)::int AS currently_in,
        COUNT(*) FILTER (WHERE sign_out_time IS NOT NULL)::int AS signed_out,
        COUNT(*) FILTER (WHERE safeguarding_flag = true)::int AS flagged
       FROM visitor_records WHERE care_home_id = $1 AND sign_in_time::date = CURRENT_DATE`,
      [careHomeId]
    );

    // Active safeguarding flags count
    const { rows: [safeguardingCount] } = await query(
      `SELECT COUNT(*)::int AS count FROM visitor_safeguarding WHERE care_home_id = $1 AND active = true`,
      [careHomeId]
    );

    res.json({ currentVisitors, todayStats, activeSafeguardingFlags: safeguardingCount.count });
  } catch (err) { next(err); }
}

export async function getFireRoll(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // All currently signed-in visitors for emergency roll call
    const { rows } = await query(
      `SELECT vr.visitor_name, vr.visitor_type, vr.company, vr.badge_number,
        vr.sign_in_time, r.first_name || ' ' || r.last_name AS visiting_resident
       FROM visitor_records vr
       LEFT JOIN residents r ON r.id = vr.visiting_resident_id
       WHERE vr.care_home_id = $1 AND vr.sign_out_time IS NULL
       ORDER BY vr.visitor_name`,
      [careHomeId]
    );
    res.json({ generatedAt: new Date().toISOString(), visitors: rows, count: rows.length });
  } catch (err) { next(err); }
}
