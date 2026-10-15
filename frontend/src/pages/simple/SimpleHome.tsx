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
import { PrnFollowups } from '../../components/PrnFollowups';
import { useLang, LOCALE } from '../../i18n';
import { Icon, type IconName } from '../../components/Icon';

export default function SimpleHome() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const { t: tr, tf, lang } = useLang();
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
      <h1 className="cv-h1" style={{ fontSize: 26, margin: '0 0 2px' }}>
        {tr(greeting)}, {user?.firstName}
      </h1>
      <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
        {new Date().toLocaleDateString(LOCALE[lang] || 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {/* The one thing they came here to do. */}
      <button onClick={() => nav('/round')} style={{
        width: '100%', minHeight: 132, borderRadius: 20, border: 'none', cursor: 'pointer',
        background: 'var(--brand)', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 6, boxShadow: 'var(--shadow-lg)', marginBottom: 12,
      }}>
        <Icon name="hand-heart" size={38} />
        <span style={{ fontSize: 21, fontWeight: 700 }}>{tr('Start my round')}</span>
        <span style={{ fontSize: 15.5, opacity: .9 }}>
          {isLoading ? tr('loading…')
            : dueNow > 0 ? tf('{n} to do now', { n: dueNow })
            : laterCount > 0 ? tf('nothing due — {n} later this shift', { n: laterCount })
            : tr('nothing waiting')}
        </span>
      </button>

      {/* The other way in: start from the person you're with. */}
      <button onClick={() => nav('/record')} style={{
        width: '100%', minHeight: 72, borderRadius: 18, cursor: 'pointer', marginBottom: 14,
        background: 'var(--surface)', border: '1.5px solid var(--brand)', color: 'var(--brand-700)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 18, fontWeight: 700,
      }}>
        <Icon name="users" size={24} />{tr('Record care for someone')}
      </button>

      {earlier > 0 && (
        <button onClick={() => nav('/round')} style={{
          width: '100%', minHeight: 64, marginBottom: 14, borderRadius: 14, cursor: 'pointer',
          border: '1.5px solid #fcd34d', background: '#fffbeb', color: '#92400e',
          fontSize: 16, fontWeight: 600, textAlign: 'left', padding: '0 16px',
        }}>
          <Icon name="triangle-alert" size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />{tf(earlier === 1 ? '{n} earlier task this shift not recorded' : '{n} earlier tasks this shift not recorded', { n: earlier })}
        </button>
      )}

      {/* Only once a check is due — a list of "not yet" is noise on this screen. */}
      <PrnFollowups onlyActionable />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <Stat value={done} label={tr("done this shift")} tone="#16a34a" />
        <Stat value={flagged} label={tr("left with a note")} tone="#d97706" />
      </div>

      <Door icon="siren" title={tr("Something's not right")} sub={tr('Someone seems different — tell the nurses')} onClick={() => nav('/something-different')} />
      <Door icon="users" title={tr('Residents')} sub={tr('Look someone up')} onClick={() => nav('/residents')} />
      <Door icon="notebook-pen" title={tr('Write a note')} sub={tr('Something worth recording')} onClick={() => nav('/care-notes')} />
      <Door icon="history" title={tr('Handover')} sub={tr('What the last shift left')} onClick={() => nav('/shift')} />

      <p style={{
        fontSize: 13.5, color: 'var(--text-secondary)', textAlign: 'center',
        marginTop: 22, lineHeight: 1.5,
      }}>
        {tr('Everything else is still there — switch to the full view from the menu.')}
      </p>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
      padding: '16px 14px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: tone, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 14.5, color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}

function Door({ icon, title, sub, onClick }: { icon: IconName; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', minHeight: 78, marginBottom: 10, cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 15, textAlign: 'left',
      padding: '0 16px', borderRadius: 16, background: 'var(--surface)', color: 'var(--text-primary)',
      border: '1px solid var(--border)',
    }}>
      <span style={{ width: 46, height: 46, borderRadius: 13, display: 'grid', placeItems: 'center', flexShrink: 0,
        background: icon === 'siren' ? 'var(--red-50)' : 'var(--brand-50)', color: icon === 'siren' ? 'var(--red-700)' : 'var(--brand-700)' }}>
        <Icon name={icon} size={24} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 18, fontWeight: 600 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 14.5, color: 'var(--text-secondary)' }}>{sub}</span>
      </span>
      <Icon name="chevron-right" size={22} style={{ color: 'var(--text-muted)' }} />
    </button>
  );
}
