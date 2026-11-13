# Batch smoke after batch 3 (R-09..R-13) vs REBUILD/inventory/baseline.md section 6

Run 2026-11-13 ~09:40-10:10 IST, branch rebuild/fable (HEAD 8fc9712 + dirty working tree holding R-09..R-13, unchanged by this run except this file: git status --short identical before/after the service runs; tests/nlp/snapshots SHA-256 identical before/after).
Services started/stopped only via scripts/start-all.ps1 -NoFrontend and scripts/stop-all.ps1; six ports free before and after. backend/.env not opened (core loads it with override, so no fake secret was injected). Previous state: baseline_after_batch2.md.

## Verdict: NOT BELOW BASELINE
Compared with batch 2: improved 3 / same 23 / different by design 2 / worse 0 / not run 4 (total 32).
Caveat: BL-11 drops from 11 to 10 problems only because analysis.controller.js grew back past line 602; AUDIT.md row 5.15's cite (531-602) now resolves but points at the R-13 recruiter code, so it is silently stale.

| ID | After batch 2 | Today | Class vs batch 2 | Observed today |
|---|---|---|---|---|
| BL-01 | PASS | PASS | same | v24.12.0 / 11.13.0 / Python 3.14.0 |
| BL-02 | PASS | PASS | same | nlp venv loads en_core_web_sm; root .venv still OSError E050 |
| BL-03 | PASS | PASS | same | 200 status running, version 2.0.0, parser_version nlp-engine@2.0.0; bind 127.0.0.1:8000 |
| BL-04 | PASS | PASS | same | 200 status ok, contract_version 1, token_configured true; 127.0.0.1 |
| BL-05 | PASS | PASS | same | 200 status healthy, llm_configured true; 127.0.0.1 |
| BL-06 | PASS | PASS | same | 200 status ok, checks.database ok; 127.0.0.1:5001 |
| BL-07 | PASS | PASS | same | 200 status ok, all four upstreams true; gateway on :: (public entry) |
| BL-08 | PASS | NOT RUN | not run | brief: start-all -NoFrontend; dev server not started (build checked in BL-09) |
| BL-09 | PASS (9 warn) | PASS (9 warn) | same | exit 0, 45 s, 9 no-unused-vars, main.7adf8bda.js 266.87 kB (identical bundle name: no frontend change in batch 3). Recruiter pages still call the removed /api/candidates and /api/recruiter/applicants and are broken at runtime until batch 4 (expected, ISSUES.md R-13 entry); not counted |
| BL-10 | FAIL | FAIL | same | run-suite -Suites frontend: exit 1, Treating warnings as errors / Failed to compile, same 9 warnings |
| BL-11 | FAIL (11) | FAIL (10) | same | 10 ARCHITECTURE.md cites into backend/Routes/auth.routes.js (27 lines). 0 new since batch 2. The batch-2 AUDIT.md 5.15 problem disappeared by accident (see caveat) |
| BL-12 | PASS 86 | PASS 86 | same | run-suite -Suites github: 86 passed, 3 warnings, 24 s |
| BL-13 | PASS 66 | PASS 66 | same | run-suite -Suites assessment: 66 passed, 6 s |
| BL-14 | PASS 122 | PASS 207 | same (superset) | run-suite -Suites backend: exit 0, tests 207 pass 207 fail 0 skipped 0, 38 s; ports freed. Also cd backend; npm test: 190/190, 14 s |
| BL-15 | PASS 122 | PASS 207 | same (superset) | covered by BL-14 |
| BL-16 | FAIL 11/14 (expected) | FAIL 13/17 (expected) | by design (R-10) | 4 failures, all gateway deny-by-default 401 on routes core does not have: errors carry a code, unknown route 404, I-0027 POST 404 (as in batch 2) plus POST /api/analyze expects 404 and gets the gateway's 401 because R-10 removed the route |
| BL-17 | PASS 40 | PASS 40 | same | 40 passed, 3 deselected, 47 s, writes redirected to scratch; all six fresh snapshots byte-identical to tests/nlp/snapshots/current. tests/eval: 10 passed |
| BL-18 | PASS 12 | PASS 12 | same | tests 12 pass 12 |
| BL-19 | PASS 29 | PASS 29 | same | run-suite -Suites gateway: tests 29 pass 29, 13 s |
| BL-20 | PASS 27 | PASS 27 | same | cd gateway; npm test: tests 27 pass 27 |
| BL-21 | PASS before / FAIL after | not zero before / FAIL after | same (tool) | before: jobs 6, applications 6, scores 12, resumes 23, assessments 4, notifications 1, storage candidates/C 1 (R-10..R-12 verifiers' rows, awaiting Anthony's sweep). after: jobs 7, applications 7, scores 14, resumes 27, assessments 5, notifications 2, storage candidates/C 1; profiles all present; exit 1 |
| BL-22 | PASS | PASS | same | 401 source gateway, error unauthorized, requestId; CSP and RateLimit headers |
| BL-23 | PASS | PASS | same | LAN address :5001 refused (curl exit 7); 127.0.0.1:5001 401 Not authenticated, error unauthorized, requestId; LAN :5000 /health 200 |
| BL-24 | PASS | PASS | same | 204, ACAO http://localhost:3000, Allow-Credentials true |
| BL-25 | PASS | PASS | by design (R-10, R-13) | new flow, all 200/201 through :5000 (table below). Analyze is gone (404): apply scores (84.84, band high, evidence_limited, github github_user_not_found). /api/candidates and /api/recruiter/applicants are gone (404): GET /api/recruiter/applications[?jobId] and /:id replace them |
| BL-26 | FAIL (provider) | PASS | improved | generation now happens in the background after apply (R-11): pool ready 32.2 s after apply, model gemini-3.1-flash-lite, 10 questions; start 200 in 200 ms |
| BL-27 | NOT RUN | PASS | improved | direct POST 127.0.0.1:8002/generate-assessment with the baseline payload: 200 in 19 s, 10 questions, gemini-3.1-flash-lite; body has questions and answer_key (service-internal; core keeps the key server-side). This was the run's second and last real generation |
| BL-28 | NOT RUN | PASS | improved | save 200 (5 answers), evaluate 200 in 2.7 s, score 10, new scores row: assessment sub-score available 10, weight 0.3846, parsing 0.6154, composite 84.84 -> 56.06; apply-time row kept in score_history |
| BL-29 | NOT RUN | NOT RUN | not run | per brief (live suites delete Supabase rows) |
| BL-30 | NOT RUN | NOT RUN | not run | needs ../patina-baseline worktree |
| BL-31 | NOT RUN | NOT RUN | not run | no positive live GitHub fetch (R-19; fixture account does not exist) |
| BL-32 | 422 | 422 | same | /parse f6_image_only.pdf with and without jd: 422 unreadable_document, reason no_text_layer, OCR not available |

## End-to-end smoke through the gateway (port 5000), accounts t0001_recr (R), t0001_recr2 (R2), t0001_cand (C), fixture f1_dev_github.pdf, dev JD
One application served both the R-13 live check and this smoke.

| Step | Request | Status | Fact |
|---|---|---|---|
| E01/E02 | GET /health, GET /api/health | 200 / 200 | all four upstreams true; database ok |
| E03 | login R, R2, C | 200 x3 | roles RECRUITER, RECRUITER, CANDIDATE; GET /api/auth/session keys userId, role |
| E05 | POST /api/jobs (R) | 201 | job 36ee7f75-e4f2-4211-b617-e5191b5c74a4, published, title [T-0001 TEST] R-13 verify 2026-11-13T04:25:39.864Z. WRITE |
| E07/E08 | GET /api/jobs (C), GET /api/resume/status | 200 / 200 | 10 jobs incl. test job; hasResume true (earlier verifiers' object) |
| E09 | POST /api/resume/upload f1 | 201 | 396 ms, parsed: 15 skills, resume 1942b0ff-894c-4203-8d8e-92475c8e41f5. WRITE |
| E10 | POST /api/jobs/:id/apply | 201 | 1.86 s, scoring {status scored, reason null}, application 9bc06da8-c4ec-4437-88ec-5689c6bd3c40; core log: composite 84.84 band high github=github_user_not_found; preparation started with the apply's request id. WRITE |
| E15' | GET /api/recruiter/applications (R), and ?jobId= | 200 / 200 | item keys id,status,applied_at,job,candidate,score,scoring,assessment; composite 84.84, band high, evidence_limited true, 3 sub-score summaries, 15 skills, profile name and account email present, scoring.state scored, assessment.state preparing; no job location |
| E16' | GET /api/recruiter/applications/:id (R) | 200 | explanation (15 keys), weights sum 1, score_history 1, notes github_ownership + unproctored_assessment; no pool/key text |
| E16'' | R2: list, ?jobId=R's job, detail | 200 (without it) / 404 job_not_found / 404 not_found | |
| | C on list and detail; anonymous on both | 403 forbidden; 401 (gateway) | |
| | GET /api/candidates, GET /api/recruiter/applicants (R); POST /api/analyze (C) | 404 / 404 / 404 | removed (R-13, R-10) |
| E17 | GET /api/jobs/mine | 200 | applicationCount 1 for the test job; every job carries an integer count |
| | 18 recruiter reads in total | - | assessment-service log: exactly 1 /generate-assessment in the run before BL-27, request id = the apply's; core log: 1 assessment-prep line |
| E13' | GET /api/assessment/status until ready | 200 | preparing -> ready at 32.2 s after apply; each call <= 182 ms; R list then shows ready |
| | POST /api/assessment/start | 200 | 200 ms, 10 questions (6 mcq, 4 short_answer), model gemini-3.1-flash-lite, expires_at set; no key fields |
| | PUT /api/assessment/:id/answers | 200 | 74 ms, saved 5 |
| E13b | POST /api/assessment/evaluate (other 5 answers) | 200 | 2.68 s, score 10, scoring scored; no recruiter_feedback or key text in the candidate body |
| | R detail after evaluate | 200 | newest score 56.06 band low, assessment sub-score 10 at weight 0.3846, weights sum 1, history [56.06, 84.84], state completed, score_of_record set, 1 attempt with 10 results each carrying question and recruiter_feedback; list has no recruiter_feedback |
| E12 | GET /api/candidate-analysis (C) | 200 | credibilityScore 56.06, assessmentScore 10, no recruiter_feedback |
| | shortlist as R2; as R | 404; 200 | R: status shortlisted, notified true |
| E14 | GET /api/notifications (C) | 200 | 1 -> 2: exactly one new notification, type shortlisted, data.applicationId = the application |
| E18/E19 | logout R, R2, C | 200 x3 | |

Times: apply 1.86 s; pool ready 32.2 s after apply (service: generate 30.9 s, 1 round); start 0.20 s; evaluate 2.68 s. Model: gemini-3.1-flash-lite (generation and grading).

Observations (not baseline regressions):
- One upload + apply + evaluate wrote 4 resumes rows (NLP /parse called 4 times across upload, apply with its background preparation, and the re-score after evaluate). ISSUES.md already records that apply parses twice; the row per re-score is the same class.
- The service generates 10 questions per pool (served=10 in its log).

## Leftover live data (node tests/backend/sweep.mjs --check after stop-all, exit 1)
Added by this run: job 36ee7f75-e4f2-4211-b617-e5191b5c74a4 ([T-0001 TEST] R-13 verify 2026-11-13T04:25:39.864Z, owner t0001_recr); application 9bc06da8-c4ec-4437-88ec-5689c6bd3c40 (shortlisted); assessment 936c062f-9491-4698-a22e-65a33638658b (+ its assessment_keys row); scores 2; resumes 4; notifications 1; storage object replaced in place (count unchanged at 1).
Totals before -> after: jobs 6 -> 7, applications 6 -> 7, scores 12 -> 14, resumes 23 -> 27, assessments 4 -> 5, notifications 1 -> 2, storage candidates/C 1 -> 1. Nothing deleted.

## External calls
Gemini: 2 generations (1 background pool after apply, 1 direct BL-27 probe), 1 grading. GitHub API: 2 /v1/evidence calls (404, fixture account does not exist). Supabase: 3 test-account logins, the reads/writes above, 2 sweep --check runs.

## Side effects (git-ignored only)
frontend/build rebuilt (same file names); tests/.out start-all and harness logs; tests/.out/t0001-profile-snapshots.json rewritten by sweep --check. Raw logs and the live script are in the verifier's scratchpad (r13live.mjs, result.json, bl*.log, rs-*.log).
