import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useUpcomingCelebrations, useCreateCelebration, useAssignCelebrationTask, useCompleteCelebrationTask, useCelebrationCalendar, useNotifyCelebrationFamily, useResidents } from '../hooks';

export default function CelebrationPlanner() {
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'plan' | 'tasks' | 'calendar'>('upcoming');
  const [showForm, setShowForm] = useState(false);
  const [selectedCelebration, setSelectedCelebration] = useState('');

  const { data: residents } = useResidents();
  const { data: upcoming = [] } = useUpcomingCelebrations();
  const { data: calendar = [] } = useCelebrationCalendar();

  const createMutation = useCreateCelebration();
  const assignTaskMutation = useAssignCelebrationTask();
  const completeTaskMutation = useCompleteCelebrationTask();
  const notifyFamilyMutation = useNotifyCelebrationFamily();

  const [form, setForm] = useState({ resident_id: '', celebration_type: 'birthday', title: '', description: '', celebration_date: '', budget: '' });

  const residentList = Array.isArray(residents) ? residents : [];
  const upcomingList = Array.isArray(upcoming) ? upcoming : [];
  const calendarList = Array.isArray(calendar) ? calendar : [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(form, {
      onSuccess: () => { setShowForm(false); setForm({ resident_id: '', celebration_type: 'birthday', title: '', description: '', celebration_date: '', budget: '' }); }
    });
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = { birthday: '🎂', admission_anniversary: '🏠', religious_festival: '🙏', achievement: '🏆', other: '🎉' };
    return icons[type] || '🎉';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      birthday: { bg: '#fce7f3', color: '#be185d' },
      admission_anniversary: { bg: '#e0e7ff', color: '#4338ca' },
      religious_festival: { bg: '#fef3c7', color: '#d97706' },
      achievement: { bg: '#dcfce7', color: '#16a34a' },
      other: { bg: '#f3f4f6', color: '#6b7280' },
    };
    return colors[type] || colors.other;
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: 4 }}>Celebration Planner</h1>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>Auto-detect birthdays and anniversaries, plan celebrations, and assign tasks.</p>

      <div style={{ display: 'flex', gap: 4, padding: 4, background: '#f3f4f6', borderRadius: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {(['upcoming', 'plan', 'tasks', 'calendar'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 500, cursor: 'pointer', background: activeTab === tab ? '#fff' : 'transparent', color: activeTab === tab ? '#111827' : '#6b7280', boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '0.85rem', textTransform: 'capitalize' }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'upcoming' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Upcoming Celebrations</h2>
          {upcomingList.map((c: any) => {
            const tc = getTypeColor(c.celebration_type);
            return (
              <div key={c.id} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 8, cursor: 'pointer' }} onClick={() => setSelectedCelebration(c.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '1.5rem' }}>{getTypeIcon(c.celebration_type)}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{c.title}</div>
                      <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>{c.resident_name || 'General'} - {c.celebration_date}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', background: tc.bg, color: tc.color }}>{c.celebration_type?.replace('_', ' ')}</span>
                    {(
                      <button onClick={(e) => { e.stopPropagation(); notifyFamilyMutation.mutate(c.id); }} style={{ padding: '4px 10px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 4, fontSize: '0.72rem', cursor: 'pointer' }}>Notify Family</button>
                    )}
                  </div>
                </div>
                {c.description && <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 8 }}>{c.description}</div>}
              </div>
            );
          })}
          {upcomingList.length === 0 && <p style={{ color: '#6b7280' }}>No upcoming celebrations detected.</p>}
        </div>
      )}

      {activeTab === 'plan' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Plan Celebration</h2>
            <button onClick={() => setShowForm(!showForm)} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>+ New Celebration</button>
          </div>
          {showForm && (
            <form onSubmit={handleCreate} style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{t('Resident')}</label>
                  <select value={form.resident_id} onChange={e => setForm(f => ({ ...f, resident_id: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="">General (no specific resident)</option>
                    {residentList.map((r: any) => <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{t('Type')}</label>
                  <select value={form.celebration_type} onChange={e => setForm(f => ({ ...f, celebration_type: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }}>
                    <option value="birthday">{t('Birthday')}</option>
                    <option value="admission_anniversary">Admission Anniversary</option>
                    <option value="religious_festival">Religious Festival</option>
                    <option value="achievement">Achievement</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>Title</label>
                  <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{t('Date')}</label>
                  <input type="date" value={form.celebration_date} onChange={e => setForm(f => ({ ...f, celebration_date: e.target.value }))} required style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{t('Description')}</label>
                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: 4 }}>{t('Budget')}</label>
                <input type="text" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} placeholder="e.g. 50.00" />
              </div>
              <button type="submit" style={{ padding: '8px 20px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Plan Celebration</button>
            </form>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Celebration Tasks</h2>
          {selectedCelebration ? (
            <div style={{ padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 12 }}>Assign a new task for the selected celebration.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" placeholder="Task title..." id="taskTitle" style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6 }} />
                <button onClick={() => {
                  const input = document.getElementById('taskTitle') as HTMLInputElement;
                  if (input?.value) { assignTaskMutation.mutate({ celebrationId: selectedCelebration, title: input.value }); input.value = ''; }
                }} style={{ padding: '8px 16px', background: '#0d9488', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Assign Task</button>
              </div>
            </div>
          ) : <p style={{ color: '#6b7280' }}>Select a celebration from the Upcoming tab to manage tasks.</p>}
        </div>
      )}

      {activeTab === 'calendar' && (
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16 }}>Celebration Calendar</h2>
          {calendarList.length > 0 ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {calendarList.map((c: any, i: number) => {
                const tc = getTypeColor(c.celebration_type);
                return (
                  <div key={i} style={{ padding: 12, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 50, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase' }}>{c.celebration_date ? new Date(c.celebration_date).toLocaleDateString('en', { month: 'short' }) : ''}</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{c.celebration_date ? new Date(c.celebration_date).getDate() : ''}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500 }}>{c.title}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{c.resident_name || 'General'}</div>
                    </div>
                    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', background: tc.bg, color: tc.color }}>{getTypeIcon(c.celebration_type)} {c.celebration_type?.replace('_', ' ')}</span>
                  </div>
                );
              })}
            </div>
          ) : <p style={{ color: '#6b7280' }}>No celebrations in the calendar yet.</p>}
        </div>
      )}
    </div>
  );
}
