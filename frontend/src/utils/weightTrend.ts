// ────────────────────────────────────────────────────────────────────────────
// Weight trend, and the two parts of a MUST screen that can be worked out
// from recorded data.
//
// MUST ("Malnutrition Universal Screening Tool") is BAPEN's. It has three
// scored steps:
//   1. BMI           >20 = 0   18.5–20 = 1   <18.5 = 2
//   2. Unplanned weight loss in the past 3–6 months
//                    <5% = 0   5–10% = 1    >10% = 2
//   3. Acute disease effect (acutely ill AND no, or likely no, nutritional
//      intake for more than 5 days) = 2
// Overall: 0 low risk, 1 medium, 2 or more high.
//
// Steps 1 and 2 come from numbers we hold. Step 3 is a clinical judgement, and
// whether a loss was *planned* is too — so this never claims to be a MUST
// score. It gives the two step scores, says that they are a floor, and asks a
// nurse to complete the screen.
//
// Pure: no React, no API. Tested in backend/tests/weighttrend.test.mjs.
// ────────────────────────────────────────────────────────────────────────────

export interface WeightReading { weight_kg: number | string | null; created_at: string | Date }

export interface WeightTrend {
  latest: { kg: number; at: Date } | null;
  /** Readings used (valid, newest first). */
  count: number;

  bmi: number | null;
  bmiScore: 0 | 1 | 2 | null;

  /** Highest weight in the 6 months before the latest reading. */
  reference: { kg: number; at: Date } | null;
  /** Loss from reference to latest, % of reference. Negative = gain. 1 dp. */
  changePct: number | null;
  lossScore: 0 | 1 | 2 | null;
  /** Days between reference and latest. */
  spanDays: number | null;

  daysSinceWeighed: number | null;
  overdue: boolean;

  /** A jump since the previous reading too big to be real, most likely. */
  suspectReading: boolean;

  /** Step 1 + step 2, when both are known. Step 3 can only add to it. */
  mustFloor: number | null;

  level: 'ok' | 'watch' | 'act';
  /** Plain sentences, worst first. */
  concerns: string[];
  /** Things worth knowing that are not concerns. */
  notes: string[];
}

export const LOOKBACK_DAYS = 183;      // "past 3–6 months": up to six
export const DEFAULT_WEIGH_INTERVAL = 31;
const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const d1 = (n: number) => Math.round(n * 10) / 10;
const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const kg = (n: number) => `${n.toFixed(1)} kg`;

export function bmiScore(bmi: number | null): 0 | 1 | 2 | null {
  if (bmi == null || !Number.isFinite(bmi)) return null;
  const b = d1(bmi);
  if (b > 20) return 0;
  if (b >= 18.5) return 1;
  return 2;
}

export function lossScore(lossPct: number | null): 0 | 1 | 2 | null {
  if (lossPct == null || !Number.isFinite(lossPct)) return null;
  const p = d1(lossPct);
  if (p < 5) return 0;
  if (p <= 10) return 1;
  return 2;
}

function clean(readings: WeightReading[]): { kg: number; at: Date }[] {
  return (readings || [])
    .map(r => ({ kg: Number(r.weight_kg), at: new Date(r.created_at) }))
    // 20–350 kg: anything outside is a typing slip, not a person.
    .filter(r => Number.isFinite(r.kg) && r.kg >= 20 && r.kg <= 350 && !Number.isNaN(r.at.getTime()))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function weightTrend(
  readings: WeightReading[],
  heightCm: number | string | null | undefined,
  now: Date = new Date(),
  opts: { intervalDays?: number } = {},
): WeightTrend {
  const interval = opts.intervalDays ?? DEFAULT_WEIGH_INTERVAL;
  const rs = clean(readings);
  const concerns: string[] = [];
  const notes: string[] = [];

  const empty: WeightTrend = {
    latest: null, count: 0, bmi: null, bmiScore: null, reference: null, changePct: null,
    lossScore: null, spanDays: null, daysSinceWeighed: null, overdue: true, suspectReading: false,
    mustFloor: null, level: 'watch', concerns: ['No weight recorded.'], notes: [],
  };
  if (rs.length === 0) return empty;

  const latest = rs[0];
  const h = Number(heightCm);
  const bmi = Number.isFinite(h) && h >= 100 && h <= 230 ? d1(latest.kg / ((h / 100) ** 2)) : null;
  const bScore = bmiScore(bmi);
  if (bmi == null) notes.push('No height recorded, so BMI (MUST step 1) cannot be worked out.');

  // Reference: the highest weight in the six months before the latest one.
  const prior = rs.slice(1).filter(r => latest.at.getTime() - r.at.getTime() <= LOOKBACK_DAYS * DAY);
  const reference = prior.length ? prior.reduce((a, b) => (b.kg > a.kg ? b : a)) : null;
  const changePct = reference ? d1(((reference.kg - latest.kg) / reference.kg) * 100) : null;
  const lScore = changePct == null ? null : lossScore(Math.max(0, changePct));
  const spanDays = reference ? Math.round((latest.at.getTime() - reference.at.getTime()) / DAY) : null;
  if (!reference) notes.push('Only one weight in the last six months, so there is no trend yet.');

  // A change of 10% or more within a week is far more often a slip — wrong
  // resident, clothes, a different scale — than a real change. Say so before
  // anyone acts on it.
  const prev = rs[1];
  const suspectReading = !!prev
    && (latest.at.getTime() - prev.at.getTime()) <= 7 * DAY
    && Math.abs(latest.kg - prev.kg) / prev.kg >= 0.10;

  const daysSinceWeighed = Math.floor((now.getTime() - latest.at.getTime()) / DAY);
  const overdue = daysSinceWeighed > interval;

  if (suspectReading) {
    concerns.push(`${kg(latest.kg)} is ${Math.abs(d1(((latest.kg - prev!.kg) / prev!.kg) * 100))}% different from ${shortDate(prev!.at)}. Re-weigh before acting on it.`);
  }
  if (lScore != null && lScore > 0 && reference) {
    concerns.push(`Down ${changePct}% since ${shortDate(reference.at)} (${kg(reference.kg)} → ${kg(latest.kg)}) — MUST weight-loss score ${lScore}, if unplanned.`);
  }
  if (bScore != null && bScore > 0) {
    concerns.push(`BMI ${bmi} — MUST BMI score ${bScore}.`);
  }
  if (overdue) {
    concerns.push(`Not weighed for ${daysSinceWeighed} days (last ${shortDate(latest.at)}).`);
  }

  const mustFloor = bScore != null && lScore != null ? bScore + lScore : null;
  const worst = Math.max(bScore ?? 0, lScore ?? 0, mustFloor ?? 0);
  const level: WeightTrend['level'] = suspectReading ? 'watch'
    : worst >= 2 ? 'act'
    : (worst === 1 || overdue) ? 'watch' : 'ok';

  if (mustFloor != null && mustFloor > 0) {
    notes.push(`Steps 1 and 2 add up to ${mustFloor}; acute illness (step 3) could add 2. A nurse should complete the full MUST screen.`);
  }

  return {
    latest, count: rs.length, bmi, bmiScore: bScore, reference, changePct, lossScore: lScore, spanDays,
    daysSinceWeighed, overdue, suspectReading, mustFloor, level, concerns, notes,
  };
}
