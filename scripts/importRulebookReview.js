#!/usr/bin/env node
// Reads the reviewers' checklist back from Google Sheets (File > Download > CSV, the layout of
// docs/rulebook-review.csv) and records the sign-offs in `reviewedBy` in rulebook/ingredients.json.
//   npm run review:import -- path/to/export.csv            dry run: prints the report, changes nothing
//   npm run review:import -- path/to/export.csv --write    applies it
// A reviewer is added to an entry only when their name cell is filled and their *_ok cell says
// yes / ok / TRUE / 1 / ✓. A row with anything in correction_notes, or with a reviewer who did not say
// yes, adds nobody: it is listed in the report. Names are only ever added, never removed. Tags,
// spellings and meanings are never touched; fix those in the rulebook yourself, then regenerate the CSV.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviewerCount } from '../lib/rulebook/loader.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INGREDIENTS = path.join(ROOT, 'rulebook', 'ingredients.json');
const REQUIRED = ['id', 'reviewer1', 'reviewer1_ok', 'reviewer2', 'reviewer2_ok', 'correction_notes'];
const YES = new Set(['yes', 'ok', 'true', '1', '✓']);

export const isYes = (v) => YES.has(String(v ?? '').trim().toLowerCase());

// RFC 4180: quoted cells, doubled quotes, CRLF or LF. Drops a leading BOM and blank lines.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

// What the sheet says, against the rulebook entries. Pure: returns
// { errors, approved: [{ id, names }], held: [{ id, why }], waiting: [id], rows }.
export function planImport(csvRows, ingredients) {
  const errors = [];
  const [header = [], ...body] = csvRows;
  const col = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const missing = REQUIRED.filter((c) => !(c in col));
  if (missing.length) {
    return { errors: [`The CSV has no column ${missing.join(', ')}. Use an export of docs/rulebook-review.csv.`], approved: [], held: [], waiting: [], rows: 0 };
  }
  const known = new Set(ingredients.map((e) => e.id));
  const seen = new Set();
  const approved = [];
  const held = [];
  const waiting = [];

  body.forEach((r, i) => {
    const get = (c) => String(r[col[c]] ?? '').trim();
    const id = get('id');
    const line = i + 2;
    if (!known.has(id)) { errors.push(`line ${line}: unknown id "${id}"`); return; }
    if (seen.has(id)) { errors.push(`line ${line}: id "${id}" appears twice`); return; }
    seen.add(id);

    const why = [];
    const names = [];
    let undecided = false;
    for (const n of ['1', '2']) {
      const name = get(`reviewer${n}`);
      const ok = get(`reviewer${n}_ok`);
      if (name && isYes(ok)) names.push(name);
      else if (name && ok) why.push(`reviewer${n} (${name}) said "${ok}"`);
      else if (name) undecided = true;
      else if (ok) why.push(`reviewer${n}_ok is "${ok}" but reviewer${n} has no name`);
    }
    const notes = get('correction_notes');
    if (notes) why.push(`correction notes: ${notes}`);

    if (why.length) held.push({ id, why });
    else if (names.length) approved.push({ id, names });
    else if (!undecided) return;
    if (!why.length && undecided) waiting.push(id);
  });
  for (const e of ingredients) if (!seen.has(e.id)) errors.push(`entry "${e.id}" is not in the CSV`);
  return { errors, approved, held, waiting, rows: body.length };
}

// The new reviewedBy of each approved entry: the existing names plus the new ones (same name in any
// letter case counts once, as reviewerCount does).
export function mergeReviewers(existing, names) {
  const out = [...existing];
  const have = new Set(out.map((n) => String(n).trim().toLowerCase()));
  for (const n of names) if (!have.has(n.toLowerCase())) { out.push(n); have.add(n.toLowerCase()); }
  return out;
}

// Rewrites only the `"reviewedBy": [...]` of the given entries in the text of ingredients.json (one entry
// per line), so the rest of the file is byte for byte the same. Throws if the result differs from the
// input in anything but reviewedBy.
export function applyReviewers(text, updates) {
  let out = text;
  for (const [id, list] of Object.entries(updates)) {
    const re = new RegExp(`("id": ${JSON.stringify(id)},[^\\n]*?"reviewedBy": )\\[[^\\]]*\\]`);
    if (!re.test(out)) throw new Error(`could not find reviewedBy of "${id}" in ingredients.json`);
    out = out.replace(re, (_, head) => head + JSON.stringify(list));
  }
  const before = JSON.parse(text);
  const after = JSON.parse(out);
  const strip = (arr) => arr.map(({ reviewedBy, ...rest }) => rest);
  if (JSON.stringify(strip(before)) !== JSON.stringify(strip(after))) throw new Error('refusing to write: more than reviewedBy changed');
  after.forEach((e) => {
    const want = updates[e.id] ?? before.find((b) => b.id === e.id).reviewedBy;
    if (JSON.stringify(e.reviewedBy) !== JSON.stringify(want)) throw new Error(`refusing to write: reviewedBy of "${e.id}" is not as planned`);
  });
  return out;
}

export function buildReport(plan, ingredients, updates, write) {
  const byId = new Map(ingredients.map((e) => [e.id, e]));
  const lines = [];
  const w = (s = '') => lines.push(s);
  const nowDone = ingredients.filter((e) => reviewerCount({ reviewedBy: updates[e.id] ?? e.reviewedBy }) >= 2).length;
  w(`${write ? 'WRITE' : 'DRY RUN (nothing written; add --write to apply)'}: ${plan.rows} rows in the CSV`);
  w();
  const changed = plan.approved.filter((a) => updates[a.id] && updates[a.id].length !== byId.get(a.id).reviewedBy.length);
  w(`Sign-offs to record: ${changed.length} entries`);
  for (const a of changed) {
    const next = updates[a.id];
    const note = next.length < 2 ? ` (${next.length}/2, needs another reviewer)` : '';
    w(`  ${a.id}: + ${next.slice(byId.get(a.id).reviewedBy.length).join(', ')} -> ${next.join(', ')}${note}`);
  }
  const same = plan.approved.length - changed.length;
  if (same) w(`  (${same} more already recorded)`);
  w();
  w(`Not OK, left unreviewed: ${plan.held.length} entries`);
  for (const h of plan.held) w(`  ${h.id}: ${h.why.join('; ')}`);
  if (plan.waiting.length) {
    w();
    w(`Named but no yes/no yet: ${plan.waiting.length} entries`);
    w(`  ${plan.waiting.join(', ')}`);
  }
  w();
  w(`Entries with two reviewers after this: ${nowDone}/${ingredients.length}`);
  return lines.join('\n');
}

function main(argv) {
  const write = argv.includes('--write');
  const files = argv.filter((a) => !a.startsWith('--'));
  if (files.length !== 1) {
    console.error('Usage: npm run review:import -- path/to/export.csv [--write]');
    return 1;
  }
  let csvText;
  try { csvText = fs.readFileSync(files[0], 'utf8'); } catch (err) {
    console.error(`Cannot read ${files[0]}: ${err.code === 'ENOENT' ? 'no such file' : err.message}. Download the sheet as CSV and pass its path.`);
    return 1;
  }
  const ingredientsText = fs.readFileSync(INGREDIENTS, 'utf8');
  const ingredients = JSON.parse(ingredientsText);
  const plan = planImport(parseCsv(csvText), ingredients);
  if (plan.errors.length) {
    console.error('Not importing:\n' + plan.errors.map((e) => '  ' + e).join('\n'));
    return 1;
  }
  const updates = {};
  for (const a of plan.approved) {
    const merged = mergeReviewers(ingredients.find((e) => e.id === a.id).reviewedBy, a.names);
    if (merged.length !== ingredients.find((e) => e.id === a.id).reviewedBy.length) updates[a.id] = merged;
  }
  console.log(buildReport(plan, ingredients, updates, write));
  if (write && Object.keys(updates).length) {
    fs.writeFileSync(INGREDIENTS, applyReviewers(ingredientsText, updates));
    console.log(`\nUpdated ${path.relative(ROOT, INGREDIENTS)}. Run npx vitest run and node scripts/validateRulebook.js, then npm run review:doc.`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
