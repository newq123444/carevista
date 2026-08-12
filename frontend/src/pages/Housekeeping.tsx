// src/pages/Housekeeping.tsx — cleaner-facing housekeeping checklists
import React, { useMemo, useState } from 'react';
import { useLang } from '../i18n';
import { useAuthStore } from '../store/auth.store';
import {
  useHousekeepingTasks, useHousekeepingRooms, useHousekeepingCommunalAreas,
  useHousekeepingLogs, useSubmitHousekeeping,
} from '../hooks';

type Category = 'daily_room' | 'weekly_room' | 'quarterly_room' | 'daily_communal';

const CATEGORIES: { key: Category; label: string; icon: string; roomBased: boolean }[] = [
  { key: 'daily_room',     label: 'Daily — Resident Room',     icon: '🧹', roomBased: true },
  { key: 'weekly_room',    label: 'Weekly — Resident Room',    icon: '🧽', roomBased: true },
  { key: 'quarterly_room', label: '3-Monthly — Resident Room', icon: '🪣', roomBased: true },
  { key: 'daily_communal', label: 'Daily — Communal Areas',    icon: '🏛️', roomBased: false },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function Housekeeping() {
  const { t: tr } = useLang();
  const { user } = useAuthStore();
  const defaultInitials = `${(user as any)?.firstName?.[0] || ''}${(user as any)?.lastName?.[0] || ''}`.toUpperCase();

  const [category, setCategory] = useState<Category>('daily_room');
  const [roomNumber, setRoomNumber] = useState('');
  const [residentId, setResidentId] = useState('');
  const [communalArea, setCommunalArea] = useState('');
  const [periodDate, setPeriodDate] = useState(today());
  const [initials, setInitials] = useState(defaultInitials);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const meta = CATEGORIES.find(c => c.key === category)!;
  const { data: tasks = [] } = useHousekeepingTasks(category);
  const { data: rooms = [] } = useHousekeepingRooms();
  const { data: areas = [] } = useHousekeepingCommunalAreas();
  const submit = useSubmitHousekeeping();

  const visibleTasks = useMemo(() => {
    if (category === 'daily_communal') return tasks.filter((t: any) => t.area_label === communalArea);
    return tasks;
  }, [tasks, category, communalArea]);

  const locationChosen = meta.roomBased ? !!roomNumber : !!communalArea;
  const { data: logs = [] } = useHousekeepingLogs(
    meta.roomBased ? { category, roomNumber, periodDate } : { category, communalArea, periodDate }
  );

  const resetSelection = () => { setChecked({}); };

  const onPickRoom = (val: string) => {
    const r = rooms.find((x: any) => x.room_number === val);
    setRoomNumber(val); setResidentId(r?.resident_id || ''); resetSelection();
  };

  const toggleAll = (on: boolean) => {
    const next: Record<string, boolean> = {};
    visibleTasks.forEach((t: any) => { next[t.id] = on; });
    setChecked(next);
  };

  const handleSave = () => {
    const items = visibleTasks
      .filter((t: any) => checked[t.id])
      .map((t: any) => ({ taskId: t.id, specification: t.specification }));
    if (items.length === 0) return;
    submit.mutate(
      {
        category,
        locationType: meta.roomBased ? 'resident_room' : 'communal',
        roomNumber: meta.roomBased ? roomNumber : undefined,
        residentId: meta.roomBased ? (residentId || undefined) : undefined,
        communalArea: meta.roomBased ? undefined : communalArea,
        periodDate,
        initials: initials || undefined,
        items,
      },
      { onSuccess: () => setChecked({}) }
    );
  };

  const card: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 };
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 };
  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 };
  const checkedCount = visibleTasks.filter((t: any) => checked[t.id]).length;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>🧹 Housekeeping Checklists</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Record cleaning against rooms and communal areas.</p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => { setCategory(c.key); resetSelection(); }}
            style={{
              padding: '10px 14px', borderRadius: 10, border: '1px solid ' + (category === c.key ? '#14b8a6' : '#d1d5db'),
              background: category === c.key ? '#14b8a6' : '#fff', color: category === c.key ? '#fff' : '#374151',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>
          <div>
            {meta.roomBased ? (
              <>
                <label style={label}>{tr('Room')}</label>
                <select style={input} value={roomNumber} onChange={e => onPickRoom(e.target.value)}>
                  <option value="">Select a room…</option>
                  {rooms.map((r: any) => (
                    <option key={r.resident_id} value={r.room_number}>Room {r.room_number} — {r.resident_name}</option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label style={label}>Communal area</label>
                <select style={input} value={communalArea} onChange={e => { setCommunalArea(e.target.value); resetSelection(); }}>
                  <option value="">Select an area…</option>
                  {areas.map((a: string) => <option key={a} value={a}>{a}</option>)}
                </select>
              </>
            )}
          </div>
          <div>
            <label style={label}>Date</label>
            <input type="date" style={input} value={periodDate} onChange={e => setPeriodDate(e.target.value)} />
          </div>
          <div>
            <label style={label}>Initials</label>
            <input style={input} value={initials} maxLength={10} onChange={e => setInitials(e.target.value.toUpperCase())} placeholder="e.g. RT" />
          </div>
        </div>
      </div>

      {locationChosen ? (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <strong>{meta.label}{!meta.roomBased && communalArea ? ` — ${communalArea}` : roomNumber ? ` — Room ${roomNumber}` : ''}</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => toggleAll(true)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}>Select all</button>
              <button onClick={() => toggleAll(false)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer' }}>Clear</button>
            </div>
          </div>
          {visibleTasks.length === 0 && <p style={{ color: '#9ca3af' }}>No tasks configured.</p>}
          {visibleTasks.map((t: any) => (
            <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!checked[t.id]} onChange={e => setChecked(prev => ({ ...prev, [t.id]: e.target.checked }))} style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 14, color: '#374151' }}>{t.specification}</span>
            </label>
          ))}
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#6b7280', fontSize: 13 }}>{checkedCount} of {visibleTasks.length} selected</span>
            <button
              onClick={handleSave}
              disabled={checkedCount === 0 || submit.isPending}
              style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: checkedCount === 0 ? '#9ca3af' : '#14b8a6', color: '#fff', fontWeight: 600, cursor: checkedCount === 0 ? 'not-allowed' : 'pointer' }}
            >
              {submit.isPending ? 'Saving…' : `Save ${checkedCount} task${checkedCount === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ ...card, color: '#9ca3af', textAlign: 'center' }}>Select a {meta.roomBased ? 'room' : 'communal area'} to begin.</div>
      )}

      {locationChosen && (
        <div style={card}>
          <strong style={{ display: 'block', marginBottom: 10 }}>Recorded on {periodDate}</strong>
          {logs.length === 0 && <p style={{ color: '#9ca3af', fontSize: 14 }}>Nothing recorded yet.</p>}
          {logs.map((l: any) => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
              <span>✅ {l.specification}</span>
              <span style={{ color: '#6b7280' }}>{l.initials || l.completed_by_name} · {new Date(l.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
