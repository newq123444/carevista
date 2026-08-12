// src/pages/RegulatoryReporting.tsx - Automated Regulatory Reporting
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

const typeLabels: Record<string, string> = { cqc: 'CQC Notification', safeguarding: 'Safeguarding Alert', dols: 'DoLS Application', death: 'Death Notification' };
const typeIcons: Record<string, string> = { cqc: '🏛️', safeguarding: '🛡️', dols: '📋', death: '🕊️' };
const typeColors: Record<string, string> = { cqc: '#0d9488', safeguarding: '#dc2626', dols: '#7c3aed', death: '#374151' };

export default function RegulatoryReporting() {
  const { t: tr } = useLang();
  const [tab, setTab] = useState<'dashboard' | 'create' | 'deadlines'>('dashboard');
  const [createForm, setCreateForm] = useState({ type: 'cqc', residentId: '', incidentId: '', details: '' });
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({ queryKey: ['regulatory-notifications'], queryFn: () => api.get('/regulatory/notifications').then(r => r.data) });
  const { data: deadlines } = useQuery({ queryKey: ['regulatory-deadlines'], queryFn: () => api.get('/regulatory/deadlines').then(r => r.data) });
  const { data: residents } = useQuery({ queryKey: ['residents'], queryFn: () => api.get('/residents').then(r => r.data?.residents ?? r.data ?? []) });

  const generateMutation = useMutation({
    mutationFn: (data: any) => api.post('/regulatory/generate-notification', data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['regulatory-notifications'] }); queryClient.invalidateQueries({ queryKey: ['regulatory-deadlines'] }); setTab('dashboard'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/regulatory/notifications/${id}`, data).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['regulatory-notifications'] }); queryClient.invalidateQueries({ queryKey: ['regulatory-deadlines'] }); },
  });

  const handleCreate = (e: React.FormEvent) => { e.preventDefault(); generateMutation.mutate(createForm); };

  // Group by type for dashboard
  const grouped = (notifications || []).reduce((acc: any, n: any) => { acc[n.type] = acc[n.type] || []; acc[n.type].push(n); return acc; }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Automated Regulatory Reporting</h1>
          <p className="page-subtitle">Auto-generate statutory notifications, track deadlines, maintain audit trails</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {([['dashboard', '📊 Dashboard'], ['deadlines', '⏰ Deadlines'], ['create', '➕ New Notification']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: `2px solid ${tab === k ? '#0d9488' : 'transparent'}`, color: tab === k ? '#0d9488' : 'var(--text-secondary)', fontWeight: tab === k ? 700 : 500, cursor: 'pointer', fontSize: 14, marginBottom: -2 }}>{l}</button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div>
          {/* Type Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
            {Object.entries(typeLabels).map(([type, label]) => {
              const items = grouped[type] || [];
              const pending = items.filter((i: any) => i.status === 'draft' || i.status === 'pending').length;
              return (
                <div key={type} className="card" style={{ padding: 16, borderTop: `3px solid ${typeColors[type]}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>{typeIcons[type]}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total: {items.length}</span>
                    {pending > 0 && <span style={{ padding: '2px 8px', borderRadius: 10, background: '#fef3c7', color: '#d97706', fontSize: 11, fontWeight: 600 }}>{pending} pending</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notifications List */}
          {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading notifications...</div>}
          <div style={{ display: 'grid', gap: 10 }}>
            {notifications?.map((n: any) => (
              <div key={n.id} className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18 }}>{typeIcons[n.type]}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{typeLabels[n.type]} {n.resident_name ? `- ${n.resident_name}` : ''}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Created {new Date(n.created_at).toLocaleDateString('en-GB')} by {n.created_by_name}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: n.status === 'submitted' ? '#dcfce7' : n.status === 'overdue' ? '#fef2f2' : '#f3f4f6', color: n.status === 'submitted' ? '#16a34a' : n.status === 'overdue' ? '#dc2626' : '#6b7280' }}>{n.status}</span>
                  {n.status === 'draft' && <button onClick={() => updateMutation.mutate({ id: n.id, data: { status: 'submitted' } })} style={{ padding: '4px 10px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>{tr('Submit')}</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'deadlines' && (
        <div style={{ display: 'grid', gap: 12 }}>
          {deadlines?.map((d: any) => (
            <div key={d.id} className="card" style={{ padding: 16, borderLeft: `4px solid ${d.is_overdue ? '#dc2626' : d.days_remaining <= 3 ? '#d97706' : '#16a34a'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{typeLabels[d.type]} {d.resident_name ? `- ${d.resident_name}` : ''}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Deadline: {new Date(d.deadline).toLocaleDateString('en-GB')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: d.is_overdue ? '#dc2626' : d.days_remaining <= 3 ? '#d97706' : '#16a34a' }}>
                    {d.is_overdue ? 'OVERDUE' : `${d.days_remaining}d`}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.is_overdue ? 'Action required' : 'remaining'}</div>
                </div>
              </div>
            </div>
          ))}
          {deadlines?.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No upcoming deadlines.</div>}
        </div>
      )}

      {tab === 'create' && (
        <form onSubmit={handleCreate} style={{ maxWidth: 500 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px' }}>Generate Statutory Notification</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Notification Type *</label>
                <select value={createForm.type} onChange={e => setCreateForm({ ...createForm, type: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}>
                  <option value="cqc">CQC Notification</option><option value="safeguarding">Safeguarding Alert</option><option value="dols">DoLS Application</option><option value="death">Death Notification</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>{tr('Resident')}</label>
                <select value={createForm.residentId} onChange={e => setCreateForm({ ...createForm, residentId: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}>
                  <option value="">Select resident (optional)</option>
                  {residents?.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Additional Details</label>
                <textarea value={createForm.details} onChange={e => setCreateForm({ ...createForm, details: e.target.value })} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, resize: 'vertical' }} />
              </div>
            </div>
            <button type="submit" disabled={generateMutation.isPending} style={{ marginTop: 16, padding: '12px 24px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
              {generateMutation.isPending ? 'Generating...' : 'Generate Notification'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
