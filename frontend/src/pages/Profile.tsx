import React, { useState } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useNavigate } from 'react-router-dom';
import { ROLE_LABELS } from '../utils/formatters';

const ROLE_COLORS: Record<string, string> = {
  home_manager: '#7c3aed', deputy_manager: '#0d9488', registered_nurse: '#0891b2',
  senior_carer: '#059669', carer: '#d97706', activities: '#ec4899',
  finance: '#dc2626', admin: '#6366f1', super_admin: '#0f766e', group_admin: '#0f766e',
};

export default function Profile() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const rc = ROLE_COLORS[user?.role || ''] || '#0d9488';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: `linear-gradient(135deg, ${rc}, ${rc}aa)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, color: 'white', marginBottom: 14, boxShadow: `0 0 24px ${rc}50` }}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, marginBottom: 6 }}>{user?.firstName} {user?.lastName}</div>
          <div style={{ padding: '5px 14px', borderRadius: 20, background: rc + '20', color: rc, fontWeight: 700, fontSize: 13, border: `1px solid ${rc}40` }}>{ROLE_LABELS[user?.role || ''] || user?.role}</div>
        </div>
        <div className="card-body">
          {[['📧 Email', user?.email], ['🏠 Care Home', user?.careHomeName], ['🔑 Role', ROLE_LABELS[user?.role || ''] || user?.role], ['🆔 User ID', user?.id]].map(([k, v]) => (
            <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
              <span style={{ color: 'var(--text-muted)' }}>{k}</span>
              <span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Account Actions</h3>
          {!showLogout ? (
            <button onClick={() => setShowLogout(true)} style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              🚪 Sign Out
            </button>
          ) : (
            <div style={{ padding: 16, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
              <p style={{ fontSize: 14, color: '#991b1b', marginBottom: 14, textAlign: 'center' }}>Are you sure you want to sign out?</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowLogout(false)} className="btn btn-ghost" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleLogout} className="btn btn-danger" style={{ flex: 1 }}>Yes, Sign Out</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
