import { buildRulebook, readRulebookFiles } from '../lib/rulebook/loader.js';
import { resolveProfile } from '../lib/diet/resolveProfile.js';
import { analyzeLabel } from '../lib/scan/analyze.js';

export const data = readRulebookFiles();
export const rb = buildRulebook(data, { allowUnreviewed: true });
export const PRESETS = Object.keys(data.diets);
export const profileOf = (preset = 'vegetarian', options = []) => resolveProfile({ preset, options }, rb);

// confidence: optional { low: ['豚'], value: 0.3 } -> every character of each listed substring gets `value`
export function run(raw, preset = 'vegetarian', options = [], confidence = null) {
  let conf = null;
  if (confidence) {
    conf = Array.from({ length: raw.length }, () => confidence.base ?? 0.99);
    for (const s of confidence.low || []) {
      let from = 0;
      let at;
      while ((at = raw.indexOf(s, from)) >= 0) { for (let i = at; i < at + s.length; i++) conf[i] = confidence.value ?? 0.3; from = at + 1; }
    }
  }
  return analyzeLabel({ raw, confidence: conf, minCharConfidence: 0.7 }, profileOf(preset, options), rb);
}
export const label = (list, tail = '\n内容量：100g') => '原材料名：' + list + tail;
