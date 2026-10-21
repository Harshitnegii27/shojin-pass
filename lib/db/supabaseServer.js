// Supabase client acting as the signed-in user (session from cookies). Row security applies.

import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { requireEnv } from '../config/env.js';
import { timedFetch } from '../http/timeout.js';

export async function supabaseServer() {
  const env = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const cookieStore = await cookies();
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      // Route handlers may set cookies, so a refreshed session is written back to the browser.
      setAll: (list) => { for (const { name, value, options } of list) cookieStore.set(name, value, options); },
    },
    global: { fetch: timedFetch(env.SUPABASE_TIMEOUT_MS) },
  });
}
