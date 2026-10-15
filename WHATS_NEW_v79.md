# CareVista v79 — Simple view

## What you asked for

> "can we make it app easiest as possible, something tinder style"

## What I did, and what I did not

I did **not** rebuild the app. Four weeks from your submission, a rewrite of 239
files and 527 endpoints would have left you with two half-working apps and
nothing to show a manager. What you need this month is something that works on a
Tuesday morning in front of a registered manager.

Instead: a **Simple view** that anyone can switch on, sitting alongside
everything that already exists. The backend is byte-for-byte identical to v78.
One existing file changed. Nothing that worked before works differently.

## Start my round

**Simple view → Start my round.** One card at a time:

- **Swipe right** — done
- **Swipe left** — not now, comes back later
- **Swipe up** — a problem, and it asks which of five things happened
- **Tap the card** — open the full form to write more

Every card shows the resident's name at 27px, their room, and the task with its
picture. No reading required beyond a name and one line.

**Buttons do everything a swipe does.** They sit along the bottom, in thumb
reach, each 76px tall. This matters more than it sounds: nitrile gloves work on
a touchscreen but imprecisely, and some barely register a drag at all. Nobody is
forced to swipe.

**Nothing happens by accident.** A swipe must travel a third of the card, or be a
genuinely fast flick. As you drag, the card tells you what is about to happen
before you let go. And every action leaves an **Undo** on screen for six seconds.

I chose undo over a confirmation dialogue deliberately. Confirmations get tapped
through without being read; an undo that sits there actually gets used.

**Medication cannot be swiped done.** eMAR tasks show "the nurse signs this on
the MAR chart" and the Done button is disabled — the same rule as v65, carried
into the new flow.

## A carer's home screen

One large "Start my round" button with the number waiting, two counts, and three
doors: Residents, Write a note, Handover. The menu drops from thirty items to
six.

## Handover in thirty seconds

**Simple view → Handover.** What was done, what was left and why, grouped by
resident, because a carer thinks in people rather than tasks. Built only from
records people actually made today — nothing here is generated or summarised by
anything clever.

## Who gets it

Anyone. There is a **Simple view / Full view** toggle at the bottom of the menu.

It defaults on for carers, senior carers and activities staff, and off for
everyone else — managers and nurses need tables, filters and exports, and swipe
cards would make their jobs slower, not faster.

It is deliberately available to you too. In a demo, switch it on and hand the
manager your phone. "This is what your carers would see" lands better than any
slide.

## The honest part

**Making recording this fast makes false recording faster too.** Someone could
sit in the staff room and swipe through twelve residents without leaving the
chair. That cuts directly against the record-integrity work in v78.

Two things address it, and neither is a claim that the problem is solved. The
implausibility check already flags care recorded for more residents than could
physically be attended in the time — the swipe UI and that detector need to be
switched on together. And a single card asking "have you done this one?" is
answered honestly more often than a list of twelve tick-boxes, which is part of
why it shows one at a time.

If a manager asks you about this in a demo, say it plainly. It is the answer that
builds trust in the rest.

## A new build check

`npm run check` now runs a ninth guard: touch targets on the simplified screens.
It fails the build if any control drops below 64px, because on these screens a
mis-tap means care recorded that did not happen, or care not recorded that did.
It caught three of my own while I was building this.

## What I could NOT check

There is no browser in my environment, so **I have not seen this UI**. I have
verified the code compiles, the targets are large enough and nothing else broke.
I have not verified that it looks right.

Open it on a real phone before you show it to anybody — ideally an actual Android
handset of the kind a home would buy, not a desktop browser window. Try it once
wearing gloves if you can.

## Running it

```
cd backend  && npm install && npm run migrate && npm run build
cd frontend && npm install && npm run build
```

No new migration. The backend did not change at all.
