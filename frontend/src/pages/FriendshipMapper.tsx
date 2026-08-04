import React, { useState } from 'react';
import { useRecordFriendshipObservation, useFriendshipConnections, useFriendshipNetwork, useSeatingSuggestions, useIsolatedResidents, useResidents } from '../hooks';

export default function FriendshipMapper() {
  const [selectedResident, setSelectedResident] = useState('');
  const [activeTab, setActiveTab] = useState<'observe' | 'network' | 'seating' | 'isolated'>('observe');
  const [showForm, setShowForm] = useState(false);

  const { data: residents } = useResidents();
  const { data: connections = [] } = useFriendshipConnections(selectedResident);
  const { data: network } = useFriendshipNetwork();
  const { data: seating } = useSeatingSuggestions();
  const { data: isolated = [] } = useIsolatedResidents();

  const observationMutation = useRecordFriendshipObservation();

  const [form, setForm] = useState({ resident_a_id: '', resident_b_id: '', interaction_type: 'conversation', quality: 'positive', context: '', notes: '' });

  const residentList = Array.isArray(residents) ? residents : [];
  const connectionList = Array.isArray(connections) ? connections : [];
  const isolatedList = Array.isArray(isolated) ? isolated : [];
  const networkData = network || { nodes: [], edges: [] };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    observationMutation.mutate(form, {
      onSuccess: () => { setShowForm(false); setForm({ resident_a_id: '', resident_b_id: '', interaction_type: 'conversation', quality: 'positive', context: '', notes: '' }); }
    });
  };

  const getQualityColor = (quality: string) => {
    if (quality === 'positive') return '#16a34a';
    if (quality === 'negative') return '#dc2626';
    return '#6b7280';
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Friendship Mapper</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Track resident relationships, visualize social networks, and identify isolation.</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Select Resident</label>
        <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', minWidth: 300 }}>
          <option value="">Choose a resident...</option>
          {residentList.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['observe', 'network', 'seating', 'isolated'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 500, cursor: 'pointer', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#111827' : '#6b7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {tab === 'observe' ? 'Record Observation' : tab === 'isolated' ? 'Isolated Residents' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'observe' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Record Observation</h2>
            <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>+ New Observation</button>
          </div>
          {showForm && (
            <form onSubmit={handleSubmit} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Resident A</label>
                  <select value={form.resident_a_id} onChange={e => setForm(f => ({ ...f, resident_a_id: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="">Select...</option>
                    {residentList.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Resident B</label>
                  <select value={form.resident_b_id} onChange={e => setForm(f => ({ ...f, resident_b_id: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="">Select...</option>
                    {residentList.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Interaction Type</label>
                  <select value={form.interaction_type} onChange={e => setForm(f => ({ ...f, interaction_type: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="conversation">Conversation</option>
                    <option value="activity">Activity</option>
                    <option value="meal">Meal</option>
                    <option value="spontaneous">Spontaneous</option>
                    <option value="conflict">Conflict</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Quality</label>
                  <select value={form.quality} onChange={e => setForm(f => ({ ...f, quality: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="positive">Positive</option>
                    <option value="neutral">Neutral</option>
                    <option value="negative">Negative</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Context</label>
                  <input type="text" value={form.context} onChange={e => setForm(f => ({ ...f, context: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="e.g. lounge, garden" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Notes</label>
                  <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Record</button>
            </form>
          )}
          {selectedResident && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Connections for Selected Resident</h3>
              {connectionList.map((c: any) => (
                <div key={c.id} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{c.resident_a_name} &harr; {c.resident_b_name}</span>
                    <span style={{ marginLeft: 12, fontSize: '0.82rem', color: '#6b7280' }}>Interactions: {c.interaction_count}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 60, height: 6, background: '#e5e7eb', borderRadius: 3 }}>
                      <div style={{ width: `${Math.min(c.strength * 10, 100)}%`, height: '100%', background: '#0d9488', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{c.strength}/10</span>
                  </div>
                </div>
              ))}
              {connectionList.length === 0 && <p style={{ color: '#6b7280' }}>No connections recorded yet.</p>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'network' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Social Network</h2>
          <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', minHeight: 300 }}>
            <svg width="100%" height="300" viewBox="0 0 600 300" style={{ background: '#fafafa', borderRadius: 8 }}>
              {Array.isArray(networkData.edges) && networkData.edges.map((edge: any, i: number) => (
                <line key={i} x1={50 + (i * 40) % 500} y1={50 + (i * 30) % 200} x2={100 + (i * 50) % 500} y2={80 + (i * 25) % 200} stroke={getQualityColor(edge.quality || 'neutral')} strokeWidth={Math.max(1, (edge.strength || 1) / 2)} opacity={0.6} />
              ))}
              {Array.isArray(networkData.nodes) && networkData.nodes.map((node: any, i: number) => (
                <g key={i}>
                  <circle cx={80 + (i * 70) % 500} cy={60 + (i * 50) % 220} r={12} fill="#0d9488" opacity={0.8} />
                  <text x={80 + (i * 70) % 500} y={60 + (i * 50) % 220 + 25} textAnchor="middle" fontSize="9" fill="#374151">{node.name || `R${i + 1}`}</text>
                </g>
              ))}
              {(!networkData.nodes || networkData.nodes.length === 0) && (
                <text x="300" y="150" textAnchor="middle" fontSize="14" fill="#6b7280">Record observations to build the network graph</text>
              )}
            </svg>
          </div>
        </div>
      )}

      {activeTab === 'seating' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Seating Suggestions</h2>
          {seating && typeof seating === 'object' ? (
            <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              {Array.isArray(seating) ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {(seating as any[]).map((item: any, i: number) => (
                    <div key={i} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
                        {Object.entries(item).filter(([k]) => k !== 'id' && k !== 'care_home_id').map(([key, value]) => (
                          <div key={key}>
                            <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'capitalize', marginBottom: 2 }}>{key.replace(/_/g, ' ')}</div>
                            <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 500 }}>
                              {value == null ? '-' : typeof value === 'object' ? (Array.isArray(value) ? value.join(', ') : JSON.stringify(value)) : String(value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                  {Object.entries(seating as Record<string, any>).filter(([k]) => k !== 'id' && k !== 'care_home_id').map(([key, value]) => (
                    <div key={key} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500, textTransform: 'capitalize', marginBottom: 4 }}>{key.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 600 }}>
                        {value == null ? '-' : typeof value === 'object' ? (Array.isArray(value) ? value.join(', ') : JSON.stringify(value)) : String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : <p style={{ color: '#6b7280' }}>No seating suggestions available yet. Record more observations to generate suggestions.</p>}
        </div>
      )}

      {activeTab === 'isolated' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Isolated Residents</h2>
          {isolatedList.length > 0 ? (
            isolatedList.map((r: any) => (
              <div key={r.id || r.resident_id} style={{ padding: 14, background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{r.resident_name || r.first_name + ' ' + r.last_name}</div>
                  <div style={{ fontSize: '0.82rem', color: '#dc2626' }}>Low social interaction detected</div>
                </div>
              </div>
            ))
          ) : <p style={{ color: '#6b7280' }}>No isolated residents detected. All residents have adequate social connections.</p>}
        </div>
      )}
    </div>
  );
}
