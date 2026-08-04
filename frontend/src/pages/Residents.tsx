// src/pages/Residents.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useResidents } from '../hooks';
import { formatDate, formatAge, getRiskColor } from '../utils/formatters';
import type { Resident } from '../types';

export default function Residents() {
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const { data: residents = [], isLoading } = useResidents({ active: true });

  const filtered = (residents as Resident[]).filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || `${r.first_name} ${r.last_name} ${r.room_number} ${r.nhs_number || ''}`.toLowerCase().includes(q);
    const matchRisk = !riskFilter || r.risk_level === riskFilter;
    return matchSearch && matchRisk;
  });

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Residents</h1><p className="page-subtitle">{filtered.length} residents shown</p></div>
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
    </div>
  );
}
