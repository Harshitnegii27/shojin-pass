// POST /api/scan/{id}/explain — the LLM "why" for one of your own scans (spec 11.5, 13.6).
// Body optional: { lang }. Session required. Someone else's scan -> 404, like a missing one.
// LLM problems (off, no key, slow, 429, rejected answer) return the template "why" with 200.

import { getUser } from '@/lib/auth/getUser';
import { ok, fail, handleError } from '@/lib/http/respond';
import { readOptionalJson } from '@/lib/http/readJson';
import { ExplainBodySchema, ScanIdSchema } from '@/lib/validation/schemas';
import { explainOwnScan } from '@/lib/scan/scanActions';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(req, { params }) {
  try {
    const user = await getUser();
    if (!user) return fail('UNAUTHENTICATED');
    const { id } = await params;
    if (!ScanIdSchema.safeParse(id).success) return fail('NOT_FOUND');
    const body = ExplainBodySchema.safeParse(await readOptionalJson(req));
    if (!body.success) return fail('INVALID_REQUEST', { detail: 'Expected { lang?: "en" | "hi" | "gu" }.' });

    return ok(await explainOwnScan({ user, scanId: id, lang: body.data.lang }));
  } catch (err) {
    return handleError(err);
  }
}
