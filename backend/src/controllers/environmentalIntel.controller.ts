// src/controllers/environmentalIntel.controller.ts
// Environmental Intelligence - Track and optimize care home environment
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// ── Log Environmental Reading ─────────────────────────────────────────────
export async function logReading(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { zone, noiseLevel, lightLevel, temperature, humidity, airQuality, recordedAt } = req.body;

    if (!zone) return res.status(400).json({ error: 'zone is required' });

    const { rows: [reading] } = await query(
      `INSERT INTO environmental_readings (care_home_id, zone, noise_level, light_level, temperature, humidity, air_quality, recorded_at, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [careHomeId, zone, noiseLevel, lightLevel, temperature, humidity, airQuality, recordedAt || new Date(), req.user!.id]
    );
    res.status(201).json(reading);
  } catch (err) { next(err); }
}

// ── Get Dashboard ─────────────────────────────────────────────────────────
export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Get latest reading per zone
    const { rows: latestByZone } = await query(
      `SELECT DISTINCT ON (zone) zone, noise_level, light_level, temperature, humidity, air_quality, recorded_at
       FROM environmental_readings
       WHERE care_home_id = $1
       ORDER BY zone, recorded_at DESC`,
      [careHomeId]
    );

    // Get averages for last 24 hours
    const { rows: averages } = await query(
      `SELECT zone,
              AVG(noise_level) AS avg_noise,
              AVG(light_level) AS avg_light,
              AVG(temperature) AS avg_temperature,
              AVG(humidity) AS avg_humidity,
              AVG(air_quality) AS avg_air_quality,
              COUNT(*) AS reading_count
       FROM environmental_readings
       WHERE care_home_id = $1 AND recorded_at > NOW() - INTERVAL '24 hours'
       GROUP BY zone`,
      [careHomeId]
    );

    res.json({ current: latestByZone, averages_24h: averages });
  } catch (err) { next(err); }
}

// ── Get Correlations ──────────────────────────────────────────────────────
export async function getCorrelations(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Correlate environmental readings with wellbeing logs
    const { rows: correlations } = await query(
      `SELECT er.zone, er.temperature, er.noise_level, er.light_level,
              wl.mood, wl.pain_level, wl.engagement_level,
              er.recorded_at
       FROM environmental_readings er
       JOIN residents r ON r.room_number = er.zone AND r.care_home_id = er.care_home_id
       JOIN wellbeing_logs wl ON wl.resident_id = r.id
         AND wl.logged_at BETWEEN er.recorded_at - INTERVAL '1 hour' AND er.recorded_at + INTERVAL '1 hour'
       WHERE er.care_home_id = $1 AND er.recorded_at > NOW() - INTERVAL '7 days'
       ORDER BY er.recorded_at DESC LIMIT 200`,
      [careHomeId]
    );

    // Generate simple correlation insights
    const insights = [];
    if (correlations.length > 0) {
      const highNoise = correlations.filter((c: any) => c.noise_level > 60);
      const lowNoise = correlations.filter((c: any) => c.noise_level <= 40);
      if (highNoise.length > 0 && lowNoise.length > 0) {
        const highNoisePain = highNoise.reduce((sum: number, c: any) => sum + (c.pain_level || 0), 0) / highNoise.length;
        const lowNoisePain = lowNoise.reduce((sum: number, c: any) => sum + (c.pain_level || 0), 0) / lowNoise.length;
        if (highNoisePain > lowNoisePain + 1) {
          insights.push({ metric: 'noise', finding: 'Higher noise levels correlate with increased pain reports', confidence: 'medium' });
        }
      }
    }

    res.json({ correlations: correlations.slice(0, 50), insights });
  } catch (err) { next(err); }
}

// ── Get Recommendations ───────────────────────────────────────────────────
export async function getRecommendations(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Get latest averages
    const { rows: zoneStats } = await query(
      `SELECT zone,
              AVG(noise_level) AS avg_noise,
              AVG(light_level) AS avg_light,
              AVG(temperature) AS avg_temp,
              AVG(humidity) AS avg_humidity
       FROM environmental_readings
       WHERE care_home_id = $1 AND recorded_at > NOW() - INTERVAL '24 hours'
       GROUP BY zone`,
      [careHomeId]
    );

    const recommendations = zoneStats.map((z: any) => {
      const recs: any[] = [];
      if (z.avg_temp && z.avg_temp > 24) recs.push({ type: 'temperature', priority: 'high', message: `${z.zone}: Temperature above optimal (${Math.round(z.avg_temp)}C). Aim for 18-22C.` });
      if (z.avg_temp && z.avg_temp < 18) recs.push({ type: 'temperature', priority: 'high', message: `${z.zone}: Temperature below optimal (${Math.round(z.avg_temp)}C). Increase heating.` });
      if (z.avg_noise && z.avg_noise > 55) recs.push({ type: 'noise', priority: 'medium', message: `${z.zone}: Noise levels elevated (${Math.round(z.avg_noise)}dB). Consider noise reduction measures.` });
      if (z.avg_humidity && z.avg_humidity > 70) recs.push({ type: 'humidity', priority: 'medium', message: `${z.zone}: Humidity high (${Math.round(z.avg_humidity)}%). Improve ventilation.` });
      if (z.avg_light && z.avg_light < 200) recs.push({ type: 'lighting', priority: 'low', message: `${z.zone}: Light levels low (${Math.round(z.avg_light)} lux). Increase for daytime alertness.` });
      return { zone: z.zone, recommendations: recs };
    });

    res.json(recommendations);
  } catch (err) { next(err); }
}
