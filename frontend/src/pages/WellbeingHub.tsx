// src/pages/WellbeingHub.tsx — Wellbeing Hub: Quick-log, trends, isolation alerts, attention list
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { Link } from 'react-router-dom';
import { useResidents, useWellbeingOverview, useLogWellbeing, useSocialIsolationAlerts, useAcknowledgeAlert } from '../hooks';
import type { Resident, SocialIsolationAlert } from '../types';

const MOOD_OPTIONS = [
  { value: 'very_happy', emoji: '😄', label: 'Great', color: '#10b981' },
  { value: 'happy', emoji: '😊', label: 'Good', color: '#22c55e' },
  { value: 'neutral', emoji: '😐', label: 'Okay', color: '#f59e0b' },
  { value: 'low', emoji: '😔', label: 'Low', color: '#f97316' },
  { value: 'very_low', emoji: '😢', label: 'Very Low', color: '#dc2626' },
] as const;

const SLEEP_OPTIONS = [
  { value: 'excellent', label: 'Excellent', icon: '🌟' },
  { value: 'good', label: 'Good', icon: '😴' },
  { value: 'fair', label: 'Fair', icon: '😐' },
  { value: 'poor', label: 'Poor', icon: '😫' },
  { value: 'very_poor', label: 'Very Poor', icon: '🥱' },
] as const;

const APPETITE_OPTIONS = [
  { value: 'excellent', label: 'Excellent', icon: '🍽️' },
  { value: 'good', label: 'Good', icon: '👍' },
  { value: 'fair', label: 'Fair', icon: '🤏' },
  { value: 'poor', label: 'Poor', icon: '😕' },
  { value: 'refused', label: 'Refused', icon: '❌' },
] as const;

const ENGAGEMENT_OPTIONS = [
  { value: 'high', label: 'High', icon: '🤝' },
  { value: 'moderate', label: 'Moderate', icon: '👋' },
  { value: 'low', label: 'Low', icon: '🙁' },
  { value: 'isolated', label: 'Isolated', icon: '🚨' },
] as const;

const ENERGY_OPTIONS = [
  { value: 'high', label: 'High', icon: '⚡' },
  { value: 'moderate', label: 'Moderate', icon: '🔋' },
  { value: 'low', label: 'Low', icon: '🪫' },
  { value: 'very_low', label: 'Very Low', icon: '😩' },
] as const;

// Quick-log resident card
function QuickLogCard({ resident, onLogged }: { resident: Resident; onLogged: () => void }) {
  const { t: tr } = useLang();
  const [expanded, setExpanded] = useState(false);
  const [mood, setMood] = useState('');
  const [sleep, setSleep] = useState('');
  const [appetite, setAppetite] = useState('');
  const [engagement, setEngagement] = useState('');
  const [energy, setEnergy] = useState('');
  const [pain, setPain] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const logMutation = useLogWellbeing();

  const handleQuickMood = (moodVal: string) => {
    setMood(moodVal);
    setExpanded(true);
  };

  const handleSubmit = async () => {
    if (!mood) return;
    await logMutation.mutateAsync({
      residentId: resident.id,
      mood,
      sleepQuality: sleep || undefined,
      appetite: appetite || undefined,
      socialEngagement: engagement || undefined,
      energyLevel: energy || undefined,
      painLevel: pain,
      notes: notes || undefined,
    });
    setMood('');
    setSleep('');
    setAppetite('');
    setEngagement('');
    setEnergy('');
    setPain(null);
    setNotes('');
    setExpanded(false);
    onLogged();
  };

  return (
    <div style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, transition: 'all 200ms' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0d948820', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#0d9488', flexShrink: 0 }}>
          {resident.first_name[0]}{resident.last_name[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {resident.first_name} {resident.last_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Room {resident.room_number}</div>
        </div>
      </div>

      {/* Quick mood buttons - 2-3 taps interface */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
        {MOOD_OPTIONS.map(m => (
          <button
            key={m.value}
            onClick={() => handleQuickMood(m.value)}
            style={{
              width: 36, height: 36, borderRadius: '50%', border: mood === m.value ? `2px solid ${m.color}` : '2px solid transparent',
              background: mood === m.value ? m.color + '20' : 'var(--surface-2)',
              cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 100ms', transform: mood === m.value ? 'scale(1.15)' : 'scale(1)',
            }}
            title={m.label}
          >
            {m.emoji}
          </button>
        ))}
      </div>

      {/* Expanded form */}
      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          {/* Sleep */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>{tr('Sleep')}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {SLEEP_OPTIONS.map(s => (
                <button key={s.value} onClick={() => setSleep(s.value)} style={{ padding: '3px 8px', borderRadius: 12, border: sleep === s.value ? '1.5px solid #0d9488' : '1px solid var(--border)', background: sleep === s.value ? '#0d948810' : 'transparent', cursor: 'pointer', fontSize: 11, color: sleep === s.value ? '#0d9488' : 'var(--text-secondary)', fontWeight: sleep === s.value ? 600 : 400 }}>
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Appetite */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>{tr('Appetite')}</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {APPETITE_OPTIONS.map(a => (
                <button key={a.value} onClick={() => setAppetite(a.value)} style={{ padding: '3px 8px', borderRadius: 12, border: appetite === a.value ? '1.5px solid #10b981' : '1px solid var(--border)', background: appetite === a.value ? '#10b98110' : 'transparent', cursor: 'pointer', fontSize: 11, color: appetite === a.value ? '#10b981' : 'var(--text-secondary)', fontWeight: appetite === a.value ? 600 : 400 }}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Social Engagement */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Social Engagement</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ENGAGEMENT_OPTIONS.map(e => (
                <button key={e.value} onClick={() => setEngagement(e.value)} style={{ padding: '3px 8px', borderRadius: 12, border: engagement === e.value ? '1.5px solid #8b5cf6' : '1px solid var(--border)', background: engagement === e.value ? '#8b5cf610' : 'transparent', cursor: 'pointer', fontSize: 11, color: engagement === e.value ? '#8b5cf6' : 'var(--text-secondary)', fontWeight: engagement === e.value ? 600 : 400 }}>
                  {e.icon} {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Energy */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Energy Level</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ENERGY_OPTIONS.map(e => (
                <button key={e.value} onClick={() => setEnergy(e.value)} style={{ padding: '3px 8px', borderRadius: 12, border: energy === e.value ? '1.5px solid #f59e0b' : '1px solid var(--border)', background: energy === e.value ? '#f59e0b10' : 'transparent', cursor: 'pointer', fontSize: 11, color: energy === e.value ? '#f59e0b' : 'var(--text-secondary)', fontWeight: energy === e.value ? 600 : 400 }}>
                  {e.icon} {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pain */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Pain (0-10)</div>
            <div style={{ display: 'flex', gap: 3 }}>
              {[0,1,2,3,4,5,6,7,8,9,10].map(p => (
                <button key={p} onClick={() => setPain(p)} style={{ width: 24, height: 24, borderRadius: 6, border: pain === p ? '1.5px solid #dc2626' : '1px solid var(--border)', background: pain === p ? '#dc262615' : 'transparent', cursor: 'pointer', fontSize: 10, fontWeight: pain === p ? 700 : 400, color: pain === p ? '#dc2626' : 'var(--text-secondary)' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional notes..."
            style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, resize: 'vertical', minHeight: 40, background: 'var(--surface)', color: 'var(--text-primary)' }}
          />

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button onClick={handleSubmit} disabled={logMutation.isPending} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', background: '#10b981', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {logMutation.isPending ? 'Saving...' : '✅ Log Wellbeing'}
            </button>
            <button onClick={() => { setExpanded(false); setMood(''); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
              {tr('Cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Isolation Alert Card
function AlertCard({ alert, onAcknowledge }: { alert: SocialIsolationAlert; onAcknowledge: (id: string, status: string) => void }) {
  const severityColors: Record<string, { bg: string; border: string; text: string }> = {
    severe: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
    moderate: { bg: '#fffbeb', border: '#fcd34d', text: '#d97706' },
    mild: { bg: '#eff6ff', border: '#93c5fd', text: '#0d9488' },
  };
  const sc = severityColors[alert.severity] || severityColors.mild;
  const alertLabels: Record<string, string> = {
    no_visitors: 'No Visitors',
    no_activities: 'No Activities',
    no_social_notes: 'No Social Notes',
    low_engagement: 'Low Engagement',
  };

  return (
    <div style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: sc.text + '15', color: sc.text, textTransform: 'uppercase' }}>
            {alert.severity}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
            {alert.first_name} {alert.last_name}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Room {alert.room_number}</span>
        </div>
        <span style={{ fontSize: 11, color: sc.text, fontWeight: 600 }}>{alert.days_since_last} days</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
        {alertLabels[alert.alert_type] || alert.alert_type} - Last engagement {alert.days_since_last} days ago
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onAcknowledge(alert.id, 'acknowledged')} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
          👁 Acknowledge
        </button>
        <button onClick={() => onAcknowledge(alert.id, 'resolved')} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#10b981', color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
          ✅ Resolve
        </button>
        <Link to={`/residents/${alert.resident_id}`} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#0d9488', textDecoration: 'none' }}>
          View Resident
        </Link>
      </div>
    </div>
  );
}

export default function WellbeingHub() {
  const { data: rawResidents } = useResidents();
  const { data: overview } = useWellbeingOverview();
  const { data: rawAlerts } = useSocialIsolationAlerts('active');
  const acknowledgeMut = useAcknowledgeAlert();
  const [search, setSearch] = useState('');

  const residents: Resident[] = Array.isArray(rawResidents) ? rawResidents : [];
  const alerts: SocialIsolationAlert[] = Array.isArray(rawAlerts) ? rawAlerts : [];

  const activeResidents = residents.filter(r => r.status === 'active');
  const filtered = search
    ? activeResidents.filter(r => `${r.first_name} ${r.last_name} ${r.room_number}`.toLowerCase().includes(search.toLowerCase()))
    : activeResidents;

  const stats = overview?.stats;
  const needsAttention = overview?.needsAttention || [];

  const handleAcknowledge = (id: string, status: string) => {
    acknowledgeMut.mutate({ id, data: { status } });
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          💚 Wellbeing Hub
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 0' }}>
          Track mood, pain, sleep, and social engagement for every resident
        </p>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#10b98112', border: '1px solid #10b98130' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>{stats.happy_count || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Happy Today</div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#f59e0b12', border: '1px solid #f59e0b30' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>{stats.neutral_count || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Neutral</div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#dc262612', border: '1px solid #dc262630' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#dc2626' }}>{stats.low_count || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Low Mood</div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#8b5cf612', border: '1px solid #8b5cf630' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#8b5cf6' }}>{stats.logged_residents || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Logged Today</div>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#06b6d412', border: '1px solid #06b6d430' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#06b6d4' }}>{stats.avg_pain ? parseFloat(stats.avg_pain).toFixed(1) : '-'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Avg Pain</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Left: Quick Log Grid */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Quick Log</h2>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search resident..."
              style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, flex: 1, maxWidth: 250, background: 'var(--surface)', color: 'var(--text-primary)' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {filtered.map(r => (
              <QuickLogCard key={r.id} resident={r} onLogged={() => {}} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No residents found</div>
          )}
        </div>

        {/* Right: Alerts & Attention */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Isolation Alerts */}
          <div style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              🚨 Social Isolation Alerts
              {alerts.length > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#dc262615', color: '#dc2626', fontWeight: 700 }}>{alerts.length}</span>}
            </h3>
            {alerts.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, textAlign: 'center', padding: 16 }}>No active alerts - everyone is engaged!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alerts.slice(0, 5).map(a => (
                  <AlertCard key={a.id} alert={a} onAcknowledge={handleAcknowledge} />
                ))}
                {alerts.length > 5 && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>+{alerts.length - 5} more alerts</p>
                )}
              </div>
            )}
          </div>

          {/* Needs Attention */}
          <div style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>⚠️ Needs Attention</h3>
            {needsAttention.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, textAlign: 'center', padding: 16 }}>All residents doing well today</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {needsAttention.slice(0, 8).map((r: any) => {
                  const moodEmoji: Record<string, string> = { very_low: '😢', low: '😔', neutral: '😐', happy: '😊', very_happy: '😄' };
                  return (
                    <Link key={r.id} to={`/residents/${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', textDecoration: 'none', color: 'inherit' }}>
                      <span style={{ fontSize: 16 }}>{moodEmoji[r.mood] || '😐'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{r.first_name} {r.last_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Room {r.room_number}</div>
                      </div>
                      {r.pain_level != null && r.pain_level >= 7 && (
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 8, background: '#dc262615', color: '#dc2626', fontWeight: 700 }}>Pain: {r.pain_level}/10</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
