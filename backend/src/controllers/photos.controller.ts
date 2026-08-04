// src/controllers/photos.controller.ts
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

// ── Upload resident profile photo ─────────────────────────────────────────
export async function uploadResidentPhoto(req: MulterRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError(400, 'No image uploaded');
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const photoUrl = `/uploads/residents/${req.file.filename}`;

    // Delete old photo if exists
    const { rows: [resident] } = await query(
      'SELECT photo_url FROM residents WHERE id=$1 AND care_home_id=$2',
      [id, careHomeId]
    );
    if (resident?.photo_url) deleteLocalFile(resident.photo_url);

    const { rows: [updated] } = await query(
      'UPDATE residents SET photo_url=$1 WHERE id=$2 AND care_home_id=$3 RETURNING id, photo_url',
      [photoUrl, id, careHomeId]
    );
    if (!updated) throw new AppError(404, 'Resident not found');
    res.json({ photoUrl: updated.photo_url });
  } catch (err) { next(err); }
}

// ── Remove resident profile photo ─────────────────────────────────────────
export async function removeResidentPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { rows: [resident] } = await query(
      'SELECT photo_url FROM residents WHERE id=$1 AND care_home_id=$2',
      [id, careHomeId]
    );
    if (resident?.photo_url) deleteLocalFile(resident.photo_url);
    await query('UPDATE residents SET photo_url=NULL WHERE id=$1 AND care_home_id=$2', [id, careHomeId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── Upload belonging photo ────────────────────────────────────────────────
export async function uploadBelongingPhoto(req: MulterRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError(400, 'No image uploaded');
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { description, category } = req.body;
    const photoUrl = `/uploads/belongings/${req.file.filename}`;

    // Verify resident belongs to this home
    const { rows: [resident] } = await query(
      'SELECT id FROM residents WHERE id=$1 AND care_home_id=$2',
      [residentId, careHomeId]
    );
    if (!resident) throw new AppError(404, 'Resident not found');

    const { rows: [belonging] } = await query(
      `INSERT INTO resident_belongings
         (care_home_id, resident_id, photo_url, description, category, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [careHomeId, residentId, photoUrl, description || null, category || 'general', req.user!.id]
    );
    res.status(201).json(belonging);
  } catch (err) { next(err); }
}

// ── List belongings for a resident ────────────────────────────────────────
export async function listBelongings(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT rb.*, u.first_name || ' ' || u.last_name AS recorded_by_name
       FROM resident_belongings rb
       LEFT JOIN users u ON u.id = rb.recorded_by
       WHERE rb.care_home_id=$1 AND rb.resident_id=$2
       ORDER BY rb.created_at DESC`,
      [careHomeId, residentId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Delete a belonging photo ──────────────────────────────────────────────
export async function deleteBelonging(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { rows: [b] } = await query(
      'DELETE FROM resident_belongings WHERE id=$1 AND care_home_id=$2 RETURNING photo_url',
      [id, careHomeId]
    );
    if (b?.photo_url) deleteLocalFile(b.photo_url);
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── Upload staff avatar ───────────────────────────────────────────────────
export async function uploadStaffAvatar(req: MulterRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError(400, 'No image uploaded');
    const userId = req.user!.id;
    const avatarUrl = `/uploads/staff/${req.file.filename}`;

    const { rows: [u] } = await query(
      'SELECT avatar_url FROM users WHERE id=$1', [userId]
    );
    if (u?.avatar_url) deleteLocalFile(u.avatar_url);

    await query('UPDATE users SET avatar_url=$1 WHERE id=$2', [avatarUrl, userId]);
    res.json({ avatarUrl });
  } catch (err) { next(err); }
}

function deleteLocalFile(url: string) {
  try {
    const filename = url.split('/uploads/')[1];
    if (!filename) return;
    const filepath = path.join(process.cwd(), 'uploads', filename);
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  } catch { /* ignore */ }
}
