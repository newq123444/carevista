// ────────────────────────────────────────────────────────────────────────────
// Writing a care note safely when two people may be writing at once.
//
// The duplicate check and the insert happen inside ONE transaction, holding a
// lock on that resident's notes (a Postgres advisory lock, released when the
// transaction ends). Before v89b the check ran, then the insert ran: two
// carers pressing Save in the same second both passed the check and both
// notes went in. Now the second waits for the first to finish, then sees it.
//
// Used by POST /care-notes and by completing a task with its note
// (POST /tasks/:id/complete with `note`), so the round, the resident page and
// the notes screen all follow the same rule.
// ────────────────────────────────────────────────────────────────────────────
import type { PoolClient } from 'pg';
import { appendQuietly } from './recordChain';
import { isLikelyDuplicate, MAX_WINDOW_MINUTES, describeDuplicate, type NoteLike } from '../utils/duplicateRules';

/** Serialise note-writing for one resident until this transaction ends. */
export async function lockResidentNotes(client: PoolClient, residentId: string): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended('care_note:' || $1::text, 0))`, [residentId]);
}

export interface DuplicateConflict {
  error: string;
  conflict: 'possible_duplicate';
  existingNote: { id: string; content: string; noteType: string; authorName: string | null; createdAt: string; minutesAgo: number; byMe: boolean };
  canSaveAnyway: true;
}

/**
 * The most recent note that is probably the same care, around the time the
 * new care happened (the phone's time for an offline note), or null.
 * Call after lockResidentNotes, in the same transaction.
 */
export async function findDuplicate(client: PoolClient, p: {
  careHomeId: string; residentId: string; userId: string; note: NoteLike; eventAt?: Date | null;
}): Promise<DuplicateConflict | null> {
  const at = p.eventAt || new Date();
  const { rows } = await client.query(
    `SELECT n.id, n.content, n.note_type, n.created_at, n.author_id, n.fluid_intake_ml, n.food_eaten_percent,
            COALESCE(n.client_recorded_at, n.created_at) AS event_at,
            u.first_name || ' ' || u.last_name AS author_name
       FROM care_notes n LEFT JOIN users u ON u.id = n.author_id
      WHERE n.resident_id = $1 AND n.care_home_id = $2 AND n.deleted_at IS NULL AND n.note_type = $3
        AND COALESCE(n.client_recorded_at, n.created_at) BETWEEN $4::timestamptz - ($5 || ' minutes')::interval
                                                             AND $4::timestamptz + ($5 || ' minutes')::interval
      ORDER BY COALESCE(n.client_recorded_at, n.created_at) DESC
      LIMIT 20`,
    [p.residentId, p.careHomeId, p.note.noteType, at.toISOString(), String(MAX_WINDOW_MINUTES)]);
  for (const r of rows) {
    const apart = (at.getTime() - new Date(r.event_at).getTime()) / 60000;
    const existing: NoteLike = {
      noteType: r.note_type,
      fluidIntakeMl: r.fluid_intake_ml === null ? null : Number(r.fluid_intake_ml),
      foodEatenPercent: r.food_eaten_percent === null ? null : Number(r.food_eaten_percent),
    };
    if (!isLikelyDuplicate(p.note, existing, apart)) continue;
    const minutesAgo = Math.max(0, (Date.now() - new Date(r.event_at).getTime()) / 60000);
    const byMe = r.author_id === p.userId;
    return {
      error: describeDuplicate({ authorName: r.author_name, byMe, minutesAgo, noteType: r.note_type }),
      conflict: 'possible_duplicate',
      existingNote: {
        id: r.id, content: r.content, noteType: r.note_type, authorName: r.author_name,
        createdAt: r.created_at, minutesAgo: Math.round(minutesAgo), byMe,
      },
      canSaveAnyway: true,
    };
  }
  return null;
}

export interface NoteFields {
  careHomeId: string; residentId: string; authorId: string; noteType: string; content: string;
  isSignificant?: boolean; isPrivate?: boolean; flagged?: boolean; flagReason?: string | null;
  vitalBpSystolic?: unknown; vitalBpDiastolic?: unknown; vitalHeartRate?: unknown; vitalTemp?: unknown;
  vitalSpo2?: unknown; vitalWeight?: unknown; painScore?: unknown; fluidIntakeMl?: number | null; fluidOutputMl?: unknown;
  foodEatenPercent?: number | null; mood?: unknown; position?: unknown; mealContext?: unknown;
  writtenOnBehalfOfName?: string | null; coAuthorNames?: string[];
  bowelsOpened?: boolean | null; stoolType?: string | null;
  clientRecordedAt?: Date | null; clientRef?: string | null;
}

/** Insert the note and its chain entry. Call inside the caller's transaction. */
export async function insertCareNote(client: PoolClient, f: NoteFields): Promise<any> {
  const { rows: [created] } = await client.query(
    `INSERT INTO care_notes (
      care_home_id, resident_id, author_id, note_type, content,
      is_significant, is_private, flagged, flag_reason,
      vital_bp_systolic, vital_bp_diastolic, vital_heart_rate, vital_temp,
      vital_spo2, vital_weight, pain_score, fluid_intake_ml, fluid_output_ml,
      food_eaten_percent, mood, position,
      meal_context, written_on_behalf_of_name, co_author_names,
      bowels_opened, stool_type, client_recorded_at, client_ref
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
    RETURNING *`,
    [f.careHomeId, f.residentId, f.authorId, f.noteType, f.content,
     f.isSignificant || false, f.isPrivate || false, f.flagged || false, f.flagReason || null,
     f.vitalBpSystolic ?? null, f.vitalBpDiastolic ?? null, f.vitalHeartRate ?? null, f.vitalTemp ?? null,
     f.vitalSpo2 ?? null, f.vitalWeight ?? null, f.painScore ?? null, f.fluidIntakeMl ?? null, f.fluidOutputMl ?? null,
     f.foodEatenPercent ?? null, f.mood ?? null, f.position ?? null,
     f.mealContext || null, f.writtenOnBehalfOfName || null,
     f.coAuthorNames && f.coAuthorNames.length ? JSON.stringify(f.coAuthorNames) : null,
     typeof f.bowelsOpened === 'boolean' ? f.bowelsOpened : null,
     f.stoolType && ['hard', 'normal', 'loose'].includes(f.stoolType) ? f.stoolType : null,
     f.clientRecordedAt || null, f.clientRef || null]);

  await appendQuietly(client, {
    careHomeId: f.careHomeId, entityType: 'care_note', entityId: created.id,
    action: f.clientRecordedAt ? 'created_offline' : 'created', row: created, recordedBy: f.authorId,
    // When the care happened, as best known: the late-entry check looks at
    // the gap to recorded_at, so an offline note is visible as one.
    eventAt: created.client_recorded_at ?? created.created_at,
  });
  // Whoever has just recorded is no longer "with" the resident.
  await client.query(`DELETE FROM care_presence WHERE resident_id = $1 AND user_id = $2`, [f.residentId, f.authorId]);
  return created;
}
