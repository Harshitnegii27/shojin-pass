// Checks a preset and options against the rulebook before anything is saved (spec 8.3: unknown -> 400).

import { AppError } from '../http/errors.js';

export function checkDiet({ preset, options }, rb) {
  if (preset !== undefined && !rb.diets[preset]) {
    throw new AppError('INVALID_REQUEST', { detail: `Unknown diet preset "${preset}"` });
  }
  for (const o of options || []) {
    if (!rb.options[o]) throw new AppError('INVALID_REQUEST', { detail: `Unknown option "${o}"` });
  }
}
