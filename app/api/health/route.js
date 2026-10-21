// GET /api/health — liveness and rulebook version (spec 13.3). Loading the rulebook here
// also proves it builds on this instance.

import { ok, handleError } from '@/lib/http/respond';
import { serverRulebook } from '@/lib/config/rulebook';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { version } = serverRulebook();
    return ok({ ok: true, rulebookVersion: version }, { rulebookVersion: version });
  } catch (err) {
    return handleError(err);
  }
}
