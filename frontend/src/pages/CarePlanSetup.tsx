// ────────────────────────────────────────────────────────────────────────────
// Care plan setup (v90): the home's own sections and fields.
//
// Sections: e.g. "Stoma care", "Diabetes", "Faith & culture" — added to any
// resident's plan from the plan itself, or to every new plan automatically.
// Fields: exact details on any area of the plan (built-in or the home's own),
// optionally shown to carers in "Know before you help".
// Nothing is ever deleted: a section or field is switched off, and anything
// already recorded with it stays on the record.
// ────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { Badge, Empty, PageHead, Tabs } from '../components/ds';
import { useCustomSetup, useCustomSetupMutations } from '../hooks';
import { DOMAIN_DETAILS } from '../shared/careDetails';

const BUILTIN: [string, string][] = [
  ['personal_care', 'Personal care & appearance'], ['mobility_transfers', 'Mobility & transfers'], ['nutrition_hydration', 'Eating & drinking'],
  ['continence', 'Continence'], ['skin_integrity', 'Skin integrity & pressure care'], ['medication', 'Medication'], ['pain', 'Pain & comfort'],
  ['breathing_circulation', 'Breathing & circulation'], ['communication_sensory', 'Communication, sight & hearing'],
  ['cognition_mental_health', 'Memory, mood & mental health'], ['behaviour_support', 'Behaviour & distress'],
  ['social_emotional', 'Social life, relationships & purpose'], ['night_care', 'Night-time care'], ['safety_risk', 'Safety & risk'],
  ['end_of_life', 'Wishes for the future'],
];
const NOTE_LABEL: Record<string, string> = {
  personal_care: 'Personal care', nutrition: 'Eating & drinking', continence: 'Continence', repositioning: 'Repositioning', sleep: 'Sleep',
  social_wellbeing: 'Wellbeing', behaviour: 'Behaviour', nursing_observation: 'Nursing observation', wound_care: 'Wound care',
  activities: 'Activities', end_of_life: 'End of life', medication_note: 'Medication note',
};
const TYPE_LABEL: Record<string, string> = { text: 'Text', select: 'Choose from a list', number: 'Number', bool: 'Yes / no', date: 'Date', list: 'A list of things' };

export default function CarePlanSetup() {
  const [tab, setTab] = useState<'sections' | 'fields'>('sections');
  const { sections, fields } = useCustomSetup();
  const types: any[] = sections.data?.types || [];
  const areas = useMemo(() => [...BUILTIN, ...types.filter(t => t.active).map(t => [t.domain_key, t.label] as [string, string])], [types]);
  return (
    <div className="page" style={{ display: 'grid', gap: 16 }}>
      <PageHead title="Care plan setup" sub="Add the home's own sections to care plans, and extra fields to any area. Your own assessments are built in the assessment builder."
        actions={<Link to="/assessment-builder" className="cv-btn cv-btn-secondary"><Icon name="list-checks" size={17} />Assessment builder</Link>} />
      <Tabs tabs={[{ key: 'sections', label: 'Sections', icon: 'clipboard-list', count: types.filter(t => t.active).length },
                   { key: 'fields', label: 'Extra fields', icon: 'pencil', count: (fields.data || []).filter((f: any) => f.active).length }]}
            value={tab} onChange={(k: string) => setTab(k as 'sections' | 'fields')} />
      {tab === 'sections' ? <SectionsTab types={types} icons={sections.data?.icons || []} noteTypes={sections.data?.noteTypes || []} />
        : <FieldsTab fields={fields.data || []} areas={areas} />}
    </div>
  );
}

function SectionsTab({ types, icons, noteTypes }: { types: any[]; icons: string[]; noteTypes: string[] }) {
  const m = useCustomSetupMutations();
  const [editing, setEditing] = useState<any | null>(null);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="cv-note cv-note-blue"><Icon name="info" size={16} />
        <span>Every care plan already has the 15 standard areas. Add a section for anything else the home needs to plan — it then appears under "Add one of the home's own sections" on any care plan, or on every new plan if you choose.</span></div>
      <div><button className="cv-btn cv-btn-primary" onClick={() => setEditing({ label: '', hint: '', icon: 'clipboard-list', noteType: 'personal_care', addToNewPlans: false })}><Icon name="plus" size={16} />New section</button></div>
      {types.length === 0 ? <div className="cv-card"><Empty icon="clipboard-list" title="No sections of your own yet">For example: Stoma care, Diabetes, Faith & culture, Dialysis, Hearing dog.</Empty></div> : (
        <div className="cv-plan-grid">
          {types.map(t => (
            <div key={t.id} className="cv-card cv-card-pad cv-need" style={{ opacity: t.active ? 1 : .6 }}>
              <div className="cv-need-head">
                <span className="cv-need-icon"><Icon name={(t.icon as IconName) || 'clipboard-list'} size={20} /></span>
                <h3>{t.label}</h3>
                {!t.active ? <Badge tone="grey">Switched off</Badge> : t.add_to_new_plans ? <Badge tone="green">On every new plan</Badge> : null}
              </div>
              {t.hint && <p className="cv-q-hint" style={{ margin: 0 }}>{t.hint}</p>}
              <div className="cv-q-hint">Round notes: {NOTE_LABEL[t.note_type] || t.note_type}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="cv-btn cv-btn-secondary" style={{ minHeight: 38 }} onClick={() => setEditing({ id: t.id, label: t.label, hint: t.hint || '', icon: t.icon, noteType: t.note_type, addToNewPlans: t.add_to_new_plans, active: t.active })}><Icon name="pencil" size={16} />Edit</button>
                <button className="cv-btn cv-btn-quiet" style={{ minHeight: 38 }} onClick={() => m.updateSection.mutate({ id: t.id, label: t.label, hint: t.hint, icon: t.icon, noteType: t.note_type, addToNewPlans: t.add_to_new_plans, active: !t.active })}>
                  {t.active ? 'Switch off' : 'Switch on'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="modal">
            <div className="modal-header"><h2 className="modal-title">{editing.id ? 'Edit section' : 'New section'}</h2>
              <button className="modal-close" onClick={() => setEditing(null)} aria-label="Close"><Icon name="x" size={18} /></button></div>
            <div className="modal-body" style={{ padding: 20, display: 'grid', gap: 12 }}>
              <label className="form-label">Name<input className="form-input" style={{ width: '100%', marginTop: 4 }} value={editing.label} maxLength={80} onChange={e => setEditing({ ...editing, label: e.target.value })} placeholder="e.g. Stoma care" /></label>
              <label className="form-label">What to cover (shown as a hint)<textarea className="form-input" rows={2} style={{ width: '100%', marginTop: 4 }} value={editing.hint} onChange={e => setEditing({ ...editing, hint: e.target.value })} placeholder="e.g. Type of stoma, appliance and size, how often changed, skin care, who to call." /></label>
              <label className="form-label">Picture
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {icons.map(i => (
                    <button key={i} type="button" className={`cv-opt${editing.icon === i ? ' selected' : ''}`} style={{ minHeight: 40, width: 46, justifyContent: 'center', padding: 0 }} onClick={() => setEditing({ ...editing, icon: i })} aria-label={i}>
                      <Icon name={i as IconName} size={18} />
                    </button>
                  ))}
                </div>
              </label>
              <label className="form-label">When carers record times from this section on the round, the note is
                <select className="form-input" style={{ width: '100%', marginTop: 4 }} value={editing.noteType} onChange={e => setEditing({ ...editing, noteType: e.target.value })}>
                  {noteTypes.map(n => <option key={n} value={n}>{NOTE_LABEL[n] || n}</option>)}
                </select></label>
              <button type="button" className={`cv-opt${editing.addToNewPlans ? ' selected' : ''}`} onClick={() => setEditing({ ...editing, addToNewPlans: !editing.addToNewPlans })}>
                <span className="cv-opt-box">{editing.addToNewPlans && <Icon name="check" size={13} />}</span><span>Add to every new care plan automatically</span>
              </button>
            </div>
            <div className="modal-footer">
              <button className="cv-btn cv-btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="cv-btn cv-btn-primary" disabled={editing.label.trim().length < 2 || m.createSection.isPending || m.updateSection.isPending}
                onClick={() => (editing.id ? m.updateSection : m.createSection).mutate(editing, { onSuccess: () => setEditing(null) })}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldsTab({ fields, areas }: { fields: any[]; areas: [string, string][] }) {
  const m = useCustomSetupMutations();
  const [editing, setEditing] = useState<any | null>(null);
  const areaLabel = (k: string) => areas.find(a => a[0] === k)?.[1] || k;
  const blank = { domain: areas[0]?.[0] || 'personal_care', definition: { label: '', type: 'text', options: '', unit: '', hint: '', fact: false, tone: 'info' } };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="cv-note cv-note-blue"><Icon name="info" size={16} />
        <span>Extra fields appear under "Key details" on that area of every care plan. Tick "Show to carers" for anything they must know before helping — it then appears in "Know before you help". Once a field exists, its kind of answer cannot change, and choices can be added but not removed, so what is already recorded stays meaningful.</span></div>
      <div><button className="cv-btn cv-btn-primary" onClick={() => setEditing(blank)}><Icon name="plus" size={16} />New field</button></div>
      {fields.length === 0 ? <div className="cv-card"><Empty icon="pencil" title="No extra fields yet">For example on Continence: "Stoma appliance and size"; on Communication: "Preferred name for their condition".</Empty></div> : (
        <div className="cv-card cv-card-pad table-container">
          <table>
            <thead><tr><th>Area</th><th>Field</th><th>Kind</th><th>Carers see it</th><th></th></tr></thead>
            <tbody>
              {fields.map(f => (
                <tr key={f.id} style={{ opacity: f.active ? 1 : .6 }}>
                  <td>{areaLabel(f.domain)}</td>
                  <td><strong>{f.definition.label}</strong>{f.definition.hint && <div className="cv-q-hint">{f.definition.hint}</div>}</td>
                  <td>{TYPE_LABEL[f.definition.type]}{f.definition.type === 'select' ? `: ${(f.definition.options || []).join(', ')}` : ''}</td>
                  <td>{f.definition.fact ? <Badge tone={f.definition.tone === 'red' ? 'red' : f.definition.tone === 'amber' ? 'amber' : 'grey'}>Yes</Badge> : '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="cv-btn cv-btn-quiet" style={{ minHeight: 32 }} onClick={() => setEditing({ id: f.id, domain: f.domain, definition: { ...f.definition, options: (f.definition.options || []).join('\n') } })}>Edit</button>
                    <button className="cv-btn cv-btn-quiet" style={{ minHeight: 32 }} onClick={() => m.updateField.mutate({ id: f.id, definition: f.definition, active: !f.active })}>{f.active ? 'Switch off' : 'Switch on'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="modal">
            <div className="modal-header"><h2 className="modal-title">{editing.id ? 'Edit field' : 'New field'}</h2>
              <button className="modal-close" onClick={() => setEditing(null)} aria-label="Close"><Icon name="x" size={18} /></button></div>
            <div className="modal-body" style={{ padding: 20, display: 'grid', gap: 12 }}>
              <label className="form-label">Area of the care plan
                <select className="form-input" style={{ width: '100%', marginTop: 4 }} value={editing.domain} disabled={!!editing.id} onChange={e => setEditing({ ...editing, domain: e.target.value })}>
                  {areas.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                {!editing.id && DOMAIN_DETAILS[editing.domain]?.length ? <span className="cv-q-hint">Already there: {DOMAIN_DETAILS[editing.domain].map(f => f.label).join(', ')}.</span> : null}
              </label>
              <label className="form-label">Field name<input className="form-input" style={{ width: '100%', marginTop: 4 }} maxLength={80} value={editing.definition.label} onChange={e => setEditing({ ...editing, definition: { ...editing.definition, label: e.target.value } })} /></label>
              <label className="form-label">Kind of answer
                <select className="form-input" style={{ width: '100%', marginTop: 4 }} value={editing.definition.type} disabled={!!editing.id} onChange={e => setEditing({ ...editing, definition: { ...editing.definition, type: e.target.value } })}>
                  {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select></label>
              {editing.definition.type === 'select' && (
                <label className="form-label">Choices, one per line<textarea className="form-input" rows={4} style={{ width: '100%', marginTop: 4 }} value={editing.definition.options} onChange={e => setEditing({ ...editing, definition: { ...editing.definition, options: e.target.value } })} /></label>
              )}
              {editing.definition.type === 'number' && (
                <label className="form-label">Unit (optional)<input className="form-input" style={{ width: 160, marginTop: 4 }} value={editing.definition.unit || ''} onChange={e => setEditing({ ...editing, definition: { ...editing.definition, unit: e.target.value } })} placeholder="e.g. ml" /></label>
              )}
              <label className="form-label">Hint (optional)<input className="form-input" style={{ width: '100%', marginTop: 4 }} maxLength={160} value={editing.definition.hint || ''} onChange={e => setEditing({ ...editing, definition: { ...editing.definition, hint: e.target.value } })} /></label>
              <button type="button" className={`cv-opt${editing.definition.fact ? ' selected' : ''}`} onClick={() => setEditing({ ...editing, definition: { ...editing.definition, fact: !editing.definition.fact } })}>
                <span className="cv-opt-box">{editing.definition.fact && <Icon name="check" size={13} />}</span><span>Show to carers in "Know before you help"</span>
              </button>
              {editing.definition.fact && (
                <div className="cv-seg" role="radiogroup">
                  {[['red', 'Red — could cause serious harm if missed'], ['amber', 'Amber — important'], ['info', 'Plain']].map(([k, l]) => (
                    <button key={k} role="radio" aria-checked={editing.definition.tone === k} className={editing.definition.tone === k ? 'active' : ''} onClick={() => setEditing({ ...editing, definition: { ...editing.definition, tone: k } })}>{l}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="cv-btn cv-btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="cv-btn cv-btn-primary" disabled={editing.definition.label.trim().length < 2 || m.createField.isPending || m.updateField.isPending}
                onClick={() => (editing.id ? m.updateField.mutate({ id: editing.id, definition: editing.definition }, { onSuccess: () => setEditing(null) })
                  : m.createField.mutate({ domain: editing.domain, definition: editing.definition }, { onSuccess: () => setEditing(null) }))}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
