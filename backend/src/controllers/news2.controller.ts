// src/controllers/news2.controller.ts
// NEWS2 Auto-Calculator - NHS National Early Warning Score 2
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── NEWS2 Scoring Functions ───────────────────────────────────────────────

function scoreRespiratoryRate(rate: number): number {
  if (rate <= 8) return 3;
  if (rate >= 9 && rate <= 11) return 1;
  if (rate >= 12 && rate <= 20) return 0;
  if (rate >= 21 && rate <= 24) return 2;
  // >= 25
  return 3;
}

function scoreSpO2Scale1(spo2: number): number {
  if (spo2 >= 96) return 0;
  if (spo2 >= 94 && spo2 <= 95) return 1;
  if (spo2 >= 92 && spo2 <= 93) return 2;
  // <= 91
  return 3;
}

function scoreSpO2Scale2(spo2: number): number {
  if (spo2 >= 97) return 0;
  if (spo2 >= 95 && spo2 <= 96) return 1;
  if (spo2 >= 93 && spo2 <= 94) return 2;
  // <= 92
  return 3;
}

function scoreSupplementalOxygen(onOxygen: boolean): number {
  return onOxygen ? 2 : 0;
}

function scoreSystolicBp(bp: number): number {
  if (bp <= 90) return 3;
  if (bp >= 91 && bp <= 100) return 2;
  if (bp >= 101 && bp <= 110) return 1;
  if (bp >= 111 && bp <= 219) return 0;
  // >= 220
  return 3;
}

function scorePulse(pulse: number): number {
  if (pulse <= 40) return 3;
  if (pulse >= 41 && pulse <= 50) return 1;
  if (pulse >= 51 && pulse <= 90) return 0;
  if (pulse >= 91 && pulse <= 110) return 1;
  if (pulse >= 111 && pulse <= 130) return 2;
  // >= 131
  return 3;
}

function scoreConsciousness(consciousness: string): number {
  return consciousness.toLowerCase() === 'alert' ? 0 : 3;
}

function scoreTemperature(temp: number): number {
  if (temp <= 35.0) return 3;
  if (temp >= 35.1 && temp <= 36.0) return 1;
  if (temp >= 36.1 && temp <= 38.0) return 0;
  if (temp >= 38.1 && temp <= 39.0) return 1;
  // >= 39.1
  return 2;
}

// ── Calculate NEWS2 Score ─────────────────────────────────────────────────
export async function calculateNews2Score(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const assessedBy = req.user!.id;
    const {
      residentId,
      respiratoryRate,
      spo2,
      supplementalOxygen,
      systolicBp,
      pulse,
      consciousness,
      temperature,
      notes,
    } = req.body;

    if (!residentId || respiratoryRate == null || spo2 == null || supplementalOxygen == null ||
        systolicBp == null || pulse == null || !consciousness || temperature == null) {
      throw new AppError(400, 'All vital signs are required');
    }

    // Calculate individual scores
    const respScore = scoreRespiratoryRate(respiratoryRate);
    const spo2Score = supplementalOxygen
      ? scoreSpO2Scale2(spo2)
      : scoreSpO2Scale1(spo2);
    const oxygenScore = scoreSupplementalOxygen(supplementalOxygen);
    const bpScore = scoreSystolicBp(systolicBp);
    const pulseScore = scorePulse(pulse);
    const consciousnessScore = scoreConsciousness(consciousness);
    const tempScore = scoreTemperature(temperature);

    const totalScore = respScore + spo2Score + oxygenScore + bpScore + pulseScore + consciousnessScore + tempScore;

    // Check if any single parameter scores 3 (critical trigger)
    const hasCriticalParameter = [respScore, spo2Score, bpScore, pulseScore, consciousnessScore, tempScore].some(s => s === 3);

    // Determine risk level
    let riskLevel: string;
    if (totalScore >= 7) {
      riskLevel = 'high';
    } else if (hasCriticalParameter) {
      riskLevel = 'critical';
    } else if (totalScore >= 5) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    // Determine escalation action
    let escalationAction: string | null = null;
    if (totalScore >= 7) {
      escalationAction = 'Contact nurse in charge immediately. Consider 999.';
    } else if (totalScore >= 5) {
      escalationAction = 'Urgent clinical review required. Notify nurse in charge.';
    }

    // Insert assessment
    const { rows: [assessment] } = await query(
      `INSERT INTO news2_assessments (
        care_home_id, resident_id, assessed_by,
        respiratory_rate, spo2, supplemental_oxygen,
        systolic_bp, pulse, consciousness, temperature,
        total_score, risk_level, escalation_action, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        careHomeId, residentId, assessedBy,
        respiratoryRate, spo2, supplementalOxygen,
        systolicBp, pulse, consciousness, temperature,
        totalScore, riskLevel, escalationAction, notes || null,
      ]
    );

    // Auto-create escalation if score >= 5
    let escalation = null;
    if (totalScore >= 5) {
      const escalationLevel = totalScore >= 7 ? 'high' : 'medium';
      const { rows: [esc] } = await query(
        `INSERT INTO news2_escalations (
          care_home_id, assessment_id, resident_id,
          escalation_level, action_taken, status
        ) VALUES ($1,$2,$3,$4,$5,'pending')
        RETURNING *`,
        [
          careHomeId, assessment.id, residentId,
          escalationLevel, escalationAction,
        ]
      );
      escalation = esc;

      // Update assessment escalation_triggered_at
      await query(
        `UPDATE news2_assessments SET escalation_triggered_at = NOW() WHERE id = $1`,
        [assessment.id]
      );
    }

    res.status(201).json({
      assessment: {
        ...assessment,
        risk_level: riskLevel,
        total_score: totalScore,
      },
      escalation,
      scoring: {
        respiratory_rate: respScore,
        spo2: spo2Score,
        supplemental_oxygen: oxygenScore,
        systolic_bp: bpScore,
        pulse: pulseScore,
        consciousness: consciousnessScore,
        temperature: tempScore,
      },
    });
  } catch (err) { next(err); }
}

// ── Get Assessment History ────────────────────────────────────────────────
export async function getAssessmentHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.query;

    if (!residentId) {
      throw new AppError(400, 'residentId query parameter is required');
    }

    const { rows } = await query(
      `SELECT na.*,
        u.first_name || ' ' || u.last_name AS assessed_by_name
       FROM news2_assessments na
       JOIN users u ON u.id = na.assessed_by
       WHERE na.care_home_id = $1 AND na.resident_id = $2
       ORDER BY na.created_at DESC`,
      [careHomeId, residentId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Escalation History ────────────────────────────────────────────────
export async function getEscalationHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, status } = req.query;

    let where = 'WHERE ne.care_home_id = $1';
    const params: any[] = [careHomeId];
    let p = 2;

    if (residentId) {
      where += ` AND ne.resident_id = $${p++}`;
      params.push(residentId);
    }
    if (status) {
      where += ` AND ne.status = $${p++}`;
      params.push(status);
    }

    const { rows } = await query(
      `SELECT ne.*,
        r.first_name || ' ' || r.last_name AS resident_name,
        resp.first_name || ' ' || resp.last_name AS responder_name
       FROM news2_escalations ne
       JOIN residents r ON r.id = ne.resident_id
       LEFT JOIN users resp ON resp.id = ne.responded_by
       ${where}
       ORDER BY ne.created_at DESC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Respond to Escalation ─────────────────────────────────────────────────
export async function respondToEscalation(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { actionTaken, status } = req.body;
    const respondedBy = req.user!.id;

    const { rows: [escalation] } = await query(
      `UPDATE news2_escalations
       SET responded_by = $1, responded_at = NOW(), action_taken = $2, status = $3
       WHERE id = $4 AND care_home_id = $5
       RETURNING *`,
      [respondedBy, actionTaken, status || 'acknowledged', id, careHomeId]
    );

    if (!escalation) {
      throw new AppError(404, 'Escalation not found');
    }

    res.json(escalation);
  } catch (err) { next(err); }
}

// ── Get Resident Trend ────────────────────────────────────────────────────
export async function getResidentTrend(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, days = '30' } = req.query;

    if (!residentId) {
      throw new AppError(400, 'residentId query parameter is required');
    }

    const { rows } = await query(
      `SELECT created_at AS date, total_score, risk_level
       FROM news2_assessments
       WHERE care_home_id = $1 AND resident_id = $2
         AND created_at > NOW() - ($3 || ' days')::INTERVAL
       ORDER BY created_at ASC`,
      [careHomeId, residentId, days]
    );

    res.json(rows);
  } catch (err) { next(err); }
}
