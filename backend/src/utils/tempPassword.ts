// ────────────────────────────────────────────────────────────────────────────
// Temporary passwords for new staff accounts.
//
// A care home office has no email server, so a new starter cannot be sent a
// sign-up link. The manager is shown a one-time password to hand over, and the
// account carries must_change_password so the app forces a change at first
// sign-in — after which nobody but the person knows their password.
//
// Design choices that matter:
//  • crypto.randomInt, not Math.random. Math.random is not a CSPRNG, and this
//    string is the only thing standing between a stranger and health records.
//  • No 0/O/1/l/I. These get read aloud and written on paper; a password that
//    cannot be transcribed reliably gets written on a sticky note instead.
//  • Grouped with hyphens for the same reason.
// ────────────────────────────────────────────────────────────────────────────
import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

export function makeTemporaryPassword(groups = 3, groupSize = 4): string {
  const parts: string[] = [];
  for (let g = 0; g < groups; g++) {
    let s = '';
    for (let i = 0; i < groupSize; i++) s += ALPHABET[randomInt(ALPHABET.length)];
    parts.push(s);
  }
  return parts.join('-');
}
