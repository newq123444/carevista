import React, { useState } from 'react';

const POLICIES = [
  { id: '1', title: 'Safeguarding Adults Policy', category: 'Safeguarding', version: '2.4', reviewed: '2025-01-15', status: 'current' },
  { id: '2', title: 'Medication Management Policy', category: 'Clinical', version: '3.1', reviewed: '2024-11-20', status: 'current' },
  { id: '3', title: 'Infection Prevention & Control', category: 'Clinical', version: '2.0', reviewed: '2025-02-01', status: 'current' },
  { id: '4', title: 'Moving & Handling Policy', category: 'Health & Safety', version: '1.8', reviewed: '2024-09-10', status: 'current' },
  { id: '5', title: 'Complaints & Compliments Policy', category: 'Quality', version: '1.5', reviewed: '2024-07-22', status: 'current' },
  { id: '6', title: 'Mental Capacity Act Policy', category: 'Legal & Compliance', version: '2.2', reviewed: '2025-03-01', status: 'current' },
  { id: '7', title: 'GDPR & Data Protection Policy', category: 'Legal & Compliance', version: '1.9', reviewed: '2024-12-05', status: 'current' },
  { id: '8', title: 'Lone Working Policy', category: 'Health & Safety', version: '1.3', reviewed: '2024-06-15', status: 'review_due' },
  { id: '9', title: 'Fire Safety Policy', category: 'Health & Safety', version: '2.6', reviewed: '2025-01-30', status: 'current' },
  { id: '10', title: 'Dignity & Respect Policy', category: 'Quality', version: '1.7', reviewed: '2024-08-14', status: 'review_due' },
];

const CATEGORIES = [...new Set(POLICIES.map(p => p.category))];

export default function Policies() {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const filtered = POLICIES.filter(p =>
    (!search || p.title.toLowerCase().includes(search.toLowerCase())) &&
    (!catFilter || p.category === catFilter)
  );

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">📋 Policies & Procedures</h1><p className="page-subtitle">{filtered.length} documents</p></div>
        <button className="btn btn-primary">+ Upload Policy</button>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input type="text" className="form-input" placeholder="🔍 Search policies…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: '1 1 240px' }} />
          <select className="form-input" value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ flex: '0 1 200px' }}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(p => (
          <div key={p.id} className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px' }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>📄</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 10 }}>
                  <span>{p.category}</span><span>·</span><span>v{p.version}</span><span>·</span><span>Reviewed: {p.reviewed}</span>
                </div>
              </div>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 700, background: p.status === 'current' ? '#f0fdf4' : '#fffbeb', color: p.status === 'current' ? '#16a34a' : '#d97706', border: `1px solid ${p.status === 'current' ? '#86efac' : '#fcd34d'}` }}>{p.status === 'current' ? '✓ Current' : '⚠ Review Due'}</span>
              <button className="btn btn-ghost btn-sm">View →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
