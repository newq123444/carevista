// ────────────────────────────────────────────────────────────────────────────
// Assessments — the home-wide register (v88).
//
// Every resident against every tool: what each found, and what is overdue,
// due this week, never done, or still an older automatic score that a person
// needs to redo. Tap a cell to open it, or to start it.
// ────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Avatar, Empty, PageHead, SearchBox, Stat } from '../components/ds';
import { useAssessmentRegister, useAssessment } from '../hooks';
import { useAuthStore } from '../store/auth.store';
import { TOOLS, LEVEL_LABEL, type ToolKey } from '../shared/assessmentTools';
import { AssessmentRunner, AssessmentView, levelTone, toolFor } from '../components/AssessmentRunner';
import { formatDate } from '../utils/formatters';

type Filter = 'all' | 'overdue' | 'missing' | 'high' | 'legacy';
const CLINICAL = ['registered_nurse', 'senior_carer', 'home_manager', 'deputy_manager', 'super_admin', 'group_admin', 'admin'];

export default function RiskAssessments() {
  const { user } = useAuthStore();
  const canEdit = CLINICAL.includes((user as any)?.role);
  const { data, isLoading } = useAssessmentRegister();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [run, setRun] = useState<{ residentId: string; name: string; type: string; previous?: any } | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const allTools: string[] = data?.tools || [];
  // Built-in and the home's own (v90).
  const T = (k: string) => toolFor(k, data?.custom || [])!;
  const whenNeeded: string[] = data?.whenNeeded || [];
  // Tools everyone needs by default; the "when needed" ones on request.
  const tools: string[] = showAll ? allTools : allTools.filter(k => !whenNeeded.includes(k));
  const counts = data?.counts || { overdue: 0, dueSoon: 0, missing: 0, legacy: 0, high: 0 };

  const rows = useMemo(() => {
    const list: any[] = data?.residents || [];
    const q = search.trim().toLowerCase();
    return list.filter(r => {
      if (q && !`${r.name} ${r.preferredName || ''} ${r.room}`.toLowerCase().includes(q)) return false;
      const as = Object.values(r.assessments) as any[];
      if (filter === 'overdue') return as.some(a => a.state === 'overdue');
      if (filter === 'missing') return tools.some(k => !whenNeeded.includes(k) && !r.assessments[k]);
      if (filter === 'high') return as.some(a => ['high', 'very_high', 'severe'].includes(a.level) || a.peepCategory === 'red');
      if (filter === 'legacy') return as.some(a => a.state === 'legacy');
      return true;
    });
  }, [data, filter, search, tools]);

  return (
    <div className="page" style={{ display: 'grid', gap: 16 }}>
      <PageHead title="Assessments" sub="Nine tools, answered by a person, reviewed on time. Tap a cell to open it."
        actions={<>
          <Link to="/assessments/fire-grab-sheet" className="cv-btn cv-btn-secondary"><Icon name="siren" size={17} />Fire grab sheet</Link>
          <button className="cv-btn cv-btn-secondary" onClick={() => window.print()}><Icon name="printer" size={17} />Print</button>
        </>} />

      <div className="cv-stats">
        <Stat label="Overdue" value={counts.overdue} icon="clock" tone={counts.overdue ? 'red' : 'green'} note="past their review date" />
        <Stat label="Due this week" value={counts.dueSoon} icon="calendar-days" tone={counts.dueSoon ? 'amber' : undefined} />
        <Stat label="Never done" value={counts.missing} icon="clipboard-list" tone={counts.missing ? 'amber' : 'green'} note="of the assessments everyone needs" />
        <Stat label="Older automatic scores" value={counts.legacy} icon="triangle-alert" tone={counts.legacy ? 'amber' : 'green'} note="made before v88 — redo by hand" />
      </div>

      <div className="cv-card cv-card-pad" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="cv-seg" role="tablist">
            {([['all', 'Everyone'], ['overdue', 'Overdue'], ['missing', 'Not done'], ['high', 'High risk'], ['legacy', 'Older scores']] as [Filter, string][]).map(([k, l]) => (
              <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}><SearchBox value={search} onChange={setSearch} placeholder="Find a resident by name or room" /></div>
          <button className={`cv-btn ${showAll ? 'cv-btn-primary' : 'cv-btn-secondary'}`} style={{ minHeight: 38 }} onClick={() => setShowAll(v => !v)}>
            <Icon name="list-checks" size={16} />{showAll ? 'All 21 assessments' : `+ ${whenNeeded.length} "when needed"`}
          </button>
        </div>
        {isLoading ? <div>Loading…</div> : rows.length === 0 ? <Empty icon="clipboard-check" title="Nobody here">Try another filter.</Empty> : (
          <div className="table-container" style={{ maxHeight: '70vh' }}>
            <table className="cv-matrix">
              <thead><tr><th>Resident</th>{tools.map(k => <th key={k} title={T(k)?.whenNeeded || 'For everyone'}>{T(k)?.shortName}{k.startsWith('custom:') ? ' *' : ''}</th>)}
                <th title="Latest NEWS2">NEWS2</th><th title="Open wounds">Wounds</th><th title="Completed capacity assessments">MCA</th><th title="DoLS status">DoLS</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.residentId}>
                    <td>
                      <Link to={`/residents/${r.residentId}?tab=Assessments`} style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'inherit', textDecoration: 'none' }}>
                        <Avatar name={r.name} photo={r.photoUrl} size={34} />
                        <span><span style={{ fontWeight: 650 }}>{r.preferredName || r.name.split(' ')[0]} {r.name.split(' ').slice(1).join(' ')}</span>
                          <span style={{ display: 'block', fontSize: '.78rem', color: 'var(--text-muted)' }}>Room {r.room}</span></span>
                      </Link>
                    </td>
                    {tools.map(k => {
                      const a = r.assessments[k];
                      if (!a) return (
                        <td key={k}>{canEdit
                          ? <button className="cv-cell cv-cell-missing" onClick={() => setRun({ residentId: r.residentId, name: r.name, type: k })} aria-label={`Start ${T(k)?.shortName} for ${r.name}`}>{whenNeeded.includes(k) ? '+' : 'Start'}</button>
                          : <span className="cv-cell cv-cell-missing">—</span>}</td>
                      );
                      if (a.state === 'legacy') return <td key={k}><button className="cv-cell cv-cell-legacy" onClick={() => setView(a.id)} title="Older automatic score — redo by hand">{a.score}<small>redo</small></button></td>;
                      const tone = a.peepCategory ? (a.peepCategory === 'red' ? 'red' : a.peepCategory === 'amber' ? 'amber' : 'green') : levelTone(a.level);
                      const main = a.peepCategory ? a.peepCategory.toUpperCase()
                        : a.level === 'not_scored' ? (k === 'falls' ? `${a.score} to act on` : 'Done')
                        : T(k)?.scored ? `${a.score}` : LEVEL_LABEL[a.level as keyof typeof LEVEL_LABEL];
                      return (
                        <td key={k}>
                          <button className={`cv-cell cv-cell-${tone === 'grey' ? 'blue' : tone}${a.state === 'overdue' ? ' cv-cell-overdue' : ''}`} onClick={() => setView(a.id)}
                            title={`${a.headline || ''} · review by ${a.nextReviewDate ? formatDate(a.nextReviewDate) : '—'}`}>
                            {main}<small>{a.state === 'overdue' ? 'overdue' : a.state === 'due_soon' ? 'due soon' : a.nextReviewDate ? formatDate(a.nextReviewDate).replace(/\s\d{4}$/, '') : ''}</small>
                          </button>
                        </td>
                      );
                    })}
                    <LinkedCells linked={r.linked || {}} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="cv-q-hint" style={{ margin: 0 }}>
          Falls has no score, by design: NICE NG249 (2025) advises against falls risk prediction tools. The number is how many factors have actions.
          Bed rails, PEEP and the support plans are decisions, not scores. Columns marked * are the home's own assessments, not validated scales. A red border means the review is overdue. "When needed" assessments
          (catheter, seizures, wheelchair, self-medication and others) are only for the people they apply to. NEWS2, wounds, MCA and DoLS are kept on their own screens — tap to open.
        </p>
      </div>

      {run && T(run.type) && <AssessmentRunner residentId={run.residentId} residentName={run.name} type={run.type} tool={T(run.type)} previous={run.previous} onClose={() => setRun(null)} />}
      {view && <RegisterView id={view} canEdit={canEdit} onClose={() => setView(null)}
        onReassess={(a: any) => { setView(null); setRun({ residentId: a.residentId, name: a.residentName, type: a.type, previous: a.legacy ? undefined : a }); }} />}
    </div>
  );
}

function LinkedCells({ linked }: { linked: any }) {
  const n = linked.news2, dols = linked.dols;
  const newsTone = !n ? '' : n.score >= 7 ? 'red' : n.score >= 5 ? 'amber' : 'green';
  return (
    <>
      <td>{n ? <Link className={`cv-cell cv-cell-${newsTone}`} to="/news2">{n.score}<small>{formatDate(n.at).replace(/\s\d{4}$/, '')}</small></Link> : <span className="cv-cell cv-cell-missing">—</span>}</td>
      <td>{linked.wounds ? <Link className="cv-cell cv-cell-amber" to="/wounds">{linked.wounds}<small>open</small></Link> : <span className="cv-cell cv-cell-missing">—</span>}</td>
      <td>{linked.mca ? <Link className="cv-cell cv-cell-blue" to="/mca">{linked.mca.count}<small>{linked.mca.nextReview ? `review ${formatDate(linked.mca.nextReview).replace(/\s\d{4}$/, '')}` : 'done'}</small></Link> : <span className="cv-cell cv-cell-missing">—</span>}</td>
      <td>{dols ? <Link className={`cv-cell cv-cell-${dols.status === 'granted' ? 'green' : ['expired', 'refused'].includes(dols.status) ? 'red' : 'amber'}`} to="/dols">{String(dols.status).replace(/_/g, ' ')}<small>{dols.grantedUntil ? `to ${formatDate(dols.grantedUntil).replace(/\s\d{4}$/, '')}` : ''}</small></Link> : <span className="cv-cell cv-cell-missing">—</span>}</td>
    </>
  );
}

function RegisterView({ id, canEdit, onClose, onReassess }: { id: string; canEdit: boolean; onClose: () => void; onReassess: (a: any) => void }) {
  const { data } = useAssessment(id);
  if (!data) return null;
  return <AssessmentView a={data} canEdit={canEdit} onClose={onClose} onReassess={() => onReassess(data)} />;
}
