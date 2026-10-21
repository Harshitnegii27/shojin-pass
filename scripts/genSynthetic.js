#!/usr/bin/env node
// Generates adversarial label texts from a fixed seed: realistic safe lists with one or two
// forbidden spellings inserted, then OCR-style noise. Used by tests/invariants/synthetic.test.js.
//   node scripts/genSynthetic.js 500 > /tmp/synthetic.json

import { readRulebookFiles } from '../lib/rulebook/loader.js';
import { isBoundarySensitive } from '../lib/rulebook/chars.js';
import { normalizeAlias } from '../lib/rulebook/normalize.js';

export function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SAFE = ['小麦粉', '砂糖', '食塩', '植物油脂', 'ぶどう糖', '水あめ', 'しょうゆ', '米', 'ごま', 'コーンスターチ', '寒天', 'りんご', 'トマト', 'キャベツ', '酢', '大豆', 'こしょう', '抹茶', 'ココア', 'レモン果汁'];
const ADDITIVES = ['クエン酸', 'ビタミンC', 'pH調整剤', 'カラメル色素', 'キサンタンガム', 'ソルビトール'];
const NOTES = ['(国産)', '(遺伝子組換えでない)', '(10%)', '(アメリカ産)', ''];
const KATA_TO_KANJI = { 'ー': '一', 'エ': '工', 'カ': '力', 'ロ': '口', 'ニ': '二', 'タ': '夕', 'ト': '卜', 'ハ': '八' };
const BRACKETS = [['(', ')'], ['（', '）'], ['【', '】'], ['〔', '〕']];

export function generate(n = 500, seed = 20261024, { insert = true } = {}) {
  const data = readRulebookFiles();
  const rnd = mulberry32(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const presets = Object.keys(data.diets);
  const out = [];
  for (let i = 0; i < n; i++) {
    const preset = pick(presets);
    const d = data.diets[preset];
    const forbiddenEntries = data.ingredients.filter((e) => !e.composite && e.tags.some((t) => d.forbid.includes(t)));
    const e = pick(forbiddenEntries);
    const alias = pick(e.aliases);
    const items = [];
    const count = 3 + Math.floor(rnd() * 6);
    for (let k = 0; k < count; k++) items.push(pick(SAFE) + pick(NOTES));
    if (insert) items.splice(Math.floor(rnd() * (items.length + 1)), 0, alias);
    // noise
    let list = items.join(pick(['、', '，', ',', '、 ', '､']));
    if (rnd() < 0.5) list += '/' + [pick(ADDITIVES), pick(ADDITIVES)].join('、');
    if (rnd() < 0.3) list += '(一部に小麦・大豆を含む)';
    let noisy = '';
    for (const ch of list) {
      let c = ch;
      if (KATA_TO_KANJI[c] && rnd() < 0.3) c = KATA_TO_KANJI[c];
      if (c === '(' || c === '（') { const b = pick(BRACKETS); c = b[0]; }
      if (c === ')' || c === '）') c = pick(BRACKETS)[1];
      noisy += c;
      if (rnd() < 0.06) noisy += pick(['\n', ' ', '　']);
    }
    const heading = pick(['原材料名：', '原 材 料 名 ', '【原材料名】', '原材料名\n']);
    const tail = pick(['\n内容量：100g', '\n賞味期限：枠外下部に記載', '\n【内容量】1個', '\n保存方法：直射日光を避けて']);
    out.push({
      id: 'S' + String(i + 1).padStart(3, '0'), preset, inserted: insert ? alias : null, entry: e.id,
      boundarySensitive: isBoundarySensitive(normalizeAlias(alias)),
      raw: heading + noisy + tail,
    });
  }
  return out;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) console.log(JSON.stringify(generate(Number(process.argv[2]) || 500), null, 1));
