import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Shown when two members of staff are about to do — or record — the same care.
//
// Care homes run on parallel work: several carers, one corridor, shared
// residents. Nothing in software can stop two people walking into the same
// room, but it can make sure neither of them is surprised, and that the record
// afterwards says what actually happened once rather than twice.
// ─────────────────────────────────────────────────────────────────────────────

export type Conflict = {
  /** 'in_progress' | 'already_completed' | 'possible_duplicate' */
  conflict: string;
  error: string;
  holderName?: string | null;
  heldMinutes?: number | null;
  completedByName?: string | null;
  minutesAgo?: number | null;
  taskName?: string | null;
  residentName?: string | null;
  canTakeOver?: boolean;
  canSaveAnyway?: boolean;
  existingNote?: {
    id: string;
    content: string;
    noteType: string;
    authorName: string | null;
    createdAt: string;
    minutesAgo: number;
    byMe: boolean;
  } | null;
};

/** Pull a conflict payload out of an axios error, or null if it isn't one. */
export function asConflict(err: any): Conflict | null {
  const d = err?.response?.data;
  if (err?.response?.status === 409 && d?.conflict) return d as Conflict;
  return null;
}

const TITLES: Record<string, string> = {
  in_progress: 'Someone else is doing this',
  already_completed: 'This has already been done',
  possible_duplicate: 'This may already be recorded',
  handled_in_emar: 'Medicines are recorded on the MAR chart',
};

const TONES: Record<string, string> = {
  in_progress: '#d97706',
  already_completed: '#dc2626',
  possible_duplicate: '#d97706',
  handled_in_emar: '#0d9488',
};

export function ConflictDialog({ conflict, onCancel, onProceed, proceedLabel, busy }: {
  conflict: Conflict;
  onCancel: () => void;
  /** Omit to show an acknowledge-only dialog. */
  onProceed?: () => void;
  proceedLabel?: string;
  busy?: boolean;
}) {
  const tone = TONES[conflict.conflict] || '#d97706';
  const note = conflict.existingNote;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <span className="modal-title" style={{ color: tone }}>
            {TITLES[conflict.conflict] || 'Please check'}
          </span>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{conflict.error}</p>

          {note && (
            <div style={{ background: 'var(--surface-2, #f8fafc)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginBottom: 6 }}>
                {note.byMe ? 'You wrote' : `${note.authorName || 'Someone'} wrote`}
                {' '}
                {note.minutesAgo < 1 ? 'less than a minute ago' : note.minutesAgo === 1 ? '1 minute ago' : `${note.minutesAgo} minutes ago`}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{note.content}</div>
            </div>
          )}

          {conflict.conflict === 'possible_duplicate' && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
              If this is the same care, cancel — it is already recorded. Save a second note only if
              something different happened.
            </p>
          )}
          {conflict.conflict === 'handled_in_emar' && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
              A tick on the task board is not a medicines record and cannot stand in for one.
              Open Medications and sign the MAR for each dose.
            </p>
          )}
          {conflict.conflict === 'in_progress' && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #64748b)' }}>
              Taking over will remove it from their screen. Only do that if you know they have stopped.
            </p>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            {onProceed ? 'Cancel' : 'OK'}
          </button>
          {onProceed && (
            <button className="btn btn-primary" onClick={onProceed} disabled={busy}
              style={{ background: tone, borderColor: tone }}>
              {busy ? 'Working…' : (proceedLabel || 'Continue anyway')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConflictDialog;
