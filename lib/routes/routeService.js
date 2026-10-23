// Shojin Routes (spec 15.2, 13.9), from data/routes.json. Pure; no network.
// - Diet check: a route whose dietPresets lack the preset is still shown, with a note.
// - Venue status: meal stops linked to a venue carry it (all venues are samples).
// - Sunset rule: only with the no_food_after_sunset option.

import routeData from '../../data/routes.json' with { type: 'json' };
import { publicVenue, venueById } from '../venues/venueService.js';
import { flagSunsetMeals } from './sunset.js';
import { todayJst } from '../time/jst.js';

export const CUSTOM_MENU_NOTE = 'needs a custom menu — book to arrange';
export const SUNSET_OPTION = 'no_food_after_sunset';

const summary = (r, preset) => {
  const fitsDiet = preset ? r.dietPresets.includes(preset) : null;
  return {
    slug: r.slug, title: r.title, titleJa: r.titleJa, city: r.city, days: r.days,
    samplePriceINR: r.samplePriceINR, season: r.season, color: r.color, blurb: r.blurb,
    highlights: r.highlights, dietPresets: r.dietPresets,
    fitsDiet, ...(fitsDiet === false ? { note: CUSTOM_MENU_NOTE } : {}),
    sample: true,
  };
};

export function listRoutes({ preset } = {}, data = routeData) {
  return data.routes.map((r) => summary(r, preset));
}

export function routeSlugs(data = routeData) {
  return data.routes.map((r) => r.slug);
}

// One route with its stops and each day's sunset (JST). date: YYYY-MM-DD for day 1 (default today
// in Japan). With no_food_after_sunset in options, meal stops get sunsetConflict / suggestEarly.
// Returns null for an unknown slug.
export function getRoute(slug, { preset, options = [], date } = {}, data = routeData) {
  const r = data.routes.find((x) => x.slug === slug);
  if (!r) return null;
  const day1 = date || todayJst();
  const stops = r.stops.map((s) => {
    const v = s.venueId ? venueById(s.venueId) : null;
    return { ...s, venue: v ? publicVenue(v) : null };
  });
  // Sunset times are always shown; meals are only flagged with the option.
  const sunsetRule = options.includes(SUNSET_OPTION);
  const flagged = flagSunsetMeals(stops, { lat: r.lat, lng: r.lng, date: day1 });
  return {
    ...summary(r, preset), lat: r.lat, lng: r.lng, date: day1, sunsetRule,
    stops: sunsetRule ? flagged.stops : stops,
    sunsets: flagged.sunsets,
  };
}
