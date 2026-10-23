// scripts/genRulebookReview.js: the review checklist lists every rulebook entry once, with the
// diets each one blocks, and reading the rulebook never changes it.

import { describe, it, expect } from 'vitest';
import { readRulebookFiles } from '../../lib/rulebook/loader.js';
import { buildReviewDoc, colourFor } from '../../scripts/genRulebookReview.js';

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

  it('does not change the rulebook data', () => {
    expect(JSON.stringify(data)).toBe(before);
  });
});
