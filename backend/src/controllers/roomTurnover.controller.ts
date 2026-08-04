import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';

export async function createTurnover(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { roomNumber, previousResidentId, vacatedDate, targetReadyDate, assignedTo, notes } = req.body;

    if (!roomNumber || !vacatedDate) {
      return res.status(400).json({ error: 'roomNumber and vacatedDate are required' });
    }

    const { rows: [turnover] } = await query(
      `INSERT INTO room_turnovers (care_home_id, room_number, previous_resident_id, vacated_date, target_ready_date, assigned_to, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'vacated') RETURNING *`,
      [careHomeId, roomNumber, previousResidentId, vacatedDate, targetReadyDate, assignedTo, notes]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'ROOM_TURNOVER_CREATED', entityType: 'room_turnover', entityId: turnover.id,
      afterData: { roomNumber, vacatedDate, targetReadyDate }, ip: req.ip,
    });
    res.status(201).json(turnover);
  } catch (err) { next(err); }
}

export async function listTurnovers(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { status } = req.query;
    let where = 'WHERE rt.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (status) { where += ` AND rt.status = $${p++}`; params.push(status); }

    const { rows } = await query(
      `SELECT rt.*, u.first_name || ' ' || u.last_name AS assigned_to_name,
        r.first_name || ' ' || r.last_name AS previous_resident_name
       FROM room_turnovers rt
       LEFT JOIN users u ON u.id = rt.assigned_to
       LEFT JOIN residents r ON r.id = rt.previous_resident_id
       ${where}
       ORDER BY rt.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function updateTurnoverStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { status, actualReadyDate, assignedTo, notes } = req.body;

    const { rows: [turnover] } = await query(
      `UPDATE room_turnovers SET
        status = COALESCE($1, status),
        actual_ready_date = COALESCE($2, actual_ready_date),
        assigned_to = COALESCE($3, assigned_to),
        notes = COALESCE($4, notes),
        updated_at = NOW()
       WHERE id = $5 AND care_home_id = $6 RETURNING *`,
      [status, actualReadyDate, assignedTo, notes, id, careHomeId]
    );
    if (!turnover) throw new AppError(404, 'Room turnover not found');

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'ROOM_TURNOVER_UPDATED', entityType: 'room_turnover', entityId: id,
      afterData: { status, actualReadyDate }, ip: req.ip,
    });
    res.json(turnover);
  } catch (err) { next(err); }
}

export async function addChecklistItem(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { turnoverId, taskName, category, notes } = req.body;

    if (!taskName) {
      return res.status(400).json({ error: 'taskName is required' });
    }

    const { rows: [item] } = await query(
      `INSERT INTO turnover_checklist_items (care_home_id, turnover_id, task_name, category, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [careHomeId, turnoverId, taskName, category, notes]
    );

    res.status(201).json(item);
  } catch (err) { next(err); }
}

export async function completeChecklistItem(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { notes } = req.body;

    const { rows: [item] } = await query(
      `UPDATE turnover_checklist_items SET completed = true, completed_by = $1, completed_at = NOW(), notes = COALESCE($2, notes)
       WHERE id = $3 AND care_home_id = $4 RETURNING *`,
      [req.user!.id, notes, id, careHomeId]
    );
    if (!item) throw new AppError(404, 'Checklist item not found');
    res.json(item);
  } catch (err) { next(err); }
}

export async function getChecklistItems(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { turnoverId } = req.params;

    const { rows } = await query(
      `SELECT tci.*, u.first_name || ' ' || u.last_name AS completed_by_name
       FROM turnover_checklist_items tci
       LEFT JOIN users u ON u.id = tci.completed_by
       WHERE tci.care_home_id = $1 AND tci.turnover_id = $2
       ORDER BY tci.category, tci.task_name`,
      [careHomeId, turnoverId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function getTurnoverDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows: statusCounts } = await query(
      `SELECT status, COUNT(*)::int AS count
       FROM room_turnovers WHERE care_home_id = $1
       GROUP BY status`,
      [careHomeId]
    );

    // Active turnovers with progress
    const { rows: activeTurnovers } = await query(
      `SELECT rt.*,
        (SELECT COUNT(*) FROM turnover_checklist_items WHERE turnover_id = rt.id)::int AS total_items,
        (SELECT COUNT(*) FROM turnover_checklist_items WHERE turnover_id = rt.id AND completed = true)::int AS completed_items
       FROM room_turnovers rt
       WHERE rt.care_home_id = $1 AND rt.status IN ('vacated', 'in_progress')
       ORDER BY rt.target_ready_date ASC NULLS LAST`,
      [careHomeId]
    );

    // Overdue turnovers
    const { rows: [overdueCount] } = await query(
      `SELECT COUNT(*)::int AS count
       FROM room_turnovers
       WHERE care_home_id = $1 AND target_ready_date < CURRENT_DATE AND status NOT IN ('ready', 'allocated')`,
      [careHomeId]
    );

    res.json({ statusCounts, activeTurnovers, overdue: overdueCount.count });
  } catch (err) { next(err); }
}
