// readLabel() over a mocked Azure Read 3.2: request shape, text + per-character confidence,
// vertical Japanese, and every failure ending as busy/unavailable, never as text.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { readLabel } from '../../lib/ocr/index.js';
import { orderLines, buildText, pageConfidence } from '../../lib/ocr/layout.js';
import { azureFetch, line, succeeded, ok200, status, noSleep, ENDPOINT, OP_URL } from '../azureMock.js';

const IMG = Buffer.from('fake-jpeg');
const deps = (fetchFn, extra = {}) => ({ endpoint: ENDPOINT, key: 'test-key-not-real', timeoutMs: 4000, fetchFn, sleep: noSleep, ...extra });

afterEach(() => vi.restoreAllMocks());
const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('readLabel: success', () => {
  it('calls Read 3.2 with language ja, the key header and the image bytes, then polls the result', async () => {
    const f = azureFetch({ polls: [ok200({ status: 'running' }), ok200(succeeded([line('原材料名：小麦粉')]))] });
    const r = await readLabel(IMG, deps(f));
    expect(r.ok).toBe(true);
    const [post, ...gets] = f.calls;
    expect(post.method).toBe('POST');
    expect(post.url).toBe(ENDPOINT + 'vision/v3.2/read/analyze?language=ja');
    expect(post.headers['Ocp-Apim-Subscription-Key']).toBe('test-key-not-real');
    expect(post.headers['Content-Type']).toBe('application/octet-stream');
    expect(post.body).toBe(IMG);
    expect(gets.map((g) => g.url)).toEqual([OP_URL, OP_URL]);
    expect(gets[0].headers['Ocp-Apim-Subscription-Key']).toBe('test-key-not-real');
  });

  it('accepts an endpoint without a trailing slash', async () => {
    const f = azureFetch({ polls: [ok200(succeeded([line('砂糖')]))] });
    await readLabel(IMG, deps(f, { endpoint: ENDPOINT.slice(0, -1) }));
    expect(f.calls[0].url).toBe(ENDPOINT + 'vision/v3.2/read/analyze?language=ja');
  });

  it('joins lines with line breaks and gives each character its word confidence', async () => {
    const words = [{ text: '小麦粉', confidence: 0.9 }, { text: '、', confidence: 0.5 }, { text: 'ラード', confidence: 0.4 }];
    const f = azureFetch({ polls: [ok200(succeeded([line('原材料名', undefined, 0.99), line('小麦粉、ラード', undefined, 0, words)]))] });
    const r = await readLabel(IMG, deps(f));
    expect(r.raw).toBe('原材料名\n小麦粉、ラード');
    expect(r.confidence).toHaveLength(r.raw.length);
    expect(r.confidence).toEqual([0.99, 0.99, 0.99, 0.99, 1, 0.9, 0.9, 0.9, 0.5, 0.4, 0.4, 0.4]);
  });

  it('an empty page is ok with no text (the page gate turns it into retake)', async () => {
    const f = azureFetch({ polls: [ok200(succeeded([]))] });
    const r = await readLabel(IMG, deps(f));
    expect(r).toMatchObject({ ok: true, raw: '', pageConfidence: null });
  });
});

describe('layout', () => {
  it('characters no word accounts for are unreadable (0); spaces are 1', () => {
    const { raw, confidence } = buildText([{ text: '豚 肉x', words: [{ text: '豚', confidence: 0.95 }, { text: '肉', confidence: 0.9 }] }]);
    expect(raw).toBe('豚 肉x');
    expect(confidence).toEqual([0.95, 1, 0.9, 0]);
  });

  it('missing or broken confidences count as 0; values are clamped to 0..1', () => {
    const { confidence } = buildText([{ text: 'abc', words: [{ text: 'a' }, { text: 'b', confidence: NaN }, { text: 'c', confidence: 7 }] }]);
    expect(confidence).toEqual([0, 0, 1]);
  });

  it('astral characters keep one confidence per UTF-16 unit', () => {
    const { raw, confidence } = buildText([{ text: '𩸽塩', words: [{ text: '𩸽', confidence: 0.8 }, { text: '塩', confidence: 0.9 }] }]);
    expect(raw.length).toBe(3);
    expect(confidence).toEqual([0.8, 0.8, 0.9]);
  });

  it('page confidence is the mean over non-space characters', () => {
    expect(pageConfidence('ab \nc', [1, 0.5, 1, 1, 0])).toBeCloseTo(0.5);
    expect(pageConfidence(' \n', [1, 1])).toBeNull();
  });

  it('vertical Japanese columns are read right to left, each top to bottom', () => {
    const col = (text, x, y = 0) => ({ text, box: [x, y, x + 20, y, x + 20, y + text.length * 20, x, y + text.length * 20], words: [] });
    // As OCR might return them: left to right.
    const lines = [col('ラード', 0), col('砂糖、', 40), col('原材料名', 80), col('小麦粉、', 40, 80)];
    expect(orderLines(lines).map((l) => l.text)).toEqual(['原材料名', '砂糖、', '小麦粉、', 'ラード']);
  });

  it('a vertical page tilted 90 degrees in the photo is still read as vertical columns', () => {
    // Rotated 90° clockwise: columns become rows; Azure reports angle 90 and image coordinates.
    const rot = (text, y) => ({ text, box: [0, y, text.length * 20, y, text.length * 20, y + 20, 0, y + 20], words: [] });
    const lines = [rot('ラード', 0), rot('原材料名', 80)];
    expect(orderLines(lines, 90).map((l) => l.text)).toEqual(['原材料名', 'ラード']);
  });

  it('horizontal lines keep the provider order; mixed pages put the larger group first', () => {
    const h = (text, y) => ({ text, box: [0, y, 400, y, 400, y + 20, 0, y + 20], words: [] });
    const v = (text, x) => ({ text, box: [x, 100, x + 20, 100, x + 20, 300, x, 300], words: [] });
    expect(orderLines([h('名称：クッキー', 0), h('原材料名：小麦粉、砂糖', 30), v('賞味', 500)]).map((l) => l.text))
      .toEqual(['名称：クッキー', '原材料名：小麦粉、砂糖', '賞味']);
  });
});

describe('readLabel: failures never produce text', () => {
  it.each([
    ['no endpoint', { endpoint: '' }],
    ['no key', { key: '' }],
  ])('%s: unavailable without calling Azure', async (_, extra) => {
    quiet();
    const f = azureFetch();
    const r = await readLabel(IMG, { ...deps(f), ...extra });
    expect(r).toMatchObject({ ok: false, status: 'unavailable', detail: 'not_configured' });
    expect(f.calls).toHaveLength(0);
  });

  it('429 on upload: busy, with Retry-After from Azure', async () => {
    quiet();
    const r = await readLabel(IMG, deps(azureFetch({ post: status(429, {}, { 'Retry-After': '17' }) })));
    expect(r).toMatchObject({ ok: false, status: 'busy', detail: 'busy', retryAfterSec: 17 });
  });

  it('429 while polling: busy, 60 s when Azure gives no Retry-After', async () => {
    quiet();
    const r = await readLabel(IMG, deps(azureFetch({ polls: [status(429)] })));
    expect(r).toMatchObject({ ok: false, status: 'busy', retryAfterSec: 60 });
  });

  it.each([
    [401, 'auth'], [403, 'auth'], [404, 'not_found'], [400, 'rejected_image'], [415, 'rejected_image'],
    [500, 'service_error'], [503, 'service_error'], [302, 'unexpected_status'],
  ])('HTTP %i on upload: unavailable (%s)', async (code, detail) => {
    quiet();
    expect(await readLabel(IMG, deps(azureFetch({ post: status(code) })))).toMatchObject({ ok: false, status: 'unavailable', detail, httpStatus: code });
  });

  it('upload accepted without an Operation-Location: unavailable', async () => {
    quiet();
    expect(await readLabel(IMG, deps(azureFetch({ post: status(202) })))).toMatchObject({ ok: false, detail: 'bad_response' });
  });

  it('Azure reports the operation failed: unavailable', async () => {
    quiet();
    expect(await readLabel(IMG, deps(azureFetch({ polls: [ok200({ status: 'failed' })] })))).toMatchObject({ ok: false, detail: 'failed' });
  });

  it.each([
    ['not JSON', status(200, '{oops')],
    ['no lines array', ok200({ status: 'succeeded', analyzeResult: { readResults: [{ page: 1 }] } })],
  ])('malformed result (%s): unavailable', async (_, poll) => {
    quiet();
    expect(await readLabel(IMG, deps(azureFetch({ polls: [poll] })))).toMatchObject({ ok: false, detail: 'bad_response' });
  });

  it('network failure: unavailable', async () => {
    quiet();
    const f = async () => { throw new TypeError('fetch failed'); };
    expect(await readLabel(IMG, deps(f))).toMatchObject({ ok: false, detail: 'network' });
  });

  it('upload hangs: gives up at OCR_TIMEOUT_MS', async () => {
    quiet();
    const started = Date.now();
    const r = await readLabel(IMG, deps(azureFetch({ post: 'hang' }), { timeoutMs: 80 }));
    expect(r).toMatchObject({ ok: false, status: 'unavailable', detail: 'timeout' });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('still running at the deadline: timeout', async () => {
    quiet();
    const r = await readLabel(IMG, deps(azureFetch({ polls: [ok200({ status: 'running' })] }), { timeoutMs: 60, sleep: undefined, pollMs: 20 }));
    expect(r).toMatchObject({ ok: false, detail: 'timeout' });
  });

  it('a bug in the provider: unavailable, never a crash', async () => {
    quiet();
    const r = await readLabel(IMG, deps(null, { read: () => { throw new Error('boom'); } }));
    expect(r).toMatchObject({ ok: false, status: 'unavailable', detail: 'internal' });
  });

  it('failures are logged without label text', async () => {
    const log = quiet();
    await readLabel(IMG, deps(azureFetch({ post: status(401) })));
    const entry = JSON.parse(log.mock.calls[0][0]);
    expect(entry).toMatchObject({ op: 'ocr', message: 'auth', status: 'unavailable', httpStatus: 401 });
  });
});
