// GET /api/insights — verdict-colour counts and the top 10 red ingredients for partners (spec B10).
// Totals only: no user ids, and every count under 5 hidden. Supabase down -> 503, never made-up numbers.
// Limited per IP (429); there is no user here.

import { ok, fail, handleError } from '@/lib/http/respond';
import { logError } from '@/lib/http/log';
import { limitRequest } from '@/lib/http/limitRequest';
import { serverRulebook } from '@/lib/config/rulebook';
import { getInsights } from '@/lib/insights/insights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const limited = await limitRequest('insights', req, null);
    if (limited) return limited;
    const rb = serverRulebook();
    const names = (id) => rb.entries.get(id)?.meaning || { en: id };
    let data;
    try {
      data = await getInsights({ names });
    } catch (err) {
      logError('insights', err);
      return fail('SERVICE_UNAVAILABLE');
    }
    return ok(data);
  } catch (err) {
    return handleError(err);
  }
}
