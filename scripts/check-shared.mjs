#!/usr/bin/env node
/**
 * The app's copy of the assessment tools and care plan details must be exactly
 * the server's. Fix with: node scripts/sync-shared.mjs
 * Exit 0 = identical. 1 = drifted or missing.
 */
import { existsSync, readFileSync } from 'node:fs';
import { SHARED, dst, expected } from './sync-shared.mjs';
let bad = 0;
for (const f of SHARED) {
  if (!existsSync(dst(f))) { console.error(`frontend/src/shared/${f} is missing. Run: node scripts/sync-shared.mjs`); bad++; continue; }
  if (readFileSync(dst(f), 'utf8') !== expected(f)) { console.error(`frontend/src/shared/${f} differs from backend/src/services/${f}. Edit the backend copy, then run: node scripts/sync-shared.mjs`); bad++; }
}
if (bad) process.exit(1);
console.log(`shared modules: ${SHARED.length} in step`);
