// /api/insights (spec B10): totals only, no user ids, every count under 5 hidden. No database:
// the rows and the Supabase client are stand-ins.

import { describe, it, expect, vi } from 'vitest';
import { computeInsights, fetchScanRows, getInsights, MIN_COUNT, TOP_N, MAX_ROWS, WINDOW_DAYS, COLUMNS } from '../../lib/insights/insights.js';

const scan = (verdict, red = []) => ({ verdict, items: red.map((ingredientId) => ({ ingredientId, colour: 'red' })) });
const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));

describe('computeInsights', () => {
  it('counts verdict colours and red ingredients (once per scan)', () => {
    const rows = [
      ...many(6, () => scan('red', ['pork', 'pork', 'lard'])), // pork twice in one scan counts once
      ...many(7, () => scan('green')),
      ...many(5, () => scan('amber')),
    ];
    const r = computeInsights(rows);
    expect(r.totalScans).toBe(18);
    expect(r.colours).toEqual({ green: 7, amber: 5, red: 6, retake: null });
    expect(r.topRed).toEqual([
      { ingredientId: 'lard', name: { en: 'lard' }, scans: 6 },
      { ingredientId: 'pork', name: { en: 'pork' }, scans: 6 },
    ]);
  });

  it(`hides every count under ${MIN_COUNT}: colours, total and ingredients`, () => {
    const rows = [...many(4, () => scan('red', ['egg'])), ...many(5, () => scan('green'))];
    const r = computeInsights(rows);
    expect(r.colours.red).toBeNull(); // 4
    expect(r.colours.green).toBe(5); // exactly 5 is shown
    expect(r.colours.amber).toBeNull(); // 0
    expect(r.topRed).toEqual([]); // egg red in only 4 scans: hidden
    expect(r.minCount).toBe(MIN_COUNT);
  });

  it('a tiny table hides everything, including the total', () => {
    const r = computeInsights(many(3, () => scan('red', ['pork'])));
    expect(r.totalScans).toBeNull();
    expect(Object.values(r.colours).every((v) => v === null)).toBe(true);
    expect(r.topRed).toEqual([]);
  });

  it(`top ${TOP_N} only, most scans first, ties by id; names from the rulebook`, () => {
    const ids = many(12, (i) => `ing${String(i).padStart(2, '0')}`);
    const rows = ids.flatMap((id, i) => many(5 + i, () => scan('red', [id])));
    const r = computeInsights(rows, { names: (id) => ({ en: id.toUpperCase() }) });
    expect(r.topRed).toHaveLength(TOP_N);
    expect(r.topRed[0]).toEqual({ ingredientId: 'ing11', name: { en: 'ING11' }, scans: 16 });
    expect(r.topRed.map((x) => x.scans)).toEqual([...r.topRed.map((x) => x.scans)].sort((a, b) => b - a));
  });

  it('the result never carries user ids, even if rows had them', () => {
    const rows = many(6, () => ({ ...scan('red', ['pork']), user_id: 'u-secret', id: 's-secret' }));
    const json = JSON.stringify(computeInsights(rows));
    expect(json).not.toContain('u-secret');
    expect(json).not.toContain('s-secret');
    expect(json).not.toMatch(/user_?id/i);
  });

  it('bad rows are ignored, not counted as a colour', () => {
    const r = computeInsights([...many(5, () => scan('green')), { verdict: 'purple', items: null }, { verdict: 'red' }]);
    expect(r.colours.green).toBe(5);
    expect(r.totalScans).toBe(7);
  });
});

describe('reading the scans table', () => {
  function fakeClient(result) {
    const calls = {};
    const q = {
      select: vi.fn((cols) => { calls.select = cols; return q; }),
      gte: vi.fn((col, v) => { calls.gte = [col, v]; return q; }),
      order: vi.fn(() => q),
      limit: vi.fn((n) => { calls.limit = n; return Promise.resolve(result); }),
    };
    return { client: { from: vi.fn((t) => { calls.table = t; return q; }) }, calls };
  }

  it(`selects only verdict and items (never user_id), last ${WINDOW_DAYS} days, at most ${MAX_ROWS} rows`, async () => {
    const { client, calls } = fakeClient({ data: [scan('green')], error: null });
    const now = new Date('2026-10-23T00:00:00Z');
    const r = await fetchScanRows({ now, client, timeoutMs: 1000 });
    expect(calls.table).toBe('scans');
    expect(calls.select).toBe(COLUMNS);
    expect(COLUMNS).not.toMatch(/user/);
    expect(calls.gte).toEqual(['created_at', '2026-07-25T00:00:00.000Z']);
    expect(calls.limit).toBe(MAX_ROWS);
    expect(r.rows).toHaveLength(1);
  });

  it('a database error is thrown (the route answers 503), never turned into numbers', async () => {
    const { client } = fakeClient({ data: null, error: new Error('db down') });
    await expect(fetchScanRows({ client, timeoutMs: 1000 })).rejects.toThrow('db down');
    await expect(getInsights({ fetchRows: async () => { throw new Error('db down'); } })).rejects.toThrow('db down');
  });

  it('getInsights passes names and the window through', async () => {
    const r = await getInsights({ fetchRows: async () => ({ rows: many(5, () => scan('red', ['pork'])), since: 'S' }), names: () => ({ en: 'Pork' }) });
    expect(r.since).toBe('S');
    expect(r.topRed[0].name).toEqual({ en: 'Pork' });
  });
});
