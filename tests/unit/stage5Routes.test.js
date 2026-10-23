// Stage 5 API routes: bad input is a clear JSON 400/404, good input returns the documented shape,
// and insights answer 503 (never made-up numbers) when the database is down. No network.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
const getInsights = vi.fn();
vi.mock('@/lib/insights/insights', () => ({ getInsights: (d) => getInsights(d) }));

const chef = await import('../../app/api/chef-card/route.js');
const routes = await import('../../app/api/routes/route.js');
const route = await import('../../app/api/routes/[slug]/route.js');
const venues = await import('../../app/api/venues/route.js');
const insights = await import('../../app/api/insights/route.js');

const post = (body) => chef.POST(new Request('http://localhost/api/chef-card', { method: 'POST', body }));
const get = (path) => new Request('http://localhost' + path);
const expectError = async (res, status, code) => {
  expect(res.status).toBe(status);
  expect(res.headers.get('content-type')).toContain('application/json');
  expect((await res.json()).error.code).toBe(code);
};

beforeEach(() => { getInsights.mockReset(); }); // braces: a returned function would run as a cleanup hook

describe('POST /api/chef-card', () => {
  it.each([
    ['not JSON', '{preset'],
    ['empty body', ''],
    ['both preset and members', JSON.stringify({ preset: 'vegetarian', members: [{ preset: 'jain_strict' }] })],
    ['unknown field', JSON.stringify({ preset: 'vegetarian', colour: 'red' })],
    ['dish name not Japanese', JSON.stringify({ preset: 'vegetarian', dishNameJa: 'pizza' })],
    ['unknown preset', JSON.stringify({ preset: 'pescatarian' })],
    ['unknown option', JSON.stringify({ preset: 'vegetarian', options: ['no_salt'] })],
  ])('%s -> 400', async (_, body) => expectError(await post(body), 400, 'INVALID_REQUEST'));

  it('one diet and everyone at the table both work', async () => {
    const one = await post(JSON.stringify({ preset: 'jain_strict', dishNameJa: '野菜の天ぷら' }));
    expect(one.status).toBe(200);
    const d = (await one.json()).data;
    expect(d.ja).toContain('「野菜の天ぷら」');
    expect(d.reviewNeeded.ja).toBe(true);
    const table = await post(JSON.stringify({ members: [{ preset: 'vegetarian_egg' }, { preset: 'jain_flexible' }] }));
    expect((await table.json()).data.identity).toBe('jain');
  });
});

describe('GET /api/routes and /api/routes/{slug}', () => {
  it('lists routes with fitsDiet; bad preset -> 400', async () => {
    const ok = await routes.GET(get('/api/routes?preset=jain_strict'));
    expect((await ok.json()).data.routes.map((r) => r.fitsDiet)).toEqual([true, false]);
    await expectError(await routes.GET(get('/api/routes?preset=nope')), 400, 'INVALID_REQUEST');
    await expectError(await routes.GET(get('/api/routes?colour=red')), 400, 'INVALID_REQUEST');
  });

  const one = (slug, q = '') => route.GET(get(`/api/routes/${slug}${q}`), { params: Promise.resolve({ slug }) });

  it('one route with the sunset rule (options repeated or comma-separated)', async () => {
    const res = await one('kyoto-zen-temple-day', '?preset=jain_strict&date=2026-10-28&options=no_food_after_sunset');
    const d = (await res.json()).data;
    expect(d.sunsetRule).toBe(true);
    expect(d.sunsets[0]).toMatchObject({ date: '2026-10-28' });
    expect(d.stops.find((s) => s.start === '19:00').sunsetConflict).toBe(true);
    const comma = await one('kyoto-zen-temple-day', '?options=avoid_alcohol,no_food_after_sunset&date=2026-10-28');
    expect((await comma.json()).data.sunsetRule).toBe(true);
  });

  it.each([
    ['bad date format', '?date=28-10-2026'],
    ['impossible date', '?date=2026-02-30'],
    ['unknown option', '?options=no_salt'],
    ['unknown preset', '?preset=nope'],
  ])('%s -> 400', async (_, q) => expectError(await one('kyoto-zen-temple-day', q), 400, 'INVALID_REQUEST'));

  it('unknown or malformed slug -> 404', async () => {
    await expectError(await one('no-such-route'), 404, 'NOT_FOUND');
    await expectError(await one('Bad_Slug!'), 404, 'NOT_FOUND');
  });
});

describe('GET /api/venues', () => {
  it('nearest sample venues; preset filters', async () => {
    const res = await venues.GET(get('/api/venues?lat=35.0116&lng=135.7681&radius=15000&preset=jain_strict'));
    const list = (await res.json()).data.venues;
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((v) => v.sample && v.supports.includes('jain_strict'))).toBe(true);
  });

  it.each([
    ['no coordinates', ''],
    ['latitude out of range', '?lat=95&lng=135'],
    ['not a number', '?lat=abc&lng=135'],
    ['radius too large', '?lat=35&lng=135&radius=50000'],
    ['radius too small', '?lat=35&lng=135&radius=10'],
    ['unknown preset', '?lat=35&lng=135&preset=nope'],
  ])('%s -> 400', async (_, q) => expectError(await venues.GET(get('/api/venues' + q)), 400, 'INVALID_REQUEST'));
});

describe('GET /api/insights', () => {
  it('returns the totals from getInsights, with rulebook names', async () => {
    getInsights.mockImplementation(async ({ names }) => ({ totalScans: 12, colours: { green: 7, amber: 5, red: null, retake: null }, topRed: [], minCount: 5, name: names('pork') }));
    const res = await insights.GET();
    expect(res.status).toBe(200);
    const d = (await res.json()).data;
    expect(d.colours.red).toBeNull();
    expect(d.name).toHaveProperty('en');
  });

  it('database down -> 503 SERVICE_UNAVAILABLE, no numbers', async () => {
    getInsights.mockRejectedValue(new Error('db down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await insights.GET();
    await expectError(res, 503, 'SERVICE_UNAVAILABLE');
    spy.mockRestore();
  });
});
