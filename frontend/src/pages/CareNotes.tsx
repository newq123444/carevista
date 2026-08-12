// src/pages/CareNotes.tsx — Full-featured care notes with meals, co-authoring, signatures
import React, { useState, useRef } from 'react';
import { useLang } from '../i18n';
import { useSearchParams } from 'react-router-dom';
import { useCareNotes, useCreateNote, useResidents, useColleagues } from '../hooks';
import { formatDateTime, NOTE_TYPE_LABELS, truncate } from '../utils/formatters';
import type { CareNote, Resident } from '../types';
import VoiceNoteInput from '../components/VoiceNoteInput';
import { formatDistanceToNow } from 'date-fns';

// Ordered list for the dropdown — clinical priority order
const NOTE_TYPES: [string,string][] = [
  ['personal_care',       'Personal Care'],
  ['continence',          'Continence & Toileting'],
  ['nutrition',           'Nutrition & Fluids'],
  ['repositioning',       'Repositioning'],
  ['nursing_observation', 'Nursing Observation'],
  ['sleep',               'Sleep'],
  ['behaviour',           'Behaviour'],
  ['wound_care',          'Wound Care'],
  ['fall_observation',    'Fall / Post-Fall Observation'],
  ['activities',          'Activities & Wellbeing'],
  ['gp_visit',            'GP / Clinical Visit'],
  ['hospital_visit',      'Hospital Visit'],
  ['family_update',       'Family Communication'],
  ['end_of_life',         'End of Life Care'],
  ['handover',            'Handover Note'],
  ['medication_note',     'Medication Note'],
  ['incident_note',       'Incident / Concern'],
  ['social_wellbeing',    'Social Wellbeing'],
];

const MOOD_OPTIONS = ['Happy','Calm','Anxious','Confused','Agitated','Sad','Tired','Pain','Unresponsive'];
const POSITION_OPTIONS = ['Left side','Right side','Back','Semi-recumbent','Sitting up','Chair','Standing'];
const MEAL_LABELS: Record<string, string> = {
  breakfast: '🌅 Breakfast', morning_snack: '☕ Morning Snack',
  lunch: '🍽 Lunch', afternoon_tea: '🫖 Afternoon Tea',
  supper: '🌙 Supper', evening_snack: '🌛 Evening Snack',
};
const APPETITE_OPTIONS = ['Excellent – ate everything','Good – ate most of meal','Fair – ate about half','Poor – ate very little','Refused – did not eat','NBM – nil by mouth'];
const DRINK_OPTIONS = ['Water','Tea','Coffee','Juice','Squash','Milk','Soup','Thickened fluid','Fortified milk'];

function NoteCard({ note: n, staff }: { note: any; staff: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const borderColor = n.flagged ? 'var(--danger)' : n.is_significant ? 'var(--warning)' : 'transparent';
  const cardBg = n.flagged ? '#fef2f208' : 'transparent';
  const meal = n.meal_context ? (typeof n.meal_context === 'string' ? JSON.parse(n.meal_context) : n.meal_context) : null;
  const coAuthors: string[] = n.co_author_names ? (typeof n.co_author_names === 'string' ? JSON.parse(n.co_author_names) : n.co_author_names) : [];

  return (
    <div
      className="card"
      style={{ borderLeft: `${n.flagged ? '5px' : '4px'} solid ${borderColor}`, background: cardBg, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
      onClick={() => setExpanded(x => !x)}
    >
      <div className="card-body">
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="badge badge-primary" style={{ fontSize: '0.82rem' }}>
              {NOTE_TYPE_LABELS[n.note_type] || n.note_type}
            </span>
            {n.resident_name && (
              <span className="badge badge-neutral" style={{ fontSize: '0.78rem' }}>👤 {n.resident_name} · Rm {n.room_number}</span>
            )}
            {meal && (
              <span className="badge badge-neutral" style={{ fontSize: '0.78rem' }}>{MEAL_LABELS[meal.meal] || meal.meal}</span>
            )}
            {n.is_significant && <span className="badge badge-warning" style={{ fontSize: '0.76rem' }}>⚠ Significant</span>}
            {n.flagged && <span className="badge badge-danger" style={{ fontSize: '0.76rem' }}>🚩 Flagged</span>}
            {n.is_private && <span className="badge badge-neutral" style={{ fontSize: '0.76rem' }}>🔒 Private</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {n.written_on_behalf_of_name ? (
                  <span>
                    <span style={{ opacity: 0.7 }}>Written by </span>{n.author_name}
                    <span style={{ opacity: 0.7 }}> on behalf of </span>{n.written_on_behalf_of_name}
                  </span>
                ) : n.author_name}
              </div>
              {coAuthors.length > 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>+ {coAuthors.join(', ')}</div>
              )}
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} title={formatDateTime(n.created_at)}>
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {/* Content — truncated or full */}
        {n.flagged && <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, color:'#dc2626', fontSize:12, fontWeight:700 }}>🚩 Flagged for Review</div>}
        <p style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
          {expanded ? n.content : (n.content?.length > 180 ? n.content.slice(0, 180) + '…' : n.content)}
        </p>

        {/* Expanded detail panels */}
        {expanded && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Meal panel */}
            {meal && (
              <div style={{ padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.83rem' }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>
                  {MEAL_LABELS[meal.meal] || meal.meal} Record
                </div>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  {meal.appetite && <div><span style={{ color: 'var(--text-muted)' }}>Appetite: </span><strong>{meal.appetite}</strong></div>}
                  {meal.food_eaten_percent != null && <div><span style={{ color: 'var(--text-muted)' }}>Eaten: </span><strong>{meal.food_eaten_percent}%</strong></div>}
                  {meal.food_description && <div><span style={{ color: 'var(--text-muted)' }}>Food: </span><strong>{meal.food_description}</strong></div>}
                  {meal.fluid_ml != null && <div><span style={{ color: 'var(--text-muted)' }}>Fluid: </span><strong>{meal.fluid_ml}ml</strong></div>}
                  {meal.drinks && <div><span style={{ color: 'var(--text-muted)' }}>Drinks: </span><strong>{meal.drinks}</strong></div>}
                  {meal.texture_modified && <div><span style={{ color: 'var(--text-muted)' }}>Texture: </span><strong>{meal.texture_modified}</strong></div>}
                  {meal.time && <div><span style={{ color: 'var(--text-muted)' }}>Time: </span><strong>{meal.time}</strong></div>}
                </div>
                {meal.preferences_noted && (
                  <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>💬 Preferences: {meal.preferences_noted}</div>
                )}
                {meal.concerns && (
                  <div style={{ marginTop: 6, color: 'var(--danger)', fontWeight: 600 }}>⚠ Concerns: {meal.concerns}</div>
                )}
              </div>
            )}

            {/* Vitals / observations panel */}
            {(n.pain_score != null || n.vital_bp_systolic || n.vital_heart_rate || n.vital_temp || n.vital_spo2 || n.vital_weight || n.fluid_intake_ml || n.fluid_output_ml || n.mood || n.position) && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
                {n.mood && <span>😊 Mood: <strong>{n.mood}</strong></span>}
                {n.pain_score != null && <span>🔴 Pain: <strong>{n.pain_score}/10</strong></span>}
                {n.vital_bp_systolic && <span>❤️ BP: <strong>{n.vital_bp_systolic}/{n.vital_bp_diastolic}</strong></span>}
                {n.vital_heart_rate && <span>💓 HR: <strong>{n.vital_heart_rate}bpm</strong></span>}
                {n.vital_temp && <span>🌡️ Temp: <strong>{n.vital_temp}°C</strong></span>}
                {n.vital_spo2 && <span>💨 SpO₂: <strong>{n.vital_spo2}%</strong></span>}
                {n.vital_weight && <span>⚖️ Weight: <strong>{n.vital_weight}kg</strong></span>}
                {n.fluid_intake_ml && <span>💧 Fluid in: <strong>{n.fluid_intake_ml}ml</strong></span>}
                {n.fluid_output_ml && <span>🚿 Fluid out: <strong>{n.fluid_output_ml}ml</strong></span>}
                {n.position && <span>🛏 Position: <strong>{n.position}</strong></span>}
              </div>
            )}

            {/* Signature strip */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, paddingTop: 6, borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span>✍ Signed: <strong style={{ color: 'var(--text-primary)' }}>
                {n.written_on_behalf_of_name ? `${n.author_name} (on behalf of ${n.written_on_behalf_of_name})` : n.author_name}
              </strong></span>
              {coAuthors.length > 0 && <span>· Co-authored: <strong style={{ color: 'var(--text-primary)' }}>{coAuthors.join(', ')}</strong></span>}
              <span style={{ marginLeft: 6 }}>· {formatDateTime(n.created_at)}</span>
              {n.author_role && <span>· <em>{n.author_role?.replace(/_/g, ' ')}</em></span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CareNotes() {
  const { t: tr } = useLang();
  const [searchParams] = useSearchParams();
  const [residentFilter, setResidentFilter] = useState(searchParams.get('resident_id') || '');
  const [typeFilter, setTypeFilter] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [quickResident, setQuickResident] = useState('');
  const [showVoice, setShowVoice] = useState(false);

  const { data: rawNotes, isLoading } = useCareNotes({
    residentId: residentFilter || undefined,
    noteType: typeFilter || undefined,
    flagged: flaggedOnly || undefined,
    limit: 50,
  });
  const notes: any[] = Array.isArray(rawNotes) ? rawNotes : (rawNotes as any)?.notes ?? [];
  const { data: rawResidents = [] } = useResidents({ active: true });
  const residents: Resident[] = Array.isArray(rawResidents) ? rawResidents : (rawResidents as any)?.residents ?? [];
  const { data: rawStaff = [] } = useColleagues();
  const staff: any[] = Array.isArray(rawStaff) ? rawStaff : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{tr('Care Notes')}</h1>
          <p className="page-subtitle">{notes.length} notes shown</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowVoice(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            🎤 {showVoice ? 'Hide Voice' : 'Voice Note'}
          </button>
          <button className="btn btn-secondary" onClick={() => { setShowCreate(true); setQuickResident(''); }}>
            + Quick Note
          </button>
          <button className="btn btn-primary" onClick={() => { setShowCreate(true); setQuickResident(residentFilter); }}>
            + Add Care Note
          </button>
        </div>
      </div>

      {/* Voice Note Input */}
      {showVoice && (
        <VoiceNoteInput residentId={residentFilter} onNoteCreated={() => setShowVoice(false)} />
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-input" value={residentFilter} onChange={e => setResidentFilter(e.target.value)} style={{ flex: '1 1 200px' }}>
            <option value="">All Residents</option>
            {residents.map((r: Resident) => (
              <option key={r.id} value={r.id}>{r.first_name} {r.last_name} — Rm {r.room_number}</option>
            ))}
          </select>
          <select className="form-input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ flex: '1 1 180px' }}>
            <option value="">All Note Types</option>
            {NOTE_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.87rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={flaggedOnly} onChange={e => setFlaggedOnly(e.target.checked)} />
            Flagged only
          </label>
          <button className="btn btn-ghost btn-sm" onClick={() => { setResidentFilter(''); setTypeFilter(''); setFlaggedOnly(false); }}>Clear</button>
        </div>
      </div>

      {/* Notes Feed */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...Array(5)].map((_, i) => <div key={i} className="card" style={{ height: 90 }} />)}
        </div>
      ) : notes.length === 0 ? (
        <div className="card"><div className="card-body table-empty">No care notes found for the selected filters</div></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notes.map((n: any) => <NoteCard key={n.id} note={n} staff={staff} />)}
        </div>
      )}

      {showCreate && (
        <CreateNoteModal
          residents={residents}
          staff={staff}
          defaultResidentId={quickResident || residentFilter}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}

// ── Full Create Note Modal ─────────────────────────────────────────────────
function CreateNoteModal({ residents, staff, defaultResidentId, onClose }: {
  residents: Resident[];
  staff: any[];
  defaultResidentId: string;
  onClose: () => void;
}) {
  const { t: tr } = useLang();
  const createNote = useCreateNote();
  const signatureRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    residentId: defaultResidentId || '',
    noteType: 'personal_care',
    content: '',
    isSignificant: false,
    isPrivate: false,
    flagged: false,
    flagReason: '',
    // Vitals
    mood: '',
    painScore: '',
    vitalBpSystolic: '', vitalBpDiastolic: '',
    vitalHeartRate: '', vitalTemp: '', vitalSpo2: '', vitalWeight: '',
    fluidIntakeMl: '', fluidOutputMl: '',
    position: '',
    // Co-authoring
    writtenOnBehalfOf: '',   // staff_profile id
    coAuthors: [] as string[], // staff_profile ids
    // Meal
    isMealNote: false,
    meal: 'lunch',
    mealTime: '',
    appetite: '',
    foodEatenPercent: '',
    foodDescription: '',
    fluidMl: '',
    drinks: [] as string[],
    textureModified: '',
    preferences: '',
    mealConcerns: '',
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleDrink = (d: string) => setForm(f => ({
    ...f, drinks: f.drinks.includes(d) ? f.drinks.filter(x => x !== d) : [...f.drinks, d]
  }));
  const toggleCoAuthor = (id: string) => setForm(f => ({
    ...f, coAuthors: f.coAuthors.includes(id) ? f.coAuthors.filter(x => x !== id) : [...f.coAuthors, id]
  }));

  const showMeal = form.noteType === 'nutrition' || form.isMealNote;
  const showVitals = ['nursing_observation','personal_care','repositioning','fall_observation','end_of_life'].includes(form.noteType);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mealContext = showMeal ? JSON.stringify({
      meal: form.meal,
      time: form.mealTime,
      appetite: form.appetite,
      food_eaten_percent: form.foodEatenPercent ? parseInt(form.foodEatenPercent) : null,
      food_description: form.foodDescription,
      fluid_ml: form.fluidMl ? parseInt(form.fluidMl) : null,
      drinks: form.drinks.join(', '),
      texture_modified: form.textureModified,
      preferences_noted: form.preferences,
      concerns: form.mealConcerns,
    }) : null;

    await createNote.mutateAsync({
      residentId: form.residentId,
      noteType: form.noteType,
      content: form.content + ((form as any).commAids?.length ? ` Communication: ${(form as any).commAids.join(', ')}.` : ''),
      isSignificant: form.isSignificant,
      isPrivate: form.isPrivate,
      flagged: form.flagged,
      flagReason: form.flagReason || null,
      mood: form.mood || null,
      painScore: form.painScore ? parseInt(form.painScore) : null,
      vitalBpSystolic: form.vitalBpSystolic ? parseInt(form.vitalBpSystolic) : null,
      vitalBpDiastolic: form.vitalBpDiastolic ? parseInt(form.vitalBpDiastolic) : null,
      vitalHeartRate: form.vitalHeartRate ? parseInt(form.vitalHeartRate) : null,
      vitalTemp: form.vitalTemp ? parseFloat(form.vitalTemp) : null,
      vitalSpo2: form.vitalSpo2 ? parseInt(form.vitalSpo2) : null,
      vitalWeight: form.vitalWeight ? parseFloat(form.vitalWeight) : null,
      fluidIntakeMl: form.fluidIntakeMl ? parseInt(form.fluidIntakeMl) : null,
      fluidOutputMl: form.fluidOutputMl ? parseInt(form.fluidOutputMl) : null,
      foodEatenPercent: form.foodEatenPercent ? parseInt(form.foodEatenPercent) : null,
      position: form.position || null,
      writtenOnBehalfOf: form.writtenOnBehalfOf || null,
      coAuthors: form.coAuthors.length ? form.coAuthors : null,
      mealContext,
    });
    onClose();
  };

  const selectedResident = residents.find(r => r.id === form.residentId);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 760, width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h2 className="modal-title">New Care Note</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>

            {/* Resident + Type */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Resident *</label>
                <select className="form-input" required value={form.residentId} onChange={e => set('residentId', e.target.value)}>
                  <option value="">Select resident…</option>
                  {residents.map((r: Resident) => (
                    <option key={r.id} value={r.id}>{r.first_name} {r.last_name} — Room {r.room_number}</option>
                  ))}
                </select>
                {selectedResident?.care_needs_summary && (
                  <p className="form-hint" style={{ marginTop: 4 }}>
                    📋 {(selectedResident.care_needs_summary as string).slice(0, 120)}…
                  </p>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Note Type *</label>
                <select className="form-input" required value={form.noteType} onChange={e => set('noteType', e.target.value)}>
                  {NOTE_TYPES.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                </select>
              </div>
            </div>

            {/* Meal toggle for non-nutrition types */}
            {form.noteType !== 'nutrition' && (
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.87rem' }}>
                  <input type="checkbox" checked={form.isMealNote} onChange={e => set('isMealNote', e.target.checked)} />
                  Include meal / food & drink record
                </label>
              </div>
            )}

            {/* ── MEAL SECTION ───────────────────────────────────── */}
            {showMeal && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 12, color: 'var(--text-secondary)' }}>
                  🍽 Meal & Nutrition Record
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{tr('Meal')}</label>
                    <select className="form-input" value={form.meal} onChange={e => set('meal', e.target.value)}>
                      {Object.entries(MEAL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Time served</label>
                    <input className="form-input" type="time" value={form.mealTime} onChange={e => set('mealTime', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{tr('Appetite')}</label>
                    <select className="form-input" value={form.appetite} onChange={e => set('appetite', e.target.value)}>
                      <option value="">Select…</option>
                      {APPETITE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">% eaten (approx)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input className="form-input" type="range" min="0" max="100" step="10"
                        value={form.foodEatenPercent || '0'}
                        onChange={e => set('foodEatenPercent', e.target.value)}
                        style={{ flex: 1 }} />
                      <span style={{ fontWeight: 700, minWidth: 36 }}>{form.foodEatenPercent || 0}%</span>
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">What they ate</label>
                  <input className="form-input" value={form.foodDescription}
                    onChange={e => set('foodDescription', e.target.value)}
                    placeholder="e.g. Shepherd's pie, mashed potato, peas — soft diet" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Fluid intake (ml)</label>
                    <input className="form-input" type="number" min="0" max="2000"
                      value={form.fluidMl} onChange={e => set('fluidMl', e.target.value)}
                      placeholder="e.g. 250" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Texture modified</label>
                    <select className="form-input" value={form.textureModified} onChange={e => set('textureModified', e.target.value)}>
                      <option value="">None / Standard</option>
                      <option>IDDSI Level 3 – Liquidised</option>
                      <option>IDDSI Level 4 – Puréed</option>
                      <option>IDDSI Level 5 – Minced & Moist</option>
                      <option>IDDSI Level 6 – Soft & Bite-Sized</option>
                      <option>IDDSI Level 7 – Regular / Easy to Chew</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Drinks offered</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {DRINK_OPTIONS.map(d => (
                      <label key={d} style={{
                        fontSize: '0.82rem', padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
                        border: '1px solid var(--border)',
                        background: form.drinks.includes(d) ? 'var(--primary)' : 'white',
                        color: form.drinks.includes(d) ? 'white' : 'var(--text-primary)',
                      }}>
                        <input type="checkbox" checked={form.drinks.includes(d)} onChange={() => toggleDrink(d)} style={{ display: 'none' }} />
                        {d}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Food preferences / likes noted</label>
                  <input className="form-input" value={form.preferences}
                    onChange={e => set('preferences', e.target.value)}
                    placeholder="e.g. Enjoys porridge, dislikes fish, likes sweet tea" />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--danger)' }}>⚠ Concerns (choking, refusal, aspiration, etc.)</label>
                  <input className="form-input" value={form.mealConcerns}
                    onChange={e => set('mealConcerns', e.target.value)}
                    placeholder="e.g. Coughed repeatedly during meal — SALT referral discussed" />
                </div>
              </div>
            )}

            {/* ── VITALS SECTION ─────────────────────────────────── */}
            {showVitals && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 12, color: 'var(--text-secondary)' }}>
                  🩺 Observations (optional)
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">{tr('Mood')}</label>
                    <select className="form-input" value={form.mood} onChange={e => set('mood', e.target.value)}>
                      <option value="">—</option>
                      {MOOD_OPTIONS.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pain Score (0–10)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="range" min="0" max="10" value={form.painScore || '0'}
                        onChange={e => set('painScore', e.target.value)} style={{ flex: 1 }} />
                      <span style={{ fontWeight: 700, minWidth: 18 }}>{form.painScore || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">BP (Systolic / Diastolic)</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="form-input" type="number" placeholder="120" value={form.vitalBpSystolic} onChange={e => set('vitalBpSystolic', e.target.value)} />
                      <input className="form-input" type="number" placeholder="80" value={form.vitalBpDiastolic} onChange={e => set('vitalBpDiastolic', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Heart Rate (bpm)</label>
                    <input className="form-input" type="number" placeholder="72" value={form.vitalHeartRate} onChange={e => set('vitalHeartRate', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Temp (°C)</label>
                    <input className="form-input" type="number" step="0.1" placeholder="36.8" value={form.vitalTemp} onChange={e => set('vitalTemp', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">SpO₂ (%)</label>
                    <input className="form-input" type="number" placeholder="98" value={form.vitalSpo2} onChange={e => set('vitalSpo2', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Weight (kg)</label>
                    <input className="form-input" type="number" step="0.1" placeholder="65.0" value={form.vitalWeight} onChange={e => set('vitalWeight', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Fluid in (ml)</label>
                    <input className="form-input" type="number" value={form.fluidIntakeMl} onChange={e => set('fluidIntakeMl', e.target.value)} placeholder="1200" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fluid out (ml)</label>
                    <input className="form-input" type="number" value={form.fluidOutputMl} onChange={e => set('fluidOutputMl', e.target.value)} placeholder="900" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Position</label>
                    <select className="form-input" value={form.position} onChange={e => set('position', e.target.value)}>
                      <option value="">—</option>
                      {POSITION_OPTIONS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* ── NOTE TEXT ──────────────────────────────────────── */}
            <div className="form-group">
              <label className="form-label">Note *
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 8 }}>
                  Describe observations, care provided, resident response, any concerns
                </span>
              </label>
              <textarea
                className="form-input" required rows={5}
                placeholder={
                  form.noteType === 'personal_care'       ? "Morning care completed. Resident cooperative, skin intact…" :
                  form.noteType === 'continence'          ? "Resident assisted to toilet. Pad changed. Bowels opened — normal consistency…" :
                  form.noteType === 'nutrition'           ? "Good appetite — ate most of lunch. Thickened fluids given. No concerns…" :
                  form.noteType === 'repositioning'       ? "Repositioned left lateral. Skin intact, no redness. Hoist used…" :
                  form.noteType === 'nursing_observation' ? "Vital signs within normal limits. Resident comfortable and alert…" :
                  form.noteType === 'wound_care'          ? "Wound to sacrum reviewed. Grade 2 pressure ulcer. Dressing changed…" :
                  form.noteType === 'fall_observation'    ? "Resident found on floor in bedroom. No visible injuries. Post-fall obs completed…" :
                  form.noteType === 'activities'          ? "Resident participated in music session. Engaged well, mood lifted…" :
                  form.noteType === 'gp_visit'            ? "GP Dr Smith visited. Reviewed chest infection. Antibiotics prescribed…" :
                  form.noteType === 'family_update'       ? "Son visited this afternoon. Updated on resident's progress. Happy with care…" :
                  form.noteType === 'end_of_life'         ? "Resident comfortable. Family present at bedside. Syringe driver checked…" :
                  form.noteType === 'handover'            ? "Quiet shift. Resident in Rm 3 to monitor — reduced appetite today…" :
                  "Document your observations, care provided, resident response…"
                }
                value={form.content}
                onChange={e => set('content', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* ── CO-AUTHORING ───────────────────────────────────── */}
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 10, color: 'var(--text-secondary)' }}>
                ✍ Authorship &amp; Signature
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Writing on behalf of (optional)</label>
                  <select className="form-input" value={form.writtenOnBehalfOf} onChange={e => set('writtenOnBehalfOf', e.target.value)}>
                    <option value="">— Writing as myself —</option>
                    {staff.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.job_title || s.role})</option>
                    ))}
                  </select>
                  <p className="form-hint">Use when documenting care that another carer provided but couldn't record themselves.</p>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Co-authors — other staff present / contributed</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {staff.slice(0, 20).map((s: any) => (
                    <label key={s.id} style={{
                      fontSize: '0.8rem', padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
                      border: '1px solid var(--border)',
                      background: form.coAuthors.includes(s.id) ? 'var(--primary)' : 'white',
                      color: form.coAuthors.includes(s.id) ? 'white' : 'var(--text-primary)',
                    }}>
                      <input type="checkbox" style={{ display: 'none' }}
                        checked={form.coAuthors.includes(s.id)} onChange={() => toggleCoAuthor(s.id)} />
                      {s.first_name} {s.last_name}
                    </label>
                  ))}
                </div>
                <p className="form-hint">Select all staff who were present or contributed to this note.</p>
              </div>
            </div>

            {/* ── FLAGS & PRIVACY ────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.87rem' }}>
                <input type="checkbox" checked={form.isSignificant} onChange={e => set('isSignificant', e.target.checked)} />
                <span>⚠ Mark as <strong>Significant</strong> — requires manager review</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.87rem' }}>
                <input type="checkbox" checked={form.isPrivate} onChange={e => set('isPrivate', e.target.checked)} />
                <span>🔒 <strong>Private</strong> — not visible on family portal</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.87rem' }}>
                <input type="checkbox" checked={form.flagged} onChange={e => set('flagged', e.target.checked)} />
                <span style={{ color: 'var(--danger)' }}>🚩 <strong>Flag</strong> for immediate attention</span>
              </label>
              {form.flagged && (
                <input className="form-input" value={form.flagReason}
                  onChange={e => set('flagReason', e.target.value)}
                  placeholder="Reason for flagging (safeguarding concern, sudden deterioration…)" />
              )}
            </div>

          </div>

          {/* Footer with signature confirmation */}
          <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', flexDirection: 'column', gap: 10, alignItems: 'stretch' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', padding: '6px 0', borderTop: '1px dashed var(--border)' }}>
              ✍ By saving, you confirm this note is accurate and was recorded by you
              {form.writtenOnBehalfOf ? ` on behalf of the named carer` : ''}.
              This record is legally binding and stored permanently.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>{tr('Cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={createNote.isPending}>
                {createNote.isPending ? 'Saving…' : '✍ Sign & Save Note'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
