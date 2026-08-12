import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useMoodSuggestions, useRecordMoodIntervention, useMoodInterventionHistory, useMoodEffectiveness, useResidents } from '../hooks';

export default function MoodEnvironment() {
  const { t: tr } = useLang();
  const [selectedResident, setSelectedResident] = useState('');
  const [activeTab, setActiveTab] = useState<'suggestions' | 'record' | 'history' | 'effectiveness'>('suggestions');
  const [showForm, setShowForm] = useState(false);

  const { data: residents } = useResidents();
  const { data: suggestions = [] } = useMoodSuggestions(selectedResident);
  const { data: history = [] } = useMoodInterventionHistory(selectedResident);
  const { data: effectiveness = [] } = useMoodEffectiveness(selectedResident);

  const recordMutation = useRecordMoodIntervention();

  const [form, setForm] = useState({ intervention_type: '', mood_before: 'low', mood_after: 'neutral', notes: '' });

  const residentList = Array.isArray(residents) ? residents : [];
  const suggestionList = Array.isArray(suggestions) ? suggestions : [];
  const historyList = Array.isArray(history) ? history : [];
  const effectivenessList = Array.isArray(effectiveness) ? effectiveness : [];

  const handleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    recordMutation.mutate({ resident_id: selectedResident, intervention_type: form.intervention_type, mood_before: form.mood_before, mood_after: form.mood_after, notes: form.notes }, {
      onSuccess: () => { setShowForm(false); setForm({ intervention_type: '', mood_before: 'low', mood_after: 'neutral', notes: '' }); }
    });
  };

  const getMoodColor = (mood: string) => {
    const colors: Record<string, string> = { very_low: '#dc2626', low: '#f97316', neutral: '#6b7280', good: '#16a34a', very_good: '#059669' };
    return colors[mood] || '#6b7280';
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Mood-Responsive Environment</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Personalized interventions based on mood, with effectiveness tracking.</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Select Resident</label>
        <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', minWidth: 300 }}>
          <option value="">Choose a resident...</option>
          {residentList.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['suggestions', 'record', 'history', 'effectiveness'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 500, cursor: 'pointer', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#111827' : '#6b7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'suggestions' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Intervention Suggestions</h2>
          {selectedResident ? (
            suggestionList.length > 0 ? (
              suggestionList.map((s: any, i: number) => (
                <div key={i} style={{ padding: 14, background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{s.intervention_type || s.name || `Intervention ${i + 1}`}</div>
                  {s.avg_effectiveness && <div style={{ fontSize: '0.82rem', color: '#0d9488', marginTop: 4 }}>Avg effectiveness: {s.avg_effectiveness}/10</div>}
                  {s.description && <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 4 }}>{s.description}</div>}
                </div>
              ))
            ) : <p style={{ color: '#6b7280' }}>No suggestions available. Record interventions to build effectiveness data.</p>
          ) : <p style={{ color: '#6b7280' }}>Select a resident to see personalized intervention suggestions.</p>}
        </div>
      )}

      {activeTab === 'record' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Record Intervention</h2>
            <button onClick={() => setShowForm(!showForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>+ Record</button>
          </div>
          {showForm && (
            <form onSubmit={handleRecord} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Intervention Type</label>
                  <input type="text" value={form.intervention_type} onChange={e => setForm(f => ({ ...f, intervention_type: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="e.g. music, garden walk" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Mood Before</label>
                  <select value={form.mood_before} onChange={e => setForm(f => ({ ...f, mood_before: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="very_low">Very Low</option>
                    <option value="low">{tr('Low')}</option>
                    <option value="neutral">Neutral</option>
                    <option value="good">{tr('Good')}</option>
                    <option value="very_good">Very Good</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Mood After</label>
                  <select value={form.mood_after} onChange={e => setForm(f => ({ ...f, mood_after: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="very_low">Very Low</option>
                    <option value="low">{tr('Low')}</option>
                    <option value="neutral">Neutral</option>
                    <option value="good">{tr('Good')}</option>
                    <option value="very_good">Very Good</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{tr('Notes')}</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Record Intervention</button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Intervention History</h2>
          {historyList.map((h: any) => (
            <div key={h.id} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{h.intervention_type}</span>
                <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>{new Date(h.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: getMoodColor(h.mood_before) + '20', color: getMoodColor(h.mood_before) }}>Before: {h.mood_before}</span>
                <span style={{ color: '#6b7280' }}>&#8594;</span>
                {h.mood_after && <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', background: getMoodColor(h.mood_after) + '20', color: getMoodColor(h.mood_after) }}>After: {h.mood_after}</span>}
              </div>
            </div>
          ))}
          {historyList.length === 0 && <p style={{ color: '#6b7280' }}>No intervention history recorded yet.</p>}
        </div>
      )}

      {activeTab === 'effectiveness' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Effectiveness Dashboard</h2>
          {effectivenessList.length > 0 ? (
            effectivenessList.map((e: any, i: number) => (
              <div key={i} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{e.intervention_type}</span>
                  <span style={{ marginLeft: 12, fontSize: '0.82rem', color: '#6b7280' }}>Used {e.usage_count} times</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 80, height: 8, background: '#e5e7eb', borderRadius: 4 }}>
                    <div style={{ width: `${(e.avg_effectiveness || 0) * 10}%`, height: '100%', background: '#16a34a', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#16a34a' }}>{e.avg_effectiveness}/10</span>
                </div>
              </div>
            ))
          ) : <p style={{ color: '#6b7280' }}>Record interventions to see effectiveness data.</p>}
        </div>
      )}
    </div>
  );
}
