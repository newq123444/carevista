import React, { useState } from 'react';
import { useLogSleep, useSleepHistory, useSleepProfile, useSleepDisturbances, useSleepSuggestions, useResidents } from '../hooks';

export default function SleepQualityTracker() {
  const [selectedResident, setSelectedResident] = useState('');
  const [activeTab, setActiveTab] = useState<'log' | 'history' | 'profile' | 'suggestions'>('log');
  const [showForm, setShowForm] = useState(false);

  const { data: residents } = useResidents();
  const { data: sleepHistory = [] } = useSleepHistory(selectedResident);
  const { data: profile } = useSleepProfile(selectedResident);
  const { data: suggestions = [] } = useSleepSuggestions(selectedResident);

  const logSleepMutation = useLogSleep();

  const [form, setForm] = useState({
    sleep_date: new Date().toISOString().split('T')[0],
    bedtime: '22:00',
    wake_time: '07:00',
    disturbances: '0',
    disturbance_types: { pain: false, anxiety: false, toileting: false, noise: false, confusion: false },
    interventions: '',
    quality_rating: '5',
    notes: ''
  });

  const residentList = Array.isArray(residents) ? residents : [];
  const historyList = Array.isArray(sleepHistory) ? sleepHistory : [];
  const suggestionList = Array.isArray(suggestions) ? suggestions : [];
  const profileData = profile || null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const distTypes = Object.entries(form.disturbance_types).filter(([_, v]) => v).map(([k]) => k);
    logSleepMutation.mutate({
      resident_id: selectedResident,
      sleep_date: form.sleep_date,
      bedtime: form.bedtime,
      wake_time: form.wake_time,
      disturbances: parseInt(form.disturbances),
      disturbance_types: distTypes,
      interventions: form.interventions ? form.interventions.split(',').map(s => s.trim()) : [],
      quality_rating: parseInt(form.quality_rating),
      notes: form.notes
    }, {
      onSuccess: () => { setShowForm(false); setForm({ sleep_date: new Date().toISOString().split('T')[0], bedtime: '22:00', wake_time: '07:00', disturbances: '0', disturbance_types: { pain: false, anxiety: false, toileting: false, noise: false, confusion: false }, interventions: '', quality_rating: '5', notes: '' }); }
    });
  };

  const getQualityColor = (rating: number) => {
    if (rating >= 8) return '#16a34a';
    if (rating >= 5) return '#ca8a04';
    return '#dc2626';
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Sleep Quality Tracker</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Track sleep patterns, disturbances, and get improvement suggestions.</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Select Resident</label>
        <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', minWidth: 300 }}>
          <option value="">Choose a resident...</option>
          {residentList.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['log', 'history', 'profile', 'suggestions'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 500, cursor: 'pointer', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#111827' : '#6b7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {tab === 'log' ? 'Log Sleep' : tab === 'profile' ? 'Sleep Profile' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'log' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Log Sleep Entry</h2>
            <button onClick={() => setShowForm(!showForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>+ Log Sleep</button>
          </div>
          {showForm && (
            <form onSubmit={handleSubmit} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Date</label>
                  <input type="date" value={form.sleep_date} onChange={e => setForm(f => ({ ...f, sleep_date: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Bedtime</label>
                  <input type="time" value={form.bedtime} onChange={e => setForm(f => ({ ...f, bedtime: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Wake Time</label>
                  <input type="time" value={form.wake_time} onChange={e => setForm(f => ({ ...f, wake_time: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Quality (1-10)</label>
                  <input type="number" min="1" max="10" value={form.quality_rating} onChange={e => setForm(f => ({ ...f, quality_rating: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Disturbances Count</label>
                  <input type="number" min="0" value={form.disturbances} onChange={e => setForm(f => ({ ...f, disturbances: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 8 }}>Disturbance Types</label>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {Object.entries(form.disturbance_types).map(([key, val]) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={val} onChange={e => setForm(f => ({ ...f, disturbance_types: { ...f.disturbance_types, [key]: e.target.checked } }))} />
                        {key}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Interventions Used (comma-separated)</label>
                  <input type="text" value={form.interventions} onChange={e => setForm(f => ({ ...f, interventions: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="e.g. warm milk, repositioning" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Notes</label>
                  <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Log Sleep</button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Sleep History</h2>
          {historyList.length > 0 && (
            <div style={{ marginBottom: 20, padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: 8 }}>Quality Trend (last entries)</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                {historyList.slice(0, 14).map((h: any, i: number) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ width: '100%', height: `${(h.quality_rating || 5) * 8}px`, background: getQualityColor(h.quality_rating || 5), borderRadius: 4, minHeight: 4 }} />
                    <span style={{ fontSize: '0.6rem', color: '#9ca3af' }}>{h.quality_rating}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {historyList.map((h: any) => (
            <div key={h.id} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{h.sleep_date}</span>
                  <span style={{ marginLeft: 12, fontSize: '0.82rem', color: '#6b7280' }}>{h.bedtime} - {h.wake_time}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>{h.disturbances} disturbances</span>
                  <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, background: getQualityColor(h.quality_rating) + '20', color: getQualityColor(h.quality_rating) }}>{h.quality_rating}/10</span>
                </div>
              </div>
              {h.disturbance_types?.length > 0 && <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#6b7280' }}>Types: {h.disturbance_types.join(', ')}</div>}
            </div>
          ))}
          {historyList.length === 0 && <p style={{ color: '#6b7280' }}>No sleep logs recorded yet.</p>}
        </div>
      )}

      {activeTab === 'profile' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Sleep Profile</h2>
          {profileData ? (
            <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>Avg Bedtime</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{profileData.avg_bedtime || '--'}</div>
                </div>
                <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>Avg Wake Time</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{profileData.avg_wake_time || '--'}</div>
                </div>
                <div style={{ padding: 12, background: '#f9fafb', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 }}>Avg Quality</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: getQualityColor(profileData.avg_quality_rating || 5) }}>{profileData.avg_quality_rating || '--'}/10</div>
                </div>
              </div>
              {profileData.trend_direction && (
                <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: profileData.trend_direction === 'improving' ? '#dcfce7' : profileData.trend_direction === 'declining' ? '#fee2e2' : '#f3f4f6' }}>
                  <span style={{ fontWeight: 600 }}>Trend: </span>
                  <span style={{ textTransform: 'capitalize' }}>{profileData.trend_direction}</span>
                </div>
              )}
            </div>
          ) : <p style={{ color: '#6b7280' }}>Select a resident to see their sleep profile.</p>}
        </div>
      )}

      {activeTab === 'suggestions' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Improvement Suggestions</h2>
          {suggestionList.length > 0 ? (
            suggestionList.map((s: any, i: number) => (
              <div key={i} style={{ padding: 14, background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', marginBottom: 8 }}>
                <div style={{ fontWeight: 500 }}>{typeof s === 'string' ? s : s.suggestion || s.title || `Suggestion ${i + 1}`}</div>
                {s.reason && <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 4 }}>{s.reason}</div>}
              </div>
            ))
          ) : <p style={{ color: '#6b7280' }}>Select a resident and log sleep data to see suggestions.</p>}
        </div>
      )}
    </div>
  );
}
