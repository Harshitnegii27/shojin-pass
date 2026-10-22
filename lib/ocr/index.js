// readLabel(): provider-neutral OCR (spec 9.3). Returns
//   { ok: true, raw, confidence, pageConfidence, ms }   confidence: one number per UTF-16 unit of raw
//   { ok: false, status: 'busy' | 'unavailable', detail, retryAfterSec?, ms }
// It never throws and never decides anything: the page gate and the verdict happen elsewhere.
// Failures are logged without any label text.

import 'server-only';
import { env } from '../config/env.js';
import { logError } from '../http/log.js';
import { azureRead32 } from './azureRead.js';
import { orderLines, buildText, pageConfidence } from './layout.js';

// deps (tests): { read, endpoint, key, timeoutMs, fetchFn, sleep, pollMs }
export async function readLabel(image, deps = {}) {
  const started = Date.now();
  const done = (r) => {
    const out = { ...r, ms: Date.now() - started };
    if (!out.ok) logError('ocr', out.detail, { status: out.status, httpStatus: out.httpStatus, ms: out.ms, error: out.error });
    return out;
  };
  try {
    const endpoint = deps.endpoint ?? env.AZURE_VISION_ENDPOINT;
    const key = deps.key ?? env.AZURE_VISION_KEY;
    if (!endpoint || !key) return done({ ok: false, status: 'unavailable', detail: 'not_configured' });

    const read = deps.read || azureRead32;
    const r = await read(image, {
      endpoint, key, language: 'ja', timeoutMs: deps.timeoutMs ?? env.OCR_TIMEOUT_MS,
      fetchFn: deps.fetchFn, sleep: deps.sleep, pollMs: deps.pollMs,
    });
    if (!r.ok) return done(r);

    const { raw, confidence } = buildText(orderLines(r.lines, r.angle));
    return done({ ok: true, raw, confidence, pageConfidence: pageConfidence(raw, confidence) });
  } catch (err) {
    return done({ ok: false, status: 'unavailable', detail: 'internal', error: String(err?.message || err) });
  }
}
