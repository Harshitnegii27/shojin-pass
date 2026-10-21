// Turns a compact (no line breaks) normalised list into recognised spellings and unknown text.
//
// Rules:
//  - At each position take the longest spelling that fits.
//  - Short kana-only spellings (いか, たこ, らっく …) only count at a word boundary; otherwise
//    the characters fall into the surrounding unknown term (the hidden-term check flags them).
//  - Separators, brackets and punctuation split unknown text and are otherwise skipped.
//  - Unknown text that is only amounts/units/percentages is dropped as noise.

import { matchesAt } from './trie.js';
import { isKana, isIgnorable, isNoiseSpan, isBoundarySensitive } from './chars.js';

export function matchText(S, rb, opts = {}) {
  const matches = [];
  const unknown = [];
  let uStart = -1;
  let lastMatchEnd = -1;

  const closeUnknown = (end) => {
    if (uStart >= 0) {
      const txt = S.slice(uStart, end);
      if (!isNoiseSpan(txt)) unknown.push({ start: uStart, end, text: txt });
      uStart = -1;
    }
  };

  let i = 0;
  while (i < S.length) {
    const c = S[i];
    if (isIgnorable(c)) { closeUnknown(i); i++; continue; }
    let chosen = null;
    for (const cand of matchesAt(rb.trie, S, i)) {
      if (isBoundarySensitive(cand.alias)) {
        const end = i + cand.length;
        const leftOk = i === 0 || !isKana(S[i - 1]) || lastMatchEnd === i;
        const rightOk = end === S.length || !isKana(S[end]) || matchesAt(rb.trie, S, end).length > 0;
        if (!(leftOk && rightOk)) continue;
      }
      chosen = cand;
      break;
    }
    if (chosen) {
      closeUnknown(i);
      matches.push({ start: i, end: i + chosen.length, id: chosen.id, alias: chosen.alias });
      i += chosen.length;
      lastMatchEnd = i;
    } else {
      if (uStart < 0) uStart = i;
      i++;
    }
  }
  closeUnknown(S.length);
  if (opts.lookAlikeRetry === false || !unknown.some((u) => LOOK_RE.test(u.text))) return { matches, unknown };
  return retryLookAlikes(S, rb, { matches, unknown });
}

// Second chance for look-alike kanji that normalisation had to leave alone because they touch a
// real kanji (生八ム, or 夕ーキー right after the heading 原材料名 once spaces are removed).
// For each separator-delimited segment that still has unknown text containing 工 力 口 二 夕 卜 八
// 才 or 一, re-match the segment with those characters read as kana. The new reading is used only
// if it leaves fewer unknown characters AND every original recognised word is still there or is
// inside a longer word that is not plain_safe (so a reading can never hide a flagged word).
const LOOK = { '工': 'え', '力': 'か', '口': 'ろ', '二': 'に', '夕': 'た', '卜': 'と', '八': 'は', '才': 'お', '一': 'ー' };
const LOOK_RE = /[工力口二夕卜八才一]/;

function retryLookAlikes(S, rb, first) {
  const segs = [];
  let a = 0;
  for (let i = 0; i <= S.length; i++) {
    if (i === S.length || isIgnorable(S[i])) { if (i > a) segs.push([a, i]); a = i + 1; }
  }
  let matches = first.matches;
  let unknown = first.unknown;
  for (const [s, e] of segs) {
    const segUnknown = unknown.filter((u) => u.start >= s && u.end <= e);
    if (!segUnknown.some((u) => LOOK_RE.test(u.text))) continue;
    const seg = S.slice(s, e);
    const variant = [...seg].map((c) => LOOK[c] || c).join('');
    const alt = matchText(variant, rb, { lookAlikeRetry: false });
    const before = segUnknown.reduce((n, u) => n + u.end - u.start, 0);
    const after = alt.unknown.reduce((n, u) => n + u.end - u.start, 0);
    if (after >= before) continue;
    const segMatches = matches.filter((m) => m.start >= s && m.end <= e);
    const altAbs = alt.matches.map((m) => ({ ...m, start: m.start + s, end: m.end + s, lookAlike: true }));
    const safe = segMatches.every((m) => altAbs.some((v) => v.start <= m.start && m.end <= v.end
      && (v.id === m.id || !isPlainOrAnnotation(rb, v.id) || isPlainOrAnnotation(rb, m.id))));
    if (!safe) continue;
    matches = [...matches.filter((m) => !(m.start >= s && m.end <= e)), ...altAbs];
    unknown = [...unknown.filter((u) => !(u.start >= s && u.end <= e)),
      ...alt.unknown.map((u) => ({ start: u.start + s, end: u.end + s, text: S.slice(u.start + s, u.end + s) }))];
  }
  matches.sort((x, y) => x.start - y.start);
  unknown.sort((x, y) => x.start - y.start);
  return { matches, unknown };
}

function isPlainOrAnnotation(rb, id) {
  const e = rb.entries.get(id);
  return !e || e.kind === 'annotation' || (e.tags.length === 1 && e.tags[0] === 'plain_safe');
}

// Index of the ')' closing the '(' at `open`, or -1.
export function closingParen(S, open) {
  let depth = 0;
  for (let i = open; i < S.length; i++) {
    if (S[i] === '(') depth++;
    else if (S[i] === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

export function bracketsBalanced(S) {
  let depth = 0;
  for (const c of S) {
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth < 0) return false; }
  }
  return depth === 0;
}

// Every place a spelling occurs, including inside other words (all lengths), for the hidden-term check.
export function allOccurrences(S, rb, wantId) {
  const out = [];
  for (let i = 0; i < S.length; i++) {
    for (const cand of matchesAt(rb.trie, S, i)) {
      if (wantId(cand.id)) out.push({ start: i, end: i + cand.length, id: cand.id, alias: cand.alias });
    }
  }
  return out;
}
