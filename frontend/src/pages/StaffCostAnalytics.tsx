// src/pages/StaffCostAnalytics.tsx
import React, { useState } from 'react';
import { useStaffCostsSummary, useStaffCostsPerResident, useStaffCostsBudgetVsActual, useStaffCostsBudgets, useCreateStaffCostBudget } from '../hooks';
import { formatDate, formatPence } from '../utils/formatters';
import type { CostBudget } from '../types';

export default function StaffCostAnalytics() {
  const [tab, setTab] = useState<'overview' | 'budgets'>('overview');
  const [showBudgetForm, setShowBudgetForm] = useState(false);

  const { data: summary } = useStaffCostsSummary();
  const { data: perResident } = useStaffCostsPerResident();
  const { data: budgetVsActual = [] } = useStaffCostsBudgetVsActual();
  const { data: budgets = [] } = useStaffCostsBudgets();

  const summ = summary || {} as any;
  const totalCost = summ.total_cost_pence || 0;
  const overtimeSpend = summ.overtime_cost_pence || 0;
  const agencyCost = summ.agency_cost_pence || 0;
  const costPerResidentDay = (perResident as any)?.cost_per_resident_day_pence || 0;
  const monthlyBreakdown = summ.monthly_breakdown || [];
  const staffTypeCosts = summ.staff_type_costs || {};

  const permanentCost = totalCost - agencyCost;
  const totalForComparison = Math.max(permanentCost, agencyCost, 1);

  const maxMonthlyCost = Math.max(...(monthlyBreakdown.length ? monthlyBreakdown.map((m: any) => (m.regular_cost_pence || 0) + (m.overtime_cost_pence || 0)) : [1]));

  const handleExportCsv = () => {
    const budgetData = budgetVsActual as CostBudget[];
    if (budgetData.length === 0) return;

    const headers = ['Budget Name', 'Period Start', 'Period End', 'Budget Amount', 'Actual Amount', 'Variance', 'Status'];
    const rows = budgetData.map(b => [
      b.budget_name,
      b.period_start,
      b.period_end,
      ((b.budget_amount_pence || 0) / 100).toFixed(2),
      ((b.actual_amount_pence || 0) / 100).toFixed(2),
      ((b.variance_pence || 0) / 100).toFixed(2),
      b.status,
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `staff-costs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Cost Analytics</h1>
          <p className="page-subtitle">Overtime, agency costs, and budget tracking</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleExportCsv}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => setShowBudgetForm(true)}>+ Create Budget</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Staff Cost', value: formatPence(totalCost), icon: '💰', color: '#6366f1' },
          { label: 'Overtime Spend', value: formatPence(overtimeSpend), icon: '⏱️', color: '#d97706' },
          { label: 'Agency Cost', value: formatPence(agencyCost), icon: '🏢', color: '#dc2626' },
          { label: 'Cost Per Resident/Day', value: formatPence(costPerResidentDay), icon: '👤', color: '#16a34a' },
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
          {(['overview', 'budgets'] as const).map(t => (
            <button
              key={t}
              className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              onClick={() => setTab(t)}
              style={{ textTransform: 'capitalize' }}
            >
              {t === 'overview' ? 'Cost Overview' : 'Budget vs Actual'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <>
          {/* Overtime vs Basic Hours Chart */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>Overtime vs Basic Hours Cost (Monthly)</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200, padding: '0 8px' }}>
                {monthlyBreakdown.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No cost data available</div>
                ) : (
                  monthlyBreakdown.map((m: any, i: number) => {
                    const regularCost = m.regular_cost_pence || 0;
                    const overtimeCost = m.overtime_cost_pence || 0;
                    const totalHeight = maxMonthlyCost > 0 ? (((regularCost + overtimeCost) / maxMonthlyCost) * 100) : 5;
                    const overtimePercent = (regularCost + overtimeCost) > 0 ? (overtimeCost / (regularCost + overtimeCost)) * 100 : 0;
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 500 }}>{formatPence(regularCost + overtimeCost)}</div>
                        <div style={{ width: '100%', height: `${Math.max(totalHeight, 5)}%`, borderRadius: '4px 4px 0 0', minHeight: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ height: `${overtimePercent}%`, background: '#d97706', minHeight: overtimeCost > 0 ? 3 : 0 }} />
                          <div style={{ flex: 1, background: '#6366f1' }} />
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{m.month_label || `M${i + 1}`}</div>
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: '#6366f1' }} />
                  <span>Basic Hours</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: '#d97706' }} />
                  <span>Overtime</span>
                </div>
              </div>
            </div>
          </div>

          {/* Agency vs Permanent Cost Comparison */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body">
              <h3 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>Agency vs Permanent Staff Cost</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Permanent Staff</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#6366f1' }}>{formatPence(permanentCost)}</span>
                  </div>
                  <div style={{ height: 24, borderRadius: 6, background: '#e5e7eb', overflow: 'hidden' }}>
                    <div style={{ width: `${totalForComparison > 0 ? (permanentCost / (permanentCost + agencyCost)) * 100 : 50}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #818cf8)', borderRadius: 6, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Agency Staff</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>{formatPence(agencyCost)}</span>
                  </div>
                  <div style={{ height: 24, borderRadius: 6, background: '#e5e7eb', overflow: 'hidden' }}>
                    <div style={{ width: `${(permanentCost + agencyCost) > 0 ? (agencyCost / (permanentCost + agencyCost)) * 100 : 50}%`, height: '100%', background: 'linear-gradient(90deg, #dc2626, #f87171)', borderRadius: 6, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Agency as % of Total</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: agencyCost > (totalCost * 0.2) ? '#dc2626' : '#16a34a' }}>
                    {totalCost > 0 ? ((agencyCost / totalCost) * 100).toFixed(1) : '0'}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'budgets' && (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Budget</th>
                  <th>Period</th>
                  <th>Budget Amount</th>
                  <th>Actual</th>
                  <th>Variance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(budgetVsActual as CostBudget[]).length === 0 ? (
                  <tr><td colSpan={6} className="table-empty">No budgets found. Create one to track spending.</td></tr>
                ) : (
                  (budgetVsActual as CostBudget[]).map(b => {
                    const variance = b.variance_pence || 0;
                    const isOver = variance > 0;
                    return (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 500 }}>{b.budget_name}</td>
                        <td style={{ fontSize: '0.82rem' }}>{formatDate(b.period_start)} - {formatDate(b.period_end)}</td>
                        <td>{formatPence(b.budget_amount_pence)}</td>
                        <td style={{ fontWeight: 600 }}>{formatPence(b.actual_amount_pence || 0)}</td>
                        <td style={{ fontWeight: 600, color: isOver ? '#dc2626' : '#16a34a' }}>
                          {isOver ? '+' : ''}{formatPence(Math.abs(variance))}
                          <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>{isOver ? 'over' : 'under'}</span>
                        </td>
                        <td>
                          <span className={`badge ${b.status === 'over_budget' ? 'badge-danger' : b.status === 'under_budget' ? 'badge-success' : 'badge-primary'}`} style={{ textTransform: 'capitalize' }}>
                            {(b.status || 'on_track').replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showBudgetForm && <CreateBudgetModal onClose={() => setShowBudgetForm(false)} />}
    </div>
  );
}

function CreateBudgetModal({ onClose }: { onClose: () => void }) {
  const create = useCreateStaffCostBudget();
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    budget_name: '',
    period_start: firstOfMonth,
    period_end: lastOfMonth,
    budget_amount: '',
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create.mutateAsync({
      budget_name: form.budget_name,
      period_start: form.period_start,
      period_end: form.period_end,
      budget_amount_pence: Math.round(parseFloat(form.budget_amount) * 100) || 0,
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h2 className="modal-title">Create Budget</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Budget Name *</label>
              <input className="form-input" required value={form.budget_name} onChange={e => set('budget_name', e.target.value)} placeholder="e.g. Monthly Staff Budget - June" />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Period Start *</label>
                <input className="form-input" type="date" required value={form.period_start} onChange={e => set('period_start', e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Period End *</label>
                <input className="form-input" type="date" required value={form.period_end} onChange={e => set('period_end', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Budget Amount (GBP) *</label>
              <input className="form-input" type="number" step="0.01" min="0" required value={form.budget_amount} onChange={e => set('budget_amount', e.target.value)} placeholder="e.g. 50000.00" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={create.isPending}>{create.isPending ? 'Creating...' : 'Create Budget'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
