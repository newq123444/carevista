// src/pages/SmartHandover.tsx - Smart Handover Intelligence
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

const urgencyColors: Record<string, string> = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' };
const urgencyBg: Record<string, string> = { critical: '#fef2f2', high: '#fff7ed', medium: '#fffbeb', low: '#f0fdf4' };

export default function SmartHandover() {
  const { t } = useLang();
  const [tab, setTab] = useState<'generate' | 'history'>('generate');
  const [shiftType, setShiftType] = useState('day');
  const [latestHandover, setLatestHandover] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: handovers, isLoading } = useQuery({ queryKey: ['smart-handovers'], queryFn: () => api.get('/handover/smart').then(r => r.data) });

  const generateMutation = useMutation({
    mutationFn: (data: any) => api.post('/handover/smart-generate', data).then(r => r.data),
    onSuccess: (data) => { setLatestHandover(data); queryClient.invalidateQueries({ queryKey: ['smart-handovers'] }); },
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.post(`/handover/smart/${id}/action`, data).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['smart-handovers'] }),
  });

  const handleGenerate = () => generateMutation.mutate({ shiftType });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🧠 Smart Handover Intelligence</h1>
          <p className="page-subtitle">AI identifies the top 3 critical items the incoming shift MUST know</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {([['generate', '⚡ Generate Handover'], ['history', '📜 History']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: `2px solid ${tab === k ? '#ea580c' : 'transparent'}`, color: tab === k ? '#ea580c' : 'var(--text-secondary)', fontWeight: tab === k ? 700 : 500, cursor: 'pointer', fontSize: 14, marginBottom: -2 }}>{l}</button>
        ))}
      </div>

      {tab === 'generate' && (
        <div>
          <div className="card" style={{ padding: 20, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, marginRight: 8 }}>Incoming Shift:</label>
              <select value={shiftType} onChange={e => setShiftType(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 14 }}>
                <option value="day">Day Shift (07:00-19:00)</option>
                <option value="night">Night Shift (19:00-07:00)</option>
                <option value="twilight">Twilight (14:00-22:00)</option>
              </select>
            </div>
            <button onClick={handleGenerate} disabled={generateMutation.isPending} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #ea580c, #f97316)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
              {generateMutation.isPending ? '⏳ Analyzing...' : '🧠 Generate Smart Handover'}
            </button>
          </div>

          {latestHandover && (
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 16, color: 'var(--text-primary)' }}>Top 3 Critical Items for {shiftType.charAt(0).toUpperCase() + shiftType.slice(1)} Shift</h3>
              <div style={{ display: 'grid', gap: 12 }}>
                {(latestHandover.critical_items || []).map((item: any, i: number) => (
                  <div key={i} className="card" style={{ padding: 20, background: urgencyBg[item.urgency] || '#f9fafb', borderLeft: `4px solid ${urgencyColors[item.urgency] || '#6b7280'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ width: 28, height: 28, borderRadius: '50%', background: urgencyColors[item.urgency] || '#6b7280', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>{item.priority}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Category: {item.category}</div>
                        </div>
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: urgencyColors[item.urgency] + '20', color: urgencyColors[item.urgency] }}>{item.urgency.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '8px 0', paddingLeft: 38 }}>{item.detail}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: urgencyColors[item.urgency], paddingLeft: 38 }}>Action: {item.action_required}</div>
                    <div style={{ paddingLeft: 38, marginTop: 10 }}>
                      <button onClick={() => actionMutation.mutate({ id: latestHandover.id, data: { itemIndex: i, actionTaken: 'Acknowledged and actioned', outcome: 'resolved' } })} style={{ padding: '6px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', marginRight: 8 }}>{t('Mark Actioned')}</button>
                      <button onClick={() => actionMutation.mutate({ id: latestHandover.id, data: { itemIndex: i, actionTaken: 'Escalated', outcome: 'escalated' } })} style={{ padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>{t('Escalate')}</button>
                    </div>
                  </div>
                ))}
              </div>
              {latestHandover.critical_items?.length === 0 && (
                <div className="card" style={{ padding: 30, textAlign: 'center', background: '#f0fdf4' }}>
                  <div style={{ fontSize: 24 }}>All clear for this shift. No critical items identified.</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading history...</div>}
          <div style={{ display: 'grid', gap: 12 }}>
            {handovers?.map((h: any) => (
              <div key={h.id} className="card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => setLatestHandover(h)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{h.shift_type?.charAt(0).toUpperCase() + h.shift_type?.slice(1)} Shift Handover</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>By {h.generated_by_name} - {new Date(h.created_at).toLocaleString('en-GB')}</div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: h.status === 'active' ? '#dbeafe' : '#f3f4f6', color: h.status === 'active' ? '#0d9488' : '#6b7280' }}>{h.status}</span>
                </div>
              </div>
            ))}
            {handovers?.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No handovers generated yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
