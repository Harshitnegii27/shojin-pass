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
