// review:import reads the sheet's CSV and adds sign-offs to reviewedBy. These tests use in-memory text
// only; none of them writes to rulebook/.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { readRulebookFiles } from '../../lib/rulebook/loader.js';
import { buildReviewCsv } from '../../scripts/genRulebookReview.js';
import { parseCsv, isYes, planImport, mergeReviewers, applyReviewers, buildReport } from '../../scripts/importRulebookReview.js';

const HEAD = 'id,reviewer1,reviewer1_ok,reviewer2,reviewer2_ok,correction_notes';
const ings = [
  { id: 'a', reviewedBy: [] }, { id: 'b', reviewedBy: ['Asha'] }, { id: 'c', reviewedBy: [] }, { id: 'd', reviewedBy: [] },
];
const sheet = (...rows) => parseCsv([HEAD, ...rows].join('\n'));

describe('review:import', () => {
  it('accepts yes, ok, TRUE, true, 1 and ✓ in any letter case, nothing else', () => {
    for (const v of ['yes', 'YES', ' ok ', 'TRUE', 'true', '1', '✓']) expect(isYes(v), v).toBe(true);
    for (const v of ['', 'no', 'FALSE', '0', 'maybe', 'y', 'x', undefined]) expect(isYes(v), String(v)).toBe(false);
  });

  it('parses quoted cells, CRLF, a BOM and its own CSV export', () => {
    expect(parseCsv('﻿a,"b, ""c""",d\r\n\r\n1,2,3\n')).toEqual([['a', 'b, "c"', 'd'], ['1', '2', '3']]);
    const data = readRulebookFiles();
    const rows = parseCsv(buildReviewCsv(data));
    expect(rows).toHaveLength(data.ingredients.length + 1);
  });

  it('records only reviewers who said yes; the rest are listed, not recorded', () => {
    const plan = planImport(sheet(
      'a,Asha,yes,Ben,TRUE,',
      'b,Ben,no,,,',
      'c,Asha,ok,Ben,ok,fix the tag',
      'd,,,,,',
    ), ings);
    expect(plan.errors).toEqual([]);
    expect(plan.approved).toEqual([{ id: 'a', names: ['Asha', 'Ben'] }]);
    expect(plan.held.map((h) => h.id)).toEqual(['b', 'c']);
    expect(plan.held[0].why[0]).toContain('"no"');
    expect(plan.held[1].why).toEqual(['correction notes: fix the tag']); // row held although both said ok
  });

  it('a named reviewer without an answer is waiting; an answer without a name is a problem', () => {
    const plan = planImport(sheet('a,Asha,,,,', 'b,,yes,,,', 'c,Asha,yes,Ben,,'), ings);
    expect(plan.waiting).toContain('a');
    expect(plan.held.find((h) => h.id === 'b').why[0]).toContain('no name');
    expect(plan.approved).toEqual([{ id: 'c', names: ['Asha'] }]);
  });

  it('refuses a CSV with unknown ids, repeated ids, missing entries or missing columns', () => {
    const errors = planImport(sheet('a,Asha,yes,,,', 'a,Ben,yes,,,', 'zzz,Asha,yes,,,'), ings).errors.join('\n');
    expect(errors).toContain('unknown id "zzz"');
    expect(errors).toContain('appears twice');
    expect(errors).toContain('entry "c" is not in the CSV');
    expect(planImport(parseCsv('id,reviewer1\na,Asha'), ings).errors[0]).toContain('no column');
  });

  it('merges names without duplicates (letter case ignored) and never removes one', () => {
    expect(mergeReviewers(['Asha'], ['asha', 'Ben'])).toEqual(['Asha', 'Ben']);
    expect(mergeReviewers(['Asha', 'Ben'], [])).toEqual(['Asha', 'Ben']);
  });

  it('applyReviewers changes only reviewedBy, byte for byte elsewhere', () => {
    const text = '[\r\n  {"id": "a", "canonical": "豚", "aliases": ["豚"], "tags": ["meat"], "reviewedBy": [], "addedIn": "1"},\r\n'
      + '  {"id": "b", "canonical": "牛", "aliases": ["牛"], "tags": ["meat"], "reviewedBy": ["Asha"], "addedIn": "1"}\r\n]\r\n';
    const out = applyReviewers(text, { a: ['Asha', 'Ben'], b: ['Asha', 'Ben'] });
    expect(out).toBe(text.replace('"reviewedBy": []', '"reviewedBy": ["Asha","Ben"]').replace('["Asha"]', '["Asha","Ben"]'));
    expect(() => applyReviewers(text, { zzz: ['x'] })).toThrow(/could not find/);
  });

  it('a hostile name cannot change anything but reviewedBy', () => {
    const text = '[\n  {"id": "a", "tags": ["meat"], "reviewedBy": [], "addedIn": "1"}\n]\n';
    const out = applyReviewers(text, { a: ['x"], "tags": ["plain_safe'] });
    expect(JSON.parse(out)[0].tags).toEqual(['meat']);
    expect(JSON.parse(out)[0].reviewedBy).toEqual(['x"], "tags": ["plain_safe']);
  });

  it('works on the real rulebook text without writing it, and the report says what it would do', () => {
    const file = new URL('../../rulebook/ingredients.json', import.meta.url);
    const onDisk = fs.readFileSync(file, 'utf8');
    const text = onDisk.replace(/"reviewedBy": \[[^\]]*\]/g, '"reviewedBy": []'); // whatever the review state, start from a draft
    const real = JSON.parse(text);
    const rows = real.slice(0, 3).map((e, i) => `${e.id},Asha,yes,${i === 0 ? 'Ben,yes' : ','},`);
    const plan = planImport(parseCsv([HEAD, ...real.map((e) => (rows.find((r) => r.startsWith(e.id + ',')) ?? `${e.id},,,,,`))].join('\n')), real);
    expect(plan.errors).toEqual([]);
    const updates = Object.fromEntries(plan.approved.map((a) => [a.id, mergeReviewers(real.find((e) => e.id === a.id).reviewedBy, a.names)]));
    const out = applyReviewers(text, updates);
    expect(JSON.parse(out).filter((e) => e.reviewedBy.length).map((e) => e.id)).toEqual(real.slice(0, 3).map((e) => e.id));
    expect(out.split('\n').length).toBe(text.split('\n').length);
    const report = buildReport(plan, real, updates, false);
    expect(report).toContain('DRY RUN');
    expect(report).toContain(`${real[0].id}: + Asha, Ben`);
    expect(report).toContain('Entries with two reviewers after this: 1/');
    expect(fs.readFileSync(file, 'utf8')).toBe(onDisk);
  });
});
