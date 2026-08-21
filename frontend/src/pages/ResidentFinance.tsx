import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useResidentBalances, useResidentLedger, useAddLedgerEntry, useResidents, useStaff } from '../hooks';

// Resident personal allowance ledger.
// Money held on a resident's behalf, with a running balance, a named recorder
// and a witness for anything going out. Mistakes are corrected with a
// reversing entry — nothing is ever edited or deleted.

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function money(n: number) {
  return `£${Number(n || 0).toFixed(2)}`;
}

export default function ResidentFinance() {
  const { t: tr } = useLang();
  const [residentId, setResidentId] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<any>({
    residentId: '', direction: 'in', amount: '', category: 'deposit',
    description: '', entryDate: '', witnessedBy: '',
  });

  const { data: balances } = useResidentBalances();
  const { data: ledger } = useResidentLedger(residentId);
  const { data: residents } = useResidents();
  const { data: staff } = useStaff();
  const addEntry = useAddLedgerEntry();

  const rows: any[] = balances?.residents || [];
  const residentList: any[] = Array.isArray(residents) ? residents : [];
  const staffList: any[] = Array.isArray(staff) ? staff : ((staff as any)?.staff || []);
  const categories: any[] = balances?.categories || ledger?.categories || [];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">{tr('Personal Allowance')}</h1>
          <p className="page-subtitle">
            Money the home holds for residents — hairdressing, chiropody, newspapers, outings.
            Local authorities audit this, and mishandling it is a safeguarding matter.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ ...form, residentId: residentId || '' }); setAddOpen(true); }}>
          Record money in or out
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card"><div className="card-body" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total held</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, marginTop: 4 }}>{money(balances?.totalHeld || 0)}</div>
        </div></div>
        <div className="card"><div className="card-body" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Residents with an account</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, marginTop: 4 }}>{rows.length}</div>
        </div></div>
        <div className="card"><div className="card-body" style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Negative balances</div>
          <div style={{ fontSize: '1.9rem', fontWeight: 700, marginTop: 4, color: (balances?.negativeBalances || 0) > 0 ? '#b91c1c' : '#059669' }}>
            {balances?.negativeBalances ?? 0}
          </div>
        </div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) 2fr', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Balances</span></div>
          {rows.length === 0 ? (
            <div className="card-body table-empty">No accounts yet.</div>
          ) : (
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {rows.map(r => (
                <div key={r.residentId}
                  onClick={() => setResidentId(r.residentId)}
                  style={{
                    padding: '12px 18px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                    background: residentId === r.residentId ? '#eef2ff' : undefined,
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{r.residentName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Room {r.roomNumber} · last entry {fmtDate(r.lastEntry)}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: r.negative ? '#b91c1c' : '#0f172a', whiteSpace: 'nowrap' }}>
                      {money(r.balance)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">
              {ledger ? `${ledger.residentName} — ${money(ledger.balance)}` : 'Ledger'}
            </span>
          </div>
          {!residentId ? (
            <div className="card-body table-empty">Choose a resident to see their ledger.</div>
          ) : !ledger ? (
            <div className="card-body">Loading…</div>
          ) : ledger.entries.length === 0 ? (
            <div className="card-body table-empty">No entries yet for {ledger.residentName}.</div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Date</th><th>What for</th><th>In</th><th>Out</th><th>Balance</th><th>Recorded / witnessed</th></tr></thead>
                <tbody>
                  {ledger.entries.map((e: any) => (
                    <tr key={e.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.entryDate)}</td>
                      <td>
                        {e.categoryLabel}
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{e.description}</div>
                      </td>
                      <td style={{ color: '#059669', fontWeight: 600 }}>{e.direction === 'in' ? money(e.amount) : ''}</td>
                      <td style={{ color: '#b91c1c', fontWeight: 600 }}>{e.direction === 'out' ? money(e.amount) : ''}</td>
                      <td style={{ fontWeight: 600 }}>{e.balanceAfter != null ? money(e.balanceAfter) : '—'}</td>
                      <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {e.recordedByName || '—'}
                        {e.witnessedByName && <div>witness: {e.witnessedByName}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {addOpen && (
        <div className="modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Record money in or out</span>
              <button className="modal-close" onClick={() => setAddOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Resident</label>
                <select className="form-input" value={form.residentId} onChange={e => setForm({ ...form, residentId: e.target.value })}>
                  <option value="">Choose a resident…</option>
                  {residentList.map(r => (
                    <option key={r.id} value={r.id}>{r.first_name || r.firstName} {r.last_name || r.lastName} — Room {r.room_number || r.roomNumber}</option>
                  ))}
                </select>
              </div>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Direction</label>
                  <select className="form-input" value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}>
                    <option value="in">Money in</option>
                    <option value="out">Money out</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (£)</label>
                  <input className="form-input" type="number" step="0.01" min="0.01" value={form.amount}
                    onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">What for</label>
                <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {categories.map((c: any) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" placeholder="e.g. Hairdresser, 21 August — receipt attached" value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={form.entryDate} onChange={e => setForm({ ...form, entryDate: e.target.value })} />
              </div>
              {form.direction === 'out' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Witnessed by</label>
                    <select className="form-input" value={form.witnessedBy} onChange={e => setForm({ ...form, witnessedBy: e.target.value })}>
                      <option value="">Choose a second member of staff…</option>
                      {staffList.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.first_name || s.firstName} {s.last_name || s.lastName}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#92400e', background: '#fffbeb', padding: '8px 12px', borderRadius: 6 }}>
                    Money going out always needs a second pair of eyes. This is the control that prevents
                    the most common form of financial abuse in care settings.
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={addEntry.isPending}
                onClick={() => addEntry.mutate(form as any, {
                  onSuccess: () => { setAddOpen(false); setForm({ ...form, amount: '', description: '', witnessedBy: '' }); },
                })}>
                {addEntry.isPending ? 'Saving…' : 'Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
