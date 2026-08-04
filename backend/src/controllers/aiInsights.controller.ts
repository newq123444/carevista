// src/controllers/aiInsights.controller.ts
// AI that actively monitors care data and generates meaningful resident insights
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { runAiOperation, AI_NOT_CONFIGURED } from '../services/ai.service';
import { createNotification } from './notifications.controller';

// ── Validate data quality — catch inaccurate/missing entries ─────────────
export async function validateCareData(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const days = parseInt(req.query.days as string) || 7;
    const issues: any[] = [];

    // 1. Fluid intake anomalies — same value every day (copy-paste)
    const { rows: fluidAnomaly } = await query(`
      SELECT r.first_name||' '||r.last_name AS name, r.room_number,
             COUNT(DISTINCT (cn.meal_context::jsonb->>'fluid_ml')) AS unique_fluid_values,
             COUNT(*) AS meal_notes,
             MIN((cn.meal_context::jsonb->>'fluid_ml')::int) AS min_fluid,
             MAX((cn.meal_context::jsonb->>'fluid_ml')::int) AS max_fluid,
             AVG((cn.meal_context::jsonb->>'fluid_ml')::int)::int AS avg_fluid
      FROM care_notes cn
      JOIN residents r ON r.id = cn.resident_id
      WHERE cn.care_home_id = $1
        AND cn.note_type = 'nutrition'
        AND cn.meal_context IS NOT NULL
        AND cn.created_at > NOW() - INTERVAL '1 day' * $2
        AND (cn.meal_context::jsonb->>'fluid_ml') IS NOT NULL
      GROUP BY r.id, r.first_name, r.last_name, r.room_number
      HAVING COUNT(*) >= 3
    `, [careHomeId, days]);

    for (const f of fluidAnomaly) {
      if (f.unique_fluid_values === 1 && f.meal_notes >= 3) {
        issues.push({ type: 'copy_paste_suspected', severity: 'warning', resident: f.name, room: f.room_number,
          message: `Fluid intake recorded as exactly ${f.min_fluid}ml every single time across ${f.meal_notes} notes — possible copy-paste. Please verify actual intake.` });
      }
      if (f.avg_fluid < 500) {
        issues.push({ type: 'low_fluid_intake', severity: 'concern', resident: f.name, room: f.room_number,
          message: `Average fluid intake ${f.avg_fluid}ml/day over ${days} days — below recommended 1500ml/day minimum. Risk of dehydration.` });
      }
      if (f.avg_fluid > 3000) {
        issues.push({ type: 'high_fluid_intake', severity: 'concern', resident: f.name, room: f.room_number,
          message: `Average fluid intake ${f.avg_fluid}ml/day — unusually high. Check for data entry errors or medical review needed.` });
      }
    }

    // 2. Food intake — always "Full" or always "Refused" (suspicious)
    const { rows: foodAnomaly } = await query(`
      SELECT r.first_name||' '||r.last_name AS name, r.room_number,
             COUNT(DISTINCT (cn.meal_context::jsonb->>'food_eaten_percent')) AS unique_values,
             COUNT(*) AS meal_notes,
             MIN((cn.meal_context::jsonb->>'food_eaten_percent')::int) AS min_food,
             MAX((cn.meal_context::jsonb->>'food_eaten_percent')::int) AS max_food
      FROM care_notes cn
      JOIN residents r ON r.id = cn.resident_id
      WHERE cn.care_home_id = $1
        AND cn.note_type = 'nutrition'
        AND cn.meal_context IS NOT NULL
        AND cn.created_at > NOW() - INTERVAL '1 day' * $2
        AND (cn.meal_context::jsonb->>'food_eaten_percent') IS NOT NULL
      GROUP BY r.id, r.first_name, r.last_name, r.room_number
      HAVING COUNT(*) >= 5
    `, [careHomeId, days]);

    for (const f of foodAnomaly) {
      if (f.unique_values === 1) {
        issues.push({ type: 'copy_paste_food', severity: 'warning', resident: f.name, room: f.room_number,
          message: `Food intake recorded as ${f.min_food}% for every single meal across ${f.meal_notes} notes — likely copy-paste. Real intake varies naturally.` });
      }
      if (f.max_food < 25) {
        issues.push({ type: 'very_low_food_intake', severity: 'urgent', resident: f.name, room: f.room_number,
          message: `${f.name} eating less than 25% of all meals for ${days} days. Urgent nutrition review needed. Consider MUST score and dietitian referral.` });
      }
    }

    // 3. Residents with NO notes in past 24 hours
    const { rows: noNotes } = await query(`
      SELECT r.first_name||' '||r.last_name AS name, r.room_number, r.risk_level,
             MAX(cn.created_at) AS last_note
      FROM residents r
      LEFT JOIN care_notes cn ON cn.resident_id = r.id AND cn.created_at > NOW()-INTERVAL '24 hours'
      WHERE r.care_home_id = $1 AND r.active = TRUE
      GROUP BY r.id, r.first_name, r.last_name, r.room_number, r.risk_level
      HAVING COUNT(cn.id) = 0
    `, [careHomeId]);

    for (const r of noNotes) {
      const sev = r.risk_level === 'high' ? 'urgent' : 'warning';
      issues.push({ type: 'no_notes_24h', severity: sev, resident: r.name, room: r.room_number,
        message: `No care notes recorded for ${r.name} in the last 24 hours${r.risk_level === 'high' ? ' — HIGH RISK resident' : ''}. Minimum documentation not met.` });
    }

    // 4. Pain score consistently high (≥7) with no GP referral noted
    const { rows: highPain } = await query(`
      SELECT r.first_name||' '||r.last_name AS name, r.room_number,
             ROUND(AVG(cn.pain_score),1) AS avg_pain, COUNT(*) AS pain_notes,
             MAX(cn.pain_score) AS max_pain
      FROM care_notes cn
      JOIN residents r ON r.id = cn.resident_id
      WHERE cn.care_home_id = $1
        AND cn.pain_score IS NOT NULL
        AND cn.pain_score >= 7
        AND cn.created_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY r.id, r.first_name, r.last_name, r.room_number
      HAVING COUNT(*) >= 2
    `, [careHomeId, days]);

    for (const p of highPain) {
      issues.push({ type: 'persistent_high_pain', severity: 'urgent', resident: p.name, room: p.room_number,
        message: `${p.name} has had pain score ≥7 recorded ${p.pain_notes} times (avg ${p.avg_pain}/10). This requires GP review and pain management plan update.` });
    }

    // 5. Bowels not opened in 3+ days
    const { rows: constipation } = await query(`
      SELECT r.first_name||' '||r.last_name AS name, r.room_number,
             MAX(cn.created_at) AS last_bowel_note
      FROM residents r
      LEFT JOIN care_notes cn ON cn.resident_id = r.id
        AND cn.content ILIKE '%bowels opened%'
        AND cn.created_at > NOW() - INTERVAL '4 days'
      WHERE r.care_home_id = $1 AND r.active = TRUE
      GROUP BY r.id, r.first_name, r.last_name, r.room_number
      HAVING COUNT(cn.id) = 0
    `, [careHomeId]);

    for (const b of constipation) {
      issues.push({ type: 'bowels_not_opened', severity: 'concern', resident: b.name, room: b.room_number,
        message: `No record of bowels opening for ${b.name} in 3+ days. Check continence notes and consider laxative review.` });
    }

    // 6. Mood consistently low/distressed
    const { rows: lowMood } = await query(`
      SELECT r.first_name||' '||r.last_name AS name, r.room_number,
             COUNT(*) FILTER (WHERE cn.mood IN ('Low','Distressed','Agitated')) AS negative_moods,
             COUNT(*) AS total_notes
      FROM care_notes cn
      JOIN residents r ON r.id = cn.resident_id
      WHERE cn.care_home_id = $1
        AND cn.mood IS NOT NULL AND cn.mood != ''
        AND cn.created_at > NOW() - INTERVAL '1 day' * $2
      GROUP BY r.id, r.first_name, r.last_name, r.room_number
      HAVING COUNT(*) >= 4
        AND COUNT(*) FILTER (WHERE cn.mood IN ('Low','Distressed','Agitated')) >= 3
    `, [careHomeId, days]);

    for (const m of lowMood) {
      const pct = Math.round((m.negative_moods / m.total_notes) * 100);
      issues.push({ type: 'persistent_low_mood', severity: 'concern', resident: m.name, room: m.room_number,
        message: `${m.name}'s mood recorded as negative ${m.negative_moods}/${m.total_notes} times (${pct}%). Consider mental wellbeing review, activity engagement, and family contact.` });
    }

    res.json({ issues, checkedDays: days, checkedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}

// ── Generate meaningful AI insights per resident ─────────────────────────
export async function generateResidentInsights(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const [resident, notes, weights, meds, incidents] = await Promise.all([
      query(`SELECT * FROM residents WHERE id=$1 AND care_home_id=$2`, [residentId, careHomeId]),
      query(`
        SELECT cn.note_type, cn.content, cn.mood, cn.pain_score, cn.flagged, cn.is_significant,
               cn.meal_context, cn.created_at,
               u.first_name||' '||u.last_name AS author
        FROM care_notes cn JOIN users u ON u.id=cn.author_id
        WHERE cn.resident_id=$1 AND cn.created_at > NOW()-INTERVAL '1 day'*$2
        ORDER BY cn.created_at DESC LIMIT 100
      `, [residentId, days]),
      query(`SELECT weight_kg, bmi, must_score, created_at FROM resident_weights WHERE resident_id=$1 ORDER BY created_at DESC LIMIT 12`, [residentId]),
      query(`SELECT name, dose, route, indication FROM medications WHERE resident_id=$1 AND active=true`, [residentId]),
      query(`SELECT incident_type, severity, description, incident_date FROM incidents WHERE resident_id=$1 ORDER BY incident_date DESC LIMIT 10`, [residentId]),
    ]);

    if (!resident.rows[0]) return res.status(404).json({ error: 'Resident not found' });
    const r = resident.rows[0];

    // Calculate nutrition stats from meal_context
    const mealNotes = notes.rows.filter((n: any) => n.meal_context);
    const fluidValues = mealNotes.map((n: any) => { try { return JSON.parse(n.meal_context).fluid_ml; } catch { return null; } }).filter(Boolean);
    const foodValues  = mealNotes.map((n: any) => { try { return JSON.parse(n.meal_context).food_eaten_percent; } catch { return null; } }).filter(Boolean);
    const avgFluid = fluidValues.length ? Math.round(fluidValues.reduce((a: number,b: number)=>a+b,0)/fluidValues.length) : null;
    const avgFood  = foodValues.length  ? Math.round(foodValues.reduce((a: number,b: number)=>a+b,0)/foodValues.length)  : null;

    // Mood analysis
    const moodNotes = notes.rows.filter((n: any) => n.mood);
    const moodCounts: Record<string,number> = {};
    for (const n of moodNotes) { moodCounts[n.mood] = (moodCounts[n.mood] || 0) + 1; }
    const dominantMood = Object.entries(moodCounts).sort((a,b)=>b[1]-a[1])[0];

    // Pain analysis
    const painNotes = notes.rows.filter((n: any) => n.pain_score !== null);
    const avgPain = painNotes.length ? (painNotes.reduce((a: number,n: any)=>a+n.pain_score,0)/painNotes.length).toFixed(1) : null;

    const prompt = `You are a compassionate, expert care home analyst. Analyse the following data for ${r.first_name} ${r.last_name} and generate meaningful, actionable insights that will genuinely improve their quality of life and care.

RESIDENT:
Name: ${r.first_name} ${r.last_name}, Age: ${new Date().getFullYear()-new Date(r.date_of_birth).getFullYear()}, Room: ${r.room_number}
Risk: ${r.risk_level} | DNACPR: ${r.dnacpr?'YES':'No'}
Care summary: ${r.care_needs_summary || 'Not recorded'}

MEDICATIONS (${meds.rows.length}):
${meds.rows.map((m: any)=>`${m.name} ${m.dose} for ${m.indication||'unspecified'}`).join(', ')}

NUTRITION (last ${days} days, ${mealNotes.length} meal records):
Average fluid intake: ${avgFluid ? avgFluid+'ml/day' : 'not consistently recorded'}
Average food intake: ${avgFood !== null ? avgFood+'% of meals' : 'not consistently recorded'}
Fluid range: ${fluidValues.length ? Math.min(...fluidValues)+'–'+Math.max(...fluidValues)+'ml' : 'unknown'}

MOOD (${moodNotes.length} records):
${Object.entries(moodCounts).map(([k,v])=>`${k}: ${v} times`).join(', ') || 'Not recorded'}
Dominant mood: ${dominantMood ? dominantMood[0]+' ('+dominantMood[1]+' times)' : 'unknown'}

PAIN (${painNotes.length} records):
Average pain score: ${avgPain || 'not recorded'}/10
High pain (≥7): ${painNotes.filter((n: any)=>n.pain_score>=7).length} occurrences

WEIGHT TREND:
${weights.rows.map((w: any)=>`${new Date(w.created_at).toLocaleDateString('en-GB')}: ${w.weight_kg}kg${w.must_score!=null?' (MUST '+w.must_score+')':''}`).join(', ') || 'No weights recorded'}

RECENT INCIDENTS (${incidents.rows.length}):
${incidents.rows.map((i: any)=>`${i.incident_type} (${i.severity}): ${i.description?.slice(0,100)}`).join(' | ') || 'None'}

RECENT CARE NOTES SUMMARY (${notes.rows.length} notes, last ${days} days):
${notes.rows.slice(0,20).map((n: any)=>`[${n.note_type}${n.flagged?' 🚩':''}] ${n.content?.slice(0,120)}`).join('\n')}

Generate a compassionate, evidence-based resident insight report with these sections:

## 🍽 Nutrition & Hydration
Analyse actual intake patterns. Is ${r.first_name} eating and drinking enough? Any trends? What could improve their nutrition? Flag any concerns. Recommend specific foods or drinks if patterns suggest preferences.

## 😊 Emotional Wellbeing & Mood
What does the mood data tell us about ${r.first_name}'s quality of life? What makes them happy? What causes distress? What activities or interventions would help? Be specific and human.

## 🩺 Pain & Comfort
Is ${r.first_name} in pain? Is it being managed well? Any patterns (time of day, after certain activities)? What could improve their comfort?

## ⚖️ Nutrition & Weight Risk
Assess malnutrition/dehydration risk. Recommend MUST scoring frequency, dietary modifications, fortified foods, or referrals.

## 🏃 Mobility & Falls Risk
Based on incidents and care notes, assess current mobility. Any deterioration? What would reduce falls risk?

## 🌟 Quality of Life Recommendations
3-5 specific, practical things carers can do THIS WEEK that would genuinely improve ${r.first_name}'s daily life. Be specific — not generic advice.

## ⚠️ Concerns Requiring Action
Any urgent clinical or care concerns that need escalation to nurse/manager TODAY?

Write with genuine care and compassion. ${r.first_name} is a person with a full life history, not a data point. Use their first name throughout.`;

    const insights = await runAiOperation({
      careHomeId, requestedBy: req.user!.id,
      operation: 'resident_insights',
      context: { residentId, days },
      prompt,
      systemPrompt: `You are an expert care quality analyst and compassionate advocate for older adults in UK care homes. 
Your insights directly improve residents' lives. Be specific, actionable, and genuinely caring.
Always use the resident's first name. Never be generic. Base everything on the actual data provided.
If data is missing, flag it as a documentation gap rather than ignoring it.`,
    });
    if (insights === AI_NOT_CONFIGURED) return res.status(503).json({ error: 'AI features are not enabled. Add ANTHROPIC_API_KEY to the server to generate insights.' });

    // Auto-create notifications for urgent findings
    if (insights.includes('⚠️') || insights.toLowerCase().includes('urgent')) {
      await createNotification({
        careHomeId, type: 'ai_insight_urgent', priority: 'high',
        title: `AI Insight — action needed for ${r.first_name} ${r.last_name}`,
        body: `AI analysis found concerns requiring attention. Review insights in AI Tools.`,
        entityType: 'resident', entityId: residentId,
      });
    }

    res.json({
      insights,
      resident: r,
      stats: { notes: notes.rows.length, avgFluid, avgFood, avgPain, dominantMood: dominantMood?.[0], weights: weights.rows.length },
      generatedAt: new Date().toISOString(),
      days,
    });
  } catch (err) { next(err); }
}

// ── Home-wide care quality dashboard ─────────────────────────────────────
export async function careQualityDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const [noteStats, moodStats, fluidStats, painStats, documentationGaps] = await Promise.all([
      // Notes per resident per day (avg over 7 days)
      query(`
        SELECT r.first_name||' '||r.last_name AS name, r.room_number, r.risk_level,
               COUNT(cn.id) AS total_notes,
               COUNT(cn.id)::float / 7 AS notes_per_day
        FROM residents r
        LEFT JOIN care_notes cn ON cn.resident_id=r.id AND cn.created_at > NOW()-INTERVAL '7 days'
        WHERE r.care_home_id=$1 AND r.active=TRUE
        GROUP BY r.id, r.first_name, r.last_name, r.room_number, r.risk_level
        ORDER BY notes_per_day ASC
      `, [careHomeId]),

      // Home-wide mood trends
      query(`
        SELECT mood, COUNT(*) AS count,
               DATE_TRUNC('day', created_at) AS day
        FROM care_notes
        WHERE care_home_id=$1 AND mood IS NOT NULL AND mood != ''
          AND created_at > NOW()-INTERVAL '14 days'
        GROUP BY mood, DATE_TRUNC('day', created_at)
        ORDER BY day
      `, [careHomeId]),

      // Fluid intake summary
      query(`
        SELECT r.first_name||' '||r.last_name AS name, r.room_number,
               AVG((cn.meal_context::jsonb->>'fluid_ml')::int)::int AS avg_fluid_ml,
               COUNT(*) AS meal_records
        FROM care_notes cn JOIN residents r ON r.id=cn.resident_id
        WHERE cn.care_home_id=$1 AND cn.meal_context IS NOT NULL
          AND (cn.meal_context::jsonb->>'fluid_ml') IS NOT NULL
          AND cn.created_at > NOW()-INTERVAL '7 days'
        GROUP BY r.id, r.first_name, r.last_name, r.room_number
        ORDER BY avg_fluid_ml ASC
      `, [careHomeId]),

      // Pain management
      query(`
        SELECT r.first_name||' '||r.last_name AS name, r.room_number,
               ROUND(AVG(cn.pain_score),1) AS avg_pain,
               MAX(cn.pain_score) AS max_pain,
               COUNT(*) FILTER (WHERE cn.pain_score >= 7) AS high_pain_count
        FROM care_notes cn JOIN residents r ON r.id=cn.resident_id
        WHERE cn.care_home_id=$1 AND cn.pain_score IS NOT NULL
          AND cn.created_at > NOW()-INTERVAL '7 days'
        GROUP BY r.id, r.first_name, r.last_name, r.room_number
        HAVING AVG(cn.pain_score) >= 4
        ORDER BY avg_pain DESC
      `, [careHomeId]),

      // Documentation gaps
      query(`
        SELECT r.first_name||' '||r.last_name AS name, r.room_number, r.risk_level,
               COUNT(cn.id) AS notes_last_48h
        FROM residents r
        LEFT JOIN care_notes cn ON cn.resident_id=r.id AND cn.created_at > NOW()-INTERVAL '48 hours'
        WHERE r.care_home_id=$1 AND r.active=TRUE
        GROUP BY r.id, r.first_name, r.last_name, r.room_number, r.risk_level
        HAVING COUNT(cn.id) < 2
        ORDER BY r.risk_level DESC, COUNT(cn.id) ASC
      `, [careHomeId]),
    ]);

    res.json({
      noteStats: noteStats.rows,
      moodStats: moodStats.rows,
      fluidStats: fluidStats.rows,
      painStats: painStats.rows,
      documentationGaps: documentationGaps.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) { next(err); }
}
