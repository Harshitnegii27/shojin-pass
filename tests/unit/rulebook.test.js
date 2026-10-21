import { describe, it, expect } from 'vitest';
import { buildRulebook, readRulebookFiles } from '../../lib/rulebook/loader.js';
import { validate } from '../../scripts/validateRulebook.js';
import { resolveProfile } from '../../lib/diet/resolveProfile.js';
import { analyzeLabel } from '../../lib/scan/analyze.js';

const fresh = () => JSON.parse(JSON.stringify(readRulebookFiles()));

describe('rulebook files', () => {
  it('pass the validator in development mode', () => {
    const r = validate(fresh());
    expect(r.errors).toEqual([]);
  });
  it('fail the release check while entries are unreviewed', () => {
    expect(validate(fresh(), { strict: true }).errors.some((e) => e.includes('fewer than two reviewers'))).toBe(true);
  });
  it('without review, no ingredient is trusted, so nothing can be green', () => {
    const rb = buildRulebook(fresh(), { allowUnreviewed: false });
    expect(rb.skippedUnreviewed).toBeGreaterThan(0);
    const r = analyzeLabel({ raw: '原材料名：小麦粉、砂糖\n内容量：1' }, resolveProfile({ preset: 'vegetarian' }, rb), rb);
    expect(r.verdict).toBe('amber');
  });
  it('rejects the same spelling in two entries', () => {
    const d = fresh();
    d.ingredients[0].aliases.push('牛乳');
    expect(() => buildRulebook(d, { allowUnreviewed: true })).toThrow(/belongs to both/);
  });
  it('rejects a spelling that only differs by katakana/hiragana from another entry', () => {
    const d = fresh();
    d.ingredients.find((e) => e.id === 'fruit').aliases.push('カツオブシ');
    expect(() => buildRulebook(d, { allowUnreviewed: true })).toThrow(/belongs to both/);
  });
  it('rejects plain_safe combined with another tag, and unknown tags', () => {
    const d = fresh();
    d.ingredients.find((e) => e.id === 'water').tags.push('meat');
    d.ingredients.find((e) => e.id === 'salt').tags.push('salty');
    const r = validate(d);
    expect(r.errors.some((e) => e.includes('plain_safe must be the only tag'))).toBe(true);
    expect(r.errors.some((e) => e.includes('unknown tag "salty"'))).toBe(true);
  });
  it('catches a preset that is milder than the one before it', () => {
    const d = fresh();
    d.diets.jain_strict.forbid = d.diets.jain_strict.forbid.filter((t) => t !== 'honey');
    expect(validate(d).errors.some((e) => e.includes('strictness order broken: tag "honey"'))).toBe(true);
  });
  it('catches a tag both forbidden and asked, and a missing chef phrase', () => {
    const d = fresh();
    d.diets.vegetarian.ask.push('egg');
    delete d.phrases.tags.honey;
    const r = validate(d);
    expect(r.errors.some((e) => e.includes('both forbidden and asked'))).toBe(true);
    expect(r.errors.some((e) => e.includes('no chef-card phrase for tag "honey"'))).toBe(true);
  });
  it('reports hidden words for human review', () => {
    const r = validate(fresh());
    expect(r.info.hiddenWords.some((h) => h.startsWith('牛 (beef) inside 牛乳'))).toBe(true);
  });
});
