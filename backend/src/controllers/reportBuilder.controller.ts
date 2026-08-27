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


// ─────────────────────────────────────────────────────────────────────────────
// Actually running a report.
//
// Until now "Run" only wrote a row saying a run was pending — nothing was ever
// executed and no result was produced, so the Download button had nothing to
// download. This executes the template against a fixed, allow-listed set of
// tables and stores the rows on the run.
//
// Every identifier below comes from the allow-list, never from the request.
// A report builder that interpolates user input into SQL is a SQL-injection
// hole with a friendly UI on top.
// ─────────────────────────────────────────────────────────────────────────────

type SourceSpec = {
  table: string;
  /** Columns a report may select, mapped to the SQL that produces them. */
  columns: Record<string, string>;
  /** Extra joins needed by those columns. */
  join?: string;
  /** Column used for date-range filtering. */
  dateColumn?: string;
  /** How the table is scoped to a care home. */
  tenantColumn?: string;
};

const SOURCES: Record<string, SourceSpec> = {
  residents: {
    table: 'residents r', tenantColumn: 'r.care_home_id', dateColumn: 'r.admission_date',
    columns: {
      first_name: 'r.first_name', last_name: 'r.last_name', room_number: 'r.room_number',
      date_of_birth: 'r.date_of_birth', admission_date: 'r.admission_date',
      discharge_date: 'r.discharge_date', risk_level: 'r.risk_level',
      funding_type: 'r.funding_type', weekly_fee: 'r.weekly_fee', nhs_number: 'r.nhs_number',
      gp_name: 'r.gp_name', dnacpr: 'r.dnacpr', allergies: 'r.allergies', active: 'r.active',
    },
  },
  care_notes: {
    table: 'care_notes cn', tenantColumn: 'cn.care_home_id', dateColumn: 'cn.created_at',
    join: `JOIN residents r ON r.id = cn.resident_id LEFT JOIN users u ON u.id = cn.author_id`,
    columns: {
      created_at: 'cn.created_at', resident: `r.first_name || ' ' || r.last_name`,
      room_number: 'r.room_number', note_type: 'cn.note_type', content: 'cn.content',
      author: `u.first_name || ' ' || u.last_name`, is_significant: 'cn.is_significant',
      flagged: 'cn.flagged', pain_score: 'cn.pain_score',
      fluid_intake_ml: 'cn.fluid_intake_ml', food_eaten_percent: 'cn.food_eaten_percent',
    },
  },
  incidents: {
    table: 'incidents i', tenantColumn: 'i.care_home_id', dateColumn: 'i.created_at',
    join: 'LEFT JOIN residents r ON r.id = i.resident_id',
    columns: {
      created_at: 'i.created_at', incident_type: 'i.incident_type', severity: 'i.severity',
      status: 'i.status', resident: `r.first_name || ' ' || r.last_name`,
      location: 'i.location', description: 'i.description', injuries: 'i.injuries',
      cqc_reportable: 'i.cqc_reportable', reported_to_cqc: 'i.reported_to_cqc',
    },
  },
  invoices: {
    table: 'invoices inv', tenantColumn: 'inv.care_home_id', dateColumn: 'inv.created_at',
    join: 'LEFT JOIN residents r ON r.id = inv.resident_id',
    columns: {
      created_at: 'inv.created_at', resident: `r.first_name || ' ' || r.last_name`,
      status: 'inv.status',
    },
  },
  occupancy_records: {
    table: 'occupancy_records o', tenantColumn: 'o.care_home_id', dateColumn: 'o.record_date',
    columns: { record_date: 'o.record_date' },
  },
  visitor_records: {
    table: 'visitor_records v', tenantColumn: 'v.care_home_id', dateColumn: 'v.created_at',
    columns: { created_at: 'v.created_at' },
  },
};

function buildReportQuery(source: string, fields: string[], params: any) {
  const spec = SOURCES[source];
  if (!spec) return null;

  const wanted = (Array.isArray(fields) && fields.length ? fields : Object.keys(spec.columns))
    .filter(f => spec.columns[f]);
  if (!wanted.length) return null;

  const select = wanted.map(f => `${spec.columns[f]} AS "${f}"`).join(', ');
  const values: any[] = [];
  const where: string[] = [];

  if (spec.tenantColumn) { values.push(params.careHomeId); where.push(`${spec.tenantColumn} = $${values.length}`); }
  if (spec.dateColumn && params.from) { values.push(params.from); where.push(`${spec.dateColumn} >= $${values.length}`); }
  if (spec.dateColumn && params.to)   { values.push(params.to);   where.push(`${spec.dateColumn} <= $${values.length}`); }

  const order = spec.dateColumn ? `ORDER BY ${spec.dateColumn} DESC` : '';
  const sql = `SELECT ${select} FROM ${spec.table} ${spec.join || ''}
               ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ${order} LIMIT 5000`;
  return { sql, values, fields: wanted };
}

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

    // Execute it, rather than only recording that somebody asked.
    const built = buildReportQuery(template.data_source, template.fields || [], {
      careHomeId,
      from: parameters?.from || parameters?.dateFrom || null,
      to: parameters?.to || parameters?.dateTo || null,
    });

    if (!built) {
      const { rows: [failed] } = await query(
        `INSERT INTO report_runs (care_home_id, template_id, parameters, status, error, created_by)
         VALUES ($1,$2,$3,'failed',$4,$5) RETURNING *`,
        [careHomeId, templateId, parameters ? JSON.stringify(parameters) : null,
         `No report is available for the data source "${template.data_source}" yet.`, req.user!.id]);
      return res.status(400).json({
        error: `Reports are not available for "${template.data_source}" yet. Choose another data source.`,
        run: failed,
      });
    }

    let rows: any[] = [];
    let runError: string | null = null;
    try {
      const result = await query(built.sql, built.values);
      rows = result.rows;
    } catch (e: any) {
      runError = e?.message || 'The report could not be run';
    }

    const { rows: [run] } = await query(
      `INSERT INTO report_runs
         (care_home_id, template_id, parameters, status, row_count, result_url, error, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [careHomeId, templateId, parameters ? JSON.stringify(parameters) : null,
       runError ? 'failed' : 'completed', runError ? null : rows.length,
       runError ? null : JSON.stringify({ fields: built.fields, rows }),
       runError, req.user!.id]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'REPORT_RUN_STARTED', entityType: 'report_run', entityId: run.id,
      afterData: { templateId, templateName: template.name, rowCount: rows.length }, ip: req.ip,
    });
    res.status(201).json({ ...run, fields: built.fields, rows });
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
    let payload: any = null;
    try { payload = run.result_url ? JSON.parse(run.result_url) : null; } catch { payload = null; }
    res.json({ ...run, fields: payload?.fields || [], rows: payload?.rows || [] });
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
