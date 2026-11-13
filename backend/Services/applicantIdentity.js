// Applicant names and emails for the recruiter applications view (T-0031, I-0063,
// I-0028; R-13).
//
// Names live in `profiles` (the account profile, never the parsed resume), which has
// no email column. Emails live in `auth.users`, read through public.applicant_emails
// (service role only). One query and one RPC, whatever the number of applicants. The
// client is passed in so this is testable without a database
// (tests/backend/applicant-identity.test.mjs).
//
// Callers pass only candidates who applied to one of the calling recruiter's jobs:
// contact data reaches a recruiter only through such an application (D§10).

/**
 * @param {object} client service-role Supabase client
 * @param {string[]} candidateIds may hold duplicates
 * @returns {Promise<Map<string, { name: string | null, email: string | null }>>} one
 *   entry per id. `name` is null when the profile has no name (never a placeholder);
 *   `email` is null when the account has none.
 * @throws when the profiles query or the email RPC fails (R-13, B8): a lookup error
 *   is an error, never a blank email or a list of nameless applicants.
 */
export async function loadApplicantIdentities(client, candidateIds) {
  const ids = [...new Set(candidateIds)];
  if (ids.length === 0) return new Map();

  const { data: profileRows, error: profilesError } = await client
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', ids);
  if (profilesError) {
    throw Object.assign(new Error('Failed to load applicant profiles'), { code: 'database_error', cause: profilesError });
  }

  // Checked on purpose: the ignored error on a missing column is how I-0063 happened.
  const { data: emailRows, error: emailsError } = await client.rpc('applicant_emails', { p_candidate_ids: ids });
  if (emailsError) {
    throw Object.assign(new Error('Failed to load applicant emails'), { code: 'database_error', cause: emailsError });
  }

  const profilesById = new Map((profileRows || []).map((p) => [p.id, p]));
  const emailsById = new Map((emailRows || []).map((row) => [row.id, row.email]));

  return new Map(ids.map((id) => {
    const profile = profilesById.get(id);
    const name = [profile?.first_name, profile?.last_name]
      .filter((s) => typeof s === 'string' && s.trim())
      .map((s) => s.trim())
      .join(' ');
    const email = emailsById.get(id);
    return [id, { name: name || null, email: typeof email === 'string' && email ? email : null }];
  }));
}
