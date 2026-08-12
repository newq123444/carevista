// src/pages/InfectionTracker.tsx — Infection Outbreak Tracker
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useResidents, useOutbreaks, useOutbreakDetails, useCreateOutbreak, useAddInfectionCase, useUpdateInfectionCase, useUpdateOutbreakStatus } from '../hooks';
import type { Resident, InfectionOutbreak, InfectionCase } from '../types';

const OUTBREAK_TYPES = ['D&V/Norovirus', 'COVID-19', 'Influenza', 'MRSA', 'C.difficile', 'Scabies', 'Other'];
const STATUS_COLORS: Record<string, string> = { active: '#dc2626', contained: '#f59e0b', resolved: '#10b981' };
const CASE_STATUS_COLORS: Record<string, string> = { active: '#dc2626', recovering: '#f59e0b', resolved: '#10b981', deceased: '#374151' };
const TYPE_ICONS: Record<string, string> = {
  'D&V/Norovirus': '🤮', 'COVID-19': '🦠', 'Influenza': '🤒', 'MRSA': '🧫',
  'C.difficile': '💊', 'Scabies': '🐛', 'Other': '⚠️',
};

export default function InfectionTracker() {
  const { t: tr } = useLang();
  const { data: residents = [] } = useResidents();
  const { data: outbreaks } = useOutbreaks();
  const createMutation = useCreateOutbreak();
  const addCaseMutation = useAddInfectionCase();
  const updateCaseMutation = useUpdateInfectionCase();
  const updateStatusMutation = useUpdateOutbreakStatus();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOutbreakId, setSelectedOutbreakId] = useState('');
  const { data: outbreakDetail } = useOutbreakDetails(selectedOutbreakId);

  // Create outbreak form state
  const [outbreakType, setOutbreakType] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [isolationProtocol, setIsolationProtocol] = useState('');
  const [createNotes, setCreateNotes] = useState('');

  // Add case form state
  const [showAddCase, setShowAddCase] = useState(false);
  const [caseResident, setCaseResident] = useState('');
  const [caseSymptoms, setCaseSymptoms] = useState('');
  const [caseOnsetDate, setCaseOnsetDate] = useState(new Date().toISOString().split('T')[0]);

  const outbreaksList: InfectionOutbreak[] = Array.isArray(outbreaks) ? outbreaks : [];
  const activeOutbreaks = outbreaksList.filter(o => o.status === 'active');
  const resolvedThisMonth = outbreaksList.filter(o => {
    if (o.status !== 'resolved') return false;
    const d = new Date(o.updated_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const totalAffected = activeOutbreaks.reduce((sum, o) => sum + (o.affected_count || 0), 0);

  const detail: any = outbreakDetail || null;
  const detailCases: InfectionCase[] = Array.isArray(detail?.cases) ? detail.cases : [];
  const detailTimeline: any[] = Array.isArray(detail?.timeline) ? detail.timeline : [];

  const handleCreateOutbreak = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outbreakType) return;
    createMutation.mutate({
      outbreak_type: outbreakType,
      start_date: startDate,
      isolation_protocol: isolationProtocol || undefined,
      notes: createNotes || undefined,
    }, {
      onSuccess: () => {
        setShowCreateForm(false);
        setOutbreakType(''); setIsolationProtocol(''); setCreateNotes('');
      }
    });
  };

  const handleAddCase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseResident || !selectedOutbreakId) return;
    addCaseMutation.mutate({
      outbreakId: selectedOutbreakId,
      data: {
        resident_id: caseResident,
        symptoms: caseSymptoms || undefined,
        onset_date: caseOnsetDate,
      }
    }, {
      onSuccess: () => {
        setShowAddCase(false);
        setCaseResident(''); setCaseSymptoms(''); setCaseOnsetDate(new Date().toISOString().split('T')[0]);
      }
    });
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 8 }}>Infection Control</h1>
      <p style={{ color: '#6b7280', marginBottom: 24 }}>Outbreak tracking, isolation protocols, and case management</p>

      {/* Dashboard Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fef2f2', borderRadius: 12, padding: 20, border: '1px solid #fecaca' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#dc2626' }}>{activeOutbreaks.length}</div>
          <div style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: 500 }}>Active Outbreaks</div>
        </div>
        <div style={{ background: '#fef3c7', borderRadius: 12, padding: 20, border: '1px solid #fde68a' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#d97706' }}>{totalAffected}</div>
          <div style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 500 }}>Total Affected Residents</div>
        </div>
        <div style={{ background: '#d1fae5', borderRadius: 12, padding: 20, border: '1px solid #a7f3d0' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>{resolvedThisMonth.length}</div>
          <div style={{ fontSize: '0.85rem', color: '#065f46', fontWeight: 500 }}>Resolved This Month</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          {selectedOutbreakId ? 'Outbreak Details' : 'Outbreaks'}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {selectedOutbreakId && (
            <button onClick={() => setSelectedOutbreakId('')} style={{ padding: '8px 16px', borderRadius: 8, background: '#f3f4f6', border: '1px solid #d1d5db', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}>
              Back to List
            </button>
          )}
          <button onClick={() => setShowCreateForm(true)} style={{ padding: '8px 16px', borderRadius: 8, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
            + Report Outbreak
          </button>
        </div>
      </div>

      {/* Create Outbreak Form */}
      {showCreateForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,.08)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Report New Outbreak</h3>
          <form onSubmit={handleCreateOutbreak}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Outbreak Type *</label>
                <select value={outbreakType} onChange={e => setOutbreakType(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db' }}>
                  <option value="">-- Select --</option>
                  {OUTBREAK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Start Date *</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db' }} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>Isolation Protocol</label>
              <textarea value={isolationProtocol} onChange={e => setIsolationProtocol(e.target.value)} rows={3} placeholder="Describe isolation measures..." style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db', resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontWeight: 500, display: 'block', marginBottom: 4, fontSize: '0.85rem' }}>{tr('Notes')}</label>
              <textarea value={createNotes} onChange={e => setCreateNotes(e.target.value)} rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db', resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={createMutation.isPending} style={{ padding: '10px 20px', borderRadius: 8, background: '#dc2626', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                {createMutation.isPending ? 'Reporting...' : 'Report Outbreak'}
              </button>
              <button type="button" onClick={() => setShowCreateForm(false)} style={{ padding: '10px 20px', borderRadius: 8, background: '#f3f4f6', border: '1px solid #d1d5db', cursor: 'pointer' }}>{tr('Cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {/* Outbreak List */}
      {!selectedOutbreakId && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {outbreaksList.length === 0 && <p style={{ color: '#9ca3af' }}>No outbreaks recorded.</p>}
          {outbreaksList.map((outbreak: InfectionOutbreak) => (
            <div
              key={outbreak.id}
              onClick={() => setSelectedOutbreakId(outbreak.id)}
              style={{ background: '#fff', borderRadius: 12, padding: 20, border: `1px solid ${STATUS_COLORS[outbreak.status] || '#e5e7eb'}40`, cursor: 'pointer', transition: 'box-shadow 150ms', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.5rem' }}>{TYPE_ICONS[outbreak.outbreak_type] || '⚠️'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{outbreak.outbreak_type}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>Started: {new Date(outbreak.start_date).toLocaleDateString()}</div>
                  </div>
                </div>
                <span style={{ padding: '4px 10px', borderRadius: 12, background: (STATUS_COLORS[outbreak.status] || '#6b7280') + '20', color: STATUS_COLORS[outbreak.status] || '#6b7280', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  {outbreak.status}
                </span>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: '0.85rem', color: '#4b5563' }}>
                <div><strong>{outbreak.affected_count || 0}</strong> affected</div>
                {outbreak.case_count != null && <div><strong>{outbreak.case_count}</strong> cases</div>}
              </div>
              {outbreak.isolation_protocol && (
                <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#6b7280', padding: '6px 10px', background: '#f3f4f6', borderRadius: 6 }}>
                  Protocol: {outbreak.isolation_protocol.substring(0, 80)}{outbreak.isolation_protocol.length > 80 ? '...' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Outbreak Detail View */}
      {selectedOutbreakId && detail && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '2rem' }}>{TYPE_ICONS[detail.outbreak_type] || '⚠️'}</span>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{detail.outbreak_type}</h3>
                <span style={{ padding: '4px 12px', borderRadius: 12, background: (STATUS_COLORS[detail.status] || '#6b7280') + '20', color: STATUS_COLORS[detail.status] || '#6b7280', fontWeight: 700, fontSize: '0.8rem' }}>{detail.status}</span>
              </div>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 4 }}>Started: {new Date(detail.start_date).toLocaleDateString()}</p>
              {detail.isolation_protocol && <p style={{ fontSize: '0.85rem', marginTop: 6 }}><strong>Protocol:</strong> {detail.isolation_protocol}</p>}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {detail.status === 'active' && (
                <button onClick={() => updateStatusMutation.mutate({ id: selectedOutbreakId, data: { status: 'contained' } })} style={{ padding: '8px 14px', borderRadius: 8, background: '#f59e0b', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                  Mark Contained
                </button>
              )}
              {(detail.status === 'active' || detail.status === 'contained') && (
                <button onClick={() => updateStatusMutation.mutate({ id: selectedOutbreakId, data: { status: 'resolved' } })} style={{ padding: '8px 14px', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                  Resolve Outbreak
                </button>
              )}
              <button onClick={() => setShowAddCase(true)} style={{ padding: '8px 14px', borderRadius: 8, background: '#0d9488', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>
                + Add Case
              </button>
            </div>
          </div>

          {/* Add Case Form */}
          {showAddCase && (
            <div style={{ background: '#f9fafb', borderRadius: 10, padding: 16, border: '1px solid #e5e7eb', marginBottom: 20 }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: 12 }}>Add Affected Resident</h4>
              <form onSubmit={handleAddCase} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>Resident *</label>
                  <select value={caseResident} onChange={e => setCaseResident(e.target.value)} required style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }}>
                    <option value="">-- Select --</option>
                    {(residents as Resident[]).map(r => <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>Onset Date</label>
                  <input type="date" value={caseOnsetDate} onChange={e => setCaseOnsetDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, display: 'block', marginBottom: 4 }}>{tr('Symptoms')}</label>
                  <input type="text" value={caseSymptoms} onChange={e => setCaseSymptoms(e.target.value)} placeholder="e.g. Nausea, vomiting" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db' }} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
                  <button type="submit" disabled={addCaseMutation.isPending} style={{ padding: '8px 16px', borderRadius: 6, background: '#0d9488', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>Add Case</button>
                  <button type="button" onClick={() => setShowAddCase(false)} style={{ padding: '8px 16px', borderRadius: 6, background: '#f3f4f6', border: '1px solid #d1d5db', cursor: 'pointer', fontSize: '0.85rem' }}>{tr('Cancel')}</button>
                </div>
              </form>
            </div>
          )}

          {/* Cases List */}
          <div style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Affected Residents ({detailCases.length})</h4>
            {detailCases.length === 0 && <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>No cases recorded yet.</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {detailCases.map((c: InfectionCase) => (
                <div key={c.id} style={{ padding: 14, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{c.resident_name || 'Resident'}</span>
                      {c.room_number && <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: 6 }}>Room {c.room_number}</span>}
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 12, background: (CASE_STATUS_COLORS[c.status] || '#6b7280') + '20', color: CASE_STATUS_COLORS[c.status] || '#6b7280', fontSize: '0.7rem', fontWeight: 600 }}>{c.status}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 6 }}>
                    <div>Onset: {new Date(c.onset_date).toLocaleDateString()}</div>
                    {c.symptoms && <div>Symptoms: {c.symptoms}</div>}
                  </div>
                  {c.status === 'active' && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                      <button onClick={() => updateCaseMutation.mutate({ id: c.id, data: { status: 'recovering' } })} style={{ padding: '3px 8px', borderRadius: 4, background: '#f59e0b20', color: '#d97706', border: '1px solid #f59e0b40', cursor: 'pointer', fontSize: '0.75rem' }}>Recovering</button>
                      <button onClick={() => updateCaseMutation.mutate({ id: c.id, data: { status: 'resolved' } })} style={{ padding: '3px 8px', borderRadius: 4, background: '#10b98120', color: '#059669', border: '1px solid #10b98140', cursor: 'pointer', fontSize: '0.75rem' }}>Resolved</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          {detailTimeline.length > 0 && (
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Outbreak Timeline</h4>
              <div style={{ borderLeft: '3px solid #e5e7eb', paddingLeft: 20, marginLeft: 8 }}>
                {detailTimeline.map((event: any, idx: number) => (
                  <div key={idx} style={{ marginBottom: 16, position: 'relative' }}>
                    <div style={{ position: 'absolute', left: -28, top: 4, width: 12, height: 12, borderRadius: '50%', background: '#0d9488', border: '2px solid #fff' }} />
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{new Date(event.event_date || event.created_at).toLocaleString()}</div>
                    <div style={{ fontWeight: 500, fontSize: '0.9rem', marginTop: 2 }}>{event.event_type || event.description || 'Event'}</div>
                    {event.details && <div style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: 2 }}>{event.details}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
