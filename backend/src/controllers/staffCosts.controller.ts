import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';

export async function recordStaffCost(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { staffId, periodStart, periodEnd, basicHours, overtimeHours, basicCostPence, overtimeCostPence, agencyCostPence, isAgency } = req.body;

    if (!staffId || !periodStart || !periodEnd || basicHours == null || !basicCostPence) {
      return res.status(400).json({ error: 'staffId, periodStart, periodEnd, basicHours, and basicCostPence are required' });
    }

    const { rows: [cost] } = await query(
      `INSERT INTO staff_costs (care_home_id, staff_id, period_start, period_end, basic_hours, overtime_hours, basic_cost_pence, overtime_cost_pence, agency_cost_pence, is_agency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [careHomeId, staffId, periodStart, periodEnd, basicHours, overtimeHours, basicCostPence, overtimeCostPence, agencyCostPence || 0, isAgency || false]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'STAFF_COST_RECORDED', entityType: 'staff_cost', entityId: cost.id,
      afterData: { staffId, periodStart, periodEnd, basicCostPence, overtimeCostPence }, ip: req.ip,
    });
    res.status(201).json(cost);
  } catch (err) { next(err); }
}

export async function getStaffCostsSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { periodStart, periodEnd } = req.query;
    let where = 'WHERE care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (periodStart) { where += ` AND period_start >= $${p++}`; params.push(periodStart); }
    if (periodEnd) { where += ` AND period_end <= $${p++}`; params.push(periodEnd); }

    const { rows: [summary] } = await query(
      `SELECT
        COALESCE(SUM(basic_cost_pence), 0)::int AS total_basic_pence,
        COALESCE(SUM(overtime_cost_pence), 0)::int AS total_overtime_pence,
        COALESCE(SUM(agency_cost_pence), 0)::int AS total_agency_pence,
        COALESCE(SUM(basic_cost_pence + overtime_cost_pence + agency_cost_pence), 0)::int AS grand_total_pence,
        COALESCE(SUM(basic_hours), 0)::numeric AS total_basic_hours,
        COALESCE(SUM(overtime_hours), 0)::numeric AS total_overtime_hours,
        COUNT(*) FILTER (WHERE is_agency = true)::int AS agency_staff_count,
        COUNT(*) FILTER (WHERE is_agency = false)::int AS permanent_staff_count
       FROM staff_costs ${where}`,
      params
    );
    res.json(summary);
  } catch (err) { next(err); }
}

export async function getCostPerResident(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows: [costs] } = await query(
      `SELECT COALESCE(SUM(basic_cost_pence + overtime_cost_pence + agency_cost_pence), 0)::int AS total_staff_cost_pence
       FROM staff_costs WHERE care_home_id = $1 AND period_start >= date_trunc('month', CURRENT_DATE)`,
      [careHomeId]
    );

    const { rows: [residents] } = await query(
      `SELECT COUNT(*)::int AS active_residents FROM residents WHERE care_home_id = $1 AND active = true`,
      [careHomeId]
    );

    const costPerResident = residents.active_residents > 0
      ? Math.round(costs.total_staff_cost_pence / residents.active_residents)
      : 0;

    res.json({ totalStaffCostPence: costs.total_staff_cost_pence, activeResidents: residents.active_residents, costPerResidentPence: costPerResident });
  } catch (err) { next(err); }
}

export async function getBudgetVsActual(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { category, months = '6' } = req.query;
    let where = 'WHERE care_home_id = $1 AND budget_month >= (CURRENT_DATE - ($2 || \' months\')::interval)';
    const params: unknown[] = [careHomeId, months];
    let p = 3;
    if (category) { where += ` AND category = $${p++}`; params.push(category); }

    const { rows } = await query(
      `SELECT * FROM cost_budgets ${where} ORDER BY budget_month DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function listBudgets(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT * FROM cost_budgets WHERE care_home_id = $1 ORDER BY budget_month DESC`,
      [careHomeId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function createBudget(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { budgetMonth, budgetPence, category, notes } = req.body;

    if (!budgetMonth || budgetPence == null) {
      return res.status(400).json({ error: 'budgetMonth and budgetPence are required' });
    }

    const { rows: [budget] } = await query(
      `INSERT INTO cost_budgets (care_home_id, budget_month, budget_pence, category, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [careHomeId, budgetMonth, budgetPence, category, notes]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'BUDGET_CREATED', entityType: 'cost_budget', entityId: budget.id,
      afterData: { budgetMonth, budgetPence, category }, ip: req.ip,
    });
    res.status(201).json(budget);
  } catch (err) { next(err); }
}
