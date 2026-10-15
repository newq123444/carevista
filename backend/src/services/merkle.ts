// ────────────────────────────────────────────────────────────────────────────
// Merkle tree over a day's chain entries.
//
// Why a tree and not just the chain head? Both commit to every entry, but the
// tree gives an *inclusion proof*: you can prove one record was in the day's
// anchor by revealing log2(n) sibling hashes, without revealing any other
// record.
//
// That is not a technical nicety in this setting. If a coroner asks a home to
// prove one resident's night notes are unaltered, the alternative — replaying
// the whole chain — means handing over every other resident's records for that
// day. A proof that leaks sixty people's health data to substantiate one
// person's record would be a data protection failure in the act of
// demonstrating good practice.
//
// Second-preimage resistance: leaves and internal nodes are domain-separated
// with a 0x00 / 0x01 prefix (RFC 6962 §2.1). Without it, an internal node can
// be passed off as a leaf and a proof forged for a record that was never there.
// ────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';

const LEAF = Buffer.from([0x00]);
const NODE = Buffer.from([0x01]);

/** Hash of a leaf, domain-separated from internal nodes. */
export function leafHash(entryHashHex: string): string {
  return createHash('sha256')
    .update(LEAF)
    .update(Buffer.from(entryHashHex, 'hex'))
    .digest('hex');
}

function nodeHash(left: string, right: string): string {
  return createHash('sha256')
    .update(NODE)
    .update(Buffer.from(left, 'hex'))
    .update(Buffer.from(right, 'hex'))
    .digest('hex');
}

/** The empty tree has a defined root, so an anchor for a quiet day is still valid. */
export const EMPTY_ROOT = createHash('sha256').update(Buffer.alloc(0)).digest('hex');

/**
 * Merkle root over entry hashes, in order.
 *
 * An odd node at a level is promoted unchanged rather than duplicated. Node
 * duplication is the CVE-2012-2459 shape: two different leaf lists can produce
 * the same root, which would let someone claim a record was anchored when it
 * was not.
 */
export function merkleRoot(entryHashes: readonly string[]): string {
  if (entryHashes.length === 0) return EMPTY_ROOT;
  let level = entryHashes.map(leafHash);
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(i + 1 < level.length ? nodeHash(level[i], level[i + 1]) : level[i]);
    }
    level = next;
  }
  return level[0];
}

export interface ProofStep { hash: string; side: 'left' | 'right'; }

/**
 * Sibling hashes needed to recompute the root from one leaf.
 * `side` is the position of the SIBLING relative to the running hash.
 */
export function inclusionProof(entryHashes: readonly string[], index: number): ProofStep[] {
  if (index < 0 || index >= entryHashes.length) {
    throw new Error(`Index ${index} is outside the ${entryHashes.length} entries in this anchor`);
  }
  const proof: ProofStep[] = [];
  let level = entryHashes.map(leafHash);
  let idx = index;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        if (i === idx) proof.push({ hash: level[i + 1], side: 'right' });
        else if (i + 1 === idx) proof.push({ hash: level[i], side: 'left' });
        next.push(nodeHash(level[i], level[i + 1]));
      } else {
        // Promoted unpaired node: nothing is added to the proof, matching
        // merkleRoot's promotion rule exactly.
        next.push(level[i]);
      }
    }
    idx = Math.floor(idx / 2);
    level = next;
  }
  return proof;
}

/**
 * Recompute a root from one entry hash and its proof.
 *
 * This is the function a third party runs. It deliberately depends on nothing
 * but node:crypto, so it can be lifted out of this file and audited on its own.
 */
export function verifyInclusion(entryHashHex: string, proof: readonly ProofStep[], expectedRoot: string): boolean {
  let h = leafHash(entryHashHex);
  for (const step of proof) {
    h = step.side === 'right' ? nodeHash(h, step.hash) : nodeHash(step.hash, h);
  }
  return timingSafeEqualHex(h, expectedRoot);
}

/** Constant-time hex comparison, so a verifier cannot be probed byte by byte. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
