#!/usr/bin/env node
/**
 * Touch-target guard for the simplified screens.
 *
 * These screens are used one-handed, in a corridor, by someone wearing nitrile
 * gloves. Gloves work on capacitive screens but imprecisely, so a control that
 * is merely "big enough" by desktop standards is not big enough here.
 *
 * WCAG 2.5.5 asks for 44px. This asks for 64px on the simple screens, because
 * the failure mode is not inconvenience — it is a carer mis-tapping and either
 * recording care that did not happen or failing to record care that did.
 *
 * It cannot check what things actually look like. Nothing here replaces opening
 * the app on a real phone.
 *
 * Exit 0 = clean. Exit 1 = targets too small. Exit 2 = could not run.
 */
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = [
  join(root, 'frontend/src/pages/simple'),
  join(root, 'frontend/src/components/SwipeCard.tsx'),
  join(root, 'frontend/src/components/FluidPicker.tsx'),
  join(root, 'frontend/src/components/PrnFollowups.tsx'),
];
const MIN_TARGET = 64;   // px, gloved use
const MIN_FONT = 13;     // px, readable at arm's length

function files(p, out = []) {
  if (!existsSync(p)) return out;
  if (statSync(p).isFile()) { out.push(p); return out; }
  for (const e of readdirSync(p)) files(join(p, e), out);
  return out;
}

/**
 * Find every <button …> opening tag with its inline style, tolerating the
 * attributes and newlines that sit between the tag name and the style prop.
 */
function buttons(src) {
  const out = [];
  const re = /<button\b/g;
  let m;
  while ((m = re.exec(src))) {
    // Walk to the matching '>' that closes the opening tag, tracking braces so
    // a '>' inside a style expression does not end it early.
    let i = m.index + 7, depth = 0;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push({ tag: src.slice(m.index, i + 1), line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

const targets = DIRS.flatMap(d => files(d));
if (targets.length === 0) { console.error('No simple-mode files found.'); process.exit(2); }

// Self-test: prove the parser sees a button and reads its minHeight.
const probe = buttons(`<button style={{ minHeight: 20, color: 'red' }}>x</button>`);
if (probe.length !== 1 || !/minHeight:\s*20/.test(probe[0].tag)) {
  console.error('Self-test failed: the button parser is broken. Not reporting a pass.');
  process.exit(2);
}

let problems = 0, checked = 0;
for (const f of targets) {
  const src = readFileSync(f, 'utf8');
  const rel = f.replace(root + '/', '');

  for (const b of buttons(src)) {
    checked++;
    const mh = /minHeight:\s*(\d+(?:\.\d+)?)/.exec(b.tag);
    const h  = /(?:^|[^n])\bheight:\s*(\d+(?:\.\d+)?)/.exec(b.tag);
    const size = mh ? Number(mh[1]) : h ? Number(h[1]) : null;

    if (size === null) {
      console.error(`${rel}:${b.line}  button has no minHeight — set one, gloved taps need a known target`);
      problems++;
    } else if (size < MIN_TARGET) {
      // A plain text link ("← Back", "Cancel") is allowed 44, the WCAG floor.
      const textual = /background:\s*['"]?(none|transparent)/.test(b.tag);
      const floor = textual ? 44 : MIN_TARGET;
      if (size < floor) {
        console.error(`${rel}:${b.line}  button minHeight ${size}px is below ${floor}px`);
        problems++;
      }
    }
  }

  for (const m of src.matchAll(/fontSize:\s*(\d+(?:\.\d+)?)/g)) {
    const px = Number(m[1]);
    if (px < MIN_FONT) {
      const line = src.slice(0, m.index).split('\n').length;
      console.error(`${rel}:${line}  fontSize ${px}px is below ${MIN_FONT}px for a simplified screen`);
      problems++;
    }
  }
}

if (problems) {
  console.error(`\n${problems} touch-target or legibility problem(s) on the simplified screens.`);
  process.exit(1);
}
console.log(`Checked ${checked} buttons across ${targets.length} simplified screens.`);
console.log(`All targets >= ${MIN_TARGET}px (44px for plain text links). This does not check how it looks —`);
console.log('open it on a real phone before showing it to anyone.');
