-- Patina: Supabase Auth profile schema
-- Run once in the Supabase Dashboard SQL Editor.
-- Auth credentials (email/password) remain in auth.users. This migration stores
-- application profile data in public.profiles.

create type public.patina_user_role as enum ('candidate', 'recruiter');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  first_name text not null,
  last_name text not null,
  role public.patina_user_role not null,
  phone text,
  github_url text,
  company_name text,
  verification_info text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_username_length check (char_length(username) between 3 and 30),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]+$'),
  constraint profiles_phone_format check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  constraint profiles_github_url check (
    github_url is null
    or github_url ~* '^https?://(www\.)?github\.com/[A-Za-z0-9-]+/?$'
  )
);

-- Usernames are case-insensitively unique, while retaining the original display case.
create unique index profiles_username_lowercase_unique
  on public.profiles (lower(username));

-- A new Supabase Auth user gets a profile automatically. Values originate from
-- signup metadata; authorization always relies on profiles.role, never metadata.
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
    (new.raw_user_meta_data ->> 'role')::public.patina_user_role,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'github_url', ''),
    nullif(new.raw_user_meta_data ->> 'company_name', ''),
    nullif(new.raw_user_meta_data ->> 'verification_info', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;

-- Users can read their own profile if the frontend later accesses Supabase directly.
-- Writes currently stay server-side through the backend service client.
create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);
