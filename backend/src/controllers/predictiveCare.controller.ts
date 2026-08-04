// src/controllers/predictiveCare.controller.ts
// AI Predictive Care Engine - falls prediction and deterioration detection
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { runAiOperation, AI_NOT_CONFIGURED } from '../services/ai.service';

// ── Calculate Falls Risk ──────────────────────────────────────────────────
export async function calculateFallsRisk(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;

    // Verify resident belongs to this care home
    const { rows: [resident] } = await query(
      'SELECT id, first_name, last_name, date_of_birth, room_number FROM residents WHERE id = $1 AND care_home_id = $2 AND active = TRUE',
      [residentId, careHomeId]
    );
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    // 1. Falls incidents in last 90 days (weight: 30%)
    const { rows: [fallsData] } = await query(
      `SELECT COUNT(*) AS falls_count
       FROM incidents
       WHERE resident_id = $1 AND care_home_id = $2
         AND incident_type ILIKE '%fall%'
         AND incident_date > NOW() - INTERVAL '90 days'`,
      [residentId, careHomeId]
    );
    const fallsCount = parseInt(fallsData.falls_count) || 0;
    const fallsScore = Math.min(fallsCount * 25, 100); // each fall adds 25, max 100

    // 2. Sedative/psychotropic medications (weight: 20%)
    const { rows: [medData] } = await query(
      `SELECT COUNT(*) AS med_count
       FROM medications
       WHERE resident_id = $1 AND care_home_id = $2 AND active = TRUE
         AND (
           indication ILIKE '%sedative%' OR indication ILIKE '%hypnotic%'
           OR indication ILIKE '%psychotropic%' OR indication ILIKE '%anxiolytic%'
           OR indication ILIKE '%antipsychotic%' OR indication ILIKE '%benzodiazepine%'
           OR name ILIKE '%diazepam%' OR name ILIKE '%zopiclone%'
           OR name ILIKE '%lorazepam%' OR name ILIKE '%haloperidol%'
           OR name ILIKE '%risperidone%' OR name ILIKE '%quetiapine%'
         )`,
      [residentId, careHomeId]
    );
    const sedativeCount = parseInt(medData.med_count) || 0;
    const medicationScore = Math.min(sedativeCount * 35, 100); // each med adds 35, max 100

    // 3. Mobility status from care notes (weight: 20%)
    const { rows: mobilityNotes } = await query(
      `SELECT content FROM care_notes
       WHERE resident_id = $1 AND care_home_id = $2
         AND (note_type = 'personal_care' OR note_type = 'nursing_observation')
         AND created_at > NOW() - INTERVAL '30 days'
         AND deleted_at IS NULL
         AND (content ILIKE '%immobile%' OR content ILIKE '%wheelchair%'
              OR content ILIKE '%zimmer%' OR content ILIKE '%walking frame%'
              OR content ILIKE '%unsteady%' OR content ILIKE '%mobility%')
       ORDER BY created_at DESC LIMIT 5`,
      [residentId, careHomeId]
    );
    let mobilityScore = 0;
    if (mobilityNotes.length > 0) {
      const mobilityText = mobilityNotes.map((n: any) => n.content.toLowerCase()).join(' ');
      if (mobilityText.includes('immobile') || mobilityText.includes('bedbound')) mobilityScore = 40;
      else if (mobilityText.includes('wheelchair')) mobilityScore = 60;
      else if (mobilityText.includes('unsteady') || mobilityText.includes('zimmer') || mobilityText.includes('walking frame')) mobilityScore = 80;
      else mobilityScore = 50;
    }

    // 4. Age factor (weight: 15%)
    const dob = new Date(resident.date_of_birth);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    let ageScore = 0;
    if (age >= 90) ageScore = 100;
    else if (age >= 85) ageScore = 80;
    else if (age >= 80) ageScore = 60;
    else if (age >= 75) ageScore = 40;
    else if (age >= 70) ageScore = 20;

    // 5. Mood/sleep from wellbeing logs (weight: 15%)
    let wellbeingData: any[] = [];
    try {
      const { rows } = await query(
        `SELECT mood_score, sleep_quality
         FROM wellbeing_logs
         WHERE resident_id = $1 AND care_home_id = $2
           AND created_at > NOW() - INTERVAL '14 days'
         ORDER BY created_at DESC LIMIT 14`,
        [residentId, careHomeId]
      );
      wellbeingData = rows;
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
    }
    let moodSleepScore = 0;
    if (wellbeingData.length > 0) {
      const avgMood = wellbeingData.reduce((sum: number, w: any) => sum + (w.mood_score || 3), 0) / wellbeingData.length;
      const poorSleep = wellbeingData.filter((w: any) => w.sleep_quality && w.sleep_quality <= 2).length;
      // Low mood (1-2 out of 5) and poor sleep increase risk
      if (avgMood <= 2) moodSleepScore += 50;
      else if (avgMood <= 3) moodSleepScore += 25;
      if (poorSleep >= 3) moodSleepScore += 50;
      else if (poorSleep >= 1) moodSleepScore += 25;
      moodSleepScore = Math.min(moodSleepScore, 100);
    }

    // Calculate weighted total
    const totalScore = Math.round(
      (fallsScore * 0.30) +
      (medicationScore * 0.20) +
      (mobilityScore * 0.20) +
      (ageScore * 0.15) +
      (moodSleepScore * 0.15)
    );

    const factors = {
      falls: { count: fallsCount, score: fallsScore, weight: 0.30 },
      medications: { sedativeCount, score: medicationScore, weight: 0.20 },
      mobility: { score: mobilityScore, weight: 0.20, notesFound: mobilityNotes.length },
      age: { value: age, score: ageScore, weight: 0.15 },
      moodSleep: { score: moodSleepScore, weight: 0.15, dataPoints: wellbeingData.length },
    };

    // Store in predictive_risk_scores (resilient - skip if table missing)
    try {
      await query(
        `INSERT INTO predictive_risk_scores (care_home_id, resident_id, risk_type, score, factors)
         VALUES ($1, $2, 'falls', $3, $4)`,
        [careHomeId, residentId, totalScore, JSON.stringify(factors)]
      );
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
    }

    res.json({
      residentId,
      residentName: `${resident.first_name} ${resident.last_name}`,
      room: resident.room_number,
      riskType: 'falls',
      score: totalScore,
      riskLevel: totalScore >= 80 ? 'critical' : totalScore >= 60 ? 'high' : totalScore >= 40 ? 'moderate' : 'low',
      factors,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
}

// ── Calculate Deterioration Risk ──────────────────────────────────────────
export async function calculateDeteriorationRisk(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;

    // Verify resident
    const { rows: [resident] } = await query(
      'SELECT id, first_name, last_name, room_number FROM residents WHERE id = $1 AND care_home_id = $2 AND active = TRUE',
      [residentId, careHomeId]
    );
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    // 1. Weight trend - loss > 5% in 30 days (weight: 25%)
    let weights: any[] = [];
    try {
      const { rows } = await query(
        `SELECT weight_kg, created_at FROM resident_weights
         WHERE resident_id = $1
         ORDER BY created_at DESC LIMIT 4`,
        [residentId]
      );
      weights = rows;
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
    }
    let weightScore = 0;
    if (weights.length >= 2) {
      const latest = parseFloat(weights[0].weight_kg);
      const earliest = parseFloat(weights[weights.length - 1].weight_kg);
      if (earliest > 0) {
        const pctChange = ((earliest - latest) / earliest) * 100;
        if (pctChange >= 10) weightScore = 100;
        else if (pctChange >= 5) weightScore = 75;
        else if (pctChange >= 3) weightScore = 50;
        else if (pctChange > 0) weightScore = 25;
      }
    }

    // 2. Fluid intake average (weight: 20%)
    const { rows: [fluidData] } = await query(
      `SELECT AVG((meal_context::jsonb->>'fluid_ml')::int) AS avg_fluid,
              COUNT(*) AS records
       FROM care_notes
       WHERE resident_id = $1 AND care_home_id = $2
         AND note_type = 'nutrition'
         AND meal_context IS NOT NULL
         AND (meal_context::jsonb->>'fluid_ml') IS NOT NULL
         AND created_at > NOW() - INTERVAL '7 days'
         AND deleted_at IS NULL`,
      [residentId, careHomeId]
    );
    let fluidScore = 0;
    const avgFluid = fluidData.avg_fluid ? parseFloat(fluidData.avg_fluid) : null;
    if (avgFluid !== null) {
      if (avgFluid < 500) fluidScore = 100;
      else if (avgFluid < 800) fluidScore = 75;
      else if (avgFluid < 1200) fluidScore = 50;
      else if (avgFluid < 1500) fluidScore = 25;
    }

    // 3. Food intake average (weight: 20%)
    const { rows: [foodData] } = await query(
      `SELECT AVG((meal_context::jsonb->>'food_eaten_percent')::int) AS avg_food,
              COUNT(*) AS records
       FROM care_notes
       WHERE resident_id = $1 AND care_home_id = $2
         AND note_type = 'nutrition'
         AND meal_context IS NOT NULL
         AND (meal_context::jsonb->>'food_eaten_percent') IS NOT NULL
         AND created_at > NOW() - INTERVAL '7 days'
         AND deleted_at IS NULL`,
      [residentId, careHomeId]
    );
    let foodScore = 0;
    const avgFood = foodData.avg_food ? parseFloat(foodData.avg_food) : null;
    if (avgFood !== null) {
      if (avgFood < 25) foodScore = 100;
      else if (avgFood < 50) foodScore = 75;
      else if (avgFood < 75) foodScore = 50;
      else if (avgFood < 90) foodScore = 25;
    }

    // 4. Pain score trends (weight: 15%)
    const { rows: [painData] } = await query(
      `SELECT AVG(pain_score) AS avg_pain, COUNT(*) AS records
       FROM care_notes
       WHERE resident_id = $1 AND care_home_id = $2
         AND pain_score IS NOT NULL
         AND created_at > NOW() - INTERVAL '7 days'
         AND deleted_at IS NULL`,
      [residentId, careHomeId]
    );
    let painScore = 0;
    const avgPain = painData.avg_pain ? parseFloat(painData.avg_pain) : null;
    if (avgPain !== null) {
      if (avgPain >= 8) painScore = 100;
      else if (avgPain >= 6) painScore = 75;
      else if (avgPain >= 4) painScore = 50;
      else if (avgPain >= 2) painScore = 25;
    }

    // 5. Mood trends (weight: 10%)
    const { rows: moodData } = await query(
      `SELECT mood FROM care_notes
       WHERE resident_id = $1 AND care_home_id = $2
         AND mood IS NOT NULL AND mood != ''
         AND created_at > NOW() - INTERVAL '7 days'
         AND deleted_at IS NULL`,
      [residentId, careHomeId]
    );
    let moodScore = 0;
    if (moodData.length > 0) {
      const negativeMoods = moodData.filter((m: any) =>
        ['Low', 'Distressed', 'Agitated', 'Anxious', 'Withdrawn'].includes(m.mood)
      ).length;
      const pctNegative = (negativeMoods / moodData.length) * 100;
      if (pctNegative >= 80) moodScore = 100;
      else if (pctNegative >= 60) moodScore = 75;
      else if (pctNegative >= 40) moodScore = 50;
      else if (pctNegative >= 20) moodScore = 25;
    }

    // 6. Missed medications (weight: 10%)
    const { rows: [missedData] } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'missed') AS missed,
         COUNT(*) AS total
       FROM med_administrations
       WHERE resident_id = $1 AND care_home_id = $2
         AND administration_date > NOW() - INTERVAL '7 days'`,
      [residentId, careHomeId]
    );
    let missedMedScore = 0;
    const missed = parseInt(missedData.missed) || 0;
    const total = parseInt(missedData.total) || 0;
    if (total > 0) {
      const pctMissed = (missed / total) * 100;
      if (pctMissed >= 20) missedMedScore = 100;
      else if (pctMissed >= 10) missedMedScore = 75;
      else if (pctMissed >= 5) missedMedScore = 50;
      else if (pctMissed > 0) missedMedScore = 25;
    }

    // Calculate weighted total
    const totalScore = Math.round(
      (weightScore * 0.25) +
      (fluidScore * 0.20) +
      (foodScore * 0.20) +
      (painScore * 0.15) +
      (moodScore * 0.10) +
      (missedMedScore * 0.10)
    );

    const factors = {
      weight: { score: weightScore, weight: 0.25, dataPoints: weights.length },
      fluid: { avgMl: avgFluid, score: fluidScore, weight: 0.20 },
      food: { avgPercent: avgFood, score: foodScore, weight: 0.20 },
      pain: { avgScore: avgPain, score: painScore, weight: 0.15 },
      mood: { score: moodScore, weight: 0.10, dataPoints: moodData.length },
      missedMedications: { missed, total, score: missedMedScore, weight: 0.10 },
    };

    // Store in predictive_risk_scores (resilient - skip if table missing)
    try {
      await query(
        `INSERT INTO predictive_risk_scores (care_home_id, resident_id, risk_type, score, factors)
         VALUES ($1, $2, 'deterioration', $3, $4)`,
        [careHomeId, residentId, totalScore, JSON.stringify(factors)]
      );
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
    }

    res.json({
      residentId,
      residentName: `${resident.first_name} ${resident.last_name}`,
      room: resident.room_number,
      riskType: 'deterioration',
      score: totalScore,
      riskLevel: totalScore >= 80 ? 'critical' : totalScore >= 60 ? 'high' : totalScore >= 40 ? 'moderate' : 'low',
      factors,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
}

// ── Risk Dashboard ────────────────────────────────────────────────────────
export async function getRiskDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Get latest risk scores per resident per type using DISTINCT ON
    let rows: any[] = [];
    try {
      const result = await query(
        `SELECT
           r.id AS resident_id,
           r.first_name,
           r.last_name,
           r.room_number,
           r.risk_level,
           falls.score AS falls_score,
           falls.factors AS falls_factors,
           falls.generated_at AS falls_generated_at,
           det.score AS deterioration_score,
           det.factors AS deterioration_factors,
           det.generated_at AS deterioration_generated_at
         FROM residents r
         LEFT JOIN LATERAL (
           SELECT score, factors, generated_at FROM predictive_risk_scores
           WHERE resident_id = r.id AND care_home_id = $1 AND risk_type = 'falls'
           ORDER BY generated_at DESC LIMIT 1
         ) falls ON TRUE
         LEFT JOIN LATERAL (
           SELECT score, factors, generated_at FROM predictive_risk_scores
           WHERE resident_id = r.id AND care_home_id = $1 AND risk_type = 'deterioration'
           ORDER BY generated_at DESC LIMIT 1
         ) det ON TRUE
         WHERE r.care_home_id = $1 AND r.active = TRUE
           AND (falls.score IS NOT NULL OR det.score IS NOT NULL)
         ORDER BY COALESCE(falls.score, 0) + COALESCE(det.score, 0) DESC`,
        [careHomeId]
      );
      rows = result.rows;
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
      // predictive_risk_scores table doesn't exist - return empty dashboard
    }

    const dashboard = rows.map((row: any) => ({
      resident_id: row.resident_id,
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      room_number: row.room_number,
      risk_level: row.risk_level,
      falls_score: row.falls_score ?? null,
      falls_generated_at: row.falls_generated_at ?? null,
      deterioration_score: row.deterioration_score ?? null,
      deterioration_generated_at: row.deterioration_generated_at ?? null,
    }));

    res.json({ dashboard, generatedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}

// ── Risk History ──────────────────────────────────────────────────────────
export async function getRiskHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;

    let rows: any[] = [];
    try {
      const result = await query(
        `SELECT id, risk_type, score, factors, generated_at
         FROM predictive_risk_scores
         WHERE resident_id = $1 AND care_home_id = $2
           AND generated_at > NOW() - INTERVAL '30 days'
         ORDER BY generated_at DESC`,
        [residentId, careHomeId]
      );
      rows = result.rows;
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
    }

    res.json({ residentId, history: rows });
  } catch (err) { next(err); }
}

// ── Get Alerts ────────────────────────────────────────────────────────────
export async function getAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    let rows: any[] = [];
    try {
      const result = await query(
        `SELECT pa.*,
           r.first_name || ' ' || r.last_name AS resident_name,
           r.room_number
         FROM predictive_alerts pa
         JOIN residents r ON r.id = pa.resident_id
         WHERE pa.care_home_id = $1 AND pa.status = 'active'
         ORDER BY pa.risk_score DESC, pa.created_at DESC`,
        [careHomeId]
      );
      rows = result.rows;
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
    }

    res.json({ alerts: rows });
  } catch (err) { next(err); }
}

// ── Acknowledge Alert ─────────────────────────────────────────────────────
export async function acknowledgeAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const userId = req.user!.id;

    let alert: any = null;
    try {
      const { rows: [row] } = await query(
        `UPDATE predictive_alerts
         SET status = 'acknowledged', acknowledged_by = $1
         WHERE id = $2 AND care_home_id = $3
         RETURNING *`,
        [userId, id, careHomeId]
      );
      alert = row;
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
      return res.status(404).json({ error: 'Alert not found (table not available)' });
    }

    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ alert });
  } catch (err) { next(err); }
}

// ── Run Predictive Analysis (Batch) ───────────────────────────────────────
export async function runPredictiveAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;

    // Get all active residents
    const { rows: residents } = await query(
      'SELECT id, first_name, last_name, room_number, date_of_birth FROM residents WHERE care_home_id = $1 AND active = TRUE',
      [careHomeId]
    );

    const results: any[] = [];
    const alerts: any[] = [];
    const errors: any[] = [];

    for (const resident of residents) {
      try {
        // Calculate falls risk
        const fallsResult = await calculateRiskInternal(careHomeId, resident.id, 'falls');
        // Calculate deterioration risk
        const detResult = await calculateRiskInternal(careHomeId, resident.id, 'deterioration');

        const residentResult: any = {
          residentId: resident.id,
          residentName: `${resident.first_name} ${resident.last_name}`,
          room: resident.room_number,
          falls: fallsResult,
          deterioration: detResult,
        };

        // Create alerts for scores > 70 (only if no active alert already exists)
        if (fallsResult.score > 70) {
          try {
            const { rows: existingFallsAlerts } = await query(
              `SELECT id FROM predictive_alerts WHERE resident_id = $1 AND alert_type = 'falls_risk' AND status = 'active'`,
              [resident.id]
            );
            if (existingFallsAlerts.length === 0) {
              const { rows: [alert] } = await query(
                `INSERT INTO predictive_alerts (care_home_id, resident_id, alert_type, risk_score, threshold, factors, status)
                 VALUES ($1, $2, 'falls_risk', $3, 70, $4, 'active') RETURNING *`,
                [careHomeId, resident.id, fallsResult.score, JSON.stringify(fallsResult.factors)]
              );
              alerts.push(alert);
            }
          } catch (e: any) {
            if (!e?.message?.includes('does not exist')) throw e;
          }
        }

        if (detResult.score > 70) {
          try {
            const { rows: existingDetAlerts } = await query(
              `SELECT id FROM predictive_alerts WHERE resident_id = $1 AND alert_type = 'deterioration_risk' AND status = 'active'`,
              [resident.id]
            );
            if (existingDetAlerts.length === 0) {
              const { rows: [alert] } = await query(
                `INSERT INTO predictive_alerts (care_home_id, resident_id, alert_type, risk_score, threshold, factors, status)
                 VALUES ($1, $2, 'deterioration_risk', $3, 70, $4, 'active') RETURNING *`,
                [careHomeId, resident.id, detResult.score, JSON.stringify(detResult.factors)]
              );
              alerts.push(alert);
            }
          } catch (e: any) {
            if (!e?.message?.includes('does not exist')) throw e;
          }
        }

        // For high-risk cases (>80), generate AI narrative explanation
        if (fallsResult.score > 80 || detResult.score > 80) {
          const highRiskType = fallsResult.score > detResult.score ? 'falls' : 'deterioration';
          const highScore = Math.max(fallsResult.score, detResult.score);
          const highFactors = highRiskType === 'falls' ? fallsResult.factors : detResult.factors;

          const narrative = await runAiOperation({
            careHomeId,
            requestedBy: userId,
            operation: 'predictive_analysis',
            context: { residentId: resident.id, riskType: highRiskType, score: highScore, factors: highFactors },
            prompt: `Generate a brief clinical narrative explaining why ${resident.first_name} ${resident.last_name} (Room ${resident.room_number}) has been flagged as HIGH RISK for ${highRiskType} with a score of ${highScore}/100.

Risk factors:
${JSON.stringify(highFactors, null, 2)}

Provide:
1. A 2-3 sentence summary of why this resident is at high risk
2. 2-3 specific interventions recommended
3. Urgency level and recommended review timeframe

Keep it concise and actionable for care staff. This is advisory only and requires clinical review.`,
          });

          if (narrative !== AI_NOT_CONFIGURED) residentResult.aiNarrative = narrative;
        }

        results.push(residentResult);
      } catch (err: any) {
        errors.push({
          residentId: resident.id,
          residentName: `${resident.first_name} ${resident.last_name}`,
          error: err.message || 'Unknown error during analysis',
        });
      }
    }

    res.json({
      summary: {
        totalResidents: residents.length,
        alertsGenerated: alerts.length,
        highRiskCount: results.filter(r => r.falls.score > 70 || r.deterioration.score > 70).length,
        criticalCount: results.filter(r => r.falls.score > 80 || r.deterioration.score > 80).length,
        errorsCount: errors.length,
      },
      results,
      alerts,
      errors,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
}

// ── Internal helper for batch risk calculation ────────────────────────────
async function calculateRiskInternal(
  careHomeId: string,
  residentId: string,
  riskType: 'falls' | 'deterioration'
): Promise<{ score: number; factors: any }> {
  if (riskType === 'falls') {
    // Falls risk calculation (simplified for batch)
    const { rows: [fallsData] } = await query(
      `SELECT COUNT(*) AS falls_count FROM incidents
       WHERE resident_id = $1 AND care_home_id = $2
         AND incident_type ILIKE '%fall%'
         AND incident_date > NOW() - INTERVAL '90 days'`,
      [residentId, careHomeId]
    );
    const fallsCount = parseInt(fallsData.falls_count) || 0;
    const fallsScore = Math.min(fallsCount * 25, 100);

    const { rows: [medData] } = await query(
      `SELECT COUNT(*) AS med_count FROM medications
       WHERE resident_id = $1 AND care_home_id = $2 AND active = TRUE
         AND (
           indication ILIKE '%sedative%' OR indication ILIKE '%hypnotic%'
           OR indication ILIKE '%psychotropic%' OR indication ILIKE '%anxiolytic%'
           OR indication ILIKE '%antipsychotic%' OR indication ILIKE '%benzodiazepine%'
           OR name ILIKE '%diazepam%' OR name ILIKE '%zopiclone%'
           OR name ILIKE '%lorazepam%' OR name ILIKE '%haloperidol%'
           OR name ILIKE '%risperidone%' OR name ILIKE '%quetiapine%'
         )`,
      [residentId, careHomeId]
    );
    const sedativeCount = parseInt(medData.med_count) || 0;
    const medicationScore = Math.min(sedativeCount * 35, 100);

    const { rows: [residentData] } = await query(
      'SELECT date_of_birth FROM residents WHERE id = $1',
      [residentId]
    );
    const age = Math.floor((Date.now() - new Date(residentData.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    let ageScore = 0;
    if (age >= 90) ageScore = 100;
    else if (age >= 85) ageScore = 80;
    else if (age >= 80) ageScore = 60;
    else if (age >= 75) ageScore = 40;
    else if (age >= 70) ageScore = 20;

    const totalScore = Math.round(
      (fallsScore * 0.30) + (medicationScore * 0.20) + (ageScore * 0.15) + (0 * 0.20) + (0 * 0.15)
    );

    const factors = {
      falls: { count: fallsCount, score: fallsScore },
      medications: { sedativeCount, score: medicationScore },
      age: { value: age, score: ageScore },
    };

    // Store score (resilient - skip if table missing)
    try {
      await query(
        `INSERT INTO predictive_risk_scores (care_home_id, resident_id, risk_type, score, factors)
         VALUES ($1, $2, 'falls', $3, $4)`,
        [careHomeId, residentId, totalScore, JSON.stringify(factors)]
      );
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
    }

    return { score: totalScore, factors };
  } else {
    // Deterioration risk calculation (simplified for batch)
    let weights: any[] = [];
    try {
      const { rows } = await query(
        `SELECT weight_kg FROM resident_weights WHERE resident_id = $1 ORDER BY created_at DESC LIMIT 4`,
        [residentId]
      );
      weights = rows;
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
    }
    let weightScore = 0;
    if (weights.length >= 2) {
      const latest = parseFloat(weights[0].weight_kg);
      const earliest = parseFloat(weights[weights.length - 1].weight_kg);
      if (earliest > 0) {
        const pctChange = ((earliest - latest) / earliest) * 100;
        if (pctChange >= 10) weightScore = 100;
        else if (pctChange >= 5) weightScore = 75;
        else if (pctChange >= 3) weightScore = 50;
        else if (pctChange > 0) weightScore = 25;
      }
    }

    const { rows: [fluidData] } = await query(
      `SELECT AVG((meal_context::jsonb->>'fluid_ml')::int) AS avg_fluid
       FROM care_notes
       WHERE resident_id = $1 AND care_home_id = $2
         AND note_type = 'nutrition' AND meal_context IS NOT NULL
         AND (meal_context::jsonb->>'fluid_ml') IS NOT NULL
         AND created_at > NOW() - INTERVAL '7 days' AND deleted_at IS NULL`,
      [residentId, careHomeId]
    );
    let fluidScore = 0;
    const avgFluid = fluidData.avg_fluid ? parseFloat(fluidData.avg_fluid) : null;
    if (avgFluid !== null) {
      if (avgFluid < 500) fluidScore = 100;
      else if (avgFluid < 800) fluidScore = 75;
      else if (avgFluid < 1200) fluidScore = 50;
      else if (avgFluid < 1500) fluidScore = 25;
    }

    const { rows: [foodData] } = await query(
      `SELECT AVG((meal_context::jsonb->>'food_eaten_percent')::int) AS avg_food
       FROM care_notes
       WHERE resident_id = $1 AND care_home_id = $2
         AND note_type = 'nutrition' AND meal_context IS NOT NULL
         AND (meal_context::jsonb->>'food_eaten_percent') IS NOT NULL
         AND created_at > NOW() - INTERVAL '7 days' AND deleted_at IS NULL`,
      [residentId, careHomeId]
    );
    let foodScore = 0;
    const avgFood = foodData.avg_food ? parseFloat(foodData.avg_food) : null;
    if (avgFood !== null) {
      if (avgFood < 25) foodScore = 100;
      else if (avgFood < 50) foodScore = 75;
      else if (avgFood < 75) foodScore = 50;
      else if (avgFood < 90) foodScore = 25;
    }

    const totalScore = Math.round(
      (weightScore * 0.25) + (fluidScore * 0.20) + (foodScore * 0.20) + (0 * 0.15) + (0 * 0.10) + (0 * 0.10)
    );

    const factors = {
      weight: { score: weightScore, dataPoints: weights.length },
      fluid: { avgMl: avgFluid, score: fluidScore },
      food: { avgPercent: avgFood, score: foodScore },
    };

    // Store score (resilient - skip if table missing)
    try {
      await query(
        `INSERT INTO predictive_risk_scores (care_home_id, resident_id, risk_type, score, factors)
         VALUES ($1, $2, 'deterioration', $3, $4)`,
        [careHomeId, residentId, totalScore, JSON.stringify(factors)]
      );
    } catch (e: any) {
      if (!e?.message?.includes('does not exist')) throw e;
    }

    return { score: totalScore, factors };
  }
}
