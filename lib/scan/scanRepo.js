// Saves scan rows with the service-role client. Users can read their own scans but never write
// them, so a stored verdict always comes from the engine (see 001_init.sql).

import 'server-only';
import { supabaseAdmin } from '../db/supabaseAdmin.js';

// Only what is needed to review a verdict: matched ingredients, not the label text or a photo.
export function scanRow({ userId, source, lang, result }) {
  return {
    user_id: userId,
    source,
    diet_preset: result.profile.preset,
    options: result.profile.options,
    language: lang,
    verdict: result.verdict,
    reasons: result.reasons,
    items: result.items.map((i) => ({
      original: i.original, ingredientId: i.ingredientId, tags: i.tags,
      colour: i.colour, reason: i.reason, lowConfidence: i.lowConfidence,
    })),
    // Flagged words found outside the main items, so the template "why" can be rebuilt later
    // (migration 002). Matched spellings and rulebook meanings only, never sentences from the label.
    details: {
      hidden: (result.hidden || []).map((h) => ({ text: h.text, original: h.original, ingredientId: h.ingredientId })),
      outside: (result.outside || []).map((o) => ({ original: o.original, ingredientId: o.ingredientId })),
      notes: (result.notes || []).map((n) => ({ code: n.code, mentions: n.mentions || [] })),
    },
    unknown_terms: result.unknown.map((u) => u.original),
    low_confidence_terms: result.lowConfidence.map((l) => l.text),
    completeness: result.completeness,
    ocr_confidence: Number.isFinite(result.ocr?.pageConfidence) ? Math.round(result.ocr.pageConfidence * 1000) / 1000 : null,
    rulebook_version: result.rulebookVersion,
    latency_ms: result.latencyMs,
  };
}

// Returns the new scan id. Throws on any failure; the caller decides what that means.
export async function saveScan(row) {
  const { data, error } = await supabaseAdmin().from('scans').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}
