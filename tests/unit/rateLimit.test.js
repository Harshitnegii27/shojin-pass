// Rate limits (stage 6): per user is the main limit, per IP ~3x higher (one venue Wi-Fi = one IP),
// a global OCR budget for the Azure free tier, and a memory fallback when Supabase fails. No network.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { rulesFor, ocrRule, memoryStore, hitRules, checkRateLimit, reserveOcrScan, OCR_WINDOW_SEC } from '../../lib/http/rateLimit.js';
import { clientIp } from '../../lib/http/clientIp.js';
import { secretMatches, bearerToken } from '../../lib/http/secret.js';

afterEach(() => vi.restoreAllMocks());

const T0 = Date.UTC(2026, 9, 24, 3, 0, 0); // aligned to every window
const clock = (t = T0) => { const c = { t, now: () => c.t }; return c; };
const limitOf = (rules, name) => rules.find((r) => r.name === name).limit;

describe('limits: per user first, per IP much higher', () => {
  it('defaults: scan 20/min and 300/day per user, 180/min per IP', () => {
    const r = rulesFor('scan', { userId: 'u1', ip: '1.2.3.4' });
    expect(limitOf(r, 'scan_user_min')).toBe(20);
    expect(limitOf(r, 'scan_user_day')).toBe(300);
    expect(limitOf(r, 'scan_ip_min')).toBe(180);
    expect(r.find((x) => x.name === 'scan_user_day').windowSec).toBe(86400);
  });

  it('explain 30, feedback 20 per user; both 180 per IP; insights 90 per IP only', () => {
    expect(limitOf(rulesFor('explain', { userId: 'u', ip: 'x' }), 'explain_user_min')).toBe(30);
    expect(limitOf(rulesFor('feedback', { userId: 'u', ip: 'x' }), 'feedback_user_min')).toBe(20);
    expect(limitOf(rulesFor('explain', { userId: 'u', ip: 'x' }), 'explain_ip_min')).toBe(180);
    expect(limitOf(rulesFor('feedback', { userId: 'u', ip: 'x' }), 'feedback_ip_min')).toBe(180);
    expect(rulesFor('insights', { ip: 'x' })).toEqual([{ name: 'insights_ip_min', key: 'ip:x', windowSec: 60, limit: 90 }]);
  });

  it('every per-IP limit is at least 3x the per-user minute limit', () => {
    for (const g of ['scan', 'explain', 'feedback']) {
      const r = rulesFor(g, { userId: 'u', ip: 'x' });
      expect(limitOf(r, `${g}_ip_min`)).toBeGreaterThanOrEqual(3 * limitOf(r, `${g}_user_min`));
    }
  });

  it('no session: per IP only; unknown IPs share one key', () => {
    expect(rulesFor('scan', { userId: null, ip: null }).map((r) => r.key)).toEqual(['ip:unknown']);
  });

  it('unknown group is a programming error', () => {
    expect(() => rulesFor('nope', {})).toThrow(/unknown rate-limit group/);
  });

  it('one shared Wi-Fi: 8 people x 20 scans is fine; the 21st scan of one person is not', async () => {
    const c = clock();
    const store = memoryStore({ now: c.now });
    const deps = { store, now: c.now };
    for (let p = 0; p < 8; p++) {
      for (let i = 0; i < 20; i++) expect((await checkRateLimit('scan', { userId: 'p' + p, ip: 'venue' }, deps)).allowed).toBe(true);
    }
    const r = await checkRateLimit('scan', { userId: 'p0', ip: 'venue' }, deps);
    expect(r).toMatchObject({ allowed: false, limit: 'scan_user_min' });
    expect((await checkRateLimit('scan', { userId: 'p9', ip: 'venue' }, deps)).allowed).toBe(true);
  });
});

describe('memory store and retry-after', () => {
  it('counts per window and tells how long until it resets', async () => {
    const c = clock(T0 + 45_000);
    const deps = { store: memoryStore({ now: c.now }), now: c.now };
    const rule = [{ name: 'b', key: 'k', windowSec: 60, limit: 2 }];
    expect((await hitRules(rule, deps)).allowed).toBe(true);
    expect((await hitRules(rule, deps)).allowed).toBe(true);
    expect(await hitRules(rule, deps)).toEqual({ allowed: false, limit: 'b', retryAfterSec: 15 });
    c.t = T0 + 60_000; // next window
    expect((await hitRules(rule, deps)).allowed).toBe(true);
  });

  it('reports the longest wait when several limits are hit', async () => {
    const c = clock(T0 + 10_000);
    const deps = { store: memoryStore({ now: c.now }), now: c.now };
    const rules = [{ name: 'min', key: 'k', windowSec: 60, limit: 0 }, { name: 'day', key: 'k', windowSec: 86400, limit: 0 }];
    expect(await hitRules(rules, deps)).toMatchObject({ allowed: false, limit: 'day' });
  });

  it('drops expired entries once it grows past maxEntries', async () => {
    const c = clock();
    const store = memoryStore({ now: c.now, maxEntries: 2 });
    for (let i = 0; i < 3; i++) await store.hit([{ name: 'b', key: 'k' + i, windowSec: 1 }]);
    c.t += 5000;
    await store.hit([{ name: 'b', key: 'k0', windowSec: 1 }]);
    expect((await store.hit([{ name: 'b', key: 'k0', windowSec: 1 }]))[0].count).toBe(2);
  });
});

describe('Supabase trouble never blocks a request', () => {
  it('store error -> memory fallback, one log line without keys', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fallback = memoryStore();
    const r = await hitRules([{ name: 'b', key: 'u:secret-user', windowSec: 60, limit: 5 }], { store: { hit: async () => { throw new Error('db down'); } }, fallback });
    expect(r.allowed).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('"op":"rate_limit"');
    expect(spy.mock.calls[0][0]).not.toContain('secret-user');
  });

  it('slow store -> gives up after the timeout and uses memory', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const started = Date.now();
    const r = await hitRules([{ name: 'b', key: 'k', windowSec: 60, limit: 5 }], { store: { hit: () => new Promise(() => {}) }, fallback: memoryStore(), timeoutMs: 30 });
    expect(r.allowed).toBe(true);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('Supabase not configured (tests, bare laptop): memory, silently', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await checkRateLimit('insights', { ip: 'x' }, { fallback: memoryStore() })).allowed).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('global OCR budget (Azure free tier: 20 calls a minute for everyone)', () => {
  it('defaults: 18 calls a minute, 2 per scan, counted in 15-second slices -> 2 scans per slice', () => {
    expect(OCR_WINDOW_SEC).toBe(15);
    expect(ocrRule()).toEqual({ name: 'ocr_global', key: 'global', windowSec: 15, limit: 4, cost: 2 });
  });

  it('the third photo scan in one slice is told to wait a few seconds', async () => {
    const c = clock(T0 + 3000);
    const deps = { store: memoryStore({ now: c.now }), now: c.now };
    expect((await reserveOcrScan(deps)).allowed).toBe(true);
    expect((await reserveOcrScan(deps)).allowed).toBe(true);
    const r = await reserveOcrScan(deps);
    expect(r).toEqual({ allowed: false, limit: 'ocr_global', retryAfterSec: 12 });
    c.t = T0 + 15_000;
    expect((await reserveOcrScan(deps)).allowed).toBe(true);
  });

  it('a whole minute stays under 20 calls', async () => {
    const c = clock();
    const deps = { store: memoryStore({ now: c.now }), now: c.now };
    let allowed = 0;
    for (let s = 0; s < 60; s++) {
      c.t = T0 + s * 1000;
      for (let i = 0; i < 5; i++) if ((await reserveOcrScan(deps)).allowed) allowed++;
    }
    expect(allowed * ocrRule().cost).toBeLessThanOrEqual(20);
    expect(allowed).toBe(8);
  });
});

describe('client IP and secrets', () => {
  const req = (h) => new Request('http://x/', { headers: h });
  it('takes the first address Vercel forwards', () => {
    expect(clientIp(req({ 'x-vercel-forwarded-for': '9.9.9.9, 1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('9.9.9.9');
    expect(clientIp(req({ 'x-forwarded-for': ' 2.2.2.2 , 3.3.3.3' }))).toBe('2.2.2.2');
    expect(clientIp(req({ 'x-real-ip': '4.4.4.4' }))).toBe('4.4.4.4');
    expect(clientIp(req({}))).toBeNull();
    expect(clientIp(undefined)).toBeNull();
  });

  it('secretMatches: exact match only; unset secret never matches', () => {
    const s = 'a'.repeat(40);
    expect(secretMatches(s, s)).toBe(true);
    expect(secretMatches(s + 'b', s)).toBe(false);
    expect(secretMatches('', '')).toBe(false);
    expect(secretMatches(undefined, undefined)).toBe(false);
    expect(secretMatches(s, undefined)).toBe(false);
  });

  it('bearerToken', () => {
    expect(bearerToken(req({ authorization: 'Bearer abc123' }))).toBe('abc123');
    expect(bearerToken(req({ authorization: 'bearer abc123' }))).toBe('abc123');
    expect(bearerToken(req({ authorization: 'Basic abc' }))).toBeNull();
    expect(bearerToken(req({}))).toBeNull();
  });
});
