// src/pages/RoomTurnoverManager.tsx
import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useRoomTurnovers, useCreateRoomTurnover, useUpdateRoomTurnoverStatus, useTurnoverChecklist, useAddTurnoverChecklistItem, useCompleteTurnoverChecklistItem, useRoomTurnoverDashboard, useResidents, useColleagues } from '../hooks';

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'ready' | 'cleaning' | 'maintenance';

const DEFAULT_CHECKLIST = [
  { task_name: 'Deep clean', category: 'cleaning' },
  { task_name: 'Carpet cleaning', category: 'cleaning' },
  { task_name: 'Maintenance check', category: 'maintenance' },
  { task_name: 'Repaint walls', category: 'decoration' },
  { task_name: 'Check furniture', category: 'inventory' },
  { task_name: 'Check curtains/blinds', category: 'decoration' },
  { task_name: 'Inventory beds/mattress', category: 'inventory' },
  { task_name: 'Electrical test', category: 'maintenance' },
  { task_name: 'PAT testing', category: 'maintenance' },
  { task_name: 'Final inspection', category: 'admin' },
];

const STATUS_STEPS = ['pending', 'in_progress', 'cleaning', 'maintenance', 'inspection', 'ready'];
const STATUS_LABELS: Record<string, string> = {
  pending: 'Vacated',
  in_progress: 'In Progress',
  cleaning: 'Cleaning',
  maintenance: 'Maintenance',
  inspection: 'Inspection',
  ready: 'Ready',
};

export default function RoomTurnoverManager() {
  const { t } = useLang();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedTurnover, setExpandedTurnover] = useState<string | null>(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('cleaning');

  const { data: dashboard } = useRoomTurnoverDashboard();
  const { data: turnovers = [] } = useRoomTurnovers();
  const { data: residents = [] } = useResidents();
  const { data: staffList = [] } = useColleagues();
  const { data: checklist = [] } = useTurnoverChecklist(expandedTurnover || '');
  const createTurnover = useCreateRoomTurnover();
  const updateStatus = useUpdateRoomTurnoverStatus();
  const addChecklistItem = useAddTurnoverChecklistItem();
  const completeItem = useCompleteTurnoverChecklistItem();

  const dash = dashboard || {} as any;
  const vacatedCount = dash.rooms_vacated ?? 0;
  const inProgressCount = dash.in_progress ?? 0;
  const readyCount = dash.ready_for_admission ?? 0;
  const avgTurnaround = dash.average_turnaround_days ?? 0;

  // Create form state
  const [createForm, setCreateForm] = useState({ room_number: '', previous_resident_id: '', vacated_date: new Date().toISOString().slice(0, 10), target_ready_date: '', assigned_to: '' });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createTurnover.mutate({
      room_number: createForm.room_number,
      previous_resident_id: createForm.previous_resident_id || undefined,
      vacated_date: createForm.vacated_date,
      target_ready_date: createForm.target_ready_date || undefined,
      assigned_to: createForm.assigned_to || undefined,
    }, { onSuccess: () => { setShowCreateForm(false); setCreateForm({ room_number: '', previous_resident_id: '', vacated_date: new Date().toISOString().slice(0, 10), target_ready_date: '', assigned_to: '' }); } });
  };

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !expandedTurnover) return;
    addChecklistItem.mutate({
      turnover_id: expandedTurnover,
      task_name: newItemName,
      category: newItemCategory,
    }, { onSuccess: () => { setNewItemName(''); setShowAddItem(false); } });
  };

  // Filter turnovers
  const filteredTurnovers = statusFilter === 'all'
    ? (turnovers as any[])
    : (turnovers as any[]).filter((t: any) => t.status === statusFilter);

  const getStatusStep = (status: string) => STATUS_STEPS.indexOf(status);

  const statusBadge = (status: string) => {
    if (status === 'ready') return 'badge-success';
    if (status === 'pending') return 'badge-warning';
    if (status === 'in_progress' || status === 'cleaning') return 'badge-primary';
    return 'badge-neutral';
  };

  // Group checklist by category
  const groupedChecklist = (checklist as any[]).reduce((acc: Record<string, any[]>, item: any) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  const completedCount = (checklist as any[]).filter((i: any) => i.completed).length;
  const totalCount = (checklist as any[]).length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Room Turnover Manager</h1>
          <p className="page-subtitle">Checklist workflow, deep clean and maintenance tracking, ready-for-admission status</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>+ New Turnover</button>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Rooms Vacated', value: String(vacatedCount), icon: '🚪', color: '#d97706' },
          { label: 'In Progress', value: String(inProgressCount), icon: '🔧', color: '#0d9488' },
          { label: 'Ready for Admission', value: String(readyCount), icon: '✅', color: '#16a34a' },
          { label: 'Avg Turnaround (days)', value: String(avgTurnaround), icon: '📈', color: '#7c3aed' },
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

      {/* Create Form */}
      {showCreateForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body">
            <h3 style={{ margin: '0 0 12px', fontSize: '1rem', fontWeight: 600 }}>Create Room Turnover</h3>
            <form onSubmit={handleCreate}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Room Number *</label>
                  <input type="text" value={createForm.room_number} onChange={e => setCreateForm({ ...createForm, room_number: e.target.value })} placeholder="e.g. 12" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Previous Resident</label>
                  <select value={createForm.previous_resident_id} onChange={e => setCreateForm({ ...createForm, previous_resident_id: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <option value="">Select...</option>
                    {(residents as any[]).map((r: any) => (
                      <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Vacated Date *</label>
                  <input type="date" value={createForm.vacated_date} onChange={e => setCreateForm({ ...createForm, vacated_date: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} required />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Target Ready Date</label>
                  <input type="date" value={createForm.target_ready_date} onChange={e => setCreateForm({ ...createForm, target_ready_date: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Assign To</label>
                  <select value={createForm.assigned_to} onChange={e => setCreateForm({ ...createForm, assigned_to: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <option value="">Select staff...</option>
                    {(staffList as any[]).map((s: any) => (
                      <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={createTurnover.isPending}>Create Turnover</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreateForm(false)}>{t('Cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {([['all', 'All'], ['pending', 'Vacated'], ['in_progress', 'In Progress'], ['ready', 'Ready']] as [StatusFilter, string][]).map(([f, label]) => (
            <button key={f} className={`btn ${statusFilter === f ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setStatusFilter(f)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Turnovers List */}
      <div className="card">
        <div className="card-body">
          {filteredTurnovers.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>No turnovers found</p>
          ) : filteredTurnovers.map((t: any) => (
            <div key={t.id} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 12, overflow: 'hidden' }}>
              {/* Turnover Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', background: expandedTurnover === t.id ? 'rgba(37,99,235,0.04)' : 'transparent' }} onClick={() => setExpandedTurnover(expandedTurnover === t.id ? null : t.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '1.2rem' }}>🛏️</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>Room {t.room_number}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.previous_resident_name || 'Previous resident'} - Vacated {t.vacated_date?.slice(0, 10)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {t.checklist_progress !== undefined && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{t.checklist_progress}%</span>
                  )}
                  <span className={`badge ${statusBadge(t.status)}`}>{STATUS_LABELS[t.status] || t.status}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{expandedTurnover === t.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Expanded Detail */}
              {expandedTurnover === t.id && (
                <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                  {/* Status Progression Bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 16, marginBottom: 16 }}>
                    {STATUS_STEPS.map((step, i) => {
                      const currentStep = getStatusStep(t.status);
                      const isCompleted = i <= currentStep;
                      const isCurrent = i === currentStep;
                      return (
                        <React.Fragment key={step}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: isCompleted ? '#16a34a' : '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: isCompleted ? '#fff' : '#6b7280', fontWeight: 700, border: isCurrent ? '2px solid #0d9488' : 'none' }}>
                              {isCompleted ? '✓' : i + 1}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: isCompleted ? '#16a34a' : 'var(--text-muted)', marginTop: 4, textAlign: 'center', fontWeight: isCurrent ? 700 : 400 }}>{STATUS_LABELS[step]}</div>
                          </div>
                          {i < STATUS_STEPS.length - 1 && (
                            <div style={{ flex: 1, height: 2, background: i < currentStep ? '#16a34a' : '#e5e7eb' }} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {/* Update Status */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    {STATUS_STEPS.filter(s => s !== t.status).map(s => (
                      <button key={s} className="btn btn-ghost btn-sm" onClick={() => updateStatus.mutate({ id: t.id, data: { status: s } })} style={{ fontSize: '0.7rem' }}>Move to {STATUS_LABELS[s]}</button>
                    ))}
                  </div>

                  {/* Completion Percentage */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Checklist Progress</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: completionPct === 100 ? '#16a34a' : '#0d9488' }}>{completionPct}% ({completedCount}/{totalCount})</span>
                    </div>
                    <div style={{ width: '100%', height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
                      <div style={{ width: `${completionPct}%`, height: '100%', background: completionPct === 100 ? '#16a34a' : '#0d9488', transition: 'width 0.3s ease', borderRadius: 4 }} />
                    </div>
                  </div>

                  {/* Checklist Items Grouped by Category */}
                  {Object.keys(groupedChecklist).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No checklist items. Default items are created when the turnover is first opened.</p>
                  ) : Object.entries(groupedChecklist).map(([category, items]) => (
                    <div key={category} style={{ marginBottom: 12 }}>
                      <h5 style={{ margin: '0 0 6px', fontSize: '0.8rem', fontWeight: 700, textTransform: 'capitalize', color: 'var(--text-muted)' }}>{category}</h5>
                      {(items as any[]).map((item: any) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                          <input type="checkbox" checked={item.completed} onChange={() => { if (!item.completed) completeItem.mutate(item.id); }} disabled={item.completed} style={{ width: 16, height: 16 }} />
                          <span style={{ flex: 1, fontSize: '0.85rem', textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? 'var(--text-muted)' : 'inherit' }}>{item.task_name}</span>
                          {item.completed && item.completed_by_name && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.completed_by_name} - {item.completed_at?.slice(0, 10)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Add Custom Checklist Item */}
                  {showAddItem ? (
                    <form onSubmit={handleAddChecklistItem} style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 2 }}>Item Name</label>
                        <input type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Custom task..." style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: '0.85rem' }} required />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 2 }}>Category</label>
                        <select value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)} style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                          <option value="cleaning">{t('Cleaning')}</option>
                          <option value="maintenance">{t('Maintenance')}</option>
                          <option value="decoration">Decoration</option>
                          <option value="inventory">Inventory</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <button type="submit" className="btn btn-primary btn-sm">{t('Add')}</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddItem(false)}>{t('Cancel')}</button>
                    </form>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAddItem(true)} style={{ marginTop: 8 }}>+ Add Custom Item</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
