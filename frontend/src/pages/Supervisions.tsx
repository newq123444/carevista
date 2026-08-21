import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useSupervisionMatrix, useSupervisions, useCreateSupervision, useUpdateSupervision, useMySupervisions } from '../hooks';
import { useAuthStore } from '../store/auth.store';

// Staff supervision and appraisal (CQC Regulation 18).
// The matrix is the point: who is due, who is overdue, and who has never had
// one. A list of past sessions does not answer any of those.

function fmtDate(d?: string | null) {
  if (!d) return 'Never';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const MANAGER_ROLES = ['home_manager', 'deputy_manager', 'super_admin', 'group_admin', 'admin'];

function Kpi({ label, value, tone, note }: { label: string; value: React.ReactNode; tone?: string; note?: string }) {
  return (
    <div className="card"><div className="card-body" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</div>
      <div style={{ fontSize: '1.9rem', fontWeight: 700, color: tone || '#0f172a', marginTop: 4 }}>{value}</div>
      {note && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{note}</div>}
    </div></div>
  );
}

export default function Supervisions() {
  const { t: tr } = useLang();
  const { user } = useAuthStore();
  const isManager = MANAGER_ROLES.includes((user as any)?.role || '');
  const [tab, setTab] = useState<'matrix' | 'sessions' | 'mine'>(isManager ? 'matrix' : 'mine');
  const [addFor, setAddFor] = useState<any>(null);
  const [form, setForm] = useState<any>({
    staffId: '', sessionType: 'supervision', sessionDate: '', status: 'completed',
    whatIsGoingWell: '', areasToDevelop: '', trainingIdentified: '', wellbeingCheck: '',
    concernsRaised: '', agreedActions: '', staffComments: '', nextSessionDue: '',
  });

  const { data: matrix } = useSupervisionMatrix();
  const { data: sessions } = useSupervisions();
  const { data: mine } = useMySupervisions();
  const create = useCreateSupervision();
  const update = useUpdateSupervision();

  const staff: any[] = matrix?.staff || [];
  const sessionList: any[] = Array.isArray(sessions) ? sessions : [];
  const myList: any[] = Array.isArray(mine) ? mine : [];
  const types: any[] = matrix?.sessionTypes || [];

  function openFor(s: any) {
    setAddFor(s);
    setForm({
      staffId: s.staffId, sessionType: 'supervision', sessionDate: new Date().toISOString().slice(0, 10),
      status: 'completed', whatIsGoingWell: '', areasToDevelop: '', trainingIdentified: '',
      wellbeingCheck: '', concernsRaised: '', agreedActions: '', staffComments: '', nextSessionDue: '',
    });
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{tr('Supervision & Appraisal')}</h1>
        <p className="page-subtitle">
          Regulation 18 requires every member of staff to receive supervision and appraisal. This is the record of it.
        </p>
      </div>

      {isManager && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
          <Kpi label="Up to date" value={matrix?.compliancePercent != null ? `${matrix.compliancePercent}%` : '—'}
            tone={(matrix?.compliancePercent || 0) >= 90 ? '#059669' : '#b45309'}
            note={matrix ? `target: every ${matrix.targetDays} days` : undefined} />
          <Kpi label="Overdue" value={matrix?.overdue ?? '—'} tone={(matrix?.overdue || 0) > 0 ? '#b45309' : '#059669'} />
          <Kpi label="Never supervised" value={matrix?.neverSupervised ?? '—'} tone={(matrix?.neverSupervised || 0) > 0 ? '#b91c1c' : '#059669'} />
          <Kpi label="Appraisal overdue" value={matrix?.appraisalOverdue ?? '—'} tone={(matrix?.appraisalOverdue || 0) > 0 ? '#b45309' : '#059669'} note="none in 12 months" />
          <Kpi label="Team size" value={matrix?.totalStaff ?? '—'} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 18, flexWrap: 'wrap' }}>
        {(isManager
          ? [['matrix', 'Who is due'], ['sessions', 'All sessions'], ['mine', 'My record']]
          : [['mine', 'My record']]
        ).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === k ? '3px solid #4f46e5' : '3px solid transparent',
            color: tab === k ? '#4f46e5' : '#64748b', fontWeight: tab === k ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'matrix' && (
        <div className="card">
          {staff.length === 0 ? (
            <div className="card-body table-empty">No active staff records found.</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Staff</th><th>Role</th><th>Last supervision</th><th>Days since</th><th>Sessions (12m)</th><th>Appraisal</th><th></th></tr></thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s.staffId} style={{ background: s.neverSupervised ? '#fef2f2' : s.overdue ? '#fffbeb' : undefined }}>
                      <td style={{ fontWeight: 500 }}>{s.staffName}</td>
                      <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{String(s.role || '').replace(/_/g, ' ')}</td>
                      <td>{fmtDate(s.lastSession)}</td>
                      <td style={{ color: s.overdue ? '#b91c1c' : '#64748b', fontWeight: s.overdue ? 600 : 400 }}>
                        {s.daysSinceLast ?? '—'}{s.neverSupervised ? ' (never)' : ''}
                      </td>
                      <td>{s.sessions12m}</td>
                      <td style={{ color: s.appraisalOverdue ? '#b45309' : '#059669', fontSize: '0.85rem' }}>
                        {s.appraisalOverdue ? 'Overdue' : 'Done'}
                      </td>
                      <td><button className="btn btn-primary btn-sm" onClick={() => openFor(s)}>Record session</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'sessions' && (
        <div className="card">
          {sessionList.length === 0 ? (
            <div className="card-body table-empty">No sessions recorded yet.</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Date</th><th>Staff</th><th>Type</th><th>Supervisor</th><th>Signed</th><th>Next due</th></tr></thead>
                <tbody>
                  {sessionList.map(s => (
                    <tr key={s.id}>
                      <td>{fmtDate(s.sessionDate)}</td>
                      <td style={{ fontWeight: 500 }}>{s.staffName}</td>
                      <td>{s.sessionTypeLabel}</td>
                      <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{s.supervisorName || '—'}</td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {s.supervisorSigned ? 'Supervisor ✓' : 'Supervisor —'}<br />
                        <span style={{ color: s.staffSigned ? '#059669' : '#b45309' }}>
                          {s.staffSigned ? 'Staff ✓' : 'Awaiting staff'}
                        </span>
                      </td>
                      <td>{fmtDate(s.nextSessionDue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'mine' && (
        <div>
          {myList.length === 0 ? (
            <div className="card"><div className="card-body table-empty">
              You have no supervision records yet. If it has been more than three months, ask your manager.
            </div></div>
          ) : myList.map(s => (
            <div className="card" key={s.id} style={{ marginBottom: 12 }}>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                  <strong>{fmtDate(s.sessionDate)}</strong>
                  <span style={{ background: '#eef2ff', color: '#4338ca', padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600 }}>
                    {s.sessionTypeLabel}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#94a3b8' }}>with {s.supervisorName || '—'}</span>
                </div>
                <div style={{ display: 'grid', gap: 10, fontSize: '0.9rem' }}>
                  {s.whatIsGoingWell && <div><strong>Going well:</strong> {s.whatIsGoingWell}</div>}
                  {s.areasToDevelop && <div><strong>To develop:</strong> {s.areasToDevelop}</div>}
                  {s.trainingIdentified && <div><strong>Training:</strong> {s.trainingIdentified}</div>}
                  {s.agreedActions && <div><strong>Agreed actions:</strong> {s.agreedActions}</div>}
                </div>
                {!s.staffSigned && (
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} disabled={update.isPending}
                    onClick={() => update.mutate({ id: s.id, data: { staffSign: true, staffComments: s.staffComments } } as any)}>
                    I agree this is an accurate record — sign
                  </button>
                )}
                {s.staffSigned && <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#059669' }}>You signed this record.</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {addFor && (
        <div className="modal-overlay" onClick={() => setAddFor(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Supervision — {addFor.staffName}</span>
              <button className="modal-close" onClick={() => setAddFor(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-input" value={form.sessionType} onChange={e => setForm({ ...form, sessionType: e.target.value })}>
                    {types.map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input className="form-input" type="date" value={form.sessionDate} onChange={e => setForm({ ...form, sessionDate: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">What is going well</label>
                <textarea className="form-input" rows={3} value={form.whatIsGoingWell} onChange={e => setForm({ ...form, whatIsGoingWell: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Areas to develop</label>
                <textarea className="form-input" rows={3} value={form.areasToDevelop} onChange={e => setForm({ ...form, areasToDevelop: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Training identified</label>
                <input className="form-input" value={form.trainingIdentified} onChange={e => setForm({ ...form, trainingIdentified: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">How are they doing</label>
                <textarea className="form-input" rows={2} value={form.wellbeingCheck}
                  placeholder="Workload, wellbeing, anything outside work affecting them."
                  onChange={e => setForm({ ...form, wellbeingCheck: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Concerns raised by them</label>
                <textarea className="form-input" rows={2} value={form.concernsRaised}
                  placeholder="Including anything they have raised about the care of residents."
                  onChange={e => setForm({ ...form, concernsRaised: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Agreed actions</label>
                <textarea className="form-input" rows={2} value={form.agreedActions} onChange={e => setForm({ ...form, agreedActions: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Next session due</label>
                <input className="form-input" type="date" value={form.nextSessionDue} onChange={e => setForm({ ...form, nextSessionDue: e.target.value })} />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', background: '#f8fafc', padding: '8px 12px', borderRadius: 6 }}>
                {addFor.staffName} will be asked to sign this in their own record. You cannot sign on their behalf.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAddFor(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={create.isPending}
                onClick={() => create.mutate(form as any, { onSuccess: () => setAddFor(null) })}>
                {create.isPending ? 'Saving…' : 'Save session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
