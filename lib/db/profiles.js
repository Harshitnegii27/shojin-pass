// profiles table, always through the USER's client: row security and the column grants in
// 001_init.sql decide what may be read or written, not this file.

import 'server-only';

const COLUMNS = 'diet_preset, options, language';

export function toApi(row) {
  return row ? { preset: row.diet_preset, options: row.options, lang: row.language } : null;
}

export async function getProfile(client, userId) {
  const { data, error } = await client.from('profiles').select(COLUMNS).eq('id', userId).maybeSingle();
  if (error) throw error;
  return toApi(data);
}

// patch: { preset?, options?, lang? } (already validated). Inserts the row if the sign-up trigger missed it.
// Update then insert, not upsert: an upsert would also try to update `id`, which users may not.
export async function saveProfile(client, userId, patch) {
  const row = {};
  if (patch.preset !== undefined) row.diet_preset = patch.preset;
  if (patch.options !== undefined) row.options = patch.options;
  if (patch.lang !== undefined) row.language = patch.lang;
  if (Object.keys(row).length) {
    const { data, error } = await client.from('profiles').update(row).eq('id', userId).select(COLUMNS).maybeSingle();
    if (error) throw error;
    if (data) return toApi(data);
  } else {
    const current = await getProfile(client, userId);
    if (current) return current;
  }
  const { data, error } = await client.from('profiles').insert({ id: userId, ...row }).select(COLUMNS).single();
  if (error) throw error;
  return toApi(data);
}
