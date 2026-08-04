// src/controllers/familyPortal.controller.ts
// Family Portal Enhancement - daily summaries, weekly reports, photo gallery, dashboard
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { runAiOperation, AI_NOT_CONFIGURED } from '../services/ai.service';

// ── Get Daily Summary ─────────────────────────────────────────────────────
export async function getDailySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const { rows: [summary] } = await query(
      `SELECT * FROM family_daily_summaries
       WHERE care_home_id = $1 AND resident_id = $2 AND summary_date = $3`,
      [careHomeId, residentId, date]
    );

    res.json(summary || null);
  } catch (err) { next(err); }
}

// ── Generate Daily Summary ────────────────────────────────────────────────
export async function generateDailySummary(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;
    const date = (req.body.date as string) || new Date().toISOString().slice(0, 10);
    const userId = req.user!.id;

    // Get resident info
    const { rows: [resident] } = await query(
      'SELECT first_name, last_name FROM residents WHERE id = $1 AND care_home_id = $2',
      [residentId, careHomeId]
    );
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    // 1. Care notes for the day (non-private only)
    const { rows: careNotes } = await query(
      `SELECT content, note_type, mood FROM care_notes
       WHERE resident_id = $1 AND care_home_id = $2
         AND created_at::date = $3
         AND is_private = FALSE
         AND deleted_at IS NULL`,
      [residentId, careHomeId, date]
    );

    // 2. Meal-related notes (nutrition)
    const { rows: mealNotes } = await query(
      `SELECT content, fluid_intake_ml, food_eaten_percent FROM care_notes
       WHERE resident_id = $1 AND care_home_id = $2
         AND note_type = 'nutrition'
         AND created_at::date = $3
         AND deleted_at IS NULL`,
      [residentId, careHomeId, date]
    );

    // 3. Activity participations for the day
    const { rows: activities } = await query(
      `SELECT a.name AS activity_name, ap.attendance, ap.mood_before, ap.mood_after
       FROM activity_participants ap
       JOIN activity_sessions s ON s.id = ap.session_id
       JOIN activities a ON a.id = s.activity_id
       WHERE ap.resident_id = $1 AND s.care_home_id = $2
         AND s.session_date = $3`,
      [residentId, careHomeId, date]
    );

    // 4. Wellbeing log for the day
    const { rows: [wellbeingLog] } = await query(
      `SELECT mood, energy_level, appetite FROM wellbeing_logs
       WHERE resident_id = $1 AND care_home_id = $2
         AND log_date = $3`,
      [residentId, careHomeId, date]
    );

    // Build context for AI
    const context = {
      residentName: `${resident.first_name} ${resident.last_name}`,
      date,
      careNotes: careNotes.map((n: any) => ({ content: n.content, type: n.note_type, mood: n.mood })),
      meals: mealNotes.map((n: any) => ({ content: n.content, fluid: n.fluid_intake_ml, food: n.food_eaten_percent })),
      activities: activities.map((a: any) => ({ name: a.activity_name, attendance: a.attendance, moodBefore: a.mood_before, moodAfter: a.mood_after })),
      wellbeing: wellbeingLog || null,
    };

    const prompt = `Generate a warm, family-friendly daily summary for ${resident.first_name} ${resident.last_name} on ${date}.

Here is the data from today:

CARE NOTES (${careNotes.length} entries):
${careNotes.map((n: any) => `[${n.note_type}] ${n.content}${n.mood ? ' (Mood: ' + n.mood + ')' : ''}`).join('\n') || 'No notes recorded today.'}

MEALS & NUTRITION (${mealNotes.length} entries):
${mealNotes.map((n: any) => `${n.content}${n.fluid_intake_ml ? ' (Fluids: ' + n.fluid_intake_ml + 'ml)' : ''}${n.food_eaten_percent ? ' (Eaten: ' + n.food_eaten_percent + '%)' : ''}`).join('\n') || 'No meal records today.'}

ACTIVITIES (${activities.length} participations):
${activities.map((a: any) => `${a.activity_name} - ${a.attendance}${a.mood_before ? ' (Mood before: ' + a.mood_before + ', after: ' + a.mood_after + ')' : ''}`).join('\n') || 'No activities today.'}

WELLBEING:
${wellbeingLog ? `Mood: ${wellbeingLog.mood}, Energy: ${wellbeingLog.energy_level}, Appetite: ${wellbeingLog.appetite}` : 'No wellbeing log today.'}

Please provide a warm, reassuring summary suitable for family members, covering:
1. Meals & nutrition (brief, positive framing)
2. Activities & social engagement
3. Mood & general wellbeing
4. Any other care highlights

Keep it concise (3-5 short paragraphs), warm, and reassuring. Use ${resident.first_name}'s name. Avoid clinical jargon. Focus on positive moments while being honest.`;

    const aiSummary = await runAiOperation({
      careHomeId,
      requestedBy: userId,
      operation: 'family_daily_summary',
      context,
      prompt,
      systemPrompt: 'You are a compassionate care home communicator writing updates for family members. Be warm, positive, honest, and reassuring. Avoid clinical terminology. Use the resident\'s first name throughout.',
    });
    if (aiSummary === AI_NOT_CONFIGURED) return res.status(503).json({ error: 'AI features are not enabled. Add ANTHROPIC_API_KEY to the server to generate family summaries.' });

    // Parse AI response into sections (simple approach - store full text in care_notes_summary)
    const mealsSummary = mealNotes.length > 0
      ? mealNotes.map((n: any) => n.content).join('; ')
      : null;
    const activitiesSummary = activities.length > 0
      ? activities.map((a: any) => a.activity_name).join(', ')
      : null;
    const moodSummary = wellbeingLog ? wellbeingLog.mood : (careNotes.find((n: any) => n.mood)?.mood || null);

    // Upsert into family_daily_summaries
    const { rows: [upserted] } = await query(
      `INSERT INTO family_daily_summaries (care_home_id, resident_id, summary_date, meals_summary, activities_summary, mood_summary, care_notes_summary, generated_at, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'ai')
       ON CONFLICT (resident_id, summary_date)
       DO UPDATE SET meals_summary = EXCLUDED.meals_summary,
                     activities_summary = EXCLUDED.activities_summary,
                     mood_summary = EXCLUDED.mood_summary,
                     care_notes_summary = EXCLUDED.care_notes_summary,
                     generated_at = NOW(),
                     generated_by = 'ai'
       RETURNING *`,
      [careHomeId, residentId, date, mealsSummary, activitiesSummary, moodSummary, aiSummary]
    );

    res.json(upserted);
  } catch (err) { next(err); }
}

// ── Get Weekly Report ─────────────────────────────────────────────────────
export async function getWeeklyReport(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;
    const weekStart = req.query.weekStart as string;

    if (!weekStart) {
      return res.status(400).json({ error: 'weekStart query parameter is required' });
    }

    const { rows: [report] } = await query(
      `SELECT * FROM family_weekly_reports
       WHERE care_home_id = $1 AND resident_id = $2 AND week_start = $3`,
      [careHomeId, residentId, weekStart]
    );

    res.json(report || null);
  } catch (err) { next(err); }
}

// ── Generate Weekly Reports (Batch) ───────────────────────────────────────
export async function generateWeeklyReports(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;

    // Calculate week start/end (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset - 7); // Previous week
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);

    // Get all active residents
    const { rows: residents } = await query(
      'SELECT id, first_name, last_name, room_number FROM residents WHERE care_home_id = $1 AND active = TRUE',
      [careHomeId]
    );

    let generatedCount = 0;

    for (const resident of residents) {
      // Notes count and mood distribution
      const { rows: noteStats } = await query(
        `SELECT note_type, mood, COUNT(*) AS count FROM care_notes
         WHERE resident_id = $1 AND care_home_id = $2
           AND created_at::date BETWEEN $3 AND $4
           AND is_private = FALSE AND deleted_at IS NULL
         GROUP BY note_type, mood`,
        [resident.id, careHomeId, weekStartStr, weekEndStr]
      );

      // Activities participated
      const { rows: activityData } = await query(
        `SELECT a.name, ap.attendance, ap.engagement_level, ap.mood_before, ap.mood_after
         FROM activity_participants ap
         JOIN activity_sessions s ON s.id = ap.session_id
         JOIN activities a ON a.id = s.activity_id
         WHERE ap.resident_id = $1 AND s.care_home_id = $2
           AND s.session_date BETWEEN $3 AND $4`,
        [resident.id, careHomeId, weekStartStr, weekEndStr]
      );

      // Wellbeing scores for the week
      const { rows: wellbeingData } = await query(
        `SELECT mood, energy_level, appetite, sleep_quality, social_engagement, pain_level
         FROM wellbeing_logs
         WHERE resident_id = $1 AND care_home_id = $2
           AND log_date BETWEEN $3 AND $4`,
        [resident.id, careHomeId, weekStartStr, weekEndStr]
      );

      // Incidents (non-private notes that reference incidents)
      const { rows: incidents } = await query(
        `SELECT incident_type, severity, description, incident_date FROM incidents
         WHERE resident_id = $1 AND care_home_id = $2
           AND incident_date BETWEEN $3 AND $4`,
        [resident.id, careHomeId, weekStartStr, weekEndStr]
      );

      const prompt = `Generate a warm weekly family report for ${resident.first_name} ${resident.last_name} (Room ${resident.room_number}) for the week ${weekStartStr} to ${weekEndStr}.

DATA:
- Care notes this week: ${noteStats.reduce((sum: number, n: any) => sum + parseInt(n.count), 0)} entries
- Mood distribution: ${noteStats.filter((n: any) => n.mood).map((n: any) => `${n.mood}: ${n.count}`).join(', ') || 'Not recorded'}
- Activities: ${activityData.map((a: any) => `${a.name} (${a.attendance})`).join(', ') || 'None this week'}
- Wellbeing logs: ${wellbeingData.length} entries. ${wellbeingData.length > 0 ? `Average mood: ${wellbeingData.map((w: any) => w.mood).join(', ')}` : ''}
- Incidents: ${incidents.length > 0 ? incidents.map((i: any) => `${i.incident_type} (${i.severity})`).join(', ') : 'None'}

Please write a family-friendly weekly summary that covers:
1. Overall wellbeing and mood
2. Activities and social engagement
3. Highlights of the week
4. Any concerns (phrased gently)

Keep it warm, positive, and reassuring. 3-4 paragraphs maximum.`;

      const reportContent = await runAiOperation({
        careHomeId,
        requestedBy: userId,
        operation: 'family_weekly_report',
        context: { residentId: resident.id, weekStart: weekStartStr, weekEnd: weekEndStr },
        prompt,
        systemPrompt: 'You are a compassionate care home communicator. Write warm, reassuring weekly reports for family members. Focus on positive moments while being honest about any concerns. Avoid clinical jargon.',
      });
      if (reportContent === AI_NOT_CONFIGURED) return res.status(503).json({ error: 'AI features are not enabled. Add ANTHROPIC_API_KEY to the server to generate weekly reports.' });

      // Calculate average wellbeing score (simple numeric average)
      let wellbeingAvg: number | null = null;
      if (wellbeingData.length > 0) {
        const scores = wellbeingData.map((w: any) => {
          let score = 0;
          let count = 0;
          if (w.energy_level) { score += parseInt(w.energy_level) || 0; count++; }
          if (w.appetite) { score += parseInt(w.appetite) || 0; count++; }
          if (w.sleep_quality) { score += parseInt(w.sleep_quality) || 0; count++; }
          if (w.social_engagement) { score += parseInt(w.social_engagement) || 0; count++; }
          return count > 0 ? score / count : 0;
        });
        wellbeingAvg = parseFloat((scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1));
      }

      // Build highlights and concerns arrays
      const highlights: string[] = [];
      const concerns: string[] = [];

      if (activityData.length > 0) {
        highlights.push(`Participated in ${activityData.length} activities`);
      }
      const goodMoods = noteStats.filter((n: any) => n.mood && ['Happy', 'Content', 'Cheerful', 'Good'].includes(n.mood));
      if (goodMoods.length > 0) {
        highlights.push('Generally positive mood throughout the week');
      }

      if (incidents.length > 0) {
        concerns.push(`${incidents.length} incident(s) recorded this week`);
      }
      const lowMoods = noteStats.filter((n: any) => n.mood && ['Low', 'Distressed', 'Agitated', 'Anxious'].includes(n.mood));
      if (lowMoods.length > 2) {
        concerns.push('Some periods of low mood noted');
      }

      // Upsert into family_weekly_reports
      await query(
        `INSERT INTO family_weekly_reports (care_home_id, resident_id, week_start, week_end, report_content, wellbeing_score_avg, highlights, concerns, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (resident_id, week_start)
         DO UPDATE SET report_content = EXCLUDED.report_content,
                       wellbeing_score_avg = EXCLUDED.wellbeing_score_avg,
                       highlights = EXCLUDED.highlights,
                       concerns = EXCLUDED.concerns,
                       generated_at = NOW()`,
        [careHomeId, resident.id, weekStartStr, weekEndStr, reportContent, wellbeingAvg, highlights, concerns]
      );

      generatedCount++;
    }

    res.json({ generatedCount, weekStart: weekStartStr, weekEnd: weekEndStr });
  } catch (err) { next(err); }
}

// ── List Photos ───────────────────────────────────────────────────────────
export async function listPhotos(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const { rows } = await query(
      `SELECT fpg.*, u.first_name || ' ' || u.last_name AS uploaded_by_name
       FROM family_photo_gallery fpg
       LEFT JOIN users u ON u.id = fpg.uploaded_by
       WHERE fpg.care_home_id = $1 AND fpg.resident_id = $2
       ORDER BY fpg.created_at DESC
       LIMIT $3 OFFSET $4`,
      [careHomeId, residentId, limit, offset]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Upload Family Photo ───────────────────────────────────────────────────
export async function uploadFamilyPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;
    const { caption } = req.body;
    const userId = req.user!.id;

    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ error: 'No photo file uploaded' });
    }

    const photoUrl = `/uploads/${file.filename}`;

    const { rows: [photo] } = await query(
      `INSERT INTO family_photo_gallery (care_home_id, resident_id, photo_url, caption, uploaded_by, visibility)
       VALUES ($1, $2, $3, $4, $5, 'family')
       RETURNING *`,
      [careHomeId, residentId, photoUrl, caption || null, userId]
    );

    res.status(201).json(photo);
  } catch (err) { next(err); }
}

// ── Get Family Dashboard ──────────────────────────────────────────────────
export async function getFamilyDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId } = req.params;
    const today = new Date().toISOString().slice(0, 10);

    // Resident basic info
    const { rows: [resident] } = await query(
      `SELECT id, first_name, last_name, room_number, photo_url
       FROM residents WHERE id = $1 AND care_home_id = $2`,
      [residentId, careHomeId]
    );
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    // Today's summary
    const { rows: [todaySummary] } = await query(
      `SELECT * FROM family_daily_summaries
       WHERE care_home_id = $1 AND resident_id = $2 AND summary_date = $3`,
      [careHomeId, residentId, today]
    );

    // Recent photos (last 6)
    const { rows: recentPhotos } = await query(
      `SELECT id, photo_url, caption, created_at FROM family_photo_gallery
       WHERE care_home_id = $1 AND resident_id = $2
       ORDER BY created_at DESC LIMIT 6`,
      [careHomeId, residentId]
    );

    // Unread message count
    const { rows: [msgCount] } = await query(
      `SELECT COUNT(*) AS count FROM family_messages
       WHERE care_home_id = $1 AND resident_id = $2 AND read = FALSE`,
      [careHomeId, residentId]
    );

    // Latest wellbeing log
    const { rows: [latestWellbeing] } = await query(
      `SELECT * FROM wellbeing_logs
       WHERE care_home_id = $1 AND resident_id = $2
       ORDER BY log_date DESC LIMIT 1`,
      [careHomeId, residentId]
    );

    res.json({
      resident,
      todaySummary: todaySummary || null,
      recentPhotos,
      unreadMessageCount: parseInt(msgCount.count) || 0,
      latestWellbeing: latestWellbeing || null,
    });
  } catch (err) { next(err); }
}
