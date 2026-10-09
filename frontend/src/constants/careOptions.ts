// ────────────────────────────────────────────────────────────────────────────
// Care recording options — the single source for every screen.
//
// These lists lived inside CarerDashboard, which meant the simplified deck had
// its own shorter copy and quietly recorded less than the full form. Two lists
// of clinical options that are meant to be the same will always drift, and the
// drift is invisible: nothing fails, the record is just thinner.
//
// So there is one list now. The full form renders all of it. The quick sheet
// renders the same groups with the common answers first and the rest behind a
// "show all", so a carer can record anything the full form can without reading
// three hundred options on a phone.
//
// Adding an option here makes it available in both places at once. Removing one
// does not delete anything already recorded — old notes keep their text.
// ────────────────────────────────────────────────────────────────────────────

export const NOTE_TYPES = [
  { value: 'personal_care',       label: 'Personal Care',    icon: '🛁', color: '#3b82f6' },
  { value: 'continence',          label: 'Continence',       icon: '🚽', color: '#8b5cf6' },
  { value: 'nutrition',           label: 'Meal & Food',      icon: '🍽️', color: '#10b981' },
  { value: 'repositioning',       label: 'Repositioning',    icon: '🔄', color: '#f59e0b' },
  { value: 'nursing_observation', label: 'Nursing Obs',      icon: '🩺', color: '#06b6d4' },
  { value: 'sleep',               label: 'Sleep',            icon: '😴', color: '#8b5cf6' },
  { value: 'behaviour',           label: 'Behaviour',        icon: '📌', color: '#ef4444' },
  { value: 'social_wellbeing',    label: 'Wellbeing',        icon: '😊', color: '#ec4899' },
  { value: 'wound_care',          label: 'Wound Care',       icon: '🩹', color: '#dc2626' },
  { value: 'fall_observation',    label: 'Fall / Obs',       icon: '⚠️', color: '#f97316' },
  { value: 'activities',          label: 'Activities',       icon: '🎯', color: '#a855f7' },
  { value: 'gp_visit',            label: 'GP / Hospital',    icon: '🏥', color: '#0891b2' },
  { value: 'family_update',       label: 'Family Update',    icon: '👨‍👩‍👧', color: '#059669' },
  { value: 'end_of_life',         label: 'End of Life',      icon: '🕊️', color: '#6b7280' },
  { value: 'handover',            label: 'Handover Note',    icon: '🔁', color: '#0d9488' },
  { value: 'incident_note',       label: 'Concern / Flag',   icon: '🚩', color: '#dc2626' },
];

// ── Per-category clinical options ─────────────────────────────────────────

export const PERSONAL_CARE_OPTS = {
  bathing: {
    label: '🛁 Bathing / Washing',
    options: ['Full bath (assisted)','Full bath (independent)','Shower (assisted)','Shower (independent)','Bed bath (full)','Strip wash / freshen up','Sponge bath','Not completed — reason below'],
  },
  hair: {
    label: '💇 Hair',
    options: ['Washed & dried','Washed & styled','Dry shampoo used','Combed / brushed only','Not required today'],
  },
  shaving: {
    label: '🪒 Shaving / Facial Care',
    options: ['Electric shave given','Wet shave given','Cream / moisturiser applied','Not required','Refused'],
  },
  nails: {
    label: '💅 Nail Care',
    options: ['Nails trimmed','Nails filed','Cream applied','Referred to podiatrist','Not required today'],
  },
  oral: {
    label: '🦷 Oral Hygiene',
    options: ['Own teeth brushed','Upper dentures cleaned','Lower dentures cleaned','Both dentures cleaned / soaked','Mouth care given (foam swabs)','Refused — encouraged','Mouth rinse given'],
  },
  skinCare: {
    label: '🧴 Skin Care',
    options: ['Moisturiser applied (full body)','Moisturiser applied (dry areas)','Emollient applied (prescribed)','Pressure cream applied','Barrier cream applied','Skin intact — no concerns','Redness noted — reported to nurse'],
  },
  dressing: {
    label: '👕 Dressing',
    options: ['Fully dressed (assisted)','Fully dressed (independent)','Night clothes on','Changed into fresh clothes','Declined to change','Compression stockings on','Compression stockings removed'],
  },
};

export const CONTINENCE_OPTS = {
  method: {
    label: '🚽 Toileting Method',
    options: ['Used toilet independently','Assisted to toilet','Commode used','Bedpan used','Catheter (indwelling)','Catheter (suprapubic)','Conveen / sheath','Pads only'],
  },
  urinary: {
    label: '💧 Urinary',
    options: ['Continent today','Pad worn — no leakage','Pad worn — leakage noted','Pad changed','Catheter emptied','Catheter output noted','Catheter bypassing — reported','UTI suspected — reported to nurse','Reduced urine output — reported','CSU specimen taken'],
  },
  bowels: {
    label: '🟤 Bowels',
    options: ['Bowels opened (normal)','Bowels opened (Bristol type 1–2 hard)','Bowels opened (Bristol type 3–4 normal)','Bowels opened (Bristol type 5–7 loose)','Bowels not opened today','Constipated — reported to nurse','Diarrhoea — reported to nurse','Bowels not opened 3+ days — escalated','PR bleed noted — reported urgently'],
  },
  catheter: {
    label: '🔌 Catheter Care',
    options: ['Catheter site clean — no concerns','Catheter bag emptied and documented','Catheter changed by nurse','Blockage concern — reported','Bypassing — reviewed by nurse','CSU sent to lab'],
  },
};

export const REPOSITIONING_OPTS = {
  position: {
    label: '🛏 Position Changed To',
    options: ['Left lateral','Right lateral','Semi-recumbent (30°)','Supine (flat)','High Fowler (sitting up)','Seated in chair','Standing (hoist / transfer)'],
  },
  equipment: {
    label: '🔧 Equipment Used',
    options: ['No equipment needed','Slide sheet used','Full hoist used','Stand aid used','Transfer board used','Manual handling (2 carers)','Turning wedge / pillow'],
  },
  skin: {
    label: '🩺 Pressure Area Check',
    options: ['Skin intact — no concerns','Grade 1 — redness (non-blanching)','Grade 2 — blister / superficial break','Grade 3 — deep wound','Grade 4 — severe — nurse notified urgently','Moisture lesion noted','Referred to tissue viability nurse'],
  },
  frequency: {
    label: '⏱ Next Turn',
    options: ['2-hourly regime','4-hourly regime','As tolerated','Resident declined repositioning','Family informed of skin concern'],
  },
};

export const SLEEP_OPTS = {
  quality: {
    label: '😴 Sleep Quality',
    options: ['Slept well — no concerns','Settled after initial wakefulness','Disturbed — awoke multiple times','Called out / shouted overnight','Confused / disorientated at night (sundowning)','Awake most of night','Slept in chair all night'],
  },
  hours: {
    label: '🕐 Hours Slept (approx)',
    options: ['1–2 hours','2–4 hours','4–6 hours','6–8 hours','8+ hours'],
  },
  intervention: {
    label: '🤲 Intervention',
    options: ['No intervention needed','Repositioned and settled','Reassured and settled','Drink/snack offered','Night medication given (check MAR)','PRN given — see MAR','Family contacted','GP called'],
  },
};

export const BEHAVIOUR_OPTS = {
  type: {
    label: '⚠️ Behaviour Type',
    options: ['Verbal aggression','Physical aggression','Wandering / exit seeking','Calling out repeatedly','Repetitive questions / behaviours','Resistance to care','Sexually disinhibited behaviour','Sundowning / evening confusion','Low mood / withdrawal','Tearful / distressed'],
  },
  trigger: {
    label: '🔍 Possible Trigger',
    options: ['Unknown / no clear trigger','Pain / discomfort','Hunger / thirst','Toileting need','Environmental noise','Unfamiliar staff','Time of day (sundowning)','Medication change','Family visit / lack of contact','Medical issue suspected'],
  },
  intervention: {
    label: '✅ Intervention Used',
    options: ['De-escalation technique','Distraction / redirection','1:1 support provided','Favourite music / TV used','Walk / fresh air offered','PRN medication given — see MAR','Family called','GP / mental health team contacted','Referred for behaviour review','Incident form completed'],
  },
};


export const WOUND_OPTS = {
  site: {
    label: '📍 Wound Site',
    options: ['Sacrum / coccyx','Left heel','Right heel','Left hip','Right hip','Left ankle','Right ankle','Left elbow','Right elbow','Left knee','Right knee','Lower leg','Torso / abdomen','Head / face','Other — see notes'],
  },
  type: {
    label: '🩺 Wound Type',
    options: ['Pressure ulcer','Moisture lesion','Skin tear','Leg ulcer (venous)','Leg ulcer (arterial)','Diabetic foot ulcer','Surgical wound','Infected wound','Bruising / haematoma','Abrasion / graze'],
  },
  grade: {
    label: '📊 Pressure Ulcer Grade (if applicable)',
    options: ['Grade 1 — non-blanching redness','Grade 2 — blister / shallow break','Grade 3 — full thickness skin loss','Grade 4 — deep tissue damage / bone visible','Unstageable','Deep tissue injury (purple / maroon)'],
  },
  dressing: {
    label: '🩹 Dressing',
    options: ['Dressing applied (unchanged)','Dressing changed','Wound cleaned prior to dressing','Hydrocolloid applied','Foam dressing applied','Alginate applied','Film dressing applied','No dressing — left open','Dressing refused by resident'],
  },
  condition: {
    label: '📈 Wound Condition',
    options: ['Improving — healing well','Static — no change','Deteriorating — reported to nurse','Infected signs — swelling / heat / smell','Bleeding — pressure applied','Referral to tissue viability nurse','GP notified','Hospital referral made'],
  },
};

export const FALL_OPTS = {
  witnessed: {
    label: '👁 Witnessed?',
    options: ['Witnessed fall','Found on floor — unwitnessed','Near miss — caught in time','Resident reported falling earlier'],
  },
  location: {
    label: '📍 Location',
    options: ['Bedroom','En-suite / bathroom','Corridor','Lounge / sitting room','Dining room','Garden / outside','Stairs'],
  },
  injuries: {
    label: '🤕 Injuries',
    options: ['No visible injuries','Minor cuts / grazes','Bruising noted','Head injury — neuro obs started','Suspected fracture — 999 called','Hip injury — X-ray needed','Laceration — wound care given','Loss of consciousness momentarily'],
  },
  response: {
    label: '📋 Response',
    options: ['Post-fall observations completed','Vital signs checked','Nurse informed immediately','GP contacted','999 / paramedic called','Family notified','Incident form completed','DATIX / Ulysses logged','X-ray arranged','Physio referral made'],
  },
};

export const ACTIVITIES_OPTS = {
  type: {
    label: '🎯 Activity Type',
    options: ['Group activity (lounge)','1:1 individual activity','Exercise / physiotherapy','Music session','Singing / choir','Arts & crafts','Gardening','Baking / cooking','Reading / book club','Board games / puzzles','Quiz / reminiscence','Film / TV watching','Religious / spiritual service','Pet therapy','Visiting entertainer','Video call with family','Outdoor walk / fresh air','Hairdresser / pamper session'],
  },
  engagement: {
    label: '🙌 Engagement Level',
    options: ['Fully engaged — enthusiastic','Engaged — participated well','Partially engaged — in and out','Observed only — chose to watch','Declined — offered but refused','Unable to engage today','Initiated activity themselves'],
  },
  moodAfter: {
    label: '😊 Mood After Activity',
    options: ['Noticeably lifted / happier','Calm and content','No change noted','Tired — needed rest afterwards','Distressed — activity stopped'],
  },
};

export const GP_VISIT_OPTS = {
  type: {
    label: '🏥 Visit Type',
    options: ['GP home visit','GP telephone consultation','Nurse practitioner visit','District nurse visit','Outpatient appointment','A&E attendance','Hospital admission','Hospital discharge','Dentist visit','Optician visit','Podiatrist visit','Physiotherapy session','Occupational therapy assessment','SALT (speech & language) assessment','Dietitian review','Palliative care team visit','Mental health team visit'],
  },
  outcome: {
    label: '📋 Outcome / Actions',
    options: ['New medication prescribed — see MAR','Medication stopped — see MAR','Medication dose changed — see MAR','Blood test arranged','X-ray / scan arranged','Referral made','Follow-up appointment booked','No action required','Admitted to hospital','Discharged home','Care plan review recommended','DNAR discussed','Capacity assessment recommended'],
  },
};

export const FAMILY_OPTS = {
  type: {
    label: '👨‍👩‍👧 Contact Type',
    options: ['Family visit in person','Telephone call from family','Video call (FaceTime / WhatsApp)','Email / letter received','Family meeting held','Social worker visit','Advocate visit','Legal representative visit'],
  },
  topics: {
    label: '💬 Topics Discussed',
    options: ['General welfare update','Health concerns discussed','Medication changes explained','Care plan reviewed together','End of life wishes discussed','Finances / funding discussed','Complaint raised by family','Positive feedback given','Request for information','Family updated on incident','Family updated on falls','Family updated on hospital visit'],
  },
  consent: {
    label: '✅ Consent / Agreements',
    options: ['Family happy with current care','Family agree to care plan changes','DNACPR discussed and agreed','DNAR form signed','Lasting Power of Attorney confirmed','Next of kin details updated','Family request noted in care plan'],
  },
};

export const EOL_OPTS = {
  care: {
    label: '🕊️ End of Life Care',
    options: ['Comfort measures in place','Syringe driver in situ — checked','Syringe driver prescribed — awaiting','Oral care given (mouth care)','Repositioned for comfort','Skin care — pressure relief','Eye care given','Catheter care given','Bowel management — suppository / enema','Oxygen in use','CPAP / BiPAP in use','Nil by mouth — comfort sips only'],
  },
  family: {
    label: '👨‍👩‍👧 Family & Support',
    options: ['Family present at bedside','Family called — coming in','Family updated by phone','Family unable to visit','Chaplain / spiritual care called','Bereavement support offered','Family staying overnight'],
  },
  clinical: {
    label: '🩺 Clinical',
    options: ['DNACPR in place and reviewed','Anticipatory medications prescribed','Syringe driver dose reviewed by nurse','GP / palliative team called','Comfort care plan reviewed','Pain assessed — comfortable','Pain assessed — PRN given','Agitation noted — PRN given','Breathing changes noted','Mottling observed — family informed','Cheyne-Stokes breathing noted'],
  },
};

export const HANDOVER_OPTS = {
  shift: {
    label: '🔁 Shift Summary',
    options: ['Quiet shift — no concerns','One or more residents to monitor','Falls this shift','Medication incidents this shift','Behavioural incidents this shift','Hospital admission this shift','GP called this shift','Family notified of concern','New resident admitted','Resident discharged / passed away'],
  },
  outstanding: {
    label: '📋 Outstanding Tasks',
    options: ['Medication awaiting — see MAR','Wound care due','Bowels not opened — needs monitoring','Referral pending','Awaiting GP call back','Family callback needed','Incident form to complete','Care plan review due','Equipment issue reported'],
  },
  handingTo: {
    label: '👋 Handing To',
    options: ['Day shift','Early shift','Late shift','Night shift','Bank staff — full handover given','Agency staff — care plans shared'],
  },
};

export const MOOD_OPTIONS = [
  { label: '😊 Happy',    value: 'Happy',    color: '#10b981' },
  { label: '😐 Neutral',  value: 'Neutral',  color: '#6b7280' },
  { label: '😔 Low',      value: 'Low',      color: '#3b82f6' },
  { label: '😠 Agitated', value: 'Agitated', color: '#ef4444' },
  { label: '😴 Drowsy',   value: 'Drowsy',   color: '#8b5cf6' },
  { label: '😕 Confused', value: 'Confused', color: '#d97706' },
  { label: '😢 Distressed',value:'Distressed',color:'#dc2626' },
  { label: '😌 Calm',     value: 'Calm',     color: '#059669' },
];

export const MEAL_TIMES = [
  { value: 'breakfast',     label: '🌅 Breakfast' },
  { value: 'morning_snack', label: '☕ Morning Snack' },
  { value: 'lunch',         label: '🍽 Lunch' },
  { value: 'afternoon_tea', label: '🫖 Afternoon Tea' },
  { value: 'supper',        label: '🌙 Supper' },
  { value: 'evening_snack', label: '🌛 Evening Snack' },
];

export const APPETITE_OPTIONS = [
  { value: 'full',    label: '✅ Excellent — ate all' },
  { value: 'most',    label: '👍 Good — ate most' },
  { value: 'half',    label: '🟡 Fair — ate half' },
  { value: 'little',  label: '⚠️ Poor — very little' },
  { value: 'refused', label: '❌ Refused meal' },
  { value: 'nbm',     label: '🚫 NBM' },
];

export const FOOD_PORTIONS = ['None','¼','½','¾','Full'];
export const FLUID_OPTIONS = ['100ml','150ml','200ml','250ml','300ml','400ml','500ml','600ml+'];
export const DRINK_OPTIONS = ['Water','Tea','Coffee','Juice','Squash','Milk','Thickened (Stage 1)','Thickened (Stage 2)','Thickened (Stage 3)','Fortisip','Ensure','Soup'];
export const TEXTURE_OPTIONS = ['Standard','IDDSI 6 – Soft & Bite-Sized','IDDSI 5 – Minced & Moist','IDDSI 4 – Puréed','IDDSI 3 – Liquidised'];
export const PAIN_OPTIONS = [0,1,2,3,4,5,6,7,8,9,10];
