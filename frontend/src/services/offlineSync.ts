// ────────────────────────────────────────────────────────────────────────────
// Keeping and sending records made offline. The rules are in
// utils/offlineQueue.ts; this file only stores the list and talks to the API.
//
// Stored in localStorage on this device. It holds care records, so:
//   • sign-out warns if anything is still waiting, and clears it if the
//     person chooses to discard;
//   • nothing is sent unless the person who made it is the one signed in.
// ────────────────────────────────────────────────────────────────────────────
import { api } from './api';
import {
  type QueuedWrite, enqueue, nextToSend, classify, applyResult, retryFailed, discard, summary,
} from '../utils/offlineQueue';

const KEY = 'cv-offline-queue-v1';
type Listener = () => void;
const listeners = new Set<Listener>();
let flushing = false;

function read(): QueuedWrite[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function write(list: QueuedWrite[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
  listeners.forEach(l => l());
}

export function subscribe(l: Listener): () => void { listeners.add(l); return () => listeners.delete(l); }
export function queued(): QueuedWrite[] { return read(); }
export function queueSummary(userId: string) { return summary(read(), userId); }

function currentUserId(): string | null {
  try { return JSON.parse(localStorage.getItem('cv_user') || 'null')?.id ?? null; } catch { return null; }
}

function newId(): string {
  const c: any = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // RFC 4122 v4 from getRandomValues.
  const b = new Uint8Array(16); c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** No response at all: offline, DNS, CORS failure, server unreachable. */
function isNetworkError(err: any) { return !!err && !err.response; }

export interface SendOutcome<T = any> { queued: boolean; id: string; data?: T }

/**
 * Send now if we can; otherwise keep it on the phone. Resolves either way
 * unless the server actually refused the record, in which case it throws as
 * a normal request would — the person is right there to fix it.
 */
export async function sendOrQueue<T = any>(opts: {
  method: 'post' | 'patch'; url: string; body: Record<string, unknown>; label: string; dependsOn?: string;
}): Promise<SendOutcome<T>> {
  const userId = currentUserId();
  const id = newId();
  const clientRecordedAt = new Date().toISOString();
  const body = { ...opts.body, clientRef: id };

  // Something made earlier is still waiting: this one must queue behind it,
  // or the record order on the server would not match the order of the care.
  const behind = userId ? nextToSend(read(), userId) : null;

  if (userId && (behind || (typeof navigator !== 'undefined' && navigator.onLine === false) || (opts.dependsOn && read().some(x => x.id === opts.dependsOn)))) {
    write(enqueue(read(), { id, userId, method: opts.method, url: opts.url, body: { ...body, clientRecordedAt }, clientRecordedAt, label: opts.label, dependsOn: opts.dependsOn }));
    return { queued: true, id };
  }
  try {
    const r = await api.request<T>({ method: opts.method, url: opts.url, data: body });
    return { queued: false, id, data: r.data };
  } catch (err: any) {
    if (userId && isNetworkError(err)) {
      write(enqueue(read(), { id, userId, method: opts.method, url: opts.url, body: { ...body, clientRecordedAt }, clientRecordedAt, label: opts.label, dependsOn: opts.dependsOn }));
      flushSoon();
      return { queued: true, id };
    }
    throw err;
  }
}

/** Send whatever is waiting, in order, until done or the connection drops. */
export async function flush(): Promise<void> {
  if (flushing) return;
  const userId = currentUserId();
  if (!userId) return;
  flushing = true;
  try {
    for (let guard = 0; guard < 200; guard++) {
      const next = nextToSend(read(), userId);
      if (!next) break;
      let result;
      try {
        // The device time travels in the body, not a custom header: a header the
        // API's CORS settings don't list would fail every resend, for ever.
        const r = await api.request({ method: next.method, url: next.url, data: next.body });
        result = classify(r.status, r.data);
      } catch (err: any) {
        result = classify(err?.response?.status, err?.response?.data);
      }
      write(applyResult(read(), next.id, result));
      if (result.kind === 'retry') break;     // keep order: try again later
    }
  } finally {
    flushing = false;
  }
}

let timer: number | undefined;
function flushSoon() { window.clearTimeout(timer); timer = window.setTimeout(() => { void flush(); }, 15_000); }

export function resend(id: string, extraBody: Record<string, unknown> = {}) { write(retryFailed(read(), id, extraBody)); void flush(); }
export function drop(id: string) { write(discard(read(), id)); }
/** Remove a record still waiting (the round's Undo, before it was ever sent). */
export function cancelWaiting(id: string): boolean {
  const list = read();
  if (!list.some(x => x.id === id)) return false;
  write(discard(list, id));
  return true;
}
/** Sign-out with records still here: the person chose to throw them away. */
export function clearForUser(userId: string) { write(read().filter(x => x.userId !== userId)); }

let started = false;
/** Call once at start-up. */
export function startOfflineSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => { void flush(); });
  window.setInterval(() => { if (navigator.onLine) void flush(); }, 60_000);
  void flush();
}
