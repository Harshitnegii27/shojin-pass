// Service-role client (server only). Bypasses row security, so every call MUST name the user explicitly.

import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '../config/env.js';
import { timedFetch } from '../http/timeout.js';

let cached = null;
export function supabaseAdmin() {
  if (!cached) {
    const env = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
    cached = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: timedFetch(env.SUPABASE_TIMEOUT_MS) },
    });
  }
  return cached;
}
