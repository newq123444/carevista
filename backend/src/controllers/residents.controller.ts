import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../models/db';
import { cache } from '../models/redis';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';

// ── List residents ────────────────────────────────────────────────────────
export async function listResidents(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { active = 'true', search, risk, page = '1', limit = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let whereClause = 'WHERE r.care_home_id = $1';
    const params: any[] = [careHomeId];
    let p = 2;

    if (active !== 'all') {
      whereClause += ` AND r.active = $${p++}`;
      params.push(active === 'true');
    }

    if (search) {
      whereClause += ` AND (
        r.first_name ILIKE $${p} OR r.last_name ILIKE $${p} OR
        r.room_number ILIKE $${p} OR r.nhs_number ILIKE $${p}
      )`;
      params.push(`%${search}%`);
      p++;
    }

    if (risk) {
      whereClause += ` AND r.risk_level = $${p++}`;
      params.push(risk);
    }

    const { rows: residents } = await query(
      `SELECT
        r.*,
        ARRAY_AGG(DISTINCT rc.condition ORDER BY rc.condition) FILTER (WHERE rc.condition IS NOT NULL) AS conditions,
        COUNT(DISTINCT cn.id) FILTER (WHERE cn.created_at > NOW() - INTERVAL '7 days') AS notes_last_7_days,
        COUNT(DISTINCT i.id) FILTER (WHERE i.status != 'closed') AS open_incidents,
        COUNT(DISTINCT ma.id) FILTER (WHERE ma.status = 'missed' AND ma.administration_date = CURRENT_DATE) AS missed_meds_today
       FROM residents r
       LEFT JOIN resident_conditions rc ON rc.resident_id = r.id
       LEFT JOIN care_notes cn ON cn.resident_id = r.id AND cn.deleted_at IS NULL
       LEFT JOIN incidents i ON i.resident_id = r.id
       LEFT JOIN med_administrations ma ON ma.resident_id = r.id
       ${whereClause}
       GROUP BY r.id
       ORDER BY r.last_name, r.first_name
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, parseInt(limit as string), offset]
    );

    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM residents r ${whereClause}`,
      params
    );

    res.json({
      residents,
      total: parseInt(countRows[0].count),
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (err) {
    next(err);
  }
}

// ── Get single resident with full details ─────────────────────────────────
export async function getResident(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;

    const { rows: [resident] } = await query(
      `SELECT r.*,
        ARRAY_AGG(DISTINCT rc.condition ORDER BY rc.condition) FILTER (WHERE rc.condition IS NOT NULL) AS conditions
       FROM residents r
       LEFT JOIN resident_conditions rc ON rc.resident_id = r.id
       WHERE r.id = $1 AND r.care_home_id = $2
       GROUP BY r.id`,
      [id, careHomeId]
    );

    if (!resident) throw new AppError(404, 'Resident not found');

    const { rows: contacts } = await query(
      'SELECT * FROM resident_contacts WHERE resident_id = $1 ORDER BY is_nok DESC',
      [id]
    );

    const { rows: recentNotes } = await query(
      `SELECT cn.*, u.first_name || ' ' || u.last_name AS author_name
       FROM care_notes cn
       JOIN users u ON u.id = cn.author_id
       WHERE cn.resident_id = $1 AND cn.deleted_at IS NULL
       ORDER BY cn.created_at DESC LIMIT 10`,
      [id]
    );

    const { rows: medications } = await query(
      'SELECT * FROM medications WHERE resident_id = $1 AND active = TRUE ORDER BY name',
      [id]
    );

    const { rows: openIncidents } = await query(
      `SELECT i.*, u.first_name || ' ' || u.last_name AS reporter_name
       FROM incidents i
       JOIN users u ON u.id = i.reported_by
       WHERE i.resident_id = $1 AND i.status != 'closed'
       ORDER BY i.incident_date DESC`,
      [id]
    );

    res.json({ ...resident, contacts, recentNotes, medications, openIncidents });
  } catch (err) {
    next(err);
  }
}

// ── Create resident ───────────────────────────────────────────────────────
export async function createResident(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const {
      firstName, lastName, preferredName, dateOfBirth, gender,
      roomNumber, admissionDate, riskLevel, fundingType, weeklyFee,
      gpName, gpPractice, gpPhone, nhsNumber, dnacpr,
      conditions, contacts, notes, careNeedsSummary, religion, language
    } = req.body;

    if (!firstName || !lastName || !dateOfBirth || !roomNumber) {
      return res.status(400).json({ error: 'firstName, lastName, dateOfBirth, and roomNumber are required' });
    }

    await withTransaction(async (client) => {
      const { rows: [resident] } = await client.query(
        `INSERT INTO residents (
          care_home_id, first_name, last_name, preferred_name, date_of_birth,
          gender, room_number, admission_date, risk_level, funding_type,
          weekly_fee, gp_name, gp_practice, gp_phone, nhs_number, dnacpr,
          notes, care_needs_summary, religion, language
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        RETURNING *`,
        [careHomeId, firstName, lastName, preferredName, dateOfBirth,
         gender, roomNumber, admissionDate, riskLevel || 'low', fundingType || 'self_funded',
         weeklyFee, gpName, gpPractice, gpPhone, nhsNumber, dnacpr || false,
         notes, careNeedsSummary, religion, language || 'English']
      );

      // Insert conditions
      if (conditions?.length > 0) {
        for (const condition of conditions) {
          await client.query(
            'INSERT INTO resident_conditions (resident_id, condition) VALUES ($1, $2)',
            [resident.id, condition]
          );
        }
      }

      // Insert contacts
      if (contacts?.length > 0) {
        for (const contact of contacts) {
          await client.query(
            `INSERT INTO resident_contacts (
              resident_id, name, relationship, phone, email, is_nok, is_emergency, power_of_attorney
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [resident.id, contact.name, contact.relationship, contact.phone,
             contact.email, contact.isNok || false, contact.isEmergency || false,
             contact.powerOfAttorney || false]
          );
        }
      }

      await auditLog({
        careHomeId,
        actorId: req.user!.id,
        actorName: `${req.user!.first_name} ${req.user!.last_name}`,
        action: 'RESIDENT_ADMITTED',
        entityType: 'resident',
        entityId: resident.id,
        afterData: { name: `${firstName} ${lastName}`, room: roomNumber },
        ip: req.ip,
      });

      // Invalidate cache
      await cache.delPattern(`residents:${careHomeId}:*`);

      res.status(201).json(resident);
    });
  } catch (err) {
    next(err);
  }
}

// ── Update resident ───────────────────────────────────────────────────────
export async function updateResident(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;

    // Verify ownership
    const { rows: [existing] } = await query(
      'SELECT * FROM residents WHERE id = $1 AND care_home_id = $2',
      [id, careHomeId]
    );
    if (!existing) throw new AppError(404, 'Resident not found');

    const {
      riskLevel, roomNumber, notes, careNeedsSummary,
      gpName, gpPractice, gpPhone, dnacpr, fundingType, weeklyFee
    } = req.body;

    const { rows: [updated] } = await query(
      `UPDATE residents SET
        risk_level = COALESCE($1, risk_level),
        room_number = COALESCE($2, room_number),
        notes = COALESCE($3, notes),
        care_needs_summary = COALESCE($4, care_needs_summary),
        gp_name = COALESCE($5, gp_name),
        gp_practice = COALESCE($6, gp_practice),
        gp_phone = COALESCE($7, gp_phone),
        dnacpr = COALESCE($8, dnacpr),
        funding_type = COALESCE($9, funding_type),
        weekly_fee = COALESCE($10, weekly_fee)
       WHERE id = $11 RETURNING *`,
      [riskLevel, roomNumber, notes, careNeedsSummary,
       gpName, gpPractice, gpPhone, dnacpr, fundingType, weeklyFee, id]
    );

    await auditLog({
      careHomeId,
      actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'RESIDENT_UPDATED',
      entityType: 'resident',
      entityId: id,
      beforeData: existing,
      afterData: updated,
      ip: req.ip,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ── Update Mobility Status ────────────────────────────────────────────────
export async function updateMobilityStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { mobilityStatus } = req.body;

    const VALID_STATUSES = ['independent', 'walking_aid', 'wheelchair', 'bed_bound'];
    if (!mobilityStatus || !VALID_STATUSES.includes(mobilityStatus)) {
      return res.status(400).json({ error: `mobilityStatus must be one of: ${VALID_STATUSES.join(', ')}` });
    }

    // Verify resident exists and belongs to this care home
    const { rows: [existing] } = await query(
      'SELECT * FROM residents WHERE id = $1 AND care_home_id = $2',
      [id, careHomeId]
    );
    if (!existing) throw new AppError(404, 'Resident not found');

    // Update mobility_status
    const { rows: [updated] } = await query(
      `UPDATE residents SET mobility_status = $1 WHERE id = $2 AND care_home_id = $3 RETURNING *`,
      [mobilityStatus, id, careHomeId]
    );

    // Delete future pending tasks so they can be regenerated with correct mobility-based tasks
    await query(
      `DELETE FROM care_tasks WHERE resident_id = $1 AND task_date >= CURRENT_DATE AND status = 'pending'`,
      [id]
    );

    // Log to audit trail
    await auditLog({
      careHomeId,
      actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'MOBILITY_STATUS_UPDATED',
      entityType: 'resident',
      entityId: id,
      beforeData: { mobility_status: existing.mobility_status },
      afterData: { mobility_status: mobilityStatus },
      ip: req.ip,
    });

    // Invalidate cache
    await cache.delPattern(`residents:${careHomeId}:*`);

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ── Discharge resident ────────────────────────────────────────────────────
export async function dischargeResident(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { dischargeDate, dischargeReason } = req.body;

    const { rows: [resident] } = await query(
      `UPDATE residents
       SET active = FALSE, discharge_date = $1, notes = notes || $2
       WHERE id = $3 AND care_home_id = $4 RETURNING *`,
      [dischargeDate || new Date(), `\n[DISCHARGED ${new Date().toISOString()}]: ${dischargeReason || ''}`, id, careHomeId]
    );

    if (!resident) throw new AppError(404, 'Resident not found');

    // Deactivate medications
    await query('UPDATE medications SET active = FALSE WHERE resident_id = $1', [id]);

    await auditLog({
      careHomeId,
      actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'RESIDENT_DISCHARGED',
      entityType: 'resident',
      entityId: id,
      afterData: { dischargeDate, dischargeReason },
      ip: req.ip,
    });

    res.json(resident);
  } catch (err) {
    next(err);
  }
}
