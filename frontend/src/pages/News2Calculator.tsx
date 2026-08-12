// src/pages/News2Calculator.tsx — NEWS2 Early Warning Score Calculator
import React, { useState, useMemo } from 'react';
import { useLang } from '../i18n';
import { useResidents, useNews2Calculate, useNews2History, useNews2Escalations, useRespondToEscalation, useNews2Trend } from '../hooks';
import type { Resident, News2Assessment, News2Escalation } from '../types';

// NEWS2 scoring functions
function scoreRespRate(rr: number): number {
  if (rr <= 8) return 3;
  if (rr <= 11) return 1;
  if (rr <= 20) return 0;
  if (rr <= 24) return 2;
  return 3;
}
function scoreSpo2(spo2: number, onO2: boolean): number {
  if (!onO2) {
    if (spo2 <= 91) return 3;
    if (spo2 <= 93) return 2;
    if (spo2 <= 95) return 1;
    return 0;
  }
  // Scale 2 for supplemental O2
  if (spo2 >= 97) return 0;
  if (spo2 >= 95) return 1;
  if (spo2 >= 93) return 2;
  return 3;
}
function scoreSupplementalO2(onO2: boolean): number {
  return onO2 ? 2 : 0;
}
function scoreSystolicBP(bp: number): number {
  if (bp <= 90) return 3;
  if (bp <= 100) return 2;
  if (bp <= 110) return 1;
  if (bp <= 219) return 0;
  return 3;
}
function scorePulse(pulse: number): number {
  if (pulse <= 40) return 3;
  if (pulse <= 50) return 1;
  if (pulse <= 90) return 0;
  if (pulse <= 110) return 1;
  if (pulse <= 130) return 2;
  return 3;
}
function scoreConsciousness(c: string): number {
  return c === 'alert' ? 0 : 3;
}
function scoreTemperature(t: number): number {
  if (t <= 35.0) return 3;
  if (t <= 36.0) return 1;
  if (t <= 38.0) return 0;
  if (t <= 39.0) return 1;
  return 2;
}
function getRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score <= 4) return 'low';
  if (score <= 6) return 'medium';
  if (score <= 8) return 'high';
  return 'critical';
}
function getRiskColor(score: number): string {
  if (score <= 4) return '#10b981';
  if (score <= 6) return '#f59e0b';
  return '#dc2626';
}

export default function News2Calculator() {
  const { t: tr } = useLang();
  const { data: residents = [] } = useResidents();
  const [selectedResident, setSelectedResident] = useState('');
  const { data: history } = useNews2History(selectedResident);
  const { data: escalations } = useNews2Escalations({ status: 'pending' });
  const { data: trendData } = useNews2Trend(selectedResident, 30);
  const calculateMutation = useNews2Calculate();
  const respondMutation = useRespondToEscalation();

  // Form state
  const [respiratoryRate, setRespiratoryRate] = useState<number>(16);
  const [spo2, setSpo2] = useState<number>(96);
  const [supplementalOxygen, setSupplementalOxygen] = useState(false);
  const [systolicBP, setSystolicBP] = useState<number>(120);
  const [pulse, setPulse] = useState<number>(72);
  const [consciousness, setConsciousness] = useState<string>('alert');
  const [temperature, setTemperature] = useState<number>(37.0);
  const [notes, setNotes] = useState('');

  // Real-time score calculation
  const scores = useMemo(() => {
    const rr = scoreRespRate(respiratoryRate);
    const sp = scoreSpo2(spo2, supplementalOxygen);
    const o2 = scoreSupplementalO2(supplementalOxygen);
    const bp = scoreSystolicBP(systolicBP);
    const p = scorePulse(pulse);
    const c = scoreConsciousness(consciousness);
    const t = scoreTemperature(temperature);
    const total = rr + sp + o2 + bp + p + c + t;
    return { rr, sp, o2, bp, p, c, t, total };
  }, [respiratoryRate, spo2, supplementalOxygen, systolicBP, pulse, consciousness, temperature]);

  const riskLevel = getRiskLevel(scores.total);
  const riskColor = getRiskColor(scores.total);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResident) return;
    calculateMutation.mutate({
      residentId: selectedResident,
      respiratoryRate,
      spo2,
      supplementalOxygen,
      systolicBp: systolicBP,
      pulse,
      consciousness,
      temperature,
      notes: notes || undefined,
    });
  };

  const handleRespond = (id: string) => {
    respondMutation.mutate({ id, data: { status: 'acknowledged', action_taken: 'Reviewed and acknowledged' } });
  };

  // Simple SVG trend chart
  const trendPoints = useMemo(() => {
    const items = Array.isArray(trendData) ? trendData : [];
    if (items.length === 0) return '';
    const maxScore = Math.max(12, ...items.map((i: any) => i.total_score || 0));
    const w = 400;
    const h = 120;
    return items.map((item: any, idx: number) => {
      const x = (idx / Math.max(items.length - 1, 1)) * w;
      const y = h - ((item.total_score || 0) / maxScore) * h;
      return `${x},${y}`;
    }).join(' ');
  }, [trendData]);

  const historyList: News2Assessment[] = Array.isArray(history) ? history : [];
  const escalationList: News2Escalation[] = Array.isArray(escalations) ? escalations : [];

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 8 }}>NEWS2 Early Warning Score</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>National Early Warning Score 2 - auto-calculated with clinical escalation</p>

      {/* Resident Selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Select Resident</label>
        <select
          value={selectedResident}
          onChange={e => setSelectedResident(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #d1d5db', width: '100%', maxWidth: 400, fontSize: '0.95rem' }}
        >
          <option value="">-- Choose resident --</option>
          {(residents as Resident[]).map(r => (
            <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
        {/* Vitals Form */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Vital Signs Entry</h2>
          <form onSubmit={handleSubmit}>
            {/* Respiratory Rate */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 500, fontSize: '0.9rem' }}>Respiratory Rate (breaths/min)</label>
                <span style={{ background: scores.rr > 0 ? '#fef3c7' : '#d1fae5', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>Score: {scores.rr}</span>
              </div>
              <input type="number" value={respiratoryRate} onChange={e => setRespiratoryRate(Number(e.target.value))} min={0} max={60} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4 }} />
            </div>

            {/* SpO2 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 500, fontSize: '0.9rem' }}>SpO2 (%)</label>
                <span style={{ background: scores.sp > 0 ? '#fef3c7' : '#d1fae5', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>Score: {scores.sp}</span>
              </div>
              <input type="number" value={spo2} onChange={e => setSpo2(Number(e.target.value))} min={50} max={100} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4 }} />
            </div>

            {/* Supplemental Oxygen */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 500, fontSize: '0.9rem' }}>Supplemental Oxygen</label>
                <span style={{ background: scores.o2 > 0 ? '#fef3c7' : '#d1fae5', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>Score: {scores.o2}</span>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={supplementalOxygen} onChange={e => setSupplementalOxygen(e.target.checked)} style={{ width: 18, height: 18 }} />
                <span style={{ fontSize: '0.9rem' }}>Patient is on supplemental O2</span>
              </label>
            </div>

            {/* Systolic BP */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 500, fontSize: '0.9rem' }}>Systolic BP (mmHg)</label>
                <span style={{ background: scores.bp > 0 ? '#fef3c7' : '#d1fae5', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>Score: {scores.bp}</span>
              </div>
              <input type="number" value={systolicBP} onChange={e => setSystolicBP(Number(e.target.value))} min={50} max={300} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4 }} />
            </div>

            {/* Pulse */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 500, fontSize: '0.9rem' }}>Pulse (bpm)</label>
                <span style={{ background: scores.p > 0 ? '#fef3c7' : '#d1fae5', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>Score: {scores.p}</span>
              </div>
              <input type="number" value={pulse} onChange={e => setPulse(Number(e.target.value))} min={20} max={220} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4 }} />
            </div>

            {/* Consciousness */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 500, fontSize: '0.9rem' }}>Consciousness (ACVPU)</label>
                <span style={{ background: scores.c > 0 ? '#fef3c7' : '#d1fae5', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>Score: {scores.c}</span>
              </div>
              <select value={consciousness} onChange={e => setConsciousness(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4 }}>
                <option value="alert">Alert</option>
                <option value="confusion">Confusion (new)</option>
                <option value="voice">Voice responsive</option>
                <option value="pain">Pain responsive</option>
                <option value="unresponsive">Unresponsive</option>
              </select>
            </div>

            {/* Temperature */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontWeight: 500, fontSize: '0.9rem' }}>Temperature (C)</label>
                <span style={{ background: scores.t > 0 ? '#fef3c7' : '#d1fae5', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600 }}>Score: {scores.t}</span>
              </div>
              <input type="number" step="0.1" value={temperature} onChange={e => setTemperature(Number(e.target.value))} min={30} max={45} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4 }} />
            </div>

            {/* Notes */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 500, fontSize: '0.9rem' }}>Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #d1d5db', marginTop: 4, resize: 'vertical' }} />
            </div>

            <button
              type="submit"
              disabled={!selectedResident || calculateMutation.isPending}
              style={{ width: '100%', padding: '12px', borderRadius: 8, background: '#0d9488', color: '#fff', fontWeight: 600, border: 'none', cursor: selectedResident ? 'pointer' : 'not-allowed', opacity: selectedResident ? 1 : 0.5, fontSize: '0.95rem' }}
            >
              {calculateMutation.isPending ? 'Calculating...' : 'Calculate & Save NEWS2'}
            </button>
          </form>
        </div>

        {/* Score Display & Trend */}
        <div>
          {/* Live Score */}
          <div style={{ background: riskColor + '15', borderRadius: 12, padding: 24, border: `2px solid ${riskColor}`, marginBottom: 24, textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: riskColor }}>{scores.total}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 600, color: riskColor, textTransform: 'uppercase' }}>
              {riskLevel} Risk
            </div>
            <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#6b7280' }}>
              {scores.total <= 4 && 'Continue routine monitoring'}
              {scores.total >= 5 && scores.total <= 6 && 'Increase monitoring frequency - alert nurse in charge'}
              {scores.total >= 7 && 'Urgent clinical review required - consider 999'}
            </div>
          </div>

          {/* Trend Chart */}
          {selectedResident && trendPoints && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', marginBottom: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>30-Day Score Trend</h3>
              <svg viewBox="0 0 400 140" style={{ width: '100%', height: 140 }}>
                {/* Grid lines */}
                <line x1="0" y1="30" x2="400" y2="30" stroke="#fee2e2" strokeWidth="1" strokeDasharray="4" />
                <line x1="0" y1="60" x2="400" y2="60" stroke="#fef3c7" strokeWidth="1" strokeDasharray="4" />
                <line x1="0" y1="90" x2="400" y2="90" stroke="#d1fae5" strokeWidth="1" strokeDasharray="4" />
                <text x="402" y="34" fontSize="9" fill="#dc2626">7+</text>
                <text x="402" y="64" fontSize="9" fill="#f59e0b">5-6</text>
                <text x="402" y="94" fontSize="9" fill="#10b981">0-4</text>
                <polyline
                  points={trendPoints}
                  fill="none"
                  stroke="#0d9488"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}

          {/* Escalation Alerts */}
          {escalationList.length > 0 && (
            <div style={{ background: '#fef2f2', borderRadius: 12, padding: 16, border: '1px solid #fca5a5', marginBottom: 24 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#dc2626', marginBottom: 12 }}>Pending Escalations</h3>
              {escalationList.map((esc: News2Escalation) => (
                <div key={esc.id} style={{ padding: 12, background: '#fff', borderRadius: 8, marginBottom: 8, border: '1px solid #fecaca' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{esc.resident_name || 'Resident'}</span>
                      <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 12, background: '#dc262620', color: '#dc2626', fontSize: '0.75rem', fontWeight: 600 }}>{esc.escalation_level}</span>
                    </div>
                    <button
                      onClick={() => handleRespond(esc.id)}
                      style={{ padding: '6px 12px', borderRadius: 6, background: '#0d9488', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                    >
                      Acknowledge
                    </button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>
                    {new Date(esc.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* History Table */}
      {selectedResident && historyList.length > 0 && (
        <div style={{ marginTop: 24, background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Assessment History</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>{tr('Date')}</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600 }}>RR</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600 }}>SpO2</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600 }}>BP</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600 }}>{tr('Pulse')}</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600 }}>Temp</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600 }}>{tr('Total')}</th>
                  <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: 600 }}>{tr('Risk')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>Assessed By</th>
                </tr>
              </thead>
              <tbody>
                {historyList.map((a: News2Assessment) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 8px' }}>{new Date(a.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>{a.respiratory_rate}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>{a.spo2}%</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>{a.systolic_bp}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>{a.pulse}</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>{a.temperature}C</td>
                    <td style={{ textAlign: 'center', padding: '10px 8px' }}>
                      <span style={{ padding: '2px 10px', borderRadius: 12, background: getRiskColor(a.total_score) + '20', color: getRiskColor(a.total_score), fontWeight: 700 }}>
                        {a.total_score}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', padding: '10px 8px', textTransform: 'capitalize' }}>{a.risk_level}</td>
                    <td style={{ padding: '10px 8px' }}>{a.assessed_by_name || 'Staff'}</td>
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
