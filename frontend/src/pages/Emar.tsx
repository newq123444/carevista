// src/pages/Emar.tsx — eMAR with Round View + full record modal
import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useEmar, useRecordAdministration, useCreateMedication, useResidents } from '../hooks';
import { useAuthStore } from '../store/auth.store';
import { formatDate, todayISO } from '../utils/formatters';
import type { Resident } from '../types';

const ROUNDS = [
  { key: '08:00', label: 'Morning',   icon: '🌅', color: '#f59e0b' },
  { key: '12:00', label: 'Afternoon', icon: '☀️',  color: '#10b981' },
  { key: '18:00', label: 'Evening',   icon: '🌆', color: '#6366f1' },
  { key: '22:00', label: 'Night',     icon: '🌙', color: '#0f766e' },
];

const STATUS_STYLE: Record<string, { bg: string; color: string; icon: string; label: string }> = {
  given:        { bg: '#dcfce7', color: '#16a34a', icon: '✓', label: 'Given'    },
  refused:      { bg: '#fef3c7', color: '#d97706', icon: '✕', label: 'Refused'  },
  missed:       { bg: '#fef2f2', color: '#dc2626', icon: '!', label: 'Missed'   },
  omitted:      { bg: '#f3f4f6', color: '#6b7280', icon: '○', label: 'Omitted'  },
  not_required: { bg: '#f3f4f6', color: '#9ca3af', icon: '—', label: 'N/A'      },
  pending:      { bg: '#eff6ff', color: '#0d9488', icon: '·', label: 'Due'      },
};


const ROUTE_ICON: Record<string, string> = {
  oral: '💊', topical: '🧴', cream: '🧴', ointment: '🧴', gel: '🧴',
  patch: '🩹', transdermal: '🩹',
  eye_drops: '👁️', ear_drops: '👂', nasal: '👃', inhaled: '💨', nebuliser: '💨',
  injection: '💉', subcutaneous: '💉', intramuscular: '💉', intravenous: '💉',
  sublingual: '🫦', buccal: '🫦', rectal: '🔴', suppository: '🔴',
  peg: '🔌', enteral: '🔌',
};

const ROUTE_OPTIONS = [
  { value: 'oral',          label: '💊 Oral (tablet / capsule / liquid)' },
  { value: 'topical',       label: '🧴 Topical (cream / ointment / gel)' },
  { value: 'patch',         label: '🩹 Transdermal patch' },
  { value: 'eye_drops',     label: '👁️ Eye drops' },
  { value: 'ear_drops',     label: '👂 Ear drops' },
  { value: 'nasal',         label: '👃 Nasal spray / drops' },
  { value: 'inhaled',       label: '💨 Inhaler / nebuliser' },
  { value: 'injection',     label: '💉 Injection (SC / IM / IV)' },
  { value: 'sublingual',    label: '🫦 Sublingual / buccal' },
  { value: 'rectal',        label: '🔴 Rectal / suppository' },
  { value: 'peg',           label: '🔌 PEG / enteral feed' },
];


// Which routes each role can administer
const CARER_ROUTES = ['topical','cream','ointment','gel','patch','transdermal',
  'eye_drops','ear_drops','nasal','mouth_care','moisturiser'];

function canRecord(userRole: string, medRoute: string): boolean {
  const route = (medRoute || '').toLowerCase();
  const isCarerRoute = CARER_ROUTES.some(r => route.includes(r));
  // Carers & activities staff: only topicals/creams/patches
  if (userRole === 'carer' || userRole === 'activities') return isCarerRoute;
  // Everyone else (senior_carer, nurse, manager): all routes
  return true;
}

function routeRestrictionLabel(medRoute: string): string {
  const route = (medRoute || '').toLowerCase();
  const isCarerRoute = CARER_ROUTES.some(r => route.includes(r));
  return isCarerRoute ? '' : '🔒 Nurse/Senior only';
}

type ViewMode = 'round' | 'resident' | 'list';

export default function Emar() {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const userRole = user?.role || 'carer';
  const [date, setDate]           = useState(todayISO());
  const [view, setView]           = useState<ViewMode>('round');
  const [activeRound, setRound]   = useState<string>(currentRound());
  const [selectedEntry, setEntry] = useState<any>(null);
  const [showAddMed, setShowAddMed] = useState(false);
  const [residentFilter, setFilter] = useState(searchParams.get('resident_id') || '');

  const { data: emarRaw, isLoading } = useEmar(date);
  const meds: any[]   = emarRaw?.medications ?? [];
  const summary: any  = emarRaw?.summary ?? { totalDoses: 0, given: 0, missed: 0, refused: 0, pending: 0 };
  const { data: rawResidents = [] } = useResidents({ active: true });
  const residents: Resident[] = Array.isArray(rawResidents) ? rawResidents : (rawResidents as any)?.residents ?? [];

  const filtered = residentFilter ? meds.filter(m => m.resident_id === residentFilter) : meds;

  // Meds due in this round
  const normaliseTime = (t: string) => String(t || '').slice(0, 5);
  const roundMeds = filtered.filter(m =>
    (m.administration_times || []).map(normaliseTime).includes(activeRound)
  );

  // Stats per round
  const roundStats = ROUNDS.map(r => {
    const due  = filtered.filter(m => (m.administration_times || []).map(normaliseTime).includes(r.key));
    const admins = due.map(m => m.rounds?.find((rd: any) => rd.time === r.key));
    return {
      ...r,
      total:   due.length,
      given:   admins.filter(a => a?.status === 'given').length,
      missed:  admins.filter(a => a?.status === 'missed' || a?.status === 'refused').length,
      pending: admins.filter(a => !a?.administration || a?.status === 'pending').length,
    };
  });

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">eMAR — Medication Administration</h1>
          <p className="page-subtitle">{formatDate(date)} · {summary.given} given · {summary.missed} missed · {summary.pending} pending</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} style={{ width: 155 }} />
          <select className="form-input" value={residentFilter} onChange={e => setFilter(e.target.value)} style={{ width: 200 }}>
            <option value="">All Residents</option>
            {residents.map((r: Resident) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>)}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddMed(true)}>+ Add Medication</button>
        </div>
      </div>

      {/* ── Summary KPIs ────────────────────────────────────────── */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Doses Today', value: summary.totalDoses, color: '#6366f1', icon: '💊' },
          { label: 'Given',    value: summary.given,    color: '#16a34a', icon: '✅' },
          { label: 'Missed',   value: summary.missed,   color: '#dc2626', icon: '⚠️' },
          { label: 'Pending',  value: summary.pending,  color: '#0d9488', icon: '⏳' },
        ].map(k => (
          <div key={k.label} style={{ padding: '14px 16px', borderRadius: 12, background: 'white', border: '1px solid var(--border)', borderLeft: `4px solid ${k.color}`, boxShadow: '0 2px 6px rgba(0,0,0,.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: k.color, lineHeight: 1 }}>{isLoading ? '—' : k.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{k.label}</div>
              </div>
              <span style={{ fontSize: 22 }}>{k.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── View toggle + Round selector ───────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {(['round', 'resident', 'list'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ padding: '8px 18px', border: 'none', background: view === v ? '#0d9488' : 'white', color: view === v ? 'white' : 'var(--text-secondary)', fontWeight: view === v ? 700 : 400, cursor: 'pointer', fontSize: 13, textTransform: 'capitalize' }}>
              {v === 'round' ? '🔔 Round View' : v === 'resident' ? '👤 By Resident' : '📋 List'}
            </button>
          ))}
        </div>
        {view === 'round' && (
          <div style={{ display: 'flex', gap: 6 }}>
            {roundStats.map(r => (
              <button key={r.key} onClick={() => setRound(r.key)} style={{ padding: '8px 14px', borderRadius: 20, border: `2px solid ${activeRound === r.key ? r.color : 'var(--border)'}`, background: activeRound === r.key ? r.color + '15' : 'white', color: activeRound === r.key ? r.color : 'var(--text-secondary)', fontWeight: activeRound === r.key ? 700 : 400, cursor: 'pointer', fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', transition: 'all 150ms' }}>
                {r.icon} {r.label}
                {r.total > 0 && <span style={{ fontSize: 11, background: r.missed > 0 ? '#fef2f2' : r.pending > 0 ? '#eff6ff' : '#dcfce7', color: r.missed > 0 ? '#dc2626' : r.pending > 0 ? '#0d9488' : '#16a34a', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>
                  {r.given}/{r.total}
                </span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading eMAR…</div>
      ) : (
        <>
          {/* ── ROUND VIEW ────────────────────────────────────── */}
          {view === 'round' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                  {ROUNDS.find(r => r.key === activeRound)?.icon} {ROUNDS.find(r => r.key === activeRound)?.label} Round — {activeRound}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{roundMeds.length} residents with meds this round</div>
              </div>

              {roundMeds.length === 0 ? (
                <div className="card"><div className="card-body table-empty">No medications due in this round</div></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {/* Group by resident */}
                  {(Object.entries(
                    roundMeds.reduce((acc: Record<string, any[]>, med) => {
                      if (!acc[med.resident_id]) acc[med.resident_id] = [];
                      acc[med.resident_id].push(med);
                      return acc;
                    }, {})
                  ) as [string, any[]][]).map(([resId, resMeds]) => {
                    const first = resMeds[0];
                    const roundsForThis = resMeds.map(m => m.rounds?.find((r: any) => r.time === activeRound));
                    const allGiven   = roundsForThis.every(r => r?.status === 'given');
                    const anyMissed  = roundsForThis.some(r => r?.status === 'missed' || r?.status === 'refused');
                    const cardBorder = allGiven ? '#16a34a' : anyMissed ? '#dc2626' : '#0d9488';

                    return (
                      <div key={resId} className="card" style={{ borderTop: `4px solid ${cardBorder}` }}>
                        <div style={{ padding: '12px 14px 0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 15 }}>{first.resident_name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Room {first.room_number}</div>
                            </div>
                            <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: cardBorder + '15', color: cardBorder, fontWeight: 700 }}>
                              {allGiven ? '✓ Complete' : anyMissed ? '⚠ Issues' : '⏳ Pending'}
                            </div>
                          </div>
                        </div>
                        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {resMeds.map((med: any) => {
                            const round = med.rounds?.find((r: any) => r.time === activeRound);
                            const status = round?.status || 'pending';
                            const ss = STATUS_STYLE[status] || STATUS_STYLE.pending;
                            return (
                              <div key={med.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, background: ss.bg, border: `1px solid ${ss.color}30` }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{med.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                    {ROUTE_ICON[med.route?.toLowerCase()] || ''} {med.dose} · {med.route}
                                    {med.special_instructions?.startsWith('Site:') && <span style={{ display: 'block', color: '#7c3aed', fontWeight: 600 }}>📍 {med.special_instructions.split('.')[0]}</span>}
                                  </div>
                                  {round?.administration?.administered_by_name && (
                                    <div style={{ fontSize: 11, color: ss.color, marginTop: 2 }}>
                                      By {round.administration.administered_by_name} at {String(round.administration.actual_time || '').slice(0, 5)}
                                    </div>
                                  )}
                                </div>
                                <div style={{ flexShrink: 0, marginLeft: 8 }}>
                                  {status === 'pending' ? (
                                    canRecord(userRole, med.route) ? (
                                      <button onClick={() => setEntry({ medicationId: med.id, residentId: med.resident_id, residentName: med.resident_name, medName: med.name, dose: med.dose, route: med.route, scheduledTime: activeRound, date })}
                                        style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: '#0d9488', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                        Record
                                      </button>
                                    ) : (
                                      <span style={{ fontSize: 10, color: '#9ca3af', display: 'block', textAlign: 'center', lineHeight: 1.3 }}>🔒 Senior/<br/>Nurse only</span>
                                    )
                                  ) : (
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: 18, color: ss.color }}>{ss.icon}</div>
                                      <div style={{ fontSize: 10, color: ss.color, fontWeight: 700 }}>{ss.label}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── BY RESIDENT VIEW ──────────────────────────────── */}
          {view === 'resident' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(Object.entries(
                filtered.reduce((acc: Record<string, any[]>, med) => {
                  if (!acc[med.resident_id]) acc[med.resident_id] = [];
                  acc[med.resident_id].push(med);
                  return acc;
                }, {})
              ) as [string, any[]][]).map(([resId, resMeds]) => {
                const first = resMeds[0];
                return (
                  <div key={resId} className="card">
                    <div className="card-header">
                      <div>
                        <span className="card-title">{first.resident_name}</span>
                        <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-muted)' }}>Room {first.room_number} · {resMeds.length} active medication{resMeds.length !== 1 ? 's' : ''}</span>
                      </div>
                      <Link to={`/residents/${resId}`} className="btn btn-ghost btn-sm">View Profile →</Link>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface-2)' }}>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Medication</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Dose / Route</th>
                            {ROUNDS.map(r => <th key={r.key} style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: r.color }}>{r.icon} {r.label}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {resMeds.map((med: any) => (
                            <tr key={med.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                                {med.name}
                                {med.is_controlled && <span style={{ marginLeft: 6, fontSize: 10, background: '#fef2f2', color: '#dc2626', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>CD</span>}
                                {med.is_prn && <span style={{ marginLeft: 6, fontSize: 10, background: '#eff6ff', color: '#0d9488', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>PRN</span>}
                                {ROUTE_ICON[med.route?.toLowerCase()] && <span style={{ marginLeft: 5, fontSize: 11 }} title={med.route}>{ROUTE_ICON[med.route?.toLowerCase()]}</span>}
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{med.indication}</div>
                              </td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{med.dose} · {med.route}</td>
                              {ROUNDS.map(r => {
                                const scheduled = (med.administration_times || []).map(normaliseTime).includes(r.key);
                                if (!scheduled) return <td key={r.key} style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>—</td>;
                                const round = med.rounds?.find((rd: any) => normaliseTime(rd.time) === r.key);
                                const status = round?.status || 'pending';
                                const ss = STATUS_STYLE[status] || STATUS_STYLE.pending;
                                return (
                                  <td key={r.key} style={{ padding: '8px 14px', textAlign: 'center' }}>
                                    {status === 'pending' ? (
                                      canRecord(userRole, med.route) ? (
                                        <button onClick={() => setEntry({ medicationId: med.id, residentId: med.resident_id, residentName: med.resident_name, medName: med.name, dose: med.dose, route: med.route, scheduledTime: r.key, date })}
                                          style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#0d9488', color: 'white', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                                          Record
                                        </button>
                                      ) : (
                                        <span style={{ fontSize: 10, color: '#9ca3af' }}>🔒 Nurse only</span>
                                      )
                                    ) : (
                                      <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                                        <span style={{ fontSize: 16, padding: '4px 10px', borderRadius: 6, background: ss.bg, color: ss.color, fontWeight: 700 }}>{ss.icon}</span>
                                        <span style={{ fontSize: 10, color: ss.color }}>{ss.label}</span>
                                        {round?.administration?.actual_time && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{String(round.administration.actual_time).slice(0, 5)}</span>}
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── LIST VIEW ─────────────────────────────────────── */}
          {view === 'list' && (
            <div className="card">
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--surface-2)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Resident</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Medication</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Dose</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>🌅 Morning</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>☀️ Afternoon</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>🌆 Evening</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>🌙 Night</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((med: any) => (
                      <tr key={med.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '9px 14px', fontWeight: 600 }}>{med.resident_name}<div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Rm {med.room_number}</div></td>
                        <td style={{ padding: '9px 14px' }}>{med.name}{med.is_controlled && <span style={{ marginLeft: 5, fontSize: 10, background: '#fef2f2', color: '#dc2626', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>CD</span>}</td>
                        <td style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>{med.dose}</td>
                        {ROUNDS.map(r => {
                          const scheduled = (med.administration_times || []).map(normaliseTime).includes(r.key);
                          if (!scheduled) return <td key={r.key} style={{ padding: '9px 14px', textAlign: 'center', color: 'var(--text-muted)' }}>—</td>;
                          const round = med.rounds?.find((rd: any) => normaliseTime(rd.time) === r.key);
                          const status = round?.status || 'pending';
                          const ss = STATUS_STYLE[status] || STATUS_STYLE.pending;
                          return (
                            <td key={r.key} style={{ padding: '8px 14px', textAlign: 'center' }}>
                              {status === 'pending' ? (
                                canRecord(userRole, med.route) ? (
                                  <button onClick={() => setEntry({ medicationId: med.id, residentId: med.resident_id, residentName: med.resident_name, medName: med.name, dose: med.dose, route: med.route, scheduledTime: r.key, date })}
                                    style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: '#0d9488', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Record</button>
                                ) : (
                                  <span style={{ fontSize: 10, color: '#9ca3af' }}>🔒</span>
                                )
                              ) : (
                                <span style={{ fontSize: 14, padding: '3px 8px', borderRadius: 6, background: ss.bg, color: ss.color, fontWeight: 700 }}>{ss.icon}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {selectedEntry && <AdminModal entry={selectedEntry} onClose={() => setEntry(null)} />}
      {showAddMed && <AddMedModal residents={residents} onClose={() => setShowAddMed(false)} />}
    </div>
  );
}

// ── Record Administration Modal ────────────────────────────────────────────
function AdminModal({ entry, onClose }: { entry: any; onClose: () => void }) {
  const record = useRecordAdministration();
  const [form, setForm] = useState({ status: 'given', actualTime: entry.scheduledTime, doseGiven: entry.dose || '', notes: '', refusalReason: '', omissionReason: '', siteApplied: '' });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const STATUS_OPTIONS = [
    { value: 'given',        label: '✓ Given',        color: '#16a34a' },
    { value: 'refused',      label: '✕ Refused',      color: '#d97706' },
    { value: 'missed',       label: '! Missed',       color: '#dc2626' },
    { value: 'omitted',      label: '○ Omitted',      color: '#6b7280' },
    { value: 'not_required', label: '— Not Required', color: '#9ca3af' },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    record.mutate(
      {
        residentId:         entry.residentId,
        medicationId:       entry.medicationId,
        administrationDate: entry.date,
        scheduledTime:      entry.scheduledTime,
        actualTime:         form.actualTime,
        status:             form.status,
        doseGiven:          form.doseGiven,
        notes:              form.notes,
        refusalReason:      form.refusalReason || null,
        omissionReason:     form.omissionReason || null,
      },
      { onSuccess: onClose }
    );
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Record Administration</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{entry.residentName} · {entry.medName} · {entry.scheduledTime}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Med info strip */}
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ fontWeight: 700 }}>{entry.medName}</span> · <span style={{ color: 'var(--text-muted)' }}>{entry.dose} · {entry.route}</span>
            </div>

            {/* Status */}
            <div>
              <label className="form-label">Administration Status *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {STATUS_OPTIONS.map(s => (
                  <button type="button" key={s.value} onClick={() => set('status', s.value)} style={{ padding: '10px 14px', borderRadius: 8, border: `2px solid ${form.status === s.value ? s.color : 'var(--border)'}`, background: form.status === s.value ? s.color + '15' : 'white', color: form.status === s.value ? s.color : 'var(--text-secondary)', fontWeight: form.status === s.value ? 700 : 400, cursor: 'pointer', fontSize: 13, textAlign: 'left', transition: 'all 120ms' }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actual time + dose */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Actual Time</label>
                <input className="form-input" type="time" value={form.actualTime} onChange={e => set('actualTime', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Dose Given</label>
                <input className="form-input" value={form.doseGiven} onChange={e => set('doseGiven', e.target.value)} placeholder={entry.dose} />
              </div>
            </div>

            {/* Conditional reasons */}
            {form.status === 'refused' && (
              <div className="form-group">
                <label className="form-label" style={{ color: '#d97706' }}>Refusal Reason *</label>
                <input className="form-input" value={form.refusalReason} onChange={e => set('refusalReason', e.target.value)} placeholder="Resident refused — reason…" required />
              </div>
            )}
            {form.status === 'omitted' && (
              <div className="form-group">
                <label className="form-label">Omission Reason *</label>
                <input className="form-input" value={form.omissionReason} onChange={e => set('omissionReason', e.target.value)} placeholder="Omission reason…" required />
              </div>
            )}

            {['topical','cream','ointment','gel','patch','eye_drops','ear_drops'].includes(entry.route?.toLowerCase()) && (
              <div className="form-group">
                <label className="form-label">Area Applied / Site</label>
                <input className="form-input" value={form.siteApplied || entry.site || ''} onChange={e => set('siteApplied', e.target.value)}
                  placeholder={entry.route === 'eye_drops' ? 'e.g. Both eyes' : entry.route === 'patch' ? 'e.g. Left upper arm' : 'e.g. Lower back, affected area'} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Skin condition, tolerance, any reactions observed…" />
            </div>

            {/* Signature notice */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
              ✍ By saving, you confirm you administered this medication and this record is accurate and legally binding.
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={record.isPending}>
              {record.isPending ? 'Saving…' : '✅ Confirm & Sign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Medication Modal ────────────────────────────────────────────────────
function AddMedModal({ residents, onClose }: { residents: Resident[]; onClose: () => void }) {
  const createMed = useCreateMedication();
  const [form, setForm] = useState({
    resident_id: '', name: '', generic_name: '', dose: '', route: 'oral', frequency: 'once_daily',
    times_of_day: ['08:00'], start_date: todayISO(), prescribed_by: '', indication: '', pharmacy: '', notes: '',
    is_controlled: false, is_prn: false, site: '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleTime = (t: string) => setForm(f => ({ ...f, times_of_day: f.times_of_day.includes(t) ? f.times_of_day.filter(x => x !== t) : [...f.times_of_day, t] }));
  const TIMES = [['08:00','🌅 Morning'], ['12:00','☀️ Afternoon'], ['18:00','🌆 Evening'], ['22:00','🌙 Night']];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMed.mutateAsync({
      residentId: form.resident_id, name: form.name, genericName: form.generic_name,
      dose: form.dose, route: form.route, frequency: form.frequency,
      administrationTimes: form.times_of_day, startDate: form.start_date,
      prescribedBy: form.prescribed_by, indication: form.indication,
      applicationSite: form.site || null,
      specialInstructions: (form.site ? `Site: ${form.site}. ` : '') + (form.notes || ''),
      isPrn: form.is_prn, isControlled: form.is_controlled,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header"><h2 className="modal-title">Add Medication</h2><button className="modal-close" onClick={onClose}>×</button></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-group"><label className="form-label">Resident *</label>
              <select className="form-input" required value={form.resident_id} onChange={e => set('resident_id', e.target.value)}>
                <option value="">Select resident…</option>
                {residents.map((r: Resident) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} — Rm {r.room_number}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Medication Name *</label><input className="form-input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Amlodipine" /></div>
              <div className="form-group"><label className="form-label">Generic Name</label><input className="form-input" value={form.generic_name} onChange={e => set('generic_name', e.target.value)} placeholder="e.g. Amlodipine besylate" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Dose *</label><input className="form-input" required value={form.dose} onChange={e => set('dose', e.target.value)} placeholder="e.g. 5mg" /></div>
              <div className="form-group"><label className="form-label">Route *</label>
                <select className="form-input" value={form.route} onChange={e => set('route', e.target.value)}>
                  {ROUTE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Frequency *</label>
                <select className="form-input" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
                  <option value="once_daily">Once Daily</option><option value="twice_daily">Twice Daily</option><option value="three_times_daily">Three Times Daily</option><option value="four_times_daily">Four Times Daily</option><option value="as_required">As Required (PRN)</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Indication</label><input className="form-input" value={form.indication} onChange={e => set('indication', e.target.value)} placeholder="e.g. Hypertension" /></div>
            </div>
            <div className="form-group">
              <label className="form-label">Administration Times</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                {TIMES.map(([t, label]) => (
                  <button type="button" key={t} onClick={() => toggleTime(t)} style={{ padding: '8px 16px', borderRadius: 20, border: `2px solid ${form.times_of_day.includes(t) ? '#0d9488' : 'var(--border)'}`, background: form.times_of_day.includes(t) ? '#eff6ff' : 'white', color: form.times_of_day.includes(t) ? '#0d9488' : 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: form.times_of_day.includes(t) ? 700 : 400, transition: 'all 120ms' }}>
                    {form.times_of_day.includes(t) ? '✓ ' : ''}{label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Prescribed By</label><input className="form-input" value={form.prescribed_by} onChange={e => set('prescribed_by', e.target.value)} placeholder="Dr. Smith" /></div>
            </div>
            {['topical','cream','ointment','gel','patch','eye_drops','ear_drops'].includes(form.route) && (
              <div className="form-group">
                <label className="form-label">Application Site / Location</label>
                <input className="form-input" value={form.site || ''} onChange={e => set('site', e.target.value)}
                  placeholder={form.route === 'eye_drops' ? 'e.g. Both eyes / Left eye / Right eye' : form.route === 'patch' ? 'e.g. Upper arm, rotate sites' : 'e.g. Lower back, right knee, affected area'} />
                <p className="form-hint">Record exactly where to apply — important for care staff.</p>
              </div>
            )}
            <div className="form-group"><label className="form-label">Special Instructions</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder={['topical','cream','patch'].includes(form.route) ? 'e.g. Apply thin layer, avoid broken skin, wear gloves when applying…' : 'Take with food, avoid dairy…'} /></div>
            <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={form.is_controlled} onChange={e => set('is_controlled', e.target.checked)} /> Controlled Drug (CD)</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}><input type="checkbox" checked={form.is_prn} onChange={e => set('is_prn', e.target.checked)} /> As Required (PRN)</label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createMed.isPending}>{createMed.isPending ? 'Adding…' : '+ Add Medication'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function currentRound(): string {
  const h = new Date().getHours();
  if (h < 11) return '08:00';
  if (h < 15) return '12:00';
  if (h < 20) return '18:00';
  return '22:00';
}
