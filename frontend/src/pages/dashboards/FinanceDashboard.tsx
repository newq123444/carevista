// src/pages/dashboards/FinanceDashboard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useInvoices, useResidents } from '../../hooks';
import { formatPence, formatDate } from '../../utils/formatters';
import type { Invoice } from '../../types';

export default function FinanceDashboard() {
  const { user } = useAuthStore();
  const { data: allInvoices = [] } = useInvoices();
  const { data: residents = [] } = useResidents({ active: true });

  const invoices = allInvoices as Invoice[];
  const overdue = invoices.filter(i => i.status === 'overdue');
  const sent = invoices.filter(i => i.status === 'sent');
  const draft = invoices.filter(i => i.status === 'draft');
  const paidThisMonth = invoices.filter(i => {
    if (i.status !== 'paid') return false;
    const d = new Date(i.paid_date || '');
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  });

  const totalOverdue = overdue.reduce((s, i) => s + i.total_pence, 0);
  const totalSent = sent.reduce((s, i) => s + i.total_pence, 0);
  const totalPaid = paidThisMonth.reduce((s, i) => s + i.total_pence, 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}, {user?.firstName} 💷</h1>
          <p className="page-subtitle">Finance · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <Link to="/billing" className="btn btn-primary">+ Create Invoice</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Overdue', value: formatPence(totalOverdue), sub: `${overdue.length} invoice${overdue.length !== 1 ? 's' : ''}`, color: '#dc2626', icon: '⛔' },
          { label: 'Awaiting Payment', value: formatPence(totalSent), sub: `${sent.length} sent`, color: '#d97706', icon: '⏳' },
          { label: 'Paid This Month', value: formatPence(totalPaid), sub: `${paidThisMonth.length} invoices`, color: '#16a34a', icon: '✅' },
          { label: 'Draft Invoices', value: draft.length.toString(), sub: 'Ready to send', color: '#6366f1', icon: '📄' },
        ].map(k => (
          <Link key={k.label} to="/billing" style={{ textDecoration: 'none' }}>
            <div style={{ padding: '18px 16px', borderRadius: 12, background: 'white', border: `1px solid var(--border)`, borderLeft: `4px solid ${k.color}`, boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{k.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{k.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{k.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">⛔ Overdue Invoices</span><Link to="/billing" className="btn btn-ghost btn-sm">View All →</Link></div>
          <div className="card-body" style={{ padding: 0 }}>
            {overdue.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>✅ No overdue invoices</div>
            ) : overdue.slice(0, 6).map(inv => (
              <div key={inv.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.resident_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.invoice_number} · Due {formatDate(inv.due_date)}</div>
                </div>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>{formatPence(inv.total_pence)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-title">⏳ Awaiting Payment</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            {sent.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No pending invoices</div>
            ) : sent.slice(0, 6).map(inv => (
              <div key={inv.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{inv.resident_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{inv.payer_type?.replace(/_/g, ' ')} · {inv.period_label}</div>
                </div>
                <span style={{ fontWeight: 700, color: '#d97706' }}>{formatPence(inv.total_pence)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
