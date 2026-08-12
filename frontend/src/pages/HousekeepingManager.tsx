// src/pages/HousekeepingManager.tsx — manage cleaning checklists (manager)
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useHkAdmin, useCreateHk, useUpdateHk, useDeleteHk, useCopyHkDefaults } from '../hooks';
import { SectionCard, PageHeading } from '../components/ui';

const CATS: { key: string; label: string }[] = [
  { key: 'daily_room', label: 'Daily — Resident Room' },
  { key: 'weekly_room', label: 'Weekly — Resident Room' },
  { key: 'quarterly_room', label: '3-Monthly — Resident Room' },
  { key: 'daily_communal', label: 'Daily — Communal Areas' },
];

export default function HousekeepingManager() {
  const { t: tr } = useLang();
  const { data: tasks = [], isLoading } = useHkAdmin();
  const create = useCreateHk(); const update = useUpdateHk(); const remove = useDeleteHk(); const copy = useCopyHkDefaults();
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({ category: 'daily_room', specification: '', area_label: '' });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const openNew = (category: string, area_label = '') => { setForm({ category, specification: '', area_label }); setEditing('new'); };
  const openEdit = (t: any) => { setForm({ ...t }); setEditing(t.id); };
  const save = () => { if (!form.specification.trim()) return; const p = { ...form, area_label: form.category === 'daily_communal' ? form.area_label : null }; if (editing === 'new') create.mutate(p, { onSuccess: () => setEditing(null) }); else update.mutate({ id: editing, data: p }, { onSuccess: () => setEditing(null) }); };

  const list = (tasks as any[]).filter(t => t.active !== false);
  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface)', color: 'var(--text-primary)' };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };

  const row = (t: any) => (
    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)' }}>{t.area_label ? <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t.area_label} · </span> : null}{t.specification}</div>
      <button onClick={() => openEdit(t)} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}>{tr('Edit')}</button>
      <button onClick={() => { if (confirm('Remove this task?')) remove.mutate(t.id); }} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--danger)', background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}>{tr('Remove')}</button>
    </div>
  );

  return (
    <div style={{ padding: 4, maxWidth: 900, margin: '0 auto' }}>
      <PageHeading greeting="Housekeeping tasks" emoji="🧹" subtitle="Configure your cleaning checklists" />
      {isLoading && <div style={{ color: 'var(--text-muted)' }}>{tr('Loading…')}</div>}
      {!isLoading && list.length === 0 && (
        <SectionCard>
          <div style={{ textAlign: 'center', padding: 12 }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>Your home is using the standard checklists. Copy them here to customise for your home.</p>
            <button onClick={() => copy.mutate()} disabled={copy.isPending} style={{ padding: '10px 18px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>{copy.isPending ? 'Copying…' : 'Copy standard checklist to customise'}</button>
          </div>
        </SectionCard>
      )}
      {list.length > 0 && CATS.map(c => {
        const items = list.filter(t => t.category === c.key);
        return (
          <SectionCard key={c.key} title={c.label}
            action={<button onClick={() => openNew(c.key)} style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ Add</button>}>
            {items.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No tasks.</div>}
            {items.map(row)}
          </SectionCard>
        );
      })}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 32 }}>
          <div style={{ width: '100%', maxWidth: 480, background: 'var(--surface)', borderRadius: 14, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><strong style={{ fontSize: 16 }}>{editing === 'new' ? 'Add task' : 'Edit task'}</strong><button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button></div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={label}>{tr('Checklist')}</label><select style={input} value={form.category} onChange={e => set('category', e.target.value)}>{CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
              {form.category === 'daily_communal' && <div><label style={label}>Area</label><input style={input} value={form.area_label || ''} onChange={e => set('area_label', e.target.value)} placeholder="e.g. Lounge" /></div>}
              <div><label style={label}>{tr('Task')}</label><input style={input} value={form.specification} onChange={e => set('specification', e.target.value)} placeholder="e.g. Dust skirting boards" /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={save} disabled={!form.specification.trim()} style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>{editing === 'new' ? 'Add' : 'Save'}</button>
              <button onClick={() => setEditing(null)} style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>{tr('Cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
