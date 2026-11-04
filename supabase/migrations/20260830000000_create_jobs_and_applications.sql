-- Patina: core hiring workflow
-- Prerequisite: 20260823_create_profiles.sql
-- Apply this migration in the Supabase SQL Editor after the profiles migration.

create extension if not exists pgcrypto;

create type public.job_status as enum ('draft', 'published', 'closed');
create type public.application_status as enum (
  'submitted', 'under_review', 'shortlisted', 'rejected', 'withdrawn'
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 2 and 160),
  description text not null check (char_length(trim(description)) >= 20),
  required_skills text[] not null default '{}',
  preferred_skills text[] not null default '{}',
  experience_level text not null,
  location text not null,
  status public.job_status not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint jobs_required_skills_present check (cardinality(required_skills) > 0)
);

create index jobs_recruiter_id_idx on public.jobs(recruiter_id);
create index jobs_published_created_at_idx on public.jobs(created_at desc)
  where status = 'published';

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute procedure public.set_updated_at();

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  status public.application_status not null default 'submitted',
  submitted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (candidate_id, job_id)
);

create index applications_job_id_idx on public.applications(job_id);
create index applications_candidate_id_idx on public.applications(candidate_id);
create index applications_status_idx on public.applications(status);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute procedure public.set_updated_at();

-- The backend uses the service-role client. These policies secure any later
-- direct browser access through the Supabase client.
alter table public.jobs enable row level security;
alter table public.applications enable row level security;

create policy "Anyone can read published jobs"
  on public.jobs for select to anon, authenticated
  using (status = 'published');

create policy "Recruiters can manage their own jobs"
  on public.jobs for all to authenticated
  using (
    (select auth.uid()) = recruiter_id
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'recruiter'
    )
  )
  with check (
    (select auth.uid()) = recruiter_id
    and exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid())
        and profiles.role = 'recruiter'
    )
  );

create policy "Candidates can read their own applications"
  on public.applications for select to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Candidates can create their own applications"
  on public.applications for insert to authenticated
  with check (
    (select auth.uid()) = candidate_id
    and exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id
        and jobs.status = 'published'
    )
  );

create policy "Recruiters can read applications for their jobs"
  on public.applications for select to authenticated
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id
        and jobs.recruiter_id = (select auth.uid())
    )
  );

create policy "Recruiters can update applications for their jobs"
  on public.applications for update to authenticated
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id
        and jobs.recruiter_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id
        and jobs.recruiter_id = (select auth.uid())
    )
  );
