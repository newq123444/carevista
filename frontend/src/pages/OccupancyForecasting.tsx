// src/pages/OccupancyForecasting.tsx
import React, { useState } from 'react';
import { useOccupancyHistory, useRecordOccupancy, useOccupancyForecasts, useGenerateOccupancyForecast, useOccupancyDashboard } from '../hooks';
import { formatDate } from '../utils/formatters';
import type { OccupancyRecord, OccupancyForecast } from '../types';

export default function OccupancyForecasting() {
  const [showRecordForm, setShowRecordForm] = useState(false);

  const { data: dashboard } = useOccupancyDashboard();
  const { data: history = [], isLoading: loadingHistory } = useOccupancyHistory();
  const { data: forecasts = [], isLoading: loadingForecasts } = useOccupancyForecasts();
  const generateForecast = useGenerateOccupancyForecast();

  const dash = dashboard || {} as any;
  const totalBeds = dash.total_beds || 0;
  const occupiedBeds = dash.occupied_beds || 0;
  const vacancyRate = totalBeds > 0 ? ((totalBeds - occupiedBeds) / totalBeds * 100) : 0;
  const revenueImpact = dash.revenue_impact_pence || 0;
  const occupancyRate = totalBeds > 0 ? (occupiedBeds / totalBeds * 100) : 0;

  const isLowOccupancy = occupancyRate < 85;

  const historyRecords = (history as OccupancyRecord[]).slice(0, 12);
  const maxOccupancy = 100;

  const handleGenerateForecast = () => {
    generateForecast.mutate({ months_ahead: 3 });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Occupancy Forecasting</h1>
          <p className="page-subtitle">Track beds, predict trends, and plan ahead</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleGenerateForecast} disabled={generateForecast.isPending}>
            {generateForecast.isPending ? 'Generating...' : 'Generate Forecast'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowRecordForm(true)}>+ Record Occupancy</button>
        </div>
      </div>

      {/* Threshold Warning */}
      {isLowOccupancy && (
        <div style={{ padding: '16px 20px', background: 'rgba(220,38,38,.08)', border: '2px solid #dc2626', borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🚨</span>
          <div>
            <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '1rem' }}>Low Occupancy Alert</div>
            <div style={{ fontSize: '0.85rem', color: '#991b1b', marginTop: 2 }}>
              Occupancy is at {occupancyRate.toFixed(1)}% - below the 85% threshold. Immediate action recommended to fill vacancies.
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Beds', value: String(totalBeds), icon: '🛏️', color: '#6366f1' },
          { label: 'Occupied', value: String(occupiedBeds), icon: '👥', color: '#16a34a' },
          { label: 'Vacancy Rate', value: `${vacancyRate.toFixed(1)}%`, icon: '📉', color: vacancyRate > 15 ? '#dc2626' : '#d97706' },
          { label: 'Revenue Impact', value: revenueImpact ? `${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(revenueImpact / 100)}/mo` : 'N/A', icon: '💰', color: '#dc2626' },
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

      {/* Occupancy Trend Chart */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>Occupancy Trend (Last 12 Months)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200, padding: '0 8px', position: 'relative' }}>
            {/* 85% threshold line */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${(85 / maxOccupancy) * 100}%`, borderTop: '2px dashed #dc2626', zIndex: 1 }}>
              <span style={{ position: 'absolute', right: 0, top: -16, fontSize: '0.6rem', color: '#dc2626', fontWeight: 600 }}>85% threshold</span>
            </div>
            {loadingHistory ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading...</div>
            ) : historyRecords.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No occupancy data available</div>
            ) : (
              historyRecords.map((r, i) => {
                const rate = r.occupancy_rate || (r.total_beds > 0 ? (r.occupied_beds / r.total_beds * 100) : 0);
                const height = Math.max((rate / maxOccupancy) * 100, 3);
                const barColor = rate < 85 ? '#dc2626' : rate < 90 ? '#d97706' : '#16a34a';
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>{rate.toFixed(0)}%</div>
                    <div style={{ width: '100%', height: `${height}%`, background: barColor, borderRadius: '4px 4px 0 0', minHeight: 6, transition: 'height 0.3s ease' }} />
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {r.record_date ? new Date(r.record_date).toLocaleDateString('en-GB', { month: 'short' }) : `M${i + 1}`}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Forecasts Section */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>Predicted Vacancies (Next 3 Months)</h3>
          {loadingForecasts ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading forecasts...</div>
          ) : (forecasts as OccupancyForecast[]).length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No forecasts generated yet. Click "Generate Forecast" to create predictions.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {(forecasts as OccupancyForecast[]).slice(0, 6).map(f => {
                const predicted = f.predicted_occupancy || 0;
                const confidenceColor = predicted < 85 ? '#dc2626' : predicted < 90 ? '#d97706' : '#16a34a';
                return (
                  <div key={f.id} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface-2, #f9fafb)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{formatDate(f.forecast_date)}</span>
                      <span className={`badge ${predicted < 85 ? 'badge-danger' : predicted < 90 ? 'badge-warning' : 'badge-success'}`}>
                        {predicted.toFixed(1)}% occupancy
                      </span>
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ height: 8, borderRadius: 4, background: '#e5e7eb', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(predicted, 100)}%`, height: '100%', background: confidenceColor, borderRadius: 4, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span>Confidence: {f.confidence_low?.toFixed(1)}% - {f.confidence_high?.toFixed(1)}%</span>
                      <span>{f.model_type || 'Linear'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Suggested Marketing Actions */}
      {isLowOccupancy && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>Suggested Marketing Actions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {[
                { action: 'Run targeted social media campaign', priority: 'High', icon: '📱', description: 'Focus on local area demographics and families searching for care options.' },
                { action: 'Partner with discharge teams at local hospitals', priority: 'High', icon: '🏥', description: 'Build relationships with hospital discharge coordinators for referrals.' },
                { action: 'Host open day event', priority: 'Medium', icon: '🎉', description: 'Invite prospective families to tour the home and meet staff.' },
                { action: 'Update online listings and reviews', priority: 'Medium', icon: '⭐', description: 'Ensure carehome.co.uk and Google profiles are current with photos and reviews.' },
                { action: 'Offer respite care packages', priority: 'Low', icon: '🤝', description: 'Short-term respite stays can lead to permanent placements.' },
                { action: 'Contact local GP surgeries', priority: 'Low', icon: '👨‍⚕️', description: 'Distribute information packs to GP surgeries in the catchment area.' },
              ].map((a, i) => (
                <div key={i} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 8, borderLeft: `3px solid ${a.priority === 'High' ? '#dc2626' : a.priority === 'Medium' ? '#d97706' : '#6366f1'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{a.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.action}</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>{a.description}</div>
                  <span className={`badge ${a.priority === 'High' ? 'badge-danger' : a.priority === 'Medium' ? 'badge-warning' : 'badge-primary'}`}>
                    {a.priority} Priority
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showRecordForm && <RecordOccupancyModal onClose={() => setShowRecordForm(false)} />}
    </div>
  );
}

function RecordOccupancyModal({ onClose }: { onClose: () => void }) {
  const record = useRecordOccupancy();
  const [form, setForm] = useState({
    record_date: new Date().toISOString().slice(0, 10),
    total_beds: '',
    occupied_beds: '',
    notes: '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await record.mutateAsync({
      record_date: form.record_date,
      total_beds: parseInt(form.total_beds) || 0,
      occupied_beds: parseInt(form.occupied_beds) || 0,
      notes: form.notes,
    });
    onClose();
  };

  const totalBeds = parseInt(form.total_beds) || 0;
  const occupied = parseInt(form.occupied_beds) || 0;
  const occupancyPreview = totalBeds > 0 ? ((occupied / totalBeds) * 100).toFixed(1) : '0';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 className="modal-title">Record Occupancy</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input className="form-input" type="date" required value={form.record_date} onChange={e => set('record_date', e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Total Beds *</label>
                <input className="form-input" type="number" min="0" required value={form.total_beds} onChange={e => set('total_beds', e.target.value)} placeholder="e.g. 60" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Occupied *</label>
                <input className="form-input" type="number" min="0" required value={form.occupied_beds} onChange={e => set('occupied_beds', e.target.value)} placeholder="e.g. 52" />
              </div>
            </div>
            {totalBeds > 0 && (
              <div style={{ padding: '10px 12px', background: 'var(--surface-2, #f9fafb)', borderRadius: 6, marginBottom: 14, fontSize: '0.85rem' }}>
                Occupancy rate: <strong style={{ color: parseFloat(occupancyPreview) < 85 ? '#dc2626' : '#16a34a' }}>{occupancyPreview}%</strong>
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={record.isPending}>{record.isPending ? 'Saving...' : 'Record'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
