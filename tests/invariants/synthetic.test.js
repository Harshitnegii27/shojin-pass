import { describe, it, expect } from 'vitest';
import { generate } from '../../scripts/genSynthetic.js';
import { run } from '../helpers.js';

describe('generated adversarial labels (fixed seed)', () => {
  const cases = generate(600);
  it('never green, and red whenever the inserted word is not a short kana word', () => {
    const failures = [];
    let red = 0;
    for (const c of cases) {
      const r = run(c.raw, c.preset);
      if (r.verdict === 'red') red++;
      if (r.verdict === 'green') failures.push(`${c.id} GREEN ${c.preset} ${c.inserted} ${JSON.stringify(c.raw)}`);
      else if (!c.boundarySensitive && r.verdict !== 'red') failures.push(`${c.id} ${r.verdict} ${c.preset} ${c.inserted} ${r.reasons} ${JSON.stringify(c.raw)}`);
    }
    expect(failures).toEqual([]);
    expect(red / cases.length).toBeGreaterThan(0.95);
  });
});
