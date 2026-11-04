// Applicant names and emails for the recruiter views (T-0031, I-0063, I-0028).
//
// Names live in `profiles`, which has no email column. Emails live in
// `auth.users`, read through public.applicant_emails (service role only).
// One query and one RPC, whatever the number of applicants. The client is passed
// in so this is testable without a database (tests/backend/applicant-identity.test.mjs).

/**
 * @param {object} client service-role Supabase client
 * @param {string[]} candidateIds may hold duplicates
 * @returns {Promise<Map<string, { name: string, email: string }>>} one entry per id.
 *   An RPC failure is logged and leaves `email` blank, so the page still lists
 *   applicants. A profiles failure throws.
 */
export async function loadApplicantIdentities(client, candidateIds) {
  const ids = [...new Set(candidateIds)];
  if (ids.length === 0) return new Map();

  const { data: profileRows, error: profilesError } = await client
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', ids);
  if (profilesError) throw new Error(`Failed to load applicant profiles: ${profilesError.message}`);

  // Checked on purpose: the ignored error on a missing column is how I-0063 happened.
  const { data: emailRows, error: emailsError } = await client.rpc('applicant_emails', { p_candidate_ids: ids });
  if (emailsError) console.error(`[applicants] applicant_emails failed: ${emailsError.message}`);

  const profilesById = new Map((profileRows || []).map((p) => [p.id, p]));
  const emailsById = new Map((emailRows || []).map((row) => [row.id, row.email]));

  return new Map(ids.map((id) => {
    const profile = profilesById.get(id);
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
    return [id, { name: name || 'Candidate', email: emailsById.get(id) || '' }];
  }));
}
