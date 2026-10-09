// ────────────────────────────────────────────────────────────────────────────
// Mental Capacity Act assessments.
//
// The engine (services/mcaEngine.ts) is the only authority on whether an
// assessment is complete and its reasoning sound. The screen calls /validate
// as the assessor works; /complete calls the engine again here and refuses
// anything with an error, so a client cannot talk its way past it.
//
// Drafts are editable. Completed assessments are final — enforced by a
// database trigger, not just here — and a review creates a new assessment that
// supersedes the old one. The original stays readable, as it must.
// ────────────────────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../models/db';
import { auditLog } from '../services/audit.service';
import { appendToChain } from '../services/recordChain';
import { validateMca, emptyRecord, normalise, CATEGORIES, type Category } from '../services/mcaEngine';

const LIST_SQL = `
  SELECT m.id, m.resident_id, r.first_name || ' ' || r.last_name AS resident_name, r.room_number,
         m.decision, m.category, m.status, m.outcome, m.review_date, m.deprivation_of_liberty,
         m.assessor_name, m.assessor_role, m.completed_at, m.created_at, m.updated_at, m.supersedes_id,
         (m.status = 'completed' AND m.review_date IS NOT NULL AND m.review_date < CURRENT_DATE) AS review_overdue,
         EXISTS (SELECT 1 FROM mca_assessments d WHERE d.supersedes_id = m.id AND d.status = 'draft') AS review_in_progress
    FROM mca_assessments m
    JOIN residents r ON r.id = m.resident_id`;

export async function listAssessments(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const residentId = typeof req.query.residentId === 'string' && req.query.residentId ? req.query.residentId : null;
    const status = typeof req.query.status === 'string' && ['draft', 'completed', 'superseded'].includes(req.query.status)
      ? req.query.status : null;
    const { rows } = await query(
      `${LIST_SQL}
        WHERE m.care_home_id = $1
          AND ($2::uuid IS NULL OR m.resident_id = $2::uuid)
          AND ($3::text IS NULL OR m.status = $3::text)
        ORDER BY (m.status = 'draft') DESC, m.created_at DESC
        LIMIT 500`, [chId, residentId, status]);
    res.json(rows);
  } catch (err) { next(err); }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { rows: [s] } = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'draft')                                                AS drafts,
         COUNT(*) FILTER (WHERE status = 'completed')                                            AS current,
         COUNT(*) FILTER (WHERE status = 'completed' AND outcome = 'lacks_capacity')             AS lacks,
         COUNT(*) FILTER (WHERE status = 'completed' AND outcome = 'has_capacity')               AS has,
         COUNT(*) FILTER (WHERE status = 'completed' AND outcome = 'cannot_determine')           AS undetermined,
         COUNT(*) FILTER (WHERE status = 'completed' AND review_date < CURRENT_DATE)             AS overdue,
         COUNT(*) FILTER (WHERE status = 'completed' AND review_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30) AS due_soon,
         COUNT(*) FILTER (WHERE status = 'completed' AND deprivation_of_liberty)                 AS deprivations
       FROM mca_assessments WHERE care_home_id = $1`, [chId]);
    const n = (x: any) => Number(x || 0);
    res.json({
      drafts: n(s.drafts), current: n(s.current), lacks: n(s.lacks), has: n(s.has),
      undetermined: n(s.undetermined), overdue: n(s.overdue), dueSoon: n(s.due_soon),
      deprivations: n(s.deprivations),
    });
  } catch (err) { next(err); }
}

async function loadOne(chId: string, id: string) {
  const { rows: [row] } = await query(
    `${LIST_SQL.replace('SELECT m.id,', 'SELECT m.id, m.record, m.created_by,')}
      WHERE m.care_home_id = $1 AND m.id = $2`, [chId, id]);
  return row || null;
}

export async function getAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await loadOne(req.user!.care_home_id, req.params.id);
    if (!row) return res.status(404).json({ error: 'Assessment not found' });
    const record = normalise(row.record);
    res.json({ ...row, record, validation: validateMca(record) });
  } catch (err) { next(err); }
}

export async function validateOnly(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(validateMca(req.body?.record));
  } catch (err) { next(err); }
}

export async function createAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const { residentId, decision } = req.body || {};
    const category: Category = CATEGORIES.includes(req.body?.category) ? req.body.category : 'other';
    if (!residentId) return res.status(400).json({ error: 'Choose the resident' });

    const { rows: [resident] } = await query(
      `SELECT id FROM residents WHERE id = $1 AND care_home_id = $2`, [residentId, chId]);
    if (!resident) return res.status(404).json({ error: 'Resident not found' });

    const record = emptyRecord(String(decision || '').trim(), category);
    const { rows: [row] } = await query(
      `INSERT INTO mca_assessments (care_home_id, resident_id, decision, category, record, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [chId, residentId, record.decision || 'Decision not yet written', category, JSON.stringify(record), req.user!.id]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'MCA_ASSESSMENT_STARTED', entityType: 'mca_assessment', entityId: row.id,
      afterData: { residentId, category }, ip: req.ip,
    });

    const full = await loadOne(chId, row.id);
    res.status(201).json({ ...full, record, validation: validateMca(record) });
  } catch (err) { next(err); }
}

export async function updateAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const record = normalise(req.body?.record);
    const { rows: [row] } = await query(
      `UPDATE mca_assessments
          SET record = $1, decision = $2, category = $3, review_date = $4, updated_at = NOW()
        WHERE id = $5 AND care_home_id = $6 AND status = 'draft'
        RETURNING id`,
      [JSON.stringify(record), record.decision || 'Decision not yet written', record.category,
       record.reviewDate ? String(record.reviewDate).slice(0, 10) : null, req.params.id, chId]);
    if (!row) {
      return res.status(409).json({
        error: 'Only a draft can be changed. A completed assessment is final — start a review to reassess.',
      });
    }
    res.json({ ok: true, validation: validateMca(record) });
  } catch (err) { next(err); }
}

export async function completeAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const id = req.params.id;

    const result = await withTransaction(async (client) => {
      const { rows: [draft] } = await client.query(
        `SELECT * FROM mca_assessments WHERE id = $1 AND care_home_id = $2 FOR UPDATE`, [id, chId]);
      if (!draft) return { status: 404, body: { error: 'Assessment not found' } };
      if (draft.status !== 'draft') return { status: 409, body: { error: 'This assessment has already been completed.' } };

      const record = normalise(draft.record);
      const validation = validateMca(record);
      if (!validation.canComplete) {
        return {
          status: 422,
          body: { error: 'This assessment is not complete yet. The items below need attention.', validation },
        };
      }

      const { rows: [done] } = await client.query(
        `UPDATE mca_assessments
            SET status = 'completed', outcome = $1, review_date = $2, deprivation_of_liberty = $3,
                assessor_id = $4, assessor_name = $5, assessor_role = $6,
                completed_at = NOW(), updated_at = NOW()
          WHERE id = $7 AND care_home_id = $8 AND status = 'draft'
          RETURNING *`,
        [record.conclusion.outcome,
         record.reviewDate ? String(record.reviewDate).slice(0, 10) : null,
         validation.deprivationOfLiberty,
         req.user!.id, `${req.user!.first_name} ${req.user!.last_name}`, req.user!.role,
         id, chId]);

      if (done.supersedes_id) {
        await client.query(
          `UPDATE mca_assessments SET status = 'superseded', updated_at = NOW()
            WHERE id = $1 AND care_home_id = $2 AND status = 'completed'`,
          [done.supersedes_id, chId]);
      }

      // A capacity determination is a legal record. It goes on the chain, and
      // if that fails the completion fails with it rather than leaving an
      // unprovable finding behind.
      await appendToChain(client, {
        careHomeId: chId, entityType: 'mca_assessment', entityId: done.id,
        action: 'completed', row: done, recordedBy: req.user!.id, eventAt: done.completed_at,
      });

      return { status: 200, body: { ...done, record, validation } };
    });

    if (result.status === 200) {
      await auditLog({
        careHomeId: chId, actorId: req.user!.id,
        actorName: `${req.user!.first_name} ${req.user!.last_name}`,
        action: 'MCA_ASSESSMENT_COMPLETED', entityType: 'mca_assessment', entityId: id,
        afterData: { outcome: (result.body as any).outcome, deprivationOfLiberty: (result.body as any).deprivation_of_liberty },
        ip: req.ip,
      });
    }
    res.status(result.status).json(result.body);
  } catch (err) { next(err); }
}

export async function startReview(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const id = req.params.id;
    const { rows: [orig] } = await query(
      `SELECT * FROM mca_assessments WHERE id = $1 AND care_home_id = $2`, [id, chId]);
    if (!orig) return res.status(404).json({ error: 'Assessment not found' });
    if (orig.status !== 'completed') {
      return res.status(409).json({ error: 'Only a current, completed assessment can be reviewed.' });
    }

    // One review at a time: hand back the one already started.
    const { rows: [existing] } = await query(
      `SELECT id FROM mca_assessments WHERE supersedes_id = $1 AND care_home_id = $2 AND status = 'draft'`, [id, chId]);
    if (existing) return res.json({ id: existing.id, existing: true });

    // Carry forward what is still useful as a starting point — the decision,
    // what the person needs to know, who matters to them. Reset the test
    // itself: a reassessment that copies last time's answers is not one.
    const prev = normalise(orig.record);
    const fresh = emptyRecord(prev.decision, prev.category);
    fresh.relevantInformation = prev.relevantInformation;
    fresh.reasonForDoubt = prev.reasonForDoubt;
    fresh.communicationNeeds = prev.communicationNeeds;
    fresh.fluctuating = prev.fluctuating;
    fresh.bestInterests.consultees = prev.bestInterests.consultees.map(c => ({ ...c, view: '', date: '' }));
    fresh.bestInterests.lpa = prev.bestInterests.lpa;
    fresh.bestInterests.deputy = prev.bestInterests.deputy;
    fresh.bestInterests.adrt = prev.bestInterests.adrt;
    fresh.bestInterests.wishesFeelings = prev.bestInterests.wishesFeelings;
    fresh.bestInterests.beliefsValues = prev.bestInterests.beliefsValues;

    const { rows: [row] } = await query(
      `INSERT INTO mca_assessments (care_home_id, resident_id, decision, category, record, supersedes_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [chId, orig.resident_id, fresh.decision, fresh.category, JSON.stringify(fresh), id, req.user!.id]);

    await auditLog({
      careHomeId: chId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'MCA_REVIEW_STARTED', entityType: 'mca_assessment', entityId: row.id,
      afterData: { supersedes: id }, ip: req.ip,
    });
    res.status(201).json({ id: row.id, existing: false });
  } catch (err) { next(err); }
}

export async function deleteDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const chId = req.user!.care_home_id;
    const isManager = ['home_manager', 'deputy_manager', 'super_admin', 'group_admin'].includes(req.user!.role);
    const { rowCount } = await query(
      `DELETE FROM mca_assessments
        WHERE id = $1 AND care_home_id = $2 AND status = 'draft'
          AND (created_by = $3 OR $4::boolean)`,
      [req.params.id, chId, req.user!.id, isManager]);
    if (!rowCount) {
      return res.status(409).json({ error: 'Only a draft can be deleted, by the person who started it or a manager.' });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
}
