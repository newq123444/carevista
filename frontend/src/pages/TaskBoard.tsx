// src/pages/TaskBoard.tsx — Real-time care task board for all roles
import React, { useState, useEffect, useCallback } from 'react';
import { useLang } from '../i18n';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useTasks, useCompleteTask, useDeferTask, useStartTask, useReleaseTask, useGenerateTasks, useResidents } from '../hooks';
import { useTaskSSE } from '../hooks/useSSE';
import { ConflictDialog, asConflict, type Conflict } from '../components/ConflictDialog';
import { todayISO } from '../utils/formatters';
import type { Resident } from '../types';

// ── Photo helper ──────────────────────────────────────────────────────────
const BACKEND = (import.meta as any).env?.VITE_API_URL?.replace('/api','') || 'http://localhost:3001';
function residentPhoto(url?: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : BACKEND + url;
}

// ── Status config ─────────────────────────────────────────────────────────
const STATUS = {
  upcoming:    { bg: '#f8fafc', border: '#e2e8f0', text: '#64748b', dot: '#94a3b8', label: 'Upcoming'    },
  due:         { bg: '#eff6ff', border: '#93c5fd', text: '#0d9488', dot: '#3b82f6', label: 'Due Now'     },
  in_progress: { bg: '#faf5ff', border: '#c4b5fd', text: '#7c3aed', dot: '#8b5cf6', label: 'In Progress' },
  overdue:     { bg: '#fffbeb', border: '#fcd34d', text: '#d97706', dot: '#f59e0b', label: 'Overdue'     },
  missed:      { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', dot: '#ef4444', label: 'Missed'      },
  done:        { bg: '#f0fdf4', border: '#86efac', text: '#15803d', dot: '#22c55e', label: 'Done'        },
  deferred:    { bg: '#f8fafc', border: '#cbd5e1', text: '#64748b', dot: '#94a3b8', label: 'Deferred'    },
  na:          { bg: '#f8fafc', border: '#e2e8f0', text: '#9ca3af', dot: '#d1d5db', label: 'N/A'         },
};

const CATEGORY_COLOR: Record<string, string> = {
  personal_care: '#3b82f6', nutrition: '#10b981', medication: '#dc2626',
  repositioning: '#f59e0b', observation: '#06b6d4', social: '#ec4899',
};

// ── Task chip ─────────────────────────────────────────────────────────────
function TaskChip({ task, userRole, userId, onOpen }: {
  task: any; userRole: string; userId: string; onOpen: (task: any) => void;
}) {
  const { t: tr } = useLang();
  const st = STATUS[task.status as keyof typeof STATUS] || STATUS.upcoming;
  const isMyTask = task.in_progress_by === userId;
  const isSomeoneElse = task.in_progress_by && task.in_progress_by !== userId;
  const isDone = task.status === 'done' || task.status === 'deferred' || task.status === 'na';
  // A medication round is a view onto the MAR chart, not something to tick here.
  const isEmar = task.handled_in === 'emar';
  const initials = task.completed_by_name && !isEmar
    ? task.completed_by_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2) : '';

  return (
    <button
      onClick={() => (isEmar || !isDone) && onOpen(task)}
      disabled={isDone && !isEmar}
      title={isEmar
        ? `${task.task_name} — signed on the MAR chart${task.med_scheduled ? ` (${task.med_given || 0} of ${task.med_scheduled} given)` : ' — nothing due at this time'}`
        : `${task.task_name} — ${task.due_time?.slice(0,5)} ${isSomeoneElse ? `(${task.in_progress_name} is filling this)` : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '5px 9px', borderRadius: 24,
        border: `2px solid ${isSomeoneElse ? '#c4b5fd' : st.border}`,
        background: isSomeoneElse ? '#faf5ff' : st.bg,
        color: isSomeoneElse ? '#7c3aed' : st.text,
        cursor: isDone ? 'default' : 'pointer',
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
        transition: 'all 150ms',
        boxShadow: task.status === 'missed' ? '0 0 0 2px #fca5a580' :
                   task.status === 'due' ? '0 0 0 2px #93c5fd60' : 'none',
        position: 'relative',
        opacity: task.status === 'upcoming' ? 0.65 : 1,
        minWidth: 80, minHeight: 32,
      }}
    >
      <span style={{ fontSize: 13 }}>{task.icon}</span>
      <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {task.task_name.split(' ')[0]}
      </span>
      {/* Presence dot */}
      {isSomeoneElse && (
        <span style={{
          position: 'absolute', top: -4, right: -4,
          width: 12, height: 12, borderRadius: '50%',
          background: '#8b5cf6', border: '2px solid white',
          fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900,
        }} title={`${task.in_progress_name} is filling this`}>!</span>
      )}
      {/* Medication rounds show MAR progress, never a carer's initials */}
      {isEmar && task.med_scheduled > 0 && (
        <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>
          {task.med_given || 0}/{task.med_scheduled} MAR
        </span>
      )}
      {/* Done initials */}
      {isDone && initials && (
        <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.8 }}>{initials}</span>
      )}
      {/* Missed pulse */}
      {task.status === 'missed' && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#dc2626', animation: 'pulse 1.5s infinite' }} />
      )}
    </button>
  );
}

// ── Complete / Defer modal ─────────────────────────────────────────────────
function TaskModal({ task, onClose }: { task: any; onClose: () => void }) {
  const { t: tr } = useLang();
  const { user } = useAuthStore();
  const complete  = useCompleteTask();
  const defer     = useDeferTask();
  const release   = useReleaseTask();
  const [mode, setMode]     = useState<'complete' | 'defer'>('complete');
  const [notes, setNotes]   = useState('');
  const [reason, setReason] = useState('');
  const [conflict, setConflict] = useState<Conflict | null>(null);

  const st = STATUS[task.status as keyof typeof STATUS] || STATUS.due;
  const isSomeoneElse = task.in_progress_by && task.in_progress_by !== user?.id;

  const handleClose = () => {
    release.mutate(task.id);
    onClose();
  };

  // The server refuses to complete a task that is already done. That happens
  // when a colleague finished it while this dialog was open — tell the carer
  // who and when instead of silently writing a second completion.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'complete') {
        await complete.mutateAsync({ id: task.id, notes });
      } else {
        if (!reason.trim()) return;
        await defer.mutateAsync({ id: task.id, reason });
      }
      onClose();
    } catch (err: any) {
      const c = asConflict(err);
      if (c) { setConflict(c); return; }
      throw err;
    }
  };

  const QUICK_NOTES: Record<string, string[]> = {
    personal_care: ['Completed with assistance', 'Resident cooperative', 'Skin intact, no concerns', 'Refused initially — encouraged gently'],
    nutrition:     ['Good appetite', 'Poor appetite — encouraged', 'Ate most of meal', 'Refused — offered alternatives'],
    medication:    ['Administered as prescribed', 'Taken without issues', 'Refused — noted', 'Administered with food'],
    repositioning: ['Repositioned — skin intact', 'Pressure areas checked', 'Resident comfortable', 'Used slide sheet'],
    observation:   ['No concerns noted', 'Within normal limits', 'Observations completed', 'Reported to senior'],
  };

  const DEFER_REASONS = [
    'Resident asleep — will complete shortly',
    'Resident unwell — reviewed by nurse',
    'Resident refused',
    'Staff shortage — escalated to manager',
    'Resident at appointment',
    'Task not applicable today',
    'Other (see notes)',
  ];

  const quickNotes = QUICK_NOTES[task.category] || [];

  if (conflict) {
    return <ConflictDialog conflict={conflict} onCancel={() => { setConflict(null); onClose(); }} />;
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header" style={{ background: st.bg, borderBottom: `2px solid ${st.border}` }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>{task.icon}</span>
              <h2 className="modal-title" style={{ color: st.text }}>{task.task_name}</h2>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              {task.resident_name} · Room {task.room_number} · Due {task.due_time?.slice(0,5)}
            </div>
          </div>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        {/* Presence warning */}
        {isSomeoneElse && (
          <div style={{ padding: '10px 16px', background: '#faf5ff', borderBottom: '1px solid #c4b5fd', fontSize: 13, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span><strong>{task.in_progress_name}</strong> is also filling this task right now</span>
          </div>
        )}

        <form onSubmit={submit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setMode('complete')} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${mode === 'complete' ? '#16a34a' : 'var(--border)'}`,
                background: mode === 'complete' ? '#f0fdf4' : 'white', color: mode === 'complete' ? '#16a34a' : 'var(--text-secondary)',
                fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}>✅ Mark Complete</button>
              <button type="button" onClick={() => setMode('defer')} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${mode === 'defer' ? '#d97706' : 'var(--border)'}`,
                background: mode === 'defer' ? '#fffbeb' : 'white', color: mode === 'defer' ? '#d97706' : 'var(--text-secondary)',
                fontWeight: 700, cursor: 'pointer', fontSize: 14,
              }}>↩️ Defer</button>
            </div>

            {mode === 'complete' && (
              <>
                {quickNotes.length > 0 && (
                  <div>
                    <label className="form-label">Quick Notes</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {quickNotes.map(q => (
                        <button type="button" key={q} onClick={() => setNotes(q)} style={{
                          padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                          border: `1px solid ${notes === q ? '#16a34a' : 'var(--border)'}`,
                          background: notes === q ? '#f0fdf4' : 'white',
                          color: notes === q ? '#16a34a' : 'var(--text-secondary)',
                          fontWeight: notes === q ? 700 : 400,
                        }}>{q}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Notes (optional)</label>
                  <textarea className="form-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder={`Any observations for ${task.resident_name}…`} />
                </div>
              </>
            )}

            {mode === 'defer' && (
              <>
                <div>
                  <label className="form-label">Reason *</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {DEFER_REASONS.map(r => (
                      <button type="button" key={r} onClick={() => setReason(r)} style={{
                        padding: '9px 14px', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                        border: `2px solid ${reason === r ? '#d97706' : 'var(--border)'}`,
                        background: reason === r ? '#fffbeb' : 'white',
                        color: reason === r ? '#d97706' : 'var(--text-secondary)',
                        fontWeight: reason === r ? 700 : 400, fontSize: 13,
                      }}>{r}</button>
                    ))}
                  </div>
                </div>
                {reason.includes('Other') && (
                  <textarea className="form-input" rows={2} value={reason === 'Other (see notes)' ? '' : reason.replace('Other (see notes)', '')}
                    onChange={e => setReason('Other: ' + e.target.value)}
                    placeholder="Please explain…" />
                )}
              </>
            )}

            <div style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
              ✍ {user?.firstName} {user?.lastName} · {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>{tr('Cancel')}</button>
            <button type="submit" className="btn btn-primary"
              disabled={complete.isPending || defer.isPending || (mode === 'defer' && !reason.trim())}
              style={{ background: mode === 'defer' ? '#d97706' : undefined, borderColor: mode === 'defer' ? '#d97706' : undefined }}>
              {complete.isPending || defer.isPending ? 'Saving…' : mode === 'complete' ? '✅ Confirm Complete' : '↩️ Confirm Defer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main TaskBoard ─────────────────────────────────────────────────────────
export default function TaskBoard() {
  const { t: tr } = useLang();
  const { user } = useAuthStore();
  // Use local date not UTC to match what DB stored
  const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };
  const [date, setDate] = useState(localToday());
  const [activeTask, setActive]   = useState<any>(null);
  const [filter, setFilter]       = useState<'all' | 'due' | 'overdue' | 'missed' | 'done'>('all');
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch]       = useState('');
  const [now, setNow]             = useState(new Date());

  const startTask   = useStartTask();
  const [tapConflict, setTapConflict] = useState<{ conflict: Conflict; task: any } | null>(null);
  const navigate = useNavigate();
  const genTasks    = useGenerateTasks();
  const { data: rawResidents = [] } = useResidents({ active: true });
  const residents: any[] = Array.isArray(rawResidents) ? rawResidents : [];

  // Live clock — updates task status colours every 30s
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Real-time SSE updates
  useTaskSSE();

  const { data: rawTasks = [], isLoading, isError, refetch } = useTasks({ date });

  // Auto-generate today's tasks if board is empty on first load
  const hasAutoGenerated = React.useRef(false);
  React.useEffect(() => {
    if (!isLoading && !isError && Array.isArray(rawTasks) && rawTasks.length === 0 && !hasAutoGenerated.current) {
      hasAutoGenerated.current = true;
      genTasks.mutate(date, {
        onSuccess: (result) => {
          console.log('Tasks generated:', result);
          refetch();
        },
        onError: (err: any) => {
          console.error('Generate tasks error:', err?.response?.data || err);
          hasAutoGenerated.current = false; // allow retry
        },
      });
    }
  }, [isLoading, isError, rawTasks, date]);
  const tasks: any[] = Array.isArray(rawTasks) ? rawTasks : [];

  const userRole   = user?.role || 'carer';
  const userId     = user?.id   || '';
  const isManager  = ['home_manager','deputy_manager','super_admin','group_admin'].includes(userRole);
  const isSenior   = ['registered_nurse','senior_carer'].includes(userRole) || isManager;

  // Group by resident
  const byResident: Record<string, any[]> = {};
  for (const t of tasks) {
    if (!byResident[t.resident_id]) byResident[t.resident_id] = [];
    byResident[t.resident_id].push(t);
  }

  // Filter rows
  const residentIds = Object.keys(byResident).filter(rid => {
    const resTasks = byResident[rid];
    if (search) {
      const name = resTasks[0]?.resident_name?.toLowerCase() || '';
      const room = String(resTasks[0]?.room_number || '');
      if (!name.includes(search.toLowerCase()) && !room.includes(search)) return false;
    }
    if (filter !== 'all') {
      const hasStatus = resTasks.some(t => t.status === filter || (filter === 'overdue' && t.status === 'overdue'));
      if (!hasStatus) return false;
    }
    return true;
  });

  const openTask = async (task: any) => {
    // Medicines live on the MAR chart. Sending the user there is the only
    // correct response to tapping a medication round.
    if (task.handled_in === 'emar') {
      navigate(`/emar?resident_id=${task.resident_id}`);
      return;
    }
    try {
      await startTask.mutateAsync({ id: task.id });
      setActive(task);
    } catch (err: any) {
      const c = asConflict(err);
      if (c) { setTapConflict({ conflict: c, task }); return; }
      setActive(task);   // presence is a convenience, not a gate
    }
  };

  const takeOverTask = async () => {
    if (!tapConflict) return;
    const t = tapConflict.task;
    setTapConflict(null);
    try {
      await startTask.mutateAsync({ id: t.id, takeOver: true });
      setActive(t);
    } catch { /* the board refreshes and shows its real state */ }
  };

  // Summary counts
  const counts = {
    due:      tasks.filter(t => t.status === 'due').length,
    overdue:  tasks.filter(t => t.status === 'overdue').length,
    missed:   tasks.filter(t => t.status === 'missed').length,
    done:     tasks.filter(t => t.status === 'done').length,
    total:    tasks.length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
  };

  const CATEGORIES = ['personal_care','nutrition','medication','repositioning','observation'];

  return (
    <div>
      {tapConflict && (
        <ConflictDialog
          conflict={tapConflict.conflict}
          onCancel={() => setTapConflict(null)}
          onProceed={tapConflict.conflict.canTakeOver ? takeOverTask : undefined}
          proceedLabel="Take over"
        />
      )}
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📋 Task Board</h1>
          <p className="page-subtitle">
            {counts.done}/{counts.total} complete · {counts.due} due · {counts.overdue} overdue · {counts.missed > 0 ? `⚠️ ${counts.missed} missed` : '0 missed'}
          </p>
          {/* Progress Ring */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8 }}>
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="var(--border)" strokeWidth="4" />
              <circle cx="24" cy="24" r="20" fill="none" stroke="#16a34a" strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - (counts.total > 0 ? counts.done / counts.total : 0))}`}
                strokeLinecap="round"
                transform="rotate(-90 24 24)"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
              <text x="24" y="24" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontWeight: 700, fill: 'var(--text-primary)' }}>
                {counts.total > 0 ? Math.round(counts.done / counts.total * 100) : 0}%
              </text>
            </svg>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>{tr('Complete')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} style={{ width: 148 }} />
          <button className="btn btn-secondary btn-sm" onClick={() => genTasks.mutate(date, { onSuccess: () => refetch() })} disabled={genTasks.isPending} style={{ minHeight: 44, padding: '10px 16px' }}>
            {genTasks.isPending ? '⏳ Generating…' : '⚡ Generate Tasks'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => refetch()} style={{ minHeight: 44, padding: '10px 16px' }}>🔄 Refresh</button>
        </div>
      </div>

      {/* ── Status KPIs ────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { key: 'all',     label: 'All Tasks',  value: counts.total,    color: '#6366f1' },
          { key: 'due',     label: 'Due Now',    value: counts.due,      color: '#0d9488' },
          { key: 'overdue', label: 'Overdue',    value: counts.overdue,  color: '#d97706' },
          { key: 'missed',  label: 'Missed',     value: counts.missed,   color: '#dc2626' },
          { key: 'done',    label: 'Complete',   value: counts.done,     color: '#16a34a' },
        ].map(k => (
          <button key={k.key} onClick={() => setFilter(k.key as any)} style={{
            padding: '8px 14px', borderRadius: 20,
            border: `2px solid ${filter === k.key ? k.color : 'var(--border)'}`,
            background: filter === k.key ? k.color + '12' : 'white',
            color: filter === k.key ? k.color : 'var(--text-secondary)',
            fontWeight: filter === k.key ? 700 : 400,
            cursor: 'pointer', fontSize: 13, display: 'flex', gap: 6, alignItems: 'center',
          }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: k.color }}>{k.value}</span>
            {k.label}
          </button>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" placeholder="🔍 Search resident…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13, width: 180, background: 'var(--surface-2)' }} />
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCatFilter(catFilter === cat ? '' : cat)} style={{
            padding: '6px 12px', borderRadius: 20,
            border: `1px solid ${catFilter === cat ? CATEGORY_COLOR[cat] : 'var(--border)'}`,
            background: catFilter === cat ? CATEGORY_COLOR[cat] + '12' : 'white',
            color: catFilter === cat ? CATEGORY_COLOR[cat] : 'var(--text-muted)',
            cursor: 'pointer', fontSize: 12, fontWeight: catFilter === cat ? 700 : 400,
          }}>
            {cat.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* ── Legend ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {Object.entries(STATUS).filter(([k]) => !['na','upcoming'].includes(k)).map(([k, v]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: v.text }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.dot, display: 'inline-block' }} />
            {v.label}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#7c3aed' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />
          🟣 Someone filling
        </span>
      </div>

      {/* ── Task Board ─────────────────────────────────────── */}
      {isLoading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading tasks…</div>
      ) : tasks.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>No tasks for {date}</div>
            {genTasks.isError && (
              <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 10, padding: '8px 14px', background: '#fef2f2', borderRadius: 8, textAlign: 'left' }}>
                <strong>⚠️ Error generating tasks:</strong><br/>
                {(genTasks.error as any)?.response?.data?.error
                  || (genTasks.error as any)?.response?.data?.message
                  || (genTasks.error as any)?.message
                  || 'Unknown error — check backend terminal for details'}
                {(genTasks.error as any)?.response?.status && (
                  <span style={{ marginLeft: 8, opacity: 0.7 }}>
                    (HTTP {(genTasks.error as any)?.response?.status})
                  </span>
                )}
              </div>
            )}
            <button className="btn btn-primary" onClick={() => genTasks.mutate(date, { onSuccess: () => refetch() })} disabled={genTasks.isPending}>
              {genTasks.isPending ? '⏳ Generating tasks…' : '⚡ Generate Today\'s Tasks'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Header row — task names */}
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8, padding: '0 0 4px', borderBottom: '2px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{tr('Resident')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Tap a chip to record — chips turn red if overdue</div>
          </div>

          {residentIds.map(rid => {
            const resTasks = byResident[rid];
            const filtered = catFilter ? resTasks.filter(t => t.category === catFilter) : resTasks;
            if (filtered.length === 0) return null;

            const first       = resTasks[0];
            const hasMissed   = resTasks.some(t => t.status === 'missed');
            const hasOverdue  = resTasks.some(t => t.status === 'overdue');
            const hasInProg   = resTasks.some(t => t.in_progress_by && t.in_progress_by !== userId);
            const allDone     = filtered.every(t => t.status === 'done' || t.status === 'deferred' || t.status === 'na');
            const doneCount   = filtered.filter(t => t.status === 'done' || t.status === 'deferred').length;
            const rowBg       = hasMissed ? '#fef2f208' : hasOverdue ? '#fffbeb08' : allDone ? '#f0fdf408' : 'white';
            const rowBorder   = hasMissed ? '#fca5a5' : hasOverdue ? '#fcd34d' : allDone ? '#86efac' : 'var(--border)';

            return (
              <div key={rid} style={{
                display: 'grid', gridTemplateColumns: '180px 1fr',
                gap: 8, padding: '10px 12px',
                background: rowBg, border: `1px solid ${rowBorder}`,
                borderRadius: 10, alignItems: 'center',
              }}>
                {/* Resident info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(() => {
                    const res = residents.find((r: any) => r.id === rid);
                    const photoUrl = residentPhoto(res?.photo_url);
                    const initials = first.resident_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2);
                    return photoUrl ? (
                      <img src={photoUrl} alt={first.resident_name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,.1)' }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e0e7ff', border: '2px solid #c7d2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#4338ca', flexShrink: 0 }}>{initials}</div>
                    );
                  })()}
                  <div>
                    <Link to={`/residents/${rid}`} style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', textDecoration: 'none' }}>
                      {first.resident_name}
                    </Link>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span>Rm {first.room_number}</span>
                      {first.risk_level === 'high' && <span style={{ color: '#dc2626', fontWeight: 700 }}>🔴</span>}
                      <span style={{ color: doneCount === filtered.length ? '#16a34a' : 'var(--text-muted)', fontWeight: 600 }}>
                        {doneCount}/{filtered.length}
                      </span>
                    </div>
                    {hasInProg && (
                      <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600, marginTop: 2 }}>
                        🟣 {resTasks.find(t => t.in_progress_by && t.in_progress_by !== userId)?.in_progress_name} filling…
                      </div>
                    )}
                  </div>
                </div>

                {/* Task chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {filtered
                    .sort((a, b) => (a.due_time || '').localeCompare(b.due_time || ''))
                    .map(task => (
                      <TaskChip
                        key={task.id}
                        task={task}
                        userRole={userRole}
                        userId={userId}
                        onOpen={openTask}
                      />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Task completion modal ──────────────────────────── */}
      {activeTask && (
        <TaskModal
          task={activeTask}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
