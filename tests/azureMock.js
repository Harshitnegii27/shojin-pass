// A fake Azure Read 3.2 for tests. Nothing here talks to the network.

export const ENDPOINT = 'https://test-vision.cognitiveservices.azure.com/';
export const OP_URL = 'https://test-vision.cognitiveservices.azure.com/vision/v3.2/read/analyzeResults/op-1';

// One OCR line. Every character is its own "word" (as Azure does for Japanese) unless `words` is given.
// box: axis-aligned [x, y, w, h] -> Azure's 8-number polygon.
export function line(text, [x, y, w, h] = [0, 0, text.length * 20, 20], conf = 0.98, words = null) {
  return {
    text,
    boundingBox: [x, y, x + w, y, x + w, y + h, x, y + h],
    words: words || [...text].filter((c) => c.trim()).map((c) => ({ text: c, boundingBox: [], confidence: conf })),
  };
}

export const succeeded = (lines, angle = 0) => ({
  status: 'succeeded',
  analyzeResult: { version: '3.2', readResults: [{ page: 1, angle, width: 2000, height: 2000, unit: 'pixel', lines }] },
});

function response(status, body, headers = {}) {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return {
    status,
    headers: { get: (k) => (h.has(k.toLowerCase()) ? h.get(k.toLowerCase()) : null) },
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
  };
}

// post: response for the POST (default 202 + Operation-Location).
// polls: responses for each GET in order (the last one repeats).
// Each entry may be a Response-like object, or 'hang' to never answer until aborted.
export function azureFetch({ post, polls = [] } = {}) {
  const calls = [];
  const answer = (r, init) => {
    if (r === 'hang') {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal.reason || Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    }
    return Promise.resolve(r);
  };
  const fn = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method || 'GET', headers: init.headers || {}, body: init.body });
    if ((init.method || 'GET') === 'POST') return answer(post ?? response(202, null, { 'Operation-Location': OP_URL }), init);
    const i = calls.filter((c) => c.method === 'GET').length - 1;
    return answer(polls[Math.min(i, polls.length - 1)], init);
  };
  fn.calls = calls;
  return fn;
}

export const ok200 = (body) => response(200, body);
export const status = (code, body = {}, headers = {}) => response(code, body, headers);
export const noSleep = async () => {};
