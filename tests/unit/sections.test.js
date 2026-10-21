import { describe, it, expect } from 'vitest';
import { normalize } from '../../lib/rulebook/normalize.js';
import { locateSections } from '../../lib/rulebook/sections.js';
import { rb } from '../helpers.js';

const loc = (raw) => locateSections(normalize(raw), rb.markers);
const lists = (raw) => loc(raw).sections.map((s) => s.compact.text);

describe('locateSections', () => {
  it('finds the list between 原材料名 and the next field', () => {
    expect(lists('名称：菓子\n原材料名：小麦粉、砂糖\n内容量：100g')).toEqual(['小麦粉、砂糖']);
  });
  it('finds spaced-out headings', () => {
    expect(lists('原 材 料 名 小麦粉\n内 容 量 1個')).toEqual(['小麦粉']);
  });
  it('does not treat 原材料の一部に… as a heading', () => {
    expect(loc('本品は原材料の一部に卵を含みます').sections).toHaveLength(0);
  });
  it('keeps a field name inside a bracket in the list, but accepts heading brackets and line starts', () => {
    expect(lists('原材料名：えび(原産国：タイ)、塩\n内容量：1')).toEqual(['えび(原産国:たい)、塩']);
    expect(lists('(原材料名)小麦粉\n(内容量)1')).toEqual(['小麦粉']);
    expect(lists('原材料名：小麦粉、\n内容量：1')).toEqual(['小麦粉、']);
  });
  it('marks lists complete / incomplete', () => {
    const c = (raw) => loc(raw).sections[0].completeness;
    expect(c('原材料名：小麦粉\n内容量：1')).toBe('complete');
    expect(c('原材料名：小麦粉、砂糖')).toBe('incomplete');
    expect(c('原材料名：小麦粉(一部に小麦を含む)')).toBe('complete');
    expect(c('原材料名：小麦粉、\n内容量：1')).toBe('incomplete');
  });
  it('finds every list on a multi-product label', () => {
    expect(lists('原材料名：小麦粉\n原材料名：しょうゆ\n内容量：1')).toEqual(['小麦粉', 'しょうゆ']);
  });
  it('accepts a heading with one misread character', () => {
    const r = loc('原材科名：豚肉\n内容量：1');
    expect(r.fuzzyStart).toBe(true);
    expect(r.sections[0].compact.text).toBe('豚肉');
  });
  it('falls back to a headless list when there is no heading', () => {
    const r = loc('小麦粉、砂糖、塩');
    expect(r.headless).toBe(true);
    expect(r.sections[0].completeness).toBe('incomplete');
  });
  it('removes shared-line sentences from the list and keeps them as notes', () => {
    const r = loc('原材料名：青のり\n内容量：10g\n本品製造工場では、えび・かにを含む製品を製造しています。');
    expect(r.sharedLines).toHaveLength(1);
    expect(r.sections[0].compact.text).toBe('青のり');
    expect(r.outside.text.includes('えび')).toBe(false);
  });
  it('does not swallow list items that share a line with a shared-line marker', () => {
    const r = loc('原材料名：豚肉、同じ工場でえびを使用\n内容量：1');
    expect(r.sections[0].compact.text.startsWith('豚肉、')).toBe(true);
  });
  it('excludes address values from the outside text but keeps the product name', () => {
    const r = loc('名称：ポークカレー\n原材料名：小麦粉\n内容量：1\n製造者：牛久食品');
    expect(r.outside.text).toContain('ぽーくかれー');
    expect(r.outside.text).not.toContain('牛久');
  });
  it('reads a separate allergen field as its own list', () => {
    const r = loc('原材料名：小麦粉\nアレルギー物質：卵、乳\n内容量：1');
    expect(r.sections.map((s) => s.kind)).toEqual(['ingredients', 'allergen']);
  });
});
