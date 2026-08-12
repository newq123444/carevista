// src/pages/CareTaskManager.tsx — manage home care tasks + personalise per resident
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useTaskTemplates, useCreateTaskTemplate, useUpdateTaskTemplate, useDeleteTaskTemplate,
  useResidents, useResidentCarePlan, useSetTaskExclusion } from '../hooks';
import { SectionCard, PageHeading } from '../components/ui';

const CATEGORIES = ['personal_care', 'nutrition', 'medication', 'observation', 'physical', 'repositioning', 'social_wellbeing'];
const SHIFTS = ['day', 'evening', 'night', 'all'];
const APPLIES = [
  { value: 'all', label: 'All residents' }, { value: 'high_risk', label: 'High-risk only' },
  { value: 'bed_bound', label: 'Bed-bound' }, { value: 'wheelchair', label: 'Wheelchair users' },
  { value: 'independent,walking_aid', label: 'Mobile residents' },
];
const blank = { name: '', icon: '📋', category: 'personal_care', shift: 'day', due_time: '09:00', window_mins: 120, applies_to: 'all', frequency: 'daily', day_of_week: 1, sort_order: 50, resident_id: null as string | null };

export default function CareTaskManager() {
  const { t: tr } = useLang();
  const [mode, setMode] = useState<'home' | 'resident'>('home');
  const [residentId, setResidentId] = useState('');
  const { data: templates = [], isLoading } = useTaskTemplates();
  const { data: residents = [] } = useResidents({ active: true });
  const create = useCreateTaskTemplate(); const update = useUpdateTaskTemplate(); const remove = useDeleteTaskTemplate();
  const plan = useResidentCarePlan(residentId);
  const setExclusion = useSetTaskExclusion(residentId);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(blank);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const openNew = (rid: string | null = null) => { setForm({ ...blank, resident_id: rid }); setEditing('new'); };
  const openEdit = (t: any) => { setForm({ ...blank, ...t, day_of_week: t.day_of_week ?? 1 }); setEditing(t.id); };
  const save = () => {
    if (!form.name.trim()) return;
    const payload = { ...form, day_of_week: form.frequency === 'weekly' ? form.day_of_week : null };
    if (editing === 'new') create.mutate(payload, { onSuccess: () => { setEditing(null); if (residentId) plan.refetch?.(); } });
    else update.mutate({ id: editing, data: payload }, { onSuccess: () => setEditing(null) });
  };

  const active = (templates as any[]).filter(t => t.active !== false && !t.resident_id);
  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface)', color: 'var(--text-primary)' };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };
  const tabBtn = (m: 'home' | 'resident', text: string) => (
    <button onClick={() => setMode(m)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid ' + (mode === m ? 'var(--primary)' : 'var(--border)'), background: mode === m ? 'var(--primary)' : 'var(--surface)', color: mode === m ? '#fff' : 'var(--text-primary)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>{text}</button>
  );
  const resName = (residents as any[]).find((r: any) => r.id === residentId);

  return (
    <div style={{ padding: 4, maxWidth: 1000, margin: '0 auto' }}>
      <PageHeading greeting="Care tasks" emoji="🗂️" subtitle="Configure the home's tasks, or personalise them per resident" />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>{tabBtn('home', '🏠 Home tasks')}{tabBtn('resident', '👤 Per resident')}</div>

      {mode === 'home' && (
        <SectionCard title="Home-wide tasks" action={<button onClick={() => openNew(null)} style={{ padding: '7px 14px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Add task</button>}>
          {isLoading && <div style={{ color: 'var(--text-muted)' }}>{tr('Loading…')}</div>}
          {active.map((t: any) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{t.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.due_time?.slice(0, 5)} · {t.frequency === 'weekly' ? 'Weekly' : 'Daily'} · {(APPLIES.find(a => a.value === t.applies_to)?.label) || t.applies_to}</div>
              </div>
              <button onClick={() => openEdit(t)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}>{tr('Edit')}</button>
              <button onClick={() => { if (confirm(`Remove "${t.name}"?`)) remove.mutate(t.id); }} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid var(--danger)', background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}>{tr('Remove')}</button>
            </div>
          ))}
        </SectionCard>
      )}

      {mode === 'resident' && (
        <>
          <SectionCard>
            <label style={label}>Choose a resident to personalise their care plan</label>
            <select style={{ ...input, maxWidth: 360 }} value={residentId} onChange={e => setResidentId(e.target.value)}>
              <option value="">Select a resident…</option>
              {(residents as any[]).map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} — Room {r.room_number}</option>)}
            </select>
          </SectionCard>

          {residentId && (
            <>
              <SectionCard title={`Home tasks for ${resName?.first_name || ''}`}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>Switch a task off to remove it from this resident's plan.</div>
                {(plan.data?.home || []).map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid var(--border)', opacity: t.excluded ? 0.5 : 1 }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{t.icon}</span>
                    <div style={{ flex: 1, fontSize: 14 }}>{t.name} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>· {t.due_time?.slice(0, 5)}</span></div>
                    <button onClick={() => setExclusion.mutate({ template_id: t.id, excluded: !t.excluded })}
                      style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid ' + (t.excluded ? 'var(--border)' : 'var(--success)'), background: t.excluded ? 'var(--surface-2)' : 'var(--success-light)', color: t.excluded ? 'var(--text-muted)' : 'var(--success)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {t.excluded ? 'Off' : 'On'}
                    </button>
                  </div>
                ))}
              </SectionCard>

              <SectionCard title={`${resName?.first_name || 'Resident'}'s own tasks`} action={<button onClick={() => openNew(residentId)} style={{ padding: '6px 13px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Add personal task</button>}>
                {(plan.data?.specific || []).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No personal tasks — add one specific to this resident (e.g. a dressing change or therapy).</div>}
                {(plan.data?.specific || []).map((t: any) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{t.icon}</span>
                    <div style={{ flex: 1, fontSize: 14 }}>{t.name} <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>· {t.due_time?.slice(0, 5)} · {t.frequency === 'weekly' ? 'Weekly' : 'Daily'}</span></div>
                    <button onClick={() => openEdit(t)} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}>{tr('Edit')}</button>
                    <button onClick={() => { if (confirm('Remove this task?')) remove.mutate(t.id, { onSuccess: () => plan.refetch?.() }); }} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--danger)', background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}>{tr('Remove')}</button>
                  </div>
                ))}
              </SectionCard>
            </>
          )}
        </>
      )}

      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 32 }}>
          <div style={{ width: '100%', maxWidth: 560, background: 'var(--surface)', borderRadius: 14, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <strong style={{ fontSize: 16 }}>{editing === 'new' ? (form.resident_id ? `Add task for ${resName?.first_name || 'resident'}` : 'Add home task') : 'Edit task'}</strong>
              <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}><label style={label}>Task name</label><input style={input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Wound dressing change" /></div>
              <div><label style={label}>Icon</label><input style={input} value={form.icon} maxLength={4} onChange={e => set('icon', e.target.value)} /></div>
              <div><label style={label}>Category</label><select style={input} value={form.category} onChange={e => set('category', e.target.value)}>{CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}</select></div>
              <div><label style={label}>Due time</label><input type="time" style={input} value={form.due_time?.slice(0, 5)} onChange={e => set('due_time', e.target.value)} /></div>
              <div><label style={label}>{tr('Shift')}</label><select style={input} value={form.shift} onChange={e => set('shift', e.target.value)}>{SHIFTS.map(sh => <option key={sh} value={sh}>{sh}</option>)}</select></div>
              {!form.resident_id && <div><label style={label}>Applies to</label><select style={input} value={form.applies_to} onChange={e => set('applies_to', e.target.value)}>{APPLIES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}</select></div>}
              <div><label style={label}>{tr('Frequency')}</label><select style={input} value={form.frequency} onChange={e => set('frequency', e.target.value)}><option value="daily">{tr('Daily')}</option><option value="weekly">{tr('Weekly')}</option></select></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={save} disabled={!form.name.trim()} style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>{editing === 'new' ? 'Add task' : 'Save changes'}</button>
              <button onClick={() => setEditing(null)} style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>{tr('Cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
