// Chef card (spec 15.1): fixed phrases only, every preset, family members merged, translations,
// and the native-speaker flags.

import { describe, it, expect } from 'vitest';
import { buildChefCard, ASK_LINE_TAGS, REVIEW_NOTE } from '../../lib/chef/cardBuilder.js';
import { ChefCardSchema } from '../../lib/validation/schemas.js';
import { rb, PRESETS, profileOf } from '../helpers.js';

const NOW = new Date('2026-10-23T05:05:00Z');
const card = (members, extra = {}) => buildChefCard({ members, now: NOW, ...extra }, rb);
const line = (c, kind) => c.lines.find((l) => l.kind === kind);

describe('chef card', () => {
  it.each(PRESETS)('%s: builds a full card in Japanese, English, Hindi and Gujarati', (preset) => {
    const c = card([{ preset }]);
    expect(c.lines[0].kind).toBe('identity');
    expect(c.lines.at(-1).kind).toBe('question');
    for (const l of c.lines) for (const k of ['ja', 'en', 'hi', 'gu']) expect(l[k]).toBeTruthy();
    expect(line(c, 'forbid').ja.endsWith(rb.phrases.endings.forbid)).toBe(true);
    expect(c.buttons.map((b) => b.id)).toEqual(['contains', 'can_make_without', 'fine']); // the spec's 3 buttons only
    for (const b of c.buttons) for (const k of ['ja', 'en', 'hi', 'gu']) expect(b[k]).toBeTruthy();
  });

  it('opening follows chefIdentity', () => {
    expect(card([{ preset: 'jain_strict' }]).lines[0].ja).toBe(rb.phrases.identity.jain);
    expect(card([{ preset: 'vegetarian' }]).lines[0].ja).toBe(rb.phrases.identity.vegetarian);
  });

  it('forbid line: one phrase per forbidden tag in tags.json order; the shared fish phrase appears once', () => {
    const c = card([{ preset: 'vegetarian' }]);
    const forbid = profileOf('vegetarian').forbid;
    const expected = [...new Set(Object.keys(rb.tags).filter((t) => forbid.has(t) && rb.phrases.tags[t]).map((t) => rb.phrases.tags[t]))];
    expect(line(c, 'forbid').ja).toBe(expected.join('・') + rb.phrases.endings.forbid);
    const fish = rb.phrases.tags.fish_seafood;
    expect(line(c, 'forbid').ja.split(fish).length - 1).toBe(1);
    expect(line(c, 'forbid').ja).toContain(rb.phrases.tags.egg);
    expect(card([{ preset: 'vegetarian_egg' }]).lines.find((l) => l.kind === 'forbid').ja).not.toContain(rb.phrases.tags.egg);
  });

  it('ask line only for root vegetables, fungus or alcohol (jain_flexible), never for a forbidden tag', () => {
    const flex = line(card([{ preset: 'jain_flexible' }]), 'ask');
    expect(flex.ja.endsWith(rb.phrases.endings.ask)).toBe(true);
    for (const t of ['root_vegetable', 'fungus', 'alcohol']) expect(flex.ja).toContain(rb.phrases.tags[t]);
    expect(flex.ja).not.toContain(rb.phrases.tags.jain_sometimes_avoided); // asked by the preset, but not an ask-line tag
    expect(line(card([{ preset: 'vegetarian' }]), 'ask')).toBeUndefined(); // vegetarian asks only about unclear sources
    // jain_strict forbids roots, fungus and alcohol; it only asks about possible root ingredients.
    const strict = card([{ preset: 'jain_strict' }]);
    expect(line(strict, 'ask').ja).toBe([rb.phrases.tags.root_vegetable_possible, rb.phrases.tags.dried_rhizome].join('・') + rb.phrases.endings.ask);
    for (const t of profileOf('jain_strict').forbid) if (rb.phrases.tags[t]) expect(line(strict, 'ask').ja).not.toContain(rb.phrases.tags[t]);
    expect([...ASK_LINE_TAGS].every((t) => rb.tags[t])).toBe(true);
  });

  it('options add restrictions (avoid_alcohol moves alcohol to the forbid line)', () => {
    const c = card([{ preset: 'vegetarian', options: ['avoid_alcohol'] }]);
    expect(line(c, 'forbid').ja).toContain(rb.phrases.tags.alcohol);
  });

  it('everyone at the table: forbidden tags merged; Jain opening if anyone is Jain', () => {
    const c = card([{ preset: 'vegetarian_egg' }, { preset: 'jain_strict' }]);
    expect(c.identity).toBe('jain');
    expect(c.lines[0].ja).toBe(rb.phrases.identity.jain);
    expect(line(c, 'forbid').ja).toContain(rb.phrases.tags.egg);
    expect(line(c, 'forbid').ja).toContain(rb.phrases.tags.root_vegetable);
    expect(c.profiles.map((p) => p.preset)).toEqual(['vegetarian_egg', 'jain_strict']);
    // A tag one member forbids is never on the ask line for the table.
    const mixed = card([{ preset: 'jain_flexible' }, { preset: 'jain_strict' }]);
    for (const t of ['root_vegetable', 'fungus', 'alcohol']) expect(line(mixed, 'ask').ja).not.toContain(rb.phrases.tags[t]);
    for (const t of ['root_vegetable', 'fungus', 'alcohol']) expect(line(mixed, 'forbid').ja).toContain(rb.phrases.tags[t]);
  });

  it('dish name goes in 「」 before the question, in every language', () => {
    const c = card([{ preset: 'vegetarian' }], { dishNameJa: '野菜の天ぷら' });
    expect(line(c, 'question').ja).toBe('「野菜の天ぷら」' + rb.phrases.endings.question);
    for (const k of ['en', 'hi', 'gu']) expect(line(c, 'question')[k]).toContain('野菜の天ぷら');
  });

  it('translations use the tag labels', () => {
    const c = card([{ preset: 'jain_strict' }]);
    expect(line(c, 'forbid').en).toContain(rb.tags.honey.label.en);
    expect(line(c, 'forbid').hi).toContain(rb.tags.honey.label.hi);
    expect(line(c, 'forbid').gu).toContain(rb.tags.honey.label.gu);
  });

  it('date and time in JST, and the native-speaker flags on every card', () => {
    const c = card([{ preset: 'vegetarian' }]);
    expect(c.issuedAtJst).toBe('23 Oct 2026, 14:05 JST');
    expect(c.reviewNeeded).toEqual({ ja: true, hi: true, gu: true, note: REVIEW_NOTE });
  });

  it('unknown preset or no members: refused', () => {
    expect(() => card([{ preset: 'pescatarian' }])).toThrow(/Unknown diet preset/);
    expect(() => card([])).toThrow();
  });
});

describe('chef card request schema', () => {
  it('accepts one diet or members, not both or neither', () => {
    expect(ChefCardSchema.safeParse({ preset: 'vegetarian' }).success).toBe(true);
    expect(ChefCardSchema.safeParse({ members: [{ preset: 'vegetarian' }, { preset: 'jain_strict' }] }).success).toBe(true);
    expect(ChefCardSchema.safeParse({ preset: 'vegetarian', members: [{ preset: 'jain_strict' }] }).success).toBe(false);
    expect(ChefCardSchema.safeParse({}).success).toBe(false);
    expect(ChefCardSchema.safeParse({ preset: 'vegetarian', extra: 1 }).success).toBe(false);
  });
  it('dishNameJa: Japanese only, at most 40 characters', () => {
    expect(ChefCardSchema.safeParse({ preset: 'vegetarian', dishNameJa: '野菜の天ぷら' }).success).toBe(true);
    expect(ChefCardSchema.safeParse({ preset: 'vegetarian', dishNameJa: 'Tempura' }).success).toBe(false);
    expect(ChefCardSchema.safeParse({ preset: 'vegetarian', dishNameJa: '<script>' }).success).toBe(false);
    expect(ChefCardSchema.safeParse({ preset: 'vegetarian', dishNameJa: 'あ'.repeat(41) }).success).toBe(false);
  });
});
