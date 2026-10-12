# T-0003 — apply-integration

## Goal
Apply the owner and team decisions recorded in INTEGRATION_REVIEW.md (R1–R41, §11 Q1–Q6)
to the working tree. The order follows the review's §9. Where these rows say so, the
baseline `32905c1` behaviour comes back (NLP fixes, persisted explainable scoring,
token-gated reset, migration, docs). Teammate work that the rows keep stays.

## Spec ref
- FR-1, FR-2, FR-12, FR-13, FR-14 and NFR-5 (PROJECT_SOURCE_DOCS.md): parsing, persisted explainable score, recruiter ranking.
- NFR-8 area (authentication: I-0018).
- CLAUDE.md guide feedback #5 (explainability).

## Mechanism (owner-approved)
- **Phase 1:** `git revert --no-commit 314e494`, then `git reset -q` (mixed, no paths).
  Nothing is staged and REVERT_HEAD is cleared. Then hand-merges.
- **Never:** revert a merge commit, rewrite history, commit, push, or stage.
- **Simulation:** `git merge-tree` against `4ed559d` gave 1 conflict (recruiter
  `Dashboard.jsx`) and 40 changed files. HEAD is now `9d76bb8`, which adds docs and
  test snapshots only.

## Scope
**In** (by phase; INTEGRATION_REVIEW.md §9 order):
- **Phase 1 (§9 step 1, step 3 as verification only):**
  - the revert, which covers R16–R26 and R28;
  - Dashboard resolved to the `32905c1` side, plus 04835ca's loader block (R38, R2);
  - hand-merges:
    - `supabase.js` (R5, R12);
    - `supabaseAuth.js`, lazy (R6);
    - `auth.controller.js` (R13 + R6);
    - `analysis.controller.js` (R14, R29, R8; R7/R30 hunks carried unchanged).
- **§9 step 2 (security):** skipped. R32, R34 and R35 belong to Prompt 4b.
- **Phase 3 (§9 step 4):**
  - R7 fixes;
  - R10 fixes (storage error, env var);
  - R11.
- **Phase 4 (§9 steps 5–6):**
  - R30 fixes 1, 2, 4 and 5;
  - R31 delete;
  - R33 env var;
  - R39 delete;
  - `import.meta.env` check.
- **Close-out:**
  - ISSUES.md updates;
  - Result;
  - WORKLOG.

**Out:**
- R32, R34 and R35 (I-0019, I-0020, I-0021): Prompt 4b, test-first.
- R40 (tracker task). I-0016 (signup). I-0026 (Landing). Score-on-apply. The merged recruiter Dashboard (R38 follow-up).
- Lint cleanup. The only exception is the owner rule: in files this task already touches, remove unused imports and variables that cause *new* warnings. Other new warnings are listed in Result and logged in ISSUES.md.
- Migration idempotency (R19 and R33 "with the I-0010 batch"). Both migrations stay verbatim.
- The hardcoded `localhost:5000` URLs not covered by a row (I-0012 remainder).
- Content edits to AUDIT.md and CHECKLIST.md, which are restored verbatim (R24, tracker task).
- `npm install` / lockfile regeneration.
- R2's optional logout warning, and R10's "store score id on application" (score-on-apply).

## Acceptance criteria
1. **NLP snapshots.**
   - **Check:** `sha256` of `tests/nlp/snapshots/current/f1..f6.json` equals
     `tests/nlp/snapshots/baseline/` for all 6. Baseline prefixes:
     - `4338e6ca`
     - `11399a83`
     - `81d92b5e`
     - `047bd608`
     - `72d51441`
     - `c6276fb1`
   - The 3 private snapshots also match `tests/private/snapshots/baseline/`.
   - No decided row changes parser output: R17 restores the NLP byte-identical to `32905c1`, so the expected diff is **none**.
   - `git diff 32905c1 -- nlp-engine` must be empty.
   - **Checked by:** `run-suite.ps1 -Target current` (nlp), then `sha256sum`.
2. **Backend tier 1** is 7/7 after every phase.
   - **Checked by:** `run-suite.ps1 -Target current -Suites backend -Live` → `smoke.test.mjs`.
3. **Backend tier 2 (live analyze)**, after every phase:
   - returns 200 with keys `id, resumeId, candidateId, jobId, credibilityScore, subScores, weights, explanation, extractedSkills`;
   - teardown removes 1 score, 1 resume and 1 storage object.
   - **Checked by:** `live-analyze.test.mjs` via `-Live`.
4. **Sweep:** `node tests/backend/sweep.mjs --check` is all 0 with exit 0, before Phase 1 and after every phase.
5. **CI build** (`CI=true npm run build`): no warnings beyond the baseline's 6, except those listed in Result and logged in ISSUES.md.
   - **Baseline 6:**
     1. `Upload.jsx:71` SkillsSelector (expected to disappear with R9's Upload)
     2. `CreateJob.jsx:4` Plus
     3. `CreateJob.jsx:4` X
     4. `Jobs.jsx:4` MapPin
     5. `Jobs.jsx:4` Users
     6. `Jobs.jsx:4` Sparkles
   - **Expected final state:** exactly the 5 CreateJob/Jobs warnings.
   - The build still exits 1, as the baseline did. This is judged on the warning set, not the exit code.
   - **Checked by:** `run-suite.ps1` frontend log.
6. **I-0009 resolved:**
   - criterion 3 passes;
   - `analysis.controller.js` imports `path` and looks up `job` before NLP and storage;
   - `git grep -n "allAnalyses\|latestAnalysis" backend` is empty, which also resolves I-0022.
7. **I-0018 resolved:**
   - `git grep -n "update-password\|updateUserById\|updatePassword" backend frontend/src` is empty;
   - live `POST /api/auth/update-password` → 404;
   - `POST /api/auth/reset-password {}` → 400, not 200.
8. **Rows applied exactly as decided, nothing else:**
   - every REVERT / KEEP-WITH-FIX row in scope has a Result line with evidence;
   - `git diff --stat` is recorded per phase;
   - a file outside a phase's expected list is a FAIL.
9. **Out-of-scope code untouched:**
   - `shortlistCandidate`, `/notifications/send` and the fail-open body of `requireAuth` stay as at HEAD. The only exception is the revert's `requireRole` `await` → `return` hunk.
   - **Checked by:** `git diff HEAD --` on those files.
10. **R6 auth client**, checked by grep and a live probe:
    - `git grep` shows `createUserScopedClient` defined once and called only inside `resetPassword`;
    - `getSupabaseAuth()` is used only for `.auth.*` calls: a `git grep` for `getSupabaseAuth().from` / `.storage`, and for any variable holding it used with `.from(` or `.storage`, is empty;
    - with `SUPABASE_ANON_KEY` unset, the backend boots and `GET /api/health` → 200;
    - `POST /api/auth/login` then fails with a clean 5xx JSON error, not a crash. The env is restored afterwards.
11. **Dependencies after Phase 1:**
    - `npm ls --depth=0` in `backend/` and `frontend/` is recorded;
    - missing packages = FAIL;
    - extraneous `mongoose` is fine.

**At each phase stop:** print a suggested commit split with exact `git add` paths. Restored
files are untracked, so `commit -a` would miss them.

## Test plan
- **Tests written first:** none. This task restores or ports already-reviewed code. The harness
  (`tests/run-suite.ps1`, T-0001) is the regression oracle. Its tier 2 currently FAILS at HEAD
  (500 `path is not defined`) and must PASS after Phase 1.
- **Ad-hoc probes** (criteria 7 and 10): `curl` against a backend started briefly on a free port.
- **Can't be automated here:**
  - browser behaviour of the restored pages (no UI tests);
  - `tests/MANUAL_SMOKE.md` is left to the owner.

## Regression
- `tests/run-suite.ps1 -Target current -Live` (nlp, backend tiers 1+2, frontend) after every phase.
- `node tests/backend/sweep.mjs --check`.

## Risks and rollback
- **Risk:** the hand-merged `analysis.controller.js` and `auth.controller.js` are the riskiest edits; tier 1/2 and the criterion 7/10 probes cover them.
- **Risk:** the singleton auth client holds the last signed-in session in memory. The team accepted this (R6), and the service client is pinned (R5).
- **Risk:** the lockfile changes come from the revert without `npm install`; criterion 11 checks this.
- **Rollback:** nothing is committed. `git checkout -- . && git clean -fd -- <restored paths>`, or the owner simply doesn't commit the phase.

---

## Result
<Filled per phase below; final per-criterion lines at close-out.>

### Pre-flight (2026-10-12)
- **Working tree:** clean at `9d76bb8` ("integration review and plan": docs + `tests/nlp/snapshots/current/` only, so the merge-tree simulation still holds).
- **Ports:** 3000, 5000 and 8000 were free, so the standard `run-suite.ps1 -Target current` ran without the port deviation.
- **`sweep.mjs --check` before Phase 1:** all 0, exit 0.

### Phase 1: §9 step 1 (+ step 3 verification), 2026-10-12

**Applied**
- **Revert:** `git revert --no-commit 314e494` hit 1 conflict (`frontend/src/pages/recruiter/Dashboard.jsx`), exactly as simulated. It auto-merged `jobs.controller`, `auth.Middleware`, `index.js`, `App.jsx`, `AuthContext` and `Login`.
- **Index reset:** `git reset -q` left nothing staged; `.git/REVERT_HEAD` and `.git/sequencer` are absent.
- **Dashboard.jsx (R38 + R2):** `git restore --source=32905c1 --worktree`. The loader block was then swapped for 04835ca's (`min-h-[400px]`, `<Spinner size="lg" />`, "Loading dashboard..."). The diff against `32905c1` is those 3 lines only.
- **supabase.js (R5/R12):** restored from `32905c1`, byte-identical (`git hash-object` = `32905c1` blob). There is no `slice(` in the file, so no key material is logged. The boot log shows `service client key role: service_role`.
- **supabaseAuth.js (R6):** a lazy `getSupabaseAuth()`. It validates `SUPABASE_URL`/`SUPABASE_ANON_KEY` on first call and uses `persistSession:false, autoRefreshToken:false`. Nothing throws at import.
- **auth.controller.js (R13 + R6):** the `32905c1` file with these changes only:
  - an import of `getSupabaseAuth`;
  - signup, login and resend take their client from `getSupabaseAuth()`;
  - `requestPasswordReset` calls `getSupabaseAuth().auth.resetPasswordForEmail`;
  - the signOut lines in signup and login are removed;
  - the comment is updated;
  - `resetPassword` keeps `createUserScopedClient()`.
- **analysis.controller.js (R14, R29, R8):** the `32905c1` file plus HEAD's `pruneOldResumes`, `saveResumeToStorage`, `getMyResumeStatus` and `uploadResume` (inserted before `analyzeResume`), and `getAllApplicants` (appended), all verbatim.
  - `git diff --numstat 32905c1` shows `197 0`: additions only, 104 + 93 HEAD lines.
  - The in-memory globals, `safeMatchLevel` and ad4f694's `getAllCandidates` are gone.
- **Byte-identical to `32905c1`** (`git hash-object` check):
  - `auth.routes.js`, `ResetPassword.jsx`, `explainability.js`, `ScoreBreakdown.jsx`, `CandidateModal.jsx`;
  - `Results.jsx`, `Processing.jsx`, recruiter `JobDetails.jsx`;
  - `20260903_create_resumes_and_scores.sql`, `AUDIT.md`, `CHECKLIST.md`, `Docs/project_checklist.md`;
  - `git diff 32905c1 -- nlp-engine`: empty.

**`git diff --stat HEAD`** (tracked; restored files are untracked):
```
 Docs/Architecture.md (D) 48 · README.md 5 · backend/Config/supabase.js 48 · backend/Config/supabaseAuth.js 39
 backend/Controllers/admin.controller.js 7 · analysis.controller.js 488 · auth.controller.js 199
 backend/Controllers/{candidate,recruiter}.js (D) 0 · jobs.controller.js 15 · Middlewares/auth.Middleware.js 2
 backend/Models/{Application,Candidate,Job,Recruiter}.Model.js (D) 102/19/30/25 · Routes/auth.routes.js 44
 Routes/parse.routes.js (D) 83 · index.js 13 · package-lock.json 205 · package.json 1 · frontend/package-lock.json 116
 App.jsx 2 · CandidateModal.jsx 403 · AuthContext.jsx 2 · data/recruiter/mockData.js (D) 624 · admin/Dashboard.jsx 18
 CandidateJobs.jsx 2 · JobDetail.jsx 4 · Processing.jsx 398 · Results.jsx 494 · Login.jsx 2 · ResetPassword.jsx 248
 recruiter/Dashboard.jsx 744 · recruiter/JobDetails.jsx 556 · recruiter/Jobs.jsx 2
 nlp-engine/app/{embedder,main,ner}.py 72/23/529 · tests/nlp/snapshots/current/f1..f6.json (harness output)
 44 files changed, 2788 insertions(+), 3317 deletions(-)
untracked (restored): AUDIT.md, CHECKLIST.md, Docs/project_checklist.md, backend/Services/explainability.js,
 frontend/src/components/recruiter/ScoreBreakdown.jsx, supabase/migrations/20260903_create_resumes_and_scores.sql
```
Count: 38 tracked code/doc files + 6 restored = 44, which is the 40 simulated files + 4 hand-merged. No unexpected file. The 6 snapshot files are harness output that now equals baseline.

**Suites:** `run-suite.ps1 -Target current -Live`, log `tests/.out/t0003-p1-run.log`.

| Criterion | Result | Evidence |
|---|---|---|
| 1 NLP | **PASS** | `10 passed in 4.52s`. f1–f6 sha256 = baseline (`4338e6ca…`, `11399a83…`, `81d92b5e…`, `047bd608…`, `72d51441…`, `c6276fb1…`), all MATCH. Private 1–3 MATCH. `git diff 32905c1 -- nlp-engine` is empty. |
| 2 Tier 1 | **PASS** | 7/7 (health, 404, login {} 400, signup {} 400, unknown user 401 no cookie, analyze 401, jobs 401) |
| 3 Tier 2 | **PASS** (was FAIL at HEAD) | `✔ POST /api/analyze forwards to NLP and returns the scored candidate (3721ms)`. `tests 8 / pass 8`. Teardown removed scores 1, resumes 1, jobs 1, `storage:<C>/` 1. Remaining after teardown: all 0. |
| 4 Sweep | **PASS** | `--check` before Phase 1: all 0. After the run: exit 0. |
| 5 CI build | as expected, open until Phase 4 | Exit 1 with 6 warnings: CreateJob Plus/X, Jobs MapPin/Users/Sparkles (baseline), plus `CandidateLayout.jsx:11 'user'` (ad4f694; removed in Phase 4 under the owner lint rule). The baseline `Upload.jsx` SkillsSelector warning is gone. Down from 21 at HEAD. |
| 6 I-0009 | **PASS** | Tier 2 is 200. `analysis.controller.js:2` imports `path`. The job lookup (`analyzeResume`, `.from('jobs')…maybeSingle()`) runs before the NLP fetch and the storage upload. `grep "allAnalyses\|latestAnalysis" backend`: no hits. |
| 7 I-0018 | **PASS** | The grep for `update-password\|updateUserById\|updatePassword` in backend and frontend/src finds nothing. Live on :5300: `POST /api/auth/update-password` → **404**; `POST /api/auth/reset-password {}` → **400** `"New password must be at least 8 characters."` |
| 9 Out of scope | **PASS** | `git diff HEAD` on `notification.routes.js`: none. `jobs.controller.js` diff has no `shortlist` lines (only R16's `applied` hunk). `auth.Middleware.js`: only `await`→`return` in `requireRole`. |
| 10 R6 | **PASS** | `createUserScopedClient` is defined once (`auth.controller.js:23`) and called once (`:175`, inside `resetPassword`). `getSupabaseAuth` is called only at `:85`, `:138`, `:230`, `:322`, always followed by `.auth.*`. The grep for `(getSupabaseAuth()\|authClient).(from\|storage)` finds nothing. With `SUPABASE_ANON_KEY` removed from `backend/.env`: boot OK, `/api/health` 200, `POST /api/auth/login` (existing test user) → `500 {"message":"Authentication is not configured correctly. Set SUPABASE_ANON_KEY in backend/.env."}`, `/api/health` 200 again, process alive. `.env` was restored and its sha256 equals the original. |
| 11 deps | **PASS** | `npm ls --depth=0` exits 0 in both trees, nothing missing. Backend: supabase-js 2.112.3, bcrypt, cors, dotenv, express-session, express 5.2.1, form-data, multer, node-fetch, nodemon (`mongoose` not even listed as extraneous). Frontend: 16 deps, react-scripts 5.0.1, react 19.2.5, recharts, lucide-react, etc. |

**Observed (expected at this phase; R11 is Phase 3):** during the first probe attempt, a second backend
started on the same port printed "Could not start: port 5300 is already in use" and then **stayed
alive** (PID 21784, no listening port). That is I-0023's current behaviour. I stopped it by hand.

**New finding:** I-0027 (the 404 handler always says "Cannot GET"; also at baseline; P3).

**Owner commit:** Phase 1 was committed as `a7c74e4` ("restore scoring, NLP, auth reset, migration, docs").

### Phase 3: §9 step 4, Aaron's flow (R7, R10, R11), 2026-10-12
(§9 step 2, the security fixes R32/R34/R35, is skipped: out of scope, Prompt 4b.)

**Applied**
- **R7** (`analysis.controller.js`):
  - `saveResumeToStorage` uses `contentType: resolveContentType(file)` instead of `file.mimetype || 'application/pdf'`;
  - `getMyResumeStatus` reads the `error` from `storage.list` and returns 500 (logged via `logPersistenceError`);
  - `uploadResume` accepts only extensions in `MIME_BY_EXT` (`.pdf`/`.docx`), replacing the mimetype-OR-extension check.
  - (R7(2) "return 500 on a storage error" for `uploadResume` was already in place: `saved === false` → 500.)
- **R10:**
  - `jobs.controller.applyToJob` returns 500 on a `storage.list` error instead of "upload your resume first";
  - `JobDetail.jsx:6` and `Upload.jsx:16` use `process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'`;
  - score id on the application: not added (score-on-apply follow-up).
- **R11** (`index.js`):
  - the listen `error` handler calls `process.exit(1)`, both for EADDRINUSE and other listen errors, since both mean no server;
  - `uncaughtException` logs, then `process.exit(1)`;
  - the 15 s watchdog `setInterval` was removed;
  - the listen split, the `unhandledRejection` logger and the graceful shutdown were kept.

**`git diff --stat HEAD`** (exactly the expected 5 files):
```
 backend/Controllers/analysis.controller.js | 22 ++++++++++++----------
 backend/Controllers/jobs.controller.js     |  7 ++++++-
 backend/index.js                           | 30 +++++-------------------------
 frontend/src/pages/candidate/JobDetail.jsx |  2 +-
 frontend/src/pages/candidate/Upload.jsx    |  2 +-
 5 files changed, 25 insertions(+), 38 deletions(-)
```
The snapshot files were rewritten by the harness with identical content, so there is no diff.

**Suites:** `run-suite.ps1 -Target current -Live`, log `tests/.out/t0003-p3-run.log`.

| Criterion | Result | Evidence |
|---|---|---|
| 1 NLP | **PASS** | `10 passed in 4.17s`. f1–f6 and private 1–3 sha256 = baseline (all MATCH). |
| 2 Tier 1 | **PASS** | 7/7 |
| 3 Tier 2 | **PASS** | `✔ POST /api/analyze … (4610ms)`, `tests 8 / pass 8`. Teardown removed scores 1, resumes 1, jobs 1, `storage:<C>/` 1. Remaining all 0. |
| 4 Sweep | **PASS** | All 0 before the run (Phase 1 end), after teardown, and after the probes. `--check` exit 0. |
| 5 CI build | unchanged, as expected | The same 6 warnings as Phase 1 (5 baseline + `CandidateLayout.jsx:11`, due in Phase 4). No new warning from `JobDetail.jsx` or `Upload.jsx`. |

**Probes** (scratch `probeP3.ps1`, backend on :5300, run after the harness):
- **R11:** a second backend started on the busy port exits within 20 s with **exit code 1**. Stderr: "Could not start: port 5300 is already in use…". In Phase 1 the same scenario left a zombie process.
- **R7**, as `t0001_cand`, logged in with 200:
  - `.txt` upload → **400** "Only PDF or DOCX resumes are supported.";
  - `f2_dev_github.docx` sent as `application/octet-stream` → **200**, stored, so the content type was resolved from the extension (the bucket allows only pdf/docx);
  - `GET /api/resume/status` → `{"hasResume":true,"fileName":"resume.docx",…}`;
  - sweep removed `storage:candidates/<C>/` 1, then `--check` all 0.
- **Not exercised live:** the storage-error → 500 branches in `getMyResumeStatus` and `applyToJob` (that would need a simulated storage outage). The evidence is the diff above.
- No `node.exe` processes were left running afterwards.

**Remaining `import.meta.env`:** `CandidateLayout.jsx:7` and `Notifications.jsx:6` only (R33, Phase 4).

**Owner commit:** Phase 3 was committed as `e9e4592`.

### Phase 4: §9 steps 5–6, ad4f694 keepers (R30, R31, R33, R39) + env check, 2026-10-12

**Applied**
- **R30** (`getAllApplicants`):
  - fix 1: the 4 `[DEBUG]` logs are removed (the failure log stays, without the prefix). The duplicate handler was already resolved in Phase 1: baseline `getAllCandidates`, with ad4f694's rewrite gone.
  - fix 2: `credibilityScore` is `null` when there is no score row (was `Number(… ?? 0)`).
  - fix 3: already satisfied by R19 (the `scores` migration is restored).
  - fix 4: the score read adds `.order('created_at',{ascending:false}).limit(1)` before `.maybeSingle()`.
  - fix 5: one `profiles` query (`select('id, first_name, last_name').in('id', candidateIds)`) with no `email`. The per-row `auth.admin` fallback now runs only for candidates without a profile row.
  - **Judgment call:** a failed profiles query now returns 500 ("Failed to load applicant profiles"), matching the handler's jobs/applications errors. The old per-row `try/catch` never saw supabase errors (they are returned, not thrown).
- **R31:** `getAllApplications` was deleted from `jobs.controller.js`, and its import and the `GET /applications` route were removed from `jobs.routes.js`. The shortlist route stays (R32 deferred). Its only caller, ad4f694's Dashboard fetch, went in Phase 1 (R38).
- **R33:** `CandidateLayout.jsx:7` and `Notifications.jsx:6` now use `process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'`. Migration idempotency is deferred to the I-0010 batch.
- **Owner lint rule:** `CandidateLayout.jsx:11` `const { logout, user }` became `const { logout }`. `user` had no other use in the file (grep).
- **R39:** deleted `frontend/src/Recruiter/{AlertDashboard,CandidateRanking,components/ScoreExplainability}.jsx`; the directory is now empty and gone.
  - A grep found no importers outside the trio.
  - `CandidateRanking.jsx:7` still imported `../data/recruiter/mockData`, which was deleted in Phase 1. Unreachable files aren't bundled, so the build never saw that import.
- **§9 step 6:** `grep -rn "import.meta.env" frontend/src` finds nothing. **PASS**

**`git diff --stat HEAD`** (the expected 8 files + ISSUES.md for I-0028):
```
 ISSUES.md                                          |  15 ++
 backend/Controllers/analysis.controller.js         |  38 +--
 backend/Controllers/jobs.controller.js             |  77 ------
 backend/Routes/jobs.routes.js                      |   2 -
 frontend/src/Recruiter/AlertDashboard.jsx          | 283 ---------------------
 frontend/src/Recruiter/CandidateRanking.jsx        | 268 -------------------
 .../Recruiter/components/ScoreExplainability.jsx   | 261 -------------------
 .../src/components/layouts/CandidateLayout.jsx     |   4 +-
 frontend/src/pages/candidate/Notifications.jsx     |   2 +-
 9 files changed, 38 insertions(+), 912 deletions(-)
```

**Suites:** `run-suite.ps1 -Target current -Live`, log `tests/.out/t0003-p4-run.log`.

| Criterion | Result | Evidence |
|---|---|---|
| 1 NLP | **PASS** | `10 passed in 3.01s`. f1–f6 and private 1–3 sha256 = baseline. |
| 2 Tier 1 | **PASS** | 7/7 |
| 3 Tier 2 | **PASS** | `✔ POST /api/analyze … (2945ms)`, `tests 8 / pass 8`. Teardown removed 1/1/1/1. Remaining all 0. |
| 4 Sweep | **PASS** | All 0 after teardown and after the probe. `--check` exit 0. |
| 5 CI build | **PASS** | Exactly 5 warnings: `CreateJob.jsx` Plus (4:10) and X (4:16); `Jobs.jsx` MapPin (4:21), Users (4:29) and Sparkles (4:50). A strict subset of the baseline 6 (SkillsSelector gone with R9). No listed exceptions needed. Exit is still 1, as at baseline. |

**Probe** (scratch `probeP4.ps1`, backend :5300). It seeded 1 tagged job (`sweep.mjs --seed-job`) and then:
- `t0001_cand`: login 200 → upload f1 200 → apply 201;
- `t0001_recr`: login 200 → `GET /api/recruiter/applicants` **200**. The row for the seeded job has `credibilityScore: null`, name "T0001 Candidate" (from the batched profiles query) and status `submitted`. The keys are unchanged from before.
- `GET /api/jobs/applications` → **404** `{"message":"Job not found."}`: the path now falls through to `/:id`.
- Backend stderr is empty. 0 `[DEBUG]` lines in stdout.
- The sweep removed applications 1, jobs 1, `storage:candidates/<C>/` 1, then `--check` all 0. No `node.exe` processes are left running.

**New finding:** I-0028. The `candidateInfo.email` returned by `getAllApplicants` is now `''` for candidates who have a profile row. Before, it was filled only by accident, through the N+1 fallback that the nonexistent `profiles.email` column triggered. Nothing calls the endpoint today; the merged Dashboard follow-up has to decide the source.
