-- Patina T-0030: re-create every public function so its stored body is LF.
--
-- The four functions were applied by hand through the SQL editor, which kept CRLF
-- line endings inside the function bodies (owner check 2026-11-04: live_has_cr =
-- true for all four, and md5 without CR equals the local body). `db diff --linked`
-- reports such a function as changed although only line endings differ.
-- Each statement below is copied byte for byte from the latest migration that
-- defines the function (named above it). CREATE OR REPLACE keeps the function's
-- owner, grants and the triggers that use it; only the body text changes.
-- Behaviour is unchanged.

-- from 20260823000000_create_profiles.sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- from 20261103120000_restrict_signup_role.sql
create or replace function public.assert_signup_role(p_role text)
returns public.patina_user_role
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_role is null or p_role not in ('candidate', 'recruiter') then
    raise exception 'invalid signup role: %', coalesce(p_role, '<null>')
      using errcode = '22023';
  end if;
  return p_role::public.patina_user_role;
end;
$$;

-- from 20261103120000_restrict_signup_role.sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    username,
    first_name,
    last_name,
    role,
    phone,
    github_url,
    company_name,
    verification_info
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    public.assert_signup_role(new.raw_user_meta_data ->> 'role'),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'github_url', ''),
    nullif(new.raw_user_meta_data ->> 'company_name', ''),
    nullif(new.raw_user_meta_data ->> 'verification_info', '')
  );
  return new;
end;
$$;

-- from 20261103120200_assessment_grading_claim.sql
create or replace function public.claim_assessment_for_grading(
  p_assessment_id uuid,
  p_candidate_id uuid,
  p_stale_after interval
)
returns table (id uuid, job_id uuid, questions jsonb, grading_started_at timestamptz)
language sql
volatile
set search_path = ''
as $$
  update public.assessments a
     set status = 'grading', grading_started_at = now()
   where a.id = p_assessment_id
     and a.candidate_id = p_candidate_id
     and (a.status = 'generated' or (a.status = 'grading' and a.grading_started_at < now() - p_stale_after))
  returning a.id, a.job_id, a.questions, a.grading_started_at;
$$;
