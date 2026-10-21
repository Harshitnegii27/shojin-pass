// The signed-in user, or null. Never throws: a missing session, missing keys or a Supabase
// outage all return null (and the last two are logged), so scans keep working without Supabase.

import 'server-only';
import { env } from '../config/env.js';
import { supabaseServer } from '../db/supabaseServer.js';
import { logError } from '../http/log.js';
import { withTimeout } from '../http/timeout.js';

// Returns { id, isAnonymous, client } where client is the user's own Supabase client.
// deps.client / deps.timeoutMs are for tests.
export async function getUser(deps = {}) {
  try {
    const client = deps.client || await supabaseServer();
    const { data, error } = await withTimeout(client.auth.getClaims(), deps.timeoutMs ?? env.SUPABASE_TIMEOUT_MS, 'get_user');
    if (error) {
      if (error.name !== 'AuthSessionMissingError') logError('get_user', error);
      return null;
    }
    const claims = data?.claims;
    if (!claims?.sub || claims.role !== 'authenticated') return null;
    return { id: claims.sub, isAnonymous: Boolean(claims.is_anonymous), client };
  } catch (err) {
    logError('get_user', err);
    return null;
  }
}
