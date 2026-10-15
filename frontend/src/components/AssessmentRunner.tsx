// ────────────────────────────────────────────────────────────────────────────
// Complete one assessment, step by step, with the result building as you go.
//
// The same tool definitions as the server (shared/assessmentTools.ts), so what
// the nurse sees is exactly what will be stored. Answers the record already
// holds (age, weight, room…) are suggested and marked "from the record" — the
// assessor confirms each one. Nothing is saved until every question is
// answered, nothing contradicts, and they have said how the person was
// involved. Then they choose what goes into the care plan.
// ────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import { Badge } from './ds';
import { useAssessmentContext, useCreateAssessment, useApplyAssessment } from '../hooks';
import { TOOLS, LEVEL_LABEL, type Answers, type Answer, type Question, type ToolKey, type Result, type Tool } from '../shared/assessmentTools';
import { customToTool } from '../shared/customAssessments';
import { formatDate } from '../utils/formatters';

export const REASON_LABEL: Record<string, string> = {
  admission: 'On admission', scheduled: 'Planned review', change: 'Their needs changed',
  after_fall: 'After a fall', after_hospital: 'Back from hospital', other: 'Other',
};

export function levelTone(level?: string | null): 'red' | 'amber' | 'green' | 'blue' | 'grey' {
  if (!level) return 'grey';
  if (['high', 'very_high', 'severe'].includes(level)) return 'red';
  if (['medium', 'moderate', 'mild'].includes(level)) return 'amber';
  if (['low', 'none'].includes(level)) return 'green';
  return 'blue';
}

function isSet(v: Answer): boolean {
  return !(v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0));
}

/** The Tool for a key: built-in, or one of the home's own (pass `custom` definitions). */
export function toolFor(type: string, custom?: { key: string; version: number; definition: any }[]): Tool | null {
  if (type in TOOLS) return TOOLS[type as ToolKey];
  const c = (custom || []).find(x => x.key === type);
  return c ? customToTool(c.definition, { key: c.key, version: c.version }) : null;
}

export function AssessmentRunner({ residentId, residentName, type, previous, onClose, tool: given }: {
  residentId: string; residentName: string; type: string; previous?: any; onClose: () => void;
  /** For the home's own assessments (v90). */
  tool?: Tool;
}) {
  const tool = (given || TOOLS[type as ToolKey]) as Tool;
  const { data: ctx } = useAssessmentContext(residentId);
  const save = useCreateAssessment();
  const [answers, setAnswers] = useState<Answers>({});
  const [fromRecord, setFromRecord] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState(previous ? 'scheduled' : 'admission');
  const [involvement, setInvolvement] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState<any>(null);
  const [prefilled, setPrefilled] = useState(false);

  // Suggest what the record already knows, once.
  useEffect(() => {
    if (prefilled || !ctx || !tool.prefill) return;
    const p = tool.prefill(ctx);
    setAnswers(a => ({ ...p, ...a }));
    setFromRecord(Object.fromEntries(Object.keys(p).map(k => [k, true])));
    setPrefilled(true);
  }, [ctx, tool, prefilled]);

  const result: Result = useMemo(() => tool.evaluate(answers, ctx || {}), [tool, answers, ctx]);
  const sections = tool.sections;
  const reviewStep = sections.length;
  const onReview = step === reviewStep;

  const set = (key: string, v: Answer) => {
    setAnswers(a => {
      const n = { ...a };
      if (!isSet(v)) delete n[key]; else n[key] = v;
      return n;
    });
    setFromRecord(f => ({ ...f, [key]: false }));
  };

  const sectionMissing = (i: number) => sections[i].questions.some(q => result.missing.includes(q.key));
  const canSave = result.complete && result.errors.length === 0 && involvement.trim().length >= 3 && !!reason;

  const copyPrevious = () => {
    if (!previous?.answers) return;
    setAnswers({ ...previous.answers });
    setFromRecord(Object.fromEntries(Object.keys(previous.answers).map(k => [k, true])));
  };

  if (saved) return <SavedPanel saved={saved} residentName={residentName} onClose={onClose} tool={tool} />;

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && window.confirm('Close without saving?')) onClose(); }}>
      <div className="modal cv-runner" style={{ maxHeight: '94dvh' }}>
        <div className="modal-header">
          <div style={{ minWidth: 0 }}>
            <h2 className="modal-title">{tool.name}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{residentName} · {tool.purpose}</div>
          </div>
          <button className="modal-close" onClick={() => { if (Object.keys(answers).length === 0 || window.confirm('Close without saving?')) onClose(); }} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <nav className="cv-steps" aria-label="Steps">
          {sections.map((s, i) => (
            <button key={s.key} className={i === step ? 'active' : sectionMissing(i) ? '' : 'done'} onClick={() => setStep(i)}>
              {!sectionMissing(i) && i !== step && <Icon name="check" size={14} />}{s.title}
            </button>
          ))}
          <button className={onReview ? 'active' : ''} onClick={() => setStep(reviewStep)}>Review and save</button>
        </nav>
        <div className="modal-body">
          <div className="cv-runner-main">
            {step === 0 && (
              <div className="cv-note cv-note-blue" style={{ marginBottom: 6 }}>
                <Icon name="info" size={16} />
                <div>
                  <div><strong>Who:</strong> {tool.who}</div>
                  {tool.key === 'falls' && <div style={{ marginTop: 4 }}>There is no falls score. NICE NG249 (2025) advises against falls risk prediction tools: look at each factor, and plan an action for each one that applies.</div>}
                  {previous?.answers && <button className="cv-btn cv-btn-quiet" style={{ marginTop: 6, padding: '4px 8px', minHeight: 32 }} onClick={copyPrevious}><Icon name="history" size={15} />Start from the last assessment ({formatDate(previous.createdAt)}) — then check every answer</button>}
                </div>
              </div>
            )}
            {!onReview ? (
              <>
                {sections[step].intro && <p className="cv-q-hint" style={{ marginTop: 10 }}>{sections[step].intro}</p>}
                {sections[step].questions.filter(q => !q.showIf || q.showIf(answers)).map(q => (
                  <QuestionView key={q.key} q={q} value={answers[q.key]} scored={tool.scored} fromRecord={!!fromRecord[q.key]}
                    missing={result.missing.includes(q.key)} onChange={v => set(q.key, v)} />
                ))}
              </>
            ) : (
              <div style={{ display: 'grid', gap: 14, paddingTop: 10 }}>
                <label className="form-label">Why is this being done?
                  <select className="form-input" style={{ width: '100%', marginTop: 4 }} value={reason} onChange={e => setReason(e.target.value)}>
                    {Object.entries(REASON_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="form-label">How were they involved? <span style={{ color: 'var(--red-700)' }}>*</span>
                  <textarea className="form-input" rows={2} style={{ width: '100%', marginTop: 4 }} value={involvement} onChange={e => setInvolvement(e.target.value)}
                    placeholder="e.g. Talked it through with her; her son joined by phone. She wants to keep walking to the dining room." />
                  <span className="cv-q-hint">Their views, and anyone who knows them well. If they could not take part, say why.</span>
                </label>
                <label className="form-label">Anything else (optional)
                  <textarea className="form-input" rows={2} style={{ width: '100%', marginTop: 4 }} value={notes} onChange={e => setNotes(e.target.value)} />
                </label>
                {result.missing.length > 0 && (
                  <div className="cv-note cv-note-amber"><Icon name="triangle-alert" size={16} />
                    <div>{result.missing.length} question{result.missing.length === 1 ? '' : 's'} not answered yet:{' '}
                      {sections.map((s, i) => sectionMissing(i) ? <button key={s.key} className="cv-btn cv-btn-quiet" style={{ padding: '2px 6px', minHeight: 28 }} onClick={() => setStep(i)}>{s.title}</button> : null)}
                    </div>
                  </div>
                )}
                <ResultDetail result={result} toolKey={type} />
                <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
                  Sources: {tool.sources.map((s, i) => <React.Fragment key={s.url}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></React.Fragment>)}. Tool version {tool.version}.
                </div>
              </div>
            )}
          </div>
          <aside className="cv-runner-side" aria-live="polite">
            <ResultSummary result={result} scored={tool.scored} />
            {result.errors.map(e => <div key={e} className="cv-note cv-note-red"><Icon name="triangle-alert" size={16} /><span>{e}</span></div>)}
            {result.warnings.map(w => <div key={w} className="cv-note cv-note-amber"><Icon name="triangle-alert" size={16} /><span>{w}</span></div>)}
            {result.complete && result.actions.length > 0 && (
              <div className="cv-runner-extra">
                <div className="cv-eyebrow" style={{ marginBottom: 6 }}>What to do</div>
                <ul className="cv-list-tight">{result.actions.slice(0, 6).map(a => <li key={a}>{a}</li>)}</ul>
                {result.actions.length > 6 && <div className="cv-q-hint" style={{ marginTop: 4 }}>…and {result.actions.length - 6} more on the last step.</div>}
              </div>
            )}
          </aside>
        </div>
        <div className="modal-footer">
          {step > 0 && <button className="cv-btn cv-btn-secondary" onClick={() => setStep(step - 1)}><Icon name="arrow-left" size={16} />Back</button>}
          <span style={{ flex: 1 }} />
          {!onReview ? (
            <button className="cv-btn cv-btn-primary" onClick={() => setStep(step + 1)}>Next<Icon name="chevron-right" size={16} /></button>
          ) : (
            <button className="cv-btn cv-btn-primary" disabled={!canSave || save.isPending}
              title={!canSave ? 'Answer every question, resolve anything in red, and say how they were involved' : undefined}
              onClick={() => save.mutate({ residentId, type, answers, reason, involvement: involvement.trim(), notes: notes.trim() || undefined }, { onSuccess: setSaved })}>
              <Icon name="check" size={16} />{save.isPending ? 'Saving…' : 'Save assessment'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function QuestionView({ q, value, onChange, scored, fromRecord, missing }: {
  q: Question; value: Answer; onChange: (v: Answer) => void; scored: boolean; fromRecord: boolean; missing: boolean;
}) {
  const label = (
    <div className="cv-q-label">
      <span>{q.label}</span>
      {fromRecord && isSet(value) && <Badge tone="blue" icon="history">From the record — check it</Badge>}
      {q.optional && <span style={{ fontWeight: 500, fontSize: '.8rem', color: 'var(--text-muted)' }}>optional</span>}
    </div>
  );
  if (q.type === 'choice') {
    return (
      <div className="cv-q" id={`q-${q.key}`}>
        {label}{q.hint && <div className="cv-q-hint">{q.hint}</div>}
        <div className={`cv-opts${(q.options || []).every(o => o.label.length < 18) ? ' cv-opts-inline' : ''}`} role="radiogroup" aria-label={q.label}>
          {(q.options || []).map(o => {
            const sel = value === o.value;
            return (
              <button key={o.value} type="button" role="radio" aria-checked={sel} className={`cv-opt radio${sel ? ' selected' : ''}`} onClick={() => onChange(sel && q.optional ? null : o.value)}>
                <span className="cv-opt-box">{sel && <Icon name="check" size={13} />}</span>
                <span>{o.label}{o.hint && <span className="cv-q-hint" style={{ display: 'block' }}>{o.hint}</span>}</span>
                {scored && o.points !== undefined && o.points >= 0 && <span className="cv-opt-pts">{o.points}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (q.type === 'multi') {
    const cur = Array.isArray(value) ? value : [];
    const toggle = (v: string, exclusive?: boolean) => {
      if (cur.includes(v)) return onChange(cur.filter(x => x !== v));
      const opts = q.options || [];
      if (exclusive) return onChange([v]);
      const exclusives = opts.filter(o => o.exclusive).map(o => o.value);
      onChange([...cur.filter(x => !exclusives.includes(x)), v]);
    };
    return (
      <div className="cv-q" id={`q-${q.key}`}>
        {label}{q.hint && <div className="cv-q-hint">{q.hint}</div>}
        {missing && <div className="cv-q-hint" style={{ color: 'var(--amber-700)' }}>Choose at least one{(q.options || []).some(o => o.exclusive) ? ' (or "None")' : ''}.</div>}
        <div className="cv-opts" role="group" aria-label={q.label}>
          {(q.options || []).map(o => {
            const sel = cur.includes(o.value);
            return (
              <button key={o.value} type="button" role="checkbox" aria-checked={sel} className={`cv-opt${sel ? ' selected' : ''}`} onClick={() => toggle(o.value, o.exclusive)}>
                <span className="cv-opt-box">{sel && <Icon name="check" size={13} />}</span>
                <span>{o.label}</span>
                {scored && o.points ? <span className="cv-opt-pts">+{o.points}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
  if (q.type === 'number') {
    return (
      <div className="cv-q" id={`q-${q.key}`}>
        {label}{q.hint && <div className="cv-q-hint">{q.hint}</div>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="number" inputMode="decimal" className="form-input" style={{ width: 140 }} value={value === undefined || value === null ? '' : String(value)}
            min={q.min} max={q.max} step="any" onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} aria-label={q.label} />
          {q.unit && <span style={{ color: 'var(--text-muted)' }}>{q.unit}</span>}
        </div>
      </div>
    );
  }
  if (q.type === 'date') {
    return (
      <div className="cv-q" id={`q-${q.key}`}>
        {label}
        <input type="date" className="form-input" style={{ width: 180 }} value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value || null)} aria-label={q.label} />
      </div>
    );
  }
  return (
    <div className="cv-q" id={`q-${q.key}`}>
      {label}{q.hint && <div className="cv-q-hint">{q.hint}</div>}
      <textarea className="form-input" rows={2} style={{ width: '100%' }} value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} aria-label={q.label} />
    </div>
  );
}

export function ResultSummary({ result, scored }: { result: Result; scored: boolean }) {
  const tone = levelTone(result.level);
  return (
    <div className="cv-card cv-card-pad" style={{ display: 'grid', gap: 8 }}>
      <div className="cv-eyebrow">{result.complete ? 'Result' : 'So far'}</div>
      {scored && result.score !== null && (
        <div className="cv-result-score" style={{ color: tone === 'red' ? 'var(--red-700)' : tone === 'amber' ? 'var(--amber-700)' : tone === 'green' ? 'var(--green-700)' : undefined }}>
          {result.score}{result.maxScore ? <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}> / {result.maxScore}</span> : null}
        </div>
      )}
      <div style={{ fontWeight: 650 }}>{result.headline || '—'}</div>
      {result.level !== 'not_scored' && <div><Badge tone={tone === 'blue' ? 'grey' : tone}>{LEVEL_LABEL[result.level]}</Badge></div>}
      {!result.complete && <div className="cv-q-hint">{result.missing.length} question{result.missing.length === 1 ? '' : 's'} still to answer</div>}
      {result.complete && <div className="cv-q-hint">Review in {result.reviewDays} days. {result.reviewNote}</div>}
    </div>
  );
}

export function ResultDetail({ result, toolKey }: { result: Result; toolKey: string }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {result.reasons.length > 0 && (
        <div><div className="cv-eyebrow" style={{ marginBottom: 6 }}>{toolKey === 'falls' ? 'Found' : 'Why'}</div>
          <ul className="cv-list-tight">{result.reasons.map(r => <li key={r}>{r}</li>)}</ul></div>
      )}
      {result.actions.length > 0 && (
        <div><div className="cv-eyebrow" style={{ marginBottom: 6 }}>What to do</div>
          <ul className="cv-list-tight">{result.actions.map(r => <li key={r}>{r}</li>)}</ul></div>
      )}
      {result.facts.length > 0 && (
        <div><div className="cv-eyebrow" style={{ marginBottom: 6 }}>Carers will see, once added to the plan</div>
          <ul className="cv-safety" style={{ listStyle: 'none', margin: 0 }}>{result.facts.map(f => <li key={f} className="cv-fact">{f}</li>)}</ul></div>
      )}
    </div>
  );
}

/** After saving: choose what goes into the care plan. */
function SavedPanel({ saved, residentName, onClose, tool: given }: { saved: any; residentName: string; onClose: () => void; tool?: Tool | null }) {
  const result: Result = saved.result;
  const plan = result.plan;
  const apply = useApplyAssessment();
  const [pick, setPick] = useState({ need: true, interventions: true, equipment: true, details: true, riskLevel: !!plan.riskLevel, staff: !!plan.staff });
  const [interventionIdx, setInterventionIdx] = useState<number[]>(plan.interventions.map((_, i) => i));
  const [scheduleIdx, setScheduleIdx] = useState<number[]>([]);
  const [done, setDone] = useState<any>(null);
  const tool = given || TOOLS[saved.type as ToolKey];
  const toggle = (arr: number[], i: number) => arr.includes(i) ? arr.filter(x => x !== i) : [...arr, i];

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg" style={{ maxHeight: '94dvh' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Saved — {tool?.shortName}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{residentName} · next review {formatDate(saved.nextReviewDate)}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body" style={{ padding: 20, display: 'grid', gap: 14, overflowY: 'auto' }}>
          <ResultSummary result={result} scored={!!tool?.scored} />
          <div className="cv-note cv-note-green"><Icon name="shield-check" size={16} /><span>Saved and sealed on the record. It cannot be changed — a reassessment will replace it, and both stay on the record.</span></div>
          {done ? (
            <div className="cv-note cv-note-blue"><Icon name="clipboard-check" size={16} />
              <span>Added to the care plan: {done.applied.join(', ')}.{done.planNeedsSigning ? ' The plan now needs re-signing.' : ''}</span></div>
          ) : (
            <div className="cv-card cv-card-pad" style={{ display: 'grid', gap: 10 }}>
              <h3 className="cv-section-title" style={{ margin: 0 }}><Icon name="clipboard-list" size={18} />Add to their care plan</h3>
              <p className="cv-q-hint" style={{ margin: 0 }}>Choose what goes in. Text is added below what is already written — nothing is overwritten.</p>
              <Check on={pick.need} set={v => setPick(p => ({ ...p, need: v }))} label={`What they need: "${plan.need}"`} />
              {plan.interventions.length > 0 && (
                <div>
                  <Check on={pick.interventions} set={v => setPick(p => ({ ...p, interventions: v }))} label="How to support them:" />
                  {pick.interventions && <div style={{ paddingLeft: 28, display: 'grid', gap: 4 }}>
                    {plan.interventions.map((x, i) => <Check key={i} small on={interventionIdx.includes(i)} set={() => setInterventionIdx(a => toggle(a, i))} label={x} />)}
                  </div>}
                </div>
              )}
              {plan.equipment && plan.equipment.length > 0 && <Check on={pick.equipment} set={v => setPick(p => ({ ...p, equipment: v }))} label={`Equipment: ${plan.equipment.join('; ')}`} />}
              {plan.staff && <Check on={pick.staff} set={v => setPick(p => ({ ...p, staff: v }))} label={`Staff: ${plan.staff}`} />}
              {plan.riskLevel && <Check on={pick.riskLevel} set={v => setPick(p => ({ ...p, riskLevel: v }))} label={`Risk level for this need: ${plan.riskLevel}`} />}
              {plan.details && Object.values(plan.details).some(v => v !== undefined && v !== null && !(Array.isArray(v) && !v.length)) && (
                <Check on={pick.details} set={v => setPick(p => ({ ...p, details: v }))} label={`Key details carers see (${result.facts.length ? result.facts.join(' · ') : 'structured details'})`} />
              )}
              {plan.schedule && plan.schedule.length > 0 && (
                <div>
                  <div style={{ fontWeight: 650, margin: '6px 0' }}>Times on their day — tick the ones to add to the round</div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {plan.schedule.map((x, i) => <Check key={i} small on={scheduleIdx.includes(i)} set={() => setScheduleIdx(a => toggle(a, i))}
                      label={`${x.time}${x.dayOfWeek != null ? ` (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][x.dayOfWeek]})` : ''} — ${x.what}`} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          {done ? <button className="cv-btn cv-btn-primary" onClick={onClose}>Done</button> : (
            <>
              <button className="cv-btn cv-btn-secondary" onClick={onClose}>Not now</button>
              <button className="cv-btn cv-btn-primary" disabled={apply.isPending}
                onClick={() => apply.mutate({ id: saved.id, ...pick, interventionIdx, scheduleIdx }, { onSuccess: setDone })}>
                <Icon name="clipboard-check" size={16} />{apply.isPending ? 'Adding…' : 'Add to care plan'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Check({ on, set, label, small }: { on: boolean; set: (v: boolean) => void; label: string; small?: boolean }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} className={`cv-opt${on ? ' selected' : ''}`} onClick={() => set(!on)}
      style={small ? { minHeight: 36, padding: '6px 10px', fontSize: '.86rem' } : undefined}>
      <span className="cv-opt-box">{on && <Icon name="check" size={13} />}</span><span>{label}</span>
    </button>
  );
}

/** Read-only view of a stored assessment: exactly what was answered and advised. */
export function AssessmentView({ a, onClose, onReassess, canEdit }: { a: any; onClose: () => void; onReassess?: () => void; canEdit: boolean }) {
  // The home's own assessment is shown with the exact version it was scored with.
  const tool: Tool | undefined = a.customDefinition ? customToTool(a.customDefinition, { key: a.type, version: a.customVersion || 1 }) : TOOLS[a.type as ToolKey];
  const [applying, setApplying] = useState(false);
  if (applying) return <SavedPanel saved={a} residentName={a.residentName || ''} onClose={onClose} tool={tool} />;
  const result: Result | null = a.result || null;
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxHeight: '94dvh' }}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{tool?.name || a.type}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {formatDate(a.completedAt || a.createdAt)} · {a.assessorName || 'Unknown'}{a.assessorRole ? ` (${String(a.assessorRole).replace(/_/g, ' ')})` : ''}
              {a.reason ? ` · ${REASON_LABEL[a.reason] || a.reason}` : ''} · {a.status === 'current' ? 'Current' : a.status === 'superseded' ? 'Replaced by a later assessment' : a.status}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body" style={{ padding: 20, display: 'grid', gap: 14, overflowY: 'auto' }}>
          {a.legacy || !result ? (
            <div className="cv-note cv-note-amber"><Icon name="triangle-alert" size={16} />
              <span>This is an older automatic score ({a.score}, {String(a.level).replace(/_/g, ' ')}), worked out by the system from other records before v88 — not answered by a person. Complete a new assessment to replace it.</span></div>
          ) : (
            <>
              <ResultSummary result={result} scored={!!tool?.scored} />
              {a.involvement && <div className="cv-note cv-note-blue"><Icon name="users" size={16} /><span><strong>Involvement:</strong> {a.involvement}</span></div>}
              {result.warnings.map((w: string) => <div key={w} className="cv-note cv-note-amber"><Icon name="triangle-alert" size={16} /><span>{w}</span></div>)}
              <ResultDetail result={result} toolKey={a.type} />
              {tool && (
                <div>
                  <div className="cv-eyebrow" style={{ marginBottom: 6 }}>Answers</div>
                  <dl className="cv-details" style={{ gridTemplateColumns: '1fr' }}>
                    {tool.sections.flatMap(s => s.questions).filter(q => isSet(a.answers?.[q.key])).map(q => (
                      <div key={q.key}><dt>{q.label}</dt><dd>{answerText(q, a.answers[q.key])}</dd></div>
                    ))}
                  </dl>
                </div>
              )}
              {a.notes && <div><div className="cv-eyebrow">Notes</div><p style={{ margin: '4px 0 0' }}>{a.notes}</p></div>}
              <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>Tool version {a.toolVersion}{a.appliedToPlanAt ? ` · Added to the care plan ${formatDate(a.appliedToPlanAt)}` : ''}</div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="cv-btn cv-btn-secondary" onClick={onClose}>Close</button>
          {canEdit && a.status === 'current' && !a.legacy && result && <button className="cv-btn cv-btn-secondary" onClick={() => setApplying(true)}><Icon name="clipboard-list" size={16} />Add to care plan</button>}
          {canEdit && onReassess && a.status === 'current' && <button className="cv-btn cv-btn-primary" onClick={onReassess}><Icon name="rotate-cw" size={16} />Reassess</button>}
        </div>
      </div>
    </div>
  );
}

export function answerText(q: Question, v: Answer): string {
  if (q.options) {
    const vals = Array.isArray(v) ? v : [v];
    return vals.map(x => q.options!.find(o => o.value === String(x))?.label || String(x)).join(', ');
  }
  return `${v}${q.unit ? ` ${q.unit}` : ''}`;
}
