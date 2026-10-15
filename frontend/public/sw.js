/* ────────────────────────────────────────────────────────────────────────────
 * CareVista service worker — keeps the app opening, and the round working,
 * when the signal drops.
 *
 *   App shell  — every built file is stored when the app is installed or
 *                updated (list from /sw-assets.json, written by the build).
 *   Pages      — network first; with no signal, the stored app opens instead.
 *   API reads  — network first for the screens a carer needs on a round;
 *                with no signal, the last copy seen on this phone is shown.
 *   API writes — never touched here. Writes made offline are kept and sent by
 *                the app itself (services/offlineSync.ts), in order.
 *
 * Resident data stored for offline use is deleted when anyone signs out.
 * ──────────────────────────────────────────────────────────────────────────── */
const SHELL_PREFIX = 'cv-shell-';
const API_CACHE = 'cv-api-v1';

// Reads worth keeping for a round with no signal. Everything else goes to
// the network only.
const API_KEEP = [
  /\/api\/tasks(\?|$)/, /\/api\/residents(\?|$)/, /\/api\/residents\/[^/]+$/,
  /\/api\/monitoring\/today/, /\/api\/home$/, /\/api\/auth\/me$/,
  /\/api\/emar\/prn-followups$/, /\/api\/weights\/trends$/, /\/api\/deterioration(\?|$)/,
];

async function precache() {
  try {
    const res = await fetch('/sw-assets.json', { cache: 'no-store' });
    if (!res.ok) return;
    const { build, files } = await res.json();
    const name = SHELL_PREFIX + build;
    const cache = await caches.open(name);
    const have = new Set((await cache.keys()).map(r => new URL(r.url).pathname));
    const want = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png', ...files].filter(f => !have.has(f));
    // One at a time is slower but a single failed file does not lose the rest.
    for (const f of want) { try { await cache.add(new Request(new URL(f, self.location).href, { cache: 'reload' })); } catch (e) { /* keep going */ } }
    for (const key of await caches.keys()) {
      if (key.startsWith(SHELL_PREFIX) && key !== name) await caches.delete(key);
    }
  } catch (e) { /* offline at install: the next visit tries again */ }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'cv-clear-api-cache') event.waitUntil(caches.delete(API_CACHE));
  if (type === 'cv-precache') event.waitUntil(precache());
});

async function fromAnyShell(request) {
  for (const key of await caches.keys()) {
    if (!key.startsWith(SHELL_PREFIX)) continue;
    const hit = await (await caches.open(key)).match(request, { ignoreSearch: true });
    if (hit) return hit;
  }
  return undefined;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                                     // writes: the app's job
  if ((req.headers.get('accept') || '').includes('text/event-stream')) return;  // live updates
  const url = new URL(req.url);

  // Opening the app.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () =>
      (await fromAnyShell('/index.html')) || (await fromAnyShell('/')) || Response.error()));
    return;
  }

  // Built files are named by their content, so a stored copy is always right.
  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const hit = await fromAnyShell(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) {
        const keys = (await caches.keys()).filter(k => k.startsWith(SHELL_PREFIX));
        if (keys.length) (await caches.open(keys[0])).put(req, res.clone());
      }
      return res;
    })());
    return;
  }

  // API reads used on a round.
  if (url.pathname.includes('/api/') && API_KEEP.some(re => re.test(url.pathname + url.search))) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(API_CACHE)).put(req, res.clone());
        return res;
      } catch (e) {
        const hit = await (await caches.open(API_CACHE)).match(req);
        if (hit) {
          // Say it is a stored copy, so the app can label it.
          const headers = new Headers(hit.headers);
          headers.set('X-CV-From-Cache', '1');
          return new Response(await hit.blob(), { status: hit.status, statusText: hit.statusText, headers });
        }
        throw e;
      }
    })());
  }
});
