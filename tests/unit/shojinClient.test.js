// The browser helper keeps the diet in localStorage and keeps scanning when login, Turnstile or
// saving fails (stage 2). Errors are logged, never thrown.

import { describe, it, expect, vi } from 'vitest';
import { createShojinClient, DIET_KEY } from '../../lib/client/shojinClient.js';

function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}
const brokenStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
const json = (status, body) => Promise.resolve({ status, json: async () => body });
const log = () => ({ error: vi.fn() });

// fetch stand-in: routes by "METHOD path"; anything else is a network failure.
function fakeFetch(routes) {
  return vi.fn((path, init) => {
    const h = routes[`${init.method} ${path}`];
    return h ? h(init.body && JSON.parse(init.body)) : Promise.reject(new TypeError('Failed to fetch'));
  });
}

function fakeSupabase({ session = null, signIn } = {}) {
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      signInAnonymously: vi.fn(signIn || (async () => ({ data: { user: { id: 'u1' } }, error: null }))),
      signOut: vi.fn(async () => ({ error: null })),
    },
  };
}

describe('sign-in', () => {
  it('sends the Turnstile token to anonymous sign-in', async () => {
    const supabase = fakeSupabase();
    const c = createShojinClient({ supabase, storage: memoryStorage(), fetchFn: fakeFetch({}), log: log() });
    expect(await c.signIn('turnstile-token')).toMatchObject({ ok: true, userId: 'u1', existing: false });
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledWith({ options: { captchaToken: 'turnstile-token' } });
  });

  it('keeps an existing session', async () => {
    const supabase = fakeSupabase({ session: { user: { id: 'u0' } } });
    const c = createShojinClient({ supabase, storage: memoryStorage(), log: log() });
    expect(await c.signIn('t')).toMatchObject({ ok: true, userId: 'u0', existing: true });
    expect(supabase.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it.each([
    ['Turnstile rejected', async () => ({ data: {}, error: new Error('captcha protection: request disallowed') })],
    ['Supabase unreachable', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('%s: returns ok false and logs, never throws', async (_, signIn) => {
    const l = log();
    const c = createShojinClient({ supabase: fakeSupabase({ signIn }), storage: memoryStorage(), log: l });
    expect((await c.signIn('t')).ok).toBe(false);
    expect(l.error).toHaveBeenCalledWith('[shojin]', 'sign_in', expect.any(String));
  });

  it('Supabase not configured: ok false', async () => {
    const c = createShojinClient({ supabase: null, storage: memoryStorage(), log: log() });
    expect((await c.signIn('t')).ok).toBe(false);
  });

  it('currentSession reports an existing session and never signs in', async () => {
    const withSession = fakeSupabase({ session: { user: { id: 'u0' } } });
    expect(await createShojinClient({ supabase: withSession, storage: memoryStorage(), log: log() }).currentSession()).toEqual({ ok: true, userId: 'u0', configured: true });
    const none = fakeSupabase();
    expect(await createShojinClient({ supabase: none, storage: memoryStorage(), log: log() }).currentSession()).toEqual({ ok: true, userId: null, configured: true });
    expect(none.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(await createShojinClient({ supabase: null, storage: memoryStorage(), log: log() }).currentSession()).toMatchObject({ ok: false, configured: false });
  });

  it('currentSession: Supabase unreachable gives no session and logs, never throws', async () => {
    const l = log();
    const supabase = { auth: { getSession: () => Promise.reject(new TypeError('Failed to fetch')) } };
    expect(await createShojinClient({ supabase, storage: memoryStorage(), log: l }).currentSession()).toEqual({ ok: false, userId: null, configured: true });
    expect(l.error).toHaveBeenCalledWith('[shojin]', 'get_session', expect.any(String));
  });
});

describe('ensureSession (the app screens sign in once, like /dev)', () => {
  it('an existing session is reused: no Turnstile token, no second sign-in', async () => {
    const supabase = fakeSupabase({ session: { user: { id: 'u0' } } });
    const getToken = vi.fn(async () => 'token');
    const c = createShojinClient({ supabase, storage: memoryStorage(), log: log() });
    expect(await c.ensureSession(getToken)).toEqual({ ok: true, userId: 'u0', existing: true });
    expect(await c.ensureSession(getToken)).toEqual({ ok: true, userId: 'u0', existing: true });
    expect(getToken).not.toHaveBeenCalled();
    expect(supabase.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('no session: one Turnstile token, one anonymous sign-in', async () => {
    const supabase = fakeSupabase();
    const getToken = vi.fn(async () => 'turnstile-token');
    const c = createShojinClient({ supabase, storage: memoryStorage(), log: log() });
    expect(await c.ensureSession(getToken)).toEqual({ ok: true, userId: 'u1', existing: false });
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledWith({ options: { captchaToken: 'turnstile-token' } });
  });

  it('calls made while signing in share it: only one new user (React runs effects twice in dev)', async () => {
    const supabase = fakeSupabase();
    let giveToken;
    const getToken = vi.fn(() => new Promise((r) => { giveToken = r; }));
    const c = createShojinClient({ supabase, storage: memoryStorage(), log: log() });
    const a = c.ensureSession(getToken);
    const b = c.ensureSession(getToken);
    expect(b).toBe(a);
    await vi.waitFor(() => expect(getToken).toHaveBeenCalled());
    giveToken('t');
    expect(await a).toMatchObject({ ok: true, userId: 'u1' });
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Turnstile fails', fakeSupabase(), async () => { throw new Error('Turnstile error'); }],
    ['Turnstile gives no token', fakeSupabase(), async () => ''],
    ['Turnstile not configured', fakeSupabase(), undefined],
    ['Supabase rejects the sign-in', fakeSupabase({ signIn: async () => ({ data: {}, error: new Error('captcha protection: request disallowed') }) }), async () => 't'],
    ['Supabase unreachable', { auth: { getSession: () => Promise.reject(new TypeError('Failed to fetch')) } }, async () => 't'],
  ])('%s: ok false and logged, never throws', async (_, supabase, getToken) => {
    const l = log();
    const r = await createShojinClient({ supabase, storage: memoryStorage(), log: l }).ensureSession(getToken);
    expect(r).toMatchObject({ ok: false, userId: null });
    expect(l.error).toHaveBeenCalledWith('[shojin]', 'sign_in', expect.any(String));
  });

  it('Supabase not configured: ok false, and a later call still runs (nothing stuck)', async () => {
    const c = createShojinClient({ supabase: null, storage: memoryStorage(), log: log() });
    expect((await c.ensureSession(async () => 't')).ok).toBe(false);
    expect((await c.ensureSession(async () => 't')).ok).toBe(false);
  });

  it('after a failed sign-in, the next call tries again', async () => {
    const supabase = fakeSupabase();
    const getToken = vi.fn().mockRejectedValueOnce(new Error('Turnstile error')).mockResolvedValueOnce('t');
    const c = createShojinClient({ supabase, storage: memoryStorage(), log: log() });
    expect((await c.ensureSession(getToken)).ok).toBe(false);
    expect((await c.ensureSession(getToken)).ok).toBe(true);
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });
});

describe('explain failures are logged clearly', () => {
  it('a reply that is not JSON (framework error page) is named as such', async () => {
    const l = log();
    const fetchFn = vi.fn(() => Promise.resolve({ status: 500, json: async () => { throw new SyntaxError('Unexpected token <'); } }));
    const r = await createShojinClient({ storage: memoryStorage(), fetchFn, log: l }).explain('s1', 'hi');
    expect(r).toMatchObject({ ok: false, status: 500 });
    expect(l.error).toHaveBeenCalledWith('[shojin]', 'explain', 'HTTP 500 (not JSON: server error page, not our API)');
  });

  it('our own JSON errors are logged by their code', async () => {
    const l = log();
    const fetchFn = fakeFetch({ 'POST /api/scan/s1/explain': () => json(400, { error: { code: 'INVALID_REQUEST' } }) });
    await createShojinClient({ storage: memoryStorage(), fetchFn, log: l }).explain('s1', 'xx');
    expect(l.error).toHaveBeenCalledWith('[shojin]', 'explain', 'INVALID_REQUEST');
  });
});

describe('scans for one family member', () => {
  const stored = () => memoryStorage({ [DIET_KEY]: JSON.stringify({ preset: 'vegetarian', options: [], lang: 'en' }) });

  it('a given diet is sent instead of the local one, and the local one is not changed', async () => {
    const storage = stored();
    const fetchFn = fakeFetch({ 'POST /api/scan/text': () => json(200, { data: { verdict: 'amber' } }) });
    const c = createShojinClient({ storage, fetchFn, log: log() });
    await c.scanText('原材料名：みりん', { diet: { preset: 'jain_strict', options: ['avoid_shared_line'], lang: 'gu' } });
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({ text: '原材料名：みりん', preset: 'jain_strict', options: ['avoid_shared_line'], lang: 'gu' });
    expect(JSON.parse(storage.dump()[DIET_KEY]).preset).toBe('vegetarian');
  });

  it('photo scans send the given diet as form fields', async () => {
    const fetchFn = vi.fn(() => json(200, { data: { verdict: 'retake' } }));
    const c = createShojinClient({ storage: stored(), fetchFn, log: log() });
    await c.scanPhoto(new Blob(['x'], { type: 'image/jpeg' }), 'l.jpg', { diet: { preset: 'jain_flexible', options: ['avoid_alcohol'] } });
    const form = fetchFn.mock.calls[0][1].body;
    expect(form.get('preset')).toBe('jain_flexible');
    expect(form.getAll('options')).toEqual(['avoid_alcohol']);
    expect(form.get('lang')).toBeNull();
  });

  it('text scan with no network returns a NETWORK error, never a verdict', async () => {
    const l = log();
    const r = await createShojinClient({ storage: stored(), fetchFn: fakeFetch({}), log: l }).scanText('x');
    expect(r).toEqual({ status: 0, error: { code: 'NETWORK', message: 'Check your connection and try again.' } });
    expect(r.data).toBeUndefined();
    expect(l.error).toHaveBeenCalledWith('[shojin]', 'scan_text', expect.any(String));
  });
});

describe('diet in localStorage', () => {
  it('saving keeps the diet locally even when the server refuses or is unreachable', async () => {
    for (const fetchFn of [fakeFetch({ 'PUT /api/profile': () => json(401, { error: { code: 'UNAUTHENTICATED' } }) }), fakeFetch({})]) {
      const storage = memoryStorage();
      const l = log();
      const c = createShojinClient({ storage, fetchFn, log: l });
      const r = await c.saveDiet({ preset: 'jain_strict', options: ['avoid_shared_line', 'avoid_shared_line'], lang: 'gu' });
      expect(r).toMatchObject({ savedLocally: true, savedOnServer: false });
      expect(JSON.parse(storage.dump()[DIET_KEY])).toEqual({ preset: 'jain_strict', options: ['avoid_shared_line'], lang: 'gu' });
      expect(l.error).toHaveBeenCalledWith('[shojin]', 'save_profile', expect.any(String));
    }
  });

  it('saving reports success when the server saves too', async () => {
    const fetchFn = fakeFetch({ 'PUT /api/profile': (b) => json(200, { data: b }) });
    const c = createShojinClient({ storage: memoryStorage(), fetchFn, log: log() });
    expect(await c.saveDiet({ preset: 'vegetarian' })).toMatchObject({ savedLocally: true, savedOnServer: true });
  });

  it('every scan sends the local diet, so the server never needs Supabase to know it', async () => {
    const storage = memoryStorage({ [DIET_KEY]: JSON.stringify({ preset: 'jain_strict', options: ['avoid_alcohol'], lang: 'hi' }) });
    const fetchFn = fakeFetch({ 'POST /api/scan/text': () => json(200, { data: { verdict: 'red' } }) });
    const c = createShojinClient({ storage, fetchFn, log: log() });
    expect((await c.scanText('原材料名：みりん')).data.verdict).toBe('red');
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({ text: '原材料名：みりん', preset: 'jain_strict', options: ['avoid_alcohol'], lang: 'hi' });
  });

  it('blocked localStorage: no crash; scan is sent without a diet (server uses the strictest fallback)', async () => {
    const fetchFn = fakeFetch({ 'POST /api/scan/text': () => json(200, { data: { verdict: 'red', dietSource: 'fallback' } }), 'PUT /api/profile': () => json(200, { data: {} }) });
    const c = createShojinClient({ storage: brokenStorage, fetchFn, log: log() });
    expect((await c.saveDiet({ preset: 'vegetarian' })).savedLocally).toBe(false);
    expect(c.loadDiet()).toBeNull();
    await c.scanText('x');
    expect(JSON.parse(fetchFn.mock.calls.at(-1)[1].body)).toEqual({ text: 'x' });
  });

  it('corrupt stored diet is ignored', () => {
    const c = createShojinClient({ storage: memoryStorage({ [DIET_KEY]: '{not json' }), log: log() });
    expect(c.loadDiet()).toBeNull();
  });

  it('sync: local diet wins; with none, the saved profile is copied down; server down leaves none', async () => {
    const local = memoryStorage({ [DIET_KEY]: JSON.stringify({ preset: 'vegetarian', options: [] }) });
    expect((await createShojinClient({ storage: local, fetchFn: fakeFetch({}), log: log() }).syncDiet()).source).toBe('local');

    const empty = memoryStorage();
    const fetchFn = fakeFetch({ 'GET /api/profile': () => json(200, { data: { preset: 'jain_flexible', options: [], lang: 'en' } }) });
    expect(await createShojinClient({ storage: empty, fetchFn, log: log() }).syncDiet()).toMatchObject({ source: 'server', diet: { preset: 'jain_flexible' } });
    expect(JSON.parse(empty.dump()[DIET_KEY]).preset).toBe('jain_flexible');

    expect((await createShojinClient({ storage: memoryStorage(), fetchFn: fakeFetch({}), log: log() }).syncDiet()).source).toBe('none');
  });
});

describe('delete my data', () => {
  it('clears the local diet and session only after the server deleted', async () => {
    const storage = memoryStorage({ [DIET_KEY]: '{"preset":"vegetarian"}' });
    const supabase = fakeSupabase();
    const ok = createShojinClient({ supabase, storage, fetchFn: fakeFetch({ 'DELETE /api/profile': () => json(200, { data: { deleted: true } }) }), log: log() });
    expect(await ok.deleteMyData()).toEqual({ deletedOnServer: true });
    expect(storage.dump()[DIET_KEY]).toBeUndefined();
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('server down: reports failure and keeps local data', async () => {
    const storage = memoryStorage({ [DIET_KEY]: '{"preset":"vegetarian"}' });
    const c = createShojinClient({ supabase: fakeSupabase(), storage, fetchFn: fakeFetch({}), log: log() });
    expect(await c.deleteMyData()).toEqual({ deletedOnServer: false });
    expect(storage.dump()[DIET_KEY]).toBeDefined();
  });
});
