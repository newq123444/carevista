// ────────────────────────────────────────────────────────────────────────────
// Records made with no signal, waiting to be sent.
//
// Care happens in bedrooms and bathrooms where the Wi-Fi drops. Without this,
// a carer with no signal either writes on a glove and types it up later, or
// doesn't record it at all. With it, the record is kept on the phone and sent,
// in the order it was made, when the signal comes back.
//
// The rules that make that safe:
//   • Order is kept. A note and the task it completes go in the order made.
//   • Each record carries the device time it was made, and is labelled as
//     such. The server's own time stays the authoritative one; the device
//     time is accepted only within a bounded window and marked "not verified".
//   • A record the server refuses for a reason (not a dropped connection) is
//     never retried for ever and never silently dropped: it is shown to the
//     person who made it, to send anyway or discard.
//   • Records belong to whoever made them. They are only sent while that
//     person is signed in, so nothing is ever sent under someone else's name.
//
// This file is pure: the list in, the list out. Storage and sending live in
// services/offlineSync.ts. Tested in backend/tests/offlinequeue.test.mjs.
// ────────────────────────────────────────────────────────────────────────────

export interface QueuedWrite {
  id: string;                 // also sent as clientRef, so a resend is recognised
  userId: string;
  method: 'post' | 'patch';
  url: string;
  body: Record<string, unknown>;
  clientRecordedAt: string;   // ISO, device clock
  label: string;              // "Personal care — Mary Smith"
  attempts: number;
  /** Must not be sent unless this one was. */
  dependsOn?: string;
  state: 'waiting' | 'failed';
  error?: string;
  /** Why the server refused it, when it said: e.g. 'possible_duplicate'. */
  conflict?: string;
}

export type SendResult =
  | { kind: 'sent' }
  | { kind: 'already' ; message: string }   // someone else recorded it; nothing to send
  | { kind: 'retry' }                        // no connection, or the server is down
  | { kind: 'refused'; message: string; conflict?: string };    // the server said no, for a reason

/** Device time older than this is too stale to accept as "when it happened". */
export const MAX_OFFLINE_HOURS = 72;

export function enqueue(list: QueuedWrite[], item: Omit<QueuedWrite, 'attempts' | 'state'>): QueuedWrite[] {
  if (list.some(x => x.id === item.id)) return list;
  return [...list, { ...item, attempts: 0, state: 'waiting' }];
}

/** The next record to send for this user, or null. Strict order: a waiting
 *  record holds back everything made after it. */
export function nextToSend(list: QueuedWrite[], userId: string): QueuedWrite | null {
  for (const x of list) {
    if (x.userId !== userId) continue;
    if (x.state === 'waiting') return x;
  }
  return null;
}

export function classify(status: number | undefined, body?: any): SendResult {
  if (status === undefined || status === 0) return { kind: 'retry' };
  if (status >= 200 && status < 300) return { kind: 'sent' };
  if (status === 408 || status === 429 || status >= 500) return { kind: 'retry' };
  if (status === 401) return { kind: 'retry' };   // signed out mid-way: keep it, send after sign-in
  if (status === 409 && body?.conflict === 'already_completed') {
    // A task someone else finished, with a note of ours attached: never drop
    // the note silently — show it, so the carer can send it anyway if it was
    // different care (v89b).
    if (body?.hadNote) return { kind: 'refused', message: body?.error || 'Someone else had already recorded this.', conflict: 'already_completed' };
    return { kind: 'already', message: body?.error || 'Someone else had already recorded this.' };
  }
  return { kind: 'refused', message: body?.error || `The server refused this record (${status}).`, conflict: body?.conflict };
}

export function applyResult(list: QueuedWrite[], id: string, r: SendResult): QueuedWrite[] {
  if (r.kind === 'sent' || r.kind === 'already') {
    return list.filter(x => x.id !== id);
  }
  if (r.kind === 'retry') {
    return list.map(x => (x.id === id ? { ...x, attempts: x.attempts + 1 } : x));
  }
  // Refused: this one fails, and so does anything that depended on it.
  const failed = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const x of list) {
      if (x.dependsOn && failed.has(x.dependsOn) && !failed.has(x.id)) { failed.add(x.id); changed = true; }
    }
  }
  return list.map(x => failed.has(x.id)
    ? { ...x, state: 'failed', error: x.id === id ? r.message : 'Not sent because the record before it was refused.', conflict: x.id === id ? r.conflict : undefined }
    : x);
}

/** Put a failed record (and those held behind it) back in the queue. */
export function retryFailed(list: QueuedWrite[], id: string, extraBody: Record<string, unknown> = {}): QueuedWrite[] {
  return list.map(x => {
    if (x.id === id) return { ...x, state: 'waiting', error: undefined, body: { ...x.body, ...extraBody } };
    if (x.dependsOn === id && x.state === 'failed') return { ...x, state: 'waiting', error: undefined };
    return x;
  });
}

/** Discard a record, and anything that depended on it. */
export function discard(list: QueuedWrite[], id: string): QueuedWrite[] {
  const gone = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const x of list) if (x.dependsOn && gone.has(x.dependsOn) && !gone.has(x.id)) { gone.add(x.id); changed = true; }
  }
  return list.filter(x => !gone.has(x.id));
}

/** Task ids this user has completed or deferred offline, so the round does not offer them again. */
export function pendingTaskIds(list: QueuedWrite[], userId: string): Set<string> {
  const ids = new Set<string>();
  for (const x of list) {
    if (x.userId !== userId) continue;
    const m = /\/tasks\/([^/]+)\/(complete|defer)$/.exec(x.url);
    if (m) ids.add(m[1]);
  }
  return ids;
}

/** Records older than the server will accept as "when it happened". */
export function stale(list: QueuedWrite[], now: Date): QueuedWrite[] {
  return list.filter(x => now.getTime() - new Date(x.clientRecordedAt).getTime() > MAX_OFFLINE_HOURS * 3600_000);
}

export function summary(list: QueuedWrite[], userId: string) {
  const mine = list.filter(x => x.userId === userId);
  return {
    waiting: mine.filter(x => x.state === 'waiting').length,
    failed: mine.filter(x => x.state === 'failed').length,
    others: list.length - mine.length,
  };
}
