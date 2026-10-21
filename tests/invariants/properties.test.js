// Properties that must hold for EVERY spelling in the rulebook and every preset.
import { describe, it, expect } from 'vitest';
import { data, rb, PRESETS, profileOf, run, label } from '../helpers.js';
import { colourForTags, RANK } from '../../lib/rulebook/verdict.js';
import { analyzeLabel } from '../../lib/scan/analyze.js';

const toKatakana = (s) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));
const toHiragana = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const halfWidth = (s) => s.normalize('NFKC'); // identity for most; half-width forms are produced below
const HW = { 'ア': 'ｱ', 'イ': 'ｲ', 'ウ': 'ｳ', 'エ': 'ｴ', 'オ': 'ｵ', 'カ': 'ｶ', 'キ': 'ｷ', 'ク': 'ｸ', 'ケ': 'ｹ', 'コ': 'ｺ', 'サ': 'ｻ', 'シ': 'ｼ', 'ス': 'ｽ', 'セ': 'ｾ', 'ソ': 'ｿ', 'タ': 'ﾀ', 'チ': 'ﾁ', 'ツ': 'ﾂ', 'テ': 'ﾃ', 'ト': 'ﾄ', 'ナ': 'ﾅ', 'ニ': 'ﾆ', 'ヌ': 'ﾇ', 'ネ': 'ﾈ', 'ノ': 'ﾉ', 'ハ': 'ﾊ', 'ヒ': 'ﾋ', 'フ': 'ﾌ', 'ヘ': 'ﾍ', 'ホ': 'ﾎ', 'マ': 'ﾏ', 'ミ': 'ﾐ', 'ム': 'ﾑ', 'メ': 'ﾒ', 'モ': 'ﾓ', 'ヤ': 'ﾔ', 'ユ': 'ﾕ', 'ヨ': 'ﾖ', 'ラ': 'ﾗ', 'リ': 'ﾘ', 'ル': 'ﾙ', 'レ': 'ﾚ', 'ロ': 'ﾛ', 'ワ': 'ﾜ', 'ン': 'ﾝ', 'ー': 'ｰ', 'ッ': 'ｯ', 'ャ': 'ｬ', 'ュ': 'ｭ', 'ョ': 'ｮ' };
const toHalfWidth = (s) => toKatakana(s).normalize('NFD').replace(/./gu, (c) => (c === '゙' ? 'ﾞ' : c === '゚' ? 'ﾟ' : HW[c] || c));
const splitLine = (s) => (s.length > 1 ? s.slice(0, 1) + '\n' + s.slice(1) : s);

const variants = (a) => [...new Set([a, toKatakana(a), toHiragana(a), toHalfWidth(a), splitLine(a), ' ' + a + ' ', halfWidth(a)])];

describe('strictness order', () => {
  const ordered = Object.entries(data.diets).sort((x, y) => x[1].strictnessRank - y[1].strictnessRank).map(([n]) => n);
  it('no tag is ever milder in a stricter preset', () => {
    for (const tag of Object.keys(data.tags)) {
      let prev = -1;
      for (const preset of ordered) {
        const r = RANK[colourForTags([tag], profileOf(preset))];
        expect(r, `${tag} in ${preset}`).toBeGreaterThanOrEqual(prev);
        prev = r;
      }
    }
  });
  it('a whole label is never milder in a stricter preset', () => {
    const labels = ['しいたけ、砂糖', 'でん粉、塩', 'はちみつ', 'みりん', '卵', 'ねぎ', 'なす', 'ターメリック', '香辛料'];
    for (const l of labels) {
      let prev = -1;
      for (const preset of ordered) {
        const r = RANK[run(label(l), preset).verdict];
        expect(r, `${l} in ${preset}`).toBeGreaterThanOrEqual(prev);
        prev = r;
      }
    }
  });
});

describe('never green when a forbidden or asked ingredient is present', () => {
  for (const preset of PRESETS) {
    it(`every relevant spelling, in every written form, in ${preset}`, () => {
      const p = profileOf(preset);
      const failures = [];
      for (const e of data.ingredients) {
        const colour = colourForTags(e.tags, p);
        if (colour === 'green' || e.composite) continue;
        for (const a of e.aliases) {
          for (const v of variants(a)) {
            for (const raw of [label('砂糖、' + v + '、食塩'), label('砂糖' + v + '食塩'), label(v)]) {
              const r = run(raw, preset);
              if (r.verdict === 'green' || RANK[r.verdict] < RANK[colour]) {
                // Glued forms may become less specific (amber instead of red) but never green.
                if (r.verdict === 'green' || raw === label('砂糖、' + v + '、食塩')) failures.push(`${e.id}:${JSON.stringify(v)} -> ${r.verdict} (expected at least ${colour})`);
              }
            }
          }
        }
      }
      expect(failures).toEqual([]);
    });
  }
  it('composite entries without listed parts keep their own colour', () => {
    for (const preset of PRESETS) {
      const p = profileOf(preset);
      for (const e of data.ingredients.filter((x) => x.composite)) {
        const colour = colourForTags(e.tags, p);
        for (const a of e.aliases) {
          const r = run(label('砂糖、' + a), preset);
          expect(RANK[r.verdict], `${preset} ${a}`).toBeGreaterThanOrEqual(RANK[colour]);
        }
      }
    }
  });
});

describe('uncertainty is never green', () => {
  const greenBase = ['小麦粉', '砂糖', '食塩', '植物油脂', 'ぶどう糖'];
  it('the base label is green', () => {
    for (const preset of PRESETS) expect(run(label(greenBase.join('、')), preset).verdict).toBe('green');
  });
  it('inserting any unknown text anywhere makes it amber', () => {
    const junk = ['ぺぽぴ', 'ﾍﾟﾎﾟ', 'zx', '朧朧', '◯◯', 'ゑゐ', '𠮷'];
    for (const j of junk) for (let pos = 0; pos <= greenBase.length; pos++) {
      const list = [...greenBase.slice(0, pos), j, ...greenBase.slice(pos)].join('、');
      expect(run(label(list), 'vegetarian').verdict, j + '@' + pos).not.toBe('green');
    }
  });
  it('cutting the label anywhere before the end field is never green', () => {
    const raw = label(greenBase.join('、'));
    const endAt = raw.indexOf('内容量');
    for (let k = 0; k < endAt + 2; k++) expect(run(raw.slice(0, k), 'vegetarian').verdict, 'cut at ' + k).not.toBe('green');
  });
  it('one unclear character anywhere in the list is never green', () => {
    const raw = label(greenBase.join('、'));
    const from = raw.indexOf('：') + 1;
    const to = raw.indexOf('\n');
    for (let k = from; k < to; k++) {
      const conf = Array.from({ length: raw.length }, () => 0.99);
      conf[k] = 0.2;
      const r = analyzeLabel({ raw, confidence: conf, minCharConfidence: 0.7 }, profileOf('vegetarian'), rb);
      expect(r.verdict, 'unclear char at ' + k + ' (' + raw[k] + ')').toBe('amber');
    }
  });
  it('truncation of very long text is never green', () => {
    const raw = '原材料名：' + '砂糖、'.repeat(8000) + '\n内容量：1';
    expect(run(raw, 'vegetarian').reasons).toContain('INCOMPLETE_LIST');
  });
});

describe('determinism and order', () => {
  it('same input gives the same output', () => {
    const raw = label('小麦粉、豚肉、ぺぽ、チーズ');
    expect(JSON.stringify(run(raw, 'vegetarian'))).toBe(JSON.stringify(run(raw, 'vegetarian')));
  });
  it('the order of ingredients does not change the verdict', () => {
    const items = ['小麦粉', '砂糖', 'チーズ', '食塩', 'でん粉'];
    const v = run(label(items.join('、')), 'jain_strict').verdict;
    for (let i = 0; i < 20; i++) {
      const shuffled = [...items].sort(() => (Math.sin(i * 99 + items.length) > 0 ? 1 : -1));
      expect(run(label(shuffled.reverse().join('、')), 'jain_strict').verdict).toBe(v);
    }
  });
});
