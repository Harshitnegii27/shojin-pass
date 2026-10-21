import { describe, it, expect } from 'vitest';
import { decideVerdict } from '../../lib/rulebook/verdict.js';
import { profileOf } from '../helpers.js';

const p = profileOf('vegetarian');
const okItem = { tags: ['plain_safe'] };
const red = { tags: ['meat'] };
const base = { items: [okItem], realCount: 1, profile: p };

describe('decideVerdict', () => {
  it('is green only when nothing is wrong', () => {
    expect(decideVerdict(base).verdict).toBe('green');
  });
  it('one red item makes the product red, even with other problems', () => {
    const r = decideVerdict({ ...base, items: [okItem, red], completeness: 'incomplete', unknown: [{ text: 'x' }] });
    expect(r.verdict).toBe('red');
    expect(r.reasons).toEqual(['FORBIDDEN_INGREDIENT', 'INCOMPLETE_LIST', 'UNKNOWN_TERM']);
  });
  it('every uncertainty on its own turns green into amber', () => {
    const cases = {
      INCOMPLETE_LIST: { completeness: 'incomplete' },
      NO_INGREDIENT_LIST: { noList: true },
      STRUCTURE_UNCLEAR: { structureUnclear: true },
      LOW_CONFIDENCE: { lowConfidenceOther: [{ text: '、' }] },
      UNKNOWN_TERM: { unknown: [{ text: 'x' }] },
      HIDDEN_TERM: { hidden: [{ text: 'いか' }] },
      OUTSIDE_SECTION_TERM: { outside: [{ text: '豚' }] },
      NO_INGREDIENTS_FOUND: { items: [], realCount: 0 },
    };
    for (const [reason, extra] of Object.entries(cases)) {
      const r = decideVerdict({ ...base, ...extra });
      expect(r.verdict, reason).toBe('amber');
      expect(r.reasons, reason).toContain(reason);
    }
    expect(decideVerdict({ ...base, truncated: true }).reasons).toContain('INCOMPLETE_LIST');
    expect(decideVerdict({ ...base, headless: true }).reasons).toContain('NO_INGREDIENT_LIST');
  });
  it('low confidence turns a green item amber but never softens red', () => {
    expect(decideVerdict({ ...base, items: [{ ...okItem, lowConfidence: true }] }).verdict).toBe('amber');
    expect(decideVerdict({ ...base, items: [{ ...red, lowConfidence: true }] }).verdict).toBe('red');
  });
  it('shared-line notices count only with the option', () => {
    expect(decideVerdict({ ...base, sharedLine: true }).verdict).toBe('green');
    expect(decideVerdict({ ...base, sharedLine: true, profile: profileOf('vegetarian', ['avoid_shared_line']) }).verdict).toBe('amber');
  });
  it('needs a resolved profile', () => {
    expect(() => decideVerdict({ items: [] })).toThrow();
  });
});
