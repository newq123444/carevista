import React, { useState } from 'react';
import { useLang } from '../i18n';
import { RecordView } from '../components/ui';
import { usePurposeRoles, useCreatePurposeRole, useAssignPurposeRole, useResidentPurposeRoles, useLogPurposeEngagement, usePurposeReport, usePurposeSuggestions, useResidents } from '../hooks';

export default function DailyPurposePlanner() {
  const { t } = useLang();
  const [selectedResident, setSelectedResident] = useState('');
  const [activeTab, setActiveTab] = useState<'roles' | 'assign' | 'engagement' | 'suggestions'>('roles');
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showEngagementForm, setShowEngagementForm] = useState(false);

  const { data: residents } = useResidents();
  const { data: roles = [] } = usePurposeRoles();
  const { data: residentRoles = [] } = useResidentPurposeRoles(selectedResident);
  const { data: report } = usePurposeReport();
  const { data: suggestions } = usePurposeSuggestions(selectedResident);

  const createRoleMutation = useCreatePurposeRole();
  const assignRoleMutation = useAssignPurposeRole();
  const logEngagementMutation = useLogPurposeEngagement();

  const [roleForm, setRoleForm] = useState({ name: '', description: '', category: '' });
  const [assignForm, setAssignForm] = useState({ role_id: '', notes: '' });
  const [engagementForm, setEngagementForm] = useState({ assignment_id: '', engagement_level: 'medium', satisfaction_score: '7', duration_minutes: '30', notes: '' });

  const residentList = Array.isArray(residents) ? residents : [];
  const roleList = Array.isArray(roles) ? roles : [];
  const residentRoleList = Array.isArray(residentRoles) ? residentRoles : [];
  const suggestionList = Array.isArray(suggestions) ? suggestions : [];

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    createRoleMutation.mutate(roleForm, {
      onSuccess: () => { setShowRoleForm(false); setRoleForm({ name: '', description: '', category: '' }); }
    });
  };

  const handleAssignRole = (e: React.FormEvent) => {
    e.preventDefault();
    assignRoleMutation.mutate({ resident_id: selectedResident, role_id: assignForm.role_id, notes: assignForm.notes }, {
      onSuccess: () => { setShowAssignForm(false); setAssignForm({ role_id: '', notes: '' }); }
    });
  };

  const handleLogEngagement = (e: React.FormEvent) => {
    e.preventDefault();
    logEngagementMutation.mutate({ assignment_id: engagementForm.assignment_id, resident_id: selectedResident, engagement_level: engagementForm.engagement_level, satisfaction_score: parseInt(engagementForm.satisfaction_score), duration_minutes: parseInt(engagementForm.duration_minutes), notes: engagementForm.notes }, {
      onSuccess: () => { setShowEngagementForm(false); setEngagementForm({ assignment_id: '', engagement_level: 'medium', satisfaction_score: '7', duration_minutes: '30', notes: '' }); }
    });
  };

  const roleIcons: Record<string, string> = { 'watering plants': '🌱', 'folding napkins': '🧻', 'greeting visitors': '👋', 'sorting mail': '📬', 'feeding fish': '🐟' };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Daily Purpose Planner</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Assign meaningful roles and track engagement and satisfaction.</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Select Resident</label>
        <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', minWidth: 300 }}>
          <option value="">Choose a resident...</option>
          {residentList.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['roles', 'assign', 'engagement', 'suggestions'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 500, cursor: 'pointer', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#111827' : '#6b7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {tab === 'assign' ? 'Assignments' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'roles' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Role Library</h2>
            <button onClick={() => setShowRoleForm(!showRoleForm)} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>+ Create Role</button>
          </div>
          {showRoleForm && (
            <form onSubmit={handleCreateRole} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Role Name</label>
                  <input type="text" value={roleForm.name} onChange={e => setRoleForm(f => ({ ...f, name: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="e.g. Watering plants" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Category</label>
                  <input type="text" value={roleForm.category} onChange={e => setRoleForm(f => ({ ...f, category: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="e.g. gardening" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{t('Description')}</label>
                  <input type="text" value={roleForm.description} onChange={e => setRoleForm(f => ({ ...f, description: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Create</button>
            </form>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {roleList.map((r: any) => (
              <div key={r.id} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>{roleIcons[r.name?.toLowerCase()] || '🎯'}</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{r.name}</div>
                {r.description && <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>{r.description}</div>}
                {r.category && <span style={{ display: 'inline-block', marginTop: 8, fontSize: '0.72rem', padding: '2px 8px', background: '#e0e7ff', borderRadius: 12, color: '#4338ca' }}>{r.category}</span>}
              </div>
            ))}
          </div>
          {roleList.length === 0 && <p style={{ color: '#6b7280' }}>No roles created yet. Add some above.</p>}
        </div>
      )}

      {activeTab === 'assign' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Role Assignments</h2>
            <button onClick={() => setShowAssignForm(!showAssignForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>+ Assign Role</button>
          </div>
          {showAssignForm && (
            <form onSubmit={handleAssignRole} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{t('Role')}</label>
                  <select value={assignForm.role_id} onChange={e => setAssignForm(f => ({ ...f, role_id: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="">Select role...</option>
                    {roleList.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{t('Notes')}</label>
                  <input type="text" value={assignForm.notes} onChange={e => setAssignForm(f => ({ ...f, notes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Assign</button>
            </form>
          )}
          {residentRoleList.map((a: any) => (
            <div key={a.id} style={{ padding: 14, background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 600 }}>{a.role_name || 'Role'}</span>
                <span style={{ marginLeft: 12, padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', background: a.status === 'active' ? '#dcfce7' : '#f3f4f6', color: a.status === 'active' ? '#16a34a' : '#6b7280' }}>{a.status}</span>
              </div>
              <span style={{ fontSize: '0.82rem', color: '#6b7280' }}>Since {a.start_date}</span>
            </div>
          ))}
          {residentRoleList.length === 0 && selectedResident && <p style={{ color: '#6b7280' }}>No roles assigned to this resident yet.</p>}
        </div>
      )}

      {activeTab === 'engagement' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Log Engagement</h2>
            <button onClick={() => setShowEngagementForm(!showEngagementForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>+ Log</button>
          </div>
          {showEngagementForm && (
            <form onSubmit={handleLogEngagement} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Assignment</label>
                  <select value={engagementForm.assignment_id} onChange={e => setEngagementForm(f => ({ ...f, assignment_id: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="">Select...</option>
                    {residentRoleList.map((a: any) => <option key={a.id} value={a.id}>{a.role_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Engagement</label>
                  <select value={engagementForm.engagement_level} onChange={e => setEngagementForm(f => ({ ...f, engagement_level: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="high">{t('High')}</option>
                    <option value="medium">{t('Medium')}</option>
                    <option value="low">{t('Low')}</option>
                    <option value="refused">{t('Refused')}</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Satisfaction (1-10)</label>
                  <input type="number" min="1" max="10" value={engagementForm.satisfaction_score} onChange={e => setEngagementForm(f => ({ ...f, satisfaction_score: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Duration (min)</label>
                  <input type="number" value={engagementForm.duration_minutes} onChange={e => setEngagementForm(f => ({ ...f, duration_minutes: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Log Engagement</button>
            </form>
          )}
          {report ? (
            <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>Engagement Report</h3>
              <RecordView data={report} empty="No purpose report yet — assign roles and log engagement to build one." />
            </div>
          ) : <p style={{ color: '#6b7280' }}>Log some engagement data to see the report.</p>}
        </div>
      )}

      {activeTab === 'suggestions' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Role Suggestions</h2>
          {suggestionList.length > 0 ? (
            suggestionList.map((s: any, i: number) => (
              <div key={i} style={{ padding: 14, background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', marginBottom: 8 }}>
                <div style={{ fontWeight: 500 }}>{s.name || s.suggestion || `Suggestion ${i + 1}`}</div>
                {s.reason && <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 4 }}>{s.reason}</div>}
              </div>
            ))
          ) : <p style={{ color: '#6b7280' }}>Select a resident to see role suggestions based on their interests and past engagement.</p>}
        </div>
      )}
    </div>
  );
}
