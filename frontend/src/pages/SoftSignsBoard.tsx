// ────────────────────────────────────────────────────────────────────────────
// Soft signs — what carers have noticed, for the nurse in charge.
//
// Newest and emergencies first. Each one shows how long it has waited, so
// "raised 40 minutes ago, nobody has looked" is impossible to miss. Closing
// one needs what was found and done, and suggests NEWS2 first.
// ────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeteriorationAlerts, useAcknowledgeDeterioration, useCloseDeterioration } from '../hooks';
import { useNow } from '../hooks/useShiftTasks';
import { useAuthStore } from '../store/auth.store';
import { SIGN_LABEL, EMERGENCY_KEYS, OUTCOMES } from '../constants/softSigns';
import { formatDate } from '../utils/formatters';

const CAN_RESPOND = ['registered_nurse', 'senior_carer', 'home_manager', 'deputy_manager', 'super_admin', 'group_admin', 'admin'];
const OUTCOME_LABEL = Object.fromEntries(OUTCOMES);

const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const waited = (iso: string, now: Date) => {
  const m = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

export default function SoftSignsBoard() {
  const nav = useNavigate();
  const now = useNow();
  const { user } = useAuthStore();
  const canRespond = CAN_RESPOND.includes(user?.role || '');
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const { data, isLoading } = useDeteriorationAlerts(tab);
  const rows: any[] = Array.isArray(data) ? data : [];

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '4px 4px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: '0 0 2px' }}>Soft signs</h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)', maxWidth: 560 }}>
            When someone who knows a resident says they are not themselves. Go and see them, take observations
            (NEWS2), and record what you found.
          </p>
        </div>
        <button className="btn btn-secondary" style={{ minHeight: 48 }} onClick={() => nav('/something-different')}>+ Raise one</button>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['open', 'closed'] as const).map(k => (
          <button key={k} onClick={() => setTab(k)} style={{
            minHeight: 48, padding: '0 18px', borderRadius: 999, cursor: 'pointer', fontSize: 15,
            border: `1.5px solid ${tab === k ? '#4f46e5' : 'var(--border)'}`,
            background: tab === k ? '#eef2ff' : '#fff', color: tab === k ? '#3730a3' : 'var(--text-secondary)', fontWeight: tab === k ? 700 : 500,
          }}>{k === 'open' ? `Open${tab === 'open' ? ` (${rows.length})` : ''}` : 'Closed (30 days)'}</button>
        ))}
      </div>

      {isLoading ? <p>Loading…</p> : rows.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>✅</div>
          <p style={{ fontSize: 17, fontWeight: 600, margin: '6px 0 0' }}>{tab === 'open' ? 'Nothing waiting' : 'Nothing closed in the last 30 days'}</p>
        </div>
      ) : rows.map(a => <AlertCard key={a.id} a={a} now={now} canRespond={canRespond} />)}
    </div>
  );
}

function AlertCard({ a, now, canRespond }: { a: any; now: Date; canRespond: boolean }) {
  const nav = useNavigate();
  const ack = useAcknowledgeDeterioration();
  const close = useCloseDeterioration();
  const [closing, setClosing] = useState(false);
  const [outcome, setOutcome] = useState('');
  const [outcomeNote, setNote] = useState('');
  const [news2, setNews2] = useState('');

  const isOpen = a.status !== 'closed';
  const slow = isOpen && !a.acknowledged_at && (now.getTime() - new Date(a.raised_at).getTime()) > 15 * 60000;
  const edge = a.emergency ? '#b91c1c' : slow ? '#dc2626' : a.status === 'open' ? '#d97706' : a.status === 'acknowledged' ? '#4f46e5' : '#94a3b8';

  return (
    <div className="card" style={{ padding: 14, marginBottom: 10, borderLeft: `6px solid ${edge}` }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <button onClick={() => nav(`/residents/${a.resident_id}`)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 18, fontWeight: 700, color: 'inherit', minHeight: 44 }}>
          {a.resident_name}
        </button>
        {a.room_number && <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Room {a.room_number}</span>}
        {a.emergency && <span style={{ fontSize: 12.5, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: '#b91c1c', color: '#fff' }}>EMERGENCY SIGNS</span>}
        <span style={{ marginLeft: 'auto', fontSize: 13.5, fontWeight: 700, color: slow ? '#b91c1c' : 'var(--text-secondary)' }}>
          {isOpen ? (a.acknowledged_at ? `Being looked at by ${a.acknowledged_by_name}` : `Waiting ${waited(a.raised_at, now)}`)
                  : `Closed ${formatDate(a.closed_at)}`}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '8px 0' }}>
        {(a.signs || []).map((k: string) => (
          <span key={k} style={{ fontSize: 14, padding: '4px 10px', borderRadius: 999,
            background: EMERGENCY_KEYS.has(k) ? '#fef2f2' : '#f1f5f9', color: EMERGENCY_KEYS.has(k) ? '#b91c1c' : '#334155',
            fontWeight: EMERGENCY_KEYS.has(k) ? 700 : 500 }}>
            {k === 'other' ? a.other_text : SIGN_LABEL[k] || k}
          </span>
        ))}
      </div>
      {a.note && <p style={{ margin: '0 0 6px', fontSize: 15, lineHeight: 1.45 }}>“{a.note}”</p>}
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
        Raised by {a.raised_by_name} at {hhmm(a.raised_at)} ·{' '}
        {a.told_in_person ? 'told someone in person' : <strong style={{ color: '#b91c1c' }}>had not told anyone in person</strong>}
      </div>

      {!isOpen && (
        <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--surface-2, #f8fafc)', fontSize: 14.5 }}>
          <strong>{OUTCOME_LABEL[a.outcome] || a.outcome}</strong>{a.news2_score != null ? ` · NEWS2 ${a.news2_score}` : ''} — {a.outcome_note}
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>by {a.closed_by_name}</div>
        </div>
      )}

      {isOpen && canRespond && !closing && (
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {!a.acknowledged_at && (
            <button className="btn btn-primary" style={{ minHeight: 48 }} disabled={ack.isPending} onClick={() => ack.mutate(a.id)}>
              I'm going to see them
            </button>
          )}
          <button className="btn btn-secondary" style={{ minHeight: 48 }} onClick={() => nav(`/news2?resident=${a.resident_id}`)}>Take NEWS2</button>
          <button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => setClosing(true)}>Record outcome</button>
        </div>
      )}

      {closing && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
          <select className="form-input" value={outcome} onChange={e => setOutcome(e.target.value)} style={{ minHeight: 48 }}>
            <option value="">What happened?</option>
            {OUTCOMES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="form-input" type="number" min={0} max={20} value={news2} onChange={e => setNews2(e.target.value)}
            placeholder="NEWS2 score (if taken)" style={{ minHeight: 48 }} />
          <textarea className="form-input" rows={2} value={outcomeNote} onChange={e => setNote(e.target.value)}
            placeholder="What you found and what you did" />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ minHeight: 48 }}
              disabled={!outcome || outcomeNote.trim().length < 3 || close.isPending}
              onClick={() => close.mutate({ id: a.id, outcome, outcomeNote: outcomeNote.trim(), news2Score: news2 === '' ? null : Number(news2) })}>
              Close
            </button>
            <button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => setClosing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
