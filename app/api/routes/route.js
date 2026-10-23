// GET /api/routes?preset= — the sample Shojin Routes, each with fitsDiet (spec 13.9).

import { ok, fail, handleError } from '@/lib/http/respond';
import { RoutesQuerySchema, queryObject } from '@/lib/validation/schemas';
import { checkDiet } from '@/lib/validation/diet';
import { serverRulebook } from '@/lib/config/rulebook';
import { listRoutes } from '@/lib/routes/routeService';

export const runtime = 'nodejs';

export async function GET(req) {
  try {
    const q = RoutesQuerySchema.safeParse(queryObject(new URL(req.url).searchParams));
    if (!q.success) return fail('INVALID_REQUEST', { detail: 'Expected ?preset= (optional).' });
    checkDiet(q.data, serverRulebook());
    return ok({ routes: listRoutes(q.data) });
  } catch (err) {
    return handleError(err);
  }
}
