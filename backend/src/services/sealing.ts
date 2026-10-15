// ────────────────────────────────────────────────────────────────────────────
// Daily seals, made and published without anyone having to remember.
//
// Every hour: seal any finished day (up to two weeks back) that has records
// but no seal, and — where the home has chosen external sealing — get an
// RFC 3161 timestamp for any seal not yet published. A seal is only marked
// "published" once a signed timestamp for exactly that seal is in hand.
// ────────────────────────────────────────────────────────────────────────────
import { query } from '../models/db';
import { logger } from '../utils/logger';
import { anchorDay } from './recordChain';
import { requestTimestamp, sealDigest, sealStatement, tsaUrlProblem, type SealFacts } from './tsa';

async function sealFacts(careHomeId: string, anchorId: number | string): Promise<(SealFacts & { publishedAt: Date | null }) | null> {
  const { rows: [a] } = await query<any>(
    `SELECT care_home_id, anchor_date::text AS day, from_seq, to_seq, entry_count, merkle_root, chain_head, published_at
       FROM chain_anchors WHERE id = $1 AND care_home_id = $2`, [anchorId, careHomeId]);
  if (!a) return null;
  return {
    careHomeId: a.care_home_id, day: a.day, fromSeq: String(a.from_seq), toSeq: String(a.to_seq),
    entryCount: String(a.entry_count), merkleRoot: String(a.merkle_root).trim(), chainHead: String(a.chain_head).trim(),
    publishedAt: a.published_at,
  };
}

export async function statementFor(careHomeId: string, anchorId: number | string) {
  const f = await sealFacts(careHomeId, anchorId);
  if (!f) return null;
  const digest = sealDigest(f).toString('hex');
  return {
    statement: sealStatement(f),
    digest,
    day: f.day,
    command: `openssl ts -verify -digest ${digest} -in seal-${f.day}.tsr -CAfile <the timestamping service's root certificate>.pem`,
  };
}

export async function publishAnchor(careHomeId: string, anchorId: number | string, endpoint: string) {
  const problem = tsaUrlProblem(endpoint);
  if (problem) return { ok: false as const, reason: problem };
  const f = await sealFacts(careHomeId, anchorId);
  if (!f) return { ok: false as const, reason: 'Seal not found.' };
  if (f.publishedAt) return { ok: false as const, reason: 'This seal is already published.' };

  const r = await requestTimestamp(endpoint, sealDigest(f));
  const host = new URL(endpoint).hostname;
  const ref = `RFC 3161 · ${host} · serial ${r.serial} · ${r.genTime.toISOString()} · policy ${r.policy} · signed by ${r.signer.subject.replace(/\n/g, ', ')}`;
  const { rowCount } = await query(
    `UPDATE chain_anchors
        SET anchor_mode = 'external', external_provider = $1, external_ref = $2,
            external_receipt = $3, published_at = $4
      WHERE id = $5 AND care_home_id = $6 AND published_at IS NULL`,
    [host, ref.slice(0, 2000), r.der, r.genTime, anchorId, careHomeId]);
  if (!rowCount) return { ok: false as const, reason: 'Published by someone else at the same moment.' };
  return { ok: true as const, genTime: r.genTime, ref };
}

/** Seal finished days, then publish where the home has asked for it. */
export async function sealPending(careHomeId: string) {
  const { rows: days } = await query<any>(
    `SELECT DISTINCT recorded_at::date::text AS day
       FROM record_chain
      WHERE care_home_id = $1 AND anchored_in IS NULL
        AND recorded_at::date < CURRENT_DATE
        AND recorded_at >= CURRENT_DATE - INTERVAL '14 days'
      ORDER BY 1`, [careHomeId]);
  let sealed = 0, published = 0;
  for (const d of days) {
    const r = await anchorDay(careHomeId, d.day);
    if (r.anchored) sealed++;
  }

  const { rows: [s] } = await query<any>(
    `SELECT anchor_mode, anchor_endpoint FROM integrity_settings WHERE care_home_id = $1`, [careHomeId]);
  if (s?.anchor_mode === 'external' && s.anchor_endpoint) {
    const { rows: open } = await query<any>(
      `SELECT id FROM chain_anchors WHERE care_home_id = $1 AND published_at IS NULL
        ORDER BY anchor_date LIMIT 30`, [careHomeId]);
    for (const a of open) {
      try {
        const r = await publishAnchor(careHomeId, a.id, s.anchor_endpoint);
        if (r.ok) published++;
      } catch (err: any) {
        logger.warn(`Timestamping failed for seal ${a.id}: ${err?.message}`);
        break;   // the service is down; try again next hour, in order
      }
    }
  }
  return { sealed, published };
}

let timer: NodeJS.Timeout | undefined;
export function startSealingSchedule() {
  if (process.env.AUTO_SEAL === 'false' || timer) return;
  const run = async () => {
    try {
      const { rows: homes } = await query<any>(
        `SELECT DISTINCT care_home_id FROM record_chain WHERE recorded_at >= NOW() - INTERVAL '15 days'`);
      for (const h of homes) {
        const r = await sealPending(h.care_home_id);
        if (r.sealed || r.published) logger.info(`Seals for ${h.care_home_id}: ${r.sealed} sealed, ${r.published} published`);
      }
    } catch (err: any) {
      logger.warn(`Automatic sealing did not run: ${err?.message}`);
    }
  };
  setTimeout(run, 2 * 60_000).unref?.();
  timer = setInterval(run, 60 * 60_000);
  timer.unref?.();
}
