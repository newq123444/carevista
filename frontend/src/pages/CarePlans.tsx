import React, { useState, useMemo } from 'react';
import { useLang } from '../i18n';
import { useAuthStore } from '../store/auth.store';
import {
  useCarePlanOverview, useCarePlans, useCarePlan, useCarePlanReviews, useCarePlanVersions,
  useCarePlanVersion, useCreateCarePlan, useUpdateCarePlan, useUpdateCarePlanSection,
  useApproveCarePlan, useAddCarePlanReview, useArchiveCarePlan, useImportAiDraft,
} from '../hooks';

// ─────────────────────────────────────────────────────────────────────────────
// The person-centred care plan (CQC Regulation 9).
//
// Two views: a home-wide list that answers "who has no plan and whose plan is
// stale", and an editor built around the four questions that make a section
// usable by a carer on their first night shift.
// ─────────────────────────────────────────────────────────────────────────────

const CLINICAL_ROLES = ['registered_nurse', 'senior_carer', 'home_manager', 'deputy_manager', 'super_admin', 'group_admin', 'admin'];

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  draft:        { bg: '#fef3c7', fg: '#92400e', label: 'Draft — not yet signed off' },
  active:       { bg: '#d1fae5', fg: '#065f46', label: 'Active' },
  under_review: { bg: '#dbeafe', fg: '#1e40af', label: 'Changed — needs re-signing' },
  archived:     { bg: '#e5e7eb', fg: '#374151', label: 'Archived' },
};

const SECTION_STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  not_started:  { bg: '#f1f5f9', fg: '#64748b', label: 'Not started' },
  in_place:     { bg: '#d1fae5', fg: '#065f46', label: 'In place' },
  needs_change: { bg: '#fee2e2', fg: '#991b1b', label: 'Needs change' },
};

const RISK_COLOR: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Pill({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}

function Kpi({ label, value, tone, note }: { label: string; value: React.ReactNode; tone?: string; note?: string }) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="card-body" style={{ padding: '16px 18px' }}>
        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</div>
        <div style={{ fontSize: '1.9rem', fontWeight: 700, color: tone || '#0f172a', lineHeight: 1.15, marginTop: 4 }}>{value}</div>
        {note && <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: 2 }}>{note}</div>}
      </div>
    </div>
  );
}

function Field({ label, value, strong }: { label: string; value?: string | null; strong?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 3 }}>{label}</div>
      <div style={{ whiteSpace: 'pre-wrap', color: value ? '#0f172a' : '#cbd5e1', fontWeight: strong && value ? 500 : 400 }}>
        {value || 'Not yet recorded'}
      </div>
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3, hint }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {hint && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>{hint}</div>}
      <textarea className="form-input" rows={rows} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// ── One editable domain section ─────────────────────────────────────────────
function SectionEditor({ planId, section, readOnly, onSaved }: {
  planId: string; section: any; readOnly: boolean; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const save = useUpdateCarePlanSection();

  const editing = draft !== null;
  const v = editing ? draft : section;

  function startEdit() {
    setDraft({
      applicable: section.applicable,
      notApplicableReason: section.notApplicableReason || '',
      assessedNeed: section.assessedNeed || '',
      desiredOutcome: section.desiredOutcome || '',
      interventions: section.interventions || '',
      residentView: section.residentView || '',
      equipment: section.equipment || '',
      staffRequired: section.staffRequired || '',
      frequency: section.frequency || '',
      measureOfSuccess: section.measureOfSuccess || '',
      riskLevel: section.riskLevel || 'low',
      status: section.status || 'not_started',
    });
    setOpen(true);
  }

  function submit() {
    save.mutate({ id: planId, sectionId: section.id, data: draft } as any, {
      onSuccess: () => { setDraft(null); onSaved(); },
    });
  }

  const st = SECTION_STATUS[section.status] || SECTION_STATUS.not_started;

  return (
    <div className="card" style={{ marginBottom: 12, borderLeft: `4px solid ${section.applicable ? (section.complete ? '#10b981' : '#f59e0b') : '#cbd5e1'}` }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}
      >
        <span style={{ color: '#94a3b8', fontSize: '0.9rem', width: 14 }}>{open ? '▾' : '▸'}</span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 600, color: '#0f172a' }}>{section.domainLabel}</div>
          {!open && (
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }}>
              {!section.applicable
                ? `Not applicable${section.notApplicableReason ? ` — ${section.notApplicableReason}` : ''}`
                : (section.interventions || section.assessedNeed || 'Nothing recorded yet')}
            </div>
          )}
        </div>
        {section.applicable && section.riskLevel !== 'low' && (
          <Pill text={section.riskLevel === 'high' ? 'High risk' : 'Medium risk'} bg="#fff" fg={RISK_COLOR[section.riskLevel]} />
        )}
        {!section.applicable
          ? <Pill text="Not applicable" bg="#f1f5f9" fg="#64748b" />
          : section.complete
            ? <Pill text={st.label} bg={st.bg} fg={st.fg} />
            : <Pill text="Incomplete" bg="#fef3c7" fg="#92400e" />}
      </div>

      {open && (
        <div className="card-body" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
          {!editing && (
            <>
              {section.hint && (
                <div style={{ fontSize: '0.8rem', color: '#64748b', background: '#f8fafc', padding: '8px 12px', borderRadius: 6, marginBottom: 14 }}>
                  {section.hint}
                </div>
              )}
              {!section.applicable ? (
                <p style={{ color: '#64748b', margin: 0 }}>
                  Marked not applicable{section.notApplicableReason ? `: ${section.notApplicableReason}` : '.'}
                </p>
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  <Field label="What this person can and cannot do" value={section.assessedNeed} />
                  <Field label="What good looks like for them" value={section.desiredOutcome} />
                  <Field label="What staff do" value={section.interventions} strong />
                  <Field label="What they say about this" value={section.residentView} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
                    <Field label="Equipment" value={section.equipment} />
                    <Field label="Staff needed" value={section.staffRequired} />
                    <Field label="How often" value={section.frequency} />
                  </div>
                  <Field label="How we will know it is working" value={section.measureOfSuccess} />
                </div>
              )}
              <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {!readOnly && <button className="btn btn-primary btn-sm" onClick={startEdit}>Edit this section</button>}
                {section.updatedByName && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Last changed by {section.updatedByName} on {fmtDate(section.updatedAt)}
                  </span>
                )}
              </div>
            </>
          )}

          {editing && (
            <div style={{ display: 'grid', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                <input type="checkbox" checked={!v.applicable}
                  onChange={e => setDraft({ ...draft, applicable: !e.target.checked })} />
                This area does not apply to this person
              </label>

              {!v.applicable ? (
                <div className="form-group">
                  <label className="form-label">Why does it not apply?</label>
                  <input className="form-input" value={v.notApplicableReason}
                    placeholder="e.g. Fully continent, no support needed"
                    onChange={e => setDraft({ ...draft, notApplicableReason: e.target.value })} />
                </div>
              ) : (
                <>
                  <TextArea label="What this person can and cannot do" rows={3}
                    hint="Be specific. 'Needs help with washing' tells a new carer nothing."
                    value={v.assessedNeed} onChange={x => setDraft({ ...draft, assessedNeed: x })} />
                  <TextArea label="What good looks like for them" rows={2}
                    hint="In their words where you can."
                    value={v.desiredOutcome} onChange={x => setDraft({ ...draft, desiredOutcome: x })} />
                  <TextArea label="What staff do" rows={4}
                    hint="Write it so somebody on their first shift could follow it."
                    value={v.interventions} onChange={x => setDraft({ ...draft, interventions: x })} />
                  <TextArea label="What they say about this" rows={2}
                    value={v.residentView} onChange={x => setDraft({ ...draft, residentView: x })} />
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Equipment</label>
                      <input className="form-input" value={v.equipment}
                        placeholder="e.g. Full hoist, medium sling"
                        onChange={e => setDraft({ ...draft, equipment: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Staff needed</label>
                      <input className="form-input" value={v.staffRequired}
                        placeholder="e.g. 2 carers"
                        onChange={e => setDraft({ ...draft, staffRequired: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">How often</label>
                      <input className="form-input" value={v.frequency}
                        placeholder="e.g. 4-hourly, day and night"
                        onChange={e => setDraft({ ...draft, frequency: e.target.value })} />
                    </div>
                  </div>
                  <TextArea label="How we will know it is working" rows={2}
                    value={v.measureOfSuccess} onChange={x => setDraft({ ...draft, measureOfSuccess: x })} />
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Risk level for this area</label>
                      <select className="form-input" value={v.riskLevel}
                        onChange={e => setDraft({ ...draft, riskLevel: e.target.value })}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select className="form-input" value={v.status}
                        onChange={e => setDraft({ ...draft, status: e.target.value })}>
                        <option value="not_started">Not started</option>
                        <option value="in_place">In place</option>
                        <option value="needs_change">Needs change</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary btn-sm" onClick={submit} disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : 'Save section'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setDraft(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── The editor ──────────────────────────────────────────────────────────────
function PlanEditor({ planId, onBack, canEdit }: { planId: string; onBack: () => void; canEdit: boolean }) {
  const { data: plan, refetch } = useCarePlan(planId);
  const { data: reviews } = useCarePlanReviews(planId);
  const { data: versions } = useCarePlanVersions(planId);
  const [tab, setTab] = useState<'plan' | 'reviews' | 'history'>('plan');
  const [editHeader, setEditHeader] = useState(false);
  const [header, setHeader] = useState<any>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [review, setReview] = useState<any>({
    reviewType: 'routine', outcome: 'no_change', whatIsWorking: '', whatIsNotWorking: '',
    whatChanged: '', residentPresent: false, familyPresent: false, othersPresent: '',
  });
  const [viewVersionId, setViewVersionId] = useState('');
  const { data: versionDetail } = useCarePlanVersion(planId, viewVersionId);

  const updatePlan = useUpdateCarePlan();
  const approve = useApproveCarePlan();
  const addReview = useAddCarePlanReview();
  const archive = useArchiveCarePlan();
  const importAi = useImportAiDraft();

  if (!plan) return <div className="card"><div className="card-body">Loading care plan…</div></div>;

  const readOnly = !canEdit || plan.status === 'archived';
  const st = STATUS_STYLE[plan.status] || STATUS_STYLE.draft;
  const sections: any[] = plan.sections || [];
  const incomplete = sections.filter((s: any) => !s.complete).length;

  function openHeaderEdit() {
    setHeader({
      whatMattersToMe: plan.whatMattersToMe || '',
      howToSupportMeBest: plan.howToSupportMeBest || '',
      whatUpsetsMe: plan.whatUpsetsMe || '',
      myRoutine: plan.myRoutine || '',
      communicationPreferences: plan.communicationPreferences || '',
      culturalSpiritualNeeds: plan.culturalSpiritualNeeds || '',
      residentInvolved: plan.residentInvolved,
      residentInvolvementNotes: plan.residentInvolvementNotes || '',
      familyInvolved: plan.familyInvolved,
      familyInvolvementNotes: plan.familyInvolvementNotes || '',
      advocateName: plan.advocateName || '',
      bestInterestsDecision: plan.bestInterestsDecision || '',
      reviewFrequencyDays: plan.reviewFrequencyDays || 30,
    });
    setEditHeader(true);
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← All care plans</button>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h1 className="page-title" style={{ marginBottom: 2 }}>{plan.preferredName || plan.residentName}</h1>
          <div className="page-subtitle" style={{ margin: 0 }}>
            Room {plan.roomNumber} · Version {plan.version} · {plan.completenessPercent}% complete
          </div>
        </div>
        <Pill text={st.label} bg={st.bg} fg={st.fg} />
      </div>

      {plan.reviewOverdue && (
        <div className="card" style={{ marginBottom: 16, background: '#fef2f2', borderLeft: '4px solid #ef4444' }}>
          <div className="card-body" style={{ padding: '12px 18px', color: '#991b1b' }}>
            This plan was due for review on {fmtDate(plan.nextReviewDate)}. An out-of-date plan is treated as no plan.
          </div>
        </div>
      )}
      {plan.status === 'under_review' && (
        <div className="card" style={{ marginBottom: 16, background: '#eff6ff', borderLeft: '4px solid #3b82f6' }}>
          <div className="card-body" style={{ padding: '12px 18px', color: '#1e40af' }}>
            This plan has changed since it was last signed off. Sign it off again so the team knows it is current.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
        <Kpi label="Allergies" value={<span style={{ fontSize: '0.95rem' }}>{plan.allergies || 'None recorded'}</span>} tone={plan.allergies ? '#b91c1c' : undefined} />
        <Kpi label="DNACPR" value={<span style={{ fontSize: '0.95rem' }}>{plan.dnacpr ? 'In place' : 'Not in place'}</span>} tone={plan.dnacpr ? '#b91c1c' : undefined} />
        <Kpi label="GP" value={<span style={{ fontSize: '0.95rem' }}>{plan.gpName || '—'}</span>} note={plan.gpPractice || undefined} />
        <Kpi label="Next review" value={<span style={{ fontSize: '0.95rem' }}>{fmtDate(plan.nextReviewDate)}</span>} tone={plan.reviewOverdue ? '#b91c1c' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 18 }}>
        {(['plan', 'reviews', 'history'] as const).map(k => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === k ? '3px solid #4f46e5' : '3px solid transparent',
            color: tab === k ? '#4f46e5' : '#64748b', fontWeight: tab === k ? 600 : 400,
          }}>
            {k === 'plan' ? 'The plan' : k === 'reviews' ? `Reviews (${reviews?.length || 0})` : `History (${versions?.length || 0})`}
          </button>
        ))}
      </div>

      {tab === 'plan' && (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">About {plan.preferredName || String(plan.residentName || '').split(' ')[0]}</span>
              {!readOnly && !editHeader && <button className="btn btn-ghost btn-sm" onClick={openHeaderEdit}>Edit</button>}
            </div>
            <div className="card-body">
              {!editHeader ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <Field label="What matters to me" value={plan.whatMattersToMe} strong />
                  <Field label="How to support me best" value={plan.howToSupportMeBest} />
                  <Field label="What upsets me" value={plan.whatUpsetsMe} />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                    <Field label="My routine" value={plan.myRoutine} />
                    <Field label="How I communicate" value={plan.communicationPreferences} />
                    <Field label="Culture, faith & identity" value={plan.culturalSpiritualNeeds} />
                  </div>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
                    <Field label="Resident involved in this plan" value={plan.residentInvolved ? (plan.residentInvolvementNotes || 'Yes') : 'Not recorded'} />
                    <Field label="Family involved" value={plan.familyInvolved ? (plan.familyInvolvementNotes || 'Yes') : 'Not recorded'} />
                    <Field label="Advocate" value={plan.advocateName} />
                  </div>
                  {plan.bestInterestsDecision && <Field label="Best interests decision" value={plan.bestInterestsDecision} />}
                  {!plan.residentInvolved && (
                    <div style={{ fontSize: '0.8rem', color: '#92400e', background: '#fffbeb', padding: '8px 12px', borderRadius: 6 }}>
                      Nobody has recorded the resident's involvement in their own plan. Regulation 9 expects it, and inspectors ask about it directly.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                  <TextArea label="What matters to me" rows={3} hint="The things that make a day good for this person."
                    value={header.whatMattersToMe} onChange={x => setHeader({ ...header, whatMattersToMe: x })} />
                  <TextArea label="How to support me best" rows={3}
                    value={header.howToSupportMeBest} onChange={x => setHeader({ ...header, howToSupportMeBest: x })} />
                  <TextArea label="What upsets me" rows={2}
                    value={header.whatUpsetsMe} onChange={x => setHeader({ ...header, whatUpsetsMe: x })} />
                  <TextArea label="My routine" rows={2}
                    value={header.myRoutine} onChange={x => setHeader({ ...header, myRoutine: x })} />
                  <TextArea label="How I communicate" rows={2}
                    value={header.communicationPreferences} onChange={x => setHeader({ ...header, communicationPreferences: x })} />
                  <TextArea label="Culture, faith & identity" rows={2}
                    value={header.culturalSpiritualNeeds} onChange={x => setHeader({ ...header, culturalSpiritualNeeds: x })} />
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input type="checkbox" checked={!!header.residentInvolved}
                        onChange={e => setHeader({ ...header, residentInvolved: e.target.checked })} />
                      The resident took part in making this plan
                    </label>
                    <input className="form-input" placeholder="How were they involved?"
                      value={header.residentInvolvementNotes}
                      onChange={e => setHeader({ ...header, residentInvolvementNotes: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input type="checkbox" checked={!!header.familyInvolved}
                        onChange={e => setHeader({ ...header, familyInvolved: e.target.checked })} />
                      Family or representative took part
                    </label>
                    <input className="form-input" placeholder="Who, and when?"
                      value={header.familyInvolvementNotes}
                      onChange={e => setHeader({ ...header, familyInvolvementNotes: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Advocate (if any)</label>
                    <input className="form-input" value={header.advocateName}
                      onChange={e => setHeader({ ...header, advocateName: e.target.value })} />
                  </div>
                  <TextArea label="Best interests decision (if the person lacks capacity for this)" rows={3}
                    hint="Who was consulted, what options were weighed, and why this is the least restrictive."
                    value={header.bestInterestsDecision} onChange={x => setHeader({ ...header, bestInterestsDecision: x })} />
                  <div className="form-group" style={{ maxWidth: 240 }}>
                    <label className="form-label">Review every (days)</label>
                    <input className="form-input" type="number" min={7} max={365} value={header.reviewFrequencyDays}
                      onChange={e => setHeader({ ...header, reviewFrequencyDays: Number(e.target.value) })} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary btn-sm" disabled={updatePlan.isPending}
                      onClick={() => updatePlan.mutate({ id: planId, data: header } as any, { onSuccess: () => { setEditHeader(false); refetch(); } })}>
                      {updatePlan.isPending ? 'Saving…' : 'Save'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditHeader(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Care needs</h2>
            <span style={{ fontSize: '0.82rem', color: incomplete ? '#b45309' : '#059669' }}>
              {incomplete === 0 ? 'All sections complete' : `${incomplete} of ${sections.length} still to complete`}
            </span>
          </div>
          {sections.map((s: any) => (
            <SectionEditor key={s.id} planId={planId} section={s} readOnly={readOnly} onSaved={refetch} />
          ))}

          {!readOnly && (
            <div className="card" style={{ marginTop: 18 }}>
              <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-primary" disabled={approve.isPending}
                  onClick={() => approve.mutate({ id: planId } as any, { onSuccess: refetch })}>
                  {approve.isPending ? 'Signing…' : plan.status === 'draft' ? 'Sign off this plan' : 'Re-sign this plan'}
                </button>
                <button className="btn btn-secondary" onClick={() => setReviewOpen(true)}>Record a review</button>
                <button className="btn btn-ghost" disabled={importAi.isPending}
                  onClick={() => importAi.mutate({ id: planId } as any, { onSuccess: refetch })}>
                  {importAi.isPending ? 'Importing…' : 'Pre-fill from AI draft'}
                </button>
                <button className="btn btn-ghost" style={{ marginLeft: 'auto', color: '#b91c1c' }}
                  onClick={() => {
                    const reason = window.prompt('Why is this plan being archived?');
                    if (reason && reason.trim()) archive.mutate({ id: planId, reason } as any, { onSuccess: onBack });
                  }}>
                  Archive
                </button>
              </div>
              {plan.approvedByName && (
                <div className="card-body" style={{ paddingTop: 0, fontSize: '0.8rem', color: '#64748b' }}>
                  Last signed off by {plan.approvedByName} on {fmtDate(plan.approvedAt)}.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'reviews' && (
        <div>
          {!readOnly && (
            <button className="btn btn-primary btn-sm" style={{ marginBottom: 14 }} onClick={() => setReviewOpen(true)}>
              Record a review
            </button>
          )}
          {(!reviews || reviews.length === 0) ? (
            <div className="card"><div className="card-body table-empty">
              No reviews recorded yet. A plan that has never been reviewed cannot be shown to be current.
            </div></div>
          ) : reviews.map((r: any) => (
            <div className="card" key={r.id} style={{ marginBottom: 12 }}>
              <div className="card-body">
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                  <strong>{fmtDate(r.reviewDate)}</strong>
                  <Pill text={String(r.reviewType || '').replace(/_/g, ' ')} bg="#eef2ff" fg="#4338ca" />
                  <Pill
                    text={r.outcome === 'no_change' ? 'No change needed' : r.outcome === 'updated' ? 'Plan updated' : 'Escalated'}
                    bg={r.outcome === 'escalated' ? '#fee2e2' : '#f1f5f9'}
                    fg={r.outcome === 'escalated' ? '#991b1b' : '#475569'} />
                  <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#94a3b8' }}>
                    {r.reviewedByName} · v{r.versionAtReview}
                  </span>
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  <Field label="What is working" value={r.whatIsWorking} />
                  <Field label="What is not working" value={r.whatIsNotWorking} />
                  {r.whatChanged && <Field label="What changed" value={r.whatChanged} />}
                </div>
                <div style={{ marginTop: 10, fontSize: '0.78rem', color: '#64748b' }}>
                  {r.residentPresent ? 'Resident present. ' : 'Resident not present. '}
                  {r.familyPresent ? 'Family present. ' : ''}
                  {r.othersPresent ? `Also: ${r.othersPresent}.` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
            A snapshot is kept every time the plan is signed off, reviewed or archived — so it can be shown
            exactly as it stood on any given date.
          </p>
          {(!versions || versions.length === 0) ? (
            <div className="card"><div className="card-body table-empty">No snapshots yet.</div></div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Date</th><th>Version</th><th>Why</th><th>By</th><th></th></tr></thead>
                <tbody>
                  {versions.map((v: any) => (
                    <tr key={v.id}>
                      <td>{fmtDate(v.createdAt)}</td>
                      <td>v{v.version}</td>
                      <td>{v.reason || '—'}</td>
                      <td>{v.createdByName || '—'}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => setViewVersionId(v.id)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {viewVersionId && versionDetail && (
            <div className="modal-overlay" onClick={() => setViewVersionId('')}>
              <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-title">Version {versionDetail.version} — {fmtDate(versionDetail.createdAt)}</span>
                  <button className="modal-close" onClick={() => setViewVersionId('')}>×</button>
                </div>
                <div className="modal-body">
                  {(versionDetail.sections || []).filter((s: any) => s.applicable).map((s: any) => (
                    <div key={s.domain} style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>{s.domainLabel}</div>
                      <div style={{ whiteSpace: 'pre-wrap', color: '#475569', fontSize: '0.88rem' }}>
                        {s.interventions || s.assessed_need || 'Nothing recorded'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {reviewOpen && (
        <div className="modal-overlay" onClick={() => setReviewOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Record a care plan review</span>
              <button className="modal-close" onClick={() => setReviewOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Type of review</label>
                <select className="form-input" value={review.reviewType}
                  onChange={e => setReview({ ...review, reviewType: e.target.value })}>
                  <option value="routine">Routine</option>
                  <option value="change_in_need">Change in need</option>
                  <option value="post_incident">After an incident</option>
                  <option value="post_hospital">After a hospital stay</option>
                  <option value="annual">Annual</option>
                  <option value="requested">Requested by resident or family</option>
                </select>
              </div>
              <TextArea label="What is working" rows={3} value={review.whatIsWorking}
                onChange={x => setReview({ ...review, whatIsWorking: x })} />
              <TextArea label="What is not working" rows={3} value={review.whatIsNotWorking}
                onChange={x => setReview({ ...review, whatIsNotWorking: x })} />
              <TextArea label="What changed as a result" rows={2} value={review.whatChanged}
                onChange={x => setReview({ ...review, whatChanged: x })} />
              <div className="form-group">
                <label className="form-label">Outcome</label>
                <select className="form-input" value={review.outcome}
                  onChange={e => setReview({ ...review, outcome: e.target.value })}>
                  <option value="no_change">No change needed</option>
                  <option value="updated">Plan updated</option>
                  <option value="escalated">Escalated for more input</option>
                </select>
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={review.residentPresent}
                  onChange={e => setReview({ ...review, residentPresent: e.target.checked })} />
                Resident took part
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={review.familyPresent}
                  onChange={e => setReview({ ...review, familyPresent: e.target.checked })} />
                Family took part
              </label>
              <div className="form-group">
                <label className="form-label">Anyone else present</label>
                <input className="form-input" value={review.othersPresent}
                  placeholder="e.g. District nurse, social worker"
                  onChange={e => setReview({ ...review, othersPresent: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setReviewOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={addReview.isPending}
                onClick={() => addReview.mutate({ id: planId, data: review } as any, {
                  onSuccess: () => { setReviewOpen(false); refetch(); },
                })}>
                {addReview.isPending ? 'Saving…' : 'Save review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── The list ────────────────────────────────────────────────────────────────
export default function CarePlans() {
  const { t: tr } = useLang();
  const { user } = useAuthStore();
  const canEdit = CLINICAL_ROLES.includes((user as any)?.role || '');
  const [selected, setSelected] = useState('');
  const [filter, setFilter] = useState('');

  const { data: overview } = useCarePlanOverview();
  const { data: plans } = useCarePlans(filter ? { status: filter } : undefined);
  const createPlan = useCreateCarePlan();

  const list: any[] = Array.isArray(plans) ? plans : [];
  const missing: any[] = overview?.missing || [];
  const overdueCount = useMemo(() => list.filter(p => p.reviewOverdue).length, [list]);

  if (selected) {
    return <div><PlanEditor planId={selected} onBack={() => setSelected('')} canEdit={canEdit} /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{tr('Care Plans')}</h1>
        <p className="page-subtitle">
          Every resident must have a person-centred care plan covering their assessed needs,
          the outcomes they want, and exactly what staff do — reviewed and signed off.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 20 }}>
        <Kpi label="Coverage"
          value={overview?.coveragePercent != null ? `${overview.coveragePercent}%` : '—'}
          tone={overview?.coveragePercent === 100 ? '#059669' : '#b45309'}
          note={overview ? `${(overview.activePlans || 0) + (overview.draftPlans || 0)} of ${overview.totalResidents} residents` : undefined} />
        <Kpi label="No plan at all" value={overview?.residentsWithoutPlan ?? '—'}
          tone={(overview?.residentsWithoutPlan || 0) > 0 ? '#b91c1c' : '#059669'} />
        <Kpi label="Review overdue" value={overview?.overdueReviews ?? overdueCount}
          tone={(overview?.overdueReviews || 0) > 0 ? '#b91c1c' : '#059669'} />
        <Kpi label="Due within 7 days" value={overview?.reviewsDueWeek ?? '—'} />
        <Kpi label="Awaiting sign-off" value={overview?.draftPlans ?? '—'}
          tone={(overview?.draftPlans || 0) > 0 ? '#b45309' : undefined} />
      </div>

      {missing.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #ef4444' }}>
          <div className="card-header">
            <span className="card-title" style={{ color: '#b91c1c' }}>
              {missing.length} resident{missing.length === 1 ? '' : 's'} with no care plan
            </span>
          </div>
          <div className="card-body">
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 0 }}>
              A resident without a care plan is being cared for from memory. This is the first thing an inspector checks.
            </p>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Resident</th><th>Room</th><th>Admitted</th><th>Days here</th><th></th></tr></thead>
                <tbody>
                  {missing.map(m => (
                    <tr key={m.residentId}>
                      <td>{m.residentName}</td>
                      <td>{m.roomNumber}</td>
                      <td>{fmtDate(m.admissionDate)}</td>
                      <td style={{ color: m.daysSinceAdmission > 7 ? '#b91c1c' : '#64748b', fontWeight: m.daysSinceAdmission > 7 ? 600 : 400 }}>
                        {m.daysSinceAdmission}
                      </td>
                      <td>
                        {canEdit && (
                          <button className="btn btn-primary btn-sm" disabled={createPlan.isPending}
                            onClick={() => createPlan.mutate({ residentId: m.residentId } as any, {
                              onSuccess: (d: any) => setSelected(d.id),
                            })}>
                            Start plan
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="card-title">Care plans</span>
          <select className="form-input" style={{ width: 'auto' }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">Current plans</option>
            <option value="draft">Drafts</option>
            <option value="active">Active</option>
            <option value="under_review">Needs re-signing</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        {list.length === 0 ? (
          <div className="card-body table-empty">
            No care plans yet. Start one from the list of residents above.
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Resident</th><th>Room</th><th>Status</th><th>Complete</th>
                  <th>Next review</th><th>Signed off by</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map(p => {
                  const s = STATUS_STYLE[p.status] || STATUS_STYLE.draft;
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.residentName}</td>
                      <td>{p.roomNumber}</td>
                      <td><Pill text={s.label} bg={s.bg} fg={s.fg} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 60, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                              width: `${p.completenessPercent}%`, height: '100%',
                              background: p.completenessPercent === 100 ? '#10b981' : '#f59e0b',
                            }} />
                          </div>
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{p.completenessPercent}%</span>
                        </div>
                      </td>
                      <td style={{ color: p.reviewOverdue ? '#b91c1c' : undefined, fontWeight: p.reviewOverdue ? 600 : 400 }}>
                        {fmtDate(p.nextReviewDate)}{p.reviewOverdue ? ' — overdue' : ''}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{p.approvedByName || 'Not signed off'}</td>
                      <td><button className="btn btn-ghost btn-sm" onClick={() => setSelected(p.id)}>Open</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
