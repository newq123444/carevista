// ============================================================
// src/controllers/wellbeing.controller.ts — Wellbeing, Life Story, Isolation, Environment
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Log Wellbeing (POST /wellbeing/log) ───────────────────────────────────
export async function logWellbeing(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId, logDate, mood, painLevel, sleepQuality, socialEngagement, appetite, energyLevel, notes } = req.body;

    if (!residentId || !mood) {
      return res.status(400).json({ error: 'residentId and mood are required' });
    }

    const { rows: [log] } = await query(
      `INSERT INTO wellbeing_logs (care_home_id, resident_id, logged_by, log_date, mood, pain_level, sleep_quality, social_engagement, appetite, energy_level, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [careHomeId, residentId, userId, logDate || new Date().toISOString().slice(0, 10), mood, painLevel ?? null, sleepQuality, socialEngagement, appetite, energyLevel, notes || null]
    );
    res.status(201).json(log);
  } catch (err) { next(err); }
}

// ── Get Resident Wellbeing (GET /wellbeing/:residentId) ───────────────────
export async function getResidentWellbeing(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const { rows } = await query(
      `SELECT wl.*, u.first_name || ' ' || u.last_name AS logged_by_name
       FROM wellbeing_logs wl
       JOIN users u ON u.id = wl.logged_by
       JOIN residents r ON r.id = wl.resident_id
       WHERE wl.resident_id = $1 AND r.care_home_id = $2 AND wl.log_date >= CURRENT_DATE - $3::int
       ORDER BY wl.log_date DESC, wl.created_at DESC`,
      [residentId, careHomeId, days]
    );

    // Calculate trends
    const moodMap: Record<string, number> = { very_happy: 5, happy: 4, neutral: 3, low: 2, very_low: 1 };
    const recentLogs = rows.slice(0, 7);
    const olderLogs = rows.slice(7, 14);
    const avgRecent = recentLogs.length > 0 ? recentLogs.reduce((s, l) => s + (moodMap[l.mood] || 3), 0) / recentLogs.length : null;
    const avgOlder = olderLogs.length > 0 ? olderLogs.reduce((s, l) => s + (moodMap[l.mood] || 3), 0) / olderLogs.length : null;
    const trend = avgRecent !== null && avgOlder !== null ? (avgRecent > avgOlder ? 'improving' : avgRecent < avgOlder ? 'declining' : 'stable') : 'insufficient_data';

    res.json({ logs: rows, trend, avgMoodScore: avgRecent });
  } catch (err) { next(err); }
}

// ── Get Wellbeing Overview (GET /wellbeing/overview) ──────────────────────
export async function getWellbeingOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const today = new Date().toISOString().slice(0, 10);

    // Today's logs grouped by resident
    const { rows: todayLogs } = await query(
      `SELECT wl.*, r.first_name, r.last_name, r.room_number, r.photo_url
       FROM wellbeing_logs wl
       JOIN residents r ON r.id = wl.resident_id
       WHERE wl.care_home_id = $1 AND wl.log_date = $2
       ORDER BY wl.created_at DESC`,
      [careHomeId, today]
    );

    // Residents needing attention (low mood or declining scores)
    const { rows: needsAttention } = await query(
      `SELECT r.id, r.first_name, r.last_name, r.room_number, r.photo_url,
              wl.mood, wl.pain_level, wl.log_date
       FROM residents r
       LEFT JOIN LATERAL (
         SELECT mood, pain_level, log_date FROM wellbeing_logs
         WHERE resident_id = r.id ORDER BY log_date DESC, created_at DESC LIMIT 1
       ) wl ON TRUE
       WHERE r.care_home_id = $1 AND r.active = TRUE
         AND (wl.mood IN ('low','very_low') OR wl.pain_level >= 7)
       ORDER BY wl.pain_level DESC NULLS LAST, wl.mood ASC`,
      [careHomeId]
    );

    // Count stats
    const { rows: [stats] } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE mood = 'very_happy' OR mood = 'happy') AS happy_count,
         COUNT(*) FILTER (WHERE mood = 'neutral') AS neutral_count,
         COUNT(*) FILTER (WHERE mood = 'low' OR mood = 'very_low') AS low_count,
         AVG(pain_level) AS avg_pain,
         COUNT(DISTINCT resident_id) AS logged_residents
       FROM wellbeing_logs
       WHERE care_home_id = $1 AND log_date = $2`,
      [careHomeId, today]
    );

    res.json({ todayLogs, needsAttention, stats });
  } catch (err) { next(err); }
}

// ── Get Life Story (GET /residents/:id/life-story) ────────────────────────
export async function getResidentLifeStory(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { rows: [story] } = await query(
      `SELECT ls.*, u.first_name || ' ' || u.last_name AS updated_by_name
       FROM resident_life_story ls
       JOIN residents r ON r.id = ls.resident_id
       LEFT JOIN users u ON u.id = ls.updated_by
       WHERE ls.resident_id = $1 AND r.care_home_id = $2`,
      [id, careHomeId]
    );
    res.json(story || null);
  } catch (err) { next(err); }
}

// ── Update Life Story (PUT /residents/:id/life-story) ─────────────────────
export async function updateResidentLifeStory(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const userId = req.user!.id;

    // Verify resident belongs to the requesting user's care home
    const { rows: [resident] } = await query(
      `SELECT id FROM residents WHERE id = $1 AND care_home_id = $2`,
      [id, careHomeId]
    );
    if (!resident) return next(new AppError(404, 'Resident not found'));

    const {
      occupation, hometown, spouseInfo, childrenInfo, pets,
      hobbies, favoriteMusic, favoriteTv, favoriteFoods,
      conversationTopics, comfortItems, dailyRoutinePreferences,
      religiousPreferences, dislikes, importantDates,
      lifeAchievements, warService, personalityTraits, communicationStyle
    } = req.body;

    const { rows: [story] } = await query(
      `INSERT INTO resident_life_story (
         resident_id, occupation, hometown, spouse_info, children_info, pets,
         hobbies, favorite_music, favorite_tv, favorite_foods,
         conversation_topics, comfort_items, daily_routine_preferences,
         religious_preferences, dislikes, important_dates,
         life_achievements, war_service, personality_traits, communication_style,
         updated_at, updated_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW(),$21)
       ON CONFLICT (resident_id) DO UPDATE SET
         occupation = EXCLUDED.occupation,
         hometown = EXCLUDED.hometown,
         spouse_info = EXCLUDED.spouse_info,
         children_info = EXCLUDED.children_info,
         pets = EXCLUDED.pets,
         hobbies = EXCLUDED.hobbies,
         favorite_music = EXCLUDED.favorite_music,
         favorite_tv = EXCLUDED.favorite_tv,
         favorite_foods = EXCLUDED.favorite_foods,
         conversation_topics = EXCLUDED.conversation_topics,
         comfort_items = EXCLUDED.comfort_items,
         daily_routine_preferences = EXCLUDED.daily_routine_preferences,
         religious_preferences = EXCLUDED.religious_preferences,
         dislikes = EXCLUDED.dislikes,
         important_dates = EXCLUDED.important_dates,
         life_achievements = EXCLUDED.life_achievements,
         war_service = EXCLUDED.war_service,
         personality_traits = EXCLUDED.personality_traits,
         communication_style = EXCLUDED.communication_style,
         updated_at = NOW(),
         updated_by = EXCLUDED.updated_by
       RETURNING *`,
      [id, occupation, hometown, spouseInfo, childrenInfo, pets,
       hobbies || [], favoriteMusic || [], favoriteTv || [], favoriteFoods || [],
       conversationTopics || [], comfortItems || [], dailyRoutinePreferences,
       religiousPreferences, dislikes || [], importantDates ? JSON.stringify(importantDates) : null,
       lifeAchievements, warService, personalityTraits || [], communicationStyle, userId]
    );
    res.json(story);
  } catch (err) { next(err); }
}

// ── Get Social Isolation Alerts (GET /wellbeing/isolation-alerts) ─────────
export async function getSocialIsolationAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const status = (req.query.status as string) || 'active';

    const { rows } = await query(
      `SELECT sa.*, r.first_name, r.last_name, r.room_number, r.photo_url,
              u.first_name || ' ' || u.last_name AS acknowledged_by_name
       FROM social_isolation_alerts sa
       JOIN residents r ON r.id = sa.resident_id
       LEFT JOIN users u ON u.id = sa.acknowledged_by
       WHERE sa.care_home_id = $1 AND sa.status = $2
       ORDER BY CASE sa.severity WHEN 'severe' THEN 1 WHEN 'moderate' THEN 2 ELSE 3 END, sa.created_at DESC`,
      [careHomeId, status]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Acknowledge Isolation Alert (PATCH /wellbeing/isolation-alerts/:id) ───
export async function acknowledgeSocialAlert(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { status } = req.body; // 'acknowledged' or 'resolved'

    const resolvedAt = status === 'resolved' ? new Date() : null;
    const { rows: [alert] } = await query(
      `UPDATE social_isolation_alerts
       SET status = $1, acknowledged_by = $2, resolved_at = $3
       WHERE id = $4 AND care_home_id = $5 RETURNING *`,
      [status || 'acknowledged', userId, resolvedAt, id, careHomeId]
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (err) { next(err); }
}

// ── Generate Isolation Alerts (POST /wellbeing/generate-isolation-alerts) ─
export async function generateIsolationAlerts(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { rows: [cfg] } = await query(
      `SELECT COALESCE((settings->>'isolation_days')::int, 7) AS threshold FROM care_homes WHERE id = $1`,
      [careHomeId]
    );
    const isolationThreshold = cfg?.threshold ?? 7;

    // Find residents with no activities in configurable days
    const { rows: noActivities } = await query(
      `SELECT r.id, r.first_name, r.last_name,
              COALESCE(
                (SELECT MAX(s.session_date) FROM activity_participants ap
                 JOIN activity_sessions s ON s.id = ap.session_id
                 WHERE ap.resident_id = r.id AND ap.attendance = 'attended'),
                r.admission_date::date
              ) AS last_activity_date
       FROM residents r
       WHERE r.care_home_id = $1 AND r.active = TRUE`,
      [careHomeId]
    );

    let created = 0;
    for (const resident of noActivities) {
      const daysSince = Math.floor((Date.now() - new Date(resident.last_activity_date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince < isolationThreshold) continue;

      const severity = daysSince >= 14 ? 'severe' : daysSince >= 10 ? 'moderate' : 'mild';

      // Check for existing active alert of this type
      const { rows: existing } = await query(
        `SELECT id FROM social_isolation_alerts
         WHERE resident_id = $1 AND alert_type = 'no_activities' AND status = 'active'`,
        [resident.id]
      );
      if (existing.length > 0) continue;

      await query(
        `INSERT INTO social_isolation_alerts (care_home_id, resident_id, alert_type, days_since_last, severity)
         VALUES ($1, $2, 'no_activities', $3, $4)`,
        [careHomeId, resident.id, daysSince, severity]
      );
      created++;
    }

    // Find residents with low social engagement in wellbeing logs
    const { rows: lowEngagement } = await query(
      `SELECT r.id FROM residents r
       WHERE r.care_home_id = $1 AND r.active = TRUE
         AND EXISTS (
           SELECT 1 FROM wellbeing_logs wl
           WHERE wl.resident_id = r.id AND wl.social_engagement = 'isolated'
             AND wl.log_date >= CURRENT_DATE - 7
         )
         AND NOT EXISTS (
           SELECT 1 FROM social_isolation_alerts sa
           WHERE sa.resident_id = r.id AND sa.alert_type = 'low_engagement' AND sa.status = 'active'
         )`,
      [careHomeId]
    );

    for (const resident of lowEngagement) {
      await query(
        `INSERT INTO social_isolation_alerts (care_home_id, resident_id, alert_type, days_since_last, severity)
         VALUES ($1, $2, 'low_engagement', 7, 'moderate')`,
        [careHomeId, resident.id]
      );
      created++;
    }

    res.json({ message: `Generated ${created} new isolation alerts` });
  } catch (err) { next(err); }
}

// ── Get Environment Preferences (GET /residents/:id/environment) ──────────
export async function getEnvironmentPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { rows: [prefs] } = await query(
      `SELECT ep.* FROM environment_preferences ep
       JOIN residents r ON r.id = ep.resident_id
       WHERE ep.resident_id = $1 AND r.care_home_id = $2`,
      [id, careHomeId]
    );
    res.json(prefs || null);
  } catch (err) { next(err); }
}

// ── Update Environment Preferences (PUT /residents/:id/environment) ───────
export async function updateEnvironmentPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;

    // Verify resident belongs to the requesting user's care home
    const { rows: [resident] } = await query(
      `SELECT id FROM residents WHERE id = $1 AND care_home_id = $2`,
      [id, careHomeId]
    );
    if (!resident) return next(new AppError(404, 'Resident not found'));

    const {
      preferredLighting, preferredTemperature, preferredMusicVolume,
      calmingSounds, aromatherapy, roomDecorations,
      photoDisplayPreference, tvVolume, noiseSensitivity, notes
    } = req.body;

    const { rows: [prefs] } = await query(
      `INSERT INTO environment_preferences (
         resident_id, preferred_lighting, preferred_temperature, preferred_music_volume,
         calming_sounds, aromatherapy, room_decorations,
         photo_display_preference, tv_volume, noise_sensitivity, notes, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (resident_id) DO UPDATE SET
         preferred_lighting = EXCLUDED.preferred_lighting,
         preferred_temperature = EXCLUDED.preferred_temperature,
         preferred_music_volume = EXCLUDED.preferred_music_volume,
         calming_sounds = EXCLUDED.calming_sounds,
         aromatherapy = EXCLUDED.aromatherapy,
         room_decorations = EXCLUDED.room_decorations,
         photo_display_preference = EXCLUDED.photo_display_preference,
         tv_volume = EXCLUDED.tv_volume,
         noise_sensitivity = EXCLUDED.noise_sensitivity,
         notes = EXCLUDED.notes,
         updated_at = NOW()
       RETURNING *`,
      [id, preferredLighting, preferredTemperature, preferredMusicVolume,
       calmingSounds || [], aromatherapy || [], roomDecorations,
       photoDisplayPreference, tvVolume, noiseSensitivity, notes]
    );
    res.json(prefs);
  } catch (err) { next(err); }
}
