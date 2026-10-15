// ────────────────────────────────────────────────────────────────────────────
// "Something's not right."
//
// The carer who helps someone wash every morning is the first to notice they
// are not themselves. This gets that noticing to a nurse in under a minute:
// who, what you've seen, have you told someone. Three taps and a send.
//
// The order is deliberate. Emergency signs come first and, if any is ticked,
// the screen says CALL 999 before it asks for anything else. Nothing here may
// ever stand between a carer and an ambulance.
// ────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useResidents, useRaiseDeterioration } from '../../hooks';
import { useLang } from '../../i18n';
import { EMERGENCY_SIGNS, SOFT_SIGNS, EMERGENCY_KEYS, type Sign } from '../../constants/softSigns';

export default function SomethingDifferent() {
  const { t: tr } = useLang();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { data: residents } = useResidents();
  const raise = useRaiseDeterioration();

  const [residentId, setResidentId] = useState(params.get('resident') || '');
  const [search, setSearch] = useState('');
  const [signs, setSigns] = useState<string[]>([]);
  const [otherText, setOtherText] = useState('');
  const [note, setNote] = useState('');
  const [told, setTold] = useState<boolean | null>(null);
  const [sent, setSent] = useState(false);

  const list: any[] = Array.isArray(residents) ? residents : [];
  const resident = list.find(r => r.id === residentId);
  const emergency = signs.some(s => EMERGENCY_KEYS.has(s));
  const toggle = (k: string) => setSigns(s => (s.includes(k) ? s.filter(x => x !== k) : [...s, k]));
  const canSend = !!residentId && signs.length > 0 && told !== null
    && (!signs.includes('other') || otherText.trim().length >= 3) && !raise.isPending;

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter(r => !q || `${r.first_name} ${r.last_name} ${r.room_number || ''}`.toLowerCase().includes(q));
  }, [list, search]);

  if (sent) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '24px 6px' }}>
          <div style={{ fontSize: 56 }}>📨</div>
          <h1 style={{ fontSize: 24, margin: '8px 0' }}>{tr('Sent to the nurses')}</h1>
          {told ? (
            <p style={{ fontSize: 17, lineHeight: 1.5 }}>{tr('Thank you. Stay with them if you are worried, and keep an eye on any change.')}</p>
          ) : (
            <p style={{ fontSize: 18, lineHeight: 1.5, fontWeight: 700, color: '#b91c1c' }}>
              {tr('Now go and tell the nurse or senior in person. A message can be missed.')}
            </p>
          )}
          <Emergency999 compact />
          <BigButton onClick={() => nav('/')} tone="#4f46e5">{tr('Done')}</BigButton>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 style={{ fontSize: 24, margin: '0 0 4px' }}>{tr("Something's not right")}</h1>
      <p style={{ fontSize: 16, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.45 }}>
        {tr('You know them best. If they seem different, say so — it is always right to ask.')}
      </p>

      {/* 1. Who */}
      <Step n={1} title={tr('Who is it?')}>
        {resident ? (
          <button onClick={() => setResidentId('')} style={{ ...chip(true), minHeight: 64 }}>
            {resident.first_name} {resident.last_name}{resident.room_number ? ` · ${tr('Room')} ${resident.room_number}` : ''}  ✕
          </button>
        ) : (
          <>
            <input className="form-input" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={tr('Name or room…')} style={{ width: '100%', minHeight: 56, fontSize: 17, marginBottom: 8 }} />
            <div style={{ display: 'grid', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {shown.slice(0, 40).map(r => (
                <button key={r.id} onClick={() => setResidentId(r.id)} style={{ ...chip(false), textAlign: 'left', minHeight: 64 }}>
                  {r.first_name} {r.last_name}{r.room_number ? ` · ${tr('Room')} ${r.room_number}` : ''}
                </button>
              ))}
            </div>
          </>
        )}
      </Step>

      {/* 2. What — emergencies first */}
      <Step n={2} title={tr('What have you noticed?')}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: '#b91c1c', margin: '0 0 6px' }}>{tr('Emergency — call 999 first')}</div>
        <SignGrid signs={EMERGENCY_SIGNS} selected={signs} onToggle={toggle} danger />
        {emergency && <Emergency999 />}
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-secondary)', margin: '14px 0 6px' }}>{tr('Changes from their usual self')}</div>
        <SignGrid signs={SOFT_SIGNS} selected={signs} onToggle={toggle} />
        {signs.includes('other') && (
          <input className="form-input" value={otherText} onChange={e => setOtherText(e.target.value)}
            placeholder={tr('What else have you noticed?')} style={{ width: '100%', minHeight: 56, fontSize: 17, marginTop: 8 }} />
        )}
      </Step>

      {/* 3. Told someone? */}
      <Step n={3} title={tr('Have you told the nurse or senior in person?')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => setTold(true)} style={{ ...chip(told === true), minHeight: 64 }}>{tr('Yes')}</button>
          <button onClick={() => setTold(false)} style={{ ...chip(told === false), minHeight: 64 }}>{tr('Not yet')}</button>
        </div>
        {told === false && (
          <p style={{ margin: '8px 0 0', fontSize: 15.5, color: '#b91c1c', fontWeight: 600, lineHeight: 1.45 }}>
            {tr('Send this, then tell them in person straight away. This message does not replace telling someone.')}
          </p>
        )}
      </Step>

      <Step n={4} title={tr('Anything else? (optional)')}>
        <textarea className="form-input" rows={2} value={note} onChange={e => setNote(e.target.value)}
          placeholder={tr('e.g. Usually chatty at breakfast, today would not open her eyes')}
          style={{ width: '100%', fontSize: 17 }} />
      </Step>

      <BigButton disabled={!canSend} tone={emergency ? '#b91c1c' : '#4f46e5'}
        onClick={() => raise.mutate(
          { residentId, signs, otherText: otherText.trim() || undefined, note: note.trim() || undefined, toldInPerson: told === true },
          { onSuccess: () => setSent(true) })}>
        {raise.isPending ? tr('Sending…') : tr('Send to the nurses')}
      </BigButton>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '18px 14px calc(28px + env(safe-area-inset-bottom))', maxWidth: 560, margin: '0 auto' }}>{children}</div>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>
        <span style={{ display: 'inline-block', width: 28, height: 28, borderRadius: '50%', background: '#eef2ff', color: '#3730a3', textAlign: 'center', lineHeight: '28px', fontSize: 15, marginRight: 8 }}>{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function SignGrid({ signs, selected, onToggle, danger }: { signs: Sign[]; selected: string[]; onToggle: (k: string) => void; danger?: boolean }) {
  const { t: tr } = useLang();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 8 }}>
      {signs.map(s => {
        const on = selected.includes(s.key);
        const c = danger ? '#b91c1c' : '#4f46e5';
        return (
          <button key={s.key} onClick={() => onToggle(s.key)} aria-pressed={on} style={{
            minHeight: 72, padding: '8px 10px', borderRadius: 14, cursor: 'pointer', textAlign: 'left',
            display: 'flex', gap: 8, alignItems: 'center', fontSize: 15, lineHeight: 1.3,
            border: `2px solid ${on ? c : danger ? '#fecaca' : 'var(--border)'}`,
            background: on ? (danger ? '#fef2f2' : '#eef2ff') : '#fff', color: on ? c : 'var(--text-primary, #111827)',
            fontWeight: on ? 700 : 500,
          }}>
            <span style={{ fontSize: 24 }} aria-hidden>{s.icon}</span>
            <span>{tr(s.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

function Emergency999({ compact }: { compact?: boolean }) {
  const { t: tr } = useLang();
  return (
    <div role="alert" style={{
      margin: compact ? '16px 0' : '10px 0 4px', padding: compact ? 12 : 16, borderRadius: 14,
      background: '#b91c1c', color: '#fff', textAlign: 'left',
    }}>
      <div style={{ fontSize: compact ? 16 : 22, fontWeight: 800 }}>📞 {compact ? tr('If it becomes an emergency: call 999') : tr('Call 999 now')}</div>
      {!compact && (
        <div style={{ fontSize: 16, marginTop: 4, lineHeight: 1.45 }}>
          {tr('Then get the nurse. Follow their care plan and any DNACPR or advance care plan. Finish this form afterwards.')}
        </div>
      )}
    </div>
  );
}

function BigButton({ children, onClick, disabled, tone }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; tone: string }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', minHeight: 64, borderRadius: 16, border: 'none', fontSize: 18, fontWeight: 700,
      background: disabled ? '#c7d2fe' : tone, color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', marginTop: 6,
    }}>{children}</button>
  );
}

function chip(on: boolean): React.CSSProperties {
  return {
    minHeight: 64, padding: '0 14px', borderRadius: 14, cursor: 'pointer', fontSize: 16.5, width: '100%',
    border: `2px solid ${on ? '#4f46e5' : 'var(--border)'}`, background: on ? '#eef2ff' : '#fff',
    color: on ? '#3730a3' : 'var(--text-primary, #111827)', fontWeight: on ? 700 : 500,
  };
}
