// GET /api/routes/{slug}?preset=&date=YYYY-MM-DD&options=no_food_after_sunset — one route with its
// stops, each day's sunset (JST) and, with no_food_after_sunset, the sunset rule (spec 13.9, 15.2).

import { ok, fail, handleError } from '@/lib/http/respond';
import { RouteQuerySchema, SlugSchema, queryObject } from '@/lib/validation/schemas';
import { checkDiet } from '@/lib/validation/diet';
import { serverRulebook } from '@/lib/config/rulebook';
import { getRoute } from '@/lib/routes/routeService';

export const runtime = 'nodejs';

export async function GET(req, { params }) {
  try {
    const { slug } = await params;
    if (!SlugSchema.safeParse(slug).success) return fail('NOT_FOUND');
    const q = RouteQuerySchema.safeParse(queryObject(new URL(req.url).searchParams));
    if (!q.success) return fail('INVALID_REQUEST', { detail: 'Expected ?preset=&options=&date=YYYY-MM-DD (all optional).' });
    checkDiet(q.data, serverRulebook());
    const route = getRoute(slug, q.data);
    return route ? ok(route) : fail('NOT_FOUND');
  } catch (err) {
    return handleError(err);
  }
}
