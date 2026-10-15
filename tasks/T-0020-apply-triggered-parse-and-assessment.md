# T-0020 — apply-triggered resume parse → assessment pipeline (step 3 link)

> Connect STEP 3 of the target end-to-end flow: applying triggers an
> automatic NLP parse of the stored resume against that job and then
> automatic assessment generation. Basic flow only; no credibility
> composite.

## Goal

When a candidate applies for a job, the backend automatically (a) parses
their already-stored resume against that job's JD via the NLP service and
persists the result as a `resumes` row, then (b) generates the assessment
(candidate questions + server-side answer key) via the assessment service
and persists it as an `assessments` row — so the candidate can open the
quiz straight from the job page, answer it, and have it scored and stored
for that candidate + job, with no manual "analyze" step and no re-upload.

## Spec ref

CHECKLIST 5.14 (score/parse on apply), 3.7 (assessment sequence uses the
stored parse), 5.3 (take assessment). ARCHITECTURE.md §4.4 constraint
(apply must not depend on NLP being synchronously up). User directive
2026-10-15: "once the candidate has clicked apply directly in background
it must work ... no final credibility score".

## Scope

**In:**
- `backend/Controllers/assessment.controller.js`:
  - Extract the body of `generateAssessment` (job lookup, open-attempt
    resume, 5-attempt limit, `resolveResumeForAssessment`, service call,
    `assessments` insert) into an HTTP-free
    `generateAssessmentForJob(candidateId, jobId)` returning
    `{ ok, status, body }`. The existing `generateAssessment` handler
    delegates to it and maps to `res.status(...).json(...)` with the same
    bodies as today.
  - Add `runApplicationPipeline(candidateId, jobId)` — awaits
    `generateAssessmentForJob` in a try/catch, never throws, and logs
    `[apply-pipeline] ...` one line on success and a warn/error otherwise.
- `backend/Controllers/jobs.controller.js`: after the `applications`
  insert succeeds in `applyToJob`, call
  `runApplicationPipeline(req.session.userId, jobId)` **without awaiting**
  (fire-and-forget); response shape stays `201 {application row}`.
- `frontend/src/pages/candidate/JobDetail.jsx`: once applied, show a
  "Take assessment" link to `/candidate/assessment?jobId=<id>` (the
  Assessment page's existing `?jobId=` auto-generate path resumes the
  already-generated open attempt).

**Out:**
- Credibility composite / `scores` table: this flow writes **no** `scores`
  row and does not recompute one (user: "no final credibility score for
  now"). The existing guarded `scores` rebuild in `evaluateAssessment` is
  left untouched; it is a no-op when no score row exists.
- `analysis.controller.js` (`/api/analyze`), the NLP service, the
  assessment service, and the `assessments` schema are unchanged.
- No queue/worker/broker: the pipeline runs in-process fire-and-forget.
- Not building a live "generating..." status UI; if the background
  generation is not finished when the candidate opens the quiz, the
  existing on-demand generate path still produces it (see Risks).

## Acceptance criteria

1. Applying for a job, with no further action, causes the stored resume to
   be parsed against that job and persisted: a `resumes` row exists for
   that candidate after apply (count 0 -> 1 on a fresh account) — checked
   by: live script `tests/.out/t0020-flow.mjs` (login, upload, apply, then
   poll Supabase/rows) and the backend log line `[apply-pipeline] resume
   parsed` / `assessment ready`.
2. The same apply causes assessment generation: an `assessments` row with
   `status='generated'` and non-null `questions` and `answer_key` exists
   for that candidate + job — checked by: same script (poll for the row).
3. The candidate can open `/candidate/assessment?jobId=<id>` and receive
   the questions with **no** answer key — checked by: the API response of
   `POST /api/assessment/generate` contains `questions` and not
   `answer_key` (asserted in the script), plus one manual UI look.
4. Submitting answers via `POST /api/assessment/evaluate` stores the
   result on that candidate + job: the `assessments` row moves to
   `status='completed'` with non-null `answers`, `score`, `evaluation` —
   checked by: script asserts the response `score` is a number and the row
   state; existing `assessment-evaluate-live` test covers the endpoint.
5. The flow writes no `scores` row: `scores` count for that candidate is
   unchanged (0) across apply -> generate -> evaluate — checked by: script
   count assertion.
6. Regression: `node tests/docs/check-trackers.mjs` exits 0; `node --check`
   on both edited controllers is clean; `node --test
   tests/backend/assessment-generate.smoke.mjs` still passes when a
   backend is running.

## Test plan

- Tests to write FIRST (FAIL before the change, PASS after):
  - `tests/.out/t0020-flow.mjs` (one-off live script; credentials from
    `tests/.env`/`backend/.env`, `T0020_*` account): step 1 asserts no
    `resumes`/`assessments` row exists immediately after apply and then one
    appears (pre-fix both stay 0 = FAIL); steps 3-5 assert the API
    contracts. Logs to `tests/.out/t0020-*.log`.
- Criteria that can't be automated:
  - LLM generation latency (2-4 min free tier) — the script polls with a
    generous timeout; a service-level LLM failure is reported separately
    (the parse row is still the parse evidence).
  - Criterion 3 visual confirmation — one manual UI look by the user.
- Regression: `node --check` on both controllers; docs suite; smoke test.

## Regression

- `node tests/backend/assessment-generate.smoke.mjs` (needs backend :5000).
- `node tests/docs/check-trackers.mjs`.
- Frontend: `JobDetail.jsx` change is additive; no route change; existing
  `Assessment.jsx` generate path reused unchanged.

## Risks and rollback

- Risk: candidate opens the quiz while the background generation is still
  running -> the page starts a second generation. Mitigated by the existing
  partial unique index `assessments_candidate_job_open_idx` (at most one
  open row) and the insert-race fallback that returns the stored open row;
  the cost is one extra LLM call, not duplicate rows.
- Risk: the in-process pipeline is lost if the backend restarts mid-run.
  Accepted for this basic iteration (no queue in scope).
- Risk: NLP/assessment service down at apply time -> generation is skipped
  and logged; the candidate's manual generate still works later. Apply
  itself always succeeds (it already only needs the resume file).
- Rollback: revert the two backend files + the one frontend file (additive
  change; no migration, no schema change).

---

## Result

Verified 2026-10-15: static checks first, then the live end-to-end run once
the Python venvs existed (L-0032).

1. PASS (live) — apply returned `201` in **172 ms**; `resumes` went `0 -> 1`
   for a fresh candidate **3.1 s** after apply, with 0 `resumes` /
   `assessments` rows immediately after apply (fire-and-forget, no waiting).
   Backend log: `[apply-pipeline] assessment ready id=bb0b0d19…`. Script
   `tests/.out/t0020-flow.mjs`, log `tests/.out/t0020-flow.log`.
2. PASS (live) — the same apply produced an `assessments` row
   `status='generated'` with non-null `questions` and `answer_key` after
   **262.6 s** (LLM free tier).
3. PASS (live) — `POST /api/assessment/generate` returned 200 with 20
   questions and **no** `answer_key` anywhere in the JSON. The manual UI look
   is still open (the page's `?jobId=` path is unchanged, reused as-is).
4. PASS (live) — `POST /api/assessment/evaluate` returned `score=10` (the
   script deliberately answers every MCQ with its first option, so a low
   score is expected) and the row moved to `status='completed'` with non-null
   `answers`, `score` and `evaluation`.
5. PASS (live) — the `scores` count stayed `0` across apply → generate →
   evaluate; this flow writes no credibility composite.
6. PASS — `node --check` clean on both controllers; `node
   tests/docs/check-trackers.mjs` exit 0; `node --test
   tests/backend/smoke.test.mjs tests/backend/assessment-generate.smoke.mjs`
   → 9/9 against a live backend on :5000.

Environment and verification notes:
- The live run needed all three services up: backend :5000, NLP :8000,
  assessment-service :8002 (venvs from L-0032).
- Supabase free-tier email rate limiting blocked the app's own
  `POST /api/auth/signup` ("email rate limit exceeded"), so the script falls
  back to the service-role admin API (`POST /auth/v1/admin/users` with
  `email_confirm: true`, which sends no email) plus a `profiles` insert.
- Test data written to the shared Supabase: `t0020_cand`, `t0020_recr`, one
  published job, one application, one `resumes` row, one `assessments` row.
- Not verified: the frontend build; criterion 3's visual confirmation.

