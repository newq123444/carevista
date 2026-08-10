// src/pages/PredictiveCare.tsx — AI Predictive Care Dashboard
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { usePredictiveRiskDashboard, usePredictiveAlerts, useResidentRiskHistory, useRunPredictiveAnalysis, useAcknowledgePredictiveAlert, useResidents } from '../hooks';
import type { PredictiveRiskDashboardItem, PredictiveAlert } from '../types';

// ── Error Boundary ────────────────────────────────────────────────────────
class PredictiveCareErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            The Falls & Risk AI page encountered an error. Please try refreshing.
          </div>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function scoreColor(score: number | null): string {
  if (score === null) return '#6b7280';
  if (score > 70) return '#dc2626';
  if (score >= 30) return '#d97706';
  return '#16a34a';
}

function scoreBg(score: number | null): string {
  if (score === null) return '#f3f4f6';
  if (score > 70) return '#fef2f2';
  if (score >= 30) return '#fffbeb';
  return '#f0fdf4';
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function PredictiveCare() {
  return (
    <PredictiveCareErrorBoundary>
      <PredictiveCareInner />
    </PredictiveCareErrorBoundary>
  );
}

function PredictiveCareInner() {
  const [tab, setTab] = useState<'dashboard' | 'alerts' | 'detail'>('dashboard');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🎯 Falls & Risk AI</h1>
          <p className="page-subtitle">Predictive risk scoring and early warning alerts for residents</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {([
          ['dashboard', '📊 Risk Dashboard'],
          ['alerts', '🔔 Active Alerts'],
          ['detail', '👤 Resident Detail'],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: `2px solid ${tab === k ? '#0d9488' : 'transparent'}`, color: tab === k ? '#0d9488' : 'var(--text-secondary)', fontWeight: tab === k ? 700 : 500, cursor: 'pointer', fontSize: 14, marginBottom: -2 }}>{l}</button>
        ))}
      </div>

      {tab === 'dashboard' && <RiskDashboardTab />}
      {tab === 'alerts' && <AlertsTab />}
      {tab === 'detail' && <ResidentDetailTab />}
    </div>
  );
}

// ── Risk Dashboard Tab ────────────────────────────────────────────────────
function RiskDashboardTab() {
  const { t } = useLang();
  const { data, isLoading, error } = usePredictiveRiskDashboard();
  const runAnalysis = useRunPredictiveAnalysis();

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading risk dashboard...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>Failed to load dashboard</div>;

  const residents: PredictiveRiskDashboardItem[] = Array.isArray(data) ? data : (data?.dashboard ?? []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{residents.length} residents tracked</span>
        <button
          onClick={() => runAnalysis.mutate()}
          disabled={runAnalysis.isPending}
          style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: runAnalysis.isPending ? 0.6 : 1 }}
        >
          {runAnalysis.isPending ? 'Analyzing...' : '🔄 Run Analysis'}
        </button>
      </div>

      {residents.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎯</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No Risk Scores Available</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 20px' }}>
            Risk analysis has not been run yet. Click the button below to calculate falls and deterioration risk scores for all active residents.
          </div>
          <button
            onClick={() => runAnalysis.mutate()}
            disabled={runAnalysis.isPending}
            style={{ padding: '12px 24px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: runAnalysis.isPending ? 0.6 : 1 }}
          >
            {runAnalysis.isPending ? '⏳ Running Analysis...' : '🔄 Run Risk Analysis'}
          </button>
          {runAnalysis.isPending && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              This may take a moment as each resident is analyzed individually...
            </div>
          )}
        </div>
      ) : (
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>{t('Resident')}</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>{t('Room')}</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Risk Level</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>Falls Score</th>
                <th style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>{t('Deterioration')}</th>
                <th style={{ padding: '10px 12px', fontWeight: 600 }}>Last Analyzed</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((r) => (
                <tr key={r.resident_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.first_name} {r.last_name}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{r.room_number}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: r.risk_level === 'high' ? '#fef2f2' : r.risk_level === 'medium' ? '#fffbeb' : '#f0fdf4', color: r.risk_level === 'high' ? '#dc2626' : r.risk_level === 'medium' ? '#d97706' : '#16a34a' }}>
                      {r.risk_level}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 6, fontWeight: 700, fontSize: 13, background: scoreBg(r.falls_score), color: scoreColor(r.falls_score) }}>
                      {r.falls_score !== null ? r.falls_score : '-'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 6, fontWeight: 700, fontSize: 13, background: scoreBg(r.deterioration_score), color: scoreColor(r.deterioration_score) }}>
                      {r.deterioration_score !== null ? r.deterioration_score : '-'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatTime(r.falls_generated_at || r.deterioration_generated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}

// ── Active Alerts Tab ─────────────────────────────────────────────────────
function AlertsTab() {
  const { data, isLoading, error } = usePredictiveAlerts();
  const acknowledge = useAcknowledgePredictiveAlert();

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading alerts...</div>;
  if (error) return <div style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>Failed to load alerts</div>;

  const alerts: PredictiveAlert[] = Array.isArray(data) ? data : (data?.alerts ?? []);

  if (alerts.length === 0) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>No active alerts</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>All residents are within safe risk thresholds</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{alerts.length} active alert{alerts.length !== 1 ? 's' : ''}</span>
      {alerts.map((alert) => (
        <div key={alert.id} className="card" style={{ border: `1px solid ${alert.risk_score > 80 ? '#fca5a5' : '#fed7aa'}` }}>
          <div style={{ padding: 16, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: alert.risk_score > 80 ? '#fef2f2' : '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {alert.risk_score > 80 ? '🚨' : '⚠️'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{alert.resident_name || 'Unknown Resident'}</span>
                <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: scoreBg(alert.risk_score), color: scoreColor(alert.risk_score) }}>
                  Score: {alert.risk_score}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                Room {alert.room_number} &middot; {alert.alert_type.replace(/_/g, ' ')} &middot; Threshold: {alert.threshold}
              </div>
              {alert.factors && Object.keys(alert.factors).length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  <strong>Factors:</strong> {Object.entries(alert.factors).slice(0, 4).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(', ')}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTime(alert.created_at)}</span>
                {alert.status === 'active' && (
                  <button
                    onClick={() => acknowledge.mutate(alert.id)}
                    disabled={acknowledge.isPending}
                    style={{ padding: '5px 12px', background: '#f0f9ff', color: '#0d9488', border: '1px solid #bfdbfe', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Acknowledge
                  </button>
                )}
                {alert.status === 'acknowledged' && (
                  <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Acknowledged{alert.acknowledged_by_name ? ` by ${alert.acknowledged_by_name}` : ''}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Resident Detail Tab ───────────────────────────────────────────────────
function ResidentDetailTab() {
  const { data: residentsData } = useResidents();
  const residents = Array.isArray(residentsData) ? residentsData : [];
  const [selectedId, setSelectedId] = useState('');
  const { data: history, isLoading } = useResidentRiskHistory(selectedId);

  const historyItems: Array<{ id: string; risk_type: string; score: number; generated_at: string; factors: Record<string, any> }> = Array.isArray(history) ? history : ((history as any)?.history ?? (history as any)?.scores ?? []);

  const fallsHistory = historyItems.filter(h => h.risk_type === 'falls').slice(0, 20);
  const deteriorationHistory = historyItems.filter(h => h.risk_type === 'deterioration').slice(0, 20);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Select Resident:</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, minWidth: 200 }}
        >
          <option value="">-- Choose a resident --</option>
          {residents.map((r: any) => (
            <option key={r.id} value={r.id}>{r.first_name} {r.last_name} (Rm {r.room_number})</option>
          ))}
        </select>
      </div>

      {!selectedId && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Select a resident to view their risk score history
        </div>
      )}

      {selectedId && isLoading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading history...</div>
      )}

      {selectedId && !isLoading && historyItems.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No risk history available for this resident. Run an analysis first.
        </div>
      )}

      {selectedId && !isLoading && historyItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Falls Risk Timeline */}
          {fallsHistory.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Falls Risk History</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fallsHistory.length} records</span>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
                  {fallsHistory.map((item, idx) => (
                    <div key={item.id || idx} title={`Score: ${item.score} - ${formatTime(item.generated_at)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: '100%', maxWidth: 30, height: `${item.score}%`, minHeight: 2, background: scoreColor(item.score), borderRadius: '3px 3px 0 0', transition: 'height 200ms' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                  <span>{fallsHistory.length > 0 ? formatTime(fallsHistory[fallsHistory.length - 1].generated_at) : ''}</span>
                  <span>{fallsHistory.length > 0 ? formatTime(fallsHistory[0].generated_at) : ''}</span>
                </div>
              </div>
            </div>
          )}

          {/* Deterioration Risk Timeline */}
          {deteriorationHistory.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Deterioration Risk History</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{deteriorationHistory.length} records</span>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100 }}>
                  {deteriorationHistory.map((item, idx) => (
                    <div key={item.id || idx} title={`Score: ${item.score} - ${formatTime(item.generated_at)}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{ width: '100%', maxWidth: 30, height: `${item.score}%`, minHeight: 2, background: scoreColor(item.score), borderRadius: '3px 3px 0 0', transition: 'height 200ms' }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                  <span>{deteriorationHistory.length > 0 ? formatTime(deteriorationHistory[deteriorationHistory.length - 1].generated_at) : ''}</span>
                  <span>{deteriorationHistory.length > 0 ? formatTime(deteriorationHistory[0].generated_at) : ''}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
