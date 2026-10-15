# T-0018 — assessment resume parse fallback (quiz from stored NLP result + JD)

> Follow-up to T-0016/T-0017 (generate + evaluate). User report: the quiz
> "asks to add resume every time" even after a resume was uploaded. Root cause
> (traced 2026-10-15): `/api/resume/upload` only writes the raw file to
> Storage (`candidates/{id}/resume{ext}`), while `generateAssessment` reads
> only the parsed `resumes` row that `/api/analyze` creates — so an
> uploaded-but-unparsed resume yields `400 Upload a resume first`.

## Goal

Assessment generation uses the NLP parse result stored in Supabase + the
stored job JD to build the quiz, and a candidate who uploaded a resume is
never asked to upload it again: if only the raw file exists, it is parsed
once on demand and the result is persisted for all later quizzes.

## Spec ref

CHECKLIST 5.1 (candidate upload portal), 3.7 (assessment sequence uses the
stored parse), 5.3 (take assessment must not be blocked by a missing parse
row). User directive 2026-10-15: "take result of nlp parser from supabase
and jd and make quiz … not need of putting resume every time."

## Scope

**In:**
- `backend/Controllers/assessment.controller.js` — `generateAssessment`
  loads the latest `resumes` row as today; when it has no usable
  `raw_text_preview` (or the stored file is newer than the row), download
  `candidates/{id}/resume*` from Storage, POST it to `NLP_PARSE_URL` with the
  job JD + skill lists (same contract as `/api/analyze`), persist a
  `resumes` row, and use that result. Later generates read Supabase only
  (no re-upload, no re-parse while the file is unchanged).
- Failure handling: NLP down + no stored result → `502` with a start-the-
  parser message; NLP down + stored result exists → use the stored result
  (warn, do not block); no file + no row → `400` unchanged (message kept);
  Storage list/download errors → `500`/stored-result fallback as applicable.
- Logs: one `console.log` line on on-demand parse, warns on fallback.

**Out:**
- `analysis.controller.js` (analyze flow stays byte-identical).
- Frontend (Upload / Assessment pages unchanged).
- Storage layout unification (`{uuid}/` vs `candidates/{id}/`) and the
  300-char `raw_text_preview` limit → ISSUES.md entries, not fixed here.
- `scores.resume_id` data (ON DELETE CASCADE — no deletes).

## Acceptance criteria

1. Candidate with no parse row and no file → `400 Upload a resume first…`
   (unchanged) — checked by: live repro script, step "generate before upload".
2. Candidate with an uploaded file but no `resumes` row → generate returns
   `200` with questions (not 400) and a new `resumes` row appears
   (`candidate_id` = that candidate, `raw_text_preview` non-empty) — checked
   by: live repro script pre-fix (expects 400, bug evidence) then same steps
   post-fix (expects 200 + SQL row count 0 → 1), log in
   `tests/.out/t0018-*.log`.
3. Repeat generates do not add `resumes` rows while the file is unchanged —
   checked by: SQL count before/after a second generate in the same script.
4. Re-upload makes the next generate use the new file (stored parse is
   refreshed when file `updated_at` > row `created_at`) — checked by:
   script step (re-upload → count 1 → 2, newest row `created_at` ≥ upload
   time) — reuses the same account, no second LLM round needed for the
   re-parse assertion if generation is also asserted (200 on a second job or
   open-attempt resume path may skip resume resolution; the assertion is on
   the row state after a generate that reaches resume resolution).
5. Regression: `node tests/backend/assessment-generate.smoke.mjs` still
   passes against the restarted backend — checked by: command output
   `2/2` (or equivalent pass line).

## Test plan

- Tests to write FIRST (FAIL before the change, PASS after):
  - one-off live script `tests/.out/t0018-repro.mjs` (credentials inline or
    from `backend/.env`; logs to `tests/.out/t0018-prefix.log` /
    `t0018-postfix.log`) — asserts criterion 1 pre-fix, criteria 2–4
    post-fix.
- Criteria that can't be automated:
  - LLM generation latency (2–4 min free tier) — script polls with a
    generous timeout; a service-level failure at the LLM step after the
    parse succeeded is reported separately (parse evidence = the new row).
- Regression: smoke test above; `node --check` on the edited controller;
  `node tests/docs/check-trackers.mjs` after the docs update.

## Regression

- `node tests/backend/assessment-generate.smoke.mjs` (needs backend :5000).
- Frontend untouched — no build required.

## Risks and rollback

- Risk: NLP call now reachable from generate (was analyze-only) — mitigated
  by 60 s timeout, fallback-to-stored-result, and the 502 path only when no
  parse exists at all; blast radius is the generate endpoint only.
- Risk: extra `resumes` rows on re-parse — harmless (`latest row wins`;
  `scores.resume_id` untouched; no deletes).
- Rollback: revert `assessment.controller.js` (additive change, no
  migration, no data contract change).

---

## Result

1. PASS — fresh account, generate with no file and no row → 400 "Upload a resume first" (tests/.out/t0018-prefix.log).
2. PASS — post-fix, same account with a file-only upload: resumes 0→1 (preview 300 chars, file_ref candidates/{id}/resume.pdf); owner UI run 04:01 parsed resume.pdf → row ba4a2c79. (200-with-questions captured in the T-0019 flow rerun.)
3. PASS — second generate with the file unchanged → still 1 row (no re-parse).
4. PASS — re-upload bumped storage updated_at → next generate re-parsed → 2 rows, newest created_at ≥ upload time.
5. PASS — node tests/backend/assessment-generate.smoke.mjs 2/2 after the restart.
