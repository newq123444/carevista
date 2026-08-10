// src/pages/dashboards/KitchenDashboard.tsx — working kitchen station
import React, { useState } from 'react';
import { useLang } from '../../i18n';
import {
  useKitchenDashboard, useKitchenChecklist, useSetKitchenCheck,
  useKitchenTemps, useLogKitchenTemp, useMealOrders, useUpdateMealOrder,
} from '../../hooks';
import { MetricCard, SectionCard, PageHeading } from '../../components/ui';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_ICON: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '☕' };
const TEMP_TYPES: { v: string; l: string; hint: string }[] = [
  { v: 'fridge', l: 'Fridge', hint: '0–5°C' },
  { v: 'freezer', l: 'Freezer', hint: '−18°C or below' },
  { v: 'cooking', l: 'Cooking', hint: '75°C+' },
  { v: 'reheating', l: 'Reheating', hint: '75°C+' },
  { v: 'hot_holding', l: 'Hot holding', hint: '63°C+' },
  { v: 'cooling', l: 'Cooling', hint: '8°C or below' },
  { v: 'delivery', l: 'Delivery', hint: '8°C or below' },
];

function currentMeal(): string {
  const h = new Date().getHours();
  if (h < 10) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 20) return 'dinner';
  return 'snack';
}

export default function KitchenDashboard() {
  const { t } = useLang();
  const [meal, setMeal] = useState<string>(currentMeal());
  const [tab, setTab] = useState<'service' | 'safety'>('service');
  const { data: dash } = useKitchenDashboard();
  const { data: orderData } = useMealOrders({ mealType: meal });
  const { data: checklist } = useKitchenChecklist();
  const { data: tempData } = useKitchenTemps();
  const setCheck = useSetKitchenCheck();
  const logTemp = useLogKitchenTemp();
  const updateOrder = useUpdateMealOrder();

  const [tf, setTf] = useState({ log_type: 'fridge', location: '', item_name: '', temperature_c: '', corrective_action: '' });

  const d = dash || ({} as any);
  const orders: any[] = orderData?.orders || [];
  const awaiting: any[] = orderData?.awaitingChoice || [];
  const sum = orderData?.summary || { total: 0, served: 0, refused: 0, textureCounts: {} };
  const cl = checklist || { items: [], completed: 0, total: 0, pct: 0 };
  const temps = tempData?.logs || [];
  const breaches = tempData?.breaches || 0;

  const submitTemp = (e: React.FormEvent) => {
    e.preventDefault();
    if (tf.temperature_c === '') return;
    logTemp.mutate(tf, { onSuccess: () => setTf({ ...tf, item_name: '', temperature_c: '', corrective_action: '' }) });
  };

  const input: React.CSSProperties = { width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface)', color: 'var(--text-primary)' };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };
  const tabBtn = (k: 'service' | 'safety', txt: string) => (
    <button onClick={() => setTab(k)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid ' + (tab === k ? 'var(--primary)' : 'var(--border)'), background: tab === k ? 'var(--primary)' : 'var(--surface)', color: tab === k ? '#fff' : 'var(--text-primary)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{txt}</button>
  );

  return (
    <div style={{ padding: 4, maxWidth: 1150, margin: '0 auto' }}>
      <PageHeading greeting="Kitchen" emoji="🍽️" subtitle="Today's service, dietary needs and food-safety records" />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <MetricCard label="Residents to serve" value={d.residents ?? '—'} icon="👥" />
        <MetricCard label="Orders this meal" value={`${sum.total}`} sub={`${awaiting.length} awaiting choice`} icon="📋" />
        <MetricCard label="Food-safety checks" value={`${d.checklist?.completed ?? cl.completed}/${d.checklist?.total ?? cl.total}`} icon="✅"
          subTone={(d.checklist?.completed ?? cl.completed) < (d.checklist?.total ?? cl.total) ? 'warning' : 'success'} />
        <MetricCard label="Temp readings today" value={d.temperatures?.total ?? temps.length} sub={breaches ? `${breaches} out of range` : 'All in range'} icon="🌡️"
          subTone={breaches ? 'danger' : 'success'} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>{tabBtn('service', '🍲 Service')}{tabBtn('safety', '🛡️ Food safety')}</div>

      {tab === 'service' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {MEALS.map(m => (
              <button key={m} onClick={() => setMeal(m)} style={{ padding: '8px 16px', borderRadius: 20, border: '1px solid ' + (meal === m ? 'var(--primary)' : 'var(--border)'), background: meal === m ? 'var(--primary)' : 'var(--surface)', color: meal === m ? '#fff' : 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer', textTransform: 'capitalize' }}>
                {MEAL_ICON[m]} {m}{d.byMeal?.[m]?.total ? ` (${d.byMeal[m].total})` : ''}
              </button>
            ))}
          </div>

          {Object.keys(sum.textureCounts || {}).length > 0 && (
            <SectionCard title="Texture-modified portions to prepare">
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {Object.entries(sum.textureCounts as Record<string, number>).map(([tx, n]) => (
                  <div key={tx} style={{ padding: '8px 14px', borderRadius: 10, background: tx === 'normal' ? 'var(--surface-2)' : 'var(--danger-light)', border: '1px solid var(--border)' }}>
                    <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{String(tx).replace(/_/g, ' ')}</span>
                    <span style={{ marginLeft: 8, color: 'var(--text-secondary)' }}>× {n}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard title={`${MEAL_ICON[meal]} ${meal.charAt(0).toUpperCase() + meal.slice(1)} orders (${orders.length})`}>
            {orders.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No orders yet for this meal. Care staff send choices from the resident's care tasks.</div>}
            {orders.map(o => {
              const texture = o.texture || o.texture_requirement;
              const allergy = o.allergies || o.dietary_requirements;
              return (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid var(--border)', opacity: o.status === 'served' ? 0.6 : 1 }}>
                  <div style={{ width: 52, fontWeight: 800, color: 'var(--primary)' }}>Rm {o.room_number}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{o.first_name} {o.last_name} — {o.choice_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {texture && texture !== 'normal' && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{String(texture).replace(/_/g, ' ')}</span>}
                      {o.portion_size && o.portion_size !== 'regular' && <span>{o.portion_size} portion</span>}
                      {o.special_request && <span>“{o.special_request}”</span>}
                      {allergy && <span style={{ color: '#b45309', fontWeight: 700 }}>⚠ {allergy}</span>}
                    </div>
                  </div>
                  {o.status === 'served'
                    ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--success)' }}>{t('Served')}</span>
                    : o.status === 'refused'
                      ? <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)' }}>Refused</span>
                      : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => updateOrder.mutate({ id: o.id, data: { status: 'preparing' } })} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}>{t('Preparing')}</button>
                          <button onClick={() => updateOrder.mutate({ id: o.id, data: { status: 'served' } })} style={{ padding: '5px 11px', borderRadius: 7, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('Served')}</button>
                        </div>
                      )}
                </div>
              );
            })}
          </SectionCard>

          {awaiting.length > 0 && (
            <SectionCard title={`Awaiting a choice (${awaiting.length})`}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>These residents have no choice recorded for this meal yet.</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {awaiting.map(r => (
                  <span key={r.id} style={{ padding: '5px 11px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13 }}>
                    Rm {r.room_number} · {r.first_name} {r.last_name}
                  </span>
                ))}
              </div>
            </SectionCard>
          )}

          {(d.allergenResidents || []).length > 0 && (
            <SectionCard title="Allergies & dietary requirements — all residents">
              {(d.allergenResidents || []).map((r: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderTop: i ? '1px solid var(--border)' : 'none', fontSize: 13 }}>
                  <span style={{ width: 60, fontWeight: 700 }}>Rm {r.room_number}</span>
                  <span style={{ flex: 1 }}>{r.resident}</span>
                  <span style={{ color: '#b45309', fontWeight: 600 }}>{[r.allergies, r.dietary_requirements].filter(Boolean).join(' · ')}</span>
                </div>
              ))}
            </SectionCard>
          )}
        </>
      )}

      {tab === 'safety' && (
        <>
          <SectionCard title="Log a temperature">
            <form onSubmit={submitTemp}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <div>
                  <label style={lbl}>Check type</label>
                  <select style={input} value={tf.log_type} onChange={e => setTf({ ...tf, log_type: e.target.value })}>
                    {TEMP_TYPES.map(t => <option key={t.v} value={t.v}>{t.l} ({t.hint})</option>)}
                  </select>
                </div>
                <div><label style={lbl}>Location / appliance</label><input style={input} value={tf.location} onChange={e => setTf({ ...tf, location: e.target.value })} placeholder="e.g. Fridge 1" /></div>
                <div><label style={lbl}>Food item (if applicable)</label><input style={input} value={tf.item_name} onChange={e => setTf({ ...tf, item_name: e.target.value })} placeholder="e.g. Chicken casserole" /></div>
                <div><label style={lbl}>Temperature °C</label><input style={input} type="number" step="0.1" value={tf.temperature_c} onChange={e => setTf({ ...tf, temperature_c: e.target.value })} required /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Corrective action (if outside range)</label><input style={input} value={tf.corrective_action} onChange={e => setTf({ ...tf, corrective_action: e.target.value })} placeholder="e.g. Reheated to 78°C and re-checked" /></div>
              </div>
              <button type="submit" disabled={logTemp.isPending} style={{ marginTop: 12, padding: '10px 20px', borderRadius: 9, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                {logTemp.isPending ? 'Saving…' : 'Log temperature'}
              </button>
            </form>
          </SectionCard>

          <SectionCard title={`Today's temperature records (${temps.length})`}>
            {temps.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No temperatures recorded today.</div>}
            {temps.map((t: any) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                <span style={{ width: 96, fontSize: 12, fontWeight: 700, textTransform: 'capitalize' }}>{String(t.log_type).replace(/_/g, ' ')}</span>
                <span style={{ flex: 1, fontSize: 13 }}>{t.location || '—'}{t.item_name ? ` · ${t.item_name}` : ''}</span>
                <span style={{ fontWeight: 800, color: t.within_range === false ? 'var(--danger)' : 'var(--success)' }}>{t.temperature_c}°C</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 62, textAlign: 'right' }}>{new Date(t.recorded_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </SectionCard>

          <SectionCard title={`Daily food-safety checklist — ${cl.completed}/${cl.total} complete`}>
            <div style={{ height: 8, borderRadius: 6, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ width: `${cl.pct || 0}%`, height: '100%', background: (cl.pct || 0) === 100 ? 'var(--success)' : 'var(--primary)' }} />
            </div>
            {(['opening', 'closing', 'weekly'] as const).map(period => {
              const items = (cl.items || []).filter((i: any) => i.period === period);
              if (!items.length) return null;
              return (
                <div key={period} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 6 }}>{period}</div>
                  {items.map((i: any) => (
                    <label key={i.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={i.completed} onChange={e => setCheck.mutate({ check_key: i.key, completed: e.target.checked })} style={{ marginTop: 3, width: 17, height: 17, cursor: 'pointer' }} />
                      <span style={{ flex: 1, fontSize: 13, color: i.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: i.completed ? 'line-through' : 'none' }}>{i.label}</span>
                      {i.completedBy && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{i.completedBy}</span>}
                    </label>
                  ))}
                </div>
              );
            })}
          </SectionCard>
        </>
      )}
    </div>
  );
}
