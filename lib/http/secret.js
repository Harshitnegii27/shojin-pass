// Secret header checks for the cron and deep-health routes (spec 16.1): constant-time comparison.
// Both sides are hashed first so timingSafeEqual always compares equal lengths.

import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (s) => createHash('sha256').update(s).digest();

// False when either side is missing or empty, so an unset secret never lets anyone in.
export function secretMatches(given, expected) {
  if (typeof given !== 'string' || !given || typeof expected !== 'string' || !expected) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

// The token from "Authorization: Bearer <token>", or null.
export function bearerToken(req) {
  const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get('authorization') || '');
  return m ? m[1] : null;
}
