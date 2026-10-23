// A scan with no ingredient list (e.g. a restaurant menu): the scanner shows one fixed "menu" line
// for amber, lists only rulebook matches (not every OCR line as "Not in our rulebook yet"), and
// never changes the engine's verdict.

import { describe, it, expect } from 'vitest';
import { rb } from '../helpers.js';
import { scanLabel } from '../../lib/scan/scanText.js';
import { MENU_LINE, listedItems, menuLine, noIngredientList } from '../../lib/ui/menuScan.ts';

const MENU = 'MENU\n天ぷらうどん、きつねそば\n冷奴、枝豆、豆腐、しょうゆ';
const MENU_RED = 'ランチメニュー\n日替わり定食、焼き魚、味噌汁、ご飯、漬物、サラダ';
const LABEL = '原材料名：豆腐、昆布だし、しょうゆ、ごま油、砂糖、しいたけ、謎の素\n内容量：100g';

describe('menu (no ingredient list)', () => {
  const r = scanLabel({ raw: MENU, preset: 'vegetarian' }, rb);

  it('the engine says amber with NO_INGREDIENT_LIST and has unknown OCR lines', () => {
    expect(r.verdict).toBe('amber');
    expect(r.reasons).toContain('NO_INGREDIENT_LIST');
    expect(r.unknown.length).toBeGreaterThan(0);
    expect(noIngredientList(r)).toBe(true);
  });

  it('shows one fixed menu line in en/hi/gu', () => {
    expect(menuLine(r, 'en')).toBe('This looks like a menu, not an ingredient label');
    for (const l of ['en', 'hi', 'gu']) expect(menuLine(r, l)).toBe(MENU_LINE[l]);
  });

  it('lists only rulebook matches, never the unknown lines', () => {
    const { items, unknown } = listedItems(r);
    expect(unknown).toEqual([]);
    expect(items).toBe(r.items);
    expect(items.length).toBeGreaterThan(0);
  });

  it('does not change the verdict or the result', () => {
    const before = JSON.stringify(r);
    menuLine(r, 'en');
    listedItems(r);
    expect(JSON.stringify(r)).toBe(before);
  });
});

describe('menu with a red ingredient', () => {
  const r = scanLabel({ raw: MENU_RED, preset: 'vegetarian' }, rb);

  it('stays red with its own verdict line; only matches are listed', () => {
    expect(r.verdict).toBe('red');
    expect(noIngredientList(r)).toBe(true);
    expect(menuLine(r, 'en')).toBeNull();
    expect(listedItems(r).unknown).toEqual([]);
    expect(listedItems(r).items.some((i) => i.colour === 'red')).toBe(true);
  });
});

describe('a real ingredient label', () => {
  const r = scanLabel({ raw: LABEL, preset: 'vegetarian' }, rb);

  it('keeps its verdict line and still lists unknown ingredients', () => {
    expect(noIngredientList(r)).toBe(false);
    expect(menuLine(r, 'en')).toBeNull();
    expect(listedItems(r).unknown).toBe(r.unknown);
  });

  it('never uses the menu line for other verdicts, even with the reason', () => {
    for (const verdict of ['green', 'red', 'retake']) expect(menuLine({ verdict, reasons: ['NO_INGREDIENT_LIST'] }, 'en')).toBeNull();
    expect(menuLine(null, 'en')).toBeNull();
    expect(menuLine({ verdict: 'amber', reasons: ['NO_INGREDIENTS_FOUND'] }, 'en')).toBeNull();
  });
});
