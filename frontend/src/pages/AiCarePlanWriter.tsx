// src/pages/AiCarePlanWriter.tsx - AI Care Plan Writer
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';

// ── Error Boundary ────────────────────────────────────────────────────────
class AiCarePlanErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            The AI Care Plan Writer encountered an error. Please try refreshing.
          </div>
          <button onClick={() => window.location.reload()} style={{ padding: '8px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AiCarePlanWriter() {
  return (
    <AiCarePlanErrorBoundary>
      <AiCarePlanWriterInner />
    </AiCarePlanErrorBoundary>
  );
}

function AiCarePlanWriterInner() {
  const { t: tr } = useLang();
  const [tab, setTab] = useState<'generate' | 'plans'>('generate');
  const [selectedResident, setSelectedResident] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: residents } = useQuery({ queryKey: ['residents'], queryFn: () => api.get('/residents').then(r => r.data?.residents ?? r.data ?? []) });
  const { data: plans, isLoading: plansLoading, isError: isPlansError } = useQuery({ queryKey: ['ai-care-plans'], queryFn: () => api.get('/ai/care-plans').then(r => r.data) });

  const generateMutation = useMutation({
    mutationFn: (data: any) => api.post('/ai/care-plan/generate', data).then(r => r.data),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['ai-care-plans'] }); setSelectedPlan(data); setTab('plans'); },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/ai/care-plans/${id}/approve`, { status }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-care-plans'] }),
  });

  const handleGenerate = () => {
    if (!selectedResident) return;
    generateMutation.mutate({ residentId: selectedResident });
  };

  const cqcDomainColors: Record<string, string> = { safe: '#dc2626', effective: '#0d9488', caring: '#ec4899', responsive: '#d97706', well_led: '#7c3aed' };

  // Safe content parser - handles both pre-parsed objects and JSON strings
  const getContent = (plan: any): any => {
    if (!plan?.content) return null;
    if (typeof plan.content === 'object') return plan.content;
    try { return JSON.parse(plan.content); } catch { return null; }
  };

  const selectedPlanContent = getContent(selectedPlan);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🤖 AI Care Plan Writer</h1>
          <p className="page-subtitle">Generate CQC-compliant care plans from assessment data using AI</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {([['generate', '✨ Generate New'], ['plans', '📋 Care Plans']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: `2px solid ${tab === k ? '#7c3aed' : 'transparent'}`, color: tab === k ? '#7c3aed' : 'var(--text-secondary)', fontWeight: tab === k ? 700 : 500, cursor: 'pointer', fontSize: 14, marginBottom: -2 }}>{l}</button>
        ))}
      </div>

      {tab === 'generate' && (
        <div style={{ maxWidth: 700 }}>
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Select Resident</h3>
            <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14 }}>
              <option value="">Choose a resident...</option>
              {residents?.map((r: any) => (
                <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>
              ))}
            </select>
          </div>

          <button onClick={handleGenerate} disabled={!selectedResident || generateMutation.isPending} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: (!selectedResident || generateMutation.isPending) ? 0.5 : 1 }}>
            {generateMutation.isPending ? '⏳ Generating...' : '🤖 Generate AI Care Plan'}
          </button>

          {generateMutation.isError && (
            <div style={{ marginTop: 16, padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Failed to generate care plan</div>
              <div>{(generateMutation.error as any)?.response?.data?.error || 'The AI care plan service encountered an error. This may happen if the system is still being set up. Please try again or contact support.'}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'plans' && (
        <div>
          {selectedPlan && (
            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>📄 {selectedPlan.resident_name || 'Care Plan'}</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedPlan.status === 'draft' && !String(selectedPlan.id).startsWith('temp-') && (
                    <>
                      <button onClick={() => approveMutation.mutate({ id: selectedPlan.id, status: 'approved' })} style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>✓ Approve</button>
                      <button onClick={() => approveMutation.mutate({ id: selectedPlan.id, status: 'rejected' })} style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>✗ Reject</button>
                    </>
                  )}
                  <button onClick={() => setSelectedPlan(null)} style={{ padding: '8px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>{tr('Close')}</button>
                </div>
              </div>

              {String(selectedPlan.id).startsWith('temp-') && (
                <div style={{ padding: 12, background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                  <strong>Note:</strong> Plan generated but not persisted - database setup required. Approve/reject actions are unavailable until the care plans table is configured.
                </div>
              )}

              {selectedPlanContent?.cqc_domains && (
                <div style={{ display: 'grid', gap: 16 }}>
                  {Object.entries(selectedPlanContent.cqc_domains).map(([key, domain]: [string, any]) => (
                    <div key={key} style={{ padding: 16, borderRadius: 10, border: `2px solid ${cqcDomainColors[key] || '#e5e7eb'}20`, background: `${cqcDomainColors[key] || '#6b7280'}08` }}>
                      <h4 style={{ margin: '0 0 8px', color: cqcDomainColors[key] || '#374151', fontSize: 15 }}>{domain.title}</h4>
                      <div style={{ fontSize: 13 }}>
                        <strong>Goals:</strong>
                        <ul style={{ margin: '4px 0 8px', paddingLeft: 20 }}>{domain.goals?.map((g: string, i: number) => <li key={i}>{g}</li>)}</ul>
                        <strong>Interventions:</strong>
                        <ul style={{ margin: '4px 0', paddingLeft: 20 }}>{domain.interventions?.map((g: string, i: number) => <li key={i}>{g}</li>)}</ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {plansLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading care plans...</div>}
          {isPlansError && !plansLoading && (
            <div className="card" style={{ padding: 20, borderLeft: '4px solid #dc2626', marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#dc2626' }}>⚠️ Unable to load care plans</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>An error occurred while loading AI care plans. Please try again later.</div>
            </div>
          )}
          {!plansLoading && !isPlansError && (
            <div style={{ display: 'grid', gap: 12 }}>
              {plans?.map((plan: any) => (
                <div key={plan.id} className="card" onClick={() => setSelectedPlan(plan)} style={{ padding: 16, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{plan.resident_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Version {plan.version} - Generated by {plan.generated_by_name}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: plan.status === 'approved' ? '#dcfce7' : plan.status === 'rejected' ? '#fef2f2' : '#f3f4f6', color: plan.status === 'approved' ? '#16a34a' : plan.status === 'rejected' ? '#dc2626' : '#6b7280' }}>{plan.status.toUpperCase()}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(plan.created_at).toLocaleDateString('en-GB')}</span>
                  </div>
                </div>
              ))}
              {plans?.length === 0 && (
                <div style={{ padding: 60, textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No Care Plans Generated Yet</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto 20px' }}>
                    AI care plans help create CQC-compliant documentation based on resident assessments and observations. Generate your first care plan to get started.
                  </div>
                  <button onClick={() => setTab('generate')} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    ✨ Generate Your First Care Plan
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
