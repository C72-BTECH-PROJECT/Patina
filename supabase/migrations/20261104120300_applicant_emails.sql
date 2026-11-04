-- Patina T-0031 (I-0063, I-0028, D1): applicant emails for recruiters.
--
-- `profiles` has no email column, so `/api/recruiter/applicants` showed a blank
-- email for every applicant. Emails live in auth.users, which PostgREST does not
-- expose. This function returns only (id, email), only for the ids it is given.
--
-- It reads auth.users as its owner (security definer) and lives in public, so
-- without the revoke any visitor could read emails at /rest/v1/rpc/applicant_emails:
-- Supabase grants new public functions to anon by default. Only the service role
-- may call it (the assert_signup_role pattern, T-0029).
--
-- The version is set by hand, not by `supabase migration new`: at the time of
-- writing the clock was still before 20261104120200, and a version older than
-- the last applied one would make `db push` ask for --include-all.

create or replace function public.applicant_emails(p_candidate_ids uuid[])
returns table (id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.email::text
  from auth.users u
  where u.id = any(p_candidate_ids);
$$;

revoke execute on function public.applicant_emails(uuid[]) from public, anon, authenticated;
grant execute on function public.applicant_emails(uuid[]) to service_role;
