// src/components/ui/index.tsx — CareVista world-class design components.
// Clean cards, calm metrics, meaningful colour, generous whitespace.
import React from 'react';

const CARD: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 };

export function MetricCard({ label, value, sub, subTone = 'muted', icon }: {
  label: string; value: React.ReactNode; sub?: string; subTone?: 'muted' | 'success' | 'warning' | 'danger' | 'accent'; icon?: string;
}) {
  const toneColor = { muted: 'var(--text-muted)', success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)', accent: 'var(--primary)' }[subTone];
  return (
    <div style={{ ...CARD, padding: '15px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: 13, marginBottom: 7 }}>
        {icon && <span aria-hidden style={{ fontSize: 15 }}>{icon}</span>}{label}
      </div>
      <div style={{ fontSize: 25, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: toneColor, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function SectionCard({ title, action, children, pad = true }: {
  title?: string; action?: React.ReactNode; children: React.ReactNode; pad?: boolean;
}) {
  return (
    <div style={{ ...CARD, padding: pad ? '16px 20px' : 0, marginBottom: 16 }}>
      {title && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <strong style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</strong>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

const TONES: Record<string, { bg: string; fg: string }> = {
  danger: { bg: 'var(--danger-light)', fg: 'var(--danger)' },
  warning: { bg: 'var(--warning-light)', fg: 'var(--warning)' },
  success: { bg: 'var(--success-light)', fg: 'var(--success)' },
  accent: { bg: 'var(--primary-light)', fg: 'var(--primary)' },
  neutral: { bg: 'var(--surface-2)', fg: 'var(--text-secondary)' },
};

export function ListRow({ icon, tone = 'neutral', title, meta, chip }: {
  icon: string; tone?: keyof typeof TONES | string; title: React.ReactNode; meta?: React.ReactNode; chip?: { label: string; tone?: string };
}) {
  const t = TONES[tone] || TONES.neutral;
  const ct = chip ? (TONES[chip.tone || 'neutral'] || TONES.neutral) : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span aria-hidden style={{ fontSize: 15 }}>{icon}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{title}</div>
        {meta && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{meta}</div>}
      </div>
      {chip && ct && <span style={{ fontSize: 11, color: ct.fg, background: ct.bg, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>{chip.label}</span>}
    </div>
  );
}

export function ProgressStat({ icon, label, value, pct, color = 'var(--primary)' }: {
  icon: string; label: string; value: React.ReactNode; pct?: number; color?: string;
}) {
  return (
    <div style={{ padding: '9px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden style={{ fontSize: 17, color: 'var(--text-secondary)' }}>{icon}</span>
        <span style={{ flex: 1, fontSize: 14, color: 'var(--text-primary)' }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</span>
      </div>
      {typeof pct === 'number' && (
        <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 20, overflow: 'hidden', marginTop: 8 }}>
          <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color }} />
        </div>
      )}
    </div>
  );
}

export function PageHeading({ greeting, subtitle, emoji, action }: {
  greeting: string; subtitle?: string; emoji?: string; action?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{emoji ? `${emoji} ` : ''}{greeting}</h1>
        {subtitle && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
