// ────────────────────────────────────────────────────────────────────────────
// The whole care plan on paper: for the resident and family, a hospital
// transfer, an inspector, or the file. Everything a reader needs, in order:
// who they are, what to know first, their day, every need in full (details,
// support, equipment, times, evaluations), the current assessments behind it,
// and who signed it. Areas marked not applicable say why.
// ────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useCarePlan, useResidentAssessments } from '../hooks';
import { DOMAIN_DETAILS, detailValue } from '../shared/careDetails';
import { TOOL_ORDER } from '../shared/assessmentTools';
import { customFieldToDetail } from '../shared/customAssessments';
import { toolFor } from '../components/AssessmentRunner';
import { formatDate, formatDateTime } from '../utils/formatters';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PROGRESS: Record<string, string> = { better: 'Better', same: 'No change', worse: 'Worse', met: 'Goal met' };

export default function PrintCarePlan() {
  const { id } = useParams<{ id: string }>();
  const { data: plan, isLoading } = useCarePlan(id!);
  const { data: assessed } = useResidentAssessments((plan as any)?.residentId);
  if (isLoading || !plan) return <div className="page">Loading…</div>;
  const p: any = plan;
  const sections: any[] = p.sections || [];
  const day = sections.filter(s => s.applicable)
    .flatMap(s => (s.schedule || []).map((x: any) => ({ ...x, label: s.domainLabel })))
    .sort((a, b) => a.time.localeCompare(b.time));
  const current: Record<string, any> = assessed?.current || {};
  const about: [string, string | null][] = [
    ['What matters to me', p.whatMattersToMe], ['How to support me best', p.howToSupportMeBest], ['Please don’t', p.pleaseDoNot],
    ['My routine', p.myRoutine], ['People who matter to me', p.peopleWhoMatter], ['How I communicate', p.communicationPreferences],
    ['What upsets or worries me', p.whatUpsetsMe || p.whatMakesMeAnxious], ['What I can still do myself', p.myStrengths],
    ['Culture, faith and beliefs', p.culturalSpiritualNeeds], ['How I take my medicines', p.howITakeMyMedication],
  ];

  return (
    <div className="page cv-plan-print" style={{ display: 'grid', gap: 16, maxWidth: 960 }}>
      <div className="no-print" style={{ display: 'flex', gap: 8 }}>
        <Link to={`/residents/${p.residentId}?tab=careplan`} className="cv-btn cv-btn-quiet"><Icon name="arrow-left" size={18} />Back</Link>
        <span style={{ flex: 1 }} />
        <button className="cv-btn cv-btn-primary" onClick={() => window.print()}><Icon name="printer" size={17} />Print</button>
      </div>

      <header style={{ borderBottom: '2px solid var(--text-primary)', paddingBottom: 10 }}>
        <div style={{ fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-muted)' }}>Person-centred care plan · Version {p.version} · {p.status === 'active' ? 'Signed' : p.status === 'draft' ? 'DRAFT — not signed off' : 'CHANGED — awaiting re-signing'}</div>
        <h1 style={{ margin: '4px 0', fontSize: '1.6rem' }}>{p.residentName}{p.preferredName ? ` (“${p.preferredName}”)` : ''}</h1>
        <div style={{ fontSize: '.9rem' }}>
          Room {p.roomNumber || '—'} · Born {p.dateOfBirth ? formatDate(p.dateOfBirth) : '—'} · NHS {p.nhsNumber || '—'} · GP {p.gpName || '—'}{p.gpPractice ? `, ${p.gpPractice}` : ''}
        </div>
        <div style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
          {p.approvedAt ? `Signed off ${formatDate(p.approvedAt)} by ${p.approvedByName || '—'}${p.approvedRole ? ` (${String(p.approvedRole).replace(/_/g, ' ')})` : ''}. ` : ''}
          Next review {p.nextReviewDate ? formatDate(p.nextReviewDate) : '—'}. Printed {formatDateTime(new Date().toISOString())}.
        </div>
      </header>

      {(p.facts || []).length > 0 && (
        <section style={{ border: '2px solid var(--red-600)', borderRadius: 8, padding: '10px 14px' }}>
          <h2 style={{ fontSize: '1rem', margin: '0 0 6px', color: 'var(--red-700)' }}>Know before you help</h2>
          <ul style={{ margin: 0, paddingLeft: 18, columns: 2, columnGap: 24 }}>{p.facts.map((f: any) => <li key={f.text} style={{ fontWeight: f.tone === 'red' ? 700 : 500 }}>{f.text}</li>)}</ul>
        </section>
      )}

      {about.some(([, v]) => v) && (
        <section>
          <h2 style={{ fontSize: '1.1rem' }}>About me</h2>
          <dl className="cv-details" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {about.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd style={{ fontWeight: 400 }}>{v}</dd></div>)}
          </dl>
          <p style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
            Involved in this plan: {p.residentInvolved ? 'the person themselves' : 'not the person'}{p.residentInvolvementNotes ? ` (${p.residentInvolvementNotes})` : ''}
            {p.familyInvolved ? `; family${p.familyInvolvementNotes ? ` (${p.familyInvolvementNotes})` : ''}` : ''}{p.advocateName ? `; advocate ${p.advocateName}` : ''}.
          </p>
        </section>
      )}

      {day.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.1rem' }}>Their day</h2>
          <table className="cv-grab"><thead><tr><th style={{ width: 80 }}>Time</th><th>What</th><th>Area of care</th></tr></thead>
            <tbody>{day.map(x => <tr key={x.id}><td><strong>{x.time}</strong>{x.day_of_week != null ? ` ${DAYS[x.day_of_week]}` : ''}</td><td>{x.what}</td><td>{x.label}</td></tr>)}</tbody></table>
        </section>
      )}

      {sections.filter(s => s.applicable).map(s => {
        const fields = [...(DOMAIN_DETAILS[s.domain] || []), ...((s.customFields || []) as any[]).map(customFieldToDetail)].filter(f => { const v = s.details?.[f.key]; return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length); });
        return (
          <section key={s.id} style={{ borderTop: '1px solid var(--border-dark)', paddingTop: 10 }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 6px' }}>{s.domainLabel}
              <span style={{ fontSize: '.8rem', fontWeight: 500, color: 'var(--text-muted)' }}> · {s.status === 'in_place' ? 'In place' : s.status === 'needs_change' ? 'Needs change' : 'Not started'}{s.riskLevel ? ` · ${s.riskLevel} risk` : ''}</span></h2>
            {(s.assessments || []).length > 0 && <div style={{ fontSize: '.85rem', marginBottom: 6 }}>Assessments: {s.assessments.map((a: any) => `${a.name}${a.legacy ? ` ${a.total_score} (older automatic score)` : a.headline ? ` — ${a.headline}` : ''}, ${formatDate(a.created_at)}`).join('; ')}</div>}
            {fields.length > 0 && <dl className="cv-details">{fields.map(f => <div key={f.key}><dt>{f.label}</dt><dd>{detailValue(f, s.details[f.key])}</dd></div>)}</dl>}
            <dl className="cv-kv" style={{ marginTop: 8 }}>
              {s.assessedNeed && <div><dt>What I need</dt><dd style={{ whiteSpace: 'pre-line' }}>{s.assessedNeed}</dd></div>}
              {s.residentView && <div><dt>In my words</dt><dd>{s.residentView}</dd></div>}
              {s.desiredOutcome && <div><dt>What I want</dt><dd>{s.desiredOutcome}</dd></div>}
              {s.interventions && <div><dt>How to support me</dt><dd style={{ whiteSpace: 'pre-line' }}>{s.interventions}</dd></div>}
              {(s.equipment || s.staffRequired || s.frequency) && <div><dt>Equipment, staff, how often</dt><dd>{[s.equipment, s.staffRequired, s.frequency].filter(Boolean).join(' · ')}</dd></div>}
              {s.measureOfSuccess && <div><dt>How we will know it is working</dt><dd>{s.measureOfSuccess}</dd></div>}
            </dl>
            {(s.evaluations || []).length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div className="cv-eyebrow">Evaluations</div>
                {s.evaluations.map((e: any) => <div key={e.id} className={`cv-eval cv-eval-${e.progress}`}>{formatDate(e.at)} · {PROGRESS[e.progress]}{e.stillRight ? '' : ' · plan needs changing'} · {e.by}: {e.note}</div>)}
              </div>
            )}
          </section>
        );
      })}

      {sections.some(s => !s.applicable) && (
        <section style={{ borderTop: '1px solid var(--border-dark)', paddingTop: 10 }}>
          <h2 style={{ fontSize: '1.1rem' }}>Not applicable</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>{sections.filter(s => !s.applicable).map(s => <li key={s.id}>{s.domainLabel}{s.notApplicableReason ? ` — ${s.notApplicableReason}` : ''}</li>)}</ul>
        </section>
      )}

      <section style={{ borderTop: '1px solid var(--border-dark)', paddingTop: 10 }}>
        <h2 style={{ fontSize: '1.1rem' }}>Current assessments</h2>
        <table className="cv-grab"><thead><tr><th>Assessment</th><th>Result</th><th>Done</th><th>By</th><th>Review by</th></tr></thead>
          <tbody>{[...TOOL_ORDER, ...((p.customTools || []) as any[]).map(c => c.key)].map((k: string) => {
            const a = current[k];
            const t = toolFor(k, p.customTools || []);
            if (!t || (t.whenNeeded && !a)) return null;
            return <tr key={k}><td>{t.shortName}{k.startsWith('custom:') ? ' (home\'s own)' : ''}</td><td>{!a ? 'Not done' : a.legacy ? `Older automatic score ${a.score}` : a.result?.headline}</td>
              <td>{a ? formatDate(a.completedAt || a.createdAt) : ''}</td><td>{a?.assessorName || ''}</td><td>{a?.nextReviewDate ? formatDate(a.nextReviewDate) : ''}</td></tr>;
          })}</tbody></table>
      </section>

      <section style={{ borderTop: '1px solid var(--border-dark)', paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, fontSize: '.9rem' }}>
        <div>Resident / representative: ________________________<br /><br />Date: ____________</div>
        <div>Nurse / senior: ________________________<br /><br />Date: ____________</div>
      </section>
    </div>
  );
}
