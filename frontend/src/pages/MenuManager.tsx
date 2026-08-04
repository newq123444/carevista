// src/pages/MenuManager.tsx — manage the kitchen menu (manager/kitchen)
import React, { useState } from 'react';
import { useMenuAdmin, useCreateMenu, useUpdateMenu, useDeleteMenu } from '../hooks';
import { SectionCard, PageHeading } from '../components/ui';

const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const TEXTURES = ['normal', 'soft', 'minced', 'pureed', 'thickened'];
const blank = { name: '', meal_type: 'lunch', texture: 'normal' };

export default function MenuManager() {
  const { data: options = [], isLoading } = useMenuAdmin();
  const create = useCreateMenu(); const update = useUpdateMenu(); const remove = useDeleteMenu();
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(blank);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const openNew = () => { setForm(blank); setEditing('new'); };
  const openEdit = (o: any) => { setForm({ ...blank, ...o }); setEditing(o.id); };
  const save = () => { if (!form.name.trim()) return; if (editing === 'new') create.mutate(form, { onSuccess: () => setEditing(null) }); else update.mutate({ id: editing, data: form }, { onSuccess: () => setEditing(null) }); };

  const active = (options as any[]).filter(o => o.active !== false);
  const byMeal = (m: string) => active.filter(o => o.meal_type === m);
  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface)', color: 'var(--text-primary)' };
  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 };
  const mealIcon: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '☕' };

  return (
    <div style={{ padding: 4, maxWidth: 900, margin: '0 auto' }}>
      <PageHeading greeting="Menu" emoji="🍽️" subtitle="Manage the dishes residents can choose from"
        action={<button onClick={openNew} style={{ padding: '9px 16px', borderRadius: 8, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>+ Add dish</button>} />
      {isLoading && <div style={{ color: 'var(--text-muted)' }}>Loading…</div>}
      {MEALS.map(m => (
        <SectionCard key={m} title={`${mealIcon[m]} ${m.charAt(0).toUpperCase() + m.slice(1)}`}>
          {byMeal(m).length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No dishes yet.</div>}
          {byMeal(m).map((o: any) => (
            <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{o.name}{o.texture && o.texture !== 'normal' ? <span style={{ color: 'var(--danger)', fontSize: 12 }}> · {o.texture}</span> : null}</div>
              </div>
              <button onClick={() => openEdit(o)} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, cursor: 'pointer', color: 'var(--text-primary)' }}>Edit</button>
              <button onClick={() => { if (confirm(`Remove "${o.name}"?`)) remove.mutate(o.id); }} style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--danger)', background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}>Remove</button>
            </div>
          ))}
        </SectionCard>
      ))}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: 32 }}>
          <div style={{ width: '100%', maxWidth: 460, background: 'var(--surface)', borderRadius: 14, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><strong style={{ fontSize: 16 }}>{editing === 'new' ? 'Add dish' : 'Edit dish'}</strong><button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button></div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><label style={label}>Dish name</label><input style={input} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Roast chicken with vegetables" /></div>
              <div><label style={label}>Meal</label><select style={input} value={form.meal_type} onChange={e => set('meal_type', e.target.value)}>{MEALS.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
              <div><label style={label}>Texture</label><select style={input} value={form.texture} onChange={e => set('texture', e.target.value)}>{TEXTURES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={save} disabled={!form.name.trim()} style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>{editing === 'new' ? 'Add' : 'Save'}</button>
              <button onClick={() => setEditing(null)} style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'var(--surface-2)', border: '1px solid var(--border)', fontWeight: 600, cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
