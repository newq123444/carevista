// src/components/ActivitiesWidget.tsx - Dashboard widget for activities
import React from 'react';
import { Link } from 'react-router-dom';
import { useSessions, useWellbeingDashboard } from '../hooks';
import type { ActivitySession, WellbeingStats } from '../types';

const CATEGORY_ICONS: Record<string, string> = {
  physical: '🏃', creative: '🎨', social: '🤝', cognitive: '🧠', sensory: '✨',
};
const CATEGORY_COLORS: Record<string, string> = {
  physical: '#10b981', creative: '#8b5cf6', social: '#3b82f6', cognitive: '#f59e0b', sensory: '#ec4899',
};

export default function ActivitiesWidget() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: sessions = [] } = useSessions({ start_date: today, end_date: today });
  const { data: wellbeing } = useWellbeingDashboard() as { data: WellbeingStats | undefined };

  const todaySessions = (sessions as ActivitySession[]).filter(s => s.session_date === today);
  const completed = todaySessions.filter(s => s.status === 'completed').length;
  const upcoming = todaySessions.filter(s => s.status === 'scheduled').length;
  const totalParticipants = todaySessions.reduce((sum, s) => sum + (Number(s.participant_count) || 0), 0);

  return (
    <div style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 14, padding: 18, borderLeft: '5px solid #8b5cf6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>🎯 Activities Today</h3>
        <Link to="/activities" style={{ fontSize: '0.72rem', fontWeight: 600, color: '#8b5cf6', textDecoration: 'none' }}>View All →</Link>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: '#8b5cf610' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#8b5cf6' }}>{todaySessions.length}</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 }}>Scheduled</div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: '#10b98110' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#10b981' }}>{completed}</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 }}>Completed</div>
        </div>
        <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: '#3b82f610' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#3b82f6' }}>{totalParticipants}</div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 }}>Participants</div>
        </div>
      </div>

      {/* Today's session list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {todaySessions.slice(0, 5).map(s => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, background: 'var(--bg-secondary, #f8fafc)' }}>
            <span style={{ fontSize: '1rem' }}>{CATEGORY_ICONS[s.category || ''] || '📌'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.activity_name}</div>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{s.start_time?.slice(0, 5)} · {s.participant_count || 0} residents</div>
            </div>
            <span style={{ padding: '2px 6px', borderRadius: 10, fontSize: '0.6rem', fontWeight: 700, background: s.status === 'completed' ? '#10b98118' : s.status === 'scheduled' ? '#3b82f618' : '#f59e0b18', color: s.status === 'completed' ? '#10b981' : s.status === 'scheduled' ? '#3b82f6' : '#f59e0b', textTransform: 'capitalize' }}>
              {s.status}
            </span>
          </div>
        ))}
        {todaySessions.length === 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0', margin: 0 }}>No activities scheduled for today</p>
        )}
      </div>

      {/* Inactive residents alert */}
      {wellbeing && wellbeing.inactive_residents.length > 0 && (
        <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 8, background: '#f59e0b10', border: '1px solid #f59e0b30' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
            ⚠️ {wellbeing.inactive_residents.length} resident{wellbeing.inactive_residents.length > 1 ? 's' : ''} inactive 3+ days
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {wellbeing.inactive_residents.slice(0, 3).map(r => `${r.first_name} ${r.last_name}`).join(', ')}
            {wellbeing.inactive_residents.length > 3 && ` +${wellbeing.inactive_residents.length - 3} more`}
          </div>
        </div>
      )}
    </div>
  );
}
