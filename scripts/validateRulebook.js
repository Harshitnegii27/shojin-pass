#!/usr/bin/env node
// Checks the rulebook. Exit code 1 on any error.
//   node scripts/validateRulebook.js           development: unreviewed entries are a warning
//   node scripts/validateRulebook.js --strict  release: every entry needs two reviewers
//   add --report to print the full hidden-word and overlap reports

import { buildRulebook, readRulebookFiles, reviewerCount } from '../lib/rulebook/loader.js';
import { normalizeAlias } from '../lib/rulebook/normalize.js';
import { isBoundarySensitive } from '../lib/rulebook/chars.js';

export function validate(data, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  const info = {};
  const rb = buildRulebook(data, { allowUnreviewed: true, lenient: true });
  errors.push(...rb.problems);

  // Reviewers
  const unreviewed = data.ingredients.filter((e) => reviewerCount(e) < 2).map((e) => e.id);
  if (unreviewed.length) {
    const msg = `${unreviewed.length} of ${data.ingredients.length} entries have fewer than two reviewers`;
    (strict ? errors : warnings).push(msg);
  }

  // Version format
  if (!/^\d+\.\d+\.\d+$/.test(String(data.meta.version))) errors.push('meta.version must look like 1.2.3');

  // Strictness order: along presets sorted by strictnessRank, each tag's colour never gets milder.
  const sev = (d, t) => (d.forbid.includes(t) ? 2 : d.ask.includes(t) ? 1 : 0);
  const presets = Object.entries(data.diets).sort((a, b) => a[1].strictnessRank - b[1].strictnessRank);
  for (const t of Object.keys(data.tags)) {
    for (let i = 1; i < presets.length; i++) {
      const [pn, pd] = presets[i - 1];
      const [cn, cd] = presets[i];
      if (sev(cd, t) < sev(pd, t)) errors.push(`strictness order broken: tag "${t}" is milder in "${cn}" than in "${pn}"`);
    }
  }
  const ranks = presets.map(([, d]) => d.strictnessRank);
  if (new Set(ranks).size !== ranks.length) errors.push('strictnessRank values must be unique');
  for (const [n, d] of Object.entries(data.diets)) {
    const both = d.forbid.filter((t) => d.ask.includes(t));
    if (both.length) errors.push(`preset "${n}": tags both forbidden and asked: ${both.join(', ')}`);
  }

  // Chef phrases for every tag a preset forbids or asks about (dairy, source_unclear, plain_safe excepted).
  const used = new Set(Object.values(data.diets).flatMap((d) => [...d.forbid, ...d.ask]));
  for (const t of used) {
    if (['dairy', 'source_unclear', 'plain_safe'].includes(t)) continue;
    if (!data.phrases.tags[t]) errors.push(`no chef-card phrase for tag "${t}"`);
  }

  // Reports
  const relevantTags = used;
  const aliasInfo = [];
  for (const [alias, id] of rb.aliasOwner) {
    const e = rb.entries.get(id);
    if (!e) continue;
    aliasInfo.push({ alias, id, relevant: e.kind === 'ingredient' && e.tags.some((t) => relevantTags.has(t)), annotation: e.kind === 'annotation' });
  }
  const relevantAliases = aliasInfo.filter((a) => a.relevant);
  const safeAliases = aliasInfo.filter((a) => !a.relevant);

  // Hidden words: a relevant spelling inside a longer spelling of a different entry.
  const hidden = [];
  for (const f of relevantAliases) {
    for (const s of aliasInfo) {
      if (s.id !== f.id && s.alias.length > f.alias.length && s.alias.includes(f.alias)) {
        hidden.push(`${f.alias} (${f.id}) inside ${s.alias} (${s.id})`);
      }
    }
  }
  info.hiddenWords = hidden;
  // Annotations that swallow a relevant spelling need a human look.
  info.annotationsContainingRelevant = hidden.filter((h) => h.includes('(annot:'));

  // Overlaps (2+ characters): the end of a safe spelling equals the start of a relevant one. Longest match could
  // consume part of the relevant word; the runtime hidden-term check turns that into amber.
  const overlaps = [];
  for (const s of safeAliases) {
    for (const f of relevantAliases) {
      for (let k = 2; k < Math.min(s.alias.length, f.alias.length); k++) {
        if (s.alias.endsWith(f.alias.slice(0, k))) { overlaps.push(`${s.alias} + ${f.alias}`); break; }
      }
    }
  }
  info.overlaps = overlaps;
  info.singleCharRelevant = relevantAliases.filter((a) => a.alias.length === 1).map((a) => `${a.alias} (${a.id})`);
  info.boundarySensitive = aliasInfo.filter((a) => isBoundarySensitive(a.alias)).map((a) => a.alias);

  // Composite flags only make sense on entries that are not plain components.
  for (const e of data.ingredients) {
    if (e.composite && e.tags.length === 1 && e.tags[0] === 'plain_safe' && e.id !== 'additive_category') {
      warnings.push(`"${e.id}" is composite but plain_safe; the flag has no effect`);
    }
  }
  // Markers must survive normalisation.
  for (const [k, list] of Object.entries(data.markers)) {
    if (!Array.isArray(list)) continue;
    for (const w of list) if (!normalizeAlias(w)) errors.push(`marker "${w}" in ${k} is empty after normalisation`);
  }
  return { errors, warnings, info, stats: { entries: data.ingredients.length, spellings: rb.aliasOwner.size, unreviewed: unreviewed.length } };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const strict = process.argv.includes('--strict');
  const report = process.argv.includes('--report');
  const { errors, warnings, info, stats } = validate(readRulebookFiles(), { strict });
  console.log(`Rulebook: ${stats.entries} entries, ${stats.spellings} spellings (incl. annotations), ${stats.unreviewed} unreviewed`);
  for (const w of warnings) console.log('WARN  ' + w);
  console.log(`INFO  ${info.hiddenWords.length} hidden-word pairs, ${info.overlaps.length} overlaps, ${info.singleCharRelevant.length} one-character relevant spellings, ${info.boundarySensitive.length} boundary-sensitive spellings`);
  if (report) {
    console.log('\n-- one-character relevant spellings --\n' + info.singleCharRelevant.join('\n'));
    console.log('\n-- annotations containing relevant spellings --\n' + info.annotationsContainingRelevant.join('\n'));
    console.log('\n-- hidden words --\n' + info.hiddenWords.join('\n'));
    console.log('\n-- overlaps --\n' + info.overlaps.join('\n'));
  }
  for (const e of errors) console.log('ERROR ' + e);
  process.exit(errors.length ? 1 : 0);
}
