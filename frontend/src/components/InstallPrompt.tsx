// ────────────────────────────────────────────────────────────────────────────
// "Add CareVista to your home screen."
//
// Installed, CareVista opens like an app: its own icon, no browser bars, full
// screen, straight to the round — and it opens with no signal. Android and
// desktop Chrome offer a one-tap install; iPhones need Share → Add to Home
// Screen, so they get the two steps instead. Asked once; "Not now" waits a
// fortnight.
// ────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { useLang } from '../i18n';

const KEY = 'cv-install-dismissed-at';
const WAIT_DAYS = 14;

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}
function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function recentlyDismissed() {
  try { const t = Number(localStorage.getItem(KEY) || 0); return Date.now() - t < WAIT_DAYS * 86_400_000; } catch { return false; }
}

export function InstallPrompt() {
  const { t: tr } = useLang();
  const [deferred, setDeferred] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e); setShow(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    // iPhones never fire the event; offer the manual steps after a moment.
    let timer: number | undefined;
    if (isIOS()) timer = window.setTimeout(() => { setIos(true); setShow(true); }, 4000);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.clearTimeout(timer); };
  }, []);

  const dismiss = () => { setShow(false); try { localStorage.setItem(KEY, String(Date.now())); } catch { /* private mode */ } };
  if (!show) return null;

  return (
    <div className="cv-install no-print" role="dialog" aria-label={tr('Install CareVista')}>
      <span className="cv-brand-mark" style={{ width: 44, height: 44, borderRadius: 12 }}><Icon name="hand-heart" size={24} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700 }}>{tr('Put CareVista on your home screen')}</div>
        <div style={{ fontSize: '.86rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {ios ? tr('Tap Share, then "Add to Home Screen". It opens like an app, even with no signal.')
               : tr('It opens like an app — full screen, one tap, even with no signal.')}
        </div>
      </div>
      {!ios && deferred && (
        <button className="cv-btn cv-btn-primary" style={{ minHeight: 40, padding: '8px 14px' }}
          onClick={async () => { deferred.prompt(); try { await deferred.userChoice; } finally { setShow(false); setDeferred(null); } }}>
          {tr('Install')}
        </button>
      )}
      <button onClick={dismiss} aria-label={tr('Not now')} title={tr('Not now')}
        style={{ border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 6, display: 'grid', minWidth: 36, minHeight: 36, placeItems: 'center' }}>
        <Icon name="x" size={18} />
      </button>
    </div>
  );
}
