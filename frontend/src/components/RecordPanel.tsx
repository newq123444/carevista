// ────────────────────────────────────────────────────────────────────────────
// "What did you do for Ernie?" — record care from the resident, not the task.
//
// Tap a picture, answer the same quick questions the round asks, save. The
// note is written in English whatever language the screen is in, it works with
// no signal, and if there is an open task on the round for the same care, it
// is ticked off with it so nobody does it twice.
// ────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon, type IconName } from './Icon';
import QuickRecord from '../pages/simple/QuickRecord';
import { useCreateNote, useCompleteTask, usePresence, usePresenceActions } from '../hooks';
import { useShiftTasks } from '../hooks/useShiftTasks';
import { useLang } from '../i18n';
import { toast } from '../utils/toast';
import { asConflict } from './ConflictDialog';
import {
  specForType, careKeyOf, buildNote, foodPercent, fluidMl, moodOf, hasAnything, bowelsFromLabels,
  type RecordType, type Selections,
} from '../utils/quickOptions';
import { matchingTask } from '../utils/recordMatch';
import { SafetyFacts } from './SafetyFacts';

interface Tile { key: RecordType | 'weight' | 'obs' | 'note' | 'not_right'; label: string; icon: IconName; bg: string; fg: string }
export const RECORD_TILES: Tile[] = [
  { key: 'personal_care',    label: 'Personal care',  icon: 'bath',         bg: 'var(--blue-50)',   fg: 'var(--blue-700)' },
  { key: 'nutrition',        label: 'Meal',           icon: 'utensils',     bg: 'var(--amber-50)',  fg: 'var(--amber-700)' },
  { key: 'fluids',           label: 'Drink',          icon: 'glass-water',  bg: '#ecfeff',          fg: '#0e7490' },
  { key: 'continence',       label: 'Continence',     icon: 'droplets',     bg: 'var(--violet-50)', fg: 'var(--violet-700)' },
  { key: 'repositioning',    label: 'Turned / moved', icon: 'rotate-cw',    bg: 'var(--green-50)',  fg: 'var(--green-700)' },
  { key: 'sleep',            label: 'Sleep',          icon: 'moon',         bg: '#eef4ff',          fg: '#3538cd' },
  { key: 'social_wellbeing', label: 'Mood & activity', icon: 'smile',       bg: '#fdf2fa',          fg: '#c11574' },
  { key: 'behaviour',        label: 'Behaviour',      icon: 'brain',        bg: '#fef6ee',          fg: '#b93815' },
  { key: 'weight',           label: 'Weight',         icon: 'scale',        bg: 'var(--surface-3)', fg: 'var(--text-secondary)' },
  { key: 'obs',              label: 'Observations',   icon: 'activity',     bg: 'var(--red-50)',    fg: 'var(--red-700)' },
  { key: 'note',             label: 'Write a note',   icon: 'notebook-pen', bg: 'var(--surface-3)', fg: 'var(--text-secondary)' },
  { key: 'not_right',        label: "Something's not right", icon: 'siren', bg: 'var(--red-50)', fg: 'var(--red-700)' },
];

// What other carers are doing, by note type, for the "is with them" line.
const CARE_LABEL: Record<string, string> = {
  personal_care: 'Personal care', nutrition: 'Meal', fluids: 'Drink', continence: 'Continence', repositioning: 'Turned / moved',
  sleep: 'Sleep', social_wellbeing: 'Mood & activity', behaviour: 'Behaviour', task: 'Care', other: 'Care',
};

export function RecordPanel({ resident, onRecorded }: { resident: { id: string; first_name: string; last_name: string; preferred_name?: string | null }; onRecorded?: () => void }) {
  const { t: tr, tf } = useLang();
  const nav = useNavigate();
  const { round } = useShiftTasks();
  const createNote = useCreateNote();
  const complete = useCompleteTask();
  const [open, setOpen] = useState<RecordType | null>(null);
  const { data: presenceList } = usePresence();
  const presence = usePresenceActions();
  // Anyone else with this resident right now (v89b).
  const others = ((Array.isArray(presenceList) ? presenceList : []) as any[]).filter(p => p.residentId === resident.id && !p.mine);
  const [saving, setSaving] = useState(false);
  const name = `${resident.first_name} ${resident.last_name}`;
  const callName = resident.preferred_name || resident.first_name;

  function tap(t: Tile) {
    if (t.key === 'weight') return nav(`/residents/${resident.id}?tab=weight`);
    if (t.key === 'obs') return nav(`/news2?resident=${resident.id}`);
    if (t.key === 'note') return nav(`/care-notes?resident_id=${resident.id}&new=1`);
    if (t.key === 'not_right') return nav(`/something-different?resident=${resident.id}`);
    const careKey = careKeyOf(specForType(t.key as RecordType));
    const same = others.find(p => p.careType === careKey);
    if (same && !window.confirm(tf('{name} started {care} for {resident} {n} minutes ago. Is this different care?', {
      name: String(same.userName).split(' ')[0], care: tr(t.label).toLowerCase(), resident: callName, n: same.minutes,
    }))) return;
    void presence.start(resident.id, careKey);
    setOpen(t.key);
  }

  async function save(sel: Selections, extra: string, confirmDuplicate = false) {
    if (!open) return;
    const spec = specForType(open);
    if (!hasAnything(sel, extra)) { toast.info(tr('Choose at least one thing, or add a note')); return; }
    setSaving(true);
    try {
      const text = buildNote(spec, sel, extra);
      const tileLabel = RECORD_TILES.find(t => t.key === open)?.label || 'Care';
      const label = `${tileLabel} — ${name}`;
      const fields = {
        noteType: spec.noteType,
        content: text,
        foodEatenPercent: foodPercent(spec, sel),
        fluidIntakeMl: fluidMl(sel),
        mood: moodOf(spec, sel),
        ...(sel.bowels?.length ? (() => { const b = bowelsFromLabels(sel.bowels); return { bowelsOpened: b.opened, stoolType: b.stoolType }; })() : {}),
      };
      // If the same care is waiting on the round, the note and the tick go
      // together in one request (v89b): if someone already did it, nothing
      // is saved and the carer is told who and when.
      const task = matchingTask([...round.earlier, ...round.now] as any[], resident.id, open);
      if (task) {
        await complete.mutateAsync({ id: (task as any).id, notes: text.slice(0, 200), label, note: fields, confirmDuplicate });
        toast.success(tf('Recorded — and "{task}" ticked off the round', { task: tr((task as any).task_name) }));
      } else {
        await createNote.mutateAsync({ __label: label, residentId: resident.id, ...fields, ...(confirmDuplicate ? { confirmDuplicate: true } : {}) });
      }
      void presence.end(resident.id);
      setOpen(null);
      onRecorded?.();
    } catch (err: any) {
      const c = asConflict(err);
      if (c?.conflict === 'possible_duplicate' || (c?.conflict === 'already_completed' && (c as any).hadNote)) {
        setSaving(false);
        if (window.confirm(`${(c as any).error || tr('This looks like it may already be recorded.')}\n\n${tr('Record it anyway?')}`)) return save(sel, extra, true);
        return;
      }
      toast.error(err?.response?.data?.error || tr('Could not save that — try again'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h2 className="cv-section-title">{tf('What did you do for {name}?', { name: callName })}</h2>
      {others.length > 0 && (
        <div className="cv-note cv-note-blue" style={{ marginBottom: 10 }}>
          <Icon name="users" size={16} />
          <span>{others.map(p => tf('{name} is with them — {care}, {n} min ago', { name: String(p.userName).split(' ')[0], care: tr(CARE_LABEL[p.careType] || 'Care'), n: p.minutes })).join(' · ')}</span>
        </div>
      )}
      <div style={{ marginBottom: 12 }}><SafetyFacts residentId={resident.id} /></div>
      <div className="cv-record-grid">
        {RECORD_TILES.map(t => (
          <button key={t.key} className={`cv-record-tile${t.key === 'not_right' ? ' alert' : ''}`} onClick={() => tap(t)}>
            <span className="cv-record-icon" style={{ background: t.bg, color: t.fg }}><Icon name={t.icon} size={24} /></span>
            {tr(t.label)}
          </button>
        ))}
      </div>
      {open && (
        <QuickRecord
          spec={specForType(open)}
          residentName={name}
          taskName={RECORD_TILES.find(t => t.key === open)?.label || ''}
          saving={saving}
          onSave={save}
          onCancel={() => { void presence.end(resident.id); setOpen(null); }}
          onFullForm={() => nav(`/care-notes?resident_id=${resident.id}&new=1`)}
        />
      )}
    </>
  );
}
