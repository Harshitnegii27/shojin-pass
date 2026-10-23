// The rate-limit step every limited route runs first: null to carry on, or the 429 reply
// { error: { code: "RATE_LIMITED", message, retryAfterSec, limit } } with a Retry-After header.

import { clientIp } from './clientIp.js';
import { checkRateLimit } from './rateLimit.js';
import { fail } from './respond.js';

export async function limitRequest(group, req, user, deps) {
  const r = await checkRateLimit(group, { userId: user?.id ?? null, ip: clientIp(req) }, deps);
  return r.allowed ? null : fail('RATE_LIMITED', { retryAfterSec: r.retryAfterSec, limit: r.limit });
}
