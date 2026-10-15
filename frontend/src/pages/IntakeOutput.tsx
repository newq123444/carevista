// ────────────────────────────────────────────────────────────────────────────
// Fluids, food and bowels — today, for the whole home, at a glance.
//
// Built for a nurse or manager on a phone in a corridor: who needs something
// doing, and why, in the first screenful. Everyone else is one tap away.
//
// The three numbers on each card are the ones handover asks about. They are
// big, they are coloured only when there is a reason, and the reason is
// written underneath in a sentence — never just a red dot.
// ────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIntakeToday } from '../hooks/useIntakeToday';
import { PrintHeader, PrintButton } from '../components/PrintHeader';
import type { ResidentDay } from '../utils/intakeSummary';
import { useWeightTrends } from '../hooks/useWeightTrends';
import type { WeightTrend } from '../utils/weightTrend';

const RED = { fg: '#b91c1c', bg: '#fef2f2', border: '#fecaca' };
const AMBER = { fg: '#92400e', bg: '#fffbeb', border: '#fde68a' };
const GREEN = { fg: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' };
const GREY = { fg: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };

type Filter = 'attention' | 'everyone' | 'charts' | 'weight';

const hhmm = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function levelOf(d: ResidentDay, area?: 'fluid' | 'food' | 'bowels') {
  const cs = area ? d.concerns.filter(c => c.area === area) : d.concerns;
  if (cs.some(c => c.level === 'red')) return RED;
  if (cs.some(c => c.level === 'amber')) return AMBER;
  return null;
}

export default function IntakeOutput() {
  const nav = useNavigate();
  const { days, red, amber, now, isLoading, isError, refetch } = useIntakeToday();
  const [filter, setFilter] = useState<Filter>('attention');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const { trends } = useWeightTrends();
  // Weight is a slower signal than today's fluids, so it has its own list and
  // does not change the counts above. Residents never weighed are counted, not
  // flagged one by one: in a home that doesn't weigh, that would be everyone.
  const weightFlag = (id: string) => {
    const w = trends.get(id);
    return !!w && !!w.latest && w.level !== 'ok';
  };
  const weightCount = days.filter(d => weightFlag(d.residentId)).length;
  const neverWeighed = trends.size ? days.filter(d => !trends.get(d.residentId)?.latest).length : 0;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return days.filter(d => {
      if (q && !`${d.name} ${d.room || ''}`.toLowerCase().includes(q)) return false;
      if (filter === 'attention') return d.concerns.length > 0;
      if (filter === 'charts') return d.fluid.monitored || d.food.monitored || d.bowels.monitored;
      if (filter === 'weight') return weightFlag(d.residentId);
      return true;
    });
  }, [days, filter, search, trends]);

  const fine = days.length - red - amber;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '4px 4px 40px' }}>
      <PrintHeader title="Fluids, food and bowels" subject={now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: '0 0 2px' }}>Fluids, food & bowels</h1>
          <p style={{ margin: 0, fontSize: 15, color: 'var(--text-secondary)' }}>
            Today so far · updated {hhmm(now.toISOString())}
          </p>
        </div>
        <PrintButton />
      </div>

      {/* The answer to "is anyone in trouble?" before anything else. */}
      <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <Tally n={red} label="need action" c={RED} onClick={() => setFilter('attention')} />
        <Tally n={amber} label="worth a look" c={AMBER} onClick={() => setFilter('attention')} />
        <Tally n={fine} label="nothing flagged" c={GREEN} onClick={() => setFilter('everyone')} />
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto' }}>
        {([['attention', `Needs attention (${red + amber})`], ['everyone', `Everyone (${days.length})`], ['charts', 'On a chart'], ['weight', `Weight (${weightCount})`]] as const)
          .map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              minHeight: 48, padding: '0 16px', borderRadius: 999, whiteSpace: 'nowrap', cursor: 'pointer',
              border: `1.5px solid ${filter === k ? '#4f46e5' : 'var(--border)'}`,
              background: filter === k ? '#eef2ff' : '#fff', color: filter === k ? '#3730a3' : 'var(--text-secondary)',
              fontSize: 15, fontWeight: filter === k ? 700 : 500,
            }}>{label}</button>
          ))}
      </div>

      <input className="form-input no-print" placeholder="Find a resident or room…" value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', minHeight: 48, fontSize: 16, marginBottom: 12 }} />

      {isLoading ? <p style={{ fontSize: 16 }}>Loading…</p>
        : isError ? (
          <div className="card" style={{ padding: 20 }}>
            <p style={{ margin: '0 0 10px' }}>Could not load today's figures.</p>
            <button className="btn btn-primary" onClick={() => refetch()}>Try again</button>
          </div>
        ) : shown.length === 0 ? (
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>✅</div>
            <p style={{ fontSize: 17, fontWeight: 600, margin: '6px 0 4px' }}>
              {filter === 'attention' ? 'Nobody flagged right now' : 'Nobody matches'}
            </p>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>
              {filter === 'attention'
                ? 'Only residents with a set target, or a clear reason, are ever flagged.'
                : 'Try a different search.'}
            </p>
          </div>
        ) : shown.map(d => (
          <ResidentCard key={d.residentId} d={d} w={trends.get(d.residentId)} open={open === d.residentId}
            onToggle={() => setOpen(o => (o === d.residentId ? null : d.residentId))}
            onChart={() => nav(`/charts?resident=${d.residentId}`)}
            onResident={() => nav(`/residents/${d.residentId}`)} />
        ))}

      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 18, lineHeight: 1.55 }}>
        Fluid targets come only from a resident's chart, set by a nurse — none are assumed.
        "Not recorded" means nothing has been written down yet, which is not the same as nothing
        drunk. Bowels turn amber after 2 days and red after 3, unless a different limit is set on the resident's chart.
      </p>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.55 }}>
        Weight: loss is measured against the highest weight in the last six months, as MUST step 2 asks — not just
        against last time. The scores shown are MUST steps 1 and 2 only; whether a loss was planned, and acute
        illness (step 3), need a nurse's judgement.
        {neverWeighed > 0 && ` ${neverWeighed} resident${neverWeighed === 1 ? ' has' : 's have'} no weight recorded.`}
      </p>
    </div>
  );
}

function Tally({ n, label, c, onClick }: { n: number; label: string; c: typeof RED; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      minHeight: 72, borderRadius: 14, cursor: 'pointer', textAlign: 'center',
      border: `1.5px solid ${n ? c.border : 'var(--border)'}`, background: n ? c.bg : '#fff',
    }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: n ? c.fg : 'var(--text-secondary)', lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: 13, color: n ? c.fg : 'var(--text-secondary)' }}>{label}</div>
    </button>
  );
}

function ResidentCard({ d, w, open, onToggle, onChart, onResident }:
  { d: ResidentDay; w?: WeightTrend; open: boolean; onToggle: () => void; onChart: () => void; onResident: () => void }) {
  const edge = levelOf(d) || GREY;
  return (
    <div className="card" style={{
      padding: 0, marginBottom: 10, overflow: 'hidden',
      borderLeft: `6px solid ${levelOf(d) ? edge.fg : 'var(--border)'}`,
    }}>
      <button onClick={onToggle} style={{
        width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
        padding: '14px 14px 12px', minHeight: 64,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{d.name}</span>
          {d.room && <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Room {d.room}</span>}
          {d.away && (
            <span style={{ fontSize: 12.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8' }}>
              Away — {String(d.away).replace(/_/g, ' ')}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 18, color: '#94a3b8' }} aria-hidden>{open ? '▴' : '▾'}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <FluidTile d={d} />
          <FoodTile d={d} />
          <BowelTile d={d} />
        </div>
      </button>

      {d.concerns.length > 0 && (
        <div style={{ padding: '0 14px 12px', display: 'grid', gap: 6 }}>
          {d.concerns.map((c, i) => {
            const col = c.level === 'red' ? RED : AMBER;
            return (
              <div key={i} style={{
                fontSize: 14.5, lineHeight: 1.4, padding: '8px 11px', borderRadius: 10,
                background: col.bg, color: col.fg, border: `1px solid ${col.border}`,
              }}>
                {c.level === 'red' ? '● ' : '○ '}{c.text}
              </div>
            );
          })}
        </div>
      )}

      {w && <WeightLine w={w} />}

      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px 14px', background: 'var(--surface-2, #f8fafc)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Drinks today</div>
          {d.fluid.entries.length === 0 ? (
            <p style={{ margin: '0 0 10px', fontSize: 14.5, color: 'var(--text-secondary)' }}>Nothing recorded yet.</p>
          ) : (
            <div style={{ marginBottom: 10 }}>
              {d.fluid.entries.slice().reverse().map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 15, padding: '5px 0', borderBottom: '1px dashed var(--border)' }}>
                  <span style={{ width: 48, color: 'var(--text-secondary)' }}>{hhmm(e.at)}</span>
                  <span style={{ width: 70, fontWeight: 700, color: '#0e7490' }}>{e.ml} ml</span>
                  <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.by || ''}</span>
                </div>
              ))}
            </div>
          )}
          <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" style={{ minHeight: 48 }} onClick={onChart}>Full chart</button>
            <button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={onResident}>Resident record</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ icon, big, small, c }: { icon: string; big: React.ReactNode; small: React.ReactNode; c: typeof RED | null }) {
  const col = c || GREY;
  return (
    <div style={{
      borderRadius: 12, padding: '9px 8px', minHeight: 84,
      background: c ? col.bg : '#fff', border: `1px solid ${c ? col.border : 'var(--border)'}`,
    }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15, color: c ? col.fg : 'var(--text-primary, #111827)' }}>{big}</div>
      <div style={{ fontSize: 12.5, color: c ? col.fg : 'var(--text-secondary)', marginTop: 2, lineHeight: 1.3 }}>{small}</div>
    </div>
  );
}

function FluidTile({ d }: { d: ResidentDay }) {
  const f = d.fluid;
  const c = levelOf(d, 'fluid');
  return (
    <Tile icon="💧 Fluids" c={c}
      big={f.recorded ? <>{f.totalMl}<span style={{ fontSize: 13, fontWeight: 600 }}> ml</span></> : '—'}
      small={<>
        {f.targetMl ? <>of {f.targetMl} ml</> : f.recorded ? 'no target set' : 'not recorded'}
        {f.targetMl && (
          <div style={{ height: 6, borderRadius: 99, background: '#e2e8f0', marginTop: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, f.percentOfTarget || 0)}%`, background: c ? c.fg : '#06b6d4' }} />
          </div>
        )}
        {f.lastAt && <div>last {hhmm(f.lastAt)}</div>}
      </>} />
  );
}

function FoodTile({ d }: { d: ResidentDay }) {
  const f = d.food;
  return (
    <Tile icon="🍽 Food" c={levelOf(d, 'food')}
      big={f.meals ? `${f.averagePercent}%` : '—'}
      small={f.meals ? `avg of ${f.meals} meal${f.meals === 1 ? '' : 's'}` : 'not recorded'} />
  );
}

function BowelTile({ d }: { d: ResidentDay }) {
  const b = d.bowels;
  const big = b.openedToday ? 'Today' : b.daysSince == null ? '—' : b.daysSince === 1 ? 'Yesterday' : `${b.daysSince} days`;
  const small = b.openedToday
    ? `${b.openedToday}× today${b.looseToday ? ` · ${b.looseToday} loose` : ''}`
    : b.daysSince == null ? 'no record' : 'since opened';
  return <Tile icon="🚽 Bowels" c={levelOf(d, 'bowels')} big={big} small={small} />;
}

function WeightLine({ w }: { w: WeightTrend }) {
  if (!w.latest) {
    return <div style={{ padding: '0 14px 12px', fontSize: 13.5, color: 'var(--text-secondary)' }}>⚖️ No weight recorded</div>;
  }
  const c = w.level === 'act' ? RED : w.level === 'watch' ? AMBER : null;
  const ago = w.daysSinceWeighed === 0 ? 'today' : w.daysSinceWeighed === 1 ? 'yesterday' : `${w.daysSinceWeighed} days ago`;
  const trend = w.changePct == null ? '' : w.changePct >= 1 ? ` · down ${w.changePct}% in 6 months` : w.changePct <= -1 ? ` · up ${Math.abs(w.changePct)}%` : ' · steady';
  return (
    <div style={{ padding: '0 14px 12px', display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 14, color: c ? c.fg : 'var(--text-secondary)' }}>
        ⚖️ {w.latest.kg.toFixed(1)} kg, {ago}{trend}{w.bmi != null ? ` · BMI ${w.bmi}` : ''}
      </div>
      {c && w.concerns.map((text, i) => (
        <div key={i} style={{ fontSize: 14.5, lineHeight: 1.4, padding: '8px 11px', borderRadius: 10, background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}>
          {w.level === 'act' ? '● ' : '○ '}{text}
        </div>
      ))}
    </div>
  );
}
