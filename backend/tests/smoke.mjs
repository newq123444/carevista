// ============================================================
// tests/smoke.mjs — end-to-end smoke test of the core journeys.
// Requires a running server + migrated/seeded database.
//   SMOKE_BASE_URL   (default http://localhost:3001)
//   SMOKE_EMAIL      (default manager@demo.carevista.co.uk)
//   SMOKE_PASSWORD   (default Demo1234!)
// Exits non-zero if any check fails.
// ============================================================
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3001';
const EMAIL = process.env.SMOKE_EMAIL || 'manager@demo.carevista.co.uk';
const PASSWORD = process.env.SMOKE_PASSWORD || 'Demo1234!';

let token = null;
let pass = 0, fail = 0;
const results = [];

function check(name, cond, detail = '') {
  if (cond) { pass++; results.push(`  ✅ ${name}`); }
  else { fail++; results.push(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function req(method, path, { body, auth = true, raw = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : (raw ? body : JSON.stringify(body)),
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  return { status: res.status, data };
}

async function run() {
  console.log(`\nCareVista smoke test → ${BASE}\n`);

  // 1. Health
  const health = await req('GET', '/health', { auth: false });
  check('GET /health returns ok', health.status === 200 && health.data?.status === 'ok', `status ${health.status}`);

  // 2. Auth required
  const noAuth = await req('GET', '/api/residents', { auth: false });
  check('GET /api/residents without token is 401', noAuth.status === 401, `got ${noAuth.status}`);

  // 3. Login
  const login = await req('POST', '/api/auth/login', { auth: false, body: { email: EMAIL, password: PASSWORD } });
  token = login.data?.accessToken || null;
  check('POST /api/auth/login returns accessToken', login.status === 200 && !!token, `status ${login.status}`);
  if (!token) { report(); process.exit(1); }

  // 4. Me
  const me = await req('GET', '/api/auth/me');
  check('GET /api/auth/me returns the user', me.status === 200 && me.data?.email === EMAIL);

  // 5. List residents
  const list = await req('GET', '/api/residents');
  check('GET /api/residents returns residents array', list.status === 200 && Array.isArray(list.data?.residents));

  // 6. Create resident
  const create = await req('POST', '/api/residents', {
    body: { firstName: 'Smoke', lastName: 'Test', dateOfBirth: '1945-05-05',
            roomNumber: 'S1', admissionDate: '2026-01-01', riskLevel: 'low', gender: 'other' },
  });
  const residentId = create.data?.id;
  check('POST /api/residents creates a resident (201)', create.status === 201 && !!residentId, `status ${create.status}`);

  // 7. Read it back
  if (residentId) {
    const got = await req('GET', `/api/residents/${residentId}`);
    check('GET /api/residents/:id returns the new resident', got.status === 200 && got.data?.id === residentId);
  }

  // 8. Create care note
  let noteOk = false;
  if (residentId) {
    const note = await req('POST', '/api/care-notes', { body: { residentId, noteType: 'personal_care', content: 'Smoke test note — resident settled.' } });
    noteOk = note.status === 201;
    check('POST /api/care-notes creates a note (201)', noteOk, `status ${note.status}`);
  }

  // 9. Create incident
  if (residentId) {
    const inc = await req('POST', '/api/incidents', { body: { residentId, incidentType: 'near_miss', severity: 'low', description: 'Smoke test incident.' } });
    check('POST /api/incidents creates an incident (201)', inc.status === 201, `status ${inc.status}`);
  }

  // 10. New endpoint: compliance framework
  const fw = await req('GET', '/api/compliance/framework');
  check('GET /api/compliance/framework returns 5 CQC domains', fw.status === 200 && Array.isArray(fw.data?.domains) && fw.data.domains.length === 5);

  // ── Security assertions ──────────────────────────────────────────────────
  // 11. zod range validation rejects bad clinical value
  if (residentId) {
    const bad = await req('POST', '/api/care-notes', { body: { residentId, noteType: 'pain', content: 'x', painScore: 99 } });
    check('zod: painScore 99 rejected (400)', bad.status === 400, `got ${bad.status}`);
  }

  // 12. Missing required field rejected
  const missing = await req('POST', '/api/care-notes', { body: { noteType: 'general' } });
  check('zod: missing residentId/content rejected (400)', missing.status === 400, `got ${missing.status}`);

  // 13. Prototype-pollution guard (send raw JSON so __proto__ is an own key)
  const proto = await req('POST', '/api/residents', {
    raw: true,
    body: '{"__proto__":{"isAdmin":true},"firstName":"x","lastName":"y","dateOfBirth":"1950-01-01"}',
  });
  check('guard: __proto__ payload rejected (400)', proto.status === 400, `got ${proto.status}`);

  // ── Operational-role access (regression test for the cleaning/kitchen 403 fix) ──
  const opLogin = await req('POST', '/api/auth/login', { auth: false, body: { email: 'cleaning@demo.carevista.co.uk', password: PASSWORD } });
  const opToken = opLogin.data?.accessToken;
  check('cleaning role can log in', opLogin.status === 200 && !!opToken, `status ${opLogin.status}`);
  if (opToken) {
    const saved = token; token = opToken;
    const opDash = await req('GET', '/api/reports/dashboard');
    check('cleaning role loads dashboard summary (was 403)', opDash.status === 200, `got ${opDash.status}`);
    const opRes = await req('GET', '/api/residents');
    check('cleaning role can read residents (dietary/context)', opRes.status === 200, `got ${opRes.status}`);

    // Housekeeping checklist feature (as the cleaning role)
    const hkTasks = await req('GET', '/api/housekeeping/tasks?category=daily_room');
    check('housekeeping: daily_room tasks load', hkTasks.status === 200 && Array.isArray(hkTasks.data) && hkTasks.data.length > 0, `status ${hkTasks.status}`);
    const hkRooms = await req('GET', '/api/housekeeping/rooms');
    check('housekeeping: rooms list loads', hkRooms.status === 200 && Array.isArray(hkRooms.data), `status ${hkRooms.status}`);
    const roomNo = hkRooms.data?.[0]?.room_number || 'S1';
    const spec = hkTasks.data?.[0]?.specification || 'Remove waste - Empty all bins';
    const hkSave = await req('POST', '/api/housekeeping/logs', { body: { category: 'daily_room', locationType: 'resident_room', roomNumber: roomNo, periodDate: '2026-05-01', initials: 'ST', items: [{ specification: spec }] } });
    check('housekeeping: cleaner can save a checklist (201)', hkSave.status === 201 && hkSave.data?.saved >= 1, `status ${hkSave.status}`);
    const hkSum = await req('GET', '/api/housekeeping/summary');
    check('housekeeping: live summary loads', hkSum.status === 200 && typeof hkSum.data?.tasks_today === 'number', `status ${hkSum.status}`);
    token = saved;
  }

  report();
  process.exit(fail === 0 ? 0 : 1);
}

function report() {
  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed\n`);
}

run().catch((e) => { console.error('Smoke test crashed:', e); process.exit(1); });
