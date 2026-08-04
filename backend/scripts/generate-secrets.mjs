// Generates strong secrets for production. Usage: node scripts/generate-secrets.mjs
import { randomBytes } from 'node:crypto';
const s = () => randomBytes(48).toString('base64url');
console.log('\n# Paste into your production environment (never commit these):');
console.log('JWT_SECRET=' + s());
console.log('JWT_REFRESH_SECRET=' + s());
console.log('\n# Rotate any credential that was ever committed to the repo.\n');
