import { describe, it, expect } from 'vitest';
import { resolveProfile, ProfileError } from '../../lib/diet/resolveProfile.js';
import { rb } from '../helpers.js';

describe('resolveProfile', () => {
  it('builds forbid and ask sets from the preset', () => {
    const p = resolveProfile({ preset: 'vegetarian' }, rb);
    expect(p.forbid.has('egg')).toBe(true);
    expect(p.ask.has('source_unclear')).toBe(true);
    expect(p.chefIdentity).toBe('vegetarian');
  });
  it('options only add restrictions, and forbid wins over ask', () => {
    const p = resolveProfile({ preset: 'jain_flexible', options: ['avoid_fungus'] }, rb);
    expect(p.forbid.has('fungus')).toBe(true);
    expect(p.ask.has('fungus')).toBe(false);
  });
  it('de-duplicates and sorts options', () => {
    expect(resolveProfile({ preset: 'vegetarian', options: ['avoid_alcohol', 'avoid_alcohol', 'avoid_fungus'] }, rb).options)
      .toEqual(['avoid_alcohol', 'avoid_fungus']);
  });
  it('turns on shared-line warnings only with the option', () => {
    expect(resolveProfile({ preset: 'jain_strict' }, rb).askSharedLine).toBe(false);
    expect(resolveProfile({ preset: 'jain_strict', options: ['avoid_shared_line'] }, rb).askSharedLine).toBe(true);
  });
  it('rejects unknown presets and options instead of falling back', () => {
    expect(() => resolveProfile({ preset: 'vegan' }, rb)).toThrow(ProfileError);
    expect(() => resolveProfile({ preset: 'vegetarian', options: ['nope'] }, rb)).toThrow(ProfileError);
    expect(() => resolveProfile({ preset: 'vegetarian', options: 'avoid_fungus' }, rb)).toThrow(ProfileError);
  });
});
