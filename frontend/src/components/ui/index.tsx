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

// ── RecordView ────────────────────────────────────────────────────────────
// Renders an arbitrary API/DB record as a readable, human-labelled grid
// instead of dumping raw column names. Formats dates, booleans, numbers,
// arrays and nested objects, and hides internal/empty fields.
const HIDDEN_KEYS = new Set([
  'id', 'care_home_id', 'resident_id', 'programme_id', 'created_at', 'updated_at',
  'deleted_at', 'created_by', 'updated_by', 'logged_by', 'observed_by', 'user_id',
]);

const ACRONYMS: Record<string, string> = { cqc: 'CQC', nhs: 'NHS', gp: 'GP', bmi: 'BMI', must: 'MUST', dnacpr: 'DNACPR', ai: 'AI', id: 'ID' };

export function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\bpct\b/gi, '%')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(w => ACRONYMS[w.toLowerCase()] || (w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T|$)/;

export function formatValue(value: any): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(1);
  if (Array.isArray(value)) return value.length ? value.map(v => (typeof v === 'object' ? Object.values(v).join(' ') : String(v))).join(', ') : '—';
  if (typeof value === 'object') {
    const parts = Object.entries(value)
      .filter(([k]) => !HIDDEN_KEYS.has(k))
      .map(([k, v]) => `${humanizeKey(k)}: ${formatValue(v)}`);
    return parts.length ? parts.join(' · ') : '—';
  }
  const s = String(value);
  if (ISO_DATE.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return s.length <= 10
        ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  }
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(s)) return humanizeKey(s);
  return s;
}

export function RecordView({ data, empty = 'Nothing recorded yet.', columns = 3 }: {
  data: any; empty?: string; columns?: number;
}) {
  if (!data || typeof data !== 'object') {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{empty}</div>;
  }
  const entries = Object.entries(data).filter(([k, v]) =>
    !HIDDEN_KEYS.has(k) && v != null && v !== '' && !(Array.isArray(v) && v.length === 0));
  if (entries.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{empty}</div>;
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(140, Math.floor(600 / columns))}px, 1fr))`, gap: 12 }}>
      {entries.map(([key, value]) => (
        <div key={key} style={{ padding: '10px 12px', background: 'var(--surface-2, #f8fafc)', borderRadius: 8, border: '1px solid var(--border, #e5e7eb)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted, #6b7280)', fontWeight: 600, marginBottom: 3 }}>{humanizeKey(key)}</div>
          <div style={{ fontSize: 14, color: 'var(--text-primary, #1e293b)', fontWeight: 600, wordBreak: 'break-word' }}>{formatValue(value)}</div>
        </div>
      ))}
    </div>
  );
}
