// src/pages/dashboards/MaintenanceDashboard.tsx — real data, world-class UI
import React from 'react';
import { useLang } from '../../i18n';
import { useAuthStore } from '../../store/auth.store';
import { useResidents, useRoomTurnoverDashboard } from '../../hooks';
import { MetricCard, SectionCard, ProgressStat, PageHeading } from '../../components/ui';

const STATUS_COLOR: Record<string, string> = {
  vacated: 'var(--text-muted)', pending: 'var(--text-muted)', in_progress: 'var(--warning)',
  cleaning: 'var(--primary)', maintenance: 'var(--accent)', inspection: 'var(--info)', ready: 'var(--success)',
};

export default function MaintenanceDashboard() {
  const { t: tr } = useLang();
  const { user } = useAuthStore();
  const { data: residents = [] } = useResidents({ active: true });
  const { data: turnover, isLoading } = useRoomTurnoverDashboard();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const active: any[] = turnover?.activeTurnovers || [];
  const overdue = turnover?.overdue ?? 0;
  const statusMap: Record<string, number> = {};
  (turnover?.statusCounts || []).forEach((r: any) => { statusMap[r.status] = Number(r.count); });
  const residentCount = Array.isArray(residents) ? residents.length : 0;

  return (
    <div>
      <PageHeading
        greeting={`${greeting}, ${user?.firstName || ''}`} emoji="🔧"
        subtitle={`Facilities & Maintenance · ${today}`}
        action={<a href="/room-turnover" style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>Manage turnovers →</a>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <MetricCard icon="🛏️" label="Active turnovers" value={active.length} sub="in progress" subTone="warning" />
        <MetricCard icon="🚨" label={tr('Overdue')} value={overdue} sub="past target date" subTone="danger" />
        <MetricCard icon="🔨" label={tr('In progress')} value={statusMap['in_progress'] ?? 0} sub="being worked on" subTone="accent" />
        <MetricCard icon="✅" label="Ready" value={statusMap['ready'] ?? 0} sub="ready to occupy" subTone="success" />
        <MetricCard icon="👥" label="Occupied rooms" value={residentCount} sub="current residents" />
      </div>

      <SectionCard title="Room turnover pipeline">
        {isLoading && <div style={{ color: 'var(--text-muted)' }}>Loading…</div>}
        {!isLoading && active.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No active room turnovers. Create one in Room Turnover, or run the operational seed (npm run seed:ops).</div>
        )}
        {active.map((r: any) => {
          const total = Number(r.total_items || 0), done = Number(r.completed_items || 0);
          const pct = total ? Math.round((done / total) * 100) : 0;
          const color = STATUS_COLOR[r.status] || 'var(--text-muted)';
          return (
            <ProgressStat key={r.id} icon="🛏️"
              label={`Room ${r.room_number} · ${String(r.status || '').replace(/_/g, ' ')}`}
              value={`${done}/${total} tasks`} pct={pct} color={color} />
          );
        })}
      </SectionCard>
    </div>
  );
}
