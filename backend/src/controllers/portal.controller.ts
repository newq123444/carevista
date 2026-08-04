import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// Family-member-facing portal. Every query is scoped to residents this family
// user is explicitly linked to (family_links), so a family member can only ever
// see their own relative.
async function linkedResidents(userId: string) {
  const r = await query(
    `SELECT fl.resident_id, fl.relationship, fl.is_primary,
            r.first_name, r.last_name, r.room_number, r.risk_level, r.care_home_id
     FROM family_links fl JOIN residents r ON r.id = fl.resident_id
     WHERE fl.user_id = $1 AND r.active = TRUE
     ORDER BY fl.is_primary DESC, r.last_name`, [userId]);
  return r.rows;
}

async function resolveResident(req: Request, res: Response): Promise<any | null> {
  const rows = await linkedResidents(req.user!.id);
  if (rows.length === 0) { res.status(404).json({ error: 'No resident is linked to your account yet' }); return null; }
  const requested = req.query.residentId as string | undefined;
  if (requested) {
    const match = rows.find(r => r.resident_id === requested);
    if (!match) { res.status(403).json({ error: 'Not permitted for this resident' }); return null; }
    return match;
  }
  return rows[0];
}

const RISK_PLAIN: Record<string, string> = {
  low: 'Settled and stable', medium: 'Being closely monitored', high: 'Receiving extra attention and support',
};
const MOOD_PLAIN: Record<string, string> = {
  very_happy: 'Very happy', happy: 'Happy', neutral: 'Content', low: 'A little low', very_low: 'Low',
};

// GET /portal/me
export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await linkedResidents(req.user!.id);
    const home = rows[0] ? await query(`SELECT name FROM care_homes WHERE id=$1`, [rows[0].care_home_id]) : null;
    res.json({
      residents: rows.map(r => ({
        id: r.resident_id, firstName: r.first_name, lastName: r.last_name,
        room: r.room_number, relationship: r.relationship, isPrimary: r.is_primary,
      })),
      careHomeName: home?.rows[0]?.name || '',
    });
  } catch (err) { next(err); }
}

// GET /portal/feed — daily summaries + recent wellbeing in plain language
export async function feed(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await resolveResident(req, res); if (!r) return;
    const summaries = await query(
      `SELECT summary_date, meals_summary, activities_summary, mood_summary, care_notes_summary, photo_urls
       FROM family_daily_summaries WHERE resident_id=$1 ORDER BY summary_date DESC LIMIT 14`, [r.resident_id]);
    const wb = await query(
      `SELECT log_date, mood, appetite, social_engagement, energy_level
       FROM wellbeing_logs WHERE resident_id=$1 ORDER BY log_date DESC LIMIT 7`, [r.resident_id]);
    res.json({
      resident: { id: r.resident_id, firstName: r.first_name, lastName: r.last_name, room: r.room_number },
      summaries: summaries.rows,
      wellbeing: wb.rows.map((w: any) => ({
        date: w.log_date,
        mood: MOOD_PLAIN[w.mood] || w.mood,
        appetite: w.appetite, social: w.social_engagement, energy: w.energy_level,
      })),
    });
  } catch (err) { next(err); }
}

// GET /portal/photos
export async function photos(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await resolveResident(req, res); if (!r) return;
    const p = await query(
      `SELECT id, photo_url, caption, created_at FROM family_photo_gallery
       WHERE resident_id=$1 AND visibility='family' ORDER BY created_at DESC LIMIT 60`, [r.resident_id]);
    res.json({ photos: p.rows });
  } catch (err) { next(err); }
}

// GET /portal/messages
export async function messages(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await resolveResident(req, res); if (!r) return;
    const m = await query(
      `SELECT id, from_name, body, direction, read, created_at
       FROM family_messages WHERE resident_id=$1 ORDER BY created_at ASC LIMIT 200`, [r.resident_id]);
    // mark inbound-to-family (outbound from staff) as read
    await query(`UPDATE family_messages SET read=TRUE, read_at=NOW()
                 WHERE resident_id=$1 AND direction='outbound' AND read=FALSE`, [r.resident_id]);
    res.json({ messages: m.rows });
  } catch (err) { next(err); }
}

// POST /portal/messages {body}
export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await resolveResident(req, res); if (!r) return;
    const body = (req.body?.body || '').toString().trim();
    if (!body) return res.status(400).json({ error: 'Message cannot be empty' });
    if (body.length > 4000) return res.status(400).json({ error: 'Message is too long' });
    const name = `${req.user!.first_name} ${req.user!.last_name}${r.relationship ? ` (${r.relationship})` : ''}`;
    const ins = await query(
      `INSERT INTO family_messages (care_home_id, resident_id, from_user_id, from_name, body, direction, read)
       VALUES ($1,$2,$3,$4,$5,'inbound',FALSE) RETURNING id, from_name, body, direction, read, created_at`,
      [r.care_home_id, r.resident_id, req.user!.id, name, body]);
    res.status(201).json(ins.rows[0]);
  } catch (err) { next(err); }
}

// GET /portal/care-highlights — safe, curated care view (no full clinical notes)
export async function careHighlights(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await resolveResident(req, res); if (!r) return;
    const notes = await query(
      `SELECT note_type, content, created_at FROM care_notes
       WHERE resident_id=$1 AND is_private=FALSE ORDER BY created_at DESC LIMIT 5`, [r.resident_id]);
    const tasks = await query(
      `SELECT COUNT(*) FILTER (WHERE status='done')::int AS done, COUNT(*)::int AS total
       FROM care_tasks WHERE resident_id=$1 AND task_date >= CURRENT_DATE - 7`, [r.resident_id]);
    const weight = await query(
      `SELECT weight_kg, created_at FROM resident_weights
       WHERE resident_id=$1 AND weight_kg IS NOT NULL ORDER BY created_at DESC LIMIT 2`, [r.resident_id]);
    let weightTrend = 'No recent weight recorded';
    if (weight.rows.length >= 1) {
      const latest = Number(weight.rows[0].weight_kg);
      if (weight.rows.length === 2) {
        const prev = Number(weight.rows[1].weight_kg);
        const diff = latest - prev;
        weightTrend = Math.abs(diff) < 0.5 ? `Stable at ${latest} kg`
          : diff > 0 ? `Up to ${latest} kg (from ${prev} kg)` : `${latest} kg (from ${prev} kg)`;
      } else weightTrend = `${latest} kg`;
    }
    const tDone = Number(tasks.rows[0]?.done || 0), tTotal = Number(tasks.rows[0]?.total || 0);
    res.json({
      resident: { id: r.resident_id, firstName: r.first_name, lastName: r.last_name },
      wellbeingSummary: RISK_PLAIN[r.risk_level] || 'Settled',
      careThisWeek: { completed: tDone, total: tTotal, pct: tTotal ? Math.round((tDone / tTotal) * 100) : null },
      weightTrend,
      recentNotes: notes.rows.map((n: any) => ({ type: n.note_type, content: n.content, date: n.created_at })),
    });
  } catch (err) { next(err); }
}
