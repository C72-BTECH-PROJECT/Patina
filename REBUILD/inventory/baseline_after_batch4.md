# Batch smoke after batch 4 (R-14..R-19) vs REBUILD/inventory/baseline.md section 6

Run 2026-11-13 ~16:10-16:35 IST, branch rebuild/fable (HEAD 0670d5d = batch 3 committed, + dirty working tree holding batch 4, unchanged by this run: git status --short identical before/after (65 lines); tests/nlp/snapshots SHA-256 identical before/after).
Services started/stopped only via scripts/start-all.ps1 (with frontend, since batch 4 changed it) and scripts/stop-all.ps1; six ports free before and after, no Patina node/python/cmd process left. No .env file opened. Previous state: baseline_after_batch3.md.
Written by the verifier to its scratchpad (the verifier cannot edit the repo); copy to REBUILD/inventory/baseline_after_batch4.md.

## Verdict: NOT BELOW BASELINE
Compared with batch 3: same 24 / improved 3 / different by design 2 / worse 0 / not run 3 (total 32). Two new rows outside the 32 (frontend Jest, e2e), both PASS.
Caveat: BL-11 goes from 10 to 25 problems. All 15 new ones are stale cites created by the intended batch-4 frontend deletions and rewrites (6 in AUDIT.md rows 2.8, 5.5, 5.9, 5.14, 5.15 x2; 9 in ARCHITECTURE.md). Owners are R-24 (ARCHITECTURE) and R-25 (AUDIT) per their TASKS.md checks, but no ISSUES.md / LOG.md / PROGRESS.md entry records them yet.

| ID | After batch 3 | Today | Class vs batch 3 | Observed today |
|---|---|---|---|---|
| BL-01 | PASS | PASS | same | v24.12.0 / 11.13.0 / Python 3.14.0 |
| BL-02 | PASS | PASS | same | nlp venv loads en_core_web_sm; root .venv still OSError E050 |
| BL-03 | PASS | PASS | same | 200 status running, version 2.0.0, parser_version nlp-engine@2.0.0; bind 127.0.0.1:8000 |
| BL-04 | PASS | PASS | same | 200 status ok, contract_version 1, token_configured true; 127.0.0.1 |
| BL-05 | PASS | PASS | same | 200 status healthy, llm_configured true; 127.0.0.1 |
| BL-06 | PASS | PASS | same | 200 status ok, checks.database ok; 127.0.0.1:5001 |
| BL-07 | PASS | PASS | same | 200 status ok, all four upstreams true; gateway on :: (public entry) |
| BL-08 | NOT RUN | PASS | improved (re-run) | start-all with frontend: 0.0.0.0:3000 up, GET / 200 (title Patina), "Compiled successfully!", 0 warnings in the dev log (only webpack-dev-server DeprecationWarnings on stderr, as before) |
| BL-09 | PASS (9 warn) | PASS (0 warn) | improved | npm run build: exit 0, 15 s, "Compiled successfully.", main.980159b5.js 170.77 kB gz (was 266.87 kB), css 7.39 kB. No ESLint suppression added (one eslint-disable-next-line no-await-in-loop in a test file; frontend/.env unchanged since 2026-09-03) |
| BL-10 | FAIL | PASS | improved | run-suite -Suites frontend (CI=true): exit 0, 15 s, Compiled successfully |
| BL-11 | FAIL (10) | FAIL (25) | by design (R-14..R-18 deletions and rewrites; fix owned by R-24/R-25) | the same 10 ARCHITECTURE.md cites into backend/Routes/auth.routes.js (27 lines) + 15 new: AUDIT.md 2.8, 5.5, 5.9, 5.15 cite recruiter/Dashboard.jsx lines past its new end (188 lines); 5.14 cites deleted Processing.jsx; 5.15 cites deleted AllCandidates.jsx; ARCHITECTURE.md cites AllCandidates.jsx x4, Processing.jsx x2, AuthContext.jsx:92 (88 lines), recruiter/Dashboard.jsx:197 and :198. Not recorded in ISSUES.md |
| BL-12 | PASS 86 | PASS 86 | same | run-suite -Suites github: 86 passed, 3 warnings, 22 s |
| BL-13 | PASS 66 | PASS 66 | same | run-suite -Suites assessment: 66 passed, 5 s |
| BL-14 | PASS 207 | PASS 217 | same (superset) | run-suite -Suites backend: exit 0, tests 217 pass 217 fail 0 skipped 0, 34 s (adds candidate-results.test.mjs and new cases); ports freed. Also cd backend; npm test: 200/200, 15 s |
| BL-15 | PASS 207 | PASS 217 | same (superset) | covered by BL-14 |
| BL-16 | FAIL 13/17 (expected) | FAIL 13/17 (expected) | same | the same 4 gateway deny-by-default 401s: errors carry a code, unknown route 404, I-0027 POST 404, POST /api/analyze expects 404 |
| BL-17 | PASS 40 | PASS 40 | same | 40 passed, 3 deselected, 41 s, writes redirected to scratch; all six fresh snapshots byte-identical to tests/nlp/snapshots/current. tests/eval: 10 passed |
| BL-18 | PASS 12 | PASS 12 | same | tests 12 pass 12 |
| BL-19 | PASS 29 | PASS 29 | same | run-suite -Suites gateway: tests 29 pass 29, 11 s |
| BL-20 | PASS 27 | PASS 27 | same | cd gateway; npm test: tests 27 pass 27 |
| BL-21 | not zero before / FAIL after | not zero before / FAIL after | same (tool) | before: notifications 8, assessments 9, scores 15, resumes 36, applications 8, jobs 0, storage candidates/C 1. after: notifications 10, assessments 11, scores 19, resumes 44, applications 10, jobs 1, storage candidates/C 1; profiles all present; exit 1. The sweep counts only [T-0001 TEST] jobs (tests/backend/lib/testdb.mjs:18,119): the 7 published [E2E ...] jobs are neither counted nor swept |
| BL-22 | PASS | PASS | same | 401 source gateway, error unauthorized, requestId; CSP and RateLimit headers |
| BL-23 | PASS | PASS | same | LAN address :5001 refused (curl exit 7); 127.0.0.1:5001 401 Not authenticated, error unauthorized, requestId; LAN :5000 /health 200 |
| BL-24 | PASS | PASS | same | 204, ACAO http://localhost:3000, Allow-Credentials true |
| BL-25 | PASS | PASS | by design (R-16, R-17, R-18) | flow all 200/201 through :5000 (table below); apply scores 84.84 band high, evidence_limited, github_user_not_found. Changed by design and checked: my-applications rows (job_title, scoring, score {composite, band}); new GET /api/applications/:id/result (own 200, other candidate 404, recruiter 403, anonymous 401, bad id 400, unknown id 404); status adds time_limit_minutes and, when completed, result; shortlist notification names the job |
| BL-26 | PASS | PASS | same | background generation after apply: pool ready 9.1 s after apply (was 32.2 s), model gemini-3.1-flash-lite, 10 questions; start 200 in 164 ms |
| BL-27 | PASS | PASS | same | direct POST 127.0.0.1:8002/generate-assessment, baseline payload: 200 in 9.0 s, 10 questions, gemini-3.1-flash-lite; body keys questions, answer_key (service-internal) |
| BL-28 | PASS | PASS | same | save 200 (5 answers), evaluate 200 in 2.3 s, score 15; new score row: assessment sub-score 15 at weight 0.3846, parsing 0.6154, composite 84.84 -> 57.98; history [57.98, 84.84] |
| BL-29 | NOT RUN | NOT RUN | not run | per brief (live suites delete Supabase rows) |
| BL-30 | NOT RUN | NOT RUN | not run | needs ../patina-baseline worktree |
| BL-31 | NOT RUN | NOT RUN | not run | no positive live GitHub fetch (fixture account does not exist) |
| BL-32 | 422 | 422 | same | /parse f6_image_only.pdf (field resume) with and without jd: 422 unreadable_document, reason no_text_layer, OCR not available |

Extra rows (new in batch 4, not in the 32):

| Row | Today | Observed |
|---|---|---|
| frontend Jest | PASS 65 | cd frontend; CI=true react-scripts test --watchAll=false: 5 suites, 65 tests passed, 6 s |
| e2e (R-19) | PASS | run-suite -Suites e2e against the running stack: exit 0, 4 passed, 1 skipped (signup.spec opt-in, E2E_SIGNUP unset), 47.6 s; spine 39.5 s (preparing -> ready 12.8 s, 10 questions, grading 3.1 s, answer-key scan of 88 responses clean, weights 0.6154/0/0.3846). Third exit-0 run today (two earlier by another verifier) |

## End-to-end API smoke through the gateway (port 5000), accounts t0001_recr (R), t0001_recr2 (R2), t0001_cand (C), t0001_cand2 (C2, reads only), fixture f1_dev_github.pdf, dev JD
Script: the batch-3 r13live.mjs extended with the batch-4 endpoints. 55 steps, all as expected. (Step ids E15b/E16b/E16c/E13a = the primed ids of the batch-3 file.)

| Step | Request | Status | Fact |
|---|---|---|---|
| E03 | login R, R2, C, C2; GET /api/auth/session (R) | 200 x4 / 200 | roles RECRUITER, RECRUITER, CANDIDATE; session keys userId, role |
| E05 | POST /api/jobs (R) | 201 | job 0fc66b02-f54a-426a-81e9-d65333fce948, published, [T-0001 TEST] batch-4 smoke 2026-11-13T11:01:07.479Z. WRITE |
| E07/E08 | GET /api/jobs (C), GET /api/resume/status | 200 / 200 | 14 jobs incl. test job; hasResume true |
| E09 | POST /api/resume/upload f1 | 201 | 351 ms, 15 skills, resume 00462e77-4840-455c-b2ec-aa939e636e47. WRITE |
| E10 | POST /api/jobs/:id/apply | 201 | 1.40 s, scoring scored, application 0a5aab36-4af8-4568-b6dd-8d8ca311261b; core: composite 84.84 band high github=github_user_not_found; preparation logged under the apply request id. WRITE |
| new | GET /api/jobs/my-applications (C) | 200 | 9 rows, keys id, job_id, status, submitted_at, job_title, scoring, score; test row title matches, scoring scored, score {84.84, high}; every row has the keys |
| new | GET /api/applications/:id/result as C; C2; R; anonymous; not-a-uuid; unknown uuid | 200; 404 not_found; 403 forbidden; 401 gateway; 400 invalid_application_id; 404 not_found | own: keys application, scoring, score; job_title matches; credibilityScore 84.84 = my-applications composite; no key/feedback text. The C2 body does not contain the job id |
| E15b | GET /api/recruiter/applications (R), ?jobId= | 200 / 200 | composite 84.84, band high, evidence_limited, 3 sub-scores, 15 skills; assessment.state preparing |
| E16b | GET /api/recruiter/applications/:id (R) | 200 | explanation 15 keys, weights sum 1, score_history 1, notes github_ownership + unproctored_assessment; no pool/key text |
| E16c | R2 list / ?jobId=(job of R) / detail; C list, detail; anonymous | 200 (without it) / 404 job_not_found / 404 not_found; 403 / 403; 401 / 401 | |
| | GET /api/candidates, GET /api/recruiter/applicants (R); POST /api/analyze (C) | 404 / 404 / 404 | removed |
| E17 | GET /api/jobs/mine | 200 | applicationCount 1 for the test job; all integers |
| E13a | GET /api/assessment/status until ready | 200 | preparing -> ready 9.1 s after apply; each call <= 126 ms; keys add time_limit_minutes (15); no result field before completion |
| | POST /api/assessment/start | 200 | 164 ms, 10 questions (6 mcq, 4 short_answer), gemini-3.1-flash-lite, expires_at set; no key fields |
| | PUT /api/assessment/:id/answers | 200 | 93 ms, saved 5 |
| E13b | POST /api/assessment/evaluate | 200 | 2.34 s, score 15, scoring scored; 10 results each with question text; no key/feedback text |
| | R detail after evaluate | 200 | 57.98 band low, assessment sub-score 15 at 0.3846, weights sum 1, history [57.98, 84.84], completed, score_of_record set, 10 results with recruiter_feedback and question; list has no recruiter_feedback |
| new | GET /api/assessment/status (completed) | 200 | keys add time_limit_minutes and result; result has 10 results with question text, score equal to the evaluate score, no scoring field, no key/feedback text |
| new | GET /api/applications/:id/result, my-applications after evaluate | 200 / 200 | credibilityScore 57.98, assessmentScore 15; my-applications score {57.98, low} |
| E12 | GET /api/candidate-analysis (C) | 200 | credibilityScore 57.98, assessmentScore 15, no recruiter_feedback |
| | shortlist as R2; as R | 404; 200 | R: shortlisted, notified true |
| E14 | GET /api/notifications (C) | 200 | 8 -> 9: one new, type shortlisted, data.applicationId = the application, message contains the job title |
| E18/E19 | logout R, R2, C, C2 | 200 x4 | |

assessment-service log: exactly 1 /generate-assessment for this application (request id = the apply request id) before BL-27.

## Leftover live data (node tests/backend/sweep.mjs --check after stop-all, exit 1)
Added by this run (read-only time-window count, matches the sweep delta):
- API smoke: job 0fc66b02-f54a-426a-81e9-d65333fce948 ([T-0001 TEST] batch-4 smoke 2026-11-13T11:01:07.479Z, owner t0001_recr); application 0a5aab36-4af8-4568-b6dd-8d8ca311261b (shortlisted); assessment 0f52ba68-651e-4709-ab6c-5ee0d1fcb50f (+ its assessment_keys row); scores 2; resumes 4 (incl. 00462e77-4840-455c-b2ec-aa939e636e47); notifications 1.
- e2e run: job 332f09bd-1a71-489a-bf25-8a7bbd241056 ([E2E 2026-11-13T11:02:01Z], published, NOT matched by sweep.mjs); application 5d853f3e-804b-429e-b566-a6191f8eac66; assessment e9c39285-b177-4f25-aaf9-77b3586b309d (+ assessment_keys); scores abfe547a-98e4-4ea5-936b-59f3bcc2374f, 71e82923-7079-4e57-8358-d8e8d1c9c305; notification eb1923cd-54bd-4899-9da9-e68a9dcfa2af; resumes 4 (the e2e teardown lists only 07e764cb-1871-411e-890d-898eff4e510b).
- Storage: candidates/C object replaced in place (count unchanged at 1).
Totals before -> after: notifications 8 -> 10, assessments 9 -> 11, scores 15 -> 19, resumes 36 -> 44, applications 8 -> 10, jobs ([T-0001 TEST]) 0 -> 1, storage candidates/C 1 -> 1. [E2E ...] published jobs for the test recruiters: 7 (outside the sweep scope). Nothing deleted.

## External calls
Gemini: 3 generations (1 background pool for the API smoke, 1 direct BL-27 probe, 1 in the e2e spine) and 2 gradings. GitHub API: /v1/evidence 404s for the fixture account (no positive fetch). Supabase: test-account logins, the reads/writes above, 2 sweep --check runs, 2 read-only count queries.

## Git and secret checks
- git status --short: 65 entries, identical before/after; 0 staged. Deleted (6, all expected): frontend/src/components/{Card,Input,Logo,Skeleton}.jsx, frontend/src/pages/candidate/Processing.jsx, frontend/src/pages/recruiter/AllCandidates.jsx. No other deletion.
- .env: none in the diff or untracked list; all five .env files are git-ignored. backend/.env mtime 2026-11-13 10:58 IST (after the HEAD commit; not opened, not attributable from here); the other four predate today.
- Secret-shaped scan (Google/OpenAI/GitHub/Supabase/AWS/Slack keys, JWTs, private keys, password/secret/token literals, long opaque strings) over 4043 added diff lines and 38 untracked files (3768 lines; node_modules and e2e output are git-ignored): 0 real hits; 1 pattern hit in frontend/src/pages/public/Login.jsx:395, the HTML autoComplete value new-password (false positive).

## Observations (not baseline regressions)
- tests/backend/sweep.mjs only matches jobs titled [T-0001 TEST] (tests/backend/lib/testdb.mjs:18,119), so the [E2E ...] jobs of the e2e suite (7, all published, visible to every candidate) are never swept. Belongs in ISSUES.md.
- The e2e teardown lists 1 resumes row per run but the run creates 4 (upload, apply parse, preparation parse, re-score after grading; the known apply-parses-twice class).
- The 15 new BL-11 stale cites are not recorded anywhere yet.

## Side effects (git-ignored only)
frontend/build rebuilt (new bundle names); tests/.out start-all, harness and e2e logs; tests/e2e/output report; tests/.out/t0001-profile-snapshots.json rewritten by sweep --check. Raw logs and scripts are in the verifier scratchpad b4/ (b4live.mjs, b4live-result.json, bl*.log, rs-*.log, e2e.log).
