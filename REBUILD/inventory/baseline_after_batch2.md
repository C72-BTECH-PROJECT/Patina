# Batch smoke after batches 1+2 (R-01..R-08, R-20) vs REBUILD/inventory/baseline.md section 6

Run 2026-11-12 ~22:00-22:40 IST, branch rebuild/fable (HEAD 6da8d3f + dirty working tree, unchanged by this run: git status --short identical before/after; tests/nlp/snapshots SHA-256 identical before/after).
Core started by start-all with a fake SESSION_SECRET in the process env (backend/.env not opened). Services started/stopped only via scripts/start-all.ps1 and stop-all.ps1; six ports free before and after; no Patina node/python/cmd process left.

## Verdict: NOT BELOW BASELINE
Improved 5 / same 15 / different by design 7 / worse 0 / not run 5 (total 32).
Caveat: BL-11 keeps 11 problems but one of them is new and caused by the rebuild (see row).

| ID | Baseline | Today | Class | Observed today |
|---|---|---|---|---|
| BL-01 | PASS | PASS | same | v24.12.0 / 11.13.0 / Python 3.14.0 |
| BL-02 | PASS | PASS | same | nlp venv loads en_core_web_sm; root .venv still OSError E050 |
| BL-03 | PASS | PASS | by design | 200 status running, version 2.0.0, parser_version nlp-engine@2.0.0; bind 127.0.0.1:8000; all 5 services up in 16 s via start-all |
| BL-04 | PASS | PASS | same | 200 status ok, contract_version 1, token_configured true; 127.0.0.1 |
| BL-05 | PASS | PASS | by design | 200 status healthy plus llm_configured true; 127.0.0.1 |
| BL-06 | PASS | PASS | by design | 200 status ok, checks.database ok; bind 127.0.0.1:5001 only (baseline: all interfaces) |
| BL-07 | PASS | PASS | same | 200 status ok, all four upstreams true; gateway still on all interfaces (public entry) |
| BL-08 | PASS | PASS | same | start-all with frontend: 0.0.0.0:3000, GET / 200, /login 200, Compiled successfully |
| BL-09 | PASS (9 warn) | PASS (9 warn) | same | exit 0, 47 s, same 9 no-unused-vars, main.7adf8bda.js 266.87 kB (identical bundle name) |
| BL-10 | FAIL | FAIL | same | exit 1, Treating warnings as errors / Failed to compile, same 9 warnings |
| BL-11 | FAIL (11) | FAIL (11) | same, composition changed | Fixed: CLAUDE.md names REBUILD/DECISIONS.md, which now exists. Still: 10 ARCHITECTURE.md cites into backend/Routes/auth.routes.js (file now 27 lines). NEW, caused by the rebuild: AUDIT.md row 5.15 cites backend/Controllers/analysis.controller.js:531-602; the file shrank from 602 lines (HEAD) to 590 (working tree) |
| BL-12 | PASS 80 | PASS 86 | improved | 86 passed, 3 warnings, 0 skipped, 24 s |
| BL-13 | PASS 12 | PASS 66 | improved | 66 passed, 0 skipped, 5 s |
| BL-14 | FAIL (port) | PASS | improved | run-suite -Suites backend: exit 0, tests 122 pass 122 fail 0 skipped 0, 44 s; ports freed |
| BL-15 | PASS 99 | PASS 122 | same (superset) | covered by BL-14: the harness runs all 11 BL-15 files plus error-contract and auth-session against core 127.0.0.1:5001 |
| BL-16 | FAIL 7/11 (expected) | FAIL 11/14 (expected) | same | 3 failures, all gateway deny-by-default 401 on unknown routes (unknown route 404, I-0027 POST 404, R-03 expects not_found). The two assessment-401 failures of baseline now pass |
| BL-17 | PASS 11 | PASS 40 | by design | 40 passed, 3 deselected (private), 51 s; writes redirected to scratch. f1-f5 skills/exp/edu/proj/github/match/similarity/tokens identical to baseline section 3.3. f6 now HTTP 422 unreadable_document. Fresh snapshots byte-identical to working-tree tests/nlp/snapshots/current (which already differ from HEAD: 6 files, +20 -62, rebuild change). Also tests/eval: 10 passed |
| BL-18 | PASS 12 | PASS 12 | same | tests 12 pass 12 |
| BL-19 | PASS 14 | PASS 29 | improved | run-suite -Suites gateway: tests 29 pass 29 skipped 0 (27 offline + 2 live), 13 s |
| BL-20 | FAIL | PASS | improved | cd gateway; npm test: tests 27 pass 27 (script now lists 4 offline files) |
| BL-21 | PASS before / FAIL after | same | same | before: all 0, exit 0. after: jobs 1, applications 1, resumes 1, scores 1, storage C 1, storage candidates/C 1, notifications 0, assessments 0, profiles all present; exit 1 |
| BL-22 | PASS | PASS | by design | 401 body source gateway, error unauthorized, message You need to sign in., requestId; plus helmet and RateLimit headers |
| BL-23 | PASS (exposure) | PASS | by design (improved) | LAN address port 5001: connection refused (curl exit 7). 127.0.0.1:5001 and localhost:5001: 401 message Not authenticated, error unauthorized, requestId. Gateway on LAN port 5000 /health: 200 |
| BL-24 | PASS | PASS | same | 204, ACAO http://localhost:3000, Allow-Credentials true |
| BL-25 | PASS | PASS | same | E01-E12 and E14-E19 all 200/201 via port 5000; analyze 1.26 s, score 84.84 Strong Match, evidenceLimited true, weights github 0 / assessment 0 / parsing 1, github reason: account does not exist (core log github_user_not_found); new E04b GET /api/auth/session 200 with role,userId |
| BL-26 | FAIL (no key) | FAIL (provider) | same status, different cause | see E13: request reached the service; Gemini failed (503, 503, timeout 174 s); service 502 llm_unavailable at about 210 s; core 502 after 210268 ms; client gave up at 180 s with no response |
| BL-27 | FAIL (no key) | NOT RUN | not run | direct probe not run: the baseline payload is valid under the new schema and would spend the single allowed live Gemini call. Same endpoint seen via E13 in the service log: POST /generate-assessment 502, error llm_unavailable |
| BL-28 | NOT RUN | NOT RUN | not run | blocked by E13 (no assessment generated) |
| BL-29 | NOT RUN | NOT RUN | not run | per brief |
| BL-30 | NOT RUN | NOT RUN | not run | per brief |
| BL-31 | NOT RUN | NOT RUN | not run | per brief |
| BL-32 | PASS(shape)/absent | 422 | by design | /parse f6_image_only.pdf (with and without jd): 422 error unreadable_document, reason no_text_layer, message says OCR is not available |

## End-to-end smoke through the gateway (port 5000), accounts t0001_recr / t0001_cand, fixture f1_dev_github.pdf, dev JD
| Step | Request | Status | error | Fact |
|---|---|---|---|---|
| E01 | GET /health | 200 | - | ok, 4 upstreams true |
| E02 | GET /api/health | 200 | - | ok, checks.database ok |
| E03 | POST /api/auth/login (R) | 200 | - | user, cookie issued, RECRUITER, 595 ms |
| E04 | GET /api/auth/me (R) | 200 | - | RECRUITER |
| E04b | GET /api/auth/session (R, new) | 200 | - | keys role,userId |
| E05 | POST /api/jobs | 201 | - | job e7e50a21-cbe5-4f0a-a12e-8dfb78eda9b8, published, title [T-0001 TEST] rebuild batch smoke 2026-11-12. WRITE |
| E06 | POST /api/auth/login (C) | 200 | - | cookie issued, CANDIDATE |
| E07 | GET /api/jobs (C) | 200 | - | 4 jobs, test job visible |
| E08 | GET /api/resume/status | 200 | - | hasResume false |
| E09 | POST /api/resume/upload | 200 | - | fileName,message,size. WRITE |
| E10 | POST /api/jobs/:id/apply | 201 | - | application row. WRITE |
| E11 | POST /api/analyze | 200 | - | 1264 ms; NLP /parse 200 once; github-evidence /v1/evidence 404 github_user_not_found; score 84.84 Strong Match (read back). WRITE |
| E12 | GET /api/candidate-analysis | 200 | - | 84.84, Strong Match, evidenceLimited true; explanation keys identical to baseline |
| E13 | POST /api/assessment/generate | client: none (aborted at 180 s); core: 502 at 210 s | core body per code: bad_gateway; service: llm_unavailable | gateway log: aborted 180338ms. Service: gemini-3.1-flash-lite 503, gemini-3.5-flash-lite 503, gemini-3.8-flash timed out after 174s. No assessments row. Not retried |
| E13b | POST /api/assessment/evaluate | NOT RUN | - | depends on E13 |
| E14 | GET /api/notifications | 200 | - | unread 0 |
| E15 | GET /api/candidates (R) | 200 | - | 1 entry for test job, score 84.84 |
| E16 | GET /api/recruiter/applicants | 200 | - | 1 entry, same 10 keys as baseline, score 84.84 |
| E17 | GET /api/jobs/mine | 200 | - | 1 job |
| E18/E19 | POST /api/auth/logout x2 | 200 | - | message |
Plus two read-only follow-ups (candidate login, GET /api/candidate-analysis, logout: all 200).

Pipeline today: login, job, upload, apply, analyze (NLP + github-evidence), score and recruiter views all work through the gateway. Generate now gets past core into the assessment service (payload accepted by the new schema, Gemini called) and fails at the LLM provider. Evaluate and the assessment-weighted score were not reached.

Observations for batch 3 (not baseline regressions):
- Generate wall time can reach about 210 s (service budget assessment-service/app/config.py:43 = 210 s; core 300 s; gateway 310 s), not about 90 s.
- Core maps any service bad_status to message Assessment generation failed, error bad_gateway, hiding llm_unavailable (backend/Services/assessmentService.js:32).
- Stale doc cite introduced by the rebuild: AUDIT.md row 5.15 cites backend/Controllers/analysis.controller.js:531-602 (BL-11).

## Leftover live data (node tests/backend/sweep.mjs --check after stop-all, exit 1)
jobs 1 (e7e50a21-cbe5-4f0a-a12e-8dfb78eda9b8, title [T-0001 TEST] rebuild batch smoke 2026-11-12, published, owner t0001_recr); applications 1; resumes 1; scores 1; storage resumes/C/ 1; storage resumes/candidates/C/ 1; notifications 0; assessments 0; C2 storage 0; all four t0001 profiles present. Nothing deleted.

## External calls
GitHub API: 1 /v1/evidence (example-mokafor, 404). Gemini: 1 generate request (3 model attempts inside the service), 0 evaluate. Supabase: 4 test-account logins, the reads/writes above, 2 sweep --check runs.

## Side effects (git-ignored only)
frontend/build rebuilt (same file names); tests/.out harness and start-all logs; tests/.out/t0001-profile-snapshots.json rewritten by sweep --check. tests/eval was run with -p no:cacheprovider (no .pytest_cache).
Raw logs in the same scratchpad folder: bl*.log, smoke/, logs-run1/, logs-run2/.
