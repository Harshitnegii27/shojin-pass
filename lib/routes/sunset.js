// Sunset rule for routes (spec 15.2), used only with the no_food_after_sunset option.
// A meal stop conflicts if it starts later than SUNSET_BUFFER_MIN before sunset on its day at the
// route's coordinates. If its venue serves before sunset, an early slot is suggested that starts
// EARLY_SLOT_BEFORE_MIN before sunset, rounded down to the quarter hour. Pure; no network.

import SunCalc from 'suncalc';
import { addDays, formatJst, jstDate } from '../time/jst.js';

export const SUNSET_BUFFER_MIN = 45;
export const EARLY_SLOT_BEFORE_MIN = 75;

// Sunset (a Date) on a date in Japan, at lat/lng.
export function sunsetOn(date, { lat, lng }) {
  return SunCalc.getTimes(jstDate(date, '12:00'), lat, lng).sunset;
}

// stops: [{ day, start: 'HH:MM', isMeal, venue? }]; date: YYYY-MM-DD of day 1.
// Returns { stops, sunsets: [{ day, date, sunset: 'HH:MM' }] }; every meal stop gets sunsetConflict
// (true/false) and, when conflicting, suggestEarly ('HH:MM' or null).
export function flagSunsetMeals(stops, { lat, lng, date }) {
  const days = [...new Set(stops.map((s) => s.day || 1))].sort((a, b) => a - b);
  const byDay = new Map(days.map((day) => {
    const d = addDays(date, day - 1);
    return [day, { date: d, sunset: sunsetOn(d, { lat, lng }) }];
  }));
  const flagged = stops.map((s) => {
    if (!s.isMeal) return s;
    const { date: d, sunset } = byDay.get(s.day || 1);
    const latestStart = new Date(sunset.getTime() - SUNSET_BUFFER_MIN * 60000);
    if (jstDate(d, s.start) <= latestStart) return { ...s, sunsetConflict: false };
    const early = new Date(sunset.getTime() - EARLY_SLOT_BEFORE_MIN * 60000);
    early.setUTCMinutes(Math.floor(early.getUTCMinutes() / 15) * 15, 0, 0);
    return { ...s, sunsetConflict: true, suggestEarly: s.venue?.servesBeforeSunset ? formatJst(early) : null };
  });
  return {
    stops: flagged,
    sunsets: days.map((day) => ({ day, date: byDay.get(day).date, sunset: formatJst(byDay.get(day).sunset) })),
  };
}
