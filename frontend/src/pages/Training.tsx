import React, { useState } from 'react';
import { useTraining, useStaff, useAddTraining } from '../hooks';
import { formatDate } from '../utils/formatters';

const COURSES = ['Manual Handling','Fire Safety','Infection Control','Safeguarding Adults','Dementia Care','First Aid','Medication Administration','COSHH','Food Hygiene','Mental Capacity Act'];

export default function Training() {
  const { data: training = [], isLoading } = useTraining();
  const { data: staff = [] } = useStaff();
  const addTraining = useAddTraining();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all'|'expiring'|'expired'>('all');
  const [form, setForm] = useState({ staffId: '', courseName: '', completedDate: new Date().toISOString().slice(0,10), expiryDate: '', provider: '' });

  const records = (training as any[]).filter(t => {
    if (filter === 'expiring') return t.status === 'expiring';
    if (filter === 'expired') return t.status === 'expired';
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addTraining.mutateAsync(form);
    setShowForm(false);
    setForm({ staffId: '', courseName: '', completedDate: new Date().toISOString().slice(0,10), expiryDate: '', provider: '' });
  };

  const statusColors: Record<string, string> = { current: '#16a34a', expiring: '#d97706', expired: '#dc2626' };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">🎓 Training Records</h1><p className="page-subtitle">{records.length} records</p></div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add Training</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20, border: '2px solid #0d9488' }}>
          <div className="card-header"><span className="card-title">Add Training Record</span><button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button></div>
          <div className="card-body">
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><label className="form-label">Staff Member *</label>
                <select className="form-input" required value={form.staffId} onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))}>
                  <option value="">Select staff…</option>
                  {(staff as any[]).map(s => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                </select></div>
              <div><label className="form-label">Course *</label>
                <select className="form-input" required value={form.courseName} onChange={e => setForm(f => ({ ...f, courseName: e.target.value }))}>
                  <option value="">Select course…</option>
                  {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><label className="form-label">Completed Date *</label>
                <input type="date" className="form-input" required value={form.completedDate} onChange={e => setForm(f => ({ ...f, completedDate: e.target.value }))} /></div>
              <div><label className="form-label">Expiry Date</label>
                <input type="date" className="form-input" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} /></div>
              <div><label className="form-label">Provider</label>
                <input type="text" className="form-input" placeholder="e.g. Skills for Care, In-house…" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} /></div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={addTraining.isPending} style={{ width: '100%' }}>{addTraining.isPending ? '⏳ Saving…' : '✅ Save Training Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'expiring', 'expired'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} style={{ textTransform: 'capitalize' }}>{f}</button>
        ))}
      </div>

      {isLoading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div> : (
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['Staff Member','Course','Completed','Expires','Status','Provider'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', borderBottom: '2px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((t: any) => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 14 }}>{t.staff_name || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 14 }}>{t.course_name}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{formatDate(t.completed_date)}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{formatDate(t.expiry_date) || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: (statusColors[t.status] || '#6b7280') + '15', color: statusColors[t.status] || '#6b7280', fontWeight: 700 }}>{t.status}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{t.provider || '—'}</td>
                </tr>
              ))}
              {records.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No training records found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
