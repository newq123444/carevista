// ────────────────────────────────────────────────────────────────────────────
// One Mental Capacity Act assessment.
//
// Draft: a stepped form that saves as you go and is checked against the
// engine on every save. Each issue appears beside the field it belongs to,
// with the provision it comes from. "Complete" stays closed until nothing the
// law requires is missing — and the server checks again before it seals it.
//
// Completed: a read-only record laid out in the order of the Code of Practice,
// ready to print. It cannot be edited; it can be reviewed, which starts a new
// assessment that supersedes this one and leaves this one readable.
// ────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMca, useUpdateMca, useCompleteMca, useStartMcaReview, useDeleteMca } from '../hooks';
import { useAuthStore } from '../store/auth.store';
import { PrintHeader, PrintButton } from '../components/PrintHeader';
import { formatDate } from '../utils/formatters';
import {
  CATEGORY_LABELS, OUTCOME_LABELS, STEP_LABELS, STEP_ORDER, RELEVANT_INFO_SUGGESTIONS,
  PRACTICABLE_STEPS, LIMB_GUIDE, DECISION_MAKERS,
} from '../constants/mcaContent';

const CAN_ASSESS = ['registered_nurse', 'senior_carer', 'home_manager', 'deputy_manager', 'super_admin', 'group_admin', 'admin'];
const LEVEL = {
  error:   { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca', mark: '●' },
  warning: { bg: '#fffbeb', fg: '#92400e', border: '#fde68a', mark: '▲' },
  info:    { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe', mark: 'i' },
} as const;

/** Immutable set by dot path: set(obj, 'bestInterests.lpa.exists', 'yes'). */
function setPath(obj: any, path: string, value: any): any {
  const [head, ...rest] = path.split('.');
  const copy = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  (copy as any)[head] = rest.length ? setPath((obj || {})[head], rest.join('.'), value) : value;
  return copy;
}
const getPath = (obj: any, path: string) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

export default function McaAssessment() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { user } = useAuthStore();
  const q = useMca(id);
  const update = useUpdateMca();
  const complete = useCompleteMca();
  const review = useStartMcaReview();
  const remove = useDeleteMca();

  const [rec, setRec] = useState<any>(null);
  const [validation, setValidation] = useState<any>(null);
  const [step, setStep] = useState<string>('decision');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error' | 'idle'>('idle');
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<number | null>(null);
  const loadedFor = useRef<string>('');

  const row: any = q.data;
  useEffect(() => {
    if (row && loadedFor.current !== id) {
      loadedFor.current = id;
      setRec(row.record);
      setValidation(row.validation);
    }
  }, [row, id]);

  const readOnly = !row || row.status !== 'draft' || !CAN_ASSESS.includes(user?.role || '');

  function change(path: string, value: any) {
    if (readOnly) return;
    setRec((prev: any) => {
      const next = setPath(prev, path, value);
      if (timer.current) window.clearTimeout(timer.current);
      setSaveState('saving');
      timer.current = window.setTimeout(() => {
        update.mutate({ id, record: next } as any, {
          onSuccess: (d: any) => { setValidation(d.validation); setSaveState('saved'); },
          onError: () => setSaveState('error'),
        });
      }, 700);
      return next;
    });
  }

  const steps = useMemo(
    () => STEP_ORDER.filter(s => !validation || validation.steps?.[s] !== 'not_needed'),
    [validation]);
  useEffect(() => { if (!steps.includes(step as any)) setStep(steps[steps.length - 1]); }, [steps, step]);

  if (q.isLoading || !rec) return <div className="page"><p>Loading…</p></div>;
  if (!row) return <div className="page"><p>Assessment not found.</p></div>;

  if (readOnly) {
    return <RecordView row={row} rec={rec} validation={validation}
      canReview={CAN_ASSESS.includes(user?.role || '') && row.status === 'completed'}
      reviewing={review.isPending}
      onReview={() => review.mutate(id, { onSuccess: (d: any) => nav(`/mca/${d.id}`) })}
      onBack={() => nav('/mca')} />;
  }

  const issues: any[] = validation?.issues || [];
  const issuesFor = (field: string) => issues.filter(i => i.field && (i.field === field || i.field.startsWith(field + '.')));
  const stepIssues = issues.filter(i => i.step === step && !i.field);
  const errorsLeft = issues.filter(i => i.level === 'error').length;
  const idx = steps.indexOf(step as any);

  const P = { rec, change, issuesFor };

  return (
    <div className="page" style={{ maxWidth: 820, margin: '0 auto', paddingBottom: 120 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => nav('/mca')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 15, minHeight: 44 }}>← Register</button>
        <span style={{ fontSize: 13.5, color: saveState === 'error' ? '#b91c1c' : 'var(--text-secondary)' }}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Not saved — check your connection' : 'Draft'}
        </span>
      </div>

      <h1 style={{ fontSize: 22, margin: '4px 0 2px' }}>{row.resident_name}</h1>
      <p style={{ margin: '0 0 14px', color: 'var(--text-secondary)', fontSize: 15 }}>
        {row.supersedes_id ? 'Review of a previous assessment · ' : ''}Capacity assessment — draft
      </p>

      {/* Steps. Each shows whether it is done, so nobody has to hunt for what is missing. */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6, marginBottom: 14 }}>
        {steps.map((s, i) => {
          const st = validation?.steps?.[s];
          const active = s === step;
          return (
            <button key={s} onClick={() => setStep(s)} style={{
              flex: '0 0 auto', minHeight: 48, padding: '0 14px', borderRadius: 12, cursor: 'pointer',
              border: `1.5px solid ${active ? '#4f46e5' : 'var(--border)'}`,
              background: active ? '#eef2ff' : '#fff', color: active ? '#3730a3' : 'var(--text-primary, #111827)',
              fontWeight: active ? 700 : 500, fontSize: 14,
            }}>
              <span style={{ marginRight: 6, color: st === 'complete' ? '#16a34a' : '#b45309' }}>{st === 'complete' ? '✓' : `${i + 1}`}</span>
              {STEP_LABELS[s]}
            </button>
          );
        })}
      </div>

      <div className="card" style={{ padding: '18px 18px 6px' }}>
        {step === 'decision' && <DecisionStep {...P} />}
        {step === 'support' && <SupportStep {...P} />}
        {step === 'test' && <TestStep {...P} />}
        {step === 'outcome' && <OutcomeStep {...P} derived={validation?.derivedOutcome} />}
        {step === 'best_interests' && <BestInterestsStep {...P} />}
        {step === 'liberty' && <LibertyStep {...P} deprived={validation?.deprivationOfLiberty} />}
        {step === 'review' && <ReviewStep {...P} />}
        <Issues list={stepIssues} />
      </div>

      {/* Footer: always visible, thumb reach. */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, background: '#fff',
        borderTop: '1px solid var(--border)', padding: '10px 14px calc(10px + env(safe-area-inset-bottom))',
      }}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost" style={{ minHeight: 52 }} disabled={idx <= 0} onClick={() => setStep(steps[idx - 1])}>Back</button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: 13.5, color: errorsLeft ? '#b45309' : '#15803d' }}>
            {errorsLeft ? `${errorsLeft} item${errorsLeft === 1 ? '' : 's'} still needed` : 'Ready to complete'}
          </span>
          {idx < steps.length - 1 ? (
            <button className="btn btn-primary" style={{ minHeight: 52 }} onClick={() => setStep(steps[idx + 1])}>Next</button>
          ) : (
            <button className="btn btn-primary" style={{ minHeight: 52 }} disabled={!validation?.canComplete || saveState === 'saving'}
              onClick={() => setConfirming(true)}>Complete</button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ minHeight: 44, color: '#b91c1c' }}
          onClick={() => { if (window.confirm('Delete this draft? This cannot be undone.')) remove.mutate(id, { onSuccess: () => nav('/mca') }); }}>
          Delete draft
        </button>
      </div>

      {confirming && (
        <div className="modal-overlay" onClick={() => setConfirming(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header"><h3 style={{ margin: 0 }}>Complete this assessment?</h3></div>
            <div className="modal-body" style={{ display: 'grid', gap: 10, fontSize: 15, lineHeight: 1.5 }}>
              <p style={{ margin: 0 }}>
                <strong>{OUTCOME_LABELS[rec.conclusion?.outcome] || '—'}</strong> — {rec.decision}
              </p>
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                Once completed it is final, signed in your name, and sealed on the record. It cannot be
                edited. If anything changes, start a review — this one stays readable.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Not yet</button>
              <button className="btn btn-primary" disabled={complete.isPending}
                onClick={() => complete.mutate(id, {
                  onSuccess: () => { setConfirming(false); q.refetch(); },
                  onError: (e: any) => {
                    setConfirming(false);
                    const v = e?.response?.data?.validation;
                    if (v) setValidation(v);
                    window.alert(e?.response?.data?.error || 'Could not complete the assessment.');
                  },
                })}>
                {complete.isPending ? 'Completing…' : 'Complete and sign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Building blocks ─────────────────────────────────────────────────────────

function Issues({ list }: { list: any[] }) {
  if (!list || list.length === 0) return null;
  return (
    <div style={{ display: 'grid', gap: 6, margin: '8px 0 12px' }}>
      {list.map((i, k) => {
        const s = (LEVEL as any)[i.level] || LEVEL.info;
        return (
          <div key={k} style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}`, borderRadius: 10, padding: '8px 11px', fontSize: 14, lineHeight: 1.45 }}>
            <span aria-hidden style={{ marginRight: 6 }}>{s.mark}</span>{i.message}
            <span style={{ display: 'block', fontSize: 12, opacity: 0.85, marginTop: 2 }}>{i.law}</span>
          </div>
        );
      })}
    </div>
  );
}

function Q({ label, help, law, issues, children }: { label: string; help?: string; law?: string; issues?: any[]; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 4 }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>{label}</span>
        {law && <span style={{ fontSize: 11.5, padding: '2px 8px', borderRadius: 999, background: '#f1f5f9', color: '#475569' }}>{law}</span>}
      </div>
      {help && <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{help}</p>}
      {children}
      <Issues list={issues || []} />
    </div>
  );
}

function Text({ value, onChange, rows = 3, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }) {
  return (
    <textarea className="form-input" rows={rows} value={value || ''} placeholder={placeholder}
      onChange={e => onChange(e.target.value)} style={{ width: '100%', fontSize: 16, lineHeight: 1.5 }} />
  );
}

function Pills({ value, options, onChange }: { value: any; options: [any, string][]; onChange: (v: any) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(([v, label]) => {
        const active = value === v;
        return (
          <button key={String(v)} onClick={() => onChange(active ? (typeof v === 'boolean' ? null : '') : v)} aria-pressed={active} style={{
            minHeight: 52, padding: '0 16px', borderRadius: 12, cursor: 'pointer', fontSize: 15,
            border: `2px solid ${active ? '#4f46e5' : 'var(--border)'}`,
            background: active ? '#eef2ff' : '#fff', color: active ? '#3730a3' : 'var(--text-primary, #111827)',
            fontWeight: active ? 700 : 500,
          }}>{label}</button>
        );
      })}
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', cursor: 'pointer', fontSize: 15, lineHeight: 1.45 }}>
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} style={{ width: 22, height: 22, marginTop: 1 }} />
      <span>{children}</span>
    </label>
  );
}

function ListEditor({ items, onChange, suggestions = [], placeholder }: { items: string[]; onChange: (v: string[]) => void; suggestions?: string[]; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const list = items || [];
  const add = (s: string) => { const t = s.trim(); if (t && !list.includes(t)) onChange([...list, t]); };
  return (
    <div>
      {list.map((it, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', marginBottom: 6, borderRadius: 10, background: 'var(--surface-2, #f8fafc)', border: '1px solid var(--border)' }}>
          <span style={{ flex: 1, fontSize: 15 }}>{it}</span>
          <button onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label="Remove"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#94a3b8', minWidth: 40, minHeight: 40 }}>✕</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="form-input" value={draft} placeholder={placeholder} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { add(draft); setDraft(''); } }} style={{ flex: 1, minHeight: 48, fontSize: 16 }} />
        <button className="btn btn-secondary" style={{ minHeight: 48 }} onClick={() => { add(draft); setDraft(''); }}>Add</button>
      </div>
      {suggestions.filter(s => !list.includes(s)).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>Tap to add, then make it specific to them:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.filter(s => !list.includes(s)).map(s => (
              <button key={s} onClick={() => add(s)} style={{ minHeight: 40, padding: '0 12px', borderRadius: 999, cursor: 'pointer', border: '1.5px dashed var(--border)', background: '#fff', fontSize: 13.5 }}>+ {s}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TRI: [string, string][] = [['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not sure']];
const YN: [boolean, string][] = [[true, 'Yes'], [false, 'No']];

// ── Steps ───────────────────────────────────────────────────────────────────

function DecisionStep({ rec, change, issuesFor }: any) {
  return (
    <>
      <Q label="The decision" law="s2(1)" issues={issuesFor('decision')}
        help="One specific decision, in one sentence. Capacity is never assessed for 'everything'.">
        <Text rows={2} value={rec.decision} onChange={v => change('decision', v)} placeholder="Whether to…" />
      </Q>
      <Q label="Kind of decision">
        <select className="form-input" value={rec.category} onChange={e => change('category', e.target.value)} style={{ minHeight: 48 }}>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Q>
      <Q label="Why is their capacity in doubt?" law="s1(2), s2(3)" issues={issuesFor('reasonForDoubt')}
        help="Everyone is presumed to have capacity. Say what they said or did that raises a doubt about THIS decision. A diagnosis alone is not a reason.">
        <Text value={rec.reasonForDoubt} onChange={v => change('reasonForDoubt', v)} />
      </Q>
      <Q label="What do they need to understand?" law="s3(1)(a), s3(4)" issues={issuesFor('relevantInformation')}
        help="The key facts for this decision — including what is likely to happen with each choice, and if no decision is made.">
        <ListEditor items={rec.relevantInformation} onChange={v => change('relevantInformation', v)}
          suggestions={RELEVANT_INFO_SUGGESTIONS[rec.category] || RELEVANT_INFO_SUGGESTIONS.other}
          placeholder="Add a key point…" />
      </Q>
      <Q label="Does this decision have to be made now?" help="If it can wait, it may be better to wait until they are able to make it themselves.">
        <Pills value={rec.isUrgent} options={[[true, 'Yes, it is urgent'], [false, 'No, it can wait']]} onChange={v => change('isUrgent', v === null ? false : v)} />
      </Q>
    </>
  );
}

function SupportStep({ rec, change, issuesFor }: any) {
  const toggle = (s: string) => {
    const list: string[] = rec.practicableSteps || [];
    change('practicableSteps', list.includes(s) ? list.filter(x => x !== s) : [...list, s]);
  };
  return (
    <>
      <Q label="What did you do to help them decide for themselves?" law="s1(3); Code ch.3" issues={issuesFor('practicableSteps')}
        help="Someone is not treated as unable to decide unless everything practicable has been done to help them.">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PRACTICABLE_STEPS.map(s => {
            const on = (rec.practicableSteps || []).includes(s);
            return (
              <button key={s} onClick={() => toggle(s)} aria-pressed={on} style={{
                minHeight: 48, padding: '0 14px', borderRadius: 12, cursor: 'pointer', fontSize: 14.5, textAlign: 'left',
                border: `2px solid ${on ? '#4f46e5' : 'var(--border)'}`, background: on ? '#eef2ff' : '#fff',
                color: on ? '#3730a3' : 'var(--text-primary, #111827)', fontWeight: on ? 700 : 500,
              }}>{on ? '✓ ' : ''}{s}</button>
            );
          })}
        </div>
      </Q>
      <Q label="Anything else you did" issues={issuesFor('supportNotes')}>
        <Text rows={2} value={rec.supportNotes} onChange={v => change('supportNotes', v)} />
      </Q>
      <Q label="How do they usually communicate best?">
        <Text rows={2} value={rec.communicationNeeds} onChange={v => change('communicationNeeds', v)} />
      </Q>
      <Q label="When was the assessment done?" law="s2(1)" issues={issuesFor('assessedAt')}>
        <input type="datetime-local" className="form-input" value={rec.assessedAt || ''} onChange={e => change('assessedAt', e.target.value)} style={{ minHeight: 48, fontSize: 16 }} />
      </Q>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <Q label="Where?"><input className="form-input" value={rec.location || ''} onChange={e => change('location', e.target.value)} style={{ minHeight: 48 }} /></Q>
        <Q label="Who was there?"><input className="form-input" value={rec.peoplePresent || ''} onChange={e => change('peoplePresent', e.target.value)} style={{ minHeight: 48 }} /></Q>
      </div>
      <Q label="Does their capacity vary — better at some times than others?" law="Code 4.26–4.27" issues={issuesFor('bestTimeConsidered')}>
        <Pills value={rec.fluctuating} options={YN} onChange={v => change('fluctuating', !!v)} />
        {rec.fluctuating && (
          <Check checked={rec.bestTimeConsidered} onChange={v => change('bestTimeConsidered', v)}>
            The assessment was done at the time they are usually at their best
          </Check>
        )}
      </Q>
    </>
  );
}

function TestStep({ rec, change, issuesFor }: any) {
  const anyUnable = ['understand', 'retain', 'weigh', 'communicate'].some(k => rec.functional?.[k]?.result === 'unable');
  return (
    <>
      <p style={{ margin: '0 0 16px', fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
        Following <em>A Local Authority v JB</em> [2021] UKSC 52: first, can they make the decision?
        Then — only if they cannot — is that <strong>because of</strong> an impairment of the mind or brain?
      </p>
      {(['understand', 'retain', 'weigh', 'communicate'] as const).map(k => {
        const g = LIMB_GUIDE[k];
        const r = rec.functional?.[k] || { result: 'not_assessed', evidence: '' };
        return (
          <div key={k} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 14 }}>
            <Q label={g.title} law={g.law} help={g.ask} issues={issuesFor(`functional.${k}`)}>
              <p style={{ margin: '0 0 10px', fontSize: 13.5, color: '#475569', fontStyle: 'italic' }}>{g.note}</p>
              <Pills value={r.result} options={[['able', 'Able'], ['unable', 'Unable'], ['not_assessed', 'Not assessed']]}
                onChange={v => change(`functional.${k}.result`, v || 'not_assessed')} />
              <div style={{ marginTop: 10 }}>
                <Text rows={2} value={r.evidence} onChange={v => change(`functional.${k}.evidence`, v)}
                  placeholder={r.result === 'unable' ? 'What they said or did — their words where you can' : 'What showed this'} />
              </div>
            </Q>
          </div>
        );
      })}

      {anyUnable && (
        <div style={{ borderTop: '2px solid var(--border)', paddingTop: 16 }}>
          <Q label="Is there an impairment of, or disturbance in the functioning of, the mind or brain?" law="s2(1)–(2)"
            issues={issuesFor('impairment')}
            help="It can be temporary — delirium, an infection, medication — and does not need a formal diagnosis.">
            <Pills value={rec.impairment?.present} options={YN} onChange={v => change('impairment.present', v)} />
            {rec.impairment?.present && (
              <div style={{ marginTop: 10 }}>
                <Text rows={2} value={rec.impairment?.description} onChange={v => change('impairment.description', v)} placeholder="What it is and how you know" />
              </div>
            )}
          </Q>
          {rec.impairment?.present && (
            <Q label="Is the inability BECAUSE OF that impairment?" law="s2(1); JB [2021] UKSC 52" issues={issuesFor('causativeNexus')}
              help="This link must be shown. Someone may be unable to decide for another reason — pressure from someone else, for example — and that is not a lack of capacity under the Act.">
              <Pills value={rec.causativeNexus?.present} options={YN} onChange={v => change('causativeNexus.present', v)} />
              {rec.causativeNexus?.present && (
                <div style={{ marginTop: 10 }}>
                  <Text rows={2} value={rec.causativeNexus?.explanation} onChange={v => change('causativeNexus.explanation', v)} placeholder="How the impairment causes the inability" />
                </div>
              )}
            </Q>
          )}
        </div>
      )}
    </>
  );
}

function OutcomeStep({ rec, change, issuesFor, derived }: any) {
  return (
    <>
      {derived && (
        <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>On what you have recorded, the outcome follows as:</div>
          <div style={{ fontSize: 17, fontWeight: 700, margin: '4px 0 8px' }}>{OUTCOME_LABELS[derived]}</div>
          {rec.conclusion?.outcome !== derived && (
            <button className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => change('conclusion.outcome', derived)}>Use this</button>
          )}
        </div>
      )}
      <Q label="Outcome" law="s2(4) — on the balance of probabilities" issues={issuesFor('conclusion.outcome')}>
        <Pills value={rec.conclusion?.outcome} onChange={v => change('conclusion.outcome', v || null)}
          options={[['has_capacity', OUTCOME_LABELS.has_capacity], ['lacks_capacity', OUTCOME_LABELS.lacks_capacity], ['cannot_determine', OUTCOME_LABELS.cannot_determine]]} />
      </Q>
      <Q label="Your reasoning" issues={issuesFor('conclusion.reasoning')} help="In your own words, why the evidence leads to this outcome.">
        <Text rows={4} value={rec.conclusion?.reasoning} onChange={v => change('conclusion.reasoning', v)} />
      </Q>
      {rec.conclusion?.outcome === 'cannot_determine' && (
        <Q label="Who will assess further, and when?" law="Code 4.51–4.54" issues={issuesFor('conclusion.furtherAssessment')}>
          <Text rows={2} value={rec.conclusion?.furtherAssessment} onChange={v => change('conclusion.furtherAssessment', v)} />
        </Q>
      )}
      {rec.fluctuating && rec.conclusion?.outcome === 'lacks_capacity' && (
        <Q label="Reassess by" law="Code 4.26–4.27" issues={issuesFor('reassessBy')}>
          <input type="date" className="form-input" value={rec.reassessBy || ''} onChange={e => change('reassessBy', e.target.value || null)} style={{ minHeight: 48 }} />
        </Q>
      )}
    </>
  );
}

function BestInterestsStep({ rec, change, issuesFor }: any) {
  const bi = rec.bestInterests || {};
  const consultees = bi.consultees || [];
  const options = bi.options || [];
  const treatment = ['medical_treatment', 'medication', 'covert_medication', 'end_of_life'].includes(rec.category);
  return (
    <>
      <p style={{ margin: '0 0 16px', fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
        They lack capacity for this decision, so it must be made in their best interests (s4) — and in the way
        that restricts their rights and freedom least (s1(6)).
      </p>

      <Q label="Is there a Lasting Power of Attorney?" law="ss9–14" issues={issuesFor('bestInterests.lpa')}>
        <Pills value={bi.lpa?.exists} options={TRI} onChange={v => change('bestInterests.lpa.exists', v || '')} />
        {bi.lpa?.exists === 'yes' && (
          <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
            <Pills value={bi.lpa?.type} onChange={v => change('bestInterests.lpa.type', v || '')}
              options={[['health_welfare', 'Health and welfare'], ['property_financial', 'Property and financial']]} />
            <input className="form-input" placeholder="Attorney's name" value={bi.lpa?.attorneyName || ''} onChange={e => change('bestInterests.lpa.attorneyName', e.target.value)} style={{ minHeight: 48 }} />
            <Check checked={bi.lpa?.registerChecked} onChange={v => change('bestInterests.lpa.registerChecked', v)}>Seen a copy; it is registered with the Office of the Public Guardian</Check>
            <div style={{ fontSize: 14.5 }}>Does it give the attorney authority over this decision?</div>
            <Pills value={bi.lpa?.coversDecision} options={YN} onChange={v => change('bestInterests.lpa.coversDecision', v)} />
          </div>
        )}
      </Q>

      <Q label="Is there a court-appointed deputy?" law="ss16–20" issues={issuesFor('bestInterests.deputy')}>
        <Pills value={bi.deputy?.exists} options={TRI} onChange={v => change('bestInterests.deputy.exists', v || '')} />
        {bi.deputy?.exists === 'yes' && (
          <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
            <input className="form-input" placeholder="Deputy's name" value={bi.deputy?.name || ''} onChange={e => change('bestInterests.deputy.name', e.target.value)} style={{ minHeight: 48 }} />
            <div style={{ fontSize: 14.5 }}>Does the court order cover this decision?</div>
            <Pills value={bi.deputy?.coversDecision} options={YN} onChange={v => change('bestInterests.deputy.coversDecision', v)} />
          </div>
        )}
      </Q>

      <Q label="Who makes this decision?" law="Code 5.8–5.12" issues={issuesFor('bestInterests.decisionMaker')}>
        <Pills value={bi.decisionMaker} options={DECISION_MAKERS} onChange={v => change('bestInterests.decisionMaker', v || '')} />
      </Q>

      {treatment && (
        <Q label="Did they make an advance decision to refuse this treatment?" law="ss24–26" issues={issuesFor('bestInterests.adrt')}>
          <Pills value={bi.adrt?.exists} options={TRI} onChange={v => change('bestInterests.adrt.exists', v || '')} />
          {bi.adrt?.exists === 'yes' && (
            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              <div style={{ fontSize: 14.5 }}>Is it valid, and does it apply to this treatment now?</div>
              <Pills value={bi.adrt?.validAndApplicable} options={YN} onChange={v => change('bestInterests.adrt.validAndApplicable', v)} />
              <Text rows={2} value={bi.adrt?.details} onChange={v => change('bestInterests.adrt.details', v)} placeholder="What it says, and where it is kept" />
            </div>
          )}
        </Q>
      )}

      <Q label="Are they likely to regain capacity for this decision?" law="s4(3)" issues={issuesFor('bestInterests.regainCapacity')}>
        <Pills value={bi.regainCapacity?.likely} options={TRI} onChange={v => change('bestInterests.regainCapacity.likely', v || '')} />
        {bi.regainCapacity?.likely === 'yes' && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 14.5, marginBottom: 6 }}>Can the decision wait until then?</div>
            <Pills value={bi.regainCapacity?.canWait} options={YN} onChange={v => change('bestInterests.regainCapacity.canWait', v)} />
          </div>
        )}
      </Q>

      <Q label="How were they involved in the decision?" law="s4(4)" issues={issuesFor('bestInterests.participation')}>
        <Text value={bi.participation} onChange={v => change('bestInterests.participation', v)} />
      </Q>
      <Q label="Their past and present wishes and feelings" law="s4(6)(a)" issues={issuesFor('bestInterests.wishesFeelings')}
        help="What they have said, written or shown — now and before. Their 'About me' and care plan can help.">
        <Text value={bi.wishesFeelings} onChange={v => change('bestInterests.wishesFeelings', v)} />
      </Q>
      <Q label="Beliefs and values that would influence them" law="s4(6)(b)" issues={issuesFor('bestInterests.beliefsValues')}>
        <Text rows={2} value={bi.beliefsValues} onChange={v => change('bestInterests.beliefsValues', v)} placeholder='Faith, culture, what matters to them — or "none known"' />
      </Q>

      <Q label="Who was consulted?" law="s4(7)" issues={issuesFor('bestInterests.consultees')}
        help="Family, friends, unpaid carers, an attorney or deputy, anyone they named — and what each said.">
        {consultees.map((c: any, i: number) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, marginBottom: 8, display: 'grid', gap: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
              <input className="form-input" placeholder="Name" value={c.name} onChange={e => change(`bestInterests.consultees.${i}.name`, e.target.value)} style={{ minHeight: 44 }} />
              <input className="form-input" placeholder="Relationship" value={c.relationship} onChange={e => change(`bestInterests.consultees.${i}.relationship`, e.target.value)} style={{ minHeight: 44 }} />
              <button aria-label="Remove" onClick={() => change('bestInterests.consultees', consultees.filter((_: any, j: number) => j !== i))}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#94a3b8', minWidth: 44 }}>✕</button>
            </div>
            <Text rows={2} value={c.view} onChange={v => change(`bestInterests.consultees.${i}.view`, v)} placeholder="What they said" />
          </div>
        ))}
        <button className="btn btn-secondary" style={{ minHeight: 48 }}
          onClick={() => change('bestInterests.consultees', [...consultees, { name: '', relationship: '', view: '' }])}>+ Add someone</button>
        <Check checked={bi.noOneAppropriateToConsult} onChange={v => change('bestInterests.noOneAppropriateToConsult', v)}>
          There is nobody appropriate to consult, other than paid staff
        </Check>
      </Q>

      {(bi.noOneAppropriateToConsult || consultees.length === 0) && (
        <Q label="Independent Mental Capacity Advocate (IMCA)" law="ss35–41" issues={issuesFor('bestInterests.imca')}
          help="Required for serious medical treatment, or a move into a care home or hospital, when there is nobody appropriate to consult.">
          <Check checked={bi.imca?.referred} onChange={v => change('bestInterests.imca.referred', v)}>An IMCA has been instructed</Check>
          {bi.imca?.referred && <input className="form-input" placeholder="IMCA name / service" value={bi.imca?.name || ''} onChange={e => change('bestInterests.imca.name', e.target.value)} style={{ minHeight: 48 }} />}
        </Q>
      )}

      <Q label="The options" law="s1(6); Code 5.13" issues={issuesFor('bestInterests.options')}
        help="At least two realistic options, including the least restrictive, with what is good and bad about each.">
        {options.map((o: any, i: number) => (
          <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, marginBottom: 8, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" placeholder="Option" value={o.option} onChange={e => change(`bestInterests.options.${i}.option`, e.target.value)} style={{ flex: 1, minHeight: 44 }} />
              <button aria-label="Remove" onClick={() => change('bestInterests.options', options.filter((_: any, j: number) => j !== i))}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: '#94a3b8', minWidth: 44 }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Text rows={2} value={o.benefits} onChange={v => change(`bestInterests.options.${i}.benefits`, v)} placeholder="Benefits" />
              <Text rows={2} value={o.burdens} onChange={v => change(`bestInterests.options.${i}.burdens`, v)} placeholder="Burdens and risks" />
            </div>
            <Pills value={o.restrictiveness} onChange={v => change(`bestInterests.options.${i}.restrictiveness`, v || '')}
              options={[['least', 'Least restrictive'], ['more', 'More restrictive'], ['most', 'Most restrictive']]} />
          </div>
        ))}
        <button className="btn btn-secondary" style={{ minHeight: 48 }}
          onClick={() => change('bestInterests.options', [...options, { option: '', benefits: '', burdens: '', restrictiveness: '' }])}>+ Add an option</button>
      </Q>

      <Q label="The option chosen" issues={issuesFor('bestInterests.chosenOption')}>
        <select className="form-input" value={bi.chosenOption || ''} onChange={e => change('bestInterests.chosenOption', e.target.value)} style={{ minHeight: 48 }}>
          <option value="">Choose…</option>
          {options.filter((o: any) => o.option).map((o: any, i: number) => <option key={i} value={o.option}>{o.option}</option>)}
        </select>
      </Q>
      <Q label="Why is this the least restrictive way to meet their needs?" law="s1(6)" issues={issuesFor('bestInterests.whyLeastRestrictive')}>
        <Text value={bi.whyLeastRestrictive} onChange={v => change('bestInterests.whyLeastRestrictive', v)} />
      </Q>

      <Q label="Confirmations" issues={[...issuesFor('bestInterests.notBasedOnAgeOrAppearance'), ...issuesFor('bestInterests.notMotivatedByDeath')]}>
        <Check checked={bi.notBasedOnAgeOrAppearance} onChange={v => change('bestInterests.notBasedOnAgeOrAppearance', v)}>
          This decision was not made on the basis of their age, appearance, condition or behaviour (s4(1))
        </Check>
        <Check checked={bi.lifeSustaining} onChange={v => change('bestInterests.lifeSustaining', v)}>
          This decision concerns life-sustaining treatment
        </Check>
        {bi.lifeSustaining && (
          <Check checked={bi.notMotivatedByDeath} onChange={v => change('bestInterests.notMotivatedByDeath', v)}>
            It is not motivated by a desire to bring about their death (s4(5))
          </Check>
        )}
      </Q>
    </>
  );
}

function LibertyStep({ rec, change, issuesFor, deprived }: any) {
  const lb = rec.liberty || {};
  return (
    <>
      <p style={{ margin: '0 0 16px', fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
        The "acid test" from <em>P v Cheshire West</em> [2014] UKSC 19. If both answers are yes, the person is
        deprived of their liberty — however kind and appropriate the care — and it must be authorised.
        DoLS (Schedule A1) is the scheme in force; the Liberty Protection Safeguards have not been commenced.
      </p>
      <Q label="Are they under continuous supervision and control?" issues={issuesFor('liberty.continuousSupervision')}>
        <Pills value={lb.continuousSupervision} options={TRI} onChange={v => change('liberty.continuousSupervision', v || '')} />
      </Q>
      <Q label="Are they NOT free to leave?" issues={issuesFor('liberty.notFreeToLeave')}
        help="Not just whether they could walk out of the door — whether they would be allowed to leave to live somewhere else.">
        <Pills value={lb.notFreeToLeave} options={[['yes', 'Yes — not free to leave'], ['no', 'No — free to leave'], ['unknown', 'Not sure']]}
          onChange={v => change('liberty.notFreeToLeave', v || '')} />
      </Q>
      {deprived && (
        <Q label="DoLS authorisation" law="Schedule A1" issues={issuesFor('liberty.authorisation')}>
          <Pills value={lb.authorisation} onChange={v => change('liberty.authorisation', v || '')}
            options={[['granted', 'Already granted'], ['applied', 'Applied for'], ['needed', 'Not yet applied for']]} />
          <p style={{ margin: '10px 0 0', fontSize: 14 }}>
            Record the application on the <a href="/dols">DoLS register</a> so its expiry and conditions are tracked.
          </p>
        </Q>
      )}
      <Q label="Notes" issues={issuesFor('liberty.notes')}>
        <Text rows={2} value={lb.notes} onChange={v => change('liberty.notes', v)} placeholder="Advice from the DoLS team, conditions, restrictions in place" />
      </Q>
    </>
  );
}

function ReviewStep({ rec, change, issuesFor }: any) {
  return (
    <>
      <Q label="Review this by" law="Code 4.26, 5.28" issues={issuesFor('reviewDate')}
        help="Capacity can change, and so can what is in their best interests. Most decisions should be reviewed within months, not years.">
        <input type="date" className="form-input" value={rec.reviewDate || ''} onChange={e => change('reviewDate', e.target.value || null)} style={{ minHeight: 48, fontSize: 16 }} />
      </Q>
      <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 12, padding: 14, fontSize: 14.5, lineHeight: 1.55 }}>
        When you complete this assessment it is signed in your name, sealed on the record integrity chain,
        and becomes final. Anything still needed is listed on each step — the Complete button opens once
        nothing the law requires is missing.
      </div>
    </>
  );
}

// ── The completed record ────────────────────────────────────────────────────

function RecordView({ row, rec, validation, canReview, reviewing, onReview, onBack }: any) {
  const f = rec.functional || {};
  const bi = rec.bestInterests || {};
  const lacks = row.outcome === 'lacks_capacity';
  const Sec = ({ title, law, children }: any) => (
    <section style={{ marginBottom: 18, breakInside: 'avoid' }}>
      <h3 style={{ fontSize: 15.5, margin: '0 0 6px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
        {title}{law && <span style={{ fontSize: 11.5, fontWeight: 500, color: '#64748b' }}>{law}</span>}
      </h3>
      <div style={{ fontSize: 14.5, lineHeight: 1.55 }}>{children}</div>
    </section>
  );
  const val = (x: any) => (x === true ? 'Yes' : x === false ? 'No' : x === 'unknown' ? 'Not known' : x ? String(x) : '—');

  return (
    <div className="page" style={{ maxWidth: 820, margin: '0 auto' }}>
      <PrintHeader title="Mental capacity assessment" subject={row.resident_name} />
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={onBack} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 15, minHeight: 44 }}>← Register</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <PrintButton />
          {canReview && (
            <button className="btn btn-primary" style={{ minHeight: 44 }} disabled={reviewing} onClick={onReview}>
              {reviewing ? 'Starting…' : 'Review / reassess'}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 21, margin: 0 }}>{row.resident_name}</h1>
            <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
              {CATEGORY_LABELS[row.category] || row.category}
              {row.room_number ? ` · Room ${row.room_number}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {row.status === 'superseded' ? 'Superseded — ' : ''}{OUTCOME_LABELS[row.outcome] || '—'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {row.completed_at && <>Assessed by {row.assessor_name} ({String(row.assessor_role || '').replace(/_/g, ' ')}), {formatDate(row.completed_at)}</>}
            </div>
          </div>
        </div>

        <Sec title="Decision" law="s2(1)">{rec.decision}</Sec>
        <Sec title="Why capacity was in doubt" law="s1(2)">{rec.reasonForDoubt}</Sec>
        <Sec title="Relevant information" law="s3(4)">
          <ul style={{ margin: 0, paddingLeft: 18 }}>{(rec.relevantInformation || []).map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
        </Sec>
        <Sec title="Support given to decide" law="s1(3)">
          {(rec.practicableSteps || []).join('; ') || '—'}{rec.supportNotes ? `. ${rec.supportNotes}` : ''}
          <div style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginTop: 4 }}>
            {rec.assessedAt && <>When: {String(rec.assessedAt).replace('T', ' ')}. </>}
            {rec.location && <>Where: {rec.location}. </>}
            {rec.peoplePresent && <>Present: {rec.peoplePresent}.</>}
          </div>
        </Sec>
        <Sec title="Functional test" law="s3(1)">
          {(['understand', 'retain', 'weigh', 'communicate'] as const).map(k => (
            <div key={k} style={{ marginBottom: 6 }}>
              <strong>{LIMB_GUIDE[k].title}</strong> {f[k]?.result === 'able' ? 'Able.' : f[k]?.result === 'unable' ? 'Unable.' : 'Not assessed.'}
              {f[k]?.evidence && <span style={{ color: '#334155' }}> {f[k].evidence}</span>}
            </div>
          ))}
        </Sec>
        {Object.values(f).some((x: any) => x?.result === 'unable') && (
          <Sec title="Impairment and causal link" law="s2(1); JB [2021] UKSC 52">
            Impairment: {val(rec.impairment?.present)}{rec.impairment?.description ? ` — ${rec.impairment.description}` : ''}.<br />
            Inability caused by it: {val(rec.causativeNexus?.present)}{rec.causativeNexus?.explanation ? ` — ${rec.causativeNexus.explanation}` : ''}.
          </Sec>
        )}
        <Sec title="Outcome and reasoning" law="s2(4)">
          <strong>{OUTCOME_LABELS[row.outcome]}.</strong> {rec.conclusion?.reasoning}
          {rec.conclusion?.furtherAssessment && <div>Further assessment: {rec.conclusion.furtherAssessment}</div>}
        </Sec>

        {lacks && (
          <>
            <Sec title="Decision-maker" law="ss9–20">
              {(DECISION_MAKERS.find(([k]) => k === bi.decisionMaker) || [null, '—'])[1]}.
              {' '}LPA: {val(bi.lpa?.exists)}{bi.lpa?.attorneyName ? ` (${bi.lpa.attorneyName})` : ''}. Deputy: {val(bi.deputy?.exists)}.
              {bi.adrt?.exists && <> Advance decision: {val(bi.adrt.exists)}{bi.adrt.details ? ` — ${bi.adrt.details}` : ''}.</>}
            </Sec>
            <Sec title="Their wishes, feelings, beliefs and values" law="s4(6)">
              {bi.wishesFeelings} {bi.beliefsValues && <>Beliefs and values: {bi.beliefsValues}</>}
            </Sec>
            <Sec title="How they were involved" law="s4(4)">{bi.participation}</Sec>
            <Sec title="Who was consulted" law="s4(7)">
              {(bi.consultees || []).length === 0 ? 'Nobody appropriate to consult.' : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>{bi.consultees.map((c: any, i: number) => <li key={i}><strong>{c.name}</strong> ({c.relationship}): {c.view}</li>)}</ul>
              )}
              {bi.imca?.referred && <div>IMCA instructed: {bi.imca.name || 'yes'}.</div>}
            </Sec>
            <Sec title="Options considered" law="s1(6)">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {(bi.options || []).map((o: any, i: number) => (
                  <li key={i}><strong>{o.option}</strong>{o.restrictiveness ? ` (${o.restrictiveness} restrictive)` : ''}. Benefits: {o.benefits || '—'}. Burdens: {o.burdens || '—'}.</li>
                ))}
              </ul>
            </Sec>
            <Sec title="Decision made in their best interests" law="s4">
              <strong>{bi.chosenOption}.</strong> {bi.whyLeastRestrictive}
            </Sec>
            {validation?.steps?.liberty !== 'not_needed' && (
              <Sec title="Deprivation of liberty" law="Schedule A1; Cheshire West">
                Continuous supervision and control: {val(rec.liberty?.continuousSupervision)}. Not free to leave: {val(rec.liberty?.notFreeToLeave)}.
                {row.deprivation_of_liberty && <> <strong>This is a deprivation of liberty.</strong> Authorisation: {val(rec.liberty?.authorisation)}.</>}
                {rec.liberty?.notes && <div>{rec.liberty.notes}</div>}
              </Sec>
            )}
          </>
        )}
        {row.review_date && <Sec title="Review by">{formatDate(row.review_date)}</Sec>}

        <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          Completed assessments are final and sealed on the record integrity chain. They can be superseded by a
          review but not edited. Assessed under the Mental Capacity Act 2005 and its Code of Practice.
        </p>
      </div>
    </div>
  );
}
