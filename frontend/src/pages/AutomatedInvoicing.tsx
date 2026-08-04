// src/pages/AutomatedInvoicing.tsx
import React, { useState } from 'react';
import { useRateUplifts, useCreateRateUplift, useApproveRateUplift, usePaymentReminders, useRevenueDashboard, useResidents } from '../hooks';
import { formatDate, formatPence } from '../utils/formatters';
import type { RateUplift, PaymentReminder, Resident } from '../types';

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-danger',
  sent: 'badge-primary',
  paid: 'badge-success',
};

export default function AutomatedInvoicing() {
  const [tab, setTab] = useState<'dashboard' | 'uplifts' | 'reminders'>('dashboard');
  const [showUpliftForm, setShowUpliftForm] = useState(false);

  const { data: dashboard } = useRevenueDashboard();
  const { data: uplifts = [], isLoading: loadingUplifts } = useRateUplifts();
  const { data: reminders = [], isLoading: loadingReminders } = usePaymentReminders();
  const { data: residents = [] } = useResidents({ active: true });
  const approveUplift = useApproveRateUplift();

  const dash = dashboard || {} as any;
  const monthlyRevenue = dash.monthly_revenue_pence || 0;
  const outstanding = dash.outstanding_pence || 0;
  const overdueCount = dash.overdue_count || 0;
  const averageRate = dash.average_rate_pence || 0;
  const monthlyBreakdown = dash.monthly_breakdown || [];

  const maxRevenue = Math.max(...(monthlyBreakdown.length ? monthlyBreakdown.map((m: any) => m.revenue_pence || 0) : [1]));

  const handleApprove = (id: string) => {
    approveUplift.mutate({ id, data: { status: 'approved' } });
  };
  const handleReject = (id: string) => {
    approveUplift.mutate({ id, data: { status: 'rejected' } });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Automated Invoicing</h1>
          <p className="page-subtitle">Revenue dashboard, rate uplifts, and payment reminders</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUpliftForm(true)}>+ New Rate Uplift</button>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Monthly Revenue', value: formatPence(monthlyRevenue), icon: '💷', color: '#16a34a' },
          { label: 'Outstanding', value: formatPence(outstanding), icon: '📊', color: '#d97706' },
          { label: 'Overdue Count', value: String(overdueCount), icon: '⏰', color: '#dc2626' },
          { label: 'Avg Weekly Rate', value: formatPence(averageRate), icon: '📈', color: '#6366f1' },
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

      {/* Tab Filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 10 }}>
          {(['dashboard', 'uplifts', 'reminders'] as const).map(t => (
            <button
              key={t}
              className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              onClick={() => setTab(t)}
              style={{ textTransform: 'capitalize' }}
            >
              {t === 'dashboard' ? 'Revenue Dashboard' : t === 'uplifts' ? 'Rate Uplifts' : 'Payment Reminders'}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Dashboard */}
      {tab === 'dashboard' && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>Monthly Revenue (Last 12 Months)</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200, padding: '0 8px' }}>
              {monthlyBreakdown.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No revenue data available</div>
              ) : (
                monthlyBreakdown.map((m: any, i: number) => {
                  const height = maxRevenue > 0 ? Math.max((m.revenue_pence / maxRevenue) * 100, 5) : 5;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>{formatPence(m.revenue_pence)}</div>
                      <div style={{ width: '100%', height: `${height}%`, background: 'linear-gradient(180deg, #16a34a, #22c55e)', borderRadius: '4px 4px 0 0', minHeight: 8, transition: 'height 0.3s ease' }} />
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{m.month_label || `M${i + 1}`}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rate Uplifts Table */}
      {tab === 'uplifts' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Resident</th>
                  <th>Previous Rate</th>
                  <th>New Rate</th>
                  <th>Effective Date</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUplifts ? (
                  [...Array(3)].map((_, i) => <tr key={i}><td colSpan={7}><div style={{ height: 14, background: 'var(--border)', borderRadius: 4 }} /></td></tr>)
                ) : (uplifts as RateUplift[]).length === 0 ? (
                  <tr><td colSpan={7} className="table-empty">No rate uplifts found</td></tr>
                ) : (
                  (uplifts as RateUplift[]).map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.resident_name || 'Unknown'}</td>
                      <td>{formatPence(u.previous_rate_pence)}</td>
                      <td style={{ fontWeight: 600, color: '#16a34a' }}>{formatPence(u.new_rate_pence)}</td>
                      <td style={{ fontSize: '0.82rem' }}>{formatDate(u.effective_date)}</td>
                      <td style={{ fontSize: '0.82rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.reason || '-'}</td>
                      <td><span className={`badge ${STATUS_BADGE[u.status]}`} style={{ textTransform: 'capitalize' }}>{u.status}</span></td>
                      <td>
                        {u.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary btn-sm" onClick={() => handleApprove(u.id)} disabled={approveUplift.isPending}>Approve</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleReject(u.id)} disabled={approveUplift.isPending}>Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Reminders */}
      {tab === 'reminders' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Resident</th>
                  <th>Payer</th>
                  <th>Amount Due</th>
                  <th>Due Date</th>
                  <th>Days Overdue</th>
                  <th>Status</th>
                  <th>Last Reminder</th>
                </tr>
              </thead>
              <tbody>
                {loadingReminders ? (
                  [...Array(3)].map((_, i) => <tr key={i}><td colSpan={8}><div style={{ height: 14, background: 'var(--border)', borderRadius: 4 }} /></td></tr>)
                ) : (reminders as PaymentReminder[]).length === 0 ? (
                  <tr><td colSpan={8} className="table-empty">No payment reminders</td></tr>
                ) : (
                  (reminders as PaymentReminder[]).map(r => (
                    <tr key={r.id} style={{ background: r.days_overdue > 30 ? 'rgba(196,54,39,.04)' : undefined }}>
                      <td><span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>{r.invoice_number || '-'}</span></td>
                      <td style={{ fontWeight: 500 }}>{r.resident_name || '-'}</td>
                      <td style={{ fontSize: '0.82rem' }}>{r.payer_name || '-'}</td>
                      <td style={{ fontWeight: 600 }}>{formatPence(r.amount_due_pence)}</td>
                      <td style={{ fontSize: '0.82rem' }}>{formatDate(r.due_date)}</td>
                      <td style={{ fontWeight: 600, color: r.days_overdue > 30 ? '#dc2626' : r.days_overdue > 14 ? '#d97706' : undefined }}>{r.days_overdue} days</td>
                      <td><span className={`badge ${STATUS_BADGE[r.status]}`} style={{ textTransform: 'capitalize' }}>{r.status}</span></td>
                      <td style={{ fontSize: '0.82rem' }}>{r.reminder_sent_at ? formatDate(r.reminder_sent_at) : 'Never'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showUpliftForm && <CreateUpliftModal residents={residents as Resident[]} onClose={() => setShowUpliftForm(false)} />}
    </div>
  );
}

function CreateUpliftModal({ residents, onClose }: { residents: Resident[]; onClose: () => void }) {
  const create = useCreateRateUplift();
  const [form, setForm] = useState({
    resident_id: '',
    previous_rate_pence: '',
    new_rate_pence: '',
    effective_date: new Date().toISOString().slice(0, 10),
    reason: '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      resident_id: form.resident_id,
      previous_rate_pence: Math.round(parseFloat(form.previous_rate_pence) * 100) || 0,
      new_rate_pence: Math.round(parseFloat(form.new_rate_pence) * 100) || 0,
      effective_date: form.effective_date,
      reason: form.reason,
    });
    onClose();
  };

  const selectedResident = (residents as Resident[]).find(r => r.id === form.resident_id);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">Create Rate Uplift</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Resident *</label>
              <select className="form-input" required value={form.resident_id} onChange={e => {
                set('resident_id', e.target.value);
                const r = residents.find(r => r.id === e.target.value);
                if (r && r.weekly_fee_pence) {
                  set('previous_rate_pence', (r.weekly_fee_pence / 100).toFixed(2));
                }
              }}>
                <option value="">Select resident...</option>
                {(residents as Resident[]).map(r => (
                  <option key={r.id} value={r.id}>{r.first_name} {r.last_name}</option>
                ))}
              </select>
            </div>
            {selectedResident && (
              <div style={{ padding: '8px 12px', background: 'var(--surface-2, #f9fafb)', borderRadius: 6, marginBottom: 14, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Current weekly rate: {selectedResident.weekly_fee_pence ? formatPence(selectedResident.weekly_fee_pence) : 'Not set'}
              </div>
            )}
            <div className="form-row" style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Old Rate (weekly, GBP) *</label>
                <input className="form-input" type="number" step="0.01" required value={form.previous_rate_pence} onChange={e => set('previous_rate_pence', e.target.value)} placeholder="e.g. 1200.00" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">New Rate (weekly, GBP) *</label>
                <input className="form-input" type="number" step="0.01" required value={form.new_rate_pence} onChange={e => set('new_rate_pence', e.target.value)} placeholder="e.g. 1350.00" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Effective Date *</label>
              <input className="form-input" type="date" required value={form.effective_date} onChange={e => set('effective_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Reason</label>
              <textarea className="form-input" rows={3} value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Reason for rate change..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={create.isPending}>{create.isPending ? 'Creating...' : 'Submit Rate Uplift'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
