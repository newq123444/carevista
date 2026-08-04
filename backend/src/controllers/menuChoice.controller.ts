import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── List Menu Options ─────────────────────────────────────────────────────

export async function listMenuOptions(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { mealType, date } = req.query;

    let where = 'WHERE care_home_id = $1 AND active = TRUE';
    const params: unknown[] = [careHomeId];
    let p = 2;

    if (mealType) {
      where += ` AND meal_type = $${p++}`;
      params.push(mealType);
    }
    if (date) {
      where += ` AND (available_date IS NULL OR available_date = $${p++})`;
      params.push(date);
    }

    const { rows } = await query(
      `SELECT * FROM menu_options ${where} ORDER BY meal_type, name`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Create Menu Option ────────────────────────────────────────────────────

export async function createMenuOption(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const b = req.body;
    const mealType = b.mealType ?? b.meal_type;
    const name = b.name;
    const description = b.description;
    const photoUrl = b.photoUrl ?? b.photo_url;
    const texture = b.texture;
    const allergens = b.allergens;
    const nutritionalInfo = b.nutritionalInfo ?? b.nutritional_info;
    const availableDate = b.availableDate ?? b.available_date;

    if (!mealType || !name) {
      return res.status(400).json({ error: 'meal and dish name are required' });
    }

    const { rows: [option] } = await query(
      `INSERT INTO menu_options (care_home_id, meal_type, name, description, photo_url, texture, allergens, nutritional_info, available_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [careHomeId, mealType, name, description, photoUrl, texture, JSON.stringify(allergens || []), JSON.stringify(nutritionalInfo || null), availableDate]
    );

    res.status(201).json(option);
  } catch (err) { next(err); }
}

// ── Get Resident Dietary Profile ──────────────────────────────────────────

export async function getResidentDietaryProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [profile] } = await query(
      `SELECT * FROM menu_dietary_profiles WHERE resident_id = $1 AND care_home_id = $2`,
      [residentId, careHomeId]
    );

    res.json(profile || null);
  } catch (err) { next(err); }
}

// ── Update Resident Dietary Profile ───────────────────────────────────────

export async function updateResidentDietaryProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { allergies, intolerances, textureRequirement, culturalNeeds, religiousNeeds, preferences, caloriesTarget, fluidTargetMl } = req.body;

    const { rows: [profile] } = await query(
      `INSERT INTO menu_dietary_profiles (care_home_id, resident_id, allergies, intolerances, texture_requirement, cultural_needs, religious_needs, preferences, calories_target, fluid_target_ml)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (care_home_id, resident_id) DO UPDATE SET
         allergies = EXCLUDED.allergies,
         intolerances = EXCLUDED.intolerances,
         texture_requirement = EXCLUDED.texture_requirement,
         cultural_needs = EXCLUDED.cultural_needs,
         religious_needs = EXCLUDED.religious_needs,
         preferences = EXCLUDED.preferences,
         calories_target = EXCLUDED.calories_target,
         fluid_target_ml = EXCLUDED.fluid_target_ml,
         updated_at = NOW()
       RETURNING *`,
      [careHomeId, residentId, JSON.stringify(allergies || []), JSON.stringify(intolerances || []), textureRequirement, culturalNeeds, religiousNeeds, preferences, caloriesTarget, fluidTargetMl]
    );

    res.json(profile);
  } catch (err) { next(err); }
}

// ── Submit Menu Choice ────────────────────────────────────────────────────

export async function submitMenuChoice(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { residentId, menuOptionId, mealDate, mealType, portionSize, specialRequest } = req.body;

    if (!residentId || !menuOptionId || !mealDate || !mealType) {
      return res.status(400).json({ error: 'residentId, menuOptionId, mealDate, and mealType are required' });
    }

    const { rows: [choice] } = await query(
      `INSERT INTO menu_choices (care_home_id, resident_id, menu_option_id, meal_date, meal_type, portion_size, special_request, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [careHomeId, residentId, menuOptionId, mealDate, mealType, portionSize || 'regular', specialRequest, userId]
    );

    res.status(201).json(choice);
  } catch (err) { next(err); }
}

// ── Get Kitchen Dashboard ─────────────────────────────────────────────────

export async function getKitchenDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { date } = req.query;
    const mealDate = date || new Date().toISOString().slice(0, 10);

    const { rows } = await query(
      `SELECT mc.meal_type, mo.name AS option_name, mo.texture,
         COUNT(*) AS total_orders,
         COUNT(*) FILTER (WHERE mc.portion_size = 'small') AS small_portions,
         COUNT(*) FILTER (WHERE mc.portion_size = 'regular') AS regular_portions,
         COUNT(*) FILTER (WHERE mc.portion_size = 'large') AS large_portions
       FROM menu_choices mc
       JOIN menu_options mo ON mo.id = mc.menu_option_id
       WHERE mc.care_home_id = $1 AND mc.meal_date = $2
       GROUP BY mc.meal_type, mo.name, mo.texture
       ORDER BY mc.meal_type, total_orders DESC`,
      [careHomeId, mealDate]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Resident Choices ──────────────────────────────────────────────────

export async function getResidentChoices(req: Request, res: Response, next: NextFunction) {
  try {
    const { residentId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT mc.*, mo.name AS option_name, mo.description AS option_description, mo.photo_url
       FROM menu_choices mc
       JOIN menu_options mo ON mo.id = mc.menu_option_id
       WHERE mc.resident_id = $1 AND mc.care_home_id = $2
       ORDER BY mc.meal_date DESC, mc.meal_type`,
      [residentId, careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

export async function updateMenuOption(req: Request, res: Response, next: NextFunction) {
  try {
    const b = req.body;
    const { rows: [row] } = await query(
      `UPDATE menu_options SET
         name = COALESCE($1,name), meal_type = COALESCE($2,meal_type),
         texture = COALESCE($3,texture), allergens = COALESCE($4::jsonb, allergens),
         active = COALESCE($5, active)
       WHERE id = $6 AND care_home_id = $7 RETURNING *`,
      [b.name, b.meal_type, b.texture, b.allergens ? JSON.stringify(b.allergens) : null, b.active, req.params.id, req.user!.care_home_id]
    );
    if (!row) return res.status(404).json({ error: 'Menu option not found' });
    res.json(row);
  } catch (err) { next(err); }
}
export async function deleteMenuOption(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows: [row] } = await query(
      `UPDATE menu_options SET active = FALSE WHERE id = $1 AND care_home_id = $2 RETURNING id`,
      [req.params.id, req.user!.care_home_id]
    );
    if (!row) return res.status(404).json({ error: 'Menu option not found' });
    res.json({ deactivated: true });
  } catch (err) { next(err); }
}
