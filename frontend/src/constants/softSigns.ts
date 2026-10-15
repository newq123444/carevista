// ────────────────────────────────────────────────────────────────────────────
// Signs that someone may be getting unwell.
//
// Two lists, deliberately separate. The first is an emergency: the screen
// says "call 999" before anything else, because a form must never sit between
// a carer and an ambulance. The second is the "soft signs" carers notice first
// — written in the words a carer would use, not clinical terms.
//
// Keys must match backend/src/constants/softSigns.ts (a test checks).
// This is not RESTORE2 or any other branded tool; it is a plain prompt to get
// a nurse or senior to look, informed by the soft-signs approach those tools
// share.
// ────────────────────────────────────────────────────────────────────────────

export interface Sign { key: string; label: string; icon: string }

export const EMERGENCY_SIGNS: Sign[] = [
  { key: 'not_responding',   icon: '🚨', label: 'Not responding normally, or cannot be woken' },
  { key: 'severe_breathing', icon: '🌬️', label: 'Struggling to breathe, or lips turning blue' },
  { key: 'chest_pain',       icon: '💔', label: 'Chest pain' },
  { key: 'stroke_signs',     icon: '🧠', label: 'Face drooping, arm weak, or speech slurred' },
  { key: 'seizure',          icon: '⚡', label: 'A fit — the first one, or lasting over 5 minutes' },
  { key: 'heavy_bleeding',   icon: '🩸', label: 'Heavy bleeding that will not stop' },
];

export const SOFT_SIGNS: Sign[] = [
  { key: 'not_themselves',    icon: '🙁', label: 'Not themselves — just seems different' },
  { key: 'more_confused',     icon: '😵', label: 'More confused than usual' },
  { key: 'more_sleepy',       icon: '😴', label: 'More sleepy than usual' },
  { key: 'breathing_changed', icon: '💨', label: 'Breathing faster, or more out of breath' },
  { key: 'not_eating',        icon: '🍽️', label: 'Eating less than usual' },
  { key: 'not_drinking',      icon: '🥤', label: 'Drinking less than usual' },
  { key: 'less_urine',        icon: '🚽', label: 'Passing less urine, or it is very dark' },
  { key: 'new_pain',          icon: '🤕', label: 'New pain, or pain is worse' },
  { key: 'hot_cold',          icon: '🌡️', label: 'Hot, cold, shivery or clammy' },
  { key: 'skin_colour',       icon: '🎨', label: 'Skin pale, grey, blue or blotchy' },
  { key: 'weaker',            icon: '🦵', label: 'Weaker, or less able to move than usual' },
  { key: 'fall_unsteady',     icon: '🧍', label: 'Had a fall, or more unsteady' },
  { key: 'cough',             icon: '😷', label: 'New cough, or coughing more' },
  { key: 'vomit_diarrhoea',   icon: '🤢', label: 'Being sick, or diarrhoea' },
  { key: 'agitated',          icon: '😣', label: 'Agitated, restless or upset' },
  { key: 'family_concern',    icon: '👪', label: 'Family say they are not themselves' },
  { key: 'other',             icon: '✏️', label: 'Something else' },
];

export const SIGN_LABEL: Record<string, string> =
  Object.fromEntries([...EMERGENCY_SIGNS, ...SOFT_SIGNS].map(s => [s.key, s.label]));
export const EMERGENCY_KEYS = new Set(EMERGENCY_SIGNS.map(s => s.key));

export const OUTCOMES: [string, string][] = [
  ['news2_stable',     'Observations done (NEWS2) — stable'],
  ['monitoring',       'Increased monitoring, plan in place'],
  ['gp_contacted',     'GP contacted'],
  ['nhs_111',          'NHS 111 contacted'],
  ['ambulance_999',    'Ambulance called (999)'],
  ['hospital',         'Went to hospital'],
  ['end_of_life_plan', 'Followed their end of life plan'],
  ['no_concern',       'Assessed — no concern found'],
];
