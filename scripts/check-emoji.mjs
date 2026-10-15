#!/usr/bin/env node
/**
 * No emoji newer than Emoji 12 (2019) in the app.
 *
 * Care homes run older Android phones and Windows 10 PCs. Emoji added in 2020
 * or later (🫖 teapot, 🫁 lungs, 🫶 heart hands, 😮‍💨 …) show there as an
 * empty box — a carer saw "☐ Afternoon Tea". Pictures are how carers find an
 * option quickly, so a blank one is a real problem, not a cosmetic one.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'frontend/src');
const EMOJI12_IN_BLOCK = new Set([0x1FA70, 0x1FA71, 0x1FA72, 0x1FA73, 0x1FA78, 0x1FA79, 0x1FA7A,
  0x1FA80, 0x1FA81, 0x1FA82, 0x1FA90, 0x1FA91, 0x1FA92, 0x1FA93, 0x1FA94, 0x1FA95]);
const NEWER = new Set([0x1F972, 0x1F977, 0x1F978, 0x1F9A3, 0x1F9A4, 0x1F9AB, 0x1F9AC, 0x1F9AD, 0x1F9CB, 0x1F90C, 0x1F7F0,
  0x1F6D6, 0x1F6D7, 0x1F6DC, 0x1F6DD, 0x1F6DE, 0x1F6DF, 0x1F979, 0x1F9CC]);
const tooNew = cp => (cp >= 0x1FA70 && cp <= 0x1FAFF && !EMOJI12_IN_BLOCK.has(cp)) || NEWER.has(cp);
const NEW_SEQ = ['😮‍💨', '😵‍💫', '😶‍🌫', '❤️‍🔥', '❤️‍🩹'];

function* files(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(tsx?|css)$/.test(e)) yield p;
  }
}
let n = 0, scanned = 0;
for (const f of files(src)) {
  scanned++;
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    const bad = [...line].filter(ch => tooNew(ch.codePointAt(0)));
    const seq = NEW_SEQ.filter(s => line.includes(s));
    if (bad.length || seq.length) { n++; console.error(`${relative(root, f)}:${i + 1}  ${[...bad, ...seq].join(' ')}  — shows as a blank box on older phones`); }
  });
}
// Self-test
if (!tooNew(0x1FAD6) || tooNew(0x1FA7A) || tooNew(0x1F600)) { console.error('check-emoji self-test failed'); process.exit(2); }
if (n) { console.error(`\n${n} line(s) use emoji too new for older phones. Pick an older one.`); process.exit(1); }
console.log(`Checked ${scanned} files: no emoji newer than 2019 (self-test passed).`);
