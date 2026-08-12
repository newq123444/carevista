// src/pages/VisitorSignIn.tsx
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useVisitors, useSignInVisitor, useSignOutVisitor, useVisitorDashboard, useVisitorFireRoll, useVisitorSafeguarding, useAddVisitorSafeguarding, useResidents } from '../hooks';

type TabType = 'current' | 'sign-in' | 'history' | 'fire-roll' | 'safeguarding';

export default function VisitorSignIn() {
  const { t: tr } = useLang();
  const [tab, setTab] = useState<TabType>('current');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFireRoll, setShowFireRoll] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);

  const { data: dashboard } = useVisitorDashboard();
  const { data: visitors = [] } = useVisitors();
  const { data: fireRoll = [] } = useVisitorFireRoll();
  const { data: safeguarding = [] } = useVisitorSafeguarding();
  const { data: residents = [] } = useResidents();
  const signIn = useSignInVisitor();
  const signOut = useSignOutVisitor();
  const addFlag = useAddVisitorSafeguarding();

  const dash = dashboard || {} as any;
  const visitorsToday = dash.visitors_today ?? 0;
  const currentlySignedIn = dash.currently_signed_in ?? 0;
  const avgDaily = dash.avg_daily_visitors ?? 0;
  const flaggedCount = dash.safeguarding_flags ?? 0;

  // Sign-in form
  const [signInForm, setSignInForm] = useState({
    visitor_name: '', visitor_type: 'family', company: '', visiting_resident_id: '', purpose: '', car_registration: '', badge_number: ''
  });

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    signIn.mutate({
      visitor_name: signInForm.visitor_name,
      visitor_type: signInForm.visitor_type,
      visitor_company: signInForm.company || undefined,
      visiting_resident_id: signInForm.visiting_resident_id || undefined,
      purpose: signInForm.purpose || undefined,
      car_registration: signInForm.car_registration || undefined,
      badge_number: signInForm.badge_number || undefined,
    }, { onSuccess: () => { setSignInForm({ visitor_name: '', visitor_type: 'family', company: '', visiting_resident_id: '', purpose: '', car_registration: '', badge_number: '' }); setTab('current'); } });
  };

  const handleSignOut = (id: string) => { signOut.mutate(id); };

  // Safeguarding form
  const [flagForm, setFlagForm] = useState({ visitor_name: '', flag_type: 'alert', reason: '', resident_id: '' });
  const handleAddFlag = (e: React.FormEvent) => {
    e.preventDefault();
    addFlag.mutate({
      visitor_name: flagForm.visitor_name,
      flag_type: flagForm.flag_type,
      reason: flagForm.reason || undefined,
      resident_id: flagForm.resident_id || undefined,
    }, { onSuccess: () => { setShowFlagForm(false); setFlagForm({ visitor_name: '', flag_type: 'alert', reason: '', resident_id: '' }); } });
  };

  // Filter visitors
  const currentVisitors = (visitors as any[]).filter((v: any) => !v.sign_out_time);
  const allVisitors = (visitors as any[]);
  const filteredHistory = searchTerm
    ? allVisitors.filter((v: any) => v.visitor_name?.toLowerCase().includes(searchTerm.toLowerCase()) || v.visiting_resident_name?.toLowerCase().includes(searchTerm.toLowerCase()))
    : allVisitors;
  const contractors = allVisitors.filter((v: any) => v.visitor_type === 'contractor' || v.visitor_company);

  const flagBadge = (type: string) => {
    if (type === 'banned') return 'badge-danger';
    if (type === 'supervised_only') return 'badge-warning';
    if (type === 'dbs_required') return 'badge-primary';
    return 'badge-neutral';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Visitor Sign-In System</h1>
          <p className="page-subtitle">Digital registration, fire roll, and safeguarding management</p>
        </div>
        <button className="btn btn-primary" style={{ background: '#dc2626', borderColor: '#dc2626' }} onClick={() => setShowFireRoll(!showFireRoll)}>
          🚨 Fire Roll
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Visitors Today', value: String(visitorsToday), icon: '👥', color: '#0d9488' },
          { label: 'Currently Signed In', value: String(currentlySignedIn), icon: '🟢', color: '#16a34a' },
          { label: 'Avg Daily Visitors', value: String(avgDaily), icon: '📊', color: '#7c3aed' },
          { label: 'Safeguarding Flags', value: String(flaggedCount), icon: '🚩', color: '#dc2626' },
        ].map(k => (
          <div key={k.label} style={{ padding: '16px', borderRadius: 12, background: 'white', border: '1px solid var(--border)', borderLeft: `4px solid ${k.color}`, boxShadow: '0 2px 6px rgba(0,0,0,.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontWeight: 500 }}>{k.label}</div>
              </div>
              <span style={{ fontSize: 22 }}>{k.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Fire Roll Modal */}
      {showFireRoll && (
        <div className="card" style={{ marginBottom: 20, border: '2px solid #dc2626' }}>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#dc2626' }}>🚨 FIRE ROLL - Currently Signed-In Visitors</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowFireRoll(false)}>{tr('Close')}</button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>Print-friendly evacuation list of all visitors currently on site</p>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Visitor Name</th><th>Company</th><th>Visiting</th><th>Badge #</th><th>Sign In Time</th></tr>
                </thead>
                <tbody>
                  {(fireRoll as any[]).length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No visitors currently signed in</td></tr>
                  ) : (fireRoll as any[]).map((v: any) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{v.visitor_name}</td>
                      <td>{v.visitor_company || '-'}</td>
                      <td>{v.visiting_resident_name || '-'}</td>
                      <td>{v.badge_number || '-'}</td>
                      <td>{v.sign_in_time?.slice(11, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {([['current', 'Currently Here'], ['sign-in', 'Sign In'], ['history', 'Visit History'], ['safeguarding', 'Safeguarding']] as [TabType, string][]).map(([t, label]) => (
            <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setTab(t)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Current Visitors Tab */}
      {tab === 'current' && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>Currently Signed In ({currentVisitors.length})</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>{tr('Visitor')}</th><th>{tr('Type')}</th><th>Visiting</th><th>{tr('Purpose')}</th><th>Sign In</th><th>{tr('Actions')}</th></tr>
                </thead>
                <tbody>
                  {currentVisitors.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No visitors currently signed in</td></tr>
                  ) : currentVisitors.map((v: any) => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 600 }}>{v.visitor_name}</td>
                      <td><span className="badge badge-neutral">{v.visitor_type || 'visitor'}</span></td>
                      <td>{v.visiting_resident_name || '-'}</td>
                      <td>{v.purpose || '-'}</td>
                      <td>{v.sign_in_time?.slice(11, 16)}</td>
                      <td><button className="btn btn-secondary btn-sm" onClick={() => handleSignOut(v.id)}>Sign Out</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sign-In Form Tab */}
      {tab === 'sign-in' && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>Sign In Visitor</h3>
            <form onSubmit={handleSignIn}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Visitor Name *</label>
                  <input type="text" value={signInForm.visitor_name} onChange={e => setSignInForm({ ...signInForm, visitor_name: e.target.value })} placeholder="Full name" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{tr('Type')}</label>
                  <select value={signInForm.visitor_type} onChange={e => setSignInForm({ ...signInForm, visitor_type: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <option value="family">{tr('Family')}</option>
                    <option value="friend">Friend</option>
                    <option value="contractor">Contractor</option>
                    <option value="professional">Professional</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Company</label>
                  <input type="text" value={signInForm.company} onChange={e => setSignInForm({ ...signInForm, company: e.target.value })} placeholder="Company name (if applicable)" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Visiting Resident</label>
                  <select value={signInForm.visiting_resident_id} onChange={e => setSignInForm({ ...signInForm, visiting_resident_id: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <option value="">Select resident...</option>
                    {(residents as any[]).map((r: any) => (
                      <option key={r.id} value={r.id}>{r.first_name} {r.last_name} (Room {r.room_number})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{tr('Purpose')}</label>
                  <input type="text" value={signInForm.purpose} onChange={e => setSignInForm({ ...signInForm, purpose: e.target.value })} placeholder="Purpose of visit" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Car Registration</label>
                  <input type="text" value={signInForm.car_registration} onChange={e => setSignInForm({ ...signInForm, car_registration: e.target.value })} placeholder="e.g. AB12 CDE" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Badge Number</label>
                  <input type="text" value={signInForm.badge_number} onChange={e => setSignInForm({ ...signInForm, badge_number: e.target.value })} placeholder="Visitor badge #" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button type="submit" className="btn btn-primary" disabled={signIn.isPending}>Sign In Visitor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visit History Tab */}
      {tab === 'history' && (
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Visit History</h3>
              <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by visitor or resident..." style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)', width: 260 }} />
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>{tr('Date')}</th><th>{tr('Visitor')}</th><th>{tr('Type')}</th><th>Visiting</th><th>{tr('Purpose')}</th><th>Duration</th></tr>
                </thead>
                <tbody>
                  {filteredHistory.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No visit history</td></tr>
                  ) : filteredHistory.slice(0, 50).map((v: any) => {
                    const duration = v.sign_out_time && v.sign_in_time
                      ? `${Math.round((new Date(v.sign_out_time).getTime() - new Date(v.sign_in_time).getTime()) / 60000)} min`
                      : 'Still here';
                    return (
                      <tr key={v.id}>
                        <td>{v.sign_in_time?.slice(0, 10)}</td>
                        <td style={{ fontWeight: 500 }}>{v.visitor_name}</td>
                        <td><span className="badge badge-neutral">{v.visitor_type || 'visitor'}</span></td>
                        <td>{v.visiting_resident_name || '-'}</td>
                        <td>{v.purpose || '-'}</td>
                        <td>{duration}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Contractor section */}
            {contractors.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 8 }}>Contractors</h4>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr><th>Name</th><th>Company</th><th>DBS</th><th>Last Visit</th></tr>
                    </thead>
                    <tbody>
                      {contractors.slice(0, 20).map((v: any) => (
                        <tr key={v.id}>
                          <td>{v.visitor_name}</td>
                          <td>{v.visitor_company || '-'}</td>
                          <td>{v.dbs_checked ? <span className="badge badge-success">Verified</span> : <span className="badge badge-warning">Unverified</span>}</td>
                          <td>{v.sign_in_time?.slice(0, 10)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Safeguarding Tab */}
      {tab === 'safeguarding' && (
        <div className="card">
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Safeguarding Flags</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowFlagForm(!showFlagForm)}>+ Add Flag</button>
            </div>

            {showFlagForm && (
              <form onSubmit={handleAddFlag} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Visitor Name *</label>
                    <input type="text" value={flagForm.visitor_name} onChange={e => setFlagForm({ ...flagForm, visitor_name: e.target.value })} placeholder="Visitor name" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} required />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Restriction Type</label>
                    <select value={flagForm.flag_type} onChange={e => setFlagForm({ ...flagForm, flag_type: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <option value="alert">Alert</option>
                      <option value="banned">Banned</option>
                      <option value="supervised_only">Supervised Only</option>
                      <option value="dbs_required">DBS Required</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Reason</label>
                    <input type="text" value={flagForm.reason} onChange={e => setFlagForm({ ...flagForm, reason: e.target.value })} placeholder="Reason for flag" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Related Resident</label>
                    <select value={flagForm.resident_id} onChange={e => setFlagForm({ ...flagForm, resident_id: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <option value="">All residents</option>
                      {(residents as any[]).map((r: any) => (
                        <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={addFlag.isPending}>Add Flag</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowFlagForm(false)}>{tr('Cancel')}</button>
                </div>
              </form>
            )}

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>{tr('Visitor')}</th><th>Restriction</th><th>Reason</th><th>Related Resident</th><th>Flagged By</th><th>{tr('Date')}</th></tr>
                </thead>
                <tbody>
                  {(safeguarding as any[]).length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No safeguarding flags</td></tr>
                  ) : (safeguarding as any[]).map((f: any) => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 600 }}>{f.visitor_name}</td>
                      <td><span className={`badge ${flagBadge(f.flag_type)}`}>{f.flag_type?.replace(/_/g, ' ')}</span></td>
                      <td>{f.reason || '-'}</td>
                      <td>{f.resident_name || 'All'}</td>
                      <td>{f.flagged_by_name || '-'}</td>
                      <td>{f.created_at?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
