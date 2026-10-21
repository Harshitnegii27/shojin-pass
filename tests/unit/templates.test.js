import { describe, it, expect } from 'vitest';
import { verdictLine, templateWhy, LANGS } from '../../lib/text/templates.js';
import { scanLabel, retakeResult } from '../../lib/scan/scanText.js';
import { rb, profileOf } from '../helpers.js';

describe('templates', () => {
  it('has a verdict line for every verdict and language', () => {
    for (const v of ['red', 'amber', 'green', 'retake']) for (const l of LANGS) expect(verdictLine(v, { en: 'X', hi: 'X', gu: 'X' }, l).length).toBeGreaterThan(5);
  });
  it('puts the diet name in the right language and falls back to English', () => {
    expect(verdictLine('red', rb.diets.jain_strict.label, 'hi')).toBe('आपके जैन (सख़्त) आहार के लिए उपयुक्त नहीं');
    expect(verdictLine('green', null, 'fr')).toBe('No avoided ingredients found on this label');
    expect(() => verdictLine('blue', null, 'en')).toThrow();
  });
  it('never says "safe" in a verdict line', () => {
    for (const l of LANGS) for (const v of ['red', 'amber', 'green', 'retake']) expect(verdictLine(v, { en: 'x' }, l).toLowerCase()).not.toMatch(/\bsafe\b/);
  });
  it('lists at most three different red items', () => {
    const r = scanLabel({ raw: '原材料名：豚肉、牛肉、ラード、豚脂、鶏肉、卵\n内容量：1', preset: 'vegetarian' }, rb);
    expect(r.why).toBe('Contains Pork, Beef and Lard (pork fat).');
  });
  it('explains the most important amber reason first', () => {
    const r = scanLabel({ raw: '原材料名：小麦粉、ぺぽぴ、チーズ', preset: 'vegetarian' }, rb);
    expect(r.reasons).toContain('INCOMPLETE_LIST');
    expect(r.why).toBe('Make sure the whole ingredient list is in the photo.');
    const u = scanLabel({ raw: '原材料名：小麦粉、ぺぽぴ\n内容量：1', preset: 'vegetarian' }, rb);
    expect(u.why).toBe('We don\'t know "ぺぽぴ" yet. Show the chef card to ask.');
  });
  it('writes Hindi and Gujarati explanations', () => {
    const r = scanLabel({ raw: '原材料名：豚肉\n内容量：1', preset: 'vegetarian', lang: 'gu' }, rb);
    expect(r.verdictLine).toBe('તમારા શાકાહારી આહાર માટે યોગ્ય નથી');
    expect(r.why).toBe('આમાં Pork છે.');
  });
  it('builds a retake result with fixed text', () => {
    const r = retakeResult('OCR_UNAVAILABLE', profileOf('vegetarian'), 'en', rb);
    expect(r.verdict).toBe('retake');
    expect(r.why).toBe("Couldn't read the label right now. Please try again.");
  });
  it('green explanation is the plain sentence', () => {
    expect(templateWhy({ verdict: 'green', reasons: [] }, 'en')).toBe('None of the ingredients we read are avoided in your diet.');
  });
});
