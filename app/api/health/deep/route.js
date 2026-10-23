// GET /api/health/deep — needs header "x-health-secret: HEALTH_SECRET" (spec 13.12). Reads a bundled
// label with OCR (expects 原材料), asks the LLM for a fixed reply and queries the database, in parallel.
// Returns { ok, ocr, llm, db, ms } with each 'ok' | 'fail' | 'busy' | 'skipped' (no key set).
// Costs 2-3 Azure calls and 1 Gemini call: run it by hand (e.g. before the pitch), not from the cron.

import { ok, fail, handleError } from '@/lib/http/respond';
import { logError } from '@/lib/http/log';
import { secretMatches } from '@/lib/http/secret';
import { env } from '@/lib/config/env';
import { checkDb, checkOcr, checkLlm } from '@/lib/health/checks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET(req) {
  try {
    if (!env.HEALTH_SECRET) logError('health_deep', 'HEALTH_SECRET is not set');
    if (!secretMatches(req.headers.get('x-health-secret'), env.HEALTH_SECRET)) return fail('UNAUTHENTICATED');

    const [ocr, llm, db] = await Promise.all([checkOcr(), checkLlm(), checkDb()]);
    const all = { ocr, llm, db };
    const data = {
      ok: Object.values(all).every((c) => c.status === 'ok' || c.status === 'skipped'),
      ocr: ocr.status, llm: llm.status, db: db.status,
      detail: Object.fromEntries(Object.entries(all).filter(([, c]) => c.detail).map(([k, c]) => [k, c.detail])),
      ms: { ocr: ocr.ms, llm: llm.ms, db: db.ms },
    };
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}
