import React, { useState } from 'react';
import { useRiskOverview, useOverdueRiskReviews, useCalculateWaterlow, useCalculateMUST, useCalculateFallsRisk2, useResidentRiskAssessments, useResidents } from '../hooks';
import type { RiskOverviewItem, RiskAssessment } from '../types';

type TabType = 'overview' | 'overdue' | 'calculate';

const RISK_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#ef4444',
  very_high: '#7f1d1d',
};

function TrafficLight({ score, level }: { score?: number; level?: string }) {
  if (score === undefined && !level) {
    return (
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600, margin: '0 auto' }}>
        -
      </div>
    );
  }
  const color = RISK_COLORS[level || 'low'] || '#6b7280';
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#fff', fontWeight: 700, margin: '0 auto' }}>
      {score ?? '?'}
    </div>
  );
}

export default function RiskAssessments() {
  const [tab, setTab] = useState<TabType>('overview');
  const [selectedResidentId, setSelectedResidentId] = useState('');
  const [detailAssessment, setDetailAssessment] = useState<RiskAssessment | null>(null);
  const [mustBmi, setMustBmi] = useState('');
  const [mustWeightLoss, setMustWeightLoss] = useState('');
  const [mustAcuteDisease, setMustAcuteDisease] = useState(false);

  const { data: overviewData } = useRiskOverview();
  const { data: overdueData } = useOverdueRiskReviews();
  const { data: residentAssessments } = useResidentRiskAssessments(selectedResidentId);
  const { data: residents } = useResidents();
  const calcWaterlow = useCalculateWaterlow();
  const calcMUST = useCalculateMUST();
  const calcFalls = useCalculateFallsRisk2();

  const overview: RiskOverviewItem[] = Array.isArray(overviewData) ? overviewData : (overviewData as any)?.residents || [];
  const overdue: RiskAssessment[] = Array.isArray(overdueData) ? overdueData : (overdueData as any)?.assessments || [];
  const residentList: any[] = Array.isArray(residents) ? residents : [];

  const tabStyle = (t: TabType) => ({
    padding: '10px 20px',
    border: 'none',
    borderBottom: tab === t ? '3px solid #4f46e5' : '3px solid transparent',
    background: 'none',
    color: tab === t ? '#4f46e5' : '#64748b',
    fontWeight: tab === t ? 600 : 400,
    fontSize: '0.9rem',
    cursor: 'pointer' as const,
  });

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: '0 0 4px', color: '#1e293b' }}>Automated Risk Assessments</h1>
      <p style={{ color: '#64748b', marginBottom: 20 }}>Waterlow, MUST, and Falls risk scoring with traffic-light indicators</p>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: 24 }}>
        <button onClick={() => setTab('overview')} style={tabStyle('overview')}>Overview</button>
        <button onClick={() => setTab('overdue')} style={tabStyle('overdue')}>Overdue Reviews</button>
        <button onClick={() => setTab('calculate')} style={tabStyle('calculate')}>Calculate</button>
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.1)', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Resident</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Room</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Waterlow</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>MUST</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Falls</th>
              </tr>
            </thead>
            <tbody>
              {overview.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No assessment data available</td></tr>
              ) : (
                overview.map(r => (
                  <tr key={r.resident_id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedResidentId(r.resident_id); setTab('calculate'); }}>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontWeight: 500, fontSize: '0.85rem', color: '#1e293b' }}>{r.first_name} {r.last_name}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', color: '#64748b' }}>{r.room_number}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                      <TrafficLight score={r.waterlow_score} level={r.waterlow_level} />
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                      <TrafficLight score={r.must_score} level={r.must_level} />
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
                      <TrafficLight score={r.falls_score} level={r.falls_level} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Overdue Tab */}
      {tab === 'overdue' && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.1)', border: '1px solid #e2e8f0' }}>
          {overdue.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#10b981', padding: 20 }}>No overdue reviews. All assessments are up to date.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {overdue.map(a => {
                const daysOverdue = a.next_review_date ? Math.max(0, Math.floor((Date.now() - new Date(a.next_review_date).getTime()) / 86400000)) : 0;
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{a.resident_name || a.resident_id}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        <span style={{ textTransform: 'capitalize' }}>{a.assessment_type}</span> - Last assessed: {new Date(a.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ padding: '4px 10px', borderRadius: 8, background: '#dc2626', color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>
                      {daysOverdue} days overdue
                    </div>
                    <button onClick={() => {
                      if (a.assessment_type === 'waterlow') calcWaterlow.mutate(a.resident_id);
                      else if (a.assessment_type === 'falls') calcFalls.mutate(a.resident_id);
                    }} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#4f46e5', color: '#fff', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                      Recalculate
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Calculate Tab */}
      {tab === 'calculate' && (
        <div>
          {/* Resident selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Select Resident</label>
            <select value={selectedResidentId} onChange={e => setSelectedResidentId(e.target.value)} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem', minWidth: 300 }}>
              <option value="">Choose a resident...</option>
              {residentList.map((r: any) => (
                <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>
              ))}
            </select>
          </div>

          {/* Three assessment cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {/* Waterlow */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>Waterlow Score</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 16 }}>Pressure ulcer risk assessment. Evaluates BMI, skin type, mobility, nutrition, continence, tissue malnutrition, neurological deficit, and surgery/trauma.</p>
              <button onClick={() => selectedResidentId && calcWaterlow.mutate(selectedResidentId)} disabled={!selectedResidentId || calcWaterlow.isPending} style={{ padding: '8px 16px', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', opacity: (!selectedResidentId || calcWaterlow.isPending) ? 0.5 : 1 }}>
                {calcWaterlow.isPending ? 'Calculating...' : 'Auto-Calculate'}
              </button>
              {calcWaterlow.data && (
                <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Score: {(calcWaterlow.data as any).total_score}</div>
                  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600, background: RISK_COLORS[(calcWaterlow.data as any).risk_level] + '20', color: RISK_COLORS[(calcWaterlow.data as any).risk_level] }}>
                    {(calcWaterlow.data as any).risk_level}
                  </span>
                </div>
              )}
            </div>

            {/* MUST */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>MUST Score</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 16 }}>Malnutrition Universal Screening Tool. Requires BMI score, unplanned weight loss percentage, and acute disease effect.</p>
              <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 2 }}>BMI Score (0-2)</label>
                  <input type="number" value={mustBmi} onChange={e => setMustBmi(e.target.value)} placeholder="0, 1, or 2" style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 2 }}>Weight Loss % Score (0-2)</label>
                  <input type="number" value={mustWeightLoss} onChange={e => setMustWeightLoss(e.target.value)} placeholder="0, 1, or 2" style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.85rem' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={mustAcuteDisease} onChange={e => setMustAcuteDisease(e.target.checked)} />
                  Acute disease effect (adds 2)
                </label>
              </div>
              <button onClick={() => selectedResidentId && calcMUST.mutate({ residentId: selectedResidentId, bmi_score: Number(mustBmi), weight_loss_score: Number(mustWeightLoss), acute_disease: mustAcuteDisease })} disabled={!selectedResidentId || calcMUST.isPending} style={{ padding: '8px 16px', borderRadius: 8, background: '#f59e0b', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', opacity: (!selectedResidentId || calcMUST.isPending) ? 0.5 : 1 }}>
                {calcMUST.isPending ? 'Calculating...' : 'Calculate MUST'}
              </button>
              {calcMUST.data && (
                <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Score: {(calcMUST.data as any).total_score}</div>
                  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600, background: RISK_COLORS[(calcMUST.data as any).risk_level] + '20', color: RISK_COLORS[(calcMUST.data as any).risk_level] }}>
                    {(calcMUST.data as any).risk_level}
                  </span>
                </div>
              )}
            </div>

            {/* Falls */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>Falls Risk</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 16 }}>Multi-factorial falls risk assessment. Evaluates history of falls, medications, mobility, cognition, continence, and environmental factors.</p>
              <button onClick={() => selectedResidentId && calcFalls.mutate(selectedResidentId)} disabled={!selectedResidentId || calcFalls.isPending} style={{ padding: '8px 16px', borderRadius: 8, background: '#ef4444', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', opacity: (!selectedResidentId || calcFalls.isPending) ? 0.5 : 1 }}>
                {calcFalls.isPending ? 'Calculating...' : 'Auto-Calculate'}
              </button>
              {calcFalls.data && (
                <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Score: {(calcFalls.data as any).total_score}</div>
                  <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600, background: RISK_COLORS[(calcFalls.data as any).risk_level] + '20', color: RISK_COLORS[(calcFalls.data as any).risk_level] }}>
                    {(calcFalls.data as any).risk_level}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Resident assessment history */}
          {selectedResidentId && residentAssessments && (
            <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>Assessment History</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {(Array.isArray(residentAssessments) ? residentAssessments : []).map((a: RiskAssessment) => (
                  <div key={a.id} onClick={() => setDetailAssessment(a)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 150ms' }}>
                    <span style={{ textTransform: 'capitalize', fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', width: 80 }}>{a.assessment_type}</span>
                    <TrafficLight score={a.total_score} level={a.risk_level} />
                    <span style={{ fontSize: '0.8rem', color: '#64748b', flex: 1 }}>{new Date(a.created_at).toLocaleDateString()}</span>
                    <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600, background: a.status === 'current' ? '#dcfce7' : a.status === 'overdue' ? '#fef2f2' : '#f1f5f9', color: a.status === 'current' ? '#166534' : a.status === 'overdue' ? '#991b1b' : '#64748b' }}>{a.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {detailAssessment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDetailAssessment(null)}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 500, maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, textTransform: 'capitalize' }}>{detailAssessment.assessment_type} Assessment</h3>
              <button onClick={() => setDetailAssessment(null)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>x</button>
            </div>
            <div style={{ display: 'grid', gap: 8, fontSize: '0.85rem' }}>
              <div><strong>Score:</strong> {detailAssessment.total_score}</div>
              <div><strong>Risk Level:</strong> <span style={{ color: RISK_COLORS[detailAssessment.risk_level] }}>{detailAssessment.risk_level}</span></div>
              <div><strong>Assessed by:</strong> {detailAssessment.assessed_by_name || detailAssessment.assessed_by}</div>
              <div><strong>Date:</strong> {new Date(detailAssessment.created_at).toLocaleString()}</div>
              {detailAssessment.next_review_date && <div><strong>Next Review:</strong> {new Date(detailAssessment.next_review_date).toLocaleDateString()}</div>}
              {detailAssessment.auto_populated && <div style={{ color: '#059669' }}>Auto-populated from existing data</div>}
              {detailAssessment.factors && (
                <div style={{ marginTop: 8 }}>
                  <strong>Factors:</strong>
                  <pre style={{ background: '#f8fafc', padding: 10, borderRadius: 6, fontSize: '0.75rem', overflowX: 'auto', margin: '4px 0 0' }}>{JSON.stringify(detailAssessment.factors, null, 2)}</pre>
                </div>
              )}
              {detailAssessment.notes && <div><strong>Notes:</strong> {detailAssessment.notes}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
