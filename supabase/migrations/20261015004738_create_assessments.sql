-- Patina: Assessment entity (CHECKLIST 3.7 / 5.3, T-0017)
-- Prerequisite: 20260830_create_jobs_and_applications.sql
-- Apply in the Supabase SQL Editor after the jobs/applications migration.
--
-- One row per generated assessment attempt. The backend uses the
-- service-role client; RLS secures any later direct browser access.
-- `answer_key` is server-side only and is never selected into a browser
-- response (the backend strips it before every candidate/recruiter reply).

create table public.assessments (
  -- assessment_id minted by the assessment service (uuid, passed through).
  id uuid primary key,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  -- Candidate-facing question set (options shuffled, no answer key).
  questions jsonb not null,
  -- Server-side answer key: correct_option / explanation, ideal_answer /
  -- key_points. Never leaves the backend.
  answer_key jsonb not null,
  status text not null default 'generated'
    check (status in ('generated', 'completed')),
  -- Candidate responses, written once at submit time:
  -- [{ question_id, response }]
  answers jsonb,
  -- 0-100 score against the answer key, set at submit time.
  score numeric(5,2),
  -- Per-question evaluation: correct/incorrect, points, feedback.
  evaluation jsonb,
  model_used text,
  prompt_version text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

-- "One assessment per candidate per job" (T-0017 scope): a candidate may have
-- at most one open ('generated') attempt and at most one completed one.
create unique index assessments_candidate_job_open_idx
  on public.assessments(candidate_id, job_id)
  where status = 'generated';

create unique index assessments_candidate_job_completed_idx
  on public.assessments(candidate_id, job_id)
  where status = 'completed';

create index assessments_candidate_id_idx on public.assessments(candidate_id);
create index assessments_job_id_idx on public.assessments(job_id);

alter table public.assessments enable row level security;

create policy "Candidates can read their own assessments"
  on public.assessments for select to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Recruiters can read assessments for their jobs"
  on public.assessments for select to authenticated
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = assessments.job_id
        and jobs.recruiter_id = (select auth.uid())
    )
  );
