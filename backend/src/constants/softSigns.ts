// Keys and labels for soft signs of deterioration. Must match
// frontend/src/constants/softSigns.ts — backend/tests/softsigns.test.mjs checks.
export const EMERGENCY_SIGN_LABELS: Record<string, string> = {
  not_responding:   'Not responding normally, or cannot be woken',
  severe_breathing: 'Struggling to breathe, or lips turning blue',
  chest_pain:       'Chest pain',
  stroke_signs:     'Face drooping, arm weak, or speech slurred',
  seizure:          'A fit — the first one, or lasting over 5 minutes',
  heavy_bleeding:   'Heavy bleeding that will not stop',
};

export const SOFT_SIGN_LABELS: Record<string, string> = {
  not_themselves:    'Not themselves — just seems different',
  more_confused:     'More confused than usual',
  more_sleepy:       'More sleepy than usual',
  breathing_changed: 'Breathing faster, or more out of breath',
  not_eating:        'Eating less than usual',
  not_drinking:      'Drinking less than usual',
  less_urine:        'Passing less urine, or it is very dark',
  new_pain:          'New pain, or pain is worse',
  hot_cold:          'Hot, cold, shivery or clammy',
  skin_colour:       'Skin pale, grey, blue or blotchy',
  weaker:            'Weaker, or less able to move than usual',
  fall_unsteady:     'Had a fall, or more unsteady',
  cough:             'New cough, or coughing more',
  vomit_diarrhoea:   'Being sick, or diarrhoea',
  agitated:          'Agitated, restless or upset',
  family_concern:    'Family say they are not themselves',
  other:             'Something else',
};

export const DETERIORATION_OUTCOMES = [
  'news2_stable', 'monitoring', 'gp_contacted', 'nhs_111', 'ambulance_999', 'hospital', 'end_of_life_plan', 'no_concern',
] as const;
