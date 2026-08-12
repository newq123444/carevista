import React, { useState } from 'react';
import { useLang } from '../i18n';
import { RecordView } from '../components/ui';
import { useIntergenerationalProgrammes, useCreateIntergenerationalProgramme, useIntergenerationalVisits, useCreateIntergenerationalVisit, useAddIntergenerationalParticipant, useLogIntergenerationalOutcome, useIntergenerationalSafeguarding, useIntergenerationalWellbeingImpact, useResidents } from '../hooks';

export default function IntergenerationalProgramme() {
  const { t: tr } = useLang();
  const [activeTab, setActiveTab] = useState<'programmes' | 'visits' | 'safeguarding' | 'outcomes'>('programmes');
  const [showProgrammeForm, setShowProgrammeForm] = useState(false);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [selectedProgramme, setSelectedProgramme] = useState('');
  const [participantFor, setParticipantFor] = useState('');
  const [participantResident, setParticipantResident] = useState('');
  const [participantScore, setParticipantScore] = useState('4');

  const { data: residents } = useResidents();
  const { data: programmes = [] } = useIntergenerationalProgrammes();
  const { data: visits = [] } = useIntergenerationalVisits();
  const { data: safeguarding } = useIntergenerationalSafeguarding(selectedProgramme);
  const { data: wellbeingImpact } = useIntergenerationalWellbeingImpact();

  const createProgrammeMutation = useCreateIntergenerationalProgramme();
  const createVisitMutation = useCreateIntergenerationalVisit();
  const addParticipantMutation = useAddIntergenerationalParticipant();
  const logOutcomeMutation = useLogIntergenerationalOutcome();

  const [programmeForm, setProgrammeForm] = useState({ name: '', description: '', partner_organisation: '', partner_type: 'school', contact_name: '', contact_email: '' });
  const [visitForm, setVisitForm] = useState({ programme_id: '', visit_date: '', start_time: '10:00', activity_type: 'reading', activity_description: '', visitor_count: '5' });

  const programmeList = Array.isArray(programmes) ? programmes : [];
  const visitList = Array.isArray(visits) ? visits : [];
  const residentList = Array.isArray(residents) ? residents : [];

  const handleCreateProgramme = (e: React.FormEvent) => {
    e.preventDefault();
    createProgrammeMutation.mutate(programmeForm, {
      onSuccess: () => { setShowProgrammeForm(false); setProgrammeForm({ name: '', description: '', partner_organisation: '', partner_type: 'school', contact_name: '', contact_email: '' }); }
    });
  };

  const handleCreateVisit = (e: React.FormEvent) => {
    e.preventDefault();
    createVisitMutation.mutate({ ...visitForm, visitor_count: parseInt(visitForm.visitor_count) }, {
      onSuccess: () => { setShowVisitForm(false); setVisitForm({ programme_id: '', visit_date: '', start_time: '10:00', activity_type: 'reading', activity_description: '', visitor_count: '5' }); }
    });
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Intergenerational Programme</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Manage partnerships with schools and nurseries, schedule visits, and track outcomes.</p>

      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['programmes', 'visits', 'safeguarding', 'outcomes'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 500, cursor: 'pointer', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#111827' : '#6b7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'programmes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Programmes</h2>
            <button onClick={() => setShowProgrammeForm(!showProgrammeForm)} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>+ New Programme</button>
          </div>
          {showProgrammeForm && (
            <form onSubmit={handleCreateProgramme} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Name</label>
                  <input type="text" value={programmeForm.name} onChange={e => setProgrammeForm(f => ({ ...f, name: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Partner Organisation</label>
                  <input type="text" value={programmeForm.partner_organisation} onChange={e => setProgrammeForm(f => ({ ...f, partner_organisation: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Partner Type</label>
                  <select value={programmeForm.partner_type} onChange={e => setProgrammeForm(f => ({ ...f, partner_type: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="school">School</option>
                    <option value="nursery">Nursery</option>
                    <option value="youth_group">Youth Group</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Contact Name</label>
                  <input type="text" value={programmeForm.contact_name} onChange={e => setProgrammeForm(f => ({ ...f, contact_name: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Contact Email</label>
                  <input type="email" value={programmeForm.contact_email} onChange={e => setProgrammeForm(f => ({ ...f, contact_email: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{tr('Description')}</label>
                  <input type="text" value={programmeForm.description} onChange={e => setProgrammeForm(f => ({ ...f, description: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Create Programme</button>
            </form>
          )}
          {programmeList.map((p: any) => (
            <div key={p.id} onClick={() => setSelectedProgramme(p.id)} style={{ padding: 16, background: '#fff', borderRadius: 12, border: selectedProgramme === p.id ? '2px solid #0d9488' : '1px solid #e5e7eb', marginBottom: 8, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '1rem' }}>{p.name}</span>
                  <span style={{ marginLeft: 12, fontSize: '0.82rem', color: '#6b7280' }}>{p.partner_organisation}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', background: p.partner_type === 'school' ? '#e0e7ff' : '#fef3c7', color: p.partner_type === 'school' ? '#4338ca' : '#d97706' }}>{p.partner_type}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', background: p.safeguarding_status === 'approved' ? '#dcfce7' : '#fee2e2', color: p.safeguarding_status === 'approved' ? '#16a34a' : '#dc2626' }}>{p.safeguarding_status}</span>
                </div>
              </div>
              {p.description && <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 6 }}>{p.description}</div>}
            </div>
          ))}
          {programmeList.length === 0 && <p style={{ color: '#6b7280' }}>No programmes created yet.</p>}
        </div>
      )}

      {activeTab === 'visits' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{tr('Visits')}</h2>
            <button onClick={() => setShowVisitForm(!showVisitForm)} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>+ Schedule Visit</button>
          </div>
          {showVisitForm && (
            <form onSubmit={handleCreateVisit} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Programme</label>
                  <select value={visitForm.programme_id} onChange={e => setVisitForm(f => ({ ...f, programme_id: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="">Select...</option>
                    {programmeList.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Visit Date</label>
                  <input type="date" value={visitForm.visit_date} onChange={e => setVisitForm(f => ({ ...f, visit_date: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Start Time</label>
                  <input type="time" value={visitForm.start_time} onChange={e => setVisitForm(f => ({ ...f, start_time: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Activity Type</label>
                  <select value={visitForm.activity_type} onChange={e => setVisitForm(f => ({ ...f, activity_type: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="reading">{tr('Reading')}</option>
                    <option value="art">Art</option>
                    <option value="baking">Baking</option>
                    <option value="singing">Singing</option>
                    <option value="games">Games</option>
                    <option value="gardening">Gardening</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Visitor Count</label>
                  <input type="number" value={visitForm.visitor_count} onChange={e => setVisitForm(f => ({ ...f, visitor_count: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{tr('Description')}</label>
                  <input type="text" value={visitForm.activity_description} onChange={e => setVisitForm(f => ({ ...f, activity_description: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Schedule Visit</button>
            </form>
          )}
          {visitList.map((v: any) => (
            <div key={v.id} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{v.programme_name || 'Visit'}</span>
                  <span style={{ marginLeft: 12, fontSize: '0.82rem', color: '#6b7280' }}>{v.visit_date} at {v.start_time}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', background: '#e0e7ff', color: '#4338ca' }}>{v.activity_type}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', background: v.status === 'completed' ? '#dcfce7' : '#fef3c7', color: v.status === 'completed' ? '#16a34a' : '#d97706' }}>{v.status}</span>
                  <button onClick={() => { setParticipantFor(participantFor === v.id ? '' : v.id); setParticipantResident(''); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #0d9488', background: '#f0fdfa', color: '#0d9488', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                    {participantFor === v.id ? 'Close' : '+ Add resident'}
                  </button>
                </div>
              </div>
              {participantFor === v.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 220px' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Resident who took part</label>
                    <select value={participantResident} onChange={e => setParticipantResident(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                      <option value="">Select a resident…</option>
                      {residentList.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} — Room {r.room_number}</option>)}
                    </select>
                  </div>
                  <div style={{ width: 150 }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Engagement (1-5)</label>
                    <select value={participantScore} onChange={e => setParticipantScore(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <button onClick={() => {
                    if (!participantResident) return;
                    addParticipantMutation.mutate({ visit_id: v.id, resident_id: participantResident, engagement_score: parseInt(participantScore) } as any, {
                      onSuccess: () => { setParticipantResident(''); setParticipantFor(''); },
                    });
                  }} disabled={!participantResident} style={{ padding: '9px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: participantResident ? 1 : 0.5 }}>{tr('Add')}</button>
                </div>
              )}
            </div>
          ))}
          {visitList.length === 0 && <p style={{ color: '#6b7280' }}>No visits scheduled yet.</p>}
        </div>
      )}

      {activeTab === 'safeguarding' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Safeguarding Requirements</h2>
          {selectedProgramme ? (
            safeguarding ? (
              <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <RecordView data={safeguarding} empty="No safeguarding checks recorded for this programme yet." />
              </div>
            ) : <p style={{ color: '#6b7280' }}>Loading safeguarding data...</p>
          ) : <p style={{ color: '#6b7280' }}>Select a programme from the Programmes tab to view safeguarding requirements.</p>}
        </div>
      )}

      {activeTab === 'outcomes' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Wellbeing Impact</h2>
          {wellbeingImpact ? (
            <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <RecordView data={wellbeingImpact} empty="No wellbeing impact data yet — log visit outcomes to build it." />
            </div>
          ) : <p style={{ color: '#6b7280' }}>No outcome data available yet. Log participant outcomes after visits.</p>}
        </div>
      )}
    </div>
  );
}
