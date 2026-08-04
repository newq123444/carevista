// src/pages/ConsentManager.tsx - Digital Consent Manager
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

const categoryIcons: Record<string, string> = { photography: '📸', outings: '🚌', medical: '💊', research: '🔬', dnr: '❤️', other: '📄' };
const categoryLabels: Record<string, string> = { photography: 'Photography', outings: 'Outings & Trips', medical: 'Medical Treatment', research: 'Research', dnr: 'DNR/DNACPR', other: 'Other' };

export default function ConsentManager() {
  const [tab, setTab] = useState<'overview' | 'create' | 'expiring'>('overview');
  const [selectedResident, setSelectedResident] = useState('');
  const [form, setForm] = useState({ residentId: '', category: 'medical', description: '', consentGivenBy: '', relationship: '', reviewDate: '', notes: '' });
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
                      <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c.status === 'active' ? '#dcfce7' : c.status === 'withdrawn' ? '#fef2f2' : '#f3f4f6', color: c.status === 'active' ? '#16a34a' : c.status === 'withdrawn' ? '#dc2626' : '#6b7280' }}>{c.status}</span>
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
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Relationship</label>
                  <input value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })} placeholder="e.g. Self, Daughter" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Review Date</label>
                <input type="date" value={form.reviewDate} onChange={e => setForm({ ...form, reviewDate: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, resize: 'vertical' }} />
              </div>
            </div>
            <button type="submit" disabled={!form.residentId || createMutation.isPending} style={{ marginTop: 16, padding: '12px 24px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
              {createMutation.isPending ? 'Saving...' : 'Record Consent'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
