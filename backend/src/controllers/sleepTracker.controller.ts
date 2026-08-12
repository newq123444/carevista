import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Log Sleep ─────────────────────────────────────────────────────────────

export async function logSleep(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId, sleepDate, bedtime, wakeTime, disturbances, disturbanceTypes, interventions, qualityRating, totalSleepHrs, notes } = req.body;

    if (!residentId || !sleepDate) {
      return res.status(400).json({ error: 'residentId and sleepDate are required' });
    }

    const { rows: [log] } = await query(
      `INSERT INTO sleep_logs (care_home_id, resident_id, sleep_date, bedtime, wake_time, disturbances, disturbance_types, interventions, quality_rating, total_sleep_hrs, notes, logged_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [careHomeId, residentId, sleepDate, bedtime, wakeTime, disturbances || 0, JSON.stringify(disturbanceTypes || []), JSON.stringify(interventions || []), qualityRating, totalSleepHrs, notes, userId]
    );

    res.status(201).json(log);
  } catch (err) { next(err); }
}

// ── Get Sleep History ─────────────────────────────────────────────────────

export async function getSleepHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT sl.*, u.first_name || ' ' || u.last_name AS logged_by_name
       FROM sleep_logs sl
       LEFT JOIN users u ON u.id = sl.logged_by
       WHERE sl.resident_id = $1 AND sl.care_home_id = $2
       ORDER BY sl.sleep_date DESC`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Sleep Profile ─────────────────────────────────────────────────────

export async function getSleepProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    // Get or calculate the profile from last 30 days
    const { rows: [stats] } = await query(
      `SELECT
         AVG(quality_rating) AS avg_quality,
         AVG(disturbances) AS avg_disturbances,
         AVG(total_sleep_hrs) AS avg_sleep_hours,
         COUNT(*) AS total_logs,
         MIN(sleep_date) AS period_start,
         MAX(sleep_date) AS period_end
       FROM sleep_logs
       WHERE resident_id = $1 AND care_home_id = $2
         AND sleep_date >= CURRENT_DATE - INTERVAL '30 days'`,
      [residentId, careHomeId]
    );

    // Get existing profile
    const { rows: [profile] } = await query(
      `SELECT * FROM sleep_profiles WHERE resident_id = $1 AND care_home_id = $2`,
      [residentId, careHomeId]
    );

    res.json({
      profile: profile || null,
      recentStats: stats
    });
  } catch (err) { next(err); }
}

// ── Get Disturbance Patterns ──────────────────────────────────────────────

export async function getDisturbancePatterns(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT
         sleep_date,
         disturbances,
         disturbance_types,
         quality_rating,
         EXTRACT(DOW FROM sleep_date) AS day_of_week
       FROM sleep_logs
       WHERE resident_id = $1 AND care_home_id = $2
         AND sleep_date >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY sleep_date DESC`,
      [residentId, careHomeId]
    );

    // Aggregate disturbance types
    const typeFrequency: Record<string, number> = {};
    for (const row of rows) {
      if (Array.isArray(row.disturbance_types)) {
        for (const t of row.disturbance_types) {
          typeFrequency[t] = (typeFrequency[t] || 0) + 1;
        }
      }
    }

    res.json({
      logs: rows,
      disturbanceTypeFrequency: typeFrequency,
      totalDisturbances: rows.reduce((sum, r) => sum + (r.disturbances || 0), 0)
    });
  } catch (err) { next(err); }
}

// ── Get Sleep Suggestions ─────────────────────────────────────────────────

export async function getSleepSuggestions(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    // Find effective interventions from sleep logs
    const { rows } = await query(
      `SELECT
         interventions,
         AVG(quality_rating) AS avg_quality_with_intervention,
         COUNT(*) AS times_used
       FROM sleep_logs
       WHERE resident_id = $1 AND care_home_id = $2
         AND interventions != '[]'::jsonb
         AND quality_rating IS NOT NULL
         AND sleep_date >= CURRENT_DATE - INTERVAL '90 days'
       GROUP BY interventions
       ORDER BY avg_quality_with_intervention DESC
       LIMIT 10`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Passive sleep picture ─────────────────────────────────────────────────
// Builds a non-intrusive view of how a resident is sleeping using records the
// team already creates — overnight continence changes, repositioning, night
// notes and incidents — plus next-day wellbeing as a proxy. No sensors, no
// wearables, and crucially no extra checks that would themselves wake them.
export async function getPassiveSleep(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { residentId } = req.params;
    const nights = Math.min(30, Math.max(7, parseInt(String(req.query.nights || '14')) || 14));

    // A "night" runs 21:00 -> 07:00 and is labelled by the date it started.
    const inNight = (col: string) => `(EXTRACT(HOUR FROM ${col}) >= 21 OR EXTRACT(HOUR FROM ${col}) < 7)`;

    const continence = await query(
      `SELECT event_time AS at, 'continence' AS source, event_type AS detail
       FROM continence_logs
       WHERE care_home_id=$1 AND resident_id=$2
         AND event_time >= NOW() - ($3::int * INTERVAL '1 day')
         AND ${inNight('event_time')}
       ORDER BY event_time DESC`, [chId, residentId, nights]);

    const tasks = await query(
      `SELECT completed_at AS at, 'care task' AS source, task_name AS detail
       FROM care_tasks
       WHERE care_home_id=$1 AND resident_id=$2 AND status='done' AND completed_at IS NOT NULL
         AND completed_at >= NOW() - ($3::int * INTERVAL '1 day')
         AND ${inNight('completed_at')}
       ORDER BY completed_at DESC`, [chId, residentId, nights]);

    const notes = await query(
      `SELECT created_at AS at, 'night note' AS source, LEFT(content, 120) AS detail
       FROM care_notes
       WHERE care_home_id=$1 AND resident_id=$2 AND deleted_at IS NULL
         AND created_at >= NOW() - ($3::int * INTERVAL '1 day')
         AND ${inNight('created_at')}
       ORDER BY created_at DESC`, [chId, residentId, nights]);

    const incidents = await query(
      `SELECT incident_date AS at, 'incident' AS source, incident_type AS detail
       FROM incidents
       WHERE care_home_id=$1 AND resident_id=$2
         AND incident_date >= NOW() - ($3::int * INTERVAL '1 day')
         AND ${inNight('incident_date')}
       ORDER BY incident_date DESC`, [chId, residentId, nights]);

    const events = [...continence.rows, ...tasks.rows, ...notes.rows, ...incidents.rows]
      .filter((e: any) => e.at)
      .sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime());

    // group into nights
    const nightOf = (d: Date) => {
      const x = new Date(d);
      if (x.getHours() < 7) x.setDate(x.getDate() - 1);
      return x.toISOString().slice(0, 10);
    };
    const byNight = new Map<string, any[]>();
    for (const e of events) {
      const k = nightOf(new Date(e.at));
      if (!byNight.has(k)) byNight.set(k, []);
      byNight.get(k)!.push({ at: e.at, source: e.source, detail: e.detail });
    }

    // next-day wellbeing as the daytime proxy
    const wb = await query(
      `SELECT log_date, mood, energy_level, appetite, sleep_quality
       FROM wellbeing_logs
       WHERE care_home_id=$1 AND resident_id=$2 AND log_date >= CURRENT_DATE - $3::int
       ORDER BY log_date DESC`, [chId, residentId, nights]);
    const wbByDate = new Map(wb.rows.map((r: any) => [String(r.log_date).slice(0, 10), r]));

    const nightList: any[] = [];
    for (let i = 0; i < nights; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const evs = (byNight.get(key) || []).sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
      const nextDay = new Date(d); nextDay.setDate(nextDay.getDate() + 1);
      const morning: any = wbByDate.get(nextDay.toISOString().slice(0, 10)) || wbByDate.get(key);
      nightList.push({
        night: key,
        disturbances: evs.length,
        events: evs,
        morning: morning ? { mood: morning.mood, energy: morning.energy_level, appetite: morning.appetite, staffRated: morning.sleep_quality } : null,
      });
    }

    const counts = nightList.map(n => n.disturbances);
    const avg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const recent = counts.slice(0, 7).reduce((a, b) => a + b, 0) / Math.max(1, Math.min(7, counts.length));
    const older = counts.slice(7).length ? counts.slice(7).reduce((a, b) => a + b, 0) / counts.slice(7).length : recent;

    // Which hour is worst?
    const hourTally: Record<number, number> = {};
    for (const e of events) { const h = new Date(e.at).getHours(); hourTally[h] = (hourTally[h] || 0) + 1; }
    const worstHour = Object.entries(hourTally).sort((a, b) => b[1] - a[1])[0];

    // Closely-spaced events that could be combined into one visit
    let clusterable = 0;
    for (const n of nightList) {
      for (let i = 1; i < n.events.length; i++) {
        const gap = (new Date(n.events[i].at).getTime() - new Date(n.events[i - 1].at).getTime()) / 60000;
        if (gap > 0 && gap <= 45) clusterable++;
      }
    }

    const good: string[] = [];
    const attention: string[] = [];
    const actions: string[] = [];

    if (events.length === 0) {
      good.push('No overnight care events recorded — on the available evidence their nights are undisturbed.');
      actions.push('If this resident is on routine night checks, review whether those checks are still necessary.');
    } else {
      if (avg <= 1) good.push(`Averaging ${avg.toFixed(1)} overnight contacts per night — low disturbance.`);
      if (recent < older - 0.5) good.push('Overnight disturbances are trending down compared with the previous week.');
      if (avg >= 3) { attention.push(`Averaging ${avg.toFixed(1)} overnight contacts per night — sleep is likely fragmented.`); actions.push('Review whether every overnight contact is clinically necessary.'); }
      if (recent > older + 0.5) attention.push('Overnight disturbances have increased compared with the previous week.');
      if (worstHour) attention.push(`Most disturbances occur around ${String(worstHour[0]).padStart(2, '0')}:00 (${worstHour[1]} events).`);
      if (clusterable > 0) { attention.push(`${clusterable} pair(s) of contacts happened within 45 minutes of each other.`); actions.push('Consider combining continence care and repositioning into a single visit to reduce wakings.'); }
    }

    const lowMornings = nightList.filter(n => n.morning && ['low', 'very_low'].includes(n.morning.energy)).length;
    const poorAppetite = nightList.filter(n => n.morning && ['poor', 'refused'].includes(n.morning.appetite)).length;
    if (lowMornings >= 3) { attention.push(`Low daytime energy on ${lowMornings} of the last ${nights} days — a classic sign of poor sleep.`); actions.push('Check for daytime napping, and review evening routine, caffeine and room environment.'); }
    if (poorAppetite >= 3) attention.push(`Poor morning appetite on ${poorAppetite} days, which often accompanies disturbed sleep.`);
    if (lowMornings === 0 && events.length > 0) good.push('Daytime energy has held up well, suggesting sleep quality is adequate.');

    actions.push('Check room temperature (18–20°C), light spill from corridors and night-time noise.');

    res.json({
      residentId, nights,
      averageDisturbances: Math.round(avg * 10) / 10,
      totalEvents: events.length,
      trend: recent === older ? 'steady' : recent < older ? 'improving' : 'worsening',
      worstHour: worstHour ? Number(worstHour[0]) : null,
      clusterable,
      nightsList: nightList,
      good, attention, actions,
      method: 'Derived from existing overnight care records and next-day wellbeing. No sensors or additional checks were used.',
    });
  } catch (err) { next(err); }
}
