-- Patina: platform administrator role
-- Prerequisite: 20260823_create_profiles.sql
-- This keeps public signup limited to candidate/recruiter in the backend.

alter type public.patina_user_role add value if not exists 'admin';

-- The first version of Patina has exactly one platform administrator.
create unique index if not exists profiles_single_admin_role
  on public.profiles (role)
  where role = 'admin';

-- After applying this migration, create a normal candidate account through the
-- application, then promote that specific profile manually in the SQL Editor:
--
-- update public.profiles
-- set role = 'admin'
-- where username = 'your_admin_username';
--
-- The partial unique index prevents a second profile from being made admin.
