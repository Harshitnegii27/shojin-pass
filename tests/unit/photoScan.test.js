// Photo scans end to end with a fake Azure: prepareImage -> readLabel -> page gate -> scanLabel.
// Every OCR failure ends as `retake` (never green, never a crash); Supabase failures never cost
// the verdict; nothing stored contains the label text or the photo.

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import sharp from 'sharp';
import { rb } from '../helpers.js';
import { runScan, FALLBACK_DIET } from '../../lib/scan/scanService.js';
import { readLabel } from '../../lib/ocr/index.js';
import { azureFetch, line, succeeded, ok200, status, noSleep, ENDPOINT } from '../azureMock.js';

let PHOTO;
beforeAll(async () => {
  PHOTO = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#ffffff' } }).jpeg().toBuffer();
});
afterEach(() => vi.restoreAllMocks());
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

const USER = { id: '11111111-1111-1111-1111-111111111111', isAnonymous: true, client: null };

// readLabel wired to a fake Azure returning these lines (or these raw responses).
const ocrWith = (fetchOpts, extra = {}) => (img) => readLabel(img, { endpoint: ENDPOINT, key: 'test-key-not-real', timeoutMs: 4000, fetchFn: azureFetch(fetchOpts), sleep: noSleep, ...extra });
const reads = (lines) => ocrWith({ polls: [ok200(succeeded(lines))] });
const LABEL = (list, conf = 0.98) => [line('名称：クッキー', undefined, conf), line('原材料名：' + list, undefined, conf), line('内容量：100g', undefined, conf)];

const scan = (readLabelFn, args = {}, deps = {}) =>
  runScan({ input: { kind: 'photo', buffer: PHOTO }, user: null, preset: 'vegetarian', ...args }, { rulebook: rb, readLabel: readLabelFn, saveScan: async () => 'scan-1', ...deps });

describe('photo scan: verdicts', () => {
  it('lard on the label: red', async () => {
    const r = await scan(reads(LABEL('小麦粉、砂糖、ラード')));
    expect(r.verdict).toBe('red');
    expect(r.reasons).toContain('FORBIDDEN_INGREDIENT');
    expect(r.ocr.status).toBe('ok');
  });

  it('safe label read clearly: green', async () => {
    const r = await scan(reads(LABEL('小麦粉、砂糖、食塩')));
    expect(r.verdict).toBe('green');
    expect(r.ocr.pageConfidence).toBeCloseTo(0.98);
  });

  it('one unclear word in a safe ingredient: amber LOW_CONFIDENCE, even though the page is clear', async () => {
    const words = [...'原材料名：小麦粉、'].map((c) => ({ text: c, confidence: 0.99 }))
      .concat([{ text: '砂糖', confidence: 0.3 }], [...'、食塩'].map((c) => ({ text: c, confidence: 0.99 })));
    const lines = [line('原材料名：小麦粉、砂糖、食塩', undefined, 0, words), line('内容量：100g', undefined, 0.99)];
    const r = await scan(reads(lines));
    expect(r.verdict).toBe('amber');
    expect(r.reasons).toContain('LOW_CONFIDENCE');
  });

  it('an unclear red ingredient stays red', async () => {
    const words = [...'原材料名：小麦粉、'].map((c) => ({ text: c, confidence: 0.99 })).concat([{ text: 'ラード', confidence: 0.3 }]);
    const r = await scan(reads([line('原材料名：小麦粉、ラード', undefined, 0, words), line('内容量：100g', undefined, 0.99)]));
    expect(r.verdict).toBe('red');
  });

  it('a vertical label is read right to left', async () => {
    const col = (text, x) => ({ ...line(text, [x, 0, 20, text.length * 20]) });
    const r = await scan(reads([col('内容量：100g', 0), col('ラード', 40), col('小麦粉、砂糖、', 80), col('原材料名：', 120)]));
    expect(r.verdict).toBe('red');
    expect(r.ocr.text).toBe('原材料名：\n小麦粉、砂糖、\nラード\n内容量：100g');
  });
});

describe('photo scan: OCR problems are retake, never green', () => {
  it('blurry photo (low page confidence): retake with advice', async () => {
    const r = await scan(reads(LABEL('小麦粉、砂糖、食塩', 0.5)));
    expect(r).toMatchObject({ verdict: 'retake', reasons: ['OCR_LOW_PAGE_CONFIDENCE'], ocr: { status: 'low_confidence' } });
    expect(r.why).toBe('Hold the label flat and closer, and avoid glare.');
  });

  it('no text at all: retake', async () => {
    const r = await scan(reads([]));
    expect(r).toMatchObject({ verdict: 'retake', reasons: ['OCR_LOW_PAGE_CONFIDENCE'], ocr: { status: 'no_text' } });
  });

  it('Azure busy (429): retake with a friendly "try again in a minute" in the user language', async () => {
    quiet();
    const busy = ocrWith({ post: status(429, {}, { 'Retry-After': '42' }) });
    const en = await scan(busy);
    expect(en).toMatchObject({ verdict: 'retake', reasons: ['OCR_UNAVAILABLE', 'OCR_BUSY'], retryAfterSec: 42, ocr: { status: 'busy' } });
    expect(en.verdictLine).toBe('Please retake the photo');
    expect(en.why).toBe('The label reader is busy right now. Please try again in a minute.');
    const hi = await scan(ocrWith({ post: status(429) }), { lang: 'hi' });
    expect(hi.why).toMatch(/एक मिनट/);
    expect(hi.retryAfterSec).toBe(60);
  });

  it.each([
    ['missing key', ocrWith({}, { key: '' }), 'not_configured'],
    ['timeout', ocrWith({ post: 'hang' }, { timeoutMs: 50 }), 'timeout'],
    ['bad key', ocrWith({ post: status(401) }), 'auth'],
    ['Azure error', ocrWith({ post: status(500) }), 'service_error'],
    ['operation failed', ocrWith({ polls: [ok200({ status: 'failed' })] }), 'failed'],
  ])('%s: retake OCR_UNAVAILABLE with a clear reason', async (_, fn, detail) => {
    quiet();
    const r = await scan(fn);
    expect(r).toMatchObject({ verdict: 'retake', reasons: ['OCR_UNAVAILABLE'], ocr: { status: 'unavailable', detail } });
    expect(r.why).toBe("Couldn't read the label right now. Please try again.");
  });

  it('no failure mode is ever green, for any diet', async () => {
    quiet();
    const failures = [
      ocrWith({}, { key: '' }), ocrWith({ post: status(429) }), ocrWith({ post: status(403) }), ocrWith({ post: status(503) }),
      ocrWith({ post: 'hang' }, { timeoutMs: 30 }), ocrWith({ polls: [status(200, 'not json')] }), reads([]),
      reads(LABEL('小麦粉、砂糖、食塩', 0.2)), async () => { throw new Error('unexpected'); },
    ];
    for (const preset of Object.keys(rb.diets)) {
      for (const fn of failures) {
        const r = await scan(async (img) => { try { return await fn(img); } catch { return { ok: false, status: 'unavailable', detail: 'internal' }; } }, { preset });
        expect(r.verdict, preset).toBe('retake');
      }
    }
  });
});

describe('photo scan: bad input is an error before any OCR call', () => {
  it.each([
    ['not an image', Buffer.from('hello'), 'UNSUPPORTED_IMAGE'],
    ['too small', null, 'IMAGE_TOO_SMALL'],
  ])('%s', async (_, buf, code) => {
    const buffer = buf || await sharp({ create: { width: 300, height: 200, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    const read = vi.fn();
    await expect(runScan({ input: { kind: 'photo', buffer }, preset: 'vegetarian' }, { rulebook: rb, readLabel: read })).rejects.toMatchObject({ code });
    expect(read).not.toHaveBeenCalled();
  });

  it('unknown preset is rejected before using OCR quota', async () => {
    const read = vi.fn();
    await expect(scan(read, { preset: 'vegan' })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(read).not.toHaveBeenCalled();
  });
});

describe('photo scan: saving and Supabase', () => {
  it('saves verdict, reasons, matched ingredients and page confidence; no label text, no photo', async () => {
    const saveScan = vi.fn(async () => 'scan-9');
    const r = await scan(reads(LABEL('小麦粉、ラード')), { lang: 'gu', user: USER }, { saveScan });
    const row = saveScan.mock.calls[0][0];
    expect(r.scanId).toBe('scan-9');
    expect(row).toMatchObject({ source: 'photo', verdict: 'red', language: 'gu', ocr_confidence: 0.98 });
    expect(row.items.map((i) => i.ingredientId)).toContain('lard');
    const stored = JSON.stringify(row);
    expect(stored).not.toContain('原材料名');
    expect(stored).not.toContain('クッキー');
    expect(Object.values(row).some((v) => Buffer.isBuffer(v))).toBe(false);
  }, 10000);

  it('retake results are saved too (useful for OCR quality), without text', async () => {
    quiet();
    const saveScan = vi.fn(async () => 'scan-r');
    await scan(ocrWith({ post: status(429) }), { user: USER }, { saveScan });
    expect(saveScan.mock.calls[0][0]).toMatchObject({ verdict: 'retake', reasons: ['OCR_UNAVAILABLE', 'OCR_BUSY'], items: [] });
  });

  it('Supabase down: the photo verdict is still returned', async () => {
    const log = quiet();
    const r = await scan(reads(LABEL('小麦粉、ラード')), { user: USER }, { saveScan: async () => { throw new Error('connection refused'); } });
    expect(r).toMatchObject({ verdict: 'red', scanId: null });
    expect(log.mock.calls.map((c) => JSON.parse(c[0]).op)).toContain('save_scan');
  });

  it('no diet sent and no profile: strictest fallback', async () => {
    const r = await runScan({ input: { kind: 'photo', buffer: PHOTO }, user: USER }, {
      rulebook: rb, readLabel: reads(LABEL('しょうゆ、みりん')), loadProfile: async () => null, saveScan: async () => 'x',
    });
    expect(r.dietSource).toBe('fallback');
    expect(r.profile).toEqual({ preset: FALLBACK_DIET.preset, options: FALLBACK_DIET.options });
    expect(r.verdict).toBe('red');
  });
});
