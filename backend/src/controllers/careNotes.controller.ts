import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';
import { appendQuietly } from '../services/recordChain';
import { lockResidentNotes, findDuplicate, insertCareNote } from '../services/careNoteWriter';
import { clientRecordedAt, clientRef } from '../utils/clientTime';

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
      writtenOnBehalfOf, coAuthors, mealContext, bowelsOpened, stoolType,
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

    // Made offline and sent later: the phone's time, bounded and labelled.
    const deviceTime = clientRecordedAt(req.body?.clientRecordedAt);
    // A resend of a note that already arrived (the reply was lost on the way
    // back) returns the original instead of creating a second copy.
    const ref = clientRef(req.body?.clientRef);
    if (ref) {
      const { rows: [already] } = await query(
        'SELECT * FROM care_notes WHERE care_home_id = $1 AND client_ref = $2', [careHomeId, ref]);
      if (already) return res.status(200).json(already);
    }

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
    // Amounts sent only inside mealContext used to stop there: the fluid chart,
    // MUST trend and monitoring alerts read the columns and never saw them.
    // Lift them into the columns when the client did not send them directly.
    let fluidIntakeMlFinal = fluidIntakeMl ?? null;
    let foodEatenPercentFinal = foodEatenPercent ?? null;
    if (mealContext) {
      try {
        const mc = typeof mealContext === 'string' ? JSON.parse(mealContext) : mealContext;
        if (mc.concerns) finalContent += `\n\n⚠ Meal concern: ${mc.concerns}`;
        const asInt = (v: unknown) => {
          const n = typeof v === 'number' ? v : Number(v);
          return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
        };
        if (fluidIntakeMlFinal == null) fluidIntakeMlFinal = asInt(mc.fluid_ml);
        if (foodEatenPercentFinal == null) {
          const pct = asInt(mc.food_eaten_percent);
          foodEatenPercentFinal = pct != null && pct <= 100 ? pct : null;
        }
      } catch {}
    }

    // The record and its chain entry are written together, and the duplicate
    // check runs inside the same transaction while holding this resident's
    // lock — so two carers saving at the same moment cannot both get through
    // (v89b). The check is about when the care HAPPENED, so a note made
    // offline and sent later is compared with what was recorded around then.
    const outcome = await withTransaction(async (client) => {
      await lockResidentNotes(client, residentId);
      // The same offline note arriving twice at once: the second waits for the
      // lock, then finds the first.
      if (ref) {
        const { rows: [again] } = await client.query('SELECT * FROM care_notes WHERE care_home_id = $1 AND client_ref = $2', [careHomeId, ref]);
        if (again) return { again };
      }
      if (req.body?.confirmDuplicate !== true) {
        const dup = await findDuplicate(client, {
          careHomeId, residentId, userId: req.user!.id, eventAt: deviceTime,
          note: { noteType: String(noteType), fluidIntakeMl: fluidIntakeMlFinal, foodEatenPercent: foodEatenPercentFinal },
        });
        if (dup) return { dup };
      }
      const created = await insertCareNote(client, {
        careHomeId, residentId, authorId: req.user!.id, noteType, content: finalContent,
        isSignificant, isPrivate, flagged, flagReason,
        vitalBpSystolic, vitalBpDiastolic, vitalHeartRate, vitalTemp, vitalSpo2, vitalWeight, painScore,
        fluidIntakeMl: fluidIntakeMlFinal, fluidOutputMl, foodEatenPercent: foodEatenPercentFinal, mood, position,
        mealContext, writtenOnBehalfOfName: onBehalfOfName, coAuthorNames,
        bowelsOpened, stoolType, clientRecordedAt: deviceTime, clientRef: ref,
      });
      return { created };
    });
    if ('again' in outcome) return res.status(200).json(outcome.again);
    if ('dup' in outcome) return res.status(409).json(outcome.dup);
    const note = outcome.created;

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

    // An amendment appends a new chain entry rather than rewriting the old one.
    // Clinical practice, and CQC, expect the original to remain readable — you
    // strike through, you do not erase. The chain mirrors that: the earlier
    // version stays in the history, and verification compares the live row
    // against the newest entry.
    const updated = await withTransaction(async (client) => {
      const { rows: [row] } = await client.query(
        `UPDATE care_notes SET
          content = COALESCE($1, content),
          is_significant = COALESCE($2, is_significant),
          flagged = COALESCE($3, flagged),
          flag_reason = COALESCE($4, flag_reason)
         WHERE id = $5 RETURNING *`,
        [content, isSignificant, flagged, flagReason, id]
      );

      await appendQuietly(client, {
        careHomeId,
        entityType: 'care_note',
        entityId: id,
        action: 'amended',
        row,
        recordedBy: req.user!.id,
        eventAt: row.created_at,
      });

      return row;
    });

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
    await withTransaction(async (client) => {
      const { rows: [row] } = await client.query(
        'UPDATE care_notes SET deleted_at = NOW() WHERE id = $1 AND care_home_id = $2 RETURNING *',
        [id, careHomeId]
      );
      // Soft delete only — the row survives, so the chain still verifies. The
      // withdrawal is itself recorded, so "this note was retracted, by whom and
      // when" is answerable later.
      if (row) {
        await appendQuietly(client, {
          careHomeId, entityType: 'care_note', entityId: id,
          action: 'withdrawn', row, recordedBy: req.user!.id, eventAt: row.created_at,
        });
      }
    });

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'CARE_NOTE_DELETED', entityType: 'care_note', entityId: id, ip: req.ip,
    });

    res.json({ message: 'Note deleted' });
  } catch (err) { next(err); }
}
