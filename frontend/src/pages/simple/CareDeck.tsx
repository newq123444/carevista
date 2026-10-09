// ────────────────────────────────────────────────────────────────────────────
// The care deck — recording a round, one card at a time.
//
// Deliberately shows ONE task. A list invites a carer to tick several at once
// from the corridor; a single card asks "have you done this one?" and is
// answered honestly far more often.
//
// The uncomfortable truth about making recording this fast: it speeds up false
// recording too. Somebody could sit in the staff room and swipe through twelve
// residents. That is why this ships alongside the implausibility check, which
// flags care recorded for more residents than could physically be attended —
// and why every action here is undoable rather than confirmed. Confirmation
// dialogues get tapped through without reading; an undo that sits there for
// six seconds actually gets used.
// ────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SwipeCard, { type SwipeDir } from '../../components/SwipeCard';
import { useCompleteTask, useDeferTask, useCreateNote, useReopenTask } from '../../hooks';
import { useShiftTasks } from '../../hooks/useShiftTasks';
import { dueAt } from '../../utils/roundWindow';
import { toast } from '../../utils/toast';
import QuickRecord from './QuickRecord';
import { asConflict } from '../../components/ConflictDialog';
import {
  specForTask, buildNote, foodPercent, fluidMl, moodOf, hasAnything, bowelsFromLabels,
  type QuickSpec, type Selections,
} from '../../utils/quickOptions';

/** Why a task might not have happened. Each is one big button, not a text box. */
const REASONS: [string, string, string][] = [
  ['Resident declined', '🚫', 'They said no, or turned away'],
  ['Resident asleep',   '😴', 'Settled — did not want to disturb'],
  ['Needs two carers',  '👥', 'Cannot be done safely alone'],
  ['Resident not here', '🚪', 'Out, at an appointment, or with family'],
  ['Tell the nurse',    '🩺', 'Something is wrong and needs checking'],
];

export default function CareDeck() {
  const nav = useNavigate();
  const { round, all, doneThisShift, isLoading } = useShiftTasks();
  const complete = useCompleteTask();
  const defer = useDeferTask();
  const createNote = useCreateNote();
  const reopen = useReopenTask();

  // Cards passed over this session, by id. NOT an index: when a card is
  // recorded the cache drops it from the list immediately, and an index then
  // lands one card too far — every Done silently skipped the next task.
  const [passed, setPassed] = useState<Set<string>>(() => new Set());
  const [problemFor, setProblemFor] = useState<any>(null);
  const [recording, setRecording] = useState<{ task: any; spec: QuickSpec } | null>(null);
  const [saving, setSaving] = useState(false);
  const [undo, setUndo] = useState<{ task: any; what: string; noteId?: string } | null>(null);
  const [includeEarlier, setIncludeEarlier] = useState(false);

  // The round is what is due around now, on this shift. Earlier unrecorded
  // tasks from this shift are one tap away and are put FIRST when opened —
  // missed care is the more urgent kind, not the less. Tasks from another
  // shift, and tasks not due yet, are never in the deck. See roundWindow.ts.
  const queue = useMemo(
    () => (includeEarlier ? [...round.earlier, ...round.now] : round.now),
    [round, includeEarlier]);

  // The deck moves as time passes. Pin the card on screen by id so a task
  // sliding into the window mid-swipe does not swap what the carer is looking at.
  const remaining = useMemo(() => queue.filter((t: any) => !passed.has(t.id)), [queue, passed]);
  const task = remaining[0];
  const total = all.length;
  const isEarlier = !!task && round.earlier.some((t: any) => t.id === task.id);

  // Medication is signed on the MAR chart by a nurse. A carer swiping it "done"
  // here would create a medication record with no administration behind it.
  const isEmar = task?.handled_in === 'emar';

  function pass(id: string) { setPassed(prev => new Set(prev).add(id)); }
  function unpass(id: string) { setPassed(prev => { const n = new Set(prev); n.delete(id); return n; }); }

  function showUndo(t: any, what: string, noteId?: string) {
    setUndo({ task: t, what, noteId });
    window.setTimeout(() => setUndo(u => (u && u.task.id === t.id ? null : u)), 8000);
  }

  function onSwipe(dir: SwipeDir) {
    if (!task) return;
    if (dir === 'right') {
      if (isEmar) { toast.info('This one is signed on the MAR chart'); return; }

      // "Done" on its own says almost nothing. Where there is something worth
      // asking, ask it — two or three taps turns a tick into a care record.
      // Where there is not, do not put an empty form in the way.
      const spec = specForTask(task);
      if (spec) { setRecording({ task, spec }); return; }

      complete.mutate({ id: task.id });
      showUndo(task, 'Recorded as done');
      pass(task.id);
    } else if (dir === 'left') {
      pass(task.id);                             // skipped, not recorded — comes back on "go through again"
      toast.info('Left for later');
    } else {
      setProblemFor(task);
    }
  }

  async function saveRecord(sel: Selections, extra: string, confirmDuplicate = false) {
    const entry = recording;
    if (!entry) return;
    setSaving(true);
    try {
      const text = buildNote(entry.spec, sel, extra);

      // The care note is the clinical record — it is what goes into the record
      // chain and what a family or an inspector reads back. The task completion
      // is only workflow state. Write the note first: a task marked done with
      // no note behind it is the thin record we are trying to stop making.
      let noteId: string | undefined;
      if (hasAnything(sel, extra)) {
        const note: any = await createNote.mutateAsync({
          residentId: entry.task.resident_id,
          noteType: entry.spec.noteType,
          content: text,
          foodEatenPercent: foodPercent(entry.spec, sel),
          fluidIntakeMl: fluidMl(sel),
          mood: moodOf(entry.spec, sel),
          ...(sel.bowels?.length ? (() => {
            const b = bowelsFromLabels(sel.bowels);
            return { bowelsOpened: b.opened, stoolType: b.stoolType };
          })() : {}),
          ...(confirmDuplicate ? { confirmDuplicate: true } : {}),
        });
        noteId = note?.id;
      }

      await complete.mutateAsync({ id: entry.task.id, notes: text.slice(0, 200) });
      setRecording(null);
      showUndo(entry.task, text ? text.slice(0, 60) : 'Recorded as done', noteId);
      pass(entry.task.id);
    } catch (err: any) {
      const c = asConflict(err);
      if (c?.conflict === 'possible_duplicate') {
        // Two carers recording the same care is common and usually innocent.
        // Say who and when, and let them decide — never just refuse.
        setSaving(false);
        if (window.confirm(`${(c as any).error || 'This looks like it may already be recorded.'}\n\nRecord it anyway?`)) {
          return saveRecord(sel, extra, true);
        }
        return;
      }
      if (c?.conflict === 'already_completed') {
        // Somebody else finished it first. Their record stands; move on.
        toast.error((c as any).error || 'Someone else has already recorded this.');
        setRecording(null);
        pass(entry.task.id);
        return;
      }
      // Anything else: leave the sheet open with their taps intact so nothing
      // has to be retyped.
      toast.error(err?.response?.data?.error || 'Could not save that — try again');
    } finally {
      setSaving(false);
    }
  }

  function recordProblem(reason: string) {
    const t = problemFor;
    setProblemFor(null);
    if (!t) return;
    defer.mutate({ id: t.id, reason });
    showUndo(t, reason);
    pass(t.id);
  }

  if (isLoading) {
    return <Centre><p style={{ fontSize: 18 }}>Getting your round…</p></Centre>;
  }

  if (!task) {
    const nextUp = round.later[0];
    const nextAt = nextUp ? dueAt(nextUp) : null;
    return (
      <Centre>
        <div style={{ fontSize: 64, marginBottom: 8 }}>
          {total === 0 ? '☕' : round.earlier.length ? '🕒' : '✅'}
        </div>
        <h2 style={{ fontSize: 24, margin: '0 0 6px' }}>
          {total === 0 ? 'Nothing on your round yet' : 'Nothing due right now'}
        </h2>
        <p style={{ fontSize: 17, color: 'var(--text-secondary)', margin: '0 0 22px', maxWidth: 340, lineHeight: 1.5 }}>
          {total === 0
            ? 'Nothing has been set up for this shift. Your manager can add tasks.'
            : <>
                {doneThisShift} recorded this {round.shift.name === 'day' ? 'shift' : 'night'}.
                {nextAt && <> Next is {nextUp.task_name} for {nextUp.resident_name} at{' '}
                  {String(nextAt.getHours()).padStart(2, '0')}:{String(nextAt.getMinutes()).padStart(2, '0')}.</>}
              </>}
        </p>
        {round.earlier.length > 0 && !includeEarlier && (
          <button onClick={() => setIncludeEarlier(true)}
            style={{ ...btn('#b45309'), minHeight: 64, boxShadow: 'none' }}>
            {round.earlier.length} earlier {round.earlier.length === 1 ? 'task was' : 'tasks were'} not recorded
          </button>
        )}
        {(round.earlier.length === 0 || includeEarlier) && passed.size > 0 && (
          <button onClick={() => setPassed(new Set())} style={{ ...btn('#4f46e5'), minHeight: 64 }}>
            Go through again
          </button>
        )}
        <button onClick={() => nav('/')}
          style={{ ...btn('transparent'), background: 'transparent', minHeight: 64,
                   color: 'var(--text-secondary)', boxShadow: 'none' }}>
          Back
        </button>
      </Centre>
    );
  }

  const initials = String(task.resident_name || '?')
    .split(' ').map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      background: 'var(--surface-2, #f1f5f9)', padding: '12px 12px 0',
    }}>
      {/* Progress: how far through the round, in words as well as a bar. */}
      <div style={{ maxWidth: 480, width: '100%', margin: '0 auto 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <button onClick={() => nav('/')} style={{
            border: 'none', background: 'none', fontSize: 16, cursor: 'pointer',
            color: 'var(--text-secondary)', padding: '8px 4px', minHeight: 44,
          }}>← Back</button>
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            {remaining.length} to do now
          </span>
        </div>
        {round.earlier.length > 0 && !includeEarlier && (
          <button onClick={() => setIncludeEarlier(true)} style={{
            width: '100%', minHeight: 64, marginBottom: 8, borderRadius: 12, cursor: 'pointer',
            border: '1.5px solid #fcd34d', background: '#fffbeb', color: '#92400e',
            fontSize: 15.5, fontWeight: 600,
          }}>
            ⚠ {round.earlier.length} earlier {round.earlier.length === 1 ? 'task' : 'tasks'} this shift not recorded — show
          </button>
        )}
        <div style={{ height: 8, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99, background: '#16a34a',
            width: `${(doneThisShift + remaining.length) ? (doneThisShift / (doneThisShift + remaining.length)) * 100 : 0}%`,
            transition: 'width .3s',
          }} />
        </div>
      </div>

      {/* The card */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 0 12px' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <SwipeCard
            key={task.id}
            onSwipe={onSwipe}
            onTap={() => nav(`/tasks?open=${task.id}`)}
            allowRight={!isEmar}
          >
            <div style={{
              background: '#fff', borderRadius: 20, padding: '28px 22px',
              boxShadow: '0 10px 30px rgba(15,23,42,.13)', textAlign: 'center',
              minHeight: 380, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <div style={{
                width: 92, height: 92, borderRadius: '50%', background: '#eef2ff',
                color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, fontWeight: 700, marginBottom: 10,
              }}>{initials}</div>

              <div style={{ fontSize: 27, fontWeight: 700, lineHeight: 1.2 }}>{task.resident_name}</div>
              <div style={{ fontSize: 17, color: 'var(--text-secondary)', marginBottom: 16 }}>
                Room {task.room_number}
              </div>

              <div style={{ fontSize: 52, lineHeight: 1 }}>{task.icon || '📋'}</div>
              <div style={{ fontSize: 22, fontWeight: 600, marginTop: 8, lineHeight: 1.25 }}>
                {task.task_name}
              </div>
              {task.due_time && (
                <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginTop: 4 }}>
                  around {String(task.due_time).slice(0, 5)}
                </div>
              )}

              {isEmar && (
                <div style={{
                  marginTop: 14, fontSize: 14.5, color: '#92400e', background: '#fffbeb',
                  border: '1px solid #fde68a', borderRadius: 10, padding: '9px 13px', maxWidth: 300,
                }}>
                  Medication — the nurse signs this on the MAR chart
                </div>
              )}

              {isEarlier && (
                <div style={{
                  marginTop: 14, fontSize: 14.5, color: '#92400e', background: '#fffbeb',
                  border: '1px solid #fde68a', borderRadius: 10, padding: '9px 13px', maxWidth: 320,
                }}>
                  Earlier this shift — only record it if it was actually done. If not, use Problem.
                </div>
              )}

              {task.status === 'upcoming' && (
                <div style={{
                  marginTop: 14, fontSize: 14.5, color: '#475569', background: '#f1f5f9',
                  border: '1px solid #cbd5e1', borderRadius: 10, padding: '9px 13px',
                }}>
                  Not due yet — only record this once you have done it
                </div>
              )}

              {task.status === 'missed' && !isEarlier && (
                <div style={{
                  marginTop: 14, fontSize: 14.5, color: '#b91c1c', background: '#fef2f2',
                  border: '1px solid #fecaca', borderRadius: 10, padding: '9px 13px',
                }}>
                  This one is overdue
                </div>
              )}

              {task.in_progress_name && (
                <div style={{
                  marginTop: 12, fontSize: 14.5, color: '#1d4ed8', background: '#eff6ff',
                  border: '1px solid #bfdbfe', borderRadius: 10, padding: '9px 13px',
                }}>
                  {task.in_progress_name} is doing this now
                </div>
              )}

              <div style={{ marginTop: 16, fontSize: 13.5, color: '#94a3b8' }}>
                Tap the card to write more
              </div>
            </div>
          </SwipeCard>
        </div>
      </div>

      {/* Buttons do everything a swipe does. Bottom of the screen, thumb reach. */}
      <div style={{
        maxWidth: 480, width: '100%', margin: '0 auto',
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10,
        padding: '0 0 calc(14px + env(safe-area-inset-bottom))',
      }}>
        <ActionButton label="Not now" icon="↻" tone="#d97706" onClick={() => onSwipe('left')} />
        <ActionButton label="Problem" icon="!" tone="#dc2626" onClick={() => onSwipe('up')} />
        <ActionButton label="Done" icon="✓" tone="#16a34a" onClick={() => onSwipe('right')}
                      disabled={isEmar} />
      </div>

      {recording && (
        <QuickRecord
          spec={recording.spec}
          residentName={recording.task.resident_name}
          taskName={recording.task.task_name}
          saving={saving}
          onSave={saveRecord}
          onCancel={() => setRecording(null)}
          onFullForm={() => nav(`/tasks?open=${recording.task.id}`)}
        />
      )}

      {/* Problem sheet */}
      {problemFor && (
        <div onClick={() => setProblemFor(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 60,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', width: '100%', maxWidth: 480,
            borderRadius: '20px 20px 0 0', padding: '20px 16px calc(20px + env(safe-area-inset-bottom))',
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 99, background: '#cbd5e1', margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 4px', fontSize: 20 }}>What happened?</h3>
            <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--text-secondary)' }}>
              {problemFor.task_name} — {problemFor.resident_name}
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {REASONS.map(([label, icon, help]) => (
                <button key={label} onClick={() => recordProblem(label)} style={{
                  display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                  padding: '14px 16px', minHeight: 68, borderRadius: 14, cursor: 'pointer',
                  border: '1.5px solid var(--border)', background: '#fff', width: '100%',
                }}>
                  <span style={{ fontSize: 28 }}>{icon}</span>
                  <span>
                    <span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>{label}</span>
                    <span style={{ display: 'block', fontSize: 14, color: 'var(--text-secondary)' }}>{help}</span>
                  </span>
                </button>
              ))}
            </div>
            <button onClick={() => setProblemFor(null)} style={{
              marginTop: 12, width: '100%', minHeight: 52, borderRadius: 14,
              border: 'none', background: 'transparent', fontSize: 16,
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Undo. Six seconds, and it says what it is undoing. */}
      {undo && (
        <div style={{
          position: 'fixed', left: 12, right: 12, bottom: 'calc(92px + env(safe-area-inset-bottom))',
          maxWidth: 456, margin: '0 auto', zIndex: 70,
          background: '#0f172a', color: '#fff', borderRadius: 14,
          padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 10px 24px rgba(0,0,0,.28)',
        }}>
          <span style={{ flex: 1, fontSize: 15, minWidth: 0 }}>
            <strong>{undo.task.resident_name}</strong> — {undo.what}
          </span>
          <button disabled={reopen.isPending} onClick={() => {
            // A real undo: the server reopens the task and withdraws the note
            // written with it, as "recorded in error". Both the record and the
            // reversal stay on the integrity chain. Only works for the person
            // who recorded it, within ten minutes — after that it is a
            // correction, not a mis-tap.
            const u = undo;
            setUndo(null);
            reopen.mutate({ id: u.task.id, noteId: u.noteId } as any, {
              onSuccess: () => { unpass(u.task.id); toast.info('Undone — the card is back'); },
            });
          }} style={{
            border: '1px solid rgba(255,255,255,.35)', background: 'transparent', color: '#fff',
            borderRadius: 10, padding: '9px 18px', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', minHeight: 56,
          }}>Undo</button>
        </div>
      )}
    </div>
  );
}

function ActionButton({ label, icon, tone, onClick, disabled }: any) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      minHeight: 76, borderRadius: 16, cursor: disabled ? 'not-allowed' : 'pointer',
      border: `2px solid ${disabled ? '#e2e8f0' : tone}`,
      background: disabled ? '#f8fafc' : '#fff',
      color: disabled ? '#cbd5e1' : tone,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
      fontWeight: 700, fontSize: 15,
    }}>
      <span style={{ fontSize: 26, lineHeight: 1 }}>{icon}</span>
      {label}
    </button>
  );
}

function Centre({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, gap: 10,
    }}>{children}</div>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    minHeight: 64, padding: '0 28px', borderRadius: 14, border: 'none',
    background: bg, color: '#fff', fontSize: 17, fontWeight: 600, cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(79,70,229,.25)',
  };
}
