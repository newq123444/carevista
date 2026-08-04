// src/controllers/regulatoryReporting.controller.ts
// Automated Regulatory Reporting - CQC, safeguarding, DoLS notifications
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';

// ── Generate Notification ─────────────────────────────────────────────────
export async function generateNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { type, incidentId, residentId, details } = req.body;

    if (!type) return res.status(400).json({ error: 'type is required (cqc|safeguarding|dols|death)' });

    // Calculate deadline based on type
    let deadlineDays = 14;
    if (type === 'death') deadlineDays = 1;
    else if (type === 'safeguarding') deadlineDays = 1;
    else if (type === 'dols') deadlineDays = 7;

    const deadline = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000).toISOString();

    // Auto-populate notification form from incident data
    let formData: any = { type, generated_at: new Date().toISOString() };
    if (incidentId) {
      const { rows: [incident] } = await query(
        `SELECT i.*, r.first_name || ' ' || r.last_name AS resident_name
         FROM incidents i LEFT JOIN residents r ON r.id = i.resident_id
         WHERE i.id = $1 AND i.care_home_id = $2`,
        [incidentId, careHomeId]
      );
      if (incident) {
        formData = { ...formData, incident_details: incident.description, severity: incident.severity, resident_name: incident.resident_name, incident_date: incident.incident_date };
      }
    }

    const { rows: [notification] } = await query(
      `INSERT INTO regulatory_notifications (care_home_id, type, resident_id, incident_id, form_data, status, deadline, created_by)
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$7) RETURNING *`,
      [careHomeId, type, residentId || null, incidentId || null, JSON.stringify(formData), deadline, req.user!.id]
    );

    res.status(201).json(notification);
  } catch (err) { next(err); }
}

// ── List Notifications ────────────────────────────────────────────────────
export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { status, type } = req.query;

    let sql = `SELECT rn.*, r.first_name || ' ' || r.last_name AS resident_name,
               u.first_name || ' ' || u.last_name AS created_by_name
               FROM regulatory_notifications rn
               LEFT JOIN residents r ON r.id = rn.resident_id
               JOIN users u ON u.id = rn.created_by
               WHERE rn.care_home_id = $1`;
    const params: any[] = [careHomeId];
    let idx = 2;

    if (status) { sql += ` AND rn.status = $${idx}`; params.push(status); idx++; }
    if (type) { sql += ` AND rn.type = $${idx}`; params.push(type); idx++; }
    sql += ` ORDER BY rn.deadline ASC LIMIT 100`;

    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) { next(err); }
}

// ── Update Notification ───────────────────────────────────────────────────
export async function updateNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { status, formData, submissionRef } = req.body;

    const { rows: [notification] } = await query(
      `UPDATE regulatory_notifications SET status = COALESCE($1, status), form_data = COALESCE($2, form_data),
       submission_ref = COALESCE($3, submission_ref), submitted_at = CASE WHEN $1 = 'submitted' THEN NOW() ELSE submitted_at END,
       submitted_by = CASE WHEN $1 = 'submitted' THEN $4 ELSE submitted_by END
       WHERE id = $5 AND care_home_id = $6 RETURNING *`,
      [status, formData ? JSON.stringify(formData) : null, submissionRef, req.user!.id, id, careHomeId]
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json(notification);
  } catch (err) { next(err); }
}

// ── Get Deadlines ─────────────────────────────────────────────────────────
export async function getDeadlines(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;

    const { rows } = await query(
      `SELECT rn.*, r.first_name || ' ' || r.last_name AS resident_name
       FROM regulatory_notifications rn
       LEFT JOIN residents r ON r.id = rn.resident_id
       WHERE rn.care_home_id = $1 AND rn.status IN ('draft','pending','overdue')
       ORDER BY rn.deadline ASC LIMIT 50`,
      [careHomeId]
    );

    // Mark overdue ones
    const deadlines = rows.map((n: any) => ({
      ...n,
      is_overdue: new Date(n.deadline) < new Date(),
      days_remaining: Math.ceil((new Date(n.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    }));

    res.json(deadlines);
  } catch (err) { next(err); }
}
