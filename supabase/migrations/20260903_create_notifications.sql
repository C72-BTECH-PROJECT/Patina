-- Patina: notifications for candidate/recruiter updates
-- Apply in the Supabase SQL Editor after the jobs/applications migration.

create extension if not exists pgcrypto;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  message text not null,
  read boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index notifications_user_id_idx on public.notifications(user_id);
create index notifications_read_idx on public.notifications(read);
create index notifications_created_at_idx on public.notifications(created_at desc);

alter table public.notifications enable row level security;

create policy "Users can read their own notifications"
  on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Recruiters can insert notifications for candidates"
  on public.notifications for insert to authenticated
  with check (
    exists (
      select 1 from public.applications
      where applications.candidate_id = notifications.user_id
        and applications.job_id in (
          select id from public.jobs where recruiter_id = (select auth.uid())
        )
    )
  );
