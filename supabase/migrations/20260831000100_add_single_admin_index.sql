-- Patina: one platform administrator (split out of 20260831000000_add_single_admin_role.sql, T-0030).
-- Its own file, so it runs after the transaction that added the 'admin' enum value
-- has committed (SQLSTATE 55P04 otherwise). Statement moved verbatim.

-- The first version of Patina has exactly one platform administrator.
create unique index if not exists profiles_single_admin_role
  on public.profiles (role)
  where role = 'admin';
