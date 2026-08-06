import React, { useState } from 'react';
import { useCreateRehabGoal, useResidentRehabGoals, useAddRehabMilestone, useUpdateRehabMilestoneProgress, useLogRehabProgress, useCelebrateRehabMilestone, useRehabReport, useResidents } from '../hooks';

export default function RehabGoalTracker() {
  const [selectedResident, setSelectedResident] = useState('');
  const [activeTab, setActiveTab] = useState<'goals' | 'milestones' | 'progress' | 'report'>('goals');
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [showProgressForm, setShowProgressForm] = useState(false);

  const { data: residents } = useResidents();
  const { data: goals = [] } = useResidentRehabGoals(selectedResident);
  const { data: report } = useRehabReport(selectedResident);

  const createGoalMutation = useCreateRehabGoal();
  const addMilestoneMutation = useAddRehabMilestone();
  const updateProgressMutation = useUpdateRehabMilestoneProgress();
  const logProgressMutation = useLogRehabProgress();
  const celebrateMutation = useCelebrateRehabMilestone();

  const [goalForm, setGoalForm] = useState({ category: 'mobility', title: '', description: '', target_date: '', priority: 'medium' });
  const [milestoneForm, setMilestoneForm] = useState({ goal_id: '', title: '', description: '', target_date: '' });
  const [progressForm, setProgressForm] = useState({ goal_id: '', milestone_id: '', progress_notes: '', score: '5' });

  const residentList = Array.isArray(residents) ? residents : [];
  const goalList = Array.isArray(goals) ? goals : [];

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    createGoalMutation.mutate({ resident_id: selectedResident, ...goalForm }, {
      onSuccess: () => { setShowGoalForm(false); setGoalForm({ category: 'mobility', title: '', description: '', target_date: '', priority: 'medium' }); }
    });
  };

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    addMilestoneMutation.mutate(milestoneForm, {
      onSuccess: () => { setShowMilestoneForm(false); setMilestoneForm({ goal_id: '', title: '', description: '', target_date: '' }); }
    });
  };

  const handleLogProgress = (e: React.FormEvent) => {
    e.preventDefault();
    logProgressMutation.mutate({ goal_id: progressForm.goal_id, milestone_id: progressForm.milestone_id || undefined, resident_id: selectedResident, progress_notes: progressForm.progress_notes, score: parseInt(progressForm.score) }, {
      onSuccess: () => { setShowProgressForm(false); setProgressForm({ goal_id: '', milestone_id: '', progress_notes: '', score: '5' }); }
    });
  };

  const getStatusColor = (status: string) => {
    if (status === 'achieved') return { bg: '#dcfce7', color: '#16a34a' };
    if (status === 'active' || status === 'in_progress') return { bg: '#e0e7ff', color: '#4338ca' };
    if (status === 'paused') return { bg: '#fef3c7', color: '#d97706' };
    return { bg: '#f3f4f6', color: '#6b7280' };
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Rehabilitation Goal Tracker</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Collaborative goal setting, milestone tracking, and achievement celebrations.</p>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Select Resident</label>
        <select value={selectedResident} onChange={e => setSelectedResident(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', minWidth: 300 }}>
          <option value="">Choose a resident...</option>
          {residentList.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} - Room {r.room_number}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['goals', 'milestones', 'progress', 'report'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 500, cursor: 'pointer', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#111827' : '#6b7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'goals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Goals</h2>
            <button onClick={() => setShowGoalForm(!showGoalForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>+ New Goal</button>
          </div>
          {showGoalForm && (
            <form onSubmit={handleCreateGoal} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Category</label>
                  <select value={goalForm.category} onChange={e => setGoalForm(f => ({ ...f, category: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="mobility">Mobility</option>
                    <option value="independence">Independence</option>
                    <option value="cognitive">Cognitive</option>
                    <option value="social">Social</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Title</label>
                  <input type="text" value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="e.g. Walk 10m independently" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Target Date</label>
                  <input type="date" value={goalForm.target_date} onChange={e => setGoalForm(f => ({ ...f, target_date: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Priority</label>
                  <select value={goalForm.priority} onChange={e => setGoalForm(f => ({ ...f, priority: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Description</label>
                <input type="text" value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Create Goal</button>
            </form>
          )}
          {goalList.map((g: any) => {
            const sc = getStatusColor(g.status);
            return (
              <div key={g.id} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{g.title}</span>
                    <span style={{ marginLeft: 12, padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', background: '#e0e7ff', color: '#4338ca' }}>{g.category}</span>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', background: sc.bg, color: sc.color }}>{g.status}</span>
                </div>
                {g.description && <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 6 }}>{g.description}</div>}
                {g.target_date && <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: 4 }}>Target: {g.target_date}</div>}
                {g.milestones && Array.isArray(g.milestones) && g.milestones.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {g.milestones.map((m: any) => {
                      const msc = getStatusColor(m.status);
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid #f3f4f6' }}>
                          <span style={{ width: 18, height: 18, borderRadius: '50%', background: m.status === 'achieved' ? '#16a34a' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: '#fff' }}>{m.status === 'achieved' ? '✓' : ''}</span>
                          <span style={{ fontSize: '0.85rem', flex: 1 }}>{m.title}</span>
                          <span style={{ padding: '1px 6px', borderRadius: 10, fontSize: '0.68rem', background: msc.bg, color: msc.color }}>{m.status}</span>
                          {m.status === 'achieved' && !m.celebrated && (
                            <button onClick={() => celebrateMutation.mutate(m.id)} style={{ padding: '2px 8px', background: '#fbbf24', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.72rem' }}>🎉 Celebrate</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {goalList.length === 0 && selectedResident && <p style={{ color: '#6b7280' }}>No goals set for this resident yet.</p>}
        </div>
      )}

      {activeTab === 'milestones' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Add Milestone</h2>
            <button onClick={() => setShowMilestoneForm(!showMilestoneForm)} disabled={!selectedResident || goalList.length === 0} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident && goalList.length > 0 ? 1 : 0.5 }}>+ Add Milestone</button>
          </div>
          {showMilestoneForm && (
            <form onSubmit={handleAddMilestone} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Goal</label>
                  <select value={milestoneForm.goal_id} onChange={e => setMilestoneForm(f => ({ ...f, goal_id: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="">Select goal...</option>
                    {goalList.map((g: any) => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Milestone Title</label>
                  <input type="text" value={milestoneForm.title} onChange={e => setMilestoneForm(f => ({ ...f, title: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="e.g. Walk 5m with frame" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Target Date</label>
                  <input type="date" value={milestoneForm.target_date} onChange={e => setMilestoneForm(f => ({ ...f, target_date: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Add Milestone</button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'progress' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Log Progress</h2>
            <button onClick={() => setShowProgressForm(!showProgressForm)} disabled={!selectedResident} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer', opacity: selectedResident ? 1 : 0.5 }}>+ Log Progress</button>
          </div>
          {showProgressForm && (
            <form onSubmit={handleLogProgress} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Goal</label>
                  <select value={progressForm.goal_id} onChange={e => setProgressForm(f => ({ ...f, goal_id: e.target.value, milestone_id: '' }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="">Select a goal…</option>
                    {goalList.map((g: any) => <option key={g.id} value={g.id}>{g.title}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Milestone (optional)</label>
                  <select value={progressForm.milestone_id} onChange={e => setProgressForm(f => ({ ...f, milestone_id: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="">— none —</option>
                    {(goalList.find((g: any) => g.id === progressForm.goal_id)?.milestones || []).map((m: any) => <option key={m.id} value={m.id}>{m.title}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Score (1-10)</label>
                  <input type="number" min="1" max="10" value={progressForm.score} onChange={e => setProgressForm(f => ({ ...f, score: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Progress Notes</label>
                  <input type="text" value={progressForm.progress_notes} onChange={e => setProgressForm(f => ({ ...f, progress_notes: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Log Progress</button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'report' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Progress Report</h2>
          {report ? (
            <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                {Object.entries(report as Record<string, any>).filter(([k]) => k !== 'id' && k !== 'care_home_id' && k !== 'resident_id').map(([key, value]) => (
                  <div key={key} style={{ padding: 12, background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b' }}>
                      {value == null ? '-' : typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : typeof value === 'object' ? (Array.isArray(value) ? value.length : Object.keys(value).length) : String(value)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500, textTransform: 'capitalize', marginTop: 4 }}>{key.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : <p style={{ color: '#6b7280' }}>Select a resident to view their progress report.</p>}
        </div>
      )}
    </div>
  );
}
