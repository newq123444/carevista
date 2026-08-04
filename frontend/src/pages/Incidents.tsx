import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useIncidents, useCreateIncident, useResidents } from '../hooks';
import { formatDateTime, getSeverityColor } from '../utils/formatters';
import type { Incident, Resident } from '../types';

const INCIDENT_TYPES = ['fall','medication_error','aggression','safeguarding','medical_emergency','pressure_sore','property_damage','other'];
const SEVERITIES = ['low','medium','high','critical'];

export default function Incidents() {
  const [searchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(searchParams.get('action') === 'new');
  const [statusFilter, setStatusFilter] = useState('');
  const { data: incidents = [], isLoading } = useIncidents({ status: statusFilter || undefined });
  const { data: residents = [] } = useResidents({ active: true });
  const createIncident = useCreateIncident();
  const [form, setForm] = useState({ residentId: '', incidentType: 'fall', severity: 'medium', description: '', immediate_action: '', location: '', incidentDate: new Date().toISOString().slice(0,16), notified_family: false, notified_gp: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createIncident.mutateAsync(form);
    setShowCreate(false);
    setForm({ residentId: '', incidentType: 'fall', severity: 'medium', description: '', immediate_action: '', location: '', incidentDate: new Date().toISOString().slice(0,16), notified_family: false, notified_gp: false });
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Incidents</h1><p className="page-subtitle">{(incidents as Incident[]).length} incidents</p></div>
        <button className="btn btn-danger" onClick={() => setShowCreate(true)}>🚨 Report Incident</button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 20, border: '2px solid #dc2626' }}>
          <div className="card-header" style={{ background: '#fef2f2' }}>
            <span className="card-title" style={{ color: '#dc2626' }}>🚨 Report New Incident</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>✕ Cancel</button>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div><label className="form-label">Resident (if applicable)</label>
                <select className="form-input" value={form.residentId} onChange={e => setForm(f => ({ ...f, residentId: e.target.value }))}>
                  <option value="">Not resident-specific</option>
                  {(residents as Resident[]).map(r => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} — Room {r.room_number}</option>)}
                </select></div>
              <div><label className="form-label">Incident Type</label>
                <select className="form-input" value={form.incidentType} onChange={e => setForm(f => ({ ...f, incidentType: e.target.value }))}>
                  {INCIDENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                </select></div>
              <div><label className="form-label">Severity</label>
                <select className="form-input" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div><label className="form-label">Date & Time</label>
                <input type="datetime-local" className="form-input" value={form.incidentDate} onChange={e => setForm(f => ({ ...f, incidentDate: e.target.value }))} /></div>
              <div><label className="form-label">Location</label>
                <input type="text" className="form-input" placeholder="e.g. Room 12, Dining Room…" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
              <div></div>
              <div style={{ gridColumn: '1 / -1' }}><label className="form-label">Description *</label>
                <textarea className="form-input" rows={4} required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe what happened…" style={{ resize: 'vertical' }} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label className="form-label">Immediate Action Taken</label>
                <textarea className="form-input" rows={3} value={form.immediate_action} onChange={e => setForm(f => ({ ...f, immediate_action: e.target.value }))} placeholder="What steps were taken immediately…" style={{ resize: 'vertical' }} /></div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={form.notified_family} onChange={e => setForm(f => ({ ...f, notified_family: e.target.checked }))} /><span style={{ fontSize: 14, fontWeight: 600 }}>Family notified</span></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={form.notified_gp} onChange={e => setForm(f => ({ ...f, notified_gp: e.target.checked }))} /><span style={{ fontSize: 14, fontWeight: 600 }}>GP notified</span></label>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="btn btn-danger" disabled={createIncident.isPending} style={{ width: '100%', padding: 14, fontSize: 15 }}>{createIncident.isPending ? '⏳ Saving…' : '🚨 Submit Incident Report'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12 }}>
          <select className="form-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ flex: '1 1 180px' }}>
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {isLoading ? <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(incidents as Incident[]).map(inc => {
            const sc = getSeverityColor(inc.severity);
            return (
              <div key={inc.id} className="card" style={{ borderLeft: `4px solid ${sc}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '14px 18px', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{inc.resident_name || 'Non-resident incident'}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: sc + '15', color: sc, fontWeight: 700, border: `1px solid ${sc}30`, textTransform: 'uppercase' }}>{inc.severity}</span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{inc.status}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{inc.incident_type?.replace(/_/g,' ') ?? ''} · {formatDateTime(inc.incident_date)}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{inc.description?.slice(0, 200)}{inc.description?.length > 200 ? '…' : ''}</div>
                  </div>
                </div>
              </div>
            );
          })}
          {(incidents as Incident[]).length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>✅ No incidents found</div>}
        </div>
      )}
    </div>
  );
}
