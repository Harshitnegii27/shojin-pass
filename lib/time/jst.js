// Japan time (JST, UTC+9, no daylight saving) for routes and the chef card. Pure; no network.

const TZ = 'Asia/Tokyo';

const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const dateTimeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});
const isoDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

// "17:05" (time only), or with { withDate: true } "23 Oct 2026, 17:05 JST".
export function formatJst(date, { withDate = false } = {}) {
  const d = date instanceof Date ? date : new Date(date);
  return withDate ? `${dateTimeFmt.format(d)} JST` : timeFmt.format(d);
}

// Today's date in Japan as YYYY-MM-DD.
export function todayJst(now = new Date()) {
  return isoDateFmt.format(now);
}

// YYYY-MM-DD plus n days (calendar arithmetic, no time zone involved).
export function addDays(date, n) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// A wall-clock time in Japan on a date: jstDate('2026-10-28', '19:00').
export function jstDate(date, hhmm) {
  return new Date(`${date}T${hhmm.slice(0, 5)}:00+09:00`);
}
