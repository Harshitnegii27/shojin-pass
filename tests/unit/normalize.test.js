import { describe, it, expect } from 'vitest';
import { normalize, compact, normalizeAlias as n } from '../../lib/rulebook/normalize.js';

describe('normalize', () => {
  it('gives one key for katakana, hiragana and half-width katakana', () => {
    expect(n('カツオブシ')).toBe('かつおぶし');
    expect(n('かつおぶし')).toBe('かつおぶし');
    expect(n('ｶﾂｵﾌﾞｼ')).toBe('かつおぶし');
    expect(n('ﾍﾟｯﾊﾟｰ')).toBe(n('ペッパー'));
  });
  it('joins a word split across lines but keeps the line break in normalize()', () => {
    const r = normalize('かつお\n節');
    expect(r.text).toBe('かつお\n節');
    expect(compact(r).text).toBe('かつお節');
  });
  it('collapses repeated and exotic line breaks', () => {
    expect(normalize('a\r\n\r\nb c').text).toBe('a\nb\nc');
  });
  it('fixes OCR look-alikes next to katakana', () => {
    expect(n('ラ一ド')).toBe('らーど');
    expect(n('チキン工キス')).toBe('ちきんえきす');
    expect(n('力ラメル')).toBe('からめる');
    expect(n('口ースト')).toBe('ろーすと');
    expect(n('二ン二ク')).toBe('にんにく');
    expect(n('夕ピオカ')).toBe('たぴおか');
    expect(n('卜マト')).toBe('とまと');
    expect(n('八チミツ')).toBe('はちみつ');
    expect(n('ラ\n一ド')).toBe('らーど'); // across a line break
  });
  it('leaves real kanji alone', () => {
    expect(n('人工甘味料')).toBe('人工甘味料');
    expect(n('加工でん粉')).toBe('加工でん粉');
    expect(n('八角')).toBe('八角');
    expect(n('二酸化ケイ素')).toBe('二酸化けい素');
    expect(n('一味唐辛子')).toBe('一味唐辛子');
  });
  it('turns a hyphen after kana into a long vowel, but not after Latin', () => {
    expect(n('ら-めん')).toBe('らーめん');
    expect(n('ラ－ド')).toBe('らーど');
    expect(n('L-システイン')).toBe('l-しすていん');
  });
  it('lower-cases Latin and converts full-width letters and digits', () => {
    expect(n('ＤＨＡ')).toBe('dha');
    expect(n('１０％')).toBe('10%');
    expect(n('pH調整剤')).toBe('ph調整剤');
  });
  it('unifies brackets and separators', () => {
    expect(n('【原材料名】〔国産〕「a」『b』［c］')).toBe('(原材料名)(国産)(a)(b)(c)');
    expect(n('小麦粉，砂糖,塩､水')).toBe('小麦粉、砂糖、塩、水');
    expect(n('ビタミンＣ･Ｅ')).toBe('びたみんc・e');
  });
  it('turns spaces into word breaks in normalize() and removes them in compact()', () => {
    expect(normalize('しょう　ゆ 塩').text).toBe('しょう\nゆ\n塩');
    expect(n('しょう　ゆ')).toBe('しょうゆ');
  });
  it('removes spaces, ideographic spaces and invisible characters', () => {
    expect(n('原　材 料\t名')).toBe('原材料名');
    expect(n('ラ​ー­ド﻿')).toBe('らーど');
  });
  it('joins stand-alone voiced marks to the previous kana', () => {
    expect(n('カ゛')).toBe('が');
    expect(n('ハ゜ン')).toBe('ぱん');
  });
  it('maps old kanji forms', () => {
    expect(n('鷄肉')).toBe('鶏肉');
    expect(n('醬油')).toBe('醤油');
  });
  it('keeps an exact map back to the raw text', () => {
    const raw = '🍣 ｶﾞ\n豚';
    const r = normalize(raw);
    expect(r.text).toBe('🍣\nが\n豚');
    expect(r.text.length).toBe(r.map.length);
    expect(raw[r.map[3]]).toBe('ｶ');
    expect(raw[r.map[5]]).toBe('豚');
  });
  it('maps every character of an NFKC expansion to its source', () => {
    const r = normalize('㍉');
    expect(r.text).toBe('みり');
    expect(r.map).toEqual([0, 0]);
  });
  it('handles empty and missing input', () => {
    expect(normalize(null).text).toBe('');
    expect(normalize(undefined).text).toBe('');
    expect(normalize('').text).toBe('');
    expect(normalize(12).text).toBe('12');
  });
});
