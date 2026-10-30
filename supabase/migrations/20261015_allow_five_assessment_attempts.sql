-- Patina: 5 assessment attempts per candidate per job (T-0019, user directive 2026-10-15)
-- Applied to the project via migration "allow_five_assessment_attempts".
-- The credibility score always reflects the LATEST completed attempt (both
-- fold-ins order by completed_at desc). The one-open-attempt invariant stays.
drop index if exists public.assessments_candidate_job_completed_idx;
