import React, { useState } from 'react';
import { useLang } from '../i18n';
import { useAuthStore } from '../store/auth.store';
import { useSensorDevices, useNightOverview, useRegisterSensor, useSetSensorConsent, useResidents } from '../hooks';
import { PrintHeader, PrintButton } from '../components/PrintHeader';

// Ambient night sensing.
//
// To know how someone's night went, somebody has to open the door and look —
// which is the thing most likely to wake them. This shows what the room can
// report without anyone going in, and without a camera or a wearable.

const SEVERITY: Record<string, { bg: string; fg: string; label: string }> = {
  urgent:    { bg: '#fee2e2', fg: '#991b1b', label: 'Urgent' },
  attention: { bg: '#fef3c7', fg: '#92400e', label: 'Needs a look' },
  info:      { bg: '#f1f5f9', fg: '#475569', label: 'For information' },
};

const EVENT_LABELS: Record<string, string> = {
  settled: '😴 Settled night',
  restless: '🔁 Restless',
  out_of_bed: '🚶 Out of bed',
  out_of_bed_prolonged: '⚠️ Out of bed a long time',
  distress: '😢 Distress',
  repeated_coughing: '💨 Repeated coughing',
  possible_fall: '🚑 Possible fall',
  left_room: '🚪 Left the room',
  unsettled_return: '🔄 Unsettled on returning',
};

function yesterday() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function time(t?: string | null) {
  return t ? new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function NightSensing() {
  const { t: tr } = useLang();
  const { user } = useAuthStore();
  const isManager = ['home_manager', 'deputy_manager', 'admin', 'super_admin', 'group_admin']
    .includes((user as any)?.role || '');

  const [night, setNight] = useState(yesterday());
  const [tab, setTab] = useState<'night' | 'devices'>('night');
  const [addOpen, setAddOpen] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ roomNumber: '', residentId: '', deviceName: '', deviceType: 'presence_acoustic', hardwareModel: '' });
  const [consentFor, setConsentFor] = useState<any>(null);
  const [consent, setConsent] = useState<any>({ consentStatus: 'given', consentBasis: 'resident_consent', notes: '' });

  const { data: overview } = useNightOverview(night);
  const { data: devices } = useSensorDevices();
  const { data: residents } = useResidents();
  const register = useRegisterSensor();
  const setSensorConsent = useSetSensorConsent();

  const events: any[] = overview?.events || [];
  const deviceList: any[] = Array.isArray(devices) ? devices : [];
  const residentList: any[] = Array.isArray(residents) ? residents : [];
  const sensing = deviceList.filter(d => d.sensing).length;

  return (
    <div>
      <PrintHeader title="Night report" note={`Night of ${night}`} />

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">{tr('Night Sensing')}</h1>
          <p className="page-subtitle">
            How the night actually went, without opening the door. No cameras, no wearables,
            and no sound is ever recorded — the sensor sends what it heard, not the sound itself.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <PrintButton label="Print night report" />
          {isManager && <button className="btn btn-primary no-print" onClick={() => setAddOpen(true)}>Add a device</button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Rooms sensing', value: sensing, tone: undefined },
          { label: 'Urgent', value: overview?.urgent ?? 0, tone: (overview?.urgent || 0) > 0 ? '#b91c1c' : '#059669' },
          { label: 'Needing a look', value: overview?.attention ?? 0, tone: (overview?.attention || 0) > 0 ? '#b45309' : '#059669' },
          { label: 'Nobody attended', value: overview?.unattended ?? 0, tone: (overview?.unattended || 0) > 0 ? '#b91c1c' : '#059669' },
        ].map(k => (
          <div className="card" key={k.label}><div className="card-body" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em' }}>{k.label}</div>
            <div style={{ fontSize: '1.9rem', fontWeight: 700, color: k.tone || '#0f172a', marginTop: 4 }}>{k.value}</div>
          </div></div>
        ))}
      </div>

      <div className="tab-strip" style={{ gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 18 }}>
        {([['night', 'Last night'], ['devices', `Devices (${deviceList.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === k ? '3px solid #4f46e5' : '3px solid transparent',
            color: tab === k ? '#4f46e5' : '#64748b', fontWeight: tab === k ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'night' && (
        <>
          <div className="card no-print" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Night of</label>
                <input className="form-input" type="date" value={night} onChange={e => setNight(e.target.value)} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                A night runs 20:00 to 10:00 the next morning.
              </div>
            </div>
          </div>

          {sensing === 0 ? (
            <div className="card"><div className="card-body table-empty">
              No room is sensing yet. Add a device and record consent for that resident before it will report anything.
            </div></div>
          ) : events.length === 0 ? (
            <div className="card"><div className="card-body table-empty">
              Nothing was detected on this night. Either every resident being sensed had an undisturbed night,
              or the devices were offline — check the Devices tab.
            </div></div>
          ) : events.map(e => {
            const sev = SEVERITY[e.severity] || SEVERITY.info;
            return (
              <div className="card" key={e.id} style={{ marginBottom: 10, borderLeft: `4px solid ${sev.fg}` }}>
                <div className="card-body" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>
                      {e.residentName} <span style={{ color: '#94a3b8', fontWeight: 400 }}>· Room {e.roomNumber}</span>
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <strong>{EVENT_LABELS[e.eventType] || e.eventType}</strong>
                      {' at '}{time(e.startedAt)}
                      {e.durationMins ? ` · ${e.durationMins} minutes` : ''}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>{e.evidence}</div>
                    {e.severity !== 'info' && (
                      <div style={{ fontSize: 12, marginTop: 6, color: e.staffAttended ? '#059669' : '#b91c1c', fontWeight: 600 }}>
                        {e.staffAttended
                          ? `Attended after ${e.attendedWithinMins ?? '—'} minutes`
                          : 'No care note recorded within 45 minutes'}
                      </div>
                    )}
                  </div>
                  <span style={{ background: sev.bg, color: sev.fg, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                    {sev.label}
                  </span>
                </div>
              </div>
            );
          })}
        </>
      )}

      {tab === 'devices' && (
        <div className="card">
          {deviceList.length === 0 ? (
            <div className="card-body table-empty">
              No devices yet. Sensing is optional and per room — nothing is monitored until a device is added
              and consent is recorded for that resident.
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Room</th><th>Resident</th><th>Device</th><th>Consent</th><th>Last seen</th><th>Readings 24h</th><th></th></tr></thead>
                <tbody>
                  {deviceList.map(d => (
                    <tr key={d.id} style={{ background: d.offline && d.sensing ? '#fffbeb' : undefined }}>
                      <td style={{ fontWeight: 500 }}>{d.roomNumber}</td>
                      <td>{d.residentName || <span style={{ color: '#94a3b8' }}>Not assigned</span>}</td>
                      <td style={{ fontSize: 13 }}>
                        {d.deviceName}
                        <div style={{ color: '#94a3b8', fontSize: 12 }}>{d.hardwareModel || d.deviceType}</div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: d.consentStatus === 'given' ? '#059669'
                               : d.consentStatus === 'pending' ? '#b45309' : '#b91c1c',
                        }}>
                          {d.consentStatus === 'given' ? 'Consented' :
                           d.consentStatus === 'pending' ? 'Awaiting consent' :
                           d.consentStatus === 'refused' ? 'Refused' : 'Withdrawn'}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: d.offline ? '#b45309' : undefined }}>
                        {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                        {d.offline && <div style={{ fontSize: 11, fontWeight: 600 }}>Offline</div>}
                      </td>
                      <td>{d.readings24h}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm no-print" onClick={() => { setConsentFor(d); setConsent({ consentStatus: 'given', consentBasis: 'resident_consent', notes: '' }); }}>
                          Consent
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {addOpen && (
        <div className="modal-overlay" onClick={() => { setAddOpen(false); setNewKey(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{newKey ? 'Device registered' : 'Add a sensing device'}</span>
              <button className="modal-close" onClick={() => { setAddOpen(false); setNewKey(null); }}>×</button>
            </div>
            {newKey ? (
              <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
                <p style={{ margin: 0 }}>Copy this key into the device now. It is not shown again.</p>
                <code style={{ display: 'block', padding: 12, background: 'var(--surface-2)', borderRadius: 8, wordBreak: 'break-all', fontSize: 13 }}>{newKey}</code>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                  The device will be refused until consent is recorded for the resident in that room.
                </p>
              </div>
            ) : (
              <>
                <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Room</label>
                    <input className="form-input" value={form.roomNumber} onChange={e => setForm({ ...form, roomNumber: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Resident</label>
                    <select className="form-input" value={form.residentId} onChange={e => setForm({ ...form, residentId: e.target.value })}>
                      <option value="">Choose a resident…</option>
                      {residentList.map(r => (
                        <option key={r.id} value={r.id}>{r.first_name} {r.last_name} — Room {r.room_number}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Device name</label>
                    <input className="form-input" placeholder="e.g. Room 6 ceiling sensor" value={form.deviceName} onChange={e => setForm({ ...form, deviceName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">What it senses</label>
                    <select className="form-input" value={form.deviceType} onChange={e => setForm({ ...form, deviceType: e.target.value })}>
                      <option value="presence">Presence and movement</option>
                      <option value="acoustic">Sound events only</option>
                      <option value="presence_acoustic">Presence and sound events</option>
                      <option value="environment">Temperature, light and humidity</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Hardware model</label>
                    <input className="form-input" placeholder="e.g. mmWave presence + on-device classifier" value={form.hardwareModel} onChange={e => setForm({ ...form, hardwareModel: e.target.value })} />
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--surface-2)', padding: 12, borderRadius: 8 }}>
                    The device sends event labels only — never audio, never images. The ingestion endpoint
                    refuses any message containing a recording.
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
                  <button className="btn btn-primary" disabled={register.isPending}
                    onClick={() => register.mutate(form as any, { onSuccess: (d: any) => setNewKey(d.apiKey) })}>
                    {register.isPending ? 'Registering…' : 'Register'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {consentFor && (
        <div className="modal-overlay" onClick={() => setConsentFor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Consent — Room {consentFor.roomNumber}</span>
              <button className="modal-close" onClick={() => setConsentFor(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14 }}>
                Sensing a person's bedroom is a restriction on their privacy. It needs a lawful basis,
                and it can be withdrawn at any time — readings stop immediately.
              </p>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={consent.consentStatus} onChange={e => setConsent({ ...consent, consentStatus: e.target.value })}>
                  <option value="given">Consent given</option>
                  <option value="refused">Refused</option>
                  <option value="withdrawn">Withdrawn</option>
                  <option value="pending">Awaiting a decision</option>
                </select>
              </div>
              {consent.consentStatus === 'given' && (
                <div className="form-group">
                  <label className="form-label">Lawful basis</label>
                  <select className="form-input" value={consent.consentBasis} onChange={e => setConsent({ ...consent, consentBasis: e.target.value })}>
                    <option value="resident_consent">The resident consented</option>
                    <option value="lpa_consent">An attorney consented on their behalf</option>
                    <option value="best_interests">Best interests decision</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={3} value={consent.notes}
                  placeholder="Who was involved in the decision, and what was explained."
                  onChange={e => setConsent({ ...consent, notes: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConsentFor(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={setSensorConsent.isPending}
                onClick={() => setSensorConsent.mutate({ id: consentFor.id, data: consent } as any, { onSuccess: () => setConsentFor(null) })}>
                {setSensorConsent.isPending ? 'Saving…' : 'Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
