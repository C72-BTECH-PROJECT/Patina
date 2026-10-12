# T-0007 — analysis-isolation-guard

## Goal
Guard I-0022 (RESOLVED in T-0003, R14) against regression: one user's analysis is never served to another.
No production code changes. There is no failing run — the test passes at HEAD, and the Result says so.

## Spec ref
NFR (data privacy), CHECKLIST 0.2 @32905c1; ISSUES I-0022.

## Scope
**In:** a live test; second candidate `t0001_cand2` (signup `anthonyjennisnadar+t0001cand2@gmail.com`, admin-confirmed, same guards), sweep coverage for it (scores/resumes/applications/storage/notifications); an ISSUES.md note on I-0022.
**Out:** any controller change.

## Acceptance criteria
1. `t0001_cand` analyzes `f1_dev_github.pdf` (live NLP) → 200 with `candidateId = C`; then `t0001_cand2` `GET /api/candidate-analysis` → 404 "No analysis yet", and the response never contains C's id, name, email or skills — `tests/backend/live-analysis-isolation.test.mjs`.
2. `t0001_cand` `GET /api/candidate-analysis` → 200 with `candidateId = C`.
3. Recruiter session → 403 on `/api/candidate-analysis`; `t0001_recr2` (no jobs) `GET /api/recruiter/applicants` → `[]`.
4. `grep -n "allAnalyses\|latestAnalysis" backend/Controllers/analysis.controller.js` → nothing; output recorded.
5. `sweep.mjs --check` covers `t0001_cand2` and is all 0 after the run; full harness green. I-0022 in ISSUES.md gets a note pointing at the guard (status stays RESOLVED).

## Test plan
- Write FIRST: `tests/backend/live-analysis-isolation.test.mjs`. Expected: passes immediately (no red). To show the test can fail, I do a mutation check in a scratch copy of the controller logic only if cheap; otherwise I state that it is unverified as a detector.

## Regression
All prior live files, tier 1/2, NLP, frontend build, sweep `--check`.

## Risks and rollback
- Risk: adds a live NLP call to the suite (slower). Rollback: delete the test file and the cand2 sweep entries.

---

## Result
(filled at the end)
