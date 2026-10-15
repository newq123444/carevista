// Tests for the quick-record note builder.
//
// This text becomes the care record. It is read back by managers, families and
// inspectors, so it has to read like English — not like a form dump.
import assert from 'node:assert';
const {
  specForTask, buildNote, foodPercent, fluidMl, moodOf, hasAnything,
  clampFluid, fluidSelection, FLUID_MAX_ML,
} = await import('./quickoptions.impl.mjs');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.error(`FAIL  ${name}\n      ${e.message}`); }
}
const TYPES = ['personal_care','nutrition','continence','repositioning','sleep','social_wellbeing','behaviour'];

// ── Which sheet opens ─────────────────────────────────────────────────────
t('note_type wins when present', () => {
  assert.strictEqual(specForTask({ note_type: 'nutrition' }).noteType, 'nutrition');
});
t('falls back to the task name', () => {
  assert.strictEqual(specForTask({ task_name: 'Morning Personal Care' }).noteType, 'personal_care');
  assert.strictEqual(specForTask({ task_name: 'Lunch' }).noteType, 'nutrition');
  assert.strictEqual(specForTask({ task_name: 'Repositioning check' }).noteType, 'repositioning');
  assert.strictEqual(specForTask({ task_name: 'Night settle and check' }).noteType, 'sleep');
});
t('a task with nothing to add opens no sheet', () => {
  for (const name of ['Fire door check','Weight check','Window restrictor check',
                      'Call bell test','Room clean']) {
    assert.strictEqual(specForTask({ task_name: name }), null, name);
  }
});
t('"check" alone never opens a sleep sheet', () => {
  assert.strictEqual(specForTask({ task_name: 'Fire door check' }), null);
  assert.strictEqual(specForTask({ task_name: 'Night check' }).noteType, 'sleep');
});
t('clinical assessments get no quick sheet', () => {
  for (const name of ['Wound dressing change','Pressure sore review','Fall observation']) {
    assert.strictEqual(specForTask({ task_name: name }), null, name);
  }
});
t('"dressing" a person is personal care, "dressing" a wound is not', () => {
  assert.strictEqual(specForTask({ task_name: 'Assist with dressing' }).noteType, 'personal_care');
  assert.strictEqual(specForTask({ task_name: 'Wound dressing change' }), null);
});

// ── Parity with the full form ─────────────────────────────────────────────
t('the sheets carry the full option lists, not an abridged copy', () => {
  // The first version had its own shorter lists and silently recorded less.
  const pc = specForTask({ note_type: 'personal_care' });
  const total = pc.groups.reduce((n, g) => n + g.choices.length, 0);
  assert.ok(total >= 40, `personal care offers only ${total} options`);
  const bathing = pc.groups.find(g => g.key === 'bathing');
  assert.ok(bathing.choices.some(c => /bed bath/i.test(c.label)), 'bed bath missing');
  assert.ok(bathing.choices.some(c => /strip wash/i.test(c.label)), 'strip wash missing');

  const nu = specForTask({ note_type: 'nutrition' });
  assert.ok(nu.groups.find(g => g.key === 'texture').choices.some(c => /IDDSI/.test(c.label)),
    'IDDSI texture levels missing — these are a choking risk control');

  const co = specForTask({ note_type: 'continence' });
  assert.ok(co.groups.find(g => g.key === 'bowels').choices.some(c => /Bristol/i.test(c.label)),
    'Bristol stool types missing');
});
t('every option is reachable even when not shown first', () => {
  for (const type of TYPES) {
    for (const g of specForTask({ note_type: type }).groups) {
      assert.ok(g.commonCount >= 1, `${type}.${g.key} shows nothing`);
      assert.ok(g.choices.length >= g.commonCount,
        `${type}.${g.key} claims to hide options it does not have`);
    }
  }
});

// ── Icons are split out of the labels, not doubled up ─────────────────────
t('a leading emoji becomes the icon and leaves the text clean', () => {
  const mood = specForTask({ note_type: 'social_wellbeing' }).groups.find(g => g.key === 'mood');
  const happy = mood.choices.find(c => c.value === 'Happy');
  assert.ok(happy, 'Happy missing');
  assert.strictEqual(happy.label, 'Happy', 'emoji left in the label');
  assert.ok(happy.icon.length > 0, 'no icon');
});
t('no label starts with an emoji', () => {
  for (const type of TYPES) {
    for (const g of specForTask({ note_type: type }).groups) {
      for (const c of g.choices) {
        assert.ok(!/^\p{Extended_Pictographic}/u.test(c.label),
          `${type}.${g.key}: "${c.label}" still carries its emoji`);
        assert.ok(c.label.trim().length > 0, `${type}.${g.key} has an empty label`);
        assert.ok(c.icon.trim().length > 0, `${type}.${g.key}: "${c.label}" has no icon`);
      }
    }
  }
});

// ── The sentences ─────────────────────────────────────────────────────────
const PC = specForTask({ note_type: 'personal_care' });
const NU = specForTask({ note_type: 'nutrition' });
const RE = specForTask({ note_type: 'repositioning' });

t('one thing reads as a sentence', () => {
  assert.strictEqual(buildNote(PC, { bathing: ['Shower (assisted)'] }),
    'Washed with shower (assisted).');
});
t('two things get "and", not a comma', () => {
  assert.strictEqual(buildNote(PC, { bathing: ['Shower (assisted)', 'Sponge bath'] }),
    'Washed with shower (assisted) and Sponge bath.');
});
t('three or more read as a proper list', () => {
  assert.strictEqual(buildNote(PC, { oral: ['Own teeth brushed', 'Mouth rinse given', 'Upper dentures cleaned'] }),
    'Mouth care: Own teeth brushed, Mouth rinse given and Upper dentures cleaned.');
});
t('groups combine into one record', () => {
  const n = buildNote(PC, { bathing: ['Bed bath (full)'], skinCare: ['Skin intact — no concerns'] });
  assert.strictEqual(n, 'Washed with bed bath (full). Skin: Skin intact — no concerns.');
});
t('repositioning says where', () => {
  assert.strictEqual(buildNote(RE, { position: ['Left lateral'] }), 'Repositioned to left lateral.');
});
t('free text is appended and punctuated', () => {
  assert.strictEqual(buildNote(PC, { bathing: ['Sponge bath'] }, 'Asked after her daughter'),
    'Washed with sponge bath. Asked after her daughter.');
  assert.strictEqual(buildNote(PC, { bathing: ['Sponge bath'] }, 'Slept well.'),
    'Washed with sponge bath. Slept well.');
});
t('free text alone still makes a record', () => {
  assert.strictEqual(buildNote(PC, {}, 'Refused all care this morning'),
    'Refused all care this morning.');
});
t('nothing selected produces nothing', () => {
  assert.strictEqual(buildNote(PC, {}), '');
});
t('no double spaces or stray punctuation, anywhere', () => {
  for (const type of TYPES) {
    const spec = specForTask({ note_type: type });
    for (const g of spec.groups) {
      for (const c of g.choices) {
        const note = buildNote(spec, { [g.key]: [c.label] }, 'And a note');
        assert.ok(!/\s{2,}/.test(note), note);
        assert.ok(!/\.\./.test(note), note);
        assert.ok(!/\s\./.test(note), note);
        assert.ok(!/undefined|null|\[object/.test(note), note);
        assert.ok(note.endsWith('.'), note);
      }
    }
  }
});
t('abbreviations keep their capitals', () => {
  const n = buildNote(NU, { texture: ['IDDSI 4 – Puréed'] });
  assert.ok(/IDDSI/.test(n), n);
});

// ── The numbers that feed the charts ──────────────────────────────────────
t('appetite maps to a percentage', () => {
  assert.strictEqual(foodPercent(NU, { ate: ['Excellent — ate all'] }), 100);
  assert.strictEqual(foodPercent(NU, { ate: ['Good — ate most'] }), 75);
  assert.strictEqual(foodPercent(NU, { ate: ['Fair — ate half'] }), 50);
  assert.strictEqual(foodPercent(NU, { ate: ['Poor — very little'] }), 25);
  assert.strictEqual(foodPercent(NU, { ate: ['Refused meal'] }), 0);
});
t('nil by mouth is not zero eaten', () => {
  // NBM is a clinical instruction, not an amount. Recording it as 0% would drag
  // the malnutrition trend down and could trigger a MUST review that is wrong.
  assert.strictEqual(foodPercent(NU, { ate: ['NBM'] }), null);
});
t('not asking about food is not the same as eating nothing', () => {
  assert.strictEqual(foodPercent(NU, {}), null);
  assert.strictEqual(foodPercent(NU, { ate: ['Refused meal'] }), 0);
});
t('fluids map to millilitres', () => {
  assert.strictEqual(fluidMl({ drank: ['100ml'] }), 100);
  assert.strictEqual(fluidMl({ drank: ['250ml'] }), 250);
  assert.strictEqual(fluidMl({ drank: ['600ml+'] }), 600);
  assert.strictEqual(fluidMl({ drank: ['Nothing'] }), 0);
  assert.strictEqual(fluidMl({}), null);
});
t('mood comes back as the plain word', () => {
  const WB = specForTask({ note_type: 'social_wellbeing' });
  assert.strictEqual(moodOf(WB, { mood: ['Happy'] }), 'Happy');
  assert.strictEqual(moodOf(WB, {}), null);
});

// ── Exact fluid amounts (the slider) ──────────────────────────────────────
t('a custom amount like 120ml is recorded exactly', () => {
  assert.deepStrictEqual(fluidSelection(120), ['120ml']);
  assert.strictEqual(fluidMl({ drank: fluidSelection(120) }), 120);
  assert.strictEqual(fluidMl({ drank: fluidSelection(370) }), 370);
});
t('amounts snap to the 10ml step', () => {
  assert.strictEqual(clampFluid(123), 120);
  assert.strictEqual(clampFluid(125), 130);
  assert.strictEqual(clampFluid(4), 0);
});
t('amounts are clamped to a sensible range', () => {
  assert.strictEqual(clampFluid(-50), 0);
  assert.strictEqual(clampFluid(5000), FLUID_MAX_ML);
});
t('nonsense is not an amount', () => {
  assert.strictEqual(clampFluid('lots'), null);
  assert.strictEqual(clampFluid(NaN), null);
  assert.deepStrictEqual(fluidSelection(NaN), []);
});
t('not set and drank nothing stay different', () => {
  // Null keeps someone out of the dehydration trend; zero puts them in it.
  assert.deepStrictEqual(fluidSelection(null), []);
  assert.strictEqual(fluidMl({ drank: fluidSelection(null) }), null);
  assert.deepStrictEqual(fluidSelection(0), ['Nothing']);
  assert.strictEqual(fluidMl({ drank: fluidSelection(0) }), 0);
});
t('the fluid question uses the picker, not chips', () => {
  const g = specForTask({ note_type: 'nutrition' }).groups.find(x => x.key === 'drank');
  assert.strictEqual(g.kind, 'fluid');
  assert.ok(/actually/.test(g.prompt), 'the prompt must say "actually drink" — offered is not drunk');
});
t('a custom amount reads as English', () => {
  const NU2 = specForTask({ note_type: 'nutrition' });
  assert.strictEqual(buildNote(NU2, { drank: ['120ml'] }), 'Drank 120ml.');
  assert.strictEqual(buildNote(NU2, { drank: ['Nothing'] }), 'Drank nothing.');
  assert.strictEqual(buildNote(NU2, { drank: ['600ml+'] }), 'Drank 600ml or more.');
});

// ── When to write a note at all ───────────────────────────────────────────
t('nothing tapped means no note', () => {
  assert.strictEqual(hasAnything({}), false);
  assert.strictEqual(hasAnything({ bathing: [] }), false);
  assert.strictEqual(hasAnything({}, '   '), false);
});
t('anything tapped means a note', () => {
  assert.strictEqual(hasAnything({ bathing: ['Sponge bath'] }), true);
  assert.strictEqual(hasAnything({}, 'Seemed unwell'), true);
});

// ── Shape of every sheet ──────────────────────────────────────────────────
t('every prompt is a question', () => {
  for (const type of TYPES) {
    for (const g of specForTask({ note_type: type }).groups) {
      assert.ok(g.prompt.endsWith('?'), `${type}.${g.key}: "${g.prompt}"`);
    }
  }
});
t('choices are unique within a group', () => {
  for (const type of TYPES) {
    for (const g of specForTask({ note_type: type }).groups) {
      const labels = g.choices.map(c => c.label);
      assert.strictEqual(new Set(labels).size, labels.length, `${type}.${g.key} has a duplicate`);
    }
  }
});

console.log(`\nquick options: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
