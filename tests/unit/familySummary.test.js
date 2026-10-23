// The family banner on the scanner: one fixed line for everyone's verdicts. Never "safe" or
// "can eat", never a meaningless "for 0 of n".

import { describe, it, expect } from 'vitest';
import { familySummary, summaryKey } from '../../lib/ui/familySummary.ts';

const o = (verdict, reasons = []) => ({ verdict, reasons });
const noList = () => o('amber', ['NO_INGREDIENT_LIST']);
const VERDICTS = ['green', 'amber', 'red', 'retake', 'error'];

describe('family banner', () => {
  it('no ingredient list for everyone: "Couldn’t find an ingredient list. Check with staff" in en/hi/gu', () => {
    const rows = [noList(), noList()];
    expect(summaryKey(rows)).toBe('noList');
    expect(familySummary(rows, 'en')).toBe('Couldn’t find an ingredient list. Check with staff');
    expect(familySummary(rows, 'hi')).toBe('सामग्री सूची नहीं मिली। स्टाफ़ से पूछें');
    expect(familySummary(rows, 'gu')).toBe('ઘટક યાદી મળી નથી. સ્ટાફને પૂછો');
    expect(summaryKey([o('amber', ['NO_INGREDIENTS_FOUND']), noList()])).toBe('noList'); // empty list counts too
  });

  it.each([
    ['everyone green', [o('green'), o('green')], 'No avoided ingredients found for anyone'],
    ['everyone red', [o('red'), o('red')], 'Not suitable for anyone'],
    ['some green, rest amber', [o('green'), o('amber', ['UNKNOWN_TERM'])], 'No avoided ingredients found for 1 of 2'],
    ['some red, rest green', [o('red'), o('green'), o('green')], 'Not suitable for 1 of 3'],
    ['some red, some unclear', [o('red'), o('amber', ['ASK_INGREDIENT']), o('green')], 'Not suitable for 1 of 3. Check with staff for the others'],
    ['some red, rest no list', [o('red'), noList()], 'Not suitable for 1 of 2. Check with staff for the others'],
    ['everyone amber, other reasons', [o('amber', ['UNKNOWN_TERM']), o('amber', ['ASK_INGREDIENT'])], 'Check with staff before eating'],
    ['no list for one, unknown word for the other', [noList(), o('amber', ['UNKNOWN_TERM'])], 'Check with staff before eating'],
    ['everyone retake', [o('retake'), o('retake')], 'Please retake the photo'],
    ['amber and retake', [o('amber'), o('retake')], 'Check with staff before eating'],
    ['everyone failed', [o('error'), o('error')], 'Couldn’t check this label. Please try again'],
  ])('%s', (_, rows, text) => expect(familySummary(rows, 'en')).toBe(text));

  it('every mix of two and three people: never "0 of", never "safe" or "can eat", always a line', () => {
    const mixes = [];
    for (const a of VERDICTS) for (const b of VERDICTS) {
      mixes.push([o(a), o(b)]);
      for (const c of VERDICTS) mixes.push([o(a), o(b), o(c)]);
    }
    mixes.push([noList(), noList(), noList()]);
    for (const rows of mixes) for (const lang of ['en', 'hi', 'gu']) {
      const s = familySummary(rows, lang);
      expect(s, JSON.stringify(rows)).toBeTruthy();
      expect(s).not.toMatch(/\b0 of\b|में से 0 |માંથી 0 /);
      expect(s.toLowerCase()).not.toMatch(/\bsafe\b|can eat|सुरक्षित|खा सकते|સુરક્ષિત|ખાઈ શકો/);
    }
  });

  it('a green count only appears when there is no red, and a red count when there is no all-red', () => {
    expect(summaryKey([o('green'), o('red')])).toBe('someRed'); // the bad news leads
    expect(summaryKey([o('green'), o('error')])).toBe('someGreen');
    expect(summaryKey([])).toBeNull();
  });
});
