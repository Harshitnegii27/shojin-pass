// A saved scan row back into the shape templates.js understands, so the fixed template "why" can be
// produced later, in any language, without the label text (which is never stored).

import { templateWhy } from '../text/templates.js';

const meaningOf = (rb, id) => rb.entries.get(id)?.meaning || { en: String(id || '?') };

export function resultFromRow(row, rb) {
  const d = row.details || {};
  return {
    verdict: row.verdict,
    reasons: row.reasons || [],
    items: (row.items || []).map((i) => ({ ...i, meaning: meaningOf(rb, i.ingredientId) })),
    unknown: (row.unknown_terms || []).map((t) => ({ text: t, original: t, lowConfidence: false })),
    lowConfidence: (row.low_confidence_terms || []).map((t) => ({ text: t })),
    hidden: (d.hidden || []).map((h) => ({ ...h, meaning: meaningOf(rb, h.ingredientId) })),
    outside: (d.outside || []).map((o) => ({ ...o, meaning: meaningOf(rb, o.ingredientId) })),
    notes: d.notes || [],
  };
}

export const templateWhyForRow = (row, rb, lang) => templateWhy(resultFromRow(row, rb), lang);
