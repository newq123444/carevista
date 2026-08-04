import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';

// ── Generate Board Pack ───────────────────────────────────────────────────

export async function generateBoardPack(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;
    const { reportMonth, title } = req.body;

    if (!reportMonth) {
      return res.status(400).json({ error: 'reportMonth is required' });
    }

    // Gather data for the board pack sections
    const { rows: [kpiSummary] } = await query(
      `SELECT json_agg(row_to_json(bk)) AS kpis
       FROM benchmarking_kpis bk
       WHERE care_home_id = $1 AND period_start >= $2::date AND period_end <= ($2::date + INTERVAL '1 month')`,
      [careHomeId, reportMonth]
    );

    const { rows: [incidentSummary] } = await query(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE severity = 'high') AS high_severity
       FROM incidents
       WHERE care_home_id = $1 AND created_at >= $2::date AND created_at < ($2::date + INTERVAL '1 month')`,
      [careHomeId, reportMonth]
    );

    const { rows: [staffingSummary] } = await query(
      `SELECT COUNT(DISTINCT staff_id) AS staff_count
       FROM staff_performance_metrics
       WHERE care_home_id = $1 AND period_start >= $2::date`,
      [careHomeId, reportMonth]
    );

    const sections = {
      kpis: kpiSummary?.kpis || [],
      incidents: incidentSummary,
      staffing: staffingSummary,
      compliance: {},
      finance: {}
    };

    const { rows: [report] } = await query(
      `INSERT INTO board_pack_reports (care_home_id, report_month, title, sections, status, generated_by, generated_at)
       VALUES ($1, $2, $3, $4, 'draft', $5, NOW()) RETURNING *`,
      [careHomeId, reportMonth, title || `Board Pack - ${reportMonth}`, JSON.stringify(sections), userId]
    );

    res.status(201).json(report);
  } catch (err) { next(err); }
}

// ── List Board Packs ──────────────────────────────────────────────────────

export async function listBoardPacks(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT bpr.*, u.first_name || ' ' || u.last_name AS generated_by_name
       FROM board_pack_reports bpr
       LEFT JOIN users u ON u.id = bpr.generated_by
       WHERE bpr.care_home_id = $1
       ORDER BY bpr.report_month DESC`,
      [careHomeId]
    );

    res.json(rows);
  } catch (err) { next(err); }
}

// ── Get Board Pack ────────────────────────────────────────────────────────

export async function getBoardPack(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [report] } = await query(
      `SELECT bpr.*, u.first_name || ' ' || u.last_name AS generated_by_name
       FROM board_pack_reports bpr
       LEFT JOIN users u ON u.id = bpr.generated_by
       WHERE bpr.id = $1 AND bpr.care_home_id = $2`,
      [id, careHomeId]
    );

    if (!report) throw new AppError(404, 'Board pack not found');
    res.json(report);
  } catch (err) { next(err); }
}

// ── Approve Board Pack ────────────────────────────────────────────────────

export async function approveBoardPack(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const userId = req.user!.id;

    const { rows: [report] } = await query(
      `UPDATE board_pack_reports
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2 AND care_home_id = $3 AND status = 'draft'
       RETURNING *`,
      [userId, id, careHomeId]
    );

    if (!report) throw new AppError(404, 'Board pack not found or already approved');
    res.json(report);
  } catch (err) { next(err); }
}
