// ────────────────────────────────────────────────────────────────────────────
// Building blocks for CareVista screens (v87 design system). The look lives in
// design-system.css; these keep the markup consistent so every screen uses the
// same header, card, badge, avatar and empty state.
// ────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Icon, type IconName } from './Icon';

// Calm, distinguishable colours for initials, chosen by name so the same
// person always gets the same colour. All pass 4.5:1 against white text.
const AVATAR_COLOURS = ['#0f766e', '#6d28d9', '#c2410c', '#0369a1', '#be123c', '#4d7c0f', '#a16207', '#4338ca', '#0e7490', '#9d174d'];
export function avatarColour(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}
export function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
}

const API_ORIGIN = ((import.meta as any).env?.VITE_API_URL || '').replace(/\/api\/?$/, '');
/** Uploaded photos are stored as /uploads/… on the API server. */
export function photoSrc(url?: string | null): string | null {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function Avatar({ name, photo, size = 40, className = '' }: { name: string; photo?: string | null; size?: number; className?: string }) {
  const src = photoSrc(photo);
  const [broken, setBroken] = React.useState(false);
  return (
    <span className={`cv-avatar ${className}`} aria-hidden
      style={{ width: size, height: size, background: avatarColour(name), fontSize: Math.round(size * 0.36) }}>
      {src && !broken ? <img src={src} alt="" onError={() => setBroken(true)} /> : initials(name)}
    </span>
  );
}

export type Tone = 'red' | 'amber' | 'green' | 'blue' | 'grey' | 'brand';
export function Badge({ tone = 'grey', icon, children, title }: { tone?: Tone; icon?: IconName; children: React.ReactNode; title?: string }) {
  return <span className={`cv-badge cv-badge-${tone}`} title={title}>{icon && <Icon name={icon} size={13} />}{children}</span>;
}

export function PageHead({ eyebrow, title, sub, actions }: { eyebrow?: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="cv-page-head">
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="cv-eyebrow">{eyebrow}</div>}
        <h1 className="cv-h1">{title}</h1>
        {sub && <p className="cv-sub">{sub}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

export function Empty({ icon = 'info', title, children, action }: { icon?: IconName; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="cv-empty">
      <div className="cv-empty-icon"><Icon name={icon} size={26} /></div>
      <h3>{title}</h3>
      {children && <div style={{ maxWidth: 440, margin: '0 auto', lineHeight: 1.55 }}>{children}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { key: T; label: string; icon?: IconName; count?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="cv-tabs" role="tablist">
      {tabs.map(t => (
        <button key={t.key} role="tab" aria-selected={value === t.key} className={`cv-tab${value === t.key ? ' active' : ''}`} onClick={() => onChange(t.key)}>
          {t.icon && <Icon name={t.icon} size={17} />}{t.label}
          {t.count != null && t.count > 0 && <span className="cv-badge cv-badge-red" style={{ height: 20 }}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, note, icon, tone }: { label: string; value: React.ReactNode; note?: React.ReactNode; icon?: IconName; tone?: 'red' | 'amber' | 'green' }) {
  const colour = tone === 'red' ? 'var(--red-700)' : tone === 'amber' ? 'var(--amber-700)' : tone === 'green' ? 'var(--green-700)' : undefined;
  return (
    <div className="cv-stat">
      <div className="cv-stat-label">{icon && <Icon name={icon} size={15} />}{label}</div>
      <div className="cv-stat-value" style={{ color: colour }}>{value}</div>
      {note && <div className="cv-stat-note">{note}</div>}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="cv-search">
      <Icon name="search" size={18} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}
