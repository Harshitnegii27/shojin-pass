// Sample routes and venues (spec 14.6, 15.2, 15.3): data rules, diet check, nearest-first search.

import { describe, it, expect } from 'vitest';
import routeData from '../../data/routes.json' with { type: 'json' };
import venueData from '../../data/venues.json' with { type: 'json' };
import { listRoutes, getRoute, routeSlugs, CUSTOM_MENU_NOTE } from '../../lib/routes/routeService.js';
import { venuesNear, haversineM, SAMPLE_NOTE } from '../../lib/venues/venueService.js';
import { PRESETS } from '../helpers.js';

const KYOTO = { lat: 35.0116, lng: 135.7681 };

describe('sample data rules', () => {
  it('every route has lat/lng; every meal stop has isMeal: true and a known venue', () => {
    const ids = new Set(venueData.venues.map((v) => v.id));
    for (const r of routeData.routes) {
      expect(typeof r.lat).toBe('number');
      expect(typeof r.lng).toBe('number');
      for (const p of r.dietPresets) expect(PRESETS).toContain(p);
      for (const s of r.stops) {
        expect(typeof s.isMeal).toBe('boolean');
        expect(s.start).toMatch(/^\d{2}:\d{2}$/);
        if (s.venueId) expect(ids.has(s.venueId)).toBe(true);
      }
      expect(r.stops.some((s) => s.isMeal)).toBe(true);
    }
  });

  it('every venue is a sample: sample true, certification "sample", no certifiedAt, a made-up name', () => {
    for (const v of venueData.venues) {
      expect(v.sample).toBe(true);
      expect(v.certification).toBe('sample');
      expect(v.certifiedAt).toBeNull();
      expect(v.nameEn).toMatch(/^Demo .*\(sample\)$/);
      for (const p of v.supports) expect(PRESETS).toContain(p);
    }
  });
});

describe('routes', () => {
  it('fitsDiet per preset; a route that does not fit is still listed, with the custom-menu note', () => {
    const list = listRoutes({ preset: 'jain_strict' });
    expect(list.map((r) => r.slug)).toEqual(routeSlugs());
    const koyasan = list.find((r) => r.slug === 'koyasan-temple-stay');
    expect(koyasan).toMatchObject({ fitsDiet: false, note: CUSTOM_MENU_NOTE });
    expect(list.find((r) => r.slug === 'kyoto-zen-temple-day')).toMatchObject({ fitsDiet: true });
    expect(list.find((r) => r.slug === 'kyoto-zen-temple-day').note).toBeUndefined();
    expect(listRoutes()[0].fitsDiet).toBeNull(); // no preset: no claim either way
  });

  it('meal stops carry their sample venue with the sample note', () => {
    const r = getRoute('kyoto-zen-temple-day', { date: '2026-10-28' });
    const lunch = r.stops.find((s) => s.start === '12:00');
    expect(lunch.venue).toMatchObject({ sample: true, sampleNote: SAMPLE_NOTE, certifiedAt: null });
    expect(getRoute('no-such-route')).toBeNull();
  });
});

describe('venues near a point', () => {
  it('haversine: about 1.1 km per 0.01° of latitude', () => {
    expect(haversineM({ lat: 35, lng: 135 }, { lat: 35.01, lng: 135 })).toBeGreaterThan(1100);
    expect(haversineM({ lat: 35, lng: 135 }, { lat: 35.01, lng: 135 })).toBeLessThan(1120);
  });

  it('nearest first, within the radius; Koyasan is not "near" Kyoto', () => {
    const list = venuesNear({ ...KYOTO, radius: 15000 });
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((v) => v.city === 'Kyoto')).toBe(true);
    const d = list.map((v) => v.distanceM);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(venuesNear({ ...KYOTO, radius: 100 })).toEqual([]);
  });

  it('with a preset, only venues that support it; without, all', () => {
    const all = venuesNear({ ...KYOTO, radius: 15000 });
    const strict = venuesNear({ ...KYOTO, radius: 15000, preset: 'jain_strict' });
    expect(strict.length).toBeLessThan(all.length);
    expect(strict.every((v) => v.supports.includes('jain_strict'))).toBe(true);
  });

  it('every venue returned says it is a sample', () => {
    for (const v of venuesNear({ ...KYOTO, radius: 20000 })) expect(v).toMatchObject({ sample: true, sampleNote: SAMPLE_NOTE, certifiedAt: null });
  });
});
