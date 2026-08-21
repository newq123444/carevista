import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useFeedbackSummary, useFeedbackList, useCreateFeedback, useUpdateFeedback, useResidents } from '../hooks';

// Complaints, concerns and compliments — CQC Regulation 16.
// Two statutory clocks: acknowledge within 3 working days, respond within 28.
// Both are shown as overdue counts rather than buried in a list.

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TYPE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  complaint:  { bg: '#fee2e2', fg: '#991b1b', label: 'Complaint' },
  concern:    { bg: '#fef3c7', fg: '#92400e', label: 'Concern' },
  compliment: { bg: '#d1fae5', fg: '#065f46', label: 'Compliment' },
  suggestion: { bg: '#dbeafe', fg: '#1e40af', label: 'Suggestion' },
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open', investigating: 'Being looked into', responded: 'Responded',
  closed: 'Closed', escalated: 'Escalated',
};

function Kpi({ label, value, tone, note }: { label: string; value: React.ReactNode; tone?: string; note?: string }) {
  return (
    <div className="card"><div className="card-body" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</div>
      <div style={{ fontSize: '1.9rem', fontWeight: 700, color: tone || '#0f172a', marginTop: 4 }}>{value}</div>
      {note && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{note}</div>}
    </div></div>
  );
}

export default function ComplaintsCompliments() {
  const { t: tr } = useLang();
  const [filter, setFilter] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState<any>({
    feedbackType: 'complaint', receivedVia: 'verbal', raisedByName: '', raisedByRelationship: '',
    raisedByContact: '', anonymous: false, residentId: '', category: 'care_quality',
    summary: '', detail: '', severity: 'low', safeguardingRaised: false,
  });
  const [work, setWork] = useState<any>({});

  const { data: summary } = useFeedbackSummary();
  const { data: items } = useFeedbackList(filter ? { type: filter } : undefined);
  const { data: residents } = useResidents();
  const create = useCreateFeedback();
  const update = useUpdateFeedback();

  const list: any[] = Array.isArray(items) ? items : [];
  const residentList: any[] = Array.isArray(residents) ? residents : [];
  const categories: any[] = summary?.categories || [];
  const themes: any[] = summary?.themes || [];

  function openDetail(f: any) {
    setDetail(f);
    setWork({
      status: f.status, category: f.category || 'care_quality', severity: f.severity,
      investigationNotes: f.investigationNotes || '', responseSummary: f.responseSummary || '',
      outcome: f.outcome || '', actionsTaken: f.actionsTaken || '',
      lessonsLearned: f.lessonsLearned || '', sharedWithTeam: !!f.sharedWithTeam,
      escalatedTo: f.escalatedTo || '', cqcNotified: !!f.cqcNotified,
    });
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">{tr('Complaints & Compliments')}</h1>
          <p className="page-subtitle">
            Everything raised about the home, and what changed as a result. Acknowledge within 3 working days, respond within 28.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>Log something</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <Kpi label="Open complaints" value={summary?.openComplaints ?? '—'} tone={(summary?.openComplaints || 0) > 0 ? '#b45309' : '#059669'} />
        <Kpi label="Not acknowledged" value={summary?.acknowledgementOverdue ?? '—'} tone={(summary?.acknowledgementOverdue || 0) > 0 ? '#b91c1c' : '#059669'} note="over 3 days" />
        <Kpi label="Response overdue" value={summary?.responseOverdue ?? '—'} tone={(summary?.responseOverdue || 0) > 0 ? '#b91c1c' : '#059669'} note="over 28 days" />
        <Kpi label="Complaints (12m)" value={summary?.complaints12m ?? '—'} />
        <Kpi label="Compliments (12m)" value={summary?.compliments12m ?? '—'} tone="#059669" />
        <Kpi label="Avg response" value={summary?.avgResponseDays != null ? `${summary.avgResponseDays}d` : '—'} />
      </div>

      {themes.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">What people raise most (last 12 months)</span></div>
          <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {themes.map((t: any) => (
              <span key={t.category} style={{ background: '#f1f5f9', padding: '6px 12px', borderRadius: 8, fontSize: '0.85rem' }}>
                {t.label} <strong style={{ marginLeft: 4 }}>{t.count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 18, flexWrap: 'wrap' }}>
        {[{ k: '', label: 'Everything' }, { k: 'complaint', label: 'Complaints' }, { k: 'concern', label: 'Concerns' },
          { k: 'compliment', label: 'Compliments' }, { k: 'suggestion', label: 'Suggestions' }].map(t => (
          <button key={t.k} onClick={() => setFilter(t.k)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: filter === t.k ? '3px solid #4f46e5' : '3px solid transparent',
            color: filter === t.k ? '#4f46e5' : '#64748b', fontWeight: filter === t.k ? 600 : 400,
          }}>{t.label}</button>
        ))}
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="card-body table-empty">
            Nothing logged yet. A register with no compliments in it is as odd as one with no complaints.
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Ref</th><th>Received</th><th>Type</th><th>About</th><th>Summary</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {list.map(f => {
                  const t = TYPE_STYLE[f.feedbackType] || TYPE_STYLE.complaint;
                  return (
                    <tr key={f.id} style={{ background: (f.acknowledgementOverdue || f.responseOverdue) ? '#fef2f2' : undefined }}>
                      <td style={{ fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>{f.reference}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {fmtDate(f.receivedDate)}
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{f.daysOpen}d ago</div>
                      </td>
                      <td><span style={{ background: t.bg, color: t.fg, padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600 }}>{t.label}</span></td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {f.categoryLabel}
                        {f.residentName && <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{f.residentName}</div>}
                      </td>
                      <td style={{ maxWidth: 280, fontSize: '0.87rem' }}>{f.summary}</td>
                      <td>
                        {STATUS_LABEL[f.status] || f.status}
                        {f.acknowledgementOverdue && <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600 }}>Not acknowledged</div>}
                        {f.responseOverdue && <div style={{ fontSize: '0.72rem', color: '#b91c1c', fontWeight: 600 }}>Response overdue</div>}
                      </td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => openDetail(f)}>Open</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && (
        <div className="modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Log feedback</span>
              <button className="modal-close" onClick={() => setAddOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">What is it</label>
                  <select className="form-input" value={form.feedbackType} onChange={e => setForm({ ...form, feedbackType: e.target.value })}>
                    <option value="complaint">Complaint</option>
                    <option value="concern">Concern</option>
                    <option value="compliment">Compliment</option>
                    <option value="suggestion">Suggestion</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">How did it come in</label>
                  <select className="form-input" value={form.receivedVia} onChange={e => setForm({ ...form, receivedVia: e.target.value })}>
                    <option value="verbal">In conversation</option>
                    <option value="in_person">In person, formally</option>
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="letter">Letter</option>
                    <option value="survey">Survey</option>
                    <option value="portal">Family portal</option>
                    <option value="anonymous">Anonymously</option>
                  </select>
                </div>
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={form.anonymous} onChange={e => setForm({ ...form, anonymous: e.target.checked })} />
                Raised anonymously
              </label>
              {!form.anonymous && (
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Raised by</label>
                    <input className="form-input" value={form.raisedByName} onChange={e => setForm({ ...form, raisedByName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Relationship</label>
                    <input className="form-input" placeholder="e.g. Daughter, resident, staff" value={form.raisedByRelationship}
                      onChange={e => setForm({ ...form, raisedByRelationship: e.target.value })} />
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">About a resident (optional)</label>
                <select className="form-input" value={form.residentId} onChange={e => setForm({ ...form, residentId: e.target.value })}>
                  <option value="">Not about a specific resident</option>
                  {residentList.map(r => (
                    <option key={r.id} value={r.id}>{r.first_name || r.firstName} {r.last_name || r.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {categories.map((c: any) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">In one line</label>
                <input className="form-input" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">What was said</label>
                <textarea className="form-input" rows={4} value={form.detail}
                  placeholder="Use their words where you can."
                  onChange={e => setForm({ ...form, detail: e.target.value })} />
              </div>
              {form.feedbackType !== 'compliment' && (
                <>
                  <div className="form-group">
                    <label className="form-label">How serious</label>
                    <select className="form-input" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={form.safeguardingRaised}
                      onChange={e => setForm({ ...form, safeguardingRaised: e.target.checked })} />
                    This raises a safeguarding concern
                  </label>
                  {form.safeguardingRaised && (
                    <div style={{ fontSize: '0.8rem', color: '#991b1b', background: '#fef2f2', padding: '8px 12px', borderRadius: 6 }}>
                      Raise a safeguarding alert with the local authority as well as logging this. Do not wait for the complaint process.
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={create.isPending}
                onClick={() => create.mutate(form as any, { onSuccess: () => { setAddOpen(false); setForm({ ...form, summary: '', detail: '', raisedByName: '' }); } })}>
                {create.isPending ? 'Saving…' : 'Log it'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{detail.reference} — {detail.categoryLabel}</span>
              <button className="modal-close" onClick={() => setDetail(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
              <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{detail.summary}</div>
                <div style={{ whiteSpace: 'pre-wrap', color: '#475569', fontSize: '0.9rem' }}>{detail.detail || 'No further detail recorded.'}</div>
                <div style={{ marginTop: 10, fontSize: '0.8rem', color: '#64748b' }}>
                  Raised by {detail.raisedByName || 'unknown'}{detail.raisedByRelationship ? ` (${detail.raisedByRelationship})` : ''} on {fmtDate(detail.receivedDate)}
                  {detail.responseDue ? ` · response due ${fmtDate(detail.responseDue)}` : ''}
                </div>
              </div>

              {!detail.acknowledgedAt && detail.feedbackType !== 'compliment' && (
                <button className="btn btn-secondary btn-sm" style={{ justifySelf: 'start' }}
                  onClick={() => update.mutate({ id: detail.id, data: { acknowledge: true, status: 'investigating' } } as any,
                    { onSuccess: () => setDetail(null) })}>
                  Acknowledge to the person who raised it
                </button>
              )}

              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={work.status} onChange={e => setWork({ ...work, status: e.target.value })}>
                  <option value="open">Open</option>
                  <option value="investigating">Being looked into</option>
                  <option value="responded">Responded</option>
                  <option value="escalated">Escalated</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">What we found</label>
                <textarea className="form-input" rows={3} value={work.investigationNotes}
                  onChange={e => setWork({ ...work, investigationNotes: e.target.value })} />
              </div>
              {detail.feedbackType !== 'compliment' && (
                <div className="form-group">
                  <label className="form-label">Outcome</label>
                  <select className="form-input" value={work.outcome} onChange={e => setWork({ ...work, outcome: e.target.value })}>
                    <option value="">Not decided yet</option>
                    <option value="upheld">Upheld</option>
                    <option value="partially_upheld">Partially upheld</option>
                    <option value="not_upheld">Not upheld</option>
                    <option value="not_applicable">Not applicable</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">What we did about it</label>
                <textarea className="form-input" rows={3} value={work.actionsTaken}
                  onChange={e => setWork({ ...work, actionsTaken: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">What we learned</label>
                <textarea className="form-input" rows={2} value={work.lessonsLearned}
                  placeholder="This is the part inspectors read."
                  onChange={e => setWork({ ...work, lessonsLearned: e.target.value })} />
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={work.sharedWithTeam}
                  onChange={e => setWork({ ...work, sharedWithTeam: e.target.checked })} />
                Shared with the team
              </label>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Escalated to</label>
                  <input className="form-input" placeholder="e.g. Local Government Ombudsman" value={work.escalatedTo}
                    onChange={e => setWork({ ...work, escalatedTo: e.target.value })} />
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 26 }}>
                  <input type="checkbox" checked={work.cqcNotified}
                    onChange={e => setWork({ ...work, cqcNotified: e.target.checked })} />
                  CQC notified
                </label>
              </div>
              {!detail.responded_at && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={!!work.markResponded}
                    onChange={e => setWork({ ...work, markResponded: e.target.checked })} />
                  We have now responded to the person who raised it
                </label>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
              <button className="btn btn-primary" disabled={update.isPending}
                onClick={() => update.mutate({ id: detail.id, data: work } as any, { onSuccess: () => setDetail(null) })}>
                {update.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
