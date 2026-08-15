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

// ── Weather location ──────────────────────────────────────────────────────
// The weather widget needs coordinates. Rather than asking a care manager for
// latitude/longitude, we resolve them from the home's own postcode and cache
// the result in settings. Managers can also override manually in Home Settings.
export async function getWeatherLocation(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [home] } = await query(
      `SELECT name, address, postcode, settings FROM care_homes WHERE id = $1`, [chId]);
    if (!home) return res.status(404).json({ error: 'Care home not found' });

    const st = home.settings || {};

    // 1. Manual override, or a previously cached lookup.
    if (st.weather_lat != null && st.weather_lon != null) {
      return res.json({
        lat: Number(st.weather_lat), lon: Number(st.weather_lon),
        place: st.weather_place || home.postcode || home.name, source: 'settings',
      });
    }

    // 2. Resolve from the home's postcode (postcodes.io — free, UK, no key).
    if (home.postcode) {
      try {
        const pc = encodeURIComponent(String(home.postcode).trim());
        const r = await fetch(`https://api.postcodes.io/postcodes/${pc}`);
        if (r.ok) {
          const j: any = await r.json();
          const res_ = j?.result;
          if (res_?.latitude != null && res_?.longitude != null) {
            const place = res_.admin_district || res_.parish || home.postcode;
            // Cache so we only look this up once.
            await query(
              `UPDATE care_homes SET settings = COALESCE(settings,'{}'::jsonb) || $2::jsonb WHERE id = $1`,
              [chId, JSON.stringify({ weather_lat: res_.latitude, weather_lon: res_.longitude, weather_place: place })]);
            return res.json({ lat: res_.latitude, lon: res_.longitude, place, source: 'postcode' });
          }
        }
      } catch {
        // Fall through — never block the dashboard on an external lookup.
      }
    }

    // 3. Nothing usable: say so honestly rather than showing another town's weather.
    res.json({ lat: null, lon: null, place: null, source: 'unset',
               message: 'Add the home postcode in Home Settings to show local weather.' });
  } catch (err) { next(err); }
}
