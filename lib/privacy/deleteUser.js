// "Delete my data" (spec 13.8, 16.2). No photos are stored, so deleting the auth user is enough:
// profiles, scans and feedback are removed by the cascades in 001_init.sql.

import 'server-only';
import { supabaseAdmin } from '../db/supabaseAdmin.js';

export async function deleteUserData(userId) {
  const { error } = await supabaseAdmin().auth.admin.deleteUser(userId);
  if (error) throw error;
}
