// POST /api/scan/{id}/feedback — { kind: "wrong_verdict" | "unclear" | "unreadable" | "helpful", note? }
// (spec 13.7). Session required; your own scans only (someone else's -> 404). One row per scan and
// kind: sending the same kind again replaces the note. wrong_verdict on a green scan is priority.

import { getUser } from '@/lib/auth/getUser';
import { ok, fail, handleError } from '@/lib/http/respond';
import { readOptionalJson } from '@/lib/http/readJson';
import { FeedbackSchema, ScanIdSchema } from '@/lib/validation/schemas';
import { recordFeedback } from '@/lib/scan/scanActions';

export const runtime = 'nodejs';

export async function POST(req, { params }) {
  try {
    const user = await getUser();
    if (!user) return fail('UNAUTHENTICATED');
    const { id } = await params;
    if (!ScanIdSchema.safeParse(id).success) return fail('NOT_FOUND');
    const body = FeedbackSchema.safeParse(await readOptionalJson(req));
    if (!body.success) return fail('INVALID_REQUEST', { detail: 'Expected { kind: wrong_verdict | unclear | unreadable | helpful, note? (max 500) }.' });

    return ok(await recordFeedback({ user, scanId: id, ...body.data }));
  } catch (err) {
    return handleError(err);
  }
}
