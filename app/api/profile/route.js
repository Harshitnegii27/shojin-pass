// GET / PUT / DELETE /api/profile (spec 13.8). Session required.
// The app keeps the diet in localStorage too; a failure here never blocks scanning.

import { getUser } from '@/lib/auth/getUser';
import { serverRulebook } from '@/lib/config/rulebook';
import { getProfile, saveProfile } from '@/lib/db/profiles';
import { deleteUserData } from '@/lib/privacy/deleteUser';
import { ok, fail, handleError } from '@/lib/http/respond';
import { logError } from '@/lib/http/log';
import { checkDiet } from '@/lib/validation/diet';
import { ProfilePutSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const user = await getUser();
    if (!user) return fail('UNAUTHENTICATED');
    const profile = await getProfile(user.client, user.id);
    if (!profile) return fail('NOT_FOUND');
    return ok(profile);
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req) {
  try {
    const user = await getUser();
    if (!user) return fail('UNAUTHENTICATED');
    let body;
    try {
      body = await req.json();
    } catch {
      return fail('INVALID_REQUEST', { detail: 'Body must be JSON.' });
    }
    const parsed = ProfilePutSchema.safeParse(body);
    if (!parsed.success) return fail('INVALID_REQUEST', { detail: 'Expected { preset?, options?, lang? }.' });
    checkDiet(parsed.data, serverRulebook());
    const saved = await saveProfile(user.client, user.id, { ...parsed.data, options: parsed.data.options && [...new Set(parsed.data.options)].sort() });
    return ok(saved);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE() {
  try {
    const user = await getUser();
    if (!user) return fail('UNAUTHENTICATED');
    await deleteUserData(user.id);
    // The session belongs to a deleted user now; clear its cookies. Failure here is harmless.
    try {
      await user.client.auth.signOut({ scope: 'local' });
    } catch (err) {
      logError('sign_out_after_delete', err);
    }
    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
