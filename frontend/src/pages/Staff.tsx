// src/pages/Staff.tsx — Staff directory with photos, edit, add
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useStaff } from '../hooks';
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
  const { t } = useLang();
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
  const { t } = useLang();
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
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('Cancel')}</button>
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
  const { t } = useLang();
  const { data: rawStaff = [], isLoading } = useStaff();
  const staff: any[] = Array.isArray(rawStaff) ? rawStaff : (rawStaff as any)?.staff ?? [];
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editing, setEditing]     = useState<any>(null);

  const filtered = staff.filter(s => {
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
      <div className="page-header">
        <div>
          <h1 className="page-title">👤 Staff Directory</h1>
          <p className="page-subtitle">{staff.length} staff members · {filtered.length} shown</p>
        </div>
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
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>{t('Loading…')}</div>
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
                    <button onClick={() => setEditing(s)}
                      style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      ✏️ Edit
                    </button>
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
    </div>
  );
}
