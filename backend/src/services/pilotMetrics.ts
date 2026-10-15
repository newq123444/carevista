// ────────────────────────────────────────────────────────────────────────────
// Pilot evidence: the same measures for two periods, side by side.
//
// Written to be read by someone sceptical. So every measure:
//   • has its definition stated in a sentence, next to the number;
//   • shows the numbers it was made from, not only a percentage;
//   • says "not enough data" rather than a percentage of almost nothing;
//   • says which direction is better, so a change is never spun.
// A baseline can come from CareVista's own records, or be typed in from a
// paper audit — in which case it is labelled as such, with its source.
//
// Pure: counts in, rows out. Tested in backend/tests/pilotmetrics.test.mjs.
// ────────────────────────────────────────────────────────────────────────────

export interface PeriodCounts {
  tasksScheduled: number; tasksDone: number; tasksDeferred: number;
  tasksTimely: number; tasksLate: number; medianDelayMin: number | null;
  fluidResidentDays: number; fluidDays4Plus: number; fluidDaysWithTarget: number; fluidDaysTargetMet: number;
  bowelResidentDays: number; bowelDaysRecorded: number;
  mcaCompleted: number; mcaCurrentAtEnd: number; mcaOverdueAtEnd: number;
  prnGiven: number; prnEffectRecorded: number; prnEffectWithin2h: number;
  softSignsRaised: number; softSignsAcknowledged: number; softSignsMedianAckMin: number | null; softSignsClosed: number;
  residentsAtEnd: number; residentsWeighed31d: number;
}

export interface ManualBaseline { value: number; source: string }

export interface MetricRow {
  key: string;
  group: string;
  label: string;
  definition: string;
  better: 'higher' | 'lower';
  unit: '%' | 'min' | 'n';
  baseline: Cell;
  pilot: Cell;
  /** Pilot minus baseline, in the metric's unit (percentage points for %). */
  change: number | null;
  verdict: 'better' | 'worse' | 'same' | 'unknown';
}
export interface Cell { value: number | null; numerator?: number; denominator?: number; note?: string; manual?: string }

/** Fewer than this many cases and a percentage is not shown. */
export const MIN_DENOMINATOR = 20;

const r1 = (n: number) => Math.round(n * 10) / 10;

function pct(num: number, den: number): Cell {
  if (!den || den < MIN_DENOMINATOR) return { value: null, numerator: num, denominator: den, note: den ? `only ${den} — too few to compare` : 'no data' };
  return { value: r1((num / den) * 100), numerator: num, denominator: den };
}
function plain(v: number | null, unit: 'min' | 'n', enough = true): Cell {
  if (v == null || !enough) return { value: null, note: 'no data' };
  return { value: unit === 'min' ? Math.round(v) : v };
}

interface Spec {
  key: string; group: string; label: string; definition: string; better: 'higher' | 'lower'; unit: '%' | 'min' | 'n';
  cell: (c: PeriodCounts) => Cell;
}

export const SPECS: Spec[] = [
  { key: 'task_completion', group: 'Care delivered and recorded', label: 'Planned care recorded as done', unit: '%', better: 'higher',
    definition: 'Of the care tasks planned for residents (excluding medicines, which are on the MAR chart, and tasks marked not applicable), the share recorded as done.',
    cell: c => pct(c.tasksDone, c.tasksScheduled) },
  { key: 'task_timely', group: 'Care delivered and recorded', label: 'Recorded within an hour of when it was due', unit: '%', better: 'higher',
    definition: 'Of the tasks recorded as done, the share recorded within 60 minutes either side of the due time (UK time). Uses the time the record reached the server — records made offline count when they arrived, which can only make this figure lower.',
    cell: c => pct(c.tasksTimely, c.tasksDone) },
  { key: 'task_late', group: 'Care delivered and recorded', label: 'Recorded more than 2 hours after it was due', unit: '%', better: 'lower',
    definition: 'Of the tasks recorded as done, the share recorded more than two hours after the due time.',
    cell: c => pct(c.tasksLate, c.tasksDone) },
  { key: 'task_median_delay', group: 'Care delivered and recorded', label: 'Typical gap between due and recorded (median)', unit: 'min', better: 'lower',
    definition: 'The median number of minutes between when a task was due and when it was recorded as done. Negative means recorded before the due time.',
    cell: c => plain(c.medianDelayMin, 'min', c.tasksDone >= MIN_DENOMINATOR) },

  { key: 'fluid_4plus', group: 'Fluids, food and bowels', label: 'Fluid charts with at least 4 drinks recorded in the day', unit: '%', better: 'higher',
    definition: 'For residents whose chart says their fluids are monitored, the share of days with four or more drinks recorded. A day with fewer is usually a recording gap, not a resident drinking nothing.',
    cell: c => pct(c.fluidDays4Plus, c.fluidResidentDays) },
  { key: 'fluid_target', group: 'Fluids, food and bowels', label: 'Days the fluid target was reached', unit: '%', better: 'higher',
    definition: 'For residents with a daily fluid target set by a nurse, the share of days on which the recorded total reached it.',
    cell: c => pct(c.fluidDaysTargetMet, c.fluidDaysWithTarget) },
  { key: 'bowels_recorded', group: 'Fluids, food and bowels', label: 'Days with a bowel entry (opened or not)', unit: '%', better: 'higher',
    definition: 'For every current resident, the share of days with a bowel entry — whether bowels opened or not. Missing days are what let constipation go unnoticed.',
    cell: c => pct(c.bowelDaysRecorded, c.bowelResidentDays) },
  { key: 'weighed_31d', group: 'Fluids, food and bowels', label: 'Residents weighed in the last month (at period end)', unit: '%', better: 'higher',
    definition: 'Of residents living in the home at the end of the period, the share with a weight recorded in the 31 days before it.',
    cell: c => pct(c.residentsWeighed31d, c.residentsAtEnd) },

  { key: 'prn_effect', group: 'Medicines', label: '"As required" doses with the effect recorded', unit: '%', better: 'higher',
    definition: 'Of "as required" (PRN) doses given, the share where someone recorded whether it worked, as NICE SC1 asks.',
    cell: c => pct(c.prnEffectRecorded, c.prnGiven) },
  { key: 'prn_effect_2h', group: 'Medicines', label: '…recorded within 2 hours of the dose', unit: '%', better: 'higher',
    definition: 'Of "as required" doses given, the share with the effect recorded within two hours.',
    cell: c => pct(c.prnEffectWithin2h, c.prnGiven) },

  { key: 'mca_overdue', group: 'Mental capacity', label: 'Capacity assessments past their review date (at period end)', unit: '%', better: 'lower',
    definition: 'Of current, completed capacity assessments at the end of the period, the share whose review date had passed.',
    cell: c => pct(c.mcaOverdueAtEnd, c.mcaCurrentAtEnd) },
  { key: 'mca_completed', group: 'Mental capacity', label: 'Capacity assessments completed', unit: 'n', better: 'higher',
    definition: 'How many decision-specific assessments were completed in the period. More is not automatically better; read alongside the one above.',
    cell: c => plain(c.mcaCompleted, 'n') },

  { key: 'soft_signs_raised', group: 'Noticing deterioration', label: '"Something\'s not right" alerts raised', unit: 'n', better: 'higher',
    definition: 'How many times staff raised a soft-signs alert. In a pilot, more is a sign the habit is forming, not that residents are less well.',
    cell: c => plain(c.softSignsRaised, 'n') },
  { key: 'soft_signs_ack', group: 'Noticing deterioration', label: 'Typical time for a nurse to respond (median)', unit: 'min', better: 'lower',
    definition: 'The median minutes from an alert being raised to a nurse or senior acknowledging it.',
    cell: c => plain(c.softSignsMedianAckMin, 'min', c.softSignsAcknowledged >= 5) },
];

export function compare(
  baseline: PeriodCounts | null,
  pilot: PeriodCounts,
  manual: Record<string, ManualBaseline> = {},
): MetricRow[] {
  return SPECS.map(s => {
    let b: Cell = baseline ? s.cell(baseline) : { value: null, note: 'no baseline period' };
    const m = manual[s.key];
    if (m && Number.isFinite(m.value)) b = { value: r1(m.value), manual: m.source || 'entered by hand' };
    const p = s.cell(pilot);
    const change = b.value != null && p.value != null ? r1(p.value - b.value) : null;
    const verdict: MetricRow['verdict'] = change == null ? 'unknown'
      : Math.abs(change) < (s.unit === '%' ? 1 : s.unit === 'min' ? 1 : 0.5) ? 'same'
      : (change > 0) === (s.better === 'higher') ? 'better' : 'worse';
    return { key: s.key, group: s.group, label: s.label, definition: s.definition, better: s.better, unit: s.unit, baseline: b, pilot: p, change, verdict };
  });
}

/** What this report cannot show. Printed with it, every time. */
export const LIMITS = [
  'A before-and-after comparison in one home cannot prove CareVista caused a change: staffing, residents and season change too.',
  'If the baseline comes from CareVista\'s own first weeks, staff were still learning the system; if it is typed in from a paper audit, it was measured differently. Both are labelled.',
  'Fluid targets and monitoring are read as they are set today, not as they were set during the period.',
  'A missing record is not proof that care was not given, and a record is not proof that it was. These are measures of recording.',
  'Capacity assessments are counted by their status today: one superseded after the period ended is not counted as current at its end.',
  'Percentages are not shown where fewer than 20 cases sit behind them.',
];
