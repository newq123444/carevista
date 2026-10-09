// ────────────────────────────────────────────────────────────────────────────
// Record integrity: verification, sealing, proofs, and the findings queue.
//
// Everything here is manager-only. Findings name individual members of staff,
// and a queue of "records that look odd, by person" visible to the whole team
// would be corrosive — so it is not.
// ────────────────────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { query, withTransaction } from '../models/db';
import { AppError } from '../utils/errors';
import { auditLog } from '../services/audit.service';
import { verifyChain, anchorDay, proveRecord, appendQuietly } from '../services/recordChain';
import { runAllChecks, DEFAULT_THRESHOLDS, type Thresholds, type RecordRow, type ShiftRow, type AbsenceRow }
  from '../services/integrityChecks';

// ── Settings ───────────────────────────────────────────────────────────────

async function loadSettings(careHomeId: string): Promise<Thresholds & { anchorMode: 'local' | 'external'; anchorProvider: string | null }> {
  const { rows: [r] } = await query<any>(
    `SELECT * FROM integrity_settings WHERE care_home_id = $1`, [careHomeId]);
  if (!r) return { ...DEFAULT_THRESHOLDS, anchorMode: 'local', anchorProvider: null };
  return {
    minMinutesPerResident: Number(r.min_minutes_per_resident),
    burstMinRecords: r.burst_min_records,
    burstWindowMinutes: r.burst_window_minutes,
    lateEntryHours: r.late_entry_hours,
    checkOffShift: r.check_off_shift,
    checkAbsentResident: r.check_absent_resident,
    checkLateEntry: r.check_late_entry,
    checkThroughput: r.check_throughput,
    checkEndOfShiftBurst: r.check_end_of_shift_burst,
    anchorMode: r.anchor_mode,
    anchorProvider: r.anchor_provider,
  };
}

export async function getSettings(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await loadSettings(req.user!.care_home_id));
  } catch (err) { next(err); }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const b = req.body || {};

    // Anchoring cannot be switched to 'external' without somewhere to publish
    // to. Claiming the stronger protection while publishing nowhere is exactly
    // the false assurance the threat model warns about.
    if (b.anchorMode === 'external' && !b.anchorProvider) {
      throw new AppError(400,
        'External anchoring needs a timestamping provider. Without one the app would be claiming ' +
        'protection it does not have.');
    }

    const { rows: [row] } = await query<any>(
      `INSERT INTO integrity_settings
         (care_home_id, min_minutes_per_resident, burst_min_records, burst_window_minutes,
          late_entry_hours, check_off_shift, check_absent_resident, check_late_entry,
          check_throughput, check_end_of_shift_burst, anchor_mode, anchor_provider,
          anchor_endpoint, updated_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       ON CONFLICT (care_home_id) DO UPDATE SET
         min_minutes_per_resident = EXCLUDED.min_minutes_per_resident,
         burst_min_records        = EXCLUDED.burst_min_records,
         burst_window_minutes     = EXCLUDED.burst_window_minutes,
         late_entry_hours         = EXCLUDED.late_entry_hours,
         check_off_shift          = EXCLUDED.check_off_shift,
         check_absent_resident    = EXCLUDED.check_absent_resident,
         check_late_entry         = EXCLUDED.check_late_entry,
         check_throughput         = EXCLUDED.check_throughput,
         check_end_of_shift_burst = EXCLUDED.check_end_of_shift_burst,
         anchor_mode              = EXCLUDED.anchor_mode,
         anchor_provider          = EXCLUDED.anchor_provider,
         anchor_endpoint          = EXCLUDED.anchor_endpoint,
         updated_by               = EXCLUDED.updated_by,
         updated_at               = NOW()
       RETURNING *`,
      [careHomeId,
       clamp(b.minMinutesPerResident, 0.5, 60, DEFAULT_THRESHOLDS.minMinutesPerResident),
       clamp(b.burstMinRecords, 2, 100, DEFAULT_THRESHOLDS.burstMinRecords),
       clamp(b.burstWindowMinutes, 1, 120, DEFAULT_THRESHOLDS.burstWindowMinutes),
       clamp(b.lateEntryHours, 1, 168, DEFAULT_THRESHOLDS.lateEntryHours),
       !!b.checkOffShift, b.checkAbsentResident !== false, b.checkLateEntry !== false,
       b.checkThroughput !== false, b.checkEndOfShiftBurst !== false,
       b.anchorMode === 'external' ? 'external' : 'local',
       b.anchorProvider || null, b.anchorEndpoint || null, req.user!.id]
    );

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'INTEGRITY_SETTINGS_UPDATED', entityType: 'integrity_settings',
      afterData: { anchorMode: row.anchor_mode }, ip: req.ip,
    });

    res.json(row);
  } catch (err) { next(err); }
}

function clamp(v: any, lo: number, hi: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

// ── Verification ───────────────────────────────────────────────────────────

export async function verify(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const result = await verifyChain(careHomeId, {
      fromSeq: req.query.fromSeq ? Number(req.query.fromSeq) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    // A verification run is itself worth logging: "we checked, on this date,
    // and it was intact" is the thing a home wants to be able to show.
    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'RECORD_CHAIN_VERIFIED', entityType: 'record_chain',
      afterData: { intact: result.intact, entriesChecked: result.entriesChecked, breaks: result.breaks.length },
      ip: req.ip,
    });

    res.json({
      ...result,
      // Said plainly, every time, so nobody reads "intact" as "the care was good".
      meaning: result.intact
        ? 'Every record checked still matches what was written when it was made. This does not say whether the records are accurate — only that they have not been changed since.'
        : 'At least one record no longer matches what was recorded at the time. See the list below.',
      protection: result.anchoring.mode === 'external'
        ? 'Daily seals are published to an independent timestamping service, so alterations are detectable even by someone with full access to this database.'
        : 'Daily seals are stored in this database only. That detects accidental corruption and anyone without database access, but NOT someone who can write to the database directly. Switch on external anchoring in Settings for that.',
    });
  } catch (err) { next(err); }
}

export async function sealDay(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const day = String(req.body?.day || req.query.day || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new AppError(400, 'A day in YYYY-MM-DD form is required');

    const result = await anchorDay(careHomeId, day);
    if (!result.anchored) return res.status(200).json(result);

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'RECORD_CHAIN_SEALED', entityType: 'chain_anchor', 
      afterData: { day, entryCount: result.entryCount, merkleRoot: result.merkleRoot }, ip: req.ip,
    });

    res.json(result);
  } catch (err) { next(err); }
}

export async function listAnchors(req: Request, res: Response, next: NextFunction) {
  try {
    const { rows } = await query(
      `SELECT id, anchor_date, entry_count, merkle_root, chain_head, anchor_mode,
              external_provider, external_ref, published_at, created_at
         FROM chain_anchors WHERE care_home_id = $1
        ORDER BY anchor_date DESC LIMIT 90`,
      [req.user!.care_home_id]);
    res.json(rows);
  } catch (err) { next(err); }
}

export async function certificate(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await proveRecord(req.user!.care_home_id, req.params.entityId);
    if (!result.found) return res.status(404).json({ error: result.reason });
    res.json({
      ...result.proof,
      // What a reader of this certificate may and may not conclude.
      meaning:
        'This proves the record was included in the seal taken on ' + result.proof!.anchorDate +
        ', and that it still says the same thing today. It does not say whether the record is accurate.',
      howToCheck:
        'Hash the record, then combine it with each listed step in order — right-hand siblings on the right, ' +
        'left-hand siblings on the left, SHA-256 each time with a 0x01 prefix — and you should arrive at the ' +
        'stated seal. Leaves are prefixed 0x00.',
    });
  } catch (err) { next(err); }
}

// ── Findings ───────────────────────────────────────────────────────────────

export async function runDetection(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90);
    const th = await loadSettings(careHomeId);

    // Care notes, medication signatures and completed tasks in one shape.
    const { rows: records } = await query<any>(
      `SELECT n.id, n.resident_id, n.author_id AS staff_id, n.created_at AS recorded_at,
              n.created_at AS event_at, 'care_note' AS kind, n.note_type AS category,
              r.first_name || ' ' || r.last_name AS resident_name,
              u.first_name || ' ' || u.last_name AS staff_name
         FROM care_notes n
         LEFT JOIN residents r ON r.id = n.resident_id
         LEFT JOIN users u ON u.id = n.author_id
        WHERE n.care_home_id = $1 AND n.deleted_at IS NULL
          AND n.created_at >= NOW() - ($2 || ' days')::interval
        UNION ALL
       SELECT t.id, t.resident_id, t.completed_by, t.completed_at,
              t.completed_at, 'care_task', t.category,
              r.first_name || ' ' || r.last_name,
              u.first_name || ' ' || u.last_name
         FROM care_tasks t
         LEFT JOIN residents r ON r.id = t.resident_id
         LEFT JOIN users u ON u.id = t.completed_by
        WHERE t.care_home_id = $1 AND t.status = 'done' AND t.completed_at IS NOT NULL
          AND t.completed_at >= NOW() - ($2 || ' days')::interval`,
      [careHomeId, String(days)]
    );

    // shifts.staff_id references staff_profiles, not users, so it has to be
    // joined through — the records above are authored by a user id.
    const { rows: shifts } = await query<any>(
      `SELECT sp.user_id AS staff_id, s.shift_date, s.start_time, s.end_time
         FROM shifts s
         JOIN staff_profiles sp ON sp.id = s.staff_id
        WHERE s.care_home_id = $1
          AND s.shift_date >= (NOW() - ($2 || ' days')::interval)::date
          AND s.start_time IS NOT NULL AND s.end_time IS NOT NULL`,
      [careHomeId, String(days)]
    );

    // resident_absences stores DATEs. An absence covers whole days, so it runs
    // from midnight on start_date to the end of actual_return — using the bare
    // date as the end would treat the day of return as time away and flag every
    // record made after someone came home.
    const { rows: absences } = await query<any>(
      `SELECT resident_id, start_date, actual_return, absence_type, reason
         FROM resident_absences
        WHERE care_home_id = $1
          AND (actual_return IS NULL
               OR actual_return >= (NOW() - ($2 || ' days')::interval)::date)`,
      [careHomeId, String(days)]
    );

    const findings = runAllChecks({
      records: records.map((r: any): RecordRow => ({
        id: r.id,
        residentId: r.resident_id,
        residentName: r.resident_name,
        staffId: r.staff_id,
        staffName: r.staff_name,
        eventAt: new Date(r.event_at),
        recordedAt: new Date(r.recorded_at),
        kind: r.kind,
        category: r.category,
      })),
      shifts: shifts.map((s: any): ShiftRow => ({
        staffId: s.staff_id,
        start: combine(s.shift_date, s.start_time),
        // A night shift ending before it starts has crossed midnight.
        end: endOfShift(s.shift_date, s.start_time, s.end_time),
      })),
      absences: absences.map((a: any): AbsenceRow => ({
        residentId: a.resident_id,
        from: startOfDay(a.start_date),
        to: a.actual_return ? endOfDay(a.actual_return) : null,
        reason: a.reason || a.absence_type,
      })),
      thresholds: th,
    });

    // Upsert on fingerprint: a finding already dealt with does not come back.
    let created = 0;
    for (const f of findings) {
      const { rowCount } = await query(
        `INSERT INTO integrity_findings
           (care_home_id, kind, severity, subject_staff_id, subject_resident_id,
            occurred_on, summary, evidence, record_ids, fingerprint)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (care_home_id, fingerprint) DO NOTHING`,
        [careHomeId, f.kind, f.severity, f.staffId, f.residentId, f.occurredOn,
         f.summary, JSON.stringify(f.evidence), f.recordIds, f.fingerprint]
      );
      created += rowCount;
    }

    res.json({
      daysExamined: days,
      recordsExamined: records.length,
      findings: findings.length,
      newFindings: created,
      note: findings.length === 0
        ? 'Nothing looked out of the ordinary.'
        : 'These are prompts to check, not accusations. Most have an ordinary explanation.',
    });
  } catch (err) { next(err); }
}

function startOfDay(d: any): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: any): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function combine(date: any, time: any): Date {
  const d = new Date(date);
  const [h, m] = String(time || '00:00:00').split(':').map(Number);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function endOfShift(date: any, start: any, end: any): Date {
  const s = combine(date, start);
  const e = combine(date, end);
  // A shift finishing at or before it starts ran through midnight.
  if (e.getTime() <= s.getTime()) e.setDate(e.getDate() + 1);
  return e;
}

export async function listFindings(req: Request, res: Response, next: NextFunction) {
  try {
    const status = String(req.query.status || 'open');
    const { rows } = await query(
      `SELECT f.*,
              su.first_name || ' ' || su.last_name AS staff_name,
              r.first_name  || ' ' || r.last_name  AS resident_name,
              ru.first_name || ' ' || ru.last_name AS resolved_by_name
         FROM integrity_findings f
         LEFT JOIN users su ON su.id = f.subject_staff_id
         LEFT JOIN residents r ON r.id = f.subject_resident_id
         LEFT JOIN users ru ON ru.id = f.resolved_by
        WHERE f.care_home_id = $1
          AND ($2 = 'all' OR f.status = $2)
        ORDER BY
          CASE f.severity WHEN 'urgent' THEN 0 WHEN 'notable' THEN 1 ELSE 2 END,
          f.occurred_on DESC
        LIMIT 500`,
      [req.user!.care_home_id, status]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

export async function resolveFinding(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { id } = req.params;
    const { status, note } = req.body || {};

    if (!['explained', 'action_taken', 'not_an_issue'].includes(status)) {
      throw new AppError(400, 'Choose how this was resolved');
    }
    // Closing without a reason is how a queue becomes wallpaper.
    if (!note || String(note).trim().length < 3) {
      throw new AppError(400, 'Please say briefly what you found — a closed finding with no reason helps nobody later');
    }

    const updated = await withTransaction(async (client) => {
      const { rows: [row] } = await client.query(
        `UPDATE integrity_findings
            SET status = $1, resolution_note = $2, resolved_by = $3, resolved_at = NOW()
          WHERE id = $4 AND care_home_id = $5 AND status = 'open'
          RETURNING *`,
        [status, String(note).trim(), req.user!.id, id, careHomeId]
      );
      if (!row) throw new AppError(404, 'That finding is not open, or does not exist');

      // The resolution goes in the chain too. A pattern of dismissing findings
      // is then itself on the record, which is the point.
      await appendQuietly(client, {
        careHomeId, entityType: 'finding_resolution', entityId: row.id,
        action: status, row, recordedBy: req.user!.id, eventAt: row.resolved_at,
      });
      return row;
    });

    await auditLog({
      careHomeId, actorId: req.user!.id,
      actorName: `${req.user!.first_name} ${req.user!.last_name}`,
      action: 'INTEGRITY_FINDING_RESOLVED', entityType: 'integrity_finding', entityId: id,
      afterData: { status }, ip: req.ip,
    });

    res.json(updated);
  } catch (err) { next(err); }
}

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    const careHomeId = req.user!.care_home_id;
    const { rows: [s] } = await query<any>(
      `SELECT
         (SELECT count(*) FROM record_chain WHERE care_home_id = $1) AS chained_records,
         (SELECT count(*) FROM record_chain WHERE care_home_id = $1 AND anchored_in IS NULL) AS unsealed,
         (SELECT count(*) FROM chain_anchors WHERE care_home_id = $1) AS days_sealed,
         (SELECT max(anchor_date)::text FROM chain_anchors WHERE care_home_id = $1) AS last_sealed,
         (SELECT count(*) FROM integrity_findings WHERE care_home_id = $1 AND status = 'open') AS open_findings,
         (SELECT count(*) FROM integrity_findings WHERE care_home_id = $1 AND status = 'open' AND severity <> 'review') AS open_notable,
         (SELECT anchor_mode FROM integrity_settings WHERE care_home_id = $1) AS anchor_mode`,
      [careHomeId]
    );
    res.json({
      chainedRecords: Number(s.chained_records),
      unsealedRecords: Number(s.unsealed),
      daysSealed: Number(s.days_sealed),
      lastSealed: s.last_sealed,
      openFindings: Number(s.open_findings),
      openNotable: Number(s.open_notable),
      anchorMode: s.anchor_mode || 'local',
    });
  } catch (err) { next(err); }
}
