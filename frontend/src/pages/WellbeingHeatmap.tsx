// src/pages/WellbeingHeatmap.tsx - Real-time Wellbeing Heatmap
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

const statusColors = { green: '#16a34a', amber: '#d97706', red: '#dc2626', no_data: '#6b7280' };
const statusBg = { green: '#f0fdf4', amber: '#fffbeb', red: '#fef2f2', no_data: '#f3f4f6' };

export default function WellbeingHeatmap() {
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['wellbeing-heatmap'],
    queryFn: () => api.get('/wellbeing/heatmap').then(r => r.data),
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  const { data: history } = useQuery({
    queryKey: ['wellbeing-heatmap-history'],
    queryFn: () => api.get('/wellbeing/heatmap/history', { params: { hours: 24 } }).then(r => r.data),
  });

  const heatmap = data?.heatmap || [];
  const summary = data?.summary || { total: 0, green: 0, amber: 0, red: 0 };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🗺️ Real-time Wellbeing Heatmap</h1>
          <p className="page-subtitle">Live visual overview of resident wellbeing by room - auto-refreshes every 30 seconds</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', animation: 'pulse 2s infinite' }} />
          Live
        </div>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div className="card" style={{ padding: 16, textAlign: 'center', borderLeft: '4px solid #6b7280' }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{summary.total}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Residents</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center', borderLeft: '4px solid #16a34a' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#16a34a' }}>{summary.green}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Happy / Settled</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center', borderLeft: '4px solid #d97706' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#d97706' }}>{summary.amber}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Needs Attention</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center', borderLeft: '4px solid #dc2626' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#dc2626' }}>{summary.red}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Distressed / Pain</div>
        </div>
        <div className="card" style={{ padding: 16, textAlign: 'center', borderLeft: '4px solid #6b7280' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#6b7280' }}>{summary.no_data || 0}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No Recent Data</div>
        </div>
      </div>

      {isLoading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading heatmap data...</div>}

      {/* Heatmap Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
        {heatmap.map((room: any) => (
          <div key={room.resident_id} onClick={() => setSelectedRoom(room)} className="card" style={{ padding: 12, cursor: 'pointer', background: statusBg[room.status as keyof typeof statusBg] || '#f9fafb', borderLeft: `4px solid ${statusColors[room.status as keyof typeof statusColors] || '#6b7280'}`, transition: 'transform 0.15s', minHeight: 80 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Room {room.room_number}</span>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: statusColors[room.status as keyof typeof statusColors] || '#6b7280' }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.resident_name}</div>
            <div style={{ fontSize: 11, color: statusColors[room.status as keyof typeof statusColors] || '#6b7280' }}>{room.status_label}</div>
          </div>
        ))}
      </div>

      {/* Room Detail Panel */}
      {selectedRoom && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Room {selectedRoom.room_number} - {selectedRoom.resident_name}</h3>
            <button onClick={() => setSelectedRoom(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-muted)' }}>x</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
            <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mood</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{selectedRoom.mood}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pain Level</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{selectedRoom.pain_level}/10</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Engagement</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{selectedRoom.engagement}</div>
            </div>
            <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Risk Level</div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{selectedRoom.risk_level}</div>
            </div>
          </div>
          {selectedRoom.last_updated && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>Last updated: {new Date(selectedRoom.last_updated).toLocaleString('en-GB')}</div>
          )}
        </div>
      )}

      {/* History Section */}
      {history?.snapshots?.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>24-Hour History</h3>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
            {history.snapshots.slice(0, 24).reverse().map((snap: any, i: number) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <div style={{ height: `${(snap.red / Math.max(snap.total, 1)) * 60}px`, background: '#dc2626', borderRadius: 2 }} />
                <div style={{ height: `${(snap.amber / Math.max(snap.total, 1)) * 60}px`, background: '#d97706', borderRadius: 2 }} />
                <div style={{ height: `${(snap.green / Math.max(snap.total, 1)) * 60}px`, background: '#16a34a', borderRadius: 2 }} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>24h ago</span><span>Now</span>
          </div>
        </div>
      )}
    </div>
  );
}
