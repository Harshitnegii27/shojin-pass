// Stage 6 routes: 429 RATE_LIMITED on scan, explain, feedback and insights (per user first, per IP
// much higher); "busy" retake when photo scans exceed the Azure budget; the cron and deep-health
// secrets; and no label text in any log line. No network: Supabase is not configured here, so the
// limiter uses its memory store; the user, explain/feedback actions, insights and checks are mocked.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';

vi.hoisted(() => {
  Object.assign(process.env, {
    CRON_SECRET: 'c'.repeat(40),
    HEALTH_SECRET: 'h'.repeat(40),
    SCAN_RATE_LIMIT_PER_MIN: '2',
    EXPLAIN_RATE_LIMIT_PER_MIN: '2',
    FEEDBACK_RATE_LIMIT_PER_MIN: '2',
    IP_RATE_LIMIT_PER_MIN: '6',
    INSIGHTS_IP_RATE_LIMIT_PER_MIN: '2',
    OCR_CALLS_PER_MIN: '8', // 2 calls per 15 s slice = one photo scan
    OCR_CALLS_PER_SCAN: '2',
  });
});

const state = vi.hoisted(() => ({ user: null }));
const checks = vi.hoisted(() => ({
  checkDb: vi.fn(), runRetention: vi.fn(), checkOcr: vi.fn(), checkLlm: vi.fn(),
}));

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth/getUser', () => ({ getUser: async () => state.user }));
vi.mock('@/lib/scan/scanActions', () => ({
  explainOwnScan: async ({ scanId }) => ({ scanId, lang: 'en', why: 'Contains pork.', source: 'template' }),
  recordFeedback: async ({ scanId, kind }) => ({ scanId, kind, saved: true, priority: false }),
}));
vi.mock('@/lib/insights/insights', () => ({ getInsights: async () => ({ totalScans: 0, colours: {}, topRed: [] }) }));
vi.mock('@/lib/health/checks', () => checks);

const textRoute = await import('../../app/api/scan/text/route.js');
const photoRoute = await import('../../app/api/scan/route.js');
const explainRoute = await import('../../app/api/scan/[id]/explain/route.js');
const feedbackRoute = await import('../../app/api/scan/[id]/feedback/route.js');
const insightsRoute = await import('../../app/api/insights/route.js');
const cronRoute = await import('../../app/api/cron/maintenance/route.js');
const deepRoute = await import('../../app/api/health/deep/route.js');
const healthRoute = await import('../../app/api/health/route.js');

const T0 = Date.UTC(2026, 9, 24, 3, 0, 0); // a fresh minute and 15 s slice
let ipCounter = 0;
let IP;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(T0 + (ipCounter + 1) * 3_600_000); // each test in its own hour: fresh windows
  IP = `10.0.0.${++ipCounter}`;
  state.user = null;
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

const userN = (n) => ({ id: `0000000${n}-1111-4111-8111-111111111111`, isAnonymous: true, client: {} });
const SCAN = '22222222-2222-4222-8222-222222222222';
const json = (body, ip = IP) => ({ method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) });
const textScan = (text = '原材料名：小麦粉、砂糖', ip) => textRoute.POST(new Request('http://localhost/api/scan/text', json({ text, preset: 'vegetarian' }, ip)));
const explain = () => explainRoute.POST(new Request(`http://localhost/api/scan/${SCAN}/explain`, json({})), { params: Promise.resolve({ id: SCAN }) });
const feedback = () => feedbackRoute.POST(new Request(`http://localhost/api/scan/${SCAN}/feedback`, json({ kind: 'helpful' })), { params: Promise.resolve({ id: SCAN }) });
const insights = () => insightsRoute.GET(new Request('http://localhost/api/insights', { headers: { 'x-forwarded-for': IP } }));

async function expect429(res, limit) {
  expect(res.status).toBe(429);
  expect(res.headers.get('content-type')).toContain('application/json');
  const retry = Number(res.headers.get('retry-after'));
  expect(retry).toBeGreaterThan(0);
  const body = await res.json();
  expect(body.error).toMatchObject({ code: 'RATE_LIMITED', message: 'Slow down a little — try again in a minute.', retryAfterSec: retry, limit });
  expect(body.meta.requestId).toBeTruthy();
}

describe('429 RATE_LIMITED', () => {
  it('text scans: the third in a minute from one user is limited', async () => {
    state.user = userN(1);
    expect((await textScan()).status).toBe(200);
    expect((await textScan()).status).toBe(200);
    await expect429(await textScan(), 'scan_user_min');
  });

  it('shared Wi-Fi: other users on the same IP still scan until the (higher) IP limit', async () => {
    for (let n = 1; n <= 3; n++) {
      state.user = userN(n);
      expect((await textScan()).status).toBe(200);
      expect((await textScan()).status).toBe(200);
    }
    state.user = userN(4);
    await expect429(await textScan(), 'scan_ip_min');
  });

  it('photo and text scans share the scan limit; limited before the photo is read', async () => {
    state.user = userN(5);
    await textScan();
    await textScan();
    const res = await photoRoute.POST(new Request('http://localhost/api/scan', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=x', 'x-forwarded-for': IP }, body: 'not a real form' }));
    await expect429(res, 'scan_user_min');
  });

  it('explain', async () => {
    state.user = userN(6);
    expect((await explain()).status).toBe(200);
    expect((await explain()).status).toBe(200);
    await expect429(await explain(), 'explain_user_min');
  });

  it('feedback', async () => {
    state.user = userN(7);
    expect((await feedback()).status).toBe(200);
    expect((await feedback()).status).toBe(200);
    await expect429(await feedback(), 'feedback_user_min');
  });

  it('explain and feedback still need a session first (401, not 429)', async () => {
    expect((await explain()).status).toBe(401);
    expect((await feedback()).status).toBe(401);
  });

  it('insights, per IP', async () => {
    expect((await insights()).status).toBe(200);
    expect((await insights()).status).toBe(200);
    await expect429(await insights(), 'insights_ip_min');
  });

  it('the limit resets in the next minute', async () => {
    state.user = userN(8);
    await textScan();
    await textScan();
    expect((await textScan()).status).toBe(429);
    vi.setSystemTime(Date.now() + 60_000);
    expect((await textScan()).status).toBe(200);
  });
});

describe('photo scans over the Azure budget: friendly busy retake, not a crash', () => {
  const photoForm = async () => {
    const jpg = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    const form = new FormData();
    form.append('image', new Blob([jpg], { type: 'image/jpeg' }), 'label.jpg');
    form.append('preset', 'vegetarian');
    return form;
  };
  const photo = async (ip) => photoRoute.POST(new Request('http://localhost/api/scan', { method: 'POST', headers: { 'x-forwarded-for': ip }, body: await photoForm() }));

  it('the second scan in one 15 s slice (any user, any IP) is "busy, try again in a few seconds"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}); // Azure is not configured here: logged
    const first = (await (await photo('10.1.0.1')).json()).data;
    expect(first.verdict).toBe('retake');
    expect(first.ocr.status).toBe('unavailable');

    const res = await photo('10.1.0.2');
    expect(res.status).toBe(200);
    const busy = (await res.json()).data;
    expect(busy).toMatchObject({ verdict: 'retake', reasons: ['OCR_UNAVAILABLE', 'OCR_BUSY'], ocr: { status: 'busy', detail: 'local_limit' } });
    expect(busy.why).toBe('Busy right now — please try again in a few seconds.');
    expect(busy.retryAfterSec).toBeGreaterThan(0);
    expect(busy.retryAfterSec).toBeLessThanOrEqual(15);

    vi.setSystemTime(Date.now() + 15_000);
    expect((await (await photo('10.1.0.3')).json()).data.ocr.status).not.toBe('busy');
  });
});

describe('GET /api/cron/maintenance', () => {
  const cron = (headers = {}) => cronRoute.GET(new Request('http://localhost/api/cron/maintenance', { headers }));
  beforeEach(() => {
    checks.checkDb.mockResolvedValue({ status: 'ok', ms: 12 });
    checks.runRetention.mockResolvedValue({ status: 'ok', ms: 20 });
  });

  it.each([
    ['no header', {}],
    ['wrong secret', { authorization: 'Bearer ' + 'x'.repeat(40) }],
    ['secret without Bearer', { authorization: 'c'.repeat(40) }],
    ['the health secret', { authorization: 'Bearer ' + 'h'.repeat(40) }],
  ])('%s -> 401, nothing runs', async (_, headers) => {
    const res = await cron(headers);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHENTICATED');
    expect(checks.checkDb).not.toHaveBeenCalled();
    expect(checks.runRetention).not.toHaveBeenCalled();
  });

  it('right secret: pings the database, runs retention, logs one info line', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await cron({ authorization: 'Bearer ' + 'c'.repeat(40) });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ ok: true, db: 'ok', retention: 'ok', ms: { db: 12, retention: 20 } });
    expect(checks.checkDb).toHaveBeenCalledTimes(1);
    expect(checks.runRetention).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).not.toContain('c'.repeat(40));
  });

  it('database down: 200 with ok false and an error log (the cron itself does not crash)', async () => {
    checks.checkDb.mockResolvedValue({ status: 'fail', detail: 'db_ping timed out', ms: 3000 });
    checks.runRetention.mockResolvedValue({ status: 'fail', detail: 'x', ms: 3000 });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await cron({ authorization: 'Bearer ' + 'c'.repeat(40) });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ ok: false, db: 'fail', retention: 'fail' });
    expect(err).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/health/deep and /api/health', () => {
  const deep = (headers = {}) => deepRoute.GET(new Request('http://localhost/api/health/deep', { headers }));
  beforeEach(() => {
    checks.checkOcr.mockResolvedValue({ status: 'ok', ms: 900 });
    checks.checkLlm.mockResolvedValue({ status: 'skipped', ms: 0 });
    checks.checkDb.mockResolvedValue({ status: 'ok', ms: 15 });
  });

  it.each([
    ['no header', {}],
    ['wrong secret', { 'x-health-secret': 'nope' }],
    ['the cron secret', { 'x-health-secret': 'c'.repeat(40) }],
    ['as a Bearer token', { authorization: 'Bearer ' + 'h'.repeat(40) }],
  ])('%s -> 401, no OCR or LLM call', async (_, headers) => {
    expect((await deep(headers)).status).toBe(401);
    expect(checks.checkOcr).not.toHaveBeenCalled();
    expect(checks.checkLlm).not.toHaveBeenCalled();
  });

  it('right secret: OCR, LLM and DB reported', async () => {
    const res = await deep({ 'x-health-secret': 'h'.repeat(40) });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ ok: true, ocr: 'ok', llm: 'skipped', db: 'ok', detail: {}, ms: { ocr: 900, llm: 0, db: 15 } });
  });

  it('a failing check shows ok false and its detail', async () => {
    checks.checkOcr.mockResolvedValue({ status: 'fail', detail: 'auth', ms: 100 });
    const d = (await (await deep({ 'x-health-secret': 'h'.repeat(40) })).json()).data;
    expect(d).toMatchObject({ ok: false, ocr: 'fail', detail: { ocr: 'auth' } });
  });

  it('plain /api/health stays public and shows no secrets', async () => {
    const res = await healthRoute.GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(Object.keys(JSON.parse(text).data).sort()).toEqual(['ok', 'rulebookVersion']);
    expect(text).not.toContain('c'.repeat(40));
    expect(text).not.toContain('h'.repeat(40));
  });
});

describe('logs never contain label text', () => {
  it('text and photo scans, with OCR failing and the limiter falling back', async () => {
    const lines = [];
    const grab = (...a) => lines.push(a.map(String).join(' '));
    for (const m of ['log', 'info', 'warn', 'error']) vi.spyOn(console, m).mockImplementation(grab);
    const MARK = 'ゾゾマーカー';

    state.user = userN(9);
    await textScan(`原材料名：小麦粉、${MARK}、豚肉`);
    await textScan(`${MARK}`.repeat(50));
    const form = new FormData();
    form.append('image', new Blob([await sharp({ create: { width: 800, height: 600, channels: 3, background: '#fff' } }).png().toBuffer()], { type: 'image/png' }), `${MARK}.png`);
    form.append('preset', 'vegetarian');
    await photoRoute.POST(new Request('http://localhost/api/scan', { method: 'POST', headers: { 'x-forwarded-for': IP }, body: form }));

    expect(lines.length).toBeGreaterThan(0); // the OCR failure was logged…
    for (const l of lines) expect(l).not.toContain(MARK); // …without any label text
  });
});
