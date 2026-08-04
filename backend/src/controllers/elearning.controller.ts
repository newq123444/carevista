import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── List Modules ──────────────────────────────────────────────────────────

export async function listModules(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { category, mandatory } = req.query;

    let where = 'WHERE care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;

    if (category) { where += ` AND category = $${p++}`; params.push(category); }
    if (mandatory !== undefined) { where += ` AND mandatory = $${p++}`; params.push(mandatory === 'true'); }

    const { rows } = await query(
      `SELECT * FROM elearning_modules ${where} ORDER BY category, title`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Create Module ─────────────────────────────────────────────────────────

export async function createModule(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { title, description, category, contentType, contentUrl, durationMinutes, mandatory } = req.body;

    if (!title || !category || !contentType) {
      return res.status(400).json({ error: 'title, category, and contentType are required' });
    }

    const { rows: [module] } = await query(
      `INSERT INTO elearning_modules (care_home_id, title, description, category, content_type, content_url, duration_minutes, mandatory, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [careHomeId, title, description, category, contentType, contentUrl, durationMinutes, mandatory || false, userId]
    );

    res.status(201).json(module);
  } catch (err) { next(err); }
}

// ── Get Module ────────────────────────────────────────────────────────────

export async function getModule(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [module] } = await query(
      `SELECT * FROM elearning_modules WHERE id = $1 AND care_home_id = $2`,
      [id, careHomeId]
    );

    if (!module) throw new AppError(404, 'Module not found');

    // Get associated quiz if any
    const { rows: [quiz] } = await query(
      `SELECT * FROM elearning_quizzes WHERE module_id = $1`,
      [id]
    );

    res.json({ ...module, quiz: quiz || null });
  } catch (err) { next(err); }
}

// ── Create Quiz ───────────────────────────────────────────────────────────

export async function createQuiz(req: Request, res: Response, next: NextFunction) {
  try {
    const { moduleId } = req.params;
    const { title, questions, passMarkPct } = req.body;

    if (!title || !questions) {
      return res.status(400).json({ error: 'title and questions are required' });
    }

    const { rows: [quiz] } = await query(
      `INSERT INTO elearning_quizzes (module_id, title, questions, pass_mark_pct)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [moduleId, title, JSON.stringify(questions), passMarkPct || 80]
    );

    res.status(201).json(quiz);
  } catch (err) { next(err); }
}

// ── Submit Quiz Attempt ───────────────────────────────────────────────────

export async function submitQuizAttempt(req: Request, res: Response, next: NextFunction) {
  try {
    const { moduleId } = req.params;
    const careHomeId = req.user!.care_home_id;
    const staffId = req.user!.id;
    const { answers } = req.body;

    // Get quiz and calculate score
    const { rows: [quiz] } = await query(
      `SELECT * FROM elearning_quizzes WHERE module_id = $1`,
      [moduleId]
    );

    if (!quiz) throw new AppError(404, 'Quiz not found for this module');

    const questions = quiz.questions as Array<{ correctAnswer: string }>;
    let correct = 0;
    for (let i = 0; i < questions.length; i++) {
      if (answers[i] === questions[i].correctAnswer) correct++;
    }
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= quiz.pass_mark_pct;

    // Generate certificate ID if passed
    const certificateId = passed ? `CERT-${moduleId.slice(0, 8)}-${Date.now()}` : null;

    const { rows: [completion] } = await query(
      `INSERT INTO elearning_completions (care_home_id, module_id, staff_id, quiz_score, passed, completed_at, certificate_id)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6) RETURNING *`,
      [careHomeId, moduleId, staffId, score, passed, certificateId]
    );

    res.status(201).json({ ...completion, totalQuestions: questions.length, correctAnswers: correct });
  } catch (err) { next(err); }
}

// ── Get Completions ───────────────────────────────────────────────────────

export async function getCompletions(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { moduleId, staffId } = req.query;

    let where = 'WHERE ec.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;

    if (moduleId) { where += ` AND ec.module_id = $${p++}`; params.push(moduleId); }
    if (staffId) { where += ` AND ec.staff_id = $${p++}`; params.push(staffId); }

    const { rows } = await query(
      `SELECT ec.*, em.title AS module_title, em.category,
         u.first_name || ' ' || u.last_name AS staff_name
       FROM elearning_completions ec
       JOIN elearning_modules em ON em.id = ec.module_id
       JOIN users u ON u.id = ec.staff_id
       ${where}
       ORDER BY ec.completed_at DESC`,
      params
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Staff Progress ────────────────────────────────────────────────────

export async function getStaffProgress(req: Request, res: Response, next: NextFunction) {
  try {
    const { staffId } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: modules } = await query(
      `SELECT em.*,
         ec.quiz_score, ec.passed, ec.completed_at, ec.certificate_id
       FROM elearning_modules em
       LEFT JOIN elearning_completions ec ON ec.module_id = em.id AND ec.staff_id = $2
       WHERE em.care_home_id = $1
       ORDER BY em.category, em.title`,
      [careHomeId, staffId]
    );

    const total = modules.length;
    const completed = modules.filter(m => m.completed_at).length;

    res.json({ staffId, total, completed, completionRate: total > 0 ? (completed / total) * 100 : 0, modules });
  } catch (err) { next(err); }
}

// ── Get Mandatory Status ──────────────────────────────────────────────────

export async function getMandatoryStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    // Get all mandatory modules
    const { rows: mandatoryModules } = await query(
      `SELECT id, title, category FROM elearning_modules WHERE care_home_id = $1 AND mandatory = TRUE`,
      [careHomeId]
    );

    // Get all active staff count
    const { rows: [staffCount] } = await query(
      `SELECT COUNT(*) AS total
       FROM staff_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.care_home_id = $1 AND u.active = TRUE`,
      [careHomeId]
    );

    // Get completion counts per mandatory module
    const { rows: completionCounts } = await query(
      `SELECT ec.module_id, COUNT(DISTINCT ec.staff_id) AS completed_count
       FROM elearning_completions ec
       JOIN elearning_modules em ON em.id = ec.module_id
       WHERE ec.care_home_id = $1 AND em.mandatory = TRUE AND ec.passed = TRUE
       GROUP BY ec.module_id`,
      [careHomeId]
    );

    const completionMap = new Map(completionCounts.map(c => [c.module_id, parseInt(c.completed_count)]));
    const totalStaff = parseInt(staffCount.total);

    const overview = mandatoryModules.map(m => ({
      ...m,
      totalStaff,
      completedStaff: completionMap.get(m.id) || 0,
      complianceRate: totalStaff > 0 ? ((completionMap.get(m.id) || 0) / totalStaff) * 100 : 0,
    }));

    res.json(overview);
  } catch (err) { next(err); }
}
