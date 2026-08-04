// src/controllers/home.controller.ts — care-home profile & settings
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

export async function getHome(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows: [row] } = await query(
      `SELECT id, name, address, postcode, phone, email, cqc_location_id, cqc_rating, timezone, settings
         FROM care_homes WHERE id = $1`, [req.user!.care_home_id]);
    if (!row) return res.status(404).json({ error: 'Care home not found' });
    res.json(row);
  } catch (err) { next(err); }
}
export async function updateHome(req: Request, res: Response, next: NextFunction) {
  try {
    const b = req.body;
    const { rows: [row] } = await query(
      `UPDATE care_homes SET
         name = COALESCE($1,name), address = COALESCE($2,address), postcode = COALESCE($3,postcode),
         phone = COALESCE($4,phone), email = COALESCE($5,email), cqc_location_id = COALESCE($6,cqc_location_id),
         settings = COALESCE(settings,'{}'::jsonb) || COALESCE($7::jsonb,'{}'::jsonb)
       WHERE id = $8 RETURNING id, name, address, postcode, phone, email, cqc_location_id, settings`,
      [b.name, b.address, b.postcode, b.phone, b.email, b.cqc_location_id,
       b.settings ? JSON.stringify(b.settings) : null, req.user!.care_home_id]);
    res.json(row);
  } catch (err) { next(err); }
}
