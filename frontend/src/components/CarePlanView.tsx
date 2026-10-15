// ────────────────────────────────────────────────────────────────────────────
// A care plan as the people who use it read it.
//
// Who I am first — in their words — then their day in time order, then each
// need: what I need, what I want, how to support me, when, and the latest
// assessment behind it. Nurses add timed items straight from a need ("turn at
// 14:00"), and those appear on the round. Editing the wording of the plan
// stays in the plan editor, with its versioning and sign-off.
//
// v88: "Know before you help" at the top; each need shows its exact details
// (IDDSI levels, sling, repositioning interval…), every current assessment
// behind it with a button to (re)assess, and its evaluations — "is this
// working?" — which a nurse adds from here.
// ────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { Badge, Empty } from './ds';
import { useAddPlanSchedule, useRemovePlanSchedule, useUpdatePlanSection, useAddEvaluation, useAddPlanSection } from '../hooks';
import { SafetyFacts } from './SafetyFacts';
import { AssessmentRunner, levelTone, toolFor } from './AssessmentRunner';
import { customFieldToDetail } from '../shared/customAssessments';
import type { IconName as IconNameT } from './Icon';
import { DOMAIN_DETAILS, detailValue, type DetailField } from '../shared/careDetails';

import { useLang } from '../i18n';
import { formatDate } from '../utils/formatters';

export const DOMAIN_ICON: Record<string, IconName> = {
  personal_care: 'bath', mobility_transfers: 'footprints', nutrition_hydration: 'utensils', continence: 'droplets',
  skin_integrity: 'bandage', medication: 'pill', pain: 'heart-pulse', breathing_circulation: 'activity',
  communication_sensory: 'message-square', cognition_mental_health: 'brain', behaviour_support: 'hand',
  social_emotional: 'users', night_care: 'moon', safety_risk: 'triangle-alert', end_of_life: 'hand-heart',
};
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CarePlanView({ plan, canEdit }: { plan: any; canEdit: boolean }) {
  const { t: tr, tf } = useLang();
  const sections: any[] = plan.sections || [];
  const applicable = sections.filter(s => s.applicable);
  const notApplicable = sections.filter(s => !s.applicable);
  const day = useMemo(() => applicable
    .flatMap(s => (s.schedule || []).map((x: any) => ({ ...x, domain: s.domain, domainLabel: s.domainLabel })))
    .sort((a, b) => a.time.localeCompare(b.time)), [applicable]);

  const about: [string, string | null][] = [
    ['What matters to me', plan.whatMattersToMe],
    ['How to support me best', plan.howToSupportMeBest],
    ['Please don’t', plan.pleaseDoNot],
    ['My routine', plan.myRoutine],
    ['People who matter to me', plan.peopleWhoMatter],
    ['How I communicate', plan.communicationPreferences],
    ['What upsets or worries me', plan.whatUpsetsMe || plan.whatMakesMeAnxious],
    ['What I can still do myself', plan.myStrengths],
  ];
  const statusTone = plan.reviewOverdue ? 'red' : plan.status === 'active' ? 'green' : 'amber';
  const statusText = plan.reviewOverdue ? tr('Review overdue') : plan.status === 'active' ? tr('Active') : plan.status === 'draft' ? tr('Draft — not signed off') : tr('Changed — needs re-signing');

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="cv-card cv-card-pad" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge tone={statusTone} icon={plan.reviewOverdue ? 'triangle-alert' : 'clipboard-check'}>{statusText}</Badge>
            <span style={{ color: 'var(--text-muted)', fontSize: '.88rem' }}>{tf('Version {n}', { n: plan.version })} · {tf('{n}% complete', { n: plan.completenessPercent })}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: '.92rem', color: 'var(--text-secondary)' }}>
            {plan.approvedAt && <>{tr('Signed off')} {formatDate(plan.approvedAt)}{plan.approvedByName ? ` · ${plan.approvedByName}` : ''}{plan.approvedRole ? ` (${String(plan.approvedRole).replace(/_/g, ' ')})` : ''} · </>}
            {plan.nextReviewDate && <span style={{ color: plan.reviewOverdue ? 'var(--red-700)' : undefined, fontWeight: plan.reviewOverdue ? 700 : 400 }}>{tr('Next review')} {formatDate(plan.nextReviewDate)}</span>}
          </div>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canEdit && <Link to={`/care-plans?plan=${plan.id}`} className="cv-btn cv-btn-primary"><Icon name="pencil" size={17} />{tr('Edit or review')}</Link>}
          <Link to={`/care-plans/${plan.id}/print`} className="cv-btn cv-btn-secondary"><Icon name="printer" size={17} />{tr('Print full plan')}</Link>
        </div>
      </div>

      {(plan.facts || []).length > 0 && <SafetyFacts facts={plan.facts} source="plan" />}

      {(plan.warnings || []).map((w: any) => (
        <div key={`${w.sectionId}-${w.assessment}`} className="cv-note cv-note-red">
          <Icon name="triangle-alert" size={16} />
          <span>{tf('"{area}" is marked not applicable, but {assessment} shows {result}. Carers will not see this risk — review the plan.', { area: tr(w.domainLabel), assessment: w.assessment, result: w.headline })}</span>
        </div>
      ))}

      {about.some(([, v]) => v) && (
        <div className="cv-card cv-card-pad">
          <h2 className="cv-section-title"><Icon name="user-round" size={18} />{tf('About {name}', { name: plan.preferredName || String(plan.residentName || '').split(' ')[0] })}</h2>
          <div className="cv-about">
            {about.filter(([, v]) => v).map(([k, v], i) => i === 0
              ? <blockquote key={k}>{v}</blockquote>
              : <dl key={k} className="cv-kv" style={{ margin: 0 }}><div><dt>{tr(k)}</dt><dd>{v}</dd></div></dl>)}
          </div>
        </div>
      )}

      <div className="cv-card cv-card-pad">
        <h2 className="cv-section-title"><Icon name="clock" size={18} />{tr('Their day')}</h2>
        {day.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            {canEdit ? tr('Nothing timed yet. Add times from each need below — they appear on the round at that time.') : tr('Nothing timed yet.')}
          </p>
        ) : (
          <div className="cv-schedule">
            {day.map(x => (
              <div key={x.id} className="cv-schedule-item">
                <span className="cv-schedule-time">{x.time}</span>
                <Icon name={DOMAIN_ICON[x.domain] || 'clipboard-list'} size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ flex: 1 }}>{x.what}{x.day_of_week != null && <span style={{ color: 'var(--text-muted)' }}> · {tr(DAYS[x.day_of_week])}</span>}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {applicable.length === 0 ? (
        <div className="cv-card"><Empty icon="clipboard-list" title={tr('No needs written yet')}>{tr('Open the plan editor to assess each area of care.')}</Empty></div>
      ) : (
        <div className="cv-plan-grid">
          {applicable.map(s => <NeedCard key={s.id} planId={plan.id} residentId={plan.residentId} residentName={plan.residentName} s={s} canEdit={canEdit} customTools={plan.customTools || []} />)}
        </div>
      )}

      {canEdit && <AddSection planId={plan.id} available={plan.availableSections || []} />}

      {notApplicable.length > 0 && (
        <p style={{ fontSize: '.88rem', color: 'var(--text-muted)', margin: 0 }}>
          {tr('Not applicable')}: {notApplicable.map(s => s.domainLabel).join(' · ')}
        </p>
      )}
    </div>
  );
}

/** Records kept on other screens, shown on their area of the plan (v90). */
function linkedText(l: any, tr: (s: string) => string, tf: (s: string, v: Record<string, string | number>) => string): string {
  if (l.kind === 'wounds') return tf('{n} open wounds', { n: l.n });
  if (l.kind === 'news2') return tf('NEWS2 {n}', { n: l.n });
  if (l.kind === 'mca') return tf('{n} capacity assessments', { n: l.n });
  if (l.kind === 'dols') return `${tr('DoLS')}: ${String(l.status || '').replace(/_/g, ' ')}`;
  if (l.kind === 'continence') return tr('Continence assessment');
  return l.text;
}

function AddSection({ planId, available }: { planId: string; available: { key: string; label: string; hint?: string }[] }) {
  const { t: tr } = useLang();
  const add = useAddPlanSection();
  const [pick, setPick] = useState('');
  if (!available.length) return null;
  return (
    <div className="cv-card cv-card-pad no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <Icon name="plus" size={18} />
      <select className="form-input" value={pick} onChange={e => setPick(e.target.value)} style={{ flex: 1, minWidth: 200 }} aria-label={tr('Add a section')}>
        <option value="">{tr('Add one of the home\'s own sections…')}</option>
        {available.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
      </select>
      <button className="cv-btn cv-btn-secondary" disabled={!pick || add.isPending} onClick={() => add.mutate({ planId, domain: pick }, { onSuccess: () => setPick('') })}>{tr('Add a section')}</button>
    </div>
  );
}

function NeedCard({ planId, residentId, residentName, s, canEdit, customTools }: { planId: string; residentId: string; residentName: string; s: any; canEdit: boolean; customTools: any[] }) {
  const { t: tr, tf } = useLang();
  const add = useAddPlanSchedule();
  const remove = useRemovePlanSchedule();
  const [adding, setAdding] = useState(false);
  const [time, setTime] = useState('');
  const [what, setWhat] = useState('');
  const [weekly, setWeekly] = useState<string>('');
  const [running, setRunning] = useState<string | null>(null);
  const [editingDetails, setEditingDetails] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const statusBadge = s.status === 'needs_change' ? <Badge tone="amber">{tr('Needs change')}</Badge>
    : s.status === 'in_place' ? <Badge tone="green">{tr('In place')}</Badge> : <Badge tone="grey">{tr('Not started')}</Badge>;
  const assessments: any[] = s.assessments || [];
  // Built-in assessments and the home's own, for this area (v90).
  const suggested: string[] = (s.suggestedTools || []).filter((k: string) => !!toolFor(k, customTools));
  // Built-in fields plus the home's own for this area (v90).
  const fields: DetailField[] = [...(DOMAIN_DETAILS[s.domain] || []), ...((s.customFields || []) as any[]).map(customFieldToDetail)];
  const details = s.details || {};
  const shown = fields.filter(f => { const v = details[f.key]; return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0); });
  const evals: any[] = s.evaluations || [];
  const small = { minHeight: 38, padding: '6px 12px', fontSize: '.86rem' };

  return (
    <div className="cv-card cv-card-pad cv-need">
      <div className="cv-need-head">
        <span className="cv-need-icon"><Icon name={(s.icon as IconNameT) || DOMAIN_ICON[s.domain] || 'clipboard-list'} size={20} /></span>
        <h3>{tr(s.domainLabel)}</h3>
        {statusBadge}
      </div>
      {assessments.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {assessments.map(a => (
            <Badge key={a.id} tone={a.legacy ? 'amber' : a.overdue ? 'red' : (levelTone(a.risk_level) === 'blue' ? 'grey' : levelTone(a.risk_level))} icon={a.overdue ? 'clock' : 'clipboard-check'}
              title={a.legacy ? tr('Older automatic score — reassess') : undefined}>
              {a.name}{a.legacy ? ` ${a.total_score}*` : a.headline ? ` · ${a.headline}` : ''} · {formatDate(a.created_at)}{a.overdue ? ` · ${tr('Review overdue')}` : ''}
            </Badge>
          ))}
        </div>
      )}
      {(s.linked || []).length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(s.linked as any[]).map(l => (
            <Link key={l.kind} to={l.to} style={{ textDecoration: 'none' }}>
              <Badge tone={l.tone === 'red' ? 'red' : l.tone === 'amber' ? 'amber' : 'grey'} icon="clipboard-list">{linkedText(l, tr, tf)}</Badge>
            </Link>
          ))}
        </div>
      )}
      {shown.length > 0 && (
        <dl className="cv-details">
          {shown.map(f => <div key={f.key}><dt>{tr(f.label)}</dt><dd>{detailValue(f, details[f.key])}</dd></div>)}
        </dl>
      )}
      <dl className="cv-kv" style={{ margin: 0 }}>
        {s.assessedNeed && <div><dt>{tr('What I need')}</dt><dd style={{ whiteSpace: 'pre-line' }}>{s.assessedNeed}</dd></div>}
        {s.desiredOutcome && <div><dt>{tr('What I want')}</dt><dd>{s.desiredOutcome}</dd></div>}
        {s.interventions && <div><dt>{tr('How to support me')}</dt><dd style={{ whiteSpace: 'pre-line' }}>{s.interventions}</dd></div>}
        {(s.equipment || s.staffRequired) && <div><dt>{tr('Equipment and staff')}</dt><dd>{[s.equipment, s.staffRequired].filter(Boolean).join(' · ')}</dd></div>}
        {!s.assessedNeed && !s.interventions && <div><dd style={{ color: 'var(--text-muted)' }}>{tr('Not assessed yet.')}</dd></div>}
      </dl>

      {(s.schedule || []).length > 0 && (
        <div className="cv-schedule">
          {s.schedule.map((x: any) => (
            <div key={x.id} className="cv-schedule-item">
              <span className="cv-schedule-time">{x.time}</span>
              <span style={{ flex: 1 }}>{x.what}{x.day_of_week != null && <span style={{ color: 'var(--text-muted)' }}> · {tr(DAYS[x.day_of_week])}</span>}</span>
              {canEdit && (
                <button className="no-print" aria-label={tr('Remove from the day')} title={tr('Remove from the day')}
                  onClick={() => { if (window.confirm(tr('Remove this from their day? Anything already recorded stays.'))) remove.mutate(x.id); }}
                  style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, minHeight: 32, minWidth: 32, display: 'grid', placeItems: 'center' }}>
                  <Icon name="x" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {evals.length > 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div className="cv-eyebrow">{tr('Is it working?')}</div>
          {evals.slice(0, 2).map(e => (
            <div key={e.id} className={`cv-eval cv-eval-${e.progress}`}>
              <strong>{tr(PROGRESS_LABEL[e.progress] || e.progress)}</strong>{!e.stillRight && <> · <span className="cv-text-amber">{tr('Plan needs changing')}</span></>}
              <span style={{ color: 'var(--text-muted)' }}> · {formatDate(e.at)} · {e.by}</span>
              <div>{e.note}</div>
            </div>
          ))}
        </div>
      )}

      {canEdit && s.domain !== 'medication' && adding && (
        <div className="no-print" style={{ display: 'grid', gap: 8, padding: 10, borderRadius: 'var(--radius)', background: 'var(--surface-2)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="time" className="form-input" value={time} onChange={e => setTime(e.target.value)} style={{ width: 120 }} aria-label={tr('Time')} />
            <select className="form-input" value={weekly} onChange={e => setWeekly(e.target.value)} style={{ width: 140 }} aria-label={tr('How often')}>
              <option value="">{tr('Every day')}</option>
              {DAYS.map((d, i) => <option key={d} value={i}>{tf('Every {day}', { day: tr(d) })}</option>)}
            </select>
          </div>
          <input className="form-input" value={what} onChange={e => setWhat(e.target.value)} maxLength={120}
            placeholder={tr('What should be done, in a few words')} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="cv-btn cv-btn-primary" disabled={!time || what.trim().length < 3 || add.isPending}
              onClick={() => add.mutate({ planId, sectionId: s.id, time, what: what.trim(), dayOfWeek: weekly === '' ? null : Number(weekly) },
                { onSuccess: () => { setTime(''); setWhat(''); setWeekly(''); setAdding(false); } })}>
              {add.isPending ? tr('Adding…') : tr('Add to their day')}
            </button>
            <button className="cv-btn cv-btn-quiet" onClick={() => setAdding(false)}>{tr('Cancel')}</button>
          </div>
          <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{tr('It appears on the round at this time, and recording it there ticks it off.')}</span>
        </div>
      )}
      {canEdit && editingDetails && <DetailsEditor planId={planId} s={s} fields={fields} onClose={() => setEditingDetails(false)} />}
      {canEdit && evaluating && <EvaluationForm planId={planId} sectionId={s.id} onClose={() => setEvaluating(false)} />}

      {canEdit && !adding && !editingDetails && !evaluating && (
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {s.domain !== 'medication' && <button className="cv-btn cv-btn-secondary" style={small} onClick={() => setAdding(true)}><Icon name="plus" size={16} />{tr('Add a time')}</button>}
          {fields.length > 0 && <button className="cv-btn cv-btn-secondary" style={small} onClick={() => setEditingDetails(true)}><Icon name="pencil" size={16} />{tr('Key details')}</button>}
          <button className="cv-btn cv-btn-secondary" style={small} onClick={() => setEvaluating(true)}><Icon name="list-checks" size={16} />{tr('Evaluate')}</button>
          {suggested.map(k => {
            const cur = assessments.find(a => a.type === k);
            return (
              <button key={k} className="cv-btn cv-btn-secondary" style={small} onClick={() => setRunning(k)}>
                <Icon name={cur ? 'rotate-cw' : 'clipboard-check'} size={16} />{tf(cur ? 'Reassess: {tool}' : 'Assess: {tool}', { tool: toolFor(k, customTools)!.shortName })}
              </button>
            );
          })}
        </div>
      )}
      {running && toolFor(running, customTools) && <AssessmentRunner residentId={residentId} residentName={residentName} type={running} tool={toolFor(running, customTools)!} onClose={() => setRunning(null)} />}
    </div>
  );
}

const PROGRESS_LABEL: Record<string, string> = { better: 'Better', same: 'No change', worse: 'Worse', met: 'Goal met' };

function DetailsEditor({ planId, s, fields, onClose }: { planId: string; s: any; fields: DetailField[]; onClose: () => void }) {
  const { t: tr } = useLang();
  const save = useUpdatePlanSection();
  const [vals, setVals] = useState<Record<string, any>>(() => ({ ...(s.details || {}) }));
  const setV = (k: string, v: any) => setVals(x => ({ ...x, [k]: v }));
  const submit = () => {
    const out: Record<string, any> = {};
    for (const f of fields) {
      const v = vals[f.key];
      if (f.type === 'list') out[f.key] = Array.isArray(v) ? v : String(v || '').split(/\n|,/).map(x => x.trim()).filter(Boolean);
      else if (f.type === 'number') out[f.key] = v === '' || v === undefined || v === null ? '' : Number(v);
      else out[f.key] = v === undefined ? '' : v;
    }
    save.mutate({ planId, sectionId: s.id, details: out }, { onSuccess: onClose });
  };
  return (
    <div className="no-print" style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 'var(--radius)', background: 'var(--surface-2)' }}>
      <div className="cv-eyebrow">{tr('Key details')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {fields.map(f => (
          <label key={f.key} className="form-label" style={{ margin: 0 }}>{tr(f.label)}{f.unit ? ` (${f.unit})` : ''}
            {f.type === 'select' ? (
              <select className="form-input" style={{ width: '100%', marginTop: 4 }} value={vals[f.key] ?? ''} onChange={e => setV(f.key, e.target.value)}>
                <option value="">—</option>
                {(f.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === 'bool' ? (
              <select className="form-input" style={{ width: '100%', marginTop: 4 }} value={vals[f.key] === true ? 'true' : vals[f.key] === false ? 'false' : ''} onChange={e => setV(f.key, e.target.value === '' ? '' : e.target.value === 'true')}>
                <option value="">—</option><option value="true">{tr('Yes')}</option><option value="false">{tr('No')}</option>
              </select>
            ) : f.type === 'list' ? (
              <textarea className="form-input" rows={2} style={{ width: '100%', marginTop: 4 }} value={Array.isArray(vals[f.key]) ? vals[f.key].join('\n') : (vals[f.key] || '')} onChange={e => setV(f.key, e.target.value)} />
            ) : (
              <input className="form-input" style={{ width: '100%', marginTop: 4 }} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                min={f.min} max={f.max} value={vals[f.key] ?? ''} placeholder={f.hint || ''} onChange={e => setV(f.key, e.target.value)} />
            )}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="cv-btn cv-btn-primary" disabled={save.isPending} onClick={submit}>{save.isPending ? tr('Saving…') : tr('Save')}</button>
        <button className="cv-btn cv-btn-quiet" onClick={onClose}>{tr('Cancel')}</button>
      </div>
      <span style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{tr('Carers see the key facts on the resident before they help. Changing a signed plan means it needs re-signing.')}</span>
    </div>
  );
}

function EvaluationForm({ planId, sectionId, onClose }: { planId: string; sectionId: string; onClose: () => void }) {
  const { t: tr } = useLang();
  const save = useAddEvaluation();
  const [progress, setProgress] = useState('');
  const [note, setNote] = useState('');
  const [stillRight, setStillRight] = useState<boolean | null>(null);
  return (
    <div className="no-print" style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 'var(--radius)', background: 'var(--surface-2)' }}>
      <div className="cv-eyebrow">{tr('Is it working?')}</div>
      <div className="cv-seg" role="radiogroup" style={{ flexWrap: 'wrap' }}>
        {Object.entries(PROGRESS_LABEL).map(([k, l]) => <button key={k} role="radio" aria-checked={progress === k} className={progress === k ? 'active' : ''} onClick={() => setProgress(k)}>{tr(l)}</button>)}
      </div>
      <textarea className="form-input" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder={tr('What have you seen? What do they and their family say?')} />
      <div className="cv-seg" role="radiogroup" style={{ flexWrap: 'wrap' }}>
        <button role="radio" aria-checked={stillRight === true} className={stillRight === true ? 'active' : ''} onClick={() => setStillRight(true)}>{tr('The plan is still right')}</button>
        <button role="radio" aria-checked={stillRight === false} className={stillRight === false ? 'active' : ''} onClick={() => setStillRight(false)}>{tr('The plan needs changing')}</button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="cv-btn cv-btn-primary" disabled={!progress || note.trim().length < 10 || stillRight === null || save.isPending}
          onClick={() => save.mutate({ planId, sectionId, progress, note: note.trim(), stillRight: !!stillRight }, { onSuccess: onClose })}>
          {save.isPending ? tr('Saving…') : tr('Save evaluation')}
        </button>
        <button className="cv-btn cv-btn-quiet" onClick={onClose}>{tr('Cancel')}</button>
      </div>
    </div>
  );
}
