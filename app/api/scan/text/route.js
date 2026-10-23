// POST /api/scan/text — typed label text -> verdict (spec 13.5).
// A session is optional: without one (or if Supabase is down) the verdict is still returned,
// just not saved (scanId null). Shares the `scan` rate limit with photos (429).

import { getUser } from '@/lib/auth/getUser';
import { ok, fail, handleError } from '@/lib/http/respond';
import { limitRequest } from '@/lib/http/limitRequest';
import { TextScanSchema } from '@/lib/validation/schemas';
import { runScan } from '@/lib/scan/scanService';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const user = await getUser();
    const limited = await limitRequest('scan', req, user);
    if (limited) return limited;

    let body;
    try {
      body = await req.json();
    } catch {
      return fail('INVALID_REQUEST', { detail: 'Body must be JSON.' });
    }
    const parsed = TextScanSchema.safeParse(body);
    if (!parsed.success) return fail('INVALID_REQUEST', { detail: 'Expected { text (1–4000 characters), preset?, options?, lang? }.' });

    const { text, ...diet } = parsed.data;
    const result = await runScan({ input: { kind: 'text', text }, user, ...diet });
    return ok(result, { rulebookVersion: result.rulebookVersion });
  } catch (err) {
    return handleError(err);
  }
}
