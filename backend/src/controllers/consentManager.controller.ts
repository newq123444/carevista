// src/controllers/consentManager.controller.ts
// Digital Consent Manager - Full consent lifecycle management
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// ── Create Consent ────────────────────────────────────────────────────────
export async function createConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, category, description, consentGivenBy, relationship, reviewDate, capacityAssessed, notes } = req.body;

    if (!residentId || !category) return res.status(400).json({ error: 'residentId and category required' });

    const { rows: [consent] } = await query(
      `INSERT INTO consent_records (care_home_id, resident_id, category, description, consent_given_by, relationship, review_date, capacity_assessed, notes, status, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10) RETURNING *`,
      [careHomeId, residentId, category, description, consentGivenBy, relationship, reviewDate, capacityAssessed || false, notes, req.user!.id]
    );
    res.status(201).json(consent);
  } catch (err) { next(err); }
}

// ── List Consents for Resident ────────────────────────────────────────────
export async function listConsents(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;

    const { rows } = await query(
      `SELECT cr.*, u.first_name || ' ' || u.last_name AS recorded_by_name
       FROM consent_records cr
       JOIN users u ON u.id = cr.recorded_by
       WHERE cr.care_home_id = $1 AND cr.resident_id = $2
       ORDER BY cr.created_at DESC`,
      [careHomeId, residentId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Update Consent ────────────────────────────────────────────────────────
export async function updateConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { status, reviewDate, notes, consentGivenBy } = req.body;

    const { rows: [consent] } = await query(
      `UPDATE consent_records SET status = COALESCE($1, status), review_date = COALESCE($2, review_date),
       notes = COALESCE($3, notes), consent_given_by = COALESCE($4, consent_given_by), updated_at = NOW()
       WHERE id = $5 AND care_home_id = $6 RETURNING *`,
      [status, reviewDate, notes, consentGivenBy, id, careHomeId]
    );
    if (!consent) return res.status(404).json({ error: 'Consent record not found' });
    res.json(consent);
  } catch (err) { next(err); }
}

// ── Get Expiring Consents ─────────────────────────────────────────────────
export async function getExpiringConsents(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { days } = req.query;
    const parsed = parseInt(days as string, 10);
    const lookAhead = Number.isFinite(parsed) && parsed > 0 ? parsed : 30;

    const { rows } = await query(
      `SELECT cr.*, r.first_name || ' ' || r.last_name AS resident_name, r.room_number
       FROM consent_records cr
       JOIN residents r ON r.id = cr.resident_id
       WHERE cr.care_home_id = $1 AND cr.status = 'active'
       AND cr.review_date IS NOT NULL AND cr.review_date <= NOW() + ($2 || ' days')::interval
       ORDER BY cr.review_date ASC`,
      [careHomeId, lookAhead.toString()]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Record Capacity Assessment ────────────────────────────────────────────
export async function recordCapacityAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { hasCapacity, assessmentDetails, assessedBy } = req.body;

    const { rows: [assessment] } = await query(
      `INSERT INTO capacity_assessments (care_home_id, consent_id, has_capacity, assessment_details, assessed_by, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [careHomeId, id, hasCapacity, assessmentDetails, assessedBy || req.user!.id, req.user!.id]
    );

    // Update consent record
    await query(
      `UPDATE consent_records SET capacity_assessed = TRUE, updated_at = NOW() WHERE id = $1 AND care_home_id = $2`,
      [id, careHomeId]
    );

    res.status(201).json(assessment);
  } catch (err) { next(err); }
}
