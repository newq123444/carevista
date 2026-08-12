// src/pages/CDRegister.tsx
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useResidents, useColleagues } from '../hooks';
import { formatDateTime } from '../utils/formatters';
import type { Resident } from '../types';

export default function CDRegister() {
  const { t: tr } = useLang();
  const qc = useQueryClient();
  const { data: rawResidents = [] } = useResidents({ active: true });
  const { data: rawStaff = [] }     = useColleagues();
  const residents: Resident[] = Array.isArray(rawResidents) ? rawResidents : (rawResidents as any)?.residents ?? [];
  const staff: any[] = Array.isArray(rawStaff) ? rawStaff : [];
  const [residentFilter, setFilter] = useState('');
  const [showRecord, setShowRecord] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm] = useState({ residentId:'', medicationName:'', dose:'', quantity:'', administeredBy:'', witnessedBy:'', balance:'', notes:'', administrationTime:new Date().toISOString().slice(0,16) });
  const set = (k:string,v:string) => setForm(f=>({...f,[k]:v}));

  const { data: rawEntries = [], isLoading } = useQuery({
    queryKey: ['cd-register', residentFilter],
    queryFn: () => api.get('/medications/cd-register', { params:{ residentId:residentFilter||undefined } }).then(r=>r.data),
    staleTime: 30_000,
  });
  const entries: any[] = Array.isArray(rawEntries) ? rawEntries : [];

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await api.post('/medications/cd-register', { ...form, quantity:parseFloat(form.quantity), balance:parseFloat(form.balance) });
      qc.invalidateQueries({ queryKey:['cd-register'] });
      setShowRecord(false);
      setForm({ residentId:'', medicationName:'', dose:'', quantity:'', administeredBy:'', witnessedBy:'', balance:'', notes:'', administrationTime:new Date().toISOString().slice(0,16) });
    } catch (err:any) { alert(err?.response?.data?.error||'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">💊 Controlled Drug Register</h1><p className="page-subtitle">All CD administrations require two-person verification</p></div>
        <button className="btn btn-primary" onClick={()=>setShowRecord(true)}>+ Record Administration</button>
      </div>

      <div style={{ padding:'12px 16px', borderRadius:10, background:'#fffbeb', border:'1px solid #fcd34d', marginBottom:16, fontSize:13, color:'#92400e', display:'flex', gap:10 }}>
        <span>⚠️</span>
        <span>Controlled Drug records are a legal requirement. Each entry must be witnessed by a second qualified person. All discrepancies must be reported immediately.</span>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <select className="form-input" value={residentFilter} onChange={e=>setFilter(e.target.value)} style={{ width:240 }}>
          <option value="">All Residents</option>
          {residents.map(r=><option key={r.id} value={r.id}>{r.first_name} {r.last_name} — Room {r.room_number}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-container">
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)', background:'var(--surface-2)' }}>
                <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, whiteSpace:'nowrap' }}>Date & Time</th>
                <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:600 }}>{tr('Resident')}</th>
                <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:600 }}>{tr('Medication')}</th>
                <th style={{ padding:'10px 14px', textAlign:'center', fontWeight:600 }}>{tr('Dose')}</th>
                <th style={{ padding:'10px 14px', textAlign:'center', fontWeight:600 }}>Qty</th>
                <th style={{ padding:'10px 14px', textAlign:'center', fontWeight:600 }}>Balance</th>
                <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:600 }}>Administered By</th>
                <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:600 }}>Witnessed By</th>
                <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:600 }}>{tr('Notes')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading?(<tr><td colSpan={9} style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>{tr('Loading…')}</td></tr>)
               :entries.length===0?(<tr><td colSpan={9} style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>No CD records found</td></tr>)
               :entries.map((e:any)=>(
                <tr key={e.id} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'9px 14px', whiteSpace:'nowrap', fontFamily:'monospace', fontSize:12 }}>{formatDateTime(e.administration_time)}</td>
                  <td style={{ padding:'9px 14px', fontWeight:600 }}>{e.resident_name}<div style={{ fontSize:11, color:'var(--text-muted)' }}>Rm {e.room_number}</div></td>
                  <td style={{ padding:'9px 14px', fontWeight:600 }}>{e.medication_name}</td>
                  <td style={{ padding:'9px 14px', textAlign:'center' }}>{e.dose}</td>
                  <td style={{ padding:'9px 14px', textAlign:'center', fontWeight:700 }}>{e.quantity}</td>
                  <td style={{ padding:'9px 14px', textAlign:'center' }}><span style={{ padding:'2px 8px', borderRadius:6, background:'#f0fdf4', color:'#16a34a', fontWeight:700, fontSize:12 }}>{e.balance}</span></td>
                  <td style={{ padding:'9px 14px' }}><div style={{ fontWeight:600 }}>{e.administered_by_name}</div><div style={{ fontSize:11, color:'var(--text-muted)' }}>{e.administered_by_role?.replace(/_/g,' ')}</div></td>
                  <td style={{ padding:'9px 14px' }}>
                    {e.witnessed_by_name
                      ?<div><div style={{ fontWeight:600 }}>{e.witnessed_by_name}</div><div style={{ fontSize:10, color:'#16a34a', fontWeight:700 }}>✓ Witnessed</div></div>
                      :<span style={{ color:'#dc2626', fontWeight:700, fontSize:11 }}>⚠ NOT WITNESSED</span>}
                  </td>
                  <td style={{ padding:'9px 14px', color:'var(--text-muted)' }}>{e.notes||'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showRecord&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowRecord(false)}>
          <div className="modal modal-lg">
            <div className="modal-header"><h2 className="modal-title">💊 Record CD Administration</h2><button className="modal-close" onClick={()=>setShowRecord(false)}>×</button></div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div style={{ padding:'10px 14px', borderRadius:8, background:'#fef2f2', border:'1px solid #fecaca', marginBottom:14, fontSize:13, color:'#dc2626', fontWeight:600 }}>⚠️ This record is legally binding. Ensure a second qualified witness is present.</div>
                <div className="form-group">
                  <label className="form-label">Resident *</label>
                  <select className="form-input" required value={form.residentId} onChange={e=>set('residentId',e.target.value)}>
                    <option value="">Select…</option>
                    {residents.map(r=><option key={r.id} value={r.id}>{r.first_name} {r.last_name} — Rm {r.room_number}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Medication *</label><input className="form-input" required value={form.medicationName} onChange={e=>set('medicationName',e.target.value)} placeholder="e.g. Morphine Sulphate"/></div>
                  <div className="form-group"><label className="form-label">Dose *</label><input className="form-input" required value={form.dose} onChange={e=>set('dose',e.target.value)} placeholder="e.g. 10mg"/></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Quantity Given *</label><input className="form-input" required type="number" step="0.5" value={form.quantity} onChange={e=>set('quantity',e.target.value)}/></div>
                  <div className="form-group"><label className="form-label">Balance Remaining *</label><input className="form-input" required type="number" step="0.5" value={form.balance} onChange={e=>set('balance',e.target.value)}/></div>
                </div>
                <div className="form-group"><label className="form-label">Date & Time *</label><input className="form-input" required type="datetime-local" value={form.administrationTime} onChange={e=>set('administrationTime',e.target.value)}/></div>
                <div style={{ background:'#f0fdf4', borderRadius:10, padding:14, marginBottom:14 }}>
                  <div style={{ fontWeight:700, fontSize:12, color:'#15803d', marginBottom:10, textTransform:'uppercase' }}>✍ Two-Person Verification</div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Administered By *</label>
                      <select className="form-input" required value={form.administeredBy} onChange={e=>set('administeredBy',e.target.value)}>
                        <option value="">Select…</option>
                        {staff.filter((s:any)=>['registered_nurse','senior_carer','home_manager','deputy_manager'].includes(s.role)).map((s:any)=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">Witnessed By *</label>
                      <select className="form-input" required value={form.witnessedBy} onChange={e=>set('witnessedBy',e.target.value)}>
                        <option value="">Select witness…</option>
                        {staff.filter((s:any)=>s.id!==form.administeredBy).map((s:any)=><option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="form-group"><label className="form-label">{tr('Notes')}</label><textarea className="form-input" rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Resident response, any concerns…"/></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={()=>setShowRecord(false)}>{tr('Cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving?'Saving…':'✅ Confirm & Sign'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
