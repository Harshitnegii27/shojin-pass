// Partner insights (spec B10, 13.3): verdict-colour counts and the top red ingredients from the scans
// table. Totals only: user_id is never selected, and any count under MIN_COUNT is hidden (null, or
// left out of the list) so small groups cannot point at a person.

import 'server-only';
import { supabaseAdmin } from '../db/supabaseAdmin.js';
import { env } from '../config/env.js';
import { withTimeout } from '../http/timeout.js';

export const MIN_COUNT = 5;
export const WINDOW_DAYS = 90;
export const MAX_ROWS = 10000;
export const TOP_N = 10;
export const CACHE_MS = 60000;
export const COLOURS = ['green', 'amber', 'red', 'retake'];
// The only columns read. Never user_id.
export const COLUMNS = 'verdict, items';

const hide = (n) => (n >= MIN_COUNT ? n : null);

// rows: [{ verdict, items: [{ ingredientId, colour }] }]. names(id) -> { en, hi?, gu? }.
// Pure, so the hiding rule is tested without a database.
export function computeInsights(rows, { names = (id) => ({ en: id }), since = null, now = new Date() } = {}) {
  const colours = Object.fromEntries(COLOURS.map((c) => [c, 0]));
  const red = new Map(); // ingredientId -> number of scans with it red
  for (const r of rows) {
    if (r.verdict in colours) colours[r.verdict]++;
    const ids = new Set((Array.isArray(r.items) ? r.items : []).filter((i) => i?.colour === 'red' && i.ingredientId).map((i) => i.ingredientId));
    for (const id of ids) red.set(id, (red.get(id) || 0) + 1);
  }
  const topRed = [...red.entries()]
    .filter(([, n]) => n >= MIN_COUNT)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_N)
    .map(([ingredientId, scans]) => ({ ingredientId, name: names(ingredientId), scans }));
  return {
    windowDays: WINDOW_DAYS,
    since,
    generatedAt: now.toISOString(),
    minCount: MIN_COUNT,
    totalScans: hide(rows.length),
    colours: Object.fromEntries(COLOURS.map((c) => [c, hide(colours[c])])),
    topRed,
    capped: rows.length >= MAX_ROWS,
  };
}

// Reads the last WINDOW_DAYS of scans (newest first, at most MAX_ROWS) with the service role.
// Throws on any database problem; the route turns that into SERVICE_UNAVAILABLE.
export async function fetchScanRows({ now = new Date(), client = supabaseAdmin(), timeoutMs = env.SUPABASE_TIMEOUT_MS } = {}) {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86400000).toISOString();
  const query = client.from('scans').select(COLUMNS).gte('created_at', since).order('created_at', { ascending: false }).limit(MAX_ROWS);
  const { data, error } = await withTimeout(query, timeoutMs, 'insights');
  if (error) throw error;
  return { rows: data || [], since };
}

let cache = null; // { at, value }

// Cached for CACHE_MS. deps: { fetchRows, names, now } for tests.
export async function getInsights(deps = {}) {
  const now = deps.now || new Date();
  if (!deps.fetchRows && cache && now.getTime() - cache.at < CACHE_MS) return cache.value;
  const { rows, since } = await (deps.fetchRows || fetchScanRows)({ now });
  const value = computeInsights(rows, { names: deps.names, since, now });
  if (!deps.fetchRows) cache = { at: now.getTime(), value };
  return value;
}
