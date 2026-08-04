// ============================================================
// src/controllers/housekeeping.controller.ts
// Housekeeping / cleaning checklists — digitises the paper
// daily/weekly/quarterly room + daily communal-area check lists.
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../models/db';

const VALID_CATEGORIES = ['daily_room', 'weekly_room', 'quarterly_room', 'daily_communal'];

// GET /housekeeping/tasks?category=daily_room
export async function listTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const category = String(req.query.category || '');
    if (!VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Invalid or missing category' });
    }
    const { rows } = await query(
      `SELECT id, category, area_label, specification, sort_order
         FROM housekeeping_tasks
        WHERE category = $1 AND active = TRUE
          AND (care_home_id = $2
               OR (care_home_id IS NULL AND NOT EXISTS (SELECT 1 FROM housekeeping_tasks WHERE care_home_id = $2 AND active = TRUE)))
        ORDER BY area_label NULLS FIRST, sort_order`,
      [category, careHomeId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// GET /housekeeping/rooms — rooms drawn from existing residents
export async function listRooms(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT id AS resident_id, room_number,
              first_name || ' ' || last_name AS resident_name
         FROM residents
        WHERE care_home_id = $1 AND active = TRUE AND room_number IS NOT NULL
        ORDER BY room_number`,
      [req.user!.care_home_id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// GET /housekeeping/communal-areas
export async function listCommunalAreas(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT DISTINCT area_label
         FROM housekeeping_tasks
        WHERE category = 'daily_communal' AND area_label IS NOT NULL AND active = TRUE
          AND (care_home_id = $1
               OR (care_home_id IS NULL AND NOT EXISTS (SELECT 1 FROM housekeeping_tasks WHERE care_home_id = $1 AND active = TRUE)))
        ORDER BY area_label`,
      [careHomeId]
    );
    res.json(rows.map(r => r.area_label));
  } catch (err) { next(err); }
}

// POST /housekeeping/logs — record completed checklist items
export async function submitLog(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const {
      category, locationType, roomNumber, residentId,
      communalArea, periodDate, items, initials,
    } = req.body;

    if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No checklist items provided' });

    const date = periodDate || new Date().toISOString().slice(0, 10);
    const sign = (initials || `${req.user!.first_name?.[0] || ''}${req.user!.last_name?.[0] || ''}`).toUpperCase();

    const inserted = await withTransaction(async (client) => {
      const out: any[] = [];
      for (const item of items) {
        const { rows: [row] } = await client.query(
          `INSERT INTO housekeeping_logs (
             care_home_id, category, location_type, room_number, resident_id,
             communal_area, task_id, specification, period_date, initials, completed_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [careHomeId, category, locationType || (communalArea ? 'communal' : 'resident_room'),
           roomNumber || null, residentId || null, communalArea || null,
           item.taskId || null, item.specification, date, sign, req.user!.id]
        );
        out.push(row);
      }
      return out;
    });

    res.status(201).json({ saved: inserted.length, logs: inserted });
  } catch (err) { next(err); }
}

// GET /housekeeping/logs?category=&periodDate=&roomNumber=&communalArea=
export async function listLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { category, periodDate, roomNumber, communalArea } = req.query;
    const clauses = ['hl.care_home_id = $1'];
    const params: any[] = [careHomeId];
    let p = 2;
    if (category) { clauses.push(`hl.category = $${p++}`); params.push(category); }
    if (periodDate) { clauses.push(`hl.period_date = $${p++}`); params.push(periodDate); }
    if (roomNumber) { clauses.push(`hl.room_number = $${p++}`); params.push(roomNumber); }
    if (communalArea) { clauses.push(`hl.communal_area = $${p++}`); params.push(communalArea); }

    const { rows } = await query(
      `SELECT hl.*, u.first_name || ' ' || u.last_name AS completed_by_name
         FROM housekeeping_logs hl
         LEFT JOIN users u ON u.id = hl.completed_by
        WHERE ${clauses.join(' AND ')}
        ORDER BY hl.completed_at DESC
        LIMIT 200`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// GET /housekeeping/summary — live stats for the cleaning dashboard (today)
export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const today = new Date().toISOString().slice(0, 10);

    const [totals, byCat, recent, activeRooms, roomStatus] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int AS tasks_today,
           COUNT(DISTINCT room_number) FILTER (WHERE room_number IS NOT NULL)::int AS rooms_serviced_today,
           COUNT(DISTINCT communal_area) FILTER (WHERE communal_area IS NOT NULL)::int AS communal_areas_today,
           COUNT(DISTINCT completed_by)::int AS staff_active_today
         FROM housekeeping_logs
         WHERE care_home_id = $1 AND period_date = $2`,
        [careHomeId, today]
      ),
      query(
        `SELECT category, COUNT(*)::int AS count
         FROM housekeeping_logs
         WHERE care_home_id = $1 AND period_date = $2
         GROUP BY category`,
        [careHomeId, today]
      ),
      query(
        `SELECT hl.category, hl.room_number, hl.communal_area, hl.specification,
                hl.initials, hl.completed_at,
                u.first_name || ' ' || u.last_name AS completed_by_name
         FROM housekeeping_logs hl
         LEFT JOIN users u ON u.id = hl.completed_by
         WHERE hl.care_home_id = $1
         ORDER BY hl.completed_at DESC
         LIMIT 8`,
        [careHomeId]
      ),
      query(
        `SELECT COUNT(*)::int AS total_rooms
         FROM residents WHERE care_home_id = $1 AND active = TRUE AND room_number IS NOT NULL`,
        [careHomeId]
      ),
      query(
        `SELECT r.room_number,
                r.first_name || ' ' || r.last_name AS resident_name,
                MAX(hl.completed_at) FILTER (WHERE hl.category = 'daily_room') AS last_cleaned
         FROM residents r
         LEFT JOIN housekeeping_logs hl
           ON hl.room_number = r.room_number AND hl.care_home_id = r.care_home_id
         WHERE r.care_home_id = $1 AND r.active = TRUE AND r.room_number IS NOT NULL
         GROUP BY r.room_number, r.first_name, r.last_name
         ORDER BY (CASE WHEN r.room_number ~ '^[0-9]+$' THEN r.room_number::int ELSE 9999 END), r.room_number`,
        [careHomeId]
      ),
    ]);

    const nowMs = Date.now();
    const rooms = roomStatus.rows.map(r => {
      let status = 'overdue';
      if (r.last_cleaned) {
        const ageH = (nowMs - new Date(r.last_cleaned).getTime()) / 3.6e6;
        status = ageH <= 20 ? 'clean' : ageH <= 32 ? 'needs-attention' : 'overdue';
      }
      return { room_number: r.room_number, resident_name: r.resident_name, last_cleaned: r.last_cleaned, status };
    });

    res.json({
      ...totals.rows[0],
      total_rooms: activeRooms.rows[0].total_rooms,
      by_category: byCat.rows,
      recent: recent.rows,
      rooms,
    });
  } catch (err) { next(err); }
}

// Manager: list the home's own housekeeping tasks (empty until defaults copied)
export async function listManageTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT * FROM housekeeping_tasks WHERE care_home_id = $1 AND active = TRUE ORDER BY category, area_label NULLS FIRST, sort_order`,
      [req.user!.care_home_id]);
    res.json(rows);
  } catch (err) { next(err); }
}
export async function copyDefaultTasks(req: Request, res: Response, next: NextFunction) {
  try {
    const { rowCount } = await query(
      `INSERT INTO housekeeping_tasks (care_home_id, category, area_label, specification, sort_order)
       SELECT $1, category, area_label, specification, sort_order FROM housekeeping_tasks WHERE care_home_id IS NULL`,
      [req.user!.care_home_id]);
    res.json({ copied: rowCount ?? 0 });
  } catch (err) { next(err); }
}
export async function createTask(req: Request, res: Response, next: NextFunction) {
  try {
    const b = req.body;
    const { rows: [row] } = await query(
      `INSERT INTO housekeeping_tasks (care_home_id, category, area_label, specification, sort_order, active)
       VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING *`,
      [req.user!.care_home_id, b.category, b.area_label || null, b.specification, b.sort_order ?? 50]);
    res.status(201).json(row);
  } catch (err) { next(err); }
}
export async function updateTask(req: Request, res: Response, next: NextFunction) {
  try {
    const b = req.body;
    const { rows: [row] } = await query(
      `UPDATE housekeeping_tasks SET specification = COALESCE($1,specification), area_label = COALESCE($2,area_label),
         sort_order = COALESCE($3,sort_order), active = COALESCE($4,active)
       WHERE id = $5 AND care_home_id = $6 RETURNING *`,
      [b.specification, b.area_label, b.sort_order, b.active, req.params.id, req.user!.care_home_id]);
    if (!row) return res.status(404).json({ error: 'Task not found' });
    res.json(row);
  } catch (err) { next(err); }
}
export async function deleteTask(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows: [row] } = await query(
      `UPDATE housekeeping_tasks SET active = FALSE WHERE id = $1 AND care_home_id = $2 RETURNING id`,
      [req.params.id, req.user!.care_home_id]);
    if (!row) return res.status(404).json({ error: 'Task not found' });
    res.json({ deactivated: true });
  } catch (err) { next(err); }
}
