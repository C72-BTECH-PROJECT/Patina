// T-0029 (I-0058, I-0017): a signup only succeeds when the on_auth_user_created
// trigger actually created the profiles row. The trigger is the only writer of
// that row; signup() no longer inserts it (the duplicate insert logged a
// profiles_pkey error on every signup).
//
// The service-role client is passed in so this is testable without a database
// (tests/backend/signup-profile.test.mjs).

/**
 * @param {object} adminClient service-role Supabase client
 * @param {{ id: string, identities?: unknown[] }} user the user returned by auth.signUp
 * @returns {Promise<{ ok: boolean, existingAccount?: boolean }>}
 */
export async function ensureProfileOrRollback(adminClient, user) {
  // GoTrue answers a signup for an already-registered email with an obfuscated
  // user that has no identities (so the endpoint does not reveal which emails
  // exist). It is not a new account: nothing was created, nothing may be deleted.
  if (Array.isArray(user?.identities) && user.identities.length === 0) {
    return { ok: true, existingAccount: true };
  }

  const { data, error } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!error && data) return { ok: true };

  console.error(
    `[signup] no profiles row after signup (${error ? 'lookup failed' : 'row missing'}); deleting auth user ${user.id}`
  );
  try {
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) console.error(`[signup] rollback failed for auth user ${user.id}`);
  } catch {
    console.error(`[signup] rollback threw for auth user ${user.id}`);
  }
  return { ok: false };
}
