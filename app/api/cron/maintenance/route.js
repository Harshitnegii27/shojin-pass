// GET /api/cron/maintenance — the daily Vercel Cron job (spec 13.12, B11; schedule in vercel.json).
// Needs "Authorization: Bearer CRON_SECRET" (Vercel Cron sends it when CRON_SECRET is set).
// A tiny Supabase query keeps the free project awake, then apply_retention runs. No OCR or LLM calls.

import { ok, fail, handleError } from '@/lib/http/respond';
import { logError, logInfo } from '@/lib/http/log';
import { bearerToken, secretMatches } from '@/lib/http/secret';
import { env } from '@/lib/config/env';
import { checkDb, runRetention } from '@/lib/health/checks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET(req) {
  try {
    if (!env.CRON_SECRET) logError('cron', 'CRON_SECRET is not set');
    if (!secretMatches(bearerToken(req), env.CRON_SECRET)) return fail('UNAUTHENTICATED');

    const db = await checkDb();
    const retention = await runRetention();
    const data = { ok: db.status === 'ok' && retention.status === 'ok', db: db.status, retention: retention.status, ms: { db: db.ms, retention: retention.ms } };
    const line = { db: db.status, dbDetail: db.detail, retention: retention.status, retentionDetail: retention.detail };
    if (data.ok) logInfo('cron', line);
    else logError('cron', 'maintenance failed', line);
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}
