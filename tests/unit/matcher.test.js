import { describe, it, expect } from 'vitest';
import { matchText } from '../../lib/rulebook/matcher.js';
import { normalizeAlias } from '../../lib/rulebook/normalize.js';
import { rb } from '../helpers.js';

const m = (s) => matchText(normalizeAlias(s), rb);
const ids = (s) => m(s).matches.map((x) => x.id);

describe('matchText', () => {
  it('takes the longest spelling', () => {
    expect(ids('かつお節エキス')).toEqual(['katsuobushi']);
    expect(ids('牛乳')).toEqual(['milk']);
    expect(ids('乳酸菌')).toEqual(['additives_plain']);
    expect(ids('乳化剤')).toEqual(['emulsifier']);
    expect(ids('鶏卵')).toEqual(['egg']);
    expect(ids('ビーフン')).toEqual(['grain']);
    expect(ids('カカオバター')).toEqual(['plant_milk_butter']);
    expect(ids('ブラックタイガー')).toEqual(['crustacean']);
    expect(ids('とろろ昆布')).toEqual(['seaweed']);
    expect(ids('きくらげ')).toEqual(['mushroom']);
    expect(ids('ちくわぶ')).toEqual(['grain']);
    expect(ids('酒石酸')).toEqual(['additives_plain']);
    expect(ids('大豆ミート')).toEqual(['soy_beans']);
    expect(ids('ジンジャーパウダー')).toEqual(['dried_rhizome']);
    expect(ids('乳酸カルシウム')).toEqual(['additives_plain']);
    expect(ids('鳥取県産')).toEqual(['annot:place']);
  });
  it('only accepts short kana words at a word boundary', () => {
    expect(ids('いか、たこ')).toEqual(['mollusc', 'mollusc']);
    expect(ids('はいかかお')).toEqual([]);
    expect(m('はいかかお').unknown.map((u) => u.text)).toEqual(['はいかかお']);
    expect(ids('いかエキス')).toEqual(['mollusc']);
    expect(ids('たこ焼き')).toContain('mollusc');
    expect(ids('グラム')).toEqual(['annot:unit']);
    expect(ids('ブラック')).toEqual(['herbs_spices']);
    expect(ids('含みます')).toEqual(['annot:statement']);
  });
  it('drops amounts and units as noise', () => {
    expect(m('100g').unknown).toEqual([]);
    expect(m('(10%)').unknown).toEqual([]);
    expect(m('1.5mg、2個').unknown).toEqual([]);
  });
  it('splits unknown text at separators and brackets', () => {
    expect(m('ぺぽ、ぴぷ(ぱぱ)').unknown.map((u) => u.text)).toEqual(['ぺぽ', 'ぴぷ', 'ぱぱ']);
  });
});
