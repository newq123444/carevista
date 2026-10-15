// ────────────────────────────────────────────────────────────────────────────
// One resident's assessments: the nine tools, what each found, when each is
// due, and the full history (older automatic scores clearly marked).
// ────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import { Badge, Empty } from './ds';
import { useResidentAssessments, useAssessment } from '../hooks';
import { useAuthStore } from '../store/auth.store';
import { TOOLS, TOOL_ORDER, LEVEL_LABEL, type ToolKey } from '../shared/assessmentTools';
import { AssessmentRunner, AssessmentView, levelTone, REASON_LABEL, toolFor } from './AssessmentRunner';
import { formatDate } from '../utils/formatters';

export const TOOL_ICON: Record<string, IconName> = {
  waterlow: 'bandage', must: 'scale', falls: 'footprints', moving_handling: 'users', bed_rails: 'bed',
  eating_drinking: 'utensils', oral_health: 'smile', peep: 'siren', abbey_pain: 'heart-pulse',
  delirium_4at: 'brain', mood_gds15: 'sun', behaviour_support: 'hand', leaving_building: 'house', hydration: 'glass-water',
  self_medication: 'pill', personal_fire: 'triangle-alert', wheelchair_belt: 'shield-check', bowel: 'clipboard-list',
  seizure: 'activity', catheter: 'droplets', emotional_safety: 'hand-heart',
};
const CLINICAL = ['registered_nurse', 'senior_carer', 'home_manager', 'deputy_manager', 'super_admin', 'group_admin', 'admin'];

export function ResidentAssessments({ residentId, residentName, startWith }: { residentId: string; residentName: string; startWith?: string | null }) {
  const { user } = useAuthStore();
  const role = (user as any)?.role;
  const canEdit = CLINICAL.includes(role);
  const { data, isLoading } = useResidentAssessments(residentId);
  const [running, setRunning] = useState<string | null>(startWith && canEdit ? startWith : null);
  const [viewing, setViewing] = useState<string | null>(null);
  const current: Record<string, any> = data?.current || {};
  const history: any[] = data?.history || [];
  const today = new Date().toISOString().slice(0, 10);

  if (isLoading) return <div className="cv-card cv-card-pad">Loading…</div>;
  // Built-in first, then the home's own (v90).
  const custom: any[] = data?.custom || [];
  const ALL: string[] = [...TOOL_ORDER, ...custom.map(c => c.key)];
  const T = (k: string) => toolFor(k, custom)!;
  const dueCount = ALL.filter(k => {
    const a = current[k];
    return a && !a.legacy && a.nextReviewDate && String(a.nextReviewDate).slice(0, 10) < today;
  }).length;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {dueCount > 0 && <div className="cv-note cv-note-red"><Icon name="clock" size={16} /><span>{dueCount} assessment{dueCount === 1 ? ' is' : 's are'} overdue for review.</span></div>}
      {data?.linked && <LinkedRecords linked={data.linked} />}
      {(['everyone', 'when'] as const).map(group => (
      <React.Fragment key={group}>
      <h2 className="cv-section-title" style={{ margin: '6px 0 0' }}>{group === 'everyone' ? 'For everyone' : 'When needed'}</h2>
      {group === 'when' && <p className="cv-q-hint" style={{ margin: 0 }}>Only for the people they apply to — each card says when.</p>}
      <div className="cv-plan-grid">
        {ALL.filter(k => T(k) && (group === 'everyone') === !T(k).whenNeeded).filter(k => group === 'everyone' || canEdit || current[k]).map(k => {
          const tool = T(k);
          const a = current[k];
          const due = a?.nextReviewDate ? String(a.nextReviewDate).slice(0, 10) : null;
          const overdue = !!(a && !a.legacy && due && due < today);
          return (
            <div key={k} className="cv-card cv-card-pad cv-need">
              <div className="cv-need-head">
                <span className="cv-need-icon"><Icon name={TOOL_ICON[k] || 'clipboard-check'} size={20} /></span>
                <h3>{tool.shortName}</h3>
                {k.startsWith('custom:') && <Badge tone="grey">Home's own</Badge>}
                {a && !a.legacy && a.level !== 'not_scored' && <Badge tone={levelTone(a.level) === 'blue' ? 'grey' : levelTone(a.level)}>{LEVEL_LABEL[a.level as keyof typeof LEVEL_LABEL] || a.level}</Badge>}
              </div>
              {!a ? (
                <p className="cv-q-hint" style={{ margin: 0 }}>{tool.whenNeeded ? `${tool.whenNeeded} ` : 'Not done yet. '}{tool.purpose}</p>
              ) : a.legacy ? (
                <div className="cv-note cv-note-amber" style={{ padding: '8px 10px' }}><Icon name="triangle-alert" size={15} />
                  <span>Older automatic score ({a.score}) from {formatDate(a.createdAt)}. Not answered by a person — please reassess.</span></div>
              ) : (
                <div style={{ display: 'grid', gap: 4 }}>
                  <div style={{ fontWeight: 650 }}>{a.result?.headline || `${a.score}`}</div>
                  <div className="cv-q-hint">{formatDate(a.completedAt || a.createdAt)} · {a.assessorName}{a.reason ? ` · ${REASON_LABEL[a.reason] || a.reason}` : ''}</div>
                  {due && <div style={{ fontSize: '.86rem', fontWeight: overdue ? 700 : 500, color: overdue ? 'var(--red-700)' : 'var(--text-secondary)' }}>
                    {overdue ? 'Review overdue since' : 'Review by'} {formatDate(due)}</div>}
                  {!a.appliedToPlanAt && canEdit && <div className="cv-q-hint" style={{ color: 'var(--amber-700)' }}>Not yet added to the care plan</div>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {a && <button className="cv-btn cv-btn-secondary" style={{ minHeight: 38, padding: '6px 12px', fontSize: '.86rem' }} onClick={() => setViewing(a.id)}><Icon name="file-text" size={16} />View</button>}
                {canEdit && <button className={`cv-btn ${!a || a.legacy || overdue ? 'cv-btn-primary' : 'cv-btn-secondary'}`} style={{ minHeight: 38, padding: '6px 12px', fontSize: '.86rem' }} onClick={() => setRunning(k)}>
                  <Icon name={a ? 'rotate-cw' : 'plus'} size={16} />{a ? 'Reassess' : 'Start'}</button>}
              </div>
            </div>
          );
        })}
      </div>
      </React.Fragment>
      ))}

      <div className="cv-card cv-card-pad">
        <h2 className="cv-section-title"><Icon name="history" size={18} />History</h2>
        {history.length === 0 ? <Empty icon="clipboard-list" title="No assessments yet" /> : (
          <div className="table-container">
            <table>
              <thead><tr><th>Date</th><th>Assessment</th><th>Result</th><th>By</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id}>
                    <td>{formatDate(h.completedAt || h.createdAt)}</td>
                    <td>{toolFor(h.type, custom)?.shortName || (h.custom ? 'Home assessment (retired)' : h.type)}</td>
                    <td>{h.legacy ? <span style={{ color: 'var(--amber-700)' }}>Automatic score {h.score} (pre-v88)</span> : h.result?.headline}</td>
                    <td>{h.assessorName || '—'}</td>
                    <td>{h.status === 'current' ? <Badge tone="green">Current</Badge> : <Badge tone="grey">Replaced</Badge>}</td>
                    <td><button className="cv-btn cv-btn-quiet" style={{ minHeight: 32, padding: '4px 8px' }} onClick={() => setViewing(h.id)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {running && T(running) && <AssessmentRunner residentId={residentId} residentName={residentName} type={running} tool={T(running)}
        previous={current[running] && !current[running].legacy ? current[running] : undefined} onClose={() => setRunning(null)} />}
      {viewing && <ViewById id={viewing} canEdit={canEdit} onClose={() => setViewing(null)}
        onReassess={t => { setViewing(null); setRunning(t); }} />}
    </div>
  );
}

function LinkedRecords({ linked }: { linked: any }) {
  const items: { to: string; icon: IconName; label: string; value: string }[] = [
    { to: '/news2', icon: 'heart-pulse', label: 'NEWS2', value: linked.news2 ? `${linked.news2.score} · ${formatDate(linked.news2.at)}` : 'None recorded' },
    { to: '/wounds', icon: 'bandage', label: 'Wounds', value: linked.wounds ? `${linked.wounds} open` : 'None open' },
    { to: '/continence', icon: 'droplets', label: 'Continence assessment', value: linked.continence ? formatDate(linked.continence.at) : 'Not done' },
    { to: '/mca', icon: 'brain', label: 'Mental capacity', value: linked.mca ? `${linked.mca.count} completed` : 'None' },
    { to: '/dols', icon: 'lock', label: 'DoLS', value: linked.dols ? String(linked.dols.status).replace(/_/g, ' ') + (linked.dols.grantedUntil ? ` to ${formatDate(linked.dols.grantedUntil)}` : '') : 'None recorded' },
  ];
  return (
    <div className="cv-card cv-card-pad">
      <h2 className="cv-section-title"><Icon name="clipboard-list" size={18} />Also on record</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
        {items.map(i => (
          <Link key={i.label} to={i.to} className="cv-opt" style={{ textDecoration: 'none' }}>
            <Icon name={i.icon} size={18} /><span><span style={{ display: 'block', fontWeight: 650 }}>{i.label}</span><span className="cv-q-hint">{i.value}</span></span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ViewById({ id, canEdit, onClose, onReassess }: { id: string; canEdit: boolean; onClose: () => void; onReassess: (t: string) => void }) {
  const { data } = useAssessment(id);
  if (!data) return null;
  return <AssessmentView a={data} canEdit={canEdit} onClose={onClose} onReassess={() => onReassess(data.type)} />;
}
