// ────────────────────────────────────────────────────────────────────────────
// Implausible-record detection.
//
// The chain answers "was this record changed?". This answers "is this record
// credible on its face?".
//
// Every function here is pure: data in, findings out, no database. That is
// deliberate — these are judgement calls with real consequences for real people,
// and a judgement call that cannot be unit tested should not be shipped.
//
// FRAMING IS NOT COSMETIC. Every finding is a prompt to check, never an
// accusation. There is an ordinary explanation for nearly all of these: a carer
// covering two floors, a tablet with the wrong clock, a rota nobody updated, a
// resident who came back from hospital early. A tool that accuses carers gets
// switched off within a week, and a switched-off tool protects nobody. The
// wording below is part of the design, not decoration.
//
// See compliance/RECORD_INTEGRITY_THREAT_MODEL.md §6 for what this cannot see.
// ────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';

export interface RecordRow {
  id: string;
  residentId: string | null;
  residentName?: string | null;
  staffId: string | null;
  staffName?: string | null;
  /** When the care happened. */
  eventAt: Date;
  /** When it was typed in. */
  recordedAt: Date;
  kind: string;              // care_note | med_administration | care_task
  category?: string | null;  // e.g. personal_care
  /** Made on a phone with no signal and sent later; eventAt is the phone's
   *  clock (bounded, not verified). */
  offline?: boolean;
}

export interface ShiftRow { staffId: string; start: Date; end: Date; }
export interface AbsenceRow { residentId: string; from: Date; to: Date | null; reason?: string | null; }

export interface Thresholds {
  minMinutesPerResident: number;
  burstMinRecords: number;
  burstWindowMinutes: number;
  lateEntryHours: number;
  checkOffShift: boolean;
  checkAbsentResident: boolean;
  checkLateEntry: boolean;
  checkThroughput: boolean;
  checkEndOfShiftBurst: boolean;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  minMinutesPerResident: 3,
  burstMinRecords: 6,
  burstWindowMinutes: 5,
  lateEntryHours: 6,
  // Off-shift checking is OFF by default. It depends on the rota being kept
  // accurate, and flagging a carer who did turn up because nobody updated the
  // rota is exactly how a home loses faith in the whole feature.
  checkOffShift: false,
  checkAbsentResident: true,
  checkLateEntry: true,
  checkThroughput: true,
  checkEndOfShiftBurst: true,
};

export type Severity = 'review' | 'notable' | 'urgent';

export interface Finding {
  kind: string;
  severity: Severity;
  staffId: string | null;
  residentId: string | null;
  occurredOn: string;
  summary: string;
  evidence: Record<string, unknown>;
  recordIds: string[];
  fingerprint: string;
}

const MIN = 60_000;

function dayOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * A stable identity for the same observation.
 *
 * Re-running the detector must not pile up duplicates of a finding a manager
 * has already dealt with, so the fingerprint covers what the finding is about
 * and never when it was detected.
 */
function fingerprintOf(kind: string, parts: (string | null)[]): string {
  return createHash('sha256').update([kind, ...parts.map(p => p ?? '~')].join(' ')).digest('hex');
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── 1. Throughput ──────────────────────────────────────────────────────────
/**
 * Care recorded for more residents than could physically be attended.
 *
 * Grows a window over one person's consecutive records; if it covers enough
 * different residents in a span that allows less than the configured minutes
 * each, the time does not add up.
 */
export function checkThroughput(records: RecordRow[], th: Thresholds): Finding[] {
  if (!th.checkThroughput) return [];
  const out: Finding[] = [];
  const byStaff = groupBy(records.filter(r => r.staffId && r.residentId), r => r.staffId!);

  for (const [staffId, rows] of byStaff) {
    const sorted = [...rows].sort((a, b) => a.eventAt.getTime() - b.eventAt.getTime());
    let i = 0;
    while (i < sorted.length) {
      const residents = new Set<string>();
      let worst: { j: number; perResident: number } | null = null;
      let j = i;
      while (j < sorted.length) {
        residents.add(sorted[j].residentId!);
        const spanMins = (sorted[j].eventAt.getTime() - sorted[i].eventAt.getTime()) / MIN;
        if (residents.size >= 3) {
          const perResident = spanMins / residents.size;
          if (perResident < th.minMinutesPerResident) worst = { j, perResident };
          else break;
        }
        j++;
      }
      if (worst) {
        const window = sorted.slice(i, worst.j + 1);
        const uniq = [...new Set(window.map(r => r.residentId!))];
        const spanMins = (window[window.length - 1].eventAt.getTime() - window[0].eventAt.getTime()) / MIN;
        out.push({
          kind: 'throughput',
          severity: worst.perResident < th.minMinutesPerResident / 2 ? 'notable' : 'review',
          staffId,
          residentId: null,
          occurredOn: dayOf(window[0].eventAt),
          summary:
            `${window[0].staffName || 'A member of staff'} recorded care for ${plural(uniq.length, 'resident', 'residents')} ` +
            `within ${Math.round(spanMins)} minutes — about ${worst.perResident.toFixed(1)} minutes each. ` +
            `Worth checking whether the times were entered as they happened.`,
          evidence: {
            residentsInWindow: uniq.length,
            windowMinutes: Math.round(spanMins),
            minutesPerResident: Number(worst.perResident.toFixed(1)),
            thresholdMinutes: th.minMinutesPerResident,
            from: window[0].eventAt.toISOString(),
            to: window[window.length - 1].eventAt.toISOString(),
          },
          recordIds: window.map(r => r.id),
          fingerprint: fingerprintOf('throughput', [staffId, dayOf(window[0].eventAt), window[0].eventAt.toISOString(), String(uniq.length)]),
        });
        i = worst.j + 1;
      } else {
        i++;
      }
    }
  }
  return out;
}

// ── 2. Recorded long after the event ───────────────────────────────────────
export function checkLateEntry(records: RecordRow[], th: Thresholds): Finding[] {
  if (!th.checkLateEntry) return [];
  const out: Finding[] = [];
  for (const r of records) {
    const lagHours = (r.recordedAt.getTime() - r.eventAt.getTime()) / (60 * MIN);
    if (lagHours < th.lateEntryHours) continue;
    out.push({
      kind: 'late_entry',
      severity: lagHours >= th.lateEntryHours * 4 ? 'notable' : 'review',
      staffId: r.staffId,
      residentId: r.residentId,
      occurredOn: dayOf(r.eventAt),
      summary: r.offline
        ? `Recorded on a phone with no signal at ${hhmm(r.eventAt)} (phone time, not verified) and sent ` +
          `${Math.round(lagHours)} hours later. Worth checking why the phone was offline that long — and, ` +
          `because the phone's clock cannot be verified, that the time is right.`
        : `Care timed at ${hhmm(r.eventAt)} was entered ${Math.round(lagHours)} hours later. ` +
          `A record written well after the event is harder to rely on afterwards — it may simply be that the ` +
          `tablet was out of range, which is worth noting on the record itself.`,
      evidence: {
        eventAt: r.eventAt.toISOString(),
        recordedAt: r.recordedAt.toISOString(),
        hoursLate: Math.round(lagHours),
        thresholdHours: th.lateEntryHours,
        ...(r.offline ? { offline: true, eventTimeSource: 'device clock, not verified' } : {}),
      },
      recordIds: [r.id],
      fingerprint: fingerprintOf('late_entry', [r.id]),
    });
  }
  return out;
}

// ── 3. Recorded by someone not on shift ────────────────────────────────────
export function checkOffShift(records: RecordRow[], shifts: ShiftRow[], th: Thresholds): Finding[] {
  if (!th.checkOffShift) return [];
  const byStaff = groupBy(shifts, s => s.staffId);
  const out: Finding[] = [];
  for (const r of records) {
    if (!r.staffId) continue;
    const theirs = byStaff.get(r.staffId) || [];
    // No rota at all for this person is not a finding. It means the rota is
    // incomplete, which is a different problem and not this person's doing.
    if (theirs.length === 0) continue;
    const covered = theirs.some(s =>
      r.eventAt.getTime() >= s.start.getTime() - 30 * MIN &&
      r.eventAt.getTime() <= s.end.getTime() + 30 * MIN);
    if (covered) continue;
    out.push({
      kind: 'off_shift',
      severity: 'review',
      staffId: r.staffId,
      residentId: r.residentId,
      occurredOn: dayOf(r.eventAt),
      summary:
        `${r.staffName || 'A member of staff'} recorded care at ${hhmm(r.eventAt)}, which is outside the shifts ` +
        `on the rota for that day. Most often this means the rota was not updated after a swap or extra cover.`,
      evidence: {
        eventAt: r.eventAt.toISOString(),
        shiftsThatDay: theirs.map(s => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
        graceMinutes: 30,
      },
      recordIds: [r.id],
      fingerprint: fingerprintOf('off_shift', [r.id]),
    });
  }
  return out;
}

// ── 4. Care recorded for a resident who was not there ──────────────────────
export function checkAbsentResident(records: RecordRow[], absences: AbsenceRow[], th: Thresholds): Finding[] {
  if (!th.checkAbsentResident) return [];
  const byResident = groupBy(absences, a => a.residentId);
  const out: Finding[] = [];
  for (const r of records) {
    if (!r.residentId) continue;
    const theirs = byResident.get(r.residentId) || [];
    const during = theirs.find(a =>
      r.eventAt.getTime() >= a.from.getTime() &&
      (a.to === null || r.eventAt.getTime() <= a.to.getTime()));
    if (!during) continue;
    out.push({
      kind: 'absent_resident',
      severity: 'notable',
      staffId: r.staffId,
      residentId: r.residentId,
      occurredOn: dayOf(r.eventAt),
      summary:
        `Care was recorded for ${r.residentName || 'a resident'} at a time when they were recorded as away ` +
        `(${during.reason || 'absent'}). Either the care record or the absence record needs correcting — ` +
        `a resident cannot be in two places.`,
      evidence: {
        eventAt: r.eventAt.toISOString(),
        absentFrom: during.from.toISOString(),
        absentTo: during.to ? during.to.toISOString() : null,
        reason: during.reason || null,
      },
      recordIds: [r.id],
      fingerprint: fingerprintOf('absent_resident', [r.id]),
    });
  }
  return out;
}

// ── 5. A shift's worth of records typed in one burst ───────────────────────
/**
 * Many records, describing care spread across hours, all entered within a few
 * minutes. This is the shape of writing up a shift from memory at the end of
 * it — not fraud, but a real risk to accuracy, and precisely what
 * "contemporaneous records" under CQC Regulation 17 is about.
 */
export function checkEndOfShiftBurst(records: RecordRow[], th: Thresholds): Finding[] {
  if (!th.checkEndOfShiftBurst) return [];
  const out: Finding[] = [];
  // Records sent from a phone when its signal came back arrive in a burst by
  // design; they were made at the time, not written up later. They are
  // excluded here and looked at by the late-entry check instead.
  const byStaff = groupBy(records.filter(r => r.staffId && !r.offline), r => r.staffId!);

  for (const [staffId, rows] of byStaff) {
    const sorted = [...rows].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j + 1 < sorted.length &&
             (sorted[j + 1].recordedAt.getTime() - sorted[i].recordedAt.getTime()) <= th.burstWindowMinutes * MIN) {
        j++;
      }
      const window = sorted.slice(i, j + 1);
      if (window.length >= th.burstMinRecords) {
        const eventSpanHours =
          (Math.max(...window.map(r => r.eventAt.getTime())) -
           Math.min(...window.map(r => r.eventAt.getTime()))) / (60 * MIN);
        // Only interesting if the care itself was spread out. Six records
        // entered together about six things that happened together is just a
        // carer finishing a round, and flagging it would be noise.
        if (eventSpanHours >= 2) {
          const typedMins = (window[window.length - 1].recordedAt.getTime() - window[0].recordedAt.getTime()) / MIN;
          out.push({
            kind: 'end_of_shift_burst',
            severity: eventSpanHours >= 6 ? 'notable' : 'review',
            staffId,
            residentId: null,
            occurredOn: dayOf(window[0].recordedAt),
            summary:
              `${window[0].staffName || 'A member of staff'} entered ${plural(window.length, 'record', 'records')} ` +
              `in ${Math.round(typedMins)} minutes, covering care spread over about ${Math.round(eventSpanHours)} hours. ` +
              `Records written up at the end of a shift are easy to get wrong; it may be worth asking whether ` +
              `something is making it hard to record as they go.`,
            evidence: {
              recordCount: window.length,
              typedWithinMinutes: Math.round(typedMins),
              careSpanHours: Math.round(eventSpanHours),
              firstEnteredAt: window[0].recordedAt.toISOString(),
            },
            recordIds: window.map(r => r.id),
            fingerprint: fingerprintOf('end_of_shift_burst', [staffId, window[0].recordedAt.toISOString()]),
          });
        }
        i = j + 1;
      } else {
        i++;
      }
    }
  }
  return out;
}

// ── Runner ─────────────────────────────────────────────────────────────────
export function runAllChecks(input: {
  records: RecordRow[];
  shifts: ShiftRow[];
  absences: AbsenceRow[];
  thresholds?: Partial<Thresholds>;
}): Finding[] {
  const th = { ...DEFAULT_THRESHOLDS, ...(input.thresholds || {}) };
  const findings = [
    ...checkThroughput(input.records, th),
    ...checkLateEntry(input.records, th),
    ...checkOffShift(input.records, input.shifts, th),
    ...checkAbsentResident(input.records, input.absences, th),
    ...checkEndOfShiftBurst(input.records, th),
  ];
  const rank: Record<Severity, number> = { review: 0, notable: 1, urgent: 2 };
  const best = new Map<string, Finding>();
  for (const f of findings) {
    const prev = best.get(f.fingerprint);
    if (!prev || rank[f.severity] > rank[prev.severity]) best.set(f.fingerprint, f);
  }
  return [...best.values()].sort((a, b) =>
    rank[b.severity] - rank[a.severity] || a.occurredOn.localeCompare(b.occurredOn));
}

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of items) {
    const k = key(it);
    const arr = m.get(k);
    if (arr) arr.push(it); else m.set(k, [it]);
  }
  return m;
}
