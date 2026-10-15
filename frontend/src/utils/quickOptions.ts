// ────────────────────────────────────────────────────────────────────────────
// Quick-record options for the care deck.
//
// Swiping "done" on its own produces a record that says "Morning Personal Care:
// done" — worth almost nothing to a manager reading back, a family asking what
// happened, or a coroner. The point of recording is the detail.
//
// These are the SAME clinical options as the full carer form, imported from the
// one shared list rather than copied. An abridged second list was the first
// attempt and it was wrong: two lists of clinical options that are meant to
// match will always drift, and the drift is invisible — nothing fails, the
// record is just quietly thinner.
//
// The difference between this and the full form is presentation, not content.
// Each group shows its common answers first and keeps the rest behind "show
// all", so the usual answer is one tap and the unusual one is two, and nobody
// reads three hundred options on a phone.
//
// Everything here is pure — taps in, note text out — so the wording that ends
// up in a legal record is unit tested rather than assembled inside a component.
// ────────────────────────────────────────────────────────────────────────────
import {
  PERSONAL_CARE_OPTS, CONTINENCE_OPTS, REPOSITIONING_OPTS, SLEEP_OPTS,
  BEHAVIOUR_OPTS, ACTIVITIES_OPTS, MOOD_OPTIONS, MEAL_TIMES, APPETITE_OPTIONS,
  FLUID_OPTIONS, DRINK_OPTIONS, TEXTURE_OPTIONS,
} from '../constants/careOptions';
import { optionIcon } from './optionIcons';

export interface QuickChoice {
  /** What goes in the record, without any leading emoji. */
  label: string;
  icon: string;
  /** The underlying code, where the shared list has one (moods, appetite). */
  value?: string;
}

export interface QuickGroup {
  key: string;
  /** The question, in plain English. */
  prompt: string;
  /** Single-select behaves like an answer; multi-select like a checklist. */
  multi: boolean;
  /**
   * How many choices to show before "show all". Every option is always
   * reachable — this only decides what a carer sees first.
   */
  commonCount: number;
  choices: QuickChoice[];
  /**
   * 'fluid' renders the exact-amount picker instead of chips. The chips are
   * kept on the group so the full form and the tests still see the same list.
   */
  kind?: 'chips' | 'fluid';
}

export interface QuickSpec {
  noteType: string;
  groups: QuickGroup[];
}

// ── Turning the shared lists into choices ──────────────────────────────────

/** Leading emoji in the shared labels becomes the icon, not part of the text. */
const LEADING_EMOJI = /^([\p{Extended_Pictographic} -㌀️‍]+)\s*/u;

function splitIcon(label: string, fallback: string): QuickChoice {
  const m = LEADING_EMOJI.exec(label);
  if (m) return { label: label.slice(m[0].length).trim(), icon: m[1].trim() };
  return { label, icon: optionIcon(label, fallback) };
}

/** A group from one of the `{ label, options }` blocks. */
function fromOpts(key: string, prompt: string, src: { label: string; options: string[] },
                  multi: boolean, commonCount: number): QuickGroup {
  // A mistyped source key — ACTIVITIES_OPTS.activity instead of .type — used to
  // sail through the compiler and surface as a blank crash the moment a carer
  // opened the sheet. Fail here, at import, where a test will see it.
  if (!src || !Array.isArray(src.options)) {
    throw new Error(`quickOptions: no option list behind "${key}" — check the name in careOptions.`);
  }
  const fallback = splitIcon(src.label, '•').icon || '•';
  return { key, prompt, multi, commonCount, choices: src.options.map(o => splitIcon(o, fallback)) };
}

/** A group from a plain string list. */
function fromList(key: string, prompt: string, options: string[],
                  multi: boolean, commonCount: number, fallback: string): QuickGroup {
  return { key, prompt, multi, commonCount, choices: options.map(o => splitIcon(o, fallback)) };
}

/** A group from a `{ value, label }` list, keeping the code for later mapping. */
function fromValued(key: string, prompt: string, items: { value: string; label: string }[],
                    multi: boolean, commonCount: number, fallback: string): QuickGroup {
  return {
    key, prompt, multi, commonCount,
    choices: items.map(i => ({ ...splitIcon(i.label, fallback), value: i.value })),
  };
}

const PERSONAL_CARE: QuickSpec = {
  noteType: 'personal_care',
  groups: [
    fromOpts('bathing',  'What wash did they have?', PERSONAL_CARE_OPTS.bathing,  true, 6),
    fromOpts('oral',     'Mouth and teeth?',         PERSONAL_CARE_OPTS.oral,     true, 4),
    fromOpts('dressing', 'Dressing?',                PERSONAL_CARE_OPTS.dressing, true, 4),
    fromOpts('skinCare', 'How was the skin?',        PERSONAL_CARE_OPTS.skinCare, true, 4),
    fromOpts('shaving',  'Shaving and face?',        PERSONAL_CARE_OPTS.shaving,  true, 3),
    fromOpts('hair',     'Hair?',                    PERSONAL_CARE_OPTS.hair,     true, 3),
    fromOpts('nails',    'Nails?',                   PERSONAL_CARE_OPTS.nails,    true, 3),
  ],
};

const NUTRITION: QuickSpec = {
  noteType: 'nutrition',
  groups: [
    fromValued('meal',   'Which meal was it?',       MEAL_TIMES,       false, 6, '🍽️'),
    fromValued('ate',    'How much did they eat?',   APPETITE_OPTIONS, false, 6, '🍽️'),
    { ...fromList('drank', 'How much did they actually drink?', [...FLUID_OPTIONS, 'Nothing'], false, 9, '💧'),
      kind: 'fluid' as const },
    fromList('drinks',   'What did they have?',      DRINK_OPTIONS,    true,  6, '🥤'),
    fromList('texture',  'What texture?',            TEXTURE_OPTIONS,  false, 5, '🥄'),
  ],
};

const CONTINENCE: QuickSpec = {
  noteType: 'continence',
  groups: [
    fromOpts('method',   'How did they go?', CONTINENCE_OPTS.method,   true, 5),
    fromOpts('urinary',  'Passing urine?',   CONTINENCE_OPTS.urinary,  true, 5),
    fromOpts('bowels',   'Bowels?',          CONTINENCE_OPTS.bowels,   true, 5),
    fromOpts('catheter', 'Catheter care?',   CONTINENCE_OPTS.catheter, true, 3),
  ],
};

const REPOSITIONING: QuickSpec = {
  noteType: 'repositioning',
  groups: [
    fromOpts('position',  'Moved to which position?', REPOSITIONING_OPTS.position,  false, 7),
    fromOpts('skin',      'Pressure areas?',          REPOSITIONING_OPTS.skin,      true,  4),
    fromOpts('equipment', 'What did you use?',        REPOSITIONING_OPTS.equipment, true,  4),
    fromOpts('frequency', 'When is the next turn?',   REPOSITIONING_OPTS.frequency, false, 3),
  ],
};

const SLEEP: QuickSpec = {
  noteType: 'sleep',
  groups: [
    fromOpts('quality',      'How did they sleep?',  SLEEP_OPTS.quality,      false, 5),
    fromOpts('hours',        'Roughly how long?',    SLEEP_OPTS.hours,        false, 5),
    fromOpts('intervention', 'Did you do anything?', SLEEP_OPTS.intervention, true,  4),
  ],
};

const WELLBEING: QuickSpec = {
  noteType: 'social_wellbeing',
  groups: [
    fromValued('mood',      'How did they seem?',     MOOD_OPTIONS,             false, 6, '🙂'),
    fromOpts('activity',    'What did they join in?', ACTIVITIES_OPTS.type,     true,  6),
    fromOpts('engagement',  'How involved were they?', ACTIVITIES_OPTS.engagement, false, 4),
  ],
};

const BEHAVIOUR: QuickSpec = {
  noteType: 'behaviour',
  groups: [
    fromOpts('type',         'What did you see?',    BEHAVIOUR_OPTS.type,         true, 5),
    fromOpts('trigger',      'Anything set it off?', BEHAVIOUR_OPTS.trigger,      true, 5),
    fromOpts('intervention', 'What helped?',         BEHAVIOUR_OPTS.intervention, true, 5),
  ],
};

// A drink on its own — the commonest thing a carer records, so it gets its own
// tile instead of hiding inside the meal sheet.
const FLUIDS: QuickSpec = {
  noteType: 'nutrition',
  groups: [NUTRITION.groups.find(g => g.key === 'drank')!, NUTRITION.groups.find(g => g.key === 'drinks')!],
};

const BY_TYPE: Record<string, QuickSpec> = {
  personal_care: PERSONAL_CARE,
  nutrition: NUTRITION,
  continence: CONTINENCE,
  repositioning: REPOSITIONING,
  sleep: SLEEP,
  social_wellbeing: WELLBEING,
  behaviour: BEHAVIOUR,
};

/**
 * The sheet for a record type chosen from a resident's page ("what did you do
 * for Ernie?"). Same options and wording as the round, so a note reads the
 * same whichever way it was made.
 */
export const RECORD_TYPES = ['personal_care', 'nutrition', 'fluids', 'continence', 'repositioning', 'sleep', 'social_wellbeing', 'behaviour'] as const;
export type RecordType = typeof RECORD_TYPES[number];
/** What kind of care a sheet records, for "someone else is doing this" checks: a drink is not a meal. */
export function careKeyOf(spec: QuickSpec): string { return spec === FLUIDS ? 'fluids' : spec.noteType; }

export function specForType(type: RecordType): QuickSpec {
  return type === 'fluids' ? FLUIDS : BY_TYPE[type];
}

/**
 * Which quick-record sheet a task should open, if any.
 *
 * Returns null where there is genuinely nothing to ask beyond "done" — a sheet
 * with no options is friction, and friction is what makes carers record less.
 */
export function specForTask(task: { note_type?: string | null; category?: string | null; task_name?: string | null }): QuickSpec | null {
  const direct = task.note_type && BY_TYPE[task.note_type];
  if (direct) return direct;

  const hay = `${task.category || ''} ${task.task_name || ''}`.toLowerCase();

  // Word boundaries throughout, and no bare "check". Half the task names in a
  // care home end in "check" — fire door check, weight check, window restrictor
  // check — and matching on it opened a sleep sheet asking "how were they?"
  // about a fire door.
  //
  // Anything clinical that needs a proper assessment gets no quick sheet at
  // all: a pressure sore or a fall is not something to summarise in four taps.
  if (/\bwound|dressing change|pressure (ulcer|sore)|\bfall\b|catheter change/.test(hay)) return null;

  if (/personal care|\bwash(ing)?\b|\bbath\b|\bshower\b|\bdress(ed|ing)?\b|groom|\bshave\b/.test(hay)) return PERSONAL_CARE;
  if (/\bmeal\b|breakfast|\blunch\b|\bdinner\b|\bsupper\b|\btea\b|snack|\bdrink|nutrition|\bfluid/.test(hay)) return NUTRITION;
  if (/continence|\btoilet|\bpad\b|catheter|commode/.test(hay)) return CONTINENCE;
  if (/reposition|\bturn(ing|s)?\b|pressure relief/.test(hay)) return REPOSITIONING;
  if (/night check|night settle|\bsettle\b|\bsleep|bedtime|overnight/.test(hay)) return SLEEP;
  if (/wellbeing|\bsocial\b|activit|\bmood\b|company/.test(hay)) return WELLBEING;
  if (/behaviour|agitat|distress/.test(hay)) return BEHAVIOUR;
  return null;
}

export type Selections = Record<string, string[]>;

function chosenValue(spec: QuickSpec, sel: Selections, key: string): string | null {
  const label = sel[key]?.[0];
  if (!label) return null;
  const group = spec.groups.find(g => g.key === key);
  const choice = group?.choices.find(c => c.label === label);
  return choice?.value ?? label;
}

/** Percentage eaten, for the malnutrition trend. Null when they were not asked. */
export function foodPercent(spec: QuickSpec, sel: Selections): number | null {
  const v = chosenValue(spec, sel, 'ate');
  if (!v) return null;
  // 'nbm' is nil by mouth — a clinical instruction, not an amount eaten, so it
  // must not be recorded as zero and drag the trend down.
  const map: Record<string, number> = { full: 100, most: 75, half: 50, little: 25, refused: 0 };
  return v in map ? map[v] : null;
}

// ── Exact fluid amounts ─────────────────────────────────────────────────────
// Drinks are not 100, 150 or 200ml. A beaker half-finished is 120. The fluid
// chart is only worth keeping if the numbers on it are the real ones.

export const FLUID_MAX_ML = 1000;
export const FLUID_STEP_ML = 10;

/** Clamp and round to the slider's step. Anything not a number is null. */
export function clampFluid(ml: unknown): number | null {
  const n = typeof ml === 'number' ? ml : Number(ml);
  if (!Number.isFinite(n)) return null;
  const stepped = Math.round(n / FLUID_STEP_ML) * FLUID_STEP_ML;
  return Math.min(FLUID_MAX_ML, Math.max(0, stepped));
}

/**
 * The selection for an amount.
 *   null  -> nothing selected: they were not asked, which is NOT the same as
 *            drinking nothing. Null keeps a resident out of the dehydration
 *            trend; zero puts them in it.
 *   0     -> ['Nothing'], an explicit "drank nothing".
 *   n     -> ['120ml']
 */
export function fluidSelection(ml: number | null): string[] {
  if (ml === null) return [];
  const v = clampFluid(ml);
  if (v === null) return [];
  return v === 0 ? ['Nothing'] : [`${v}ml`];
}

/** Millilitres drunk, for the fluid balance chart. Null when not asked. */
export function fluidMl(sel: Selections): number | null {
  const v = sel.drank?.[0];
  if (!v) return null;
  if (v === 'Nothing') return 0;
  const m = /^(\d+)ml/.exec(v);
  return m ? Number(m[1]) : null;
}

// ── Bowels, as data ─────────────────────────────────────────────────────────

export type StoolType = 'hard' | 'normal' | 'loose';

/**
 * Read whether bowels opened, and the stool band, from the options chosen.
 *
 * Works from the labels so the full form and the quick sheet give the same
 * answer from the same list. Anything ambiguous is left null rather than
 * guessed: "constipated" does not say whether a small hard stool was passed.
 */
export function bowelsFromLabels(labels: string[]): { opened: boolean | null; stoolType: StoolType | null } {
  let opened: boolean | null = null;
  let stoolType: StoolType | null = null;
  for (const raw of labels || []) {
    const l = raw.toLowerCase();
    if (/^bowels opened/.test(l) || /\bdiarrh?oea\b/.test(l)) opened = true;
    else if (/^bowels not opened/.test(l) && opened !== true) opened = false;

    if (/type 1[–-]2|\bhard\b/.test(l)) stoolType = 'hard';
    else if (/type 5[–-]7|\bloose\b|\bdiarrh?oea\b/.test(l)) stoolType = 'loose';
    else if (/type 3[–-]4|\(normal\)/.test(l) && !stoolType) stoolType = 'normal';
  }
  // A stool type with no explicit "opened" still means they opened.
  if (stoolType && opened === null) opened = true;
  return { opened, stoolType };
}

/** The mood word, where one was chosen. */
export function moodOf(spec: QuickSpec, sel: Selections): string | null {
  return chosenValue(spec, sel, 'mood');
}

/**
 * Turn the taps into something a person would have written.
 *
 * A record reading "Bathing: Shower (assisted)" is a form dump, and anyone
 * reading it back can tell. "Washed with shower (assisted)." is the same fact,
 * written like a person wrote it.
 */
export function buildNote(spec: QuickSpec, sel: Selections, extra?: string): string {
  const parts: string[] = [];

  for (const group of spec.groups) {
    const chosen = (sel[group.key] || []).filter(Boolean);
    if (chosen.length === 0) continue;
    parts.push(sentenceFor(group.key, chosen));
  }

  const tail = (extra || '').trim();
  if (tail) parts.push(/[.!?]$/.test(tail) ? tail : `${tail}.`);

  return parts.join(' ');
}

/** Lead-ins that read as prose. Anything without one still lists cleanly. */
const LEAD: Record<string, string> = {
  bathing: 'Washed with', oral: 'Mouth care:', dressing: 'Dressing:',
  skinCare: 'Skin:', shaving: 'Face:', hair: 'Hair:', nails: 'Nails:',
  meal: 'At', ate: 'Appetite:', drank: 'Fluids:', drinks: 'Drinks offered:',
  texture: 'Texture:', method: 'Toileting:', urinary: 'Urinary:',
  bowels: 'Bowels:', catheter: 'Catheter:', position: 'Repositioned to',
  skin: 'Pressure areas:', equipment: 'Equipment:', frequency: 'Next turn:',
  quality: 'Sleep:', hours: 'Slept roughly', intervention: 'Action taken:',
  mood: 'Seemed', activity: 'Took part in', engagement: 'Engagement:',
  type: 'Observed:', trigger: 'Possible trigger:',
};

/** Lead-ins that flow into the text and so want a lower-case first word. */
const FLOWING = new Set(['bathing', 'position', 'mood', 'activity', 'hours', 'meal']);

function sentenceFor(key: string, chosen: string[]): string {
  if (key === 'drank') {
    const v = chosen[0];
    if (v === 'Nothing') return 'Drank nothing.';
    return `Drank ${v.replace(/\+$/, ' or more')}.`;
  }
  const list = humanList(chosen);
  const prefix = LEAD[key];
  if (!prefix) return `${capitalise(list)}.`;
  return `${prefix} ${FLOWING.has(key) ? lowerFirst(list) : list}.`;
}

/** True when anything at all was recorded — decides whether to write a note. */
export function hasAnything(sel: Selections, extra?: string): boolean {
  if ((extra || '').trim()) return true;
  return Object.values(sel).some(v => v && v.length > 0);
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function lowerFirst(s: string): string {
  // Leave codes and abbreviations alone: IDDSI, NBM, PRN, CSU.
  if (/^[A-Z]{2,}/.test(s)) return s;
  return /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

function humanList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
