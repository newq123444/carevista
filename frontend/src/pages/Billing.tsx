// src/pages/Billing.tsx
import React, { useState } from 'react';
import { useInvoices, useCreateInvoice, useUpdateInvoiceStatus, useResidents } from '../hooks';
import { formatDate, formatPence, FUNDING_LABELS } from '../utils/formatters';
import type { Invoice, Resident } from '../types';

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-neutral', sent: 'badge-primary', paid: 'badge-success',
  overdue: 'badge-danger', cancelled: 'badge-neutral',
};

export default function Billing() {
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [updating, setUpdating] = useState<Invoice | null>(null);

  const { data: invoices = [], isLoading } = useInvoices({ status: statusFilter || undefined });
  const { data: residents = [] } = useResidents({ active: true });

  const totalOutstanding = (invoices as Invoice[])
    .filter(i => ['sent', 'overdue'].includes(i.status))
    .reduce((sum, i) => sum + i.total_pence, 0);

  const totalPaidThisMonth = (invoices as Invoice[])
    .filter(i => {
      if (i.status !== 'paid') return false;
      const paid = new Date(i.paid_date || '');
      const now = new Date();
      return paid.getMonth() === now.getMonth() && paid.getFullYear() === now.getFullYear();
    })
    .reduce((sum, i) => sum + i.total_pence, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing & Invoices</h1>
          <p className="page-subtitle">{invoices.length} invoices</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Create Invoice</button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Outstanding',      value: formatPence(totalOutstanding),       icon: '💷', color: '#dc2626' },
          { label: 'Paid This Month',  value: formatPence(totalPaidThisMonth),     icon: '✅', color: '#16a34a' },
          { label: 'Overdue Invoices', value: String((invoices as Invoice[]).filter(i => i.status === 'overdue').length), icon: '⏰', color: '#d97706' },
          { label: 'Drafts',           value: String((invoices as Invoice[]).filter(i => i.status === 'draft').length),   icon: '📄', color: '#6366f1' },
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

      {/* Filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: 'flex', gap: 10 }}>
          {['', 'draft', 'sent', 'paid', 'overdue', 'cancelled'].map(s => (
            <button
              key={s}
              className={`btn ${statusFilter === s ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              onClick={() => setStatusFilter(s)}
              style={{ textTransform: 'capitalize' }}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>Invoice #</th><th>Resident</th><th>Period</th><th>Amount</th><th>Payer</th><th>Status</th><th>Due Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => <tr key={i}><td colSpan={8}><div style={{ height: 14, background: 'var(--border)', borderRadius: 4 }} /></td></tr>)
              ) : invoices.length === 0 ? (
                <tr><td colSpan={8} className="table-empty">No invoices found</td></tr>
              ) : (
                (invoices as Invoice[]).map(inv => (
                  <tr key={inv.id} style={{ background: inv.status === 'overdue' ? 'rgba(196,54,39,.04)' : undefined }}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>{inv.invoice_number}</span></td>
                    <td style={{ fontWeight: 500 }}>{inv.resident_name || '—'}</td>
                    <td style={{ fontSize: '0.82rem' }}>{inv.period_label || `${formatDate(inv.period_start)} – ${formatDate(inv.period_end)}`}</td>
                    <td style={{ fontWeight: 600 }}>{formatPence(inv.total_pence)}</td>
                    <td style={{ fontSize: '0.82rem' }}>{inv.payer_name || '—'}<br /><span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{FUNDING_LABELS[inv.payer_type || ''] || ''}</span></td>
                    <td><span className={`badge ${STATUS_BADGE[inv.status]}`} style={{ textTransform: 'capitalize' }}>{inv.status}</span></td>
                    <td style={{ fontSize: '0.82rem', color: inv.status === 'overdue' ? 'var(--danger)' : undefined }}>{formatDate(inv.due_date)}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => setUpdating(inv)}>Update</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateInvoiceModal residents={residents as Resident[]} onClose={() => setShowCreate(false)} />}
      {updating && <UpdateInvoiceModal invoice={updating} onClose={() => setUpdating(null)} />}
    </div>
  );
}

function CreateInvoiceModal({ residents, onClose }: { residents: Resident[]; onClose: () => void }) {
  const create = useCreateInvoice();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastOfMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [form, setForm] = useState({
    resident_id: '', period_start: firstOfMonth, period_end: lastOfMonth,
    amount_pence: '', vat_pence: '0', payer_name: '', payer_type: 'self_funded',
    due_date: '', notes: '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const total = (parseFloat(form.amount_pence as any) || 0) + (parseFloat(form.vat_pence as any) || 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      ...form,
      amount_pence: Math.round(parseFloat(form.amount_pence as any) * 100) || 0,
      vat_pence:    Math.round(parseFloat(form.vat_pence as any) * 100) || 0,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header"><h2 className="modal-title">Create Invoice</h2><button className="modal-close" onClick={onClose}>×</button></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-group"><label className="form-label">Resident *</label>
              <select className="form-input" required value={form.resident_id} onChange={e => {
                const r = residents.find(r => r.id === e.target.value);
                set('resident_id', e.target.value);
                if (r) { set('payer_type', r.funding_type); set('amount_pence', (r.weekly_fee_pence / 100 * 4).toFixed(2)); }
              }}>
                <option value="">Select resident…</option>
                {residents.map(r => <option key={r.id} value={r.id}>{r.first_name} {r.last_name} — {FUNDING_LABELS[r.funding_type]}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Period Start *</label><input className="form-input" type="date" required value={form.period_start} onChange={e => set('period_start', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Period End *</label><input className="form-input" type="date" required value={form.period_end} onChange={e => set('period_end', e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Amount (£) *</label><input className="form-input" type="number" step="0.01" required value={form.amount_pence} onChange={e => set('amount_pence', e.target.value)} placeholder="e.g. 5000.00" /></div>
              <div className="form-group"><label className="form-label">VAT (£)</label><input className="form-input" type="number" step="0.01" value={form.vat_pence} onChange={e => set('vat_pence', e.target.value)} placeholder="0.00" /></div>
            </div>
            {total > 0 && <div style={{ padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', marginBottom: 14, fontSize: '0.88rem' }}>
              Total: <strong>{formatPence(total * 100)}</strong>
            </div>}
            <div className="form-row">
              <div className="form-group"><label className="form-label">Payer Name</label><input className="form-input" value={form.payer_name} onChange={e => set('payer_name', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Payer Type</label>
                <select className="form-input" value={form.payer_type} onChange={e => set('payer_type', e.target.value)}>
                  {Object.entries(FUNDING_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group"><label className="form-label">Due Date</label><input className="form-input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create Invoice'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UpdateInvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const update = useUpdateInvoiceStatus();
  const [form, setForm] = useState({ status: invoice.status, paid_date: invoice.paid_date?.slice(0, 10) || '', notes: invoice.notes || '' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await update.mutateAsync({ id: invoice.id, data: form });
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header"><h2 className="modal-title">Update Invoice</h2><button className="modal-close" onClick={onClose}>×</button></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div style={{ marginBottom: 14, fontSize: '0.87rem' }}><strong>{invoice.invoice_number}</strong> · {invoice.resident_name} · {formatPence(invoice.total_pence)}</div>
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>
                <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
            {form.status === 'paid' && (
              <div className="form-group"><label className="form-label">Paid Date</label><input className="form-input" type="date" value={form.paid_date} onChange={e => setForm(f => ({ ...f, paid_date: e.target.value }))} /></div>
            )}
            <div className="form-group"><label className="form-label">Notes</label><textarea className="form-input" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
