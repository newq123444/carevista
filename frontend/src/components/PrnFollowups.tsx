// ────────────────────────────────────────────────────────────────────────────
// "Did it work?" — follow-ups for "as required" (PRN) doses.
//
// Shown at the top of the eMAR and on the carer's simple home screen. A dose
// of pain relief given at two o'clock is only half a record until someone has
// written down, an hour later, whether the pain eased.
// ────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { usePrnFollowups, useRecordPrnEffect } from '../hooks';
import { useNow } from '../hooks/useShiftTasks';
import { prnState, prnStateText, sortFollowups } from '../utils/prnFollowup';
import { useLang } from '../i18n';

const OUTCOMES: { key: string; label: string; icon: string; fg: string; bg: string; border: string }[] = [
  { key: 'effective',        label: 'It worked',        icon: '✅', fg: '#15803d', bg: '#f0fdf4', border: '#86efac' },
  { key: 'partly_effective', label: 'Partly',           icon: '➖', fg: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  { key: 'not_effective',    label: 'No effect',        icon: '❌', fg: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
  { key: 'unable_to_assess', label: "Couldn't tell",    icon: '❔', fg: '#475569', bg: '#f8fafc', border: '#cbd5e1' },
];
const NEEDS_NOTE = new Set(['not_effective', 'unable_to_assess']);

const TONE = {
  waiting: { fg: '#475569', bg: '#f1f5f9' },
  due:     { fg: '#92400e', bg: '#fef3c7' },
  late:    { fg: '#b91c1c', bg: '#fee2e2' },
};

/**
 * @param onlyActionable  hide doses still inside their first hour (simple home)
 */
export function PrnFollowups({ onlyActionable = false }: { onlyActionable?: boolean }) {
  const { t: tr } = useLang();
  const now = useNow();
  const { data } = usePrnFollowups();
  const rows = sortFollowups(Array.isArray(data) ? data : [], now)
    .filter((r: any) => !onlyActionable || prnState(r.created_at, now).state !== 'waiting');
  if (rows.length === 0) return null;

  return (
    <section aria-label={tr('As-required doses to check')} style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>💊 {tr('Did it work?')}</h2>
      <p style={{ margin: '0 0 10px', fontSize: 14.5, color: 'var(--text-secondary)' }}>
        {tr('"As required" doses given today. Check about an hour after the dose and record what you saw.')}
      </p>
      {rows.map((r: any) => <FollowupCard key={r.id} r={r} now={now} />)}
    </section>
  );
}

function FollowupCard({ r, now }: { r: any; now: Date }) {
  const { t: tr } = useLang();
  const record = useRecordPrnEffect();
  const [outcome, setOutcome] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const s = prnState(r.created_at, now);
  const tone = TONE[s.state];
  const given = new Date(r.created_at);
  const givenAt = `${String(given.getHours()).padStart(2, '0')}:${String(given.getMinutes()).padStart(2, '0')}`;
  const noteNeeded = !!outcome && NEEDS_NOTE.has(outcome);
  const canSave = !!outcome && (!noteNeeded || note.trim().length >= 3) && !record.isPending;

  return (
    <div className="card" style={{ padding: 14, marginBottom: 10, borderLeft: `6px solid ${tone.fg}` }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{r.resident_name}</span>
        {r.room_number && <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{tr('Room')} {r.room_number}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: tone.bg, color: tone.fg }}>
          {prnStateText(r.created_at, now)}
        </span>
      </div>
      <div style={{ fontSize: 15.5, margin: '6px 0 2px' }}>
        <strong>{r.medication_name}</strong>{r.dose_given ? ` ${r.dose_given}` : ''} {tr('at')} {givenAt}
      </div>
      <div style={{ fontSize: 14.5, color: 'var(--text-secondary)', marginBottom: 10 }}>
        {tr('For')}: {r.prn_reason || tr('reason not recorded')} · {tr('given by')} {r.given_by_name}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {OUTCOMES.map(o => (
          <button key={o.key} type="button" onClick={() => setOutcome(o.key)} aria-pressed={outcome === o.key}
            style={{
              minHeight: 64, borderRadius: 14, cursor: 'pointer', fontSize: 16, fontWeight: 700,
              border: `2px solid ${outcome === o.key ? o.fg : o.border}`,
              background: outcome === o.key ? o.bg : '#fff', color: o.fg,
            }}>
            <span aria-hidden>{o.icon}</span> {tr(o.label)}
          </button>
        ))}
      </div>

      {outcome && (
        <div style={{ marginTop: 10 }}>
          <label style={{ display: 'block', fontSize: 14.5, fontWeight: 600, marginBottom: 4 }}>
            {outcome === 'not_effective' ? tr('What did you see, and what have you done? (a nurse will be told)')
              : outcome === 'unable_to_assess' ? tr('Why could you not tell?')
              : tr('What did you see? (optional)')}
          </label>
          <textarea className="form-input" rows={2} value={note} onChange={e => setNote(e.target.value)}
            style={{ width: '100%', fontSize: 16 }}
            placeholder={outcome === 'effective' ? tr('e.g. Settled, says the pain has gone') : ''} />
          <button type="button" disabled={!canSave}
            onClick={() => record.mutate({ id: r.id, outcome: outcome!, note: note.trim() || undefined })}
            style={{
              width: '100%', minHeight: 64, marginTop: 8, borderRadius: 14, border: 'none', cursor: canSave ? 'pointer' : 'not-allowed',
              background: canSave ? '#4f46e5' : '#c7d2fe', color: '#fff', fontSize: 17, fontWeight: 700,
            }}>
            {record.isPending ? tr('Saving…') : tr('Save')}
          </button>
        </div>
      )}
    </div>
  );
}
