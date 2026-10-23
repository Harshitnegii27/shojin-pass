// scripts/genRulebookReview.js: the review checklist lists every rulebook entry once, with the
// diets each one blocks, and reading the rulebook never changes it.

import { describe, it, expect } from 'vitest';
import { readRulebookFiles } from '../../lib/rulebook/loader.js';
import { buildReviewDoc, buildReviewCsv, colourFor, CSV_REVIEW_COLUMNS } from '../../scripts/genRulebookReview.js';

// Minimal RFC 4180 reader (quoted cells, doubled quotes, CRLF), as a spreadsheet would read it.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += ch;
  }
  return rows;
}

const data = readRulebookFiles();
const before = JSON.stringify(data);
const doc = buildReviewDoc(data);

describe('rulebook review checklist', () => {
  it('one tick box per entry, every id exactly once', () => {
    expect(doc.match(/^- \[ \] /gm)).toHaveLength(data.ingredients.length);
    for (const e of data.ingredients) expect(doc.split(`\`${e.id}\`: `).length - 1).toBe(1);
  });

  it('shows the diets an entry blocks', () => {
    const pork = doc.slice(doc.indexOf('`pork`: '), doc.indexOf('`beef`: '));
    expect(pork).toContain('Red (avoid) for: all diets');
    expect(pork).toContain('Status: draft, 0/2 reviewers');
  });

  it('colourFor: forbidden beats asked; neither is green', () => {
    const rule = { forbid: ['meat'], ask: ['source_unclear'] };
    expect(colourFor(['source_unclear', 'meat'], rule)).toBe('red');
    expect(colourFor(['source_unclear'], rule)).toBe('amber');
    expect(colourFor(['plain_safe'], rule)).toBe('green');
  });

  it('CSV: header, one row per entry, a verdict per diet, empty reviewer columns', () => {
    const csv = buildReviewCsv(data);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
    expect(csv.endsWith('\r\n')).toBe(true);
    const [header, ...rows] = parseCsv(csv);
    const diets = Object.keys(data.diets);
    expect(header).toEqual(['id', 'japanese_term', 'aliases', 'meaning', 'tags', ...diets, ...CSV_REVIEW_COLUMNS]);
    expect(rows).toHaveLength(data.ingredients.length);
    expect(rows.map((r) => r[0])).toEqual(data.ingredients.map((e) => e.id));
    for (const r of rows) {
      expect(r).toHaveLength(header.length);
      for (const d of diets) expect(['red', 'amber', 'green']).toContain(r[header.indexOf(d)]);
      expect(r.slice(-CSV_REVIEW_COLUMNS.length).every((c) => c === '')).toBe(true);
    }
    const pork = rows.find((r) => r[0] === 'pork');
    expect(pork[1]).toBe('豚肉');
    expect(pork[2].split('、')).toEqual(data.ingredients.find((e) => e.id === 'pork').aliases);
    expect(diets.every((d) => pork[header.indexOf(d)] === 'red')).toBe(true);
    // Meanings with commas survive quoting.
    const withComma = data.ingredients.find((e) => e.meaning.en.includes(','));
    expect(rows.find((r) => r[0] === withComma.id)[3]).toBe(withComma.meaning.en);
  });

  it('CSV: a cell starting with = + - @ is kept as text, not run as a formula', () => {
    const fake = { ...data, ingredients: [{ id: 'x', canonical: '=HYPERLINK("http://evil")', aliases: ['+1'], meaning: { en: '-a, "b"' }, tags: ['meat'] }] };
    const [, row] = parseCsv(buildReviewCsv(fake));
    expect(row.slice(0, 4)).toEqual(['x', '\'=HYPERLINK("http://evil")', "'+1", '\'-a, "b"']);
  });

  it('does not change the rulebook data', () => {
    expect(JSON.stringify(data)).toBe(before);
  });
});
