// Character classes used by normalisation, section finding and matching.
// All checks work on single UTF-16 code units of already-normalised text.

export const isHiragana = (c) => c >= 'ぁ' && c <= 'ゟ';
export const isKatakana = (c) => (c >= 'ァ' && c <= 'ヺ') || c === 'ー' || (c >= 'ㇰ' && c <= 'ㇿ');
export const isKana = (c) => isHiragana(c) || isKatakana(c) || c === 'ー';
export const isKanji = (c) =>
  (c >= '一' && c <= '鿿') || (c >= '㐀' && c <= '䶿') || (c >= '豈' && c <= '﫿') || c === '々' || c === '〆';
export const isLatinOrDigit = (c) => /[a-z0-9]/.test(c);

// Characters that separate or decorate list items. They are skipped by the matcher
// (never part of an "unknown" term) unless they sit inside an alias.
export const IGNORABLE = new Set([...
  '、,/・:;()。.※★☆●○■□◆◇▲△▼▽"\'`!?…‥*#&+=|\\~〜「」『』<>[]{}%', '\n',
]);
export const isIgnorable = (c) => IGNORABLE.has(c);

// An "unknown" span made only of these is noise (amounts, percentages, units), not an ingredient.
// Applied to the span text after the matcher has failed to recognise it.
const UNIT = '(g|mg|kg|μg|ml|l|kcal|cal|%|個|本|枚|袋|粒|包|cm|mm|号)';
const NOISE_RE = new RegExp('^[-0-9.,~+%x×]*' + UNIT + '?$');
export const isNoiseSpan = (s) => s.length > 0 && NOISE_RE.test(s);

// Aliases written only in kana and at most 3 long (いか, たこ, らっく, ます...) appear inside many
// unrelated words, so they only count when they stand at a word boundary.
export const isBoundarySensitive = (alias) => alias.length <= 3 && [...alias].every((c) => isHiragana(c) || c === 'ー');
