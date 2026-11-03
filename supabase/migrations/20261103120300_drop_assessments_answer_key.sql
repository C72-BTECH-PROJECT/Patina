-- Patina T-0029 (I-0066), step 2 of 2: drop assessments.answer_key.
--
-- APPLY ONLY AFTER: (1) 20261103120100_create_assessment_keys.sql is applied
-- and the owner has checked the copy in the dashboard; (2) the owner has taken
-- the locked-down backup (tasks/T-0029-security-batch.md, owner step B);
-- (3) the T-0029 backend is deployed (it no longer reads or writes the column).
--
-- Attempts created by the old backend between step 1 and the deploy have a key
-- only in the old column: copy those first, then verify that every attempt has
-- a key row, then drop. One transaction: if the check raises, nothing changes.

insert into public.assessment_keys (assessment_id, answer_key)
select a.id, a.answer_key
from public.assessments a
where a.answer_key is not null
  and not exists (select 1 from public.assessment_keys k where k.assessment_id = a.id);

do $$
declare
  n_missing bigint;
begin
  select count(*) into n_missing
  from public.assessments a
  where not exists (select 1 from public.assessment_keys k where k.assessment_id = a.id);
  if n_missing > 0 then
    raise exception 'assessment_keys incomplete: % assessments have no key row', n_missing;
  end if;
end;
$$;

alter table public.assessments drop column answer_key;
