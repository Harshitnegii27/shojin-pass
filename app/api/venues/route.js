// GET /api/venues?lat=&lng=&radius=&preset= — sample venues near a point, nearest first (spec 13.10).
// Every venue is a sample, not a real certification (each carries sample: true and sampleNote).

import { ok, fail, handleError } from '@/lib/http/respond';
import { VenuesQuerySchema, queryObject } from '@/lib/validation/schemas';
import { checkDiet } from '@/lib/validation/diet';
import { serverRulebook } from '@/lib/config/rulebook';
import { venuesNear } from '@/lib/venues/venueService';

export const runtime = 'nodejs';

export async function GET(req) {
  try {
    const q = VenuesQuerySchema.safeParse(queryObject(new URL(req.url).searchParams));
    if (!q.success) return fail('INVALID_REQUEST', { detail: 'Expected ?lat=&lng= plus radius (100–20000 m) and preset (optional).' });
    checkDiet(q.data, serverRulebook());
    return ok({ venues: venuesNear(q.data) });
  } catch (err) {
    return handleError(err);
  }
}
