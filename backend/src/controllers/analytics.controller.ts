import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// Outcomes / impact analytics — proof that the home improves residents' lives.
// All figures are care_home-scoped. Trends are gap-filled in JS so charts are stable.
export async function getOutcomes(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const days = Math.min(365, Math.max(30, parseInt(String(req.query.days || '90')) || 90));

    // Occupancy
    const occ = await query(
      `SELECT (SELECT COUNT(*)::int FROM residents WHERE care_home_id=$1 AND active=TRUE) AS residents,
              (SELECT COALESCE(registered_beds,0)::int FROM care_homes WHERE id=$1) AS beds`, [chId]);
    const residents = occ.rows[0]?.residents || 0;
    const beds = occ.rows[0]?.beds || 0;

    // Falls — last 30d vs previous 30d, plus per-1000-bed-day rate
    const bedDays30 = Math.max(1, residents * 30);
    const falls = await query(
      `SELECT
         COUNT(*) FILTER (WHERE incident_date >= NOW() - INTERVAL '30 days') AS cur,
         COUNT(*) FILTER (WHERE incident_date >= NOW() - INTERVAL '60 days'
                          AND incident_date < NOW() - INTERVAL '30 days') AS prev
       FROM incidents WHERE care_home_id=$1 AND incident_type ILIKE '%fall%'`, [chId]);
    const fallsCur = Number(falls.rows[0]?.cur || 0);
    const fallsPrev = Number(falls.rows[0]?.prev || 0);

    // All incidents last 30d vs prev 30d
    const inc = await query(
      `SELECT
         COUNT(*) FILTER (WHERE incident_date >= NOW() - INTERVAL '30 days') AS cur,
         COUNT(*) FILTER (WHERE incident_date >= NOW() - INTERVAL '60 days'
                          AND incident_date < NOW() - INTERVAL '30 days') AS prev
       FROM incidents WHERE care_home_id=$1`, [chId]);

    // Falls trend — monthly, last 6 months
    const fallsMonthly = await query(
      `SELECT to_char(date_trunc('month', incident_date),'YYYY-MM') AS ym, COUNT(*)::int AS n
       FROM incidents WHERE care_home_id=$1 AND incident_type ILIKE '%fall%'
         AND incident_date >= date_trunc('month', NOW()) - INTERVAL '5 months'
       GROUP BY 1 ORDER BY 1`, [chId]);
    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const fmMap = new Map(fallsMonthly.rows.map((r: any) => [r.ym, r.n]));
    const falls_trend = monthKeys.map(ym => {
      const count = Number(fmMap.get(ym) || 0);
      return { month: ym, count, per1000: Math.round((count / Math.max(1, residents * 30)) * 1000 * 10) / 10 };
    });

    // Incidents by type — last `days`
    const byType = await query(
      `SELECT incident_type AS type, COUNT(*)::int AS n
       FROM incidents WHERE care_home_id=$1 AND incident_date >= NOW() - ($2::int * INTERVAL '1 day')
       GROUP BY 1 ORDER BY n DESC LIMIT 8`, [chId, days]);

    // Wellbeing mood — distribution last 30d + low% trend by week (8 weeks)
    const moodDist = await query(
      `SELECT mood, COUNT(*)::int AS n FROM wellbeing_logs
       WHERE care_home_id=$1 AND log_date >= CURRENT_DATE - 30 AND mood IS NOT NULL
       GROUP BY 1`, [chId]);
    const moodOrder = ['very_happy', 'happy', 'neutral', 'low', 'very_low'];
    const mdMap = new Map(moodDist.rows.map((r: any) => [r.mood, r.n]));
    const mood_distribution = moodOrder.map(m => ({ mood: m, count: Number(mdMap.get(m) || 0) }));
    const moodLowPct = (() => {
      const total = mood_distribution.reduce((a, b) => a + b.count, 0);
      const low = mood_distribution.filter(m => m.mood === 'low' || m.mood === 'very_low').reduce((a, b) => a + b.count, 0);
      return total ? Math.round((low / total) * 100) : 0;
    })();

    // Social isolation — residents flagged isolated in last 14d
    const iso = await query(
      `SELECT COUNT(DISTINCT resident_id)::int AS n FROM wellbeing_logs
       WHERE care_home_id=$1 AND log_date >= CURRENT_DATE - 14 AND social_engagement='isolated'`, [chId]);

    // Care task completion — last 7d
    const tasks = await query(
      `SELECT COUNT(*) FILTER (WHERE status='done')::int AS done, COUNT(*)::int AS total
       FROM care_tasks WHERE care_home_id=$1 AND task_date >= CURRENT_DATE - 7`, [chId]);
    const tDone = Number(tasks.rows[0]?.done || 0), tTotal = Number(tasks.rows[0]?.total || 0);
    const taskPct: number | null = tTotal ? Math.round((tDone / tTotal) * 100) : null;

    // Task completion trend — weekly 6 weeks
    const taskWeekly = await query(
      `SELECT to_char(date_trunc('week', task_date),'YYYY-MM-DD') AS wk,
              COUNT(*) FILTER (WHERE status='done')::int AS done, COUNT(*)::int AS total
       FROM care_tasks WHERE care_home_id=$1 AND task_date >= CURRENT_DATE - 42
       GROUP BY 1 ORDER BY 1`, [chId]);
    const task_completion_trend = taskWeekly.rows.map((r: any) => ({
      week: r.wk, pct: r.total ? Math.round((r.done / r.total) * 100) : 0,
    }));

    // Weight stability — compare each resident's latest two weights
    const weights = await query(
      `WITH ranked AS (
         SELECT resident_id, weight_kg,
                ROW_NUMBER() OVER (PARTITION BY resident_id ORDER BY created_at DESC) AS rn
         FROM resident_weights WHERE care_home_id=$1 AND weight_kg IS NOT NULL)
       SELECT resident_id,
              MAX(weight_kg) FILTER (WHERE rn=1) AS latest,
              MAX(weight_kg) FILTER (WHERE rn=2) AS prev
       FROM ranked WHERE rn <= 2 GROUP BY resident_id`, [chId]);
    let wStable = 0, wDown = 0, wUp = 0;
    for (const r of weights.rows) {
      if (r.prev == null) { wStable++; continue; }
      const diff = Number(r.latest) - Number(r.prev);
      const pct = Number(r.prev) ? diff / Number(r.prev) : 0;
      if (pct <= -0.03) wDown++; else if (pct >= 0.03) wUp++; else wStable++;
    }
    const wTracked = weights.rows.length;
    const weight_stable_pct = wTracked ? Math.round(((wStable + wUp) / wTracked) * 100) : 0;

    // NEWS2 early-warning — high/critical assessments (30d vs prev 30d), pending escalations,
    // and residents whose latest score is elevated.
    const n2 = await query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'
                          AND risk_level IN ('high','critical')) AS cur,
         COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '60 days'
                          AND created_at < NOW() - INTERVAL '30 days'
                          AND risk_level IN ('high','critical')) AS prev
       FROM news2_assessments WHERE care_home_id=$1`, [chId]);
    const n2Cur = Number(n2.rows[0]?.cur || 0), n2Prev = Number(n2.rows[0]?.prev || 0);

    const n2Pending = await query(
      `SELECT COUNT(*)::int AS n FROM news2_escalations
       WHERE care_home_id=$1 AND status='pending'`, [chId]);

    const n2Elevated = await query(
      `WITH latest AS (
         SELECT resident_id, risk_level,
                ROW_NUMBER() OVER (PARTITION BY resident_id ORDER BY created_at DESC) AS rn
         FROM news2_assessments WHERE care_home_id=$1)
       SELECT COUNT(*)::int AS n FROM latest WHERE rn=1 AND risk_level IN ('high','critical')`, [chId]);

    const n2Monthly = await query(
      `SELECT to_char(date_trunc('month', created_at),'YYYY-MM') AS ym, COUNT(*)::int AS n
       FROM news2_assessments WHERE care_home_id=$1 AND risk_level IN ('high','critical')
         AND created_at >= date_trunc('month', NOW()) - INTERVAL '5 months'
       GROUP BY 1 ORDER BY 1`, [chId]);
    const n2Map = new Map(n2Monthly.rows.map((r: any) => [r.ym, r.n]));
    const news2_trend = monthKeys.map(ym => ({ month: ym, count: Number(n2Map.get(ym) || 0) }));

    // A percentage change from zero is undefined — return null so the UI can say
    // "no prior data" instead of a misleading 100%/1300%.
    const delta = (cur: number, prev: number): number | null =>
      prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);

    res.json({
      range_days: days,
      occupancy: { residents, beds, pct: beds ? Math.round((residents / beds) * 100) : 0 },
      kpis: {
        falls: { value: fallsCur, prev: fallsPrev, delta: delta(fallsCur, fallsPrev),
                 per1000: Math.round((fallsCur / bedDays30) * 1000 * 10) / 10, good: 'down' },
        incidents: { value: Number(inc.rows[0]?.cur || 0), prev: Number(inc.rows[0]?.prev || 0),
                     delta: delta(Number(inc.rows[0]?.cur || 0), Number(inc.rows[0]?.prev || 0)), good: 'down' },
        task_completion: { value: taskPct, done: tDone, total: tTotal, good: 'up' },
        wellbeing_low: { value: moodLowPct, good: 'down' },
        isolation: { value: Number(iso.rows[0]?.n || 0), good: 'down' },
        weight_stable: { value: weight_stable_pct, tracked: wTracked, good: 'up' },
        news2_high: { value: n2Cur, prev: n2Prev, delta: delta(n2Cur, n2Prev), good: 'down' },
        news2_pending: { value: Number(n2Pending.rows[0]?.n || 0), good: 'down' },
        news2_elevated: { value: Number(n2Elevated.rows[0]?.n || 0), good: 'down' },
      },
      falls_trend,
      news2_trend,
      incidents_by_type: byType.rows,
      mood_distribution,
      task_completion_trend,
      weight: { stable: wStable, up: wUp, down: wDown, tracked: wTracked },
    });
  } catch (err) { next(err); }
}

// ── Outcome drill-down ────────────────────────────────────────────────────
// Returns the records behind a headline metric, plus a plain-English read of
// what is going well and what needs attention, so a manager can act on it.
export async function getOutcomeDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const metric = String(req.params.metric || '');
    const good: string[] = [];
    const attention: string[] = [];
    const actions: string[] = [];
    let title = '';
    let rows: any[] = [];
    let columns: { key: string; label: string }[] = [];

    if (metric === 'falls' || metric === 'incidents') {
      const isFalls = metric === 'falls';
      title = isFalls ? 'Falls in the last 30 days' : 'All incidents in the last 30 days';
      const q = await query(
        `SELECT i.id, i.incident_date, i.incident_type, i.severity, i.status,
                r.first_name || ' ' || r.last_name AS resident, r.room_number
         FROM incidents i LEFT JOIN residents r ON r.id = i.resident_id
         WHERE i.care_home_id = $1 AND i.incident_date >= NOW() - INTERVAL '30 days'
           ${isFalls ? "AND i.incident_type ILIKE '%fall%'" : ''}
         ORDER BY i.incident_date DESC LIMIT 100`, [chId]);
      rows = q.rows;
      columns = [
        { key: 'incident_date', label: 'Date' }, { key: 'resident', label: 'Resident' },
        { key: 'room_number', label: 'Room' }, { key: 'incident_type', label: 'Type' },
        { key: 'severity', label: 'Severity' }, { key: 'status', label: 'Status' },
      ];
      // repeat fallers
      const repeat = await query(
        `SELECT r.first_name || ' ' || r.last_name AS resident, r.room_number, COUNT(*)::int AS n
         FROM incidents i JOIN residents r ON r.id = i.resident_id
         WHERE i.care_home_id = $1 AND i.incident_date >= NOW() - INTERVAL '30 days'
           ${isFalls ? "AND i.incident_type ILIKE '%fall%'" : ''}
         GROUP BY 1,2 HAVING COUNT(*) > 1 ORDER BY n DESC`, [chId]);
      const openCount = rows.filter(r => r.status === 'open').length;
      const severe = rows.filter(r => ['high', 'critical'].includes(String(r.severity))).length;

      if (rows.length === 0) good.push('No incidents recorded in the last 30 days.');
      if (openCount === 0 && rows.length > 0) good.push('Every incident has been reviewed or closed.');
      if (severe === 0 && rows.length > 0) good.push('No high or critical severity incidents.');
      if (repeat.rows.length) {
        attention.push(`${repeat.rows.length} resident(s) had more than one: ${repeat.rows.map((x: any) => `${x.resident} (${x.n})`).join(', ')}.`);
        actions.push('Review individual risk assessments and care plans for repeat residents.');
      }
      if (openCount) { attention.push(`${openCount} incident(s) are still open.`); actions.push('Close out open incidents with actions taken and lessons learned.'); }
      if (severe) { attention.push(`${severe} incident(s) were high or critical severity.`); actions.push('Confirm safeguarding referrals and CQC notifications where required.'); }

    } else if (metric === 'task_completion') {
      title = 'Scheduled care in the last 7 days';
      const q = await query(
        `SELECT ct.task_date, ct.task_name, ct.status, ct.due_time,
                r.first_name || ' ' || r.last_name AS resident, r.room_number
         FROM care_tasks ct LEFT JOIN residents r ON r.id = ct.resident_id
         WHERE ct.care_home_id = $1 AND ct.task_date >= CURRENT_DATE - 7
         ORDER BY ct.task_date DESC, ct.due_time LIMIT 200`, [chId]);
      rows = q.rows;
      columns = [
        { key: 'task_date', label: 'Date' }, { key: 'resident', label: 'Resident' },
        { key: 'room_number', label: 'Room' }, { key: 'task_name', label: 'Task' },
        { key: 'due_time', label: 'Due' }, { key: 'status', label: 'Status' },
      ];
      const done = rows.filter(r => r.status === 'done').length;
      const missed = rows.filter(r => r.status === 'missed').length;
      const pending = rows.filter(r => r.status === 'pending').length;
      if (rows.length === 0) {
        attention.push('No care tasks have been generated for the last 7 days, so completion cannot be measured.');
        actions.push('Check that daily task generation is running, and that care task templates exist in Care Tasks.');
      } else {
        if (done / rows.length >= 0.9) good.push(`${done} of ${rows.length} scheduled tasks completed — strong delivery.`);
        if (missed) { attention.push(`${missed} task(s) recorded as missed.`); actions.push('Review missed care with the shift lead and record the reason.'); }
        if (pending) attention.push(`${pending} task(s) still pending.`);
      }

    } else if (metric === 'wellbeing_low' || metric === 'isolation') {
      title = metric === 'isolation' ? 'Residents flagged as isolated (14 days)' : 'Low mood in wellbeing logs (30 days)';
      const q = metric === 'isolation'
        ? await query(
            `SELECT DISTINCT r.first_name || ' ' || r.last_name AS resident, r.room_number,
                    MAX(w.log_date) AS last_log
             FROM wellbeing_logs w JOIN residents r ON r.id = w.resident_id
             WHERE w.care_home_id = $1 AND w.log_date >= CURRENT_DATE - 14 AND w.social_engagement = 'isolated'
             GROUP BY 1,2 ORDER BY 1`, [chId])
        : await query(
            `SELECT r.first_name || ' ' || r.last_name AS resident, r.room_number, w.log_date, w.mood, w.notes
             FROM wellbeing_logs w JOIN residents r ON r.id = w.resident_id
             WHERE w.care_home_id = $1 AND w.log_date >= CURRENT_DATE - 30 AND w.mood IN ('low','very_low')
             ORDER BY w.log_date DESC LIMIT 100`, [chId]);
      rows = q.rows;
      columns = metric === 'isolation'
        ? [{ key: 'resident', label: 'Resident' }, { key: 'room_number', label: 'Room' }, { key: 'last_log', label: 'Last flagged' }]
        : [{ key: 'log_date', label: 'Date' }, { key: 'resident', label: 'Resident' }, { key: 'room_number', label: 'Room' }, { key: 'mood', label: 'Mood' }, { key: 'notes', label: 'Notes' }];
      if (rows.length === 0) good.push('No residents currently flagged — social and emotional wellbeing looks stable.');
      else {
        attention.push(`${rows.length} record(s) flagged.`);
        actions.push('Review activity participation and one-to-one time for these residents.');
        actions.push('Consider a friendship/seating review and family contact.');
      }

    } else if (metric === 'weight_stable') {
      title = 'Residents losing weight';
      const q = await query(
        `WITH ranked AS (
           SELECT resident_id, weight_kg, created_at,
                  ROW_NUMBER() OVER (PARTITION BY resident_id ORDER BY created_at DESC) AS rn
           FROM resident_weights WHERE care_home_id = $1 AND weight_kg IS NOT NULL)
         SELECT r.first_name || ' ' || r.last_name AS resident, r.room_number,
                MAX(x.weight_kg) FILTER (WHERE x.rn = 1) AS latest,
                MAX(x.weight_kg) FILTER (WHERE x.rn = 2) AS previous
         FROM ranked x JOIN residents r ON r.id = x.resident_id
         WHERE x.rn <= 2 GROUP BY 1,2`, [chId]);
      const losing = q.rows.filter((r: any) => r.previous && Number(r.latest) < Number(r.previous) * 0.97);
      rows = losing.map((r: any) => ({ ...r, change: (Number(r.latest) - Number(r.previous)).toFixed(1) + ' kg' }));
      columns = [{ key: 'resident', label: 'Resident' }, { key: 'room_number', label: 'Room' },
                 { key: 'previous', label: 'Previous' }, { key: 'latest', label: 'Latest' }, { key: 'change', label: 'Change' }];
      if (rows.length === 0) good.push('No resident has lost 3% or more of body weight since their last recorded weight.');
      else { attention.push(`${rows.length} resident(s) have lost 3%+ of body weight.`); actions.push('Complete a MUST reassessment and consider fortified diet or dietitian referral.'); }

    } else if (metric === 'news2_high' || metric === 'news2_elevated' || metric === 'news2_pending') {
      title = 'NEWS2 early-warning detail';
      const q = await query(
        `SELECT n.created_at, n.total_score, n.risk_level,
                r.first_name || ' ' || r.last_name AS resident, r.room_number
         FROM news2_assessments n JOIN residents r ON r.id = n.resident_id
         WHERE n.care_home_id = $1 AND n.created_at >= NOW() - INTERVAL '30 days'
           AND n.risk_level IN ('high','critical')
         ORDER BY n.created_at DESC LIMIT 100`, [chId]);
      rows = q.rows;
      columns = [{ key: 'created_at', label: 'When' }, { key: 'resident', label: 'Resident' },
                 { key: 'room_number', label: 'Room' }, { key: 'total_score', label: 'Score' }, { key: 'risk_level', label: 'Risk' }];
      const pending = await query(
        `SELECT COUNT(*)::int AS n FROM news2_escalations WHERE care_home_id = $1 AND status = 'pending'`, [chId]);
      if (rows.length === 0) good.push('No high or critical NEWS2 scores in the last 30 days.');
      else { attention.push(`${rows.length} high/critical score(s) recorded.`); actions.push('Confirm each triggered the correct escalation and GP/111 review.'); }
      if (Number(pending.rows[0]?.n) > 0) { attention.push(`${pending.rows[0].n} escalation(s) still awaiting response.`); actions.push('Action open escalations now — these are time-critical.'); }
      else good.push('No escalations are waiting for a response.');

    } else {
      return res.status(400).json({ error: 'Unknown metric' });
    }

    res.json({ metric, title, columns, rows, good, attention, actions });
  } catch (err) { next(err); }
}
