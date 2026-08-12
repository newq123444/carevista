import React, { useState } from 'react';
import { useLang } from '../i18n';
import {
  useComplianceActions, useCreateComplianceAction, useUpdateComplianceAction,
  useCqcDomainScores, useCalculateCqcScores, useGenerateEvidencePack,
  useCqcEvidencePacks, usePolicyReviews, useCreatePolicyReview,
  useInspectionChecklist, useUpdateChecklistItem, useComplianceOverview,
  usePolicies,
} from '../hooks';
import { formatDate } from '../utils/formatters';
import type { ComplianceAction, CqcDomainScore, InspectionChecklist } from '../types';

const KLOE_DOMAINS = ['safe', 'effective', 'caring', 'responsive', 'well_led'] as const;
const DOMAIN_LABELS: Record<string, string> = { safe: 'Safe', effective: 'Effective', caring: 'Caring', responsive: 'Responsive', well_led: 'Well-led' };
const DOMAIN_ICONS: Record<string, string> = { safe: '🛡️', effective: '🎯', caring: '💜', responsive: '➡️', well_led: '⭐' };
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

export default function Compliance() {
  const [tab, setTab] = useState<'readiness' | 'evidence' | 'policies' | 'inspection' | 'actions'>('readiness');

  const tabs: [string, string][] = [
    ['readiness', '📊 CQC Readiness'],
    ['evidence', '📦 Evidence Packs'],
    ['policies', '📋 Policy Reviews'],
    ['inspection', '✅ Inspection Prep'],
    ['actions', '⚡ Actions'],
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">✅ CQC Compliance</h1>
          <p className="page-subtitle">Inspection readiness, evidence packs, and policy management</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k as any)} style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: `2px solid ${tab === k ? '#0d9488' : 'transparent'}`, color: tab === k ? '#0d9488' : 'var(--text-secondary)', fontWeight: tab === k ? 700 : 500, cursor: 'pointer', fontSize: 14, marginBottom: -2 }}>{l}</button>
        ))}
      </div>

      {tab === 'readiness' && <CqcReadinessTab />}
      {tab === 'evidence' && <EvidencePacksTab />}
      {tab === 'policies' && <PolicyReviewsTab />}
      {tab === 'inspection' && <InspectionPrepTab />}
      {tab === 'actions' && <ActionsTab />}
    </div>
  );
}

// ── Tab 1: CQC Readiness ──────────────────────────────────────────────────
function CqcReadinessTab() {
  const { t: tr } = useLang();
  const { data: scores = [], isLoading: scoresLoading } = useCqcDomainScores();
  const { data: overview } = useComplianceOverview();
  const calculateScores = useCalculateCqcScores();

  const domainScores: CqcDomainScore[] = Array.isArray(scores) ? scores : [];
  const overallScore = overview?.overall_readiness_score ?? (domainScores.length > 0 ? Math.round(domainScores.reduce((sum: number, d: CqcDomainScore) => sum + d.score, 0) / domainScores.length) : 0);
  const overallColor = overallScore >= 70 ? '#16a34a' : overallScore >= 40 ? '#d97706' : '#dc2626';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Overall Score */}
      <div className="card">
        <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px' }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Overall CQC Readiness</div>
            <div style={{ fontSize: 48, fontWeight: 900, color: overallColor }}>{overallScore}%</div>
            {overview && (
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>Overdue policies: <strong style={{ color: '#dc2626' }}>{overview.overdue_policies_count}</strong></span>
                <span>Expiring training: <strong style={{ color: '#d97706' }}>{overview.expiring_training_count}</strong></span>
                <span>Open actions: <strong style={{ color: '#0d9488' }}>{overview.open_actions_count}</strong></span>
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => calculateScores.mutate()} disabled={calculateScores.isPending}>
            {calculateScores.isPending ? '⏳ Calculating...' : '🔄 Calculate Scores'}
          </button>
        </div>
      </div>

      {scoresLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading domain scores...</div>}

      {/* Domain Score Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {domainScores.map((d: CqcDomainScore) => {
          const color = d.score >= 70 ? '#16a34a' : d.score >= 40 ? '#d97706' : '#dc2626';
          const icon = DOMAIN_ICONS[d.domain] || '📊';
          const label = DOMAIN_LABELS[d.domain] || d.domain;
          return (
            <div key={d.id} className="card" style={{ borderTop: `3px solid ${color}` }}>
              <div className="card-body" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 22 }}>{icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.evidence_count} evidence / {d.gaps_count} gaps</div>
                </div>

                {/* Circular progress using conic-gradient */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                  <div style={{ width: 70, height: 70, borderRadius: '50%', background: `conic-gradient(${color} ${d.score * 3.6}deg, #e5e7eb ${d.score * 3.6}deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, color }}>{d.score}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Score out of 100</div>
                    <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${d.score}%`, background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                </div>

                {/* Strengths */}
                {d.strengths && d.strengths.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginBottom: 4 }}>{tr('Strengths')}</div>
                    {d.strengths.slice(0, 3).map((s, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#15803d', paddingLeft: 10, marginBottom: 2 }}>+ {s}</div>
                    ))}
                  </div>
                )}

                {/* Weaknesses */}
                {d.weaknesses && d.weaknesses.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>Weaknesses</div>
                    {d.weaknesses.slice(0, 3).map((w, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#b91c1c', paddingLeft: 10, marginBottom: 2 }}>- {w}</div>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {d.recommendations && d.recommendations.length > 0 && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', marginBottom: 4 }}>{tr('Recommendations')}</div>
                    {d.recommendations.slice(0, 3).map((r, i) => (
                      <div key={i} style={{ fontSize: 12, color: '#0d9488', paddingLeft: 10, marginBottom: 2 }}>&#8226; {r}</div>
                    ))}
                  </div>
                )}

                {d.calculated_at && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>Last calculated: {formatDate(d.calculated_at)}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!scoresLoading && domainScores.length === 0 && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No CQC scores calculated yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Click "Calculate Scores" to generate domain readiness scores based on your current evidence and compliance data.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 2: Evidence Packs ─────────────────────────────────────────────────
function EvidencePacksTab() {
  const { data: packs = [], isLoading } = useCqcEvidencePacks();
  const generatePack = useGenerateEvidencePack();
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  const toggleDomain = (d: string) => {
    setSelectedDomains(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleGenerate = () => {
    if (selectedDomains.length === 0 || !dateStart || !dateEnd) return;
    generatePack.mutate({ domains: selectedDomains, date_range_start: dateStart, date_range_end: dateEnd });
  };

  const packList = Array.isArray(packs) ? packs : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Generate new pack */}
      <div className="card">
        <div className="card-header"><span className="card-title">📦 Generate Evidence Pack</span></div>
        <div className="card-body">
          <div style={{ marginBottom: 14 }}>
            <label className="form-label">Select Domains</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {KLOE_DOMAINS.map(d => (
                <label key={d} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `2px solid ${selectedDomains.includes(d) ? '#0d9488' : 'var(--border)'}`, background: selectedDomains.includes(d) ? '#eff6ff' : 'white', cursor: 'pointer', fontSize: 13, fontWeight: selectedDomains.includes(d) ? 700 : 400 }}>
                  <input type="checkbox" checked={selectedDomains.includes(d)} onChange={() => toggleDomain(d)} style={{ display: 'none' }} />
                  {DOMAIN_ICONS[d]} {DOMAIN_LABELS[d]}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'flex-end' }}>
            <div>
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={dateStart} onChange={e => setDateStart(e.target.value)} />
            </div>
            <div>
              <label className="form-label">End Date</label>
              <input type="date" className="form-input" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generatePack.isPending || selectedDomains.length === 0 || !dateStart || !dateEnd}>
              {generatePack.isPending ? '⏳ Generating...' : '📦 Generate'}
            </button>
          </div>
        </div>
      </div>

      {/* Existing packs list */}
      <div className="card">
        <div className="card-header"><span className="card-title">📋 Evidence Packs</span></div>
        {isLoading ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 30 }}>Loading...</div>
        ) : packList.length === 0 ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No evidence packs generated yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {packList.map((pack: any) => {
              const statusColor = pack.status === 'complete' ? '#16a34a' : pack.status === 'generating' ? '#d97706' : '#dc2626';
              return (
                <div key={pack.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                      {(pack.domains_included || []).map((d: string) => (
                        <span key={d} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#eff6ff', color: '#0d9488', fontWeight: 600 }}>{DOMAIN_LABELS[d] || d}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {pack.date_range_start && pack.date_range_end ? `${formatDate(pack.date_range_start)} - ${formatDate(pack.date_range_end)}` : 'No date range'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 10, background: statusColor + '15', color: statusColor, fontWeight: 700 }}>{pack.status}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pack.created_at ? formatDate(pack.created_at) : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 3: Policy Reviews ─────────────────────────────────────────────────
function PolicyReviewsTab() {
  const { t: tr } = useLang();
  const { data: reviews = [], isLoading } = usePolicyReviews();
  const { data: policies = [] } = usePolicies();
  const createReview = useCreatePolicyReview();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ policy_id: '', next_review_date: '', changes_made: '', notes: '' });

  const reviewList = Array.isArray(reviews) ? reviews : [];
  const policyList = Array.isArray(policies) ? policies : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createReview.mutateAsync(form);
    setShowForm(false);
    setForm({ policy_id: '', next_review_date: '', changes_made: '', notes: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Record Review'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ border: '2px solid #3b82f6' }}>
          <div className="card-header"><span className="card-title">Record Policy Review</span></div>
          <div className="card-body">
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label className="form-label">{tr('Policy')}</label>
                <select className="form-input" required value={form.policy_id} onChange={e => setForm(f => ({ ...f, policy_id: e.target.value }))}>
                  <option value="">Select policy...</option>
                  {policyList.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Next Review Date</label>
                <input type="date" className="form-input" value={form.next_review_date} onChange={e => setForm(f => ({ ...f, next_review_date: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Changes Made</label>
                <textarea className="form-input" rows={2} value={form.changes_made} onChange={e => setForm(f => ({ ...f, changes_made: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label className="form-label">{tr('Notes')}</label>
                <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <button type="submit" className="btn btn-primary" disabled={createReview.isPending}>{createReview.isPending ? 'Saving...' : 'Submit Review'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Policy reviews table */}
      <div className="card">
        <div className="card-header"><span className="card-title">📋 Policy Reviews</span></div>
        {isLoading ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 30 }}>Loading...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface-2)' }}>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600 }}>Policy Title</th>
                  <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600 }}>Reviewer</th>
                  <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 600 }}>Review Date</th>
                  <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 600 }}>Next Review</th>
                  <th style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 600 }}>{tr('Status')}</th>
                </tr>
              </thead>
              <tbody>
                {reviewList.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>No policy reviews recorded</td></tr>
                ) : reviewList.map((r: any) => {
                  const isOverdue = r.next_review_date && new Date(r.next_review_date) < new Date();
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 14px', fontWeight: 600 }}>{r.policy_title || 'Unknown'}</td>
                      <td style={{ padding: '8px 14px' }}>{r.reviewer_name || '-'}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>{r.review_date ? formatDate(r.review_date) : '-'}</td>
                      <td style={{ padding: '8px 14px', textAlign: 'center', color: isOverdue ? '#dc2626' : 'inherit', fontWeight: isOverdue ? 700 : 400 }}>
                        {r.next_review_date ? formatDate(r.next_review_date) : '-'}
                        {isOverdue && ' ⚠️'}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: r.status === 'completed' ? '#f0fdf4' : '#fffbeb', color: r.status === 'completed' ? '#16a34a' : '#d97706', fontWeight: 700 }}>{r.status || 'pending'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 4: Inspection Prep ────────────────────────────────────────────────
function InspectionPrepTab() {
  const [selectedDomain, setSelectedDomain] = useState<string>('safe');
  const { data: checklist, isLoading } = useInspectionChecklist(selectedDomain);
  const updateItem = useUpdateChecklistItem();

  const checklistData: InspectionChecklist | null = checklist && !Array.isArray(checklist) ? checklist as InspectionChecklist : (Array.isArray(checklist) && checklist.length > 0 ? checklist[0] : null);
  const items = checklistData?.items || [];
  const completedCount = items.filter((item: any) => item.completed).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const progressColor = progress >= 80 ? '#16a34a' : progress >= 50 ? '#d97706' : '#dc2626';

  const handleToggle = (index: number, completed: boolean) => {
    if (checklistData) {
      updateItem.mutate({ id: checklistData.id, data: { itemIndex: index, completed: !completed } });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Domain selector */}
      <div className="card">
        <div className="card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {KLOE_DOMAINS.map(d => (
            <button key={d} onClick={() => setSelectedDomain(d)} style={{ padding: '8px 16px', borderRadius: 8, border: `2px solid ${selectedDomain === d ? '#0d9488' : 'var(--border)'}`, background: selectedDomain === d ? '#eff6ff' : 'white', color: selectedDomain === d ? '#0d9488' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: selectedDomain === d ? 700 : 500 }}>
              {DOMAIN_ICONS[d]} {DOMAIN_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div className="card">
        <div className="card-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{DOMAIN_ICONS[selectedDomain]} {DOMAIN_LABELS[selectedDomain]} - Inspection Checklist</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: progressColor }}>{completedCount}/{totalCount} complete ({progress}%)</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: '#e5e7eb', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: progressColor, borderRadius: 5, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      {/* Checklist items */}
      <div className="card">
        {isLoading ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 30 }}>Loading checklist...</div>
        ) : items.length === 0 ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No checklist items for this domain. Click "Calculate Scores" in the Readiness tab to generate checklists.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((item: any, idx: number) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 18px', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => handleToggle(idx, item.completed)}>
                <div style={{ width: 22, height: 22, borderRadius: 4, border: `2px solid ${item.completed ? '#16a34a' : '#d1d5db'}`, background: item.completed ? '#16a34a' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  {item.completed && <span style={{ color: 'white', fontSize: 14, fontWeight: 700 }}>&#10003;</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)' }}>{item.title}</div>
                  {item.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{item.description}</div>}
                  {item.evidence && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Evidence: {item.evidence}</div>}
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: '#eff6ff', color: '#0d9488', fontWeight: 600, whiteSpace: 'nowrap', marginTop: 2 }}>{DOMAIN_LABELS[selectedDomain] || selectedDomain}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 5: Actions ────────────────────────────────────────────────────────
function ActionsTab() {
  const { t: tr } = useLang();
  const { data: actions = [], isLoading } = useComplianceActions();
  const createAction = useCreateComplianceAction();
  const updateAction = useUpdateComplianceAction();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ title: '', description: '', category: 'Safe', priority: 'medium', due_date: '' });

  const arr = Array.isArray(actions) ? actions as ComplianceAction[] : [];
  const filtered = arr.filter(a => !filterStatus || a.status === filterStatus);
  const overdue = arr.filter(a => a.due_date && new Date(a.due_date) < new Date() && a.status !== 'closed').length;
  const open = arr.filter(a => a.status !== 'closed').length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAction.mutateAsync(form);
    setShowCreate(false);
    setForm({ title: '', description: '', category: 'Safe', priority: 'medium', due_date: '' });
  };

  const pc = (p: string) => p === 'critical' ? '#7c3aed' : p === 'high' ? '#dc2626' : p === 'medium' ? '#d97706' : '#16a34a';
  const pb = (p: string) => p === 'critical' ? '#f5f3ff' : p === 'high' ? '#fef2f2' : p === 'medium' ? '#fffbeb' : '#f0fdf4';
  const sc = (s: string) => s === 'closed' ? '#16a34a' : s === 'in_progress' ? '#0d9488' : '#d97706';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{open} open · {overdue} overdue</div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Add Action</button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 20, border: '2px solid #3b82f6' }}>
          <div className="card-header"><span className="card-title">+ New Compliance Action</span><button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>&#10005;</button></div>
          <div className="card-body">
            <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1/-1' }}><label className="form-label">Title *</label><input type="text" className="form-input" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Action title..." /></div>
              <div><label className="form-label">{tr('Domain')}</label><select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{['Safe', 'Effective', 'Caring', 'Responsive', 'Well-led'].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
              <div><label className="form-label">{tr('Priority')}</label><select className="form-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>{PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
              <div><label className="form-label">Due Date</label><input type="date" className="form-input" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              <div></div>
              <div style={{ gridColumn: '1/-1' }}><label className="form-label">{tr('Description')}</label><textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} /></div>
              <div style={{ gridColumn: '1/-1' }}><button type="submit" className="btn btn-primary" disabled={createAction.isPending}>{createAction.isPending ? 'Saving...' : 'Create Action'}</button></div>
            </form>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-body" style={{ display: 'flex', gap: 10 }}>
          {['', 'open', 'in_progress', 'closed'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${filterStatus === s ? '#3b82f6' : 'var(--border)'}`, background: filterStatus === s ? '#eff6ff' : 'white', color: filterStatus === s ? '#0d9488' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: filterStatus === s ? 700 : 400 }}>{s || 'All'}</button>
          ))}
        </div>
      </div>

      {isLoading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((a: ComplianceAction) => (
            <div key={a.id} className="card" style={{ borderLeft: `4px solid ${pc(a.priority)}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 18px', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{a.title}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: pb(a.priority), color: pc(a.priority), fontWeight: 700 }}>{a.priority}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--surface-2)', color: sc(a.status), fontWeight: 700 }}>{a.status.replace('_', ' ')}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#eff6ff', color: '#0d9488', fontWeight: 700 }}>{a.category}</span>
                  </div>
                  {a.description && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>{a.description}</div>}
                  {a.due_date && <div style={{ fontSize: 12, color: new Date(a.due_date) < new Date() && a.status !== 'closed' ? '#dc2626' : 'var(--text-muted)' }}>Due: {formatDate(a.due_date)}{new Date(a.due_date) < new Date() && a.status !== 'closed' ? ' OVERDUE' : ''}</div>}
                </div>
                {a.status !== 'closed' && (
                  <button onClick={() => updateAction.mutateAsync({ id: a.id, data: { status: a.status === 'open' ? 'in_progress' : 'closed' } })} className="btn btn-ghost btn-sm">
                    {a.status === 'open' ? '▶ Start' : '✅ Close'}
                  </button>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No compliance actions found</div>}
        </div>
      )}
    </div>
  );
}
