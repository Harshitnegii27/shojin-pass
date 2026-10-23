// Checks for the daily cron and the deep health route (spec 13.12, B11). Each returns
// { status: 'ok' | 'fail' | 'skipped' | 'busy', ms, detail? } and never throws. 'skipped' means the
// service has no key configured. Nothing here logs or returns label text or keys.

import 'server-only';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../db/supabaseAdmin.js';
import { withTimeout } from '../http/timeout.js';
import { reserveOcrScan } from '../http/rateLimit.js';
import { readLabel } from '../ocr/index.js';
import { geminiGenerate } from '../llm/gemini.js';
import { SAMPLE_LABEL_PNG, EXPECTED_TEXT } from './sampleLabel.js';

const dbConfigured = () => Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

async function timed(fn) {
  const started = Date.now();
  try {
    const r = await fn();
    return { ...r, ms: Date.now() - started };
  } catch (err) {
    return { status: 'fail', detail: String(err?.message || err).slice(0, 120), ms: Date.now() - started };
  }
}

const supabaseCall = async (promise, op) => {
  const { error } = await withTimeout(promise, env.SUPABASE_TIMEOUT_MS * 2, op);
  if (error) throw new Error(error.message || op + ' failed');
  return { status: 'ok' };
};

// A tiny real query: keeps the free Supabase project from pausing and proves the server can reach it.
export function checkDb(deps = {}) {
  return timed(async () => {
    if (!deps.db && !dbConfigured()) return { status: 'skipped' };
    const db = deps.db || supabaseAdmin();
    return supabaseCall(db.from('profiles').select('id').limit(1), 'db_ping');
  });
}

// Unlinks old scans from users and drops old LLM-call and rate-limit rows (apply_retention).
export function runRetention(deps = {}) {
  return timed(async () => {
    if (!deps.db && !dbConfigured()) return { status: 'skipped' };
    const db = deps.db || supabaseAdmin();
    return supabaseCall(db.rpc('apply_retention', { scan_days: env.SCAN_RETENTION_DAYS }), 'apply_retention');
  });
}

// Reads the bundled label (2-3 Azure calls, so only the deep check runs this, never the cron).
export function checkOcr(deps = {}) {
  return timed(async () => {
    if (!deps.readLabel && !(env.AZURE_VISION_ENDPOINT && env.AZURE_VISION_KEY)) return { status: 'skipped' };
    const slot = await (deps.reserveOcr || reserveOcrScan)();
    if (!slot.allowed) return { status: 'busy', detail: 'local_limit' };
    const r = await (deps.readLabel || readLabel)(SAMPLE_LABEL_PNG);
    if (!r.ok) return { status: r.status === 'busy' ? 'busy' : 'fail', detail: r.detail };
    return r.raw.includes(EXPECTED_TEXT) ? { status: 'ok' } : { status: 'fail', detail: 'expected_text_missing' };
  });
}

// One fixed, tiny Gemini request with a fixed reply. Sends no user data.
export function checkLlm(deps = {}) {
  return timed(async () => {
    if (!env.LLM_ENABLED || (!deps.generate && !env.LLM_API_KEY)) return { status: 'skipped' };
    const r = await (deps.generate || geminiGenerate)({
      key: env.LLM_API_KEY, model: env.LLM_MODEL, thinkingLevel: env.LLM_THINKING_LEVEL, timeoutMs: env.LLM_TIMEOUT_MS,
      system: 'This is a health check. Reply with {"ok": true}.',
      input: { ping: true },
      schema: { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } }, required: ['ok'] },
      maxOutputTokens: 50,
    });
    if (!r.ok) return { status: r.status === 'busy' ? 'busy' : 'fail', detail: r.detail };
    let reply;
    try {
      reply = JSON.parse(r.text);
    } catch {
      return { status: 'fail', detail: 'bad_reply' };
    }
    return reply?.ok === true ? { status: 'ok' } : { status: 'fail', detail: 'bad_reply' };
  });
}
