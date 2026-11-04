-- Patina: platform administrator role
-- Prerequisite: 20260823_create_profiles.sql
-- This keeps public signup limited to candidate/recruiter in the backend.

alter type public.patina_user_role add value if not exists 'admin';

-- T-0030: the single-admin unique index moved verbatim to
-- 20260831000100_add_single_admin_index.sql. Postgres cannot use an enum value in
-- the transaction that added it (SQLSTATE 55P04), and the CLI runs each file as
-- one transaction.

-- After applying this migration, create a normal candidate account through the
-- application, then promote that specific profile manually in the SQL Editor:
--
-- update public.profiles
-- set role = 'admin'
-- where username = 'your_admin_username';
--
-- The partial unique index prevents a second profile from being made admin.
