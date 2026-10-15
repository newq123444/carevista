// The service worker, run in a simulated browser: a fake network that can be
// switched off, and an in-memory Cache Storage. No real browser is available
// here, so this checks the logic, not how a given phone behaves.
import assert from 'node:assert';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../../frontend/public/sw.js', import.meta.url)), 'utf8');
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; } catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); } };

function makeWorld() {
  const store = new Map();                       // cacheName -> Map(url -> Response)
  const caches = {
    async open(name) {
      if (!store.has(name)) store.set(name, new Map());
      const m = store.get(name);
      const key = r => (typeof r === 'string' ? new URL(r, 'https://app.example').href : r.url);
      return {
        async put(r, res) { m.set(key(r), res); },
        async add(r) { const res = await world.fetch(r); if (!res.ok) throw new Error('bad'); m.set(key(r), res); },
        async match(r, opts) {
          const k = key(r);
          if (m.has(k)) return m.get(k).clone();
          if (opts?.ignoreSearch) { const base = k.split('?')[0]; for (const [kk, v] of m) if (kk.split('?')[0] === base) return v.clone(); }
          return undefined;
        },
        async keys() { return [...m.keys()].map(u => new Request(u)); },
      };
    },
    async keys() { return [...store.keys()]; },
    async delete(name) { return store.delete(name); },
  };
  const listeners = {};
  const world = {
    online: true,
    served: [],
    routes: {
      'https://app.example/sw-assets.json': () => new Response(JSON.stringify({ build: 'B1', files: ['/assets/index-abc.js', '/assets/CareDeck-def.js'] })),
      'https://app.example/': () => new Response('<html>app</html>', { headers: { 'content-type': 'text/html' } }),
      'https://app.example/index.html': () => new Response('<html>app</html>', { headers: { 'content-type': 'text/html' } }),
      'https://app.example/assets/index-abc.js': () => new Response('console.log(1)'),
      'https://app.example/assets/CareDeck-def.js': () => new Response('console.log(2)'),
      'https://api.example/api/tasks?date=2026-10-11': () => new Response(JSON.stringify([{ id: 't1' }]), { headers: { 'content-type': 'application/json' } }),
      'https://api.example/api/billing/invoices': () => new Response('[]'),
    },
    async fetch(input) {
      const url = typeof input === 'string' ? new URL(input, 'https://app.example').href : input.url;
      if (!world.online) throw new TypeError('Failed to fetch');
      world.served.push(url);
      const r = world.routes[url];
      return r ? r() : new Response('not found', { status: 404 });
    },
  };
  const self = {
    location: new URL('https://app.example/sw.js'),
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
  };
  const ctx = vm.createContext({ self, caches, fetch: (...a) => world.fetch(...a), Request, Response, Headers, URL, console, Set });
  vm.runInContext(src, ctx);

  async function lifecycle(type) {
    let p; listeners[type]({ waitUntil: x => { p = x; } }); await p;
  }
  async function request(url, init = {}) {
    let responded = null;
    const req = new Request(url, init);
    if (init.navigate) Object.defineProperty(req, 'mode', { value: 'navigate' });
    listeners.fetch({ request: req, respondWith: p => { responded = p; } });
    if (!responded) return { passedThrough: true };
    return await responded;
  }
  async function message(data) { let p; listeners.message({ data, waitUntil: x => { p = x; } }); await p; }
  return { world, store, lifecycle, request, message };
}

await t('install stores the whole app, from the list the build wrote', async () => {
  const w = makeWorld();
  await w.lifecycle('install');
  const shell = w.store.get('cv-shell-B1');
  assert.ok(shell, 'no shell cache');
  for (const f of ['/', '/index.html', '/assets/index-abc.js', '/assets/CareDeck-def.js']) {
    assert.ok(shell.has('https://app.example' + f), `missing ${f}`);
  }
});
await t('with no signal, opening the app gives the stored app', async () => {
  const w = makeWorld(); await w.lifecycle('install');
  w.world.online = false;
  const res = await w.request('https://app.example/round', { navigate: true });
  assert.strictEqual(await res.text(), '<html>app</html>');
});
await t('with no signal, the round\'s task list comes from the last copy, labelled as such', async () => {
  const w = makeWorld(); await w.lifecycle('install');
  await w.request('https://api.example/api/tasks?date=2026-10-11');      // online: stored
  w.world.online = false;
  const res = await w.request('https://api.example/api/tasks?date=2026-10-11');
  assert.deepStrictEqual(await res.json(), [{ id: 't1' }]);
  assert.strictEqual(res.headers.get('X-CV-From-Cache'), '1');
});
await t('screens that are not part of the round are not stored', async () => {
  const w = makeWorld();
  await w.request('https://api.example/api/billing/invoices');
  assert.ok(!(w.store.get('cv-api-v1')?.has('https://api.example/api/billing/invoices')));
});
await t('writes are never intercepted — the app queues them itself', async () => {
  const w = makeWorld();
  const r = await w.request('https://api.example/api/care-notes', { method: 'POST', body: '{}' });
  assert.strictEqual(r.passedThrough, true);
});
await t('live updates (event streams) are left alone', async () => {
  const w = makeWorld();
  const r = await w.request('https://api.example/api/tasks/stream', { headers: { accept: 'text/event-stream' } });
  assert.strictEqual(r.passedThrough, true);
});
await t('signing out deletes the stored resident data', async () => {
  const w = makeWorld();
  await w.request('https://api.example/api/tasks?date=2026-10-11');
  assert.ok(w.store.has('cv-api-v1'));
  await w.message({ type: 'cv-clear-api-cache' });
  assert.ok(!w.store.has('cv-api-v1'));
  w.world.online = false;
  await assert.rejects(() => w.request('https://api.example/api/tasks?date=2026-10-11'));
});
await t('a new build replaces the old stored app', async () => {
  const w = makeWorld(); await w.lifecycle('install');
  w.world.routes['https://app.example/sw-assets.json'] = () => new Response(JSON.stringify({ build: 'B2', files: ['/assets/index-abc.js'] }));
  await w.message({ type: 'cv-precache' });
  assert.ok(w.store.has('cv-shell-B2'));
  assert.ok(!w.store.has('cv-shell-B1'));
});
await t('installing with no signal does not break anything', async () => {
  const w = makeWorld(); w.world.online = false;
  await w.lifecycle('install');
  assert.strictEqual([...w.store.keys()].length, 0);
});

console.log(`\nservice worker: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
