// Normalisation: turns raw label text (OCR or typed) into one standard form, while
// remembering, for every output character, which raw character it came from.
//
// normalize(raw) -> { text, map }
//   text keeps word breaks as '\n': line breaks AND spaces (labels space out field names and
//   OCR inserts spaces between words), collapsed to one '\n'. They are needed to find label
//   fields and sentences; compact() removes them for matching. map[i] is the index in `raw` of text[i].
// compact(norm, from, to, skip?) -> { text, map }  the same with '\n' removed (used for matching).
// normalizeAlias(s) -> string  same rules, for rulebook spellings and marker words.

import { isKana, isKatakana, isKanji } from './chars.js';
import {
  KANJI_TO_KATAKANA, KANJI_VARIANTS, OPEN_BRACKETS, CLOSE_BRACKETS, SEPARATOR_MAP, DASHES, INVISIBLE,
} from './confusables.js';

const NEWLINES = new Set(['\n', '\r', ' ', ' ', '\u0085', '\u000B', '\u000C']);
const isVoicedMark = (c) => c === '゙' || c === '゚';

function mapChar(c) {
  if (c >= 'A' && c <= 'Z') return c.toLowerCase();
  if (KANJI_VARIANTS[c]) return KANJI_VARIANTS[c];
  if (OPEN_BRACKETS.has(c)) return '(';
  if (CLOSE_BRACKETS.has(c)) return ')';
  if (SEPARATOR_MAP[c]) return SEPARATOR_MAP[c];
  if (DASHES.has(c)) return '-';
  return c;
}

export function normalize(raw) {
  const s = raw == null ? '' : String(raw);
  const out = [];
  const map = [];

  // Pass 1: per-character NFKC, recombine voiced marks, unify brackets/separators/case, drop whitespace.
  for (let i = 0; i < s.length; i++) {
    const cp = s.codePointAt(i);
    const width = cp > 0xffff ? 2 : 1;
    const ch = String.fromCodePoint(cp);
    if (NEWLINES.has(ch)) {
      if (out.length && out[out.length - 1] !== '\n') { out.push('\n'); map.push(i); }
      i += width - 1;
      continue;
    }
    // Stand-alone voiced marks ゛゜ decompose to "space + mark" under NFKC; map them directly.
    const pre = ch === '\u309B' ? '\u3099' : ch === '\u309C' ? '\u309A' : ch;
    for (const c0 of pre.normalize('NFKC')) {
      if (INVISIBLE.has(c0)) continue;
      if (/\s/.test(c0)) { // spaces, tabs, ideographic space: a word break like a line break
        if (out.length && out[out.length - 1] !== '\n') { out.push('\n'); map.push(i); }
        continue;
      }
      if (isVoicedMark(c0)) {
        // Attach ﾞ/ﾟ (and stand-alone ゛゜) to the previous kana: ｶﾞ -> ガ
        const p = out.length - 1;
        if (p >= 0 && out[p] !== '\n') {
          const combined = (out[p] + c0).normalize('NFC');
          if (combined.length === 1) out[p] = combined;
        }
        continue;
      }
      // Astral characters (emoji, rare kanji) are kept as two UTF-16 units so that text[i]
      // and map[i] always line up.
      for (const unit of mapChar(c0).split('')) { out.push(unit); map.push(i); }
    }
    i += width - 1;
  }

  // Pass 2: OCR look-alikes.
  //  - '-' after kana is the long-vowel mark.
  //  - Kanji that look like katakana (工 力 口 二 夕 卜 八 才, and 一 for ー) are fixed only inside a
  //    "katakana run": a stretch of katakana and look-alikes (line breaks allowed inside) that
  //    contains at least one real katakana letter. A look-alike at the edge of the run that
  //    directly touches a real kanji (人工, 加工, 八角, 二酸化) stays kanji. 一 never becomes ー at
  //    the start of a run.
  const src = out.slice();
  const isLook = (c) => Boolean(KANJI_TO_KATAKANA[c]) || c === '一';
  const isRealKanji = (c) => c != null && isKanji(c) && !isLook(c);
  const idx = [];
  for (let i = 0; i < src.length; i++) if (src[i] !== '\n') idx.push(i);
  for (let v = 0; v < idx.length; v++) {
    const i = idx[v];
    if (src[i] === '-') {
      const p = v > 0 ? src[idx[v - 1]] : null;
      if (p && isKana(p)) out[i] = 'ー';
    }
  }
  let v = 0;
  while (v < idx.length) {
    const c = src[idx[v]];
    if (!(isKatakana(c) || isLook(c))) { v++; continue; }
    let a = v;
    let b = v;
    while (b + 1 < idx.length && (isKatakana(src[idx[b + 1]]) || isLook(src[idx[b + 1]]))) b++;
    // Trim look-alikes at the edges that directly touch a real kanji (no line break between).
    while (a <= b && isLook(src[idx[a]]) && isRealKanji(src[idx[a] - 1])) a++;
    while (b >= a && isLook(src[idx[b]]) && isRealKanji(src[idx[b] + 1])) b--;
    let hasKata = false;
    for (let k = a; k <= b; k++) if (isKatakana(src[idx[k]]) && src[idx[k]] !== 'ー') hasKata = true;
    if (hasKata) {
      for (let k = a; k <= b; k++) {
        const ch = src[idx[k]];
        if (ch === '一') { if (k > a) out[idx[k]] = 'ー'; }
        else if (KANJI_TO_KATAKANA[ch]) out[idx[k]] = KANJI_TO_KATAKANA[ch];
      }
    }
    v = Math.max(b, v) + 1;
  }

  // Pass 3: katakana -> hiragana by code point (ァ..ヶ). ー, ヷ-ヺ and everything else unchanged.
  for (let i = 0; i < out.length; i++) {
    const c = out[i];
    if (c >= 'ァ' && c <= 'ヶ') out[i] = String.fromCharCode(c.charCodeAt(0) - 0x60);
  }

  // Trim a trailing line break.
  while (out.length && out[out.length - 1] === '\n') { out.pop(); map.pop(); }
  return { text: out.join(''), map };
}

// Same text with line breaks removed. `from`/`to` are indices into norm.text;
// `skip(i)` may exclude further positions (e.g. shared-line sentences).
export function compact(norm, from = 0, to = norm.text.length, skip = null) {
  const t = [];
  const m = [];
  for (let i = from; i < to; i++) {
    const c = norm.text[i];
    if (c === '\n') continue;
    if (skip && skip(i)) continue;
    t.push(c);
    m.push(norm.map[i]);
  }
  return { text: t.join(''), map: m };
}

export function normalizeAlias(s) {
  return compact(normalize(s)).text;
}
