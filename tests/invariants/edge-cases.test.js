import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { run } from '../helpers.js';
import { checkCase } from '../fixtures/check.js';

const cases = JSON.parse(fs.readFileSync(new URL('../fixtures/edge-cases.json', import.meta.url), 'utf8'));

describe('edge-case catalogue', () => {
  for (const c of cases) {
    it(`${c.id} ${c.title}`, () => {
      const r = run(c.raw, c.preset, c.options, c.confidence);
      expect(checkCase(c, r)).toEqual([]);
    });
  }
});
