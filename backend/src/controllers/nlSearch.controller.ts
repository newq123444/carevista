// src/controllers/nlSearch.controller.ts
// Natural Language Search - parse user queries and search across clinical data
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// Medication category mappings
const MEDICATION_CATEGORIES: Record<string, string[]> = {
  'blood thinners': ['warfarin', 'rivaroxaban', 'apixaban', 'edoxaban', 'dabigatran', 'heparin', 'enoxaparin'],
  'antihypertensives': ['amlodipine', 'ramipril', 'lisinopril', 'enalapril', 'losartan', 'candesartan', 'bisoprolol', 'atenolol', 'doxazosin', 'bendroflumethiazide'],
  'diabetes': ['metformin', 'insulin', 'gliclazide', 'glipizide', 'sitagliptin', 'empagliflozin', 'dapagliflozin'],
  'antidepressants': ['sertraline', 'fluoxetine', 'citalopram', 'paroxetine', 'mirtazapine', 'venlafaxine', 'duloxetine'],
  'painkillers': ['paracetamol', 'codeine', 'tramadol', 'morphine', 'ibuprofen', 'naproxen', 'diclofenac'],
  'antibiotics': ['amoxicillin', 'flucloxacillin', 'clarithromycin', 'ciprofloxacin', 'trimethoprim', 'nitrofurantoin', 'doxycycline'],
};

interface ParsedIntent {
  type: string;
  filters: Record<string, any>;
  timeRange?: string;
  medicationNames?: string[];
  riskLevel?: string;
  roomNumber?: string;
  condition?: string;
}

function parseQuery(queryText: string): ParsedIntent {
  const text = queryText.toLowerCase().trim();
  const intent: ParsedIntent = { type: 'general', filters: {} };

  // Time range detection
  if (text.includes('last month') || text.includes('past month')) {
    intent.timeRange = '1 month';
    intent.filters.timeRange = '1 month';
  } else if (text.includes('last week') || text.includes('past week')) {
    intent.timeRange = '7 days';
    intent.filters.timeRange = '7 days';
  } else if (text.includes('last year') || text.includes('past year')) {
    intent.timeRange = '1 year';
    intent.filters.timeRange = '1 year';
  } else if (text.includes('last 3 months') || text.includes('past 3 months')) {
    intent.timeRange = '3 months';
    intent.filters.timeRange = '3 months';
  }

  // Room number detection
  const roomMatch = text.match(/room\s*(\d+[a-z]?)/i);
  if (roomMatch) {
    intent.roomNumber = roomMatch[1];
    intent.filters.roomNumber = roomMatch[1];
  }

  // Risk level detection
  if (text.includes('high fall risk') || text.includes('high risk')) {
    intent.riskLevel = 'high';
    intent.filters.riskLevel = 'high';
  } else if (text.includes('medium risk')) {
    intent.riskLevel = 'medium';
    intent.filters.riskLevel = 'medium';
  } else if (text.includes('low risk')) {
    intent.riskLevel = 'low';
    intent.filters.riskLevel = 'low';
  }

  // Falls detection
  if (text.includes('fall') || text.includes('fell') || text.includes('trip')) {
    intent.type = 'incidents_falls';
    intent.filters.incidentType = 'fall';
  }

  // Medication category detection
  for (const [category, meds] of Object.entries(MEDICATION_CATEGORIES)) {
    if (text.includes(category)) {
      intent.type = 'medications';
      intent.medicationNames = meds;
      intent.filters.medicationCategory = category;
      break;
    }
  }

  // Specific medication name detection
  if (intent.type === 'general') {
    const medPatterns = [
      /residents?\s+(?:on|taking|prescribed)\s+(.+?)(?:\s+with|\s+and|\s+who|$)/i,
      /(?:on|taking|prescribed)\s+(.+?)(?:\s+with|\s+and|\s+who|$)/i,
    ];
    for (const pattern of medPatterns) {
      const medMatch = text.match(pattern);
      if (medMatch) {
        const medName = medMatch[1].trim();
        // Check if it is a category
        if (MEDICATION_CATEGORIES[medName]) {
          intent.type = 'medications';
          intent.medicationNames = MEDICATION_CATEGORIES[medName];
          intent.filters.medicationCategory = medName;
        } else {
          intent.type = 'medications';
          intent.medicationNames = [medName];
          intent.filters.medicationName = medName;
        }
        break;
      }
    }
  }

  // Condition-specific detection
  if (text.includes('diabetic') || text.includes('diabetes')) {
    intent.type = intent.type === 'general' ? 'condition' : intent.type;
    intent.condition = 'diabetes';
    intent.filters.condition = 'diabetes';
    if (!intent.medicationNames) {
      intent.medicationNames = MEDICATION_CATEGORIES['diabetes'];
    }
  }

  if (text.includes('blood pressure') || text.includes('hypertension') || text.includes('hypertensive')) {
    intent.type = intent.type === 'general' ? 'condition' : intent.type;
    intent.condition = 'hypertension';
    intent.filters.condition = 'hypertension';
    if (!intent.medicationNames) {
      intent.medicationNames = MEDICATION_CATEGORIES['antihypertensives'];
    }
  }

  // If still general and mentions residents, treat as resident search
  if (intent.type === 'general' && (text.includes('resident') || intent.riskLevel || intent.roomNumber)) {
    intent.type = 'residents';
  }

  return intent;
}

// ── Search ────────────────────────────────────────────────────────────────
export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { query: queryText } = req.body;

    if (!queryText || typeof queryText !== 'string') {
      return res.status(400).json({ error: 'query is required' });
    }

    const parsedIntent = parseQuery(queryText);
    let results: any[] = [];

    // Build and execute appropriate queries based on parsed intent
    if (parsedIntent.type === 'incidents_falls') {
      // Search for residents who had falls
      let sql = `
        SELECT DISTINCT r.id AS resident_id, r.first_name, r.last_name, r.room_number, r.risk_level,
               COUNT(i.id) AS incident_count,
               MAX(i.incident_date) AS last_incident
        FROM residents r
        JOIN incidents i ON i.resident_id = r.id AND i.care_home_id = $1
        WHERE r.care_home_id = $1 AND r.active = TRUE
          AND i.incident_type ILIKE '%fall%'
      `;
      const params: any[] = [careHomeId];
      let paramIdx = 2;

      if (parsedIntent.timeRange) {
        sql += ` AND i.incident_date > NOW() - INTERVAL '${parsedIntent.timeRange}'`;
      }
      if (parsedIntent.riskLevel) {
        sql += ` AND r.risk_level = $${paramIdx}`;
        params.push(parsedIntent.riskLevel);
        paramIdx++;
      }
      if (parsedIntent.roomNumber) {
        sql += ` AND r.room_number = $${paramIdx}`;
        params.push(parsedIntent.roomNumber);
        paramIdx++;
      }

      sql += ` GROUP BY r.id, r.first_name, r.last_name, r.room_number, r.risk_level ORDER BY incident_count DESC`;

      const { rows } = await query(sql, params);
      results = rows;
    } else if (parsedIntent.type === 'medications') {
      // Search for residents on specific medications
      const medNames = parsedIntent.medicationNames || [];
      if (medNames.length > 0) {
        const medConditions = medNames.map((_: string, i: number) => `m.name ILIKE $${i + 2}`).join(' OR ');
        let sql = `
          SELECT DISTINCT r.id AS resident_id, r.first_name, r.last_name, r.room_number, r.risk_level,
                 ARRAY_AGG(DISTINCT m.name) AS medications
          FROM residents r
          JOIN medications m ON m.resident_id = r.id AND m.care_home_id = $1
          WHERE r.care_home_id = $1 AND r.active = TRUE AND m.active = TRUE
            AND (${medConditions})
        `;
        const params: any[] = [careHomeId, ...medNames.map(n => `%${n}%`)];
        let paramIdx = medNames.length + 2;

        if (parsedIntent.riskLevel) {
          sql += ` AND r.risk_level = $${paramIdx}`;
          params.push(parsedIntent.riskLevel);
          paramIdx++;
        }
        if (parsedIntent.roomNumber) {
          sql += ` AND r.room_number = $${paramIdx}`;
          params.push(parsedIntent.roomNumber);
          paramIdx++;
        }

        sql += ` GROUP BY r.id, r.first_name, r.last_name, r.room_number, r.risk_level ORDER BY r.last_name`;

        const { rows } = await query(sql, params);
        results = rows;
      }
    } else if (parsedIntent.type === 'condition') {
      // Search by condition - check medications and care notes
      const medNames = parsedIntent.medicationNames || [];
      const condition = parsedIntent.condition || '';

      let sql = `
        SELECT DISTINCT r.id AS resident_id, r.first_name, r.last_name, r.room_number, r.risk_level
        FROM residents r
        WHERE r.care_home_id = $1 AND r.active = TRUE
          AND (
            EXISTS (
              SELECT 1 FROM medications m
              WHERE m.resident_id = r.id AND m.care_home_id = $1 AND m.active = TRUE
                AND (${medNames.map((_: string, i: number) => `m.name ILIKE $${i + 2}`).join(' OR ')})
            )
            OR EXISTS (
              SELECT 1 FROM care_notes cn
              WHERE cn.resident_id = r.id AND cn.care_home_id = $1 AND cn.deleted_at IS NULL
                AND cn.content ILIKE $${medNames.length + 2}
            )
          )
      `;
      const params: any[] = [careHomeId, ...medNames.map(n => `%${n}%`), `%${condition}%`];
      let paramIdx = medNames.length + 3;

      if (parsedIntent.riskLevel) {
        sql += ` AND r.risk_level = $${paramIdx}`;
        params.push(parsedIntent.riskLevel);
        paramIdx++;
      }
      if (parsedIntent.roomNumber) {
        sql += ` AND r.room_number = $${paramIdx}`;
        params.push(parsedIntent.roomNumber);
        paramIdx++;
      }

      sql += ` ORDER BY r.last_name`;

      const { rows } = await query(sql, params);
      results = rows;
    } else if (parsedIntent.type === 'residents') {
      // Generic resident search with filters
      let sql = `
        SELECT r.id AS resident_id, r.first_name, r.last_name, r.room_number, r.risk_level
        FROM residents r
        WHERE r.care_home_id = $1 AND r.active = TRUE
      `;
      const params: any[] = [careHomeId];
      let paramIdx = 2;

      if (parsedIntent.riskLevel) {
        sql += ` AND r.risk_level = $${paramIdx}`;
        params.push(parsedIntent.riskLevel);
        paramIdx++;
      }
      if (parsedIntent.roomNumber) {
        sql += ` AND r.room_number = $${paramIdx}`;
        params.push(parsedIntent.roomNumber);
        paramIdx++;
      }

      sql += ` ORDER BY r.last_name`;

      const { rows } = await query(sql, params);
      results = rows;
    } else {
      // General full-text search across residents, notes, incidents
      const { rows } = await query(
        `SELECT r.id AS resident_id, r.first_name, r.last_name, r.room_number, r.risk_level
         FROM residents r
         WHERE r.care_home_id = $1 AND r.active = TRUE
           AND (
             r.first_name ILIKE $2 OR r.last_name ILIKE $2
             OR EXISTS (
               SELECT 1 FROM care_notes cn WHERE cn.resident_id = r.id AND cn.deleted_at IS NULL AND cn.content ILIKE $2
             )
           )
         ORDER BY r.last_name LIMIT 50`,
        [careHomeId, `%${req.body.query}%`]
      );
      results = rows;
    }

    // Log the search
    await query(
      `INSERT INTO nl_search_queries (care_home_id, user_id, query_text, parsed_intent, results_count)
       VALUES ($1, $2, $3, $4, $5)`,
      [careHomeId, userId, queryText, JSON.stringify(parsedIntent), results.length]
    );

    res.json({
      query: queryText,
      parsedIntent,
      results,
      resultsCount: results.length,
    });
  } catch (err) { next(err); }
}

// ── Get Search History ────────────────────────────────────────────────────
export async function getSearchHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;

    const { rows } = await query(
      `SELECT id, query_text, parsed_intent, results_count, created_at
       FROM nl_search_queries
       WHERE care_home_id = $1 AND user_id = $2
       ORDER BY created_at DESC
       LIMIT 20`,
      [careHomeId, userId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}
