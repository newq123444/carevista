// src/utils/nhsNumber.ts
//
// NHS numbers carry a check digit. Validating it catches transposed digits at
// the point of entry rather than at the point where a record cannot be matched
// to the right person — which is the moment it becomes a safety problem.
//
// Modulus 11, per the NHS Data Dictionary:
//   multiply the first 9 digits by weights 10..2, sum, take 11 - (sum mod 11).
//   11 becomes 0; 10 is invalid and means no such NHS number exists.

/** Strip spaces and dashes; NHS numbers are usually written 123 456 7890. */
export function normaliseNhsNumber(input: string): string {
  return String(input || '').replace(/[\s-]/g, '');
}

export function isValidNhsNumber(input: string): boolean {
  const digits = normaliseNhsNumber(input);
  if (!/^\d{10}$/.test(digits)) return false;

  // A number made of one repeated digit passes the checksum but is never real.
  if (/^(\d)\1{9}$/.test(digits)) return false;

  let total = 0;
  for (let i = 0; i < 9; i++) total += Number(digits[i]) * (10 - i);
  const remainder = total % 11;
  let check = 11 - remainder;
  if (check === 11) check = 0;
  if (check === 10) return false;
  return check === Number(digits[9]);
}

/** Format for display: 123 456 7890. */
export function formatNhsNumber(input: string): string {
  const d = normaliseNhsNumber(input);
  return /^\d{10}$/.test(d) ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : input;
}

export default isValidNhsNumber;
