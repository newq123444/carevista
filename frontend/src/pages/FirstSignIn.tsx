// ────────────────────────────────────────────────────────────────────────────
// FirstSignIn — shown instead of the app when a manager-issued one-time
// password is still in force.
//
// This is a full-screen block, not a dismissible prompt. Until the person picks
// their own password, their manager knows how to sign in as them — and anything
// recorded under their name would not truthfully be theirs. A care record has
// to be attributable, so the app will not let them past this screen.
// ────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../store/auth.store';
import toast from 'react-hot-toast';

export default function FirstSignIn() {
  const { user, logout, passwordChanged } = useAuthStore();
  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [again, setAgain]     = useState('');
  const [busy, setBusy]       = useState(false);

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = again.length > 0 && next !== again;
  const sameAsOld = next.length > 0 && next === current;
  const ready = next.length >= 8 && next === again && !sameAsOld && current.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      passwordChanged();
      toast.success('Password changed. Welcome to CareVista.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Could not change your password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0f172a', padding: 20,
    }}>
      <form onSubmit={submit} style={{
        width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16, padding: 32,
        display: 'grid', gap: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Choose your own password</h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#475569' }}>
            Hello {user?.firstName}. You signed in with a password your manager gave you. Please
            pick one only you know — everything you record is signed with your name.
          </p>
        </div>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>The password you were given</span>
          <input className="form-input" type="password" autoComplete="current-password"
                 value={current} onChange={e => setCurrent(e.target.value)} required />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Your new password</span>
          <input className="form-input" type="password" autoComplete="new-password"
                 value={next} onChange={e => setNext(e.target.value)} required />
          {tooShort && <span style={{ fontSize: 12, color: '#b91c1c' }}>At least 8 characters.</span>}
          {sameAsOld && <span style={{ fontSize: 12, color: '#b91c1c' }}>This has to be different from the one you were given.</span>}
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Type it again</span>
          <input className="form-input" type="password" autoComplete="new-password"
                 value={again} onChange={e => setAgain(e.target.value)} required />
          {mismatch && <span style={{ fontSize: 12, color: '#b91c1c' }}>These two do not match.</span>}
        </label>

        <button className="btn btn-primary" type="submit" disabled={!ready || busy}>
          {busy ? 'Saving…' : 'Save and carry on'}
        </button>
        <button type="button" onClick={() => logout()}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
          Sign out instead
        </button>
      </form>
    </div>
  );
}
