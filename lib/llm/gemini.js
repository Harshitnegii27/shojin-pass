// Google Gemini API, generateContent over REST. Writes text only; never sees label text.
// Never throws: returns { ok: true, text } or { ok: false, status: 'busy' | 'unavailable', detail }.

import 'server-only';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

async function errorReason(res) {
  try {
    const body = await res.json();
    const reason = body?.error?.details?.find?.((d) => d?.reason)?.reason || body?.error?.status;
    return reason ? String(reason).slice(0, 80) : undefined;
  } catch {
    return undefined;
  }
}

// opts: { key, model, thinkingLevel, timeoutMs, system, input (object, sent as JSON), schema?, maxOutputTokens?, fetchFn? }
// schema: structured output (generationConfig.responseSchema, OpenAPI subset) the reply must follow.
export async function geminiGenerate(opts) {
  const fetchFn = opts.fetchFn || fetch;
  const generationConfig = {
    temperature: 0.2,
    maxOutputTokens: opts.maxOutputTokens ?? 1024,
    responseMimeType: 'application/json',
    ...(opts.schema ? { responseSchema: opts.schema } : {}),
  };
  if (opts.thinkingLevel && opts.thinkingLevel !== 'none') generationConfig.thinkingConfig = { thinkingLevel: opts.thinkingLevel };

  let res;
  try {
    res = await fetchFn(BASE + encodeURIComponent(opts.model) + ':generateContent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(opts.input) }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
  } catch (err) {
    return { ok: false, status: 'unavailable', detail: err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'timeout' : 'network' };
  }

  if (res.status !== 200) {
    const reason = await errorReason(res); // e.g. ACCESS_TOKEN_TYPE_UNSUPPORTED, RESOURCE_EXHAUSTED
    if (res.status === 429) return { ok: false, status: 'busy', detail: 'busy', httpStatus: 429, reason };
    const detail = res.status === 401 || res.status === 403 ? 'auth'
      : res.status === 404 ? 'model_not_found'
      : res.status === 400 ? 'bad_request'
      : res.status >= 500 ? 'service_error' : 'unexpected_status';
    return { ok: false, status: 'unavailable', detail, httpStatus: res.status, reason };
  }

  let body;
  try {
    body = await res.json();
  } catch (err) {
    return { ok: false, status: 'unavailable', detail: err?.name === 'TimeoutError' ? 'timeout' : 'bad_response' };
  }
  if (body?.promptFeedback?.blockReason) return { ok: false, status: 'unavailable', detail: 'blocked', reason: String(body.promptFeedback.blockReason) };
  const cand = body?.candidates?.[0];
  if (!cand) return { ok: false, status: 'unavailable', detail: 'bad_response' };
  if (cand.finishReason && cand.finishReason !== 'STOP') return { ok: false, status: 'unavailable', detail: 'finish_' + String(cand.finishReason).toLowerCase() };
  const text = (cand.content?.parts || []).filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('');
  if (!text) return { ok: false, status: 'unavailable', detail: 'empty' };
  return { ok: true, text };
}
