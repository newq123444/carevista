// src/pages/ReportBuilder.tsx
import React, { useState } from 'react';
import { useReportTemplates, useCreateReportTemplate, useUpdateReportTemplate, useDeleteReportTemplate, useRunReport, useReportRuns, useReportDataSources } from '../hooks';

const DATA_SOURCES = [
  'residents', 'care_notes', 'incidents', 'medications', 'staff',
  'invoices', 'activities', 'wellbeing', 'schedule', 'training',
];

const SOURCE_FIELDS: Record<string, string[]> = {
  residents: ['id', 'first_name', 'last_name', 'room_number', 'care_type', 'status', 'risk_level', 'admission_date', 'date_of_birth', 'nhs_number', 'mobility_status', 'funding_type'],
  care_notes: ['id', 'resident_name', 'staff_name', 'note_type', 'body', 'flagged', 'created_at'],
  incidents: ['id', 'resident_name', 'incident_type', 'severity', 'status', 'incident_date', 'location', 'description'],
  medications: ['id', 'resident_id', 'name', 'dose', 'route', 'frequency', 'prescriber', 'start_date', 'status'],
  staff: ['id', 'first_name', 'last_name', 'role', 'job_title', 'email', 'start_date', 'contracted_hours', 'active'],
  invoices: ['id', 'resident_name', 'period_start', 'period_end', 'total_pence', 'status', 'due_date', 'funding_type'],
  activities: ['id', 'name', 'activity_type', 'category', 'duration_minutes', 'max_participants', 'location'],
  wellbeing: ['id', 'resident_id', 'mood', 'engagement', 'social_interaction', 'created_at'],
  schedule: ['id', 'staff_name', 'shift_date', 'shift_type', 'start_time', 'end_time', 'role_cover'],
  training: ['id', 'staff_name', 'course_name', 'completed_date', 'expiry_date', 'status', 'provider'],
};

const OPERATORS = ['equals', 'contains', 'greater_than', 'less_than', 'between'];

interface FilterRow {
  field: string;
  operator: string;
  value: string;
}

export default function ReportBuilder() {
  const [view, setView] = useState<'templates' | 'designer' | 'history'>('templates');
  const [editingTemplate, setEditingTemplate] = useState<any>(null);

  const { data: templates = [] } = useReportTemplates();
  const { data: runs = [] } = useReportRuns();
  const { data: dataSources } = useReportDataSources();
  const createTemplate = useCreateReportTemplate();
  const updateTemplate = useUpdateReportTemplate();
  const deleteTemplate = useDeleteReportTemplate();
  const runReport = useRunReport();

  // Designer state
  const [designerForm, setDesignerForm] = useState({
    name: '',
    description: '',
    data_source: 'residents',
    columns: [] as string[],
    filters: [] as FilterRow[],
    date_start: '',
    date_end: '',
    group_by: '',
    sort_by: '',
    sort_order: 'asc' as 'asc' | 'desc',
    format: 'PDF',
    schedule: 'one-time',
    schedule_frequency: 'weekly',
  });

  const availableFields = SOURCE_FIELDS[designerForm.data_source] || [];

  const handleToggleColumn = (col: string) => {
    setDesignerForm(f => ({
      ...f,
      columns: f.columns.includes(col)
        ? f.columns.filter(c => c !== col)
        : [...f.columns, col],
    }));
  };

  const handleAddFilter = () => {
    setDesignerForm(f => ({
      ...f,
      filters: [...f.filters, { field: availableFields[0] || '', operator: 'equals', value: '' }],
    }));
  };

  const handleRemoveFilter = (idx: number) => {
    setDesignerForm(f => ({
      ...f,
      filters: f.filters.filter((_, i) => i !== idx),
    }));
  };

  const handleFilterChange = (idx: number, key: keyof FilterRow, value: string) => {
    setDesignerForm(f => ({
      ...f,
      filters: f.filters.map((fil, i) => i === idx ? { ...fil, [key]: value } : fil),
    }));
  };

  const handleSaveTemplate = () => {
    const payload = {
      name: designerForm.name,
      description: designerForm.description,
      data_source: designerForm.data_source,
      columns: designerForm.columns,
      filters: {
        conditions: designerForm.filters,
        date_start: designerForm.date_start || undefined,
        date_end: designerForm.date_end || undefined,
      },
      grouping: designerForm.group_by || undefined,
      sort_by: designerForm.sort_by || undefined,
      sort_order: designerForm.sort_order,
      format: designerForm.format,
      schedule: designerForm.schedule,
      schedule_frequency: designerForm.schedule === 'recurring' ? designerForm.schedule_frequency : undefined,
    };

    if (editingTemplate) {
      updateTemplate.mutate({ id: editingTemplate.id, data: payload }, { onSuccess: () => { setView('templates'); setEditingTemplate(null); resetDesigner(); } });
    } else {
      createTemplate.mutate(payload, { onSuccess: () => { setView('templates'); resetDesigner(); } });
    }
  };

  const handleRunNow = () => {
    const payload = {
      template_id: editingTemplate?.id,
      data_source: designerForm.data_source,
      columns: designerForm.columns,
      filters: {
        conditions: designerForm.filters,
        date_start: designerForm.date_start || undefined,
        date_end: designerForm.date_end || undefined,
      },
      grouping: designerForm.group_by || undefined,
      sort_by: designerForm.sort_by || undefined,
      sort_order: designerForm.sort_order,
      format: designerForm.format,
    };
    runReport.mutate(payload);
  };

  const resetDesigner = () => {
    setDesignerForm({
      name: '', description: '', data_source: 'residents', columns: [], filters: [],
      date_start: '', date_end: '', group_by: '', sort_by: '', sort_order: 'asc',
      format: 'PDF', schedule: 'one-time', schedule_frequency: 'weekly',
    });
  };

  const handleEditTemplate = (tmpl: any) => {
    setEditingTemplate(tmpl);
    setDesignerForm({
      name: tmpl.name || '',
      description: tmpl.description || '',
      data_source: tmpl.data_source || 'residents',
      columns: tmpl.columns || [],
      filters: tmpl.filters?.conditions || [],
      date_start: tmpl.filters?.date_start || '',
      date_end: tmpl.filters?.date_end || '',
      group_by: tmpl.grouping || '',
      sort_by: tmpl.sort_by || '',
      sort_order: tmpl.sort_order || 'asc',
      format: tmpl.format || 'PDF',
      schedule: tmpl.schedule || 'one-time',
      schedule_frequency: tmpl.schedule_frequency || 'weekly',
    });
    setView('designer');
  };

  const handleDeleteTemplate = (id: string) => {
    if (confirm('Delete this report template?')) {
      deleteTemplate.mutate(id);
    }
  };

  const handleRunTemplate = (tmpl: any) => {
    runReport.mutate({
      template_id: tmpl.id,
      data_source: tmpl.data_source,
      columns: tmpl.columns,
      filters: tmpl.filters,
      grouping: tmpl.grouping,
      sort_by: tmpl.sort_by,
      sort_order: tmpl.sort_order,
    });
  };

  const statusBadge = (status: string) => {
    if (status === 'completed') return 'badge-success';
    if (status === 'running') return 'badge-primary';
    if (status === 'failed') return 'badge-danger';
    return 'badge-neutral';
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Custom Report Builder</h1>
          <p className="page-subtitle">Design, schedule, and generate custom reports from your data</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetDesigner(); setEditingTemplate(null); setView('designer'); }}>+ New Report</button>
      </div>

      {/* Tab Navigation */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 10 }}>
          {([['templates', 'Templates'], ['designer', 'Designer'], ['history', 'Run History']] as ['templates' | 'designer' | 'history', string][]).map(([t, label]) => (
            <button key={t} className={`btn ${view === t ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setView(t)}>{label}</button>
          ))}
        </div>
      </div>

      {/* Templates List */}
      {view === 'templates' && (
        <div>
          {(templates as any[]).length === 0 ? (
            <div className="card"><div className="card-body" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No report templates yet. Create one to get started.</div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {(templates as any[]).map((tmpl: any) => (
                <div key={tmpl.id} className="card">
                  <div className="card-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{tmpl.name}</h4>
                      <span className="badge badge-neutral">{tmpl.data_source}</span>
                    </div>
                    {tmpl.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>{tmpl.description}</p>}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                      Created by {tmpl.created_by_name || 'Unknown'} on {tmpl.created_at?.slice(0, 10)}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => handleRunTemplate(tmpl)}>Run</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleEditTemplate(tmpl)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteTemplate(tmpl.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Designer */}
      {view === 'designer' && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>{editingTemplate ? 'Edit Template' : 'Report Template Designer'}</h3>

            {/* Name & Description */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Report Name *</label>
                <input type="text" value={designerForm.name} onChange={e => setDesignerForm({ ...designerForm, name: e.target.value })} placeholder="Monthly Residents Report" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Description</label>
                <input type="text" value={designerForm.description} onChange={e => setDesignerForm({ ...designerForm, description: e.target.value })} placeholder="Brief description..." style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
              </div>
            </div>

            {/* Data Source */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Data Source</label>
              <select value={designerForm.data_source} onChange={e => setDesignerForm({ ...designerForm, data_source: e.target.value, columns: [], filters: [], group_by: '', sort_by: '' })} style={{ width: '100%', maxWidth: 300, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                {DATA_SOURCES.map(ds => (
                  <option key={ds} value={ds}>{ds.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            {/* Field Picker */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Select Fields (columns)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {availableFields.map(field => (
                  <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: designerForm.columns.includes(field) ? 'rgba(37,99,235,0.1)' : 'transparent', cursor: 'pointer' }}>
                    <input type="checkbox" checked={designerForm.columns.includes(field)} onChange={() => handleToggleColumn(field)} style={{ width: 14, height: 14 }} />
                    {field.replace(/_/g, ' ')}
                  </label>
                ))}
              </div>
            </div>

            {/* Filter Builder */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Filters</label>
              {designerForm.filters.map((fil, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <select value={fil.field} onChange={e => handleFilterChange(idx, 'field', e.target.value)} style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: '0.8rem' }}>
                    {availableFields.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                  </select>
                  <select value={fil.operator} onChange={e => handleFilterChange(idx, 'operator', e.target.value)} style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: '0.8rem' }}>
                    {OPERATORS.map(op => <option key={op} value={op}>{op.replace(/_/g, ' ')}</option>)}
                  </select>
                  <input type="text" value={fil.value} onChange={e => handleFilterChange(idx, 'value', e.target.value)} placeholder="Value..." style={{ flex: 1, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: '0.8rem' }} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleRemoveFilter(idx)} style={{ color: 'var(--danger)', padding: '4px 8px' }}>x</button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddFilter}>+ Add Filter</button>
            </div>

            {/* Date Range */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Start Date</label>
                <input type="date" value={designerForm.date_start} onChange={e => setDesignerForm({ ...designerForm, date_start: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>End Date</label>
                <input type="date" value={designerForm.date_end} onChange={e => setDesignerForm({ ...designerForm, date_end: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }} />
              </div>
            </div>

            {/* Group By & Sort */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Group By</label>
                <select value={designerForm.group_by} onChange={e => setDesignerForm({ ...designerForm, group_by: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                  <option value="">None</option>
                  {designerForm.columns.map(col => <option key={col} value={col}>{col.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Sort By</label>
                <select value={designerForm.sort_by} onChange={e => setDesignerForm({ ...designerForm, sort_by: e.target.value })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                  <option value="">None</option>
                  {availableFields.map(f => <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Sort Order</label>
                <select value={designerForm.sort_order} onChange={e => setDesignerForm({ ...designerForm, sort_order: e.target.value as 'asc' | 'desc' })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>
                  <option value="asc">Ascending (ASC)</option>
                  <option value="desc">Descending (DESC)</option>
                </select>
              </div>
            </div>

            {/* Format */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Output Format</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {['PDF', 'CSV', 'Excel', 'JSON'].map(fmt => (
                  <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input type="radio" name="format" value={fmt} checked={designerForm.format === fmt} onChange={e => setDesignerForm({ ...designerForm, format: e.target.value })} />
                    {fmt}
                  </label>
                ))}
              </div>
            </div>

            {/* Schedule */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Schedule</label>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="radio" name="schedule" value="one-time" checked={designerForm.schedule === 'one-time'} onChange={e => setDesignerForm({ ...designerForm, schedule: e.target.value })} />
                  One-time
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input type="radio" name="schedule" value="recurring" checked={designerForm.schedule === 'recurring'} onChange={e => setDesignerForm({ ...designerForm, schedule: e.target.value })} />
                  Recurring
                </label>
                {designerForm.schedule === 'recurring' && (
                  <select value={designerForm.schedule_frequency} onChange={e => setDesignerForm({ ...designerForm, schedule_frequency: e.target.value })} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <button className="btn btn-primary" onClick={handleSaveTemplate} disabled={!designerForm.name || createTemplate.isPending || updateTemplate.isPending}>
                {editingTemplate ? 'Update Template' : 'Save Template'}
              </button>
              <button className="btn btn-secondary" onClick={handleRunNow} disabled={runReport.isPending}>Run Now</button>
              <button className="btn btn-ghost" onClick={() => { setView('templates'); setEditingTemplate(null); resetDesigner(); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Run History */}
      {view === 'history' && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>Report Run History</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr><th>Template</th><th>Run Date</th><th>Status</th><th>Row Count</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {(runs as any[]).length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No report runs yet</td></tr>
                  ) : (runs as any[]).map((run: any) => (
                    <tr key={run.id}>
                      <td style={{ fontWeight: 500 }}>{run.template_name || 'Ad-hoc Report'}</td>
                      <td>{run.started_at?.slice(0, 16).replace('T', ' ')}</td>
                      <td><span className={`badge ${statusBadge(run.status)}`}>{run.status}</span></td>
                      <td>{run.row_count ?? '-'}</td>
                      <td>
                        {run.status === 'completed' && (
                          <button className="btn btn-ghost btn-sm">Download</button>
                        )}
                      </td>
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
