// ────────────────────────────────────────────────────────────────────────────
// RFC 3161 trusted timestamps for the daily seals.
//
// A seal stored only in our own database proves nothing against someone who
// can write to that database: they could rewrite the records and recompute
// the seals. A timestamp from an independent Time-Stamp Authority closes that
// gap. The TSA signs "this fingerprint existed at this time"; it never sees a
// record, only a SHA-256 digest.
//
// What this file does, and does not, check:
//   ✔ the reply is a granted timestamp for exactly our digest and our nonce;
//   ✔ the signature inside the token is valid for the certificate the token
//     carries, and that certificate's key signed the attributes covering the
//     timestamp (messageDigest matches the TSTInfo);
//   ✘ it does NOT check that the TSA's certificate chains to a trusted root.
//     That is done independently by anyone holding the receipt:
//       openssl ts -verify -digest <hex> -in seal.tsr -CAfile <TSA root>.pem
//     — which is the point: the check should not depend on trusting us.
//
// No dependency: a small DER encoder/decoder for exactly the structures used.
// Tested against real OpenSSL-made replies in backend/tests/tsa.test.mjs.
// ────────────────────────────────────────────────────────────────────────────
import { createHash, randomBytes, verify as cryptoVerify, X509Certificate } from 'node:crypto';

export const OID = {
  sha256: '2.16.840.1.101.3.4.2.1',
  signedData: '1.2.840.113549.1.7.2',
  tstInfo: '1.2.840.113549.1.9.16.1.4',
  messageDigest: '1.2.840.113549.1.9.4',
};

// ── DER encoding ───────────────────────────────────────────────────────────
function encLen(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  while (n > 0) { bytes.unshift(n & 0xff); n = Math.floor(n / 256); }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
const tlv = (tag: number, value: Buffer) => Buffer.concat([Buffer.from([tag]), encLen(value.length), value]);
const seq = (...parts: Buffer[]) => tlv(0x30, Buffer.concat(parts));
function int(bytes: Buffer): Buffer {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  let b = bytes.subarray(i);
  if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0]), b]);
  return tlv(0x02, b);
}
function oid(dotted: string): Buffer {
  const parts = dotted.split('.').map(Number);
  const out = [40 * parts[0] + parts[1]];
  for (const p of parts.slice(2)) {
    const stack = [p & 0x7f];
    let v = Math.floor(p / 128);
    while (v > 0) { stack.unshift((v & 0x7f) | 0x80); v = Math.floor(v / 128); }
    out.push(...stack);
  }
  return tlv(0x06, Buffer.from(out));
}

/** TimeStampReq for a SHA-256 digest, asking for the TSA certificate. */
export function buildTimeStampReq(digest: Buffer, nonce: Buffer): Buffer {
  if (digest.length !== 32) throw new Error('A SHA-256 digest is 32 bytes');
  return seq(
    int(Buffer.from([1])),                                              // version
    seq(seq(oid(OID.sha256), Buffer.from([0x05, 0x00])), tlv(0x04, digest)), // messageImprint
    int(nonce),                                                         // nonce
    tlv(0x01, Buffer.from([0xff])),                                     // certReq TRUE
  );
}

// ── DER decoding ───────────────────────────────────────────────────────────
interface Node { tag: number; value: Buffer; raw: Buffer }

function readNode(buf: Buffer, at: number): { node: Node; next: number } {
  if (at + 2 > buf.length) throw new Error('Truncated DER');
  const tag = buf[at];
  if ((tag & 0x1f) === 0x1f) throw new Error('High tag numbers are not used here');
  let len = buf[at + 1];
  let hdr = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n === 0 || n > 4) throw new Error('Unsupported DER length');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[at + 2 + i];
    hdr += n;
  }
  const end = at + hdr + len;
  if (end > buf.length) throw new Error('DER length runs past the end');
  return { node: { tag, value: buf.subarray(at + hdr, end), raw: buf.subarray(at, end) }, next: end };
}
function kids(n: Node): Node[] {
  const out: Node[] = [];
  let at = 0;
  while (at < n.value.length) { const r = readNode(n.value, at); out.push(r.node); at = r.next; }
  return out;
}
function decOid(v: Buffer): string {
  const out = [Math.floor(v[0] / 40), v[0] % 40];
  let acc = 0;
  for (const b of v.subarray(1)) { acc = acc * 128 + (b & 0x7f); if (!(b & 0x80)) { out.push(acc); acc = 0; } }
  return out.join('.');
}
const decInt = (v: Buffer) => { let i = 0; while (i < v.length - 1 && v[i] === 0) i++; return v.subarray(i).toString('hex'); };
function decGeneralizedTime(v: Buffer): Date {
  const s = v.toString('ascii');
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:[.,](\d+))?Z$/.exec(s);
  if (!m) throw new Error(`Unexpected time format: ${s}`);
  const ms = m[7] ? Number((m[7] + '00').slice(0, 3)) : 0;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], ms));
}

export interface TimeStamp {
  granted: true;
  status: number;
  genTime: Date;
  serial: string;
  policy: string;
  imprintAlgorithm: string;
  imprint: string;
  nonce: string | null;
  tstInfo: Buffer;
  signedData: Node;
}
export interface Refusal { granted: false; status: number; statusText: string }

export function parseTimeStampResp(der: Buffer): TimeStamp | Refusal {
  const top = readNode(der, 0).node;
  if (top.tag !== 0x30) throw new Error('Not a TimeStampResp');
  const [statusInfo, token] = kids(top);
  const si = kids(statusInfo);
  const status = parseInt(decInt(si[0].value), 16);
  if (status !== 0 && status !== 1) {
    const text = si[1] && si[1].tag === 0x30 ? kids(si[1]).map(k => k.value.toString('utf8')).join('; ') : '';
    return { granted: false, status, statusText: text || `status ${status}` };
  }
  if (!token) throw new Error('Granted, but no token in the reply');

  const [ctype, explicit] = kids(token);
  if (decOid(ctype.value) !== OID.signedData) throw new Error('Token is not CMS SignedData');
  const signedData = kids(explicit)[0];
  const sd = kids(signedData);
  const encap = sd.find(n => n.tag === 0x30 && kids(n)[0]?.tag === 0x06 && decOid(kids(n)[0].value) === OID.tstInfo);
  if (!encap) throw new Error('No TSTInfo in the token');
  const eContentExplicit = kids(encap)[1];
  const octet = kids(eContentExplicit)[0];
  const tstInfo = octet.value;

  const t = kids(readNode(tstInfo, 0).node);
  const [, policy, imprint, serial, genTime, ...rest] = t;
  const [alg, hashed] = kids(imprint);
  const nonceNode = rest.find(n => n.tag === 0x02);
  return {
    granted: true, status,
    genTime: decGeneralizedTime(genTime.value),
    serial: decInt(serial.value),
    policy: decOid(policy.value),
    imprintAlgorithm: decOid(kids(alg)[0].value),
    imprint: hashed.value.toString('hex'),
    nonce: nonceNode ? decInt(nonceNode.value) : null,
    tstInfo,
    signedData,
  };
}

/** Check the CMS signature inside the token against the certificate it carries. */
export function verifyTokenSignature(ts: TimeStamp): { ok: boolean; reason?: string; signer?: { subject: string; issuer: string; validTo: string } } {
  const sd = kids(ts.signedData);
  const certSet = sd.find(n => n.tag === 0xa0);
  const signerInfos = sd[sd.length - 1];
  if (!certSet) return { ok: false, reason: 'The token carries no certificate (certReq was refused).' };
  if (signerInfos.tag !== 0x31) return { ok: false, reason: 'No signer information in the token.' };
  const certs = kids(certSet).map(c => { try { return new X509Certificate(c.raw); } catch { return null; } }).filter(Boolean) as X509Certificate[];

  for (const si of kids(signerInfos)) {
    const f = kids(si);
    const signedAttrs = f.find(n => n.tag === 0xa0);
    const digestAlg = f.find(n => n.tag === 0x30 && kids(n)[0]?.tag === 0x06);
    const signature = f.find(n => n.tag === 0x04);
    if (!signedAttrs || !digestAlg || !signature) continue;

    // messageDigest attribute must be the hash of the TSTInfo.
    const hashName = decOid(kids(digestAlg)[0].value) === OID.sha256 ? 'sha256'
      : decOid(kids(digestAlg)[0].value) === '2.16.840.1.101.3.4.2.2' ? 'sha384'
      : decOid(kids(digestAlg)[0].value) === '2.16.840.1.101.3.4.2.3' ? 'sha512'
      : decOid(kids(digestAlg)[0].value) === '1.3.14.3.2.26' ? 'sha1' : null;
    if (!hashName) return { ok: false, reason: 'Unsupported digest algorithm in the token.' };
    const md = kids(signedAttrs).find(a => decOid(kids(a)[0].value) === OID.messageDigest);
    if (!md) return { ok: false, reason: 'No messageDigest attribute.' };
    const claimed = kids(kids(md)[1])[0].value.toString('hex');
    if (claimed !== createHash(hashName).update(ts.tstInfo).digest('hex')) {
      return { ok: false, reason: 'The signed digest does not match the timestamp contents.' };
    }

    // The signature covers the attributes re-encoded as a SET (tag 0x31).
    const toVerify = Buffer.concat([Buffer.from([0x31]), signedAttrs.raw.subarray(1)]);
    for (const cert of certs) {
      try {
        if (cryptoVerify(hashName, toVerify, cert.publicKey, signature.value)) {
          return { ok: true, signer: { subject: cert.subject, issuer: cert.issuer, validTo: cert.validTo } };
        }
      } catch { /* try the next certificate */ }
    }
    return { ok: false, reason: 'The signature does not verify with any certificate in the token.' };
  }
  return { ok: false, reason: 'No usable signer information.' };
}

// ── What a seal's timestamp actually covers ────────────────────────────────
export interface SealFacts {
  careHomeId: string; day: string; fromSeq: number | string; toSeq: number | string;
  entryCount: number | string; merkleRoot: string; chainHead: string;
}
/** The exact text whose SHA-256 is timestamped. Shown and downloadable, so
 *  anyone can recompute the digest from the seal without trusting the app. */
export function sealStatement(f: SealFacts): string {
  return [
    'CareVista daily seal v1',
    `home: ${f.careHomeId}`,
    `day: ${f.day}`,
    `entries: ${f.fromSeq}-${f.toSeq} (${f.entryCount})`,
    `merkle_root: ${f.merkleRoot}`,
    `chain_head: ${f.chainHead}`,
    '',
  ].join('\n');
}
export const sealDigest = (f: SealFacts) => createHash('sha256').update(sealStatement(f), 'utf8').digest();

// ── Where requests may go ──────────────────────────────────────────────────
// The server makes an outbound request to whatever URL a manager types, so it
// is limited to known public TSAs unless the operator deliberately opens it.
export const KNOWN_TSA_HOSTS = [
  'timestamp.digicert.com', 'timestamp.sectigo.com', 'timestamp.globalsign.com',
  'freetsa.org', 'tsa.swisssign.net', 'timestamp.entrust.net',
];
export function tsaUrlProblem(url: string, allowAny = process.env.TSA_ALLOW_ANY === 'true'): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return 'Not a web address.'; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'Must start with https:// or http://';
  if (allowAny) return null;
  if (!KNOWN_TSA_HOSTS.includes(u.hostname.toLowerCase())) {
    return `Not a known timestamping service. Use one of: ${KNOWN_TSA_HOSTS.join(', ')} — or ask your administrator to set TSA_ALLOW_ANY=true.`;
  }
  return null;
}

/** Ask the TSA. Throws with a plain reason if anything is not exactly right. */
export async function requestTimestamp(url: string, digest: Buffer, timeoutMs = 20_000) {
  const problem = tsaUrlProblem(url);
  if (problem) throw new Error(problem);
  const nonce = randomBytes(8);
  nonce[0] &= 0x7f;                              // keep it a positive INTEGER without padding surprises
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/timestamp-query', Accept: 'application/timestamp-reply' },
    // An ArrayBuffer is a body type every fetch typing accepts; a Buffer is not.
    body: (() => { const b = buildTimeStampReq(digest, nonce); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; })(),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`The timestamping service answered ${res.status}.`);
  const der = Buffer.from(await res.arrayBuffer());
  const ts = parseTimeStampResp(der);
  if (!ts.granted) throw new Error(`The timestamping service refused: ${ts.statusText}`);
  if (ts.imprintAlgorithm !== OID.sha256 || ts.imprint !== digest.toString('hex')) {
    throw new Error('The timestamp is for a different fingerprint. Not stored.');
  }
  if (ts.nonce !== decInt(nonce)) throw new Error('The reply does not match this request (nonce). Not stored.');
  const sig = verifyTokenSignature(ts);
  if (!sig.ok) throw new Error(`The timestamp's signature did not check out: ${sig.reason}`);
  return { der, genTime: ts.genTime, serial: ts.serial, policy: ts.policy, signer: sig.signer! };
}
