import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// ── Food-safety checklist (FSA "Safer Food, Better Business" / CQC Reg 14) ──
export const DEFAULT_CHECKS: { key: string; label: string; period: 'opening' | 'closing' | 'weekly' }[] = [
  { key: 'fridge_temps', label: 'Fridge temperatures checked and recorded (0–5°C)', period: 'opening' },
  { key: 'freezer_temps', label: 'Freezer temperatures checked and recorded (-18°C or below)', period: 'opening' },
  { key: 'staff_fit', label: 'Staff fit to work — no sickness/diarrhoea in last 48 hours', period: 'opening' },
  { key: 'handwash_stock', label: 'Hand-wash basin stocked (soap, hot water, paper towels)', period: 'opening' },
  { key: 'surfaces_clean', label: 'Food preparation surfaces clean and sanitised', period: 'opening' },
  { key: 'chopping_boards', label: 'Correct colour-coded boards/equipment in use', period: 'opening' },
  { key: 'stock_rotation', label: 'Stock rotated, use-by dates checked, out-of-date food removed', period: 'opening' },
  { key: 'deliveries', label: 'Deliveries checked — temperature, packaging, date codes', period: 'opening' },
  { key: 'allergen_info', label: 'Allergen information available and matched to residents', period: 'opening' },
  { key: 'probe_clean', label: 'Temperature probe cleaned and sanitised before use', period: 'opening' },
  { key: 'cooking_temps', label: 'Cooking/reheating temperatures reached 75°C+ and recorded', period: 'closing' },
  { key: 'hot_holding', label: 'Hot-held food kept above 63°C and recorded', period: 'closing' },
  { key: 'cooling', label: 'Cooked food cooled within 90 minutes and refrigerated', period: 'closing' },
  { key: 'leftovers', label: 'Leftovers labelled, dated and stored correctly', period: 'closing' },
  { key: 'waste', label: 'Food waste removed; bins cleaned', period: 'closing' },
  { key: 'clean_down', label: 'Full kitchen clean-down completed', period: 'closing' },
  { key: 'deep_clean', label: 'Weekly deep clean (extraction, behind equipment, shelving)', period: 'weekly' },
  { key: 'pest_check', label: 'Weekly pest-control check — no evidence of pests', period: 'weekly' },
  { key: 'equipment_calib', label: 'Weekly probe/thermometer accuracy check', period: 'weekly' },
];

// Safe ranges used to auto-flag readings
function inRange(type: string, t: number): boolean {
  switch (type) {
    case 'fridge': return t >= 0 && t <= 5;
    case 'freezer': return t <= -18;
    case 'cooking':
    case 'reheating': return t >= 75;
    case 'hot_holding': return t >= 63;
    case 'cooling': return t <= 8;
    case 'delivery': return t <= 8;
    default: return true;
  }
}

export async function getChecklist(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const { rows } = await query(
      `SELECT kc.*, u.first_name || ' ' || u.last_name AS completed_by_name
       FROM kitchen_checks kc LEFT JOIN users u ON u.id = kc.completed_by
       WHERE kc.care_home_id = $1 AND kc.check_date = $2`, [chId, date]);
    const map = new Map(rows.map((r: any) => [r.check_key, r]));
    const items = DEFAULT_CHECKS.map(c => {
      const rec: any = map.get(c.key);
      return { ...c, completed: !!rec?.completed, notes: rec?.notes || null,
               completedBy: rec?.completed_by_name || null, completedAt: rec?.completed_at || null };
    });
    const done = items.filter(i => i.completed).length;
    res.json({ date, items, total: items.length, completed: done,
               pct: items.length ? Math.round((done / items.length) * 100) : 0 });
  } catch (err) { next(err); }
}

export async function setCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body;
    const key = b.checkKey || b.check_key;
    const date = b.date || b.check_date || new Date().toISOString().slice(0, 10);
    if (!key) return res.status(400).json({ error: 'A checklist item is required' });
    const def = DEFAULT_CHECKS.find(c => c.key === key);
    const completed = b.completed !== false;
    const { rows: [row] } = await query(
      `INSERT INTO kitchen_checks (care_home_id, check_date, check_key, period, completed, notes, completed_by, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $5 THEN NOW() ELSE NULL END)
       ON CONFLICT (care_home_id, check_date, check_key) DO UPDATE SET
         completed = EXCLUDED.completed, notes = COALESCE(EXCLUDED.notes, kitchen_checks.notes),
         completed_by = EXCLUDED.completed_by, completed_at = EXCLUDED.completed_at
       RETURNING *`,
      [chId, date, key, def?.period || 'opening', completed, b.notes || null, req.user!.id]);
    res.status(201).json(row);
  } catch (err) { next(err); }
}

export async function listTemperatures(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const { rows } = await query(
      `SELECT kt.*, u.first_name || ' ' || u.last_name AS recorded_by_name
       FROM kitchen_temperature_logs kt LEFT JOIN users u ON u.id = kt.recorded_by
       WHERE kt.care_home_id = $1 AND kt.log_date = $2
       ORDER BY kt.recorded_at DESC`, [chId, date]);
    const breaches = rows.filter((r: any) => r.within_range === false).length;
    res.json({ date, logs: rows, breaches });
  } catch (err) { next(err); }
}

export async function logTemperature(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body;
    const logType = b.logType || b.log_type;
    const temperature = b.temperatureC ?? b.temperature_c ?? b.temperature;
    if (!logType || temperature == null || temperature === '')
      return res.status(400).json({ error: 'A check type and a temperature are required' });
    const t = Number(temperature);
    if (Number.isNaN(t)) return res.status(400).json({ error: 'Temperature must be a number' });
    const ok = inRange(logType, t);
    const { rows: [row] } = await query(
      `INSERT INTO kitchen_temperature_logs
        (care_home_id, log_date, log_type, location, item_name, temperature_c, within_range, corrective_action, recorded_by)
       VALUES ($1, COALESCE($2, CURRENT_DATE), $3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [chId, b.date || b.log_date || null, logType, b.location || null, b.itemName || b.item_name || null,
       t, ok, b.correctiveAction || b.corrective_action || null, req.user!.id]);
    res.status(201).json({ ...row, withinRange: ok });
  } catch (err) { next(err); }
}

// ── Meal orders: care team -> kitchen ─────────────────────────────────────
export async function listOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const mealType = req.query.mealType as string | undefined;
    const params: any[] = [chId, date];
    let where = 'mo.care_home_id = $1 AND mo.meal_date = $2';
    if (mealType) { params.push(mealType); where += ` AND mo.meal_type = $${params.length}`; }
    const { rows } = await query(
      `SELECT mo.*, r.first_name, r.last_name, r.room_number,
              r.allergies, r.dietary_requirements,
              mdp.texture_requirement, mdp.allergies AS profile_allergies
       FROM meal_orders mo
       JOIN residents r ON r.id = mo.resident_id
       LEFT JOIN menu_dietary_profiles mdp ON mdp.resident_id = r.id
       WHERE ${where}
       ORDER BY r.room_number, r.last_name`, params);

    // Residents with no order yet for this meal — the kitchen needs to know
    const { rows: missing } = mealType ? await query(
      `SELECT r.id, r.first_name, r.last_name, r.room_number
       FROM residents r
       WHERE r.care_home_id = $1 AND r.active = TRUE
         AND NOT EXISTS (SELECT 1 FROM meal_orders mo
                         WHERE mo.resident_id = r.id AND mo.meal_date = $2 AND mo.meal_type = $3)
       ORDER BY r.room_number`, [chId, date, mealType]) : { rows: [] };

    const textureCounts: Record<string, number> = {};
    for (const o of rows as any[]) {
      const tx = o.texture || o.texture_requirement || 'normal';
      textureCounts[tx] = (textureCounts[tx] || 0) + 1;
    }
    res.json({
      date, mealType: mealType || null, orders: rows, awaitingChoice: missing,
      summary: {
        total: rows.length,
        served: rows.filter((o: any) => o.status === 'served').length,
        refused: rows.filter((o: any) => o.status === 'refused').length,
        textureCounts,
      },
    });
  } catch (err) { next(err); }
}

export async function createOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body;
    const residentId = b.residentId || b.resident_id;
    const mealType = b.mealType || b.meal_type;
    const menuOptionId = b.menuOptionId || b.menu_option_id || null;
    let choiceName = b.choiceName || b.choice_name || null;
    let texture = b.texture || null;
    if (!residentId || !mealType)
      return res.status(400).json({ error: 'A resident and a meal are required' });
    if (menuOptionId && (!choiceName || !texture)) {
      const { rows: [opt] } = await query(`SELECT name, texture FROM menu_options WHERE id = $1 AND care_home_id = $2`, [menuOptionId, chId]);
      choiceName = choiceName || opt?.name || null;
      texture = texture || opt?.texture || null;
    }
    if (!choiceName) return res.status(400).json({ error: 'A meal choice is required' });
    const { rows: [row] } = await query(
      `INSERT INTO meal_orders (care_home_id, resident_id, meal_date, meal_type, menu_option_id, choice_name, texture, portion_size, special_request, ordered_by)
       VALUES ($1,$2, COALESCE($3, CURRENT_DATE), $4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (resident_id, meal_date, meal_type) DO UPDATE SET
         menu_option_id = EXCLUDED.menu_option_id, choice_name = EXCLUDED.choice_name,
         texture = EXCLUDED.texture, portion_size = EXCLUDED.portion_size,
         special_request = EXCLUDED.special_request, status = 'ordered', updated_at = NOW()
       RETURNING *`,
      [chId, residentId, b.mealDate || b.meal_date || null, mealType, menuOptionId, choiceName,
       texture, b.portionSize || b.portion_size || 'regular', b.specialRequest || b.special_request || null, req.user!.id]);
    res.status(201).json(row);
  } catch (err) { next(err); }
}

export async function updateOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const b = req.body;
    const status = b.status;
    const { rows: [row] } = await query(
      `UPDATE meal_orders SET
         status = COALESCE($1, status),
         intake_percent = COALESCE($2, intake_percent),
         served_by = CASE WHEN $1 = 'served' THEN $3 ELSE served_by END,
         served_at = CASE WHEN $1 = 'served' THEN NOW() ELSE served_at END,
         updated_at = NOW()
       WHERE id = $4 AND care_home_id = $5 RETURNING *`,
      [status || null, b.intakePercent ?? b.intake_percent ?? null, req.user!.id, req.params.id, chId]);
    if (!row) return res.status(404).json({ error: 'Meal order not found' });
    res.json(row);
  } catch (err) { next(err); }
}

// ── Kitchen dashboard ─────────────────────────────────────────────────────
export async function getDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const orders = await query(
      `SELECT meal_type, status, COUNT(*)::int AS n FROM meal_orders
       WHERE care_home_id = $1 AND meal_date = $2 GROUP BY meal_type, status`, [chId, date]);
    const residents = await query(
      `SELECT COUNT(*)::int AS n FROM residents WHERE care_home_id = $1 AND active = TRUE`, [chId]);
    const textures = await query(
      `SELECT COALESCE(NULLIF(mo.texture,''), mdp.texture_requirement, 'normal') AS texture, COUNT(*)::int AS n
       FROM meal_orders mo LEFT JOIN menu_dietary_profiles mdp ON mdp.resident_id = mo.resident_id
       WHERE mo.care_home_id = $1 AND mo.meal_date = $2 GROUP BY 1 ORDER BY n DESC`, [chId, date]);
    const allergens = await query(
      `SELECT r.first_name || ' ' || r.last_name AS resident, r.room_number, r.allergies, r.dietary_requirements
       FROM residents r
       WHERE r.care_home_id = $1 AND r.active = TRUE
         AND ((r.allergies IS NOT NULL AND r.allergies <> '') OR (r.dietary_requirements IS NOT NULL AND r.dietary_requirements <> ''))
       ORDER BY r.room_number`, [chId]);
    const temps = await query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE within_range = FALSE)::int AS breaches
       FROM kitchen_temperature_logs WHERE care_home_id = $1 AND log_date = $2`, [chId, date]);
    const checks = await query(
      `SELECT COUNT(*) FILTER (WHERE completed)::int AS done FROM kitchen_checks
       WHERE care_home_id = $1 AND check_date = $2`, [chId, date]);
    const intake = await query(
      `SELECT COUNT(*) FILTER (WHERE status='refused')::int AS refused,
              ROUND(AVG(intake_percent) FILTER (WHERE intake_percent IS NOT NULL))::int AS avg_intake
       FROM meal_orders WHERE care_home_id = $1 AND meal_date >= $2::date - 6`, [chId, date]);

    const byMeal: Record<string, any> = {};
    for (const r of orders.rows as any[]) {
      byMeal[r.meal_type] = byMeal[r.meal_type] || { ordered: 0, served: 0, refused: 0, total: 0 };
      byMeal[r.meal_type][r.status] = (byMeal[r.meal_type][r.status] || 0) + r.n;
      byMeal[r.meal_type].total += r.n;
    }
    res.json({
      date,
      residents: residents.rows[0]?.n || 0,
      byMeal,
      textures: textures.rows,
      allergenResidents: allergens.rows,
      temperatures: { total: temps.rows[0]?.total || 0, breaches: temps.rows[0]?.breaches || 0 },
      checklist: { completed: checks.rows[0]?.done || 0, total: DEFAULT_CHECKS.length },
      week: { refused: intake.rows[0]?.refused || 0, avgIntake: intake.rows[0]?.avg_intake ?? null },
    });
  } catch (err) { next(err); }
}
