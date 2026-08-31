import React, { useState } from 'react';
import { useLang } from '../i18n';
import {
  useStaff, useAddStaff, useStaffWorking, useUpdateStaffFull, useDeactivateStaff,
  useReactivateStaff, useSetStaffPrefs, useAddUnavailability, useDeleteUnavailability,
  useImportStaff,
} from '../hooks';
import { api } from '../services/api';
import { PrintHeader, PrintButton } from '../components/PrintHeader';
import { exportCsv } from '../utils/exportCsv';

// Adding people, recording leavers, and capturing when somebody cannot work.
//
// The leaver flow is the important one: before this, a carer who left in March
// could still sign in in September, because the only thing a manager could
// change was a job title.

const ROLES = [
  ['home_manager', 'Home manager'], ['deputy_manager', 'Deputy manager'],
  ['registered_nurse', 'Registered nurse'], ['senior_carer', 'Senior carer'],
  ['carer', 'Carer'], ['activities', 'Activities'], ['kitchen', 'Kitchen'],
  ['cleaning', 'Housekeeping'], ['maintenance', 'Maintenance'],
  ['admin', 'Administrator'], ['finance', 'Finance'],
];
const LEAVING = [
  ['resigned', 'Resigned'], ['end_of_contract', 'End of contract'], ['retired', 'Retired'],
  ['dismissed', 'Dismissed'], ['redundancy', 'Redundancy'], ['transferred', 'Transferred to another home'],
  ['deceased', 'Deceased'], ['other', 'Other'],
];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const KINDS = [
  ['unavailable', 'Cannot work'], ['prefer_not', 'Would rather not'],
  ['annual_leave', 'Annual leave'], ['training', 'Training'],
  ['fixed_commitment', 'Fixed commitment'], ['parental', 'Childcare'], ['medical', 'Medical'],
];

function Modal({ title, onClose, children, footer, wide }: any) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={wide ? 'modal modal-lg' : 'modal'}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gap: 12 }}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// ── Working preferences and unavailability ─────────────────────────────────
function WorkingModal({ staff: s, onClose }: any) {
  const { data } = useStaffWorking(s.id);
  const savePrefs = useSetStaffPrefs();
  const addUnavail = useAddUnavailability();
  const delUnavail = useDeleteUnavailability();

  const [p, setP] = useState<any>(null);
  const [u, setU] = useState<any>({ kind: 'unavailable', weekday: '', fromDate: '', toDate: '', reason: '' });

  React.useEffect(() => {
    if (data && p === null) {
      setP(data.preferences || {
        preferredShifts: [], avoidShifts: [], maxHoursPerWeek: '', maxConsecutiveDays: '',
        minHoursBetweenShifts: 11, wantsMoreHours: false, canDoOvertime: true, worksAloneOk: true, notes: '',
      });
    }
  }, [data]);

  const toggle = (field: string, v: string) => setP((prev: any) => {
    const arr: string[] = prev[field] || [];
    return { ...prev, [field]: arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v] };
  });

  if (!p) return <Modal title="Working preferences" onClose={onClose}><p>Loading…</p></Modal>;

  return (
    <Modal wide title={`Working preferences — ${s.first_name} ${s.last_name}`} onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" disabled={savePrefs.isPending}
            onClick={() => savePrefs.mutate({ id: s.id, data: {
              ...p,
              maxHoursPerWeek: p.maxHoursPerWeek === '' ? null : Number(p.maxHoursPerWeek),
              maxConsecutiveDays: p.maxConsecutiveDays === '' ? null : Number(p.maxConsecutiveDays),
            } } as any)}>
            {savePrefs.isPending ? 'Saving…' : 'Save preferences'}
          </button>
        </>
      }>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
        Recorded so the rota stops proposing shifts this person cannot work. Nothing here blocks a
        manager — it warns, so you know when you are asking a favour.
      </p>

      <div>
        <label className="form-label">Prefers these shifts</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['day', 'evening', 'night'].map(v => (
            <button key={v} type="button" onClick={() => toggle('preferredShifts', v)}
              className={`btn btn-sm ${p.preferredShifts?.includes(v) ? 'btn-primary' : 'btn-secondary'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="form-label">Asks not to be given</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['day', 'evening', 'night'].map(v => (
            <button key={v} type="button" onClick={() => toggle('avoidShifts', v)}
              className={`btn btn-sm ${p.avoidShifts?.includes(v) ? 'btn-danger' : 'btn-secondary'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
        <div className="form-group">
          <label className="form-label">Max hours a week</label>
          <input className="form-input" type="number" value={p.maxHoursPerWeek ?? ''}
            onChange={e => setP({ ...p, maxHoursPerWeek: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Max days in a row</label>
          <input className="form-input" type="number" value={p.maxConsecutiveDays ?? ''}
            onChange={e => setP({ ...p, maxConsecutiveDays: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Hours rest between shifts</label>
          <input className="form-input" type="number" value={p.minHoursBetweenShifts ?? 11}
            onChange={e => setP({ ...p, minHoursBetweenShifts: Number(e.target.value) })} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {[['wantsMoreHours', 'Would like more hours'], ['canDoOvertime', 'Available for overtime'],
          ['worksAloneOk', 'Can work alone']].map(([k, label]) => (
          <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={!!p[k]} onChange={e => setP({ ...p, [k]: e.target.checked })} />
            {label}
          </label>
        ))}
      </div>

      <div className="form-group">
        <label className="form-label">Notes</label>
        <textarea className="form-input" rows={2} value={p.notes || ''}
          onChange={e => setP({ ...p, notes: e.target.value })} />
      </div>

      {/* ── Unavailability ── */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <label className="form-label">When they cannot work</label>
        {(data?.unavailability || []).length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 10px' }}>Nothing recorded.</p>
        ) : (
          <div style={{ marginBottom: 10 }}>
            {data.unavailability.map((x: any) => (
              <div key={x.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ flex: 1, fontSize: 13 }}>
                  <strong>{KINDS.find(k => k[0] === x.kind)?.[1] || x.kind}</strong>
                  {' — '}
                  {x.weekday !== null && x.weekday !== undefined ? `every ${DAYS[x.weekday]}` : ''}
                  {x.fromDate ? `${x.fromDate}${x.toDate ? ` to ${x.toDate}` : ''}` : ''}
                  {x.reason ? ` · ${x.reason}` : ''}
                </span>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => delUnavail.mutate({ id: s.id, entryId: x.id } as any)}>Remove</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Type</label>
            <select className="form-input" value={u.kind} onChange={e => setU({ ...u, kind: e.target.value })}>
              {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Every</label>
            <select className="form-input" value={u.weekday} onChange={e => setU({ ...u, weekday: e.target.value })}>
              <option value="">— or use dates —</option>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From</label>
            <input className="form-input" type="date" value={u.fromDate} onChange={e => setU({ ...u, fromDate: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To</label>
            <input className="form-input" type="date" value={u.toDate} onChange={e => setU({ ...u, toDate: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Reason</label>
            <input className="form-input" value={u.reason} onChange={e => setU({ ...u, reason: e.target.value })} />
          </div>
          <button className="btn btn-secondary btn-sm" disabled={addUnavail.isPending}
            onClick={() => addUnavail.mutate({ id: s.id, data: u } as any, {
              onSuccess: () => setU({ kind: 'unavailable', weekday: '', fromDate: '', toDate: '', reason: '' }),
            })}>Add</button>
        </div>
      </div>
    </Modal>
  );
}

export default WorkingModal;
export { Modal, ROLES, LEAVING };
