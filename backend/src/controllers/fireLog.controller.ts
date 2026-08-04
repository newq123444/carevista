import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';

// ── Fire Tests ────────────────────────────────────────────────────────────

export async function recordFireTest(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { testType, testDate, timeTakenSeconds, allClear, issuesFound, witnesses, notes } = req.body;

    if (!testType || !testDate) {
      return res.status(400).json({ error: 'testType and testDate are required' });
    }

    const { rows: [test] } = await query(
      `INSERT INTO fire_tests (care_home_id, test_type, test_date, time_taken_seconds, all_clear, issues_found, conducted_by, witnesses, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [careHomeId, testType, testDate, timeTakenSeconds, allClear !== false, issuesFound, req.user!.id, witnesses ? JSON.stringify(witnesses) : null, notes]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'FIRE_TEST_RECORDED', entityType: 'fire_test', entityId: test.id,
      afterData: { testType, testDate, allClear: allClear !== false }, ip: req.ip,
    });
    res.status(201).json(test);
  } catch (err) { next(err); }
}

export async function listFireTests(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { testType } = req.query;
    let where = 'WHERE ft.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (testType) { where += ` AND ft.test_type = $${p++}`; params.push(testType); }

    const { rows } = await query(
      `SELECT ft.*, u.first_name || ' ' || u.last_name AS conducted_by_name
       FROM fire_tests ft
       LEFT JOIN users u ON u.id = ft.conducted_by
       ${where}
       ORDER BY ft.test_date DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Fire Equipment Checks ─────────────────────────────────────────────────

export async function recordEquipmentCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { equipmentType, location, checkDate, status, nextCheckDate, notes } = req.body;

    if (!equipmentType || !location || !checkDate) {
      return res.status(400).json({ error: 'equipmentType, location, and checkDate are required' });
    }

    const { rows: [check] } = await query(
      `INSERT INTO fire_equipment_checks (care_home_id, equipment_type, location, check_date, status, next_check_date, checked_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [careHomeId, equipmentType, location, checkDate, status || 'pass', nextCheckDate, req.user!.id, notes]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'FIRE_EQUIPMENT_CHECKED', entityType: 'fire_equipment_check', entityId: check.id,
      afterData: { equipmentType, location, status: status || 'pass' }, ip: req.ip,
    });
    res.status(201).json(check);
  } catch (err) { next(err); }
}

export async function listEquipmentChecks(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { status, equipmentType } = req.query;
    let where = 'WHERE fec.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (status) { where += ` AND fec.status = $${p++}`; params.push(status); }
    if (equipmentType) { where += ` AND fec.equipment_type = $${p++}`; params.push(equipmentType); }

    const { rows } = await query(
      `SELECT fec.*, u.first_name || ' ' || u.last_name AS checked_by_name
       FROM fire_equipment_checks fec
       LEFT JOIN users u ON u.id = fec.checked_by
       ${where}
       ORDER BY fec.check_date DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function getOverdueChecks(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT fec.*, u.first_name || ' ' || u.last_name AS checked_by_name
       FROM fire_equipment_checks fec
       LEFT JOIN users u ON u.id = fec.checked_by
       WHERE fec.care_home_id = $1 AND fec.next_check_date < CURRENT_DATE
       ORDER BY fec.next_check_date ASC`,
      [careHomeId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── PEEPs ─────────────────────────────────────────────────────────────────

export async function createPeep(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, mobilityStatus, evacuationMethod, assistanceRequired, equipmentNeeded, primaryHelper, secondaryHelper, reviewDate } = req.body;

    if (!residentId || !mobilityStatus || !evacuationMethod) {
      return res.status(400).json({ error: 'residentId, mobilityStatus, and evacuationMethod are required' });
    }

    const { rows: [peep] } = await query(
      `INSERT INTO peeps (care_home_id, resident_id, mobility_status, evacuation_method, assistance_required, equipment_needed, primary_helper, secondary_helper, review_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'current') RETURNING *`,
      [careHomeId, residentId, mobilityStatus, evacuationMethod, assistanceRequired, equipmentNeeded, primaryHelper, secondaryHelper, reviewDate]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'PEEP_CREATED', entityType: 'peep', entityId: peep.id,
      afterData: { residentId, mobilityStatus, evacuationMethod }, ip: req.ip,
    });
    res.status(201).json(peep);
  } catch (err) { next(err); }
}

export async function listPeeps(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { status, residentId } = req.query;
    let where = 'WHERE p.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (status) { where += ` AND p.status = $${p++}`; params.push(status); }
    if (residentId) { where += ` AND p.resident_id = $${p++}`; params.push(residentId); }

    const { rows } = await query(
      `SELECT p.*, r.first_name || ' ' || r.last_name AS resident_name, r.room_number,
        u1.first_name || ' ' || u1.last_name AS primary_helper_name,
        u2.first_name || ' ' || u2.last_name AS secondary_helper_name
       FROM peeps p
       JOIN residents r ON r.id = p.resident_id
       LEFT JOIN users u1 ON u1.id = p.primary_helper
       LEFT JOIN users u2 ON u2.id = p.secondary_helper
       ${where}
       ORDER BY r.last_name, r.first_name`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function updatePeep(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { mobilityStatus, evacuationMethod, assistanceRequired, equipmentNeeded, primaryHelper, secondaryHelper, reviewDate, status } = req.body;

    const { rows: [peep] } = await query(
      `UPDATE peeps SET
        mobility_status = COALESCE($1, mobility_status),
        evacuation_method = COALESCE($2, evacuation_method),
        assistance_required = COALESCE($3, assistance_required),
        equipment_needed = COALESCE($4, equipment_needed),
        primary_helper = COALESCE($5, primary_helper),
        secondary_helper = COALESCE($6, secondary_helper),
        review_date = COALESCE($7, review_date),
        status = COALESCE($8, status),
        updated_at = NOW()
       WHERE id = $9 AND care_home_id = $10 RETURNING *`,
      [mobilityStatus, evacuationMethod, assistanceRequired, equipmentNeeded, primaryHelper, secondaryHelper, reviewDate, status, id, careHomeId]
    );
    if (!peep) throw new AppError(404, 'PEEP not found');

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'PEEP_UPDATED', entityType: 'peep', entityId: id,
      afterData: { mobilityStatus, status }, ip: req.ip,
    });
    res.json(peep);
  } catch (err) { next(err); }
}

// ── Fire Dashboard ────────────────────────────────────────────────────────

export async function getFireDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Last test of each type
    const { rows: lastTests } = await query(
      `SELECT DISTINCT ON (test_type) test_type, test_date, all_clear, time_taken_seconds
       FROM fire_tests WHERE care_home_id = $1
       ORDER BY test_type, test_date DESC`,
      [careHomeId]
    );

    // Equipment status summary
    const { rows: equipmentSummary } = await query(
      `SELECT status, COUNT(*)::int AS count
       FROM fire_equipment_checks WHERE care_home_id = $1
       AND id IN (
         SELECT DISTINCT ON (equipment_type, location) id
         FROM fire_equipment_checks WHERE care_home_id = $1
         ORDER BY equipment_type, location, check_date DESC
       )
       GROUP BY status`,
      [careHomeId]
    );

    // Overdue equipment checks count
    const { rows: [overdueCount] } = await query(
      `SELECT COUNT(*)::int AS count
       FROM fire_equipment_checks WHERE care_home_id = $1 AND next_check_date < CURRENT_DATE`,
      [careHomeId]
    );

    // PEEPs coverage
    const { rows: [peepsCoverage] } = await query(
      `SELECT
        COUNT(DISTINCT p.resident_id)::int AS residents_with_peep,
        (SELECT COUNT(*)::int FROM residents WHERE care_home_id = $1 AND active = true) AS total_active_residents,
        COUNT(*) FILTER (WHERE p.status = 'needs_review')::int AS needs_review
       FROM peeps p WHERE p.care_home_id = $1 AND p.status != 'archived'`,
      [careHomeId]
    );

    res.json({ lastTests, equipmentSummary, overdueChecks: overdueCount.count, peepsCoverage });
  } catch (err) { next(err); }
}
