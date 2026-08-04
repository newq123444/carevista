import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Upload Photo ──────────────────────────────────────────────────────────

export async function uploadPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, photoUrl, caption, uploadedByName, uploadedByEmail, showOnDate } = req.body;

    if (!residentId || !photoUrl) {
      return res.status(400).json({ error: 'residentId and photoUrl are required' });
    }

    const { rows: [photo] } = await query(
      `INSERT INTO photo_frame_photos (care_home_id, resident_id, photo_url, caption, uploaded_by_name, uploaded_by_email, show_on_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [careHomeId, residentId, photoUrl, caption, uploadedByName, uploadedByEmail, showOnDate]
    );

    res.status(201).json(photo);
  } catch (err) { next(err); }
}

// ── List Photos ───────────────────────────────────────────────────────────

export async function listPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { status } = req.query;

    let where = 'WHERE pfp.resident_id = $1 AND pfp.care_home_id = $2';
    const params: unknown[] = [residentId, careHomeId];

    if (status) {
      where += ' AND pfp.approval_status = $3';
      params.push(status);
    }

    const { rows } = await query(
      `SELECT pfp.*, u.first_name || ' ' || u.last_name AS approved_by_name
       FROM photo_frame_photos pfp
       LEFT JOIN users u ON u.id = pfp.approved_by
       ${where}
       ORDER BY pfp.created_at DESC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Approve Photo ─────────────────────────────────────────────────────────

export async function approvePhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;

    const { rows: [photo] } = await query(
      `UPDATE photo_frame_photos
       SET approval_status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND care_home_id = $3 AND approval_status = 'pending'
       RETURNING *`,
      [userId, id, careHomeId]
    );

    if (!photo) throw new AppError(404, 'Photo not found or already processed');
    res.json(photo);
  } catch (err) { next(err); }
}

// ── Reject Photo ──────────────────────────────────────────────────────────

export async function rejectPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { reason } = req.body;

    const { rows: [photo] } = await query(
      `UPDATE photo_frame_photos
       SET approval_status = 'rejected', approved_by = $1, approved_at = NOW(), rejection_reason = $2
       WHERE id = $3 AND care_home_id = $4 AND approval_status = 'pending'
       RETURNING *`,
      [userId, reason, id, careHomeId]
    );

    if (!photo) throw new AppError(404, 'Photo not found or already processed');
    res.json(photo);
  } catch (err) { next(err); }
}

// ── Schedule Photo ────────────────────────────────────────────────────────

export async function schedulePhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { showOnDate, displayOrder } = req.body;

    const { rows: [photo] } = await query(
      `UPDATE photo_frame_photos
       SET show_on_date = $1, display_order = COALESCE($2, display_order)
       WHERE id = $3 AND care_home_id = $4
       RETURNING *`,
      [showOnDate, displayOrder, id, careHomeId]
    );

    if (!photo) throw new AppError(404, 'Photo not found');
    res.json(photo);
  } catch (err) { next(err); }
}

// ── Get Viewing History ───────────────────────────────────────────────────

export async function getViewingHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT pfvh.*, pfp.caption, pfp.photo_url
       FROM photo_frame_viewing_history pfvh
       JOIN photo_frame_photos pfp ON pfp.id = pfvh.photo_id
       WHERE pfvh.resident_id = $1 AND pfvh.care_home_id = $2
       ORDER BY pfvh.viewed_at DESC LIMIT 100`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Log View ──────────────────────────────────────────────────────────────

export async function logView(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { photoId, residentId, reaction, notes } = req.body;

    if (!photoId || !residentId) {
      return res.status(400).json({ error: 'photoId and residentId are required' });
    }

    const { rows: [view] } = await query(
      `INSERT INTO photo_frame_viewing_history (care_home_id, photo_id, resident_id, reaction, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [careHomeId, photoId, residentId, reaction, notes]
    );

    res.status(201).json(view);
  } catch (err) { next(err); }
}
