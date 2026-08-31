#!/usr/bin/env node
/**
 * Sensor simulator.
 *
 * Sends a realistic night of observations to the ingestion endpoint using a
 * real device key, so the whole path — device auth, consent check, ingestion,
 * inference, night report — can be demonstrated and tested before any hardware
 * exists.
 *
 * It sends exactly what the firmware will send: event labels and numbers.
 * Never audio, never images. If this simulator cannot produce a useful night
 * report from labels alone, neither will the hardware, and that is worth
 * knowing before anything is bought.
 *
 *   node scripts/simulate-sensor.mjs --key cvs_xxx --api http://localhost:3001/api [--scenario settled|restless|fall|chest]
 */

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1]]);
    return acc;
  }, []));

const API = args.api || process.env.API || 'http://localhost:3001/api';
const KEY = args.key || process.env.DEVICE_KEY;
const SCENARIO = args.scenario || 'restless';

if (!KEY) {
  console.error('A device key is required. Register a device in the app, then:\n' +
                '  node scripts/simulate-sensor.mjs --key cvs_...');
  process.exit(1);
}

// Last night, 20:00 → 08:00.
const base = new Date();
base.setDate(base.getDate() - 1);
base.setHours(20, 0, 0, 0);
const at = (mins) => new Date(base.getTime() + mins * 60000).toISOString();

function build(scenario) {
  const o = [];
  const push = (mins, signal, event_label = null, confidence = null, value = null) =>
    o.push({ observedAt: at(mins), signal, eventLabel: event_label, confidence, value });

  push(0, 'presence');
  push(60, 'bed_occupied');                       // settled about 21:00

  if (scenario === 'settled') {
    [180, 300, 420, 540].forEach(m => push(m, 'motion'));
    push(660, 'bed_exit');                        // up at 07:00
    return o;
  }

  if (scenario === 'fall') {
    push(330, 'bed_exit');                        // 01:30
    push(332, 'sound_event', 'fall_impact', 0.82);
    push(333, 'sound_event', 'call_out', 0.9);
    // deliberately never returns to bed
    [335, 340, 350].forEach(m => push(m, 'motion'));
    return o;
  }

  if (scenario === 'chest') {
    for (let i = 0; i < 7; i++) push(200 + i * 7, 'sound_event', 'cough', 0.85 + i * 0.01);
    [210, 230, 260].forEach(m => push(m, 'motion'));
    push(600, 'bed_exit'); push(615, 'bed_occupied');
    return o;
  }

  // restless: several wakings, one long trip, a low-confidence noise that
  // should deliberately NOT raise an alert
  [120, 150, 200, 240, 280, 300, 340, 380, 400, 430, 470, 500, 540].forEach(m => push(m, 'motion'));
  push(210, 'bed_exit'); push(228, 'bed_occupied');        // 18 minutes
  push(390, 'bed_exit'); push(445, 'bed_occupied');        // 55 minutes — urgent
  push(392, 'sound_event', 'call_out', 0.74);
  push(500, 'sound_event', 'speech', 0.35);                // below threshold
  push(690, 'bed_exit');
  return o;
}

const observations = build(SCENARIO);

const res = await fetch(`${API}/sensing/ingest`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({ observations, battery: 87, firmware: 'sim-1.0.0' }),
});

const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Ingestion refused (${res.status}):`, body.error || body);
  process.exit(1);
}

console.log(`Scenario "${SCENARIO}": sent ${observations.length} observations, stored ${body.stored}.`);
console.log(`Night of ${base.toISOString().slice(0, 10)}.`);
console.log('\nNow open Night Sensing in the app, or call:');
console.log(`  GET ${API}/sensing/night/<residentId>?night=${base.toISOString().slice(0, 10)}`);
