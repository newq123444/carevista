import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useBoardPacks, useGenerateBoardPack, useApproveBoardPack } from '../hooks';

export default function BoardPackGenerator() {
  const { t } = useLang();
  const { data: packs = [], isLoading } = useBoardPacks();
  const generateMutation = useGenerateBoardPack();
  const approveMutation = useApproveBoardPack();

  const [showGenerator, setShowGenerator] = useState(false);
  const [selectedPack, setSelectedPack] = useState<any>(null);
  const [sections, setSections] = useState({
    kpi_summary: true,
    incident_overview: true,
    staffing_metrics: true,
    financial_summary: true,
    compliance_status: true,
    notable_events: true,
  });
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const enabledSections = Object.entries(sections).filter(([, v]) => v).map(([k]) => k);
    generateMutation.mutate({ period_start: periodStart, period_end: periodEnd, sections: enabledSections }, {
      onSuccess: () => { setShowGenerator(false); setPeriodStart(''); setPeriodEnd(''); }
    });
  };

  const handleApprove = (id: string) => {
    approveMutation.mutate({ id, data: { status: 'approved' } });
  };

  const packList = Array.isArray(packs) ? packs : (packs as any)?.packs || [];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      draft: { bg: '#f3f4f6', color: '#374151' },
      pending_approval: { bg: '#fef9c3', color: '#854d0e' },
      approved: { bg: '#dcfce7', color: '#166534' },
      rejected: { bg: '#fee2e2', color: '#991b1b' },
    };
    const s = styles[status] || styles.draft;
    return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: s.bg, color: s.color }}>{status.replace(/_/g, ' ')}</span>;
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Board Pack Generator</h1>
          <p style={{ color: '#6b7280', margin: 0 }}>Generate monthly board reports with KPIs, incidents, staffing, and compliance data.</p>
        </div>
        <button onClick={() => setShowGenerator(!showGenerator)} style={{ padding: '10px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
          + New Board Pack
        </button>
      </div>

      {/* Generator Form */}
      {showGenerator && (
        <div style={{ padding: 24, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 16 }}>Generate New Board Pack</h2>
          <form onSubmit={handleGenerate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Period Start</label>
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} required style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Period End</label>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} required style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }} />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 8 }}>Include Sections</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {Object.entries(sections).map(([key, checked]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: checked ? '#eff6ff' : '#f9fafb', borderRadius: 8, border: `1px solid ${checked ? '#bfdbfe' : '#e5e7eb'}`, cursor: 'pointer' }}>
                    <input type="checkbox" checked={checked} onChange={e => setSections(s => ({ ...s, [key]: e.target.checked }))} />
                    <span style={{ fontSize: '0.85rem', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={generateMutation.isPending} style={{ padding: '10px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                {generateMutation.isPending ? 'Generating...' : 'Generate Pack'}
              </button>
              <button type="button" onClick={() => setShowGenerator(false)} style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
                {t('Cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview selected pack */}
      {selectedPack && (
        <div style={{ padding: 24, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{selectedPack.title}</h2>
            <button onClick={() => setSelectedPack(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '1.2rem' }}>x</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={{ padding: 8, background: '#f9fafb', borderRadius: 6, fontSize: '0.85rem' }}>
              <span style={{ color: '#6b7280' }}>Period: </span>{selectedPack.period_start} to {selectedPack.period_end}
            </div>
            <div style={{ padding: 8, background: '#f9fafb', borderRadius: 6, fontSize: '0.85rem' }}>
              <span style={{ color: '#6b7280' }}>Status: </span>{getStatusBadge(selectedPack.status)}
            </div>
            <div style={{ padding: 8, background: '#f9fafb', borderRadius: 6, fontSize: '0.85rem' }}>
              <span style={{ color: '#6b7280' }}>Generated by: </span>{selectedPack.generated_by_name || 'System'}
            </div>
          </div>
          {selectedPack.status === 'pending_approval' && (
            <button onClick={() => handleApprove(selectedPack.id)} style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
              Approve Pack
            </button>
          )}
        </div>
      )}

      {/* Pack List */}
      <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 12 }}>Previous Board Packs</h2>
      {isLoading ? (
        <p style={{ color: '#6b7280' }}>Loading...</p>
      ) : packList.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
          <p style={{ color: '#6b7280', margin: 0 }}>No board packs generated yet. Click "New Board Pack" to create one.</p>
        </div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          {packList.map((pack: any) => (
            <div key={pack.id} onClick={() => setSelectedPack(pack)} style={{ padding: 16, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: '#fff' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{pack.title || `Board Pack - ${pack.period_start}`}</div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{pack.period_start} to {pack.period_end}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {getStatusBadge(pack.status)}
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{new Date(pack.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
