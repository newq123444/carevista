// RFC 3161 timestamps, checked against a real Time-Stamp Authority: OpenSSL's
// own `ts -reply`, with a throwaway CA. If OpenSSL is not installed the test
// says so and is skipped — it does not pretend to pass.
import assert from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';

const T = await import('./tsa.impl.mjs');
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; } catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); } };

let haveOpenssl = true;
try { execFileSync('openssl', ['version'], { stdio: 'ignore' }); } catch { haveOpenssl = false; }
if (!haveOpenssl) { console.log('\ntsa: SKIPPED — openssl not installed, nothing was checked'); process.exit(0); }

const dir = mkdtempSync(join(tmpdir(), 'cv-tsa-'));
const f = n => join(dir, n);
const ssl = (...args) => execFileSync('openssl', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] }).toString();
try {
  writeFileSync(f('tsa.ext'), 'basicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=critical,timeStamping\n');
  writeFileSync(f('ts.cnf'), `[ tsa ]\ndefault_tsa = tsa1\n[ tsa1 ]\ndir = ${dir}\nserial = ${f('serial')}\ncrypto_device = builtin\nsigner_digest = sha256\ndefault_policy = 1.2.3.4.1\ndigests = sha256\naccuracy = secs:1\nordering = no\ntsa_name = no\ness_cert_id_chain = no\ness_cert_id_alg = sha256\n`);
  writeFileSync(f('serial'), '01\n');
  ssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.crt', '-subj', '/CN=Test Root CA', '-days', '2');
  ssl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'tsa.key', '-out', 'tsa.csr', '-subj', '/CN=Test TSA');
  ssl('x509', '-req', '-in', 'tsa.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'tsa.crt', '-days', '2', '-extfile', 'tsa.ext');

  const reply = (reqDer) => {
    writeFileSync(f('q.tsq'), reqDer);
    ssl('ts', '-reply', '-config', 'ts.cnf', '-queryfile', 'q.tsq', '-inkey', 'tsa.key', '-signer', 'tsa.crt', '-out', 'r.tsr');
    return readFileSync(f('r.tsr'));
  };
  const digest = createHash('sha256').update('CareVista test seal').digest();
  const nonce = Buffer.from('0102030405060708', 'hex');

  await t('OpenSSL reads our request as a valid SHA-256 timestamp query', () => {
    writeFileSync(f('q.tsq'), T.buildTimeStampReq(digest, nonce));
    const text = ssl('ts', '-query', '-in', 'q.tsq', '-text');
    assert.match(text, /Hash Algorithm: sha256/);
    assert.match(text, new RegExp(digest.toString('hex').slice(0, 8).match(/../g).join(' '), 'i'));
    assert.match(text, /Nonce: 0x0102030405060708/i);
    assert.match(text, /Certificate required: yes/);
  });

  const der = reply(T.buildTimeStampReq(digest, nonce));
  const ts = T.parseTimeStampResp(der);

  await t('a granted reply is read: our digest, our nonce, a time, a serial, the policy', () => {
    assert.strictEqual(ts.granted, true);
    assert.strictEqual(ts.imprint, digest.toString('hex'));
    assert.strictEqual(ts.imprintAlgorithm, T.OID.sha256);
    assert.strictEqual(ts.nonce, '0102030405060708');
    assert.strictEqual(ts.policy, '1.2.3.4.1');
    assert.ok(Math.abs(ts.genTime.getTime() - Date.now()) < 120_000, 'genTime should be about now');
    assert.ok(ts.serial.length > 0);
  });
  await t('the token\'s signature checks out against the TSA certificate it carries', () => {
    const v = T.verifyTokenSignature(ts);
    assert.strictEqual(v.ok, true, v.reason);
    assert.match(v.signer.subject, /Test TSA/);
  });
  await t('OpenSSL independently verifies the same reply against the root (what an auditor would run)', () => {
    writeFileSync(f('r.tsr'), der);
    const out = ssl('ts', '-verify', '-digest', digest.toString('hex'), '-in', 'r.tsr', '-CAfile', 'ca.crt', '-untrusted', 'tsa.crt');
    assert.match(out, /Verification: OK/);
  });
  await t('a token whose time was altered fails the signature check', () => {
    const bad = Buffer.from(der);
    const at = bad.indexOf(Buffer.from(String(ts.genTime.getUTCFullYear())));
    assert.ok(at > 0);
    bad[at + 3] = bad[at + 3] === 0x39 ? 0x38 : bad[at + 3] + 1;   // change the year
    const p = T.parseTimeStampResp(bad);
    assert.strictEqual(T.verifyTokenSignature(p).ok, false);
  });
  await t('a refusal from the TSA is reported as a refusal, with its reason', () => {
    // TimeStampResp { status { rejection(2), statusString { "bad request" } } }
    const s = Buffer.from('bad request');
    const statusString = Buffer.concat([Buffer.from([0x30, s.length + 2, 0x0c, s.length]), s]);
    const statusInfo = Buffer.concat([Buffer.from([0x30, 3 + statusString.length, 0x02, 0x01, 0x02]), statusString]);
    const resp = Buffer.concat([Buffer.from([0x30, statusInfo.length]), statusInfo]);
    const r = T.parseTimeStampResp(resp);
    assert.strictEqual(r.granted, false);
    assert.strictEqual(r.status, 2);
    assert.match(r.statusText, /bad request/);
  });
  await t('garbage is an error, not a timestamp', () => {
    assert.throws(() => T.parseTimeStampResp(Buffer.from('<html>502</html>')));
  });

  // ── End to end over HTTP ────────────────────────────────────────────────
  let replay = null;
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = replay ?? reply(Buffer.concat(chunks));
      res.writeHead(200, { 'Content-Type': 'application/timestamp-reply' });
      res.end(body);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/tsr`;
  process.env.TSA_ALLOW_ANY = 'true';

  await t('requestTimestamp: a real round trip gives a stored-ready receipt', async () => {
    const d = createHash('sha256').update('round trip').digest();
    const r = await T.requestTimestamp(url, d);
    assert.ok(Buffer.isBuffer(r.der) && r.der.length > 500);
    assert.match(r.signer.subject, /Test TSA/);
  });
  await t('requestTimestamp refuses a reply to a different request (replayed old receipt)', async () => {
    replay = der;    // a genuine, signed reply — but for another digest and nonce
    await assert.rejects(() => T.requestTimestamp(url, createHash('sha256').update('other').digest()), /different fingerprint|nonce/);
    replay = null;
  });
  server.close();

  await t('only known timestamping services, unless the operator opens it up', () => {
    assert.strictEqual(T.tsaUrlProblem('http://timestamp.digicert.com', false), null);
    assert.match(T.tsaUrlProblem('http://169.254.169.254/latest/meta-data', false), /Not a known/);
    assert.match(T.tsaUrlProblem('file:///etc/passwd', false), /https/);
    assert.strictEqual(T.tsaUrlProblem('http://10.0.0.5/tsa', true), null);
  });
  await t('the sealed statement is plain text anyone can recompute', () => {
    const facts = { careHomeId: 'h1', day: '2026-10-10', fromSeq: 5, toSeq: 9, entryCount: 5, merkleRoot: 'a'.repeat(64), chainHead: 'b'.repeat(64) };
    const s = T.sealStatement(facts);
    assert.match(s, /^CareVista daily seal v1\nhome: h1\nday: 2026-10-10\nentries: 5-9 \(5\)\n/);
    assert.strictEqual(T.sealDigest(facts).toString('hex'), createHash('sha256').update(s).digest('hex'));
  });
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log(`\ntsa: ${pass} passed, ${fail} failed (against OpenSSL's own TSA)`);
if (fail) process.exit(1);
