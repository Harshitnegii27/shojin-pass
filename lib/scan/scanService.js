// The conductor (spec 5, 9): the only file that knows the order of the scan pipeline.
// Every verdict comes from scanLabel(); nothing here decides or changes one.
// Supabase is optional here: loading the profile and saving the row may fail or time out,
// and the verdict is still returned (logged, scanId null).

import 'server-only';
import { scanLabel } from './scanText.js';
import { saveScan, scanRow } from './scanRepo.js';
import { serverRulebook } from '../config/rulebook.js';
import { env } from '../config/env.js';
import { getProfile } from '../db/profiles.js';
import { AppError } from '../http/errors.js';
import { logError } from '../http/log.js';
import { withTimeout } from '../http/timeout.js';

// Used when the request has no diet and no saved profile can be read: the strictest preset plus
// every option that adds caution, so a lost diet can never produce a false safe for anyone.
export const FALLBACK_DIET = { preset: 'jain_strict', options: ['avoid_shared_line'] };

const defaultDeps = {
  loadProfile: (user) => getProfile(user.client, user.id),
  saveScan,
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

// input: { kind: 'text', text } (photo arrives in stage 3). user: from getUser(), or null.
// deps (tests): { rulebook, loadProfile, saveScan, timeoutMs }.
export async function runScan({ input, user = null, preset, options, lang }, deps = {}) {
  const started = Date.now();
  const d = { ...defaultDeps, ...deps };
  const ms = d.timeoutMs ?? env.SUPABASE_TIMEOUT_MS;
  const rb = d.rulebook || serverRulebook();
  if (input.kind !== 'text') throw new AppError('INVALID_REQUEST');

  const diet = await chooseDiet({ preset, options, lang, user }, d, ms);
  const usedLang = diet.lang || 'en';

  // Typed text: no OCR, so confidence is 1.0 for every character (spec 13.5).
  const result = scanLabel({
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
