// ────────────────────────────────────────────────────────────────────────────
// Mental capacity — the register.
//
// Every decision-specific assessment in the home, what was found, and when it
// is due for review. Overdue reviews and deprivations of liberty come first,
// because those are the ones that go wrong quietly.
// ────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMcaList, useMcaRegister, useCreateMca, useResidents } from '../hooks';
import { useAuthStore } from '../store/auth.store';
import { PrintHeader, PrintButton } from '../components/PrintHeader';
import { formatDate } from '../utils/formatters';
import { CATEGORY_LABELS, OUTCOME_LABELS, DECISION_EXAMPLES } from '../constants/mcaContent';

const OUTCOME_TONE: Record<string, { bg: string; fg: string }> = {
  has_capacity:     { bg: '#f0fdf4', fg: '#15803d' },
  lacks_capacity:   { bg: '#eef2ff', fg: '#3730a3' },
  cannot_determine: { bg: '#fffbeb', fg: '#92400e' },
};
const CAN_ASSESS = ['registered_nurse', 'senior_carer', 'home_manager', 'deputy_manager', 'super_admin', 'group_admin', 'admin'];

export default function MentalCapacity() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const canAssess = CAN_ASSESS.includes(user?.role || '');
  const [status, setStatus] = useState<string>('current');
  const [residentId, setResidentId] = useState('');
  const [starting, setStarting] = useState(false);

  const reg = useMcaRegister();
  const list = useMcaList({
    residentId: residentId || undefined,
    status: status === 'current' ? 'completed' : status === 'all' ? undefined : status,
  });
  const { data: residents } = useResidents();

  const rows = useMemo(() => {
    const arr = Array.isArray(list.data) ? list.data : [];
    // Overdue reviews first, then deprivations of liberty, then newest.
    return [...arr].sort((a: any, b: any) =>
      (Number(!!b.review_overdue) - Number(!!a.review_overdue)) ||
      (Number(!!b.deprivation_of_liberty) - Number(!!a.deprivation_of_liberty)) ||
      String(b.created_at).localeCompare(String(a.created_at)));
  }, [list.data]);

  const r = reg.data || {};

  return (
    <div className="page" style={{ maxWidth: 900, margin: '0 auto' }}>
      <PrintHeader title="Mental capacity register" />
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">🧠 Mental Capacity</h1>
          <p className="page-subtitle" style={{ maxWidth: 620 }}>
            Decision-specific assessments under the Mental Capacity Act 2005. Everyone is presumed to have
            capacity; an assessment is for one decision, at one time, when there is a reason to doubt it.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <PrintButton />
          {canAssess && (
            <button className="btn btn-primary no-print" style={{ minHeight: 48 }} onClick={() => setStarting(true)}>
              + New assessment
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        <Stat n={r.overdue} label="reviews overdue" tone={r.overdue ? '#b91c1c' : undefined} />
        <Stat n={r.dueSoon} label="due in 30 days" tone={r.dueSoon ? '#b45309' : undefined} />
        <Stat n={r.deprivations} label="deprivations of liberty" tone={r.deprivations ? '#3730a3' : undefined} />
        <Stat n={r.current} label="current findings" />
        <Stat n={r.drafts} label="drafts in progress" />
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {([['current', 'Current'], ['draft', 'Drafts'], ['superseded', 'Superseded'], ['all', 'All']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)} style={{
            minHeight: 44, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
            border: `1.5px solid ${status === k ? '#4f46e5' : 'var(--border)'}`,
            background: status === k ? '#eef2ff' : '#fff', color: status === k ? '#3730a3' : 'var(--text-secondary)',
            fontWeight: status === k ? 700 : 500, fontSize: 14.5,
          }}>{label}</button>
        ))}
        <select className="form-input" value={residentId} onChange={e => setResidentId(e.target.value)}
          style={{ width: 'auto', minHeight: 44 }}>
          <option value="">All residents</option>
          {(residents || []).map((x: any) => (
            <option key={x.id} value={x.id}>{x.first_name} {x.last_name}</option>
          ))}
        </select>
      </div>

      {list.isLoading ? <p>Loading…</p> : rows.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>No assessments here</p>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {status === 'current'
              ? 'No completed assessments yet. That is fine — capacity is presumed until there is a reason to doubt it.'
              : 'Nothing matches these filters.'}
          </p>
        </div>
      ) : rows.map((a: any) => {
        const tone = OUTCOME_TONE[a.outcome] || { bg: '#f1f5f9', fg: '#475569' };
        return (
          <button key={a.id} onClick={() => nav(`/mca/${a.id}`)} className="card" style={{
            width: '100%', textAlign: 'left', cursor: 'pointer', padding: 16, marginBottom: 10,
            borderLeft: `5px solid ${a.review_overdue ? '#dc2626' : a.status === 'draft' ? '#94a3b8' : tone.fg}`,
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>{a.resident_name}</span>
              {a.room_number && <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>Room {a.room_number}</span>}
              <span style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                background: a.status === 'draft' ? '#f1f5f9' : tone.bg, color: a.status === 'draft' ? '#475569' : tone.fg }}>
                {a.status === 'draft' ? 'Draft' : a.status === 'superseded' ? 'Superseded' : OUTCOME_LABELS[a.outcome] || a.outcome}
              </span>
            </div>
            <div style={{ fontSize: 15.5, lineHeight: 1.4, marginBottom: 6 }}>{a.decision}</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)' }}>
              <span>{CATEGORY_LABELS[a.category] || a.category}</span>
              {a.completed_at && <span>Assessed {formatDate(a.completed_at)} by {a.assessor_name}</span>}
              {a.review_date && (
                <span style={{ color: a.review_overdue ? '#b91c1c' : undefined, fontWeight: a.review_overdue ? 700 : 400 }}>
                  {a.review_overdue ? 'Review overdue — ' : 'Review '}{formatDate(a.review_date)}
                </span>
              )}
              {a.deprivation_of_liberty && <span style={{ color: '#3730a3', fontWeight: 600 }}>Deprivation of liberty</span>}
              {a.review_in_progress && <span style={{ color: '#b45309' }}>Review in progress</span>}
            </div>
          </button>
        );
      })}

      {starting && <StartDialog residents={residents || []} onClose={() => setStarting(false)}
        onStarted={(id: string) => nav(`/mca/${id}`)} />}
    </div>
  );
}

function Stat({ n, label, tone }: { n: any; label: string; tone?: string }) {
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: tone || 'var(--text-primary, #111827)', lineHeight: 1.1 }}>{Number(n || 0)}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

function StartDialog({ residents, onClose, onStarted }: any) {
  const create = useCreateMca();
  const [residentId, setResidentId] = useState('');
  const [decision, setDecision] = useState('');
  const [category, setCategory] = useState('care_and_support');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header"><h3 style={{ margin: 0 }}>New capacity assessment</h3></div>
        <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            One assessment is for one decision. If you need to assess more than one, start one for each.
          </p>
          <div className="form-group">
            <label className="form-label">Who is it about?</label>
            <select className="form-input" value={residentId} onChange={e => setResidentId(e.target.value)} style={{ minHeight: 48 }}>
              <option value="">Choose a resident…</option>
              {residents.map((x: any) => <option key={x.id} value={x.id}>{x.first_name} {x.last_name}{x.room_number ? ` — Room ${x.room_number}` : ''}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">What kind of decision?</label>
            <select className="form-input" value={category} onChange={e => setCategory(e.target.value)} style={{ minHeight: 48 }}>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">The decision, in one sentence</label>
            <textarea className="form-input" rows={2} value={decision} onChange={e => setDecision(e.target.value)}
              placeholder="Whether to…" style={{ fontSize: 16 }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
              For example: {DECISION_EXAMPLES.slice(0, 2).map(x => `"${x}"`).join(' or ')}.
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!residentId || create.isPending}
            onClick={() => create.mutate({ residentId, decision, category } as any,
              { onSuccess: (d: any) => onStarted(d.id) })}>
            {create.isPending ? 'Starting…' : 'Start'}
          </button>
        </div>
      </div>
    </div>
  );
}
