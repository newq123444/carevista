// src/pages/dashboards/CarerDashboard.tsx
// Merged Task Board + Care Notes — one screen for carers
// Ad-hoc notes always available via "+ New Note" button
import React, { useState, useEffect, useCallback } from 'react';
import { useLang } from '../../i18n';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import {
  useDashboard, useResidents, useCreateNote, useColleagues,
  useTasks, useCompleteTask, useDeferTask, useStartTask, useReleaseTask, useGenerateTasks,
  useWellbeingOverview, useHome,
  useMenuAdmin, useCreateMealOrder,
} from '../../hooks';
import { useTaskSSE } from '../../hooks/useSSE';
import { formatAge, todayISO } from '../../utils/formatters';
import type { Resident } from '../../types';

// ── Task category → note type mapping ────────────────────────────────────
const BACKEND = (import.meta as any).env?.VITE_API_URL?.replace('/api','') || 'http://localhost:3001';
function residentPhoto(url?: string | null): string | null {
  if (!url) return null;
  return url.startsWith('http') ? url : BACKEND + url;
}

const TASK_TO_NOTE: Record<string,string> = {
  personal_care:  'personal_care',
  nutrition:      'nutrition',
  medication:     'nursing_observation',
  repositioning:  'repositioning',
  observation:    'nursing_observation',
  sleep:          'sleep',
};

// ── Task status config ────────────────────────────────────────────────────
const TASK_STATUS: Record<string,{bg:string;border:string;text:string;dot:string}> = {
  upcoming:    { bg:'#f8fafc', border:'#e2e8f0', text:'#64748b', dot:'#94a3b8' },
  due:         { bg:'#eff6ff', border:'#93c5fd', text:'#0d9488', dot:'#3b82f6' },
  in_progress: { bg:'#faf5ff', border:'#c4b5fd', text:'#7c3aed', dot:'#8b5cf6' },
  overdue:     { bg:'#fffbeb', border:'#fcd34d', text:'#d97706', dot:'#f59e0b' },
  missed:      { bg:'#fef2f2', border:'#fca5a5', text:'#dc2626', dot:'#ef4444' },
  done:        { bg:'#f0fdf4', border:'#86efac', text:'#15803d', dot:'#22c55e' },
  deferred:    { bg:'#f8fafc', border:'#cbd5e1', text:'#64748b', dot:'#94a3b8' },
};

// ── Clinical note type definitions ────────────────────────────────────────
const NOTE_TYPES = [
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

const PERSONAL_CARE_OPTS = {
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

const CONTINENCE_OPTS = {
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

const REPOSITIONING_OPTS = {
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

const SLEEP_OPTS = {
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

const BEHAVIOUR_OPTS = {
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


const WOUND_OPTS = {
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

const FALL_OPTS = {
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

const ACTIVITIES_OPTS = {
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

const GP_VISIT_OPTS = {
  type: {
    label: '🏥 Visit Type',
    options: ['GP home visit','GP telephone consultation','Nurse practitioner visit','District nurse visit','Outpatient appointment','A&E attendance','Hospital admission','Hospital discharge','Dentist visit','Optician visit','Podiatrist visit','Physiotherapy session','Occupational therapy assessment','SALT (speech & language) assessment','Dietitian review','Palliative care team visit','Mental health team visit'],
  },
  outcome: {
    label: '📋 Outcome / Actions',
    options: ['New medication prescribed — see MAR','Medication stopped — see MAR','Medication dose changed — see MAR','Blood test arranged','X-ray / scan arranged','Referral made','Follow-up appointment booked','No action required','Admitted to hospital','Discharged home','Care plan review recommended','DNAR discussed','Capacity assessment recommended'],
  },
};

const FAMILY_OPTS = {
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

const EOL_OPTS = {
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

const HANDOVER_OPTS = {
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

const MOOD_OPTIONS = [
  { label: '😊 Happy',    value: 'Happy',    color: '#10b981' },
  { label: '😐 Neutral',  value: 'Neutral',  color: '#6b7280' },
  { label: '😔 Low',      value: 'Low',      color: '#3b82f6' },
  { label: '😠 Agitated', value: 'Agitated', color: '#ef4444' },
  { label: '😴 Drowsy',   value: 'Drowsy',   color: '#8b5cf6' },
  { label: '😕 Confused', value: 'Confused', color: '#d97706' },
  { label: '😢 Distressed',value:'Distressed',color:'#dc2626' },
  { label: '😌 Calm',     value: 'Calm',     color: '#059669' },
];

const MEAL_TIMES = [
  { value: 'breakfast',     label: '🌅 Breakfast' },
  { value: 'morning_snack', label: '☕ Morning Snack' },
  { value: 'lunch',         label: '🍽 Lunch' },
  { value: 'afternoon_tea', label: '🫖 Afternoon Tea' },
  { value: 'supper',        label: '🌙 Supper' },
  { value: 'evening_snack', label: '🌛 Evening Snack' },
];

const APPETITE_OPTIONS = [
  { value: 'full',    label: '✅ Excellent — ate all' },
  { value: 'most',    label: '👍 Good — ate most' },
  { value: 'half',    label: '🟡 Fair — ate half' },
  { value: 'little',  label: '⚠️ Poor — very little' },
  { value: 'refused', label: '❌ Refused meal' },
  { value: 'nbm',     label: '🚫 NBM' },
];

const FOOD_PORTIONS = ['None','¼','½','¾','Full'];
const FLUID_OPTIONS = ['100ml','150ml','200ml','250ml','300ml','400ml','500ml','600ml+'];
const DRINK_OPTIONS = ['Water','Tea','Coffee','Juice','Squash','Milk','Thickened (Stage 1)','Thickened (Stage 2)','Thickened (Stage 3)','Fortisip','Ensure','Soup'];
const TEXTURE_OPTIONS = ['Standard','IDDSI 6 – Soft & Bite-Sized','IDDSI 5 – Minced & Moist','IDDSI 4 – Puréed','IDDSI 3 – Liquidised'];
const PAIN_OPTIONS = [0,1,2,3,4,5,6,7,8,9,10];

const ROLE_COLORS: Record<string, string> = {
  home_manager:'#7c3aed',deputy_manager:'#0d9488',registered_nurse:'#0891b2',
  senior_carer:'#059669',carer:'#d97706',activities:'#ec4899',finance:'#dc2626',
};

// ── Helper: multi-select chip group ──────────────────────────────────────
function ChipGroup({ label, options, selected, onToggle, color = '#0d9488' }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void; color?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(o => {
          const active = selected.includes(o);
          return (
            <button key={o} type="button" onClick={() => onToggle(o)} style={{
              padding: '5px 12px', borderRadius: 20, border: `1.5px solid ${active ? color : 'var(--border)'}`,
              background: active ? color + '10' : 'var(--surface-2)', color: active ? color : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 12, fontWeight: active ? 600 : 400, transition: 'all 100ms',
            }}>
              {active ? '✓ ' : ''}{o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────

// ── ClinicalForm — shared form used by both task-triggered and ad-hoc notes ──
interface ClinicalFormProps {
  resident: Resident;
  noteType: typeof NOTE_TYPES[0];
  task?: any;           // if triggered from a task chip
  onClose: () => void;
  onSaved?: () => void;
  isAdHoc?: boolean;
}

function ClinicalForm({ resident, noteType, task, onClose, onSaved, isAdHoc=false }: ClinicalFormProps) {
  const { t } = useLang();
  const { user } = useAuthStore();
  const { data: rawStaff = [] } = useColleagues();
  const staff: any[] = Array.isArray(rawStaff) ? rawStaff : [];
  const createNote    = useCreateNote();
  const completeTask  = useCompleteTask();
  const deferTask     = useDeferTask();
  const releaseTask   = useReleaseTask();
  const now           = new Date();
  const defaultMeal   = now.getHours() < 10 ? 'breakfast' : now.getHours() < 12 ? 'morning_snack' : now.getHours() < 14 ? 'lunch' : now.getHours() < 16 ? 'afternoon_tea' : now.getHours() < 20 ? 'supper' : 'evening_snack';

  const [mode, setMode]         = useState<'complete'|'defer'>('complete');
  const [deferReason, setDefer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [note, setNote]         = useState<any>({
    body:'', flagged:false, mood:'', pain:null,
    meal:defaultMeal, drinks:[], coAuthors:[],
    bathing:[], hair:[], shaving:[], nails:[], oral:[], skinCare:[], dressing:[],
    continenceMethod:[], urinary:[], bowels:[], catheter:[],
    repositionPosition:[], repositionEquip:[], repositionSkin:[], repositionFreq:[],
    sleepQuality:[], sleepHours:[], sleepIntervention:[],
    behaviourType:[], behaviourTrigger:[], behaviourIntervention:[],
    woundSite:[], woundType:[], woundGrade:[], woundDressing:[], woundCondition:[],
    fallWitnessed:[], fallLocation:[], fallInjuries:[], fallResponse:[],
    activityType:[], activityEngagement:[], activityMoodAfter:[],
    gpVisitType:[], gpOutcome:[], gpNotes:'',
    familyType:[], familyTopics:[], familyConsent:[],
    eolCare:[], eolFamily:[], eolClinical:[],
    handoverShift:[], handoverOutstanding:[], handoverTo:[],
  });

  const set = (k: string, v: any) => setNote((n:any) => ({...n, [k]: v}));
  const toggle = (field: string, val: string) => setNote((n:any) => {
    const arr: string[] = n[field] || [];
    return {...n, [field]: arr.includes(val) ? arr.filter((x:string)=>x!==val) : [...arr, val]};
  });

  // Release task lock if user navigates away
  useEffect(() => {
    return () => { if (task?.id) releaseTask.mutate(task.id); };
  }, [task?.id]);

  const buildContent = () => {
    const parts: string[] = [];
    if (note.mood) parts.push(`Mood: ${note.mood}.`);
    if (noteType.value === 'personal_care') {
      if (note.bathing?.length)  parts.push(`Bathing: ${note.bathing.join('; ')}.`);
      if (note.hair?.length)     parts.push(`Hair: ${note.hair.join('; ')}.`);
      if (note.shaving?.length)  parts.push(`Shaving: ${note.shaving.join('; ')}.`);
      if (note.nails?.length)    parts.push(`Nails: ${note.nails.join('; ')}.`);
      if (note.oral?.length)     parts.push(`Oral hygiene: ${note.oral.join('; ')}.`);
      if (note.skinCare?.length) parts.push(`Skin care: ${note.skinCare.join('; ')}.`);
      if (note.dressing?.length) parts.push(`Dressing: ${note.dressing.join('; ')}.`);
    }
    if (noteType.value === 'continence') {
      if (note.continenceMethod?.length) parts.push(`Toileting: ${note.continenceMethod.join('; ')}.`);
      if (note.urinary?.length)          parts.push(`Urinary: ${note.urinary.join('; ')}.`);
      if (note.bowels?.length)           parts.push(`Bowels: ${note.bowels.join('; ')}.`);
      if (note.catheter?.length)         parts.push(`Catheter: ${note.catheter.join('; ')}.`);
    }
    if (noteType.value === 'repositioning') {
      if (note.repositionPosition?.length) parts.push(`Position: ${note.repositionPosition.join('; ')}.`);
      if (note.repositionEquip?.length)    parts.push(`Equipment: ${note.repositionEquip.join('; ')}.`);
      if (note.repositionSkin?.length)     parts.push(`Skin check: ${note.repositionSkin.join('; ')}.`);
      if (note.repositionFreq?.length)     parts.push(`Next turn: ${note.repositionFreq.join('; ')}.`);
    }
    if (noteType.value === 'sleep') {
      if (note.sleepQuality?.length)      parts.push(`Sleep: ${note.sleepQuality.join('; ')}.`);
      if (note.sleepHours?.length)        parts.push(`Hours: ${note.sleepHours.join('; ')}.`);
      if (note.sleepIntervention?.length) parts.push(`Intervention: ${note.sleepIntervention.join('; ')}.`);
    }
    if (noteType.value === 'behaviour') {
      if (note.behaviourType?.length)         parts.push(`Behaviour: ${note.behaviourType.join('; ')}.`);
      if (note.behaviourTrigger?.length)      parts.push(`Trigger: ${note.behaviourTrigger.join('; ')}.`);
      if (note.behaviourIntervention?.length) parts.push(`Intervention: ${note.behaviourIntervention.join('; ')}.`);
    }
    if (noteType.value === 'nutrition') {
      if (note.appetite)       parts.push(`Appetite: ${note.appetite}.`);
      if (note.food)           parts.push(`Food intake: ${note.food}.`);
      if (note.fluidMl)        parts.push(`Fluid: ${note.fluidMl}.`);
      if (note.drinks?.length) parts.push(`Drinks: ${note.drinks.join(', ')}.`);
      if (note.texture)        parts.push(`Texture: ${note.texture}.`);
      if (note.mealConcerns)   parts.push(`⚠ Concern: ${note.mealConcerns}`);
    }
    if (noteType.value === 'wound_care') {
      if (note.woundSite?.length)      parts.push(`Site: ${note.woundSite.join('; ')}.`);
      if (note.woundType?.length)      parts.push(`Type: ${note.woundType.join('; ')}.`);
      if (note.woundGrade?.length)     parts.push(`Grade: ${note.woundGrade.join('; ')}.`);
      if (note.woundDressing?.length)  parts.push(`Dressing: ${note.woundDressing.join('; ')}.`);
      if (note.woundCondition?.length) parts.push(`Condition: ${note.woundCondition.join('; ')}.`);
    }
    if (noteType.value === 'fall_observation') {
      if (note.fallWitnessed?.length)  parts.push(`Witnessed: ${note.fallWitnessed.join('; ')}.`);
      if (note.fallLocation?.length)   parts.push(`Location: ${note.fallLocation.join('; ')}.`);
      if (note.fallInjuries?.length)   parts.push(`Injuries: ${note.fallInjuries.join('; ')}.`);
      if (note.fallResponse?.length)   parts.push(`Response: ${note.fallResponse.join('; ')}.`);
    }
    if (noteType.value === 'activities') {
      if (note.activityType?.length)       parts.push(`Activity: ${note.activityType.join('; ')}.`);
      if (note.activityEngagement?.length) parts.push(`Engagement: ${note.activityEngagement.join('; ')}.`);
      if (note.activityMoodAfter?.length)  parts.push(`Mood after: ${note.activityMoodAfter.join('; ')}.`);
    }
    if (noteType.value === 'gp_visit') {
      if (note.gpVisitType?.length) parts.push(`Visit: ${note.gpVisitType.join('; ')}.`);
      if (note.gpOutcome?.length)   parts.push(`Outcome: ${note.gpOutcome.join('; ')}.`);
      if (note.gpNotes?.trim())     parts.push(`Notes: ${note.gpNotes.trim()}.`);
    }
    if (noteType.value === 'family_update') {
      if (note.familyType?.length)    parts.push(`Contact: ${note.familyType.join('; ')}.`);
      if (note.familyTopics?.length)  parts.push(`Discussed: ${note.familyTopics.join('; ')}.`);
      if (note.familyConsent?.length) parts.push(`Agreed: ${note.familyConsent.join('; ')}.`);
    }
    if (noteType.value === 'end_of_life') {
      if (note.eolCare?.length)     parts.push(`Care: ${note.eolCare.join('; ')}.`);
      if (note.eolFamily?.length)   parts.push(`Family: ${note.eolFamily.join('; ')}.`);
      if (note.eolClinical?.length) parts.push(`Clinical: ${note.eolClinical.join('; ')}.`);
    }
    if (noteType.value === 'handover') {
      if (note.handoverShift?.length)       parts.push(`Shift: ${note.handoverShift.join('; ')}.`);
      if (note.handoverOutstanding?.length) parts.push(`Outstanding: ${note.handoverOutstanding.join('; ')}.`);
      if (note.handoverTo?.length)          parts.push(`Handing to: ${note.handoverTo.join('; ')}.`);
    }
    if (note.pain != null) parts.push(`Pain score: ${note.pain}/10.`);
    if (task) parts.push(`Task completed: ${task.task_name}.`);
    if (note.body?.trim()) parts.push(note.body.trim());
    return parts.join(' ') || 'Care provided — no concerns noted.';
  };

  const handleDefer = async () => {
    if (!deferReason.trim()) return;
    if (task?.id) {
      await deferTask.mutateAsync({ id: task.id, reason: deferReason });
    }
    onSaved?.();
    onClose();
  };

  const handleSubmit = async () => {
    const isMeal = noteType.value === 'nutrition';
    const mealContext = isMeal ? JSON.stringify({
      meal: note.meal || defaultMeal,
      time: now.toTimeString().slice(0,5),
      appetite: note.appetite || null,
      food_eaten_percent: note.food==='Full'?100:note.food==='¾'?75:note.food==='½'?50:note.food==='¼'?25:note.food==='None'?0:null,
      fluid_ml: note.fluidMl ? parseInt(note.fluidMl) : null,
      drinks: note.drinks?.join(', ') || null,
      texture_modified: note.texture || null,
      concerns: note.mealConcerns || null,
    }) : null;

    // Save care note
    await createNote.mutateAsync({
      residentId: resident.id,
      noteType: noteType.value,
      content: buildContent(),
      isSignificant: note.flagged || false,
      flagged: note.flagged || false,
      mood: note.mood || null,
      painScore: note.pain ?? null,
      mealContext,
    });

    // Mark task complete if triggered from task chip
    if (task?.id) {
      await completeTask.mutateAsync({ id: task.id, notes: buildContent().slice(0, 200) });
    }

    setSubmitted(true);
    setTimeout(() => { onSaved?.(); onClose(); }, 1500);
  };

  const isBusy = createNote.isPending || completeTask.isPending;

  if (submitted) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:40, gap:12 }}>
      <div style={{ fontSize:48 }}>✅</div>
      <div style={{ fontWeight:700, fontSize:16, color:'#15803d' }}>
        {task ? 'Task completed & note saved!' : 'Care note saved!'}
      </div>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Form header */}
      <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--surface-2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>{noteType.icon}</span>
          <div>
            <div style={{ fontWeight:600, fontSize:13, color:'var(--text-primary)' }}>{noteType.label}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>
              {resident.first_name} {resident.last_name} · Rm {resident.room_number}
              {isAdHoc && <span style={{ marginLeft:6, fontSize:10, background:'#fef3c7', color:'#d97706', padding:'1px 6px', borderRadius:8, fontWeight:700 }}>AD-HOC</span>}
              {task && <span style={{ marginLeft:6, fontSize:10, background:noteType.color+'20', color:noteType.color, padding:'1px 6px', borderRadius:8, fontWeight:700 }}>TASK</span>}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:20, lineHeight:1 }}>×</button>
      </div>

      {/* Scrollable form body */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:0, minHeight:0 }}>

        {/* Mood selector */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', display:'block', marginBottom:6, textTransform:'uppercase', letterSpacing:'.05em' }}>Resident Mood</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {MOOD_OPTIONS.map(m => {
              const active = note.mood === m.value;
              return <button key={m.value} type="button" onClick={() => set('mood', active ? '' : m.value)} style={{ padding:'7px 12px', borderRadius:20, border:`2px solid ${active ? m.color : 'var(--border)'}`, background:active ? m.color+'18' : 'white', color:active ? m.color : 'var(--text-secondary)', cursor:'pointer', fontSize:12, fontWeight:active?700:400, transition:'all 120ms' }}>{m.label}</button>;
            })}
          </div>
        </div>
            {/* ── PERSONAL CARE ──────────────────────────────────── */}
            {noteType.value === 'personal_care' && (
              <div style={{ background: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#0d9488', marginBottom: 12 }}>🛁 Personal Care Record</div>
                <ChipGroup label={PERSONAL_CARE_OPTS.bathing.label} options={PERSONAL_CARE_OPTS.bathing.options} selected={note.bathing||[]} onToggle={v=>toggle('bathing',v)} color="#3b82f6" />
                <ChipGroup label={PERSONAL_CARE_OPTS.hair.label} options={PERSONAL_CARE_OPTS.hair.options} selected={note.hair||[]} onToggle={v=>toggle('hair',v)} color="#3b82f6" />
                <ChipGroup label={PERSONAL_CARE_OPTS.shaving.label} options={PERSONAL_CARE_OPTS.shaving.options} selected={note.shaving||[]} onToggle={v=>toggle('shaving',v)} color="#3b82f6" />
                <ChipGroup label={PERSONAL_CARE_OPTS.oral.label} options={PERSONAL_CARE_OPTS.oral.options} selected={note.oral||[]} onToggle={v=>toggle('oral',v)} color="#3b82f6" />
                <ChipGroup label={PERSONAL_CARE_OPTS.skinCare.label} options={PERSONAL_CARE_OPTS.skinCare.options} selected={note.skinCare||[]} onToggle={v=>toggle('skinCare',v)} color="#3b82f6" />
                <ChipGroup label={PERSONAL_CARE_OPTS.dressing.label} options={PERSONAL_CARE_OPTS.dressing.options} selected={note.dressing||[]} onToggle={v=>toggle('dressing',v)} color="#3b82f6" />
                <ChipGroup label={PERSONAL_CARE_OPTS.nails.label} options={PERSONAL_CARE_OPTS.nails.options} selected={note.nails||[]} onToggle={v=>toggle('nails',v)} color="#3b82f6" />
              </div>
            )}

            {/* ── CONTINENCE ─────────────────────────────────────── */}
            {noteType.value === 'continence' && (
              <div style={{ background: '#f5f3ff', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#6d28d9', marginBottom: 12 }}>🚽 Continence & Toileting Record</div>
                <ChipGroup label={CONTINENCE_OPTS.method.label} options={CONTINENCE_OPTS.method.options} selected={note.continenceMethod||[]} onToggle={v=>toggle('continenceMethod',v)} color="#8b5cf6" />
                <ChipGroup label={CONTINENCE_OPTS.urinary.label} options={CONTINENCE_OPTS.urinary.options} selected={note.urinary||[]} onToggle={v=>toggle('urinary',v)} color="#8b5cf6" />
                <ChipGroup label={CONTINENCE_OPTS.bowels.label} options={CONTINENCE_OPTS.bowels.options} selected={note.bowels||[]} onToggle={v=>toggle('bowels',v)} color="#8b5cf6" />
                {(note.continenceMethod||[]).some((v: string) => v.toLowerCase().includes('catheter')) && (
                  <ChipGroup label={CONTINENCE_OPTS.catheter.label} options={CONTINENCE_OPTS.catheter.options} selected={note.catheter||[]} onToggle={v=>toggle('catheter',v)} color="#8b5cf6" />
                )}
              </div>
            )}

            {/* ── REPOSITIONING ──────────────────────────────────── */}
            {noteType.value === 'repositioning' && (
              <div style={{ background: '#fffbeb', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#b45309', marginBottom: 12 }}>🔄 Repositioning Record</div>
                <ChipGroup label={REPOSITIONING_OPTS.position.label} options={REPOSITIONING_OPTS.position.options} selected={note.repositionPosition||[]} onToggle={v=>toggle('repositionPosition',v)} color="#f59e0b" />
                <ChipGroup label={REPOSITIONING_OPTS.equipment.label} options={REPOSITIONING_OPTS.equipment.options} selected={note.repositionEquip||[]} onToggle={v=>toggle('repositionEquip',v)} color="#f59e0b" />
                <ChipGroup label={REPOSITIONING_OPTS.skin.label} options={REPOSITIONING_OPTS.skin.options} selected={note.repositionSkin||[]} onToggle={v=>toggle('repositionSkin',v)} color="#f59e0b" />
                <ChipGroup label={REPOSITIONING_OPTS.frequency.label} options={REPOSITIONING_OPTS.frequency.options} selected={note.repositionFreq||[]} onToggle={v=>toggle('repositionFreq',v)} color="#f59e0b" />
              </div>
            )}

            {/* ── SLEEP ──────────────────────────────────────────── */}
            {noteType.value === 'sleep' && (
              <div style={{ background: '#f5f3ff', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#6d28d9', marginBottom: 12 }}>😴 Sleep Record</div>
                <ChipGroup label={SLEEP_OPTS.quality.label} options={SLEEP_OPTS.quality.options} selected={note.sleepQuality||[]} onToggle={v=>toggle('sleepQuality',v)} color="#8b5cf6" />
                <ChipGroup label={SLEEP_OPTS.hours.label} options={SLEEP_OPTS.hours.options} selected={note.sleepHours||[]} onToggle={v=>toggle('sleepHours',v)} color="#8b5cf6" />
                <ChipGroup label={SLEEP_OPTS.intervention.label} options={SLEEP_OPTS.intervention.options} selected={note.sleepIntervention||[]} onToggle={v=>toggle('sleepIntervention',v)} color="#8b5cf6" />
              </div>
            )}

            {/* ── BEHAVIOUR ──────────────────────────────────────── */}
            {noteType.value === 'behaviour' && (
              <div style={{ background: '#fef2f2', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#dc2626', marginBottom: 12 }}>📌 Behaviour Record</div>
                <ChipGroup label={BEHAVIOUR_OPTS.type.label} options={BEHAVIOUR_OPTS.type.options} selected={note.behaviourType||[]} onToggle={v=>toggle('behaviourType',v)} color="#ef4444" />
                <ChipGroup label={BEHAVIOUR_OPTS.trigger.label} options={BEHAVIOUR_OPTS.trigger.options} selected={note.behaviourTrigger||[]} onToggle={v=>toggle('behaviourTrigger',v)} color="#ef4444" />
                <ChipGroup label={BEHAVIOUR_OPTS.intervention.label} options={BEHAVIOUR_OPTS.intervention.options} selected={note.behaviourIntervention||[]} onToggle={v=>toggle('behaviourIntervention',v)} color="#ef4444" />
              </div>
            )}

            {/* ── NUTRITION ──────────────────────────────────────── */}
            {noteType.value === 'nutrition' && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#15803d', marginBottom: 12 }}>🍽 Meal Record</div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Which Meal?</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {MEAL_TIMES.map(m => { const active=(note.meal||defaultMeal)===m.value; return <button key={m.value} onClick={()=>set('meal',m.value)} style={{ padding:'7px 14px',borderRadius:20,border:`2px solid ${active?'#10b981':'var(--border)'}`,background:active?'#f0fdf4':'white',color:active?'#15803d':'var(--text-secondary)',cursor:'pointer',fontSize:13,fontWeight:active?700:400,transition:'all 120ms' }}>{m.label}</button>; })}
                  </div>
                </div>
                <MealChoiceToKitchen residentId={resident.id} meal={note.meal || defaultMeal} />
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('Appetite')}</label>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {APPETITE_OPTIONS.map(a => { const active=note.appetite===a.value; return <button key={a.value} onClick={()=>set('appetite',active?'':a.value)} style={{ padding:'8px 14px',borderRadius:20,border:`2px solid ${active?'#10b981':'var(--border)'}`,background:active?'#dcfce7':'white',color:active?'#15803d':'var(--text-secondary)',cursor:'pointer',fontSize:13,fontWeight:active?700:400,transition:'all 120ms' }}>{a.label}</button>; })}
                  </div>
                </div>
                <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:14 }}>
                  <div>
                    <label style={{ fontSize:11,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em' }}>Food Intake</label>
                    <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                      {FOOD_PORTIONS.map(f => { const active=note.food===f; return <button key={f} onClick={()=>set('food',active?'':f)} style={{ padding:'8px 14px',borderRadius:8,border:`2px solid ${active?'#10b981':'var(--border)'}`,background:active?'#f0fdf4':'white',cursor:'pointer',fontSize:13,fontWeight:active?700:400,color:active?'#16a34a':'var(--text-secondary)',transition:'all 120ms' }}>{f}</button>; })}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:11,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em' }}>Fluid Intake</label>
                    <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                      {FLUID_OPTIONS.map(f => { const active=note.fluidMl===f; return <button key={f} onClick={()=>set('fluidMl',active?'':f)} style={{ padding:'8px 12px',borderRadius:8,border:`2px solid ${active?'#06b6d4':'var(--border)'}`,background:active?'#ecfeff':'white',cursor:'pointer',fontSize:12,fontWeight:active?700:400,color:active?'#0891b2':'var(--text-secondary)',transition:'all 120ms' }}>{f}</button>; })}
                    </div>
                  </div>
                </div>
                <ChipGroup label="Drinks Offered" options={DRINK_OPTIONS} selected={note.drinks||[]} onToggle={v=>toggle('drinks',v)} color="#06b6d4" />
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize:11,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em' }}>Texture Modified?</label>
                  <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
                    {TEXTURE_OPTIONS.map(t => { const active=note.texture===t; return <button key={t} onClick={()=>set('texture',active?'':t)} style={{ padding:'7px 14px',borderRadius:20,border:`2px solid ${active?'#10b981':'var(--border)'}`,background:active?'#dcfce7':'white',color:active?'#15803d':'var(--text-secondary)',cursor:'pointer',fontSize:12,fontWeight:active?700:400,transition:'all 120ms' }}>{t}</button>; })}
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize:11,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.05em' }}>What They Ate</label>
                  <input value={note.foodDescription||''} onChange={e=>set('foodDescription',e.target.value)} placeholder="e.g. Shepherd's pie, mashed potato, peas — soft diet" style={{ width:'100%',padding:'10px 14px',borderRadius:8,border:'1px solid #86efac',fontSize:13,background:'white',boxSizing:'border-box',fontFamily:'inherit' }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize:11,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.05em' }}>Food Preferences Noted</label>
                  <input value={note.preferences||''} onChange={e=>set('preferences',e.target.value)} placeholder="e.g. Enjoys porridge, dislikes fish, likes sweet tea" style={{ width:'100%',padding:'10px 14px',borderRadius:8,border:'1px solid #86efac',fontSize:13,background:'white',boxSizing:'border-box',fontFamily:'inherit' }} />
                </div>
                <div>
                  <label style={{ fontSize:11,fontWeight:700,color:'#dc2626',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.05em' }}>⚠ Meal Concerns</label>
                  <input value={note.mealConcerns||''} onChange={e=>set('mealConcerns',e.target.value)} placeholder="e.g. Coughing, aspiration signs, SALT referral needed" style={{ width:'100%',padding:'10px 14px',borderRadius:8,border:`1px solid ${note.mealConcerns?'#fca5a5':'#86efac'}`,fontSize:13,background:note.mealConcerns?'#fef2f2':'white',boxSizing:'border-box',fontFamily:'inherit' }} />
                </div>
              </div>
            )}

            {/* ── WOUND CARE ───────────────────────────────────────── */}
            {noteType.value === 'wound_care' && (
              <div style={{ background:'#fef2f2',borderRadius:12,padding:16,marginBottom:14 }}>
                <div style={{ fontWeight:800,fontSize:13,color:'#dc2626',marginBottom:12 }}>🩹 Wound Care Record</div>
                <ChipGroup label={WOUND_OPTS.site.label} options={WOUND_OPTS.site.options} selected={note.woundSite||[]} onToggle={v=>toggle('woundSite',v)} color="#dc2626" />
                <ChipGroup label={WOUND_OPTS.type.label} options={WOUND_OPTS.type.options} selected={note.woundType||[]} onToggle={v=>toggle('woundType',v)} color="#dc2626" />
                {(note.woundType||[]).some((v:string)=>v.toLowerCase().includes('pressure')) && (
                  <ChipGroup label={WOUND_OPTS.grade.label} options={WOUND_OPTS.grade.options} selected={note.woundGrade||[]} onToggle={v=>toggle('woundGrade',v)} color="#dc2626" />
                )}
                <ChipGroup label={WOUND_OPTS.dressing.label} options={WOUND_OPTS.dressing.options} selected={note.woundDressing||[]} onToggle={v=>toggle('woundDressing',v)} color="#dc2626" />
                <ChipGroup label={WOUND_OPTS.condition.label} options={WOUND_OPTS.condition.options} selected={note.woundCondition||[]} onToggle={v=>toggle('woundCondition',v)} color="#dc2626" />
              </div>
            )}

            {/* ── FALL OBSERVATION ─────────────────────────────────── */}
            {noteType.value === 'fall_observation' && (
              <div style={{ background:'#fff7ed',borderRadius:12,padding:16,marginBottom:14,border:'2px solid #fed7aa' }}>
                <div style={{ fontWeight:800,fontSize:13,color:'#c2410c',marginBottom:12 }}>⚠️ Fall / Post-Fall Observation Record</div>
                <div style={{ padding:'10px 12px',borderRadius:8,background:'#fef2f2',border:'1px solid #fecaca',marginBottom:12,fontSize:12,color:'#dc2626',fontWeight:600 }}>
                  ⚠ Complete an Incident Report as well — this note captures clinical observations
                </div>
                <ChipGroup label={FALL_OPTS.witnessed.label} options={FALL_OPTS.witnessed.options} selected={note.fallWitnessed||[]} onToggle={v=>toggle('fallWitnessed',v)} color="#f97316" />
                <ChipGroup label={FALL_OPTS.location.label} options={FALL_OPTS.location.options} selected={note.fallLocation||[]} onToggle={v=>toggle('fallLocation',v)} color="#f97316" />
                <ChipGroup label={FALL_OPTS.injuries.label} options={FALL_OPTS.injuries.options} selected={note.fallInjuries||[]} onToggle={v=>toggle('fallInjuries',v)} color="#f97316" />
                <ChipGroup label={FALL_OPTS.response.label} options={FALL_OPTS.response.options} selected={note.fallResponse||[]} onToggle={v=>toggle('fallResponse',v)} color="#f97316" />
              </div>
            )}

            {/* ── ACTIVITIES ───────────────────────────────────────── */}
            {noteType.value === 'activities' && (
              <div style={{ background:'#faf5ff',borderRadius:12,padding:16,marginBottom:14 }}>
                <div style={{ fontWeight:800,fontSize:13,color:'#7e22ce',marginBottom:12 }}>🎯 Activity Record</div>
                <ChipGroup label={ACTIVITIES_OPTS.type.label} options={ACTIVITIES_OPTS.type.options} selected={note.activityType||[]} onToggle={v=>toggle('activityType',v)} color="#a855f7" />
                <ChipGroup label={ACTIVITIES_OPTS.engagement.label} options={ACTIVITIES_OPTS.engagement.options} selected={note.activityEngagement||[]} onToggle={v=>toggle('activityEngagement',v)} color="#a855f7" />
                <ChipGroup label={ACTIVITIES_OPTS.moodAfter.label} options={ACTIVITIES_OPTS.moodAfter.options} selected={note.activityMoodAfter||[]} onToggle={v=>toggle('activityMoodAfter',v)} color="#a855f7" />
              </div>
            )}

            {/* ── GP / HOSPITAL VISIT ──────────────────────────────── */}
            {noteType.value === 'gp_visit' && (
              <div style={{ background:'#ecfeff',borderRadius:12,padding:16,marginBottom:14 }}>
                <div style={{ fontWeight:800,fontSize:13,color:'#0e7490',marginBottom:12 }}>🏥 GP / Clinical Visit Record</div>
                <ChipGroup label={GP_VISIT_OPTS.type.label} options={GP_VISIT_OPTS.type.options} selected={note.gpVisitType||[]} onToggle={v=>toggle('gpVisitType',v)} color="#0891b2" />
                <ChipGroup label={GP_VISIT_OPTS.outcome.label} options={GP_VISIT_OPTS.outcome.options} selected={note.gpOutcome||[]} onToggle={v=>toggle('gpOutcome',v)} color="#0891b2" />
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:11,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:'.05em' }}>Clinician Name / Notes</label>
                  <input value={note.gpNotes||''} onChange={e=>set('gpNotes',e.target.value)} placeholder="e.g. Dr Patel reviewed — new prescription for Amoxicillin 500mg" style={{ width:'100%',padding:'10px 14px',borderRadius:8,border:'1px solid #a5f3fc',fontSize:13,background:'white',boxSizing:'border-box',fontFamily:'inherit' }} />
                </div>
              </div>
            )}

            {/* ── FAMILY UPDATE ────────────────────────────────────── */}
            {noteType.value === 'family_update' && (
              <div style={{ background:'#f0fdf4',borderRadius:12,padding:16,marginBottom:14 }}>
                <div style={{ fontWeight:800,fontSize:13,color:'#15803d',marginBottom:12 }}>👨‍👩‍👧 Family Communication Record</div>
                <ChipGroup label={FAMILY_OPTS.type.label} options={FAMILY_OPTS.type.options} selected={note.familyType||[]} onToggle={v=>toggle('familyType',v)} color="#059669" />
                <ChipGroup label={FAMILY_OPTS.topics.label} options={FAMILY_OPTS.topics.options} selected={note.familyTopics||[]} onToggle={v=>toggle('familyTopics',v)} color="#059669" />
                <ChipGroup label={FAMILY_OPTS.consent.label} options={FAMILY_OPTS.consent.options} selected={note.familyConsent||[]} onToggle={v=>toggle('familyConsent',v)} color="#059669" />
              </div>
            )}

            {/* ── END OF LIFE ──────────────────────────────────────── */}
            {noteType.value === 'end_of_life' && (
              <div style={{ background:'#f8fafc',borderRadius:12,padding:16,marginBottom:14,border:'2px solid #e2e8f0' }}>
                <div style={{ fontWeight:800,fontSize:13,color:'#374151',marginBottom:4 }}>🕊️ End of Life Care Record</div>
                <div style={{ fontSize:12,color:'var(--text-muted)',marginBottom:12 }}>This note is handled with the utmost care and privacy.</div>
                <ChipGroup label={EOL_OPTS.care.label} options={EOL_OPTS.care.options} selected={note.eolCare||[]} onToggle={v=>toggle('eolCare',v)} color="#6b7280" />
                <ChipGroup label={EOL_OPTS.family.label} options={EOL_OPTS.family.options} selected={note.eolFamily||[]} onToggle={v=>toggle('eolFamily',v)} color="#6b7280" />
                <ChipGroup label={EOL_OPTS.clinical.label} options={EOL_OPTS.clinical.options} selected={note.eolClinical||[]} onToggle={v=>toggle('eolClinical',v)} color="#6b7280" />
              </div>
            )}

            {/* ── HANDOVER NOTE ────────────────────────────────────── */}
            {noteType.value === 'handover' && (
              <div style={{ background:'#eff6ff',borderRadius:12,padding:16,marginBottom:14 }}>
                <div style={{ fontWeight:800,fontSize:13,color:'#0d9488',marginBottom:12 }}>🔁 Shift Handover Record</div>
                <ChipGroup label={HANDOVER_OPTS.shift.label} options={HANDOVER_OPTS.shift.options} selected={note.handoverShift||[]} onToggle={v=>toggle('handoverShift',v)} color="#0d9488" />
                <ChipGroup label={HANDOVER_OPTS.outstanding.label} options={HANDOVER_OPTS.outstanding.options} selected={note.handoverOutstanding||[]} onToggle={v=>toggle('handoverOutstanding',v)} color="#0d9488" />
                <ChipGroup label={HANDOVER_OPTS.handingTo.label} options={HANDOVER_OPTS.handingTo.options} selected={note.handoverTo||[]} onToggle={v=>toggle('handoverTo',v)} color="#0d9488" />
              </div>
            )}

            {/* Pain score */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize:11,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em' }}>Pain Score {note.pain!=null?`— ${note.pain}/10`:'(optional)'}</label>
              <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
                {PAIN_OPTIONS.map(p => { const pc=p===0?'#10b981':p<=3?'#84cc16':p<=6?'f59e0b':'#ef4444'; const active=note.pain===p; return <button key={p} onClick={()=>set('pain',active?null:p)} style={{ width:34,height:34,borderRadius:8,border:`2px solid ${active?pc:'var(--border)'}`,background:active?pc+'20':'white',cursor:'pointer',fontSize:13,fontWeight:700,color:active?pc:'var(--text-muted)',transition:'all 120ms' }}>{p}</button>; })}
              </div>
              <div style={{ fontSize:11,color:'var(--text-muted)',marginTop:4 }}>0 = No pain · 10 = Worst pain</div>
            </div>

            {/* Additional notes */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize:11,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.05em' }}>Additional Notes</label>
              <textarea rows={3} value={note.body||''} onChange={e=>set('body',e.target.value)}
                placeholder={`Any additional observations for ${resident.first_name}…`}
                style={{ width:'100%',padding:'12px 14px',borderRadius:10,border:'1px solid var(--border)',fontSize:14,resize:'vertical',fontFamily:'inherit',background:'var(--surface-2)',boxSizing:'border-box',outline:'none' }} />
            </div>

            {/* Co-authoring */}
            <details style={{ border:'1px solid var(--border)',borderRadius:10,padding:'10px 14px',marginBottom:14 }}>
              <summary style={{ cursor:'pointer',fontSize:13,fontWeight:600,color:'var(--text-secondary)',userSelect:'none' }}>✍ Authorship options</summary>
              <div style={{ marginTop:12 }}>
                <label style={{ fontSize:11,fontWeight:700,color:'var(--text-secondary)',display:'block',marginBottom:4,textTransform:'uppercase' }}>Writing on behalf of</label>
                <select value={note.writtenOnBehalfOf||''} onChange={e=>set('writtenOnBehalfOf',e.target.value)} style={{ width:'100%',padding:'9px 12px',borderRadius:8,border:'1px solid var(--border)',fontSize:13,background:'white',fontFamily:'inherit' }}>
                  <option value="">— Writing as myself —</option>
                  {staff.map((s:any)=><option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.job_title||s.role?.replace(/_/g,' ')})</option>)}
                </select>
              </div>
            </details>

            {/* Flag toggle */}
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderRadius:10,background:note.flagged?'#fef2f2':'var(--surface-2)',border:`1px solid ${note.flagged?'#fecaca':'var(--border)'}`,cursor:'pointer',marginBottom:14 }}
              onClick={()=>set('flagged',!note.flagged)}>
              <div>
                <div style={{ fontSize:14,fontWeight:700,color:note.flagged?'#dc2626':'var(--text-primary)' }}>🚩 Flag for senior/manager review</div>
                <div style={{ fontSize:12,color:'var(--text-muted)' }}>Mark if this needs immediate follow-up</div>
              </div>
              <div style={{ width:48,height:26,borderRadius:13,background:note.flagged?'#dc2626':'#e5e7eb',position:'relative',flexShrink:0 }}>
                <div style={{ position:'absolute',top:3,left:note.flagged?25:3,width:20,height:20,borderRadius:'50%',background:'white',transition:'left 200ms',boxShadow:'0 1px 3px rgba(0,0,0,.2)' }} />
              </div>
            </div>

            {/* Signature notice */}
            <div style={{ fontSize:12,color:'var(--text-muted)',borderTop:'1px dashed var(--border)',paddingTop:10,marginBottom:14 }}>
              ✍ By saving, you confirm this note is accurate and was recorded by you{note.writtenOnBehalfOf?' on behalf of the named carer':''}.
            </div>



        {/* Defer option for tasks */}
        {task && mode === 'complete' && (
          <button type="button" onClick={() => setMode('defer')} style={{ width:'100%', padding:'10px', borderRadius:10, border:'1px solid #fcd34d', background:'#fffbeb', color:'#d97706', fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:10 }}>
            ↩️ Defer this task instead
          </button>
        )}

        {mode === 'defer' && task && (
          <div style={{ background:'#fffbeb', borderRadius:12, padding:14, marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:'#d97706', marginBottom:10 }}>↩️ Defer Reason</div>
            {['Resident asleep — will complete shortly','Resident unwell — reviewed by nurse','Resident refused','Staff shortage — escalated','Resident at appointment','Not applicable today'].map(r => (
              <button key={r} type="button" onClick={() => setDefer(r)} style={{ display:'block', width:'100%', padding:'8px 12px', marginBottom:6, borderRadius:8, textAlign:'left', border:`1px solid ${deferReason===r?'#d97706':'var(--border)'}`, background:deferReason===r?'#fffbeb':'white', color:deferReason===r?'#d97706':'var(--text-secondary)', cursor:'pointer', fontSize:13, fontWeight:deferReason===r?700:400 }}>{r}</button>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button type="button" onClick={handleDefer} disabled={!deferReason.trim()||deferTask.isPending} className="btn btn-primary" style={{ flex:1, background:'#d97706', borderColor:'#d97706' }}>{deferTask.isPending?'Deferring…':'↩️ Confirm Defer'}</button>
              <button type="button" onClick={() => setMode('complete')} className="btn btn-secondary" style={{ flex:1 }}>{t('Back')}</button>
            </div>
          </div>
        )}

        {mode === 'complete' && (
          <>
            <div style={{ fontSize:11, color:'var(--text-muted)', borderTop:'1px dashed var(--border)', paddingTop:10, marginBottom:12 }}>
              ✍ {user?.firstName} {user?.lastName} · {now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
              {task && ' — completing task & saving note'}
            </div>
            <button type="button" onClick={handleSubmit} disabled={isBusy} style={{ width:'100%', padding:'14px', borderRadius:12, border:'none', background:isBusy?'#93c5fd':`linear-gradient(135deg,${noteType.color},${noteType.color}cc)`, color:'white', fontSize:15, fontWeight:800, cursor:isBusy?'not-allowed':'pointer', boxShadow:`0 4px 16px ${noteType.color}40` }}>
              {isBusy ? '⏳ Saving…' : task ? `✅ Complete Task & Save Note` : `✅ Sign & Save ${noteType.label} Note`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Wellbeing Alert Widget ─────────────────────────────────────────────────
function WellbeingAlertWidget({ residents }: { residents: Resident[] }) {
  const { data: overview } = useWellbeingOverview();
  const needsAttention = overview?.needsAttention || [];

  if (needsAttention.length === 0) return null;

  const MOOD_EMOJI: Record<string, string> = { very_low: '😢', low: '😔', neutral: '😐', happy: '😊', very_happy: '😄' };

  return (
    <div style={{ background: '#fef9f0', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#9a3412' }}>💚 Wellbeing Concerns Today</span>
        <Link to="/wellbeing" style={{ fontSize: 11, color: '#0d9488', fontWeight: 600, textDecoration: 'none' }}>View Hub →</Link>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {needsAttention.slice(0, 4).map((r: any) => (
          <Link key={r.id} to={`/residents/${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: 'white', border: '1px solid #fed7aa', textDecoration: 'none', color: 'inherit', fontSize: 12 }}>
            <span>{MOOD_EMOJI[r.mood] || '😐'}</span>
            <span style={{ fontWeight: 600 }}>{r.first_name}</span>
            <span style={{ color: 'var(--text-muted)' }}>Rm {r.room_number}</span>
            {r.pain_level != null && r.pain_level >= 7 && (
              <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>Pain {r.pain_level}</span>
            )}
          </Link>
        ))}
        {needsAttention.length > 4 && (
          <span style={{ fontSize: 11, color: '#9a3412', alignSelf: 'center' }}>+{needsAttention.length - 4} more</span>
        )}
      </div>
    </div>
  );
}

// ── Main CarerDashboard ───────────────────────────────────────────────────
export default function CarerDashboard() {
  const { t } = useLang();
  const { user }            = useAuthStore();
  const { data: dashData }  = useDashboard();
  const { data: rawResidents = [] } = useResidents({ active: true });
  const residents: Resident[] = Array.isArray(rawResidents) ? rawResidents : (rawResidents as any)?.residents ?? [];
  const genTasks            = useGenerateTasks();

  const [now, setNow]       = useState(new Date());
  const [search, setSearch] = useState('');
  const [date]              = useState(todayISO());

  // View mode: grid (photo cards) or list (original task list)
  const [viewMode, setViewMode] = useState<'grid'|'list'>('grid');
  // Selected resident for grid view detail panel
  const [gridSelectedResident, setGridSelectedResident] = useState<Resident|null>(null);

  // Active form state
  const [activeResident, setResident]     = useState<Resident|null>(null);
  const [activeNoteType, setNoteType]     = useState<typeof NOTE_TYPES[0]|null>(null);
  const [activeTask, setTask]             = useState<any>(null);
  const [isAdHoc, setIsAdHoc]             = useState(false);
  const [isMobile, setIsMobile]           = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet]           = useState(window.innerWidth >= 768 && window.innerWidth < 1024);

  // Track viewport width for mobile overlay
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startTask = useStartTask();
  const { data: homeCfg } = useHome();
  useTaskSSE();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const { data: rawTasks = [], isLoading: tasksLoading, refetch } = useTasks({ date });
  const tasks: any[] = Array.isArray(rawTasks) ? rawTasks : [];

  // Auto-generate tasks if empty
  const hasAutoGen = React.useRef(false);
  useEffect(() => {
    if (!tasksLoading && tasks.length === 0 && !hasAutoGen.current) {
      hasAutoGen.current = true;
      genTasks.mutate(date, { onSuccess: () => refetch() });
    }
  }, [tasksLoading, tasks.length]);

  // Group tasks by resident
  const byResident: Record<string, any[]> = {};
  for (const t of tasks) {
    if (!byResident[t.resident_id]) byResident[t.resident_id] = [];
    byResident[t.resident_id].push(t);
  }

  const hour = now.getHours();
  const _h = (v: string, d: number) => { const n = parseInt((v || '').split(':')[0]); return isNaN(n) ? d : n; };
  const dayStart = _h(homeCfg?.settings?.day_start, 7), eveStart = _h(homeCfg?.settings?.evening_start, 15), nightStart = _h(homeCfg?.settings?.night_start, 22);
  const shift = hour >= dayStart && hour < eveStart ? 'Day' : hour >= eveStart && hour < nightStart ? 'Evening' : 'Night';
  const shiftColor = shift === 'Day' ? '#f59e0b' : shift === 'Evening' ? '#8b5cf6' : '#0f766e';
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const filteredResidentIds = Object.keys(byResident).filter(rid => {
    if (!search) return true;
    const t = byResident[rid][0];
    return `${t.resident_name} ${t.room_number}`.toLowerCase().includes(search.toLowerCase());
  });

  // When a task chip is tapped
  const handleTaskTap = (task: any) => {
    if (task.status === 'done' || task.status === 'deferred') return;
    const r = residents.find(res => res.id === task.resident_id);
    if (!r) return;
    const mapped = TASK_TO_NOTE[task.category] || 'nursing_observation';
    const nt = NOTE_TYPES.find(n => n.value === mapped) || NOTE_TYPES[0];
    startTask.mutate(task.id);
    setTask(task);
    setResident(r);
    setNoteType(nt);
    setIsAdHoc(false);
  };

  // Ad-hoc note — no task attached
  const handleAdHoc = (r: Resident, nt?: typeof NOTE_TYPES[0]) => {
    setTask(null);
    setResident(r);
    setNoteType(nt || null);
    setIsAdHoc(true);
  };

  const closeForm = () => {
    setResident(null);
    setNoteType(null);
    setTask(null);
    setIsAdHoc(false);
  };

  // Grid view: compute columns and card border color
  const gridCols = isMobile ? 3 : isTablet ? 4 : 4;
  const getCardBorderColor = (residentTasks: any[]) => {
    if (!residentTasks || residentTasks.length === 0) return '#e2e8f0';
    const done = residentTasks.filter((t: any) => t.status === 'done' || t.status === 'deferred').length;
    const hasMissed = residentTasks.some((t: any) => t.status === 'missed');
    const hasOverdue = residentTasks.some((t: any) => t.status === 'overdue');
    if (hasMissed) return '#ef4444';
    if (hasOverdue) return '#f59e0b';
    if (done === residentTasks.length) return '#22c55e';
    if (done > 0) return '#3b82f6';
    return '#e2e8f0';
  };

  // Grid view: handle card tap
  const handleGridCardTap = (r: Resident) => {
    if (isMobile) {
      setGridSelectedResident(r);
    } else {
      setGridSelectedResident(r);
    }
  };

  const closeGridPanel = () => {
    setGridSelectedResident(null);
  };

  // Get mood emoji from wellbeing overview
  const { data: wellbeingOverview } = useWellbeingOverview();
  const getMoodEmoji = (residentId: string): string | null => {
    const MOOD_EMOJI_MAP: Record<string, string> = { 
      very_low: '😢', low: '😔', neutral: '😐', happy: '😊', very_happy: '😄',
      Happy: '😊', Neutral: '😐', Low: '😔', Agitated: '😠', Drowsy: '😴', 
      Confused: '😕', Distressed: '😢', Calm: '😌'
    };
    const needsAttention = wellbeingOverview?.needsAttention || [];
    const found = needsAttention.find((r: any) => r.id === residentId);
    if (found?.mood) return MOOD_EMOJI_MAP[found.mood] || null;
    return null;
  };

  // If note type not yet chosen for ad-hoc, show type picker
  const showTypePicker = activeResident && !activeNoteType;
  const showForm       = activeResident && activeNoteType;

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, marginBottom:4, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>{greeting}, {user?.firstName}</h1>
            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:11, padding:'3px 10px', borderRadius:4, background:shiftColor+'15', color:shiftColor, fontWeight:600, border:`1px solid ${shiftColor}30`, textTransform:'uppercase', letterSpacing:'0.05em' }}>{shift} Shift</span>
              <span style={{ fontSize:12, color:'var(--text-muted)' }}>{now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Link to="/incidents" style={{ padding:'8px 16px', borderRadius:10, background:'#dc2626', color:'white', fontWeight:700, fontSize:13, textDecoration:'none' }}>🚨 Report Incident</Link>
          </div>
        </div>
      </div>

      {/* ── Alert banner ────────────────────────────────────── */}
      {dashData?.openIncidents > 0 && (
        <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:10, padding:'10px 16px', marginBottom:14, display:'flex', alignItems:'center', gap:10 }}>
          <span>⚠️</span>
          <span style={{ fontSize:13, color:'#991b1b', fontWeight:600 }}>{dashData.openIncidents} open incident{dashData.openIncidents!==1?'s':''} — check with senior staff</span>
          <Link to="/incidents" style={{ marginLeft:'auto', fontSize:13, color:'#dc2626', fontWeight:600 }}>View →</Link>
        </div>
      )}

      {/* ── Wellbeing Quick Alert ───────────────────────────── */}
      <WellbeingAlertWidget residents={residents} />

      {/* ── View Mode Toggle ────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ display:'flex', gap:4, background:'var(--surface-2)', borderRadius:8, padding:3 }}>
          <button onClick={()=>{ setViewMode('grid'); setGridSelectedResident(null); }} style={{ padding:'6px 14px', borderRadius:6, border:'none', background:viewMode==='grid'?'white':'transparent', color:viewMode==='grid'?'var(--text-primary)':'var(--text-muted)', fontSize:12, fontWeight:viewMode==='grid'?700:500, cursor:'pointer', boxShadow:viewMode==='grid'?'0 1px 3px rgba(0,0,0,.1)':'none', transition:'all 150ms' }}>
            🖼 Grid View
          </button>
          <button onClick={()=>{ setViewMode('list'); setGridSelectedResident(null); }} style={{ padding:'6px 14px', borderRadius:6, border:'none', background:viewMode==='list'?'white':'transparent', color:viewMode==='list'?'var(--text-primary)':'var(--text-muted)', fontSize:12, fontWeight:viewMode==='list'?700:500, cursor:'pointer', boxShadow:viewMode==='list'?'0 1px 3px rgba(0,0,0,.1)':'none', transition:'all 150ms' }}>
            📋 List View
          </button>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <input type="text" placeholder="🔍 Search resident..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, width:140, background:'var(--surface-2)' }} />
          <button className="btn btn-ghost btn-sm" onClick={()=>refetch()} style={{ fontSize:12 }}>{t('Refresh')}</button>
        </div>
      </div>

      {/* ── Grid View: Mobile overlay for resident detail ──── */}
      {viewMode === 'grid' && isMobile && gridSelectedResident && !showForm && !showTypePicker && (
        <div style={{ position:'fixed', inset:0, zIndex:10000, background:'var(--bg-primary, #1a1d27)', color:'var(--text-primary, #e2e8f0)', overflowY:'auto', padding:'16px', WebkitOverflowScrolling:'touch' }}>
          <button onClick={closeGridPanel} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', fontSize:14, fontWeight:600, color:'var(--text-primary, #e2e8f0)', marginBottom:12, padding:'4px 0' }}>
            ← Back
          </button>
          {/* Resident header */}
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, padding:'12px', background:'var(--surface-2, #252830)', borderRadius:12 }}>
            {(() => {
              const photoUrl = residentPhoto(gridSelectedResident.photo_url);
              const initials = (gridSelectedResident.first_name[0] + gridSelectedResident.last_name[0]).toUpperCase();
              return photoUrl ? (
                <img src={photoUrl} alt={gridSelectedResident.first_name} style={{ width:56, height:56, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--border)' }} />
              ) : (
                <div style={{ width:56, height:56, borderRadius:'50%', background:'#374151', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#e2e8f0', border:'3px solid #4b5563' }}>{initials}</div>
              );
            })()}
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>{gridSelectedResident.first_name} {gridSelectedResident.last_name}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>Room {gridSelectedResident.room_number}</div>
              {gridSelectedResident.risk_level === 'high' && (
                <span style={{ fontSize:10, padding:'2px 6px', borderRadius:4, background:'#fef2f2', color:'#dc2626', fontWeight:700, marginTop:4, display:'inline-block' }}>HIGH RISK</span>
              )}
            </div>
          </div>
          {/* Tasks for this resident */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontWeight:600, fontSize:13, marginBottom:8, color:'var(--text-primary, #e2e8f0)' }}>Pending Tasks</div>
            {(byResident[gridSelectedResident.id] || []).sort((a:any,b:any)=>(a.due_time||'').localeCompare(b.due_time||'')).map((task:any) => {
              const st = TASK_STATUS[task.status] || TASK_STATUS.upcoming;
              const isDone = task.status==='done'||task.status==='deferred';
              return (
                <button key={task.id} onClick={()=>handleTaskTap(task)} disabled={isDone}
                  style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px', marginBottom:6, borderRadius:8, border:`1px solid ${st.border}`, background:st.bg, cursor:isDone?'default':'pointer', textAlign:'left' }}>
                  <span style={{ fontSize:20 }}>{task.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:st.text }}>{task.task_name}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>Due {task.due_time?.slice(0,5)} {isDone && '- Done'}</div>
                  </div>
                  {isDone && <span style={{ fontSize:14 }}>✓</span>}
                </button>
              );
            })}
            {(!byResident[gridSelectedResident.id] || byResident[gridSelectedResident.id].length === 0) && (
              <div style={{ fontSize:12, color:'var(--text-muted)', padding:12, textAlign:'center' }}>No tasks assigned today</div>
            )}
          </div>
          {/* Quick actions */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <button onClick={()=>handleAdHoc(gridSelectedResident)} style={{ padding:'12px 16px', borderRadius:10, border:'1px solid #3b82f6', background:'#eff6ff', color:'#0d9488', fontSize:13, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
              📝 + Ad-hoc Note
            </button>
            <Link to={`/residents/${gridSelectedResident.id}`} style={{ padding:'12px 16px', borderRadius:10, border:'1px solid var(--border)', background:'var(--surface-2, #252830)', color:'var(--text-primary, #e2e8f0)', fontSize:13, fontWeight:600, cursor:'pointer', textAlign:'center', textDecoration:'none' }}>
              👤 View Full Profile
            </Link>
          </div>
        </div>
      )}

      {/* ── Mobile overlay for form/picker ─────────────────── */}
      {(isMobile || viewMode === 'grid') && (showForm || showTypePicker) && (
        <div style={{ position:'fixed', inset:0, zIndex:10000, background: isMobile ? 'var(--bg-primary, #1a1d27)' : 'rgba(15,23,42,.55)', color:'var(--text-primary, #e2e8f0)', overflowY:'auto', padding: isMobile ? '16px' : '32px', display: isMobile ? 'block' : 'flex', justifyContent:'center', alignItems:'flex-start', WebkitOverflowScrolling:'touch' }}>
          <div style={{ width:'100%', maxWidth: isMobile ? '100%' : 760 }}>
          <button onClick={closeForm} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', fontSize:14, fontWeight:600, color:'var(--text-primary, #e2e8f0)', marginBottom:12, padding:'4px 0' }}>
            ← Back
          </button>

          {showTypePicker && activeResident && (
            <div className="card" style={{ border:'2px solid #0d9488' }}>
              <div className="card-header" style={{ background:'#eff6ff' }}>
                <div>
                  <span className="card-title">📝 Select Note Type</span>
                  <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                    Ad-hoc note for {activeResident.first_name} {activeResident.last_name} · Rm {activeResident.room_number}
                  </div>
                </div>
                <button onClick={closeForm} style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 }}>✕ Cancel</button>
              </div>
              <div className="card-body">
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:8 }}>
                  {NOTE_TYPES.map(nt=>(
                    <button key={nt.value} onClick={()=>setNoteType(nt)}
                      style={{ padding:'12px 8px', borderRadius:10, border:`2px solid ${nt.color}25`, background:nt.color+'0e', cursor:'pointer', textAlign:'center', transition:'all 150ms' }}
                      onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=nt.color;}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=nt.color+'25';}}>
                      <div style={{ fontSize:22, marginBottom:4 }}>{nt.icon}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:nt.color }}>{nt.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {showForm && activeResident && activeNoteType && (
            <div className="card" style={{ border:`2px solid ${activeNoteType.color}`, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
              <ClinicalForm
                resident={activeResident}
                noteType={activeNoteType}
                task={activeTask}
                onClose={closeForm}
                onSaved={() => { refetch(); closeForm(); }}
                isAdHoc={isAdHoc}
              />
            </div>
          )}
          </div>
        </div>
      )}

      {/* ── GRID VIEW ──────────────────────────────────────── */}
      {viewMode === 'grid' && (
        <div className="no-mobile-collapse" style={{ display:'grid', gridTemplateColumns: !isMobile && gridSelectedResident ? `1fr 380px` : '1fr', gap:16, alignItems:'start' }}>
          {/* Photo Grid */}
          <div>
            {/* Task summary progress bars */}
            <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
              {[
                { label:'Due', val:tasks.filter(t=>t.status==='due').length, color:'#0d9488' },
                { label:'Overdue', val:tasks.filter(t=>t.status==='overdue').length, color:'#d97706' },
                { label:'Missed', val:tasks.filter(t=>t.status==='missed').length, color:'#dc2626' },
                { label:'Done', val:tasks.filter(t=>t.status==='done').length, color:'#16a34a' },
              ].map(k=>(
                <div key={k.label} style={{ flex:'1 1 120px', minWidth:100 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:k.color }}>{k.label}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:k.color }}>{k.val}</span>
                  </div>
                  <div style={{ height:6, borderRadius:3, background:'var(--surface-2)', overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:3, background:k.color, width:`${tasks.length>0 ? (k.val/tasks.length*100) : 0}%`, transition:'width 0.3s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Resident photo cards grid */}
            <div className="no-mobile-collapse" style={{ display:'grid', gridTemplateColumns:`repeat(${gridCols}, 1fr)`, gap:isMobile ? 6 : 12 }}>
              {residents.filter(r => {
                if (!search) return true;
                return `${r.first_name} ${r.last_name} ${r.room_number}`.toLowerCase().includes(search.toLowerCase());
              }).map(r => {
                const resTasks = byResident[r.id] || [];
                const done = resTasks.filter((t:any) => t.status === 'done' || t.status === 'deferred').length;
                const borderColor = getCardBorderColor(resTasks);
                const photoUrl = residentPhoto(r.photo_url);
                const initials = (r.first_name[0] + (r.last_name?.[0] || '')).toUpperCase();
                const moodEmoji = getMoodEmoji(r.id);
                const isSelected = gridSelectedResident?.id === r.id;

                return (
                  <div key={r.id} onClick={() => handleGridCardTap(r)}
                    style={{
                      borderRadius: isMobile ? 8 : 12, overflow:'hidden', cursor:'pointer',
                      border:`${isMobile ? 2 : 3}px solid ${isSelected ? '#0d9488' : borderColor}`,
                      boxShadow: isSelected ? '0 4px 20px rgba(37,99,235,.3)' : '0 2px 8px rgba(0,0,0,.12)',
                      transition:'all 180ms ease', position:'relative',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                    }}>
                    {/* Photo area */}
                    <div style={{ position:'relative', width:'100%', paddingTop: isMobile ? '64px' : '100%', height: isMobile ? 0 : undefined, background:'#1e293b' }}>
                      {photoUrl ? (
                        <img src={photoUrl} alt={r.first_name}
                          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover' }} />
                      ) : (
                        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}>
                          <span style={{ fontSize: isMobile ? 22 : 40, fontWeight:700, color:'#94a3b8' }}>{initials}</span>
                        </div>
                      )}
                      {/* Mood emoji overlay - bottom right of photo */}
                      {moodEmoji && (
                        <div style={{ position:'absolute', bottom: isMobile ? 2 : 6, right: isMobile ? 2 : 6, fontSize:isMobile ? 14 : 20, background:'rgba(0,0,0,.5)', borderRadius:'50%', width:isMobile ? 20 : 30, height:isMobile ? 20 : 30, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {moodEmoji}
                        </div>
                      )}
                      {/* Risk level info badge - top right */}
                      {r.risk_level === 'high' && (
                        <div style={{ position:'absolute', top: isMobile ? 2 : 6, right: isMobile ? 2 : 6, fontSize: isMobile ? 9 : 12, background:'rgba(220,38,38,.9)', color:'white', borderRadius: isMobile ? 4 : 6, padding: isMobile ? '1px 3px' : '2px 6px', fontWeight:700 }}>
                          ℹ️
                        </div>
                      )}
                      {/* Task count badge - top left */}
                      {resTasks.length > 0 && (
                        <div style={{ position:'absolute', top: isMobile ? 2 : 6, left: isMobile ? 2 : 6, fontSize: isMobile ? 8 : 10, background:'rgba(0,0,0,.7)', color:'white', borderRadius: isMobile ? 4 : 6, padding: isMobile ? '1px 4px' : '2px 7px', fontWeight:700 }}>
                          {done}/{resTasks.length}
                        </div>
                      )}
                      {/* Room number overlay - bottom left (mobile only) */}
                      {isMobile && (
                        <div style={{ position:'absolute', bottom:2, left:2, fontSize:8, background:'rgba(0,0,0,.6)', color:'#e2e8f0', borderRadius:4, padding:'1px 4px', fontWeight:600 }}>
                          {r.room_number}
                        </div>
                      )}
                    </div>
                    {/* Name strip */}
                    <div style={{ background:'#1e293b', padding:isMobile ? '4px 4px' : '8px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div>
                        <div style={{ fontSize:isMobile ? 10 : 13, fontWeight:700, color:'#f1f5f9', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.first_name}</div>
                        {!isMobile && <div style={{ fontSize:10, color:'#94a3b8', fontWeight:500 }}>Rm {r.room_number}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Desktop: Resident Detail Panel (right side) */}
          {!isMobile && gridSelectedResident && (
            <div style={{ position:'sticky', top:80, background:'white', borderRadius:12, border:'2px solid #e2e8f0', boxShadow:'0 4px 16px rgba(0,0,0,.08)', overflow:'hidden', maxHeight:'calc(100vh - 100px)', display:'flex', flexDirection:'column' }}>
              {/* Panel header */}
              <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, background:'var(--surface-2)' }}>
                {(() => {
                  const photoUrl = residentPhoto(gridSelectedResident.photo_url);
                  const initials = (gridSelectedResident.first_name[0] + gridSelectedResident.last_name[0]).toUpperCase();
                  return photoUrl ? (
                    <img src={photoUrl} alt={gridSelectedResident.first_name} style={{ width:44, height:44, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border)' }} />
                  ) : (
                    <div style={{ width:44, height:44, borderRadius:'50%', background:'#e0e7ff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#4338ca', border:'2px solid #c7d2fe' }}>{initials}</div>
                  );
                })()}
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14 }}>{gridSelectedResident.first_name} {gridSelectedResident.last_name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>Room {gridSelectedResident.room_number} {gridSelectedResident.risk_level === 'high' && <span style={{ color:'#dc2626', fontWeight:700 }}>- HIGH RISK</span>}</div>
                </div>
                <button onClick={closeGridPanel} style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 }}>✕</button>
              </div>
              {/* Scrollable tasks list */}
              <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
                <div style={{ fontWeight:600, fontSize:12, marginBottom:8, color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.05em' }}>Tasks Today</div>
                {(byResident[gridSelectedResident.id] || []).sort((a:any,b:any)=>(a.due_time||'').localeCompare(b.due_time||'')).map((task:any) => {
                  const st = TASK_STATUS[task.status] || TASK_STATUS.upcoming;
                  const isDone = task.status==='done'||task.status==='deferred';
                  return (
                    <button key={task.id} onClick={()=>handleTaskTap(task)} disabled={isDone}
                      style={{ display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px', marginBottom:6, borderRadius:8, border:`1px solid ${st.border}`, background:st.bg, cursor:isDone?'default':'pointer', textAlign:'left', transition:'all 120ms' }}>
                      <span style={{ fontSize:18 }}>{task.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:st.text }}>{task.task_name}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>Due {task.due_time?.slice(0,5)} {isDone && '- Completed'}</div>
                      </div>
                      {isDone && <span style={{ fontSize:14, color:'#16a34a' }}>✓</span>}
                    </button>
                  );
                })}
                {(!byResident[gridSelectedResident.id] || byResident[gridSelectedResident.id].length === 0) && (
                  <div style={{ fontSize:12, color:'var(--text-muted)', padding:16, textAlign:'center', background:'var(--surface-2)', borderRadius:8 }}>No tasks assigned today</div>
                )}
              </div>
              {/* Quick actions */}
              <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:8 }}>
                <button onClick={()=>handleAdHoc(gridSelectedResident)} style={{ padding:'10px 16px', borderRadius:8, border:'1px solid #3b82f6', background:'#eff6ff', color:'#0d9488', fontSize:13, fontWeight:700, cursor:'pointer', textAlign:'center' }}>
                  📝 + Ad-hoc Note
                </button>
                <Link to={`/residents/${gridSelectedResident.id}`} style={{ padding:'10px 16px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface-2)', color:'var(--text-primary)', fontSize:13, fontWeight:600, cursor:'pointer', textAlign:'center', textDecoration:'none' }}>
                  👤 View Full Profile
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LIST VIEW (original task board) ─────────────────── */}
      {viewMode === 'list' && (
      <>
      {/* ── Main split layout ───────────────────────────────── */}
      <div className="carer-main-grid no-mobile-collapse" style={{ display:'grid', gridTemplateColumns: !isMobile && (showForm || showTypePicker) ? '1fr 1fr' : '1fr', gap:16, alignItems:'start' }}>

        {/* ── LEFT: Task Board ─────────────────────────────── */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10, flexWrap:'wrap', gap:8 }}>
            <div style={{ fontWeight:600, fontSize:14, color:'var(--text-primary)', letterSpacing:'-0.01em' }}>Today's Care Tasks</div>
            <div style={{ display:'flex', gap:6 }}>
              <input type="text" placeholder="🔍 Search resident…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, width:140, background:'var(--surface-2)' }} />
              <button className="btn btn-ghost btn-sm" onClick={()=>refetch()} style={{ fontSize:12 }}>{t('Refresh')}</button>
            </div>
          </div>

          {/* Task summary progress bars */}
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
            {[
              { label:'Due', val:tasks.filter(t=>t.status==='due').length, color:'#0d9488' },
              { label:'Overdue', val:tasks.filter(t=>t.status==='overdue').length, color:'#d97706' },
              { label:'Missed', val:tasks.filter(t=>t.status==='missed').length, color:'#dc2626' },
              { label:'Done', val:tasks.filter(t=>t.status==='done').length, color:'#16a34a' },
            ].map(k=>(
              <div key={k.label} style={{ flex:'1 1 120px', minWidth:100 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:k.color }}>{k.label}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:k.color }}>{k.val}</span>
                </div>
                <div style={{ height:6, borderRadius:3, background:'var(--surface-2)', overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:3, background:k.color, width:`${tasks.length>0 ? (k.val/tasks.length*100) : 0}%`, transition:'width 0.3s ease' }} />
                </div>
              </div>
            ))}
          </div>

          {tasksLoading || genTasks.isPending ? (
            <div style={{ padding:30, textAlign:'center', color:'var(--text-muted)', fontSize:13 }}>
              {genTasks.isPending ? '⏳ Generating today\'s tasks…' : 'Loading…'}
            </div>
          ) : tasks.length === 0 ? (
            <div className="card">
              <div className="card-body" style={{ textAlign:'center', padding:30 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                <div style={{ fontWeight:700, marginBottom:8 }}>No tasks for today</div>
                <button className="btn btn-primary btn-sm" onClick={()=>genTasks.mutate(date,{onSuccess:()=>refetch()})} disabled={genTasks.isPending}>⚡ Generate Tasks</button>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {filteredResidentIds.map(rid => {
                const resTasks = byResident[rid].sort((a:any,b:any)=>(a.due_time||'').localeCompare(b.due_time||''));
                const first    = resTasks[0];
                const done     = resTasks.filter((t:any)=>t.status==='done'||t.status==='deferred').length;
                const hasMissed  = resTasks.some((t:any)=>t.status==='missed');
                const hasOverdue = resTasks.some((t:any)=>t.status==='overdue');
                const allDone    = done === resTasks.length;
                const rowBorder  = hasMissed?'#fca5a5':hasOverdue?'#fcd34d':allDone?'#86efac':'var(--border)';
                const r = residents.find(res=>res.id===rid);

                return (
                  <div key={rid} style={{ background:allDone?'linear-gradient(135deg, #f0fdf4 0%, white 40%)':hasMissed?'linear-gradient(135deg, #fef2f2 0%, white 40%)':hasOverdue?'linear-gradient(135deg, #fffbeb 0%, white 40%)':'white', border:`1px solid ${rowBorder}`, borderRadius:10, padding:'10px 12px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6, paddingBottom:6, borderBottom:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {/* Resident photo or initials */}
                      {(() => {
                        const res = residents.find(r => r.id === rid);
                        const photoUrl = residentPhoto(res?.photo_url);
                        const initials = first.resident_name.split(' ').map((n:string)=>n[0]).join('').slice(0,2);
                        return photoUrl ? (
                          <img src={photoUrl} alt={first.resident_name} style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border)', flexShrink:0, boxShadow:'0 1px 3px rgba(0,0,0,.1)' }} />
                        ) : (
                          <div style={{ width:36, height:36, borderRadius:'50%', background:'#e0e7ff', border:'2px solid #c7d2fe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#4338ca', flexShrink:0 }}>{initials}</div>
                        );
                      })()}
                      <div style={{ fontWeight:600, fontSize:13 }}>{first.resident_name}</div>
                        <span style={{ fontSize:11, color:'var(--text-muted)' }}>Rm {first.room_number}</span>
                        {first.risk_level==='high'&&<span style={{ fontSize:9, padding:'1px 5px', borderRadius:3, background:'#fef2f2', color:'#dc2626', fontWeight:600, letterSpacing:'0.03em', textTransform:'uppercase' }}>High Risk</span>}
                        <span style={{ fontSize:11, color:allDone?'#16a34a':hasMissed?'#dc2626':'var(--text-muted)', fontWeight:500 }}>{done}/{resTasks.length}</span>
                      </div>
                      {r && (
                        <button onClick={()=>handleAdHoc(r)} style={{ fontSize:12, padding:'5px 14px', borderRadius:8, border:'1px solid #3b82f6', background:'#eff6ff', color:'#0d9488', cursor:'pointer', fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
                          📝 Ad-hoc Note
                        </button>
                      )}
                    </div>
                    {/* Task chips */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {resTasks.map((task:any) => {
                        const st = TASK_STATUS[task.status] || TASK_STATUS.upcoming;
                        const isDone = task.status==='done'||task.status==='deferred';
                        const isActive = activeTask?.id === task.id;
                        const isSomeoneElse = task.in_progress_by && task.in_progress_by !== user?.id;
                        return (
                          <button key={task.id} onClick={()=>handleTaskTap(task)}
                            disabled={isDone}
                            title={`${task.task_name} — Due ${task.due_time?.slice(0,5)}${isSomeoneElse?` (${task.in_progress_name} is filling this)`:''}`}
                            style={{
                              display:'inline-flex', alignItems:'center', gap:5,
                              padding:'4px 10px', borderRadius:6,
                              border:`1px solid ${isActive?'#0d9488':isSomeoneElse?'#c4b5fd':st.border}`,
                              background:isActive?'#dbeafe':isSomeoneElse?'#ede9fe':st.bg,
                              color:isActive?'#0f766e':isSomeoneElse?'#6d28d9':st.text,
                              cursor:isDone?'default':'pointer', fontSize:11, fontWeight:500,
                              opacity:task.status==='upcoming'?0.5:1,
                              transition:'all 120ms', position:'relative',
                              boxShadow:task.status==='missed'?'0 0 0 2px #fca5a540':task.status==='due'?'0 0 0 2px #93c5fd40':'none',
                            }}>
                            <span style={{ fontSize:16 }}>{task.icon}</span>
                            <span style={{ maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {task.task_name.length > 12 ? task.task_name.slice(0,12)+'…' : task.task_name}
                            </span>
                            {isSomeoneElse && (
                              <span style={{ position:'absolute', top:-5, right:-5, width:12, height:12, borderRadius:'50%', background:'#8b5cf6', border:'2px solid white', fontSize:7, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900 }}>!</span>
                            )}
                            {isDone && (
                              <span style={{ fontSize:10, opacity:0.7 }}>✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: Clinical Form ──────────────────────────── */}
        {!isMobile && (showForm || showTypePicker) && (
          <div style={{ position:'sticky', top:80, height:'calc(100vh - 100px)', display:'flex', flexDirection:'column' }}>
            {showTypePicker && activeResident && (
              <div className="card" style={{ border:`2px solid #0d9488` }}>
                <div className="card-header" style={{ background:'#eff6ff' }}>
                  <div>
                    <span className="card-title">📝 Select Note Type</span>
                    <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
                      Ad-hoc note for {activeResident.first_name} {activeResident.last_name} · Rm {activeResident.room_number}
                    </div>
                  </div>
                  <button onClick={closeForm} style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontSize:12 }}>✕ Cancel</button>
                </div>
                <div className="card-body">
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:8 }}>
                    {NOTE_TYPES.map(nt=>(
                      <button key={nt.value} onClick={()=>setNoteType(nt)}
                        style={{ padding:'12px 8px', borderRadius:10, border:`2px solid ${nt.color}25`, background:nt.color+'0e', cursor:'pointer', textAlign:'center', transition:'all 150ms' }}
                        onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=nt.color;}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.borderColor=nt.color+'25';}}>
                        <div style={{ fontSize:22, marginBottom:4 }}>{nt.icon}</div>
                        <div style={{ fontSize:11, fontWeight:700, color:nt.color }}>{nt.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {showForm && activeResident && activeNoteType && (
              <div className="card" style={{ border:`2px solid ${activeNoteType.color}`, flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
                <ClinicalForm
                  resident={activeResident}
                  noteType={activeNoteType}
                  task={activeTask}
                  onClose={closeForm}
                  onSaved={() => { refetch(); closeForm(); }}
                  isAdHoc={isAdHoc}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Legend ──────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:12, marginTop:12, flexWrap:'wrap', padding:'8px 0', borderTop:'1px solid var(--border)', fontSize:11, color:'var(--text-muted)' }}>
        {Object.entries(TASK_STATUS).filter(([k])=>!['upcoming'].includes(k)).map(([k,v])=>(
          <span key={k} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:v.text }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:v.dot, display:'inline-block' }} />
            <span style={{ textTransform:'capitalize' }}>{k.replace(/_/g,' ')}</span>
          </span>
        ))}
        <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#7c3aed' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'#8b5cf6', display:'inline-block' }} />
          Someone filling
        </span>
      </div>
      </>
      )}
    </div>
  );
}

// ── Meal choice -> kitchen ────────────────────────────────────────────────
// Lets the carer record what the resident chose; the order appears instantly
// on the kitchen's service list with texture, portion and allergy flags.
const KITCHEN_MEAL: Record<string, string> = {
  breakfast: 'breakfast', morning_snack: 'snack', lunch: 'lunch',
  afternoon_tea: 'snack', supper: 'dinner', evening_snack: 'snack',
};

function MealChoiceToKitchen({ residentId, meal }: { residentId: string; meal: string }) {
  const { t } = useLang();
  const kitchenMeal = KITCHEN_MEAL[meal] || 'lunch';
  const { data: menu = [] } = useMenuAdmin();
  const createOrder = useCreateMealOrder();
  const [choice, setChoice] = useState('');
  const [portion, setPortion] = useState('regular');
  const [request, setRequest] = useState('');
  const [sent, setSent] = useState(false);

  const options = (Array.isArray(menu) ? menu : []).filter((o: any) => o.meal_type === kitchenMeal && o.active !== false);

  const send = () => {
    if (!choice) return;
    const opt = options.find((o: any) => o.id === choice);
    createOrder.mutate(
      { resident_id: residentId, meal_type: kitchenMeal, menu_option_id: choice,
        choice_name: opt?.name, texture: opt?.texture, portion_size: portion, special_request: request || null },
      { onSuccess: () => { setSent(true); setTimeout(() => setSent(false), 2500); } }
    );
  };

  return (
    <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, background: '#fff', border: '1px dashed #86efac' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        Send choice to kitchen ({kitchenMeal})
      </div>
      {options.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No {kitchenMeal} options on the menu yet — a manager can add them in Menu Setup.</div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={choice} onChange={e => setChoice(e.target.value)} style={{ flex: '2 1 200px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
              <option value="">{t('Choose a dish…')}</option>
              {options.map((o: any) => <option key={o.id} value={o.id}>{o.name}{o.texture && o.texture !== 'normal' ? ` (${o.texture})` : ''}</option>)}
            </select>
            <select value={portion} onChange={e => setPortion(e.target.value)} style={{ flex: '1 1 110px', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
              <option value="small">{t('Small')}</option><option value="regular">{t('Regular')}</option><option value="large">{t('Large')}</option>
            </select>
          </div>
          <input value={request} onChange={e => setRequest(e.target.value)} placeholder="Special request (optional) — e.g. no gravy, extra soft"
            style={{ width: '100%', marginTop: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }} />
          <button type="button" onClick={send} disabled={!choice || createOrder.isPending}
            style={{ marginTop: 8, padding: '8px 16px', borderRadius: 8, border: 'none', background: sent ? '#16a34a' : '#10b981', color: '#fff', fontWeight: 700, fontSize: 13, cursor: choice ? 'pointer' : 'not-allowed', opacity: choice ? 1 : 0.5 }}>
            {sent ? '✓ Sent to kitchen' : createOrder.isPending ? 'Sending…' : 'Send to kitchen'}
          </button>
        </>
      )}
    </div>
  );
}
