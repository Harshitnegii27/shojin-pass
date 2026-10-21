// Builds the in-memory rulebook: entries, a trie of every normalised spelling, and normalised
// label-field markers. buildRulebook() is pure (takes plain data); loadRulebook() reads the JSON files.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAlias } from './normalize.js';
import { buildTrie } from './trie.js';

const FILES = ['meta', 'tags', 'diets', 'options', 'ingredients', 'annotations', 'markers', 'phrases.ja'];
const DEFAULT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../rulebook');

export function readRulebookFiles(dir = DEFAULT_DIR) {
  const data = {};
  for (const f of FILES) {
    data[f === 'phrases.ja' ? 'phrases' : f] = JSON.parse(fs.readFileSync(path.join(dir, f + '.json'), 'utf8'));
  }
  return data;
}

export function reviewerCount(entry) {
  return new Set((entry.reviewedBy || []).map((r) => String(r).trim().toLowerCase()).filter(Boolean)).size;
}

// opts.allowUnreviewed: include entries with fewer than two reviewers (development and tests only).
// opts.lenient: collect problems instead of throwing (used by the validator).
export function buildRulebook(data, opts = {}) {
  const problems = [];
  const fail = (msg) => problems.push(msg);
  const tagNames = new Set(Object.keys(data.tags));

  const entries = new Map();
  const aliasOwner = new Map(); // normalised alias -> id
  const pairs = [];
  let skippedUnreviewed = 0;

  const addAlias = (rawAlias, id) => {
    const a = normalizeAlias(rawAlias);
    if (!a) { fail(`"${id}": spelling "${rawAlias}" is empty after normalisation`); return; }
    const owner = aliasOwner.get(a);
    if (owner && owner !== id) {
      // Two annotation groups may share a word harmlessly; anything else is a real clash.
      if (owner.startsWith('annot:') && id.startsWith('annot:')) return;
      fail(`spelling "${rawAlias}" (normalised "${a}") belongs to both "${owner}" and "${id}"`);
      return;
    }
    if (owner === id) return;
    aliasOwner.set(a, id);
    pairs.push({ alias: a, id });
  };

  for (const e of data.ingredients) {
    if (!e.id || !/^[a-z0-9_]+$/.test(e.id)) fail(`bad id "${e.id}"`);
    if (entries.has(e.id)) fail(`duplicate id "${e.id}"`);
    if (!e.meaning || !e.meaning.en) fail(`"${e.id}": missing English meaning`);
    if (!Array.isArray(e.tags) || e.tags.length === 0) fail(`"${e.id}": no tags`);
    for (const t of e.tags || []) if (!tagNames.has(t)) fail(`"${e.id}": unknown tag "${t}"`);
    if ((e.tags || []).includes('plain_safe') && e.tags.length > 1) fail(`"${e.id}": plain_safe must be the only tag`);
    if (!Array.isArray(e.aliases) || !e.aliases.includes(e.canonical)) fail(`"${e.id}": aliases must include canonical`);
    if (reviewerCount(e) < 2 && !opts.allowUnreviewed) { skippedUnreviewed++; continue; }
    entries.set(e.id, {
      id: e.id, kind: 'ingredient', tags: [...e.tags], meaning: e.meaning, canonical: e.canonical,
      composite: Boolean(e.composite),
    });
    for (const a of e.aliases) addAlias(a, e.id);
  }

  // Annotations: words that describe the list. One pseudo-entry per kind.
  const ann = data.annotations;
  const annotKinds = Object.keys(ann.phrases);
  for (const kind of [...annotKinds, 'place']) {
    entries.set('annot:' + kind, { id: 'annot:' + kind, kind: 'annotation', annot: kind, tags: [], meaning: { en: kind } });
  }
  for (const kind of annotKinds) for (const p of ann.phrases[kind]) addAlias(p, 'annot:' + kind);
  for (const place of ann.places) for (const suf of ann.placeSuffixes) addAlias(place + suf, 'annot:place');

  // Diets and options
  const diets = data.diets;
  for (const [name, d] of Object.entries(diets)) {
    for (const t of [...(d.forbid || []), ...(d.ask || [])]) if (!tagNames.has(t)) fail(`preset "${name}": unknown tag "${t}"`);
    if (!d.label || !d.label.en) fail(`preset "${name}": missing English label`);
    if (!['jain', 'vegetarian'].includes(d.chefIdentity)) fail(`preset "${name}": chefIdentity must be jain or vegetarian`);
  }
  for (const [name, o] of Object.entries(data.options)) {
    for (const t of [...(o.forbid || []), ...(o.ask || [])]) if (!tagNames.has(t)) fail(`option "${name}": unknown tag "${t}"`);
  }

  // Markers (normalised the same way as label text)
  const m = data.markers;
  const norm = (list) => [...new Set(list.map(normalizeAlias).filter(Boolean))].sort((a, b) => b.length - a.length);
  const markers = {
    start: norm(m.start),
    startFuzzyTarget: normalizeAlias(m.startFuzzyTarget),
    startExcludeNext: norm(m.startExcludeNext),
    allergenStart: norm(m.allergenStart),
    end: norm(m.end),
    address: new Set(norm(m.address)),
    fieldInvalidPrev: new Set(m.fieldInvalidPrev),
    sharedLine: norm(m.sharedLine),
    sharedLineOpeners: norm(m.sharedLineOpeners),
    allergenTail: norm(m.allergenTail),
  };

  const rb = {
    version: data.meta.version,
    tags: data.tags,
    diets,
    options: data.options,
    phrases: data.phrases,
    entries,
    aliasOwner,
    trie: buildTrie(pairs),
    markers,
    skippedUnreviewed,
    problems,
  };
  if (problems.length && !opts.lenient) {
    throw new Error('Rulebook problems:\n- ' + problems.join('\n- '));
  }
  return rb;
}

let cached = null;
export function getRulebook() {
  if (!cached) {
    const allowUnreviewed = process.env.RULEBOOK_ALLOW_UNREVIEWED === 'true';
    cached = buildRulebook(readRulebookFiles(), { allowUnreviewed });
  }
  return cached;
}
