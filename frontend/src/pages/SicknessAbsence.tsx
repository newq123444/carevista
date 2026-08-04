import React, { useState, useMemo } from 'react';
import {
  useAbsences, useRecordAbsence, useBradfordScores,
  useAbsencePatterns, useReturnToWorkDue, useCompleteReturnToWork,
  useAbsenceDashboard, useStaff,
} from '../hooks';
import type { AbsenceRecord, BradfordScore } from '../types';

const ABSENCE_TYPES = [
  { value: 'sick', label: 'Sickness' },
  { value: 'unpaid', label: 'Unauthorized' },
  { value: 'compassionate', label: 'Compassionate' },
  { value: 'holiday', label: 'Annual Leave' },
  { value: 'other', label: 'Other' },
];

export default function SicknessAbsence() {
  const { data: absences } = useAbsences();
  const { data: bradfordScores } = useBradfordScores();
  const { data: patterns } = useAbsencePatterns();
  const { data: returnToWork } = useReturnToWorkDue();
  const { data: dashboard } = useAbsenceDashboard();
  const { data: staffList } = useStaff();
  const recordAbsence = useRecordAbsence();
  const completeRtw = useCompleteReturnToWork();

  const [showAbsenceForm, setShowAbsenceForm] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({
    staff_id: '', absence_type: 'sick', start_date: '', end_date: '', reason: '', self_certified: false,
  });

  const staffMembers: any[] = Array.isArray(staffList) ? staffList : [];
  const absenceList: AbsenceRecord[] = Array.isArray(absences) ? absences : [];
  const bradfordList: BradfordScore[] = Array.isArray(bradfordScores) ? bradfordScores : [];
  const patternList: any[] = Array.isArray(patterns) ? patterns : [];
  const rtwList: any[] = Array.isArray(returnToWork) ? returnToWork : [];
  const dashData = dashboard || {} as any;

  // Dashboard KPIs
  const totalDaysLost = dashData.total_days_lost || absenceList.reduce((sum, a) => sum + (a.days_lost || 0), 0);
  const avgPerEmployee = dashData.avg_per_employee || (staffMembers.length > 0 ? (totalDaysLost / staffMembers.length).toFixed(1) : '0');
  const bradfordAlerts = dashData.bradford_alerts || bradfordList.filter(b => b.risk_level === 'high' || b.risk_level === 'critical').length;
  const costEstimate = dashData.cost_estimate || (totalDaysLost * 150);

  const handleRecordAbsence = (e: React.FormEvent) => {
    e.preventDefault();
    recordAbsence.mutate(absenceForm);
    setAbsenceForm({ staff_id: '', absence_type: 'sick', start_date: '', end_date: '', reason: '', self_certified: false });
    setShowAbsenceForm(false);
  };

  const handleCompleteRtw = (id: string) => {
    completeRtw.mutate({ id, data: { completed: true, completed_date: new Date().toISOString().slice(0, 10) } });
  };

  const getBradfordColor = (score: number) => {
    if (score < 50) return '#10b981';
    if (score < 200) return '#f59e0b';
    return '#ef4444';
  };

  const getBradfordBadge = (score: number) => {
    if (score < 50) return 'badge-success';
    if (score < 200) return 'badge-warning';
    return 'badge-danger';
  };

  // Generate mock calendar data for annual leave
  const leaveRecords = useMemo(() => {
    return absenceList.filter(a => a.absence_type === 'holiday');
  }, [absenceList]);

  // Generate a 30-day range for the calendar
  const calendarDays = useMemo(() => {
    const days: string[] = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }, []);

  const isStaffOnLeave = (staffId: string, date: string) => {
    return leaveRecords.some(r => r.staff_id === staffId && r.start_date <= date && (!r.end_date || r.end_date >= date));
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sickness & Absence</h1>
          <p className="page-subtitle">Bradford Factor analysis, pattern detection, and return-to-work management</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAbsenceForm(true)}>+ Record Absence</button>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-primary)' }}>{totalDaysLost}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Days Lost (Year)</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#3b82f6' }}>{avgPerEmployee}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Avg per Employee</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>{bradfordAlerts}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Bradford Alerts</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: '#8b5cf6' }}>&pound;{typeof costEstimate === 'number' ? costEstimate.toLocaleString() : costEstimate}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Estimated Cost</div>
          </div>
        </div>
      </div>

      {/* Record Absence Form Modal */}
      {showAbsenceForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: 500 }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Record Absence</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAbsenceForm(false)}>X</button>
              </div>
              <form onSubmit={handleRecordAbsence}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Staff Member *</label>
                    <select className="input" value={absenceForm.staff_id} onChange={e => setAbsenceForm(f => ({ ...f, staff_id: e.target.value }))} required>
                      <option value="">Select staff...</option>
                      {staffMembers.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Absence Type *</label>
                    <select className="input" value={absenceForm.absence_type} onChange={e => setAbsenceForm(f => ({ ...f, absence_type: e.target.value }))} required>
                      {ABSENCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Start Date *</label>
                      <input className="input" type="date" value={absenceForm.start_date} onChange={e => setAbsenceForm(f => ({ ...f, start_date: e.target.value }))} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>End Date</label>
                      <input className="input" type="date" value={absenceForm.end_date} onChange={e => setAbsenceForm(f => ({ ...f, end_date: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: 4 }}>Reason</label>
                    <textarea className="input" rows={3} value={absenceForm.reason} onChange={e => setAbsenceForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for absence..." />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" id="self_certified" checked={absenceForm.self_certified} onChange={e => setAbsenceForm(f => ({ ...f, self_certified: e.target.checked }))} />
                    <label htmlFor="self_certified" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Self-certified</label>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setShowAbsenceForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={recordAbsence.isPending}>
                      {recordAbsence.isPending ? 'Recording...' : 'Record Absence'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bradford Factor Dashboard */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h3 style={{ margin: '0 0 16px' }}>Bradford Factor Scores</h3>
          {bradfordList.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No Bradford Factor data available yet.</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Role</th>
                    <th>Score</th>
                    <th>Spells</th>
                    <th>Total Days</th>
                    <th>Risk Level</th>
                  </tr>
                </thead>
                <tbody>
                  {bradfordList.sort((a, b) => b.score - a.score).map(item => {
                    const staffMember = staffMembers.find((s: any) => s.id === item.staff_id);
                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>{item.staff_name || (staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : '-')}</td>
                        <td style={{ textTransform: 'capitalize' }}>{staffMember?.role?.replace(/_/g, ' ') || '-'}</td>
                        <td>
                          <span style={{ fontWeight: 700, color: getBradfordColor(item.score) }}>{item.score}</span>
                        </td>
                        <td>{item.spells}</td>
                        <td>{item.total_days}</td>
                        <td>
                          <span className={`badge ${getBradfordBadge(item.score)}`}>
                            {item.score < 50 ? 'Low' : item.score < 200 ? 'Medium' : 'High'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Pattern Detection Panel */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h3 style={{ margin: '0 0 16px' }}>Pattern Detection</h3>
          {patternList.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No absence patterns detected.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {patternList.map((pattern: any, idx: number) => (
                <div key={idx} className="card" style={{ margin: 0, border: '1px solid #f59e0b40', background: 'rgba(245, 158, 11, 0.05)' }}>
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: '1.2rem' }}>&#9888;</span>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{pattern.staff_name || 'Unknown Staff'}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {pattern.pattern_description || pattern.description || 'Recurring absence pattern detected'}
                    </p>
                    {pattern.pattern_type && (
                      <span className="badge badge-warning" style={{ marginTop: 8, display: 'inline-block' }}>
                        {pattern.pattern_type === 'day_of_week' ? 'Always same day' : pattern.pattern_type === 'after_holiday' ? 'Always after holiday' : pattern.pattern_type}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Return to Work Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body">
          <h3 style={{ margin: '0 0 16px' }}>Return to Work Interviews Due</h3>
          {rtwList.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)' }}>No return-to-work interviews pending.</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Absence Type</th>
                    <th>Dates</th>
                    <th>Days Lost</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rtwList.map((item: any) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.staff_name || '-'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{item.absence_type?.replace(/_/g, ' ') || '-'}</td>
                      <td>
                        {item.start_date ? new Date(item.start_date).toLocaleDateString() : '-'}
                        {item.end_date ? ` - ${new Date(item.end_date).toLocaleDateString()}` : ''}
                      </td>
                      <td>{item.days_lost || '-'}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => handleCompleteRtw(item.id)} disabled={completeRtw.isPending}>
                          Complete RTW
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Annual Leave Calendar View */}
      <div className="card">
        <div className="card-body">
          <h3 style={{ margin: '0 0 16px' }}>Annual Leave Calendar (Next 30 Days)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ minWidth: 800, fontSize: '0.75rem' }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--bg-primary, #fff)', zIndex: 1, minWidth: 140 }}>Staff</th>
                  {calendarDays.map(day => (
                    <th key={day} style={{ textAlign: 'center', padding: '4px 2px', minWidth: 28 }}>
                      <div>{new Date(day).toLocaleDateString('en-GB', { day: '2-digit' })}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{new Date(day).toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffMembers.slice(0, 20).map((staff: any) => (
                  <tr key={staff.id}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--bg-primary, #fff)', zIndex: 1, fontWeight: 500, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {staff.first_name} {staff.last_name}
                    </td>
                    {calendarDays.map(day => {
                      const onLeave = isStaffOnLeave(staff.id, day);
                      const isWeekend = [0, 6].includes(new Date(day).getDay());
                      return (
                        <td key={day} style={{ padding: '4px 2px', textAlign: 'center' }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: 4, margin: '0 auto',
                            background: onLeave ? '#3b82f6' : isWeekend ? 'rgba(0,0,0,0.04)' : 'transparent',
                          }} title={onLeave ? 'On Leave' : ''} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {staffMembers.length === 0 && (
                  <tr><td colSpan={calendarDays.length + 1} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>No staff data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
