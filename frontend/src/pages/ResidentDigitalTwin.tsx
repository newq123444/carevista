// src/pages/ResidentDigitalTwin.tsx - Resident Digital Twin
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

const riskColors: Record<string, string> = { high: '#dc2626', warning: '#d97706', info: '#0d9488' };

// ── Error Boundary ────────────────────────────────────────────────────────
class DigitalTwinErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            The Digital Twin page encountered an error. Please try refreshing.
          </div>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ResidentDigitalTwin() {
  return (
    <DigitalTwinErrorBoundary>
      <ResidentDigitalTwinInner />
    </DigitalTwinErrorBoundary>
  );
}

function ResidentDigitalTwinInner() {
  const { t } = useLang();
  const [selectedResident, setSelectedResident] = useState('');

  const { data: residents } = useQuery({ queryKey: ['residents'], queryFn: () => api.get('/residents').then(r => r.data?.residents ?? r.data ?? []) });
  const { data: twin, isLoading, isError: isTwinError, error: twinError } = useQuery({
    queryKey: ['digital-twin', selectedResident],
    queryFn: () => api.get(`/digital-twin/${selectedResident}`).then(r => r.data),
    enabled: !!selectedResident,
    refetchInterval: 60000,
  });
  const { data: timeline } = useQuery({
    queryKey: ['digital-twin-timeline', selectedResident],
    queryFn: () => api.get(`/digital-twin/${selectedResident}/timeline`).then(r => r.data),
    enabled: !!selectedResident,
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🧬 Resident Digital Twin</h1>
          <p className="page-subtitle">Complete digital representation - medical, social, emotional, preferences, all in one view</p>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
        <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}>
          <option value="">Select a resident to view their Digital Twin...</option>
          {residents?.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number} ({r.care_type})</option>)}
        </select>
      </div>

      {isLoading && selectedResident && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading digital twin...</div>}

      {isTwinError && selectedResident && (
        <div className="card" style={{ padding: 24, borderLeft: '4px solid #dc2626', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#dc2626' }}>Unable to load Digital Twin</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                {(twinError as any)?.response?.data?.error || 'An error occurred while loading resident data. Please try again later.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {twin && (
        <div style={{ display: 'grid', gap: 20 }}>
          {/* Personal Summary Header */}
          <div className="card" style={{ padding: 20, background: 'linear-gradient(135deg, #1e293b, #334155)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700 }}>
                {twin.personal?.name?.split(' ').map((n: string) => n[0]).join('') || '?'}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 20 }}>{twin.personal?.name || 'Unknown'}</h2>
                <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Room {twin.personal?.room_number || 'N/A'}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>DOB: {twin.personal?.date_of_birth ? new Date(twin.personal.date_of_birth).toLocaleDateString('en-GB') : 'N/A'}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>Admitted: {twin.personal?.admission_date ? new Date(twin.personal.admission_date).toLocaleDateString('en-GB') : 'N/A'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 10, background: '#6366f120', color: '#a5b4fc', fontSize: 11, fontWeight: 600 }}>{twin.personal?.care_type || 'N/A'}</span>
                </div>
              </div>
              {twin.emotional?.current_wellbeing_score != null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: twin.emotional?.current_wellbeing_score >= 7 ? '#4ade80' : twin.emotional?.current_wellbeing_score >= 4 ? '#fbbf24' : '#f87171' }}>{twin.emotional?.current_wellbeing_score}/10</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{t('Wellbeing')}</div>
                </div>
              )}
            </div>
          </div>

          {/* Risk Indicators */}
          {twin.risk_indicators?.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {twin.risk_indicators.map((r: any, i: number) => (
                <div key={i} style={{ padding: '6px 12px', borderRadius: 8, background: `${riskColors[r.level] || '#6b7280'}15`, border: `1px solid ${riskColors[r.level] || '#6b7280'}30`, color: riskColors[r.level] || '#6b7280', fontSize: 12, fontWeight: 600 }}>
                  {r.detail}
                </div>
              ))}
            </div>
          )}

          {/* Main Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {/* Medical */}
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>💊 Medical</h3>
              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                <div><strong>Risk Level:</strong> <span style={{ color: twin.medical?.risk_level === 'high' ? '#dc2626' : twin.medical?.risk_level === 'medium' ? '#d97706' : '#16a34a' }}>{twin.medical?.risk_level || 'N/A'}</span></div>
                <div><strong>Mobility:</strong> {twin.medical?.mobility_status || 'Not recorded'}</div>
                <div><strong>Allergies:</strong> {twin.medical?.allergies || 'None known'}</div>
                <div><strong>Diet:</strong> {twin.medical?.dietary_requirements || 'Standard'}</div>
                {twin.medical?.dnacpr && <div style={{ color: '#dc2626', fontWeight: 600 }}>DNACPR in place</div>}
                {twin.medical?.medications?.length > 0 ? (
                  <div>
                    <strong>Active Medications ({twin.medical?.medications?.length || 0}):</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                      {twin.medical?.medications?.slice(0, 5).map((m: any, i: number) => (
                        <li key={i} style={{ fontSize: 12, marginBottom: 2 }}>{m.medication_name} - {m.dose} ({m.frequency})</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No active medications recorded</div>
                )}
                {twin.medical?.gp?.name && <div><strong>GP:</strong> {twin.medical.gp.name}</div>}
              </div>
            </div>

            {/* Social & Preferences */}
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>👥 Social & Preferences</h3>
              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                {twin.social?.key_worker && <div><strong>Key Worker:</strong> {twin.social.key_worker.first_name} {twin.social.key_worker.last_name} ({twin.social.key_worker.role})</div>}
                <div><strong>Funding:</strong> {twin.social?.funding_type || 'Not specified'}</div>
                {twin.social?.interests?.length > 0 && (
                  <div>
                    <strong>Interests:</strong>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {twin.social?.interests?.map((int: string, i: number) => (
                        <span key={i} style={{ padding: '3px 8px', borderRadius: 12, background: '#ede9fe', color: '#7c3aed', fontSize: 11 }}>{int}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Emotional & Wellbeing */}
            <div className="card" style={{ padding: 18 }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>💚 Emotional & Wellbeing</h3>
              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                {twin.emotional?.recent_moods?.length > 0 ? (
                  <div>
                    <strong>Recent Moods:</strong>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {twin.emotional?.recent_moods?.slice(0, 5).map((m: any, i: number) => (
                        <span key={i} style={{ padding: '3px 8px', borderRadius: 12, background: m.mood === 'happy' ? '#dcfce7' : m.mood === 'content' ? '#dbeafe' : m.mood === 'anxious' ? '#fef3c7' : '#fef2f2', fontSize: 11 }}>{m.mood}</span>
                      ))}
                    </div>
                  </div>
                ) : <div style={{ color: 'var(--text-muted)' }}>No recent mood data</div>}
              </div>
            </div>
          </div>

          {/* Timeline */}
          {timeline && timeline.length > 0 ? (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>📅 Recent Events Timeline</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {timeline.slice(0, 15).map((event: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 16 }}>{event.event_type === 'care_note' ? '📝' : event.event_type === 'incident' ? '⚠️' : '💚'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{event.sub_type}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.detail}</div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(event.event_date).toLocaleDateString('en-GB')}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : twin && (
            <div className="card" style={{ padding: 30, textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>📅 Recent Events Timeline</h3>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No recent events recorded for this resident.</div>
            </div>
          )}
        </div>
      )}

      {!selectedResident && (
        <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧬</div>
          <div style={{ fontSize: 16 }}>Select a resident above to view their complete Digital Twin</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>Shows medical, social, emotional, and historical data in one unified view</div>
        </div>
      )}
    </div>
  );
}
