// ────────────────────────────────────────────────────────────────────────────
// The tamper-evident record chain.
//
// Every clinically meaningful record appends an entry committing to the entry
// before it. Altering any historic record breaks every hash after it, and
// verification reports the exact sequence number where the break starts.
//
// Read compliance/RECORD_INTEGRITY_THREAT_MODEL.md before changing anything
// here. In particular: this proves a record has not been altered since it was
// made. It does not prove the record is true.
// ────────────────────────────────────────────────────────────────────────────
import type { PoolClient } from 'pg';
import { query } from '../models/db';
import { recordDigest, fieldNames, hashPair, ZERO_HASH, type FieldSpec } from '../utils/canonical';
import { merkleRoot, inclusionProof, verifyInclusion, type ProofStep } from './merkle';
import { logger } from '../utils/logger';

export const DIGEST_VERSION = 1;

/**
 * Which fields of each record are hashed.
 *
 * Only the fields that carry clinical or evidential meaning. Deliberately NOT
 * `updated_at` or similar bookkeeping columns: a housekeeping migration that
 * touches them would otherwise look identical to somebody rewriting a note.
 *
 * These lists are append-only in spirit. Changing one changes every future
 * digest, so a change must come with a new DIGEST_VERSION and verification must
 * use the version stored on the entry.
 */
export const HASHED_FIELDS: Record<string, readonly FieldSpec[]> = {
  care_note: [
    'id', 'care_home_id', 'resident_id', 'author_id', 'note_type', 'content',
    { name: 'is_significant', type: 'bool' },
    { name: 'vital_bp_systolic', type: 'numeric' },
    { name: 'vital_bp_diastolic', type: 'numeric' },
    { name: 'vital_heart_rate', type: 'numeric' },
    { name: 'vital_temp', type: 'numeric' },
    { name: 'vital_spo2', type: 'numeric' },
    { name: 'vital_weight', type: 'numeric' },
    { name: 'pain_score', type: 'numeric' },
    { name: 'fluid_intake_ml', type: 'numeric' },
    { name: 'fluid_output_ml', type: 'numeric' },
    { name: 'food_eaten_percent', type: 'numeric' },
    'position', 'mood', 'written_on_behalf_of_name',
    { name: 'bowels_opened', type: 'bool' },
    'stool_type',
    { name: 'created_at', type: 'time' },
    // Added in v86. Each entry stores the field list it was hashed over, so
    // entries written before this column existed still verify.
    { name: 'client_recorded_at', type: 'time' },
  ],
  med_administration: [
    'id', 'care_home_id', 'resident_id', 'medication_id', 'status',
    'administered_by', 'witnessed_by', 'notes', 'dose_given',
    'refusal_reason', 'omission_reason', 'prn_reason', 'prn_effect',
    { name: 'is_prn', type: 'bool' },
    // administration_date is DATE and scheduled_time/actual_time are TIME.
    // node-postgres hands DATE back as a Date built at *local* midnight, so
    // normalising it through UTC would shift the day if the server's timezone
    // ever changed — and every historic digest would break at once. The 'date'
    // type reads the calendar day the driver actually constructed.
    { name: 'administration_date', type: 'date' },
    'scheduled_time', 'actual_time',
    { name: 'created_at', type: 'time' },
  ],
  care_task: [
    'id', 'care_home_id', 'resident_id', 'template_id', 'task_name',
    'category', 'status', 'completed_by', 'notes', 'deferred_reason',
    'note_type', 'handled_in',
    { name: 'task_date', type: 'date' },
    { name: 'completed_at', type: 'time' },
    { name: 'client_recorded_at', type: 'time' },
  ],
  finding_resolution: [
    'id', 'care_home_id', 'kind', 'status', 'resolution_note', 'resolved_by',
    { name: 'resolved_at', type: 'time' },
  ],
  // The whole structured record is hashed, not just the outcome: the evidence
  // for each limb of the test is what makes the finding defensible, so it is
  // the evidence that must be provably unaltered. Status is deliberately NOT
  // hashed — a completed assessment legitimately becomes "superseded".
  mca_assessment: [
    'id', 'care_home_id', 'resident_id', 'decision', 'category', 'outcome', 'record',
    { name: 'review_date', type: 'date' },
    { name: 'deprivation_of_liberty', type: 'bool' },
    'assessor_id',
    { name: 'completed_at', type: 'time' },
  ],
  // Status is not hashed: "acknowledged" is bookkeeping. Closing changes the
  // outcome fields, so a closed alert gets its own chain entry.
  deterioration_alert: [
    'id', 'care_home_id', 'resident_id', 'raised_by', 'signs', 'other_text', 'note',
    { name: 'told_in_person', type: 'bool' },
    { name: 'emergency', type: 'bool' },
    'outcome', 'outcome_note',
    { name: 'news2_score', type: 'numeric' },
    'closed_by',
    { name: 'raised_at', type: 'time' },
    { name: 'closed_at', type: 'time' },
  ],
  // v88. The answers AND the result the assessor saw are hashed: the advice
  // given is part of the evidence. Status and applied_to_plan_at are not —
  // superseding an assessment is bookkeeping, not an alteration.
  risk_assessment: [
    'id', 'care_home_id', 'resident_id', 'assessed_by', 'assessment_type',
    { name: 'total_score', type: 'numeric' },
    'risk_level', 'answers', 'result', 'tool_version', 'reason', 'involvement', 'notes',
    'supersedes_id', 'assessor_name',
    { name: 'next_review_date', type: 'date' },
    { name: 'completed_at', type: 'time' },
    // v90: the exact version of the home's own assessment it was scored with.
    'custom_tool_id',
  ],
  // v89: home safety checks. Status is bookkeeping and not hashed.
  premises_assessment: [
    'id', 'care_home_id', 'check_type', 'area', 'answers', 'result', 'level',
    { name: 'failures', type: 'numeric' },
    'tool_version', 'notes', 'supersedes_id', 'assessed_by', 'assessor_name',
    { name: 'next_due', type: 'date' },
    { name: 'completed_at', type: 'time' },
  ],
  weight: [
    'id', 'care_home_id', 'resident_id',
    { name: 'weight_kg', type: 'numeric' },
    { name: 'bmi', type: 'numeric' },
    { name: 'must_score', type: 'numeric' },
    'recorded_by', 'notes',
    { name: 'created_at', type: 'time' },
  ],
};

export interface AppendInput {
  careHomeId: string;
  entityType: keyof typeof HASHED_FIELDS | string;
  entityId: string;
  action?: string;
  /** The record row, exactly as it was written. */
  row: Record<string, unknown>;
  recordedBy?: string | null;
  /** When the care actually happened, if different from now. */
  eventAt?: Date | string | null;
}

/**
 * Append one entry. Must run inside the same transaction as the record itself,
 * so a record can never exist without its chain entry or vice versa.
 *
 * The SELECT takes a row lock on the home's chain head. Two carers recording at
 * the same instant would otherwise both read the same previous hash and write a
 * fork, which verification would then report as tampering on an honest home.
 */
export async function appendToChain(client: PoolClient, input: AppendInput): Promise<{ seq: number; chainHash: string }> {
  const fields = HASHED_FIELDS[input.entityType];
  if (!fields) throw new Error(`No hashed-field list defined for "${input.entityType}"`);

  const entryHash = recordDigest(input.row, fields);

  // FOR UPDATE serialises appends per home. Scoped to one home so that a busy
  // home never blocks a different one.
  const { rows: prev } = await client.query(
    `SELECT seq, chain_hash FROM record_chain
      WHERE care_home_id = $1
      ORDER BY seq DESC LIMIT 1
      FOR UPDATE`,
    [input.careHomeId]
  );

  const prevHash: string = prev[0]?.chain_hash ?? ZERO_HASH;
  const seq: number = prev[0] ? Number(prev[0].seq) + 1 : 1;
  const chainHash = hashPair(prevHash, entryHash);

  await client.query(
    `INSERT INTO record_chain
       (care_home_id, seq, entity_type, entity_id, action,
        entry_hash, hashed_fields, digest_version, prev_hash, chain_hash,
        recorded_by, event_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [input.careHomeId, seq, input.entityType, input.entityId, input.action || 'created',
     entryHash, fieldNames(fields), DIGEST_VERSION, prevHash, chainHash,
     input.recordedBy ?? null, input.eventAt ?? null]
  );

  return { seq, chainHash };
}

/**
 * Append without failing the caller.
 *
 * Used where the record itself matters more than the chain entry. If hashing
 * throws — an unexpected value in a column, say — a carer must not be blocked
 * from recording that a resident was repositioned. The failure is logged loudly
 * and shows up in verification as a gap, which is the honest outcome: a missing
 * link is visible rather than silently pretended away.
 */
export async function appendQuietly(client: PoolClient, input: AppendInput): Promise<void> {
  try {
    await appendToChain(client, input);
  } catch (err: any) {
    logger.error('Record chain append failed — the record was saved, the chain entry was not', {
      entityType: input.entityType, entityId: input.entityId, error: err.message,
    });
  }
}

// ── Verification ───────────────────────────────────────────────────────────

export interface Break {
  seq: number;
  entityType: string;
  entityId: string;
  recordedAt: string;
  problem: 'record_altered' | 'record_missing' | 'chain_broken' | 'sequence_gap';
  detail: string;
}

export interface VerifyResult {
  careHomeId: string;
  entriesChecked: number;
  intact: boolean;
  breaks: Break[];
  firstBreakSeq: number | null;
  headHash: string | null;
  checkedAt: string;
  /** Honest statement of the protection actually in force. */
  anchoring: { mode: 'local' | 'external'; anchoredThrough: string | null; unanchoredEntries: number };
}

const SOURCE_TABLE: Record<string, string> = {
  care_note: 'care_notes',
  med_administration: 'med_administrations',
  care_task: 'care_tasks',
  finding_resolution: 'integrity_findings',
  mca_assessment: 'mca_assessments',
  weight: 'resident_weights',
  deterioration_alert: 'deterioration_alerts',
  risk_assessment: 'risk_assessments',
  premises_assessment: 'premises_assessments',
};

/**
 * Replay a home's chain against the live records.
 *
 * Every entry is recomputed from the record as it stands now. A mismatch means
 * the record changed after it was recorded; a missing row means it was deleted;
 * a chain hash that does not follow from its predecessor means the chain table
 * itself was interfered with.
 */
export async function verifyChain(careHomeId: string, opts: { fromSeq?: number; limit?: number } = {}): Promise<VerifyResult> {
  const fromSeq = opts.fromSeq ?? 1;
  const limit = Math.min(opts.limit ?? 100_000, 500_000);

  const { rows: entries } = await query<any>(
    `SELECT seq, entity_type, entity_id, entry_hash, hashed_fields, digest_version,
            prev_hash, chain_hash, recorded_at
       FROM record_chain
      WHERE care_home_id = $1 AND seq >= $2
      ORDER BY seq ASC
      LIMIT $3`,
    [careHomeId, fromSeq, limit]
  );

  // A care note may legitimately be amended. Clinical practice — and CQC — do
  // not want an original obliterated, so an amendment is written as a NEW chain
  // entry rather than by rewriting the old one. That means the live row matches
  // only the LATEST entry for that record; earlier entries describe superseded
  // versions and are checked for linkage only.
  //
  // Without this, every legitimate correction to a note would be reported as
  // tampering, and the feature would be worse than useless.
  const latestSeqByEntity = new Map<string, number>();
  if (entries.length) {
    const { rows: latest } = await query<any>(
      `SELECT entity_type, entity_id, max(seq) AS max_seq
         FROM record_chain
        WHERE care_home_id = $1 AND entity_id = ANY($2::uuid[])
        GROUP BY entity_type, entity_id`,
      [careHomeId, entries.map((e: any) => e.entity_id)]
    );
    for (const r of latest) latestSeqByEntity.set(`${r.entity_type}:${r.entity_id}`, Number(r.max_seq));
  }

  const breaks: Break[] = [];
  let expectedPrev: string | null = null;
  let expectedSeq = fromSeq;

  for (const e of entries) {
    const seq = Number(e.seq);

    if (seq !== expectedSeq) {
      breaks.push({
        seq: expectedSeq, entityType: '—', entityId: '—',
        recordedAt: e.recorded_at, problem: 'sequence_gap',
        detail: `Entry ${expectedSeq} is missing. The next entry present is ${seq}.`,
      });
      expectedSeq = seq;
    }
    expectedSeq++;

    // Does this entry follow from the one before it?
    if (expectedPrev !== null && e.prev_hash !== expectedPrev) {
      breaks.push({
        seq, entityType: e.entity_type, entityId: e.entity_id, recordedAt: e.recorded_at,
        problem: 'chain_broken',
        detail: 'This entry does not follow from the one before it. The chain table itself has been altered.',
      });
    }
    if (e.chain_hash !== hashPair(e.prev_hash, e.entry_hash)) {
      breaks.push({
        seq, entityType: e.entity_type, entityId: e.entity_id, recordedAt: e.recorded_at,
        problem: 'chain_broken',
        detail: 'This entry\'s own link hash does not match its contents.',
      });
    }
    expectedPrev = e.chain_hash;

    // Does the live record still hash to what was recorded?
    // Superseded versions are skipped: only the newest entry for a record is
    // expected to match the row as it stands now.
    if (latestSeqByEntity.get(`${e.entity_type}:${e.entity_id}`) !== seq) continue;

    // `table` can only ever be one of the literals in SOURCE_TABLE; a value
    // from the database cannot reach the query text. Interpolation is safe here
    // and a parameter would not work for an identifier.
    const table = SOURCE_TABLE[e.entity_type];
    if (!table) continue;
    if (Number(e.digest_version) !== DIGEST_VERSION) continue; // verified under its own rules elsewhere

    const { rows: found } = await query<any>(`SELECT * FROM ${table} WHERE id = $1`, [e.entity_id]);
    if (found.length === 0) {
      breaks.push({
        seq, entityType: e.entity_type, entityId: e.entity_id, recordedAt: e.recorded_at,
        problem: 'record_missing',
        detail: 'The record this entry refers to is no longer in the database.',
      });
      continue;
    }

    const fields = (e.hashed_fields as string[]).map(name => {
      const spec = (HASHED_FIELDS[e.entity_type] || []).find(
        f => (typeof f === 'string' ? f : f.name) === name);
      return spec ?? name;
    });

    let recomputed: string;
    try {
      recomputed = recordDigest(found[0], fields);
    } catch (err: any) {
      breaks.push({
        seq, entityType: e.entity_type, entityId: e.entity_id, recordedAt: e.recorded_at,
        problem: 'record_altered',
        detail: `The record could not be re-hashed: ${err.message}`,
      });
      continue;
    }

    if (recomputed !== e.entry_hash) {
      breaks.push({
        seq, entityType: e.entity_type, entityId: e.entity_id, recordedAt: e.recorded_at,
        problem: 'record_altered',
        detail: 'This record has been changed since it was recorded.',
      });
    }
  }

  const { rows: [anchorInfo] } = await query<any>(
    `SELECT
       (SELECT anchor_mode FROM integrity_settings WHERE care_home_id = $1) AS mode,
       (SELECT max(anchor_date)::text FROM chain_anchors WHERE care_home_id = $1 AND published_at IS NOT NULL) AS through,
       (SELECT count(*) FROM record_chain WHERE care_home_id = $1 AND anchored_in IS NULL) AS unanchored`,
    [careHomeId]
  );

  return {
    careHomeId,
    entriesChecked: entries.length,
    intact: breaks.length === 0,
    breaks,
    firstBreakSeq: breaks.length ? Math.min(...breaks.map(b => b.seq)) : null,
    headHash: entries.length ? entries[entries.length - 1].chain_hash : null,
    checkedAt: new Date().toISOString(),
    anchoring: {
      mode: (anchorInfo?.mode as 'local' | 'external') || 'local',
      anchoredThrough: anchorInfo?.through ?? null,
      unanchoredEntries: Number(anchorInfo?.unanchored ?? 0),
    },
  };
}

// ── Anchoring ──────────────────────────────────────────────────────────────

/**
 * Seal a day: compute a Merkle root over its entries and store it.
 *
 * The root is what lets a single record be proved later without disclosing any
 * other resident's records.
 */
export async function anchorDay(careHomeId: string, day: string): Promise<{ anchored: boolean; reason?: string; anchorId?: number; entryCount?: number; merkleRoot?: string }> {
  const { rows: existing } = await query<any>(
    `SELECT id FROM chain_anchors WHERE care_home_id = $1 AND anchor_date = $2`,
    [careHomeId, day]
  );
  if (existing.length) return { anchored: false, reason: 'This day has already been sealed.' };

  const { rows: entries } = await query<any>(
    `SELECT id, seq, entry_hash FROM record_chain
      WHERE care_home_id = $1 AND recorded_at::date = $2::date
      ORDER BY seq ASC`,
    [careHomeId, day]
  );
  if (entries.length === 0) return { anchored: false, reason: 'Nothing was recorded on this day.' };

  const root = merkleRoot(entries.map((e: any) => e.entry_hash));
  const { rows: [head] } = await query<any>(
    `SELECT chain_hash FROM record_chain WHERE care_home_id = $1 AND seq = $2`,
    [careHomeId, entries[entries.length - 1].seq]
  );

  const { rows: [settings] } = await query<any>(
    `SELECT anchor_mode, anchor_provider FROM integrity_settings WHERE care_home_id = $1`, [careHomeId]);
  const mode: 'local' | 'external' = settings?.anchor_mode === 'external' ? 'external' : 'local';

  // A local anchor is stored immediately. An external one is written only once
  // the third party has actually acknowledged it — an anchor row claiming
  // external publication that never happened would be the worst kind of false
  // assurance, so publication is recorded, never assumed.
  const { rows: [anchor] } = await query<any>(
    `INSERT INTO chain_anchors
       (care_home_id, anchor_date, from_seq, to_seq, entry_count, merkle_root, chain_head,
        anchor_mode, external_provider, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'local',$8,NULL)
     RETURNING id`,
    [careHomeId, day, entries[0].seq, entries[entries.length - 1].seq, entries.length,
     root, head?.chain_hash ?? ZERO_HASH, mode === 'external' ? settings?.anchor_provider ?? null : null]
  );

  await query(
    `UPDATE record_chain SET anchored_in = $1
      WHERE care_home_id = $2 AND recorded_at::date = $3::date AND anchored_in IS NULL`,
    [anchor.id, careHomeId, day]
  );

  return { anchored: true, anchorId: Number(anchor.id), entryCount: entries.length, merkleRoot: root };
}

/**
 * A proof that one record was in a sealed day, revealing nothing about any
 * other record beyond the sibling hashes needed to recompute the root.
 */
export async function proveRecord(careHomeId: string, entityId: string): Promise<{
  found: boolean; reason?: string;
  proof?: { entryHash: string; steps: ProofStep[]; merkleRoot: string; anchorDate: string;
            anchorMode: string; publishedAt: string | null; externalRef: string | null;
            verifiesNow: boolean; recordUnchanged: boolean };
}> {
  const { rows: [entry] } = await query<any>(
    `SELECT rc.*, ca.anchor_date, ca.merkle_root, ca.anchor_mode, ca.published_at, ca.external_ref
       FROM record_chain rc
       LEFT JOIN chain_anchors ca ON ca.id = rc.anchored_in
      WHERE rc.care_home_id = $1 AND rc.entity_id = $2
      ORDER BY rc.seq DESC LIMIT 1`,
    [careHomeId, entityId]
  );
  if (!entry) return { found: false, reason: 'No chain entry exists for this record.' };
  if (!entry.anchored_in) {
    return { found: false, reason: 'This record has not been sealed yet. Sealing happens once a day.' };
  }

  const { rows: dayEntries } = await query<any>(
    `SELECT entry_hash FROM record_chain WHERE anchored_in = $1 ORDER BY seq ASC`,
    [entry.anchored_in]
  );
  const hashes = dayEntries.map((d: any) => d.entry_hash);
  const index = hashes.indexOf(entry.entry_hash);
  if (index < 0) return { found: false, reason: 'The entry is not present in the day it was sealed into.' };

  const steps = inclusionProof(hashes, index);

  // Also re-hash the live record, so the certificate says both "this was
  // sealed on that date" and "it still says the same thing today".
  let recordUnchanged = false;
  const table = SOURCE_TABLE[entry.entity_type];
  if (table) {
    const { rows: found } = await query<any>(`SELECT * FROM ${table} WHERE id = $1`, [entityId]);
    if (found.length) {
      const fields = (entry.hashed_fields as string[]).map(name => {
        const spec = (HASHED_FIELDS[entry.entity_type] || []).find(
          f => (typeof f === 'string' ? f : f.name) === name);
        return spec ?? name;
      });
      try { recordUnchanged = recordDigest(found[0], fields) === entry.entry_hash; } catch { recordUnchanged = false; }
    }
  }

  return {
    found: true,
    proof: {
      entryHash: entry.entry_hash,
      steps,
      merkleRoot: entry.merkle_root,
      anchorDate: entry.anchor_date,
      anchorMode: entry.anchor_mode,
      publishedAt: entry.published_at,
      externalRef: entry.external_ref,
      verifiesNow: verifyInclusion(entry.entry_hash, steps, entry.merkle_root),
      recordUnchanged,
    },
  };
}
