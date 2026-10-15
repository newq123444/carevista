# CareVista v90 — make it the home's own

You asked for four things:

1. care plan sections of the home's own;
2. an assessment builder;
3. extra fields on any part of the care plan;
4. closing the gaps between assessments and the care plan.

All four are in this release.

**Database:** one new migration, `043_home_customisation.sql`. Render applies it on start.

## 1. Your own care plan sections

**Care plan setup** (in the menu, for managers) → **Sections**.

- **Create a section.** For example: "Stoma care", "Diabetes", "Faith & culture", "Dialysis" or "Hearing dog". Each section has:
  - a name;
  - a hint saying what to cover;
  - a picture;
  - which kind of care note the round writes for timed tasks from that section.
- **Add it to a plan.** On any care plan: *"Add one of the home's own sections…"*.
- **Add it to every plan.** Tick *"Add to every new care plan"* and new plans get it automatically.
- **Works like the built-in sections.** It has the same parts as the other 15: needs, wishes, how to support, equipment, key details, times on the round, evaluations, sign-off and versions. It also prints.
- **Switching off.** You switch a section off rather than delete it, so anything already recorded with it stays on the record.

## 2. Your own fields on any area

**Care plan setup** → **Extra fields**.

- **Add a field** to any area, built-in or your own. Types:
  - text
  - choose from a list
  - number (with a unit)
  - yes/no
  - date
  - a list
- **Show it to carers if you want.** Tick *"Show to carers"* and it appears in **Know before you help**, in red, amber or plain. For example: "Appliance: two-piece" (amber).
- **Records stay meaningful.** Once a field exists:
  - its type cannot change;
  - choices can be added, but not removed.

  This keeps answers already recorded meaningful.

## 3. Assessment builder

**Assessment builder** (in the menu, for managers).

- **Questions:** yes/no, choose one, choose any, number, text or date. Organise them into sections, reorder them, and make any of them optional.
- **Points** for answers, if the assessment is scored. **A warning** can be attached to any answer, e.g. "Dark stoma: tell the nurse now".
- **Score bands** (or a single outcome if not scored). Each band has:
  - a name;
  - a level (low, medium or high);
  - what to do, one action per line;
  - when to review;
  - optionally, a short line carers see before helping.
- **The care plan area** it belongs to, and whether it is for everyone or only for some people.
- **Try it** while you build: answer the questions and watch the score, warnings and actions.
- **Ready to publish?** A checklist explains, in plain words, anything that would make the assessment not work. Examples: bands that can't be reached, a band missing its actions, or two answers that are the same.
- **Publish freezes that version.** "Change" makes the next version, and publishing that retires the old one. A completed assessment always comes back showing **the exact version** it was scored with. Old versions can never be edited, deleted or brought back.

**Once published, your assessments work exactly like the 21 built-in ones:**

- on the resident's **Assessments** tab;
- as a column in the **register**;
- on their **care plan** area, with Assess and Reassess buttons;
- scored by the **server**;
- **final once saved**;
- sealed on the **record chain**;
- added to the care plan with **"Add to care plan"**;
- shown on the **printed plan**.

Every one is marked **"Home's own" — not a validated scale**, on screen, in the register and in its result.

## 4. Gaps closed

- **Every assessment shows on the care plan.** That covers all 21 built-in ones and your own.
- **Records from other screens now show on the matching care plan area:**

  | Record | Care plan area |
  |---|---|
  | Open wounds | Skin |
  | Latest NEWS2 | Breathing & circulation |
  | Capacity assessments | Memory & mood |
  | DoLS status | Safety & risk |
  | Continence assessment | Continence |

  Tap any of them to open its screen.
- **New warning for hidden risks.** If an area is marked **not applicable** but a current assessment for it shows a high risk, the plan now says so in red. For example: *"Skin integrity" is marked not applicable, but Waterlow shows High risk (19). Carers will not see this risk — review the plan.*

## Proof

- **486 unit tests pass**, including 10 new ones for the builder. They cover:
  - the publish checks;
  - scoring and bands;
  - warnings;
  - the "not validated" label;
  - custom fields reaching carers, and only in their own area.
- **New database tests in CI** check that:
  - a published assessment cannot be changed, deleted or brought back;
  - there is only one live version, and one current result per resident per assessment;
  - your own sections are accepted on a plan and made-up ones are refused.
- **A full run against a throwaway database in CI** goes from a new section, through a field on it, a draft, publishing and a scored result, to a new version and the register column.

## Please check

- **No browser here.** After deploying, as a manager:
  1. Create a section and a field.
  2. Add the section to a care plan.
  3. Build a small assessment, try it, publish it, and complete it for a resident.
  4. Check the register column and the printed plan.
- **Who can do what:**
  - Managers and deputies build sections, fields and assessments.
  - Nurses and senior carers use them.
- **Clinical check:** have a nurse look over any assessment before it is used with residents. Where a validated tool exists, use that instead.
- **Translations:** 8 new phrases. Names you give your own sections, fields and assessments appear exactly as you write them.
