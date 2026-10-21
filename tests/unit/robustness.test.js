import { describe, it, expect } from 'vitest';
import { analyzeLabel, MAX_TEXT } from '../../lib/scan/analyze.js';
import { rb, profileOf, label } from '../helpers.js';

const p = profileOf('vegetarian');
const greenRaw = label('小麦粉、砂糖、食塩');

describe('robustness', () => {
  it('a confidence list shorter than the text treats missing values as unreadable', () => {
    const conf = Array.from({ length: 8 }, () => 0.99);
    expect(analyzeLabel({ raw: greenRaw, confidence: conf }, p, rb).verdict).toBe('amber');
  });
  it('NaN or missing confidence values count as unreadable', () => {
    const conf = Array.from({ length: greenRaw.length }, () => 0.99);
    conf[greenRaw.indexOf('砂')] = NaN;
    expect(analyzeLabel({ raw: greenRaw, confidence: conf }, p, rb).reasons).toContain('LOW_CONFIDENCE');
  });
  it('full confidence keeps a clean label green', () => {
    const conf = Array.from({ length: greenRaw.length }, () => 0.99);
    expect(analyzeLabel({ raw: greenRaw, confidence: conf }, p, rb).verdict).toBe('green');
  });
  it('very long text is cut and reported, not crashed on', () => {
    const raw = '原材料名：' + '砂糖、'.repeat(MAX_TEXT) + '\n内容量：1';
    const r = analyzeLabel({ raw }, p, rb);
    expect(r.truncated).toBe(true);
    expect(r.verdict).toBe('amber');
  });
  it('stays fast on worst-case input (deep brackets, long unknown text)', () => {
    const nasty = [
      '原材料名：' + '砂糖('.repeat(3000) + ')'.repeat(3000),
      '原材料名：' + 'ぺ'.repeat(19000),
      '原材料名：' + 'いかいかいか'.repeat(3000),
      '原材料名：' + '(一部に'.repeat(4000),
    ];
    for (const raw of nasty) {
      const t0 = Date.now();
      const r = analyzeLabel({ raw }, p, rb);
      expect(Date.now() - t0, raw.slice(0, 12)).toBeLessThan(3000);
      expect(r.verdict).not.toBe('green');
    }
  });
  it('accepts odd input types without crashing', () => {
    for (const raw of [null, undefined, 42, '   ', '\n\n\n', '原材料名', '内容量：100g']) {
      expect(['amber', 'red']).toContain(analyzeLabel({ raw }, p, rb).verdict);
    }
  });
  it('keeps the original text of every item for display', () => {
    const r = analyzeLabel({ raw: label('ｶﾂｵﾌﾞｼ、ラ\n一ド') }, p, rb);
    expect(r.items.map((i) => i.original)).toEqual(['ｶﾂｵﾌﾞｼ', 'ラ\n一ド']);
  });
});
