// ────────────────────────────────────────────────────────────────────────────
// Record Integrity.
//
// Two jobs, kept visibly separate because they answer different questions:
//   • Has any record been changed since it was made?   (the chain)
//   • Does any record look implausible on its face?    (the findings)
//
// The page states, every time, what the protection actually is. Overstating it
// would be worse than not having it, because a false assurance gets relied on.
// ────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import {
  useIntegritySummary, useIntegrityFindings, useChainAnchors, useIntegritySettings,
  useVerifyChain, useSealDay, useRunDetection, useResolveFinding, useSetIntegritySettings,
} from '../hooks';
import { PrintHeader, PrintButton } from '../components/PrintHeader';
import { formatDate } from '../utils/formatters';

const RESOLUTIONS: [string, string, string][] = [
  ['explained', 'There is an explanation', 'Ordinary reason — cover on two floors, a wrong clock, a rota not updated.'],
  ['action_taken', 'I have taken action', 'Something needed to change and it has been dealt with.'],
  ['not_an_issue', 'Not an issue', 'Looked at it; nothing in it.'],
];

const SEVERITY: Record<string, { label: string; bg: string; fg: string }> = {
  urgent:  { label: 'Look now',   bg: '#fef2f2', fg: '#b91c1c' },
  notable: { label: 'Worth a look', bg: '#fffbeb', fg: '#b45309' },
  review:  { label: 'For information', bg: '#f8fafc', fg: '#475569' },
};

export default function RecordIntegrity() {
  const [tab, setTab] = useState<'chain' | 'findings' | 'settings'>('chain');
  const summary = useIntegritySummary();
  const s = summary.data;

  return (
    <div className="page">
      <PrintHeader title="Record integrity" />
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">🔒 Record Integrity</h1>
          <p className="page-subtitle">
            Whether your records can be shown to be unchanged — and whether any of them look odd.
          </p>
        </div>
        <PrintButton />
      </div>

      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
          <Stat label="Records protected" value={s.chainedRecords} />
          <Stat label="Days sealed" value={s.daysSealed} sub={s.lastSealed ? `to ${formatDate(s.lastSealed)}` : 'none yet'} />
          <Stat label="Not yet sealed" value={s.unsealedRecords} sub="sealed once a day" />
          <Stat label="Open findings" value={s.openFindings}
                sub={s.openNotable > 0 ? `${s.openNotable} worth a look` : 'nothing pressing'}
                tone={s.openNotable > 0 ? 'warn' : undefined} />
        </div>
      )}

      {s && (
        <div style={{
          padding: 14, borderRadius: 10, marginBottom: 20, fontSize: 14,
          background: s.anchorMode === 'external' ? '#f0fdf4' : '#fffbeb',
          border: `1px solid ${s.anchorMode === 'external' ? '#bbf7d0' : '#fde68a'}`,
        }}>
          {s.anchorMode === 'external' ? (
            <>
              <strong>External sealing is on.</strong> Each day's seal is published to an independent
              timestamping service, so a change would be detectable even by someone with full access to
              this system's database.
            </>
          ) : (
            <>
              <strong>Sealing is local only.</strong> Seals are stored in the same database they protect.
              That catches accidental corruption and anyone without database access — but it does{' '}
              <strong>not</strong> protect against someone who can write to the database directly, because
              they could recompute the seals to match. Turn on external sealing in Settings for that.
            </>
          )}
        </div>
      )}

      <div className="no-print" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 20, flexWrap: 'wrap' }}>
        {([['chain', 'Unchanged records'], ['findings', 'Records worth checking'], ['settings', 'Settings']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === v ? '3px solid #4f46e5' : '3px solid transparent',
            color: tab === v ? '#4f46e5' : 'var(--text-secondary)', fontWeight: tab === v ? 600 : 400,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'chain' && <ChainTab />}
      {tab === 'findings' && <FindingsTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}

function Stat({ label, value, sub, tone }: any) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: tone === 'warn' ? '#b45309' : undefined }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</div>}
    </div>
  );
}

function ChainTab() {
  const verify = useVerifyChain();
  const seal = useSealDay();
  const anchors = useChainAnchors();
  const result = verify.data;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Check every record</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 0 }}>
          Re-reads every care note, medication signature and completed task, and re-checks it against
          what was recorded at the time. On a large home this can take a minute.
        </p>
        <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={verify.isPending} onClick={() => verify.mutate()}>
            {verify.isPending ? 'Checking…' : 'Check the records now'}
          </button>
          <button className="btn btn-secondary" disabled={seal.isPending} onClick={() => seal.mutate(yesterday)}>
            {seal.isPending ? 'Sealing…' : `Seal ${formatDate(yesterday)}`}
          </button>
        </div>

        {result && (
          <div style={{
            marginTop: 18, padding: 16, borderRadius: 10,
            background: result.intact ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${result.intact ? '#bbf7d0' : '#fecaca'}`,
          }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              {result.intact
                ? `All ${result.entriesChecked} records checked out`
                : `${result.breaks.length} problem${result.breaks.length === 1 ? '' : 's'} found`}
            </div>
            <p style={{ fontSize: 14, margin: '0 0 8px' }}>{result.meaning}</p>
            <p style={{ fontSize: 13, margin: 0, color: 'var(--text-secondary)' }}>{result.protection}</p>

            {result.breaks?.length > 0 && (
              <div className="table-container" style={{ marginTop: 14, maxHeight: 340, overflowY: 'auto' }}>
                <table className="table">
                  <thead><tr><th>Entry</th><th>What</th><th>Problem</th></tr></thead>
                  <tbody>
                    {result.breaks.map((b: any, i: number) => (
                      <tr key={i}>
                        <td>{b.seq}</td>
                        <td style={{ fontSize: 12 }}>{b.entityType.replace(/_/g, ' ')}</td>
                        <td style={{ fontSize: 13 }}>{b.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Sealed days</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 0 }}>
          Each day is sealed with a single fingerprint covering every record made that day. From a seal,
          one resident's record can be proved without revealing anybody else's — which matters when a
          coroner or a solicitor asks about one person.
        </p>
        {anchors.isLoading ? <p>Loading…</p>
          : !anchors.data?.length ? (
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              No days sealed yet. Seal yesterday above to start.
            </p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Day</th><th>Records</th><th>Seal</th><th>Published</th></tr></thead>
                <tbody>
                  {anchors.data.map((a: any) => (
                    <tr key={a.id}>
                      <td>{formatDate(a.anchor_date)}</td>
                      <td>{a.entry_count}</td>
                      <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
                        {String(a.merkle_root).slice(0, 16)}…
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {a.published_at
                          ? `${a.external_provider || 'external'} · ${formatDate(a.published_at)}`
                          : 'stored locally only'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}

function FindingsTab() {
  const [status, setStatus] = useState('open');
  const findings = useIntegrityFindings(status);
  const detect = useRunDetection();
  const resolve = useResolveFinding();
  const [open, setOpen] = useState<any>(null);
  const [form, setForm] = useState({ status: 'explained', note: '' });

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{
        padding: 14, borderRadius: 10, background: 'var(--surface-2)',
        border: '1px solid var(--border)', fontSize: 14,
      }}>
        These are <strong>prompts to check, not accusations</strong>. Nearly all of them have an ordinary
        explanation — someone covering two floors, a tablet with the wrong time, a rota nobody updated.
        They are visible to managers only.
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-primary" disabled={detect.isPending} onClick={() => detect.mutate(7)}>
          {detect.isPending ? 'Looking…' : 'Check the last 7 days'}
        </button>
        <button className="btn btn-secondary btn-sm" disabled={detect.isPending} onClick={() => detect.mutate(30)}>
          Last 30 days
        </button>
        <select className="form-input" style={{ width: 'auto' }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="open">Open</option>
          <option value="all">Everything</option>
          <option value="explained">Explained</option>
          <option value="action_taken">Action taken</option>
          <option value="not_an_issue">Not an issue</option>
        </select>
        {detect.data && (
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Looked at {detect.data.recordsExamined} records · {detect.data.newFindings} new
          </span>
        )}
      </div>

      {findings.isLoading ? <p>Loading…</p>
        : !findings.data?.length ? (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 32 }}>✅</div>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Nothing to look at</p>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
              {status === 'open' ? 'No open findings. Run a check above to look again.' : 'Nothing in this list.'}
            </p>
          </div>
        ) : findings.data.map((f: any) => {
          const sev = SEVERITY[f.severity] || SEVERITY.review;
          return (
            <div key={f.id} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: sev.bg, color: sev.fg }}>
                  {sev.label}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{formatDate(f.occurred_on)}</span>
                {f.staff_name && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>· {f.staff_name}</span>}
                {f.resident_name && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>· {f.resident_name}</span>}
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 14.5, lineHeight: 1.55 }}>{f.summary}</p>

              <details style={{ fontSize: 13 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>What this is based on</summary>
                <pre style={{
                  background: 'var(--surface-2)', padding: 12, borderRadius: 8, overflowX: 'auto',
                  fontSize: 12, marginTop: 8,
                }}>{JSON.stringify(f.evidence, null, 2)}</pre>
              </details>

              {f.status === 'open' ? (
                <button className="btn btn-secondary btn-sm no-print" style={{ marginTop: 12 }}
                  onClick={() => { setOpen(f); setForm({ status: 'explained', note: '' }); }}>
                  Record what you found
                </button>
              ) : (
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <strong>{RESOLUTIONS.find(r => r[0] === f.status)?.[1] || f.status}</strong>
                  {' — '}{f.resolution_note}
                  {f.resolved_by_name && <> · {f.resolved_by_name}, {formatDate(f.resolved_at)}</>}
                </div>
              )}
            </div>
          );
        })}

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header"><h3 style={{ margin: 0 }}>What did you find?</h3></div>
            <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
              <p style={{ fontSize: 14, margin: 0, color: 'var(--text-secondary)' }}>{open.summary}</p>
              <div style={{ display: 'grid', gap: 8 }}>
                {RESOLUTIONS.map(([v, label, help]) => (
                  <label key={v} style={{
                    display: 'flex', gap: 10, padding: 12, borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${form.status === v ? '#4f46e5' : 'var(--border)'}`,
                    background: form.status === v ? '#eef2ff' : 'transparent',
                  }}>
                    <input type="radio" name="res" checked={form.status === v}
                           onChange={() => setForm({ ...form, status: v })} />
                    <span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{label}</span>
                      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)' }}>{help}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Briefly, what was it?</label>
                <textarea className="form-input" rows={3} value={form.note}
                  onChange={e => setForm({ ...form, note: e.target.value })}
                  placeholder="e.g. Amara was covering both floors that night — checked with her and the care was given." />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  This is kept with the finding, and is itself added to the sealed record.
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setOpen(null)}>Cancel</button>
              <button className="btn btn-primary"
                disabled={resolve.isPending || form.note.trim().length < 3}
                onClick={() => resolve.mutate({ id: open.id, data: form } as any, { onSuccess: () => setOpen(null) })}>
                {resolve.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const settings = useIntegritySettings();
  const save = useSetIntegritySettings();
  const [form, setForm] = useState<any>(null);
  const v = form || settings.data;
  if (!v) return <p>Loading…</p>;
  const set = (k: string, val: any) => setForm({ ...v, [k]: val });

  return (
    <div style={{ display: 'grid', gap: 20, maxWidth: 720 }}>
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Which checks to run</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 0 }}>
          A check that keeps flagging honest work does more harm than good. Switch off anything that
          depends on records your home does not keep up to date.
        </p>
        {([
          ['checkThroughput', 'Care recorded faster than it could be given'],
          ['checkLateEntry', 'Care recorded long after it happened'],
          ['checkEndOfShiftBurst', 'A shift written up all at once'],
          ['checkAbsentResident', 'Care recorded while the resident was away'],
          ['checkOffShift', 'Care recorded by someone not on the rota'],
        ] as const).map(([k, label]) => (
          <label key={k} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0' }}>
            <input type="checkbox" checked={!!v[k]} onChange={e => set(k, e.target.checked)} />
            <span style={{ fontSize: 14 }}>
              {label}
              {k === 'checkOffShift' && (
                <span style={{ display: 'block', fontSize: 12.5, color: '#b45309' }}>
                  Off by default. Only switch this on if your rota is reliably kept up to date — otherwise
                  it will flag carers who did turn up.
                </span>
              )}
            </span>
          </label>
        ))}
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Thresholds</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Minutes per resident, minimum</label>
            <input className="form-input" type="number" step="0.5" min="0.5" max="60"
              value={v.minMinutesPerResident} onChange={e => set('minMinutesPerResident', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">"Recorded late" after (hours)</label>
            <input className="form-input" type="number" min="1" max="168"
              value={v.lateEntryHours} onChange={e => set('lateEntryHours', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Records in a burst</label>
            <input className="form-input" type="number" min="2" max="100"
              value={v.burstMinRecords} onChange={e => set('burstMinRecords', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Burst window (minutes)</label>
            <input className="form-input" type="number" min="1" max="120"
              value={v.burstWindowMinutes} onChange={e => set('burstWindowMinutes', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Sealing</h3>
        <p style={{ fontSize: 14, marginTop: 0 }}>
          Local sealing stores the daily fingerprint in this database. That is enough to detect
          accidental corruption, and anyone without database access. It is <strong>not</strong> enough
          against someone who can write to the database directly — they could recompute the seals.
          External sealing publishes the fingerprint to an independent timestamping service, which
          closes that gap from the moment it is published.
        </p>
        <div className="form-group">
          <label className="form-label">Mode</label>
          <select className="form-input" value={v.anchorMode} onChange={e => set('anchorMode', e.target.value)}>
            <option value="local">Local only</option>
            <option value="external">Publish externally</option>
          </select>
        </div>
        {v.anchorMode === 'external' && (
          <div className="form-group">
            <label className="form-label">Timestamping provider (RFC 3161)</label>
            <input className="form-input" value={v.anchorProvider || ''} onChange={e => set('anchorProvider', e.target.value)}
              placeholder="e.g. your qualified trust service provider" />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Required. The app will not claim external sealing without somewhere to publish to.
            </span>
          </div>
        )}
      </div>

      <button className="btn btn-primary" style={{ justifySelf: 'start' }}
        disabled={save.isPending || !form} onClick={() => save.mutate(form)}>
        {save.isPending ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  );
}
