// ────────────────────────────────────────────────────────────────────────────
// Today's fluids, food and bowels, per resident — what a nurse or manager needs
// to see walking down a corridor.
//
// Pure: rows in, summaries out. Every rule here decides whether somebody's name
// turns red on a screen, so every rule is unit tested.
//
// Runs on the DEVICE, not the server. "How far through the waking day are we"
// and "how many days since" both depend on local time, and the server's clock
// is UTC with no timezone set — an hour out all summer. The server returns the
// raw rows for the window the device asks for; the judgement happens here.
//
// Ground rules, each learned the hard way somewhere:
//
//  • NO INVENTED TARGETS. A resident without a fluid target set by a clinician
//    shows their total and nothing else. A made-up 1500ml would turn half the
//    home amber, and an always-amber board is a board nobody reads.
//
//  • NOT RECORDED IS NOT ZERO. A resident with no fluids on record is "nothing
//    recorded", which is a recording problem, not proof they drank nothing.
//    The board says which it is.
//
//  • AWAY IS NOT MISSING. Someone in hospital has no fluids on our chart
//    because they are not here. They are shown as away, never flagged.
//
//  • SAY WHY. Every concern carries a sentence a person can act on.
// ────────────────────────────────────────────────────────────────────────────

export interface ResidentIn {
  id: string;
  name: string;
  room: string | null;
  away?: string | null;            // reason, when currently away (hospital etc.)
}

export interface NoteIn {
  residentId: string;
  at: Date;
  fluidMl: number | null;
  foodPct: number | null;
  bowelsOpened: boolean | null;
  stoolType: 'hard' | 'normal' | 'loose' | null;
  by?: string | null;
}

export interface TargetIn {
  residentId: string;
  monitorFluids: boolean;
  fluidTargetMl: number | null;
  fluidMinimumMl: number | null;
  monitorFood: boolean;
  foodMinimumPercent: number | null;
  monitorBowels: boolean;
  bowelAlertDays: number | null;
}

export type Level = 'red' | 'amber';
export interface Concern { level: Level; area: 'fluid' | 'food' | 'bowels'; text: string; }

export interface ResidentDay {
  residentId: string;
  name: string;
  room: string | null;
  away: string | null;
  fluid: {
    totalMl: number;
    recorded: boolean;
    monitored: boolean;
    targetMl: number | null;
    percentOfTarget: number | null;
    expectedByNowMl: number | null;
    lastAt: string | null;
    entries: { at: string; ml: number; by: string | null }[];
  };
  food: {
    meals: number;
    averagePercent: number | null;
    lowMeals: number;
    monitored: boolean;
  };
  bowels: {
    lastOpenedAt: string | null;
    daysSince: number | null;
    openedToday: number;
    looseToday: number;
    alertDays: number;
    monitored: boolean;
  };
  concerns: Concern[];
}

export interface SummaryOptions {
  /** Waking day over which a fluid target is expected to be drunk. */
  wakingStartHour: number;
  wakingEndHour: number;
  /** Hours without a drink, while awake, before a monitored resident is flagged. */
  noDrinkHours: number;
  defaultBowelAlertDays: number;
}

export const DEFAULT_SUMMARY: SummaryOptions = {
  wakingStartHour: 7,
  wakingEndHour: 22,
  noDrinkHours: 3,
  defaultBowelAlertDays: 3,
};

const DAY = 86_400_000;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole calendar days between two instants, by the local calendar. */
export function calendarDaysBetween(earlier: Date, later: Date): number {
  return Math.round((startOfLocalDay(later).getTime() - startOfLocalDay(earlier).getTime()) / DAY);
}

/** How much of a daily target should have been drunk by now, across the waking day. */
export function expectedByNow(targetMl: number, now: Date, opts: SummaryOptions = DEFAULT_SUMMARY): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), opts.wakingStartHour);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), opts.wakingEndHour);
  const f = Math.min(1, Math.max(0, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())));
  return Math.round(targetMl * f);
}

export function summariseDay(input: {
  residents: ResidentIn[];
  todaysNotes: NoteIn[];
  targets: TargetIn[];
  lastOpened: Map<string, Date>;
  now: Date;
  opts?: Partial<SummaryOptions>;
}): ResidentDay[] {
  const opts = { ...DEFAULT_SUMMARY, ...(input.opts || {}) };
  const now = input.now;
  const byResident = new Map<string, NoteIn[]>();
  for (const n of input.todaysNotes) {
    const list = byResident.get(n.residentId);
    if (list) list.push(n); else byResident.set(n.residentId, [n]);
  }
  const targets = new Map(input.targets.map(t => [t.residentId, t]));

  const awake = now.getHours() >= opts.wakingStartHour && now.getHours() < opts.wakingEndHour;

  const days = input.residents.map((r): ResidentDay => {
    const notes = (byResident.get(r.id) || []).slice().sort((a, b) => a.at.getTime() - b.at.getTime());
    const t = targets.get(r.id);
    const concerns: Concern[] = [];
    const away = r.away || null;

    // ── Fluid ───────────────────────────────────────────────────────────────
    const drinks = notes.filter(n => n.fluidMl != null);
    const totalMl = drinks.reduce((s, n) => s + Number(n.fluidMl || 0), 0);
    const monitoredFluid = !!t?.monitorFluids;
    const targetMl = monitoredFluid && t?.fluidTargetMl ? Number(t.fluidTargetMl) : null;
    const expected = targetMl ? expectedByNow(targetMl, now, opts) : null;
    const lastDrink = drinks.length ? drinks[drinks.length - 1].at : null;

    if (!away && monitoredFluid) {
      if (targetMl && expected && expected > 0) {
        if (totalMl < expected * 0.5) {
          concerns.push({ level: 'red', area: 'fluid',
            text: `${totalMl} ml so far — well behind the ${expected} ml expected by now (target ${targetMl} ml).` });
        } else if (totalMl < expected * 0.75) {
          concerns.push({ level: 'amber', area: 'fluid',
            text: `${totalMl} ml so far — behind the ${expected} ml expected by now (target ${targetMl} ml).` });
        }
      }
      if (awake) {
        if (!lastDrink && now.getHours() >= opts.wakingStartHour + opts.noDrinkHours) {
          concerns.push({ level: 'amber', area: 'fluid', text: 'On a fluid chart and no drinks recorded today.' });
        } else if (lastDrink && now.getTime() - lastDrink.getTime() >= opts.noDrinkHours * 3_600_000) {
          const hrs = Math.floor((now.getTime() - lastDrink.getTime()) / 3_600_000);
          concerns.push({ level: 'amber', area: 'fluid', text: `No drink recorded for ${hrs} hours.` });
        }
      }
    }

    // ── Food ────────────────────────────────────────────────────────────────
    const meals = notes.filter(n => n.foodPct != null);
    const avg = meals.length ? Math.round(meals.reduce((s, n) => s + Number(n.foodPct), 0) / meals.length) : null;
    const lowMeals = meals.filter(n => Number(n.foodPct) <= 25).length;
    const monitoredFood = !!t?.monitorFood;

    if (!away && meals.length) {
      if (meals.length >= 2 && meals.every(n => Number(n.foodPct) === 0)) {
        concerns.push({ level: 'red', area: 'food', text: `Has eaten nothing at ${meals.length} meals today.` });
      } else if (lowMeals >= 2) {
        concerns.push({ level: 'amber', area: 'food', text: `Ate a quarter or less at ${lowMeals} meals today.` });
      } else if (monitoredFood && t?.foodMinimumPercent != null && avg != null && avg < Number(t.foodMinimumPercent)) {
        concerns.push({ level: 'amber', area: 'food',
          text: `Eating ${avg}% on average today, below the ${t.foodMinimumPercent}% set for them.` });
      }
    }

    // ── Bowels ──────────────────────────────────────────────────────────────
    const alertDays = Number(t?.bowelAlertDays ?? opts.defaultBowelAlertDays);
    const openedToday = notes.filter(n => n.bowelsOpened === true);
    const looseToday = notes.filter(n => n.stoolType === 'loose').length;
    const lastOpened = openedToday.length
      ? openedToday[openedToday.length - 1].at
      : input.lastOpened.get(r.id) || null;
    const daysSince = lastOpened ? calendarDaysBetween(lastOpened, now) : null;
    const monitoredBowels = !!t?.monitorBowels;

    if (!away) {
      if (looseToday >= 3) {
        concerns.push({ level: 'red', area: 'bowels',
          text: `${looseToday} loose stools today — consider infection control and tell the nurse.` });
      } else if (looseToday === 2) {
        concerns.push({ level: 'amber', area: 'bowels', text: '2 loose stools today — watch for a third.' });
      }

      if (daysSince != null && daysSince >= alertDays) {
        concerns.push({ level: 'red', area: 'bowels',
          text: `Bowels last opened ${daysSince} days ago.` });
      } else if (daysSince != null && daysSince === alertDays - 1 && alertDays > 1) {
        concerns.push({ level: 'amber', area: 'bowels',
          text: `Bowels last opened ${daysSince} ${daysSince === 1 ? 'day' : 'days'} ago — check today.` });
      } else if (daysSince == null && monitoredBowels) {
        concerns.push({ level: 'amber', area: 'bowels', text: 'On a bowel chart and no bowel record found.' });
      }
    }

    return {
      residentId: r.id,
      name: r.name,
      room: r.room,
      away,
      fluid: {
        totalMl,
        recorded: drinks.length > 0,
        monitored: monitoredFluid,
        targetMl,
        percentOfTarget: targetMl ? Math.round((totalMl / targetMl) * 100) : null,
        expectedByNowMl: expected,
        lastAt: lastDrink ? lastDrink.toISOString() : null,
        entries: drinks.map(n => ({ at: n.at.toISOString(), ml: Number(n.fluidMl), by: n.by || null })),
      },
      food: { meals: meals.length, averagePercent: avg, lowMeals, monitored: monitoredFood },
      bowels: {
        lastOpenedAt: lastOpened ? lastOpened.toISOString() : null,
        daysSince,
        openedToday: openedToday.length,
        looseToday,
        alertDays,
        monitored: monitoredBowels,
      },
      concerns,
    };
  });

  // Most worrying first: reds, then ambers, then by room.
  const weight = (d: ResidentDay) =>
    d.concerns.filter(c => c.level === 'red').length * 100 + d.concerns.filter(c => c.level === 'amber').length;
  return days.sort((a, b) =>
    weight(b) - weight(a) ||
    String(a.room || '').localeCompare(String(b.room || ''), undefined, { numeric: true }));
}
