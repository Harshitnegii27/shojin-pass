// scripts/genRulebookReview.js: the review checklist lists every rulebook entry once, with the
// diets each one blocks, and reading the rulebook never changes it.

import { describe, it, expect } from 'vitest';
import { readRulebookFiles } from '../../lib/rulebook/loader.js';
import {
  buildReviewDoc, buildReviewCsv, colourFor, CSV_REVIEW_COLUMNS, jmdictMeaning, loadJmdictExtract, JMDICT_NOT_FOUND,
} from '../../scripts/genRulebookReview.js';
import { buildExtract } from '../../scripts/buildJmdictExtract.js';

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
    expect(header).toEqual(['id', 'japanese_term', 'aliases', 'meaning', 'jmdict_meaning', 'tags', ...diets, ...CSV_REVIEW_COLUMNS]);
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

  it('CSV: jmdict_meaning from the bundled JMdict extract', () => {
    const [header, ...rows] = parseCsv(buildReviewCsv(data));
    const col = header.indexOf('jmdict_meaning');
    const cell = (id) => rows.find((r) => r[0] === id)[col];
    expect(cell('pork')).toBe('pork');
    expect(cell('salmon')).toContain('salmon'); // さけ: the fish, not 酒
    expect(cell('salmon')).not.toContain('sake');
    expect(cell('herbs_spices')).toBe('pepper'); // こしょう: 胡椒, not 故障 or 湖沼
    expect(cell('animal_fat_generic')).toBe(JMDICT_NOT_FOUND);
    expect(rows.every((r) => r[col] !== '')).toBe(true);
  });

  it('the JMdict extract covers every term and credits EDRDG', () => {
    const extract = loadJmdictExtract();
    for (const e of data.ingredients) expect(extract.entries).toHaveProperty([e.canonical]);
    expect(extract.license).toMatch(/EDRDG.*CC BY-SA 4\.0/);
  });

  it('jmdictMeaning: alias spellings, then common words, then all; senses numbered and capped', () => {
    const j = (seq, common, spellings, senses) => ({ seq, common, spellings, senses });
    const extract = { entries: {
      かな: [j(1, true, ['仮名', 'かな'], [['kana']]), j(2, false, ['哉', 'かな'], [['I wonder']])],
      たね: [j(3, false, ['種', 'たね'], [['seed'], ['cause'], ['trick'], ['breed']]), j(4, false, ['胤', 'たね'], [['offspring']])],
      ない: [],
    } };
    expect(jmdictMeaning({ canonical: 'かな', aliases: ['かな', '哉'] }, extract)).toBe('I wonder');
    expect(jmdictMeaning({ canonical: 'かな', aliases: ['かな'] }, extract)).toBe('kana');
    expect(jmdictMeaning({ canonical: 'たね', aliases: ['たね'] }, extract)).toBe('1. seed 2. cause 3. trick … | offspring');
    expect(jmdictMeaning({ canonical: 'ない', aliases: [] }, extract)).toBe(JMDICT_NOT_FOUND);
    expect(jmdictMeaning({ canonical: '無い', aliases: [] }, extract)).toBe(JMDICT_NOT_FOUND);
  });

  it('buildExtract: exact spelling matches only, sense restrictions respected, XML entities decoded', () => {
    const xml = `<!-- JMdict created: 2026-01-02 -->
<entry><ent_seq>10</ent_seq><k_ele><keb>生</keb><ke_pri>ichi1</ke_pri></k_ele><r_ele><reb>なま</reb></r_ele><r_ele><reb>き</reb></r_ele>
<sense><stagr>なま</stagr><pos>&n;</pos><gloss>raw</gloss></sense><sense><stagr>き</stagr><gloss>pure</gloss></sense><sense><gloss>R&amp;D</gloss></sense></entry>
<entry><ent_seq>11</ent_seq><k_ele><keb>生地</keb></k_ele><r_ele><reb>きじ</reb></r_ele><sense><gloss g_type="lit">dough</gloss></sense></entry>`;
    const ex = buildExtract(xml, ['なま', '生', 'きじ', '生き']);
    expect(ex.created).toBe('2026-01-02');
    expect(ex.entries['なま']).toEqual([{ seq: 10, common: false, spellings: ['生', 'なま', 'き'], senses: [['raw'], ['R&D']] }]);
    expect(ex.entries['生'][0]).toMatchObject({ common: true, senses: [['raw'], ['pure'], ['R&D']] });
    expect(ex.entries['きじ'][0].senses).toEqual([['dough']]);
    expect(ex.entries['生き']).toEqual([]);
  });

  it('does not change the rulebook data', () => {
    expect(JSON.stringify(data)).toBe(before);
  });
});
