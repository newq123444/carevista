// src/pages/AdmissionMatching.tsx - Predictive Admission Matching
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

function scoreColor(score: number): string {
  if (score >= 70) return '#16a34a';
  if (score >= 50) return '#d97706';
  return '#dc2626';
}

export default function AdmissionMatching() {
  const [tab, setTab] = useState<'referrals' | 'new' | 'result'>('referrals');
  const [matchResult, setMatchResult] = useState<any>(null);
  const [form, setForm] = useState({ name: '', dateOfBirth: '', referralSource: '', mobility: 'independent', behavior: 'settled', urgency: 'routine', medicalHistory: '', careNeeds: { nursingCare: false, dementiaCare: false, palliative: false } });
  const queryClient = useQueryClient();

  const { data: referrals, isLoading } = useQuery({ queryKey: ['admission-referrals'], queryFn: () => api.get('/admissions/referrals').then(r => r.data) });

  const createReferral = useMutation({
    mutationFn: (data: any) => api.post('/admissions/referrals', data).then(r => r.data),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['admission-referrals'] }); matchMutation.mutate({ referralId: data.id, careNeeds: form.careNeeds, mobility: form.mobility, behavior: form.behavior }); },
  });

  const matchMutation = useMutation({
    mutationFn: (data: any) => api.post('/admissions/match', data).then(r => r.data),
    onSuccess: (data) => { setMatchResult(data); setTab('result'); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createReferral.mutate(form);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🎯 Predictive Admission Matching</h1>
          <p className="page-subtitle">AI-powered referral analysis against home capabilities, staff skills, and resident mix</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {([['referrals', '📋 Referrals'], ['new', '➕ New Referral'], ['result', '📊 Match Result']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: `2px solid ${tab === k ? '#0d9488' : 'transparent'}`, color: tab === k ? '#0d9488' : 'var(--text-secondary)', fontWeight: tab === k ? 700 : 500, cursor: 'pointer', fontSize: 14, marginBottom: -2 }}>{l}</button>
        ))}
      </div>

      {tab === 'referrals' && (
        <div>
          {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading referrals...</div>}
          <div style={{ display: 'grid', gap: 12 }}>
            {referrals?.map((ref: any) => (
              <div key={ref.id} className="card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{ref.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Source: {ref.referral_source || 'Unknown'} | Mobility: {ref.mobility || 'N/A'} | Urgency: {ref.urgency}</div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ref.status === 'accepted' ? '#dcfce7' : ref.status === 'declined' ? '#fef2f2' : '#fef3c7', color: ref.status === 'accepted' ? '#16a34a' : ref.status === 'declined' ? '#dc2626' : '#d97706' }}>{ref.status?.toUpperCase()}</span>
              </div>
            ))}
            {referrals?.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No referrals yet. Create one to get a match score.</div>}
          </div>
        </div>
      )}

      {tab === 'new' && (
        <form onSubmit={handleSubmit} style={{ maxWidth: 600 }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Referral Details</h3>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Date of Birth</label>
                  <input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Referral Source</label>
                  <input value={form.referralSource} onChange={e => setForm({ ...form, referralSource: e.target.value })} placeholder="e.g. Hospital, GP" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Mobility</label>
                  <select value={form.mobility} onChange={e => setForm({ ...form, mobility: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}>
                    <option value="independent">Independent</option><option value="walking_aid">Walking Aid</option><option value="wheelchair">Wheelchair</option><option value="bed_bound">Bed Bound</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Behavior</label>
                  <select value={form.behavior} onChange={e => setForm({ ...form, behavior: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}>
                    <option value="settled">Settled</option><option value="anxious">Anxious</option><option value="challenging">Challenging</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Urgency</label>
                  <select value={form.urgency} onChange={e => setForm({ ...form, urgency: e.target.value })} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}>
                    <option value="routine">Routine</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 4 }}>Medical History</label>
                <textarea value={form.medicalHistory} onChange={e => setForm({ ...form, medicalHistory: e.target.value })} rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, resize: 'vertical' }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>Care Needs</label>
                <div style={{ display: 'flex', gap: 16 }}>
                  {(['nursingCare', 'dementiaCare', 'palliative'] as const).map(need => (
                    <label key={need} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <input type="checkbox" checked={(form.careNeeds as any)[need]} onChange={e => setForm({ ...form, careNeeds: { ...form.careNeeds, [need]: e.target.checked } })} />
                      {need.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button type="submit" disabled={!form.name || createReferral.isPending} style={{ marginTop: 20, padding: '12px 24px', background: 'linear-gradient(135deg, #0d9488, #3b82f6)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
              {createReferral.isPending ? '⏳ Analyzing...' : '🎯 Submit & Run Match Analysis'}
            </button>
          </div>
        </form>
      )}

      {tab === 'result' && matchResult && (
        <div style={{ maxWidth: 700 }}>
          <div className="card" style={{ padding: 24, marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: scoreColor(matchResult.overall_score) }}>{matchResult.overall_score}%</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Overall Match Score</div>
            <div style={{ marginTop: 12, padding: '8px 20px', display: 'inline-block', borderRadius: 20, background: matchResult.recommendation === 'accept' ? '#dcfce7' : matchResult.recommendation === 'decline' ? '#fef2f2' : '#fef3c7', color: matchResult.recommendation === 'accept' ? '#16a34a' : matchResult.recommendation === 'decline' ? '#dc2626' : '#d97706', fontWeight: 700, fontSize: 14 }}>
              Recommendation: {matchResult.recommendation?.toUpperCase()}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {matchResult.reasoning?.map((r: any, i: number) => (
              <div key={i} className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.area}</span>
                  <span style={{ fontWeight: 700, color: scoreColor(r.score) }}>{r.score}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${r.score}%`, borderRadius: 3, background: scoreColor(r.score), transition: 'width 0.5s' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{r.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
