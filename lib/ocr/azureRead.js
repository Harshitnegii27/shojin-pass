// Azure AI Vision Read 3.2 (asynchronous): POST the image, then poll the result.
// Image Analysis 4.0 is not offered in Central India, so Read 3.2 is used (spec 2.0, B7).
// Free tier: 20 calls per minute, and every poll counts, so polling is sparse.
// Never throws: returns { ok: true, lines, angle } or { ok: false, status, detail, retryAfterSec? }.

import 'server-only';

export const API_PATH = '/vision/v3.2/read/analyze';
const DEFAULT_POLL_MS = 1000;      // Microsoft recommends 1–2 s between polls
const DEFAULT_RETRY_AFTER = 60;

function failure(detail, extra = {}) {
  return { ok: false, status: detail === 'busy' ? 'busy' : 'unavailable', detail, ...extra };
}

function fromHttp(res) {
  if (res.status === 429) {
    const s = Number(res.headers.get('retry-after'));
    return failure('busy', { httpStatus: 429, retryAfterSec: Number.isFinite(s) && s > 0 ? Math.min(Math.ceil(s), 300) : DEFAULT_RETRY_AFTER });
  }
  const detail = res.status === 401 || res.status === 403 ? 'auth'
    : res.status === 404 ? 'not_found'           // wrong endpoint or API not offered in the region
    : res.status === 400 || res.status === 415 ? 'rejected_image'
    : res.status >= 500 ? 'service_error'
    : 'unexpected_status';
  return failure(detail, { httpStatus: res.status });
}

const errorDetail = (err) => (err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'timeout' : 'network');

// opts: { endpoint, key, timeoutMs, language, pollMs?, fetchFn?, sleep? } (the last three for tests)
export async function azureRead32(image, opts) {
  const fetchFn = opts.fetchFn || fetch;
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const pollMs = opts.pollMs ?? DEFAULT_POLL_MS;
  const deadline = Date.now() + opts.timeoutMs;
  const left = () => deadline - Date.now();
  const headers = { 'Ocp-Apim-Subscription-Key': opts.key };

  let url;
  try {
    url = new URL(API_PATH.slice(1), opts.endpoint.endsWith('/') ? opts.endpoint : opts.endpoint + '/');
  } catch {
    return failure('bad_endpoint');
  }
  url.searchParams.set('language', opts.language || 'ja');

  let operation;
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/octet-stream' },
      body: image,
      signal: AbortSignal.timeout(Math.max(1, left())),
    });
    if (res.status !== 202) return fromHttp(res);
    operation = res.headers.get('operation-location');
    if (!operation) return failure('bad_response');
  } catch (err) {
    return failure(errorDetail(err));
  }

  while (left() > 0) {
    await sleep(Math.min(pollMs, Math.max(0, left())));
    if (left() <= 0) break;
    let body;
    try {
      const res = await fetchFn(operation, { headers, signal: AbortSignal.timeout(Math.max(1, left())) });
      if (res.status !== 200) return fromHttp(res);
      body = await res.json();
    } catch (err) {
      return failure(err instanceof SyntaxError ? 'bad_response' : errorDetail(err));
    }
    if (body?.status === 'succeeded') {
      const page = body.analyzeResult?.readResults?.[0];
      if (!page) return { ok: true, lines: [], angle: 0 };
      if (!Array.isArray(page.lines)) return failure('bad_response');
      const lines = page.lines.map((l) => ({
        text: typeof l.text === 'string' ? l.text : '',
        box: Array.isArray(l.boundingBox) ? l.boundingBox : [],
        words: Array.isArray(l.words) ? l.words.map((w) => ({ text: typeof w.text === 'string' ? w.text : '', confidence: w.confidence })) : [],
      }));
      return { ok: true, lines, angle: Number.isFinite(page.angle) ? page.angle : 0 };
    }
    if (body?.status === 'failed') return failure('failed');
    // notStarted / running: poll again
  }
  return failure('timeout');
}
