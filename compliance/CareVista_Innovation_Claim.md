# CareVista — the innovation claim

**For:** endorsing body assessment, Innovator Founder route
**Founder:** Ramandeep Singh
**Version:** 78, September 2026

---

## 1. What is being claimed, in one sentence

Existing care record systems are built to make recording fast and compliant.
CareVista is built to make the resulting record **provable** — so that a home can
demonstrate to a coroner, a regulator, an insurer or a family that a record has
not been altered since the moment it was made, and so that records which are
implausible on their face are surfaced for someone to check.

## 2. What is NOT being claimed

Stated first, deliberately. An assessor who finds an overstatement in one part
of a claim will discount the rest of it.

- **No new cryptography.** Hash chains and Merkle trees are long-established
  (Haber & Stornetta, 1991; Merkle, 1979). Nothing here invents them.
- **No blockchain, no distributed ledger, no token.** These words do not appear
  in the product because none of them is involved.
- **Not a claim that records are true.** The mechanism proves a record was made
  at a time and has not changed since. A carer who writes something false at the
  right time produces a record that verifies perfectly. The product says this in
  those words, on screen, every time it reports a result.
- **Not a claim to detect a careful bad actor.** The implausibility checks catch
  careless falsification and honest mistakes. Someone on shift, writing a
  plausible entry at a plausible time, is not detectable by this and the product
  does not pretend otherwise.
- **No patent is being sought.** UK software patents are slow, expensive, and
  this would likely fall foul of excluded subject matter. The defensibility
  argument below does not depend on one.

## 3. The problem this addresses

A care record is a legal document. It is read in coroner's inquests,
safeguarding enquiries, CQC enforcement, negligence claims and police
investigations. Two failures recur across the sector:

**Records get falsified.** MAR charts signed for medication never given. Night
checks logged that never happened. Notes written up at end of shift and dated as
contemporaneous. This is a recurring theme in CQC enforcement activity.

**Honest homes cannot prove their innocence.** When a good home is accused, its
evidence is its own database — which its own administrator can edit. There is no
mechanism by which it can demonstrate to a third party that a record has not
been changed since the day it was written. CQC Regulation 17 requires accurate,
complete, contemporaneous records; it provides no way to *evidence* that they
are.

Both failures land hardest on the people least able to speak for themselves.

## 4. The three mechanisms

### 4.1 Tamper-evident record chain

Every care note, medication signature, completed task and integrity resolution
appends an entry to an append-only chain, one per home. Each entry commits to
the previous one, so altering any historic record breaks every hash after it,
and verification reports the exact point where the break begins.

Implementation decisions that an assessor can check:

- The chain table is append-only **at the database level**, enforced by a
  trigger that refuses UPDATE and DELETE. The application cannot quietly rewrite
  history, and neither can anyone using the application's credentials.
- Records and their chain entries are written in the **same transaction**, so a
  record can never exist without its entry, nor an entry without its record.
- The digest is taken over an **explicitly declared, typed field list** stored
  with each entry. This is what stops a later migration invalidating historic
  entries, and what stops a driver type difference producing a false alarm.
- Amendments **append**, never overwrite. Clinical practice and CQC expect the
  original to remain legible — you strike through, you do not erase — and the
  chain mirrors that. Verification compares the live row against the newest
  entry, so a legitimate correction does not look like tampering.

### 4.2 Privacy-preserving single-record proof

Each day is sealed with a Merkle root over that day's entries. This allows one
record to be proved with a handful of sibling hashes, without disclosing any
other record.

This is not a technical nicety. If a coroner asks a home to demonstrate that one
resident's night notes are unaltered, the alternative — replaying the chain —
means handing over every other resident's records for that day. A proof that
leaks sixty people's health data in order to substantiate one person's record
would be a data protection failure committed in the act of demonstrating good
practice. The tree avoids that.

The implementation defends against both classic Merkle attacks: leaves and
internal nodes are domain-separated (RFC 6962 §2.1) so an internal node cannot
be passed off as a leaf, and odd nodes are promoted rather than duplicated,
avoiding the CVE-2012-2459 collision where two different record sets share a
root. Both are covered by tests.

### 4.3 Implausible-record detection

A separate mechanism answering a different question: not "was this changed?" but
"is this credible on its face?". It flags:

- care recorded for more residents than could physically be attended in the time
- records entered long after the event they describe
- records made by someone not on shift according to the rota
- care recorded for a resident who was in hospital or on leave
- a shift's worth of records typed in a single burst at the end of it

Every finding carries its evidence, is visible to managers only, and must be
closed with a written reason — which is itself added to the chain, so a pattern
of dismissing findings is on the record.

**The framing is part of the engineering, not the marketing.** Every finding is
worded as a prompt to check, never an accusation, because there is an ordinary
explanation for nearly all of them. A tool that accuses carers gets switched off
within a week, and a switched-off tool protects nobody. There is an automated
test that fails the build if any finding is phrased accusatorially, and the
off-shift check ships **disabled by default** because it depends on the rota
being accurate and would otherwise blame carers for administrative gaps.

## 5. Why this is not simply copied

Honestly assessed, in descending order of strength.

**Strongest — the evidence, once it exists.** Twelve months of outcome data from
a real home, gathered under a stated methodology, cannot be replicated quickly by
anyone. This is the asset the business should be built around, and CareVista does
not have it yet. Everything below is a bridge to it.

**Strong — architectural retrofit cost.** The chain is a data-layer decision, not
a screen. An incumbent adding it must decide what to do about every record
already in their database that has no chain entry, and any answer that
back-fills entries for historic records produces a chain that proves nothing.
Their strongest honest claim would be "protected from today onward" — which is
the same claim a new entrant makes, without the migration.

**Moderate — the product thesis.** Competitors optimise for speed of recording.
Reorienting around provability changes what gets built and how findings are
worded. That is a strategic choice a competitor can make, but it cuts against
what they currently sell.

**Weak, and stated as such — the mechanism itself.** A competent engineering team
could implement a hash chain in a few weeks. This is not a technical moat and
should not be presented as one.

## 6. What an assessor can verify

Everything in section 4 is in the repository, not a slide:

| Claim | Where |
|---|---|
| Threat model, including limitations | `compliance/RECORD_INTEGRITY_THREAT_MODEL.md` |
| Canonical serialisation | `backend/src/utils/canonical.ts` |
| Chain, sealing and proofs | `backend/src/services/recordChain.ts`, `merkle.ts` |
| Implausibility checks | `backend/src/services/integrityChecks.ts` |
| Append-only enforcement | `backend/migrations/032_record_integrity.sql` |
| 119 tests, including tamper simulation | `backend/tests/`, run with `npm test` |

The test suite deliberately includes a test asserting the **documented
limitation** — that an attacker with full database write access can rewrite the
whole chain and it will verify clean — together with a test showing that a
published external seal catches exactly that. A claim is only worth as much as
its stated boundary.

## 7. Current status, stated plainly

- Mechanisms implemented, unit tested, not yet exercised against a production
  database with real volume.
- External anchoring is **designed and gated but not integrated**: the product
  ships in local-only mode and the interface refuses to describe itself as
  protecting against a privileged insider until a timestamping provider is
  configured.
- No pilot home yet. No outcome data yet. The competitive position described in
  section 5 is a plan, not an achievement.
