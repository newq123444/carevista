import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useMonitoringAlerts, useMonitoringTargets, useMonitoringChart, useSetMonitoringTarget, useResidents } from '../hooks';

// Fluid, food and repositioning charts.
// Built from the care notes staff already write — no second place to record
// the same number. What is added is the target, the shortfall, and the alert.

function fmtTime(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function Kpi({ label, value, tone, note }: { label: string; value: React.ReactNode; tone?: string; note?: string }) {
  return (
    <div className="card"><div className="card-body" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</div>
      <div style={{ fontSize: '1.9rem', fontWeight: 700, color: tone || '#0f172a', marginTop: 4 }}>{value}</div>
      {note && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{note}</div>}
    </div></div>
  );
}

function Bar({ value, target, colour }: { value: number; target?: number | null; colour: string }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div style={{ height: 10, background: '#e2e8f0', borderRadius: 5, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: colour, transition: 'width .3s' }} />
    </div>
  );
}

export default function MonitoringCharts() {
  const { t: tr } = useLang();
  const [tab, setTab] = useState<'alerts' | 'chart' | 'setup'>('alerts');
  const [residentId, setResidentId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [setupOpen, setSetupOpen] = useState(false);
  const [setup, setSetup] = useState<any>({
    residentId: '', monitorFluids: false, fluidTargetMl: 1500, fluidMinimumMl: 1000,
    monitorOutput: false, monitorFood: false, foodMinimumPercent: 50,
    monitorRepositioning: false, repositionIntervalHours: 4,
    monitorWeight: false, monitorBowels: false, bowelAlertDays: 3, reason: '',
  });

  const { data: alerts } = useMonitoringAlerts();
  const { data: targets } = useMonitoringTargets();
  const { data: chart } = useMonitoringChart(residentId, date);
  const { data: residents } = useResidents();
  const setTarget = useSetMonitoringTarget();

  const alertList: any[] = alerts?.alerts || [];
  const targetList: any[] = Array.isArray(targets) ? targets : [];
  const residentList: any[] = Array.isArray(residents) ? residents : [];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">{tr('Fluid & Food Charts')}</h1>
          <p className="page-subtitle">
            Built from the care notes staff already write. Set a target for a resident and the shortfall shows here.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setSetupOpen(true)}>Start monitoring someone</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <Kpi label="Being monitored" value={alerts?.residentsMonitored ?? '—'} />
        <Kpi label="Needs attention" value={alertList.length} tone={alertList.length > 0 ? '#b45309' : '#059669'} />
        <Kpi label="Urgent" value={alerts?.highCount ?? 0} tone={(alerts?.highCount || 0) > 0 ? '#b91c1c' : '#059669'} />
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 18, flexWrap: 'wrap' }}>
        {([['alerts', 'Needs attention'], ['chart', "One person's chart"], ['setup', 'Who is monitored']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === k ? '3px solid #4f46e5' : '3px solid transparent',
            color: tab === k ? '#4f46e5' : '#64748b', fontWeight: tab === k ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'alerts' && (
        <div>
          {(alerts?.residentsMonitored || 0) === 0 ? (
            <div className="card"><div className="card-body table-empty">
              Nobody is being monitored yet. Start with anyone at risk of dehydration, poor intake or pressure damage.
            </div></div>
          ) : alertList.length === 0 ? (
            <div className="card"><div className="card-body table-empty" style={{ color: '#059669' }}>
              Everyone being monitored is on track right now.
            </div></div>
          ) : alertList.map((a, i) => (
            <div className="card" key={i} style={{ marginBottom: 10, borderLeft: `4px solid ${a.severity === 'high' ? '#ef4444' : '#f59e0b'}` }}>
              <div className="card-body" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', padding: '14px 18px' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600 }}>{a.residentName} <span style={{ color: '#94a3b8', fontWeight: 400 }}>· Room {a.roomNumber}</span></div>
                  <div style={{ color: a.severity === 'high' ? '#b91c1c' : '#b45309', marginTop: 2 }}>{a.message}</div>
                  {a.detail && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{a.detail}</div>}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => { setResidentId(a.residentId); setTab('chart'); }}>
                  Open chart
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'chart' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 220, marginBottom: 0 }}>
                <label className="form-label">Resident</label>
                <select className="form-input" value={residentId} onChange={e => setResidentId(e.target.value)}>
                  <option value="">Choose a resident…</option>
                  {targetList.map(t => <option key={t.residentId} value={t.residentId}>{t.residentName} — Room {t.roomNumber}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Day</label>
                <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
          </div>

          {!residentId ? (
            <div className="card"><div className="card-body table-empty">Choose a resident to see their chart.</div></div>
          ) : !chart ? (
            <div className="card"><div className="card-body">Loading…</div></div>
          ) : !chart.monitoring ? (
            <div className="card"><div className="card-body table-empty">
              {chart.residentName} is not being monitored. Use "Start monitoring someone" to set a target.
            </div></div>
          ) : (
            <>
              {chart.noEntries && (
                <div className="card" style={{ marginBottom: 16, background: '#fffbeb', borderLeft: '4px solid #f59e0b' }}>
                  <div className="card-body" style={{ padding: '12px 18px', color: '#92400e' }}>
                    Nothing charted for this day. A blank chart is not a zero — it means nobody recorded anything.
                  </div>
                </div>
              )}

              {chart.monitoring.fluids && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header"><span className="card-title">Fluids</span></div>
                  <div className="card-body">
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: '2rem', fontWeight: 700, color: chart.fluid.belowMinimum ? '#b91c1c' : chart.fluid.behindSchedule ? '#b45309' : '#0f172a' }}>
                        {chart.fluid.totalMl}ml
                      </span>
                      <span style={{ color: '#64748b' }}>of {chart.fluid.targetMl}ml target</span>
                      {chart.fluid.percentOfTarget != null && <span style={{ marginLeft: 'auto', color: '#64748b' }}>{chart.fluid.percentOfTarget}%</span>}
                    </div>
                    <Bar value={chart.fluid.totalMl} target={chart.fluid.targetMl}
                      colour={chart.fluid.belowMinimum ? '#ef4444' : chart.fluid.behindSchedule ? '#f59e0b' : '#10b981'} />
                    {chart.fluid.behindSchedule && (
                      <div style={{ marginTop: 8, color: '#b45309', fontSize: '0.85rem' }}>
                        Behind for this time of day — around {chart.fluid.expectedByNowMl}ml would be expected by now.
                      </div>
                    )}
                    {chart.fluid.entries.length > 0 && (
                      <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {chart.fluid.entries.map((e: any) => (
                          <span key={e.id} style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: 6, fontSize: '0.82rem' }}>
                            {fmtTime(e.at)} · <strong>{e.ml}ml</strong>
                            <span style={{ color: '#94a3b8' }}> {e.recordedBy}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {chart.monitoring.output && (
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0', fontSize: '0.9rem' }}>
                        Output recorded today: <strong>{chart.output.totalMl}ml</strong> across {chart.output.entries.length} entries.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {chart.monitoring.food && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header"><span className="card-title">Food</span></div>
                  <div className="card-body">
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: '2rem', fontWeight: 700, color: chart.food.belowMinimum ? '#b91c1c' : '#0f172a' }}>
                        {chart.food.averagePercent != null ? `${chart.food.averagePercent}%` : '—'}
                      </span>
                      <span style={{ color: '#64748b' }}>
                        eaten on average across {chart.food.mealsRecorded} meal{chart.food.mealsRecorded === 1 ? '' : 's'}
                      </span>
                    </div>
                    {chart.food.entries.map((e: any) => (
                      <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ width: 56, color: '#64748b', fontSize: '0.85rem' }}>{fmtTime(e.at)}</span>
                        <div style={{ flex: 1 }}><Bar value={e.percent} target={100} colour={e.percent < 50 ? '#ef4444' : e.percent < 75 ? '#f59e0b' : '#10b981'} /></div>
                        <span style={{ width: 44, textAlign: 'right', fontWeight: 600 }}>{e.percent}%</span>
                      </div>
                    ))}
                    {chart.food.entries.length === 0 && <div style={{ color: '#94a3b8' }}>No meals recorded for this day.</div>}
                  </div>
                </div>
              )}

              {chart.monitoring.repositioning && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header"><span className="card-title">Repositioning</span></div>
                  <div className="card-body">
                    <div style={{ marginBottom: 10 }}>
                      <strong style={{ fontSize: '1.4rem' }}>{chart.repositioning.count}</strong>
                      <span style={{ color: '#64748b' }}> of about {chart.repositioning.expectedCount} expected (every {chart.repositioning.intervalHours} hours)</span>
                    </div>
                    {chart.repositioning.gaps.length > 0 && (
                      <div style={{ background: '#fef2f2', padding: '10px 14px', borderRadius: 6, marginBottom: 12 }}>
                        <div style={{ color: '#991b1b', fontWeight: 600, marginBottom: 4 }}>
                          {chart.repositioning.gaps.length} gap{chart.repositioning.gaps.length === 1 ? '' : 's'} longer than the interval
                        </div>
                        {chart.repositioning.gaps.map((g: any, i: number) => (
                          <div key={i} style={{ fontSize: '0.85rem', color: '#991b1b' }}>
                            {fmtTime(g.from)} → {fmtTime(g.to)} · {g.hours} hours
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {chart.repositioning.entries.map((e: any) => (
                        <span key={e.id} style={{ background: '#f1f5f9', padding: '6px 10px', borderRadius: 6, fontSize: '0.82rem' }}>
                          {fmtTime(e.at)} · <strong>{e.position}</strong>
                        </span>
                      ))}
                      {chart.repositioning.entries.length === 0 && <span style={{ color: '#94a3b8' }}>Nothing recorded for this day.</span>}
                    </div>
                  </div>
                </div>
              )}

              {chart.monitoring.reason && (
                <div className="card">
                  <div className="card-body" style={{ fontSize: '0.88rem', color: '#64748b' }}>
                    <strong>Why this person is monitored:</strong> {chart.monitoring.reason}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'setup' && (
        <div className="card">
          {targetList.length === 0 ? (
            <div className="card-body table-empty">Nobody is being monitored yet.</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Resident</th><th>Room</th><th>What is monitored</th><th>Since</th><th>Set by</th><th></th></tr></thead>
                <tbody>
                  {targetList.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 500 }}>{t.residentName}</td>
                      <td>{t.roomNumber}</td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {[
                          t.monitorFluids && `Fluids (${t.fluidTargetMl}ml)`,
                          t.monitorFood && `Food (min ${t.foodMinimumPercent}%)`,
                          t.monitorRepositioning && `Repositioning (${t.repositionIntervalHours}h)`,
                          t.monitorWeight && 'Weight',
                          t.monitorBowels && 'Bowels',
                        ].filter(Boolean).join(' · ')}
                      </td>
                      <td>{t.startedOn}</td>
                      <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{t.setByName || '—'}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          setSetup({
                            residentId: t.residentId, monitorFluids: t.monitorFluids,
                            fluidTargetMl: t.fluidTargetMl || 1500, fluidMinimumMl: t.fluidMinimumMl || 1000,
                            monitorOutput: t.monitorOutput, monitorFood: t.monitorFood,
                            foodMinimumPercent: t.foodMinimumPercent || 50,
                            monitorRepositioning: t.monitorRepositioning,
                            repositionIntervalHours: t.repositionIntervalHours || 4,
                            monitorWeight: t.monitorWeight, monitorBowels: t.monitorBowels,
                            bowelAlertDays: t.bowelAlertDays || 3, reason: t.reason || '',
                          });
                          setSetupOpen(true);
                        }}>Change</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {setupOpen && (
        <div className="modal-overlay" onClick={() => setSetupOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Monitoring</span>
              <button className="modal-close" onClick={() => setSetupOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Resident</label>
                <select className="form-input" value={setup.residentId} onChange={e => setSetup({ ...setup, residentId: e.target.value })}>
                  <option value="">Choose a resident…</option>
                  {residentList.map(r => (
                    <option key={r.id} value={r.id}>{r.first_name || r.firstName} {r.last_name || r.lastName} — Room {r.room_number || r.roomNumber}</option>
                  ))}
                </select>
              </div>

              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={setup.monitorFluids} onChange={e => setSetup({ ...setup, monitorFluids: e.target.checked })} />
                Fluid chart
              </label>
              {setup.monitorFluids && (
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingLeft: 24 }}>
                  <div className="form-group">
                    <label className="form-label">Daily target (ml)</label>
                    <input className="form-input" type="number" value={setup.fluidTargetMl}
                      onChange={e => setSetup({ ...setup, fluidTargetMl: Number(e.target.value) })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alert below (ml)</label>
                    <input className="form-input" type="number" value={setup.fluidMinimumMl}
                      onChange={e => setSetup({ ...setup, fluidMinimumMl: Number(e.target.value) })} />
                  </div>
                </div>
              )}
              {setup.monitorFluids && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 24 }}>
                  <input type="checkbox" checked={setup.monitorOutput} onChange={e => setSetup({ ...setup, monitorOutput: e.target.checked })} />
                  Also record output
                </label>
              )}

              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={setup.monitorFood} onChange={e => setSetup({ ...setup, monitorFood: e.target.checked })} />
                Food chart
              </label>
              {setup.monitorFood && (
                <div className="form-group" style={{ paddingLeft: 24 }}>
                  <label className="form-label">Alert if average eaten falls below (%)</label>
                  <input className="form-input" type="number" value={setup.foodMinimumPercent}
                    onChange={e => setSetup({ ...setup, foodMinimumPercent: Number(e.target.value) })} />
                </div>
              )}

              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={setup.monitorRepositioning} onChange={e => setSetup({ ...setup, monitorRepositioning: e.target.checked })} />
                Repositioning chart
              </label>
              {setup.monitorRepositioning && (
                <div className="form-group" style={{ paddingLeft: 24 }}>
                  <label className="form-label">Reposition every (hours)</label>
                  <input className="form-input" type="number" min={1} max={12} value={setup.repositionIntervalHours}
                    onChange={e => setSetup({ ...setup, repositionIntervalHours: Number(e.target.value) })} />
                </div>
              )}

              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={setup.monitorWeight} onChange={e => setSetup({ ...setup, monitorWeight: e.target.checked })} />
                  Weight
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" checked={setup.monitorBowels} onChange={e => setSetup({ ...setup, monitorBowels: e.target.checked })} />
                  Bowels
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Why</label>
                <textarea className="form-input" rows={2} value={setup.reason}
                  placeholder="e.g. Recurrent UTIs, poor oral intake noted by night staff."
                  onChange={e => setSetup({ ...setup, reason: e.target.value })} />
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b', background: '#f8fafc', padding: '8px 12px', borderRadius: 6 }}>
                Staff do not enter anything twice — these charts read the fluid, food and position fields
                already on care notes. Unticking everything stops monitoring.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setSetupOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={setTarget.isPending}
                onClick={() => setTarget.mutate(setup as any, { onSuccess: () => setSetupOpen(false) })}>
                {setTarget.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
