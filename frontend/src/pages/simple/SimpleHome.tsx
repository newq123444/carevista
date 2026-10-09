// ────────────────────────────────────────────────────────────────────────────
// Simple home.
//
// The full dashboard shows a carer eleven cards, four charts and a nav menu of
// thirty items, almost none of which they can act on. This shows the three
// things a carer actually needs at the start of a shift, at a size that can be
// read at arm's length in a corridor.
//
// Everything on this screen is either a number they need or a door they can
// walk through. Nothing here is decoration.
// ────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useShiftTasks } from '../../hooks/useShiftTasks';
import { useAuthStore } from '../../store/auth.store';

export default function SimpleHome() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  // Same source as the round itself, so "3 to do now" here is exactly the
  // number of cards a carer will find when they tap through.
  const { round, all, doneThisShift, isLoading } = useShiftTasks();
  const dueNow = round.now.length;
  const earlier = round.earlier.length;
  const laterCount = round.later.length;
  const done = doneThisShift;
  const flagged = all.filter((t: any) => t.status === 'deferred').length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div style={{ padding: '18px 14px calc(24px + env(safe-area-inset-bottom))', maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ fontSize: 26, margin: '0 0 2px', lineHeight: 1.2 }}>
        {greeting}, {user?.firstName}
      </h1>
      <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {/* The one thing they came here to do. */}
      <button onClick={() => nav('/round')} style={{
        width: '100%', minHeight: 132, borderRadius: 20, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg,#4f46e5,#4338ca)', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 4, boxShadow: '0 8px 22px rgba(79,70,229,.32)', marginBottom: 14,
      }}>
        <span style={{ fontSize: 40, lineHeight: 1 }}>👐</span>
        <span style={{ fontSize: 21, fontWeight: 700 }}>Start my round</span>
        <span style={{ fontSize: 15.5, opacity: .9 }}>
          {isLoading ? 'loading…'
            : dueNow > 0 ? `${dueNow} to do now`
            : laterCount > 0 ? `nothing due — ${laterCount} later this shift`
            : 'nothing waiting'}
        </span>
      </button>

      {earlier > 0 && (
        <button onClick={() => nav('/round')} style={{
          width: '100%', minHeight: 64, marginBottom: 14, borderRadius: 14, cursor: 'pointer',
          border: '1.5px solid #fcd34d', background: '#fffbeb', color: '#92400e',
          fontSize: 16, fontWeight: 600, textAlign: 'left', padding: '0 16px',
        }}>
          ⚠ {earlier} earlier {earlier === 1 ? 'task' : 'tasks'} this shift not recorded
        </button>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <Stat value={done} label="done this shift" tone="#16a34a" />
        <Stat value={flagged} label="left with a note" tone="#d97706" />
      </div>

      <Door icon="🧑‍🤝‍🧑" title="Residents" sub="Look someone up" onClick={() => nav('/residents')} />
      <Door icon="📝" title="Write a note" sub="Something worth recording" onClick={() => nav('/care-notes')} />
      <Door icon="🔄" title="Handover" sub="What the last shift left" onClick={() => nav('/shift')} />

      <p style={{
        fontSize: 13.5, color: 'var(--text-secondary)', textAlign: 'center',
        marginTop: 22, lineHeight: 1.5,
      }}>
        Everything else is still there — switch to the full view from the menu.
      </p>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border)', borderRadius: 16,
      padding: '16px 14px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: tone, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 14.5, color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

function Door({ icon, title, sub, onClick }: any) {
  return (
    <button onClick={onClick} style={{
      width: '100%', minHeight: 78, marginBottom: 10, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 15, textAlign: 'left',
      padding: '0 18px', borderRadius: 16, background: '#fff',
      border: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 30 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 18, fontWeight: 600 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 14.5, color: 'var(--text-secondary)' }}>{sub}</span>
      </span>
      <span style={{ fontSize: 22, color: '#cbd5e1' }}>›</span>
    </button>
  );
}
