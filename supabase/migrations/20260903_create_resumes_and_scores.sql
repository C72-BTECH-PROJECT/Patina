-- Patina: Resume and Score entities (CHECKLIST 0.2 / 0.3 / 4.4 / 4.11)
-- Prerequisite: 20260830_create_jobs_and_applications.sql
-- Apply in the Supabase SQL Editor after the jobs/applications migration.
--
-- These two tables replace the in-memory `allAnalyses[]` array that previously
-- held parsed resumes and scores in the Node process. Parsed entities and the
-- granular sub-scores are persisted (never recomputed on render) so a stored
-- score can be re-explained after the fact (4.11).

create extension if not exists pgcrypto;

-- Private bucket holding the raw uploaded resume file. The backend uses the
-- service-role client to write; recruiter access is via signed URLs later.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do nothing;

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  file_name text,
  -- storage object path in the `resumes` bucket for the raw upload (0.3)
  file_ref text,
  raw_text_preview text,
  -- Structured parsed entities. Stored as-extracted so downstream modules
  -- (GitHub aggregator, assessment engine) read them without re-parsing.
  contact jsonb not null default '{}'::jsonb,        -- {candidate_name,email,phone,github,linkedin}
  skills text[] not null default '{}',
  experience jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  project_links text[] not null default '{}',        -- seeds Modules 2 and 3 (1.9)
  parser_version text,
  created_at timestamptz not null default timezone('utc', now())
);

create index resumes_candidate_id_idx on public.resumes(candidate_id);
create index resumes_job_id_idx on public.resumes(job_id);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  candidate_id uuid not null references public.profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  -- Composite 0-100 "Credibility Score" (4.3)
  composite_score numeric(5,2) not null,
  -- Named sub-scores kept alongside the composite (4.4). Shape:
  --   { "parsing_semantic_alignment": { "value": <0-100>, "weight": <n>,
  --       "components": { similarity_score, semantic_score, skill_coverage,
  --                       matched_skills, missing_skills, match_level, match_reason } },
  --     "github_evidence": null,            -- module not built yet
  --     "assessment_results": null }        -- module not built yet
  subscores jsonb not null default '{}'::jsonb,
  -- Weighting scheme actually applied, so the composite is reproducible (4.11).
  weights jsonb not null default '{}'::jsonb,
  -- Factor-by-factor breakdown with cited evidence (4.5).
  explanation jsonb not null default '{}'::jsonb,
  -- True while GitHub / assessment evidence is unavailable (4.7 / 5.10).
  evidence_limited boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create index scores_candidate_id_idx on public.scores(candidate_id);
create index scores_job_id_idx on public.scores(job_id);
create index scores_resume_id_idx on public.scores(resume_id);
create index scores_job_composite_idx on public.scores(job_id, composite_score desc);

-- The backend uses the service-role client (RLS bypassed). These policies
-- secure any later direct browser access through the Supabase client.
alter table public.resumes enable row level security;
alter table public.scores enable row level security;

create policy "Candidates can read their own resumes"
  on public.resumes for select to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Recruiters can read resumes for their jobs"
  on public.resumes for select to authenticated
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = resumes.job_id
        and jobs.recruiter_id = (select auth.uid())
    )
  );

create policy "Candidates can read their own scores"
  on public.scores for select to authenticated
  using ((select auth.uid()) = candidate_id);

create policy "Recruiters can read scores for their jobs"
  on public.scores for select to authenticated
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = scores.job_id
        and jobs.recruiter_id = (select auth.uid())
    )
  );
