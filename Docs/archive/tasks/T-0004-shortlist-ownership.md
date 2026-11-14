# T-0004 — shortlist-ownership

## Goal
A recruiter can change the status of an application only on a job they own; only the
two recruiter-settable statuses are accepted; and only the owner's action notifies the
candidate. Fixes I-0019.

## Spec ref
None in PROJECT_SOURCE_DOCS.md (authorization hardening). INTEGRATION_REVIEW.md R32; ISSUES I-0019.

## Scope
**In:**
- `shortlistCandidate` in `backend/Controllers/jobs.controller.js`: ownership check, 404 on no row, status allow-list.
- Shared live-test infrastructure (reused by T-0005..T-0007): second recruiter `t0001_recr2`, sweep/guards for it and for `notifications`, profile snapshot + `--restore-profiles`, `lib/session.mjs`.
- Account `t0001_recr2` (signup `anthonyjennisnadar+t0001recr2@gmail.com`, email confirmed via the Supabase admin API as in L-0003).

**Out:**
- `getAllApplicants` / `getAllCandidates` (already scoped by `recruiter_id`), any UI (no frontend caller of the route exists).
- Malformed (non-UUID) `applicationId` handling: if it 500s, log it in ISSUES.md rather than fix it here.
- The notifications route (T-0005).

## Acceptance criteria
1. Recruiter B (`t0001_recr2`) `POST /api/jobs/applications/shortlist {applicationId: <application on recruiter A's job>, status:'shortlisted'}` → 404; the row is still `submitted`; 0 notifications for the candidate — checked by `tests/backend/live-shortlist-authz.test.mjs` (service-role reads).
2. Same with `status:'rejected'` → 404, row unchanged — same file.
3. Control: recruiter A (`t0001_recr`) shortlists their own application → 200, row `shortlisted`, exactly 1 `shortlisted` notification for the candidate; and rejects another own application → 200, no notification — same file (passes before and after).
4. Well-formed but non-existent `applicationId` as A → 404 (today a 500) — same file.
5. Candidate session → 403 on the route — same file.
6. Status allow-list: as the owner, `status` of `'submitted'` (accepted today), `'withdrawn'`, `''`, `'SHORTLISTED'`, and a non-string (`{}`/`123`) → 400, row unchanged, no notification — same file. (Today only `'submitted'` gets past validation; the red run records what each value returns.)
7. After the file runs, `node tests/backend/sweep.mjs --check` → all 0, exit 0; `sweep.mjs --restore-profiles` run twice gives the same result (idempotent).
8. Full harness green: `powershell -File tests\run-suite.ps1 -Target current -Live` (NLP 10/10, tier 1, tier 2, new live file, CI frontend build with the 5 baseline warnings). Production code changed only in `jobs.controller.js`.

## Test plan
- Tests to write FIRST (must FAIL before, PASS after):
  - `tests/backend/live-shortlist-authz.test.mjs` — criteria 1, 2, 4, 6 (`submitted` row) fail today; 3, 5 and the other criterion-6 values pass today.
- Not automatable: none.

## Regression
`smoke.test.mjs`, `live-analyze.test.mjs`, NLP suite, frontend build, `sweep.mjs --check`.

## Risks and rollback
- Risk: the `jobs!inner(recruiter_id)` embed name must match the FK (proven by the red→green run). Dropping `'submitted'` removes a recruiter's ability to un-shortlist; no frontend uses the route, but I note it in the summary.
- Rollback: revert the controller block; the test infra is additive.

---

## Result
1. PASS — red `tests/.out/t0004-red.log`: B shortlisting A's application gave `{"http":200,"row":"shortlisted","notifications":1}`; green `tests/.out/t0004-green.log`: 404, row `submitted`, 0 notifications.
2. PASS — red: 200, row `rejected`; green: 404, row unchanged.
3. PASS — control passed in both runs (A shortlists → 200, row `shortlisted`, 1 `shortlisted` notification; A rejects → 200, row `rejected`, 0 notifications).
4. PASS — red: `HTTP 500 {"message":"Could not update application status."}`; green: 404.
5. PASS — candidate session → 403, row unchanged (both runs).
6. PASS — owner sending `"submitted"`: red 200 (accepted, `{"http":200,...}`), green 400. `"withdrawn"`, `"SHORTLISTED"`, `""`, `{$ne:'x'}`, `123` → 400, row `shortlisted`, no notification, in both runs (already rejected before the change).
7. PASS — `node tests/backend/sweep.mjs --check` exit 0, all counts 0 incl. `profile-missing:*`; `--restore-profiles` run twice printed the same `restored profiles: [t0001_cand, t0001_recr, t0001_recr2]` and zero counts.
8. PASS (frontend "same as before") — `run-suite.ps1 -Target current -Live` (`tests/.out/t0004-full-harness.log`): NLP 10/10; backend `tests 19 / pass 19 / fail 0` (7 smoke + 1 live-analyze + 11 new); frontend CI build exits 1 on exactly the 5 CreateJob.jsx/Jobs.jsx `no-unused-vars` warnings that T-0003 recorded (not new). Only `jobs.controller.js` changed in production code.

Not verified: the lookup-error 500 branch (cannot be forced live). Found, not fixed: malformed non-UUID id → 500 (I-0029).
