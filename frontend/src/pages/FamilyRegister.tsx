// src/pages/FamilyRegister.tsx — public page where family redeem an invite code
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useNavigate } from 'react-router-dom';
import { familyRegisterApi } from '../services/api';
import { toast } from '../utils/toast';

export default function FamilyRegister() {
  const { t: tr } = useLang();
  const navigate = useNavigate();
  const [form, setForm] = useState({ code: '', firstName: '', lastName: '', email: '', password: '' });
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.code.trim() || form.password.length < 8) { toast.error('Enter your code and a password (min 8 characters)'); return; }
    setBusy(true);
    try { await familyRegisterApi.register(form); setDone(true); }
    catch (e: any) { toast.error(e.response?.data?.error || 'Registration failed'); }
    finally { setBusy(false); }
  };

  const input: React.CSSProperties = { width: '100%', padding: '11px 12px', border: '1px solid #dbe2e6', borderRadius: 9, fontSize: 15, marginTop: 4 };
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#475569', display: 'block', marginTop: 12 };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f8f9', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 8px 30px rgba(15,23,42,.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 30 }}>💚</div>
          <h1 style={{ fontSize: 20, margin: '6px 0 2px' }}>Join the family portal</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Enter the invite code from the care home</p>
        </div>
        {done ? (
          <div style={{ textAlign: 'center', padding: '18px 0' }}>
            <div style={{ fontSize: 30 }}>✅</div>
            <p style={{ fontSize: 15, color: '#334155' }}>Your account is ready. You can now sign in.</p>
            <button onClick={() => navigate('/login')} style={{ padding: '11px 18px', borderRadius: 9, background: '#0f766e', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Go to sign in</button>
          </div>
        ) : (
          <>
            <label style={label}>{tr('Invite code')}<input style={input} value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="e.g. A1B2C3D4E5" /></label>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ ...label, flex: 1 }}>First name<input style={input} value={form.firstName} onChange={e => set('firstName', e.target.value)} /></label>
              <label style={{ ...label, flex: 1 }}>Last name<input style={input} value={form.lastName} onChange={e => set('lastName', e.target.value)} /></label>
            </div>
            <label style={label}>Email<input style={input} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="Your email" /></label>
            <label style={label}>Choose a password<input style={input} type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 8 characters" /></label>
            <button onClick={submit} disabled={busy} style={{ width: '100%', marginTop: 18, padding: '12px', borderRadius: 9, background: '#0f766e', color: '#fff', border: 'none', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>{busy ? 'Creating…' : 'Create my account'}</button>
            <button onClick={() => navigate('/login')} style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 9, background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Already have an account? Sign in</button>
          </>
        )}
      </div>
    </div>
  );
}
