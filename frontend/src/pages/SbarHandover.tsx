// src/pages/SbarHandover.tsx — SBAR Handover Generation and Review
import React, { useState } from 'react';
import { useSbarHandovers, useGenerateSbar, useApproveSbar } from '../hooks';
import type { SbarHandover as SbarHandoverType } from '../types';

const STATUS_BADGES: Record<string, { bg: string; color: string; label: string }> = {
  draft: { bg: '#fef3c7', color: '#92400e', label: 'Draft' },
  active: { bg: '#dbeafe', color: '#0f766e', label: 'Active' },
  approved: { bg: '#d1fae5', color: '#065f46', label: 'Approved' },
  rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
};

/** Strip markdown formatting from AI output for clean display */
function cleanText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/#{1,6}\s*/g, '')      // Remove heading markers (##, #, etc.)
    .replace(/\*\*/g, '')            // Remove bold markers (**)
    .replace(/---+/g, '')            // Remove horizontal rules (---)
    .replace(/--/g, '')              // Remove double dashes
    .replace(/^\s*[-*]\s+/gm, '')    // Remove bullet point markers at start of lines
    .replace(/\n{3,}/g, '\n\n')      // Collapse multiple blank lines
    .trim();
}

export default function SbarHandover() {
  const [shiftDate, setShiftDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [shiftType, setShiftType] = useState('day');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: rawHandovers, isLoading } = useSbarHandovers();
  const handovers: SbarHandoverType[] = Array.isArray(rawHandovers) ? rawHandovers : (rawHandovers as any)?.handovers ?? [];
  const generateSbar = useGenerateSbar();
  const approveSbar = useApproveSbar();

  const selectedHandover = handovers.find(h => h.id === selectedId) || null;

  const handleGenerate = async () => {
    try {
      await generateSbar.mutateAsync({ shiftDate, shiftType });
    } catch {
      // Error is handled by the mutation's onError callback in the hook
    }
  };

  const handleApprove = async (id: string) => {
    await approveSbar.mutateAsync(id);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">SBAR Handover</h1>
          <p className="page-subtitle">Generate and review structured shift handovers</p>
        </div>
      </div>

      {/* Generate Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 700 }}>Generate SBAR Handover</h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Shift Date</label>
              <input
                className="form-input"
                type="date"
                value={shiftDate}
                onChange={e => setShiftDate(e.target.value)}
                style={{ minWidth: 160 }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Shift Type</label>
              <select className="form-input" value={shiftType} onChange={e => setShiftType(e.target.value)} style={{ minWidth: 140 }}>
                <option value="day">Day</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={generateSbar.isPending}
              style={{ height: 40 }}
            >
              {generateSbar.isPending ? 'Generating...' : '🤖 Generate SBAR'}
            </button>
          </div>
          {generateSbar.isError && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', fontSize: '0.85rem' }}>
              {(generateSbar.error as any)?.response?.data?.error || 'Failed to generate handover. Please try again.'}
            </div>
          )}
        </div>
      </div>

      {/* Handovers List and Detail */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedHandover ? '1fr 1.5fr' : '1fr', gap: 20 }}>
        {/* Recent Handovers */}
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700 }}>Recent Handovers</h3>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(3)].map((_, i) => <div key={i} className="card" style={{ height: 80 }} />)}
            </div>
          ) : handovers.length === 0 ? (
            <div className="card">
              <div className="card-body table-empty">No handovers generated yet. Use the form above to generate one.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {handovers.map((h: SbarHandoverType) => {
                const badge = STATUS_BADGES[h.status] || STATUS_BADGES.active;
                const isSelected = selectedId === h.id;
                return (
                  <div
                    key={h.id}
                    className="card"
                    onClick={() => setSelectedId(isSelected ? null : h.id)}
                    style={{
                      cursor: 'pointer',
                      borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                      boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.08)' : undefined,
                    }}
                  >
                    <div className="card-body" style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                            {new Date(h.shift_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="badge badge-neutral" style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                            {h.shift_type}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 12, background: badge.bg, color: badge.color, fontWeight: 600 }}>
                          {badge.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Generated by {h.generated_by_name || 'System'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SBAR Detail */}
        {selectedHandover && (
          <div>
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 700 }}>SBAR Detail</h3>
            <div style={{ marginBottom: 12, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Shift: <strong style={{ textTransform: 'capitalize' }}>{selectedHandover.shift_type}</strong> on{' '}
              <strong>{new Date(selectedHandover.shift_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Situation */}
              <div className="card" style={{ borderTop: '4px solid #0d9488' }}>
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#0d9488', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.82rem' }}>S</span>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0d9488' }}>Situation</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{cleanText(selectedHandover.situation)}</p>
                </div>
              </div>

              {/* Background */}
              <div className="card" style={{ borderTop: '4px solid #7c3aed' }}>
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.82rem' }}>B</span>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#7c3aed' }}>Background</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{cleanText(selectedHandover.background)}</p>
                </div>
              </div>

              {/* Assessment */}
              <div className="card" style={{ borderTop: '4px solid #d97706' }}>
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#d97706', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.82rem' }}>A</span>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#d97706' }}>Assessment</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{cleanText(selectedHandover.assessment)}</p>
                </div>
              </div>

              {/* Recommendation */}
              <div className="card" style={{ borderTop: '4px solid #059669' }}>
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#059669', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.82rem' }}>R</span>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#059669' }}>Recommendation</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{cleanText(selectedHandover.recommendation)}</p>
                </div>
              </div>

              {/* Status / Approval info */}
              <div className="card">
                <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {selectedHandover.status === 'approved' && <span>Approved{selectedHandover.approved_by_name ? ` by ${selectedHandover.approved_by_name}` : ''}{selectedHandover.approved_at ? ` on ${new Date(selectedHandover.approved_at).toLocaleDateString('en-GB')}` : ''}</span>}
                    {(selectedHandover.status === 'active' || selectedHandover.status === 'draft') && <span>Awaiting review</span>}
                    {selectedHandover.status === 'rejected' && <span style={{ color: 'var(--danger)' }}>Rejected</span>}
                  </div>
                  {(selectedHandover.status === 'active' || selectedHandover.status === 'draft') && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleApprove(selectedHandover.id)}
                      disabled={approveSbar.isPending}
                    >
                      {approveSbar.isPending ? 'Approving...' : 'Approve Handover'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
