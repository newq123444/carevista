// src/controllers/riskAssessments.controller.ts
// Automated Risk Assessments - Waterlow, MUST, Falls scoring
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// ── Calculate Waterlow Score ──────────────────────────────────────────────
export async function calculateWaterlow(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId } = req.body;

    if (!residentId) {
      return res.status(400).json({ error: 'residentId is required' });
    }

    // Verify resident
    const { rows: [resident] } = await query(
      `SELECT id, first_name, last_name, date_of_birth, mobility_status, room_number
       FROM residents WHERE id = $1 AND care_home_id = $2 AND active = TRUE`,
      [residentId, careHomeId]
    );
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    let totalScore = 0;
    const factors: Record<string, any> = {};

    // 1. Age scoring
    const dob = new Date(resident.date_of_birth);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    let ageScore = 0;
    if (age >= 80) ageScore = 5;
    else if (age >= 75) ageScore = 4;
    else if (age >= 65) ageScore = 3;
    else if (age >= 50) ageScore = 2;
    else if (age >= 14) ageScore = 1;
    totalScore += ageScore;
    factors.age = { value: age, score: ageScore };

    // 2. Build/BMI - check last weight
    const { rows: weightRows } = await query(
      `SELECT weight_kg, bmi FROM resident_weights
       WHERE resident_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [residentId]
    );
    let buildScore = 0; // default: average
    if (weightRows.length > 0) {
      const bmi = parseFloat(weightRows[0].bmi);
      if (!isNaN(bmi)) {
        if (bmi < 18.5) buildScore = 3; // below average
        else if (bmi >= 18.5 && bmi < 25) buildScore = 0; // average
        else if (bmi >= 25 && bmi < 30) buildScore = 1; // above average
        else buildScore = 2; // obese
      }
    }
    totalScore += buildScore;
    factors.build = { bmi: weightRows.length > 0 ? weightRows[0].bmi : null, score: buildScore };

    // 3. Skin type - check wound assessments and care notes
    let skinScore = 0;
    const { rows: wounds } = await query(
      `SELECT status, surrounding_skin FROM wound_assessments
       WHERE resident_id = $1 AND care_home_id = $2 AND status IN ('active', 'worsening')
       ORDER BY created_at DESC LIMIT 5`,
      [residentId, careHomeId]
    );
    if (wounds.length > 0) {
      const hasBroken = wounds.some((w: any) => w.status === 'worsening' || (w.surrounding_skin && w.surrounding_skin.toLowerCase().includes('broken')));
      const hasDiscoloured = wounds.some((w: any) => w.surrounding_skin && w.surrounding_skin.toLowerCase().includes('discolour'));
      if (hasBroken) skinScore = 3;
      else if (hasDiscoloured) skinScore = 2;
      else skinScore = 1; // dry/tissue paper/oedematous/clammy
    }
    totalScore += skinScore;
    factors.skin = { activeWounds: wounds.length, score: skinScore };

    // 4. Mobility - from residents.mobility_status
    let mobilityScore = 0;
    const mobility = resident.mobility_status || 'independent';
    if (mobility === 'independent') mobilityScore = 0;
    else if (mobility === 'walking_aid') mobilityScore = 1;
    else if (mobility === 'wheelchair') mobilityScore = 2;
    else if (mobility === 'bed_bound') mobilityScore = 3;
    totalScore += mobilityScore;
    factors.mobility = { status: mobility, score: mobilityScore };

    // 5. Continence - check continence logs
    let continenceScore = 0;
    const { rows: continenceLogs } = await query(
      `SELECT event_type, COUNT(*) AS cnt
       FROM continence_logs
       WHERE resident_id = $1 AND care_home_id = $2
         AND event_time > NOW() - INTERVAL '7 days'
       GROUP BY event_type`,
      [residentId, careHomeId]
    );
    const continenceMap: Record<string, number> = {};
    continenceLogs.forEach((cl: any) => { continenceMap[cl.event_type] = parseInt(cl.cnt); });
    if (continenceMap['incontinent_both']) continenceScore = 2;
    else if (continenceMap['incontinent_urine'] || continenceMap['incontinent_faeces']) continenceScore = 1;
    // Check for catheter in care notes
    const { rows: catheterNotes } = await query(
      `SELECT id FROM care_notes
       WHERE resident_id = $1 AND care_home_id = $2 AND deleted_at IS NULL
         AND content ILIKE '%catheter%'
       LIMIT 1`,
      [residentId, careHomeId]
    );
    if (catheterNotes.length > 0 && continenceScore < 1) continenceScore = 1;
    totalScore += continenceScore;
    factors.continence = { score: continenceScore, recentEvents: continenceMap };

    // 6. Appetite - check nutrition notes and wellbeing logs
    let appetiteScore = 0;
    const { rows: nutritionNotes } = await query(
      `SELECT food_eaten_percent FROM care_notes
       WHERE resident_id = $1 AND care_home_id = $2
         AND note_type = 'nutrition' AND deleted_at IS NULL
         AND food_eaten_percent IS NOT NULL
         AND created_at > NOW() - INTERVAL '7 days'
       ORDER BY created_at DESC LIMIT 7`,
      [residentId, careHomeId]
    );
    if (nutritionNotes.length > 0) {
      const avgFood = nutritionNotes.reduce((sum: number, n: any) => sum + (parseInt(n.food_eaten_percent) || 0), 0) / nutritionNotes.length;
      if (avgFood < 25) appetiteScore = 2; // very poor / NG tube
      else if (avgFood < 50) appetiteScore = 1; // poor
      // else average = 0
    }
    totalScore += appetiteScore;
    factors.appetite = { avgFoodPercent: nutritionNotes.length > 0 ? Math.round(nutritionNotes.reduce((s: number, n: any) => s + (parseInt(n.food_eaten_percent) || 0), 0) / nutritionNotes.length) : null, score: appetiteScore };

    // 7. Medications - steroids, anti-inflammatory, anticoagulants
    let medicationScore = 0;
    const { rows: meds } = await query(
      `SELECT name FROM medications
       WHERE resident_id = $1 AND care_home_id = $2 AND active = TRUE
         AND (
           name ILIKE '%prednisolone%' OR name ILIKE '%dexamethasone%' OR name ILIKE '%hydrocortisone%'
           OR name ILIKE '%ibuprofen%' OR name ILIKE '%naproxen%' OR name ILIKE '%diclofenac%'
           OR name ILIKE '%warfarin%' OR name ILIKE '%rivaroxaban%' OR name ILIKE '%apixaban%'
           OR name ILIKE '%edoxaban%' OR name ILIKE '%dabigatran%' OR name ILIKE '%heparin%'
           OR name ILIKE '%enoxaparin%'
         )`,
      [residentId, careHomeId]
    );
    if (meds.length > 0) medicationScore = 4;
    totalScore += medicationScore;
    factors.medications = { riskMedications: meds.map((m: any) => m.name), score: medicationScore };

    // Score interpretation
    let riskLevel: string;
    if (totalScore >= 20) riskLevel = 'very_high';
    else if (totalScore >= 15) riskLevel = 'high';
    else if (totalScore >= 10) riskLevel = 'medium';
    else riskLevel = 'low';

    // Mark previous waterlow assessments as superseded
    await query(
      `UPDATE risk_assessments SET status = 'superseded', updated_at = NOW()
       WHERE resident_id = $1 AND care_home_id = $2 AND assessment_type = 'waterlow' AND status = 'current'`,
      [residentId, careHomeId]
    );

    // Insert new assessment
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 7);

    const { rows: [assessment] } = await query(
      `INSERT INTO risk_assessments (care_home_id, resident_id, assessed_by, assessment_type, total_score, risk_level, factors, auto_populated, next_review_date, status)
       VALUES ($1, $2, $3, 'waterlow', $4, $5, $6, TRUE, $7, 'current') RETURNING *`,
      [careHomeId, residentId, userId, totalScore, riskLevel, JSON.stringify(factors), nextReview.toISOString().slice(0, 10)]
    );

    res.status(201).json({
      assessment,
      residentName: `${resident.first_name} ${resident.last_name}`,
      room: resident.room_number,
      factors,
    });
  } catch (err) { next(err); }
}

// ── Calculate MUST Score ──────────────────────────────────────────────────
export async function calculateMUST(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId, bmiScore, weightLossScore, acuteDiseaseScore } = req.body;

    if (!residentId || bmiScore === undefined || weightLossScore === undefined || acuteDiseaseScore === undefined) {
      return res.status(400).json({ error: 'residentId, bmiScore, weightLossScore, and acuteDiseaseScore are required' });
    }

    // Verify resident
    const { rows: [resident] } = await query(
      `SELECT id, first_name, last_name, room_number FROM residents WHERE id = $1 AND care_home_id = $2 AND active = TRUE`,
      [residentId, careHomeId]
    );
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    // Validate scores
    const bmi = Math.max(0, Math.min(2, parseInt(bmiScore) || 0)); // >20=0, 18.5-20=1, <18.5=2
    const weightLoss = Math.max(0, Math.min(2, parseInt(weightLossScore) || 0)); // <5%=0, 5-10%=1, >10%=2
    const acuteDisease = Math.max(0, Math.min(2, parseInt(acuteDiseaseScore) || 0)); // no=0, yes=2

    const totalScore = bmi + weightLoss + acuteDisease;

    // Score interpretation
    let riskLevel: string;
    if (totalScore >= 2) riskLevel = 'high';
    else if (totalScore === 1) riskLevel = 'medium';
    else riskLevel = 'low';

    const factors = {
      bmiScore: bmi,
      weightLossScore: weightLoss,
      acuteDiseaseScore: acuteDisease,
    };

    // Mark previous MUST assessments as superseded
    await query(
      `UPDATE risk_assessments SET status = 'superseded', updated_at = NOW()
       WHERE resident_id = $1 AND care_home_id = $2 AND assessment_type = 'must' AND status = 'current'`,
      [residentId, careHomeId]
    );

    // Insert new assessment
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 7);

    const { rows: [assessment] } = await query(
      `INSERT INTO risk_assessments (care_home_id, resident_id, assessed_by, assessment_type, total_score, risk_level, factors, auto_populated, next_review_date, status)
       VALUES ($1, $2, $3, 'must', $4, $5, $6, FALSE, $7, 'current') RETURNING *`,
      [careHomeId, residentId, userId, totalScore, riskLevel, JSON.stringify(factors), nextReview.toISOString().slice(0, 10)]
    );

    res.status(201).json({
      assessment,
      residentName: `${resident.first_name} ${resident.last_name}`,
      room: resident.room_number,
      factors,
    });
  } catch (err) { next(err); }
}

// ── Calculate Falls Risk ──────────────────────────────────────────────────
export async function calculateFallsRisk(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId } = req.body;

    if (!residentId) {
      return res.status(400).json({ error: 'residentId is required' });
    }

    // Verify resident
    const { rows: [resident] } = await query(
      `SELECT id, first_name, last_name, date_of_birth, mobility_status, room_number
       FROM residents WHERE id = $1 AND care_home_id = $2 AND active = TRUE`,
      [residentId, careHomeId]
    );
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    let totalScore = 0;
    const factors: Record<string, any> = {};

    // 1. Previous falls in last 90 days
    const { rows: [fallsData] } = await query(
      `SELECT COUNT(*) AS falls_count FROM incidents
       WHERE resident_id = $1 AND care_home_id = $2
         AND incident_type ILIKE '%fall%'
         AND incident_date > NOW() - INTERVAL '90 days'`,
      [residentId, careHomeId]
    );
    const fallsCount = parseInt(fallsData.falls_count) || 0;
    let fallsScore = 0;
    if (fallsCount >= 2) fallsScore = 4;
    else if (fallsCount === 1) fallsScore = 2;
    totalScore += fallsScore;
    factors.previousFalls = { count: fallsCount, score: fallsScore };

    // 2. Age
    const dob = new Date(resident.date_of_birth);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    let ageScore = 0;
    if (age >= 85) ageScore = 3;
    else if (age >= 75) ageScore = 2;
    else if (age >= 65) ageScore = 1;
    totalScore += ageScore;
    factors.age = { value: age, score: ageScore };

    // 3. Mobility
    const mobility = resident.mobility_status || 'independent';
    let mobilityScore = 0;
    if (mobility === 'independent') mobilityScore = 0;
    else if (mobility === 'walking_aid') mobilityScore = 2;
    else if (mobility === 'wheelchair') mobilityScore = 3;
    else if (mobility === 'bed_bound') mobilityScore = 1;
    totalScore += mobilityScore;
    factors.mobility = { status: mobility, score: mobilityScore };

    // 4. Medications (sedatives, antihypertensives, diuretics)
    const { rows: [medData] } = await query(
      `SELECT COUNT(*) AS med_count FROM medications
       WHERE resident_id = $1 AND care_home_id = $2 AND active = TRUE
         AND (
           name ILIKE '%diazepam%' OR name ILIKE '%zopiclone%' OR name ILIKE '%lorazepam%'
           OR name ILIKE '%temazepam%' OR name ILIKE '%nitrazepam%'
           OR name ILIKE '%amlodipine%' OR name ILIKE '%ramipril%' OR name ILIKE '%lisinopril%'
           OR name ILIKE '%bisoprolol%' OR name ILIKE '%atenolol%' OR name ILIKE '%doxazosin%'
           OR name ILIKE '%bendroflumethiazide%' OR name ILIKE '%furosemide%' OR name ILIKE '%indapamide%'
           OR name ILIKE '%spironolactone%'
         )`,
      [residentId, careHomeId]
    );
    const riskyMedCount = parseInt(medData.med_count) || 0;
    let medScore = 0;
    if (riskyMedCount >= 3) medScore = 2;
    else if (riskyMedCount >= 1) medScore = 1;
    totalScore += medScore;
    factors.medications = { riskyMedCount, score: medScore };

    // 5. Cognitive impairment (check resident_conditions for dementia or care notes)
    const { rows: dementiaNotes } = await query(
      `SELECT id FROM resident_conditions
       WHERE resident_id = $1
         AND condition ILIKE '%dementia%'
       LIMIT 1`,
      [residentId]
    );
    let cognitiveScore = 0;
    if (dementiaNotes.length > 0) {
      cognitiveScore = 2;
    } else {
      // Fallback: check care notes
      const { rows: dementiaInNotes } = await query(
        `SELECT id FROM care_notes
         WHERE resident_id = $1 AND care_home_id = $2 AND deleted_at IS NULL
           AND content ILIKE '%dementia%'
         LIMIT 1`,
        [residentId, careHomeId]
      );
      if (dementiaInNotes.length > 0) cognitiveScore = 2;
    }
    totalScore += cognitiveScore;
    factors.cognitiveImpairment = { hasDementia: cognitiveScore > 0, score: cognitiveScore };

    // Score interpretation
    let riskLevel: string;
    if (totalScore >= 12) riskLevel = 'very_high';
    else if (totalScore >= 8) riskLevel = 'high';
    else if (totalScore >= 4) riskLevel = 'medium';
    else riskLevel = 'low';

    // Mark previous falls assessments as superseded
    await query(
      `UPDATE risk_assessments SET status = 'superseded', updated_at = NOW()
       WHERE resident_id = $1 AND care_home_id = $2 AND assessment_type = 'falls' AND status = 'current'`,
      [residentId, careHomeId]
    );

    // Insert new assessment
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + 7);

    const { rows: [assessment] } = await query(
      `INSERT INTO risk_assessments (care_home_id, resident_id, assessed_by, assessment_type, total_score, risk_level, factors, auto_populated, next_review_date, status)
       VALUES ($1, $2, $3, 'falls', $4, $5, $6, TRUE, $7, 'current') RETURNING *`,
      [careHomeId, residentId, userId, totalScore, riskLevel, JSON.stringify(factors), nextReview.toISOString().slice(0, 10)]
    );

    res.status(201).json({
      assessment,
      residentName: `${resident.first_name} ${resident.last_name}`,
      room: resident.room_number,
      factors,
    });
  } catch (err) { next(err); }
}

// ── Get Resident Assessments ──────────────────────────────────────────────
export async function getResidentAssessments(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;

    const { rows } = await query(
      `SELECT ra.*, u.first_name || ' ' || u.last_name AS assessed_by_name
       FROM risk_assessments ra
       LEFT JOIN users u ON u.id = ra.assessed_by
       WHERE ra.resident_id = $1 AND ra.care_home_id = $2 AND ra.status != 'superseded'
       ORDER BY ra.assessment_type, ra.created_at DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Overdue Reviews ───────────────────────────────────────────────────
export async function getOverdueReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT ra.*, r.first_name || ' ' || r.last_name AS resident_name, r.room_number,
              u.first_name || ' ' || u.last_name AS assessed_by_name
       FROM risk_assessments ra
       JOIN residents r ON r.id = ra.resident_id
       LEFT JOIN users u ON u.id = ra.assessed_by
       WHERE ra.care_home_id = $1 AND ra.status = 'current'
         AND ra.next_review_date < NOW()
       ORDER BY ra.next_review_date ASC`,
      [careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Home Risk Overview ────────────────────────────────────────────────
export async function getHomeRiskOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Get all residents with their latest risk scores per assessment type
    const { rows } = await query(
      `SELECT
         r.id AS resident_id,
         r.first_name || ' ' || r.last_name AS resident_name,
         r.room_number,
         r.risk_level AS overall_risk_level,
         waterlow.total_score AS waterlow_score,
         waterlow.risk_level AS waterlow_risk,
         waterlow.next_review_date AS waterlow_next_review,
         must.total_score AS must_score,
         must.risk_level AS must_risk,
         must.next_review_date AS must_next_review,
         falls.total_score AS falls_score,
         falls.risk_level AS falls_risk,
         falls.next_review_date AS falls_next_review
       FROM residents r
       LEFT JOIN LATERAL (
         SELECT total_score, risk_level, next_review_date FROM risk_assessments
         WHERE resident_id = r.id AND care_home_id = $1 AND assessment_type = 'waterlow' AND status = 'current'
         ORDER BY created_at DESC LIMIT 1
       ) waterlow ON TRUE
       LEFT JOIN LATERAL (
         SELECT total_score, risk_level, next_review_date FROM risk_assessments
         WHERE resident_id = r.id AND care_home_id = $1 AND assessment_type = 'must' AND status = 'current'
         ORDER BY created_at DESC LIMIT 1
       ) must ON TRUE
       LEFT JOIN LATERAL (
         SELECT total_score, risk_level, next_review_date FROM risk_assessments
         WHERE resident_id = r.id AND care_home_id = $1 AND assessment_type = 'falls' AND status = 'current'
         ORDER BY created_at DESC LIMIT 1
       ) falls ON TRUE
       WHERE r.care_home_id = $1 AND r.active = TRUE
       ORDER BY r.last_name, r.first_name`,
      [careHomeId]
    );

    // Format for traffic-light display
    const overview = rows.map((row: any) => ({
      residentId: row.resident_id,
      residentName: row.resident_name,
      roomNumber: row.room_number,
      overallRiskLevel: row.overall_risk_level,
      waterlow: row.waterlow_score !== null ? {
        score: row.waterlow_score,
        riskLevel: row.waterlow_risk,
        nextReview: row.waterlow_next_review,
      } : null,
      must: row.must_score !== null ? {
        score: row.must_score,
        riskLevel: row.must_risk,
        nextReview: row.must_next_review,
      } : null,
      falls: row.falls_score !== null ? {
        score: row.falls_score,
        riskLevel: row.falls_risk,
        nextReview: row.falls_next_review,
      } : null,
    }));

    res.json(overview);
  } catch (err) { next(err); }
}
