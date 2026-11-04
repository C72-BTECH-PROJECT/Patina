-- Patina T-0030 (I-0041): describe the stored shape of scores.subscores.
--
-- The `--` comment inside 20260903000100_create_resumes_and_scores.sql still says
-- github_evidence / assessment_results are null. That file is applied and is not
-- edited (T-0030 rule), so the database comment below is the source of truth.
-- It matches the sub-score contract in backend/Services/explainability.js.
comment on column public.scores.subscores is
'Object keyed by parsing_semantic_alignment, github_evidence and assessment_results. Every entry has the same shape, available or not: { key, label, available, value (0-100, null while unavailable), weight (share of the composite, 0..1; 0 while unavailable), reason (why it is unavailable; null when available), components (raw source metrics for audit; an unavailable GitHub entry holds { reason_code }), evidence (array of evidence items) }. Contract: backend/Services/explainability.js (SUB-SCORE CONTRACT).';
