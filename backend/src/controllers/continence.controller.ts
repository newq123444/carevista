// src/controllers/continence.controller.ts
// Continence Assessment Tool - logging, pattern analysis, and care planning
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Log Continence Event ──────────────────────────────────────────────────
export async function logContinenceEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const loggedBy = req.user!.id;
    const { residentId, eventType, eventTime, padStatus, location, notes } = req.body;

    if (!residentId || !eventType) {
      throw new AppError(400, 'residentId and eventType are required');
    }

    const { rows: [log] } = await query(
      `INSERT INTO continence_logs (
        care_home_id, resident_id, logged_by,
        event_type, event_time, pad_status, location, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        careHomeId, residentId, loggedBy,
        eventType, eventTime || new Date().toISOString(), padStatus || null,
        location || null, notes || null,
      ]
    );

    res.status(201).json(log);
  } catch (err) { next(err); }
}

// ── Get Resident Log ──────────────────────────────────────────────────────
export async function getResidentLog(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;
    const { days = '7' } = req.query;

    const { rows } = await query(
      `SELECT cl.*,
        u.first_name || ' ' || u.last_name AS logged_by_name
       FROM continence_logs cl
       JOIN users u ON u.id = cl.logged_by
       WHERE cl.care_home_id = $1 AND cl.resident_id = $2
         AND cl.event_time > NOW() - ($3 || ' days')::INTERVAL
       ORDER BY cl.event_time DESC`,
      [careHomeId, residentId, days]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Pattern Analysis ──────────────────────────────────────────────────
export async function getPatternAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;

    // Aggregate events by hour of day over the last 14 days
    const { rows: hourlyData } = await query(
      `SELECT
        EXTRACT(HOUR FROM event_time)::INTEGER AS hour,
        COUNT(*) FILTER (WHERE event_type = 'continent') AS continent_count,
        COUNT(*) FILTER (WHERE event_type LIKE 'incontinent%') AS incontinent_count,
        COUNT(*) AS total_events
       FROM continence_logs
       WHERE care_home_id = $1 AND resident_id = $2
         AND event_time > NOW() - INTERVAL '14 days'
       GROUP BY EXTRACT(HOUR FROM event_time)
       ORDER BY hour`,
      [careHomeId, residentId]
    );

    // Find hours with highest incontinence for suggested toileting times
    const suggestedToiletingTimes = hourlyData
      .filter((h: any) => parseInt(h.incontinent_count) > 0)
      .sort((a: any, b: any) => parseInt(b.incontinent_count) - parseInt(a.incontinent_count))
      .slice(0, 5)
      .map((h: any) => ({
        hour: h.hour,
        incontinent_count: parseInt(h.incontinent_count),
        suggestion: `Schedule toileting support around ${h.hour}:00`,
      }));

    res.json({
      hourlyData: hourlyData.map((h: any) => ({
        hour: h.hour,
        continent_count: parseInt(h.continent_count),
        incontinent_count: parseInt(h.incontinent_count),
        total_events: parseInt(h.total_events),
      })),
      suggestedToiletingTimes,
    });
  } catch (err) { next(err); }
}

// ── Create/Update Assessment ──────────────────────────────────────────────
export async function createAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const assessedBy = req.user!.id;
    const {
      residentId,
      patternAnalysis,
      recommendedSchedule,
      padType,
      currentPadUsage,
      targetPadUsage,
      dignityNotes,
      reviewDate,
    } = req.body;

    if (!residentId) {
      throw new AppError(400, 'residentId is required');
    }

    // Upsert by resident_id and care_home_id - check if exists first
    const { rows: [existing] } = await query(
      `SELECT id FROM continence_assessments WHERE care_home_id = $1 AND resident_id = $2`,
      [careHomeId, residentId]
    );

    let assessment;
    if (existing) {
      const { rows: [updated] } = await query(
        `UPDATE continence_assessments SET
          assessed_by = $1,
          pattern_analysis = $2,
          recommended_schedule = $3,
          pad_type = $4,
          current_pad_usage = $5,
          target_pad_usage = $6,
          dignity_notes = $7,
          review_date = $8,
          updated_at = NOW()
        WHERE id = $9 AND care_home_id = $10
        RETURNING *`,
        [
          assessedBy,
          patternAnalysis ? JSON.stringify(patternAnalysis) : null,
          recommendedSchedule ? JSON.stringify(recommendedSchedule) : null,
          padType || null, currentPadUsage || null, targetPadUsage || null,
          dignityNotes || null, reviewDate || null,
          existing.id, careHomeId,
        ]
      );
      assessment = updated;
    } else {
      const { rows: [inserted] } = await query(
        `INSERT INTO continence_assessments (
          care_home_id, resident_id, assessed_by,
          pattern_analysis, recommended_schedule,
          pad_type, current_pad_usage, target_pad_usage,
          dignity_notes, review_date
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *`,
        [
          careHomeId, residentId, assessedBy,
          patternAnalysis ? JSON.stringify(patternAnalysis) : null,
          recommendedSchedule ? JSON.stringify(recommendedSchedule) : null,
          padType || null, currentPadUsage || null, targetPadUsage || null,
          dignityNotes || null, reviewDate || null,
        ]
      );
      assessment = inserted;
    }

    res.status(201).json(assessment);
  } catch (err) { next(err); }
}

// ── Get Assessment ────────────────────────────────────────────────────────
export async function getAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;

    const { rows: [assessment] } = await query(
      `SELECT ca.*,
        u.first_name || ' ' || u.last_name AS assessed_by_name
       FROM continence_assessments ca
       JOIN users u ON u.id = ca.assessed_by
       WHERE ca.care_home_id = $1 AND ca.resident_id = $2`,
      [careHomeId, residentId]
    );

    if (!assessment) {
      return res.status(404).json({ error: 'No assessment found for this resident' });
    }

    res.json(assessment);
  } catch (err) { next(err); }
}

// ── Get Home Overview ─────────────────────────────────────────────────────
export async function getHomeOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Total residents with logs
    const { rows: [logStats] } = await query(
      `SELECT
        COUNT(DISTINCT resident_id) AS residents_with_logs,
        COUNT(*) FILTER (WHERE event_type = 'continent') AS continent_total,
        COUNT(*) FILTER (WHERE event_type LIKE 'incontinent%') AS incontinent_total
       FROM continence_logs
       WHERE care_home_id = $1
         AND event_time > NOW() - INTERVAL '7 days'`,
      [careHomeId]
    );

    const continentTotal = parseInt(logStats.continent_total) || 0;
    const incontinentTotal = parseInt(logStats.incontinent_total) || 0;
    const total = continentTotal + incontinentTotal;
    const avgContinentPercentage = total > 0 ? Math.round((continentTotal / total) * 100) : 0;

    // Total pad changes this week
    const { rows: [padStats] } = await query(
      `SELECT COUNT(*) AS pad_changes
       FROM continence_logs
       WHERE care_home_id = $1
         AND event_type = 'pad_change'
         AND event_time > NOW() - INTERVAL '7 days'`,
      [careHomeId]
    );

    // Residents needing review (assessments older than 30 days or no assessment)
    const { rows: [reviewStats] } = await query(
      `SELECT COUNT(DISTINCT cl.resident_id) AS needs_review
       FROM continence_logs cl
       LEFT JOIN continence_assessments ca
         ON ca.resident_id = cl.resident_id AND ca.care_home_id = cl.care_home_id
       WHERE cl.care_home_id = $1
         AND cl.event_time > NOW() - INTERVAL '7 days'
         AND (ca.id IS NULL OR ca.updated_at < NOW() - INTERVAL '30 days')`,
      [careHomeId]
    );

    res.json({
      residentsWithLogs: parseInt(logStats.residents_with_logs) || 0,
      avgContinentPercentage,
      padChangesThisWeek: parseInt(padStats.pad_changes) || 0,
      residentsNeedingReview: parseInt(reviewStats.needs_review) || 0,
    });
  } catch (err) { next(err); }
}
