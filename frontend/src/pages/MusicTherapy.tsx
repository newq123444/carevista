import React, { useState } from 'react';
import { useMusicGenres, useMusicPreferences, useUpdateMusicPreferences, useStartMusicSession, useEndMusicSession, useMusicSessionHistory, useMusicEffectiveness, useResidents } from '../hooks';

export default function MusicTherapy() {
  const [selectedResident, setSelectedResident] = useState('');
  const [activeTab, setActiveTab] = useState<'genres' | 'preferences' | 'session' | 'history' | 'effectiveness'>('genres');
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [showPrefForm, setShowPrefForm] = useState(false);

  const { data: residents } = useResidents();
  const { data: genres = [] } = useMusicGenres();
  const { data: preferences = [] } = useMusicPreferences(selectedResident);
  const { data: sessions = [] } = useMusicSessionHistory(selectedResident);
  const { data: effectiveness } = useMusicEffectiveness(selectedResident);

  const updatePrefMutation = useUpdateMusicPreferences();
  const startSessionMutation = useStartMusicSession();
  const endSessionMutation = useEndMusicSession();

  const [sessionForm, setSessionForm] = useState({ mood_before: '5', notes: '' });
  const [prefForm, setPrefForm] = useState({ genre_id: '', tempo_preference: 'moderate', preferred_artists: '', notes: '' });

  const residentList = Array.isArray(residents) ? residents : [];
  const genreList = Array.isArray(genres) ? genres : [];
  const prefList = Array.isArray(preferences) ? preferences : [];
  const sessionList = Array.isArray(sessions) ? sessions : [];
  const effectivenessData = effectiveness || {};

  const handleStartSession = (e: React.FormEvent) => {
    e.preventDefault();
    startSessionMutation.mutate({ resident_id: selectedResident, mood_before: parseInt(sessionForm.mood_before), notes: sessionForm.notes }, {
      onSuccess: () => { setShowSessionForm(false); setSessionForm({ mood_before: '5', notes: '' }); }
    });
  };

  const handleEndSession = (id: string, mood_after: string) => {
    endSessionMutation.mutate({ id, data: { mood_after } });
  };

  const handleUpdatePreference = (e: React.FormEvent) => {
    e.preventDefault();
    updatePrefMutation.mutate({ residentId: selectedResident, data: { genreId: prefForm.genre_id, tempoPreference: prefForm.tempo_preference, preferredArtists: prefForm.preferred_artists, notes: prefForm.notes } }, {
      onSuccess: () => { setShowPrefForm(false); setPrefForm({ genre_id: '', tempo_preference: 'moderate', preferred_artists: '', notes: '' }); }
    });
  };

  const getMoodColor = (mood: string) => {
    const colors: Record<string, string> = { very_low: '#dc2626', low: '#f97316', neutral: '#6b7280', good: '#16a34a', very_good: '#059669' };
    return colors[mood] || '#6b7280';
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Music Therapy</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Manage music preferences, run therapy sessions, and track effectiveness.</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Select Resident</label>
        <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', minWidth: 300 }}>
          <option value="">Choose a resident...</option>
          {residentList.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['genres', 'preferences', 'session', 'history', 'effectiveness'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 500, cursor: 'pointer', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#111827' : '#6b7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'genres' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Genre Library</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {genreList.map((g: any) => (
              <div key={g.id} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>{g.name}</div>
                {g.description && <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>{g.description}</div>}
              </div>
            ))}
            {genreList.length === 0 && <p style={{ color: '#6b7280' }}>No genres available yet.</p>}
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Music Preferences</h2>
            <button onClick={() => setShowPrefForm(!showPrefForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>+ Add Preference</button>
          </div>
          {showPrefForm && (
            <form onSubmit={handleUpdatePreference} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Genre</label>
                  <select value={prefForm.genre_id} onChange={e => setPrefForm(f => ({ ...f, genre_id: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="">Select genre...</option>
                    {genreList.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Tempo Preference</label>
                  <select value={prefForm.tempo_preference} onChange={e => setPrefForm(f => ({ ...f, tempo_preference: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="slow">Slow</option>
                    <option value="moderate">Moderate</option>
                    <option value="fast">Fast</option>
                    <option value="varied">Varied</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Preferred Artists (comma-separated)</label>
                  <input type="text" value={prefForm.preferred_artists} onChange={e => setPrefForm(f => ({ ...f, preferred_artists: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Notes</label>
                  <input type="text" value={prefForm.notes} onChange={e => setPrefForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Save Preference</button>
            </form>
          )}
          {prefList.map((p: any) => (
            <div key={p.id} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>{p.genre_name || 'Unknown Genre'}</span>
                <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: '#f3f4f6', color: '#6b7280' }}>{p.tempo_preference || 'moderate'}</span>
              </div>
              {p.preferred_artists && <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 4 }}>Artists: {p.preferred_artists}</div>}
            </div>
          ))}
          {prefList.length === 0 && selectedResident && <p style={{ color: '#6b7280' }}>No preferences recorded for this resident.</p>}
        </div>
      )}

      {activeTab === 'session' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Start Session</h2>
            <button onClick={() => setShowSessionForm(!showSessionForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>+ New Session</button>
          </div>
          {showSessionForm && (
            <form onSubmit={handleStartSession} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Mood Before</label>
                  <select value={sessionForm.mood_before} onChange={e => setSessionForm(f => ({ ...f, mood_before: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="very_low">Very Low</option>
                    <option value="low">Low</option>
                    <option value="neutral">Neutral</option>
                    <option value="good">Good</option>
                    <option value="very_good">Very Good</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Notes</label>
                  <input type="text" value={sessionForm.notes} onChange={e => setSessionForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Start Session</button>
            </form>
          )}
          {sessionList.filter((s: any) => s.status === 'active').map((s: any) => (
            <div key={s.id} style={{ padding: 16, background: '#fffbeb', borderRadius: 12, border: '1px solid #fde68a', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>Active Session</span>
                  <span style={{ marginLeft: 12, color: getMoodColor(s.mood_before), fontSize: '0.82rem' }}>Mood before: {s.mood_before}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['very_low', 'low', 'neutral', 'good', 'very_good'] as const).map(mood => (
                    <button key={mood} onClick={() => handleEndSession(s.id, mood)} style={{ padding: '4px 10px', background: getMoodColor(mood), color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' }}>{mood.replace('_', ' ')}</button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Session History</h2>
          {sessionList.map((s: any) => (
            <div key={s.id} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{new Date(s.started_at).toLocaleDateString()}</span>
                  <span style={{ marginLeft: 12, fontSize: '0.82rem', color: '#6b7280' }}>{s.duration_minutes ? `${s.duration_minutes} min` : 'In progress'}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: getMoodColor(s.mood_before) + '20', color: getMoodColor(s.mood_before) }}>Before: {s.mood_before}</span>
                  {s.mood_after && <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: getMoodColor(s.mood_after) + '20', color: getMoodColor(s.mood_after) }}>After: {s.mood_after}</span>}
                </div>
              </div>
            </div>
          ))}
          {sessionList.length === 0 && <p style={{ color: '#6b7280' }}>No sessions recorded yet.</p>}
        </div>
      )}

      {activeTab === 'effectiveness' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Effectiveness Report</h2>
          {effectivenessData && typeof effectivenessData === 'object' && Object.keys(effectivenessData).length > 0 ? (
            <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: 12 }}>Analysis of music sessions and their impact on mood for the selected resident.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {Object.entries(effectivenessData as Record<string, any>).filter(([k]) => k !== 'id' && k !== 'care_home_id' && k !== 'resident_id').map(([key, value]) => (
                  <div key={key} style={{ padding: 12, background: '#faf5ff', borderRadius: 8, border: '1px solid #e9d5ff', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b' }}>
                      {value == null ? '-' : typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : typeof value === 'object' ? (Array.isArray(value) ? value.join(', ') : Object.keys(value).length) : String(value)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500, textTransform: 'capitalize', marginTop: 4 }}>{key.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: '#6b7280' }}>Select a resident and complete some sessions to see effectiveness data.</p>
          )}
        </div>
      )}
    </div>
  );
}
