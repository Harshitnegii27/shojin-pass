// The pure core of a scan: label text (+ optional per-character OCR confidence) and a resolved
// profile in, verdict out. Used by scanService for photo and text scans, and by every test.

import { normalize, compact } from '../rulebook/normalize.js';
import { locateSections } from '../rulebook/sections.js';
import { matchText, closingParen, bracketsBalanced, allOccurrences } from '../rulebook/matcher.js';
import { decideVerdict } from '../rulebook/verdict.js';

export const MAX_TEXT = 20000;
const STATEMENT_KINDS = new Set(['statement', 'more']);

// input: { raw, confidence?: number[] (one value per UTF-16 unit of raw), minCharConfidence?: number }
export function analyzeLabel(input, profile, rb) {
  let raw = input.raw == null ? '' : String(input.raw);
  let confidence = input.confidence || null;
  const min = input.minCharConfidence ?? 0.7;
  let truncated = false;
  if (raw.length > MAX_TEXT) {
    raw = raw.slice(0, MAX_TEXT);
    if (confidence) confidence = confidence.slice(0, MAX_TEXT);
    truncated = true;
  }
  const confAt = (rawIdx) => (confidence ? (Number.isFinite(confidence[rawIdx]) ? confidence[rawIdx] : 0) : 1);
  const original = (map, s, e) => (e > s ? raw.slice(map[s], map[e - 1] + 1) : '');

  const norm = normalize(raw);
  const loc = locateSections(norm, rb.markers);
  const relevantId = (id) => {
    const e = rb.entries.get(id);
    return e && e.kind === 'ingredient' && e.tags.some((t) => profile.relevant.has(t));
  };

  const items = [];
  const unknown = [];
  const hidden = [];
  const lowConfidenceOther = [];
  let completeness = 'complete';
  let structureUnclear = false;
  let realCount = 0;

  for (const sec of loc.sections) {
    const S = sec.compact.text;
    const map = sec.compact.map;
    const { matches, unknown: unk } = matchText(S, rb);
    const tokens = matches.map((m) => ({ ...m, entry: rb.entries.get(m.id) }));

    // Origin rule: "X(Y由来)" — an unclear X takes the tags of the stated source Y.
    // Composite rule: a composite X followed by a bracket that lists its components (and no
    // "contains"/"and others" statement) is replaced by those components.
    for (const t of tokens) {
      if (t.entry.kind !== 'ingredient') continue;
      t.effectiveTags = t.entry.tags;
      if (S[t.end] !== '(') continue;
      const close = closingParen(S, t.end);
      if (close < 0) continue;
      const inner = tokens.filter((x) => x.start > t.end && x.end <= close);
      const innerUnknown = unk.filter((u) => u.start > t.end && u.end <= close);
      const innerIng = inner.filter((x) => x.entry.kind === 'ingredient');
      const innerAnnot = inner.filter((x) => x.entry.kind === 'annotation');
      const hasOrigin = innerAnnot.some((x) => x.alias === '由来');
      if (t.entry.tags.includes('source_unclear') && hasOrigin && innerIng.length && !innerUnknown.length) {
        const tags = new Set(innerIng.flatMap((x) => x.entry.tags));
        if (tags.size > 1) tags.delete('plain_safe');
        t.effectiveTags = [...tags];
        t.resolvedBy = S.slice(t.end + 1, close);
        continue;
      }
      if (t.entry.composite && innerIng.length && !innerAnnot.some((x) => STATEMENT_KINDS.has(x.entry.annot))) {
        t.structural = true;
      }
    }

    // Per-character confidence (photo scans only).
    const low = new Uint8Array(S.length);
    if (confidence) for (let k = 0; k < S.length; k++) if (confAt(map[k]) < min) low[k] = 1;
    const spanLow = (s, e) => { for (let k = s; k < e; k++) if (low[k]) return true; return false; };
    const spanConf = (s, e) => { let c = 1; for (let k = s; k < e; k++) c = Math.min(c, confAt(map[k])); return c; };
    const covered = new Uint8Array(S.length);

    for (const t of tokens) {
      for (let k = t.start; k < t.end; k++) covered[k] = 1;
      if (t.entry.kind !== 'ingredient' || t.structural) continue;
      realCount++;
      items.push({
        text: S.slice(t.start, t.end),
        original: original(map, t.start, t.end),
        ingredientId: t.id,
        meaning: t.entry.meaning,
        tags: t.effectiveTags,
        baseTags: t.entry.tags,
        resolvedBy: t.resolvedBy || null,
        confidence: confidence ? spanConf(t.start, t.end) : 1,
        lowConfidence: spanLow(t.start, t.end),
        fromAllergenField: sec.kind === 'allergen',
      });
    }
    for (const u of unk) {
      for (let k = u.start; k < u.end; k++) covered[k] = 1;
      realCount++;
      unknown.push({
        text: u.text,
        original: original(map, u.start, u.end),
        confidence: confidence ? spanConf(u.start, u.end) : 1,
        lowConfidence: spanLow(u.start, u.end),
      });
    }
    // Low-confidence characters that were skipped as punctuation or noise could hide a letter.
    for (let k = 0; k < S.length; k++) {
      if (low[k] && !covered[k]) lowConfidenceOther.push({ text: S[k], original: original(map, k, k + 1), confidence: confAt(map[k]) });
    }

    // Hidden-term check: any relevant spelling that is not fully inside one recognised spelling.
    const seen = new Set();
    for (const o of allOccurrences(S, rb, relevantId)) {
      const explained = tokens.some((t) => t.start <= o.start && o.end <= t.end);
      const key = o.start + ':' + o.alias;
      if (!explained && !seen.has(key)) {
        seen.add(key);
        hidden.push({ text: o.alias, original: original(map, o.start, o.end), ingredientId: o.id, meaning: rb.entries.get(o.id).meaning });
      }
    }

    if (!bracketsBalanced(S)) structureUnclear = true;
    let secComplete = sec.completeness === 'complete';
    // A misread end-of-list field name means we cannot trust where the list stopped.
    if (secComplete && confidence && sec.endMarker) {
      for (let i = sec.endMarker.start; i < sec.endMarker.end; i++) {
        if (norm.text[i] !== '\n' && confAt(norm.map[i]) < min) { secComplete = false; break; }
      }
    }
    if (!secComplete) completeness = 'incomplete';
  }

  // Outside sweep: a relevant word elsewhere on the label (not addresses, not shared-line notices).
  const outside = [];
  {
    const O = loc.outside.text;
    const { matches } = matchText(O, rb);
    for (const m of matches) {
      // Only words the diet FORBIDS count here; "ask" words such as たんぱく質 appear in every
      // nutrition table and would make every label amber.
      const e = rb.entries.get(m.id);
      if (m.alias.length < 2 || e.kind !== 'ingredient' || !e.tags.some((t) => profile.forbid.has(t))) continue;
      outside.push({ text: m.alias, original: original(loc.outside.map, m.start, m.end), ingredientId: m.id, meaning: rb.entries.get(m.id).meaning });
    }
  }

  // Shared production line notices: shown as notes; amber only with the avoid_shared_line option.
  const notes = loc.sharedLines.map((s) => {
    const c = compact(norm, s.start, s.end);
    const mentions = matchText(c.text, rb).matches
      .filter((m) => relevantId(m.id))
      .map((m) => rb.entries.get(m.id).meaning.en);
    return { code: 'SHARED_LINE', original: original(c.map, 0, c.text.length), mentions: [...new Set(mentions)] };
  });

  const noList = loc.sections.length === 0;
  const decision = decideVerdict({
    items, unknown, hidden, outside, lowConfidenceOther, completeness: noList ? 'incomplete' : completeness,
    noList, headless: loc.headless, structureUnclear, sharedLine: notes.length > 0, realCount, truncated, profile,
  });

  return {
    verdict: decision.verdict,
    reasons: decision.reasons,
    items: decision.items,
    unknown,
    hidden,
    outside,
    lowConfidence: [
      ...decision.items.filter((i) => i.lowConfidence).map((i) => ({ text: i.original, confidence: i.confidence })),
      ...unknown.filter((u) => u.lowConfidence).map((u) => ({ text: u.original, confidence: u.confidence })),
      ...lowConfidenceOther.map((l) => ({ text: l.original, confidence: l.confidence })),
    ],
    completeness: noList ? 'incomplete' : completeness,
    notes,
    sections: loc.sections.map((s) => ({ kind: s.kind, completeness: s.completeness, fuzzyStart: Boolean(s.fuzzyStart), headless: Boolean(s.headless) })),
    truncated,
    profile: { preset: profile.preset, options: profile.options },
    rulebookVersion: rb.version,
  };
}
