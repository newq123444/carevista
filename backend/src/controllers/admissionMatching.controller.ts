// src/controllers/admissionMatching.controller.ts
// Predictive Admission Matching - AI analyzes referrals against home capabilities
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// ── Match Referral ────────────────────────────────────────────────────────
export async function matchReferral(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { referralId, careNeeds, medicalConditions, mobility, behavior, preferences } = req.body;

    if (!referralId && !careNeeds) {
      return res.status(400).json({ error: 'referralId or careNeeds required' });
    }

    // Get current home stats
    const { rows: [homeStats] } = await query(
      `SELECT COUNT(*) AS total_residents,
              COUNT(*) FILTER (WHERE active) AS active_residents,
              COUNT(*) FILTER (WHERE care_type = 'nursing') AS nursing_count,
              COUNT(*) FILTER (WHERE care_type = 'dementia') AS dementia_count,
              COUNT(*) FILTER (WHERE risk_level = 'high') AS high_risk_count
       FROM residents WHERE care_home_id = $1`,
      [careHomeId]
    );

    // Get staff capabilities
    const { rows: staffStats } = await query(
      `SELECT u.role, COUNT(*) AS count
       FROM users u WHERE u.care_home_id = $1 AND u.active = TRUE AND u.deleted_at IS NULL
       GROUP BY u.role`,
      [careHomeId]
    );

    const nurseCount = staffStats.find((s: any) => s.role === 'registered_nurse')?.count || 0;
    const carerCount = staffStats.filter((s: any) => ['carer', 'senior_carer'].includes(s.role))
      .reduce((sum: number, s: any) => sum + parseInt(s.count), 0);

    // Calculate matching scores
    const needs = careNeeds || {};
    let capabilityScore = 85;
    let staffScore = 80;
    let roomScore = 90;
    let compatibilityScore = 75;

    // Adjust based on care needs
    if (needs.nursingCare && parseInt(nurseCount) < 2) capabilityScore -= 30;
    if (needs.dementiaCare && parseInt(homeStats.dementia_count) > 10) compatibilityScore -= 15;
    if (mobility === 'bed_bound' && parseInt(nurseCount) < 3) staffScore -= 20;
    if (behavior === 'challenging' && parseInt(homeStats.high_risk_count) > 5) compatibilityScore -= 20;

    const overallScore = Math.round((capabilityScore + staffScore + roomScore + compatibilityScore) / 4);
    const recommendation = overallScore >= 70 ? 'accept' : overallScore >= 50 ? 'conditional' : 'decline';

    const reasoning = [
      { area: 'Capabilities', score: capabilityScore, detail: capabilityScore >= 70 ? 'Home can meet identified care needs' : 'Some care needs may exceed current capabilities' },
      { area: 'Staff Skills', score: staffScore, detail: staffScore >= 70 ? 'Sufficient qualified staff available' : 'Additional staff training may be needed' },
      { area: 'Room Suitability', score: roomScore, detail: roomScore >= 70 ? 'Appropriate rooms available' : 'Room adaptations may be required' },
      { area: 'Resident Mix', score: compatibilityScore, detail: compatibilityScore >= 70 ? 'Good compatibility with existing residents' : 'Potential compatibility concerns identified' },
    ];

    // Store the match result
    const { rows: [match] } = await query(
      `INSERT INTO admission_matches (care_home_id, referral_id, overall_score, recommendation, reasoning, care_needs, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [careHomeId, referralId || null, overallScore, recommendation, JSON.stringify(reasoning), JSON.stringify(needs), req.user!.id]
    );

    res.status(201).json({
      ...match,
      overall_score: overallScore,
      recommendation,
      reasoning,
      home_stats: { total_residents: homeStats.total_residents, active_residents: homeStats.active_residents, nurses: nurseCount, carers: carerCount },
    });
  } catch (err) { next(err); }
}

// ── List Referrals ────────────────────────────────────────────────────────
export async function listReferrals(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { status } = req.query;

    let sql = `SELECT * FROM admission_referrals WHERE care_home_id = $1`;
    const params: any[] = [careHomeId];
    if (status) { sql += ` AND status = $2`; params.push(status); }
    sql += ` ORDER BY created_at DESC LIMIT 50`;

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Create Referral ───────────────────────────────────────────────────────
export async function createReferral(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { name, dateOfBirth, referralSource, careNeeds, medicalHistory, mobility, behavior, preferences, urgency } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const { rows: [referral] } = await query(
      `INSERT INTO admission_referrals (care_home_id, name, date_of_birth, referral_source, care_needs, medical_history, mobility, behavior, preferences, urgency, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11) RETURNING *`,
      [careHomeId, name, dateOfBirth, referralSource, JSON.stringify(careNeeds || {}), medicalHistory, mobility, behavior, JSON.stringify(preferences || {}), urgency || 'routine', req.user!.id]
    );

    res.status(201).json(referral);
  } catch (err) { next(err); }
}

// ── Update Referral Status ────────────────────────────────────────────────
export async function updateReferralStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { status, decisionNotes } = req.body;

    const { rows: [referral] } = await query(
      `UPDATE admission_referrals SET status = $1, decision_notes = $2, decided_by = $3, decided_at = NOW()
       WHERE id = $4 AND care_home_id = $5 RETURNING *`,
      [status, decisionNotes, req.user!.id, id, careHomeId]
    );
    if (!referral) return res.status(404).json({ error: 'Referral not found' });
    res.json(referral);
  } catch (err) { next(err); }
}
