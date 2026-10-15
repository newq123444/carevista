// ────────────────────────────────────────────────────────────────────────────
// Sign in.
//
// Plain and calm: the home's staff see this at 7am on a phone. Demo accounts
// appear only where the server says demo sign-in is switched on — never on a
// server holding real records.
// ────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { useLang, LanguageSwitcher } from '../i18n';
import { Icon, type IconName } from '../components/Icon';
import { Avatar } from '../components/ds';

const API = (import.meta as any).env?.VITE_API_URL || '/api';
const DEMO_ACCOUNTS: { email: string; label: string; name: string }[] = [
  { email: 'manager@demo.carevista.co.uk',     label: 'Home Manager',      name: 'Sarah Mitchell' },
  { email: 'deputy@demo.carevista.co.uk',      label: 'Deputy Manager',    name: 'James Patel' },
  { email: 'nurse@demo.carevista.co.uk',       label: 'Nurse',             name: 'Priya Sharma' },
  { email: 'senior@demo.carevista.co.uk',      label: 'Senior Carer',      name: 'Daniel Hughes' },
  { email: 'carer1@demo.carevista.co.uk',      label: 'Care Assistant',    name: 'Amara Osei' },
  { email: 'activities@demo.carevista.co.uk',  label: 'Activities',        name: 'Lisa Brown' },
  { email: 'finance@demo.carevista.co.uk',     label: 'Finance',           name: 'Karen Lloyd' },
  { email: 'cleaning@demo.carevista.co.uk',    label: 'Cleaning Staff',    name: 'Grace Williams' },
  { email: 'kitchen@demo.carevista.co.uk',     label: 'Kitchen Staff',     name: 'Marcus Johnson' },
  { email: 'maintenance@demo.carevista.co.uk', label: 'Maintenance Staff', name: 'Robert Taylor' },
];
const DEMO_PASSWORD = 'Demo1234!';

const POINTS: { icon: IconName; text: string }[] = [
  { icon: 'hand-heart', text: 'Record care in a few taps — from the round or from the person' },
  { icon: 'wifi-off', text: 'Keeps working with no signal, and sends when it’s back' },
  { icon: 'siren', text: 'Carers can flag “not themselves” to the nurse in seconds' },
  { icon: 'shield-check', text: 'Every record sealed against later alteration' },
];

export default function Login() {
  const { t: tr } = useLang();
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [demoOn, setDemoOn] = useState(false);

  useEffect(() => {
    axios.get(`${API}/auth/demo`).then(r => setDemoOn(!!r.data?.enabled)).catch(() => setDemoOn(false));
  }, []);

  const signIn = async (e: string, p: string) => {
    setLocalError(''); clearError();
    try { await login(e.trim(), p); navigate('/', { replace: true }); }
    catch (err: any) { setLocalError(err.message || tr('Sign-in failed')); }
  };
  const displayError = localError || error;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg)' }}>
      <aside className="login-left" style={{
        flex: '1 1 44%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '56px 56px',
        background: 'linear-gradient(160deg, #0f766e 0%, #115e59 55%, #134e4a 100%)', color: '#f0fdfa',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 56 }}>
          <span style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center' }}><Icon name="hand-heart" size={26} /></span>
          <span style={{ fontSize: 24, fontWeight: 750, letterSpacing: '-0.02em' }}>CareVista</span>
        </div>
        <h1 style={{ color: '#fff', fontSize: 38, lineHeight: 1.12, fontWeight: 750, letterSpacing: '-0.03em', margin: '0 0 16px', maxWidth: 460 }}>
          {tr('Care records that carers actually want to use.')}
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.6, opacity: .85, maxWidth: 440, margin: '0 0 40px' }}>
          {tr('For care homes in England: the round, the residents, medicines and care plans — on the phone in your pocket.')}
        </p>
        <div style={{ display: 'grid', gap: 14 }}>
          {POINTS.map(p => (
            <div key={p.text} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.12)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name={p.icon} size={19} /></span>
              <span style={{ fontSize: 15, opacity: .92 }}>{tr(p.text)}</span>
            </div>
          ))}
        </div>
      </aside>

      <main className="login-right" style={{ flex: '1 1 56%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 40px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 440, width: '100%', margin: '0 auto' }}>
          <div className="login-mobile-header" style={{ alignItems: 'center', gap: 10, marginBottom: 28 }}>
            <span className="cv-brand-mark" style={{ width: 42, height: 42, borderRadius: 12 }}><Icon name="hand-heart" size={22} /></span>
            <span style={{ fontSize: 22, fontWeight: 750, letterSpacing: '-0.02em' }}>CareVista</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}><LanguageSwitcher compact /></div>
          <h2 className="cv-h1" style={{ marginBottom: 6 }}>{tr('Sign in')}</h2>
          <p className="cv-sub" style={{ margin: '0 0 26px' }}>{tr('Use the email and password your manager gave you.')}</p>

          <form onSubmit={e => { e.preventDefault(); void signIn(email, password); }} style={{ display: 'grid', gap: 14 }}>
            {displayError && (
              <div role="alert" style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--red-50)', border: '1px solid var(--red-200)', color: 'var(--red-700)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 14.5 }}>
                <Icon name="triangle-alert" size={18} />{displayError}
              </div>
            )}
            <label className="form-label">{tr('Email address')}
              <input className="form-input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@yourhome.co.uk" required style={{ width: '100%', marginTop: 6, minHeight: 50, fontSize: 16 }} />
            </label>
            <label className="form-label">{tr('Password')}
              <span style={{ position: 'relative', display: 'block', marginTop: 6 }}>
                <input className="form-input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password}
                  onChange={e => setPassword(e.target.value)} required style={{ width: '100%', minHeight: 50, fontSize: 16, paddingRight: 64 }} />
                <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? tr('Hide password') : tr('Show password')}
                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: 'var(--brand-700)', cursor: 'pointer', height: 40, padding: '0 8px', fontWeight: 600, fontSize: 13.5 }}>
                  {showPassword ? tr('Hide') : tr('Show')}
                </button>
              </span>
            </label>
            <button type="submit" className="cv-btn cv-btn-primary cv-btn-lg" disabled={isLoading} style={{ marginTop: 6 }}>
              {isLoading && !activeDemo ? tr('Signing in…') : tr('Sign in')}
            </button>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--text-muted)', textAlign: 'center' }}>
              {tr('Forgotten your password? Ask your manager — they can give you a new one-time password.')}
            </p>
          </form>

          {demoOn && (
            <section style={{ marginTop: 34 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{tr('Demo — try a role')}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <div className="login-demo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {DEMO_ACCOUNTS.map(acc => (
                  <button key={acc.email} disabled={isLoading} onClick={async () => { setActiveDemo(acc.email); setEmail(acc.email); setPassword(DEMO_PASSWORD); await signIn(acc.email, DEMO_PASSWORD); setActiveDemo(null); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', minHeight: 54, opacity: isLoading && activeDemo !== acc.email ? .6 : 1 }}>
                    <Avatar name={acc.name} size={34} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 650, fontSize: 13.5, color: 'var(--text-primary)' }}>{tr(acc.label)}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeDemo === acc.email ? tr('Signing in…') : acc.name}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
                {tr('Demo data only — every resident and record here is made up.')}
              </p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
