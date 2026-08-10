import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useCompetencySignoffs, useCreateCompetencySignoff, useUpdateCompetencySignoff, useColleagues } from '../hooks';

export default function CompetencySignoff() {
  const { t } = useLang();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'signed_off'>('all');

  const { data: signoffs = [], isLoading } = useCompetencySignoffs();
  const { data: staffList } = useColleagues();
  const createMutation = useCreateCompetencySignoff();
  const updateMutation = useUpdateCompetencySignoff();

  const [form, setForm] = useState({
    staff_id: '',
    competency_name: '',
    outcome: 'competent' as 'competent' | 'not_yet_competent' | 'requires_training',
    evidence_notes: '',
    observation_date: new Date().toISOString().split('T')[0],
  });

  const signoffList = Array.isArray(signoffs) ? signoffs : (signoffs as any)?.signoffs || [];
  const staff = Array.isArray(staffList) ? staffList : (staffList as any)?.staff || [];

  const filteredSignoffs = filter === 'all' ? signoffList : signoffList.filter((s: any) => s.status === filter);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form, { onSuccess: () => { setShowForm(false); setForm({ staff_id: '', competency_name: '', outcome: 'competent', evidence_notes: '', observation_date: new Date().toISOString().split('T')[0] }); } });
  };

  const handleSignOff = (id: string) => {
    updateMutation.mutate({ id, data: { status: 'signed_off' } });
  };

  const getOutcomeBadge = (outcome: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      competent: { bg: '#dcfce7', color: '#166534' },
      not_yet_competent: { bg: '#fef9c3', color: '#854d0e' },
      requires_training: { bg: '#fee2e2', color: '#991b1b' },
    };
    const s = styles[outcome] || styles.competent;
    return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: s.bg, color: s.color }}>{outcome.replace(/_/g, ' ')}</span>;
  };

  const competencyOptions = [
    'Manual Handling', 'Medication Administration', 'Infection Control',
    'Wound Care', 'Catheter Care', 'PEG Feed Management',
    'Syringe Driver', 'Venepuncture', 'Basic Life Support',
    'Diabetes Management', 'Epilepsy Management', 'Mental Capacity Assessment',
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Competency Sign-Off</h1>
          <p style={{ color: '#6b7280', margin: 0 }}>Record observations, assess competency, and sign off staff skills.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
          + New Assessment
        </button>
      </div>

      {/* New Assessment Form */}
      {showForm && (
        <div style={{ padding: 24, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: 16 }}>Record Competency Assessment</h2>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Staff Member</label>
                <select value={form.staff_id} onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))} required style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}>
                  <option value="">Select staff member...</option>
                  {staff.map((s: any) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{t('Competency')}</label>
                <select value={form.competency_name} onChange={e => setForm(f => ({ ...f, competency_name: e.target.value }))} required style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}>
                  <option value="">Select competency...</option>
                  {competencyOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Observation Date</label>
                <input type="date" value={form.observation_date} onChange={e => setForm(f => ({ ...f, observation_date: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Outcome</label>
                <select value={form.outcome} onChange={e => setForm(f => ({ ...f, outcome: e.target.value as any }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}>
                  <option value="competent">Competent</option>
                  <option value="not_yet_competent">Not Yet Competent</option>
                  <option value="requires_training">Requires Training</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Evidence / Observation Notes</label>
              <textarea value={form.evidence_notes} onChange={e => setForm(f => ({ ...f, evidence_notes: e.target.value }))} rows={4} placeholder="Describe the observation, evidence of competence, and any areas for development..." style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={createMutation.isPending} style={{ padding: '10px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                {createMutation.isPending ? 'Recording...' : 'Record & Sign Off'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
                {t('Cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 20, width: 'fit-content' }}>
        {(['all', 'pending', 'signed_off'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', borderRadius: 8, border: 'none', fontWeight: 500, cursor: 'pointer', background: filter === f ? '#fff' : 'transparent', color: filter === f ? '#111827' : '#6b7280', boxShadow: filter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {f === 'signed_off' ? 'Signed Off' : f === 'all' ? 'All' : 'Pending'}
          </button>
        ))}
      </div>

      {/* Sign-offs List */}
      {isLoading ? (
        <p style={{ color: '#6b7280' }}>Loading sign-offs...</p>
      ) : filteredSignoffs.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
          <p style={{ color: '#6b7280', margin: 0 }}>No competency sign-offs found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredSignoffs.map((signoff: any) => (
            <div key={signoff.id} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px' }}>{signoff.staff_name || 'Staff Member'}</h3>
                  <p style={{ fontSize: '0.9rem', color: '#374151', margin: 0 }}>{signoff.competency_name}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {getOutcomeBadge(signoff.outcome)}
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: signoff.status === 'signed_off' ? '#dcfce7' : '#fef9c3', color: signoff.status === 'signed_off' ? '#166534' : '#854d0e' }}>
                    {signoff.status === 'signed_off' ? 'Signed Off' : 'Pending'}
                  </span>
                </div>
              </div>
              {signoff.evidence_notes && (
                <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '8px 0 0', fontStyle: 'italic' }}>{signoff.evidence_notes}</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                  Observed: {signoff.observation_date} {signoff.assessor_name && `by ${signoff.assessor_name}`}
                </span>
                {signoff.status === 'pending' && (
                  <button onClick={() => handleSignOff(signoff.id)} style={{ padding: '6px 12px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                    Sign Off
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
