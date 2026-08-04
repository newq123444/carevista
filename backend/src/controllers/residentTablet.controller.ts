import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Create Request ────────────────────────────────────────────────────────

export async function createRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, requestType, payload } = req.body;

    if (!residentId || !requestType) {
      return res.status(400).json({ error: 'residentId and requestType are required' });
    }

    const { rows: [request] } = await query(
      `INSERT INTO resident_tablet_requests (care_home_id, resident_id, request_type, payload, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [careHomeId, residentId, requestType, JSON.stringify(payload || {})]
    );

    res.status(201).json(request);
  } catch (err) { next(err); }
}

// ── List Requests ─────────────────────────────────────────────────────────

export async function listRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { status, requestType, residentId } = req.query;

    let where = 'WHERE rtr.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;

    if (status) { where += ` AND rtr.status = $${p++}`; params.push(status); }
    if (requestType) { where += ` AND rtr.request_type = $${p++}`; params.push(requestType); }
    if (residentId) { where += ` AND rtr.resident_id = $${p++}`; params.push(residentId); }

    const { rows } = await query(
      `SELECT rtr.*, r.first_name || ' ' || r.last_name AS resident_name, r.room_number
       FROM resident_tablet_requests rtr
       JOIN residents r ON r.id = rtr.resident_id
       ${where}
       ORDER BY rtr.created_at DESC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Acknowledge Request ───────────────────────────────────────────────────

export async function acknowledgeRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;

    const { rows: [request] } = await query(
      `UPDATE resident_tablet_requests
       SET status = 'acknowledged', acknowledged_at = NOW(), acknowledged_by = $1
       WHERE id = $2 AND care_home_id = $3 AND status = 'pending'
       RETURNING *`,
      [userId, id, careHomeId]
    );

    if (!request) throw new AppError(404, 'Request not found or already acknowledged');
    res.json(request);
  } catch (err) { next(err); }
}

// ── Get Resident View ─────────────────────────────────────────────────────

export async function getResidentView(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [resident] } = await query(
      `SELECT id, first_name, last_name, room_number, photo_url
       FROM residents WHERE id = $1 AND care_home_id = $2`,
      [residentId, careHomeId]
    );

    if (!resident) throw new AppError(404, 'Resident not found');

    const { rows: requests } = await query(
      `SELECT * FROM resident_tablet_requests
       WHERE resident_id = $1 AND care_home_id = $2
       ORDER BY created_at DESC LIMIT 20`,
      [residentId, careHomeId]
    );

    res.json({ resident, requests });
  } catch (err) { next(err); }
}
