import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useAppointments, useAppointmentSummary, useCreateAppointment, useUpdateAppointment, useResidents, useStaff } from '../hooks';

// Healthcare appointments and visiting professionals.
// A missed chiropody visit for a diabetic resident, or an unbooked GP review
// after a fall, is exactly the kind of gap that shows up later as harm.

function fmtDateTime(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const LOCATIONS = [
  { value: 'in_home', label: 'Here in the home' },
  { value: 'clinic', label: 'Clinic / surgery' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'video', label: 'Video call' },
  { value: 'telephone', label: 'Telephone' },
];

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  scheduled:      { bg: '#dbeafe', fg: '#1e40af', label: 'Booked' },
  attended:       { bg: '#d1fae5', fg: '#065f46', label: 'Attended' },
  did_not_attend: { bg: '#fee2e2', fg: '#991b1b', label: 'Did not attend' },
  cancelled:      { bg: '#f1f5f9', fg: '#475569', label: 'Cancelled' },
  rescheduled:    { bg: '#fef3c7', fg: '#92400e', label: 'Rescheduled' },
};

function Kpi({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="card"><div className="card-body" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</div>
      <div style={{ fontSize: '1.9rem', fontWeight: 700, color: tone || '#0f172a', marginTop: 4 }}>{value}</div>
    </div></div>
  );
}

export default function Appointments() {
  const { t: tr } = useLang();
  const [scope, setScope] = useState('upcoming');
  const [addOpen, setAddOpen] = useState(false);
  const [outcomeFor, setOutcomeFor] = useState<any>(null);
  const [form, setForm] = useState<any>({
    residentId: '', appointmentType: 'gp', professionalName: '', organisation: '',
    scheduledAt: '', location: 'in_home', reason: '', escortRequired: false,
    escortStaffId: '', transportNotes: '',
  });
  const [outcome, setOutcome] = useState<any>({ status: 'attended', outcome: '', actionsRequired: '', medicationChanged: false, followUpDate: '' });

  const { data: summary } = useAppointmentSummary();
  const { data: appts } = useAppointments({ scope });
  const { data: residents } = useResidents();
  const { data: staff } = useStaff();
  const create = useCreateAppointment();
  const update = useUpdateAppointment();

  const list: any[] = Array.isArray(appts) ? appts : [];
  const residentList: any[] = Array.isArray(residents) ? residents : [];
  const staffList: any[] = Array.isArray(staff) ? staff : ((staff as any)?.staff || []);
  const types: any[] = summary?.types || [];

  function submitNew() {
    create.mutate(form as any, {
      onSuccess: () => {
        setAddOpen(false);
        setForm({ residentId: '', appointmentType: 'gp', professionalName: '', organisation: '', scheduledAt: '', location: 'in_home', reason: '', escortRequired: false, escortStaffId: '', transportNotes: '' });
      },
    });
  }

  function submitOutcome() {
    update.mutate({ id: outcomeFor.id, data: outcome } as any, {
      onSuccess: () => {
        setOutcomeFor(null);
        setOutcome({ status: 'attended', outcome: '', actionsRequired: '', medicationChanged: false, followUpDate: '' });
      },
    });
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">{tr('Appointments')}</h1>
          <p className="page-subtitle">GP rounds, district nurses, chiropody, dentists, opticians and hospital appointments.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddOpen(true)}>Book an appointment</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        <Kpi label="Today" value={summary?.today ?? '—'} />
        <Kpi label="Next 7 days" value={summary?.next7Days ?? '—'} />
        <Kpi label="Awaiting outcome" value={summary?.awaitingOutcome ?? '—'} tone={(summary?.awaitingOutcome || 0) > 0 ? '#b45309' : undefined} />
        <Kpi label="Missed (90 days)" value={summary?.dna90Days ?? '—'} tone={(summary?.dna90Days || 0) > 0 ? '#b91c1c' : undefined} />
        <Kpi label="Follow-ups due" value={summary?.followUpsDue ?? '—'} />
      </div>

      {(summary?.awaitingOutcome || 0) > 0 && scope !== 'needs_outcome' && (
        <div className="card" style={{ marginBottom: 16, borderLeft: '4px solid #f59e0b' }}>
          <div className="card-body" style={{ padding: '12px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#92400e' }}>
              {summary?.awaitingOutcome} appointment{summary?.awaitingOutcome === 1 ? ' has' : 's have'} passed with no outcome recorded.
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => setScope('needs_outcome')}>Show them</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 18, flexWrap: 'wrap' }}>
        {[
          { k: 'upcoming', label: 'Upcoming' },
          { k: 'needs_outcome', label: 'Needs an outcome' },
          { k: 'past', label: 'Past' },
          { k: 'all', label: 'All' },
        ].map(t => (
          <button key={t.k} onClick={() => setScope(t.k)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: scope === t.k ? '3px solid #4f46e5' : '3px solid transparent',
            color: scope === t.k ? '#4f46e5' : '#64748b', fontWeight: scope === t.k ? 600 : 400,
          }}>{t.label}</button>
        ))}
      </div>

      <div className="card">
        {list.length === 0 ? (
          <div className="card-body table-empty">
            {scope === 'upcoming' ? 'No appointments booked. Use "Book an appointment" to add one.'
              : scope === 'needs_outcome' ? 'Nothing waiting — every past appointment has an outcome recorded.'
              : 'Nothing to show.'}
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>When</th><th>Resident</th><th>Type</th><th>Who / where</th><th>Status</th><th>Outcome</th><th></th></tr>
              </thead>
              <tbody>
                {list.map(a => {
                  const s = STATUS_STYLE[a.status] || STATUS_STYLE.scheduled;
                  const overdue = a.status === 'scheduled' && new Date(a.scheduledAt) < new Date();
                  return (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: 'nowrap', color: overdue ? '#b45309' : undefined, fontWeight: overdue ? 600 : 400 }}>
                        {fmtDateTime(a.scheduledAt)}
                      </td>
                      <td style={{ fontWeight: 500 }}>{a.residentName}<div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Room {a.roomNumber}</div></td>
                      <td>{a.appointmentTypeLabel}</td>
                      <td style={{ fontSize: '0.85rem' }}>
                        {a.professionalName || '—'}
                        <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                          {LOCATIONS.find(l => l.value === a.location)?.label}
                          {a.escortRequired ? ` · escort: ${a.escortStaffName || 'needed'}` : ''}
                        </div>
                      </td>
                      <td>
                        <span style={{ background: s.bg, color: s.fg, padding: '3px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 600 }}>{s.label}</span>
                      </td>
                      <td style={{ fontSize: '0.85rem', maxWidth: 240 }}>
                        {a.outcome || <span style={{ color: '#cbd5e1' }}>Not recorded</span>}
                        {a.followUpDate && <div style={{ color: '#64748b', fontSize: '0.78rem' }}>Follow-up {fmtDate(a.followUpDate)}</div>}
                      </td>
                      <td>
                        {a.status === 'scheduled' && (
                          <button className="btn btn-primary btn-sm" onClick={() => { setOutcomeFor(a); setOutcome({ status: 'attended', outcome: '', actionsRequired: '', medicationChanged: false, followUpDate: '' }); }}>
                            Record outcome
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addOpen && (
        <div className="modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Book an appointment</span>
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
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-input" value={form.appointmentType} onChange={e => setForm({ ...form, appointmentType: e.target.value })}>
                  {types.map((t: any) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date and time</label>
                <input className="form-input" type="datetime-local" value={form.scheduledAt}
                  onChange={e => setForm({ ...form, scheduledAt: e.target.value })} />
              </div>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Professional</label>
                  <input className="form-input" placeholder="e.g. Dr Ahmed" value={form.professionalName}
                    onChange={e => setForm({ ...form, professionalName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Organisation</label>
                  <input className="form-input" placeholder="e.g. Riverside Surgery" value={form.organisation}
                    onChange={e => setForm({ ...form, organisation: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Where</label>
                <select className="form-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>
                  {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <textarea className="form-input" rows={2} value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })} />
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={form.escortRequired}
                  onChange={e => setForm({ ...form, escortRequired: e.target.checked })} />
                Someone needs to go with them
              </label>
              {form.escortRequired && (
                <>
                  <div className="form-group">
                    <label className="form-label">Escort</label>
                    <select className="form-input" value={form.escortStaffId}
                      onChange={e => setForm({ ...form, escortStaffId: e.target.value })}>
                      <option value="">Not decided yet</option>
                      {staffList.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.first_name || s.firstName} {s.last_name || s.lastName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Transport notes</label>
                    <input className="form-input" placeholder="e.g. Wheelchair taxi booked" value={form.transportNotes}
                      onChange={e => setForm({ ...form, transportNotes: e.target.value })} />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={create.isPending} onClick={submitNew}>
                {create.isPending ? 'Booking…' : 'Book'}
              </button>
            </div>
          </div>
        </div>
      )}

      {outcomeFor && (
        <div className="modal-overlay" onClick={() => setOutcomeFor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{outcomeFor.residentName} — {outcomeFor.appointmentTypeLabel}</span>
              <button className="modal-close" onClick={() => setOutcomeFor(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">What happened</label>
                <select className="form-input" value={outcome.status} onChange={e => setOutcome({ ...outcome, status: e.target.value })}>
                  <option value="attended">Attended</option>
                  <option value="did_not_attend">Did not attend</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="rescheduled">Rescheduled</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">
                  {outcome.status === 'attended' ? 'What came out of it' : 'Why'}
                </label>
                <textarea className="form-input" rows={3} value={outcome.outcome}
                  placeholder={outcome.status === 'attended' ? 'What was said, decided or changed' : 'Reason'}
                  onChange={e => setOutcome({ ...outcome, outcome: e.target.value })} />
              </div>
              {outcome.status === 'attended' && (
                <>
                  <div className="form-group">
                    <label className="form-label">Actions for us</label>
                    <textarea className="form-input" rows={2} value={outcome.actionsRequired}
                      onChange={e => setOutcome({ ...outcome, actionsRequired: e.target.value })} />
                  </div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={outcome.medicationChanged}
                      onChange={e => setOutcome({ ...outcome, medicationChanged: e.target.checked })} />
                    Medication was changed
                  </label>
                  {outcome.medicationChanged && (
                    <div style={{ fontSize: '0.8rem', color: '#92400e', background: '#fffbeb', padding: '8px 12px', borderRadius: 6 }}>
                      Update the MAR chart before the next round.
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Follow-up needed by</label>
                    <input className="form-input" type="date" value={outcome.followUpDate}
                      onChange={e => setOutcome({ ...outcome, followUpDate: e.target.value })} />
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setOutcomeFor(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={update.isPending} onClick={submitOutcome}>
                {update.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
