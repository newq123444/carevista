import React, { useState } from 'react';
import { useMedInteractionAlerts, useCheckMedInteractions, useResidentMedInteractions, useAcknowledgeMedInteraction, useResidents } from '../hooks';
import type { MedicationInteraction } from '../types';

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  minor: { bg: '#eff6ff', text: '#0d9488', border: '#bfdbfe' },
  moderate: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  major: { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  contraindicated: { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff' },
};

function SeverityBadge({ severity }: { severity: string }) {
  const colors = SEVERITY_COLORS[severity] || SEVERITY_COLORS.minor;
  return (
    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 700, background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`, textTransform: 'uppercase' }}>
      {severity}
    </span>
  );
}

export default function MedInteractionChecker() {
  const [selectedResidentId, setSelectedResidentId] = useState('');

  const { data: alertsData } = useMedInteractionAlerts();
  const { data: residentInteractionsData } = useResidentMedInteractions(selectedResidentId);
  const { data: residents } = useResidents();
  const checkInteractions = useCheckMedInteractions();
  const acknowledgeMutation = useAcknowledgeMedInteraction();

  const alerts: MedicationInteraction[] = Array.isArray(alertsData) ? alertsData : (alertsData as any)?.alerts || [];
  const residentInteractions: MedicationInteraction[] = Array.isArray(residentInteractionsData) ? residentInteractionsData : (residentInteractionsData as any)?.interactions || [];
  const residentList: any[] = Array.isArray(residents) ? residents : [];

  const activeAlerts = alerts.filter(a => a.status === 'active');
  const uniqueResidents = new Set(alerts.map(a => a.resident_id)).size;

  const handleCheck = () => {
    if (selectedResidentId) checkInteractions.mutate(selectedResidentId);
  };

  const handleAcknowledge = (id: string) => {
    acknowledgeMutation.mutate(id);
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 4px', color: '#1e293b' }}>Medication Interaction Checker</h1>
      <p style={{ color: '#64748b', marginBottom: 20 }}>Monitor and manage drug-drug interactions across all residents</p>

      {/* Severity Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(SEVERITY_COLORS).map(([sev, colors]) => (
          <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: colors.text }} />
            <span style={{ fontSize: '0.75rem', color: '#475569', textTransform: 'capitalize' }}>{sev}</span>
          </div>
        ))}
      </div>

      {/* Dashboard Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Active Alerts</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: activeAlerts.length > 0 ? '#dc2626' : '#10b981' }}>{activeAlerts.length}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Residents with Interactions</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>{uniqueResidents}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Last Check</div>
          <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>{alerts.length > 0 ? new Date(alerts[0].flagged_at || alerts[0].created_at).toLocaleString() : 'Never'}</div>
        </div>
      </div>

      {/* Alerts Panel */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.1)', marginBottom: 24, border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, color: '#1e293b' }}>Unacknowledged Interaction Alerts</h2>
        {activeAlerts.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#10b981', padding: 16 }}>No active alerts. All interactions have been reviewed.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {activeAlerts.map(alert => (
              <div key={alert.id} style={{ padding: 16, borderRadius: 10, border: `1px solid ${(SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.minor).border}`, background: (SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.minor).bg }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <SeverityBadge severity={alert.severity} />
                    <span style={{ marginLeft: 10, fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{alert.resident_name || 'Unknown Resident'}</span>
                    {alert.room_number && <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 8 }}>Room {alert.room_number}</span>}
                  </div>
                  <button onClick={() => handleAcknowledge(alert.id)} disabled={acknowledgeMutation.isPending} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                    Acknowledge
                  </button>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#1e293b', marginBottom: 4 }}>
                  <strong>{alert.medication_a_name || 'Medication A'}</strong>
                  <span style={{ margin: '0 8px', color: '#94a3b8' }}>vs</span>
                  <strong>{alert.medication_b_name || 'Medication B'}</strong>
                </div>
                {alert.clinical_effect && (
                  <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 4 }}>
                    <strong>Clinical Effect:</strong> {alert.clinical_effect}
                  </div>
                )}
                {alert.recommendation && (
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    <strong>Recommendation:</strong> {alert.recommendation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resident-Specific Section */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.1)', border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, color: '#1e293b' }}>Resident Interaction Check</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Select Resident</label>
            <select value={selectedResidentId} onChange={e => setSelectedResidentId(e.target.value)} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem', minWidth: 280 }}>
              <option value="">Choose a resident...</option>
              {residentList.map((r: any) => (
                <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>
              ))}
            </select>
          </div>
          <button onClick={handleCheck} disabled={!selectedResidentId || checkInteractions.isPending} style={{ padding: '10px 20px', borderRadius: 8, background: '#4f46e5', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', opacity: (!selectedResidentId || checkInteractions.isPending) ? 0.6 : 1, height: 42 }}>
            {checkInteractions.isPending ? 'Checking...' : 'Run Interaction Check'}
          </button>
        </div>

        {/* Interactions for resident */}
        {selectedResidentId && (
          <div>
            {residentInteractions.length === 0 ? (
              <p style={{ color: '#10b981', padding: 16, textAlign: 'center', background: '#f0fdf4', borderRadius: 8 }}>No known interactions for this resident.</p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {residentInteractions.map(interaction => (
                  <div key={interaction.id} style={{ padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', background: interaction.status === 'acknowledged' ? '#f8fafc' : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <SeverityBadge severity={interaction.severity} />
                      <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 8, background: interaction.status === 'active' ? '#fef2f2' : '#f0fdf4', color: interaction.status === 'active' ? '#991b1b' : '#166534' }}>
                        {interaction.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                      {interaction.medication_a_name || 'Medication A'} vs {interaction.medication_b_name || 'Medication B'}
                    </div>
                    {interaction.description && <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 4 }}>{interaction.description}</div>}
                    {interaction.clinical_effect && <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 4 }}><strong>Effect:</strong> {interaction.clinical_effect}</div>}
                    {interaction.recommendation && <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: 4 }}><strong>Recommendation:</strong> {interaction.recommendation}</div>}
                    {interaction.acknowledged_by_name && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 8 }}>
                        Acknowledged by {interaction.acknowledged_by_name} on {interaction.acknowledged_at ? new Date(interaction.acknowledged_at).toLocaleString() : 'N/A'}
                      </div>
                    )}
                    {interaction.status === 'active' && (
                      <button onClick={() => handleAcknowledge(interaction.id)} style={{ marginTop: 8, padding: '6px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#475569', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                        Acknowledge
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
