// Reads and validates every setting (spec section 7). The only file that reads process.env.
// Tunables always have defaults. Keys and secrets are optional here so that endpoints which
// do not need them (health, text scans) run without them; code that needs one calls
// requireEnv() first. On a Vercel production deploy every required name is checked at startup.

import 'server-only';
import { z } from 'zod';

// An empty value (NAME= copied from .env.example) counts as not set.
const unset = (v) => (v === '' ? undefined : v);
const opt = (schema) => z.preprocess(unset, schema.optional());
const bool = (d) => z.preprocess(unset, z.enum(['true', 'false']).default(d).transform((v) => v === 'true'));
const num = (d) => z.preprocess(unset, z.coerce.number().default(d));

const Schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: opt(z.string().url()),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: opt(z.string().min(20)),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: opt(z.string().min(10)),
  SUPABASE_SERVICE_ROLE_KEY: opt(z.string().min(20)),
  SUPABASE_TIMEOUT_MS: num(1500),
  AZURE_VISION_ENDPOINT: opt(z.string().url()),
  AZURE_VISION_KEY: opt(z.string().min(10)),
  LLM_API_KEY: opt(z.string().min(1)), // Google AI Studio key; new keys start "AQ.", so no format check
  LLM_MODEL: z.preprocess(unset, z.string().min(3).default('gemini-3.5-flash-lite')),
  LLM_THINKING_LEVEL: z.preprocess(unset, z.enum(['none', 'minimal', 'low', 'medium', 'high']).default('minimal')), // 'none' omits the setting
  LLM_ENABLED: bool('true'),
  LLM_TIMEOUT_MS: num(5000),
  LLM_USER_PER_MIN: num(5),   // explanations generated per user (cache hits are free)
  LLM_USER_PER_DAY: num(50),
  OCR_TIMEOUT_MS: num(4000),
  OCR_MIN_PAGE_CONFIDENCE: num(0.8),
  OCR_MIN_CHAR_CONFIDENCE: num(0.7),
  SCAN_RATE_LIMIT_PER_MIN: num(20),
  SCAN_RATE_LIMIT_PER_DAY: num(300),
  IP_RATE_LIMIT_PER_MIN: num(60),
  SCAN_RETENTION_DAYS: num(90),
  CRON_SECRET: opt(z.string().min(32)),
  HEALTH_SECRET: opt(z.string().min(32)),
  RULEBOOK_ALLOW_UNREVIEWED: bool('false'), // development only (spec 8.5)
  VERCEL_ENV: opt(z.string()), // set by Vercel: production | preview | development
});

// Every name a full deployment needs. LLM_API_KEY / LLM_MODEL are not here on purpose: without them
// the explanation falls back to the template "why" (spec 11.5), and scans never need them.
export const REQUIRED_FOR_DEPLOY = [
  'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY', 'AZURE_VISION_ENDPOINT', 'AZURE_VISION_KEY',
  'CRON_SECRET', 'HEALTH_SECRET',
];

const parsed = Schema.safeParse(process.env);
if (!parsed.success) {
  const names = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))].join(', ');
  throw new Error('Missing or invalid environment variables: ' + names);
}
export const env = parsed.data;

// Throws, listing every missing name, unless all are set. Returns env for convenience.
export function requireEnv(...names) {
  const missing = names.filter((n) => env[n] === undefined);
  if (missing.length) throw new Error('Missing or invalid environment variables: ' + missing.join(', '));
  return env;
}

export const isProduction = env.VERCEL_ENV === 'production';

if (isProduction) {
  requireEnv(...REQUIRED_FOR_DEPLOY);
  if (env.RULEBOOK_ALLOW_UNREVIEWED) {
    throw new Error('RULEBOOK_ALLOW_UNREVIEWED must not be true in production');
  }
}
