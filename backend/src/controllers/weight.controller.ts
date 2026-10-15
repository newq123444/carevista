// src/controllers/weight.controller.ts
import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../models/db';
import { appendQuietly } from '../services/recordChain';
import { AppError } from '../utils/errors';
import { createNotification } from './notifications.controller';

export async function recordWeight(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;
    const { weightKg, mustScore, notes } = req.body;
    const kg = Number(weightKg);
    if (!Number.isFinite(kg) || kg < 20 || kg > 350) {
      throw new AppError(400, 'Enter the weight in kilograms (between 20 and 350)');
    }

    const { rows: [resident] } = await query(
      'SELECT first_name, last_name, height_cm FROM residents WHERE id=$1 AND care_home_id=$2',
      [residentId, careHomeId]
    );
    if (!resident) throw new AppError(404, 'Resident not found');
    const h = Number(resident.height_cm);
    const bmi = Number.isFinite(h) && h >= 100 && h <= 230
      ? Math.round((kg / ((h / 100) ** 2)) * 10) / 10 : null;

    const record = await withTransaction(async (client) => {
      const { rows: [row] } = await client.query(
        `INSERT INTO resident_weights (care_home_id,resident_id,weight_kg,bmi,must_score,recorded_by,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [careHomeId, residentId, kg, bmi, mustScore ?? null, req.user!.id, notes || null]
      );
      await appendQuietly(client, {
        careHomeId, entityType: 'weight', entityId: row.id, action: 'created',
        row, recordedBy: req.user!.id, eventAt: row.created_at,
      });
      return row;
    });

    // MUST step 2 looks at loss over the past 3–6 months, not since last
    // time: a resident losing 2% a month never trips a "since last time"
    // check and has lost 10% by spring. Compare with the highest weight in
    // the last six months. (The screens use utils/weightTrend.ts, which
    // applies the same rule and is tested.)
    const { rows: [ref] } = await query(
      `SELECT weight_kg::float AS kg, created_at FROM resident_weights
        WHERE resident_id=$1 AND care_home_id=$2 AND id<>$3 AND weight_kg IS NOT NULL
          AND weight_kg BETWEEN 20 AND 350
          AND created_at >= NOW() - INTERVAL '183 days'
        ORDER BY weight_kg DESC LIMIT 1`,
      [residentId, careHomeId, record.id]
    );
    if (ref) {
      const pct = Math.round(((ref.kg - kg) / ref.kg) * 1000) / 10;
      if (pct >= 5) {
        const score = pct > 10 ? 2 : 1;
        await createNotification({ careHomeId, type:'weight_drop', priority: score === 2 ? 'urgent' : 'high',
          title:`Weight loss — ${resident.first_name} ${resident.last_name}`,
          body:`Down ${pct}% in the last six months (${ref.kg.toFixed(1)} kg → ${kg.toFixed(1)} kg). ` +
               `MUST weight-loss score ${score} if unplanned. Re-weigh to confirm, then complete a full MUST screen.`,
          entityType:'resident', entityId:residentId });
      }
    }

    res.status(201).json({ ...record, bmi });
  } catch (err) { next(err); }
}

// Every current resident with their recent weights and height, for the
// intake board and the weight trend. Raw readings: the trend and MUST steps
// are worked out by utils/weightTrend.ts on the screen.
export async function getWeightTrends(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT r.id AS resident_id, r.height_cm,
              COALESCE((
                SELECT json_agg(json_build_object('weight_kg', w.weight_kg, 'created_at', w.created_at)
                                ORDER BY w.created_at DESC)
                  FROM (SELECT weight_kg, created_at FROM resident_weights rw
                         WHERE rw.resident_id = r.id AND rw.care_home_id = r.care_home_id
                           AND rw.weight_kg IS NOT NULL
                         ORDER BY rw.created_at DESC LIMIT 40) w
              ), '[]'::json) AS readings
         FROM residents r
        WHERE r.care_home_id = $1 AND r.active = TRUE AND r.discharge_date IS NULL`,
      [req.user!.care_home_id]
    );
    res.json(rows);
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
