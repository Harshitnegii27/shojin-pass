// POST /api/chef-card — the Japanese chef card with translations (spec 13.11, 15.1).
// Body: { preset, options?, dishNameJa? } or { members: [{ preset, options? }], dishNameJa? }.
// Fixed phrases only (no LLM). Anyone may call it.

import { ok, fail, handleError } from '@/lib/http/respond';
import { readOptionalJson } from '@/lib/http/readJson';
import { ChefCardSchema } from '@/lib/validation/schemas';
import { checkDiet } from '@/lib/validation/diet';
import { serverRulebook } from '@/lib/config/rulebook';
import { buildChefCard } from '@/lib/chef/cardBuilder';

export const runtime = 'nodejs';

export async function POST(req) {
  try {
    const body = ChefCardSchema.safeParse(await readOptionalJson(req));
    if (!body.success) {
      return fail('INVALID_REQUEST', { detail: 'Expected { preset, options?, dishNameJa? } or { members: [{ preset, options? }], dishNameJa? }; dishNameJa is up to 40 Japanese characters.' });
    }
    const rb = serverRulebook();
    const members = body.data.members || [{ preset: body.data.preset, options: body.data.options }];
    for (const m of members) checkDiet(m, rb);
    return ok(buildChefCard({ members, dishNameJa: body.data.dishNameJa }, rb), { rulebookVersion: rb.version });
  } catch (err) {
    return handleError(err);
  }
}
