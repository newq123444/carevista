// ────────────────────────────────────────────────────────────────────────────
// The line across the top that says: no signal; or, records waiting to send;
// or, a record the server refused — tap to sort it out.
//
// Records waiting on a phone are invisible unless something says so. A carer
// who doesn't know three notes are still on her phone goes home with them.
// ────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { subscribe, queued, queueSummary, flush, resend, drop } from '../services/offlineSync';
import { useAuthStore } from '../store/auth.store';
import { useLang } from '../i18n';

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

export function OfflineBanner() {
  const { t: tr } = useLang();
  const online = useOnline();
  const userId = useAuthStore(s => s.user?.id) || '';
  const [, setV] = useState(0);
  useEffect(() => subscribe(() => setV(v => v + 1)), []);
  const [open, setOpen] = useState(false);
  const s = queueSummary(userId);

  if (online && s.waiting === 0 && s.failed === 0) return null;

  const tone = s.failed ? { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' }
    : !online ? { bg: '#1e293b', fg: '#f8fafc', border: '#1e293b' }
    : { bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' };

  return (
    <>
      <div role="status" className="no-print" style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px',
        background: tone.bg, color: tone.fg, borderBottom: `1px solid ${tone.border}`, fontSize: 15, fontWeight: 600,
      }}>
        <span style={{ flex: 1, minWidth: 200 }}>
          {!online && <>📵 {tr('No signal.')} </>}
          {s.waiting > 0 && <>{s.waiting} {tr(s.waiting === 1 ? 'record waiting to send' : 'records waiting to send')}. </>}
          {!online && s.waiting === 0 && tr('You can keep recording — it will be kept on this phone.')}
          {s.failed > 0 && <>{s.failed} {tr(s.failed === 1 ? 'record could not be sent' : 'records could not be sent')}.</>}
        </span>
        {online && s.waiting > 0 && (
          <button onClick={() => void flush()} style={btn(tone.fg)}>{tr('Send now')}</button>
        )}
        {(s.failed > 0 || s.waiting > 0) && (
          <button onClick={() => setOpen(true)} style={btn(tone.fg)}>{tr('Show')}</button>
        )}
      </div>
      {open && <QueueSheet userId={userId} onClose={() => setOpen(false)} />}
    </>
  );
}

function QueueSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t: tr } = useLang();
  const [, setV] = useState(0);
  useEffect(() => subscribe(() => setV(v => v + 1)), []);
  const mine = queued().filter(x => x.userId === userId);
  const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header"><h3 style={{ margin: 0 }}>{tr('Records on this phone')}</h3></div>
        <div className="modal-body" style={{ display: 'grid', gap: 10 }}>
          {mine.length === 0 && <p style={{ margin: 0 }}>{tr('Everything has been sent.')}</p>}
          {mine.map(x => (
            <div key={x.id} className="card" style={{ padding: 12, borderLeft: `5px solid ${x.state === 'failed' ? '#dc2626' : '#3b82f6'}` }}>
              <div style={{ fontWeight: 700, fontSize: 15.5 }}>{x.label}</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>
                {tr('Made at')} {hhmm(x.clientRecordedAt)} ({tr('phone time')}) · {x.state === 'failed' ? tr('not sent') : tr('waiting')}
              </div>
              {x.error && <div style={{ fontSize: 14.5, color: '#b91c1c', marginTop: 6 }}>{x.error}</div>}
              {x.state === 'failed' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {/* The server's duplicate warning: "… already recorded a … note for this resident …" */}
                  {x.conflict === 'possible_duplicate' || x.conflict === 'already_completed' || /already recorded a .* note/i.test(x.error || '') ? (
                    <button className="btn btn-primary" style={{ minHeight: 48 }} onClick={() => resend(x.id, { confirmDuplicate: true })}>
                      {tr('It is not a duplicate — send')}
                    </button>
                  ) : (
                    <button className="btn btn-primary" style={{ minHeight: 48 }} onClick={() => resend(x.id)}>{tr('Try again')}</button>
                  )}
                  <button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => {
                    if (window.confirm(tr('Throw this record away? It has not reached the care record.'))) drop(x.id);
                  }}>{tr('Discard')}</button>
                </div>
              )}
            </div>
          ))}
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {tr('Records are sent in the order they were made. Each keeps the time on this phone when it was made, shown in the record as device time.')}
          </p>
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>{tr('Close')}</button></div>
      </div>
    </div>
  );
}

function btn(fg: string): React.CSSProperties {
  return { minHeight: 44, padding: '0 14px', borderRadius: 10, border: `1.5px solid ${fg}`, background: 'transparent', color: fg, fontWeight: 700, cursor: 'pointer', fontSize: 14.5 };
}
