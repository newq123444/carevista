// src/pages/Activities.tsx - Activity Scheduling with Mobility-Based Filtering
import React, { useState, useMemo } from 'react';
import { useActivities, useSessions, useCreateActivity, useCreateSession, useSessionParticipants, useAddParticipant, useUpdateParticipant, useEligibleResidents, useWellbeingDashboard, useResidents } from '../hooks';
import type { Activity, ActivitySession, ActivityParticipant, WellbeingStats } from '../types';

const CATEGORIES = ['physical', 'creative', 'social', 'cognitive', 'sensory'];
const MOBILITY_LABELS: Record<string, string> = {
  any: 'All Residents',
  walking_aid_or_better: 'Walking Aid+',
  wheelchair_or_better: 'Wheelchair+',
  independent_only: 'Independent Only',
};
const MOBILITY_COLORS: Record<string, string> = {
  any: '#10b981',
  walking_aid_or_better: '#3b82f6',
  wheelchair_or_better: '#f59e0b',
  independent_only: '#ef4444',
};
const CATEGORY_ICONS: Record<string, string> = {
  physical: '🏃',
  creative: '🎨',
  social: '🤝',
  cognitive: '🧠',
  sensory: '✨',
};
const CATEGORY_COLORS: Record<string, string> = {
  physical: '#10b981',
  creative: '#8b5cf6',
  social: '#3b82f6',
  cognitive: '#f59e0b',
  sensory: '#ec4899',
};

function getWeekDates(offset: number = 0): { dates: Date[]; label: string } {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  const label = `${dates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${dates[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  return { dates, label };
}

function toDateStr(d: Date): string { return d.toISOString().slice(0, 10); }
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Activities() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedSession, setSelectedSession] = useState<ActivitySession | null>(null);
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'library' | 'wellbeing'>('calendar');
  const [selectedActivityForSession, setSelectedActivityForSession] = useState('');

  const { dates, label: weekLabel } = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const startDate = toDateStr(dates[0]);
  const endDate = toDateStr(dates[6]);

  const { data: activities = [] } = useActivities();
  const { data: sessions = [] } = useSessions({ start_date: startDate, end_date: endDate });
  const { data: wellbeing } = useWellbeingDashboard() as { data: WellbeingStats | undefined };

  // Group sessions by date (normalize ISO timestamps to plain date strings)
  const sessionsByDate = useMemo(() => {
    const map: Record<string, ActivitySession[]> = {};
    (sessions as ActivitySession[]).forEach(s => {
      const key = s.session_date ? s.session_date.slice(0, 10) : '';
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [sessions]);

  const today = toDateStr(new Date());

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>🎯 Activities & Wellbeing</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Intelligent activity scheduling with mobility-based safety filtering</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowCreateActivity(true)} style={{ padding: '8px 16px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>+ New Activity</button>
          <button onClick={() => setShowCreateSession(true)} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>+ Schedule Session</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-secondary, #f1f5f9)', padding: 4, borderRadius: 10, width: 'fit-content' }}>
        {(['calendar', 'library', 'wellbeing'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: activeTab === tab ? 'white' : 'transparent', color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: activeTab === tab ? 700 : 500, fontSize: '0.82rem', cursor: 'pointer', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
            {tab === 'calendar' && '📅 Weekly Calendar'}
            {tab === 'library' && '📚 Activity Library'}
            {tab === 'wellbeing' && '💚 Wellbeing Impact'}
          </button>
        ))}
      </div>

      {/* Calendar View */}
      {activeTab === 'calendar' && (
        <CalendarView
          dates={dates}
          weekLabel={weekLabel}
          weekOffset={weekOffset}
          setWeekOffset={setWeekOffset}
          sessionsByDate={sessionsByDate}
          today={today}
          onSelectSession={setSelectedSession}
        />
      )}

      {/* Activity Library */}
      {activeTab === 'library' && (
        <ActivityLibrary activities={activities as Activity[]} />
      )}

      {/* Wellbeing Impact */}
      {activeTab === 'wellbeing' && wellbeing && (
        <WellbeingDashboard data={wellbeing} />
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <SessionDetailModal session={selectedSession} onClose={() => setSelectedSession(null)} />
      )}

      {/* Create Activity Modal */}
      {showCreateActivity && (
        <CreateActivityModal onClose={() => setShowCreateActivity(false)} />
      )}

      {/* Create Session Modal */}
      {showCreateSession && (
        <CreateSessionModal activities={activities as Activity[]} selectedActivityId={selectedActivityForSession} onClose={() => { setShowCreateSession(false); setSelectedActivityForSession(''); }} />
      )}
    </div>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────
function CalendarView({ dates, weekLabel, weekOffset, setWeekOffset, sessionsByDate, today, onSelectSession }: {
  dates: Date[];
  weekLabel: string;
  weekOffset: number;
  setWeekOffset: (v: number) => void;
  sessionsByDate: Record<string, ActivitySession[]>;
  today: string;
  onSelectSession: (s: ActivitySession) => void;
}) {
  return (
    <div>
      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => setWeekOffset(weekOffset - 1)} style={{ padding: '6px 12px', background: 'var(--bg-secondary, #f1f5f9)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>← Prev</button>
        <button onClick={() => setWeekOffset(0)} style={{ padding: '6px 12px', background: weekOffset === 0 ? '#3b82f6' : 'var(--bg-secondary, #f1f5f9)', color: weekOffset === 0 ? 'white' : 'inherit', border: '1px solid var(--border, #e2e8f0)', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>This Week</button>
        <button onClick={() => setWeekOffset(weekOffset + 1)} style={{ padding: '6px 12px', background: 'var(--bg-secondary, #f1f5f9)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem' }}>Next →</button>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{weekLabel}</span>
      </div>

      {/* Calendar grid */}
      <div className="no-mobile-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, minHeight: 400 }}>
        {dates.map((date, i) => {
          const dateStr = toDateStr(date);
          const daySessions = sessionsByDate[dateStr] || [];
          const isToday = dateStr === today;
          return (
            <div key={dateStr} style={{ background: 'var(--bg-card, white)', border: `1px solid ${isToday ? '#3b82f6' : 'var(--border, #e2e8f0)'}`, borderRadius: 10, padding: 10, minHeight: 180, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{DAY_NAMES[i]}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: isToday ? 800 : 600, color: isToday ? '#3b82f6' : 'var(--text-primary)', background: isToday ? '#3b82f620' : 'none', padding: isToday ? '2px 6px' : 0, borderRadius: 4 }}>{date.getDate()}</span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {daySessions.map(session => (
                  <button key={session.id} onClick={() => onSelectSession(session)} style={{ padding: '5px 6px', borderRadius: 6, border: 'none', background: (CATEGORY_COLORS[session.category || ''] || '#64748b') + '18', cursor: 'pointer', textAlign: 'left', transition: 'background 100ms' }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: CATEGORY_COLORS[session.category || ''] || '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {CATEGORY_ICONS[session.category || ''] || '📌'} {session.activity_name}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {session.start_time?.slice(0, 5)} · {session.participant_count || 0} joined
                    </div>
                  </button>
                ))}
                {daySessions.length === 0 && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>No activities</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Activity Library ──────────────────────────────────────────────────────
function ActivityLibrary({ activities }: { activities: Activity[] }) {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? activities : activities.filter(a => a.category === filter);

  return (
    <div>
      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setFilter('all')} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filter === 'all' ? '#3b82f6' : 'var(--border, #e2e8f0)'}`, background: filter === 'all' ? '#3b82f610' : 'transparent', color: filter === 'all' ? '#3b82f6' : 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>All</button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${filter === cat ? CATEGORY_COLORS[cat] : 'var(--border, #e2e8f0)'}`, background: filter === cat ? CATEGORY_COLORS[cat] + '15' : 'transparent', color: filter === cat ? CATEGORY_COLORS[cat] : 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
            {CATEGORY_ICONS[cat]} {cat}
          </button>
        ))}
      </div>

      {/* Activity cards */}
      <div className="no-mobile-collapse" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {filtered.map(activity => (
          <div key={activity.id} style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 16, borderLeft: `4px solid ${CATEGORY_COLORS[activity.category] || '#64748b'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {CATEGORY_ICONS[activity.category] || '📌'} {activity.name}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{activity.description}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 700, background: (MOBILITY_COLORS[activity.required_mobility_level] || '#64748b') + '20', color: MOBILITY_COLORS[activity.required_mobility_level] || '#64748b' }}>
                {MOBILITY_LABELS[activity.required_mobility_level] || activity.required_mobility_level}
              </span>
              <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 600, background: 'var(--bg-secondary, #f1f5f9)', color: 'var(--text-muted)' }}>
                {activity.duration_minutes} min
              </span>
              <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 600, background: 'var(--bg-secondary, #f1f5f9)', color: 'var(--text-muted)' }}>
                Max {activity.max_participants}
              </span>
              {activity.sensory_friendly && (
                <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 600, background: '#ec489920', color: '#ec4899' }}>
                  Sensory Friendly
                </span>
              )}
              {activity.location && (
                <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 600, background: 'var(--bg-secondary, #f1f5f9)', color: 'var(--text-muted)' }}>
                  📍 {activity.location}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Wellbeing Dashboard ───────────────────────────────────────────────────
function WellbeingDashboard({ data }: { data: WellbeingStats }) {
  const { stats, popular_activities, inactive_residents, week_stats } = data;

  return (
    <div>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <KpiCard icon="👥" value={stats.unique_participants} label="Active Participants" sublabel="Last 30 days" color="#3b82f6" />
        <KpiCard icon="✅" value={`${stats.attendance_rate || 0}%`} label="Attendance Rate" sublabel="Registered vs attended" color="#10b981" />
        <KpiCard icon="⭐" value={stats.high_engagement} label="High Engagement" sublabel="Fully engaged sessions" color="#f59e0b" />
        <KpiCard icon="📅" value={week_stats.sessions_this_week} label="Sessions This Week" sublabel={`${week_stats.completed} done, ${week_stats.upcoming} upcoming`} color="#8b5cf6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Popular Activities */}
        <div style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.92rem', fontWeight: 700 }}>🏆 Most Popular Activities</h3>
          {popular_activities.map((a, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < popular_activities.length - 1 ? '1px solid var(--border, #f1f5f9)' : 'none' }}>
              <span style={{ fontSize: '1.1rem' }}>{CATEGORY_ICONS[a.category] || '📌'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{a.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{a.category}</div>
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: CATEGORY_COLORS[a.category] || '#64748b' }}>{a.participant_count}</span>
            </div>
          ))}
          {popular_activities.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No activity data yet</p>}
        </div>

        {/* Inactive Residents Alert */}
        <div style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.92rem', fontWeight: 700 }}>⚠️ Needs Engagement (3+ days inactive)</h3>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {inactive_residents.slice(0, 10).map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f59e0b20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b' }}>
                  {r.first_name[0]}{r.last_name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{r.first_name} {r.last_name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Room {r.room_number} · {r.mobility_status?.replace('_', ' ')}</div>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#dc2626', fontWeight: 600 }}>
                  {r.last_activity_date ? `Last: ${new Date(r.last_activity_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Never'}
                </div>
              </div>
            ))}
            {inactive_residents.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>All residents are engaged - great job!</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, value, label, sublabel, color }: { icon: string; value: string | number; label: string; sublabel: string; color: string }) {
  return (
    <div style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 16, borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color, lineHeight: 1 }}>{value || 0}</div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>{label}</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2 }}>{sublabel}</div>
        </div>
        <span style={{ fontSize: '1.4rem' }}>{icon}</span>
      </div>
    </div>
  );
}

// ── Session Detail Modal ──────────────────────────────────────────────────
function SessionDetailModal({ session, onClose }: { session: ActivitySession; onClose: () => void }) {
  const { data: participants = [] } = useSessionParticipants(session.id);
  const { data: eligibleResidents = [] } = useEligibleResidents(session.activity_id);
  const addParticipant = useAddParticipant();
  const updateParticipant = useUpdateParticipant();
  const [showAddResident, setShowAddResident] = useState(false);

  const participantIds = new Set((participants as ActivityParticipant[]).map(p => p.resident_id));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card, white)', borderRadius: 16, width: '100%', maxWidth: 700, maxHeight: '85vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
              {CATEGORY_ICONS[session.category || ''] || '📌'} {session.activity_name}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {new Date(session.session_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {session.start_time?.slice(0, 5)} - {session.end_time?.slice(0, 5)}
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 700, background: (MOBILITY_COLORS[session.required_mobility_level || 'any'] || '#64748b') + '20', color: MOBILITY_COLORS[session.required_mobility_level || 'any'] || '#64748b' }}>
                {MOBILITY_LABELS[session.required_mobility_level || 'any']}
              </span>
              <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 600, background: session.status === 'completed' ? '#10b98120' : '#3b82f620', color: session.status === 'completed' ? '#10b981' : '#3b82f6', textTransform: 'capitalize' }}>
                {session.status}
              </span>
              {session.location && <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 600, background: 'var(--bg-secondary, #f1f5f9)', color: 'var(--text-muted)' }}>📍 {session.location}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Participants */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>Participants ({(participants as ActivityParticipant[]).length})</h3>
            {session.status !== 'completed' && (
              <button onClick={() => setShowAddResident(!showAddResident)} style={{ padding: '5px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                + Add Resident
              </button>
            )}
          </div>

          {/* Add resident panel */}
          {showAddResident && (
            <div style={{ background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <p style={{ margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Showing eligible residents (mobility: {MOBILITY_LABELS[session.required_mobility_level || 'any']})
              </p>
              <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(eligibleResidents as any[]).filter(r => !participantIds.has(r.id)).map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-card, white)' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#3b82f620', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 700, color: '#3b82f6' }}>{r.first_name[0]}{r.last_name[0]}</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{r.first_name} {r.last_name}</span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 6 }}>Rm {r.room_number} · {r.mobility_status?.replace('_', ' ')}</span>
                    </div>
                    <button onClick={() => addParticipant.mutate({ sessionId: session.id, data: { resident_id: r.id } })} style={{ padding: '4px 10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 5, fontSize: '0.7rem', fontWeight: 600, cursor: 'pointer' }}>Add</button>
                  </div>
                ))}
                {(eligibleResidents as any[]).filter(r => !participantIds.has(r.id)).length === 0 && (
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>All eligible residents are already added</p>
                )}
              </div>
            </div>
          )}

          {/* Participant list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(participants as ActivityParticipant[]).map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border, #e2e8f0)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#8b5cf620', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#8b5cf6' }}>
                  {p.first_name?.[0]}{p.last_name?.[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.first_name} {p.last_name}</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Rm {p.room_number} · {p.mobility_status?.replace('_', ' ')}</div>
                </div>
                {session.status === 'completed' && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {p.attendance && <span style={{ padding: '2px 6px', borderRadius: 10, fontSize: '0.62rem', fontWeight: 700, background: p.attendance === 'attended' ? '#10b98120' : '#dc262620', color: p.attendance === 'attended' ? '#10b981' : '#dc2626', textTransform: 'capitalize' }}>{p.attendance}</span>}
                    {p.engagement_level && <span style={{ padding: '2px 6px', borderRadius: 10, fontSize: '0.62rem', fontWeight: 700, background: p.engagement_level === 'high' ? '#f59e0b20' : '#64748b20', color: p.engagement_level === 'high' ? '#f59e0b' : '#64748b', textTransform: 'capitalize' }}>{p.engagement_level}</span>}
                  </div>
                )}
                {session.status !== 'completed' && (
                  <select value={p.attendance} onChange={e => updateParticipant.mutate({ sessionId: session.id, residentId: p.resident_id, data: { attendance: e.target.value } })} style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border, #e2e8f0)', fontSize: '0.72rem', background: 'var(--bg-card, white)' }}>
                    <option value="registered">Registered</option>
                    <option value="attended">Attended</option>
                    <option value="declined">Declined</option>
                    <option value="unable">Unable</option>
                  </select>
                )}
              </div>
            ))}
            {(participants as ActivityParticipant[]).length === 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: 16 }}>No participants yet. Click "Add Resident" to get started.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create Activity Modal ─────────────────────────────────────────────────
function CreateActivityModal({ onClose }: { onClose: () => void }) {
  const createActivity = useCreateActivity();
  const [form, setForm] = useState({
    name: '', description: '', category: 'social', activity_type: 'social',
    required_mobility_level: 'any', duration_minutes: 60, max_participants: 12,
    location: '', sensory_friendly: false, cognitive_level: 'any',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createActivity.mutate(form, { onSuccess: onClose });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card, white)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '85vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Create New Activity</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Activity Name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', fontSize: '0.85rem', boxSizing: 'border-box' }} placeholder="e.g. Morning Chair Yoga" />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }} placeholder="Describe the activity..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value, activity_type: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', fontSize: '0.85rem' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Mobility Requirement</label>
              <select value={form.required_mobility_level} onChange={e => setForm({ ...form, required_mobility_level: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', fontSize: '0.85rem' }}>
                <option value="any">Any (All Welcome)</option>
                <option value="wheelchair_or_better">Wheelchair or Better</option>
                <option value="walking_aid_or_better">Walking Aid or Better</option>
                <option value="independent_only">Independent Only</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Duration (min)</label>
              <input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: +e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Max Participants</label>
              <input type="number" value={form.max_participants} onChange={e => setForm({ ...form, max_participants: +e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Location</label>
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', fontSize: '0.85rem', boxSizing: 'border-box' }} placeholder="e.g. Main Lounge" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.sensory_friendly} onChange={e => setForm({ ...form, sensory_friendly: e.target.checked })} />
              Sensory Friendly
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: 'var(--bg-secondary, #f1f5f9)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={!form.name || createActivity.isPending} style={{ flex: 1, padding: '10px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', opacity: !form.name ? 0.5 : 1 }}>
              {createActivity.isPending ? 'Creating...' : 'Create Activity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Create Session Modal ──────────────────────────────────────────────────
function CreateSessionModal({ activities, selectedActivityId, onClose }: { activities: Activity[]; selectedActivityId: string; onClose: () => void }) {
  const createSession = useCreateSession();
  const [form, setForm] = useState({
    activity_id: selectedActivityId || '',
    session_date: new Date().toISOString().slice(0, 10),
    start_time: '10:00',
    end_time: '11:00',
  });

  const selectedActivity = activities.find(a => a.id === form.activity_id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSession.mutate(form, { onSuccess: onClose });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-card, white)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '85vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Schedule Session</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Activity *</label>
            <select value={form.activity_id} onChange={e => setForm({ ...form, activity_id: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', fontSize: '0.85rem' }}>
              <option value="">Select an activity...</option>
              {activities.map(a => <option key={a.id} value={a.id}>{CATEGORY_ICONS[a.category]} {a.name} ({MOBILITY_LABELS[a.required_mobility_level]})</option>)}
            </select>
          </div>
          {selectedActivity && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: (CATEGORY_COLORS[selectedActivity.category] || '#64748b') + '10', border: `1px solid ${(CATEGORY_COLORS[selectedActivity.category] || '#64748b')}30`, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <strong>Mobility:</strong> {MOBILITY_LABELS[selectedActivity.required_mobility_level]} · <strong>Duration:</strong> {selectedActivity.duration_minutes}min · <strong>Max:</strong> {selectedActivity.max_participants}
            </div>
          )}
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Date *</label>
            <input type="date" value={form.session_date} onChange={e => setForm({ ...form, session_date: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Start Time *</label>
              <input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>End Time *</label>
              <input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', fontSize: '0.85rem', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: 'var(--bg-secondary, #f1f5f9)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={!form.activity_id || createSession.isPending} style={{ flex: 1, padding: '10px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', opacity: !form.activity_id ? 0.5 : 1 }}>
              {createSession.isPending ? 'Scheduling...' : 'Schedule Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
