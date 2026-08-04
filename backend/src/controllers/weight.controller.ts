// src/controllers/weight.controller.ts
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { createNotification } from './notifications.controller';

export async function recordWeight(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;
    const { weightKg, mustScore, notes } = req.body;
    if (!weightKg) throw new AppError(400, 'Weight is required');

    const { rows: [resident] } = await query(
      'SELECT first_name, last_name, height_cm FROM residents WHERE id=$1 AND care_home_id=$2',
      [residentId, careHomeId]
    );
    if (!resident) throw new AppError(404, 'Resident not found');
    const bmi = resident.height_cm
      ? Math.round((weightKg / ((resident.height_cm/100)**2)) * 10) / 10 : null;

    const { rows: [record] } = await query(
      `INSERT INTO resident_weights (care_home_id,resident_id,weight_kg,bmi,must_score,recorded_by,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [careHomeId, residentId, weightKg, bmi, mustScore||null, req.user!.id, notes||null]
    );

    // Check weight drop vs previous
    const { rows: prev } = await query(
      `SELECT weight_kg FROM resident_weights WHERE resident_id=$1 AND id!=$2 ORDER BY created_at DESC LIMIT 1`,
      [residentId, record.id]
    );
    if (prev[0]) {
      const pct = ((prev[0].weight_kg - weightKg) / prev[0].weight_kg) * 100;
      if (pct >= 5) {
        await createNotification({ careHomeId, type:'weight_drop', priority:'high',
          title:`Weight drop — ${resident.first_name} ${resident.last_name}`,
          body:`${pct.toFixed(1)}% weight loss (${prev[0].weight_kg}kg → ${weightKg}kg). Consider MUST score & dietitian referral.`,
          entityType:'resident', entityId:residentId });
      }
    }

    res.status(201).json({ ...record, bmi });
  } catch (err) { next(err); }
}

export async function getWeightHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT rw.*, u.first_name||' '||u.last_name AS recorded_by_name
       FROM resident_weights rw LEFT JOIN users u ON u.id=rw.recorded_by
       WHERE rw.care_home_id=$1 AND rw.resident_id=$2
       ORDER BY rw.created_at DESC LIMIT 24`,
      [req.user!.care_home_id, req.params.residentId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function getAllWeights(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT rw.*, r.first_name||' '||r.last_name AS resident_name, r.room_number,
              u.first_name||' '||u.last_name AS recorded_by_name
       FROM resident_weights rw
       JOIN residents r ON r.id=rw.resident_id
       LEFT JOIN users u ON u.id=rw.recorded_by
       WHERE rw.care_home_id=$1
       ORDER BY rw.created_at DESC LIMIT 100`,
      [req.user!.care_home_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}
