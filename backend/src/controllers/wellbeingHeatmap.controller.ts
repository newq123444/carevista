// src/controllers/wellbeingHeatmap.controller.ts
// Real-time Wellbeing Heatmap - Room-by-room wellbeing visualization
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// ── Get Heatmap ───────────────────────────────────────────────────────────
export async function getHeatmap(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Get all active residents with their latest wellbeing data
    const { rows: residents } = await query(
      `SELECT r.id, r.first_name, r.last_name, r.room_number, r.risk_level,
              r.wellbeing_score, r.mobility_status,
              wl.mood, wl.pain_level, wl.engagement_level, wl.logged_at AS last_wellbeing_log
       FROM residents r
       LEFT JOIN LATERAL (
         SELECT mood, pain_level, engagement_level, logged_at
         FROM wellbeing_logs
         WHERE resident_id = r.id AND care_home_id = $1
         ORDER BY logged_at DESC LIMIT 1
       ) wl ON true
       WHERE r.care_home_id = $1 AND r.active = TRUE
       ORDER BY r.room_number`,
      [careHomeId]
    );

    // Calculate room status based on wellbeing data
    const heatmapData = residents.map((r: any) => {
      let status: 'green' | 'amber' | 'red' | 'no_data' = 'green';
      let statusLabel = 'Settled';

      // Check for stale or missing data (no log in the last 24 hours)
      const lastLog = r.last_wellbeing_log ? new Date(r.last_wellbeing_log).getTime() : null;
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

      if (!lastLog || lastLog < twentyFourHoursAgo) {
        status = 'no_data';
        statusLabel = 'No recent data';
      } else if (r.pain_level && r.pain_level >= 7) { status = 'red'; statusLabel = 'In pain'; }
      else if (r.mood === 'distressed' || r.mood === 'agitated') { status = 'red'; statusLabel = 'Distressed'; }
      else if (r.mood === 'anxious' || r.mood === 'low') { status = 'amber'; statusLabel = 'Needs attention'; }
      else if (r.pain_level && r.pain_level >= 4) { status = 'amber'; statusLabel = 'Mild discomfort'; }
      else if (r.engagement_level === 'disengaged') { status = 'amber'; statusLabel = 'Disengaged'; }
      else if (r.mood === 'happy' || r.mood === 'content') { status = 'green'; statusLabel = 'Happy/Settled'; }

      return {
        resident_id: r.id,
        resident_name: `${r.first_name} ${r.last_name}`,
        room_number: r.room_number,
        status,
        status_label: statusLabel,
        mood: r.mood || 'unknown',
        pain_level: r.pain_level || 0,
        engagement: r.engagement_level || 'unknown',
        risk_level: r.risk_level,
        wellbeing_score: r.wellbeing_score,
        last_updated: r.last_wellbeing_log,
      };
    });

    // Summary stats
    const summary = {
      total: heatmapData.length,
      green: heatmapData.filter((h: any) => h.status === 'green').length,
      amber: heatmapData.filter((h: any) => h.status === 'amber').length,
      red: heatmapData.filter((h: any) => h.status === 'red').length,
      no_data: heatmapData.filter((h: any) => h.status === 'no_data').length,
      last_updated: new Date().toISOString(),
    };

    res.json({ heatmap: heatmapData, summary });
  } catch (err) { next(err); }
}

// ── Get Heatmap History ───────────────────────────────────────────────────
export async function getHeatmapHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { hours } = req.query;
    const parsed = parseInt(hours as string, 10);
    const lookbackHours = Number.isFinite(parsed) && parsed > 0 ? parsed : 24;

    const { rows } = await query(
      `SELECT wl.resident_id, r.room_number, r.first_name || ' ' || r.last_name AS resident_name,
              wl.mood, wl.pain_level, wl.engagement_level, wl.logged_at
       FROM wellbeing_logs wl
       JOIN residents r ON r.id = wl.resident_id
       WHERE wl.care_home_id = $1 AND wl.logged_at > NOW() - ($2 || ' hours')::interval
       ORDER BY wl.logged_at DESC`,
      [careHomeId, lookbackHours.toString()]
    );

    // Group by time intervals
    const snapshots: any[] = [];
    const intervalMs = 60 * 60 * 1000; // 1 hour intervals
    const now = Date.now();

    for (let i = 0; i < lookbackHours; i++) {
      const periodEnd = now - (i * intervalMs);
      const periodStart = periodEnd - intervalMs;
      const periodLogs = rows.filter((r: any) => {
        const logTime = new Date(r.logged_at).getTime();
        return logTime >= periodStart && logTime < periodEnd;
      });

      if (periodLogs.length > 0) {
        snapshots.push({
          timestamp: new Date(periodEnd).toISOString(),
          green: periodLogs.filter((l: any) => l.mood === 'happy' || l.mood === 'content').length,
          amber: periodLogs.filter((l: any) => l.mood === 'anxious' || l.mood === 'low').length,
          red: periodLogs.filter((l: any) => l.mood === 'distressed' || l.mood === 'agitated' || (l.pain_level && l.pain_level >= 7)).length,
          total: periodLogs.length,
        });
      }
    }

    res.json({ snapshots, total_logs: rows.length });
  } catch (err) { next(err); }
}

// ── Get Room Detail ───────────────────────────────────────────────────────
export async function getRoomDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { roomNumber } = req.params;

    const { rows: [resident] } = await query(
      `SELECT r.*, 
              (SELECT json_agg(json_build_object('mood', wl.mood, 'pain_level', wl.pain_level, 'engagement_level', wl.engagement_level, 'logged_at', wl.logged_at))
               FROM (SELECT * FROM wellbeing_logs WHERE resident_id = r.id ORDER BY logged_at DESC LIMIT 10) wl
              ) AS recent_wellbeing
       FROM residents r
       WHERE r.care_home_id = $1 AND r.room_number = $2 AND r.active = TRUE`,
      [careHomeId, roomNumber]
    );

    if (!resident) return res.status(404).json({ error: 'No active resident in this room' });
    res.json(resident);
  } catch (err) { next(err); }
}
