import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';

// ── Report Templates CRUD ─────────────────────────────────────────────────

export async function createReportTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { name, description, dataSource, fields, filters, groupBy, sortBy, scheduleCron, format } = req.body;

    if (!name || !dataSource) {
      return res.status(400).json({ error: 'name and dataSource are required' });
    }

    const { rows: [template] } = await query(
      `INSERT INTO report_templates (care_home_id, name, description, data_source, fields, filters, group_by, sort_by, schedule_cron, format, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [careHomeId, name, description, dataSource, fields ? JSON.stringify(fields) : null, filters ? JSON.stringify(filters) : null, groupBy ? JSON.stringify(groupBy) : null, sortBy ? JSON.stringify(sortBy) : null, scheduleCron, format || 'pdf', req.user!.id]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'REPORT_TEMPLATE_CREATED', entityType: 'report_template', entityId: template.id,
      afterData: { name, dataSource, format: format || 'pdf' }, ip: req.ip,
    });
    res.status(201).json(template);
  } catch (err) { next(err); }
}

export async function listReportTemplates(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { rows } = await query(
      `SELECT rt.*, u.first_name || ' ' || u.last_name AS created_by_name
       FROM report_templates rt
       LEFT JOIN users u ON u.id = rt.created_by
       WHERE rt.care_home_id = $1
       ORDER BY rt.name`,
      [careHomeId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function getReportTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [template] } = await query(
      `SELECT rt.*, u.first_name || ' ' || u.last_name AS created_by_name
       FROM report_templates rt
       LEFT JOIN users u ON u.id = rt.created_by
       WHERE rt.id = $1 AND rt.care_home_id = $2`,
      [id, careHomeId]
    );
    if (!template) throw new AppError(404, 'Report template not found');
    res.json(template);
  } catch (err) { next(err); }
}

export async function updateReportTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { name, description, dataSource, fields, filters, groupBy, sortBy, scheduleCron, format } = req.body;

    const { rows: [template] } = await query(
      `UPDATE report_templates SET
        name = COALESCE($1, name), description = COALESCE($2, description),
        data_source = COALESCE($3, data_source),
        fields = COALESCE($4, fields), filters = COALESCE($5, filters),
        group_by = COALESCE($6, group_by), sort_by = COALESCE($7, sort_by),
        schedule_cron = COALESCE($8, schedule_cron), format = COALESCE($9, format),
        updated_at = NOW()
       WHERE id = $10 AND care_home_id = $11 RETURNING *`,
      [name, description, dataSource, fields ? JSON.stringify(fields) : null, filters ? JSON.stringify(filters) : null, groupBy ? JSON.stringify(groupBy) : null, sortBy ? JSON.stringify(sortBy) : null, scheduleCron, format, id, careHomeId]
    );
    if (!template) throw new AppError(404, 'Report template not found');
    res.json(template);
  } catch (err) { next(err); }
}

export async function deleteReportTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [template] } = await query(
      `DELETE FROM report_templates WHERE id = $1 AND care_home_id = $2 RETURNING *`,
      [id, careHomeId]
    );
    if (!template) throw new AppError(404, 'Report template not found');

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'REPORT_TEMPLATE_DELETED', entityType: 'report_template', entityId: id,
      afterData: { name: template.name }, ip: req.ip,
    });
    res.json({ message: 'Template deleted' });
  } catch (err) { next(err); }
}

// ── Report Runs ───────────────────────────────────────────────────────────

export async function runReport(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { templateId, parameters } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'templateId is required' });
    }

    // Verify template exists
    const { rows: [template] } = await query(
      `SELECT * FROM report_templates WHERE id = $1 AND care_home_id = $2`,
      [templateId, careHomeId]
    );
    if (!template) throw new AppError(404, 'Report template not found');

    const { rows: [run] } = await query(
      `INSERT INTO report_runs (care_home_id, template_id, parameters, status, created_by)
       VALUES ($1, $2, $3, 'pending', $4) RETURNING *`,
      [careHomeId, templateId, parameters ? JSON.stringify(parameters) : null, req.user!.id]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'REPORT_RUN_STARTED', entityType: 'report_run', entityId: run.id,
      afterData: { templateId, templateName: template.name }, ip: req.ip,
    });
    res.status(201).json(run);
  } catch (err) { next(err); }
}

export async function listReportRuns(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { templateId, status } = req.query;
    let where = 'WHERE rr.care_home_id = $1';
    const params: unknown[] = [careHomeId];
    let p = 2;
    if (templateId) { where += ` AND rr.template_id = $${p++}`; params.push(templateId); }
    if (status) { where += ` AND rr.status = $${p++}`; params.push(status); }

    const { rows } = await query(
      `SELECT rr.*, rt.name AS template_name, u.first_name || ' ' || u.last_name AS created_by_name
       FROM report_runs rr
       JOIN report_templates rt ON rt.id = rr.template_id
       LEFT JOIN users u ON u.id = rr.created_by
       ${where}
       ORDER BY rr.run_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function getReportRun(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [run] } = await query(
      `SELECT rr.*, rt.name AS template_name, u.first_name || ' ' || u.last_name AS created_by_name
       FROM report_runs rr
       JOIN report_templates rt ON rt.id = rr.template_id
       LEFT JOIN users u ON u.id = rr.created_by
       WHERE rr.id = $1 AND rr.care_home_id = $2`,
      [id, careHomeId]
    );
    if (!run) throw new AppError(404, 'Report run not found');
    res.json(run);
  } catch (err) { next(err); }
}

// ── Available Data Sources ────────────────────────────────────────────────

export async function getAvailableDataSources(_req: Request, res: Response, next: NextFunction) {
  try {
    const dataSources = [
      { id: 'residents', name: 'Residents', description: 'Resident demographics and status' },
      { id: 'care_notes', name: 'Care Notes', description: 'Daily care notes and observations' },
      { id: 'incidents', name: 'Incidents', description: 'Incident reports and outcomes' },
      { id: 'invoices', name: 'Invoices', description: 'Billing and invoice data' },
      { id: 'staff_costs', name: 'Staff Costs', description: 'Staff cost and overtime data' },
      { id: 'occupancy_records', name: 'Occupancy', description: 'Bed occupancy records' },
      { id: 'absence_records', name: 'Absence', description: 'Staff absence records' },
      { id: 'training_records', name: 'Training', description: 'Staff training and compliance' },
      { id: 'medications', name: 'Medications', description: 'Medication administration records' },
      { id: 'visitor_records', name: 'Visitors', description: 'Visitor sign-in records' },
      { id: 'fire_tests', name: 'Fire Tests', description: 'Fire safety test records' },
      { id: 'room_turnovers', name: 'Room Turnovers', description: 'Room turnover tracking' },
      { id: 'competencies', name: 'Competencies', description: 'Staff competency matrix' },
      { id: 'job_applications', name: 'Recruitment', description: 'Job applications and pipeline' },
    ];
    res.json(dataSources);
  } catch (err) { next(err); }
}
