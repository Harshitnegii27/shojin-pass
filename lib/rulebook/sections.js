// Finds where the ingredient list (and any allergen field) is on the label, whether each list is
// complete, which sentences are "shared production line" notices, and which text lies outside.
// Works on normalize() output, which keeps '\n' so field names and sentences can be found.

import { compact } from './normalize.js';
import { isKanji } from './chars.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Occurrences of `word`, allowing a line break between any two characters.
function occurrences(text, word) {
  const re = new RegExp([...word].map(escapeRe).join('\\n?'), 'g');
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    out.push({ start: m.index, end: m.index + m[0].length, word });
    re.lastIndex = m.index + 1;
  }
  return out;
}

const prevChar = (text, i) => { for (let j = i - 1; j >= 0; j--) if (text[j] !== '\n') return text[j]; return null; };
const nextIndex = (text, i) => { for (let j = i; j < text.length; j++) if (text[j] !== '\n') return j; return -1; };
const textFrom = (text, i, n) => {
  let s = '';
  for (let j = i; j < text.length && s.length < n; j++) if (text[j] !== '\n') s += text[j];
  return s;
};

function findSharedLines(text, markers) {
  const spans = [];
  for (const w of markers.sharedLine) {
    for (const occ of occurrences(text, w)) {
      const pos = occ.start;
      // Sentence boundary: last 。 or line break before the marker.
      let b = 0;
      for (let j = pos - 1; j >= 0; j--) if (text[j] === '。' || text[j] === '\n') { b = j + 1; break; }
      // Closest opener (本品, ※, …) within 40 characters before the marker, not crossing a 。
      let start = -1;
      for (const op of markers.sharedLineOpeners) {
        for (const o of occurrences(text.slice(Math.max(0, pos - 40), pos), op)) {
          const at = Math.max(0, pos - 40) + o.start;
          if (!text.slice(at, pos).includes('。') && at > start) start = at;
        }
      }
      if (start < 0) {
        // No opener: start at the sentence boundary only if that part looks like one clause
        // (no list separators); otherwise start at the marker so real ingredients stay in the list.
        const head = text.slice(b, pos);
        start = /[、/]/.test(head) ? pos : b;
      }
      let end = text.length;
      for (let j = occ.end; j < text.length && j < occ.end + 80; j++) {
        if (text[j] === '。') { end = j + 1; break; }
        if (text[j] === '\n') { end = j; break; }
        end = j + 1;
      }
      spans.push({ start, end });
    }
  }
  spans.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else merged.push({ ...s });
  }
  return merged;
}

function fuzzyStart(text, target) {
  // A 4-character window equal to 原材料名 except one of its first three characters (OCR misread
  // such as 原材科名). The mismatched character must be kanji.
  const found = [];
  const chars = [];
  for (let i = 0; i < text.length; i++) if (text[i] !== '\n') chars.push(i);
  for (let k = 0; k + target.length <= chars.length; k++) {
    let miss = -1;
    let bad = false;
    for (let t = 0; t < target.length; t++) {
      if (text[chars[k + t]] !== target[t]) {
        if (miss >= 0 || t === target.length - 1) { bad = true; break; }
        miss = t;
      }
    }
    if (!bad && miss >= 0 && isKanji(text[chars[k + miss]])) {
      found.push({ start: chars[k], end: chars[k + target.length - 1] + 1, word: target, type: 'start', fuzzy: true });
    }
  }
  return found;
}

export function locateSections(norm, markers) {
  const text = norm.text;
  const excluded = new Uint8Array(text.length);
  const sharedLines = findSharedLines(text, markers);
  for (const s of sharedLines) for (let i = s.start; i < s.end; i++) excluded[i] = 1;

  // Collect candidate field markers.
  const cands = [];
  for (const [type, list] of [['start', markers.start], ['allergenStart', markers.allergenStart], ['end', markers.end]]) {
    for (const w of list) for (const o of occurrences(text, w)) cands.push({ ...o, type });
  }
  const valid = (c) => {
    if (excluded[c.start]) return false;
    const p = prevChar(text, c.start);
    if (c.type === 'start') {
      if (p === '、' || p === '/') return false;
      // 原材料の一部に… / 原材料に… are sentences, not the heading. Only the bare word 原材料 is
      // checked, and only against what directly follows it (a space or line break ends the word).
      const isPrefixOfLonger = markers.start.some((o) => o !== c.word && o.startsWith(c.word));
      const after = text.slice(c.end, c.end + 4);
      if (isPrefixOfLonger && markers.startExcludeNext.some((x) => after.startsWith(x))) return false;
      return true;
    }
    if (c.type === 'allergenStart') return !(p === '、' || p === '/');
    // end markers: a field name at the start of a line always counts. Elsewhere it must not
    // sit inside a list item, unless written as a heading like (内容量).
    if (c.start === 0 || text[c.start - 1] === '\n') return true;
    if (p && markers.fieldInvalidPrev.has(p)) {
      const n = nextIndex(text, c.end);
      return p === '(' && n >= 0 && text[n] === ')';
    }
    return true;
  };
  let kept = cands.filter(valid);
  // Keep the longest marker at each place; drop markers overlapping an earlier one.
  kept.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const nonOverlap = [];
  for (const c of kept) {
    const last = nonOverlap[nonOverlap.length - 1];
    if (last && c.start < last.end) continue;
    nonOverlap.push(c);
  }
  kept = nonOverlap;
  let fuzzyUsed = false;
  if (!kept.some((c) => c.type === 'start')) {
    const fz = fuzzyStart(text, markers.startFuzzyTarget).filter((c) => !excluded[c.start]);
    if (fz.length) {
      fuzzyUsed = true;
      kept = [...kept, ...fz].sort((a, b) => a.start - b.start);
    }
  }

  // Address field values are not searched by the outside sweep (company names, places).
  const addressRanges = [];
  kept.forEach((c, k) => {
    if (c.type === 'end' && markers.address.has(c.word)) {
      const next = kept[k + 1] ? kept[k + 1].start : text.length;
      addressRanges.push({ start: c.end, end: Math.min(next, c.end + 120) });
    }
  });

  const sections = [];
  kept.forEach((c, k) => {
    if (c.type !== 'start' && c.type !== 'allergenStart') return;
    let s = c.end;
    while (s < text.length && (text[s] === ':' || text[s] === ')' || text[s] === '\n' || text[s] === '-')) s++;
    const next = kept[k + 1] || null;
    let e = next ? next.start : text.length;
    // Heading-style next field "(内容量)": its opening bracket is not part of this list.
    if (next) {
      let j = e - 1;
      while (j >= s && text[j] === '\n') j--;
      if (j >= s && text[j] === '(') e = j;
    }
    sections.push({
      kind: c.type === 'start' ? 'ingredients' : 'allergen',
      start: s, end: e, marker: c,
      endMarker: next, fuzzyStart: Boolean(c.fuzzy),
    });
  });

  let headless = false;
  if (sections.length === 0) {
    const commas = (text.match(/、/g) || []).length;
    if (commas >= 2) {
      headless = true;
      sections.push({ kind: 'ingredients', start: 0, end: text.length, marker: null, endMarker: null, headless: true });
    }
  }

  const inAddress = new Uint8Array(text.length);
  for (const r of addressRanges) for (let i = r.start; i < r.end; i++) inAddress[i] = 1;
  const inMarker = new Uint8Array(text.length);
  for (const c of kept) for (let i = c.start; i < c.end; i++) inMarker[i] = 1;

  for (const sec of sections) {
    const skip = (i) => excluded[i] === 1 || inMarker[i] === 1 || (sec.headless && inAddress[i] === 1);
    sec.compact = compact(norm, sec.start, sec.end, skip);
    sec.completeness = completenessOf(sec, markers);
  }

  // Outside text: not in any section, marker, shared-line sentence or address value.
  const inSection = new Uint8Array(text.length);
  for (const sec of sections) for (let i = sec.start; i < sec.end; i++) inSection[i] = 1;
  const outsideSkip = (i) => inSection[i] || inMarker[i] || excluded[i] || inAddress[i];
  const outside = compact(norm, 0, text.length, outsideSkip);

  return {
    sections, sharedLines, outside, fuzzyStart: fuzzyUsed, headless, markers: kept,
  };
}

function completenessOf(sec, markers) {
  const t = sec.compact.text.replace(/[)。.]+$/, '');
  const endsCut = /[、・/(]$/.test(t);
  if (sec.headless) return 'incomplete';
  if (sec.kind === 'allergen') return endsCut ? 'incomplete' : 'complete';
  if (endsCut) return 'incomplete';
  if (sec.endMarker) return 'complete';
  if (markers.allergenTail.some((w) => t.endsWith(w))) return 'complete';
  return 'incomplete';
}
