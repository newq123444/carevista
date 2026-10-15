// ────────────────────────────────────────────────────────────────────────────
// Words for the Mental Capacity Act screens.
//
// Plain English first, the law second. An assessor should be able to follow
// this without the Code of Practice open — and an inspector reading the record
// should see the same structure the Code uses.
//
// Suggestions are starting points, never answers. Every one can be edited or
// removed, and the relevant information must always be tailored to the person
// and the decision in front of you.
// ────────────────────────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<string, string> = {
  care_and_support:     'Care and support (for example personal care)',
  medical_treatment:    'Medical treatment',
  medication:           'Taking medication',
  covert_medication:    'Giving medicine covertly',
  accommodation:        'Where to live',
  finance:              'Money and property',
  contact:              'Contact with people',
  restrictive_practice: 'A restriction (sensor mat, bed rails, locked door)',
  end_of_life:          'End of life care',
  other:                'Something else',
};

export const OUTCOME_LABELS: Record<string, string> = {
  has_capacity:     'Has capacity for this decision',
  lacks_capacity:   'Lacks capacity for this decision',
  cannot_determine: 'Cannot yet determine',
};

export const STEP_LABELS: Record<string, string> = {
  decision:       'The decision',
  support:        'Support given',
  test:           'The test',
  outcome:        'Outcome',
  best_interests: 'Best interests',
  liberty:        'Liberty (DoLS)',
  review:         'Review and sign',
};

export const STEP_ORDER = ['decision', 'support', 'test', 'outcome', 'best_interests', 'liberty', 'review'] as const;

export const DECISION_EXAMPLES = [
  'Whether to move from the residential floor to the nursing floor',
  'Whether to accept help with washing and dressing each morning',
  'Whether to take the prescribed blood-thinning tablets',
  'Whether to have a sensor mat beside the bed at night',
  'Whether to have contact with a particular visitor',
];

export const RELEVANT_INFO_SUGGESTIONS: Record<string, string[]> = {
  care_and_support: [
    'What help is being offered, and why',
    'What could happen to their skin, health or dignity without it',
    'That they can say no, and what would happen if they did',
  ],
  medical_treatment: [
    'What the treatment is and what it is for',
    'The main benefits',
    'The main risks or side effects',
    'What is likely to happen without it',
    'Any other options available',
  ],
  medication: [
    'What the medicine is for',
    'How and when it is taken',
    'The common side effects',
    'What may happen if they do not take it',
  ],
  covert_medication: [
    'That the medicine is needed, and what for',
    'That it would be given hidden in food or drink',
    'What may happen if they do not have it',
  ],
  accommodation: [
    'Where they would live and what it is like',
    'The care they would get there, and from whom',
    'The cost, and who pays',
    'The risks of each option, including staying where they are',
    'Whether they would be free to come and go',
  ],
  finance: [
    'What money or property is involved',
    'What the decision commits them to',
    'The risks of each option, including doing nothing',
  ],
  contact: [
    'Who the person is and their relationship to them',
    'What contact would involve — how, where, how often',
    'Any risks of contact, and of no contact',
  ],
  restrictive_practice: [
    'What the restriction is and how it works',
    'Why it is being proposed — what it is meant to prevent',
    'How it would affect their freedom and privacy',
    'What could happen without it',
  ],
  end_of_life: [
    'Their condition and what is likely to happen',
    'What the treatment or plan would involve',
    'What would happen with it and without it',
  ],
  other: [
    'What the decision is and why it needs making now',
    'The options available',
    'What would happen with each option, and if no decision is made',
  ],
};

// The Code of Practice, chapter 3: ways to help someone decide for themselves.
export const PRACTICABLE_STEPS = [
  'Chose a time of day they are usually most alert',
  'Chose a quiet, familiar place',
  'Used simple words and short sentences',
  'Gave information one piece at a time',
  'Used pictures, objects or an easy-read sheet',
  'Made sure glasses and hearing aids were in',
  'Used their first language or an interpreter',
  'Someone they trust was with them',
  'Gave them time and did not rush',
  'Explained it more than once',
  'Wrote the key points down for them',
  'Treated pain, infection or tiredness first',
  'Used their usual way of communicating',
];

export const LIMB_GUIDE: Record<string, { title: string; ask: string; note: string; law: string }> = {
  understand: {
    title: 'Can they understand the information?',
    ask: 'Explain it simply. Ask them to tell you back, in their own words, what the decision is and what the choices are.',
    note: 'They only need to understand the main points, explained in a way that suits them.',
    law: 's3(1)(a), s3(2)',
  },
  retain: {
    title: 'Can they hold on to it long enough to decide?',
    ask: 'After a short while, ask about it again. Notes or prompts can be used.',
    note: 'Keeping it in mind for a short time is enough.',
    law: 's3(1)(b), s3(3)',
  },
  weigh: {
    title: 'Can they use or weigh it to reach a decision?',
    ask: 'Ask what is good and bad about each choice, and what might happen. Can they balance those things?',
    note: 'Disagreeing with staff, or making a choice others think unwise, is NOT the same as being unable to weigh.',
    law: 's3(1)(c), s1(4)',
  },
  communicate: {
    title: 'Can they communicate their decision?',
    ask: 'By any means — speech, writing, signs, gestures, pointing, blinking.',
    note: 'Only "unable" if no means works after you have tried.',
    law: 's3(1)(d)',
  },
};

export const DECISION_MAKERS: [string, string][] = [
  ['staff', 'The home (the person proposing the care)'],
  ['clinician', 'A doctor or nurse (treatment decision)'],
  ['lpa_attorney', 'Their attorney under a Lasting Power of Attorney'],
  ['deputy', 'Their court-appointed deputy'],
  ['court', 'The Court of Protection'],
];
