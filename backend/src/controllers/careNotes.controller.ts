import { Request, Response, NextFunction } from 'express';
import { query } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';

export async function listNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { residentId, type, startDate, endDate, page = '1', limit = '30' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let where = 'WHERE cn.care_home_id = $1 AND cn.deleted_at IS NULL';
    const params: any[] = [careHomeId];
    let p = 2;

    if (residentId) { where += ` AND cn.resident_id = $${p++}`; params.push(residentId); }
    if (type) { where += ` AND cn.note_type = $${p++}`; params.push(type); }
    if (startDate) { where += ` AND cn.created_at >= $${p++}`; params.push(startDate); }
    if (endDate) { where += ` AND cn.created_at <= $${p++}`; params.push(endDate + 'T23:59:59Z'); }

    const { rows } = await query(
      `SELECT
        cn.*,
        r.first_name || ' ' || r.last_name AS resident_name,
        r.room_number,
        u.first_name || ' ' || u.last_name AS author_name,
        u.role AS author_role,
        JSON_AGG(DISTINCT jsonb_build_object('id', na.id, 'filename', na.filename, 's3Key', na.s3_key))
          FILTER (WHERE na.id IS NOT NULL) AS attachments
       FROM care_notes cn
       JOIN residents r ON r.id = cn.resident_id
       JOIN users u ON u.id = cn.author_id
       LEFT JOIN note_attachments na ON na.note_id = cn.id
       ${where}
       GROUP BY cn.id, r.first_name, r.last_name, r.room_number, u.first_name, u.last_name, u.role
       ORDER BY cn.created_at DESC
       LIMIT $${p} OFFSET $${p+1}`,
      [...params, parseInt(limit as string), offset]
    );

    const { rows: [{ count }] } = await query(
      `SELECT COUNT(*) FROM care_notes cn ${where}`, params
    );

    res.json({ notes: rows, total: parseInt(count), page: parseInt(page as string) });
  } catch (err) { next(err); }
}

export async function createNote(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const {
      residentId, noteType, content, isSignificant, isPrivate,
      vitalBpSystolic, vitalBpDiastolic, vitalHeartRate, vitalTemp,
      vitalSpo2, vitalWeight, painScore, fluidIntakeMl, fluidOutputMl,
      foodEatenPercent, mood, position,
      writtenOnBehalfOf, coAuthors, mealContext,
      flagged, flagReason,
    } = req.body;

    if (!residentId || !noteType || !content) {
      return res.status(400).json({ error: 'residentId, noteType, and content are required' });
    }

    // Verify resident belongs to this care home
    const { rows: [resident] } = await query(
      'SELECT id FROM residents WHERE id = $1 AND care_home_id = $2 AND active = TRUE',
      [residentId, careHomeId]
    );
    if (!resident) throw new AppError(404, 'Resident not found');

    // Resolve co-author names if provided
    let coAuthorNames: string[] = [];
    if (coAuthors?.length) {
      const { rows: coStaff } = await query(
        `SELECT u.first_name || ' ' || u.last_name AS name
         FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
         WHERE sp.id = ANY($1::uuid[]) AND sp.care_home_id = $2`,
        [coAuthors, careHomeId]
      );
      coAuthorNames = coStaff.map((s: any) => s.name);
    }

    // Resolve written-on-behalf-of name
    let onBehalfOfName: string | null = null;
    if (writtenOnBehalfOf) {
      const { rows: [behalf] } = await query(
        `SELECT u.first_name || ' ' || u.last_name AS name
         FROM staff_profiles sp JOIN users u ON u.id = sp.user_id
         WHERE sp.id = $1 AND sp.care_home_id = $2`,
        [writtenOnBehalfOf, careHomeId]
      );
      onBehalfOfName = behalf?.name || null;
    }

    // Build enriched content: append meal context summary inline if provided
    let finalContent = content;
    if (mealContext) {
      try {
        const mc = JSON.parse(mealContext);
        if (mc.concerns) finalContent += `\n\n⚠ Meal concern: ${mc.concerns}`;
      } catch {}
    }

    const { rows: [note] } = await query(
      `INSERT INTO care_notes (
        care_home_id, resident_id, author_id, note_type, content,
        is_significant, is_private, flagged, flag_reason,
        vital_bp_systolic, vital_bp_diastolic, vital_heart_rate, vital_temp,
        vital_spo2, vital_weight, pain_score, fluid_intake_ml, fluid_output_ml,
        food_eaten_percent, mood, position,
        meal_context, written_on_behalf_of_name, co_author_names
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      RETURNING *`,
      [careHomeId, residentId, req.user!.id, noteType, finalContent,
       isSignificant || false, isPrivate || false, flagged || false, flagReason || null,
       vitalBpSystolic, vitalBpDiastolic, vitalHeartRate, vitalTemp,
       vitalSpo2, vitalWeight, painScore, fluidIntakeMl, fluidOutputMl,
       foodEatenPercent, mood, position,
       mealContext || null,
       onBehalfOfName,
       coAuthorNames.length ? JSON.stringify(coAuthorNames) : null]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_NOTE_CREATED', entityType: 'care_note', entityId: note.id,
      afterData: { residentId, noteType, isSignificant }, ip: req.ip,
    });

    res.status(201).json(note);
  } catch (err) { next(err); }
}

export async function updateNote(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;
    const { content, isSignificant, flagged, flagReason } = req.body;

    const { rows: [existing] } = await query(
      'SELECT * FROM care_notes WHERE id = $1 AND care_home_id = $2 AND deleted_at IS NULL',
      [id, careHomeId]
    );
    if (!existing) throw new AppError(404, 'Note not found');

    // Only author or manager can edit
    const canEdit = existing.author_id === req.user!.id ||
      ['home_manager','deputy_manager','super_admin'].includes(req.user!.role);
    if (!canEdit) throw new AppError(403, 'Cannot edit this note');

    const { rows: [updated] } = await query(
      `UPDATE care_notes SET
        content = COALESCE($1, content),
        is_significant = COALESCE($2, is_significant),
        flagged = COALESCE($3, flagged),
        flag_reason = COALESCE($4, flag_reason)
       WHERE id = $5 RETURNING *`,
      [content, isSignificant, flagged, flagReason, id]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_NOTE_UPDATED', entityType: 'care_note', entityId: id,
      beforeData: { content: existing.content }, afterData: { content }, ip: req.ip,
    });

    res.json(updated);
  } catch (err) { next(err); }
}

export async function deleteNote(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const careHomeId = req.user!.care_home_id;

    // Only managers can delete; soft-delete only
    await query(
      'UPDATE care_notes SET deleted_at = NOW() WHERE id = $1 AND care_home_id = $2',
      [id, careHomeId]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_NOTE_DELETED', entityType: 'care_note', entityId: id, ip: req.ip,
    });

    res.json({ message: 'Note deleted' });
  } catch (err) { next(err); }
}
