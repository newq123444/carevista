// src/pages/Residents.tsx
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { Link } from 'react-router-dom';
import { useResidents, useResidentAbsences, useStartAbsence, useEndAbsence } from '../hooks';
import { formatDate, formatAge, getRiskColor } from '../utils/formatters';
import type { Resident } from '../types';

export default function Residents() {
  const { t: tr } = useLang();
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const { data: residents = [], isLoading } = useResidents({ active: true });
  const { data: absences = [] } = useResidentAbsences(true);
  const startAbsence = useStartAbsence();
  const endAbsence = useEndAbsence();
  const [awayFor, setAwayFor] = useState<any>(null);
  const [awayForm, setAwayForm] = useState({ absence_type: 'hospital', reason: '', expected_return: '', planned: false });

  // resident_id -> open absence record
  const awayMap = new Map((Array.isArray(absences) ? absences : []).map((a: any) => [a.resident_id, a]));

  const filtered = (residents as Resident[]).filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${r.first_name} ${r.last_name} ${r.room_number} ${r.nhs_number || ''}`.toLowerCase().includes(q);
    const matchRisk = !riskFilter || r.risk_level === riskFilter;
    return matchSearch && matchRisk;
  });

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">{tr('Residents')}</h1><p className="page-subtitle">{filtered.length} residents shown</p></div>
        <Link to="/residents/new" className="btn btn-primary">+ Admit Resident</Link>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" placeholder="🔍 Search name, room, NHS…" value={search} onChange={e => setSearch(e.target.value)} className="form-input" style={{ flex: '1 1 240px' }} />
          <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} className="form-input" style={{ flex: '0 1 160px' }}>
            <option value="">All Risk Levels</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setRiskFilter(''); }}>Clear</button>
        </div>
      </div>
      {isLoading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading residents…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((r: Resident) => {
            const rc = getRiskColor(r.risk_level);
            const rb = r.risk_level === 'high' ? '#fef2f2' : r.risk_level === 'medium' ? '#fffbeb' : '#f0fdf4';
            return (
              <div key={r.id} className="card" style={{ borderLeft: `5px solid ${rc}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', flexWrap: 'wrap' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: rb, border: `2px solid ${rc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: rc, flexShrink: 0 }}>{r.first_name?.[0] ?? '?'}{r.last_name?.[0] ?? ''}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{r.first_name} {r.last_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ background:'#eff6ff', color:'#0f766e', padding:'1px 8px', borderRadius:6, fontWeight:700, fontSize:12 }}>Rm {r.room_number}</span><span>·</span><span>{formatAge(r.date_of_birth)}</span><span>·</span><span>Admitted {formatDate(r.admission_date)}</span>
                      {r.nhs_number && <><span>·</span><span>NHS: {r.nhs_number}</span></>}
                      {r.dnacpr && <><span>·</span><span style={{ color: '#dc2626', fontWeight: 700 }}>🔴 DNACPR</span></>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {awayMap.get(r.id) ? (
                      <>
                        <span title={`${(awayMap.get(r.id) as any).reason || ''}`}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#eef2ff', color: '#4338ca', fontWeight: 700, border: '1px solid #c7d2fe' }}>
                          🏥 {String((awayMap.get(r.id) as any).absence_type).replace(/_/g, ' ')} · {(awayMap.get(r.id) as any).days_away}d
                        </span>
                        <button onClick={e => { e.preventDefault(); endAbsence.mutate({ id: (awayMap.get(r.id) as any).id, data: {} }); }}
                          style={{ fontSize: 11, padding: '4px 11px', borderRadius: 7, border: '1px solid #16a34a', background: '#f0fdf4', color: '#15803d', fontWeight: 700, cursor: 'pointer' }}>
                          Mark returned
                        </button>
                      </>
                    ) : (
                      <button onClick={e => { e.preventDefault(); setAwayFor(r); setAwayForm({ absence_type: 'hospital', reason: '', expected_return: '', planned: false }); }}
                        style={{ fontSize: 11, padding: '4px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2, #f8fafc)', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>
                        Mark away
                      </button>
                    )}
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: rb, color: rc, fontWeight: 700, border: `1px solid ${rc}30` }}>{r.risk_level?.toUpperCase() ?? ''}</span>

                    <Link to={`/residents/${r.id}`} className="btn btn-primary btn-sm">View →</Link>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No residents found</div>}
        </div>
      )}

      {awayFor && (
        <div onClick={e => { if (e.target === e.currentTarget) setAwayFor(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 28 }}>
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: 14, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Record as away</h2>
              <button onClick={() => setAwayFor(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
              {awayFor.first_name} {awayFor.last_name} · Room {awayFor.room_number}
            </div>

            <div style={{ padding: 11, background: '#eef2ff', borderRadius: 8, fontSize: 12, color: '#3730a3', marginBottom: 14 }}>
              Their bed and record are kept. Care tasks and meals pause while they are away, and these days won't count against care-completion.
            </div>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Reason for absence</label>
            <select value={awayForm.absence_type} onChange={e => setAwayForm(f => ({ ...f, absence_type: e.target.value }))}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, marginBottom: 12, background: 'var(--surface)', color: 'var(--text-primary)' }}>
              <option value="hospital">Hospital admission</option>
              <option value="home_leave">Home leave with family</option>
              <option value="respite_elsewhere">Respite elsewhere</option>
              <option value="other">Other</option>
            </select>

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Details (optional)</label>
            <input value={awayForm.reason} onChange={e => setAwayForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Admitted after a fall — suspected fracture"
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, marginBottom: 12 }} />

            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Expected return (optional)</label>
            <input type="date" value={awayForm.expected_return} onChange={e => setAwayForm(f => ({ ...f, expected_return: e.target.value }))}
              style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, marginBottom: 12 }} />

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={awayForm.planned} onChange={e => setAwayForm(f => ({ ...f, planned: e.target.checked }))} />
              This was planned (not an emergency admission)
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => startAbsence.mutate(
                  { resident_id: awayFor.id, absence_type: awayForm.absence_type, reason: awayForm.reason || null,
                    expected_return: awayForm.expected_return || null, planned: awayForm.planned },
                  { onSuccess: () => setAwayFor(null) })}
                disabled={startAbsence.isPending}
                style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                {startAbsence.isPending ? 'Saving…' : 'Record as away'}
              </button>
              <button onClick={() => setAwayFor(null)}
                style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'var(--surface-2, #f3f4f6)', border: '1px solid var(--border)', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
