import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// A real activity feed: every entry is an actual record created by a real member
// of staff. Nothing here is generated or simulated — if the home is quiet, the
// feed is quiet.
export async function getActivityFeed(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const limit = Math.min(200, Math.max(10, parseInt(String(req.query.limit || '60')) || 60));
    const hours = Math.min(168, Math.max(1, parseInt(String(req.query.hours || '24')) || 24));

    const sql = `
      -- Care notes
      SELECT cn.created_at AS at, 'care-note' AS type, 'Care' AS department,
             COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') AS staff,
             cn.note_type::text AS detail,
             r.first_name || ' ' || r.last_name AS resident, r.room_number, NULL::text AS extra
      FROM care_notes cn
      LEFT JOIN users u ON u.id = cn.author_id
      LEFT JOIN residents r ON r.id = cn.resident_id
      WHERE cn.care_home_id = $1 AND cn.deleted_at IS NULL
        AND cn.created_at >= NOW() - ($2::int * INTERVAL '1 hour')

      UNION ALL
      -- Completed care tasks
      SELECT ct.completed_at, 'task', 'Care',
             COALESCE(u.first_name || ' ' || u.last_name, 'Unknown'),
             ct.task_name, r.first_name || ' ' || r.last_name, r.room_number, NULL
      FROM care_tasks ct
      LEFT JOIN users u ON u.id = ct.completed_by
      LEFT JOIN residents r ON r.id = ct.resident_id
      WHERE ct.care_home_id = $1 AND ct.status = 'done' AND ct.completed_at IS NOT NULL
        AND ct.completed_at >= NOW() - ($2::int * INTERVAL '1 hour')

      UNION ALL
      -- Medication administrations
      SELECT ma.created_at, 'medication', 'Nursing',
             COALESCE(u.first_name || ' ' || u.last_name, 'Unknown'),
             m.name, r.first_name || ' ' || r.last_name, r.room_number, ma.status::text
      FROM med_administrations ma
      LEFT JOIN users u ON u.id = ma.administered_by
      LEFT JOIN residents r ON r.id = ma.resident_id
      LEFT JOIN medications m ON m.id = ma.medication_id
      WHERE ma.care_home_id = $1
        AND ma.created_at >= NOW() - ($2::int * INTERVAL '1 hour')

      UNION ALL
      -- Incidents
      SELECT i.created_at, 'incident', 'Care',
             COALESCE(u.first_name || ' ' || u.last_name, 'Unknown'),
             i.incident_type, r.first_name || ' ' || r.last_name, r.room_number, i.severity::text
      FROM incidents i
      LEFT JOIN users u ON u.id = i.reported_by
      LEFT JOIN residents r ON r.id = i.resident_id
      WHERE i.care_home_id = $1
        AND i.created_at >= NOW() - ($2::int * INTERVAL '1 hour')

      UNION ALL
      -- Housekeeping
      SELECT hl.completed_at, 'cleaning', 'Cleaning',
             COALESCE(u.first_name || ' ' || u.last_name, 'Unknown'),
             hl.category, NULL, hl.room_number, NULL
      FROM housekeeping_logs hl
      LEFT JOIN users u ON u.id = hl.completed_by
      WHERE hl.care_home_id = $1 AND hl.completed_at IS NOT NULL
        AND hl.completed_at >= NOW() - ($2::int * INTERVAL '1 hour')

      UNION ALL
      -- Meals served
      SELECT mo.served_at, 'kitchen', 'Kitchen',
             COALESCE(u.first_name || ' ' || u.last_name, 'Unknown'),
             mo.choice_name, r.first_name || ' ' || r.last_name, r.room_number, mo.meal_type
      FROM meal_orders mo
      LEFT JOIN users u ON u.id = mo.served_by
      LEFT JOIN residents r ON r.id = mo.resident_id
      WHERE mo.care_home_id = $1 AND mo.status = 'served' AND mo.served_at IS NOT NULL
        AND mo.served_at >= NOW() - ($2::int * INTERVAL '1 hour')

      UNION ALL
      -- Kitchen temperature checks
      SELECT kt.recorded_at, 'kitchen', 'Kitchen',
             COALESCE(u.first_name || ' ' || u.last_name, 'Unknown'),
             kt.log_type, NULL, kt.location,
             kt.temperature_c::text || '°C' || CASE WHEN kt.within_range = FALSE THEN ' (out of range)' ELSE '' END
      FROM kitchen_temperature_logs kt
      LEFT JOIN users u ON u.id = kt.recorded_by
      WHERE kt.care_home_id = $1
        AND kt.recorded_at >= NOW() - ($2::int * INTERVAL '1 hour')

      UNION ALL
      -- Visitors
      SELECT v.sign_in_time, 'visitor', 'Reception', v.visitor_name,
             v.visitor_type, r.first_name || ' ' || r.last_name, NULL, v.purpose
      FROM visitor_records v
      LEFT JOIN residents r ON r.id = v.visiting_resident_id
      WHERE v.care_home_id = $1
        AND v.sign_in_time >= NOW() - ($2::int * INTERVAL '1 hour')

      UNION ALL
      -- Resident absences / returns
      SELECT ra.created_at, 'admission', 'Admin',
             COALESCE(u.first_name || ' ' || u.last_name, 'Unknown'),
             ra.absence_type, r.first_name || ' ' || r.last_name, r.room_number, ra.reason
      FROM resident_absences ra
      LEFT JOIN users u ON u.id = ra.recorded_by
      LEFT JOIN residents r ON r.id = ra.resident_id
      WHERE ra.care_home_id = $1
        AND ra.created_at >= NOW() - ($2::int * INTERVAL '1 hour')

      ORDER BY at DESC NULLS LAST
      LIMIT $3`;

    const { rows } = await query(sql, [chId, hours, limit]);

    const ICON: Record<string, string> = {
      'care-note': '📝', task: '✅', medication: '💊', incident: '⚠️',
      cleaning: '🧹', kitchen: '👨‍🍳', visitor: '🧍', admission: '🏥', maintenance: '🔧',
    };
    const COLOR: Record<string, string> = {
      'care-note': '#0d9488', task: '#16a34a', medication: '#7c3aed', incident: '#d97706',
      cleaning: '#14b8a6', kitchen: '#f97316', visitor: '#0891b2', admission: '#ec4899', maintenance: '#64748b',
    };
    const human = (s: string) => String(s || '').replace(/_/g, ' ');

    const entries = rows.map((r: any, i: number) => {
      const who = r.resident ? `${r.resident}${r.room_number ? ` (Room ${r.room_number})` : ''}` : (r.room_number || '');
      let message = '';
      switch (r.type) {
        case 'care-note':  message = `${human(r.detail)} note recorded${who ? ` for ${who}` : ''}`; break;
        case 'task':       message = `${r.detail} completed${who ? ` for ${who}` : ''}`; break;
        case 'medication': message = `${r.detail || 'Medication'} — ${human(r.extra)}${who ? ` for ${who}` : ''}`; break;
        case 'incident':   message = `${human(r.detail)} reported${who ? ` for ${who}` : ''}${r.extra ? ` (${r.extra} severity)` : ''}`; break;
        case 'cleaning':   message = `${human(r.detail)} completed${r.room_number ? ` — ${r.room_number}` : ''}`; break;
        case 'kitchen':    message = r.extra && r.extra.includes('°C')
                             ? `${human(r.detail)} temperature ${r.extra}${r.room_number ? ` — ${r.room_number}` : ''}`
                             : `${r.detail} served${who ? ` to ${who}` : ''}`; break;
        case 'visitor':    message = `${r.staff} signed in${r.resident ? ` to visit ${r.resident}` : ''}${r.extra ? ` — ${r.extra}` : ''}`; break;
        case 'admission':  message = `${who} recorded as away (${human(r.detail)})${r.extra ? ` — ${r.extra}` : ''}`; break;
        default:           message = human(r.detail);
      }
      return {
        id: `${r.type}-${i}-${new Date(r.at).getTime()}`,
        type: r.type, department: r.department, user: r.staff, message,
        timestamp: r.at, icon: ICON[r.type] || '•', color: COLOR[r.type] || '#64748b',
      };
    });

    res.json({ entries, hours, count: entries.length, generatedAt: new Date().toISOString() });
  } catch (err) { next(err); }
}
