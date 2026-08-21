import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useLibertySummary, useLibertyProtections, useCreateLibertyProtection, useUpdateLibertyProtection, useResidents } from '../hooks';

// DoLS authorisations and the restrictions register.
// An expired authorisation is an unlawful deprivation of liberty, and a
// restriction with no recorded lawful basis is the finding that most often
// turns into an enforcement action. Both are surfaced first.

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const CONSENT_LABELS: Record<string, string> = {
  resident_consent: 'The person consented',
  best_interests: 'Best interests decision',
  dols_authorised: 'Authorised under DoLS',
  court_authorised: 'Authorised by the Court of Protection',
  lpa_consent: 'Consented by an attorney (LPA)',
};

const DOLS_LABELS: Record<string, string> = {
  not_applied: 'Not applied for', urgent_in_place: 'Urgent authorisation in place',
  standard_applied: 'Standard applied for', granted: 'Granted', expired: 'Expired',
  refused: 'Refused', withdrawn: 'Withdrawn',
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

export default function DolsRegister() {
  const { t: tr } = useLang();
  const [tab, setTab] = useState<'dols' | 'restriction'>('dols');
  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [work, setWork] = useState<any>({});
  const [form, setForm] = useState<any>({
    residentId: '', recordType: 'dols', dolsStatus: 'standard_applied', appliedDate: '',
    urgentExpiry: '', grantedFrom: '', grantedUntil: '', supervisoryBody: '', referenceNumber: '',
    conditions: '', representativeName: '', representativeContact: '',
    restrictionType: 'bed_rails', description: '', reason: '', lessRestrictiveConsidered: '',
    consentBasis: '', authorisedBy: '', familyConsulted: false, gpConsulted: false,
    startDate: '', reviewFrequencyDays: 90,
  });

  const { data: summary } = useLibertySummary();
  const { data: items } = useLibertyProtections({ recordType: tab });
  const { data: residents } = useResidents();
  const create = useCreateLibertyProtection();
  const update = useUpdateLibertyProtection();

  const list: any[] = Array.isArray(items) ? items : [];
  const residentList: any[] = Array.isArray(residents) ? residents : [];
  const restrictionTypes: any[] = summary?.restrictionTypes || [];

  function openDetail(r: any) {
    setDetail(r);
    setWork({
      dolsStatus: r.dolsStatus || '', grantedFrom: r.grantedFrom || '', grantedUntil: r.grantedUntil || '',
      conditions: r.conditions || '', representativeName: r.representativeName || '',
      consentBasis: r.consentBasis || '', reviewNotes: '', recordReview: false, active: r.active,
    });
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">{tr('DoLS & Restrictions')}</h1>
          <p className="page-subtitle">
            Every authorisation and every restriction on a person's liberty — with its reason, its lawful basis, and when it must be reviewed.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ ...form, recordType: tab }); setAddOpen(true); }}>
          {tab === 'dols' ? 'Record a DoLS' : 'Record a restriction'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <Kpi label="DoLS in force" value={summary?.dolsInForce ?? '—'} />
        <Kpi label="Awaiting decision" value={summary?.dolsAwaiting ?? '—'} tone={(summary?.dolsAwaiting || 0) > 0 ? '#b45309' : undefined} />
        <Kpi label="Expired" value={summary?.dolsExpired ?? '—'} tone={(summary?.dolsExpired || 0) > 0 ? '#b91c1c' : '#059669'} note="unlawful if still restricted" />
        <Kpi label="Expiring in 28 days" value={summary?.dolsExpiring ?? '—'} tone={(summary?.dolsExpiring || 0) > 0 ? '#b45309' : undefined} />
        <Kpi label="Restrictions in place" value={summary?.restrictionsActive ?? '—'} />
        <Kpi label="No lawful basis" value={summary?.restrictionsWithoutLawfulBasis ?? '—'}
          tone={(summary?.restrictionsWithoutLawfulBasis || 0) > 0 ? '#b91c1c' : '#059669'} />
      </div>

      {(summary?.dolsExpired || 0) > 0 && (
        <div className="card" style={{ marginBottom: 16, background: '#fef2f2', borderLeft: '4px solid #ef4444' }}>
          <div className="card-body" style={{ padding: '12px 18px', color: '#991b1b' }}>
            {summary?.dolsExpired} authorisation{summary?.dolsExpired === 1 ? ' has' : 's have'} expired.
            If the person is still being deprived of their liberty, that is unlawful now — reapply today.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 18 }}>
        {([['dols', 'DoLS authorisations'], ['restriction', 'Restrictions register']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === k ? '3px solid #4f46e5' : '3px solid transparent',
            color: tab === k ? '#4f46e5' : '#64748b', fontWeight: tab === k ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="card-body table-empty">
            {tab === 'dols'
              ? 'No DoLS records. If any resident cannot leave and is under continuous supervision, they need one.'
              : 'No restrictions recorded. Bed rails, lap belts, locked doors and covert medication all belong here.'}
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Resident</th>
                  {tab === 'dols' ? <><th>Status</th><th>In force</th><th>Supervisory body</th><th>Representative</th></>
                    : <><th>Restriction</th><th>Lawful basis</th><th>Started</th><th>Consulted</th></>}
                  <th>Review</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map(r => (
                  <tr key={r.id} style={{ background: (r.authorisationExpired || r.missingLawfulBasis) ? '#fef2f2' : undefined }}>
                    <td style={{ fontWeight: 500 }}>{r.residentName}<div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Room {r.roomNumber}</div></td>
                    {tab === 'dols' ? (
                      <>
                        <td>{DOLS_LABELS[r.dolsStatus] || r.dolsStatus || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap', color: r.authorisationExpired ? '#b91c1c' : r.expiringSoon ? '#b45309' : undefined, fontWeight: (r.authorisationExpired || r.expiringSoon) ? 600 : 400 }}>
                          {r.grantedFrom ? `${fmtDate(r.grantedFrom)} – ${fmtDate(r.grantedUntil)}` : '—'}
                          {r.authorisationExpired && <div style={{ fontSize: '0.72rem' }}>EXPIRED</div>}
                          {r.expiringSoon && !r.authorisationExpired && <div style={{ fontSize: '0.72rem' }}>Expiring soon</div>}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>{r.supervisoryBody || '—'}</td>
                        <td style={{ fontSize: '0.85rem' }}>{r.representativeName || <span style={{ color: '#b45309' }}>None named</span>}</td>
                      </>
                    ) : (
                      <>
                        <td>{r.restrictionLabel}<div style={{ fontSize: '0.78rem', color: '#94a3b8', maxWidth: 220 }}>{r.reason}</div></td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {r.consentBasis ? CONSENT_LABELS[r.consentBasis] : <span style={{ color: '#b91c1c', fontWeight: 600 }}>Not recorded</span>}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.startDate)}</td>
                        <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {[r.familyConsulted && 'Family', r.gpConsulted && 'GP'].filter(Boolean).join(', ') || '—'}
                        </td>
                      </>
                    )}
                    <td style={{ whiteSpace: 'nowrap', color: r.reviewOverdue ? '#b91c1c' : undefined, fontWeight: r.reviewOverdue ? 600 : 400 }}>
                      {fmtDate(r.nextReviewDate)}{r.reviewOverdue ? ' — overdue' : ''}
                    </td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => openDetail(r)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && (
        <div className="modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{form.recordType === 'dols' ? 'Record a DoLS' : 'Record a restriction'}</span>
              <button className="modal-close" onClick={() => setAddOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Resident</label>
                <select className="form-input" value={form.residentId} onChange={e => setForm({ ...form, residentId: e.target.value })}>
                  <option value="">Choose a resident…</option>
                  {residentList.map(r => (
                    <option key={r.id} value={r.id}>{r.first_name || r.firstName} {r.last_name || r.lastName} — Room {r.room_number || r.roomNumber}</option>
                  ))}
                </select>
              </div>

              {form.recordType === 'dols' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Where is it up to</label>
                    <select className="form-input" value={form.dolsStatus} onChange={e => setForm({ ...form, dolsStatus: e.target.value })}>
                      {Object.entries(DOLS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Applied on</label>
                      <input className="form-input" type="date" value={form.appliedDate} onChange={e => setForm({ ...form, appliedDate: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Urgent authorisation expires</label>
                      <input className="form-input" type="date" value={form.urgentExpiry} onChange={e => setForm({ ...form, urgentExpiry: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Granted from</label>
                      <input className="form-input" type="date" value={form.grantedFrom} onChange={e => setForm({ ...form, grantedFrom: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Granted until</label>
                      <input className="form-input" type="date" value={form.grantedUntil} onChange={e => setForm({ ...form, grantedUntil: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Supervisory body</label>
                      <input className="form-input" placeholder="e.g. Surrey County Council" value={form.supervisoryBody}
                        onChange={e => setForm({ ...form, supervisoryBody: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Reference</label>
                      <input className="form-input" value={form.referenceNumber} onChange={e => setForm({ ...form, referenceNumber: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Conditions attached</label>
                    <textarea className="form-input" rows={3} value={form.conditions}
                      placeholder="Conditions are binding. Write them out in full."
                      onChange={e => setForm({ ...form, conditions: e.target.value })} />
                  </div>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Relevant person's representative</label>
                      <input className="form-input" value={form.representativeName} onChange={e => setForm({ ...form, representativeName: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Their contact</label>
                      <input className="form-input" value={form.representativeContact} onChange={e => setForm({ ...form, representativeContact: e.target.value })} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">What is the restriction</label>
                    <select className="form-input" value={form.restrictionType} onChange={e => setForm({ ...form, restrictionType: e.target.value })}>
                      {restrictionTypes.map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Describe it</label>
                    <input className="form-input" placeholder="e.g. Both bed rails raised overnight" value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Why is it needed</label>
                    <textarea className="form-input" rows={3} value={form.reason}
                      onChange={e => setForm({ ...form, reason: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">What less restrictive options were considered</label>
                    <textarea className="form-input" rows={2} value={form.lessRestrictiveConsidered}
                      placeholder="e.g. Ultra-low bed and crash mat tried for two weeks — resident still rolled out."
                      onChange={e => setForm({ ...form, lessRestrictiveConsidered: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lawful basis</label>
                    <select className="form-input" value={form.consentBasis} onChange={e => setForm({ ...form, consentBasis: e.target.value })}>
                      <option value="">Choose…</option>
                      {Object.entries(CONSENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Authorised by</label>
                    <input className="form-input" value={form.authorisedBy} onChange={e => setForm({ ...form, authorisedBy: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="checkbox" checked={form.familyConsulted} onChange={e => setForm({ ...form, familyConsulted: e.target.checked })} />
                      Family consulted
                    </label>
                    <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="checkbox" checked={form.gpConsulted} onChange={e => setForm({ ...form, gpConsulted: e.target.checked })} />
                      GP consulted
                    </label>
                  </div>
                </>
              )}

              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Started</label>
                  <input className="form-input" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Review every (days)</label>
                  <input className="form-input" type="number" value={form.reviewFrequencyDays}
                    onChange={e => setForm({ ...form, reviewFrequencyDays: Number(e.target.value) })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={create.isPending}
                onClick={() => create.mutate(form as any, { onSuccess: () => setAddOpen(false) })}>
                {create.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="modal-overlay" onClick={() => setDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{detail.residentName} — {detail.recordType === 'dols' ? 'DoLS' : detail.restrictionLabel}</span>
              <button className="modal-close" onClick={() => setDetail(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              {detail.recordType === 'dols' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-input" value={work.dolsStatus} onChange={e => setWork({ ...work, dolsStatus: e.target.value })}>
                      {Object.entries(DOLS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Granted from</label>
                      <input className="form-input" type="date" value={work.grantedFrom || ''} onChange={e => setWork({ ...work, grantedFrom: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Granted until</label>
                      <input className="form-input" type="date" value={work.grantedUntil || ''} onChange={e => setWork({ ...work, grantedUntil: e.target.value })} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Conditions</label>
                    <textarea className="form-input" rows={3} value={work.conditions} onChange={e => setWork({ ...work, conditions: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Representative</label>
                    <input className="form-input" value={work.representativeName} onChange={e => setWork({ ...work, representativeName: e.target.value })} />
                  </div>
                </>
              ) : (
                <>
                  <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: '0.88rem' }}>
                    <div><strong>Reason:</strong> {detail.reason || '—'}</div>
                    <div style={{ marginTop: 6 }}><strong>Less restrictive options considered:</strong> {detail.lessRestrictiveConsidered || 'Not recorded'}</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Lawful basis</label>
                    <select className="form-input" value={work.consentBasis} onChange={e => setWork({ ...work, consentBasis: e.target.value })}>
                      <option value="">Choose…</option>
                      {Object.entries(CONSENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </>
              )}

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input type="checkbox" checked={!!work.recordReview} onChange={e => setWork({ ...work, recordReview: e.target.checked })} />
                  I am recording a review today
                </label>
                <textarea className="form-input" rows={3} placeholder="Review notes — is this still needed, and still the least restrictive option?"
                  value={work.reviewNotes} onChange={e => setWork({ ...work, reviewNotes: e.target.value })} />
              </div>

              <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#b91c1c' }}>
                <input type="checkbox" checked={work.active === false} onChange={e => setWork({ ...work, active: !e.target.checked })} />
                This is no longer in place (say why in the notes above)
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Cancel</button>
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
