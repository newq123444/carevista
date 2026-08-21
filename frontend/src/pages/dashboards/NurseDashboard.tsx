// src/pages/dashboards/NurseDashboard.tsx
import React from 'react';
import { useLang } from '../../i18n';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useDashboard, useEmar, useIncidents, useMonitoringAlerts, useCarePlanOverview } from '../../hooks';
import { formatDate, todayISO } from '../../utils/formatters';
import type { Incident } from '../../types';

export default function NurseDashboard() {
  const { t: tr } = useLang();
  const { user } = useAuthStore();
  const { data: dashData } = useDashboard();
  const { data: emarRaw } = useEmar(todayISO());
  const emarData: any[] = emarRaw?.medications ?? [];
  const emarSummary = emarRaw?.summary ?? { totalDoses: 0, given: 0, missed: 0, refused: 0, pending: 0 };
  const { data: incidents = [] } = useIncidents({ status: 'open' });
  const { data: monitoring } = useMonitoringAlerts();
  const { data: planOverview } = useCarePlanOverview();
  const chartAlerts: any[] = monitoring?.alerts || [];
  const planGaps = (planOverview?.residentsWithoutPlan || 0) + (planOverview?.overdueReviews || 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Count pending meds
  const pendingMeds = emarData.reduce((sum, entry) => {
    const meds = entry.medications || [];
    const admins = entry.administrations || [];
    return sum + meds.reduce((s: number, m: any) => {
      const pending = (m.times_of_day || []).filter((t: string) => {
        const adminForTime = admins.find((a: any) => a.medication_id === m.id && a.scheduled_time?.includes(t));
        return !adminForTime;
      });
      return s + pending.length;
    }, 0);
  }, 0);

  const openIncidents = (incidents as Incident[]).length;

  const CLINICAL_ACTIONS = [
    { label: 'Open eMAR',          icon: '💊', color: '#0d9488', path: '/emar',       desc: `${pendingMeds} pending doses` },
    { label: 'Nursing Notes',      icon: '🩺', color: '#0891b2', path: '/care-notes?note_type=nursing_observation', desc: 'Add observation' },
    { label: 'Active Incidents',   icon: '⚠️', color: '#dc2626', path: '/incidents',  desc: `${openIncidents} open` },
    { label: 'Medication Flags',   icon: '🔍', color: '#7c3aed', path: '/ai-tools',   desc: 'AI medication review' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}, {user?.firstName} 🩺</h1>
          <p className="page-subtitle">Registered Nurse · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      {/* Clinical priority cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {CLINICAL_ACTIONS.map(a => (
          <Link key={a.label} to={a.path} style={{ textDecoration: 'none' }}>
            <div style={{ padding: 20, borderRadius: 12, background: 'white', border: `2px solid ${a.color}25`, boxShadow: '0 2px 8px rgba(0,0,0,.06)', cursor: 'pointer', transition: 'transform 150ms' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{a.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: a.color, marginBottom: 4 }}>{a.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Charts falling short right now, and care plans that are missing or stale.
          Both are read from records staff already keep — nothing extra to enter. */}
      {(chartAlerts.length > 0 || planGaps > 0) && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid #f59e0b' }}>
          <div className="card-header">
            <span className="card-title">⚠️ Needs attention now</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {planGaps > 0 && (
              <Link to="/care-plans" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 18 }}>📖</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>
                      {planOverview?.residentsWithoutPlan ? `${planOverview.residentsWithoutPlan} resident(s) with no care plan` : ''}
                      {planOverview?.residentsWithoutPlan && planOverview?.overdueReviews ? ' · ' : ''}
                      {planOverview?.overdueReviews ? `${planOverview.overdueReviews} plan review(s) overdue` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Open care plans</div>
                  </div>
                </div>
              </Link>
            )}
            {chartAlerts.slice(0, 6).map((a: any, i: number) => (
              <Link key={i} to="/charts" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 18 }}>{a.type === 'fluid' ? '💧' : a.type === 'food' ? '🍽' : '🛏'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{a.residentName} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>· Room {a.roomNumber}</span></div>
                    <div style={{ fontSize: 13, color: a.severity === 'high' ? '#dc2626' : '#b45309' }}>{a.message}</div>
                  </div>
                </div>
              </Link>
            ))}
            {chartAlerts.length > 6 && (
              <div style={{ padding: '10px 18px', fontSize: 13 }}>
                <Link to="/charts">and {chartAlerts.length - 6} more…</Link>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Medication snapshot */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">💊 Today's eMAR Snapshot</span>
            <Link to="/emar" className="btn btn-primary btn-sm">{tr('Open eMAR')} →</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {emarData.slice(0, 6).map((entry: any) => {
              const res = entry.resident;
              const meds = entry.medications || [];
              const admins = entry.administrations || [];
              const pending = meds.reduce((s: number, m: any) => s + (m.times_of_day || []).filter((t: string) => !admins.find((a: any) => a.medication_id === m.id && a.scheduled_time?.includes(t))).length, 0);
              const given = admins.filter((a: any) => a.status === 'given').length;
              const missed = admins.filter((a: any) => a.status === 'missed').length;
              if (!res) return null;
              return (
                <div key={res.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#0d9488', flexShrink: 0 }}>{res.first_name?.[0]}{res.last_name?.[0]}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{res.first_name} {res.last_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Room {res.room_number}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {given > 0 && <span style={{ padding: '2px 7px', borderRadius: 10, background: '#f0fdf4', color: '#16a34a', fontSize: 11, fontWeight: 700 }}>✓ {given}</span>}
                    {missed > 0 && <span style={{ padding: '2px 7px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 700 }}>✗ {missed}</span>}
                    {pending > 0 && <span style={{ padding: '2px 7px', borderRadius: 10, background: '#fffbeb', color: '#d97706', fontSize: 11, fontWeight: 700 }}>⏳ {pending}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Open incidents */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">⚠️ Open Incidents</span>
            <Link to="/incidents" className="btn btn-ghost btn-sm">{tr('View All')} →</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {(incidents as Incident[]).length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>✅ No open incidents</div>
            ) : (
              (incidents as Incident[]).slice(0, 6).map((inc: Incident) => (
                <div key={inc.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{inc.resident_name}</span>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: inc.severity === 'high' || inc.severity === 'critical' ? '#fef2f2' : '#fffbeb', color: inc.severity === 'high' || inc.severity === 'critical' ? '#dc2626' : '#d97706', fontWeight: 700, textTransform: 'capitalize' }}>{inc.severity}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{inc.incident_type?.replace(/_/g, ' ') ?? ''} · {formatDate(inc.incident_date)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
