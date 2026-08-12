// src/pages/dashboards/CleaningDashboard.tsx — real data, world-class UI
import React from 'react';
import { useLang } from '../../i18n';
import { useAuthStore } from '../../store/auth.store';
import { useHousekeepingSummary } from '../../hooks';
import { MetricCard, SectionCard, ListRow, PageHeading } from '../../components/ui';

const STATUS: Record<string, { label: string; tone: string; emoji: string }> = {
  'clean':           { label: 'Clean', tone: 'success', emoji: '✅' },
  'needs-attention': { label: 'Needs attention', tone: 'warning', emoji: '🕓' },
  'overdue':         { label: 'Overdue', tone: 'danger', emoji: '🚨' },
};

export default function CleaningDashboard() {
  const { t: tr } = useLang();
  const { user } = useAuthStore();
  const { data: hk, isLoading } = useHousekeepingSummary();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const rooms: any[] = hk?.rooms || [];
  const cleaned = rooms.filter(r => r.status === 'clean').length;
  const attention = rooms.filter(r => r.status === 'needs-attention').length;
  const overdue = rooms.filter(r => r.status === 'overdue').length;

  return (
    <div>
      <PageHeading
        greeting={`${greeting}, ${user?.firstName || ''}`} emoji="🧹"
        subtitle={`Cleaning & Housekeeping · ${today}`}
        action={<a href="/housekeeping" style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>Open checklists →</a>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <MetricCard icon="✅" label="Rooms clean" value={`${cleaned}/${rooms.length || 0}`} sub="today" subTone="success" />
        <MetricCard icon="🕓" label="Needs attention" value={attention} sub="within the day" subTone="warning" />
        <MetricCard icon="🚨" label={tr('Overdue')} value={overdue} sub="priority" subTone="danger" />
        <MetricCard icon="🧾" label="Tasks logged" value={hk?.tasks_today ?? 0} sub="today" />
        <MetricCard icon="🏛️" label={tr('Communal areas')} value={hk?.communal_areas_today ?? 0} sub="serviced today" />
      </div>

      <SectionCard title="Room cleaning status">
        {isLoading && <div style={{ color: 'var(--text-muted)' }}>Loading…</div>}
        {!isLoading && rooms.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No rooms yet. Log cleaning from the checklists, or run the operational seed (npm run seed:ops).</div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
          {rooms.map((r) => {
            const st = STATUS[r.status] || STATUS['overdue'];
            const tone = { success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)' }[st.tone] || 'var(--text-muted)';
            const bg = { success: 'var(--success-light)', warning: 'var(--warning-light)', danger: 'var(--danger-light)' }[st.tone] || 'var(--surface-2)';
            return (
              <div key={r.room_number} style={{ padding: '12px 14px', borderRadius: 10, background: bg, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>Room {r.room_number}</strong>
                  <span style={{ fontSize: 11, fontWeight: 600, color: tone }}>{st.emoji} {st.label}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{r.resident_name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {r.last_cleaned ? `Last cleaned ${new Date(r.last_cleaned).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Not yet logged'}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Recent activity">
        {(!hk?.recent || hk.recent.length === 0) && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No housekeeping logged yet.</div>}
        {hk?.recent?.map((r: any, i: number) => (
          <ListRow key={i} icon="✅" tone="success"
            title={`${r.room_number ? `Room ${r.room_number}` : r.communal_area} — ${r.specification}`}
            meta={`${r.initials || r.completed_by_name} · ${new Date(r.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`} />
        ))}
      </SectionCard>
    </div>
  );
}
