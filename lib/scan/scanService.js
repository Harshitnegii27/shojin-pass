// The conductor (spec 5, 9): the only file that knows the order of the scan pipeline.
// Every verdict comes from scanLabel() (or retakeResult() for the photo page gate); nothing here
// decides or changes one. Supabase is optional here: loading the profile and saving the row may
// fail or time out, and the verdict is still returned (logged, scanId null).

import 'server-only';
import { scanLabel, retakeResult } from './scanText.js';
import { saveScan, scanRow } from './scanRepo.js';
import { serverRulebook } from '../config/rulebook.js';
import { env, isProduction } from '../config/env.js';
import { getProfile } from '../db/profiles.js';
import { resolveProfile } from '../diet/resolveProfile.js';
import { prepareImage } from '../image/prepareImage.js';
import { readLabel } from '../ocr/index.js';
import { AppError } from '../http/errors.js';
import { logError } from '../http/log.js';
import { withTimeout } from '../http/timeout.js';
import { ocrNotice } from '../text/ocrNotices.js';

// Used when the request has no diet and no saved profile can be read: the strictest preset plus
// every option that adds caution, so a lost diet can never produce a false safe for anyone.
export const FALLBACK_DIET = { preset: 'jain_strict', options: ['avoid_shared_line'] };

const defaultDeps = {
  loadProfile: (user) => getProfile(user.client, user.id),
  saveScan,
  prepareImage,
  readLabel,
};

// Which diet to judge by. source: 'request' | 'saved' | 'fallback'.
async function chooseDiet({ preset, options, lang, user }, deps, ms) {
  if (preset) return { preset, options: options || [], lang, source: 'request' };
  if (user) {
    try {
      const saved = await withTimeout(deps.loadProfile(user), ms, 'load_profile');
      if (saved?.preset) return { preset: saved.preset, options: saved.options || [], lang: lang || saved.lang, source: 'saved' };
    } catch (err) {
      logError('load_profile', err);
    }
  }
  return { ...FALLBACK_DIET, lang, source: 'fallback' };
}

// Photo path, spec 9.2–9.4. Bad files are errors (413/415/422); OCR problems are `retake`.
async function photoResult(buffer, diet, lang, rb, d) {
  const profile = resolveProfile(diet, rb);            // unknown preset -> 400 before using OCR quota
  const image = await d.prepareImage(buffer);
  const ocr = await d.readLabel(image.buffer);

  if (!ocr.ok) {
    const result = retakeResult('OCR_UNAVAILABLE', profile, lang, rb);
    if (ocr.status === 'busy') {
      return { ...result, reasons: ['OCR_UNAVAILABLE', 'OCR_BUSY'], why: ocrNotice('OCR_BUSY', lang), retryAfterSec: ocr.retryAfterSec ?? 60, ocr: { status: 'busy', ms: ocr.ms } };
    }
    return { ...result, ocr: { status: 'unavailable', detail: ocr.detail, ms: ocr.ms } };
  }

  // Page gate (9.4): no characters, or the page as a whole is too unclear.
  const page = ocr.pageConfidence;
  if (page === null || page < env.OCR_MIN_PAGE_CONFIDENCE) {
    const result = retakeResult('OCR_LOW_PAGE_CONFIDENCE', profile, lang, rb);
    return { ...result, ocr: { status: page === null ? 'no_text' : 'low_confidence', pageConfidence: page, ms: ocr.ms } };
  }

  const result = scanLabel({
    raw: ocr.raw, confidence: ocr.confidence, preset: diet.preset, options: diet.options, lang,
    minCharConfidence: env.OCR_MIN_CHAR_CONFIDENCE,
  }, rb);
  // The label text is returned only outside production, to help test OCR. It is never stored or logged.
  return { ...result, ocr: { status: 'ok', pageConfidence: page, ms: ocr.ms, ...(isProduction ? {} : { text: ocr.raw }) } };
}

// input: { kind: 'text', text } | { kind: 'photo', buffer }. user: from getUser(), or null.
// deps (tests): { rulebook, loadProfile, saveScan, prepareImage, readLabel, timeoutMs }.
export async function runScan({ input, user = null, preset, options, lang }, deps = {}) {
  const started = Date.now();
  const d = { ...defaultDeps, ...deps };
  const ms = d.timeoutMs ?? env.SUPABASE_TIMEOUT_MS;
  const rb = d.rulebook || serverRulebook();
  if (input?.kind !== 'text' && input?.kind !== 'photo') throw new AppError('INVALID_REQUEST');

  const diet = await chooseDiet({ preset, options, lang, user }, d, ms);
  const usedLang = diet.lang || 'en';

  const result = input.kind === 'photo'
    ? await photoResult(input.buffer, diet, usedLang, rb, d)
    // Typed text: no OCR, so confidence is 1.0 for every character (spec 13.5).
    : scanLabel({
      raw: input.text, confidence: null, preset: diet.preset, options: diet.options, lang: usedLang,
      minCharConfidence: env.OCR_MIN_CHAR_CONFIDENCE,
    }, rb);
  result.latencyMs = Date.now() - started;

  // Saved before replying (spec 9.12), but a failed or slow save never costs the user the verdict.
  let scanId = null;
  if (user) {
    try {
      scanId = await withTimeout(d.saveScan(scanRow({ userId: user.id, source: input.kind, lang: usedLang, result })), ms, 'save_scan');
    } catch (err) {
      logError('save_scan', err);
    }
  }
  return { ...result, dietSource: diet.source, scanId };
}
