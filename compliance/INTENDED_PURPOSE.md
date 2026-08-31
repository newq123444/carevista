# CareVista — statement of intended purpose

**Version 1.0 · 27 August 2026 · CareVista Technologies Ltd**

This statement determines how CareVista is classified under the UK Medical
Devices Regulations 2002. It is the controlling document: if the product ever
does something this statement does not describe, the statement must be revised
and the classification reconsidered **before** the feature ships.

---

## 1. Intended purpose

CareVista is a **record-keeping and workflow system for adult residential care
services**. Its purpose is to record the care that has been delivered, to
display information that has already been recorded, and to help a care service
organise and evidence its own work.

It is intended for use by care staff, nurses and managers employed by a
registered care provider. It is not intended for use by residents, by families
as a clinical tool, or by the public.

---

## 2. What CareVista does

- Records care delivered: personal care, nutrition and hydration, continence, repositioning, sleep, mood, activity.
- Holds the person-centred care plan, its reviews and its version history.
- Records medication administration on an electronic MAR, signed by the person administering.
- Records incidents, complaints, safeguarding concerns, restrictions and DoLS authorisations.
- Displays recognised assessment tools — NEWS2, MUST, Waterlow, Bristol stool scale — **showing every component value and score** so the user can verify the result against the published tool.
- Summarises information already recorded, including trends and counts, so staff and managers can see what their own records show.
- Records ambient sensor events in a resident's room, where consented, and reports them as observations.

## 3. What CareVista does not do

CareVista is **not** intended to:

- diagnose, prevent, monitor, treat or alleviate disease;
- predict a future clinical event;
- recommend, calculate or alter a medicine, dose or treatment;
- replace, override or automate clinical judgement;
- trigger any clinical action without a qualified person deciding to take it;
- be relied upon as the sole basis for any clinical decision.

**No output of this system is a clinical decision.** Every output is information
about what has already been recorded, presented for a qualified person to
interpret.

---

## 4. Design rules that keep this true

These are enforced in the product, not merely stated here.

**Calculations show their working.** Assessment tools return every parameter, its
value, its sub-score and the source of the tool. A NEWS2 result can be checked
line by line against the chart on the wall. A calculation the user can verify is
reference information; one they cannot verify is the pattern the MHRA treats as
a medical device.

**Reference information cites its source.** Every medication interaction shown
carries its source and a statement that the current BNF must be checked before
acting. The system reports a known interaction; it does not decide anything.

**Risk indicators report the past, not the future.** The risk indicator module
weighs facts already in the record — falls in the last 90 days, sedating
medicines on the MAR, weight and intake trends, missed doses — and returns the
factors and weights that produced any figure. It states on screen that it does
not predict.

**Generated text is a draft, never a record.** AI-assisted drafting produces
suggested wording only. Nothing generated enters a clinical record until a
qualified person has read, edited where necessary and signed it. The system
records who signed.

**Sensor output is observation, not alarm.** Ambient sensing reports what was
observed — out of bed, sounds of distress, an impact — with the evidence and a
confidence. It does not diagnose a fall; it reports an impact and asks a person
to check.

---

## 5. Classification position

On the basis of the intended purpose above, CareVista is considered **not to be
a medical device** under UK MDR 2002, because:

- an electronic record that replaces a paper care file does not have a medical purpose;
- software that provides reference information for a healthcare professional to apply their own knowledge does not have a medical purpose;
- calculations presented are simple, published and verifiable by the intended user.

**This position is held by the manufacturer and has not been confirmed by the
MHRA.** An MHRA borderline determination will be sought before the product is
used with real resident data at scale, and in any event before any feature is
added that forecasts an outcome.

## 6. Review triggers

This statement must be reviewed and the classification reconsidered if any of
the following is proposed:

1. Any feature that states a probability or forecast of a future clinical event.
2. Any feature that recommends, calculates or adjusts a medicine or dose.
3. Any calculation whose result the user cannot verify from what is displayed.
4. Any output presented as a conclusion rather than as information.
5. Any change that allows an automated action without a person deciding.
6. Adoption of the new UK medical device framework rules aligning software
   classification with EU MDR Rule 11.

---

**Prepared by:** Ramandeep Singh, Founder
**Next review:** before the first pilot with live resident data, and annually thereafter.
