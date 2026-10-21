// /dev — a bare test console for the backend (login, profile, text scan). Not the real app screens.
// Hidden on production deploys. Only public values are passed to the browser.

import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { env, isProduction } from '@/lib/config/env';
import { serverRulebook } from '@/lib/config/rulebook';
import DevConsole from './DevConsole';

export default async function DevPage() {
  await connection(); // read settings at request time, not build time
  if (isProduction) notFound();
  const rb = serverRulebook();
  return (
    <DevConsole
      supabaseUrl={env.NEXT_PUBLIC_SUPABASE_URL ?? null}
      supabaseAnonKey={env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null}
      turnstileSiteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null}
      presets={Object.keys(rb.diets)}
      options={Object.keys(rb.options)}
    />
  );
}
