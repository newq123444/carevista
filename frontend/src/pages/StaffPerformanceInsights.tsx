import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useStaffPerformanceTeam, useStaffPerformanceIndividual, useStaffResponseTimes, useCalculateStaffPerformance, useStaff } from '../hooks';

export default function StaffPerformanceInsights() {
  const { t: tr } = useLang();
  const [viewMode, setViewMode] = useState<'team' | 'individual'>('team');
  const [selectedStaffId, setSelectedStaffId] = useState('');

  const { data: teamMetrics, isLoading: teamLoading } = useStaffPerformanceTeam();
  const { data: individualMetrics } = useStaffPerformanceIndividual(selectedStaffId);
  const { data: responseTimes } = useStaffResponseTimes();
  const { data: staffList } = useStaff();
  const calculateMutation = useCalculateStaffPerformance();

  const teamData = Array.isArray(teamMetrics) ? teamMetrics : (teamMetrics as any)?.metrics || [];
  const individualData = Array.isArray(individualMetrics) ? individualMetrics : (individualMetrics as any)?.metrics || [];
  const responseData = Array.isArray(responseTimes) ? responseTimes : (responseTimes as any)?.data || [];
  const staff = Array.isArray(staffList) ? staffList : (staffList as any)?.staff || [];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Staff Performance Insights</h1>
          <p style={{ color: '#6b7280', margin: 0 }}>Team-level and individual performance metrics for supervision.</p>
        </div>
        <button onClick={() => calculateMutation.mutate({})} disabled={calculateMutation.isPending} style={{ padding: '10px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
          {calculateMutation.isPending ? 'Calculating...' : 'Recalculate'}
        </button>
      </div>

      {/* View Toggle */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 24, width: 'fit-content' }}>
        <button onClick={() => setViewMode('team')} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer', background: viewMode === 'team' ? '#fff' : 'transparent', color: viewMode === 'team' ? '#111827' : '#6b7280', boxShadow: viewMode === 'team' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
          {tr('Team View')}
        </button>
        <button onClick={() => setViewMode('individual')} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer', background: viewMode === 'individual' ? '#fff' : 'transparent', color: viewMode === 'individual' ? '#111827' : '#6b7280', boxShadow: viewMode === 'individual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
          {tr('Individual View')}
        </button>
      </div>

      {viewMode === 'team' ? (
        <>
          {/* Team Metrics */}
          {teamLoading ? (
            <p style={{ color: '#6b7280' }}>Loading team metrics...</p>
          ) : (
            <>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>Task Completion (Anonymised)</h2>
              <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 24 }}>
                {teamData.length === 0 ? (
                  <p style={{ color: '#6b7280', margin: 0 }}>No team metrics available. Click "Recalculate" to generate.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {teamData.map((metric: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '0.85rem', color: '#6b7280', minWidth: 80 }}>Staff {i + 1}</span>
                        <div style={{ flex: 1, height: 24, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, metric.tasks_completed || metric.metric_value || 0)}%`, background: '#0d9488', borderRadius: 6, transition: 'width 300ms' }} />
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{metric.tasks_completed || metric.metric_value || 0}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Response Times */}
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12 }}>Average Response Times</h2>
              <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 24 }}>
                {responseData.length === 0 ? (
                  <p style={{ color: '#6b7280', margin: 0 }}>No response time data available.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {responseData.map((rt: any, i: number) => (
                      <div key={i} style={{ padding: 12, background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0d9488' }}>{rt.avg_response_time_minutes || rt.value || 0} min</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>{rt.staff_name || rt.category || `Team ${i + 1}`}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {/* Individual View */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{tr('Select Staff Member')}</label>
            <select
              value={selectedStaffId}
              onChange={e => setSelectedStaffId(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', minWidth: 300 }}
            >
              <option value="">Choose a staff member...</option>
              {staff.map((s: any) => (
                <option key={s.id} value={s.id}>{s.first_name} {s.last_name} - {s.role}</option>
              ))}
            </select>
          </div>

          {selectedStaffId && (
            <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Individual Performance</h2>
              {individualData.length === 0 ? (
                <p style={{ color: '#6b7280' }}>No metrics available for this staff member.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                  {individualData.map((metric: any, i: number) => (
                    <div key={i} style={{ padding: 16, background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#111827' }}>{metric.metric_value || metric.tasks_completed || 0}</div>
                      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4, textTransform: 'capitalize' }}>{(metric.metric_type || '').replace(/_/g, ' ')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
