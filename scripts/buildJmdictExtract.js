#!/usr/bin/env node
// Writes data/jmdict-extract.json: the JMdict entries whose kanji or kana spelling is exactly the
// Japanese term (`canonical`) of a rulebook entry. Only the review CSV uses it (column jmdict_meaning);
// the engine never reads it. Reads the rulebook; never changes it.
//   node scripts/buildJmdictExtract.js path/to/JMdict_e.gz   (or the unpacked JMdict_e)
// JMdict_e comes from http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz. The full file (60+ MB) stays out
// of the repo. JMdict is © the Electronic Dictionary Research and Development Group, CC BY-SA 4.0.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { readRulebookFiles } from '../lib/rulebook/loader.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'jmdict-extract.json');

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, n) => XML_ENTITIES[n]);
const all = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}(?: [^>]*)?>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => m[1]);
const texts = (xml, tag) => all(xml, tag).map(decode);

// One <entry> as { seq, kanji, kana, senses: [{ stagk, stagr, glosses }] }.
export function parseEntry(xml) {
  return {
    seq: Number(texts(xml, 'ent_seq')[0]),
    kanji: all(xml, 'k_ele').map((k) => ({ text: texts(k, 'keb')[0], pri: texts(k, 'ke_pri').length > 0 })),
    kana: all(xml, 'r_ele').map((r) => ({ text: texts(r, 'reb')[0], pri: texts(r, 're_pri').length > 0 })),
    senses: all(xml, 'sense').map((s) => ({ stagk: texts(s, 'stagk'), stagr: texts(s, 'stagr'), glosses: texts(s, 'gloss') })),
  };
}

// The senses of an entry that apply to `term`, as lists of glosses; null if the term is not a spelling
// of the entry. A sense restricted to other spellings (stagk / stagr) is left out.
export function sensesFor(entry, term) {
  const k = entry.kanji.find((x) => x.text === term);
  const r = entry.kana.find((x) => x.text === term);
  if (!k && !r) return null;
  const senses = entry.senses
    .filter((s) => { const only = k ? s.stagk : s.stagr; return only.length === 0 || only.includes(term); })
    .map((s) => s.glosses)
    .filter((g) => g.length);
  const spellings = [...entry.kanji, ...entry.kana].map((x) => x.text);
  return { seq: entry.seq, common: Boolean((k || r).pri), spellings, senses };
}

// Every matching entry per term: common words first, then JMdict order.
export function buildExtract(xml, terms) {
  const wanted = new Set(terms);
  const found = new Map(terms.map((t) => [t, []]));
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const spellings = [...m[1].matchAll(/<(?:keb|reb)>([^<]*)<\/(?:keb|reb)>/g)].map((x) => decode(x[1]));
    const hits = [...new Set(spellings.filter((s) => wanted.has(s)))];
    if (!hits.length) continue;
    const entry = parseEntry(m[1]);
    for (const t of hits) {
      const s = sensesFor(entry, t);
      if (s && s.senses.length) found.get(t).push(s);
    }
  }
  const entries = {};
  for (const [t, list] of found) entries[t] = list.sort((a, b) => Number(b.common) - Number(a.common));
  const created = xml.match(/<!-- JMdict created: ([0-9-]+) -->/)?.[1] ?? null;
  return { source: 'JMdict (JMdict_e)', created, entries };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/buildJmdictExtract.js path/to/JMdict_e.gz');
    process.exit(1);
  }
  const raw = fs.readFileSync(file);
  const xml = (file.endsWith('.gz') ? zlib.gunzipSync(raw) : raw).toString('utf8');
  const terms = [...new Set(readRulebookFiles().ingredients.map((e) => e.canonical))];
  const extract = {
    ...buildExtract(xml, terms),
    license: 'JMdict © Electronic Dictionary Research and Development Group (EDRDG), CC BY-SA 4.0. '
      + 'https://www.edrdg.org/edrdg/licence.html',
  };
  fs.writeFileSync(OUT, JSON.stringify(extract, null, 2) + '\n');
  const missing = terms.filter((t) => !extract.entries[t].length);
  console.log(`Wrote ${path.relative(ROOT, OUT)}: ${terms.length - missing.length}/${terms.length} terms found in JMdict ${extract.created}.`);
  if (missing.length) console.log(`Not in JMdict: ${missing.join('、')}`);
}
