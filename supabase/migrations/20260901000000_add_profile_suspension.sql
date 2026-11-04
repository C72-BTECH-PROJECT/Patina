-- Administrators can revoke portal access without deleting a user or their data.
alter table public.profiles
  add column if not exists is_suspended boolean not null default false,
  add column if not exists suspended_at timestamptz;

create index if not exists profiles_role_suspension_idx
  on public.profiles (role, is_suspended);
