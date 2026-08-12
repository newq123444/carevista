import React, { useState, useRef } from 'react';
import { useLang } from '../i18n';
import { useGenerateRota, useRotaTemplates, useRotaTemplate, useUpdateRotaShift, usePublishRota, useRotaConstraints, useUploadRotaCsv } from '../hooks';
import type { RotaTemplate, RotaShift } from '../types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SHIFT_COLORS: Record<string, string> = {
  day: '#3b82f6',
  evening: '#f59e0b',
  night: '#8b5cf6',
};

export default function SmartRota() {
  const { t: tr } = useLang();
  const [weekStart, setWeekStart] = useState('');
  const [rotaName, setRotaName] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('');
  const [respectPreferences, setRespectPreferences] = useState(true);
  const [minNurseCoverage, setMinNurseCoverage] = useState(true);
  const [workingTimeDirective, setWorkingTimeDirective] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [editingShift, setEditingShift] = useState<RotaShift | null>(null);
  const [editStaffId, setEditStaffId] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateRota = useGenerateRota();
  const { data: templates, isError: templatesError, isLoading: templatesLoading } = useRotaTemplates();
  const { data: templateDetail } = useRotaTemplate(selectedTemplateId);
  const updateShift = useUpdateRotaShift();
  const publishRota = usePublishRota();
  const { data: constraints, isError: constraintsError } = useRotaConstraints();
  const uploadCsv = useUploadRotaCsv();

  const handleGenerate = () => {
    if (!weekStart) return;
    try {
      const budgetPence = budgetLimit ? Math.round(parseFloat(budgetLimit) * 100) : undefined;
      generateRota.mutate({
        week_start: weekStart,
        name: rotaName || `Rota ${weekStart}`,
        budget_limit_pence: budgetPence,
        constraints: {
          respect_preferences: respectPreferences,
          min_nurse_coverage: minNurseCoverage,
          working_time_directive: workingTimeDirective,
        },
      }, {
        onSuccess: (data: any) => {
          if (data?.id) setSelectedTemplateId(data.id);
          else if (data?.template?.id) setSelectedTemplateId(data.template.id);
        }
      });
    } catch {
      // Error is handled by the mutation's onError callback
    }
  };

  const handleEditShift = (shift: RotaShift) => {
    setEditingShift(shift);
    setEditStaffId(shift.staff_id);
    setEditStartTime(shift.start_time);
    setEditEndTime(shift.end_time);
  };

  const handleSaveShift = () => {
    if (!editingShift) return;
    updateShift.mutate({ id: editingShift.id, data: { staff_id: editStaffId, start_time: editStartTime, end_time: editEndTime } });
    setEditingShift(null);
  };

  const handlePublish = () => {
    if (selectedTemplateId) publishRota.mutate(selectedTemplateId);
  };

  const handleCsvUpload = () => {
    if (!csvFile) return;
    const formData = new FormData();
    formData.append('file', csvFile);
    uploadCsv.mutate(formData, {
      onSuccess: () => {
        setCsvFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    });
  };

  const currentTemplate: RotaTemplate | null = templateDetail?.template || templateDetail || null;
  const shifts: RotaShift[] = currentTemplate?.shifts || templateDetail?.shifts || [];

  // Group shifts by staff
  const staffMap: Record<string, { name: string; role: string; shifts: RotaShift[] }> = {};
  shifts.forEach(s => {
    if (!staffMap[s.staff_id]) {
      staffMap[s.staff_id] = { name: s.staff_name || s.staff_id, role: s.staff_role || s.role_required || 'Staff', shifts: [] };
    }
    staffMap[s.staff_id].shifts.push(s);
  });

  // Sort by role
  const staffEntries = Object.entries(staffMap).sort((a, b) => a[1].role.localeCompare(b[1].role));

  const getDayIndex = (dateStr: string): number => {
    const d = new Date(dateStr);
    const day = d.getDay();
    return day === 0 ? 6 : day - 1;
  };

  const templateList: RotaTemplate[] = Array.isArray(templates) ? templates : (templates as any)?.templates || [];

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = { draft: '#f59e0b', published: '#10b981', archived: '#6b7280' };
    return (
      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: (colors[status] || '#6b7280') + '20', color: colors[status] || '#6b7280' }}>
        {status}
      </span>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>AI Smart Rota Builder</h1>
        <p style={{ color: '#64748b', marginTop: 4 }}>Generate optimised staff rotas using AI, respecting constraints and budget limits</p>
      </div>

      {/* Generation Error */}
      {generateRota.isError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, marginBottom: 16, color: '#991b1b' }}>
          <strong>Rota Generation Failed:</strong> {(generateRota.error as any)?.response?.data?.error || 'An error occurred while generating the rota. Please try again.'}
        </div>
      )}

      {/* Generation Form */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.1)', marginBottom: 24, border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, color: '#1e293b' }}>Generate New Rota</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Week Start Date</label>
            <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Rota Name</label>
            <input type="text" value={rotaName} onChange={e => setRotaName(e.target.value)} placeholder="e.g. Week 12 Rota" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Budget Limit (pounds)</label>
            <input type="number" value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)} placeholder="e.g. 5000" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem' }} />
          </div>
        </div>

        {/* Constraints */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 8 }}>Constraints</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem', color: '#334155' }}>
              <input type="checkbox" checked={respectPreferences} onChange={e => setRespectPreferences(e.target.checked)} />
              Respect staff preferences
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem', color: '#334155' }}>
              <input type="checkbox" checked={minNurseCoverage} onChange={e => setMinNurseCoverage(e.target.checked)} />
              Minimum nurse coverage
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem', color: '#334155' }}>
              <input type="checkbox" checked={workingTimeDirective} onChange={e => setWorkingTimeDirective(e.target.checked)} />
              Working Time Directive compliance
            </label>
          </div>
        </div>

        <button onClick={handleGenerate} disabled={!weekStart || generateRota.isPending} style={{ padding: '10px 24px', borderRadius: 8, background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', opacity: (!weekStart || generateRota.isPending) ? 0.6 : 1 }}>
          {generateRota.isPending ? 'Generating...' : 'Generate AI Rota'}
        </button>
      </div>

      {/* Upload Excel/CSV Rota */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.1)', marginBottom: 24, border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8, color: '#1e293b' }}>Upload CSV Rota</h2>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 16 }}>
          Upload a CSV file with columns: <strong>staff_name</strong>, <strong>date</strong> (YYYY-MM-DD), <strong>shift_type</strong> (day/evening/night/off/annual_leave/sick)
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={e => setCsvFile(e.target.files?.[0] || null)}
            style={{ fontSize: '0.85rem' }}
          />
          <button
            onClick={handleCsvUpload}
            disabled={!csvFile || uploadCsv.isPending}
            style={{ padding: '8px 20px', borderRadius: 8, background: '#0d9488', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', opacity: (!csvFile || uploadCsv.isPending) ? 0.6 : 1 }}
          >
            {uploadCsv.isPending ? 'Uploading...' : 'Upload CSV Rota'}
          </button>
        </div>
        {uploadCsv.isError && (
          <div style={{ marginTop: 12, color: '#dc2626', fontSize: '0.85rem' }}>
            {(uploadCsv.error as any)?.response?.data?.error || 'Upload failed. Please check your file format.'}
          </div>
        )}
        {uploadCsv.isSuccess && uploadCsv.data && (
          <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
            <div style={{ color: '#166534', fontWeight: 600, fontSize: '0.85rem' }}>{(uploadCsv.data as any)?.message}</div>
            {(uploadCsv.data as any)?.details && (
              <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#475569', maxHeight: 150, overflowY: 'auto' }}>
                {((uploadCsv.data as any).details as any[]).filter((d: any) => d.status !== 'imported').map((d: any, i: number) => (
                  <div key={i}>Row {d.row}: {d.status}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Templates List */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.1)', marginBottom: 24, border: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 16, color: '#1e293b' }}>Rota Templates</h2>
        {templatesLoading ? (
          <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Loading templates...</p>
        ) : templatesError ? (
          <p style={{ color: '#dc2626', fontStyle: 'italic' }}>Unable to load templates. Please try refreshing.</p>
        ) : templateList.length === 0 ? (
          <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No templates yet. Generate your first rota above.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {templateList.map((t: RotaTemplate) => (
              <div key={t.id} onClick={() => setSelectedTemplateId(t.id)} style={{ padding: 16, borderRadius: 8, border: selectedTemplateId === t.id ? '2px solid #7c3aed' : '1px solid #e2e8f0', cursor: 'pointer', background: selectedTemplateId === t.id ? '#f5f3ff' : '#fff', transition: 'all 150ms' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{t.name}</span>
                  {statusBadge(t.status)}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Week of {t.week_start}</div>
                {t.shifts && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4 }}>{t.shifts.length} shifts</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Week Grid */}
      {currentTemplate && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.1)', marginBottom: 24, border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
              Week Grid: {currentTemplate.name}
            </h2>
            {currentTemplate.status === 'draft' && (
              <button onClick={handlePublish} disabled={publishRota.isPending} style={{ padding: '8px 16px', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                {publishRota.isPending ? 'Publishing...' : 'Publish Rota'}
              </button>
            )}
          </div>

          {/* Grid */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 600, color: '#475569', width: 180 }}>{tr('Staff')}</th>
                  {DAYS.map(d => (
                    <th key={d} style={{ padding: '10px 8px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffEntries.map(([staffId, info]) => (
                  <tr key={staffId}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' }}>
                      <div style={{ fontWeight: 500, fontSize: '0.85rem', color: '#1e293b' }}>{info.name}</div>
                      <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 8, background: '#e0e7ff', color: '#4338ca' }}>{info.role}</span>
                    </td>
                    {DAYS.map((_, dayIdx) => {
                      const dayShifts = info.shifts.filter(s => getDayIndex(s.shift_date) === dayIdx);
                      return (
                        <td key={dayIdx} style={{ padding: '4px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', textAlign: 'center' }}>
                          {dayShifts.map(s => (
                            <div key={s.id} onClick={() => handleEditShift(s)} style={{ padding: '4px 6px', borderRadius: 6, background: (SHIFT_COLORS[s.shift_type] || '#6b7280') + '20', border: `1px solid ${SHIFT_COLORS[s.shift_type] || '#6b7280'}40`, cursor: 'pointer', marginBottom: 2 }}>
                              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: SHIFT_COLORS[s.shift_type] || '#6b7280' }}>{s.shift_type}</div>
                              <div style={{ fontSize: '0.6rem', color: '#64748b' }}>{s.start_time}-{s.end_time}</div>
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {staffEntries.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No shifts in this template</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
            {Object.entries(SHIFT_COLORS).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: color + '40', border: `1px solid ${color}` }} />
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'capitalize' }}>{type}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Constraints Panel */}
      {!constraintsError && constraints && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,.1)', marginBottom: 24, border: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 12, color: '#1e293b' }}>Staff Constraints</h2>
          {Array.isArray(constraints) && constraints.length > 0 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {(constraints as any[]).map((c: any, i: number) => {
                const hasViolation = c.hasViolation || (c.violations && c.violations.length > 0);
                return (
                  <div key={i} style={{ padding: 16, borderRadius: 8, background: hasViolation ? '#fef2f2' : '#f0fdf4', border: `1px solid ${hasViolation ? '#fecaca' : '#bbf7d0'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{c.staff_name || 'Unknown Staff'}</span>
                        {c.role && (
                          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: '#e0e7ff', color: '#4338ca' }}>{c.role}</span>
                        )}
                      </div>
                      {hasViolation && (
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600, background: '#fef2f2', color: '#991b1b' }}>Violation</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.82rem', color: '#475569' }}>
                      {(c.contractHours || c.contract_hours) != null && (
                        <span>{c.contractHours || c.contract_hours}h contracted</span>
                      )}
                      {c.hoursThisWeek != null && (
                        <span>{c.hoursThisWeek}h this week</span>
                      )}
                      {c.remainingHours != null && (
                        <span style={{ color: c.remainingHours < 0 ? '#dc2626' : '#16a34a' }}>{c.remainingHours}h remaining</span>
                      )}
                      {c.maxWeeklyHours != null && (
                        <span>Max {c.maxWeeklyHours}h/week</span>
                      )}
                    </div>
                    {c.violations && Array.isArray(c.violations) && c.violations.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {c.violations.map((v: string, vi: number) => (
                          <span key={vi} style={{ padding: '2px 8px', borderRadius: 12, fontSize: '0.72rem', fontWeight: 500, background: '#fee2e2', color: '#dc2626' }}>{v}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: '#10b981', fontSize: '0.85rem' }}>No constraint violations detected.</p>
          )}
        </div>
      )}

      {/* Edit Shift Modal */}
      {editingShift && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 400, maxWidth: '90%' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>Edit Shift</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Staff ID</label>
              <input value={editStaffId} onChange={e => setEditStaffId(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Start Time</label>
              <input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem' }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>End Time</label>
              <input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: '0.9rem' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingShift(null)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#475569', cursor: 'pointer', fontSize: '0.85rem' }}>{tr('Cancel')}</button>
              <button onClick={handleSaveShift} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>{tr('Save')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
