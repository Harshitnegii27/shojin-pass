// Convenience wrapper used by /api/scan/text and the OCR path: profile + analysis + fixed text.
import { resolveProfile } from '../diet/resolveProfile.js';
import { analyzeLabel } from './analyze.js';
import { attachText } from '../text/templates.js';

export function scanLabel({ raw, confidence = null, preset = 'vegetarian', options = [], lang = 'en', minCharConfidence = 0.7 }, rb) {
  const profile = resolveProfile({ preset, options }, rb);
  const result = analyzeLabel({ raw, confidence, minCharConfidence }, profile, rb);
  return attachText(result, profile.label, lang);
}

// OCR page gate: called before analysis for photo scans.
export function retakeResult(code, profile, lang, rb) {
  const result = { verdict: 'retake', reasons: [code], items: [], unknown: [], hidden: [], outside: [], lowConfidence: [], completeness: 'incomplete', notes: [], sections: [], profile: { preset: profile.preset, options: profile.options }, rulebookVersion: rb.version };
  return attachText(result, profile.label, lang);
}
