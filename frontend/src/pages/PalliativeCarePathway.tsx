import React, { useState } from 'react';
import { useLang } from '../i18n';
import { usePalliativeCarePlan, useCreatePalliativeCarePlan, useUpdatePalliativeCarePlan, useComfortRounds, useScheduleComfortRound, useCompleteComfortRound, useAnticipatoryMeds, useAddAnticipatoryMed, useAdministerAnticipatoryMed, useFamilyCommunications, useLogFamilyCommunication, useResidents } from '../hooks';

export default function PalliativeCarePathway() {
  const { t: tr } = useLang();
  const [selectedResident, setSelectedResident] = useState('');
  const [activeTab, setActiveTab] = useState<'care-plan' | 'comfort' | 'meds' | 'family' | 'resources'>('care-plan');
  const [showCarePlanForm, setShowCarePlanForm] = useState(false);
  const [showComfortForm, setShowComfortForm] = useState(false);
  const [showMedForm, setShowMedForm] = useState(false);
  const [showFamilyForm, setShowFamilyForm] = useState(false);

  const { data: residents } = useResidents();
  const { data: carePlan } = usePalliativeCarePlan(selectedResident);
  const { data: comfortRounds = [] } = useComfortRounds(selectedResident);
  const { data: meds = [] } = useAnticipatoryMeds(selectedResident);
  const { data: familyComms = [] } = useFamilyCommunications(selectedResident);

  const createPlanMutation = useCreatePalliativeCarePlan();
  const updatePlanMutation = useUpdatePalliativeCarePlan();
  const scheduleComfortMutation = useScheduleComfortRound();
  const completeComfortMutation = useCompleteComfortRound();
  const addMedMutation = useAddAnticipatoryMed();
  const administerMedMutation = useAdministerAnticipatoryMed();
  const logCommMutation = useLogFamilyCommunication();

  const residentList = Array.isArray(residents) ? residents : [];
  const rounds = Array.isArray(comfortRounds) ? comfortRounds : [];
  const medsList = Array.isArray(meds) ? meds : [];
  const comms = Array.isArray(familyComms) ? familyComms : [];

  const [carePlanForm, setCarePlanForm] = useState({ preferred_place_of_death: 'care_home', resuscitation_status: 'dnacpr', spiritual_needs: '', advance_decisions: '' });
  const [comfortForm, setComfortForm] = useState({ scheduled_time: '', notes: '' });
  const [medForm, setMedForm] = useState({ medication_name: '', indication: '', dose: '', route: 'subcutaneous' });
  const [familyForm, setFamilyForm] = useState({ family_member_name: '', communication_type: 'phone', summary: '', follow_up_required: false });

  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    createPlanMutation.mutate({ resident_id: selectedResident, ...carePlanForm }, { onSuccess: () => setShowCarePlanForm(false) });
  };

  const handleScheduleComfort = (e: React.FormEvent) => {
    e.preventDefault();
    scheduleComfortMutation.mutate({ resident_id: selectedResident, scheduled_time: comfortForm.scheduled_time, notes: comfortForm.notes }, { onSuccess: () => { setShowComfortForm(false); setComfortForm({ scheduled_time: '', notes: '' }); } });
  };

  const handleAddMed = (e: React.FormEvent) => {
    e.preventDefault();
    addMedMutation.mutate({ resident_id: selectedResident, ...medForm }, { onSuccess: () => { setShowMedForm(false); setMedForm({ medication_name: '', indication: '', dose: '', route: 'subcutaneous' }); } });
  };

  const handleLogComm = (e: React.FormEvent) => {
    e.preventDefault();
    logCommMutation.mutate({ resident_id: selectedResident, ...familyForm, communication_date: new Date().toISOString() }, { onSuccess: () => { setShowFamilyForm(false); setFamilyForm({ family_member_name: '', communication_type: 'phone', summary: '', follow_up_required: false }); } });
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Palliative Care Pathway</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>End-of-life care planning, comfort rounds, anticipatory medications, and family communications.</p>

      {/* Resident Selector */}
      <div style={{ marginBottom: 24 }}>
        <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', minWidth: 300 }}>
          <option value="">Select a resident...</option>
          {residentList.filter((r: any) => r.care_type === 'palliative' || r.status === 'active').map((r: any) => (
            <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {([['care-plan', 'Care Plan'], ['comfort', 'Comfort Rounds'], ['meds', 'Anticipatory Meds'], ['family', 'Family Comms'], ['resources', 'Resources']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key as any)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 500, cursor: 'pointer', background: activeTab === key ? '#fff' : 'transparent', color: activeTab === key ? '#111827' : '#6b7280', boxShadow: activeTab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.85rem' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Care Plan Tab */}
      {activeTab === 'care-plan' && (
        <div>
          {carePlan && !showCarePlanForm ? (
            <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Current Care Plan</h2>
                <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: '#dcfce7', color: '#166534' }}>Active</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>Preferred Place of Death</div>
                  <div style={{ fontWeight: 500, textTransform: 'capitalize' }}>{((carePlan as any).preferred_place_of_death || '').replace(/_/g, ' ')}</div>
                </div>
                <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8 }}>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>Resuscitation Status</div>
                  <div style={{ fontWeight: 500, textTransform: 'uppercase', color: (carePlan as any).resuscitation_status === 'dnacpr' ? '#dc2626' : '#16a34a' }}>{(carePlan as any).resuscitation_status}</div>
                </div>
                {(carePlan as any).spiritual_needs && (
                  <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>Spiritual Needs</div>
                    <div>{(carePlan as any).spiritual_needs}</div>
                  </div>
                )}
                {(carePlan as any).advance_decisions && (
                  <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>Advance Decisions</div>
                    <div>{(carePlan as any).advance_decisions}</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <button onClick={() => setShowCarePlanForm(!showCarePlanForm)} disabled={!selectedResident} style={{ padding: '10px 20px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>
                + Create Care Plan
              </button>
              {showCarePlanForm && (
                <form onSubmit={handleCreatePlan} style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Preferred Place of Death</label>
                      <select value={carePlanForm.preferred_place_of_death} onChange={e => setCarePlanForm(f => ({ ...f, preferred_place_of_death: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}>
                        <option value="care_home">Care Home</option>
                        <option value="hospital">Hospital</option>
                        <option value="hospice">Hospice</option>
                        <option value="home">Family Home</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Resuscitation Status</label>
                      <select value={carePlanForm.resuscitation_status} onChange={e => setCarePlanForm(f => ({ ...f, resuscitation_status: e.target.value }))} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }}>
                        <option value="dnacpr">DNACPR</option>
                        <option value="for_resuscitation">For Resuscitation</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Spiritual Needs</label>
                    <textarea value={carePlanForm.spiritual_needs} onChange={e => setCarePlanForm(f => ({ ...f, spiritual_needs: e.target.value }))} rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Advance Decisions</label>
                    <textarea value={carePlanForm.advance_decisions} onChange={e => setCarePlanForm(f => ({ ...f, advance_decisions: e.target.value }))} rows={3} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8 }} />
                  </div>
                  <button type="submit" disabled={createPlanMutation.isPending} style={{ padding: '10px 20px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
                    {createPlanMutation.isPending ? 'Creating...' : 'Create Care Plan'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* Comfort Rounds Tab */}
      {activeTab === 'comfort' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Comfort Rounds</h2>
            <button onClick={() => setShowComfortForm(!showComfortForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>
              + Schedule Round
            </button>
          </div>
          {showComfortForm && (
            <form onSubmit={handleScheduleComfort} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Scheduled Time</label>
                  <input type="datetime-local" value={comfortForm.scheduled_time} onChange={e => setComfortForm(f => ({ ...f, scheduled_time: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{tr('Notes')}</label>
                  <input type="text" value={comfortForm.notes} onChange={e => setComfortForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" disabled={scheduleComfortMutation.isPending} style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>{tr('Schedule')}</button>
            </form>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rounds.length === 0 ? (
              <p style={{ padding: 24, textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: 12 }}>No comfort rounds scheduled.</p>
            ) : rounds.map((round: any) => (
              <div key={round.id} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{new Date(round.scheduled_time).toLocaleString()}</span>
                    <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: round.status === 'completed' ? '#dcfce7' : round.status === 'missed' ? '#fee2e2' : '#fef9c3', color: round.status === 'completed' ? '#166534' : round.status === 'missed' ? '#991b1b' : '#854d0e' }}>{round.status}</span>
                  </div>
                  {round.status === 'scheduled' && (
                    <button onClick={() => completeComfortMutation.mutate({ id: round.id, data: { status: 'completed' } })} style={{ padding: '6px 12px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>{tr('Complete')}</button>
                  )}
                </div>
                {round.notes && <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#6b7280' }}>{round.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anticipatory Meds Tab */}
      {activeTab === 'meds' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Anticipatory Medications</h2>
            <button onClick={() => setShowMedForm(!showMedForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>
              + Add Medication
            </button>
          </div>
          {showMedForm && (
            <form onSubmit={handleAddMed} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Medication Name</label>
                  <input type="text" value={medForm.medication_name} onChange={e => setMedForm(f => ({ ...f, medication_name: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Indication</label>
                  <input type="text" value={medForm.indication} onChange={e => setMedForm(f => ({ ...f, indication: e.target.value }))} required placeholder="e.g. Pain, Nausea, Secretions" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{tr('Dose')}</label>
                  <input type="text" value={medForm.dose} onChange={e => setMedForm(f => ({ ...f, dose: e.target.value }))} required placeholder="e.g. 2.5mg-5mg" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{tr('Route')}</label>
                  <select value={medForm.route} onChange={e => setMedForm(f => ({ ...f, route: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="subcutaneous">Subcutaneous</option>
                    <option value="sublingual">Sublingual</option>
                    <option value="buccal">Buccal</option>
                    <option value="rectal">Rectal</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={addMedMutation.isPending} style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Add Medication</button>
            </form>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {medsList.length === 0 ? (
              <p style={{ padding: 24, textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: 12 }}>No anticipatory medications prescribed.</p>
            ) : medsList.map((med: any) => (
              <div key={med.id} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{med.medication_name}</span>
                    <span style={{ marginLeft: 8, color: '#6b7280', fontSize: '0.85rem' }}>{med.dose} {med.route}</span>
                  </div>
                  <button onClick={() => administerMedMutation.mutate({ id: med.id, data: { administered_at: new Date().toISOString() } })} style={{ padding: '6px 12px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>{tr('Administer')}</button>
                </div>
                <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#6b7280' }}>
                  <span>Indication: {med.indication}</span>
                  {med.last_administered_at && <span style={{ marginLeft: 12 }}>Last given: {new Date(med.last_administered_at).toLocaleString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Family Communications Tab */}
      {activeTab === 'family' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Family Communication Log</h2>
            <button onClick={() => setShowFamilyForm(!showFamilyForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>
              + Log Communication
            </button>
          </div>
          {showFamilyForm && (
            <form onSubmit={handleLogComm} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Family Member Name</label>
                  <input type="text" value={familyForm.family_member_name} onChange={e => setFamilyForm(f => ({ ...f, family_member_name: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Communication Type</label>
                  <select value={familyForm.communication_type} onChange={e => setFamilyForm(f => ({ ...f, communication_type: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="phone">Phone</option>
                    <option value="in_person">In Person</option>
                    <option value="video">Video Call</option>
                    <option value="email">Email</option>
                    <option value="letter">Letter</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{tr('Summary')}</label>
                <textarea value={familyForm.summary} onChange={e => setFamilyForm(f => ({ ...f, summary: e.target.value }))} rows={3} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={familyForm.follow_up_required} onChange={e => setFamilyForm(f => ({ ...f, follow_up_required: e.target.checked }))} />
                <span style={{ fontSize: '0.85rem' }}>Follow-up required</span>
              </label>
              <button type="submit" disabled={logCommMutation.isPending} style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Log Communication</button>
            </form>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comms.length === 0 ? (
              <p style={{ padding: 24, textAlign: 'center', color: '#6b7280', background: '#f9fafb', borderRadius: 12 }}>No family communications logged.</p>
            ) : comms.map((comm: any) => (
              <div key={comm.id} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{comm.family_member_name}</span>
                    <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', background: '#f3f4f6', color: '#374151' }}>{comm.communication_type}</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{new Date(comm.communication_date || comm.created_at).toLocaleDateString()}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#374151' }}>{comm.summary}</p>
                {comm.follow_up_required && <span style={{ display: 'inline-block', marginTop: 8, padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', background: '#fef9c3', color: '#854d0e', fontWeight: 600 }}>Follow-up needed</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resources Tab */}
      {activeTab === 'resources' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Bereavement Support Resources</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {[
              { title: 'Cruse Bereavement Care', desc: 'Free support for anyone bereaved or affected by grief.', phone: '0808 808 1677' },
              { title: 'Marie Curie', desc: 'Support for people living with terminal illness and their families.', phone: '0800 090 2309' },
              { title: 'Macmillan Cancer Support', desc: 'Practical, emotional and financial support for people with cancer.', phone: '0808 808 0000' },
              { title: 'Samaritans', desc: '24/7 emotional support for anyone in distress.', phone: '116 123' },
              { title: 'Age UK', desc: 'Support and advice for older people and their families.', phone: '0800 678 1602' },
              { title: 'Local Hospice', desc: 'Specialist palliative care, bereavement counselling, and respite.', phone: 'Contact local service' },
            ].map(resource => (
              <div key={resource.title} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>{resource.title}</h3>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 8 }}>{resource.desc}</p>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0d9488' }}>{resource.phone}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
