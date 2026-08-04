// ============================================================
// incidents.controller.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';

export async function listIncidents(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { status, severity, residentId, page = '1', limit = '30' } = req.query;
    let where = 'WHERE i.care_home_id = $1';
    const params: any[] = [careHomeId]; let p = 2;
    if (status) { where += ` AND i.status = $${p++}`; params.push(status); }
    if (severity) { where += ` AND i.severity = $${p++}`; params.push(severity); }
    if (residentId) { where += ` AND i.resident_id = $${p++}`; params.push(residentId); }

    const { rows } = await query(
      `SELECT i.*,
        r.first_name||' '||r.last_name AS resident_name, r.room_number,
        u.first_name||' '||u.last_name AS reporter_name
       FROM incidents i
       JOIN residents r ON r.id = i.resident_id
       JOIN users u ON u.id = i.reported_by
       ${where}
       ORDER BY i.incident_date DESC
       LIMIT $${p} OFFSET $${p+1}`,
      [...params, parseInt(limit as string), (parseInt(page as string)-1)*parseInt(limit as string)]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function createIncident(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, incidentType, severity, description, location, witnessed,
            witnessName, injuries, immediateActions, followUp, cqcReportable,
            familyNotified, gpNotified, incidentDate } = req.body;

    if (!residentId || !incidentType || !severity || !description) {
      return res.status(400).json({ error: 'residentId, incidentType, severity, and description are required' });
    }

    const { rows: [inc] } = await query(
      `INSERT INTO incidents (
        care_home_id, resident_id, reported_by, incident_type, severity, description,
        location, witnessed, witness_name, injuries, immediate_actions, follow_up,
        cqc_reportable, family_notified, gp_notified, incident_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [careHomeId, residentId, req.user!.id, incidentType, severity, description,
       location, witnessed || false, witnessName, injuries, immediateActions, followUp,
       cqcReportable || false, familyNotified || false, gpNotified || false,
       incidentDate || new Date()]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'INCIDENT_CREATED', entityType: 'incident', entityId: inc.id,
      afterData: { incidentType, severity, residentId }, ip: req.ip,
    });
    res.status(201).json(inc);
  } catch (err) { next(err); }
}

export async function updateIncidentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { status, updateNote } = req.body;

    const { rows: [inc] } = await query(
      `UPDATE incidents SET status = $1, closed_by = $2, closed_at = $3
       WHERE id = $4 AND care_home_id = $5 RETURNING *`,
      [status, status === 'closed' ? req.user!.id : null,
       status === 'closed' ? new Date() : null, id, careHomeId]
    );
    if (!inc) throw new AppError(404, 'Incident not found');

    if (updateNote) {
      await query(
        `INSERT INTO incident_updates (incident_id, author_id, content, status_change)
         VALUES ($1, $2, $3, $4)`,
        [id, req.user!.id, updateNote, status]
      );
    }
    res.json(inc);
  } catch (err) { next(err); }
}
