// src/pages/Staff.tsx — Staff directory with photos, edit, add
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useStaff, useAddStaff, useDeactivateStaff, useReactivateStaff, useImportStaff } from '../hooks';
import WorkingModal, { Modal, ROLES, LEAVING } from './StaffAdmin';
import { PrintHeader, PrintButton } from '../components/PrintHeader';
import { exportCsv } from '../utils/exportCsv';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate, ROLE_LABELS } from '../utils/formatters';
import { api } from '../services/api';

const ROLE_COLORS: Record<string, string> = {
  home_manager: '#7c3aed', deputy_manager: '#0d9488', registered_nurse: '#0891b2',
  senior_carer: '#059669', carer: '#d97706', activities: '#ec4899',
  finance: '#dc2626', admin: '#6366f1',
};

const BACKEND = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
function photoSrc(url?: string | null) {
  if (!url) return '';
  return url.startsWith('http') ? url : BACKEND + url;
}

// ── Staff Avatar with upload ──────────────────────────────────────────────
function StaffAvatar({ staff: s, size = 52, editable = false, onUploaded }: {
  staff: any; size?: number; editable?: boolean; onUploaded?: () => void;
}) {
  const { t: tr } = useLang();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const rc = ROLE_COLORS[s.role] || '#6b7280';

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await api.post('/staff/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries({ queryKey: ['staff'] });
      onUploaded?.();
    } catch { alert('Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block', flexShrink: 0 }}>
      {s.avatar_url ? (
        <img src={photoSrc(s.avatar_url)} alt={s.first_name}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${rc}40` }} />
      ) : (
        <div style={{ width: size, height: size, borderRadius: '50%', background: rc + '20', border: `2px solid ${rc}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.32, fontWeight: 800, color: rc }}>
          {s.first_name?.[0]}{s.last_name?.[0]}
        </div>
      )}
      {editable && (
        <>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: '#0d9488', border: '2px solid white', color: 'white', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {uploading ? '⏳' : '📷'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = ''; }} />
        </>
      )}
    </div>
  );
}

// ── Edit Staff Modal ──────────────────────────────────────────────────────
function EditStaffModal({ staff: s, onClose }: { staff: any; onClose: () => void }) {
  const { t: tr } = useLang();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    jobTitle:     s.job_title    || '',
    phone:        s.phone        || '',
    contractHours: s.contract_hours || '',
    hourlyRate:   s.hourly_rate  || '',
    dbsNumber:    s.dbs_number   || '',
    dbsExpires:   s.dbs_expires?.slice(0, 10) || '',
    startDate:    s.start_date?.slice(0, 10)  || '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/staff/${s.id}`, {
        jobTitle:      form.jobTitle,
        contractHours: form.contractHours ? parseFloat(form.contractHours) : null,
        hourlyRate:    form.hourlyRate    ? parseFloat(form.hourlyRate)    : null,
        dbsNumber:     form.dbsNumber    || null,
        dbsExpires:    form.dbsExpires   || null,
      });
      qc.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); }
  };

  const rc = ROLE_COLORS[s.role] || '#6b7280';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header" style={{ background: rc + '10', borderBottom: `2px solid ${rc}30` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StaffAvatar staff={s} size={44} editable onUploaded={() => {}} />
            <div>
              <h2 className="modal-title">{s.first_name} {s.last_name}</h2>
              <div style={{ fontSize: 12, color: rc, fontWeight: 600 }}>{ROLE_LABELS[s.role] || s.role}</div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Read-only info */}
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2)', marginBottom: 14, fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <span>📧 {s.email}</span>
                <span>🆔 {s.employee_number}</span>
                {s.start_date && <span>📅 Started {formatDate(s.start_date)}</span>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Job Title</label>
              <input className="form-input" value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} placeholder="e.g. Senior Care Assistant" />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Contract Hours / Week</label>
                <input className="form-input" type="number" step="0.5" value={form.contractHours} onChange={e => set('contractHours', e.target.value)} placeholder="e.g. 37.5" />
              </div>
              <div className="form-group">
                <label className="form-label">Hourly Rate (£)</label>
                <input className="form-input" type="number" step="0.01" value={form.hourlyRate} onChange={e => set('hourlyRate', e.target.value)} placeholder="e.g. 12.50" />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0 14px', paddingTop: 14, fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>🪪 DBS Check</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">DBS Certificate Number</label>
                <input className="form-input" value={form.dbsNumber} onChange={e => set('dbsNumber', e.target.value)} placeholder="e.g. DBS001234" />
              </div>
              <div className="form-group">
                <label className="form-label">DBS Expiry Date</label>
                <input className="form-input" type="date" value={form.dbsExpires} onChange={e => set('dbsExpires', e.target.value)} />
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0 14px', paddingTop: 14, fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>📷 Profile Photo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <StaffAvatar staff={s} size={64} editable onUploaded={() => qc.invalidateQueries({ queryKey: ['staff'] })} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Click the camera icon to upload a profile photo.<br />
                On mobile, this opens your front camera directly.
              </div>
            </div>

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{tr('Cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '⏳ Saving…' : '✅ Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Staff Page ───────────────────────────────────────────────────────
export default function Staff() {
  const { t: tr } = useLang();
  const { data: rawStaff = [], isLoading } = useStaff();
  const staff: any[] = Array.isArray(rawStaff) ? rawStaff : (rawStaff as any)?.staff ?? [];
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editing, setEditing]     = useState<any>(null);
  const [adding, setAdding]       = useState(false);
  const [leaver, setLeaver]       = useState<any>(null);
  const [working, setWorking]     = useState<any>(null);
  const [importOpen, setImport]   = useState(false);
  const [showLeavers, setShowLeavers] = useState(false);
  const [newStaff, setNewStaff]   = useState<any>({ firstName:'', lastName:'', email:'', role:'carer', jobTitle:'', phone:'', contractHours:'', startDate:'' });
  const [leaveForm, setLeaveForm] = useState<any>({ leavingReason:'resigned', leavingDate:'', notes:'' });
  const [file, setFile]           = useState<File | null>(null);
  const [preview, setPreview]     = useState<any>(null);
  const [handover, setHandover]   = useState<any>(null);
  const addStaff    = useAddStaff();
  const deactivate  = useDeactivateStaff();
  const reactivate  = useReactivateStaff();
  const importStaff = useImportStaff();

  const filtered = staff.filter(s => {
    // A leaver keeps their record and their care notes, but is out of the way
    // unless the manager asks to see them.
    const hasLeft = s.active === false || !!s.end_date;
    if (hasLeft !== showLeavers) return false;
    if (roleFilter && s.role !== roleFilter) return false;
    if (search && !`${s.first_name} ${s.last_name} ${s.job_title} ${s.email}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const roles = [...new Set(staff.map((s: any) => s.role))].sort();

  const dbsAlerts = staff.filter((s: any) => {
    const exp = s.dbs_expires ? new Date(s.dbs_expires) : null;
    return exp && exp < new Date(Date.now() + 30 * 86400000);
  });

  return (
    <div>
      <PrintHeader title="Staff directory" />
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">👤 Staff Directory</h1>
          <p className="page-subtitle">
            {staff.filter((x: any) => x.active !== false && !x.end_date).length} current ·{' '}
            {staff.filter((x: any) => x.active === false || x.end_date).length} left · {filtered.length} shown
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PrintButton />
          <button className="btn btn-secondary btn-sm no-print" onClick={() => exportCsv('staff', filtered, [
            { header: 'First name', value: (r: any) => r.first_name },
            { header: 'Last name', value: (r: any) => r.last_name },
            { header: 'Email', value: (r: any) => r.email },
            { header: 'Role', value: (r: any) => r.role },
            { header: 'Job title', value: (r: any) => r.job_title },
            { header: 'Contract hours', value: (r: any) => r.contract_hours },
            { header: 'Start date', value: (r: any) => r.start_date },
            { header: 'DBS expires', value: (r: any) => r.dbs_expires },
          ])}>⬇ Export</button>
          <button className="btn btn-secondary btn-sm no-print" onClick={() => setImport(true)}>⬆ Import from Excel</button>
          <button className="btn btn-primary no-print" onClick={() => setAdding(true)}>+ Add staff</button>
        </div>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {[[false, 'Current staff'], [true, 'Left']].map(([v, label]: any) => (
          <button key={String(v)} onClick={() => setShowLeavers(v)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: showLeavers === v ? '3px solid #4f46e5' : '3px solid transparent',
            color: showLeavers === v ? '#4f46e5' : 'var(--text-secondary)', fontWeight: showLeavers === v ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {/* DBS alert banner */}
      {dbsAlerts.length > 0 && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fcd34d', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span>⚠️</span>
          <span style={{ color: '#d97706', fontWeight: 600 }}>
            {dbsAlerts.length} staff member{dbsAlerts.length !== 1 ? 's' : ''} with DBS expiring within 30 days:&nbsp;
            {dbsAlerts.map((s: any) => `${s.first_name} ${s.last_name}`).join(', ')}
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" className="form-input" placeholder="🔍 Search name, email, job title…"
            value={search} onChange={e => setSearch(e.target.value)} style={{ flex: '1 1 220px', maxWidth: 320 }} />
          <select className="form-input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ flex: '1 1 180px', maxWidth: 240 }}>
            <option value="">All Roles</option>
            {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setRoleFilter(''); }}>Clear</button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>{tr('Loading…')}</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {filtered.map((s: any) => {
            const rc = ROLE_COLORS[s.role] || '#6b7280';
            const dbsExp = s.dbs_expires ? new Date(s.dbs_expires) : null;
            const dbsExpiring = dbsExp && dbsExp < new Date(Date.now() + 30 * 86400000);
            const dbsMissed   = !s.dbs_expires;
            return (
              <div key={s.id} className="card" style={{ borderTop: `3px solid ${rc}` }}>
                <div style={{ padding: '16px 18px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <StaffAvatar staff={s} size={52} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{s.first_name} {s.last_name}</div>
                      <div style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: rc + '15', color: rc, display: 'inline-block', fontWeight: 600, marginTop: 2 }}>
                        {ROLE_LABELS[s.role] || s.role}
                      </div>
                    </div>
                    <div className="no-print" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(s.active === false || s.end_date) ? (
                      <button onClick={() => reactivate.mutate(s.id)}
                        style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #16a34a', background: '#f0fdf4', color: '#15803d', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                        Reinstate
                      </button>
                    ) : (
                      <>
                        <button onClick={() => setWorking(s)}
                          style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12 }}>
                          🗓 Availability
                        </button>
                        <button onClick={() => { setLeaver(s); setLeaveForm({ leavingReason: 'resigned', leavingDate: '', notes: '' }); }}
                          style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', cursor: 'pointer', fontSize: 12 }}>
                          Left
                        </button>
                      </>
                    )}
                    <button onClick={() => setEditing(s)}
                      style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      ✏️ Edit
                    </button>
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[
                      ['📋', s.job_title || '—'],
                      ['📧', s.email],
                      ['📞', s.phone || '—'],
                      ['🆔', `Emp: ${s.employee_number || '—'}`],
                      ['⏰', `${s.contract_hours || '—'} hrs/wk`],
                      ['📅', `DBS: ${formatDate(s.dbs_expires)}`],
                    ].map(([icon, val]) => (
                      <div key={String(val)} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                        <span style={{ flexShrink: 0 }}>{icon}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{val}</span>
                      </div>
                    ))}
                  </div>

                  {/* DBS alerts */}
                  {dbsExpiring && (
                    <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fcd34d', fontSize: 12, color: '#d97706', fontWeight: 600 }}>
                      ⚠️ DBS expiring {dbsExp!.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                  {dbsMissed && (
                    <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
                      🚨 No DBS expiry recorded
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No staff found matching your search
            </div>
          )}
        </div>
      )}

      {editing && <EditStaffModal staff={editing} onClose={() => setEditing(null)} />}
      {working && <WorkingModal staff={working} onClose={() => setWorking(null)} />}

      {adding && (
        <Modal title="Add a staff member" onClose={() => setAdding(false)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={addStaff.isPending}
              onClick={() => addStaff.mutate({
                ...newStaff,
                contractHours: newStaff.contractHours === '' ? null : Number(newStaff.contractHours),
                // No password is sent. The server generates a one-time one and
                // returns it below, to be handed over in person.
              } as any, { onSuccess: (d: any) => {
                setAdding(false);
                setNewStaff({ firstName:'', lastName:'', email:'', role:'carer', jobTitle:'', phone:'', contractHours:'', startDate:'' });
                if (d?.temporaryPassword) setHandover({ name: `${d.first_name} ${d.last_name}`, email: d.email, password: d.temporaryPassword });
              } })}>
              {addStaff.isPending ? 'Adding…' : 'Add'}
            </button>
          </>}>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label className="form-label">First name</label>
              <input className="form-input" value={newStaff.firstName} onChange={e => setNewStaff({ ...newStaff, firstName: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Last name</label>
              <input className="form-input" value={newStaff.lastName} onChange={e => setNewStaff({ ...newStaff, lastName: e.target.value })} /></div>
          </div>
          <div className="form-group"><label className="form-label">Email — they sign in with this</label>
            <input className="form-input" type="email" value={newStaff.email} onChange={e => setNewStaff({ ...newStaff, email: e.target.value })} /></div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group"><label className="form-label">Role — decides what they can see</label>
              <select className="form-input" value={newStaff.role} onChange={e => setNewStaff({ ...newStaff, role: e.target.value })}>
                {ROLES.map(([v, l]: any) => <option key={v} value={v}>{l}</option>)}
              </select></div>
            <div className="form-group"><label className="form-label">Job title</label>
              <input className="form-input" value={newStaff.jobTitle} onChange={e => setNewStaff({ ...newStaff, jobTitle: e.target.value })} /></div>
          </div>
          <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>
            <div className="form-group"><label className="form-label">Phone</label>
              <input className="form-input" value={newStaff.phone} onChange={e => setNewStaff({ ...newStaff, phone: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Contract hours</label>
              <input className="form-input" type="number" value={newStaff.contractHours} onChange={e => setNewStaff({ ...newStaff, contractHours: e.target.value })} /></div>
            <div className="form-group"><label className="form-label">Start date</label>
              <input className="form-input" type="date" value={newStaff.startDate} onChange={e => setNewStaff({ ...newStaff, startDate: e.target.value })} /></div>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            You will be shown a one-time password to give them. The app makes them choose their own
            the first time they sign in, so after that nobody — including you — knows it.
          </p>
        </Modal>
      )}

      {leaver && (
        <Modal title={`${leaver.first_name} ${leaver.last_name} has left`} onClose={() => setLeaver(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => setLeaver(null)}>Cancel</button>
            <button className="btn btn-danger" disabled={deactivate.isPending}
              onClick={() => deactivate.mutate({ id: leaver.id, data: leaveForm } as any, { onSuccess: () => setLeaver(null) })}>
              {deactivate.isPending ? 'Saving…' : 'Remove access'}
            </button>
          </>}>
          <p style={{ margin: 0, fontSize: 14 }}>
            Their sign-in stops working immediately. Their record and every care note they wrote are
            kept — a care record must never lose its author. Any future shifts are removed from the
            rota so it does not look covered when it is not.
          </p>
          <div className="form-group"><label className="form-label">Reason</label>
            <select className="form-input" value={leaveForm.leavingReason} onChange={e => setLeaveForm({ ...leaveForm, leavingReason: e.target.value })}>
              {LEAVING.map(([v, l]: any) => <option key={v} value={v}>{l}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Last day</label>
            <input className="form-input" type="date" value={leaveForm.leavingDate} onChange={e => setLeaveForm({ ...leaveForm, leavingDate: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={leaveForm.notes} onChange={e => setLeaveForm({ ...leaveForm, notes: e.target.value })} /></div>
        </Modal>
      )}

      {handover && (
        <Modal title="Give them this to sign in" onClose={() => setHandover(null)}
          footer={<button className="btn btn-primary" onClick={() => setHandover(null)}>Done</button>}>
          <p style={{ margin: 0, fontSize: 14 }}>
            <strong>{handover.name}</strong> can now sign in. This password is shown once and cannot
            be looked up again — write it down or hand it over now. They will be asked to choose
            their own the first time they use it.
          </p>
          <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Email</div>
            <div style={{ fontWeight: 600, marginBottom: 10, wordBreak: 'break-all' }}>{handover.email}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>One-time password</div>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 22, letterSpacing: 1, fontWeight: 700 }}>
              {handover.password}
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" style={{ justifySelf: 'start' }}
            onClick={() => navigator.clipboard?.writeText(handover.password)}>Copy password</button>
        </Modal>
      )}

      {importOpen && (
        <Modal wide title="Import staff from a spreadsheet" onClose={() => { setImport(false); setPreview(null); setFile(null); }}
          footer={<>
            <button className="btn btn-ghost" onClick={() => { setImport(false); setPreview(null); setFile(null); }}>Close</button>
            {preview?.summary?.willCreate > 0 && (
              <button className="btn btn-primary" disabled={importStaff.isPending}
                onClick={() => { const fd = new FormData(); fd.append('file', file as File);
                  importStaff.mutate({ formData: fd, commit: true } as any, { onSuccess: (d: any) => setPreview(d) }); }}>
                {importStaff.isPending ? 'Adding…' : `Add ${preview.summary.willCreate} people`}
              </button>
            )}
          </>}>
          <p style={{ margin: 0, fontSize: 14 }}>
            Upload the staff list you already keep — Excel (.xlsx) or CSV. Nothing is saved until you
            have seen exactly what will happen to every row.
          </p>
          <button className="btn btn-secondary btn-sm" style={{ justifySelf: 'start' }}
            onClick={async () => {
              const res = await api.get('/staff/import/template', { responseType: 'blob' });
              const url = URL.createObjectURL(res.data as any);
              const a = document.createElement('a'); a.href = url; a.download = 'carevista-staff-template.csv';
              document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }}>⬇ Download a template</button>
          <input className="form-input" type="file" accept=".xlsx,.csv"
            onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); }} />
          {file && !preview && (
            <button className="btn btn-primary" disabled={importStaff.isPending}
              onClick={() => { const fd = new FormData(); fd.append('file', file);
                importStaff.mutate({ formData: fd, commit: false } as any, { onSuccess: (d: any) => setPreview(d) }); }}>
              {importStaff.isPending ? 'Checking…' : 'Check the file'}
            </button>
          )}
          {preview && (
            <div>
              <p style={{ fontWeight: 600 }}>{preview.message}</p>
              {preview.results?.some((r: any) => r.temporaryPassword) && (
                <>
                  <p style={{ fontSize: 13, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 10 }}>
                    Print or write these down before you close this window — they are shown once and
                    cannot be looked up again. Each person is asked to choose their own password the
                    first time they sign in.
                  </p>
                  <button className="btn btn-secondary btn-sm" style={{ justifySelf: 'start' }}
                    onClick={() => exportCsv('new-staff-passwords', preview.results.filter((r: any) => r.temporaryPassword), [
                      { header: 'Name', value: (r: any) => r.name },
                      { header: 'Email', value: (r: any) => r.email },
                      { header: 'One-time password', value: (r: any) => r.temporaryPassword },
                    ])}>⬇ Download the list</button>
                </>
              )}
              <div className="table-container" style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table className="table">
                  <thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Result</th><th>One-time password</th></tr></thead>
                  <tbody>
                    {preview.results.map((r: any, i: number) => (
                      <tr key={i}>
                        <td>{r.line}</td><td>{r.name}</td><td style={{ fontSize: 12 }}>{r.email || '—'}</td>
                        <td style={{ fontSize: 12, color: r.status === 'skipped' || r.status === 'failed' ? '#b91c1c' : '#059669' }}>
                          {r.status === 'will_create' ? 'Will be added' : r.status === 'created' ? 'Added' : r.status}
                          {r.reason ? ` — ${r.reason}` : ''}{r.note ? ` — ${r.note}` : ''}
                        </td>
                        <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 600 }}>
                          {r.temporaryPassword || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
