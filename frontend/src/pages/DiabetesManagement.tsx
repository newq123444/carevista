import React, { useState } from 'react';
import { useGlucoseReadings, useLogGlucose, useInsulinDoses, useLogInsulinDose, useHba1cHistory, useRecordHba1c, useDiabetesAlerts, useAcknowledgeDiabetesAlert, useGlucosePatterns, useResidents } from '../hooks';

export default function DiabetesManagement() {
  const [selectedResident, setSelectedResident] = useState('');
  const [activeTab, setActiveTab] = useState<'glucose' | 'insulin' | 'hba1c' | 'alerts' | 'patterns'>('glucose');
  const [showGlucoseForm, setShowGlucoseForm] = useState(false);
  const [showInsulinForm, setShowInsulinForm] = useState(false);
  const [showHba1cForm, setShowHba1cForm] = useState(false);

  const { data: residents } = useResidents();
  const { data: glucoseReadings = [] } = useGlucoseReadings(selectedResident);
  const { data: insulinDoses = [] } = useInsulinDoses(selectedResident);
  const { data: hba1cHistory = [] } = useHba1cHistory(selectedResident);
  const { data: alerts = [] } = useDiabetesAlerts();
  const { data: patterns } = useGlucosePatterns(selectedResident);

  const logGlucoseMutation = useLogGlucose();
  const logInsulinMutation = useLogInsulinDose();
  const recordHba1cMutation = useRecordHba1c();
  const ackAlertMutation = useAcknowledgeDiabetesAlert();

  const [glucoseForm, setGlucoseForm] = useState({ reading_mmol: '', meal_timing: 'fasting', notes: '' });
  const [insulinForm, setInsulinForm] = useState({ insulin_type: '', dose_units: '', injection_site: '', notes: '' });
  const [hba1cForm, setHba1cForm] = useState({ value_mmol_mol: '', test_date: new Date().toISOString().split('T')[0] });

  const residentList = Array.isArray(residents) ? residents : [];
  const readings = Array.isArray(glucoseReadings) ? glucoseReadings : [];
  const doses = Array.isArray(insulinDoses) ? insulinDoses : [];
  const hba1cs = Array.isArray(hba1cHistory) ? hba1cHistory : [];
  const alertList = Array.isArray(alerts) ? alerts : [];
  const patternData = patterns || {};

  const handleLogGlucose = (e: React.FormEvent) => {
    e.preventDefault();
    logGlucoseMutation.mutate({ resident_id: selectedResident, reading_mmol: parseFloat(glucoseForm.reading_mmol), meal_timing: glucoseForm.meal_timing, notes: glucoseForm.notes }, {
      onSuccess: () => { setShowGlucoseForm(false); setGlucoseForm({ reading_mmol: '', meal_timing: 'fasting', notes: '' }); }
    });
  };

  const handleLogInsulin = (e: React.FormEvent) => {
    e.preventDefault();
    logInsulinMutation.mutate({ resident_id: selectedResident, insulin_type: insulinForm.insulin_type, dose_units: parseFloat(insulinForm.dose_units), injection_site: insulinForm.injection_site, notes: insulinForm.notes }, {
      onSuccess: () => { setShowInsulinForm(false); setInsulinForm({ insulin_type: '', dose_units: '', injection_site: '', notes: '' }); }
    });
  };

  const handleRecordHba1c = (e: React.FormEvent) => {
    e.preventDefault();
    recordHba1cMutation.mutate({ resident_id: selectedResident, value_mmol_mol: parseFloat(hba1cForm.value_mmol_mol), test_date: hba1cForm.test_date }, {
      onSuccess: () => { setShowHba1cForm(false); setHba1cForm({ value_mmol_mol: '', test_date: new Date().toISOString().split('T')[0] }); }
    });
  };

  const getGlucoseColor = (val: number) => {
    if (val < 4) return '#dc2626';
    if (val > 10) return '#dc2626';
    if (val >= 4 && val <= 7) return '#16a34a';
    return '#ca8a04';
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Diabetes Management</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Track glucose readings, insulin doses, HbA1c results, and manage alerts.</p>

      {/* Resident Selector */}
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Select Resident</label>
        <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', minWidth: 300 }}>
          <option value="">Choose a resident...</option>
          {residentList.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>)}
        </select>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['glucose', 'insulin', 'hba1c', 'alerts', 'patterns'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 500, cursor: 'pointer', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#111827' : '#6b7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {tab === 'hba1c' ? 'HbA1c' : tab}
          </button>
        ))}
      </div>

      {/* Glucose Tab */}
      {activeTab === 'glucose' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Glucose Readings</h2>
            <button onClick={() => setShowGlucoseForm(!showGlucoseForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>
              + Log Reading
            </button>
          </div>
          {showGlucoseForm && (
            <form onSubmit={handleLogGlucose} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Reading (mmol/L)</label>
                  <input type="number" step="0.1" value={glucoseForm.reading_mmol} onChange={e => setGlucoseForm(f => ({ ...f, reading_mmol: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Meal Timing</label>
                  <select value={glucoseForm.meal_timing} onChange={e => setGlucoseForm(f => ({ ...f, meal_timing: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="fasting">Fasting</option>
                    <option value="pre_meal">Pre-meal</option>
                    <option value="post_meal">Post-meal</option>
                    <option value="bedtime">Bedtime</option>
                    <option value="random">Random</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Notes</label>
                  <input type="text" value={glucoseForm.notes} onChange={e => setGlucoseForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" disabled={logGlucoseMutation.isPending} style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                {logGlucoseMutation.isPending ? 'Logging...' : 'Log Glucose'}
              </button>
            </form>
          )}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            {readings.length === 0 ? (
              <p style={{ padding: 24, textAlign: 'center', color: '#6b7280', margin: 0 }}>No glucose readings recorded.</p>
            ) : readings.map((r: any) => (
              <div key={r.id} style={{ padding: 12, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 8, background: getGlucoseColor(r.reading_mmol) + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: getGlucoseColor(r.reading_mmol) }}>{r.reading_mmol}</span>
                  <div>
                    <span style={{ fontWeight: 500 }}>{r.reading_mmol} mmol/L</span>
                    <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#6b7280', textTransform: 'capitalize' }}>{(r.meal_timing || '').replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{new Date(r.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insulin Tab */}
      {activeTab === 'insulin' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Insulin Doses</h2>
            <button onClick={() => setShowInsulinForm(!showInsulinForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>
              + Log Dose
            </button>
          </div>
          {showInsulinForm && (
            <form onSubmit={handleLogInsulin} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Insulin Type</label>
                  <input type="text" value={insulinForm.insulin_type} onChange={e => setInsulinForm(f => ({ ...f, insulin_type: e.target.value }))} required placeholder="e.g. NovoRapid" style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Units</label>
                  <input type="number" value={insulinForm.dose_units} onChange={e => setInsulinForm(f => ({ ...f, dose_units: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Injection Site</label>
                  <select value={insulinForm.injection_site} onChange={e => setInsulinForm(f => ({ ...f, injection_site: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="">Select site...</option>
                    <option value="abdomen">Abdomen</option>
                    <option value="thigh">Thigh</option>
                    <option value="upper_arm">Upper Arm</option>
                    <option value="buttock">Buttock</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={logInsulinMutation.isPending} style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                {logInsulinMutation.isPending ? 'Logging...' : 'Log Dose'}
              </button>
            </form>
          )}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            {doses.length === 0 ? (
              <p style={{ padding: 24, textAlign: 'center', color: '#6b7280', margin: 0 }}>No insulin doses recorded.</p>
            ) : doses.map((d: any) => (
              <div key={d.id} style={{ padding: 12, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{d.insulin_type}</span>
                  <span style={{ marginLeft: 8, color: '#0d9488', fontWeight: 600 }}>{d.dose_units} units</span>
                  {d.injection_site && <span style={{ marginLeft: 8, fontSize: '0.8rem', color: '#6b7280' }}>({d.injection_site})</span>}
                </div>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{new Date(d.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HbA1c Tab */}
      {activeTab === 'hba1c' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>HbA1c History</h2>
            <button onClick={() => setShowHba1cForm(!showHba1cForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>
              + Record HbA1c
            </button>
          </div>
          {showHba1cForm && (
            <form onSubmit={handleRecordHba1c} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Value (mmol/mol)</label>
                  <input type="number" value={hba1cForm.value_mmol_mol} onChange={e => setHba1cForm(f => ({ ...f, value_mmol_mol: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Test Date</label>
                  <input type="date" value={hba1cForm.test_date} onChange={e => setHba1cForm(f => ({ ...f, test_date: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" disabled={recordHba1cMutation.isPending} style={{ padding: '8px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>
                {recordHba1cMutation.isPending ? 'Recording...' : 'Record HbA1c'}
              </button>
            </form>
          )}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            {hba1cs.length === 0 ? (
              <p style={{ padding: 24, textAlign: 'center', color: '#6b7280', margin: 0 }}>No HbA1c records.</p>
            ) : hba1cs.map((h: any) => (
              <div key={h.id} style={{ padding: 12, borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{h.value_mmol_mol} mmol/mol</span>
                  {h.value_percent && <span style={{ marginLeft: 8, color: '#6b7280' }}>({h.value_percent}%)</span>}
                </div>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{h.test_date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Diabetes Alerts</h2>
          {alertList.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <p style={{ color: '#6b7280', margin: 0 }}>No active alerts.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {alertList.map((alert: any) => (
                <div key={alert.id} style={{ padding: 16, background: alert.severity === 'critical' || alert.severity === 'high' ? '#fef2f2' : '#fffbeb', borderRadius: 12, border: `1px solid ${alert.severity === 'critical' || alert.severity === 'high' ? '#fecaca' : '#fde68a'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{alert.resident_name}</span>
                      <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: alert.alert_type === 'hypo' ? '#fee2e2' : '#fef9c3', color: alert.alert_type === 'hypo' ? '#991b1b' : '#854d0e', textTransform: 'uppercase' }}>
                        {alert.alert_type}
                      </span>
                    </div>
                    {alert.status === 'active' && (
                      <button onClick={() => ackAlertMutation.mutate({ id: alert.id, data: { status: 'acknowledged' } })} style={{ padding: '4px 10px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                        Acknowledge
                      </button>
                    )}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#374151' }}>{alert.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Patterns Tab */}
      {activeTab === 'patterns' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Glucose Patterns</h2>
          {!selectedResident ? (
            <p style={{ color: '#6b7280' }}>Select a resident to view glucose patterns.</p>
          ) : (
            <div style={{ padding: 20, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: 8, textAlign: 'left', color: '#6b7280' }}>Time Period</th>
                      <th style={{ padding: 8, textAlign: 'center', color: '#6b7280' }}>Mon</th>
                      <th style={{ padding: 8, textAlign: 'center', color: '#6b7280' }}>Tue</th>
                      <th style={{ padding: 8, textAlign: 'center', color: '#6b7280' }}>Wed</th>
                      <th style={{ padding: 8, textAlign: 'center', color: '#6b7280' }}>Thu</th>
                      <th style={{ padding: 8, textAlign: 'center', color: '#6b7280' }}>Fri</th>
                      <th style={{ padding: 8, textAlign: 'center', color: '#6b7280' }}>Sat</th>
                      <th style={{ padding: 8, textAlign: 'center', color: '#6b7280' }}>Sun</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['Fasting', 'Pre-lunch', 'Post-lunch', 'Pre-dinner', 'Post-dinner', 'Bedtime'].map(period => (
                      <tr key={period} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: 8, fontWeight: 500 }}>{period}</td>
                        {[0, 1, 2, 3, 4, 5, 6].map(day => {
                          const val = (patternData as any)?.[period]?.[day];
                          return (
                            <td key={day} style={{ padding: 8, textAlign: 'center' }}>
                              {val ? (
                                <span style={{ padding: '2px 6px', borderRadius: 4, background: getGlucoseColor(val) + '20', color: getGlucoseColor(val), fontWeight: 600 }}>{val}</span>
                              ) : (
                                <span style={{ color: '#d1d5db' }}>-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 16, justifyContent: 'center', fontSize: '0.8rem' }}>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: '#dcfce7', marginRight: 4 }} /> 4-7 (Target)</span>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: '#fef9c3', marginRight: 4 }} /> 7-10 (Elevated)</span>
                <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: '#fee2e2', marginRight: 4 }} /> &lt;4 or &gt;10 (Alert)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
