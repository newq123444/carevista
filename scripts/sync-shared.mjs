#!/usr/bin/env node
/**
 * Copies the modules the server and the app must agree on exactly.
 *
 * The server scores every assessment itself and stores its own result; the app
 * scores as the nurse answers so they see the result live. If the two copies
 * drifted, the nurse would see one score and the record would hold another.
 * So there is one source (backend), one generated copy (frontend), and
 * `npm run check` (scripts/check-shared.mjs) fails if they differ.
 *
 *   node scripts/sync-shared.mjs          write the copies
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SHARED = ['assessmentCore.ts', 'assessmentTools.ts', 'assessmentToolsMore.ts', 'homeSafetyTools.ts', 'careDetails.ts', 'customAssessments.ts'];
export const HEADER = '// GENERATED from backend/src/services by scripts/sync-shared.mjs — do not edit here.\n';
export const src = f => join(root, 'backend/src/services', f);
export const dst = f => join(root, 'frontend/src/shared', f);
export const expected = f => HEADER + readFileSync(src(f), 'utf8');

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(join(root, 'frontend/src/shared'), { recursive: true });
  for (const f of SHARED) { writeFileSync(dst(f), expected(f)); console.log(`wrote frontend/src/shared/${f}`); }
}
