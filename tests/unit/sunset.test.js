// Sunset rule for routes (spec 15.2) and JST formatting. suncalc runs locally; no network.

import { describe, it, expect } from 'vitest';
import { flagSunsetMeals, sunsetOn, SUNSET_BUFFER_MIN, EARLY_SLOT_BEFORE_MIN } from '../../lib/routes/sunset.js';
import { formatJst, todayJst, addDays, jstDate } from '../../lib/time/jst.js';
import { getRoute } from '../../lib/routes/routeService.js';

const KYOTO = { lat: 35.0116, lng: 135.7681 };
const DATE = '2026-10-28';
const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

describe('JST helpers', () => {
  it('formatJst shows Japan time, with or without the date', () => {
    const d = new Date('2026-10-23T05:05:00Z'); // 14:05 in Japan
    expect(formatJst(d)).toBe('14:05');
    expect(formatJst(d, { withDate: true })).toBe('23 Oct 2026, 14:05 JST');
  });
  it('todayJst uses the Japanese date, not UTC', () => {
    expect(todayJst(new Date('2026-10-23T16:30:00Z'))).toBe('2026-10-24'); // 01:30 next day in Japan
  });
  it('addDays and jstDate', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(jstDate(DATE, '19:00').toISOString()).toBe('2026-10-28T10:00:00.000Z');
  });
});

describe('sunset rule', () => {
  it('Kyoto in late October: sunset a little after 17:00 JST (spec example)', () => {
    const s = formatJst(sunsetOn(DATE, KYOTO));
    expect(minutes(s)).toBeGreaterThanOrEqual(minutes('17:00'));
    expect(minutes(s)).toBeLessThanOrEqual(minutes('17:15'));
  });

  it('a 19:00 dinner conflicts; a 12:00 lunch does not; non-meals are untouched', () => {
    const r = flagSunsetMeals([
      { day: 1, start: '12:00', isMeal: true },
      { day: 1, start: '19:00', isMeal: true },
      { day: 1, start: '20:00', isMeal: false, title: 'walk' },
    ], { ...KYOTO, date: DATE });
    expect(r.stops[0].sunsetConflict).toBe(false);
    expect(r.stops[1].sunsetConflict).toBe(true);
    expect(r.stops[2]).toEqual({ day: 1, start: '20:00', isMeal: false, title: 'walk' });
  });

  it(`the limit is ${SUNSET_BUFFER_MIN} minutes before sunset`, () => {
    const sunset = sunsetOn(DATE, KYOTO);
    const limit = new Date(sunset.getTime() - SUNSET_BUFFER_MIN * 60000);
    const before = formatJst(new Date(limit.getTime() - 60000)); // one minute before the limit
    const after = formatJst(new Date(limit.getTime() + 60000));
    const r = flagSunsetMeals([{ day: 1, start: before, isMeal: true }, { day: 1, start: after, isMeal: true }], { ...KYOTO, date: DATE });
    expect(r.stops.map((s) => s.sunsetConflict)).toEqual([false, true]);
  });

  it(`early slot: ${EARLY_SLOT_BEFORE_MIN} min before sunset, rounded down to the quarter hour, only if the venue serves before sunset`, () => {
    const r = flagSunsetMeals([
      { day: 1, start: '19:00', isMeal: true, venue: { servesBeforeSunset: true } },
      { day: 1, start: '19:00', isMeal: true, venue: { servesBeforeSunset: false } },
      { day: 1, start: '19:00', isMeal: true },
    ], { ...KYOTO, date: DATE });
    expect(r.stops[0].suggestEarly).toBe('15:45'); // spec 15.2: about 15:45–16:00
    expect(minutes(r.stops[0].suggestEarly) % 15).toBe(0);
    expect(r.stops[1].suggestEarly).toBeNull();
    expect(r.stops[2].suggestEarly).toBeNull();
  });

  it('day 2 uses the next date, and each day reports its sunset in JST', () => {
    const r = flagSunsetMeals([{ day: 1, start: '12:00', isMeal: true }, { day: 2, start: '07:30', isMeal: true }], { ...KYOTO, date: '2026-10-31' });
    expect(r.sunsets.map((s) => s.date)).toEqual(['2026-10-31', '2026-11-01']);
    for (const s of r.sunsets) expect(s.sunset).toMatch(/^\d{2}:\d{2}$/);
  });

  it('summer sunset is later: a 18:00 meal is fine in June, too late in December', () => {
    const meal = [{ day: 1, start: '18:00', isMeal: true }];
    expect(flagSunsetMeals(meal, { ...KYOTO, date: '2026-06-21' }).stops[0].sunsetConflict).toBe(false);
    expect(flagSunsetMeals(meal, { ...KYOTO, date: '2026-12-21' }).stops[0].sunsetConflict).toBe(true);
  });
});

describe('routes use the rule only with no_food_after_sunset', () => {
  it('without the option: sunset times shown, no meal flagged', () => {
    const r = getRoute('kyoto-zen-temple-day', { preset: 'jain_strict', date: DATE });
    expect(r.sunsetRule).toBe(false);
    expect(r.sunsets).toHaveLength(1);
    expect(r.stops.some((s) => 'sunsetConflict' in s)).toBe(false);
  });

  it('with the option: the 19:00 partner dinner conflicts and gets the early slot (its sample venue serves before sunset)', () => {
    const r = getRoute('kyoto-zen-temple-day', { preset: 'jain_strict', options: ['no_food_after_sunset'], date: DATE });
    const dinner = r.stops.find((s) => s.start === '19:00');
    expect(dinner.sunsetConflict).toBe(true);
    expect(dinner.suggestEarly).toBe('15:45');
    expect(r.stops.find((s) => s.start === '12:00').sunsetConflict).toBe(false);
  });

  it('a two-day route checks each day', () => {
    const r = getRoute('koyasan-temple-stay', { options: ['no_food_after_sunset'], date: DATE });
    expect(r.sunsets.map((s) => s.day)).toEqual([1, 2]);
    expect(r.stops.find((s) => s.day === 1 && s.start === '17:30').sunsetConflict).toBe(true);
    expect(r.stops.find((s) => s.day === 2 && s.start === '07:30').sunsetConflict).toBe(false);
  });
});
