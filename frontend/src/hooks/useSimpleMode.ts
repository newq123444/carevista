// ────────────────────────────────────────────────────────────────────────────
// Simple mode.
//
// A carer is standing in a corridor with a phone in one hand, often wearing
// gloves, often reading English as a second language, and has about four
// seconds. A manager is sitting at a desk and needs to sort, filter and export.
// The same interface cannot be right for both.
//
// So simple mode is a preference, not a role. It defaults on for carers because
// that is who it was designed for, but anyone can switch it — a manager needs
// to be able to turn it on to see exactly what their staff see.
//
// Stored per user on the device rather than on the server: it is a preference
// about this phone, and a carer who uses a shared floor handset should not have
// their choice follow them to the office computer.
// ────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';

const KEY = 'cv_simple_mode';
const EVENT = 'cv-simple-mode-changed';

/** Roles the simplified screens were designed around. */
const DEFAULT_ON = ['carer', 'senior_carer', 'activities'];

function storageKey(userId?: string) {
  return userId ? `${KEY}:${userId}` : KEY;
}

export function readSimpleMode(userId?: string, role?: string): boolean {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw === '1') return true;
    if (raw === '0') return false;
  } catch {
    // Private browsing, or storage disabled. Fall through to the role default
    // rather than failing — a carer must never be locked out of recording.
  }
  return DEFAULT_ON.includes(role || '');
}

export function useSimpleMode(userId?: string, role?: string) {
  const [simple, setSimple] = useState(() => readSimpleMode(userId, role));

  // Re-read when the user changes, so signing in as someone else does not
  // inherit the previous person's preference.
  useEffect(() => { setSimple(readSimpleMode(userId, role)); }, [userId, role]);

  // Keep every mounted component in step. Two parts of the app showing
  // different modes at once would be baffling.
  useEffect(() => {
    const onChange = () => setSimple(readSimpleMode(userId, role));
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [userId, role]);

  const set = useCallback((next: boolean) => {
    try { localStorage.setItem(storageKey(userId), next ? '1' : '0'); } catch { /* not fatal */ }
    setSimple(next);
    window.dispatchEvent(new Event(EVENT));
  }, [userId]);

  return { simple, setSimple: set, toggle: () => set(!simple) };
}
