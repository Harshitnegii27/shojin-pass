// Venues near a point (spec 15.3), from data/venues.json. Hackathon version: haversine distance in
// JavaScript over a small list. Every venue is a SAMPLE (no real certification). Pure; no network.

import venueData from '../../data/venues.json' with { type: 'json' };

export const SAMPLE_NOTE = 'Sample — not a real certification';
export const RADIUS = { min: 100, max: 20000, default: 2000 };

const EARTH_M = 6371000;

// Great-circle distance in metres.
export function haversineM(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

export function allVenues(data = venueData) {
  return data.venues;
}

export function venueById(id, data = venueData) {
  return data.venues.find((v) => v.id === id) || null;
}

// What the app sees for one venue: spec 13.10 fields plus the sample marking and map position.
export function publicVenue(v, distanceM) {
  return {
    id: v.id, nameEn: v.nameEn, nameJa: v.nameJa, type: v.type, city: v.city, area: v.area,
    ...(distanceM == null ? {} : { distanceM: Math.round(distanceM) }),
    certifiedAt: v.certifiedAt ?? null, servesBeforeSunset: Boolean(v.servesBeforeSunset),
    supports: v.supports, priceLevel: v.priceLevel, note: v.note, map: v.map,
    sample: v.sample !== false, sampleNote: v.sample !== false ? SAMPLE_NOTE : null,
  };
}

// Venues within radius metres of { lat, lng }, nearest first. With preset, only venues whose
// supports include it (spec 13.10); without, all of them.
export function venuesNear({ lat, lng, radius = RADIUS.default, preset }, data = venueData) {
  return data.venues
    .filter((v) => !preset || v.supports.includes(preset))
    .map((v) => ({ v, d: haversineM({ lat, lng }, v) }))
    .filter((x) => x.d <= radius)
    .sort((a, b) => a.d - b.d)
    .map((x) => publicVenue(x.v, x.d));
}
