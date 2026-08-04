// src/pages/FireLogBook.tsx
import React, { useState } from 'react';
import { useFireTests, useRecordFireTest, useFireEquipmentChecks, useRecordFireEquipmentCheck, usePeeps, useCreatePeep, useUpdatePeep, useFireDashboard, useResidents, useStaff } from '../hooks';

type TabType = 'tests' | 'equipment' | 'peeps';

export default function FireLogBook() {
  const [tab, setTab] = useState<TabType>('tests');
  const [showTestForm, setShowTestForm] = useState(false);
  const [showEquipForm, setShowEquipForm] = useState(false);
  const [showPeepForm, setShowPeepForm] = useState(false);
  const [editingPeep, setEditingPeep] = useState<any>(null);

  const { data: dashboard } = useFireDashboard();
  const { data: tests = [] } = useFireTests();
  const { data: equipmentChecks = [] } = useFireEquipmentChecks();
  const { data: peeps = [] } = usePeeps();
  const { data: residents = [] } = useResidents();
  const { data: staffList = [] } = useStaff();
  const recordTest = useRecordFireTest();
  const recordEquipCheck = useRecordFireEquipmentCheck();
  const createPeep = useCreatePeep();
  const updatePeep = useUpdatePeep();

  const dash = dashboard || {} as any;
  const lastWeeklyTest = dash.last_weekly_test || 'N/A';
  const nextDrillDue = dash.next_drill_due || 'N/A';
  const equipmentStatus = dash.equipment_status || 'All OK';
  const peepsCoverage = dash.peeps_coverage_percent ?? 0;

  // Test form state
  const [testForm, setTestForm] = useState({ test_date: new Date().toISOString().slice(0, 10), time_taken_seconds: '', all_clear: 'yes', issues_found: '', notes: '' });

  const handleSubmitTest = (e: React.FormEvent) => {
    e.preventDefault();
    recordTest.mutate({
      test_type: 'weekly_alarm',
      test_date: testForm.test_date,
      time_taken_seconds: testForm.time_taken_seconds ? Number(testForm.time_taken_seconds) : undefined,
      result: testForm.all_clear === 'yes' ? 'pass' : 'fail',
      issues_found: testForm.issues_found || undefined,
      notes: testForm.notes || undefined,
    }, { onSuccess: () => { setShowTestForm(false); setTestForm({ test_date: new Date().toISOString().slice(0, 10), time_taken_seconds: '', all_clear: 'yes', issues_found: '', notes: '' }); } });
  };

  // Equipment form state
  const [equipForm, setEquipForm] = useState({ equipment_type: 'extinguisher', location: '', status: 'pass', issues_found: '', next_check_due: '', notes: '' });

  const handleSubmitEquip = (e: React.FormEvent) => {
    e.preventDefault();
    recordEquipCheck.mutate({
      equipment_type: equipForm.equipment_type,
      location: equipForm.location,
      check_date: new Date().toISOString().slice(0, 10),
      status: equipForm.status,
      issues_found: equipForm.issues_found || undefined,
      next_check_due: equipForm.next_check_due || undefined,
      notes: equipForm.notes || undefined,
    }, { onSuccess: () => { setShowEquipForm(false); setEquipForm({ equipment_type: 'extinguisher', location: '', status: 'pass', issues_found: '', next_check_due: '', notes: '' }); } });
  };

  // PEEP form state
  const [peepForm, setPeepForm] = useState({ resident_id: '', mobility_needs: 'walking_aid', evacuation_method: '', assistance_required: '', equipment_needed: '', primary_helper: '', secondary_helper: '', review_date: '' });

  const handleSubmitPeep = (e: React.FormEvent) => {
    e.preventDefault();
    const resName = (residents as any[]).find((r: any) => r.id === peepForm.resident_id);
    const payload = {
      resident_id: peepForm.resident_id,
      person_name: resName ? `${resName.first_name} ${resName.last_name}` : '',
      mobility_needs: peepForm.mobility_needs,
      evacuation_method: peepForm.evacuation_method,
      assistance_required: peepForm.assistance_required,
      equipment_needed: peepForm.equipment_needed,
      primary_helper: peepForm.primary_helper,
      secondary_helper: peepForm.secondary_helper,
      review_date: peepForm.review_date || undefined,
      status: 'active',
    };
    if (editingPeep) {
      updatePeep.mutate({ id: editingPeep.id, data: payload }, { onSuccess: () => { setShowPeepForm(false); setEditingPeep(null); resetPeepForm(); } });
    } else {
      createPeep.mutate(payload, { onSuccess: () => { setShowPeepForm(false); resetPeepForm(); } });
    }
  };

  const resetPeepForm = () => setPeepForm({ resident_id: '', mobility_needs: 'walking_aid', evacuation_method: '', assistance_required: '', equipment_needed: '', primary_helper: '', secondary_helper: '', review_date: '' });

  const handleEditPeep = (peep: any) => {
    setEditingPeep(peep);
    setPeepForm({
      resident_id: peep.resident_id || '',
      mobility_needs: peep.mobility_needs || 'walking_aid',
      evacuation_method: peep.evacuation_method || '',
      assistance_required: peep.assistance_required || '',
      equipment_needed: peep.equipment_needed || '',
      primary_helper: peep.primary_helper || '',
      secondary_helper: peep.secondary_helper || '',
      review_date: peep.review_date ? peep.review_date.slice(0, 10) : '',
    });
    setShowPeepForm(true);
  };

  const statusBadge = (status: string) => {
    if (status === 'pass') return 'badge-success';
    if (status === 'fail') return 'badge-danger';
    return 'badge-warning';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Digital Fire Log Book</h1>
          <p className="page-subtitle">Weekly alarm tests, equipment checks, and PEEPs management</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Last Weekly Test', value: lastWeeklyTest !== 'N/A' ? lastWeeklyTest.slice(0, 10) : 'N/A', icon: '🔔', color: '#0d9488' },
          { label: 'Next Drill Due', value: nextDrillDue !== 'N/A' ? nextDrillDue.slice(0, 10) : 'N/A', icon: '🚨', color: '#d97706' },
          { label: 'Equipment Status', value: equipmentStatus, icon: '🧯', color: '#16a34a' },
          { label: 'PEEPs Coverage', value: `${peepsCoverage}%`, icon: '♿', color: '#7c3aed' },
        ].map(k => (
          <div key={k.label} style={{ padding: '16px', borderRadius: 12, background: 'white', border: '1px solid var(--border)', borderLeft: `4px solid ${k.color}`, boxShadow: '0 2px 6px rgba(0,0,0,.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>{k.label}</div>
              </div>
              <span style={{ fontSize: 22 }}>{k.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 10 }}>
          {([['tests', 'Weekly Tests'], ['equipment', 'Equipment'], ['peeps', 'PEEPs']] as [TabType, string][]).map(([t, label]) => (
            <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setTab(t)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Weekly Tests Tab */}
      {tab === 'tests' && (
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Weekly Alarm Tests</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowTestForm(!showTestForm)}>+ Record Test</button>
            </div>

            {showTestForm && (
              <form onSubmit={handleSubmitTest} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Date</label>
                    <input type="date" value={testForm.test_date} onChange={e => setTestForm({ ...testForm, test_date: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} required />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Time Taken (seconds)</label>
                    <input type="number" value={testForm.time_taken_seconds} onChange={e => setTestForm({ ...testForm, time_taken_seconds: e.target.value })} placeholder="e.g. 45" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>All Clear?</label>
                    <select value={testForm.all_clear} onChange={e => setTestForm({ ...testForm, all_clear: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Issues Found</label>
                    <input type="text" value={testForm.issues_found} onChange={e => setTestForm({ ...testForm, issues_found: e.target.value })} placeholder="Any issues..." style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes</label>
                  <textarea value={testForm.notes} onChange={e => setTestForm({ ...testForm, notes: e.target.value })} rows={2} placeholder="Additional notes..." style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={recordTest.isPending}>Save Test</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowTestForm(false)}>Cancel</button>
                </div>
              </form>
            )}

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Result</th><th>Conducted By</th><th>Issues</th></tr>
                </thead>
                <tbody>
                  {(tests as any[]).length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No fire tests recorded</td></tr>
                  ) : (tests as any[]).map((t: any) => (
                    <tr key={t.id}>
                      <td>{t.test_date?.slice(0, 10)}</td>
                      <td>{t.test_type?.replace(/_/g, ' ')}</td>
                      <td><span className={`badge ${statusBadge(t.result)}`}>{t.result}</span></td>
                      <td>{t.conducted_by_name || t.conducted_by || '-'}</td>
                      <td>{t.issues_found || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Equipment Tab */}
      {tab === 'equipment' && (
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Equipment Checks</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowEquipForm(!showEquipForm)}>+ Record Check</button>
            </div>

            {showEquipForm && (
              <form onSubmit={handleSubmitEquip} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Equipment Type</label>
                    <select value={equipForm.equipment_type} onChange={e => setEquipForm({ ...equipForm, equipment_type: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <option value="extinguisher">Extinguisher</option>
                      <option value="emergency_lighting">Emergency Lighting</option>
                      <option value="fire_door">Fire Door</option>
                      <option value="smoke_detector">Smoke Detector</option>
                      <option value="fire_alarm_panel">Fire Alarm Panel</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Location</label>
                    <input type="text" value={equipForm.location} onChange={e => setEquipForm({ ...equipForm, location: e.target.value })} placeholder="e.g. Ground floor corridor" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} required />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Status</label>
                    <select value={equipForm.status} onChange={e => setEquipForm({ ...equipForm, status: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <option value="pass">Pass</option>
                      <option value="fail">Fail</option>
                      <option value="needs_attention">Needs Attention</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Issues Found</label>
                    <input type="text" value={equipForm.issues_found} onChange={e => setEquipForm({ ...equipForm, issues_found: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Next Check Due</label>
                    <input type="date" value={equipForm.next_check_due} onChange={e => setEquipForm({ ...equipForm, next_check_due: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={recordEquipCheck.isPending}>Save Check</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEquipForm(false)}>Cancel</button>
                </div>
              </form>
            )}

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Type</th><th>Location</th><th>Status</th><th>Checked By</th><th>Next Check</th></tr>
                </thead>
                <tbody>
                  {(equipmentChecks as any[]).length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No equipment checks recorded</td></tr>
                  ) : (equipmentChecks as any[]).map((c: any) => (
                    <tr key={c.id}>
                      <td>{c.equipment_type?.replace(/_/g, ' ')}</td>
                      <td>{c.location}</td>
                      <td><span className={`badge ${statusBadge(c.status)}`}>{c.status?.replace(/_/g, ' ')}</span></td>
                      <td>{c.checked_by_name || c.checked_by || '-'}</td>
                      <td>{c.next_check_due?.slice(0, 10) || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PEEPs Tab */}
      {tab === 'peeps' && (
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Personal Emergency Evacuation Plans (PEEPs)</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditingPeep(null); resetPeepForm(); setShowPeepForm(!showPeepForm); }}>+ New PEEP</button>
            </div>

            {showPeepForm && (
              <form onSubmit={handleSubmitPeep} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', fontWeight: 600 }}>{editingPeep ? 'Edit PEEP' : 'Create PEEP'}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Resident</label>
                    <select value={peepForm.resident_id} onChange={e => setPeepForm({ ...peepForm, resident_id: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} required>
                      <option value="">Select resident...</option>
                      {(residents as any[]).map((r: any) => (
                        <option key={r.id} value={r.id}>{r.first_name} {r.last_name} (Room {r.room_number})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Mobility Status</label>
                    <select value={peepForm.mobility_needs} onChange={e => setPeepForm({ ...peepForm, mobility_needs: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <option value="independent">Independent</option>
                      <option value="walking_aid">Walking Aid</option>
                      <option value="wheelchair">Wheelchair</option>
                      <option value="bed_bound">Bed Bound</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Evacuation Method</label>
                    <input type="text" value={peepForm.evacuation_method} onChange={e => setPeepForm({ ...peepForm, evacuation_method: e.target.value })} placeholder="e.g. Evacuslide, Carry Chair" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} required />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Assistance Required</label>
                    <input type="text" value={peepForm.assistance_required} onChange={e => setPeepForm({ ...peepForm, assistance_required: e.target.value })} placeholder="e.g. 2 staff members" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Equipment Needed</label>
                    <input type="text" value={peepForm.equipment_needed} onChange={e => setPeepForm({ ...peepForm, equipment_needed: e.target.value })} placeholder="e.g. Evacuation chair" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Primary Helper</label>
                    <select value={peepForm.primary_helper} onChange={e => setPeepForm({ ...peepForm, primary_helper: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <option value="">Select staff...</option>
                      {(staffList as any[]).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Secondary Helper</label>
                    <select value={peepForm.secondary_helper} onChange={e => setPeepForm({ ...peepForm, secondary_helper: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <option value="">Select staff...</option>
                      {(staffList as any[]).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Review Date</label>
                    <input type="date" value={peepForm.review_date} onChange={e => setPeepForm({ ...peepForm, review_date: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={createPeep.isPending || updatePeep.isPending}>{editingPeep ? 'Update PEEP' : 'Create PEEP'}</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowPeepForm(false); setEditingPeep(null); }}>Cancel</button>
                </div>
              </form>
            )}

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Resident</th><th>Mobility</th><th>Evacuation Method</th><th>Assistance</th><th>Helpers</th><th>Review Date</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {(peeps as any[]).length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No PEEPs recorded</td></tr>
                  ) : (peeps as any[]).map((p: any) => (
                    <tr key={p.id}>
                      <td>{p.person_name || p.resident_name || '-'}</td>
                      <td>{p.mobility_needs?.replace(/_/g, ' ') || '-'}</td>
                      <td>{p.evacuation_method || '-'}</td>
                      <td>{p.assistance_required || '-'}</td>
                      <td>{p.primary_helper || '-'}{p.secondary_helper ? `, ${p.secondary_helper}` : ''}</td>
                      <td>{p.review_date?.slice(0, 10) || '-'}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => handleEditPeep(p)}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
