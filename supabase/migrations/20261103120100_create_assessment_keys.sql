-- Patina T-0029 (I-0066), step 1 of 2: move answer keys out of the table
-- candidates can read.
--
-- public.assessments has RLS policies that let a candidate (and the job's
-- recruiter) SELECT every column, answer_key included, through PostgREST with
-- their own token. Keys move to public.assessment_keys: RLS on, NO policy, and
-- no table privilege for anon/authenticated. Only the service role (the
-- backend) can read it.
--
-- This step copies and verifies; it drops nothing. Step 2
-- (20261103120300_drop_assessments_answer_key.sql) drops the old column, and is
-- applied only after the owner has checked this copy and taken a backup.
-- Runs as one transaction: if the verification raises, nothing is applied.

create table public.assessment_keys (
  assessment_id uuid primary key references public.assessments(id) on delete cascade,
  answer_key jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.assessment_keys enable row level security;
-- Deliberately no policy: with RLS on and no policy, anon and authenticated see
-- nothing even if a grant is added later by mistake. The revoke removes
-- Supabase's default table grants as well.
revoke all on public.assessment_keys from anon, authenticated;

insert into public.assessment_keys (assessment_id, answer_key)
select id, answer_key from public.assessments;

do $$
declare
  n_assessments bigint;
  n_keys bigint;
begin
  select count(*) into n_assessments from public.assessments;
  select count(*) into n_keys from public.assessment_keys;
  if n_assessments <> n_keys then
    raise exception 'assessment_keys copy mismatch: % assessments, % keys', n_assessments, n_keys;
  end if;
end;
$$;

-- The T-0029 backend writes new keys only to assessment_keys, so new attempts
-- must be insertable without the old column until step 2 drops it.
alter table public.assessments alter column answer_key drop not null;
