# Record integrity — threat model

**Status:** design document, written before the code.
**Scope:** the tamper-evident record chain and the implausible-record detector.

This document exists so that nobody — a care home manager, a CQC inspector, an
endorsing body assessor, a coroner, or a future engineer — is misled about what
these mechanisms do. Overstating them would be worse than not having them,
because a false assurance gets relied on.

---

## 1. The problem

A care record is a legal document. It is read in coroner's inquests,
safeguarding enquiries, CQC enforcement, negligence claims and police
investigations. Two failures recur:

1. **Records are falsified.** MAR charts signed for medication that was never
   given. Night checks recorded that never happened. Notes written up at the end
   of a shift and dated as if contemporaneous. This is a documented, recurring
   theme in CQC enforcement.

2. **Honest homes cannot prove their innocence.** When a good home is accused,
   its defence is its own database — which its own administrator can edit. There
   is no way to demonstrate to a third party that a record has not been changed
   since the day it was made.

Existing care systems, including ours before this change, have an audit log.
An audit log is a table. Anyone with database access can update a table.

---

## 2. What the chain does

Every clinically meaningful record — a care note, a medication administration, a
completed care task, a resolution of an integrity finding — appends an entry to
an append-only chain, one chain per care home.

Each entry stores:

- a **canonical digest** of the record's meaningful fields (see §5),
- the **previous entry's chain hash**,
- its own **chain hash** = SHA-256(previous chain hash ‖ entry digest).

Because each entry commits to the one before it, altering any historic record
changes its digest, which breaks every chain hash after it. Verification replays
the chain from the source records and reports the first sequence number where
recomputation disagrees.

Once a day, the entries for that day are combined into a **Merkle root** and
stored as an anchor. A Merkle root, rather than just the chain head, is used
deliberately: it allows a single record to be proved without disclosing any
other record. Proving one resident's note should not require handing over sixty
other residents' notes to a third party.

---

## 3. What the chain protects against

| Threat | Detected? | How |
|---|---|---|
| A member of staff edits a historic care note through the app | Yes | Digest changes; chain breaks at that sequence |
| A manager edits a record directly in the database | Yes | Same — the chain is computed from record content |
| A record is deleted from the database | Yes | Chain gap; replay fails |
| A record is inserted later and dated as contemporaneous | Yes, **if** a later anchor was already externally published (see §4) |
| An administrator edits a record *and* the chain table to match | Yes, **if** externally anchored. **No**, if anchoring is local only |
| Backup restored to an earlier state to erase a record | Yes, if anchors were externally published |
| Clock manipulation on the server to back-date entries | Partially — external anchoring bounds when an entry can have existed |

---

## 4. What the chain does NOT protect against

These limits are stated in the product UI, not only here.

**It does not make a record true.** If a carer records "ate a full lunch" when
the resident ate nothing, the chain proves only that this false statement was
recorded at that time by that person. Integrity of the record is not accuracy of
the care. Anyone who reads "tamper-evident" as "verified true" has misunderstood
it, and the interface says so in those words.

**Local-only anchoring is materially weaker.** If the daily root hash is stored
only in the same database it protects, an attacker with full database access can
alter a record, recompute the entire chain forward, and rewrite the anchors. The
chain then verifies cleanly. Detection depends on the root hash having been
published somewhere the attacker does not control, before the alteration.

The product therefore reports its anchoring mode explicitly and refuses to
describe itself as tamper-evident against a privileged insider when anchoring is
local only. The available modes:

- `local` — root hash stored in the database. Default. Protects against
  accidental corruption and against anyone without database write access.
  **Does not** protect against a privileged insider. Labelled as such.
- `external` — root hash sent to an independent timestamping authority
  (RFC 3161) or other third party, with the receipt stored. Protects against a
  privileged insider from the moment of publication onward.

Until a home configures external anchoring, the app must not claim the stronger
property. This is enforced in the code path that renders the status, not left to
documentation.

**How external anchoring works (implemented in v86).** Each finished day is
sealed automatically within the hour. The text that is timestamped is a short
plain statement — home id, day, sequence range, entry count, Merkle root and
chain head — and only its SHA-256 leaves the server. The reply from the
Time-Stamp Authority is accepted only if it is granted, is for exactly that
digest and the request's nonce, and its CMS signature verifies against the
certificate it carries; only then is the seal marked published, and from then on
the database refuses any change to it. The signed receipt (`.tsr`) and the
statement can be downloaded, and checked by anyone with OpenSSL and the TSA's
root certificate (`openssl ts -verify -digest … -in seal-YYYY-MM-DD.tsr -CAfile
…`). The app deliberately does **not** check the TSA's certificate chain itself:
that check should not depend on trusting CareVista. Tested against OpenSSL's own
TSA, including an altered token (rejected) and a replayed genuine receipt for a
different seal (rejected). Not yet tested against a commercial TSA from this
environment, which has no outbound access to them.

The services offered by default (DigiCert, Sectigo, GlobalSign, FreeTSA) are
free public TSAs. None is a UK *qualified* trust service; a home that needs that
status must use a qualified provider, which the operator has to allow
explicitly (`TSA_ALLOW_ANY=true`), because the server makes an outbound request
to whatever address is configured.

**Records made offline.** A note recorded with no signal carries the phone's
clock (`client_recorded_at`), bounded by the database to no more than 5 minutes
ahead of, and 72 hours behind, the server's own time — which remains the
authoritative one, and is what the chain's `recorded_at` uses. The phone's time
is shown labelled "device time, not verified". Such records are excluded from the
"written up at the end of the shift" check (they arrive in a burst by design)
and remain subject to the late-entry check, which says the time came from the
phone.

**It is not a blockchain and no distributed ledger is involved.** It is a hash
chain with periodic external timestamping — a well-understood technique dating
to Haber and Stornetta (1991). We claim no invention of the cryptography. What
is new here is applying it to the care record with a specific evidential purpose
and a privacy-preserving single-record proof.

**It does not protect the current shift.** Entries made since the last anchor
are chained but not yet externally committed. The window is stated in the UI.

**It does not survive a stolen signing key**, because there is no signing key —
this is a hash chain, not a signature scheme. Per-entry signatures by the
authoring member of staff would be stronger and are noted as future work; they
require key management that a care home cannot realistically operate today.

---

## 5. Canonicalisation

Verification recomputes each digest from the live record. If serialisation is
not perfectly deterministic, verification produces **false alarms** — which is
the worst outcome, because a system that cries tampering when nothing happened
gets switched off, and then it protects nothing.

The canonical form therefore fixes:

- **Key order** — keys sorted by Unicode code point, recursively.
- **Absent vs null** — a field that is absent and a field that is null are
  normalised to the same thing. Postgres returns `null` for both.
- **Numbers** — `DECIMAL` columns are read as strings and kept as strings.
  Floating point is never used in a digest. `36.5` and `36.50` are different
  strings and would produce different digests, so numeric columns are
  normalised to a fixed representation at write time.
- **Timestamps** — always UTC, ISO 8601, millisecond precision.
- **Text** — Unicode NFC normalisation, so that visually identical text composed
  differently does not appear altered.
- **Booleans** — `true`/`false`, never `t`/`f` or `1`/`0`.

The field list that goes into each digest is stored with the entry, so that
adding a column to a table in a future migration does not invalidate historic
entries.

---

## 6. The implausible-record detector

Separate mechanism, different purpose. The chain answers "was this record
changed?". The detector answers "is this record credible on its face?".

It flags records that are physically impossible or strongly implausible given
other data the system already holds:

- personal care recorded for more residents than could be attended in the time,
- records entered a long time after the event they describe,
- records made by someone who was not on shift according to the rota,
- records for a resident who was in hospital or on leave at that time,
- a shift's worth of records entered in a single burst at the end of it.

**Framing is not cosmetic here.** Every finding is presented as a prompt to
check, never as an accusation. There are ordinary explanations for all of these:
a carer covering two floors, a tablet with a wrong clock, a rota not kept up to
date, a late return from hospital that nobody recorded. A tool that accuses
carers will be switched off within a week, and a switched-off tool protects
nobody. So:

- findings are visible to managers, not published to the team,
- every finding can be resolved with a written reason,
- the resolution itself is appended to the chain, so a pattern of dismissing
  findings is itself on the record,
- thresholds are configurable per home, and defaults are deliberately
  conservative — a false positive costs more trust than a missed finding.

**Known limitations.** The detector depends on the rota and absence records
being accurate; where they are not, it produces noise. It cannot detect a
plausible-looking falsification made at the right time by the right person on
shift — that is exactly the case it cannot see, and claiming otherwise would be
dishonest. It is a net for careless falsification and for genuine mistakes, not
a defence against a careful bad actor.

---

## 7. Residual risk

The honest summary a manager should be given:

> This proves your records have not been altered since they were made, and — once
> external anchoring is switched on — proves it to somebody who does not trust
> you. It does not prove the records are true, and it will not catch a careful
> person who writes a false record at the right time. It makes casual
> falsification detectable and it protects an honest home from an accusation it
> cannot otherwise disprove.
