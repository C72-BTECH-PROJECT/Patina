-- Patina T-0029 (I-0069): one grade per attempt.
--
-- Evaluate used to read status, grade, then update with no row-count check, so
-- concurrent submits were all graded (each an LLM call against the free-model
-- rate limits) and all folded into the score. Now evaluate first CLAIMS the
-- attempt with one atomic UPDATE ... RETURNING ('generated' -> 'grading'),
-- releases it back to 'generated' if grading fails, and completes it only
-- while it still holds the claim. A claim older than the backend's stale limit
-- (10 minutes, passed in as p_stale_after) can be taken over, so a crashed
-- grader never leaves an attempt stuck.

alter table public.assessments add column grading_started_at timestamptz;

-- The status check was declared inline in 20261015_create_assessments.sql, so
-- Postgres named it assessments_status_check. Confirm before replacing it.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.assessments'::regclass
      and conname = 'assessments_status_check'
      and contype = 'c'
  ) then
    raise exception 'expected check constraint assessments_status_check on public.assessments';
  end if;
end;
$$;

alter table public.assessments drop constraint assessments_status_check;
alter table public.assessments
  add constraint assessments_status_check
  check (status in ('generated', 'grading', 'completed'));

-- At most one open attempt per candidate and job, where "open" now includes an
-- attempt being graded, so generate cannot start a second one meanwhile.
drop index public.assessments_candidate_job_open_idx;
create unique index assessments_candidate_job_open_idx
  on public.assessments (candidate_id, job_id)
  where status in ('generated', 'grading');

-- One statement, so it is atomic: under READ COMMITTED a concurrent second
-- UPDATE waits on the row lock, re-checks WHERE against the committed row
-- ('grading', fresh timestamp), matches nothing and returns no row.
-- Uses the database clock, so backend process clocks do not matter.
create or replace function public.claim_assessment_for_grading(
  p_assessment_id uuid,
  p_candidate_id uuid,
  p_stale_after interval
)
returns table (id uuid, job_id uuid, questions jsonb, grading_started_at timestamptz)
language sql
volatile
set search_path = ''
as $$
  update public.assessments a
     set status = 'grading', grading_started_at = now()
   where a.id = p_assessment_id
     and a.candidate_id = p_candidate_id
     and (a.status = 'generated' or (a.status = 'grading' and a.grading_started_at < now() - p_stale_after))
  returning a.id, a.job_id, a.questions, a.grading_started_at;
$$;

-- In public, so PostgREST would expose it to anon/authenticated by default.
-- Only the backend (service role) may claim.
revoke execute on function public.claim_assessment_for_grading(uuid, uuid, interval) from public, anon, authenticated;
grant execute on function public.claim_assessment_for_grading(uuid, uuid, interval) to service_role;
