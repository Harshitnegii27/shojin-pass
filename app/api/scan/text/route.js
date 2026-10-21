// POST /api/scan/text — typed label text -> verdict (spec 13.5).

import { ok, fail, handleError } from '@/lib/http/respond';
import { TextScanSchema } from '@/lib/validation/schemas';
import { runScan } from '@/lib/scan/scanService';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    // TODO(stage 2): require a Supabase session here — `const user = await getUser();
    // if (!user) return fail('UNAUTHENTICATED');` — and apply the `scan` rate-limit bucket
    // (stage 6). Until then this endpoint is open, so it MUST NOT be deployed before stage 2.

    let body;
    try {
      body = await req.json();
    } catch {
      return fail('INVALID_REQUEST', { detail: 'Body must be JSON.' });
    }
    const parsed = TextScanSchema.safeParse(body);
    if (!parsed.success) return fail('INVALID_REQUEST', { detail: 'Expected { text (1–4000 characters), preset?, lang? }.' });

    const { text, preset, lang } = parsed.data;
    const result = await runScan({ input: { kind: 'text', text }, preset, lang });
    return ok(result, { rulebookVersion: result.rulebookVersion });
  } catch (err) {
    return handleError(err);
  }
}
