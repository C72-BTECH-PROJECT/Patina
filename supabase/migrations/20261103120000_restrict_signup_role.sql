-- Patina T-0029 (I-0055): signup may set only 'candidate' or 'recruiter'.
--
-- handle_new_user() (20260823_create_profiles.sql) cast the role from signup
-- metadata straight into profiles.role. 'admin' joined the enum in
-- 20260831_add_single_admin_role.sql, so a direct GoTrue signup with the public
-- anon key and data.role = 'admin' created an admin profile whenever none
-- existed. From here on the role goes through public.assert_signup_role(),
-- which raises errcode 22023 "invalid signup role" for anything else; GoTrue
-- then rolls back the auth.users insert, so no user and no profile exist.
--
-- Admin promotion stays the manual UPDATE documented in 20260831 (an update,
-- which this insert trigger never sees).
--
-- Apply once (SQL editor or `supabase db push`). Re-running is safe: both
-- statements are CREATE OR REPLACE, and the grants are idempotent.

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

-- The function lives in public, so PostgREST would expose it at
-- /rest/v1/rpc/assert_signup_role to anon and authenticated by default.
-- Only the service role may call it (the live test does); the trigger below
-- calls it as its owner (security definer), so the trigger is unaffected.
revoke execute on function public.assert_signup_role(text) from public, anon, authenticated;
grant execute on function public.assert_signup_role(text) to service_role;

-- Same signature, security definer and search_path as 20260823; only the role
-- expression changes. The on_auth_user_created trigger keeps pointing at it.
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
