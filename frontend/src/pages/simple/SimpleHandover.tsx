// ────────────────────────────────────────────────────────────────────────────
// Simple handover.
//
// Handover is the moment care is most often lost. The full SBAR screen is right
// for a nurse writing one; this is for a carer arriving on shift who needs to
// know, in thirty seconds, what happened and who to watch.
//
// Built entirely from records already made today — nothing here is generated,
// inferred or summarised by anything clever. If it says a task was left, a
// person left it and said why.
// ────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useShiftTasks } from '../../hooks/useShiftTasks';
import { useLang, LOCALE } from '../../i18n';

export default function SimpleHandover() {
  const nav = useNavigate();
  const { t: tr, tf, lang } = useLang();
  // Built from the same shift logic as the round: what this shift has done,
  // what it left with a reason, what is still to come — and anything the
  // previous shift did not record, which is what handover exists to catch.
  const { round, all, doneThisShift, isLoading } = useShiftTasks();
  const deferred = all.filter((t: any) => t.status === 'deferred');
  const pending = [...round.earlier, ...round.now, ...round.later];
  const done = { length: doneThisShift };
  const lastShiftMissed = round.previousShift;

  // Group what was left by resident: a carer thinks in people, not tasks.
  const byResident = new Map<string, any[]>();
  for (const t of deferred) {
    const key = t.resident_name || 'Someone';
    const list = byResident.get(key);
    if (list) list.push(t); else byResident.set(key, [t]);
  }

  return (
    <div style={{ padding: '18px 14px calc(24px + env(safe-area-inset-bottom))', maxWidth: 560, margin: '0 auto' }}>
      <button onClick={() => nav('/')} style={{
        border: 'none', background: 'none', fontSize: 16, cursor: 'pointer',
        color: 'var(--text-secondary)', padding: '8px 0', minHeight: 44,
      }}>← {tr('Back')}</button>

      <h1 style={{ fontSize: 25, margin: '4px 0 4px' }}>{tr('Handover')}</h1>
      <p style={{ fontSize: 15.5, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        {tr(round.shift.name === 'day' ? 'Day shift' : 'Night shift')}, {round.shift.start.toLocaleDateString(LOCALE[lang] || 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {isLoading ? <p style={{ fontSize: 17 }}>{tr('Loading…')}</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 22 }}>
            <Tally value={done.length} label={tr("done")} tone="#16a34a" />
            <Tally value={deferred.length} label={tr("left")} tone="#d97706" />
            <Tally value={pending.length} label={tr("waiting")} tone="#64748b" />
          </div>

          {lastShiftMissed.length > 0 && (
            <Section title={tr("Not recorded by the last shift")} empty="">
              <p style={{ fontSize: 14.5, color: '#92400e', margin: '0 0 10px', lineHeight: 1.5 }}>
                {tr('These were due before this shift started and nothing was recorded. Check with whoever was on before assuming they were not done.')}
              </p>
              {lastShiftMissed.slice(0, 15).map((t: any) => (
                <Row key={t.id} icon={t.icon} main={t.resident_name}
                     sub={`${tr(t.task_name)}${t.due_time ? ` · ${String(t.due_time).slice(0, 5)}` : ''}`} />
              ))}
            </Section>
          )}

          <Section title={tr("Needs picking up")} empty={tr("Nothing was left with a note.")}>
            {[...byResident.entries()].map(([name, tasks]) => (
              <div key={name} style={{
                background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 14,
                padding: '14px 16px', marginBottom: 10,
              }}>
                <div style={{ fontSize: 17.5, fontWeight: 700, marginBottom: 6 }}>{name}</div>
                {tasks.map((t: any) => (
                  <div key={t.id} style={{ fontSize: 15.5, lineHeight: 1.5, marginBottom: 3 }}>
                    <span style={{ marginRight: 6 }}>{t.icon || '•'}</span>
                    {tr(t.task_name)}
                    {t.deferred_reason && (
                      <span style={{ color: '#92400e' }}> — {tr(t.deferred_reason)}</span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </Section>

          <Section title={tr("Still to do this shift")} empty={tr("Nothing outstanding this shift.")}>
            {pending.slice(0, 12).map((t: any) => (
              <Row key={t.id} icon={t.icon} main={t.resident_name}
                   sub={`${tr(t.task_name)}${t.due_time ? ` · ${String(t.due_time).slice(0, 5)}` : ''}`} />
            ))}
            {pending.length > 12 && (
              <p style={{ fontSize: 14.5, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
                {tf('and {n} more', { n: pending.length - 12 })}
              </p>
            )}
          </Section>

          <button onClick={() => nav('/round')} style={{
            width: '100%', minHeight: 68, borderRadius: 16, border: 'none', cursor: 'pointer',
            background: '#4f46e5', color: '#fff', fontSize: 18, fontWeight: 700, marginTop: 8,
          }}>
            {tr('Start my round')}
          </button>
        </>
      )}
    </div>
  );
}

function Tally({ value, label, tone }: any) {
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border)', borderRadius: 14,
      padding: '13px 8px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 27, fontWeight: 800, color: tone, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

function Section({ title, empty, children }: any) {
  const has = React.Children.toArray(children).some(Boolean) &&
              React.Children.toArray(children).flat().length > 0;
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 18.5, margin: '0 0 10px' }}>{title}</h2>
      {has ? children : (
        <p style={{ fontSize: 15.5, color: 'var(--text-secondary)', margin: 0 }}>{empty}</p>
      )}
    </div>
  );
}

function Row({ icon, main, sub }: any) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 13, padding: '11px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 23 }}>{icon || '•'}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 16.5, fontWeight: 600 }}>{main}</span>
        <span style={{ display: 'block', fontSize: 14.5, color: 'var(--text-secondary)' }}>{sub}</span>
      </span>
    </div>
  );
}
