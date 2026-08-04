import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Queue Offline Action ──────────────────────────────────────────────────

export async function queueOfflineAction(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { entityType, entityId, action, payload } = req.body;

    if (!entityType || !action || !payload) {
      return res.status(400).json({ error: 'entityType, action, and payload are required' });
    }

    const { rows: [item] } = await query(
      `INSERT INTO offline_sync_queue (care_home_id, user_id, entity_type, entity_id, action, payload, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [careHomeId, userId, entityType, entityId, action, JSON.stringify(payload)]
    );

    res.status(201).json(item);
  } catch (err) { next(err); }
}

// ── Sync Offline Actions ──────────────────────────────────────────────────

export async function syncOfflineActions(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;

    // Get all pending items for this user
    const { rows: pending } = await query(
      `SELECT * FROM offline_sync_queue
       WHERE care_home_id = $1 AND user_id = $2 AND status = 'pending'
       ORDER BY created_at ASC`,
      [careHomeId, userId]
    );

    const synced: string[] = [];
    const conflicts: string[] = [];

    for (const item of pending) {
      // Check for conflicts (same entity modified by another user after this action was queued)
      const { rows: conflicting } = await query(
        `SELECT id FROM offline_sync_queue
         WHERE care_home_id = $1 AND entity_type = $2 AND entity_id = $3
           AND user_id != $4 AND status = 'synced' AND synced_at > $5`,
        [careHomeId, item.entity_type, item.entity_id, userId, item.created_at]
      );

      if (conflicting.length > 0) {
        await query(
          `UPDATE offline_sync_queue SET status = 'conflict' WHERE id = $1`,
          [item.id]
        );
        conflicts.push(item.id);
      } else {
        await query(
          `UPDATE offline_sync_queue SET status = 'synced', synced_at = NOW() WHERE id = $1`,
          [item.id]
        );
        synced.push(item.id);
      }
    }

    res.json({ synced, conflicts, total: pending.length });
  } catch (err) { next(err); }
}

// ── Get Conflicts ─────────────────────────────────────────────────────────

export async function getConflicts(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT * FROM offline_sync_queue
       WHERE care_home_id = $1 AND status = 'conflict'
       ORDER BY created_at DESC`,
      [careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Resolve Conflict ──────────────────────────────────────────────────────

export async function resolveConflict(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { resolution } = req.body;

    const { rows: [item] } = await query(
      `UPDATE offline_sync_queue
       SET status = 'synced', conflict_resolution = $1, synced_at = NOW()
       WHERE id = $2 AND care_home_id = $3 AND status = 'conflict'
       RETURNING *`,
      [JSON.stringify(resolution), id, careHomeId]
    );

    if (!item) throw new AppError(404, 'Conflict not found');
    res.json(item);
  } catch (err) { next(err); }
}
