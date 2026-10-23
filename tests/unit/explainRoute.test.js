// POST /api/scan/{id}/explain with bad input: always a clear JSON error (400, or 404 for a malformed
// id so ids cannot be probed, spec 13.6), never a 500, and the explanation code is never reached.
// No network, Supabase or Gemini: the user and the explain action are mocked.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const user = { id: '11111111-1111-4111-8111-111111111111', isAnonymous: true, client: {} };
const getUser = vi.fn(async () => user);
const explainOwnScan = vi.fn(async ({ scanId, lang }) => ({ scanId, lang: lang ?? 'en', why: 'Contains pork.', source: 'template' }));

vi.mock('@/lib/auth/getUser', () => ({ getUser: () => getUser() }));
vi.mock('@/lib/scan/scanActions', () => ({ explainOwnScan: (a) => explainOwnScan(a) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

const { POST } = await import('../../app/api/scan/[id]/explain/route.js');

const SCAN = '22222222-2222-4222-8222-222222222222';
const call = (id, body) => POST(
  new Request(`http://localhost/api/scan/${id}/explain`, { method: 'POST', headers: { 'content-type': 'application/json' }, body }),
  { params: Promise.resolve({ id }) },
);

beforeEach(() => {
  getUser.mockClear();
  explainOwnScan.mockClear();
});

describe('explain route: bad input is a clear error, never a 500', () => {
  it.each([
    ['body is not JSON', '{lang: hi', 'Body must be JSON.'],
    ['unknown language', '{"lang":"fr"}', 'Expected { lang?: "en" | "hi" | "gu" }.'],
    ['language is not a string', '{"lang":5}', 'Expected { lang?: "en" | "hi" | "gu" }.'],
    ['an extra field', '{"lang":"hi","scanId":"x"}', 'Expected { lang?: "en" | "hi" | "gu" }.'],
    ['a JSON array', '["hi"]', 'Expected { lang?: "en" | "hi" | "gu" }.'],
    ['JSON null', 'null', 'Expected { lang?: "en" | "hi" | "gu" }.'],
  ])('%s -> 400 INVALID_REQUEST', async (_, body, detail) => {
    const res = await call(SCAN, body);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
    const json = await res.json();
    expect(json.error).toMatchObject({ code: 'INVALID_REQUEST', detail });
    expect(json.error.message).toBeTruthy();
    expect(explainOwnScan).not.toHaveBeenCalled();
  });

  it.each(['not-a-uuid', '123', "1' OR '1'='1"])('malformed scan id %j -> 404 NOT_FOUND (same as a missing scan)', async (id) => {
    const res = await call(encodeURIComponent(id), '{"lang":"hi"}');
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe('NOT_FOUND');
    expect(explainOwnScan).not.toHaveBeenCalled();
  });

  it('no session -> 401 UNAUTHENTICATED', async () => {
    getUser.mockResolvedValueOnce(null);
    const res = await call(SCAN, '{"lang":"hi"}');
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED');
  });

  it('good input still works: empty body (scan language) and { lang } as the scanner sends it', async () => {
    const empty = await call(SCAN, '');
    expect(empty.status).toBe(200);
    expect(explainOwnScan).toHaveBeenLastCalledWith({ user, scanId: SCAN, lang: undefined });

    const hi = await call(SCAN, '{"lang":"hi"}');
    expect(hi.status).toBe(200);
    expect((await hi.json()).data).toMatchObject({ scanId: SCAN, lang: 'hi', source: 'template' });
    expect(explainOwnScan).toHaveBeenLastCalledWith({ user, scanId: SCAN, lang: 'hi' });
  });
});
