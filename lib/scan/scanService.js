// The conductor (spec 5, 9): the only file that knows the order of the scan pipeline.
// Every verdict comes from scanLabel(); nothing here decides or changes one.

import 'server-only';
import { scanLabel } from './scanText.js';
import { serverRulebook } from '../config/rulebook.js';
import { env } from '../config/env.js';
import { AppError } from '../http/errors.js';

// input: { kind: 'text', text } (photo arrives in stage 3).
// TODO(stage 2): take preset/options from the saved profile when the request leaves them out.
// TODO(stage 3): photo path (prepareImage, readLabel, page gate) and saving the scan row.
export async function runScan({ input, preset = 'vegetarian', options = [], lang = 'en' }) {
  const started = Date.now();
  const rb = serverRulebook();
  if (input.kind !== 'text') throw new AppError('INVALID_REQUEST');

  // Typed text: no OCR, so confidence is 1.0 for every character (spec 13.5).
  const result = scanLabel({
    raw: input.text, confidence: null, preset, options, lang,
    minCharConfidence: env.OCR_MIN_CHAR_CONFIDENCE,
  }, rb);

  return { ...result, scanId: null, latencyMs: Date.now() - started };
}
