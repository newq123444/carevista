// src/controllers/digitalTwin.controller.ts
// Resident Digital Twin - Comprehensive unified resident view
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// ── Get Digital Twin ──────────────────────────────────────────────────────
export async function getDigitalTwin(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;

    // Core resident data
    const { rows: [resident] } = await query(
      `SELECT * FROM residents WHERE id = $1 AND care_home_id = $2`,
      [residentId, careHomeId]
    );
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    // Recent care notes
    const { rows: recentNotes } = await query(
      `SELECT id, note_type, content, created_at FROM care_notes
       WHERE resident_id = $1 AND care_home_id = $2 AND deleted_at IS NULL
       ORDER BY created_at DESC LIMIT 10`,
      [residentId, careHomeId]
    );

    // Wellbeing trend (last 7 days) - wrapped in try/catch for resilience
    // engagement_level and logged_at may not exist if migration 014 hasn't been applied
    let wellbeingTrend: any[] = [];
    try {
      const { rows } = await query(
        `SELECT mood, pain_level, engagement_level, logged_at
         FROM wellbeing_logs WHERE resident_id = $1 AND care_home_id = $2
         AND logged_at > NOW() - INTERVAL '7 days' ORDER BY logged_at DESC`,
        [residentId, careHomeId]
      );
      wellbeingTrend = rows;
    } catch (e: any) {
      // Only fall back if the error is about a missing column/relation
      if (e?.message?.includes('does not exist')) {
        try {
          const { rows } = await query(
            `SELECT mood, pain_level, created_at AS logged_at
             FROM wellbeing_logs WHERE resident_id = $1 AND care_home_id = $2
             AND created_at > NOW() - INTERVAL '7 days' ORDER BY created_at DESC`,
            [residentId, careHomeId]
          );
          wellbeingTrend = rows;
        } catch (fallbackErr: any) {
          // Only swallow "does not exist" errors; re-throw others
          if (!fallbackErr?.message?.includes('does not exist')) throw fallbackErr;
        }
      } else {
        throw e;
      }
    }

    // Incidents
    let recentIncidents: any[] = [];
    try {
      const { rows } = await query(
        `SELECT id, incident_type, severity, status, incident_date FROM incidents
         WHERE resident_id = $1 AND care_home_id = $2
         ORDER BY incident_date DESC LIMIT 5`,
        [residentId, careHomeId]
      );
      recentIncidents = rows;
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
    }

    // Medications
    let medications: any[] = [];
    try {
      const { rows } = await query(
        `SELECT name AS medication_name, dose, route, frequency, active FROM medications
         WHERE resident_id = $1 AND care_home_id = $2 AND active = TRUE`,
        [residentId, careHomeId]
      );
      medications = rows;
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
    }

    // Key relationships (key worker)
    let keyWorker: any[] = [];
    try {
      const { rows } = await query(
        `SELECT u.first_name, u.last_name, u.role FROM users u
         WHERE u.id = $1 AND u.care_home_id = $2`,
        [resident.key_worker_id, careHomeId]
      );
      keyWorker = rows;
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
    }

    // Risk indicators
    const riskIndicators = [];
    if (resident.risk_level === 'high') riskIndicators.push({ type: 'falls', level: 'high', detail: 'High falls risk' });
    if (resident.dnacpr) riskIndicators.push({ type: 'dnacpr', level: 'info', detail: 'DNACPR in place' });
    if (resident.allergies) riskIndicators.push({ type: 'allergy', level: 'warning', detail: `Allergies: ${resident.allergies}` });

    const digitalTwin = {
      personal: {
        id: resident.id,
        name: `${resident.first_name} ${resident.last_name}`,
        date_of_birth: resident.date_of_birth,
        room_number: resident.room_number,
        admission_date: resident.admission_date,
        care_type: resident.care_type,
        nhs_number: resident.nhs_number,
        photo_url: resident.photo_url,
      },
      medical: {
        medications,
        allergies: resident.allergies,
        dietary_requirements: resident.dietary_requirements,
        mobility_status: resident.mobility_status,
        risk_level: resident.risk_level,
        dnacpr: resident.dnacpr,
        gp: { name: resident.gp_name, phone: resident.gp_phone },
      },
      social: {
        interests: resident.interests || [],
        key_worker: keyWorker[0] || null,
        funding_type: resident.funding_type,
      },
      emotional: {
        current_wellbeing_score: resident.wellbeing_score,
        recent_moods: wellbeingTrend.slice(0, 5).map((w: any) => ({ mood: w.mood, date: w.logged_at })),
        wellbeing_trend: wellbeingTrend,
      },
      risk_indicators: riskIndicators,
      recent_events: {
        care_notes: recentNotes,
        incidents: recentIncidents,
      },
      last_updated: new Date().toISOString(),
    };

    res.json(digitalTwin);
  } catch (err) { next(err); }
}

// ── Get Timeline ──────────────────────────────────────────────────────────
export async function getTimeline(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;
    const { days } = req.query;
    const parsed = parseInt(days as string, 10);
    const lookback = Number.isFinite(parsed) && parsed > 0 ? parsed : 30;

    // Gather events from multiple sources
    const { rows: notes } = await query(
      `SELECT 'care_note' AS event_type, id, note_type AS sub_type, content AS detail, created_at AS event_date
       FROM care_notes WHERE resident_id = $1 AND care_home_id = $2 AND deleted_at IS NULL
       AND created_at > NOW() - ($3 || ' days')::interval`,
      [residentId, careHomeId, lookback.toString()]
    );

    const { rows: incidents } = await query(
      `SELECT 'incident' AS event_type, id, incident_type AS sub_type, description AS detail, incident_date AS event_date
       FROM incidents WHERE resident_id = $1 AND care_home_id = $2
       AND incident_date > NOW() - ($3 || ' days')::interval`,
      [residentId, careHomeId, lookback.toString()]
    );

    let wellbeingLogs: any[] = [];
    try {
      const { rows } = await query(
        `SELECT 'wellbeing' AS event_type, id, mood AS sub_type, 
                'Pain: ' || pain_level || ', Engagement: ' || engagement_level AS detail, logged_at AS event_date
         FROM wellbeing_logs WHERE resident_id = $1 AND care_home_id = $2
         AND logged_at > NOW() - ($3 || ' days')::interval`,
        [residentId, careHomeId, lookback.toString()]
      );
      wellbeingLogs = rows;
    } catch (e: any) {
      // Only fall back if the error is about a missing column/relation
      if (e?.message?.includes('does not exist')) {
        try {
          const { rows } = await query(
            `SELECT 'wellbeing' AS event_type, id, mood AS sub_type,
                    'Pain: ' || pain_level AS detail, created_at AS event_date
             FROM wellbeing_logs WHERE resident_id = $1 AND care_home_id = $2
             AND created_at > NOW() - ($3 || ' days')::interval`,
            [residentId, careHomeId, lookback.toString()]
          );
          wellbeingLogs = rows;
        } catch (fallbackErr: any) {
          // Only swallow "does not exist" errors; re-throw others
          if (!fallbackErr?.message?.includes('does not exist')) throw fallbackErr;
        }
      } else {
        throw e;
      }
    }

    // Merge and sort chronologically
    const timeline = [...notes, ...incidents, ...wellbeingLogs]
      .sort((a: any, b: any) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
      .slice(0, 100);

    res.json(timeline);
  } catch (err) { next(err); }
}
