// ────────────────────────────────────────────────────────────────────────────
// Mental Capacity Act 2005 — assessment engine.
//
// Decides whether an assessment record is complete and lawful in its reasoning,
// and what its outcome must be given the evidence recorded. Pure: a record in,
// issues and a derived outcome out. The screen calls it as the assessor works;
// completion calls it again and refuses anything with an error.
//
// What this encodes (England & Wales):
//   • The five principles, s1.
//   • The two-stage test, ss2–3, applied in the order the Supreme Court set
//     out in A Local Authority v JB [2021] UKSC 52: first whether the person
//     can understand, retain, use or weigh the relevant information and
//     communicate a decision; then whether any inability is BECAUSE OF an
//     impairment of, or disturbance in the functioning of, the mind or brain.
//   • Decision- and time-specific assessment (s2(1), Code of Practice ch.4).
//   • Best interests, s4, including the checklist in s4(3)–(7).
//   • LPA (ss9–14), deputies (ss16–20), advance decisions (ss24–26),
//     IMCA (ss35–41).
//   • Deprivation of liberty: the acid test in P v Cheshire West [2014]
//     UKSC 19 and authorisation under Schedule A1 (DoLS). The Liberty
//     Protection Safeguards in the 2019 amending Act are NOT in force; DoLS is
//     the scheme applied here. Review this if LPS is ever commenced.
//
// What it does NOT do: decide anything about a person. It checks that the
// assessor's own recorded evidence supports the conclusion they reach, and
// that nothing the law requires has been left out. The judgement is theirs.
//
// Every issue carries the provision it comes from, so the reason for a
// question is never "because the software says so".
// ────────────────────────────────────────────────────────────────────────────

export type Limb = 'able' | 'unable' | 'not_assessed';
export type Tri = 'yes' | 'no' | 'unknown';
export type Outcome = 'has_capacity' | 'lacks_capacity' | 'cannot_determine';

export type Category =
  | 'care_and_support' | 'medical_treatment' | 'medication' | 'covert_medication'
  | 'accommodation' | 'finance' | 'contact' | 'restrictive_practice'
  | 'end_of_life' | 'other';

export const CATEGORIES: Category[] = [
  'care_and_support', 'medical_treatment', 'medication', 'covert_medication',
  'accommodation', 'finance', 'contact', 'restrictive_practice', 'end_of_life', 'other',
];

export interface LimbResult { result: Limb; evidence: string; }

export interface Consultee { name: string; relationship: string; view: string; date?: string; }
export interface OptionRow { option: string; benefits: string; burdens: string; restrictiveness: 'least' | 'more' | 'most' | ''; }

export interface McaRecord {
  decision: string;
  category: Category;
  relevantInformation: string[];
  reasonForDoubt: string;
  isUrgent: boolean;

  practicableSteps: string[];
  supportNotes: string;
  communicationNeeds: string;
  peoplePresent: string;
  location: string;
  assessedAt: string;
  fluctuating: boolean;
  bestTimeConsidered: boolean;

  functional: {
    understand: LimbResult;
    retain: LimbResult;
    weigh: LimbResult;
    communicate: LimbResult;
  };
  impairment: { present: boolean | null; description: string; };
  causativeNexus: { present: boolean | null; explanation: string; };

  conclusion: { outcome: Outcome | null; reasoning: string; furtherAssessment: string; };
  reassessBy: string | null;

  bestInterests: {
    decisionMaker: 'staff' | 'clinician' | 'lpa_attorney' | 'deputy' | 'court' | '';
    lpa: { exists: Tri | ''; type: 'health_welfare' | 'property_financial' | ''; registerChecked: boolean; attorneyName: string; coversDecision: boolean | null; };
    deputy: { exists: Tri | ''; name: string; coversDecision: boolean | null; };
    adrt: { exists: Tri | 'not_applicable' | ''; validAndApplicable: boolean | null; details: string; };
    regainCapacity: { likely: Tri | ''; canWait: boolean | null; notes: string; };
    participation: string;
    wishesFeelings: string;
    beliefsValues: string;
    otherFactors: string;
    consultees: Consultee[];
    noOneAppropriateToConsult: boolean;
    imca: { referred: boolean; name: string; };
    options: OptionRow[];
    chosenOption: string;
    whyLeastRestrictive: string;
    notBasedOnAgeOrAppearance: boolean;
    lifeSustaining: boolean;
    notMotivatedByDeath: boolean;
  };

  liberty: {
    continuousSupervision: Tri | '';
    notFreeToLeave: Tri | '';
    authorisation: 'granted' | 'applied' | 'needed' | 'not_needed' | '';
    notes: string;
  };

  reviewDate: string | null;
}

export type Level = 'error' | 'warning' | 'info';
export type Step = 'decision' | 'support' | 'test' | 'outcome' | 'best_interests' | 'liberty' | 'review';

export interface Issue {
  level: Level;
  step: Step;
  field?: string;
  message: string;
  law: string;
}

export type StepState = 'complete' | 'incomplete' | 'not_needed';

export interface Validation {
  issues: Issue[];
  derivedOutcome: Outcome | null;
  canComplete: boolean;
  steps: Record<Step, StepState>;
  deprivationOfLiberty: boolean;
}

// ── An empty record, so the screen never has to guess at a shape ────────────
export function emptyRecord(decision = '', category: Category = 'other'): McaRecord {
  const limb = (): LimbResult => ({ result: 'not_assessed', evidence: '' });
  return {
    decision, category, relevantInformation: [], reasonForDoubt: '', isUrgent: false,
    practicableSteps: [], supportNotes: '', communicationNeeds: '', peoplePresent: '',
    location: '', assessedAt: '', fluctuating: false, bestTimeConsidered: false,
    functional: { understand: limb(), retain: limb(), weigh: limb(), communicate: limb() },
    impairment: { present: null, description: '' },
    causativeNexus: { present: null, explanation: '' },
    conclusion: { outcome: null, reasoning: '', furtherAssessment: '' },
    reassessBy: null,
    bestInterests: {
      decisionMaker: '',
      lpa: { exists: '', type: '', registerChecked: false, attorneyName: '', coversDecision: null },
      deputy: { exists: '', name: '', coversDecision: null },
      adrt: { exists: '', validAndApplicable: null, details: '' },
      regainCapacity: { likely: '', canWait: null, notes: '' },
      participation: '', wishesFeelings: '', beliefsValues: '', otherFactors: '',
      consultees: [], noOneAppropriateToConsult: false,
      imca: { referred: false, name: '' },
      options: [], chosenOption: '', whyLeastRestrictive: '',
      notBasedOnAgeOrAppearance: false, lifeSustaining: false, notMotivatedByDeath: false,
    },
    liberty: { continuousSupervision: '', notFreeToLeave: '', authorisation: '', notes: '' },
    reviewDate: null,
  };
}

/**
 * Fill in anything missing, so old or partial records validate without
 * crashing, and drop anything unexpected so a client cannot smuggle extra
 * fields into a legal record.
 */
export function normalise(input: any): McaRecord {
  const base = emptyRecord();
  const r = input && typeof input === 'object' ? input : {};
  const merge = (a: any, b: any): any => {
    if (Array.isArray(a)) return Array.isArray(b) ? b : a;
    if (a && typeof a === 'object') {
      const out: any = {};
      for (const k of Object.keys(a)) out[k] = merge(a[k], b?.[k]);
      return out;
    }
    if (b === undefined) return a;
    // Keep types honest: a string field stays a string, a boolean a boolean.
    if (typeof a === 'string' && typeof b !== 'string') return b === null ? a : String(b);
    if (typeof a === 'boolean' && typeof b !== 'boolean') return a;
    return b;
  };
  const out = merge(base, r);
  if (!CATEGORIES.includes(out.category)) out.category = 'other';
  return out;
}

const LIMBS: { key: keyof McaRecord['functional']; name: string; law: string }[] = [
  { key: 'understand',  name: 'understand the relevant information',               law: 'MCA 2005 s3(1)(a)' },
  { key: 'retain',      name: 'retain that information',                           law: 'MCA 2005 s3(1)(b)' },
  { key: 'weigh',       name: 'use or weigh that information as part of deciding', law: 'MCA 2005 s3(1)(c)' },
  { key: 'communicate', name: 'communicate their decision by any means',           law: 'MCA 2005 s3(1)(d)' },
];

/** Decisions about where, how and under what restrictions someone lives — where DoLS can arise. */
export const LIBERTY_CATEGORIES: Category[] = ['accommodation', 'care_and_support', 'restrictive_practice', 'covert_medication'];
/** Where a valid advance decision to refuse treatment could apply. */
const TREATMENT_CATEGORIES: Category[] = ['medical_treatment', 'medication', 'covert_medication', 'end_of_life'];
/** Where an IMCA must be instructed if there is nobody appropriate to consult (ss37–39). */
const IMCA_CATEGORIES: Category[] = ['medical_treatment', 'accommodation', 'end_of_life'];
/** Which kind of LPA covers which decisions. */
const LPA_TYPE_FOR: Record<Category, 'health_welfare' | 'property_financial'> = {
  care_and_support: 'health_welfare', medical_treatment: 'health_welfare', medication: 'health_welfare',
  covert_medication: 'health_welfare', accommodation: 'health_welfare', contact: 'health_welfare',
  restrictive_practice: 'health_welfare', end_of_life: 'health_welfare', other: 'health_welfare',
  finance: 'property_financial',
};

const len = (s: unknown) => (typeof s === 'string' ? s.trim().length : 0);

// A decision phrased about a whole area of life, or about "capacity" in
// general, is not a decision. Capacity is always about one decision, now.
const GLOBAL_DECISION = /\b(all (decisions|matters|aspects)|everything|in general|generally|overall|global(ly)?|any decisions?|day[- ]to[- ]day decisions|(lacks?|has|have) capacity)\b/i;

// The words of a reason that rests only on who the person is, not on anything
// they said or did. s2(3) forbids concluding incapacity from these alone; a
// reason to DOUBT capacity built only on them is a red flag for the same error.
const STATUS_ONLY = /\b(dementia|alzheimer'?s?|diagnos\w*|learning disabilit\w*|age|aged|elderly|old|appearance|looks|condition)\b/i;
const OBSERVED = /\b(said|says|asked|asks|told|tells|stated|refus\w*|declin\w*|forg[eo]t\w*|repeat\w*|could ?n[o']?t|unable|did ?n[o']?t|seemed|appeared to|confused about|insist\w*|wander\w*|tried|attempt\w*|believ\w*|thinks?|thought|mistak\w*|explain\w*)\b/i;

const UNWISE = /\b(unwise|bad (decision|choice)|wrong (decision|choice)|against (medical |our |professional )?advice|disagree\w*|not (in )?(his|her|their) best interests?|risky|foolish|irrational)\b/i;
const COMMS_TRIED = /\b(sign|signs|gesture|gestures|picture|pictures|written|write|wrote|writing|blink\w*|aid|aids|interpreter|eye|eyes|point|pointing|nod\w*|board|makaton|translat\w*|easy[- ]read|objects?|symbols?|talking mat)\b/i;
const CONSEQUENCE = /\b(if|consequence\w*|risk\w*|happen\w*|would|might|could|without|otherwise|refus\w*|not (to )?decid\w*)\b/i;

export function deriveOutcome(rec: McaRecord): Outcome | null {
  const f = rec.functional;
  const results = LIMBS.map(l => f[l.key].result);
  const anyUnable = results.includes('unable');
  const allAble = results.every(r => r === 'able');

  if (allAble) return 'has_capacity';
  if (anyUnable) {
    if (rec.impairment.present === true && rec.causativeNexus.present === true) return 'lacks_capacity';
    // Unable, but not because of an impairment of mind or brain — the Act does
    // not treat them as lacking capacity. Coercion or undue influence is a
    // matter for safeguarding and, if needed, the inherent jurisdiction.
    if (rec.impairment.present === false || rec.causativeNexus.present === false) return 'has_capacity';
    return null;
  }
  return null;
}

export function validateMca(input: any, opts: { now?: Date } = {}): Validation {
  const rec = normalise(input);
  const now = opts.now || new Date();
  const issues: Issue[] = [];
  const add = (level: Level, step: Step, message: string, law: string, field?: string) =>
    issues.push({ level, step, field, message, law });

  // ── 1. The decision ───────────────────────────────────────────────────────
  if (len(rec.decision) < 12) {
    add('error', 'decision', 'Say exactly which decision this is about, in a full sentence — for example "whether to move to the nursing floor".',
      'MCA 2005 s2(1); Code of Practice 4.4', 'decision');
  } else if (GLOBAL_DECISION.test(rec.decision)) {
    add('error', 'decision', 'Capacity is assessed for one decision at one time. Name a single, specific decision rather than an area of life or "capacity" in general.',
      'MCA 2005 s2(1); Code of Practice 4.4', 'decision');
  }

  if (rec.relevantInformation.filter(x => len(x) > 0).length === 0) {
    add('error', 'decision', 'List the information the person needs to understand to make this decision — the key facts, not everything.',
      'MCA 2005 s3(1)(a), s3(4); Code of Practice 4.16', 'relevantInformation');
  } else if (!rec.relevantInformation.some(x => CONSEQUENCE.test(x))) {
    add('warning', 'decision', 'The relevant information should include the likely consequences of each choice, and of not deciding at all.',
      'MCA 2005 s3(4)', 'relevantInformation');
  }

  if (len(rec.reasonForDoubt) < 15) {
    add('error', 'decision', 'Record why capacity is in doubt for this decision. A person is presumed to have capacity unless there is a reason to think otherwise.',
      'MCA 2005 s1(2); Code of Practice 4.34–4.35', 'reasonForDoubt');
  } else if (STATUS_ONLY.test(rec.reasonForDoubt) && !OBSERVED.test(rec.reasonForDoubt)) {
    add('warning', 'decision', 'This reason rests on a diagnosis, age or condition. Say what the person has said or done that raises the doubt — a diagnosis on its own is not a reason.',
      'MCA 2005 s2(3)', 'reasonForDoubt');
  }

  // ── 2. Support ────────────────────────────────────────────────────────────
  const steps = rec.practicableSteps.filter(x => len(x) > 0);
  const derived = deriveOutcome(rec);
  if (steps.length === 0) {
    add(derived === 'lacks_capacity' ? 'error' : 'warning', 'support',
      'Record what was done to help the person make this decision themselves — the right time of day, simple language, aids, someone they trust present.',
      'MCA 2005 s1(3); Code of Practice ch.3', 'practicableSteps');
  }
  if (rec.fluctuating && !rec.bestTimeConsidered) {
    add('warning', 'support', 'Their capacity seems to vary. Record whether the assessment was done at the time of day they are usually at their best.',
      'Code of Practice 3.13–3.14, 4.26–4.27', 'bestTimeConsidered');
  }
  if (!len(rec.assessedAt)) {
    add('error', 'support', 'Record when the assessment took place. Capacity is assessed at a particular time.',
      'MCA 2005 s2(1)', 'assessedAt');
  }

  // ── 3. The test, in the JB order: functional first, then the cause ────────
  const f = rec.functional;
  const anyUnable = LIMBS.some(l => f[l.key].result === 'unable');
  for (const l of LIMBS) {
    const r = f[l.key];
    if (r.result === 'not_assessed') {
      add(anyUnable ? 'warning' : 'error', 'test',
        anyUnable
          ? `Whether they can ${l.name} has not been recorded. One inability is enough, but record all four where you can.`
          : `Record whether they can ${l.name}.`,
        l.law, `functional.${l.key}`);
      continue;
    }
    if (r.result === 'unable' && len(r.evidence) < 25) {
      add('error', 'test',
        `Say what the person said or did that shows they cannot ${l.name}. Their words, where possible.`,
        `${l.law}; MCA 2005 s2(4)`, `functional.${l.key}.evidence`);
    }
    if (r.result === 'able' && len(r.evidence) === 0) {
      add('warning', 'test', `Briefly note what showed they can ${l.name}.`, l.law, `functional.${l.key}.evidence`);
    }
  }
  if (f.weigh.result === 'unable' && UNWISE.test(f.weigh.evidence)) {
    add('warning', 'test',
      'This evidence describes the choice as unwise or against advice. Making an unwise decision is not, on its own, a sign of being unable to weigh information.',
      'MCA 2005 s1(4); Code of Practice 2.10–2.11', 'functional.weigh.evidence');
  }
  if (f.communicate.result === 'unable' && !COMMS_TRIED.test(f.communicate.evidence)) {
    add('warning', 'test',
      'Being unable to communicate means by ANY means. Record which other ways were tried — writing, pictures, signs, gestures, blinking, an interpreter.',
      'MCA 2005 s3(1)(d); Code of Practice 4.23–4.25', 'functional.communicate.evidence');
  }
  if (f.retain.result === 'unable' && /\b(short|brief|few) (time|while|minutes?|moments?)\b/i.test(f.retain.evidence)) {
    add('warning', 'test',
      'Holding information for long enough to make the decision is enough — even if it is only for a short time.',
      'MCA 2005 s3(3)', 'functional.retain.evidence');
  }

  if (anyUnable) {
    if (rec.impairment.present === null) {
      add('error', 'test', 'Is there an impairment of, or disturbance in the functioning of, the mind or brain? It can be temporary and does not need a formal diagnosis.',
        'MCA 2005 s2(1)–(2)', 'impairment.present');
    } else if (rec.impairment.present && len(rec.impairment.description) < 10) {
      add('error', 'test', 'Describe the impairment or disturbance and how you know about it.',
        'MCA 2005 s2(1)', 'impairment.description');
    }
    if (rec.impairment.present === true) {
      if (rec.causativeNexus.present === null) {
        add('error', 'test', 'Is the inability to decide BECAUSE OF the impairment? This link has to be shown, not assumed.',
          'MCA 2005 s2(1); A Local Authority v JB [2021] UKSC 52', 'causativeNexus.present');
      } else if (rec.causativeNexus.present && len(rec.causativeNexus.explanation) < 20) {
        add('error', 'test', 'Explain how the impairment causes the inability you recorded.',
          'MCA 2005 s2(1); A Local Authority v JB [2021] UKSC 52', 'causativeNexus.explanation');
      }
    }
    if (rec.impairment.present === false || rec.causativeNexus.present === false) {
      add('info', 'test',
        'The inability is not caused by an impairment of mind or brain, so the Act does not treat the person as lacking capacity. If you suspect pressure or undue influence from someone, raise it as a safeguarding concern.',
        'MCA 2005 s2(1); Code of Practice 4.12', 'impairment.present');
    }
  }

  // ── 4. Outcome ────────────────────────────────────────────────────────────
  const outcome = rec.conclusion.outcome;
  if (!outcome) {
    add('error', 'outcome', 'Record the outcome of the assessment.', 'MCA 2005 s2(4)', 'conclusion.outcome');
  } else if (derived && outcome !== derived) {
    add('error', 'outcome',
      derived === 'has_capacity'
        ? 'The evidence recorded does not support a finding that they lack capacity. On the evidence, they have capacity for this decision.'
        : 'The evidence recorded supports a finding that they lack capacity for this decision. Either the conclusion or the evidence needs to change.',
      'MCA 2005 ss1(2), 2(1), 2(4)', 'conclusion.outcome');
  } else if (!derived && outcome !== 'cannot_determine') {
    add('error', 'outcome', 'The test is not finished, so no conclusion can yet be drawn. Complete the test, or record that capacity cannot yet be determined.',
      'MCA 2005 s2(4)', 'conclusion.outcome');
  }
  if (len(rec.conclusion.reasoning) < 20) {
    add('error', 'outcome', 'Explain the reasoning behind the outcome in your own words, on the balance of probabilities.',
      'MCA 2005 s2(4); Code of Practice 4.10', 'conclusion.reasoning');
  }
  if (outcome === 'cannot_determine') {
    if (len(rec.conclusion.furtherAssessment) < 10) {
      add('error', 'outcome', 'Record who will assess further, or what specialist input is needed.',
        'Code of Practice 4.51–4.54', 'conclusion.furtherAssessment');
    }
    add('info', 'outcome', 'Until it is established that they lack capacity, they are presumed to have it.',
      'MCA 2005 s1(2)');
  }
  if (outcome === 'has_capacity') {
    add('info', 'outcome', 'They make this decision themselves — even if others think it unwise.', 'MCA 2005 s1(4)');
  }
  if (rec.fluctuating && !rec.reassessBy && outcome === 'lacks_capacity') {
    add('error', 'outcome', 'Their capacity varies. Set a date by which this decision will be reassessed.',
      'Code of Practice 4.26–4.27', 'reassessBy');
  }

  // ── 5. Best interests — only when they lack capacity ──────────────────────
  const lacks = outcome === 'lacks_capacity' && derived === 'lacks_capacity';
  const bi = rec.bestInterests;
  if (lacks) {
    const S: Step = 'best_interests';

    if (!bi.lpa.exists) {
      add('error', S, 'Check whether there is a Lasting Power of Attorney.', 'MCA 2005 ss9–14; Code of Practice ch.7', 'bestInterests.lpa.exists');
    } else if (bi.lpa.exists === 'unknown') {
      add('warning', S, 'Search the Office of the Public Guardian register, or ask family, before proceeding.', 'MCA 2005 ss9–14', 'bestInterests.lpa.exists');
    } else if (bi.lpa.exists === 'yes') {
      if (!bi.lpa.registerChecked) {
        add('warning', S, 'Check the LPA is registered and see a copy — an unregistered LPA cannot be used.', 'MCA 2005 s9(2)(b)', 'bestInterests.lpa.registerChecked');
      }
      const needed = LPA_TYPE_FOR[rec.category];
      if (bi.lpa.type && bi.lpa.type !== needed) {
        add('info', S, `This LPA is for ${bi.lpa.type === 'property_financial' ? 'property and financial affairs' : 'health and welfare'}; it does not cover this kind of decision.`,
          'MCA 2005 ss9–11', 'bestInterests.lpa.type');
      } else if (bi.lpa.type === needed && bi.lpa.coversDecision === true && bi.decisionMaker !== 'lpa_attorney') {
        add('error', S, 'A registered attorney with authority over this decision makes it — not the home. Record the attorney as the decision-maker.',
          'MCA 2005 s9, s11(7)', 'bestInterests.decisionMaker');
      }
    }

    if (bi.deputy.exists === 'yes' && bi.deputy.coversDecision === true && bi.decisionMaker !== 'deputy'
        && bi.decisionMaker !== 'lpa_attorney') {
      add('error', S, 'A court-appointed deputy with authority over this decision makes it. Record the deputy as the decision-maker.',
        'MCA 2005 ss16, 20', 'bestInterests.decisionMaker');
    }
    if (!bi.decisionMaker) {
      add('error', S, 'Record who the decision-maker is.', 'Code of Practice 5.8–5.12', 'bestInterests.decisionMaker');
    }

    if (TREATMENT_CATEGORIES.includes(rec.category)) {
      if (!bi.adrt.exists) {
        add('error', S, 'Check whether they made an advance decision to refuse this treatment.', 'MCA 2005 ss24–26; Code of Practice ch.9', 'bestInterests.adrt.exists');
      } else if (bi.adrt.exists === 'yes' && bi.adrt.validAndApplicable === null) {
        add('error', S, 'Is the advance decision valid and applicable to this treatment?', 'MCA 2005 s25', 'bestInterests.adrt.validAndApplicable');
      } else if (bi.adrt.exists === 'yes' && bi.adrt.validAndApplicable === true) {
        add(len(bi.adrt.details) < 10 ? 'error' : 'warning', S,
          'A valid, applicable advance decision has the same effect as if they had refused at the time. It must be followed — best interests cannot override it.',
          'MCA 2005 s26(1)', 'bestInterests.adrt.details');
      }
    }

    if (!bi.regainCapacity.likely) {
      add('error', S, 'Consider whether they are likely to regain capacity for this decision, and when.', 'MCA 2005 s4(3)', 'bestInterests.regainCapacity.likely');
    } else if (bi.regainCapacity.likely === 'yes' && bi.regainCapacity.canWait === true) {
      add('warning', S, 'They may regain capacity and the decision can wait. Consider waiting so they can make it themselves.', 'MCA 2005 s4(3)', 'bestInterests.regainCapacity.canWait');
    }

    if (len(bi.participation) < 15) {
      add('error', S, 'Record how they were helped to take part in the decision, as fully as they could.', 'MCA 2005 s4(4)', 'bestInterests.participation');
    }
    if (len(bi.wishesFeelings) < 15) {
      add('error', S, 'Record their past and present wishes and feelings — what they have said, written or shown.', 'MCA 2005 s4(6)(a)', 'bestInterests.wishesFeelings');
    }
    if (len(bi.beliefsValues) < 5) {
      add('error', S, 'Record the beliefs and values that would be likely to influence them — or "none known" if that is the case.', 'MCA 2005 s4(6)(b)', 'bestInterests.beliefsValues');
    }

    const consultees = bi.consultees.filter(c => len(c?.name) > 0);
    if (consultees.length === 0 && !bi.noOneAppropriateToConsult) {
      add('error', S, 'Record who was consulted — family, friends, carers, an attorney or deputy — and what they said. If there is nobody appropriate, say so.',
        'MCA 2005 s4(7)', 'bestInterests.consultees');
    }
    consultees.forEach((c, i) => {
      if (len(c.relationship) === 0 || len(c.view) < 5) {
        add('error', S, `For ${c.name}, record their relationship and what they said.`, 'MCA 2005 s4(7)', `bestInterests.consultees.${i}`);
      }
    });
    if ((consultees.length === 0 || bi.noOneAppropriateToConsult) && IMCA_CATEGORIES.includes(rec.category) && !bi.imca.referred) {
      add('error', S, 'With nobody appropriate to consult, an Independent Mental Capacity Advocate must be instructed for this kind of decision.',
        'MCA 2005 ss37–39; Code of Practice ch.10', 'bestInterests.imca.referred');
    }

    if (rec.category === 'covert_medication') {
      const has = (re: RegExp) => consultees.some(c => re.test(`${c.relationship} ${c.name}`));
      if (!has(/\b(gp|doctor|prescriber|physician|consultant)\b/i)) {
        add('error', S, 'Covert medication needs the prescriber in the best interests decision.', 'NICE SC1 — covert administration of medicines', 'bestInterests.consultees');
      }
      if (!has(/\bpharmac/i)) {
        add('error', S, 'Covert medication needs a pharmacist\'s advice on how each medicine can safely be given.', 'NICE SC1 — covert administration of medicines', 'bestInterests.consultees');
      }
    }

    const options = bi.options.filter(o => len(o?.option) > 0);
    if (options.length < 2) {
      add('error', S, 'Set out the realistic options — at least two, including the least restrictive — with the benefits and burdens of each.',
        'MCA 2005 s1(6); Code of Practice 5.13', 'bestInterests.options');
    }
    if (len(bi.chosenOption) === 0) {
      add('error', S, 'Record the option chosen.', 'MCA 2005 s4', 'bestInterests.chosenOption');
    }
    if (len(bi.whyLeastRestrictive) < 20) {
      add('error', S, 'Explain why this is the least restrictive way of meeting their needs, or why a less restrictive option will not work.',
        'MCA 2005 s1(6)', 'bestInterests.whyLeastRestrictive');
    }
    if (!bi.notBasedOnAgeOrAppearance) {
      add('error', S, 'Confirm the decision was not made on the basis of their age, appearance, condition or behaviour.',
        'MCA 2005 s4(1)', 'bestInterests.notBasedOnAgeOrAppearance');
    }
    if (bi.lifeSustaining && !bi.notMotivatedByDeath) {
      add('error', S, 'Where life-sustaining treatment is concerned, confirm the decision is not motivated by a desire to bring about their death.',
        'MCA 2005 s4(5)', 'bestInterests.notMotivatedByDeath');
    }
  }

  // ── 6. Liberty — DoLS ──────────────────────────────────────────────────────
  const libertyRelevant = lacks && LIBERTY_CATEGORIES.includes(rec.category);
  const lb = rec.liberty;
  const deprived = libertyRelevant && lb.continuousSupervision === 'yes' && lb.notFreeToLeave === 'yes';
  if (libertyRelevant) {
    const L: Step = 'liberty';
    if (!lb.continuousSupervision) {
      add('error', L, 'Are they under continuous supervision and control?', 'P v Cheshire West [2014] UKSC 19', 'liberty.continuousSupervision');
    }
    if (!lb.notFreeToLeave) {
      add('error', L, 'Are they free to leave — not just able to walk out, but free to go and live elsewhere?', 'P v Cheshire West [2014] UKSC 19', 'liberty.notFreeToLeave');
    }
    const unsure = lb.continuousSupervision === 'unknown' || lb.notFreeToLeave === 'unknown';
    if (deprived) {
      if (lb.authorisation !== 'granted' && lb.authorisation !== 'applied') {
        add('error', L, 'This amounts to a deprivation of liberty. The home must apply to the local authority for a standard authorisation, and record it on the DoLS register.',
          'MCA 2005 Schedule A1; P v Cheshire West [2014] UKSC 19', 'liberty.authorisation');
      }
    } else if (unsure) {
      add('warning', L, 'If you are unsure, take advice from the local authority DoLS team. Their view should be recorded.',
        'MCA 2005 Schedule A1', 'liberty.notes');
    }
  }

  // ── 7. Review ─────────────────────────────────────────────────────────────
  if (outcome === 'lacks_capacity' || outcome === 'cannot_determine') {
    if (!rec.reviewDate) {
      add('error', 'review', 'Set a date to review this. Capacity can change, and so can what is in their best interests.',
        'Code of Practice 4.26, 5.28', 'reviewDate');
    } else {
      const due = new Date(String(rec.reviewDate).slice(0, 10) + 'T12:00:00');
      const days = (due.getTime() - now.getTime()) / 86_400_000;
      if (Number.isNaN(due.getTime())) {
        add('error', 'review', 'The review date is not a valid date.', 'Code of Practice 5.28', 'reviewDate');
      } else if (days < 0) {
        add('error', 'review', 'The review date is in the past.', 'Code of Practice 5.28', 'reviewDate');
      } else if (days > 366) {
        add('warning', 'review', 'Review dates more than a year away are hard to justify. Most decisions should be reviewed sooner.', 'Code of Practice 5.28', 'reviewDate');
      }
    }
  }

  // ── Which steps apply, and which are done ─────────────────────────────────
  const errorsIn = (s: Step) => issues.some(i => i.level === 'error' && i.step === s);
  const stepState = (s: Step, needed: boolean): StepState => !needed ? 'not_needed' : errorsIn(s) ? 'incomplete' : 'complete';
  const stepsOut: Record<Step, StepState> = {
    decision: stepState('decision', true),
    support: stepState('support', true),
    test: stepState('test', true),
    outcome: stepState('outcome', true),
    best_interests: stepState('best_interests', lacks),
    liberty: stepState('liberty', libertyRelevant),
    review: stepState('review', outcome === 'lacks_capacity' || outcome === 'cannot_determine'),
  };

  return {
    issues,
    derivedOutcome: derived,
    canComplete: !issues.some(i => i.level === 'error'),
    steps: stepsOut,
    deprivationOfLiberty: deprived,
  };
}
