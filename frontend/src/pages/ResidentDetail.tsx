// src/pages/ResidentDetail.tsx — Full resident profile with timeline
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useParams, Link } from 'react-router-dom';
import { useResident, useCareNotes, useResidentMedications, useIncidents, useResidentActivityHistory, useResidentWellbeing, useUpdateMobility, useResidentCarePlanFull } from '../hooks';
import { WeightChart } from '../components/WeightChart';
import { BodyMap, type BodyMapMark } from '../components/BodyMap';
import { LifeStoryBoard } from '../components/LifeStoryBoard';
import { EnvironmentCard } from '../components/EnvironmentCard';
import { api } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate, formatAge, formatDateTime, NOTE_TYPE_LABELS } from '../utils/formatters';

const TABS = ['Overview', 'Care Plan', 'Timeline', 'Medications', 'Incidents', 'Notes', 'Activities', 'Life Story', 'Wellbeing', 'Belongings', 'Weight', 'Body Map'] as const;
type Tab = typeof TABS[number];

const BELONGING_CATEGORIES = ['general','clothing','jewellery','electronics','documents','valuables','toiletries','other'];

// Resolve photo URL — handle both relative (/uploads/...) and absolute URLs
const BACKEND = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
function photoSrc(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return BACKEND + url;
}


// ── Resident Photo Upload ─────────────────────────────────────────────────
function ResidentPhoto({ residentId, photoUrl, name }: { residentId: string; photoUrl?: string; name: string }) {
  const { t: tr } = useLang();
  const qc = useQueryClient();
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await api.post(`/residents/${residentId}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries({ queryKey: ['residents', residentId] });
    } catch (e) { alert('Upload failed'); }
    finally { setUploading(false); }
  };

  const removePhoto = async () => {
    if (!confirm('Remove profile photo?')) return;
    await api.delete(`/residents/${residentId}/photo`);
    qc.invalidateQueries({ queryKey: ['residents', residentId] });
  };

  const initials = name.split(' ').map(n => n[0]).join('').slice(0,2);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {photoUrl ? (
        <img src={photoSrc(photoUrl)} alt={name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--border)' }} />
      ) : (
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: 'white', border: '3px solid var(--border)' }}>
          {initials}
        </div>
      )}
      {/* Camera button */}
      <button onClick={() => fileRef.current?.click()} disabled={uploading}
        style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: '50%', background: '#0d9488', border: '2px solid white', color: 'white', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        title="Upload photo">
        {uploading ? '⏳' : '📷'}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = ''; }} />
      {photoUrl && (
        <button onClick={removePhoto} style={{ position: 'absolute', top: 0, right: -2, width: 20, height: 20, borderRadius: '50%', background: '#dc2626', border: '2px solid white', color: 'white', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Remove photo">×</button>
      )}
    </div>
  );
}

// ── Belongings Tab ────────────────────────────────────────────────────────
function BelongingsTab({ residentId }: { residentId: string }) {
  const { t: tr } = useLang();
  const qc = useQueryClient();
  const [belongings, setBelongings] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [form, setForm] = React.useState({ description: '', category: 'general' });
  const [preview, setPreview] = React.useState<string | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [lightbox, setLightbox] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    api.get(`/residents/${residentId}/belongings`).then(r => {
      setBelongings(r.data);
      setLoading(false);
    });
  }, [residentId]);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const submitBelonging = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', selectedFile);
      fd.append('description', form.description);
      fd.append('category', form.category);
      const { data } = await api.post(`/residents/${residentId}/belongings`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setBelongings(prev => [data, ...prev]);
      setSelectedFile(null);
      setPreview(null);
      setForm({ description: '', category: 'general' });
    } catch { alert('Upload failed'); }
    finally { setUploading(false); }
  };

  const deleteBelonging = async (id: string, photoUrl: string) => {
    if (!confirm('Delete this photo?')) return;
    await api.delete(`/belongings/${id}`);
    setBelongings(prev => prev.filter(b => b.id !== id));
  };

  return (
    <div>
      {/* Add new belonging */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">📦 Record New Item / Belonging</span></div>
        <div className="card-body">
          {!preview ? (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={() => fileRef.current?.click()} className="btn btn-primary">
                📷 Take Photo / Upload
              </button>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center', margin: 0 }}>
                Photograph new items brought in — clothing, jewellery, electronics, valuables
              </p>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onFileSelect} />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {/* Preview */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img src={preview} alt={tr('Preview')} style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 10, border: '2px solid var(--border)' }} />
                <button onClick={() => { setPreview(null); setSelectedFile(null); }}
                  style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24, borderRadius: '50%', background: '#dc2626', color: 'white', border: '2px solid white', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
              {/* Form */}
              <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select className="form-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {BELONGING_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{tr('Description')}</label>
                  <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="e.g. Gold wedding ring, blue cardigan, iPhone 13..." />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={submitBelonging} disabled={uploading}>
                    {uploading ? '⏳ Saving…' : '✅ Save Record'}
                  </button>
                  <button className="btn btn-secondary" onClick={() => { setPreview(null); setSelectedFile(null); }}>{tr('Cancel')}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Belongings grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>{tr('Loading…')}</div>
      ) : belongings.length === 0 ? (
        <div className="card"><div className="card-body table-empty">No items recorded yet — use the camera above to photograph new belongings on arrival</div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {belongings.map(b => (
            <div key={b.id} className="card" style={{ overflow: 'hidden' }}>
              <img src={photoSrc(b.photo_url)} alt={b.description || 'Belonging'} onClick={() => setLightbox(b.photo_url)}
                style={{ width: '100%', height: 160, objectFit: 'cover', cursor: 'zoom-in', display: 'block' }} />
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 11, background: 'var(--surface-2)', color: 'var(--text-muted)', padding: '1px 7px', borderRadius: 10, display: 'inline-block', marginBottom: 6, textTransform: 'capitalize' }}>{b.category}</div>
                {b.description && <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{b.description}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {b.recorded_by_name} · {new Date(b.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <button onClick={() => deleteBelonging(b.id, b.photo_url)}
                  style={{ marginTop: 8, padding: '3px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                  🗑 Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.9)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={photoSrc(lightbox)} alt="Full size" style={{ maxWidth: '95vw', maxHeight: '95vh', objectFit: 'contain', borderRadius: 8 }} />
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.1)', border: 'none', color: 'white', fontSize: 24, width: 40, height: 40, borderRadius: '50%', cursor: 'pointer' }}>×</button>
        </div>
      )}
    </div>
  );
}


// ── Mobility Status Card ──────────────────────────────────────────────────
const MOBILITY_OPTIONS = [
  { value: 'independent', label: 'Independent' },
  { value: 'walking_aid', label: 'Walking Aid' },
  { value: 'wheelchair', label: 'Wheelchair' },
  { value: 'bed_bound', label: 'Bed-bound' },
];

function MobilityStatusCard({ residentId, currentStatus }: { residentId: string; currentStatus?: string }) {
  const [selected, setSelected] = React.useState(currentStatus || 'independent');
  const mobilityMutation = useUpdateMobility();
  const isDirty = selected !== (currentStatus || 'independent');

  React.useEffect(() => {
    setSelected(currentStatus || 'independent');
  }, [currentStatus]);

  const handleSave = () => {
    mobilityMutation.mutate({ id: residentId, mobilityStatus: selected });
  };

  return (
    <div className="card" style={{ border: '2px solid #0d948830', background: '#eff6ff08' }}>
      <div className="card-header" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{'\u267F'}</span> Mobility Status
        </span>
      </div>
      <div className="card-body" style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select
            className="form-input"
            value={selected}
            onChange={e => setSelected(e.target.value)}
            style={{ flex: 1, minWidth: 160, maxWidth: 220 }}
          >
            {MOBILITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={!isDirty || mobilityMutation.isPending}
            style={{ opacity: isDirty ? 1 : 0.5 }}
          >
            {mobilityMutation.isPending ? '\u23F3 Saving...' : '\u2705 Save'}
          </button>
        </div>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Tasks and activities will automatically adjust based on mobility level
        </p>
      </div>
    </div>
  );
}

// ── Edit Resident Modal ───────────────────────────────────────────────────
function EditResidentModal({ resident: r, onClose, onSaved }: { resident: any; onClose: () => void; onSaved: () => void }) {
  const { t: tr } = useLang();
  const qc = useQueryClient();
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    firstName:        r.first_name || '',
    lastName:         r.last_name  || '',
    roomNumber:       r.room_number || '',
    nhsNumber:        r.nhs_number || '',
    riskLevel:        r.risk_level || 'low',
    fundingType:      r.funding_type || 'self_funded',
    weeklyFee:        r.weekly_fee || '',
    dnacpr:           r.dnacpr || false,
    gpName:           r.gp_name || '',
    gpPractice:       r.gp_practice || '',
    gpPhone:          r.gp_phone || '',
    careNeedsSummary: r.care_needs_summary || '',
    admissionDate:    r.admission_date?.slice(0,10) || '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/residents/${r.id}`, {
        riskLevel:        form.riskLevel,
        roomNumber:       form.roomNumber,
        careNeedsSummary: form.careNeedsSummary,
        gpName:           form.gpName,
        gpPractice:       form.gpPractice,
        gpPhone:          form.gpPhone,
        dnacpr:           form.dnacpr,
        fundingType:      form.fundingType,
        weeklyFee:        form.weeklyFee ? parseFloat(form.weeklyFee) : null,
      });
      qc.invalidateQueries({ queryKey: ['residents', r.id] });
      onSaved();
      onClose();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxHeight: '90vh' }}>
        <div className="modal-header">
          <h2 className="modal-title">✏️ Edit — {r.first_name} {r.last_name}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={save}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

            {/* Section: Resident Details */}
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>👤 Resident Details</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Room Number</label>
                <input className="form-input" value={form.roomNumber} onChange={e => set('roomNumber', e.target.value)} placeholder="e.g. 6" />
              </div>
              <div className="form-group">
                <label className="form-label">Risk Level</label>
                <select className="form-input" value={form.riskLevel} onChange={e => set('riskLevel', e.target.value)}>
                  <option value="low">{tr('Low')}</option>
                  <option value="medium">{tr('Medium')}</option>
                  <option value="high">{tr('High')}</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Funding Type</label>
                <select className="form-input" value={form.fundingType} onChange={e => set('fundingType', e.target.value)}>
                  <option value="self_funded">Self Funded</option>
                  <option value="local_authority">Local Authority</option>
                  <option value="nhs_continuing">NHS Continuing</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Weekly Fee (£)</label>
                <input className="form-input" type="number" step="0.01" value={form.weeklyFee} onChange={e => set('weeklyFee', e.target.value)} placeholder="e.g. 1100" />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={form.dnacpr} onChange={e => set('dnacpr', e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: '#dc2626' }} />
                <span>🔴 <strong>DNACPR</strong> — Do Not Attempt Cardiopulmonary Resuscitation</span>
              </label>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0 14px', paddingTop: 14, fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>🩺 GP & Clinical</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">GP Name</label>
                <input className="form-input" value={form.gpName} onChange={e => set('gpName', e.target.value)} placeholder="Dr. Smith" />
              </div>
              <div className="form-group">
                <label className="form-label">GP Phone</label>
                <input className="form-input" value={form.gpPhone} onChange={e => set('gpPhone', e.target.value)} placeholder="0161 123 4567" />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">GP Practice</label>
              <input className="form-input" value={form.gpPractice} onChange={e => set('gpPractice', e.target.value)} placeholder="Salford Medical Centre" />
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0 14px', paddingTop: 14, fontWeight: 700, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>📋 Care Needs Summary</div>
            <div className="form-group">
              <textarea className="form-input" rows={4} value={form.careNeedsSummary}
                onChange={e => set('careNeedsSummary', e.target.value)}
                placeholder="Describe care needs, dietary requirements, mobility, allergies, preferences…"
                style={{ resize: 'vertical' }} />
              <p className="form-hint">This appears on care plans, handover reports, and is used by AI tools to personalise suggestions.</p>
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


// The care plan, summarised on the resident record. The full editor lives at
// /care-plans — this is the "is there one, and is it current" answer that a
// carer opening a resident actually needs.
function CarePlanTab({ residentId }: { residentId: string }) {
  const { data: plan, isLoading } = useResidentCarePlanFull(residentId);

  if (isLoading) return <div className="card"><div className="card-body">Loading care plan…</div></div>;

  if (!plan) {
    return (
      <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
        <div className="card-body">
          <div style={{ fontWeight: 600, color: '#b91c1c', marginBottom: 6 }}>No care plan</div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>
            This resident has no person-centred care plan. Regulation 9 requires one, and staff are
            currently working from memory and handover alone.
          </p>
          <Link to="/care-plans" className="btn btn-primary btn-sm">Start a care plan</Link>
        </div>
      </div>
    );
  }

  const overdue = plan.reviewOverdue;
  return (
    <div>
      <div className="card" style={{ marginBottom: 16, borderLeft: `4px solid ${overdue ? '#ef4444' : plan.status === 'active' ? '#10b981' : '#f59e0b'}` }}>
        <div className="card-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontWeight: 600 }}>
              {plan.status === 'active' ? 'Active care plan' : plan.status === 'draft' ? 'Draft — not yet signed off' : 'Changed — needs re-signing'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Version {plan.version} · {plan.completenessPercent}% complete ·{' '}
              {overdue ? <span style={{ color: '#b91c1c', fontWeight: 600 }}>review overdue</span>
                       : `next review ${plan.nextReviewDate || '—'}`}
              {plan.approvedByName ? ` · signed off by ${plan.approvedByName}` : ''}
            </div>
          </div>
          <Link to="/care-plans" className="btn btn-primary btn-sm">Open the full plan</Link>
        </div>
      </div>

      {plan.whatMattersToMe && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><span className="card-title">What matters to me</span></div>
          <div className="card-body" style={{ whiteSpace: 'pre-wrap' }}>{plan.whatMattersToMe}</div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><span className="card-title">What staff do</span></div>
        <div className="card-body">
          {(plan.sections || []).filter((sec: any) => sec.applicable && sec.interventions).length === 0 ? (
            <div style={{ color: 'var(--text-secondary)' }}>
              No interventions written yet. Open the full plan to complete it.
            </div>
          ) : (plan.sections || []).filter((sec: any) => sec.applicable && sec.interventions).map((sec: any) => (
            <div key={sec.id} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 3 }}>
                {sec.domainLabel}
                {sec.riskLevel === 'high' && <span style={{ marginLeft: 8, fontSize: 11, background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>High risk</span>}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{sec.interventions}</div>
              {(sec.equipment || sec.staffRequired || sec.frequency) && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {[sec.staffRequired, sec.equipment, sec.frequency].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ResidentDetail() {
  const { t: tr } = useLang();
  const { id } = useParams<{ id: string }>();
  const [tab, setTab]       = useState<Tab>('Overview');
  const [showEdit, setShowEdit]     = useState(false);
  const [bodyMarks, setBodyMarks]   = useState<BodyMapMark[]>([]);

  const { data: resident, isLoading } = useResident(id!);
  const { data: rawNotes }      = useCareNotes({ residentId: id, limit: 100 });
  const { data: rawMeds }       = useResidentMedications(id!);
  const { data: rawIncidents }  = useIncidents({ residentId: id });

  const notes:     any[] = Array.isArray(rawNotes)      ? rawNotes      : (rawNotes as any)?.notes      ?? [];
  const meds:      any[] = Array.isArray(rawMeds)        ? rawMeds       : [];
  const incidents: any[] = Array.isArray(rawIncidents)   ? rawIncidents  : (rawIncidents as any)?.incidents ?? [];

  if (isLoading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading resident…</div>;
  if (!resident)  return <div style={{ padding: 60, textAlign: 'center', color: 'var(--danger)' }}>Resident not found</div>;

  const r   = resident as any;
  const rc  = r.risk_level === 'high' ? '#dc2626' : r.risk_level === 'medium' ? '#d97706' : '#16a34a';
  const rb  = r.risk_level === 'high' ? '#fef2f2' : r.risk_level === 'medium' ? '#fffbeb' : '#f0fdf4';

  // Build timeline — merge notes + incidents sorted by date desc
  const timeline = [
    ...notes.map((n: any) => ({ type: 'note', date: n.created_at, data: n })),
    ...incidents.map((inc: any) => ({ type: 'incident', date: inc.incident_date, data: inc })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Link to="/residents" style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>← Residents</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Avatar */}
            <ResidentPhoto residentId={r.id} photoUrl={r.photo_url} name={`${r.first_name} ${r.last_name}`} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>{r.first_name} {r.last_name}</h1>
                {r.dnacpr && <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 700 }}>🔴 DNACPR</span>}
                <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: rb, color: rc, border: `1px solid ${rc}40`, fontWeight: 700 }}>{r.risk_level?.toUpperCase() ?? ''} RISK</span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span>🛏 Room {r.room_number}</span>
                <span>🎂 {formatAge(r.date_of_birth)}</span>
                <span>📅 Admitted {formatDate(r.admission_date)}</span>
                <span>💷 {r.funding_type?.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to={`/care-notes?resident_id=${r.id}`} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#0d9488', color: 'white', fontWeight: 700, fontSize: 13, textDecoration: 'none' }}>📝 Add Note</Link>
            <Link to={`/emar?resident_id=${r.id}`} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>💊 eMAR</Link>
            <Link to={`/incidents?resident_id=${r.id}`} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>⚠️ Incident</Link>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '10px 20px', border: 'none', background: 'none', borderBottom: `2px solid ${tab === t ? '#0d9488' : 'transparent'}`, color: tab === t ? '#0d9488' : 'var(--text-secondary)', fontWeight: tab === t ? 700 : 500, cursor: 'pointer', fontSize: 14, transition: 'all 150ms', marginBottom: -2 }}>
            {t}
            {t === 'Incidents' && incidents.length > 0 && <span style={{ marginLeft: 5, fontSize: 10, background: '#fef2f2', color: '#dc2626', padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>{incidents.length}</span>}
            {t === 'Notes' && notes.length > 0 && <span style={{ marginLeft: 5, fontSize: 10, background: '#eff6ff', color: '#0d9488', padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>{notes.length}</span>}
            {t === 'Medications' && meds.length > 0 && <span style={{ marginLeft: 5, fontSize: 10, background: '#dcfce7', color: '#16a34a', padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>{meds.length}</span>}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────── */}
      {tab === 'Overview' && (
        <div className="grid-2">
          {/* Personal */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">👤 Personal Details</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEdit(true)}>✏️ Edit</button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {[
                ['Full Name', `${r.first_name} ${r.last_name}`],
                ['Date of Birth', formatDate(r.date_of_birth)],
                ['Age', formatAge(r.date_of_birth)],
                ['NHS Number', r.nhs_number || '—'],
                ['Room', r.room_number],
                ['Admitted', formatDate(r.admission_date)],
                ['Funding', r.funding_type?.replace(/_/g, ' ') || '—'],
                ['Weekly Fee', r.weekly_fee ? `£${Number(r.weekly_fee).toLocaleString()}` : '—'],
                ['DNACPR', r.dnacpr ? '🔴 Yes — do not attempt CPR' : '✅ No'],
                ['Risk Level', r.risk_level?.toUpperCase() ?? '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{k}</span>
                  <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">🩺 GP & Clinical</span></div>
              <div className="card-body" style={{ padding: 0 }}>
                {[
                  ['GP Name', r.gp_name || '—'],
                  ['GP Practice', r.gp_practice || '—'],
                  ['GP Phone', r.gp_phone || '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">📋 Care Needs Summary</span></div>
              <div className="card-body">
                <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', margin: 0 }}>{r.care_needs_summary || 'No care needs summary recorded.'}</p>
              </div>
            </div>

            {/* Mobility Status */}
            <MobilityStatusCard residentId={r.id} currentStatus={r.mobility_status} />

            {/* Quick stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Active Meds', value: meds.length, color: '#10b981', icon: '💊' },
                { label: 'Open Incidents', value: incidents.filter((i: any) => i.status !== 'closed').length, color: '#dc2626', icon: '⚠️' },
                { label: 'Notes (30d)', value: notes.length, color: '#0d9488', icon: '📝' },
              ].map(k => (
                <div key={k.label} style={{ padding: '12px', borderRadius: 10, background: k.color + '10', border: `1px solid ${k.color}25`, textAlign: 'center' }}>
                  <div style={{ fontSize: 22 }}>{k.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TIMELINE ─────────────────────────────────────────── */}
      {tab === 'Care Plan' && <CarePlanTab residentId={id!} />}

      {tab === 'Timeline' && (
        <div style={{ maxWidth: 720 }}>
          {timeline.length === 0 ? (
            <div className="card"><div className="card-body table-empty">No timeline events yet</div></div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: 32 }}>
              {/* Vertical line */}
              <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />

              {timeline.map((item, i) => {
                const isNote     = item.type === 'note';
                const isIncident = item.type === 'incident';
                const color      = isIncident ? '#dc2626' : '#0d9488';
                const bg         = isIncident ? '#fef2f2' : '#eff6ff';
                const n          = item.data;
                const meal       = isNote && n.meal_context ? (() => { try { return JSON.parse(n.meal_context); } catch { return null; } })() : null;

                return (
                  <div key={i} style={{ position: 'relative', marginBottom: 16 }}>
                    {/* Dot */}
                    <div style={{ position: 'absolute', left: -26, top: 14, width: 14, height: 14, borderRadius: '50%', background: color, border: '2px solid white', boxShadow: `0 0 0 2px ${color}40` }} />

                    <div style={{ background: 'white', border: '1px solid var(--border)', borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {isNote && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: bg, color, fontWeight: 700 }}>{NOTE_TYPE_LABELS[n.note_type] || n.note_type}</span>}
                          {isIncident && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>⚠️ Incident</span>}
                          {meal && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f0fdf4', color: '#16a34a', fontWeight: 700 }}>🍽 {meal.meal}</span>}
                          {isNote && n.is_significant && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fffbeb', color: '#d97706', fontWeight: 700 }}>⚠ Significant</span>}
                          {isNote && n.flagged && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>🚩 Flagged</span>}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>{formatDateTime(item.date)}</span>
                      </div>
                      <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)', margin: 0 }}>
                        {isNote ? (n.content?.slice(0, 220) + (n.content?.length > 220 ? '…' : '')) : n.description?.slice(0, 220)}
                      </p>
                      {isNote && meal && (
                        <div style={{ marginTop: 8, display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          {meal.appetite && <span>Appetite: <strong>{meal.appetite}</strong></span>}
                          {meal.food_eaten_percent != null && <span>Eaten: <strong>{meal.food_eaten_percent}%</strong></span>}
                          {meal.fluid_ml && <span>Fluid: <strong>{meal.fluid_ml}ml</strong></span>}
                          {meal.drinks && <span>Drinks: <strong>{meal.drinks}</strong></span>}
                        </div>
                      )}
                      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        {isNote ? `By ${n.author_name}` : `Reported by ${n.reporter_name || 'staff'}`}
                        {isNote && n.written_on_behalf_of_name && ` on behalf of ${n.written_on_behalf_of_name}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MEDICATIONS ───────────────────────────────────────── */}
      {tab === 'Medications' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{meds.length} active medication{meds.length !== 1 ? 's' : ''}</div>
            <Link to={`/emar?resident_id=${r.id}`} className="btn btn-primary btn-sm">Open in eMAR →</Link>
          </div>
          {meds.length === 0 ? (
            <div className="card"><div className="card-body table-empty">No active medications</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {meds.map((m: any) => (
                <div key={m.id} className="card">
                  <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: m.is_controlled ? '#fef2f2' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>💊</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{m.name}</span>
                        {m.is_controlled && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>CD</span>}
                        {m.is_prn && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#eff6ff', color: '#0d9488', fontWeight: 700 }}>PRN</span>}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>{m.dose} · {m.route} · {m.frequency?.replace(/_/g, ' ')}</div>
                      {m.indication && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>For: {m.indication}</div>}
                      {m.special_instructions && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{m.special_instructions}</div>}
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>
                      <div>Started {formatDate(m.start_date)}</div>
                      {m.prescribed_by && <div>Dr. {m.prescribed_by}</div>}
                      <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                        {(m.administration_times || []).map((t: string) => (
                          <span key={t} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-muted)', fontWeight: 600 }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── INCIDENTS ─────────────────────────────────────────── */}
      {tab === 'Incidents' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{incidents.length} incident{incidents.length !== 1 ? 's' : ''} recorded</div>
            <Link to={`/incidents?resident_id=${r.id}`} className="btn btn-ghost btn-sm">View in Incidents →</Link>
          </div>
          {incidents.length === 0 ? (
            <div className="card"><div className="card-body table-empty">No incidents recorded</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {incidents.map((inc: any) => {
                const sColor = inc.severity === 'critical' || inc.severity === 'high' ? '#dc2626' : inc.severity === 'medium' ? '#d97706' : '#6b7280';
                return (
                  <div key={inc.id} className="card" style={{ borderLeft: `4px solid ${sColor}` }}>
                    <div className="card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: sColor + '15', color: sColor, fontWeight: 700, textTransform: 'uppercase' }}>{inc.severity}</span>
                          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--text-muted)' }}>{inc.incident_type?.replace(/_/g, ' ')}</span>
                          <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: inc.status === 'closed' ? '#dcfce7' : '#fffbeb', color: inc.status === 'closed' ? '#16a34a' : '#d97706', fontWeight: 600 }}>{inc.status}</span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(inc.incident_date)}</span>
                      </div>
                      <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)', margin: 0 }}>{inc.description?.slice(0, 200)}{inc.description?.length > 200 ? '…' : ''}</p>
                      {inc.injuries && <div style={{ marginTop: 6, fontSize: 13, color: '#dc2626' }}>Injuries: {inc.injuries}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── NOTES ─────────────────────────────────────────────── */}
      {tab === 'Notes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>{notes.length} notes</div>
            <Link to={`/care-notes?resident_id=${r.id}`} className="btn btn-primary btn-sm">+ Add Note</Link>
          </div>
          {notes.length === 0 ? (
            <div className="card"><div className="card-body table-empty">No care notes yet</div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notes.map((n: any) => (
                <div key={n.id} className="card" style={{ borderLeft: `3px solid ${n.flagged ? '#dc2626' : n.is_significant ? '#d97706' : 'transparent'}` }}>
                  <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#eff6ff', color: '#0d9488', fontWeight: 700 }}>{NOTE_TYPE_LABELS[n.note_type] || n.note_type}</span>
                        {n.flagged && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontWeight: 700 }}>🚩 Flagged</span>}
                        {n.is_significant && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#fffbeb', color: '#d97706', fontWeight: 700 }}>⚠ Significant</span>}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{n.author_name} · {formatDateTime(n.created_at)}</span>
                    </div>
                    <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)', margin: 0 }}>{n.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showEdit && resident && (
        <EditResidentModal
          resident={resident}
          onClose={() => setShowEdit(false)}
          onSaved={() => setShowEdit(false)}
        />
      )}

      {/* ── ACTIVITIES ─────────────────────────────────────────── */}
      {tab === 'Activities' && <ResidentActivitiesTab residentId={id!} resident={resident} />}

      {/* ── LIFE STORY ─────────────────────────────────────────── */}
      {tab === 'Life Story' && (
        <LifeStoryBoard residentId={id!} residentName={`${(resident as any).first_name} ${(resident as any).last_name}`} canEdit={true} />
      )}

      {/* ── WELLBEING ──────────────────────────────────────────── */}
      {tab === 'Wellbeing' && <ResidentWellbeingTab residentId={id!} />}

      {/* ── BELONGINGS ──────────────────────────────────────────── */}
      {tab === 'Belongings' && <BelongingsTab residentId={id!} />}

      {/* ── WEIGHT & NUTRITION ───────────────────────────────────── */}
      {tab === 'Weight' && resident && (
        <WeightChart residentId={id!} residentName={`${(resident as any).first_name} ${(resident as any).last_name}`} />
      )}

      {/* ── BODY MAP ─────────────────────────────────────────────── */}
      {tab === 'Body Map' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div>
              <h2 style={{ fontSize:16, fontWeight:700, margin:0 }}>🗺 Body Map — Skin & Wound Chart</h2>
              <p style={{ fontSize:13, color:'var(--text-muted)', margin:'4px 0 0' }}>Click to mark wounds, pressure areas, bruising or skin concerns</p>
            </div>
            {bodyMarks.length > 0 && (
              <span style={{ fontSize:12, padding:'4px 12px', borderRadius:20, background:'#fef2f2', color:'#dc2626', fontWeight:700 }}>
                {bodyMarks.length} mark{bodyMarks.length!==1?'s':''} recorded
              </span>
            )}
          </div>
          <div className="card">
            <div className="card-body">
              <BodyMap marks={bodyMarks} onChange={setBodyMarks} />
              {bodyMarks.length > 0 && (
                <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid var(--border)', display:'flex', gap:8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    const summary = bodyMarks.map(m => `${m.side} - ${m.type.replace(/_/g,' ')}${m.grade?' ('+m.grade+')':''}${m.notes?' - '+m.notes:''}`).join('; ');
                    alert('Body map summary copied. Add to care note:\n\n' + summary);
                  }}>📝 Add to Care Note</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { if(confirm('Clear all marks?')) setBodyMarks([]); }}>🗑 Clear All</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ── Resident Wellbeing Tab ─────────────────────────────────────────────────
function ResidentWellbeingTab({ residentId }: { residentId: string }) {
  const { data } = useResidentWellbeing(residentId, 30);
  const logs = data?.logs || [];
  const trend = data?.trend || 'insufficient_data';

  const MOOD_EMOJI: Record<string, string> = { very_happy: '😄', happy: '😊', neutral: '😐', low: '😔', very_low: '😢' };
  const MOOD_COLORS: Record<string, string> = { very_happy: '#10b981', happy: '#22c55e', neutral: '#f59e0b', low: '#f97316', very_low: '#dc2626' };
  const TREND_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    improving: { label: 'Improving', color: '#10b981', icon: '📈' },
    declining: { label: 'Declining', color: '#dc2626', icon: '📉' },
    stable: { label: 'Stable', color: '#0d9488', icon: '➡️' },
    insufficient_data: { label: 'Not enough data', color: '#6b7280', icon: '📊' },
  };
  const trendInfo = TREND_LABELS[trend] || TREND_LABELS.insufficient_data;

  return (
    <div>
      {/* Trend summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ padding: '14px', borderRadius: 12, background: trendInfo.color + '10', border: `1px solid ${trendInfo.color}30` }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Mood Trend (7 days)</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: trendInfo.color }}>
            {trendInfo.icon} {trendInfo.label}
          </div>
        </div>
        <div style={{ padding: '14px', borderRadius: 12, background: '#8b5cf610', border: '1px solid #8b5cf630' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total Logs (30 days)</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#8b5cf6' }}>{logs.length}</div>
        </div>
        {data?.avgMoodScore && (
          <div style={{ padding: '14px', borderRadius: 12, background: '#f59e0b10', border: '1px solid #f59e0b30' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Avg Mood Score</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#f59e0b' }}>{parseFloat(data.avgMoodScore).toFixed(1)}/5</div>
          </div>
        )}
      </div>

      {/* Environment Preferences */}
      <div style={{ marginBottom: 20 }}>
        <EnvironmentCard residentId={residentId} canEdit={true} />
      </div>

      {/* Recent Logs */}
      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>Recent Wellbeing Logs</h3>
      {logs.length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No wellbeing logs yet. Use the Wellbeing Hub to start logging.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.slice(0, 20).map((log: any) => (
            <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: 'var(--bg-card, white)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 24 }}>{MOOD_EMOJI[log.mood] || '😐'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: (MOOD_COLORS[log.mood] || '#6b7280') + '15', color: MOOD_COLORS[log.mood] || '#6b7280', fontWeight: 700, textTransform: 'capitalize' }}>
                    {log.mood?.replace(/_/g, ' ')}
                  </span>
                  {log.sleep_quality && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#0d948810', color: '#0d9488' }}>Sleep: {log.sleep_quality}</span>}
                  {log.appetite && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#10b98110', color: '#10b981' }}>Appetite: {log.appetite}</span>}
                  {log.social_engagement && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#8b5cf610', color: '#8b5cf6' }}>Social: {log.social_engagement}</span>}
                  {log.energy_level && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f59e0b10', color: '#f59e0b' }}>Energy: {log.energy_level}</span>}
                  {log.pain_level != null && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: log.pain_level >= 7 ? '#dc262615' : '#6b728010', color: log.pain_level >= 7 ? '#dc2626' : '#6b7280' }}>Pain: {log.pain_level}/10</span>}
                </div>
                {log.notes && <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{log.notes}</p>}
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                <div>{new Date(log.log_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                <div>{log.logged_by_name}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Resident Activities Tab ───────────────────────────────────────────────
function ResidentActivitiesTab({ residentId, resident }: { residentId: string; resident: any }) {
  const { t: tr } = useLang();
  const { data: history = [] } = useResidentActivityHistory(residentId);
  const CATEGORY_ICONS: Record<string, string> = { physical: '🏃', creative: '🎨', social: '🤝', cognitive: '🧠', sensory: '✨' };
  const MOBILITY_LABELS: Record<string, string> = { independent: 'Independent', walking_aid: 'Walking Aid', wheelchair: 'Wheelchair', bed_bound: 'Bed-bound' };

  const attended = (history as any[]).filter(h => h.attendance === 'attended');
  const highEngagement = attended.filter(h => h.engagement_level === 'high').length;
  const totalAttended = attended.length;

  return (
    <div>
      {/* Mobility & Interests Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Mobility Status</h4>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {MOBILITY_LABELS[resident?.mobility_status] || 'Not set'}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Determines eligible activities
          </p>
        </div>
        <div style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Wellbeing Score</h4>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: (resident?.wellbeing_score ?? 5) >= 7 ? '#10b981' : (resident?.wellbeing_score ?? 5) >= 5 ? '#f59e0b' : '#dc2626' }}>
            {resident?.wellbeing_score ?? '-'}/10
          </div>
        </div>
        <div style={{ background: 'var(--bg-card, white)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 12, padding: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Activity Engagement</h4>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#8b5cf6' }}>
            {totalAttended} sessions
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {highEngagement} high engagement
          </p>
        </div>
      </div>

      {/* Interests */}
      {resident?.interests && resident.interests.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>{tr('Interests')}</h4>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(resident.interests as string[]).map((interest: string) => (
              <span key={interest} style={{ padding: '4px 10px', borderRadius: 14, background: '#8b5cf615', border: '1px solid #8b5cf630', fontSize: '0.75rem', fontWeight: 600, color: '#8b5cf6', textTransform: 'capitalize' }}>
                {interest.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Activity History */}
      <h3 style={{ margin: '20px 0 12px', fontSize: '0.92rem', fontWeight: 700 }}>Activity History</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(history as any[]).slice(0, 30).map((h: any, i: number) => (
          <div key={h.id || i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--bg-card, white)', border: '1px solid var(--border, #e2e8f0)' }}>
            <span style={{ fontSize: '1.1rem' }}>{CATEGORY_ICONS[h.category] || '📌'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{h.activity_name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {h.session_date ? new Date(h.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''} · {h.start_time?.slice(0, 5)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {h.attendance && <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: '0.65rem', fontWeight: 700, background: h.attendance === 'attended' ? '#10b98118' : '#dc262618', color: h.attendance === 'attended' ? '#10b981' : '#dc2626', textTransform: 'capitalize' }}>{h.attendance}</span>}
              {h.engagement_level && <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: '0.65rem', fontWeight: 700, background: h.engagement_level === 'high' ? '#f59e0b18' : '#64748b18', color: h.engagement_level === 'high' ? '#f59e0b' : '#64748b', textTransform: 'capitalize' }}>{h.engagement_level}</span>}
            </div>
            {h.mood_before && h.mood_after && (
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'right', minWidth: 60 }}>
                {h.mood_before} → {h.mood_after}
              </div>
            )}
          </div>
        ))}
        {(history as any[]).length === 0 && (
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No activity history yet</p>
        )}
      </div>
    </div>
  );
}
