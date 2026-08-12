// src/pages/Login.tsx — God-Mode Login: unified portal for all roles
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useLang, LanguageSwitcher } from '../i18n';

const DEMO_ACCOUNTS = [
  { email: 'manager@demo.carevista.co.uk',   label: 'Home Manager',     icon: '🏠', color: '#7c3aed', role: 'home_manager',      name: 'Sarah Mitchell' },
  { email: 'deputy@demo.carevista.co.uk',    label: 'Deputy Manager',   icon: '📋', color: '#0d9488', role: 'deputy_manager',    name: 'James Patel' },
  { email: 'nurse@demo.carevista.co.uk',     label: 'Nurse',            icon: '🩺', color: '#0891b2', role: 'registered_nurse',  name: 'Priya Sharma' },
  { email: 'senior@demo.carevista.co.uk',    label: 'Senior Carer',     icon: '⭐', color: '#059669', role: 'senior_carer',      name: 'Daniel Hughes' },
  { email: 'carer1@demo.carevista.co.uk',    label: 'Care Assistant',   icon: '❤️', color: '#d97706', role: 'carer',             name: 'Amara Osei' },
  { email: 'activities@demo.carevista.co.uk',label: 'Activities',       icon: '🎨', color: '#ec4899', role: 'activities',        name: 'Lisa Brown' },
  { email: 'finance@demo.carevista.co.uk',   label: 'Finance',          icon: '💷', color: '#dc2626', role: 'finance',           name: 'Karen Lloyd' },
  { email: 'cleaning@demo.carevista.co.uk', label: 'Cleaning Staff',   icon: '🧹', color: '#14b8a6', role: 'cleaning',          name: 'Grace Williams' },
  { email: 'kitchen@demo.carevista.co.uk',  label: 'Kitchen Staff',    icon: '👨‍🍳', color: '#f97316', role: 'kitchen',           name: 'Marcus Johnson' },
  { email: 'maintenance@demo.carevista.co.uk', label: 'Maintenance Staff', icon: '🔧', color: '#64748b', role: 'maintenance',    name: 'Robert Taylor' },
];
const DEMO_PASSWORD = 'Demo1234!';

export default function Login() {
  const { t: tr } = useLang();
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setLocalError(err.message || 'Login failed');
    }
  };

  const handleDemoLogin = async (acc: typeof DEMO_ACCOUNTS[0]) => {
    setActiveDemo(acc.email);
    setLocalError('');
    clearError();
    setEmail(acc.email);
    setPassword(DEMO_PASSWORD);
    try {
      await login(acc.email, DEMO_PASSWORD);
      navigate('/', { replace: true });
    } catch (err: any) {
      setLocalError(err.message || 'Demo login failed');
    } finally {
      setActiveDemo(null);
    }
  };

  const displayError = localError || error;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      background: 'linear-gradient(135deg, #0f1623 0%, #1a2640 50%, #0f1623 100%)',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Left panel – branding */}
      <div className="login-left" style={{
        flex: '1 1 45%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 48px',
        borderRight: '1px solid rgba(255,255,255,.06)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, boxShadow: '0 0 32px rgba(99,102,241,.4)',
          }}>⚕</div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>CareVista</div>
            <div style={{ fontSize: 12, color: '#4a5a7a', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 600 }}>{tr('Care Home Management')}</div>
          </div>
        </div>

        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 38, fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: 16, letterSpacing: '-1px' }}>
            One platform.<br />
            <span style={{ background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Every role.</span>
          </h1>
          <p style={{ fontSize: 16, color: '#6b7a9a', lineHeight: 1.7, maxWidth: 380 }}>
            A unified, intelligent care home management system designed for UK care providers — from carers to managers to nurses.
          </p>
        </div>

        {/* Feature highlights */}
        {[
          { icon: '⚡', text: 'Real-time care notes & handover board' },
          { icon: '💊', text: 'Digital eMAR with administration tracking' },
          { icon: '🤖', text: 'AI-powered risk assessment & summaries' },
          { icon: '✅', text: 'CQC compliance monitoring built-in' },
        ].map(f => (
          <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
            }}>{f.icon}</div>
            <span style={{ fontSize: 14, color: '#8a9ab8' }}>{f.text}</span>
          </div>
        ))}

        <div style={{ marginTop: 48, padding: '16px 20px', borderRadius: 12, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
          <div style={{ fontSize: 12, color: '#4a5a7a', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>🔒 Demo Environment</div>
          <div style={{ fontSize: 13, color: '#6b7a9a' }}>All data is simulated. Password for all accounts: <span style={{ color: '#93c5fd', fontFamily: 'monospace', fontWeight: 700 }}>Demo1234!</span></div>
        </div>
      </div>

      {/* Right panel – login form */}
      <div className="login-right" style={{
        flex: '1 1 55%', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px 48px', overflowY: 'auto',
      }}>
        <div style={{ maxWidth: 520, width: '100%', margin: '0 auto' }}>
          {/* Mobile header - visible only when left panel is hidden */}
          <div className="login-mobile-header">
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, boxShadow: '0 0 20px rgba(99,102,241,.3)',
            }}>⚕</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>CareVista</div>
              <div style={{ fontSize: 10, color: '#4a5a7a', letterSpacing: '.08em', textTransform: 'uppercase' }}>{tr('Care Home Management')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><LanguageSwitcher compact /></div>
          <h2 style={{ fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{tr('Sign in')}</h2>
          <p style={{ fontSize: 14, color: '#4a5a7a', marginBottom: 32 }}>Enter your credentials or pick a demo account below</p>

          {/* Login form */}
          <form onSubmit={handleSubmit} style={{ marginBottom: 32 }}>
            {displayError && (
              <div style={{
                padding: '12px 16px', borderRadius: 10, marginBottom: 16,
                background: '#2d1515', border: '1px solid #7f1d1d',
                color: '#fca5a5', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                ⚠️ {displayError}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#8a9ab8', marginBottom: 6 }}>{tr('Email address')}</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@carehome.co.uk" required
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 10,
                  background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
                  color: '#fff', fontSize: 15, outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#8a9ab8', marginBottom: 6 }}>{tr('Password')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{
                    width: '100%', padding: '12px 44px 12px 16px', borderRadius: 10,
                    background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)',
                    color: '#fff', fontSize: 15, outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,.1)'}
                />
                <button
                  type="button" onClick={() => setShowPassword(s => !s)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#6b7a9a', cursor: 'pointer', fontSize: 16,
                  }}
                >{showPassword ? '🙈' : '👁'}</button>
              </div>
            </div>

            <button
              type="submit" disabled={isLoading}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                background: isLoading ? '#0d9488' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 20px rgba(99,102,241,.4)',
                transition: 'opacity 150ms',
              }}
            >
              {isLoading ? '⏳ Signing in…' : '→ Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.07)' }} />
            <span style={{ fontSize: 12, color: '#3a4a5e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>{tr('Quick Demo Login')}</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.07)' }} />
          </div>

          {/* Demo account cards */}
          <div className="login-demo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            {DEMO_ACCOUNTS.map(acc => (
              <button
                key={acc.email}
                onClick={() => handleDemoLogin(acc)}
                disabled={isLoading}
                style={{
                  padding: '12px 14px', borderRadius: 12, border: `1px solid ${acc.color}30`,
                  background: activeDemo === acc.email ? acc.color + '25' : acc.color + '10',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'all 150ms', textAlign: 'left',
                  opacity: isLoading && activeDemo !== acc.email ? 0.6 : 1,
                  boxShadow: activeDemo === acc.email ? `0 0 16px ${acc.color}30` : 'none',
                }}
                onMouseEnter={e => {
                  if (!isLoading) {
                    (e.currentTarget as HTMLElement).style.borderColor = acc.color + '60';
                    (e.currentTarget as HTMLElement).style.background = acc.color + '20';
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = acc.color + '30';
                  (e.currentTarget as HTMLElement).style.background = activeDemo === acc.email ? acc.color + '25' : acc.color + '10';
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: acc.color + '20', border: `1px solid ${acc.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>{acc.icon}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: acc.color }}>{acc.label}</div>
                  <div style={{ fontSize: 11, color: '#4a5a7a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeDemo === acc.email ? '⏳ Signing in…' : acc.name}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <p style={{ marginTop: 24, fontSize: 12, color: '#2a3a52', textAlign: 'center' }}>
            🔒 CareVista is GDPR compliant · Data encrypted at rest and in transit
          </p>
        </div>
      </div>
    </div>
  );
}
