// Scanning must never depend on Supabase (stage 2): a failed or slow login, profile load or
// save still returns the verdict, logs the error, and never turns a result green.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { rb, label } from '../helpers.js';
import { runScan, FALLBACK_DIET } from '../../lib/scan/scanService.js';
import { getUser } from '../../lib/auth/getUser.js';

const USER = { id: '11111111-1111-1111-1111-111111111111', isAnonymous: true, client: null };
const LARD = label('小麦粉、ラード');
const SAFE = label('小麦粉、砂糖、食塩');
const MIRIN = label('しょうゆ、みりん');
const text = (t) => ({ kind: 'text', text: t });
const hang = () => new Promise(() => {});
const boom = (msg) => () => Promise.reject(new Error(msg));

function logSpy() {
  return vi.spyOn(console, 'error').mockImplementation(() => {});
}
const loggedOps = (spy) => spy.mock.calls.map((c) => JSON.parse(c[0]).op);

afterEach(() => vi.restoreAllMocks());

describe('runScan without Supabase', () => {
  it('no session: verdict returned, nothing saved, nothing logged', async () => {
    const log = logSpy();
    const saveScan = vi.fn();
    const r = await runScan({ input: text(LARD), user: null, preset: 'vegetarian' }, { rulebook: rb, saveScan });
    expect(r.verdict).toBe('red');
    expect(r.scanId).toBeNull();
    expect(saveScan).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });

  it('save fails: verdict still returned, scanId null, error logged', async () => {
    const log = logSpy();
    for (const [t, want] of [[LARD, 'red'], [SAFE, 'green']]) {
      const r = await runScan({ input: text(t), user: USER, preset: 'vegetarian' }, { rulebook: rb, saveScan: boom('connection refused') });
      expect(r.verdict).toBe(want);
      expect(r.scanId).toBeNull();
    }
    expect(loggedOps(log)).toEqual(['save_scan', 'save_scan']);
  });

  it('save hangs: gives up after the timeout and still returns the verdict', async () => {
    const log = logSpy();
    const started = Date.now();
    const r = await runScan({ input: text(LARD), user: USER, preset: 'vegetarian' }, { rulebook: rb, saveScan: hang, timeoutMs: 50 });
    expect(r.verdict).toBe('red');
    expect(r.scanId).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ op: 'save_scan', message: expect.stringMatching(/timed out/) });
  });

  it('save works: scanId returned and the row holds verdict, reasons and matched ingredients only', async () => {
    const saveScan = vi.fn(async () => 'scan-1');
    const r = await runScan({ input: text(LARD), user: USER, preset: 'vegetarian', lang: 'hi' }, { rulebook: rb, saveScan });
    expect(r.scanId).toBe('scan-1');
    const row = saveScan.mock.calls[0][0];
    expect(row).toMatchObject({ user_id: USER.id, source: 'text', diet_preset: 'vegetarian', language: 'hi', verdict: 'red', reasons: ['FORBIDDEN_INGREDIENT'], rulebook_version: rb.version });
    expect(row.items.map((i) => i.ingredientId)).toContain('lard');
    expect(JSON.stringify(row)).not.toContain('原材料名'); // no label text stored
  });

  it('the diet in the request wins and does not touch Supabase', async () => {
    const loadProfile = vi.fn();
    const r = await runScan({ input: text(MIRIN), user: USER, preset: 'jain_flexible', options: [] }, { rulebook: rb, loadProfile, saveScan: async () => 'x' });
    expect(r.verdict).toBe('amber');
    expect(r.dietSource).toBe('request');
    expect(loadProfile).not.toHaveBeenCalled();
  });

  it('no diet in the request: uses the saved profile', async () => {
    const r = await runScan({ input: text(MIRIN), user: USER }, { rulebook: rb, loadProfile: async () => ({ preset: 'jain_flexible', options: [], lang: 'gu' }), saveScan: async () => 'x' });
    expect(r.dietSource).toBe('saved');
    expect(r.profile.preset).toBe('jain_flexible');
    expect(r.verdict).toBe('amber');
  });

  it.each([
    ['no session', null, undefined],
    ['profile load fails', USER, boom('db down')],
    ['profile load hangs', USER, hang],
    ['no saved profile', USER, async () => null],
  ])('no diet and %s: falls back to the strictest diet, never a false safe', async (_, user, loadProfile) => {
    logSpy();
    const deps = { rulebook: rb, loadProfile, saveScan: async () => 'x', timeoutMs: 50 };
    const r = await runScan({ input: text(MIRIN), user }, deps);
    expect(r.dietSource).toBe('fallback');
    expect(r.profile).toEqual({ preset: FALLBACK_DIET.preset, options: FALLBACK_DIET.options });
    expect(r.verdict).toBe('red'); // mirin is red for jain_strict even though it is only amber for jain_flexible
  });

  it('the fallback diet is at least as strict as every preset with every option', async () => {
    const labels = [MIRIN, label('玉ねぎ'), label('でん粉'), label('はちみつ'), label('しいたけ'), label('卵'), label('小麦粉、砂糖'), label('砂糖') + '\n本品製造工場では卵を含む製品を生産しています。'];
    const RANK = { green: 0, amber: 1, red: 2 };
    for (const l of labels) {
      const fb = await runScan({ input: text(l), user: null }, { rulebook: rb });
      for (const preset of Object.keys(rb.diets)) {
        const r = await runScan({ input: text(l), user: null, preset, options: Object.keys(rb.options) }, { rulebook: rb });
        expect(RANK[fb.verdict], `${l} / ${preset}`).toBeGreaterThanOrEqual(RANK[r.verdict]);
      }
    }
  });
});

describe('getUser never throws', () => {
  const clientWith = (getClaims) => ({ auth: { getClaims } });

  it('valid session', async () => {
    const client = clientWith(async () => ({ data: { claims: { sub: USER.id, role: 'authenticated', is_anonymous: true } }, error: null }));
    expect(await getUser({ client })).toMatchObject({ id: USER.id, isAnonymous: true });
  });

  it('no session: null, not logged', async () => {
    const log = logSpy();
    const err = Object.assign(new Error('Auth session missing!'), { name: 'AuthSessionMissingError' });
    expect(await getUser({ client: clientWith(async () => ({ data: null, error: err })) })).toBeNull();
    expect(await getUser({ client: clientWith(async () => ({ data: null, error: null })) })).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });

  it('a token for the anon role is not a user', async () => {
    const client = clientWith(async () => ({ data: { claims: { sub: 'x', role: 'anon' } }, error: null }));
    expect(await getUser({ client })).toBeNull();
  });

  it.each([
    ['throws', () => Promise.reject(new Error('fetch failed'))],
    ['returns an error', async () => ({ data: null, error: new Error('invalid JWT') })],
    ['hangs', hang],
  ])('Supabase %s: null, logged', async (_, getClaims) => {
    const log = logSpy();
    expect(await getUser({ client: clientWith(getClaims), timeoutMs: 50 })).toBeNull();
    expect(loggedOps(log)).toEqual(['get_user']);
  });
});
