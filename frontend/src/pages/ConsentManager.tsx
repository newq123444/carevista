// src/pages/ConsentManager.tsx - Digital Consent Manager
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

const categoryIcons: Record<string, string> = { photography: '📸', outings: '🚌', medical: '💊', research: '🔬', dnr: '❤️', other: '📄' };
const categoryLabels: Record<string, string> = { photography: 'Photography', outings: 'Outings & Trips', medical: 'Medical Treatment', research: 'Research', dnr: 'DNR/DNACPR', other: 'Other' };

export default function ConsentManager() {
  const { t } = useLang();
  const [tab, setTab] = useState<'overview' | 'create' | 'expiring'>('overview');
  const [selectedResident, setSelectedResident] = useState('');
  const [form, setForm] = useState({ residentId: '', category: 'medical', description: '', consentGivenBy: '', relationship: '', reviewDate: '', notes: '' });
  const [capacityFor, setCapacityFor] = useState<any>(null);
  const [cap, setCap] = useState({
    impairment: '', understand: '', retain: '', weigh: '', communicate: '',
    supportGiven: '', conclusion: '', bestInterests: '', consulted: '',
  });
  const queryClient = useQueryClient();

  const { data: residents } = useQuery({ queryKey: ['residents'], queryFn: () => api.get('/residents').then(r => r.data?.residents ?? r.data ?? []) });
  const { data: consents, isLoading, isError: isConsentsError } = useQuery({ queryKey: ['consents', selectedResident], queryFn: () => selectedResident ? api.get(`/consents/${selectedResident}`).then(r => r.data) : Promise.resolve([]), enabled: !!selectedResident });
  const { data: expiring, isError: isExpiringError } = useQuery({ queryKey: ['consents-expiring'], queryFn: () => api.get('/consents/expiring/all').then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/consents', data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['consents'] }); queryClient.invalidateQueries({ queryKey: ['consents-expiring'] }); setTab('overview'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/consents/${id}`, data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['consents'] }); queryClient.invalidateQueries({ queryKey: ['consents-expiring'] }); },
  });

  const capacityMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.post(`/consents/${id}/capacity-assessment`, data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['consents'] }); setCapacityFor(null); resetCap(); },
  });

  const resetCap = () => setCap({ impairment: '', understand: '', retain: '', weigh: '', communicate: '', supportGiven: '', conclusion: '', bestInterests: '', consulted: '' });

  // Mental Capacity Act 2005: capacity is decision-specific. A person lacks capacity
  // only if there is an impairment of mind/brain AND they cannot do one or more of
  // the four functional elements (s.2-3 MCA).
  const functional = [cap.understand, cap.retain, cap.weigh, cap.communicate];
  const anyFunctionalFail = functional.includes('no');
  const derivedLacks = cap.impairment === 'yes' && anyFunctionalFail;
  const capComplete = cap.impairment && functional.every(Boolean);

  const submitCapacity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!capacityFor || !capComplete) return;
    const yn = (v: string) => (v === 'yes' ? 'Yes' : v === 'no' ? 'No' : '—');
    const details = [
      `Decision assessed: ${categoryLabels[capacityFor.category] || capacityFor.category}${capacityFor.description ? ' — ' + capacityFor.description : ''}`,
      `Stage 1 (diagnostic) — impairment of mind or brain: ${yn(cap.impairment)}`,
      `Stage 2 (functional) — understand: ${yn(cap.understand)}; retain: ${yn(cap.retain)}; use or weigh: ${yn(cap.weigh)}; communicate: ${yn(cap.communicate)}`,
      cap.supportGiven ? `Practicable support given: ${cap.supportGiven}` : '',
      `Conclusion: ${derivedLacks ? 'Lacks capacity for this decision' : 'Has capacity for this decision'}`,
      cap.conclusion ? `Assessor notes: ${cap.conclusion}` : '',
      derivedLacks && cap.bestInterests ? `Best-interests decision: ${cap.bestInterests}` : '',
      derivedLacks && cap.consulted ? `Consulted: ${cap.consulted}` : '',
    ].filter(Boolean).join('\n');
    capacityMutation.mutate({ id: capacityFor.id, data: { hasCapacity: !derivedLacks, assessmentDetails: details } });
  };

  const handleCreate = (e: React.FormEvent) => { e.preventDefault(); createMutation.mutate(form); };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📝 Digital Consent Manager</h1>
          <p className="page-subtitle">Full digital consent management for all aspects of care</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {([['overview', '📋 Consent Overview'], ['expiring', '⚠️ Expiring'], ['create', '➕ Record Consent']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: `2px solid ${tab === k ? '#7c3aed' : 'transparent'}`, color: tab === k ? '#7c3aed' : 'var(--text-secondary)', fontWeight: tab === k ? 700 : 500, cursor: 'pointer', fontSize: 14, marginBottom: -2 }}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div>
          <div className="card" style={{ padding: 16, marginBottom: 20 }}>
            <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}>
              <option value="">Select a resident to view consents...</option>
              {residents?.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>)}
            </select>
          </div>

          {selectedResident && isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading consents...</div>}
          
          {selectedResident && isConsentsError && (
            <div className="card" style={{ padding: 20, borderLeft: '4px solid #dc2626', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#dc2626' }}>⚠️ Unable to load consents</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>An error occurred while loading consent records. Please try again later.</div>
            </div>
          )}
          
          {selectedResident && !isLoading && (
            <div>
              {/* Category Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
                {Object.keys(categoryLabels).map(cat => {
                  const items = (consents || []).filter((c: any) => c.category === cat);
                  const active = items.filter((c: any) => c.status === 'active').length;
                  return (
                    <div key={cat} className="card" style={{ padding: 12, textAlign: 'center' }}>
                      <div style={{ fontSize: 22 }}>{categoryIcons[cat]}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{categoryLabels[cat]}</div>
                      <div style={{ fontSize: 11, color: active > 0 ? '#16a34a' : 'var(--text-muted)', marginTop: 4 }}>{active > 0 ? `${active} active` : 'No consent'}</div>
                    </div>
                  );
                })}
              </div>

              {/* Consent List */}
              <div style={{ display: 'grid', gap: 10 }}>
                {consents?.map((c: any) => (
                  <div key={c.id} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 20 }}>{categoryIcons[c.category] || '📄'}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{categoryLabels[c.category] || c.category}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Given by: {c.consent_given_by} ({c.relationship || 'self'}) | Recorded: {new Date(c.created_at).toLocaleDateString('en-GB')}</div>
                        {c.review_date && <div style={{ fontSize: 11, color: '#d97706' }}>Review by: {new Date(c.review_date).toLocaleDateString('en-GB')}</div>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {c.capacity_assessed
                        ? <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#eef2ff', color: '#4338ca' }}>Capacity assessed</span>
                        : <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#fffbeb', color: '#b45309' }}>No capacity assessment</span>}
                      <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c.status === 'active' ? '#dcfce7' : c.status === 'withdrawn' ? '#fef2f2' : '#f3f4f6', color: c.status === 'active' ? '#16a34a' : c.status === 'withdrawn' ? '#dc2626' : '#6b7280' }}>{c.status}</span>
                      <button onClick={() => { setCapacityFor(c); resetCap(); }} style={{ padding: '4px 10px', background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Assess capacity</button>
                      {c.status === 'active' && <button onClick={() => updateMutation.mutate({ id: c.id, data: { status: 'withdrawn' } })} style={{ padding: '4px 8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>Withdraw</button>}
                    </div>
                  </div>
                ))}
                {consents?.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No consents recorded for this resident.</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'expiring' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {isExpiringError && (
            <div className="card" style={{ padding: 20, borderLeft: '4px solid #dc2626' }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#dc2626' }}>⚠️ Unable to load expiring consents</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>An error occurred while loading expiring consent data. Please try again later.</div>
            </div>
          )}
          {!isExpiringError && expiring?.map((c: any) => (
            <div key={c.id} className="card" style={{ padding: 14, borderLeft: '4px solid #d97706' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.resident_name} - {categoryLabels[c.category] || c.category}</div>
                  <div style={{ fontSize: 12, color: '#d97706', marginTop: 4 }}>Review due: {new Date(c.review_date).toLocaleDateString('en-GB')}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Room {c.room_number}</span>
              </div>
            </div>
          ))}
          {!isExpiringError && expiring?.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No consents due for review in the next 30 days.</div>}
        </div>
      )}

      {tab === 'create' && (
        <form onSubmit={handleCreate} style={{ maxWidth: 550 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px' }}>Record New Consent</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Resident *</label>
                <select value={form.residentId} onChange={e => setForm({ ...form, residentId: e.target.value })} required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}>
                  <option value="">Select resident...</option>
                  {residents?.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Category *</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}>
                  {Object.entries(categoryLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Consent Given By</label>
                  <input value={form.consentGivenBy} onChange={e => setForm({ ...form, consentGivenBy: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>{t('Relationship')}</label>
                  <input value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })} placeholder="e.g. Self, Daughter" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Review Date</label>
                <input type="date" value={form.reviewDate} onChange={e => setForm({ ...form, reviewDate: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>{t('Notes')}</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, resize: 'vertical' }} />
              </div>
            </div>
            <button type="submit" disabled={!form.residentId || createMutation.isPending} style={{ marginTop: 16, padding: '12px 24px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
              {createMutation.isPending ? 'Saving...' : 'Record Consent'}
            </button>
          </div>
        </form>
      )}

      {capacityFor && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 28 }}>
          <form onSubmit={submitCapacity} style={{ width: '100%', maxWidth: 720, background: 'var(--surface, #fff)', borderRadius: 14, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Mental Capacity Assessment</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)', marginTop: 2 }}>
                  {categoryLabels[capacityFor.category] || capacityFor.category}
                  {capacityFor.description ? ` — ${capacityFor.description}` : ''}
                </div>
              </div>
              <button type="button" onClick={() => setCapacityFor(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>×</button>
            </div>

            <div style={{ padding: 10, background: '#eef2ff', borderRadius: 8, fontSize: 12, color: '#3730a3', marginBottom: 16 }}>
              Under the Mental Capacity Act 2005, capacity is <strong>decision-specific</strong> and must be assumed unless shown otherwise. Assess only this decision, at this time.
            </div>

            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Stage 1 — Diagnostic test</div>
            <YesNo label="Is there an impairment of, or disturbance in the functioning of, the person's mind or brain?" value={cap.impairment} onChange={(v: string) => setCap(c => ({ ...c, impairment: v }))} />

            <div style={{ fontWeight: 700, fontSize: 13, margin: '16px 0 6px' }}>Stage 2 — Functional test <span style={{ fontWeight: 400, color: '#6b7280' }}>(can the person…)</span></div>
            <YesNo label="Understand the information relevant to the decision?" value={cap.understand} onChange={(v: string) => setCap(c => ({ ...c, understand: v }))} />
            <YesNo label="Retain that information long enough to decide?" value={cap.retain} onChange={(v: string) => setCap(c => ({ ...c, retain: v }))} />
            <YesNo label="Use or weigh that information as part of the decision?" value={cap.weigh} onChange={(v: string) => setCap(c => ({ ...c, weigh: v }))} />
            <YesNo label="Communicate their decision (by any means)?" value={cap.communicate} onChange={(v: string) => setCap(c => ({ ...c, communicate: v }))} />

            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>All practicable steps taken to support the decision</label>
              <textarea value={cap.supportGiven} onChange={e => setCap(c => ({ ...c, supportGiven: e.target.value }))} rows={2} placeholder="e.g. explained in simple language, used pictures, chose a time of day when most alert, involved family" style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border, #d1d5db)', fontSize: 13, resize: 'vertical' }} />
            </div>

            {capComplete && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: derivedLacks ? '#fef2f2' : '#f0fdf4', border: `1px solid ${derivedLacks ? '#fecaca' : '#bbf7d0'}` }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: derivedLacks ? '#b91c1c' : '#15803d' }}>
                  {derivedLacks ? 'Outcome: lacks capacity for this decision' : 'Outcome: has capacity for this decision'}
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                  {derivedLacks
                    ? 'A best-interests decision is required under s.4 MCA. Record it below.'
                    : 'The person can make this decision themselves — their decision must be respected.'}
                </div>
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Assessor notes / evidence</label>
              <textarea value={cap.conclusion} onChange={e => setCap(c => ({ ...c, conclusion: e.target.value }))} rows={2} style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border, #d1d5db)', fontSize: 13, resize: 'vertical' }} />
            </div>

            {derivedLacks && (
              <>
                <div style={{ marginTop: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Best-interests decision and reasons</label>
                  <textarea value={cap.bestInterests} onChange={e => setCap(c => ({ ...c, bestInterests: e.target.value }))} rows={3} placeholder="What is being decided, why it is in the person's best interests, and the least restrictive option considered" style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border, #d1d5db)', fontSize: 13, resize: 'vertical' }} />
                </div>
                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>People consulted (family, advocate/IMCA, GP, LPA holder)</label>
                  <input type="text" value={cap.consulted} onChange={e => setCap(c => ({ ...c, consulted: e.target.value }))} style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border, #d1d5db)', fontSize: 13 }} />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button type="submit" disabled={!capComplete || capacityMutation.isPending} style={{ flex: 1, padding: '11px', borderRadius: 9, background: '#4338ca', color: '#fff', border: 'none', fontWeight: 700, cursor: capComplete ? 'pointer' : 'not-allowed', opacity: capComplete ? 1 : 0.5 }}>
                {capacityMutation.isPending ? 'Saving…' : 'Record assessment'}
              </button>
              <button type="button" onClick={() => setCapacityFor(null)} style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'var(--surface-2, #f3f4f6)', border: '1px solid var(--border, #d1d5db)', fontWeight: 600, cursor: 'pointer' }}>{t('Cancel')}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border, #f1f5f9)' }}>
      <span style={{ fontSize: 13, flex: 1 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        {['yes', 'no'].map(v => (
          <button key={v} type="button" onClick={() => onChange(v)}
            style={{ padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${value === v ? (v === 'yes' ? '#16a34a' : '#dc2626') : '#d1d5db'}`,
              background: value === v ? (v === 'yes' ? '#dcfce7' : '#fef2f2') : '#fff',
              color: value === v ? (v === 'yes' ? '#15803d' : '#b91c1c') : '#6b7280' }}>
            {v === 'yes' ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
}
