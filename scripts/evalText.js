#!/usr/bin/env node
// Runs every edge-case fixture and prints a table. Exit code 1 if any case fails.
import fs from 'node:fs';
import { buildRulebook, readRulebookFiles } from '../lib/rulebook/loader.js';
import { resolveProfile } from '../lib/diet/resolveProfile.js';
import { analyzeLabel } from '../lib/scan/analyze.js';
import { checkCase } from '../tests/fixtures/check.js';

const rb = buildRulebook(readRulebookFiles(), { allowUnreviewed: true });
const cases = JSON.parse(fs.readFileSync(new URL('../tests/fixtures/edge-cases.json', import.meta.url), 'utf8'));
let failed = 0;
for (const c of cases) {
  let conf = null;
  if (c.confidence) {
    conf = Array.from({ length: c.raw.length }, () => 0.99);
    for (const s of c.confidence.low) { let f = 0, at; while ((at = c.raw.indexOf(s, f)) >= 0) { for (let i = at; i < at + s.length; i++) conf[i] = c.confidence.value; f = at + 1; } }
  }
  const r = analyzeLabel({ raw: c.raw, confidence: conf }, resolveProfile({ preset: c.preset, options: c.options }, rb), rb);
  const p = checkCase(c, r);
  if (p.length) failed++;
  console.log(`${p.length ? 'FAIL' : 'ok  '} ${c.id.padEnd(5)} ${r.verdict.padEnd(5)} ${c.title}${p.length ? '\n      ' + p.join('; ') + '\n      reasons: ' + r.reasons.join(',') + ' | unknown: ' + r.unknown.map((u) => u.original).join(' ') + ' | hidden: ' + r.hidden.map((h) => h.text).join(' ') : ''}`);
}
console.log(`\n${cases.length - failed}/${cases.length} edge cases pass`);
process.exit(failed ? 1 : 0);
