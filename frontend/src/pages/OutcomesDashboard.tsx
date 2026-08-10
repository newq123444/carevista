// src/pages/OutcomesDashboard.tsx — proof-of-impact analytics for managers
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useOutcomes } from '../hooks';
import { SectionCard, PageHeading } from '../components/ui';

const MOOD_LABEL: Record<string, string> = { very_happy: 'Very happy', happy: 'Happy', neutral: 'Content', low: 'Low', very_low: 'Very low' };
const MOOD_COLOR: Record<string, string> = { very_happy: '#0f766e', happy: '#14b8a6', neutral: '#64748b', low: '#f59e0b', very_low: '#ef4444' };
const monthName = (ym: string) => { const [y, m] = ym.split('-'); return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-GB', { month: 'short' }); };

function Kpi({ label, value, unit, delta, good, sub }: { label: string; value: React.ReactNode; unit?: string; delta?: number; good?: string; sub?: string }) {
  let arrow = ''; let tone = 'var(--text-muted)';
  if (typeof delta === 'number' && delta !== 0 && good) {
    const improving = (good === 'down' && delta < 0) || (good === 'up' && delta > 0);
    arrow = delta > 0 ? '▲' : '▼';
    tone = improving ? 'var(--success)' : 'var(--danger)';
  }
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', flex: '1 1 150px', minWidth: 150 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 12, marginTop: 4, color: tone }}>
        {arrow} {typeof delta === 'number' && delta !== 0 ? `${Math.abs(delta)}% vs prev 30d` : (sub || 'No change')}
      </div>
    </div>
  );
}

// Simple bar chart (SVG)
function Bars({ data, color = 'var(--primary)', fmt }: { data: { label: string; value: number }[]; color?: string; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const W = 100 / data.length;
  return (
    <svg viewBox="0 0 100 60" preserveAspectRatio="none" style={{ width: '100%', height: 150 }}>
      {data.map((d, i) => {
        const h = (d.value / max) * 46;
        return <g key={i}>
          <rect x={i * W + W * 0.2} y={50 - h} width={W * 0.6} height={h} rx={1.2} fill={color} />
        </g>;
      })}
    </svg>
  );
}

function TrendLine({ data }: { data: { label: string; value: number }[] }) {
  const { t } = useLang();
  if (data.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 12 }}>{t('No data yet')}</div>;
  const max = 100, min = 0;
  const pts = data.map((d, i) => {
    const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
    const y = 50 - ((d.value - min) / (max - min)) * 44;
    return [x, y];
  });
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 100 54" preserveAspectRatio="none" style={{ width: '100%', height: 140 }}>
      <line x1="0" y1="6" x2="100" y2="6" stroke="var(--border)" strokeWidth="0.3" />
      <line x1="0" y1="50" x2="100" y2="50" stroke="var(--border)" strokeWidth="0.3" />
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="1.3" fill="var(--primary)" />)}
    </svg>
  );
}

export default function OutcomesDashboard() {
  const { t } = useLang();
  const [days, setDays] = useState(90);
  const { data, isLoading } = useOutcomes(days);

  if (isLoading || !data) return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading outcomes…</div>;
  const k = data.kpis;
  const fallsTrend = (data.falls_trend || []).map((f: any) => ({ label: monthName(f.month), value: f.count }));
  const taskTrend = (data.task_completion_trend || []).map((t: any, i: number) => ({ label: `W${i + 1}`, value: t.pct }));
  const moodTotal = (data.mood_distribution || []).reduce((a: number, b: any) => a + b.count, 0);
  const wt = data.weight || { stable: 0, up: 0, down: 0, tracked: 0 };
  const wtTotal = Math.max(1, wt.tracked);

  const lbl: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)' };

  return (
    <div style={{ padding: 4, maxWidth: 1100, margin: '0 auto' }}>
      <PageHeading greeting="Outcomes & impact" emoji="📈" subtitle="Evidence that residents' lives are improving — falls, wellbeing, nutrition and care delivery"
        action={
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
            <option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value={180}>Last 6 months</option>
          </select>} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <Kpi label="Falls (30d)" value={k.falls.value} unit={`· ${k.falls.per1000}/1k bed-days`} delta={k.falls.delta} good="down" />
        <Kpi label="All incidents (30d)" value={k.incidents.value} delta={k.incidents.delta} good="down" />
        <Kpi label="Care completed (7d)" value={`${k.task_completion.value}%`} good="up" sub="of scheduled care" />
        <Kpi label="Low mood (30d)" value={`${k.wellbeing_low.value}%`} good="down" sub="of wellbeing logs" />
        <Kpi label="Feeling isolated" value={k.isolation.value} unit="residents" good="down" sub="last 14 days" />
        <Kpi label="Weight stable/up" value={`${k.weight_stable.value}%`} good="up" sub={`${k.weight_stable.tracked} tracked`} />
        <Kpi label="NEWS2 high (30d)" value={k.news2_high.value} delta={k.news2_high.delta} good="down" sub="high/critical scores" />
        <Kpi label="Escalations open" value={k.news2_pending.value} good="down" sub="awaiting response" />
        <Kpi label="At elevated risk" value={k.news2_elevated.value} unit="residents" good="down" sub="latest NEWS2" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 8 }}>
        <SectionCard title="Early warning — high/critical NEWS2 by month">
          {(() => { const nt = (data.news2_trend || []).map((n: any) => ({ label: monthName(n.month), value: n.count }));
            const any = nt.some((x: any) => x.value > 0);
            return any ? <>
              <Bars data={nt} color="#ef4444" />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {nt.map((n: any, i: number) => <span key={i} style={lbl}>{n.label}</span>)}
              </div>
            </> : <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No high or critical NEWS2 scores recorded — a good sign. Deterioration flags will appear here.</div>;
          })()}
        </SectionCard>
        <SectionCard title="Falls by month">
          <Bars data={fallsTrend} color="#0f766e" />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {fallsTrend.map((f: any, i: number) => <span key={i} style={lbl}>{f.label}</span>)}
          </div>
        </SectionCard>

        <SectionCard title="Care completion trend (weekly)">
          <TrendLine data={taskTrend} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {taskTrend.map((t: any, i: number) => <span key={i} style={lbl}>{t.value}%</span>)}
          </div>
        </SectionCard>

        <SectionCard title="Resident mood (last 30 days)">
          {moodTotal === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No wellbeing logs recorded yet.</div>}
          {(data.mood_distribution || []).map((m: any) => {
            const pct = moodTotal ? Math.round((m.count / moodTotal) * 100) : 0;
            return (
              <div key={m.mood} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{MOOD_LABEL[m.mood]}</span><span style={{ color: 'var(--text-muted)' }}>{pct}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: MOOD_COLOR[m.mood], borderRadius: 6 }} />
                </div>
              </div>
            );
          })}
        </SectionCard>

        <SectionCard title="Incidents by type">
          {(data.incidents_by_type || []).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No incidents in this period.</div>}
          {(() => { const mx = Math.max(1, ...(data.incidents_by_type || []).map((x: any) => x.n));
            return (data.incidents_by_type || []).map((x: any) => (
              <div key={x.type} style={{ marginBottom: 9 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{x.type}</span><span style={{ color: 'var(--text-muted)' }}>{x.n}</span>
                </div>
                <div style={{ height: 8, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ width: `${(x.n / mx) * 100}%`, height: '100%', background: '#f59e0b', borderRadius: 6 }} />
                </div>
              </div>)); })()}
        </SectionCard>

        <SectionCard title="Weight & nutrition stability">
          <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ width: `${(wt.stable / wtTotal) * 100}%`, background: '#14b8a6' }} title="Stable" />
            <div style={{ width: `${(wt.up / wtTotal) * 100}%`, background: '#0f766e' }} title="Gaining" />
            <div style={{ width: `${(wt.down / wtTotal) * 100}%`, background: '#ef4444' }} title="Losing" />
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
            <span><span style={{ color: '#14b8a6' }}>●</span> Stable {wt.stable}</span>
            <span><span style={{ color: '#0f766e' }}>●</span> Gaining {wt.up}</span>
            <span><span style={{ color: '#ef4444' }}>●</span> Losing {wt.down}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>Losing weight is a key malnutrition and deterioration signal — this tracks how many residents are maintaining or gaining.</div>
        </SectionCard>

        <SectionCard title={t('Occupancy')}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 34, fontWeight: 700 }}>{data.occupancy.pct}%</span>
            <span style={{ color: 'var(--text-muted)' }}>{data.occupancy.residents} of {data.occupancy.beds} beds</span>
          </div>
          <div style={{ height: 10, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 10 }}>
            <div style={{ width: `${Math.min(100, data.occupancy.pct)}%`, height: '100%', background: 'var(--primary)', borderRadius: 6 }} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
