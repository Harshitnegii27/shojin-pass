// Characters OCR often confuses, and spelling variants that should match each other.

// Kanji that look like a katakana letter. Replaced only when a neighbour is katakana
// and neither neighbour is kanji (so 人工, 加工, 八角, 二酸化 stay untouched).
export const KANJI_TO_KATAKANA = {
  '工': 'エ', '力': 'カ', '口': 'ロ', '二': 'ニ', '夕': 'タ', '卜': 'ト', '八': 'ハ', '才': 'オ',
};

// Old or variant kanji that mean the same as the common form.
export const KANJI_VARIANTS = {
  '鷄': '鶏', '雞': '鶏', '麵': '麺', '麪': '麺', '醬': '醤', '鹽': '塩', '黃': '黄'
};

// Every bracket style becomes ( or ).
export const OPEN_BRACKETS = new Set([...'([{【「『〔〈《〘〚﹙⦅']);
export const CLOSE_BRACKETS = new Set([...')]}】」』〕〉》〙〛﹚⦆']);

// Separators after NFKC (、 is kept; ， and , become 、; ･ and · become ・).
export const SEPARATOR_MAP = { ',': '、', '､': '、', '·': '・', '･': '・', '‧': '・' };

// Dash-like characters. After normalisation they are '-' unless they follow kana,
// in which case they become the long-vowel mark ー.
export const DASHES = new Set(['‐', '‑', '‒', '–', '—', '―', '−', '─', '━', '﹣', '－', '-']);

// Characters removed completely (zero-width and soft hyphen).
export const INVISIBLE = new Set(['​', '‌', '‍', '⁠', '﻿', '­']);
