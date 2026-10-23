// Rate limits (spec 16.1, stage 6), shared by every Vercel instance through Supabase (migration 003).
// Per user is the main limit; per IP is about 3x higher, because a whole venue on one Wi-Fi shares
// one IP address. A global OCR budget keeps photo scans under the Azure free tier (20 calls a minute
// for everyone together). If Supabase is missing, down or slow, a per-instance memory counter is
// used instead: a limit check never blocks or breaks a scan, and it never touches a verdict.
// Keys are hashed before they leave the server, so the database never holds a raw IP address.

import 'server-only';
import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../db/supabaseAdmin.js';
import { logError } from './log.js';
import { withTimeout } from './timeout.js';

const MIN = 60;
const DAY = 86400;
export const OCR_WINDOW_SEC = 15; // short windows, so "busy" clears in seconds, not a minute

// rule: { name, key, windowSec, limit, cost? }. name is the database bucket and what a 429 reports.
export function rulesFor(group, { userId = null, ip = null } = {}) {
  const user = (name, limit, windowSec = MIN) => (userId ? [{ name, key: 'u:' + userId, windowSec, limit }] : []);
  const byIp = (name, limit) => [{ name, key: 'ip:' + (ip || 'unknown'), windowSec: MIN, limit }];
  switch (group) {
    case 'scan':
      return [
        ...user('scan_user_min', env.SCAN_RATE_LIMIT_PER_MIN),
        ...user('scan_user_day', env.SCAN_RATE_LIMIT_PER_DAY, DAY),
        ...byIp('scan_ip_min', env.IP_RATE_LIMIT_PER_MIN),
      ];
    case 'explain':
      return [...user('explain_user_min', env.EXPLAIN_RATE_LIMIT_PER_MIN), ...byIp('explain_ip_min', env.IP_RATE_LIMIT_PER_MIN)];
    case 'feedback':
      return [...user('feedback_user_min', env.FEEDBACK_RATE_LIMIT_PER_MIN), ...byIp('feedback_ip_min', env.IP_RATE_LIMIT_PER_MIN)];
    case 'insights':
      return byIp('insights_ip_min', env.INSIGHTS_IP_RATE_LIMIT_PER_MIN);
    default:
      throw new Error('unknown rate-limit group: ' + group);
  }
}

// One photo scan reserves OCR_CALLS_PER_SCAN of the global Azure budget, counted in 15-second slices.
export function ocrRule() {
  const cost = Math.max(1, env.OCR_CALLS_PER_SCAN);
  const limit = Math.max(cost, Math.floor((env.OCR_CALLS_PER_MIN * OCR_WINDOW_SEC) / MIN));
  return { name: 'ocr_global', key: 'global', windowSec: OCR_WINDOW_SEC, limit, cost };
}

const hashKey = (key) =>
  createHash('sha256').update((env.SUPABASE_SERVICE_ROLE_KEY || 'local') + '\n' + key).digest('hex').slice(0, 32);
const windowStart = (now, sec) => Math.floor(now / 1000 / sec) * sec * 1000;

class NotConfigured extends Error {}

// Shared counters: one call to hit_rate_limits (migration 003) for all of a request's rules.
export const supabaseStore = {
  async hit(rules) {
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new NotConfigured();
    const { data, error } = await supabaseAdmin().rpc('hit_rate_limits', {
      p_buckets: rules.map((r) => r.name),
      p_keys: rules.map((r) => hashKey(r.key)),
      p_windows: rules.map((r) => r.windowSec),
      p_costs: rules.map((r) => r.cost ?? 1),
    });
    if (error) throw new Error(error.message || 'rate limit call failed');
    return rules.map((r) => {
      const row = (data || []).find((d) => d.bucket === r.name);
      if (!row) throw new Error('rate limit reply is missing ' + r.name);
      return { count: Number(row.count), resetAt: Date.parse(row.reset_at) };
    });
  },
};

// Per-instance counters: the fallback, and what local development without Supabase uses.
export function memoryStore({ now = () => Date.now(), maxEntries = 5000 } = {}) {
  const counts = new Map(); // "bucket|key|windowStart" -> { count, resetAt }
  return {
    async hit(rules) {
      const t = now();
      if (counts.size > maxEntries) for (const [k, v] of counts) if (v.resetAt <= t) counts.delete(k);
      return rules.map((r) => {
        const start = windowStart(t, r.windowSec);
        const id = `${r.name}|${r.key}|${start}`;
        const entry = counts.get(id) || { count: 0, resetAt: start + r.windowSec * 1000 };
        entry.count += r.cost ?? 1;
        counts.set(id, entry);
        return { ...entry };
      });
    },
  };
}

const memory = memoryStore();

// -> { allowed: true } or { allowed: false, limit, retryAfterSec }.
// deps (tests): { store, fallback, timeoutMs, now }
export async function hitRules(rules, deps = {}) {
  if (!rules.length) return { allowed: true };
  const fallback = deps.fallback || memory;
  let counts;
  try {
    counts = await withTimeout((deps.store || supabaseStore).hit(rules), deps.timeoutMs ?? env.RATE_LIMIT_TIMEOUT_MS, 'rate_limit');
  } catch (err) {
    if (!(err instanceof NotConfigured)) logError('rate_limit', err);
    counts = await fallback.hit(rules);
  }
  const t = deps.now ? deps.now() : Date.now();
  let worst = null;
  rules.forEach((r, i) => {
    if (counts[i].count <= r.limit) return;
    const retryAfterSec = Math.max(1, Math.ceil((counts[i].resetAt - t) / 1000));
    if (!worst || retryAfterSec > worst.retryAfterSec) worst = { limit: r.name, retryAfterSec };
  });
  return worst ? { allowed: false, ...worst } : { allowed: true };
}

export const checkRateLimit = (group, who, deps) => hitRules(rulesFor(group, who), deps);

// Before each Azure call: is there room in the global budget? Same shape as checkRateLimit.
export const reserveOcrScan = (deps) => hitRules([ocrRule()], deps);
