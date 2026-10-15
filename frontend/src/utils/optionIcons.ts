// src/utils/optionIcons.ts
//
// One picture per option on the care recording forms.
//
// Many carers read English as a second language, and everyone is working fast,
// one-handed, on a phone. So the picture has to carry the meaning, not just
// decorate the words.
//
// Two rules make that work, and both were learned the hard way:
//
//  1. EVERY OPTION IN A GROUP GETS A DIFFERENT PICTURE. An earlier version
//     matched on keywords, so "Electric shave given" and "Wet shave given"
//     both showed a razor — which tells a carer nothing at the moment they are
//     choosing between the two. Where options differ only by a modifier, the
//     picture is a pair: 🛁🤝 assisted, 🛁🧍 independent. The subject stays
//     recognisable and the difference is visible.
//     `npm run check:icons` fails the build if two options in one group ever
//     share a picture again.
//
//  2. THE WORDS STAY. A razor cannot tell you whether the shave was refused,
//     and "refused" is the entry that matters most in a clinical record. The
//     picture is read first; the words remove all doubt.
//
// Outcome markers are deliberately consistent everywhere: ➖ not needed,
// 🚫 refused, 📢 reported to a nurse, 🚑 emergency, ✅ no concerns. Those five
// are the ones a carer learns in the first shift.

const OPTION_ICONS: Record<string, string> = {
  // 🛁 Bathing / Washing
  'Full bath (assisted)': '🛁🤝',
  'Full bath (independent)': '🛁🧍',
  'Shower (assisted)': '🚿🤝',
  'Shower (independent)': '🚿🧍',
  'Bed bath (full)': '🛏🧽',
  'Strip wash / freshen up': '🧼',
  'Sponge bath': '🧽',
  'Not completed — reason below': '➖',

  // 💇 Hair
  'Washed & dried': '💇',
  'Washed & styled': '💈',
  'Dry shampoo used': '🧴',
  'Combed / brushed only': '💆',
  'Not required today': '➖',

  // 🪒 Shaving / Facial Care
  'Electric shave given': '⚡🪒',
  'Wet shave given': '💧🪒',
  'Cream / moisturiser applied': '🧴',
  'Not required': '➖',
  'Refused': '🚫',

  // 💅 Nail Care
  'Nails trimmed': '✂️',
  'Nails filed': '💅',
  'Cream applied': '🧴',
  'Referred to podiatrist': '🦶➡️',

  // 🦷 Oral Hygiene
  'Own teeth brushed': '🧼',
  'Upper dentures cleaned': '⬆️🦷',
  'Lower dentures cleaned': '⬇️🦷',
  'Both dentures cleaned / soaked': '🥛🦷',
  'Mouth care given (foam swabs)': '🧽👄',
  'Refused — encouraged': '🚫',
  'Mouth rinse given': '💧👄',

  // 🧴 Skin Care
  'Moisturiser applied (full body)': '🧴🧍',
  'Moisturiser applied (dry areas)': '🧴📍',
  'Emollient applied (prescribed)': '💊🧴',
  'Pressure cream applied': '🛡',
  'Barrier cream applied': '🧱',
  'Skin intact — no concerns': '✅',
  'Redness noted — reported to nurse': '🔴📢',

  // 👕 Dressing
  'Fully dressed (assisted)': '👕🤝',
  'Fully dressed (independent)': '👕🧍',
  'Night clothes on': '🌙👚',
  'Changed into fresh clothes': '🔄👕',
  'Declined to change': '🚫',
  'Compression stockings on': '🧦⬆️',
  'Compression stockings removed': '🧦⬇️',

  // 🚽 Toileting Method
  'Used toilet independently': '🚽🧍',
  'Assisted to toilet': '🚽🤝',
  'Commode used': '🪑',
  'Bedpan used': '🛏🚽',
  'Catheter (indwelling)': '🔌',
  'Catheter (suprapubic)': '🔌📍',
  'Conveen / sheath': '🩲',
  'Pads only': '🧻',

  // 💧 Urinary
  'Continent today': '✅',
  'Pad worn — no leakage': '🧻✅',
  'Pad worn — leakage noted': '🧻💧',
  'Pad changed': '🔄🧻',
  'Catheter emptied': '🔌⬇️',
  'Catheter output noted': '📏',
  'Catheter bypassing — reported': '🔌📢',
  'UTI suspected — reported to nurse': '🦠📢',
  'Reduced urine output — reported': '📉📢',
  'CSU specimen taken': '🧪',

  // 🟤 Bowels
  'Bowels opened (normal)': '✅',
  'Bowels opened (Bristol type 1–2 hard)': '🧱',
  'Bowels opened (Bristol type 3–4 normal)': '🟢',
  'Bowels opened (Bristol type 5–7 loose)': '💦',
  'Bowels not opened today': '⭕',
  'Constipated — reported to nurse': '🧱📢',
  'Diarrhoea — reported to nurse': '💦📢',
  'Bowels not opened 3+ days — escalated': '⏳🚨',
  'PR bleed noted — reported urgently': '🩸🚑',

  // 🔌 Catheter Care
  'Catheter site clean — no concerns': '✅',
  'Catheter bag emptied and documented': '⬇️📝',
  'Catheter changed by nurse': '🔄🔌',
  'Blockage concern — reported': '⛔📢',
  'Bypassing — reviewed by nurse': '💧📢',
  'CSU sent to lab': '🧪',

  // 🛏 Position Changed To
  'Left lateral': '⬅️🛏',
  'Right lateral': '➡️🛏',
  'Semi-recumbent (30°)': '📐',
  'Supine (flat)': '⬛',
  'High Fowler (sitting up)': '⬆️🛏',
  'Seated in chair': '🪑',
  'Standing (hoist / transfer)': '🧍',

  // 🔧 Equipment Used
  'No equipment needed': '➖',
  'Slide sheet used': '📄',
  'Full hoist used': '🏗',
  'Stand aid used': '🧍🤝',
  'Transfer board used': '📏',
  'Manual handling (2 carers)': '👥',
  'Turning wedge / pillow': '🔺',

  // 🩺 Pressure Area Check
  'Grade 1 — redness (non-blanching)': '1️⃣',
  'Grade 2 — blister / superficial break': '2️⃣',
  'Grade 3 — deep wound': '3️⃣',
  'Grade 4 — severe — nurse notified urgently': '4️⃣🚑',
  'Moisture lesion noted': '💧🩹',
  'Referred to tissue viability nurse': '🩺➡️',

  // ⏱ Next Turn
  '2-hourly regime': '2️⃣',
  '4-hourly regime': '4️⃣',
  'As tolerated': '🔄',
  'Resident declined repositioning': '🚫',
  'Family informed of skin concern': '👨‍👩‍👧📢',

  // 😴 Sleep Quality
  'Slept well — no concerns': '✅',
  'Settled after initial wakefulness': '🌙✅',
  'Disturbed — awoke multiple times': '🔁',
  'Called out / shouted overnight': '🗣',
  'Confused / disorientated at night (sundowning)': '🌆',
  'Awake most of night': '👁',
  'Slept in chair all night': '🪑',

  // 🕐 Hours Slept (approx)
  '1–2 hours': '🕐',
  '2–4 hours': '🕑',
  '4–6 hours': '🕓',
  '6–8 hours': '🕕',
  '8+ hours': '🕗',

  // 🤲 Intervention
  'No intervention needed': '➖',
  'Repositioned and settled': '🔄🛏',
  'Reassured and settled': '🤲',
  'Drink/snack offered': '🥤',
  'Night medication given (check MAR)': '🌙💊',
  'PRN given — see MAR': '💊',
  'Family contacted': '👨‍👩‍👧',
  'GP called': '🩺',

  // ⚠️ Behaviour Type
  'Verbal aggression': '🗣',
  'Physical aggression': '✊',
  'Wandering / exit seeking': '🚪',
  'Calling out repeatedly': '📣',
  'Repetitive questions / behaviours': '🔁',
  'Resistance to care': '🙅',
  'Sexually disinhibited behaviour': '⚠️',
  'Sundowning / evening confusion': '🌆',
  'Low mood / withdrawal': '😔',
  'Tearful / distressed': '😢',

  // 🔍 Possible Trigger
  'Unknown / no clear trigger': '❓',
  'Pain / discomfort': '💢',
  'Hunger / thirst': '🍽',
  'Toileting need': '🚽',
  'Environmental noise': '🔊',
  'Unfamiliar staff': '🧑',
  'Time of day (sundowning)': '🌆',
  'Medication change': '💊',
  'Family visit / lack of contact': '👨‍👩‍👧',
  'Medical issue suspected': '🩺',

  // ✅ Intervention Used
  'De-escalation technique': '🕊',
  'Distraction / redirection': '🔀',
  '1:1 support provided': '🧑‍🤝‍🧑',
  'Favourite music / TV used': '🎵',
  'Walk / fresh air offered': '🚶',
  'PRN medication given — see MAR': '💊',
  'Family called': '📞',
  'GP / mental health team contacted': '🩺',
  'Referred for behaviour review': '➡️',
  'Incident form completed': '📝',

  // 📍 Wound Site
  'Sacrum / coccyx': '🪑',
  'Left heel': '⬅️👣',
  'Right heel': '➡️👣',
  'Left hip': '⬅️🦴',
  'Right hip': '➡️🦴',
  'Left ankle': '⬅️🦶',
  'Right ankle': '➡️🦶',
  'Left elbow': '⬅️💪',
  'Right elbow': '➡️💪',
  'Left knee': '⬅️🦵',
  'Right knee': '➡️🦵',
  'Lower leg': '🧦',
  'Torso / abdomen': '👕',
  'Head / face': '🙂',
  'Other — see notes': '📝',

  // 🩺 Wound Type
  'Pressure ulcer': '🛏',
  'Moisture lesion': '💧',
  'Skin tear': '✂️',
  'Leg ulcer (venous)': '🔵',
  'Leg ulcer (arterial)': '🔴',
  'Diabetic foot ulcer': '🦶',
  'Surgical wound': '🏥',
  'Infected wound': '🦠',
  'Bruising / haematoma': '🟣',
  'Abrasion / graze': '🩹',

  // 📊 Pressure Ulcer Grade (if applicable)
  'Grade 1 — non-blanching redness': '1️⃣',
  'Grade 2 — blister / shallow break': '2️⃣',
  'Grade 3 — full thickness skin loss': '3️⃣',
  'Grade 4 — deep tissue damage / bone visible': '4️⃣',
  'Unstageable': '❓',
  'Deep tissue injury (purple / maroon)': '🟣',

  // 🩹 Dressing
  'Dressing applied (unchanged)': '🩹',
  'Dressing changed': '🔄',
  'Wound cleaned prior to dressing': '🧼',
  'Hydrocolloid applied': '🟠',
  'Foam dressing applied': '🧽',
  'Alginate applied': '🌿',
  'Film dressing applied': '📄',
  'No dressing — left open': '➖',
  'Dressing refused by resident': '🚫',

  // 📈 Wound Condition
  'Improving — healing well': '📈',
  'Static — no change': '➖',
  'Deteriorating — reported to nurse': '📉📢',
  'Infected signs — swelling / heat / smell': '🦠',
  'Bleeding — pressure applied': '🩸',
  'Referral to tissue viability nurse': '🩺➡️',
  'GP notified': '📞',
  'Hospital referral made': '🏥',

  // 👁 Witnessed?
  'Witnessed fall': '👁',
  'Found on floor — unwitnessed': '⬇️',
  'Near miss — caught in time': '🤲',
  'Resident reported falling earlier': '🗣',

  // 📍 Location
  'Bedroom': '🛏',
  'En-suite / bathroom': '🚿',
  'Corridor': '🚪',
  'Lounge / sitting room': '🛋',
  'Dining room': '🍽',
  'Garden / outside': '🌳',
  'Stairs': '⬆️',

  // 🤕 Injuries
  'No visible injuries': '✅',
  'Minor cuts / grazes': '🩹',
  'Bruising noted': '🟣',
  'Head injury — neuro obs started': '🤕',
  'Suspected fracture — 999 called': '🦴🚑',
  'Hip injury — X-ray needed': '🦴',
  'Laceration — wound care given': '✂️',
  'Loss of consciousness momentarily': '😵',

  // 📋 Response
  'Post-fall observations completed': '📋',
  'Vital signs checked': '🩺',
  'Nurse informed immediately': '📢',
  'GP contacted': '📞',
  '999 / paramedic called': '🚑',
  'Family notified': '👨‍👩‍👧',
  'DATIX / Ulysses logged': '💻',
  'X-ray arranged': '🦴',
  'Physio referral made': '🏃➡️',

  // 🎯 Activity Type
  'Group activity (lounge)': '👥',
  '1:1 individual activity': '🧑‍🤝‍🧑',
  'Exercise / physiotherapy': '🏃',
  'Music session': '🎵',
  'Singing / choir': '🎤',
  'Arts & crafts': '🎨',
  'Gardening': '🌱',
  'Baking / cooking': '🧁',
  'Reading / book club': '📖',
  'Board games / puzzles': '🧩',
  'Quiz / reminiscence': '💭',
  'Film / TV watching': '📺',
  'Religious / spiritual service': '🕊',
  'Pet therapy': '🐕',
  'Visiting entertainer': '🎭',
  'Video call with family': '📹',
  'Outdoor walk / fresh air': '🌳',
  'Hairdresser / pamper session': '💇',

  // 🙌 Engagement Level
  'Fully engaged — enthusiastic': '🌟',
  'Engaged — participated well': '🙌',
  'Partially engaged — in and out': '🔀',
  'Observed only — chose to watch': '👁',
  'Declined — offered but refused': '🚫',
  'Unable to engage today': '➖',
  'Initiated activity themselves': '💡',

  // 😊 Mood After Activity
  'Noticeably lifted / happier': '😊',
  'Calm and content': '😌',
  'No change noted': '➖',
  'Tired — needed rest afterwards': '😪',
  'Distressed — activity stopped': '😢',

  // 🏥 Visit Type
  'GP home visit': '🩺🏠',
  'GP telephone consultation': '🩺📞',
  'Nurse practitioner visit': '💉',
  'District nurse visit': '🚗💉',
  'Outpatient appointment': '🏥',
  'A&E attendance': '🚑',
  'Hospital admission': '🏥⬆️',
  'Hospital discharge': '🏥⬇️',
  'Dentist visit': '🦷',
  'Optician visit': '👓',
  'Podiatrist visit': '🦶',
  'Physiotherapy session': '🏃',
  'Occupational therapy assessment': '🧰',
  'SALT (speech & language) assessment': '🗣',
  'Dietitian review': '🍽',
  'Palliative care team visit': '🕊',
  'Mental health team visit': '🧠',

  // 📋 Outcome / Actions
  'New medication prescribed — see MAR': '💊➕',
  'Medication stopped — see MAR': '💊🚫',
  'Medication dose changed — see MAR': '💊🔄',
  'Blood test arranged': '🩸',
  'X-ray / scan arranged': '🦴',
  'Referral made': '➡️',
  'Follow-up appointment booked': '📅',
  'No action required': '➖',
  'Admitted to hospital': '🏥⬆️',
  'Discharged home': '🏠',
  'Care plan review recommended': '📖',
  'DNAR discussed': '📄',
  'Capacity assessment recommended': '⚖️',

  // 👨‍👩‍👧 Contact Type
  'Family visit in person': '🚪',
  'Telephone call from family': '📞',
  'Video call (FaceTime / WhatsApp)': '📹',
  'Email / letter received': '✉️',
  'Family meeting held': '👥',
  'Social worker visit': '🧑‍💼',
  'Advocate visit': '🗣',
  'Legal representative visit': '⚖️',

  // 💬 Topics Discussed
  'General welfare update': '💬',
  'Health concerns discussed': '🩺',
  'Medication changes explained': '💊',
  'Care plan reviewed together': '📖',
  'End of life wishes discussed': '🕊',
  'Finances / funding discussed': '💷',
  'Complaint raised by family': '📣',
  'Positive feedback given': '⭐',
  'Request for information': '❓',
  'Family updated on incident': '📝',
  'Family updated on falls': '⬇️',
  'Family updated on hospital visit': '🏥',

  // ✅ Consent / Agreements
  'Family happy with current care': '😊',
  'Family agree to care plan changes': '📖✅',
  'DNACPR discussed and agreed': '📄',
  'DNAR form signed': '🖊',
  'Lasting Power of Attorney confirmed': '⚖️',
  'Next of kin details updated': '📇',
  'Family request noted in care plan': '📝',

  // 🕊️ End of Life Care
  'Comfort measures in place': '🤲',
  'Syringe driver in situ — checked': '💉✅',
  'Syringe driver prescribed — awaiting': '💉⏳',
  'Oral care given (mouth care)': '👄',
  'Repositioned for comfort': '🔄🛏',
  'Skin care — pressure relief': '🧴',
  'Eye care given': '👁',
  'Catheter care given': '🔌',
  'Bowel management — suppository / enema': '🟤',
  'Oxygen in use': '💨',
  'CPAP / BiPAP in use': '😷',
  'Nil by mouth — comfort sips only': '🚱',

  // 👨‍👩‍👧 Family & Support
  'Family present at bedside': '🛏👨‍👩‍👧',
  'Family called — coming in': '📞🚗',
  'Family updated by phone': '📞',
  'Family unable to visit': '🚫',
  'Chaplain / spiritual care called': '🕊',
  'Bereavement support offered': '🤲',
  'Family staying overnight': '🌙',

  // 🩺 Clinical
  'DNACPR in place and reviewed': '📄',
  'Anticipatory medications prescribed': '💊',
  'Syringe driver dose reviewed by nurse': '💉',
  'GP / palliative team called': '📞',
  'Comfort care plan reviewed': '📖',
  'Pain assessed — comfortable': '😌',
  'Pain assessed — PRN given': '💢',
  'Agitation noted — PRN given': '😣',
  'Breathing changes noted': '💨',
  'Mottling observed — family informed': '🟣',
  'Cheyne-Stokes breathing noted': '🌊',

  // 🔁 Shift Summary
  'Quiet shift — no concerns': '✅',
  'One or more residents to monitor': '👁',
  'Falls this shift': '⬇️',
  'Medication incidents this shift': '💊',
  'Behavioural incidents this shift': '⚠️',
  'Hospital admission this shift': '🏥',
  'GP called this shift': '🩺',
  'Family notified of concern': '👨‍👩‍👧',
  'New resident admitted': '🚪➕',
  'Resident discharged / passed away': '🕊',

  // 📋 Outstanding Tasks
  'Medication awaiting — see MAR': '💊',
  'Wound care due': '🩹',
  'Bowels not opened — needs monitoring': '🟤',
  'Referral pending': '➡️',
  'Awaiting GP call back': '📞',
  'Family callback needed': '👨‍👩‍👧',
  'Incident form to complete': '📝',
  'Care plan review due': '📖',
  'Equipment issue reported': '🔧',

  // 👋 Handing To
  'Day shift': '☀️',
  'Early shift': '🌅',
  'Late shift': '🌇',
  'Night shift': '🌙',
  'Bank staff — full handover given': '🧑',
  'Agency staff — care plans shared': '🧑‍💼',

  // DRINK_OPTIONS
  'Water': '💧',
  'Tea': '🍵',
  'Coffee': '☕',
  'Juice': '🧃',
  'Squash': '🥤',
  'Milk': '🥛',
  'Thickened (Stage 1)': '1️⃣',
  'Thickened (Stage 2)': '2️⃣',
  'Thickened (Stage 3)': '3️⃣',
  'Fortisip': '🧴',
  'Ensure': '🥛➕',
  'Soup': '🍲',

  // TEXTURE_OPTIONS
  'Standard': '🍽',
  'IDDSI 6 – Soft & Bite-Sized': '6️⃣',
  'IDDSI 5 – Minced & Moist': '5️⃣',
  'IDDSI 4 – Puréed': '4️⃣',
  'IDDSI 3 – Liquidised': '3️⃣',
};

// Fallback only — for options added later that are not yet in the table above.
// Keep the table authoritative: this is a safety net, not the mechanism.
const KEYWORD_RULES: [RegExp, string][] = [
  [/(refused|declined)/i, '🚫'],
  [/(999|paramedic|emergency)/i, '🚑'],
  [/(escalated|reported to nurse|notified urgently)/i, '📢'],
  [/(not required|not completed|no action|none)/i, '➖'],
  [/(no concerns|intact)/i, '✅'],
  [/(medication|mar|prn)/i, '💊'],
  [/family/i, '👨‍👩‍👧'],
  [/(gp|nurse|doctor)/i, '🩺'],
];

/**
 * Pulls the picture off the front of a group heading such as "💇 Hair", so an
 * unmapped option still shows something related to its section.
 */
export function groupIcon(label: string): string | undefined {
  if (!label) return undefined;
  const m = label.match(/^\s*(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)/u);
  return m ? m[1] : undefined;
}

/** The picture for one care option. Never empty, so the layout stays steady. */
export function optionIcon(text: string, fallback = '•'): string {
  if (!text) return fallback;
  const exact = OPTION_ICONS[text];
  if (exact) return exact;
  for (const [pattern, symbol] of KEYWORD_RULES) {
    if (pattern.test(text)) return symbol;
  }
  return fallback;
}

export { OPTION_ICONS };
export default optionIcon;
