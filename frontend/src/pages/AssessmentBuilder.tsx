// ────────────────────────────────────────────────────────────────────────────
// Assessment builder (v90): the home's own assessments.
//
// Questions (yes/no, choose one, choose any, number, text, date), points for
// answers, score bands with what to do and when to review, a warning on any
// answer, and what carers should see. Try it as you build. Publishing checks
// it and freezes that version; changing it later makes a new version, so a
// completed assessment always shows exactly what was asked and scored.
// Every one is labelled as the home's own — not a validated scale.
// ────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Badge, Empty, PageHead } from '../components/ds';
import { useCustomTools, useCustomToolMutations } from '../hooks';
import { validateCustomTool, customToTool, maxScore, type CustomToolDef, type CustomQuestionDef, type CustomBandDef } from '../shared/customAssessments';
import type { Answers, Answer } from '../shared/assessmentCore';
import { QuestionView, ResultSummary, ResultDetail } from '../components/AssessmentRunner';
import { formatDate } from '../utils/formatters';

const BUILTIN_AREAS: [string, string][] = [
  ['personal_care', 'Personal care & appearance'], ['mobility_transfers', 'Mobility & transfers'], ['nutrition_hydration', 'Eating & drinking'],
  ['continence', 'Continence'], ['skin_integrity', 'Skin integrity & pressure care'], ['medication', 'Medication'], ['pain', 'Pain & comfort'],
  ['breathing_circulation', 'Breathing & circulation'], ['communication_sensory', 'Communication, sight & hearing'],
  ['cognition_mental_health', 'Memory, mood & mental health'], ['behaviour_support', 'Behaviour & distress'],
  ['social_emotional', 'Social life, relationships & purpose'], ['night_care', 'Night-time care'], ['safety_risk', 'Safety & risk'],
  ['end_of_life', 'Wishes for the future'],
];
const QTYPE: Record<CustomQuestionDef['type'], string> = { yesno: 'Yes / no', choice: 'Choose one', multi: 'Choose any', number: 'Number', text: 'Text', date: 'Date' };

const starter = (): CustomToolDef => ({
  name: '', shortName: '', purpose: '', who: '', domain: 'safety_risk', scored: true, whenNeeded: '',
  sections: [{ title: 'Questions', questions: [{ key: 'q1', label: '', type: 'yesno', options: [{ value: 'yes', label: 'Yes', points: 1 }, { value: 'no', label: 'No', points: 0 }] }] }],
  bands: [
    { from: 0, label: 'Low', level: 'low', actions: ['Routine care. Review as planned.'], reviewDays: 90 },
    { from: 1, label: 'Some risk', level: 'medium', actions: [''], reviewDays: 28 },
  ],
});

export default function AssessmentBuilder() {
  const { data, isLoading } = useCustomTools();
  const m = useCustomToolMutations();
  const [editing, setEditing] = useState<{ id: string; def: CustomToolDef; version: number } | null>(null);
  const families: any[] = data?.families || [];
  const areas: [string, string][] = [...BUILTIN_AREAS, ...((data?.sectionTypes || []) as any[]).map(t => [t.key, t.label] as [string, string])];
  const domains: string[] = data?.domains || areas.map(a => a[0]);

  const startNew = () => m.create.mutate(starter(), { onSuccess: (d: any) => setEditing({ id: d.id, def: d.definition, version: d.version }) });

  return (
    <div className="page" style={{ display: 'grid', gap: 16 }}>
      <PageHead title="Assessment builder" sub="Build the home's own assessments. They appear with the built-in ones — on the resident, in the register and on the care plan — clearly marked as the home's own, not validated scales."
        actions={<><Link to="/care-plan-setup" className="cv-btn cv-btn-secondary"><Icon name="settings" size={17} />Care plan setup</Link>
          <button className="cv-btn cv-btn-primary" onClick={startNew} disabled={m.create.isPending}><Icon name="plus" size={17} />New assessment</button></>} />
      <div className="cv-note cv-note-amber"><Icon name="triangle-alert" size={16} />
        <span>Before using one with residents, have a nurse or clinical lead check the questions, points and actions. Where a validated tool exists for the same purpose (e.g. Waterlow, MUST, 4AT), use that instead.</span></div>
      {isLoading ? <div className="cv-card cv-card-pad">Loading…</div> : families.length === 0 ? (
        <div className="cv-card"><Empty icon="list-checks" title="No assessments of your own yet">For example: a stoma check, a diabetic foot check, a sun-safety check, or your local smoking agreement.</Empty></div>
      ) : (
        <div className="cv-plan-grid">
          {families.map(f => {
            const live = f.live, draft = f.draft;
            return (
              <div key={f.familyId} className="cv-card cv-card-pad cv-need">
                <div className="cv-need-head">
                  <span className="cv-need-icon"><Icon name="list-checks" size={20} /></span>
                  <h3>{f.name || 'Untitled'}</h3>
                  {live ? <Badge tone="green">Live v{live.version}</Badge> : <Badge tone="grey">Not live</Badge>}
                </div>
                {live && <div className="cv-q-hint">Published {formatDate(live.publishedAt)}{live.publishedByName ? ` by ${live.publishedByName}` : ''} · used {live.used} time{live.used === 1 ? '' : 's'}</div>}
                {draft && <div className="cv-q-hint" style={{ color: 'var(--amber-700)' }}>Draft v{draft.version} in progress</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {draft ? (
                    <button className="cv-btn cv-btn-primary" style={{ minHeight: 38 }} onClick={() => setEditing({ id: draft.id, def: draft.definition, version: draft.version })}><Icon name="pencil" size={16} />Edit draft</button>
                  ) : live && (
                    <button className="cv-btn cv-btn-secondary" style={{ minHeight: 38 }} onClick={() => m.newVersion.mutate(live.id, { onSuccess: (d: any) => setEditing({ id: d.id, def: d.definition, version: d.version }) })}><Icon name="pencil" size={16} />Change (new version)</button>
                  )}
                  {live && <button className="cv-btn cv-btn-quiet" style={{ minHeight: 38 }} onClick={() => { if (window.confirm('Retire this assessment? It will no longer be offered. Completed ones stay on the record.')) m.retire.mutate(live.id); }}>Retire</button>}
                  {draft && <button className="cv-btn cv-btn-quiet" style={{ minHeight: 38 }} onClick={() => { if (window.confirm('Delete this draft?')) m.remove.mutate(draft.id); }}>Delete draft</button>}
                </div>
                {f.versions.length > 1 && <div className="cv-q-hint">Versions: {f.versions.map((v: any) => `v${v.version} ${v.status}`).join(' · ')}</div>}
              </div>
            );
          })}
        </div>
      )}
      {editing && <Editor key={editing.id} id={editing.id} version={editing.version} initial={editing.def} areas={areas} domains={domains} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Editor({ id, version, initial, areas, domains, onClose }: { id: string; version: number; initial: CustomToolDef; areas: [string, string][]; domains: string[]; onClose: () => void }) {
  const m = useCustomToolMutations();
  const [def, setDef] = useState<CustomToolDef>(() => JSON.parse(JSON.stringify(initial)));
  const [trying, setTrying] = useState(false);
  const problems = useMemo(() => validateCustomTool(def, domains), [def, domains]);
  const top = useMemo(() => maxScore(def), [def]);
  const set = (patch: Partial<CustomToolDef>) => setDef(d => ({ ...d, ...patch }));
  const allQ = def.sections.flatMap(s => s.questions);
  const nextKey = () => `q${Math.max(0, ...allQ.map(q => Number(q.key.replace(/^q/, '')) || 0)) + 1}`;
  const setQ = (si: number, qi: number, patch: Partial<CustomQuestionDef>) => setDef(d => {
    const sections = d.sections.map((s, i) => i !== si ? s : { ...s, questions: s.questions.map((q, j) => j !== qi ? q : { ...q, ...patch }) });
    return { ...d, sections };
  });
  const move = (si: number, qi: number, by: number) => setDef(d => {
    const qs = [...d.sections[si].questions]; const [x] = qs.splice(qi, 1); qs.splice(Math.max(0, Math.min(qs.length, qi + by)), 0, x);
    return { ...d, sections: d.sections.map((s, i) => i === si ? { ...s, questions: qs } : s) };
  });
  const save = (then?: () => void) => m.update.mutate({ id, definition: def }, { onSuccess: () => then?.() });

  return (
    <div className="modal-overlay">
      <div className="modal cv-runner" style={{ maxHeight: '96dvh' }}>
        <div className="modal-header">
          <div><h2 className="modal-title">{def.name || 'New assessment'} — draft v{version}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Saved as a draft until you publish. Published versions never change.</div></div>
          <button className="modal-close" onClick={() => { if (window.confirm('Close? Unsaved changes will be lost.')) onClose(); }} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="cv-runner-main" style={{ display: 'grid', gap: 16 }}>
            <section className="cv-card cv-card-pad" style={{ display: 'grid', gap: 10 }}>
              <h3 className="cv-section-title" style={{ margin: 0 }}>About it</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <label className="form-label">Name<input className="form-input" style={{ width: '100%' }} maxLength={80} value={def.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Stoma care check" /></label>
                <label className="form-label">Short name (for columns)<input className="form-input" style={{ width: '100%' }} maxLength={24} value={def.shortName} onChange={e => set({ shortName: e.target.value })} placeholder="e.g. Stoma" /></label>
              </div>
              <label className="form-label">What it is for<textarea className="form-input" rows={2} style={{ width: '100%' }} value={def.purpose} onChange={e => set({ purpose: e.target.value })} /></label>
              <label className="form-label">Who completes it, and when<textarea className="form-input" rows={2} style={{ width: '100%' }} value={def.who} onChange={e => set({ who: e.target.value })} placeholder="e.g. A nurse, weekly, and whenever the stoma changes." /></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label className="form-label">Area of the care plan
                  <select className="form-input" style={{ width: '100%' }} value={def.domain} onChange={e => set({ domain: e.target.value })}>
                    {areas.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select></label>
                <label className="form-label">Only for some people? Say who (leave blank if for everyone)
                  <input className="form-input" style={{ width: '100%' }} value={def.whenNeeded || ''} onChange={e => set({ whenNeeded: e.target.value })} placeholder="e.g. For anyone with a stoma" /></label>
              </div>
              <div className="cv-seg" role="radiogroup">
                <button role="radio" aria-checked={def.scored} className={def.scored ? 'active' : ''} onClick={() => set({ scored: true })}>Scored (points and bands)</button>
                <button role="radio" aria-checked={!def.scored} className={!def.scored ? 'active' : ''} onClick={() => set({ scored: false, bands: [def.bands[0] || { from: 0, label: 'Done', level: 'low', actions: [''], reviewDays: 28 }] })}>Not scored (a checklist)</button>
              </div>
            </section>

            {def.sections.map((s, si) => (
              <section key={si} className="cv-card cv-card-pad" style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="form-input" style={{ flex: 1, fontWeight: 650 }} value={s.title} onChange={e => setDef(d => ({ ...d, sections: d.sections.map((x, i) => i === si ? { ...x, title: e.target.value } : x) }))} aria-label="Section title" />
                  {def.sections.length > 1 && <button className="cv-btn cv-btn-quiet" style={{ minHeight: 34 }} onClick={() => setDef(d => ({ ...d, sections: d.sections.filter((_, i) => i !== si) }))}>Remove section</button>}
                </div>
                <input className="form-input" value={s.intro || ''} onChange={e => setDef(d => ({ ...d, sections: d.sections.map((x, i) => i === si ? { ...x, intro: e.target.value } : x) }))} placeholder="Instructions for this section (optional)" />
                {s.questions.map((q, qi) => (
                  <QuestionEditor key={q.key} q={q} scored={def.scored}
                    onChange={p => setQ(si, qi, p)}
                    onMove={by => move(si, qi, by)}
                    onRemove={() => setDef(d => ({ ...d, sections: d.sections.map((x, i) => i === si ? { ...x, questions: x.questions.filter((_, j) => j !== qi) } : x) }))} />
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="cv-btn cv-btn-secondary" style={{ minHeight: 38 }} onClick={() => setDef(d => ({ ...d, sections: d.sections.map((x, i) => i === si ? { ...x, questions: [...x.questions, { key: nextKey(), label: '', type: 'yesno', options: [{ value: 'yes', label: 'Yes', points: 0 }, { value: 'no', label: 'No', points: 0 }] }] } : x) }))}>
                    <Icon name="plus" size={16} />Add a question</button>
                </div>
              </section>
            ))}
            <div><button className="cv-btn cv-btn-quiet" onClick={() => setDef(d => ({ ...d, sections: [...d.sections, { title: 'More questions', questions: [{ key: nextKey(), label: '', type: 'yesno', options: [{ value: 'yes', label: 'Yes', points: 0 }, { value: 'no', label: 'No', points: 0 }] }] }] }))}><Icon name="plus" size={16} />Add a section of questions</button></div>

            <section className="cv-card cv-card-pad" style={{ display: 'grid', gap: 10 }}>
              <h3 className="cv-section-title" style={{ margin: 0 }}>{def.scored ? `Score bands (highest possible score: ${top})` : 'Outcome'}</h3>
              {def.bands.map((b, bi) => (
                <BandEditor key={bi} b={b} scored={def.scored} first={bi === 0}
                  onChange={p => setDef(d => ({ ...d, bands: d.bands.map((x, i) => i === bi ? { ...x, ...p } : x) }))}
                  onRemove={def.scored && def.bands.length > 1 ? () => setDef(d => ({ ...d, bands: d.bands.filter((_, i) => i !== bi) })) : undefined} />
              ))}
              {def.scored && def.bands.length < 6 && (
                <div><button className="cv-btn cv-btn-secondary" style={{ minHeight: 38 }} onClick={() => setDef(d => ({ ...d, bands: [...d.bands, { from: (Number(d.bands[d.bands.length - 1]?.from) || 0) + 1, label: '', level: 'high', actions: [''], reviewDays: 7 }] }))}><Icon name="plus" size={16} />Add a band</button></div>
              )}
            </section>
          </div>
          <aside className="cv-runner-side">
            <div className="cv-card cv-card-pad" style={{ display: 'grid', gap: 6 }}>
              <div className="cv-eyebrow">Ready to publish?</div>
              {problems.length === 0 ? <div className="cv-note cv-note-green"><Icon name="check" size={16} /><span>Yes — everything needed is there.</span></div>
                : <ul className="cv-list-tight">{problems.slice(0, 12).map(p => <li key={p}>{p}</li>)}{problems.length > 12 && <li>…and {problems.length - 12} more</li>}</ul>}
            </div>
            <button className="cv-btn cv-btn-secondary" onClick={() => setTrying(true)} disabled={!allQ.length}><Icon name="clipboard-check" size={16} />Try it</button>
          </aside>
        </div>
        <div className="modal-footer">
          <button className="cv-btn cv-btn-secondary" onClick={() => save(onClose)} disabled={m.update.isPending}>Save draft and close</button>
          <span style={{ flex: 1 }} />
          <button className="cv-btn cv-btn-primary" disabled={problems.length > 0 || m.update.isPending || m.publish.isPending}
            onClick={() => { if (window.confirm('Publish this version? It will be frozen; later changes make a new version.')) save(() => m.publish.mutate(id, { onSuccess: onClose })); }}>
            <Icon name="check" size={16} />Publish</button>
        </div>
      </div>
      {trying && <TryIt def={def} onClose={() => setTrying(false)} />}
    </div>
  );
}

function QuestionEditor({ q, scored, onChange, onMove, onRemove }: { q: CustomQuestionDef; scored: boolean; onChange: (p: Partial<CustomQuestionDef>) => void; onMove: (by: number) => void; onRemove: () => void }) {
  const opts = q.options || [];
  const nextVal = () => `o${Math.max(0, ...opts.map(o => Number(String(o.value).replace(/^o/, '')) || 0)) + 1}`;
  const setType = (type: CustomQuestionDef['type']) => {
    if (type === 'yesno') onChange({ type, options: [{ value: 'yes', label: 'Yes', points: 0 }, { value: 'no', label: 'No', points: 0 }] });
    else if (type === 'choice' || type === 'multi') onChange({ type, options: opts.length >= 2 && q.type !== 'yesno' ? opts : [{ value: 'o1', label: '', points: 0 }, { value: 'o2', label: '', points: 0 }] });
    else onChange({ type, options: undefined });
  };
  const setOpt = (i: number, p: any) => onChange({ options: opts.map((o, j) => j === i ? { ...o, ...p } : o) });
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 10, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input className="form-input" style={{ flex: '1 1 260px' }} value={q.label} onChange={e => onChange({ label: e.target.value })} placeholder="The question" aria-label="Question" />
        <select className="form-input" style={{ width: 150 }} value={q.type} onChange={e => setType(e.target.value as any)} aria-label="Kind of answer">
          {Object.entries(QTYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button className="cv-btn cv-btn-quiet" style={{ minHeight: 34, padding: '4px 8px' }} onClick={() => onMove(-1)} aria-label="Move up">↑</button>
        <button className="cv-btn cv-btn-quiet" style={{ minHeight: 34, padding: '4px 8px' }} onClick={() => onMove(1)} aria-label="Move down">↓</button>
        <button className="cv-btn cv-btn-quiet" style={{ minHeight: 34, padding: '4px 8px' }} onClick={onRemove} aria-label="Remove question"><Icon name="x" size={16} /></button>
      </div>
      <input className="form-input" value={q.hint || ''} onChange={e => onChange({ hint: e.target.value })} placeholder="Hint (optional)" />
      {(q.type === 'choice' || q.type === 'multi' || q.type === 'yesno') && (
        <div style={{ display: 'grid', gap: 6 }}>
          {opts.map((o, i) => (
            <div key={o.value} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="form-input" style={{ flex: '1 1 180px' }} value={o.label} disabled={q.type === 'yesno'} onChange={e => setOpt(i, { label: e.target.value })} placeholder={`Answer ${i + 1}`} />
              {scored && <input className="form-input" type="number" min={0} max={100} style={{ width: 80 }} value={o.points ?? 0} onChange={e => setOpt(i, { points: e.target.value === '' ? 0 : Number(e.target.value) })} aria-label="Points" title="Points" />}
              <input className="form-input" style={{ flex: '1 1 200px' }} value={o.alert || ''} onChange={e => setOpt(i, { alert: e.target.value || undefined })} placeholder="Warning if chosen (optional)" />
              {q.type !== 'yesno' && opts.length > 2 && <button className="cv-btn cv-btn-quiet" style={{ minHeight: 32, padding: '2px 6px' }} onClick={() => onChange({ options: opts.filter((_, j) => j !== i) })} aria-label="Remove answer"><Icon name="x" size={14} /></button>}
            </div>
          ))}
          {q.type !== 'yesno' && <div><button className="cv-btn cv-btn-quiet" style={{ minHeight: 32 }} onClick={() => onChange({ options: [...opts, { value: nextVal(), label: '', points: 0 }] })}><Icon name="plus" size={14} />Add an answer</button></div>}
        </div>
      )}
      {q.type === 'number' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-input" style={{ width: 110 }} value={q.unit || ''} onChange={e => onChange({ unit: e.target.value || undefined })} placeholder="Unit" />
          <input className="form-input" type="number" style={{ width: 110 }} value={q.min ?? ''} onChange={e => onChange({ min: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="Lowest" />
          <input className="form-input" type="number" style={{ width: 110 }} value={q.max ?? ''} onChange={e => onChange({ max: e.target.value === '' ? undefined : Number(e.target.value) })} placeholder="Highest" />
        </div>
      )}
      <button type="button" className={`cv-opt${q.optional ? ' selected' : ''}`} style={{ minHeight: 36, padding: '4px 10px' }} onClick={() => onChange({ optional: !q.optional })}>
        <span className="cv-opt-box">{q.optional && <Icon name="check" size={13} />}</span><span>Optional</span>
      </button>
    </div>
  );
}

function BandEditor({ b, scored, first, onChange, onRemove }: { b: CustomBandDef; scored: boolean; first: boolean; onChange: (p: Partial<CustomBandDef>) => void; onRemove?: () => void }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 10, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {scored && <label className="form-label" style={{ margin: 0 }}>From score<input className="form-input" type="number" min={0} style={{ width: 90, marginLeft: 6 }} value={b.from} disabled={first} onChange={e => onChange({ from: Number(e.target.value) })} /></label>}
        <input className="form-input" style={{ flex: '1 1 160px' }} value={b.label} onChange={e => onChange({ label: e.target.value })} placeholder={scored ? 'Band name, e.g. High risk' : 'Outcome, e.g. Checked'} />
        <select className="form-input" style={{ width: 120 }} value={b.level} onChange={e => onChange({ level: e.target.value as any })} aria-label="Level">
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
        <label className="form-label" style={{ margin: 0 }}>Review in<input className="form-input" type="number" min={1} max={730} style={{ width: 80, margin: '0 6px' }} value={b.reviewDays} onChange={e => onChange({ reviewDays: Number(e.target.value) })} />days</label>
        {onRemove && <button className="cv-btn cv-btn-quiet" style={{ minHeight: 32, padding: '2px 6px' }} onClick={onRemove} aria-label="Remove band"><Icon name="x" size={14} /></button>}
      </div>
      <textarea className="form-input" rows={3} value={b.actions.join('\n')} onChange={e => onChange({ actions: e.target.value.split('\n') })} placeholder="What to do — one action per line" />
      <input className="form-input" maxLength={120} value={b.fact || ''} onChange={e => onChange({ fact: e.target.value || undefined })} placeholder="What carers should see before helping (optional, short)" />
    </div>
  );
}

function TryIt({ def, onClose }: { def: CustomToolDef; onClose: () => void }) {
  const tool = useMemo(() => customToTool(def, { key: 'custom:preview', version: 0 }), [def]);
  const [a, setA] = useState<Answers>({});
  const r = tool.evaluate(a, {});
  const set = (k: string, v: Answer) => setA(x => { const n = { ...x }; if (v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete n[k]; else n[k] = v; return n; });
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal cv-runner" style={{ maxHeight: '94dvh' }}>
        <div className="modal-header"><div><h2 className="modal-title">Try it — {def.name || 'draft'}</h2><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing is saved.</div></div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button></div>
        <div className="modal-body">
          <div className="cv-runner-main">
            {tool.sections.map(s => (
              <div key={s.key}><h3 className="cv-section-title" style={{ marginTop: 12 }}>{s.title}</h3>
                {s.intro && <p className="cv-q-hint">{s.intro}</p>}
                {s.questions.map(q => <QuestionView key={q.key} q={q} value={a[q.key]} scored={tool.scored} fromRecord={false} missing={r.missing.includes(q.key)} onChange={v => set(q.key, v)} />)}
              </div>
            ))}
          </div>
          <aside className="cv-runner-side">
            <ResultSummary result={r} scored={tool.scored} />
            {r.warnings.map(w => <div key={w} className="cv-note cv-note-amber"><Icon name="triangle-alert" size={16} /><span>{w}</span></div>)}
            <div className="cv-runner-extra"><ResultDetail result={r} toolKey={tool.key} /></div>
          </aside>
        </div>
        <div className="modal-footer"><button className="cv-btn cv-btn-secondary" onClick={() => setA({})}>Clear</button><button className="cv-btn cv-btn-primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
