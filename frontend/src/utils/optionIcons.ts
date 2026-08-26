// src/utils/optionIcons.ts
//
// A small picture in front of every option on the care recording forms.
//
// Why: a large share of care staff read English as a second language, and
// everyone is working fast, one-handed, on a phone. A symbol is recognised
// before a phrase is read.
//
// Why the words stay: an icon on its own is ambiguous, and this is a clinical
// record. A razor cannot tell you whether the shave was electric, wet, or
// refused — and "refused" is the entry that matters most. The icon speeds
// recognition; the words keep the record unambiguous. So: icon AND text.
//
// The rules below are ordered, most specific first. The first match wins.
// Outcome markers (refused, escalated, emergency) come before subject matter,
// because at a glance the important thing is not "this is about bathing" but
// "this one was refused" or "this one was escalated to a nurse".

type Rule = [RegExp, string];

const RULES: Rule[] = [
  // ── Outcome first: these change what a reader needs to do ────────────────
  [/\b(refused|declined|resistance to care|unable to engage|activity stopped)\b/i, '🚫'],
  [/\b(999|paramedic|urgent|urgently|emergency)\b/i, '🚑'],
  [/\b(escalated|reported to nurse|notified urgently|nurse informed|reported)\b/i, '📢'],
  [/\b(not required|not completed|not applicable|no concerns needed|no intervention|no equipment|none|no action required|no visible injuries|not opened today)\b/i, '➖'],
  [/\bno change\b/i, '➖'],

  // ── Personal care ────────────────────────────────────────────────────────
  // Order matters: "Bed bath (full)" must not be caught by the full-bath rule,
  // and "Own teeth brushed" must not be caught by the hair rule.
  [/(bed bath|strip wash|sponge bath|freshen up)/i, '🧽'],
  [/(teeth|dentures|mouth care|mouth rinse|oral hygiene)/i, '🦷'],
  [/\bshower\b/i, '🚿'],
  [/(full bath|bath \()/i, '🛁'],
  [/(hair|shampoo|combed|styled)/i, '💇'],
  [/shav(e|ing)/i, '🪒'],
  [/\bnails?\b/i, '💅'],
  [/(podiatrist|chiropod)/i, '🦶'],
  [/\b(moisturiser|emollient|barrier cream|pressure cream|cream applied)\b/i, '🧴'],
  [/\bcompression stockings\b/i, '🧦'],
  [/\b(dressed|night clothes|fresh clothes|change)\b/i, '👕'],

  // ── Continence ───────────────────────────────────────────────────────────
  [/\bcatheter|conveen|sheath|csu\b/i, '🔌'],
  [/(toilet|commode|bedpan)/i, '🚽'],
  [/\bpads?\b/i, '🩲'],
  [/\b(bowels|bristol|constipated|diarrhoea|pr bleed|suppository|enema)\b/i, '🟤'],
  [/\b(urine|urinary|uti|continent)\b/i, '💧'],

  // ── Moving & positioning ─────────────────────────────────────────────────
  [/\b(hoist|slide sheet|stand aid|transfer board|manual handling|wedge)\b/i, '🔧'],
  [/\b(lateral|supine|recumbent|fowler|seated in chair|standing|position)\b/i, '🛏'],
  [/\b(2-hourly|4-hourly|hourly|as tolerated)\b/i, '⏱'],

  // ── Skin & wounds ────────────────────────────────────────────────────────
  [/\b(grade [1-4]|unstageable|deep tissue|pressure ulcer|moisture lesion|skin tear|ulcer)\b/i, '🩹'],
  [/\b(dressing|hydrocolloid|foam|alginate|film)\b/i, '🩹'],
  [/\bskin intact\b/i, '✅'],
  [/(redness|blister|wound|abrasion|graze|laceration|bruis|haematoma|cuts)/i, '🩹'],
  [/\btissue viability\b/i, '🩺'],
  [/\b(healing well|improving)\b/i, '📈'],
  [/\b(deteriorating|infected|bleeding)\b/i, '📉'],

  // ── Sleep & night ────────────────────────────────────────────────────────
  [/\b(slept|sleep|settled|awoke|awake|sundowning)\b/i, '😴'],
  [/\b\d+(–|-)\d+ hours|\d\+ hours\b/i, '🕐'],

  // ── Behaviour & mood ─────────────────────────────────────────────────────
  [/\b(aggression|aggressive|disinhibited)\b/i, '⚠️'],
  [/\b(wandering|exit seeking|walk|fresh air|outdoor)\b/i, '🚶'],
  [/\b(calling out|shouted|repetitive)\b/i, '🗣'],
  [/\b(de-escalation|distraction|redirection|reassured)\b/i, '🤲'],
  [/\b1:1\b/i, '🧑‍🤝‍🧑'],
  [/\b(low mood|withdrawal|tearful|distressed)\b/i, '😢'],
  [/\b(happier|lifted|enthusiastic)\b/i, '😊'],
  [/\b(calm|content|comfortable)\b/i, '😌'],
  [/\b(engaged|participated|initiated)\b/i, '🙌'],
  [/\btired\b/i, '😪'],

  // ── Clinical ─────────────────────────────────────────────────────────────
  [/\b(medication|mar|prn|prescribed|dose)\b/i, '💊'],
  [/\b(pain)\b/i, '💢'],
  [/\bsyringe driver\b/i, '💉'],
  [/\b(oxygen|cpap|bipap|breathing|cheyne)\b/i, '🫁'],
  [/\b(blood test|bloods)\b/i, '🩸'],
  [/\b(x-ray|scan)\b/i, '🩻'],
  [/\b(observations|obs|vital signs|neuro)\b/i, '🩺'],
  [/\b(fracture|hip injury)\b/i, '🦴'],
  [/\bhead injury|loss of consciousness\b/i, '🤕'],
  [/\b(fall|found on floor|near miss)\b/i, '⬇️'],
  [/(hospital|a&e|admitted|admission|discharge|outpatient)/i, '🏥'],
  [/\b(gp|doctor|nurse practitioner|district nurse)\b/i, '🩺'],
  [/(referral|referred|arranged|booked|follow-up)/i, '➡️'],   // not 'review' — too greedy, it appears in half the clinical options
  [/\b(dnacpr|dnar|lasting power of attorney|capacity)\b/i, '📄'],
  [/\b(incident form|datix|ulysses)\b/i, '📝'],

  // ── Drinks & textures ────────────────────────────────────────────────────
  [/\bwater\b/i, '💧'],
  [/\btea\b/i, '🍵'],
  [/\bcoffee\b/i, '☕'],
  [/(juice|squash)/i, '🧃'],
  [/\bmilk\b/i, '🥛'],
  [/(thickened|iddsi|minced|pur[ée]e|soft & bite)/i, '🥣'],
  [/\bstandard\b/i, '🍽'],

  // ── Food & drink ─────────────────────────────────────────────────────────
  [/\b(drink|sips|fluid)\b/i, '🥤'],
  [/\b(meal|food|snack|appetite|baking|cooking)\b/i, '🍽'],
  [/\bnil by mouth\b/i, '🚱'],

  // ── Activities & social ──────────────────────────────────────────────────
  [/\b(music|singing|choir)\b/i, '🎵'],
  [/\b(arts|crafts)\b/i, '🎨'],
  [/\bgardening\b/i, '🪴'],
  [/\b(reading|book)\b/i, '📖'],
  [/\b(games|puzzles|quiz|reminiscence)\b/i, '🧩'],
  [/\b(film|tv)\b/i, '📺'],
  [/\b(religious|spiritual|chaplain)\b/i, '🕊'],
  [/\bpet therapy\b/i, '🐕'],
  [/\b(exercise|physio)\b/i, '🏃'],
  [/\bhairdresser\b/i, '💇'],

  // ── Family & communication ───────────────────────────────────────────────
  [/\bvideo call|facetime|whatsapp\b/i, '📹'],
  [/\b(telephone|phone|called|call back|callback)\b/i, '📞'],
  [/\b(email|letter)\b/i, '✉️'],
  [/\b(family|next of kin|advocate|social worker)\b/i, '👨‍👩‍👧'],
  [/\bcomplaint\b/i, '📣'],
  [/\bpositive feedback\b/i, '⭐'],
  [/\b(visit|visiting)\b/i, '🚪'],
  [/\b(meeting|handover|shift)\b/i, '🔁'],
  [/\bcare plan\b/i, '📖'],

  // ── Places in the home ───────────────────────────────────────────────────
  [/\bbedroom\b/i, '🛏'],
  [/(en-suite|bathroom)/i, '🚿'],
  [/\bcorridor\b/i, '🚶'],
  [/(lounge|sitting room)/i, '🛋'],
  [/\bdining\b/i, '🍽'],
  [/(garden|outside)/i, '🌳'],
  [/\bstairs\b/i, '🪜'],

  // ── Body sites ───────────────────────────────────────────────────────────
  [/(heel|ankle|foot|feet)/i, '🦶'],
  [/(hip|knee|elbow|leg|bone)/i, '🦴'],
  [/(sacrum|coccyx|torso|abdomen|head \/ face)/i, '📍'],

  // ── Conversation & needs ─────────────────────────────────────────────────
  [/(discussed|welfare update|request for information)/i, '💬'],
  [/(hunger|thirst)/i, '🍽'],
  [/\bnoise\b/i, '🔊'],
  [/(unfamiliar staff|agency staff|bank staff)/i, '🧑'],
  [/(passed away|bereavement|end of life)/i, '🕊'],
  [/(observed only|chose to watch)/i, '👁'],
  [/(finances|funding)/i, '💷'],
  [/(dietitian|salt|speech|occupational therapy|physiotherapy)/i, '🩺'],
  [/(comfort|pressure relief)/i, '🤲'],

  // ── Generic positives / agreement, last so specifics win ─────────────────
  [/\b(agreed|agree|happy with|confirmed|updated|completed|given|in place|checked|documented)\b/i, '✅'],
  [/\b(monitor|monitoring|awaiting|pending|due)\b/i, '⏳'],
  [/\b(unknown|no clear trigger|suspected|possible)\b/i, '❓'],
  [/(other — see notes|see notes)/i, '📝'],
];

const cache = new Map<string, string>();

/**
 * Returns a single symbol for a care option, or a neutral dot if nothing fits.
 * Never throws, never returns an empty string, so the layout stays stable.
 */
/**
 * Pulls the symbol off the front of a group heading such as "💇 Hair", so
 * options that only make sense in context ("Washed & dried") inherit it
 * instead of falling back to a neutral dot.
 */
export function groupIcon(label: string): string | undefined {
  if (!label) return undefined;
  const m = label.match(/^\s*(\p{Extended_Pictographic}(?:\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F)?)*)/u);
  return m ? m[1] : undefined;
}

export function optionIcon(text: string, fallback = '•'): string {
  if (!text) return fallback;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  let icon = fallback;
  for (const [pattern, symbol] of RULES) {
    if (pattern.test(text)) { icon = symbol; break; }
  }
  cache.set(text, icon);
  return icon;
}

export default optionIcon;
