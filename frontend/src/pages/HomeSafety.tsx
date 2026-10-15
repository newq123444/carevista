// ────────────────────────────────────────────────────────────────────────────
// Home safety — the building's checks (v89).
//
// Eleven checks with their due dates: fire risk assessment, fire checks,
// evacuation readiness (worked out from residents' PEEPs), windows, hot water,
// legionella, COSHH, hoists and lifts, night working, oxygen, electrical and
// gas. Each failing answer says how serious it is and what to do.
// ────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/Icon';
import { Badge, Empty, PageHead, Stat } from '../components/ds';
import { useHomeSafety, useHomeCheckHistory, useCreateHomeCheck } from '../hooks';
import { useAuthStore } from '../store/auth.store';
import { HOME_TOOLS, evaluateHome, type HomeToolKey, type HomeResult } from '../shared/homeSafetyTools';
import type { Answers, Answer } from '../shared/assessmentCore';
import { QuestionView } from '../components/AssessmentRunner';
import { formatDate } from '../utils/formatters';

const ICON: Record<HomeToolKey, IconName> = {
  fire_risk_assessment: 'file-text', fire_safety_checks: 'bell', evacuation: 'siren', window_restrictors: 'house',
  hot_water: 'thermometer', legionella: 'droplets', coshh: 'flask-conical', lifting_equipment: 'users',
  night_working: 'moon', oxygen_storage: 'activity', electrical_gas: 'settings',
};
const CLINICAL = ['registered_nurse', 'senior_carer', 'home_manager', 'deputy_manager', 'super_admin', 'group_admin', 'admin'];
const SEV_TONE = { critical: 'red', major: 'amber', minor: 'grey' } as const;

export default function HomeSafety() {
  const { user } = useAuthStore();
  const canEdit = CLINICAL.includes((user as any)?.role);
  const { data, isLoading } = useHomeSafety();
  const [running, setRunning] = useState<HomeToolKey | null>(null);
  const [history, setHistory] = useState<HomeToolKey | null>(null);
  const checks: any[] = data?.checks || [];
  const counts = data?.counts || { never: 0, overdue: 0, critical: 0 };
  const ctx = data?.context || {};

  return (
    <div className="page" style={{ display: 'grid', gap: 16 }}>
      <PageHead title="Home safety" sub="The building's checks, with what is due and what needs putting right. They support, and never replace, the assessments by competent people the law requires."
        actions={<Link to="/assessments/fire-grab-sheet" className="cv-btn cv-btn-secondary"><Icon name="siren" size={17} />Fire grab sheet</Link>} />
      <div className="cv-stats">
        <Stat label="Critical findings" value={counts.critical} icon="triangle-alert" tone={counts.critical ? 'red' : 'green'} note="act today" />
        <Stat label="Overdue" value={counts.overdue} icon="clock" tone={counts.overdue ? 'red' : 'green'} />
        <Stat label="Never done" value={counts.never} icon="clipboard-list" tone={counts.never ? 'amber' : 'green'} />
        <Stat label="PEEPs" value={`${ctx.peepRed ?? 0} red · ${ctx.peepAmber ?? 0} amber`} icon="siren" tone={ctx.noPeep ? 'amber' : undefined} note={ctx.noPeep ? `${ctx.noPeep} residents with no PEEP` : 'every resident has one'} />
      </div>
      {isLoading ? <div className="cv-card cv-card-pad">Loading…</div> : (
        <div className="cv-plan-grid">
          {checks.map(c => {
            const tool = HOME_TOOLS[c.type as HomeToolKey];
            const cur = c.current;
            return (
              <div key={c.type} className="cv-card cv-card-pad cv-need">
                <div className="cv-need-head">
                  <span className="cv-need-icon"><Icon name={ICON[c.type as HomeToolKey]} size={20} /></span>
                  <h3>{tool.shortName}</h3>
                  {cur && <Badge tone={cur.level === 'high' ? 'red' : cur.level === 'medium' ? 'amber' : 'green'}>{cur.level === 'high' ? 'Critical' : cur.level === 'medium' ? 'Action needed' : 'OK'}</Badge>}
                </div>
                {!cur ? <p className="cv-q-hint" style={{ margin: 0 }}>Not done yet. {tool.purpose}</p> : (
                  <div style={{ display: 'grid', gap: 4 }}>
                    <div style={{ fontWeight: 650 }}>{cur.headline}</div>
                    <div className="cv-q-hint">{formatDate(cur.completedAt)} · {cur.assessorName}</div>
                    <div style={{ fontSize: '.86rem', fontWeight: c.state === 'overdue' ? 700 : 500, color: c.state === 'overdue' ? 'var(--red-700)' : 'var(--text-secondary)' }}>
                      {c.state === 'overdue' ? 'Overdue since' : 'Next due'} {formatDate(cur.nextDue)}</div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {cur && <button className="cv-btn cv-btn-secondary" style={{ minHeight: 38, padding: '6px 12px', fontSize: '.86rem' }} onClick={() => setHistory(c.type)}><Icon name="history" size={16} />History</button>}
                  {canEdit && <button className={`cv-btn ${!cur || c.state === 'overdue' ? 'cv-btn-primary' : 'cv-btn-secondary'}`} style={{ minHeight: 38, padding: '6px 12px', fontSize: '.86rem' }} onClick={() => setRunning(c.type)}>
                    <Icon name={cur ? 'rotate-cw' : 'plus'} size={16} />{cur ? 'Check again' : 'Start'}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {running && <HomeCheckRunner type={running} ctx={ctx} onClose={() => setRunning(null)} />}
      {history && <HistorySheet type={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function FailureList({ result }: { result: HomeResult }) {
  if (!result.failures.length) return <div className="cv-note cv-note-green"><Icon name="check" size={16} /><span>No problems found.</span></div>;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {result.failures.map((f, i) => (
        <div key={i} className={`cv-note cv-note-${f.severity === 'critical' ? 'red' : f.severity === 'major' ? 'amber' : 'blue'}`}>
          <Icon name="triangle-alert" size={16} />
          <div><Badge tone={SEV_TONE[f.severity]}>{f.severity}</Badge> <strong>{f.question}</strong><div>{f.action}</div></div>
        </div>
      ))}
    </div>
  );
}

function HomeCheckRunner({ type, ctx, onClose }: { type: HomeToolKey; ctx: any; onClose: () => void }) {
  const tool = HOME_TOOLS[type];
  const save = useCreateHomeCheck();
  const [answers, setAnswers] = useState<Answers>({});
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState<any>(null);
  const result = useMemo(() => evaluateHome(type, answers, ctx), [type, answers, ctx]);
  const set = (k: string, v: Answer) => setAnswers(a => { const n = { ...a }; if (v === null || v === undefined || v === '') delete n[k]; else n[k] = v; return n; });

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && (saved || window.confirm('Close without saving?'))) onClose(); }}>
      <div className="modal cv-runner" style={{ maxHeight: '94dvh' }}>
        <div className="modal-header">
          <div><h2 className="modal-title">{tool.name}</h2><div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{tool.purpose}</div></div>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="cv-runner-main">
            {saved ? (
              <div style={{ display: 'grid', gap: 12, paddingTop: 10 }}>
                <div className="cv-note cv-note-green"><Icon name="shield-check" size={16} /><span>Saved and sealed on the record. Next due {formatDate(saved.nextDue)}.</span></div>
                <FailureList result={saved.result} />
              </div>
            ) : (
              <>
                <div className="cv-note cv-note-blue" style={{ marginTop: 10 }}><Icon name="info" size={16} /><span><strong>Who and how often:</strong> {tool.who}</span></div>
                {tool.sections.map(s => (
                  <div key={s.key}>
                    <h3 className="cv-section-title" style={{ marginTop: 14 }}>{s.title}</h3>
                    {s.questions.map(q => <QuestionView key={q.key} q={q} value={answers[q.key]} scored={false} fromRecord={false} missing={result.missing.includes(q.key)} onChange={v => set(q.key, v)} />)}
                  </div>
                ))}
                <label className="form-label" style={{ display: 'block', marginTop: 12 }}>Area checked (optional)
                  <input className="form-input" style={{ width: '100%', marginTop: 4 }} value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Whole building, or First floor" /></label>
                <label className="form-label" style={{ display: 'block', marginTop: 12 }}>Notes (optional)
                  <textarea className="form-input" rows={2} style={{ width: '100%', marginTop: 4 }} value={notes} onChange={e => setNotes(e.target.value)} /></label>
                <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: 10 }}>
                  Sources: {tool.sources.map((s, i) => <React.Fragment key={s.url}>{i > 0 && ' · '}<a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></React.Fragment>)}.
                </div>
              </>
            )}
          </div>
          <aside className="cv-runner-side" aria-live="polite">
            <div className="cv-card cv-card-pad" style={{ display: 'grid', gap: 6 }}>
              <div className="cv-eyebrow">{result.complete ? 'Result' : 'So far'}</div>
              <div style={{ fontWeight: 700, color: result.level === 'high' ? 'var(--red-700)' : result.level === 'medium' ? 'var(--amber-700)' : 'var(--green-700)' }}>{result.headline}</div>
              {!result.complete && <div className="cv-q-hint">{result.missing.length} still to answer</div>}
            </div>
            {result.notes.map(n => <div key={n} className="cv-note cv-note-blue"><Icon name="info" size={16} /><span>{n}</span></div>)}
            {!saved && <div className="cv-runner-extra"><FailureList result={result} /></div>}
          </aside>
        </div>
        <div className="modal-footer">
          {saved ? <button className="cv-btn cv-btn-primary" onClick={onClose}>Done</button> : (
            <>
              <button className="cv-btn cv-btn-secondary" onClick={onClose}>Cancel</button>
              <button className="cv-btn cv-btn-primary" disabled={!result.complete || save.isPending}
                onClick={() => save.mutate({ type, answers, area: area.trim() || undefined, notes: notes.trim() || undefined }, { onSuccess: setSaved })}>
                <Icon name="check" size={16} />{save.isPending ? 'Saving…' : 'Save check'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HistorySheet({ type, onClose }: { type: HomeToolKey; onClose: () => void }) {
  const { data } = useHomeCheckHistory(type);
  const [open, setOpen] = useState<string | null>(null);
  const rows: any[] = data || [];
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg" style={{ maxHeight: '94dvh' }}>
        <div className="modal-header"><h2 className="modal-title">{HOME_TOOLS[type].name} — history</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button></div>
        <div className="modal-body" style={{ padding: 20, display: 'grid', gap: 10, overflowY: 'auto' }}>
          {rows.length === 0 ? <Empty icon="history" title="No checks yet" /> : rows.map(r => (
            <div key={r.id} className="cv-card cv-card-pad" style={{ display: 'grid', gap: 6 }}>
              <button className="cv-btn cv-btn-quiet" style={{ justifyContent: 'space-between', width: '100%' }} onClick={() => setOpen(open === r.id ? null : r.id)}>
                <span>{formatDate(r.completedAt)} · {r.assessorName}{r.area ? ` · ${r.area}` : ''}</span>
                <span><Badge tone={r.level === 'high' ? 'red' : r.level === 'medium' ? 'amber' : 'green'}>{r.result?.headline}</Badge> {r.status === 'superseded' && <Badge tone="grey">Replaced</Badge>}</span>
              </button>
              {open === r.id && <><FailureList result={r.result} />{r.notes && <p style={{ margin: 0 }}>{r.notes}</p>}<div className="cv-q-hint">Tool version {r.toolVersion}</div></>}
            </div>
          ))}
        </div>
        <div className="modal-footer"><button className="cv-btn cv-btn-secondary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
