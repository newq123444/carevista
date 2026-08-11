// src/pages/dashboards/ManagerDashboard.tsx — Animated KPI dashboard
import React, { useEffect, useRef, useState } from 'react';
import { useLang } from '../../i18n';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useDashboard, useIncidents, useComplianceActions, useInvoices, useResidents, useStaff, useTraining, useHousekeepingSummary, useMenuKitchenDashboard, useRoomTurnoverDashboard } from '../../hooks';
import { formatDate, formatPence } from '../../utils/formatters';
import type { Incident, ComplianceAction, Invoice, Resident } from '../../types';
import WeatherWidget from '../../components/WeatherWidget';
import LiveActivityFeed from '../../components/LiveActivityFeed';
import ActivitiesWidget from '../../components/ActivitiesWidget';

// Animated counter hook
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) { setVal(0); return; }
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const t = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(start);
      if (start >= target) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [target, duration]);
  return val;
}

function KpiCard({ label, value, sub, icon, color, link, trend }: any) {
  const animated = useCountUp(typeof value === 'number' ? value : 0);
  const display  = typeof value === 'number' ? animated : value;
  return (
    <Link to={link} style={{ textDecoration: 'none' }}>
      <div style={{ padding: '18px 16px', borderRadius: 14, background: 'white', border: `1px solid ${color}30`, borderLeft: `5px solid ${color}`, boxShadow: `0 2px 12px ${color}15`, cursor: 'pointer', transition: 'transform 150ms, box-shadow 150ms', height: '100%' }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 6px 20px ${color}25`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 12px ${color}15`; }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 32, fontWeight: 900, color, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {display === '—' || value === undefined ? '—' : display}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 7 }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>
          </div>
          <span style={{ fontSize: 26, opacity: 0.85 }}>{icon}</span>
        </div>
        {trend !== undefined && (
          <div style={{ marginTop: 10, fontSize: 11, color: trend >= 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
            {trend >= 0 ? `↑ ${trend}` : `↓ ${Math.abs(trend)}`} vs last week
          </div>
        )}
      </div>
    </Link>
  );
}

export default function ManagerDashboard() {
  const { t } = useLang();
  const { user }     = useAuthStore();
  const { data: dash, isLoading } = useDashboard();
  const { data: rawIncidents = [] }   = useIncidents({ status: 'open', limit: 10 });
  const { data: rawActions = [] }     = useComplianceActions();
  const { data: rawInvoices = [] }    = useInvoices({ status: 'overdue', limit: 20 });
  const { data: rawResidents = [] }   = useResidents({ active: true });
  const { data: rawStaff = [] }       = useStaff();
  const { data: hkSummary }           = useHousekeepingSummary();
  const { data: kitchenOrders }       = useMenuKitchenDashboard();
  const { data: turnoverData }        = useRoomTurnoverDashboard();
  const { data: rawTraining = [] }    = useTraining();

  const incidents: Incident[]         = Array.isArray(rawIncidents)  ? rawIncidents  : (rawIncidents as any)?.incidents ?? [];
  const compActions: ComplianceAction[] = Array.isArray(rawActions)  ? rawActions    : [];
  const invoices: Invoice[]           = Array.isArray(rawInvoices)   ? rawInvoices   : (rawInvoices as any)?.invoices ?? [];
  const residents: Resident[]         = Array.isArray(rawResidents)  ? rawResidents  : (rawResidents as any)?.residents ?? [];
  const staff: any[]                  = Array.isArray(rawStaff)      ? rawStaff      : [];
  const training: any[]               = Array.isArray(rawTraining)   ? rawTraining   : [];

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const overdueActions  = compActions.filter(a => a.status !== 'closed' && a.due_date && new Date(a.due_date) < new Date());
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const overdueTotal    = overdueInvoices.reduce((s, i) => s + (i.total_pence || 0), 0);
  const occupancyRate   = dash?.residents?.total ? Math.round((dash.residents.active / dash.residents.total) * 100) : null;
  const dbsExpiring     = staff.filter(s => s.dbs_expires && new Date(s.dbs_expires) < new Date(Date.now() + 30 * 86400000)).length;
  const trainingExpiring = training.filter(t => t.status === 'expiring' || t.status === 'expired').length;

  const KPI_CARDS = [
    { label: 'Active Residents',   value: dash?.residents?.active ?? 0, sub: occupancyRate ? `${occupancyRate}% occupancy` : 'Loading…', icon: '👥', color: '#0d9488', link: '/residents' },
    { label: 'Open Incidents',     value: incidents.length,              sub: `${incidents.filter(i => i.severity === 'high' || i.severity === 'critical').length} high/critical`, icon: '⚠️', color: incidents.length > 0 ? '#dc2626' : '#16a34a', link: '/incidents' },
    { label: 'Missed Meds Today',  value: dash?.missedMedsToday ?? 0,   sub: 'Requires follow-up', icon: '💊', color: (dash?.missedMedsToday ?? 0) > 0 ? '#dc2626' : '#16a34a', link: '/emar' },
    { label: 'Overdue Invoices',   value: overdueInvoices.length,        sub: formatPence(overdueTotal) + ' outstanding', icon: '💷', color: overdueInvoices.length > 0 ? '#dc2626' : '#16a34a', link: '/billing' },
    { label: 'Compliance Actions', value: overdueActions.length,         sub: `${compActions.filter(a => a.status !== 'closed').length} total open`, icon: '✅', color: overdueActions.length > 0 ? '#d97706' : '#16a34a', link: '/compliance' },
    { label: 'Training Issues',    value: trainingExpiring,              sub: 'Expired or expiring soon', icon: '🎓', color: trainingExpiring > 0 ? '#d97706' : '#16a34a', link: '/training' },
    { label: 'DBS Expiring',       value: dbsExpiring,                   sub: 'Within 30 days', icon: '🪪', color: dbsExpiring > 0 ? '#d97706' : '#16a34a', link: '/staff' },
    { label: 'Unread Messages',    value: dash?.unreadMessages ?? 0,     sub: 'Family portal', icon: '💬', color: (dash?.unreadMessages ?? 0) > 0 ? '#6366f1' : '#6b7280', link: '/family' },
  ];

  return (
    <div>
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title">{greeting}, {user?.firstName} 🏠</h1>
          <p className="page-subtitle">{user?.careHomeName} · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/care-notes" className="btn btn-secondary btn-sm">📝 Care Notes</Link>
          <Link to="/incidents?action=new" className="btn btn-danger btn-sm">🚨 Report Incident</Link>
        </div>
      </div>

      {/* ── Weather Widget (prominent position) ─────────────── */}
      <div style={{ marginBottom: 24 }}>
        <WeatherWidget />
      </div>

      {/* ── KPI Grid (animated) ────────────────────────────────── */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        {KPI_CARDS.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* ── Operations today (connects cleaning / kitchen / maintenance) ── */}
      {(() => {
        const orders = Array.isArray(kitchenOrders) ? kitchenOrders : [];
        const meals = orders.reduce((n: number, r: any) => n + Number(r.total_orders || 0), 0);
        const active = turnoverData?.activeTurnovers?.length ?? 0;
        const overdueT = turnoverData?.overdue ?? 0;
        const tiles = [
          { label: 'Rooms serviced today', value: `${hkSummary?.rooms_serviced_today ?? 0}/${hkSummary?.total_rooms ?? 0}`, color: '#14b8a6', icon: '🧹', to: '/housekeeping' },
          { label: 'Housekeeping tasks today', value: `${hkSummary?.tasks_today ?? 0}`, color: '#7c3aed', icon: '🧾', to: '/housekeeping' },
          { label: 'Meal orders today', value: `${meals}`, color: '#f97316', icon: '🍽️', to: '/menu-choices' },
          { label: 'Active room turnovers', value: `${active}${overdueT ? ` · ${overdueT} overdue` : ''}`, color: '#64748b', icon: '🛏️', to: '/room-turnover' },
        ];
        return (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <strong style={{ fontSize: 15 }}>🏢 Operations today</strong>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cleaning · Kitchen · Maintenance</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {tiles.map(t => (
                <Link key={t.label} to={t.to} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '14px', borderRadius: 10, background: '#f9fafb', border: '1px solid var(--border)', borderLeft: `4px solid ${t.color}` }}>
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{t.icon}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: t.color }}>{t.value}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2, color: 'var(--text)' }}>{t.label}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Occupancy Bar ─────────────────────────────────────── */}
      {occupancyRate !== null && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">🏠 Occupancy</span><span style={{ fontSize: 24, fontWeight: 900, color: '#0d9488' }}>{occupancyRate}%</span></div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <div style={{ height: 12, borderRadius: 6, background: '#e5e7eb', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${occupancyRate}%`, borderRadius: 6, background: occupancyRate > 90 ? '#16a34a' : occupancyRate > 70 ? '#d97706' : '#dc2626', transition: 'width 1s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>{dash?.residents?.active ?? 0} occupied</span>
              <span>{(dash?.residents?.total ?? 0) - (dash?.residents?.active ?? 0)} available</span>
              <span>{dash?.residents?.total ?? 0} total beds</span>
            </div>
          </div>
        </div>
      )}

      {/* ── 3-column content ───────────────────────────────────── */}
      <div className="grid-3">

        {/* Open Incidents */}
        <div className="card">
          <div className="card-header"><span className="card-title">⚠️ Open Incidents</span><Link to="/incidents" className="btn btn-ghost btn-sm">All →</Link></div>
          <div className="card-body" style={{ padding: 0 }}>
            {incidents.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>✅ No open incidents</div>
            ) : incidents.slice(0, 6).map(inc => {
              const sColor = inc.severity === 'critical' || inc.severity === 'high' ? '#dc2626' : inc.severity === 'medium' ? '#d97706' : '#6b7280';
              return (
                <div key={inc.id} style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: sColor, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{inc.resident_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inc.incident_type?.replace(/_/g, ' ') ?? ''} · {formatDate(inc.incident_date)}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: sColor + '15', color: sColor, fontWeight: 700, textTransform: 'uppercase', flexShrink: 0 }}>{inc.severity}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* CQC KLoE RAG */}
        <div className="card">
          <div className="card-header"><span className="card-title">📋 CQC KLoE Status</span><Link to="/compliance" className="btn btn-ghost btn-sm">Detail →</Link></div>
          <div className="card-body" style={{ padding: 0 }}>
            {[
              { domain: 'safe',      label: 'Safe',        icon: '🛡️' },
              { domain: 'effective', label: 'Effective',   icon: '⚡' },
              { domain: 'caring',    label: 'Caring',      icon: '❤️' },
              { domain: 'responsive',label: 'Responsive',  icon: '🔄' },
              { domain: 'well_led',  label: 'Well-Led',    icon: '🏆' },
            ].map(k => {
              const open    = compActions.filter(a => a.kloe_domain === k.domain && a.status !== 'closed').length;
              const overdue = compActions.filter(a => a.kloe_domain === k.domain && a.status !== 'closed' && a.due_date && new Date(a.due_date) < new Date()).length;
              const rag     = overdue > 0 ? 'red' : open > 0 ? 'amber' : 'green';
              const ragColor = rag === 'red' ? '#dc2626' : rag === 'amber' ? '#d97706' : '#16a34a';
              const ragBg    = rag === 'red' ? '#fef2f2' : rag === 'amber' ? '#fffbeb' : '#f0fdf4';
              return (
                <div key={k.domain} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: ragColor, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 16 }}>{k.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{k.label}</span>
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: ragBg, color: ragColor, fontWeight: 700 }}>
                    {rag === 'green' ? '✓ Good' : `${overdue || open} ${overdue > 0 ? 'overdue' : 'open'}`}
                  </span>
                </div>
              );
            })}
            <div style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#16a34a', marginRight: 4 }} />{t('Good')}</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#d97706', marginRight: 4 }} />Requires attention</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#dc2626', marginRight: 4 }} />{t('Overdue')}</span>
            </div>
          </div>
        </div>

        {/* Recent Care Notes + Quick Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">📊 Today at a Glance</span></div>
            <div className="card-body" style={{ padding: 0 }}>
              {[
                { label: 'Care notes logged', value: dash?.notesToday ?? '—', color: '#6366f1' },
                { label: 'Flagged notes',     value: dash?.flaggedNotes ?? '—', color: '#dc2626' },
                { label: 'High-risk residents', value: dash?.residents?.high_risk ?? '—', color: '#d97706' },
                { label: 'Staff on shift',    value: staff.length, color: '#0d9488' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">⚡ Quick Actions</span></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['/residents?action=admit', '+ Admit New Resident', '#0d9488'],
                ['/schedule', '📅 View/Edit Rota', '#8b5cf6'],
                ['/training', '🎓 Training Matrix', '#d97706'],
                ['/billing', '💷 Billing & Invoices', '#16a34a'],
                ['/compliance', '📋 Compliance Actions', '#dc2626'],
                ['/staff', '👥 Staff Directory', '#059669'],
              ].map(([path, label, color]) => (
                <Link key={path} to={path as string} style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid ${color}25`, background: (color as string) + '0e', color: color as string, fontWeight: 600, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 120ms' }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Activities Widget ─────────────────────────────────── */}
      <div style={{ marginTop: 24 }}>
        <ActivitiesWidget />
      </div>

      {/* ── Live Activity Feed ─────────────────────────────────── */}
      <div style={{ marginTop: 24 }}>
        <LiveActivityFeed />
      </div>
    </div>
  );
}
