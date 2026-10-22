// Reading a user's own scan (user client: row security decides ownership), and the server-only
// tables around it: explanation cache, LLM call log, feedback (service role).

import 'server-only';
import { supabaseAdmin } from './supabaseAdmin.js';

const SCAN_COLUMNS = 'id, verdict, reasons, items, details, unknown_terms, low_confidence_terms, completeness, diet_preset, options, language';

// null when the scan does not exist OR belongs to someone else (row security hides it).
export async function getOwnScan(client, scanId) {
  const { data, error } = await client.from('scans').select(SCAN_COLUMNS).eq('id', scanId).maybeSingle();
  if (error) throw error;
  return data;
}

// { text, model } or null. `model` also records the prompt version that wrote the text.
export async function getExplanation(scanId, lang) {
  const { data, error } = await supabaseAdmin().from('scan_explanations').select('text, model').eq('scan_id', scanId).eq('language', lang).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function saveExplanation(scanId, lang, text, model) {
  const { error } = await supabaseAdmin().from('scan_explanations')
    .upsert({ scan_id: scanId, language: lang, text, model }, { onConflict: 'scan_id,language' });
  if (error) throw error;
}

// LLM calls by this user in the last minute and day.
export async function countLlmCalls(userId) {
  const since = (ms) => new Date(Date.now() - ms).toISOString();
  const count = async (ms) => {
    const { count: n, error } = await supabaseAdmin().from('llm_calls')
      .select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since(ms));
    if (error) throw error;
    return n ?? 0;
  };
  const [minute, day] = await Promise.all([count(60_000), count(86_400_000)]);
  return { minute, day };
}

export async function recordLlmCall(userId) {
  const { error } = await supabaseAdmin().from('llm_calls').insert({ user_id: userId });
  if (error) throw error;
}

// One row per scan, user and kind; sending the same kind again updates the note.
export async function saveFeedback({ scanId, userId, kind, note, priority }) {
  const { error } = await supabaseAdmin().from('scan_feedback')
    .upsert({ scan_id: scanId, user_id: userId, kind, note: note ?? null, priority }, { onConflict: 'scan_id,user_id,kind' });
  if (error) throw error;
}
