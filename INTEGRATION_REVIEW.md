# Integration review: baseline `32905c1` → HEAD `4ed559d` (T-0002)

**Status: review only, nothing applied.** Every change made by a teammate
between the baseline and HEAD is classified below. The owner fills in the
**Owner decision** column. No code changes until then.

**Classes:**
- **KEEP**: works and fits the spec.
- **KEEP-WITH-FIX**: right intent, broken implementation. The exact fix is given.
- **REVERT**: breaks something that worked at baseline, or contradicts the spec or a standing decision.
- **NEEDS-TEAM-DECISION**: a legitimate alternative to the baseline implementation. Both sides are given.

**References:**
- **Spec:** `PROJECT_SOURCE_DOCS.md`. Ids are written FR-n/NFR-n.
- **Standing decisions:** `AUDIT.md` and `CHECKLIST.md` as they were at `32905c1`, read with `git show 32905c1:<file>`. Both are missing at HEAD, because `314e494` deleted them (§8). Guide feedback is cited as GF-n (CLAUDE.md #1–5).
- **Evidence notation:** `file:line@sha`. A bare `file:line` means HEAD.
- **Harness logs:** `tests/.out/current-*.log`. These are git-ignored and exist only on the machine that ran them.
- **Snapshots:** `tests/nlp/snapshots/current/`.

**A difference from baseline is not automatically a regression.** Each one is
judged against the spec. Baseline outputs that are known to be wrong are listed
in `tests/BASELINE_RESULTS.md`.

---

## 1. Summary table

Rows are hunk groups, in history order. "→ Rn" points to the detailed row a group depends on.

| # | Change | Author | Class | Evidence | Proposed action | Owner decision |
|---|---|---|---|---|---|---|
| R1 | `4fc97db`: logout always clears auth state; layouts always navigate home | Aditya | KEEP | `AuthContext.jsx:90-104` is identical to `4fc97db`. Baseline never touched logout: `git diff f270666 32905c1` on these 3 files changes only `AuthContext.jsx:4`. | None (already at HEAD). Optional: warn the user when `/logout` returns non-OK. | Accept proposed action. |
| R2 | `04835ca`: spinner on the Landing demo score; full-page loader on the recruiter Dashboard | Aditya | KEEP | The Landing score is a hardcoded marketing demo that predates this commit (`Landing.jsx:48`, the same at `32905c1`). The spinner adds no data. Dashboard loader: `:7`, `:308-315`, `loading` cleared in `finally` at `:245`. All hooks run before the early return. Baseline Dashboard had the same pattern (`Dashboard.jsx:11,229@32905c1`). | Keep. If the Dashboard is rebuilt (R38), keep a loader. | Accept proposed action. |
| R3 | `d78b52a`: closes the JSX that `04835ca` left open | Aditya | KEEP | `04835ca` alone has unclosed `<>` / ternary (`Landing.jsx:100-131@04835ca`). HEAD Landing equals `d78b52a`. The frontend build without `CI` compiles (`current-frontend-build-noci.log`). | None | Accept proposed action. |
| R4 | `71c632d`: `.gitignore` adds `backend/server-*.log` | Aaron | KEEP | One-line ignore rule | None | Accept proposed action. |
| R5 | `71c632d`: `Config/supabase.js` key-role boot log | Aaron | REVERT | `supabase.js:39` prints the **last 6 characters of the service-role key** (visible in `current-backend.out.log`). Baseline at the same spot logs the role only, warns when it isn't `service_role`, and pins the service key as `global.headers.Authorization` (`supabase.js:48-61@32905c1`, AUDIT@32905c1 "[Persistence bug]" fix layer 2). | Restore the baseline `supabase.js`. Log no key material. | Accept proposed action. |
| R6 | `71c632d`: `Config/supabaseAuth.js` singleton anon client for signup/login/resend | Aaron | NEEDS-TEAM-DECISION | Both sides fix the same root bug: user sessions leaking onto the shared service client (AUDIT@32905c1 "[Persistence bug]"). **Aaron:** one module-level anon client (`supabaseAuth.js:26-28`). It throws at import when `SUPABASE_ANON_KEY` is missing (`:14-18`), so the backend won't boot, and it never signs out. **Baseline:** a per-request `createUserScopedClient()` plus `signOut()` (`auth.controller.js:21-29,194,254@32905c1`). A missing key fails that request only. Tier 1 is 7/7 with Aaron's version (key set locally). | Recommend baseline's version (signs out, no boot crash) plus R5's Authorization pin. Delete the other one. Team picks. | Team decision: keep Aaron's supabaseAuth singleton for signup, login and resend, with fixes: (1) create it lazily, so a missing SUPABASE_ANON_KEY fails that request, not boot; (2) persistSession: false, autoRefreshToken: false. Exception: any handler that sets a session on the client (the token-gated reset restored by R13) creates its own per-request client, so concurrent resets can't share session state. Delete createUserScopedClient everywhere else. Keep R5's Authorization pin on the service client. |
| R7 | `71c632d`: `saveResumeToStorage`, `pruneOldResumes`, `getMyResumeStatus`, routes `GET /resume/status` and `POST /resume/upload` | Aaron | KEEP-WITH-FIX | (1) `contentType: file.mimetype \|\| 'application/pdf'` at `analysis.controller.js:41@71c632d`. The live bucket allows only pdf/docx (read-only bucket listing, §7), and multer often reports `application/octet-stream` for DOCX, so storage returns 415 (AUDIT@32905c1 "Storage MIME allow-list"). (2) The storage `error` is discarded (`:60@71c632d`), so an outage looks like "no resume". (3) Type check is mimetype OR extension (`:86-91@71c632d`). | Use baseline `resolveContentType` (`analysis.controller.js:20-30@32905c1`). Return 500 on a storage error. Require an allowed extension. Whether this whole flow stays depends on R9. | Accept proposed action. |
| R8 | `71c632d`: `analyzeResume` stores the file before looking up the job | Aaron | KEEP-WITH-FIX | `:135-136@71c632d` overwrites the profile resume even when the job is then 404 | Move the call after the job lookup. Only matters if analyze-per-job survives R9. | Accept proposed action. |
| R9 | `71c632d`: `Upload.jsx` rewrite (upload once, no job), `uploadResume` stores only (no parse, no score) | Aaron | NEEDS-TEAM-DECISION | Both sides in §4.2. **Baseline:** pick job → `/api/analyze` → persisted, explainable score per candidate and job (FR-12/13/14, CHECKLIST 0.3/4.4). **Aaron:** upload once, apply per job (`applications` row). Nothing parses or scores (`analysis.controller.js:78-112@71c632d`), and Processing/Results are unreachable (no navigation to `/candidate/processing` anywhere, `git grep`). | Team decides. Middle ground (built nowhere yet): upload once, and applying runs the baseline analyze pipeline and links the score to the application. | Team decision: target = upload once, applying runs analyze, score linked to the application. In T-apply: keep 71c632d's upload/apply UI and restore the baseline /api/analyze backend (tier 2 must pass). Score-on-apply is a follow-up task. |
| R10 | `71c632d`: `getJobById`, `applyToJob`, routes `/:id` and `/:id/apply`, `JobDetail.jsx`, `CandidateJobs` link, `App.jsx` `/candidate/jobs/:id` | Aaron | KEEP-WITH-FIX | Works against the real `applications` table: `unique (candidate_id, job_id)` (`20260830_…sql:42`) gives a 409 on duplicates. Defects: storage error ignored (`jobs.controller.js:92-94@71c632d`). `JobDetail.jsx:6` and `Upload.jsx:16` use `import.meta.env.VITE_API_BASE_URL`, which CRA's webpack 5.106.2 compiles to `undefined` (`node_modules/webpack/lib/dependencies/ImportMetaPlugin.js:366-376`), so the env override never applies (I-0012). | Switch to `process.env.REACT_APP_API_BASE_URL`. Handle the storage error. If R9 links scores, store the score id on the application. | Accept proposed action. |
| R11 | `71c632d`: `index.js` listen split, crash guards, 15 s watchdog | Aaron | KEEP-WITH-FIX | `index.js:94-95` swallows `uncaughtException`. The watchdog at `:106-119` re-listens every 15 s and `:109` resets `exitCode` to 0, so on EADDRINUSE the process never exits (I-0023). The listen split and graceful shutdown are fine. | Keep the listen split and shutdown. `process.exit(1)` on EADDRINUSE and after logging `uncaughtException`. Drop the watchdog. | Accept proposed action. |
| R12 | `e7bf01b` (merge): `supabase.js` conflict resolved to Aaron's side; baseline's cleanly merged Authorization pin also dropped | Aaron | REVERT | `git diff 71c632d e7bf01b -- backend/Config/supabase.js` is empty. The remerge-diff shows the baseline hunk removed outside the conflict markers. | Same as R5 | Accept proposed action. |
| R13 | `e7bf01b`: `auth.controller.js` resolved to Aaron's side, dropping baseline's token-gated password reset and keeping the unauthenticated `updatePassword` | Aaron | REVERT | **The merge result can't boot:** `auth.routes.js:8-9@e7bf01b` imports `requestPasswordReset`/`resetPassword`, which `auth.controller.js@e7bf01b` doesn't export. **At HEAD:** `POST /api/auth/update-password` (`auth.routes.js:12`) resets any user's password from a username alone via `auth.admin.updateUserById` (`auth.controller.js:68-124`). This is an account-takeover hole that baseline `fdd22c3` had closed. **I-0018 (P0).** | Restore baseline `auth.controller.js`, `auth.routes.js` and `ResetPassword.jsx` (token-gated reset). Apply the R6 decision for the auth client. | Accept proposed action. |
| R14 | `e7bf01b`: `analysis.controller.js` resolved to Aaron's side, dropping explainability, persistence, `NLP_PARSE_URL`, required/preferred skill forwarding, `resolveContentType`, Supabase error logging and the scoped readers | Aaron | REVERT | `08afde3`'s controller has no `explainability` import. Baseline had it at `:8` and `NLP_PARSE_URL` at `:12@32905c1`. HEAD scores `credibilityScore = Math.round(semanticSimilarity * 100)` (`:191`), bypassing the explainability weights. In-memory `latestAnalysis` is served to **any** candidate (`:115,229-236`), a cross-user leak that the I-0009 crash currently hides (I-0022). Baseline tier 2 proved persistence: 1 `resumes` + 1 `scores` row written. | Restore baseline `analyzeResume`, `getCandidateAnalysis` and `serializeCandidate`, plus the helpers. Keep Aaron's storage helpers per R7/R9. | Accept proposed action. |
| R15 | `e7bf01b`: `Upload.jsx`, all 5 conflict hunks resolved to Aaron's side | Aaron | NEEDS-TEAM-DECISION | Same choice as R9 | Decide together with R9 | Team decision: keep 71c632d's Upload.jsx (see R9). |
| R16 | `08afde3`: "applied" state on the job detail page, read from `applications` | Aaron | KEEP | `jobs.controller.js:86-99@08afde3`. The unique `(candidate_id, job_id)` constraint makes `maybeSingle` safe. **Absent at HEAD:** `git diff 08afde3 HEAD` reverses both hunks, because `314e494` undid it. | Re-apply. Apply option (a) in §9 does this automatically. | Accept proposed action. |
| R17 | `314e494`: NLP files set back to `365a09e` | Aaron | REVERT | §3.3. Fabricated experience in 8 of 8 text-bearing fixtures. `jd_source` and `component_weights` absent in 9 of 9. `rest`/`api` split. `typescript` listed twice. Bullet fragments as project titles on 2 real resumes. Education leak is back. | Restore the `32905c1` NLP. It is byte-identical in `08afde3` (`git diff 32905c1 08afde3 -- nlp-engine` is empty). | Accept proposed action. |
| R18 | `314e494`: deletes `Services/explainability.js` and `ScoreBreakdown.jsx`; sets `CandidateModal`, `JobDetails`, `Results`, `Processing`, `Jobs`, `CandidateJobs`, admin `Dashboard` and `ResetPassword` back to older versions | Aaron | REVERT | AUDIT@32905c1 rows 4.3 and 4.4 were DONE_CORRECTLY and 4.5 partial, all through `explainability.js`. At HEAD no file computes or renders a weighted, explained score. `JobDetails.jsx:5` imports `mockData`. 12 of the 16 new lint warnings are in these files (§2). | Restore from baseline | Accept proposed action. |
| R19 | `314e494`: deletes `supabase/migrations/20260903_create_resumes_and_scores.sql` | Aaron | REVERT | That file created the `resumes` bucket and the `resumes` and `scores` tables, with RLS. Its deletion is the root cause of I-0001, I-0007 and I-0013. The live DB still has all three (§7), so the repo no longer describes the DB. | Restore. Make it idempotent with the I-0010 batch. | Accept proposed action. |
| R20 | `314e494`: re-adds `frontend/src/data/recruiter/mockData.js` (624 lines) | Aaron | REVERT | Standing decision: "No mock data remains anywhere in `frontend/src`" (AUDIT@32905c1:76-80). Imported by `JobDetails.jsx:5` and `Recruiter/CandidateRanking.jsx:7`. | Delete, along with its importers' mock paths (R18, R39) | Accept proposed action. |
| R21 | `314e494`: re-adds Mongoose `Models/*.Model.js` ×4, the `mongoose` dependency (`package.json:23`), and empty `Controllers/{candidate,recruiter}.js` | Aaron | REVERT | Deleted at baseline (AUDIT@32905c1:159). CLAUDE.md says Supabase is authoritative. Nothing imports them (`grep` finds no `Models` import). | Delete | Accept proposed action. |
| R22 | `314e494`: re-adds `Routes/parse.routes.js`, mounted at `/api/parse` (`index.js:7,53`) | Aaron | REVERT | It takes a **candidate-supplied** `jd` (`parse.routes.js:25`), a self-scoring hole that `32905c1` closed (AUDIT@32905c1 5.1). NLP URL is hardcoded (`:45`). No frontend caller. Baseline `fdd22c3` deleted it. | Delete the file and its mount | Accept proposed action. |
| R23 | `314e494`: frontend env-var and routing changes: `/candidate/results` route gone, `import.meta.env` in `AuthContext`/`Login` and others, recruiter Dashboard fake content | Aaron | REVERT | `Dashboard.jsx:341` ("Welcome back, Amit"), `:367` (`trend={12}`), `:177`/`:184` (hardcoded charts). `git blame` attributes these to `314e494`, and they are absent at `32905c1` (grep count 0). I-0012. | Restore baseline. Hand-merge the Dashboard (R38). | Accept proposed action. |
| R24 | `314e494`: deletes `AUDIT.md` and `CHECKLIST.md` | Aaron | REVERT | CLAUDE.md's working agreements and REVIEW_BRIEF.md (93 references) depend on them. They were deleted in a commit that claimed only code changes. | Restore verbatim from `32905c1`, as was done for `PROJECT_SOURCE_DOCS.md` in `4ed559d`. Their relation to the tracker is in §8. | Accept. Restore verbatim; reconciled in the tracker task. |
| R25 | `314e494`: deletes `Docs/project_checklist.md` | Aaron | REVERT | CLAUDE.md refers to it as the team's rough pointer ("Do NOT treat project_checklist.md as accurate"), so it expects the file to exist | Restore verbatim. Consolidating it with `IMPLEMENTATION-TRACKER.md` belongs to the tracker task (§8). | Accept. Restore verbatim; reconciled in the tracker task. |
| R26 | `314e494`: re-adds `Docs/Architecture.md`; README API table back to in-memory and `/api/parse` wording | Aaron | REVERT | `a30dbe3` had deleted Architecture.md. It is pasted chat output with `[cite_start]` artifacts and says "Data Layer: MongoDB" (`Docs/Architecture.md:13`), which contradicts CLAUDE.md. README lines 149-155 describe an in-memory store and a route that should not exist (R22). | Delete again (CLAUDE.md prefers consolidation). Restore the baseline README lines. | Accept. ARCHITECTURE.md comes from the architecture audit. |
| R27 | `5d2bea8` (merge `32905c1` into Aditya's branch) | Aditya | KEEP | The remerge-diff is empty. Code evidence: `git diff 32905c1 5d2bea8` is exactly `4fc97db`'s 3 files, and the two sides' edits don't overlap (`AuthContext.jsx:4` vs `:90-104`). Its logout code is the one running at HEAD (R1). | None | Accept proposed action. |
| R28 | `72451d1` (merge `origin/Aaron`) | Aditya | REVERT (effect) | The remerge-diff is empty, but **its effect is the reset**: `git diff 314e494 72451d1` is only `4fc97db`'s 3 files, so main received `314e494`'s tree. Every NLP, lint and docs regression in §2/§3 entered main here. | Handled by reverting `314e494` (§9). Do **not** `git revert -m 1 72451d1`: that would also drop `71c632d`/`08afde3`. | Accept proposed action. |
| R29 | `ad4f694`: removes `import path` and the job lookup in `analyzeResume` | Aditya | REVERT (these 2 hunks) | `72451d1:4` had the import, and `path.extname` is still called at `:34`. `job` is now undefined at `:137`, `:144`, `:215`. **Tier 2: `HTTP 500 "path is not defined"`** (`current-backend-tests.log`). Knock-on: `applyToJob` requires a stored resume (`jobs.controller.js:93-104`), so new candidates can't apply. **I-0009 corrected:** the cause is `ad4f694`, not `71c632d`. | Re-add the import and the `72451d1:138-146` lookup, or let R14's restore supersede both. Do not re-enable the in-memory readers (R14). | Accept proposed action. |
| R30 | `ad4f694`: `getAllApplicants` (`:240-331`) and rewritten `getAllCandidates` (`:333-420`), Supabase-backed | Aditya | KEEP-WITH-FIX | (1) Duplicates except for the `[DEBUG]` logs (`:243,249,262,328`). (2) `Number(scoreRow?.composite_score ?? 0)` at `:318,407` gives unscored candidates a **fake 0**, against the standing decision "null, never 0" (AUDIT@32905c1:96). (3) Reads `scores`, which no HEAD migration creates (R19). (4) `.maybeSingle()` on `scores` breaks after a second analysis, because there is no unique `(candidate_id, job_id)` (baseline migration has only an `id` PK). (5) Selects `profiles.email`, which doesn't exist (`20260823_create_profiles.sql:8-28`), so it falls back to N+1 `auth.admin` calls. | Keep one handler (the Dashboard calls `/api/recruiter/applicants`, `Dashboard.jsx:213`). Return `null` for "Not scored". Use `.order('created_at',{ascending:false}).limit(1)`. Drop `email` from the select and batch names with `.in()`. Or replace it with baseline `getAllCandidates` (`:284-336@32905c1`); decide with R38. | Keep getAllApplicants with fixes 1–5; use baseline getAllCandidates instead of the ad4f694 rewrite. |
| R31 | `ad4f694`: `jobs.controller.getAllApplications` and route `GET /api/jobs/applications` | Aditya | REVERT | The only caller is `Dashboard.jsx:215`, and its result `applicationsData` (`:220`) is never used (lint warning). Same `email` bug at `:176`. | Delete the endpoint and the fetch | Accept proposed action. |
| R32 | `ad4f694`: `shortlistCandidate` (`POST /api/jobs/applications/shortlist`) | Aditya | KEEP-WITH-FIX | **IDOR:** `jobs.controller.js:229-234` updates by `applicationId` with the service-role client and no recruiter ownership check. Any recruiter can shortlist or reject any application and trigger a notification. **I-0019.** | Load the application with `job:jobs!inner(recruiter_id)` and require it to equal `req.session.userId`. Return 404 on 0 rows. | Defer to security task (I-0019), test-first. |
| R33 | `ad4f694`: notifications: controller, `GET /`, `POST /:id/read`, migration, CandidateLayout bell, candidate `Notifications.jsx`, `App.jsx` route | Aditya | KEEP-WITH-FIX | The migration enables RLS with select-own and recruiter→applicant insert policies (`20260903_create_notifications.sql:20-36`). It isn't idempotent (same class as I-0010). The table exists live (9 rows). `markNotificationRead` is scoped by user. `CandidateLayout.jsx:7` and `Notifications.jsx:6` use `import.meta.env`, which compiles to `undefined` (see R10). | Switch to the `process.env.REACT_APP_API_BASE_URL` constant. Make the migration idempotent with the I-0010 batch. | Accept proposed action. |
| R34 | `ad4f694`: `POST /api/notifications/send` | Aditya | REVERT | `notification.routes.js:7-20` uses `requireAuth` only. Any logged-in user, candidates included, can send any message to any `userId`, and the service role bypasses RLS. No frontend caller. **I-0020.** | Delete the route. `shortlistCandidate` already calls `sendNotification` internally. | Defer to security task (I-0020), test-first. |
| R35 | `ad4f694`: `requireAuth` swallows profile-lookup errors | Aditya | REVERT | `auth.Middleware.js:10-28`: supabase-js returns `{error}` rather than throwing, so a DB error or a deleted profile now passes authentication and the suspension check. `72451d1` and `32905c1` both returned 401 on `error \|\| !profile`. **I-0021.** | Restore the fail-closed check | Defer to security task (I-0021), test-first. |
| R36 | `ad4f694`: route wiring (`/recruiter/applicants`, `/api/jobs/applications*`, `/api/notifications`) | Aditya | KEEP | `analysis.routes.js:10`, `jobs.routes.js:18-19` are registered before `/:id` (correct order), `index.js:9,55` | Keep the wiring for the handlers that survive R30–R34 | Accept proposed action. |
| R37 | `ad4f694`: `Login.jsx` hides the password icon | Aditya | KEEP | `Login.jsx:31-35`, cosmetic | None | Accept proposed action. |
| R38 | `ad4f694`: recruiter `Dashboard.jsx` rewrite (real API data, shortlist/reject, search, 30 s polling) | Aditya | NEEDS-TEAM-DECISION | **ad4f694:** a hiring workflow on `/api/recruiter/applicants`. It removed the fake "Attention required" block. **Baseline:** `/api/candidates` (scores ⨝ resumes ⨝ profiles) plus `CandidateModal`/`ScoreBreakdown` drill-down into the persisted explanation (FR-13/15, CHECKLIST 5.7/5.8). Bugs either way: `'applied'` vs enum `'submitted'` (`:228,306,483`, so Pending is always 0), fake 0 score (`:226`), unused fetch and `user` (`:203,215,220`), Reject shown only for shortlisted (`:122`). This is the **only textual conflict** in apply option (a). | Recommend baseline's score and explanation view as the base, with ad4f694's shortlist/reject/notify actions added to it. | Team decision: resolve to baseline side + keep 04835ca loader now. The merged application-centric page (score, status, shortlist/reject, explanation drill-down) is built in the score-on-apply task with Aditya. |
| R39 | `ad4f694`: `frontend/src/Recruiter/{AlertDashboard,CandidateRanking,components/ScoreExplainability}.jsx` | Aditya | REVERT | `MOCK_ALERTS` with named fake candidates (`AlertDashboard.jsx:15`). `mockData` import (`CandidateRanking.jsx:7`). **`Math.random()` sub-scores** (`:241-243`). Client-side weights `{nlp .30, github .35, assessment .35}` (`ScoreExplainability.jsx:22`) that contradict the backend's 0.40/0.35/0.25 with redistribution (`explainability.js:85-89@32905c1`). None is reachable: no route and no importer outside the trio. | Delete all three | Accept proposed action. |
| R40 | `ad4f694`: `Docs/IMPLEMENTATION-TRACKER.md` (new, 258 lines) | Aditya | NEEDS-TEAM-DECISION (tracker task) | It proposes Firebase Firestore (`:16-17,60-118`; I-0008). It claims done "MongoDB models" (`:44`), "Custom NER" (`:50`) and recruiter charts/alerts (`:31`). The code contradicts all three (R17, R21, R39). | No decision here. Input for the tracker task (§8). | Defer to tracker task. |
| R41 | `cc0e637` (merge `aditya-ui-work`) | Aditya | KEEP | The remerge-diff is empty. Code evidence: `git diff ad4f694 cc0e637` is exactly `04835ca`'s Dashboard hunk plus `d78b52a`'s Landing. The loader references live state (`Dashboard.jsx:199,245,308-315`), with `useMemo` at `:286` before the early return. Harness evidence: the frontend compiles without `CI`, and none of the 21 lint warnings is blamed on `04835ca`/`d78b52a`. | None | Accept proposed action. |

**Totals:** 9 KEEP · 7 KEEP-WITH-FIX · 20 REVERT · 5 NEEDS-TEAM-DECISION (41 rows).

**By author, in short:**
- **Aaron:** most of the 20 REVERTs are rows of `314e494`'s single reset (R17–R26). They undo one accidental commit, not 10 separate pieces of work.
- **Aaron:** his genuine features (R7–R11, R16) are KEEP or KEEP-WITH-FIX, apart from the team decisions.
- **Aditya:** commits are KEEP, except `ad4f694`'s three security holes, the import removal and the unreachable mock pages.

The owner's own commits after the baseline (`d6701ff`, `92db9f0`, `bcfa21c`,
`4ed559d`) are docs, tooling and tests only. They are **not classified**. Their
docs are covered for staleness in §8.

---

## 2. Harness: current vs baseline

**How it was run:**
- The T-0001 test files ran unchanged against this tree (HEAD `4ed559d`, clean).
- The owner's dev stack held ports 3000, 5000 and 8000 (PIDs 17568, 18064, 13308) and was **not stopped**.
- So a scratch runner that mirrors `tests/run-suite.ps1 -Target current` used **NLP 8200 and backend 5200**, with the same env pins (`PYTHONHASHSEED=0`, HF offline).
- `PORT=5200` came from the shell. That works because `backend/.env` has no `PORT`.
- HEAD hardcodes the NLP URL (`analysis.controller.js:146`, `localhost:8000`). A successful analyze would have reached the owner's dev NLP, but analyze died first.

| Suite | Baseline `32905c1` | Current HEAD | Verdict |
|---|---|---|---|
| NLP `/parse` (6 synthetic + 3 private) | 10/10 | **10/10** (`10 passed in 5.86s`) | Same shape. The content differs a lot (§3). |
| NLP determinism (server restarted) | All hashes equal | **All 9 hashes equal**, run 1 vs run 2 (`current-snapshot-hashes-run{1,2}.txt`) | Same. The seed is pinned; I-0015 still applies. |
| Backend tier 1 (7 smoke checks) | 7/7 | **7/7** | Same |
| Backend tier 2 (live analyze, f1) | PASS: 200 in 3.37 s, all keys present | **FAIL**: `HTTP 500: {"message":"Analyze failed","error":"path is not defined"}` | **Regression**, caused by `ad4f694` (R29) |
| Tier 2 data written and swept | 1 score, 1 resume, 1 job, 1 storage object; check after = all 0 | Only the tagged job (removed). Check before and after = **all 0**. | Clean |
| Frontend `CI=true npm run build` | FAIL: 6 warnings | **FAIL: 21 warnings** | Worse (breakdown below) |
| Frontend build without `CI` | Compiles | **Compiles** ("Compiled with warnings") | Same |
| `/parse` wall-clock (reference only) | 0.03–1.16 s | 0.04–0.65 s | Not a quality signal: the older parser just does less work |

**Lint warnings at HEAD: 21.**
- **Carried from baseline (5):** `CreateJob.jsx` Plus/X; `Jobs.jsx` MapPin/Users/Sparkles.
- **Resolved:** the baseline `Upload.jsx` SkillsSelector warning is gone, because R9 rewrote the file.
- **New (16), by `git blame`:**
  - 12 are in files `314e494` set back to older versions: `CandidateModal.jsx` (5), `Processing.jsx` (1), `ResetPassword.jsx` (1), recruiter `Dashboard.jsx:4` (2), `JobDetails.jsx` (3).
  - 3 come from `ad4f694`: `CandidateLayout.jsx:11`, `Dashboard.jsx:203,220`.
  - 1 is `Dashboard.jsx:253` (`exhaustive-deps`). The line dates from `93c7405` and came back with the reverted Dashboard.

---

## 3. `314e494` deep review: "feat: NLP engine updates + full resume parsing pipeline" (Aaron)

### 3.1 What the commit actually is

```
$ git rev-parse 71c632d^{tree} 314e494^{tree}
f09d034b85543f4450c2125b89294d0d03726fe1
f09d034b85543f4450c2125b89294d0d03726fe1
$ git diff --stat 71c632d 314e494          # (empty)
$ git diff 365a09e HEAD -- nlp-engine       # (empty)
```

**Confirmed (owner addition 1): `314e494` adds nothing new.** Its tree is
byte-for-byte the tree of Aaron's earlier `71c632d`.

Relative to its parent `08afde3`, every line of its 41-file diff does one of two things:
- **(a)** removes work that arrived from `main` in `e7bf01b`: `c27037f`, `a30dbe3`, `fdd22c3` and `32905c1`;
- **(b)** removes Aaron's own `08afde3`, committed just before.

Its NLP files are identical to `365a09e` (2026-09-02). That commit is already
an ancestor of the baseline, and `32905c1` superseded it.

The commit message's "NLP engine updates", "mock data" and "removed deprecated
files and services" describe no change relative to `71c632d`. The "services" it
removed are `explainability.js` and the `resumes`/`scores` migration.

**Open question for Aaron (Q1):** do you have NLP or parsing work locally that
was never pushed? The tree match is consistent with an older working copy being
committed over the merge result. If there was newer parser work, no pushed
commit contains it.

### 3.2 What it undid, file by file

Method: `git diff --name-status 08afde3 314e494`. Then, per file,
`git log f270666..32905c1 -- <file>` shows which baseline commits were undone,
and `git log 314e494..HEAD -- <file>` shows whether the file was touched again
later.

| Area | Files (status in `314e494`) | Baseline work undone | Touched again later? |
|---|---|---|---|
| NLP | `nlp-engine/app/{ner,embedder,main}.py` (M) | `32905c1` parsing fixes, `fdd22c3` weights | No |
| Scoring / explainability | `backend/Services/explainability.js` (D) | `fdd22c3`, `32905c1` | No |
| Scoring UI and candidate loop | `ScoreBreakdown.jsx` (D). `CandidateModal`, recruiter `JobDetails`/`Jobs`, candidate `Results`/`Processing`/`CandidateJobs`, admin `Dashboard`, `ResetPassword` (M) | `fdd22c3`, `32905c1`, `a30dbe3`, `0bb3953` | No |
| Mock data | `frontend/src/data/recruiter/mockData.js` (A) | `fdd22c3` | No |
| Schema | `supabase/migrations/20260903_create_resumes_and_scores.sql` (D) | `c27037f` | No |
| Dead backend code | `backend/Models/*` ×4 (A), `package.json` + lockfile `mongoose` (M), `Controllers/{candidate,recruiter}.js` (A, 0 bytes) | `c27037f`, `a30dbe3` | No |
| Parallel NLP proxy | `backend/Routes/parse.routes.js` (A) | `fdd22c3` | `index.js` by `ad4f694` |
| App shell, auth wiring | `App.jsx`, `index.js`, `auth.routes.js`, `auth.Middleware.js`, `admin.controller.js` (M) | `fdd22c3`, `a30dbe3` | `App.jsx`, `index.js` and middleware by `ad4f694` |
| Env-var convention | `AuthContext.jsx`, `Login.jsx` and others (M), I-0012 | `fdd22c3` | `AuthContext` by `4fc97db`; `Login` by `ad4f694` |
| Aaron's own | `jobs.controller.js`, `JobDetail.jsx` (M) | `08afde3` | `jobs.controller.js` by `ad4f694` |
| Docs | `AUDIT.md`, `CHECKLIST.md`, `Docs/project_checklist.md`, `PROJECT_SOURCE_DOCS.md` (D). `Docs/Architecture.md` (A). `README.md` (M). | `c27037f`, `fdd22c3`, `32905c1`, `a30dbe3` | `PROJECT_SOURCE_DOCS.md` (restored in `4ed559d`) |

**Not in `314e494`'s diff:** `analysis.controller.js`, `auth.controller.js`,
`Config/supabase.js` and `Upload.jsx`. At `08afde3` these four were already
identical to `71c632d`, because `e7bf01b` had resolved them to Aaron's side
(§5). This is why reverting `314e494` alone doesn't bring back the scoring
(§9).

### 3.3 The four `32905c1` parsing fixes, fixture by fixture

The fixes, as recorded in `git show 32905c1:AUDIT.md` ("[Parsing / JD-source fixes 2026-09-03]"):
1. **Experience** is no longer built from every spaCy ORG/DATE entity. It is section-scoped `{title, organisation, dates, highlights}`, or `[]` when no section exists.
2. **The job's own skill lists win.** The structured `required_skills`/`preferred_skills` are authoritative, the markdown description is only a fallback, and `jd_source` is reported.
3. **Skills are deduplicated and normalised** on both the résumé and the job side.
4. **Bullets no longer become project titles.** Title-pattern gating attaches action-verb bullets to the description instead.
5. (Also part of `32905c1`) **Education** is taken from the education section only.

**Code at HEAD:**
- `ner.py:155-170` appends every `ORG` as `{"type":"organisation"}` and every `DATE` as `{"type":"date"}`.
- `is_plausible_organisation` is back at `ner.py:111`.
- These baseline functions are all absent: `split_sections`, `normalize_skill(s)`, `_extract_experience`, `_extract_projects`, `_extract_education` (baseline `ner.py:127,142,281,377,414,459`).
- `main.py:37-39` accepts only `resume` and `jd`. Baseline also took `required_skills` and `preferred_skills` (`:55-56@32905c1`).
- `embedder.py:96` sets `jd_skills = extract_skills(jd_text)`.
- `"typescript"` is listed twice (`ner.py:8`, `:53`).

**Synthetic fixtures** (no personal data; values from the snapshots; B = baseline, H = HEAD):

| Fixture | Fix 1: experience | Fix 2: job skill source | Fix 3: dedup | Fix 4: projects | Score (B → H) |
|---|---|---|---|---|---|
| `f1_dev_github` (PDF) | B: 2 structured roles. Known defects: #2 has title and org swapped, and a `" ()"` suffix. H: **8 spaCy labels**, including `'TX'`, `'3 years'`, `'ECS'`, `'QueueBench'` (a project name), and the degree line as an "organisation". | B: `structured_skills`, 10. H: field absent; 14 scraped from the JD prose, including `django`, `fastapi`, `javascript`. | H's job side has `rest` and `api` as 2 skills, both matched (13 of 14). B normalised them to `rest api`. | B: `[]` (known-wrong). H: 1 entry, with the **correct** title "Ledgerly – …", but the second project "QueueBench" is swallowed into its description. Here H is better than B. | 0.8484 → 0.8668, Strong → Strong |
| `f2_dev_github` (DOCX) | B: 5 entries (2 roles + 3 bullets as entries, known-wrong). H: **9 labels**, including **the phone number `'98765 01234'` as a date** and `'Built Express'` as an organisation. | 10 → 14 scraped | H's missing list has `rest` while `api` counts as matched (split token) | `[]` → `[]` | 0.4779 → 0.4502 |
| `f3_support_nogithub` (PDF) | B: 2 correct roles. H: **13 labels**: phone `'5550 1234'` as a date; the skills ServiceNow, Nagios and Windows as organisations; the certificate "ITIL 4 Foundation" as an organisation; `'monthly'` as a date. | B: the 10 structured job skills. H: **5 scraped** (`python, bash, oracle, linux, sql`). ServiceNow, Jira, ITIL, Splunk and Nagios are not in the dictionary, so they **vanish from the job side**. | — | `[]` → `[]` | 0.4138 Weak → **0.5938 Moderate** |
| `f4_support_nogithub` (DOCX) | B: 4 entries (2 roles + 2 bullets as entries, known-wrong). H: **10 labels**, including `'Keeps'`, `'PL/SQL'`, `'Shell Scripting'`, `'Root Cause Analysis'` as organisations and `'15-year-old'` as a date. | 10 structured → 5 scraped (same effect as f3) | — | `[]` → `[]` | 0.4354 Weak → **0.6154 Moderate** |
| `f5_multicolumn` (PDF) | B: `[]` (known-wrong, the two columns interleave). H: **5 labels**: `'9988'` (the phone number's tail) as a date; `'CO - Ran 40 Kubernetes'` as an organisation. | 10 → 14 scraped | — | B: `[]`. H: **2 skill names as project titles** (`PostgreSQL`, `Terraform`). | 0.6906 → 0.6134 |
| `f6_image_only` (scanned) | `[]` → `[]` | 10 → 14 | — | `[]` → `[]` | 0.0 → 0.0. Both still return HTTP 200 with a 0 score and no "unreadable" signal (GF-2, no OCR). |

Education leak (fix 5): on f1, H lists the internship line under education.

**Private resumes** (counts and shapes only; `tests/private/`, git-ignored):

| Resume | Fix 1: experience | Fix 2 | Fix 3 | Fix 4: projects |
|---|---|---|---|---|
| private#1 (DOCX) | B `[]` → H **15 labels** (12 organisation, 3 date) | `jd_source` absent; 10 → 14 job skills | — | B: 2 real titles. H: 4, including 1 action-verb bullet ("Deployed…") and 1 fragment. |
| private#2 (PDF) | B `[]` → H **19 labels** | same | — | B: 2 real titles. H: 6, of which **3 start with action verbs ("Engineered…", "Trained…", "Deployed…")**, plus a 2-word fragment. One of B's real projects is lost. |
| private#3 (PDF) | B: 12 structured (4 are bullets as entries) → H **29 labels** | same | **`typescript` appears twice** in H's skills (`skill_count` 24 vs 23) | B: `[]`. H: **5 "titles" that are 14–20-word sentence fragments** (beginning "now", "promoting", "to"). |

**Verdict, judged against FR-2, NFR-5 and GF-3/GF-5 (not against the old snapshots):**
1. **Fix 1 was overwritten.** Fabricated experience is back in every fixture with text: 5 synthetic plus 3 private. Phone fragments appear as job dates in f2, f3 and f5. REVERT (R17).
2. **Fix 2 was overwritten.** `jd_source` and `component_weights` are absent in 9 of 9 outputs, and the recruiter's structured skill lists are ignored. HEAD scores the support candidates higher (f3/f4 go from Weak to Moderate), but **only because 5 of the recruiter's 10 required skills drop out of the denominator.** That is not the fairness fix GF-3 asks for:
   - the candidate's ServiceNow, Jira and ITIL are still unrecognised;
   - the explanation now hides them instead of showing them as missing (against GF-5).

   The real fairness work (support-tool vocabulary) stays open: see BASELINE_RESULTS f3/f4.
3. **Fix 3 was overwritten.** `rest`/`api` are split and double-counted on the job side, and `typescript` is duplicated (private#3).
4. **Fix 4 was overwritten on real resumes.** private#2 has 3 action-verb titles; private#3 has 5 sentence fragments as titles. On synthetic f1, HEAD finds one real title where the baseline found none: baseline's over-suppression on f1, f2 and f5 is already listed as known-wrong. That is a reason to improve `_extract_projects` after the restore, not to keep HEAD's parser.

---

## 4. `71c632d` deep review (Aaron)

### 4.1 Judged on its own code

- **No crash bugs.** `71c632d` imports `path` (`analysis.controller.js:4@71c632d`) and defines `job` (`:138-146`). The I-0009 crash is `ad4f694`'s (R29).
- **The hardcoded NLP URL predates it.** `http://localhost:8000/parse` was already at `f270666:49`.
- **Six files are unchanged at HEAD.** These are byte-identical at HEAD and `71c632d`:
  - `auth.controller.js`
  - `supabase.js`
  - `supabaseAuth.js`
  - `Upload.jsx`
  - `CandidateJobs.jsx`
  - `JobDetail.jsx` (which means `08afde3`'s change to it is undone)
- **Hunk groups and classes:** R4–R11.
- **Real defects:**
  - **Upload type:** the MIME type is passed raw to a bucket with an allow-list, so uploads fail with 415 (R7).
  - **Storage errors ignored:** they read as "no resume" (R7, R10).
  - **Resume overwritten early:** the stored resume is replaced before the job is validated (R8).
  - **Boot crash:** the backend won't start without `SUPABASE_ANON_KEY` (R6).
  - **Key leak:** the boot log prints part of the service key (R5).
  - **Hang on port clash:** the process never exits on EADDRINUSE (R11).
  - **Env var ignored:** `import.meta.env` under CRA (R10).

### 4.2 Upload flow: both sides (R9 / R15)

| | Baseline `32905c1` | Aaron `71c632d` |
|---|---|---|
| Candidate steps | Upload page: pick a job and a file → Processing (real XHR progress) → `POST /api/analyze` → Results | Upload page: one resume per profile (status check plus replace). Job page → Apply. |
| Backend | NLP gets the job's JD and the structured required/preferred skills. Inserts `resumes` and `scores` (`buildScoreRecord`) and returns the explanation. | Stores the file only (`resumes/candidates/<uid>/resume<ext>`). Apply inserts an `applications` row. **No parse, no score.** |
| Spec fit | FR-1/2/12/13 and CHECKLIST 0.3/4.4: each (candidate, job) gets a persisted, explainable score that the recruiter view ranks (FR-14) | A real job-portal model that uses the existing `applications` table. Recruiters get no score, and Processing/Results are unreachable. |
| Gaps | No `applications` row, so there is no "apply" concept. `Upload.jsx:121@32905c1` hardcodes the jobs URL. | A later upload overwrites the file, so an application doesn't record which resume version it was made with. |

**Middle ground (built nowhere yet):** keep upload-once and Apply. On apply,
read the stored resume, run the baseline analyze pipeline, persist `resumes`
and `scores`, and link the score to the application.

### 4.3 The persistence bug both sides fixed

Both sides fixed the same bug: logins planted a user session on the shared
service-role client, which broke RLS-guarded writes.
- **Baseline:** a per-request anon client plus `signOut()`, and the service key pinned as the Authorization header.
- **Aaron:** a dedicated anon singleton (`supabaseAuth.js`).

Either works today: tier 1 passes, and nothing at HEAD calls `supabase.auth.*`
on the service client (grep). The team should pick one (R6) and keep R5's
pin as defence in depth.

---

## 5. Merge commits and their conflict resolutions

`git show --remerge-diff <sha>` (git 2.50.1) re-runs the merge and shows how
the committed result differs from git's automatic attempt. **An empty
remerge-diff only means there was no textual conflict.** So every merge also
gets code or harness evidence (owner addition 4).

| Merge | Parents | Remerge-diff | Code / harness evidence | Rows |
|---|---|---|---|---|
| `e7bf01b` (Aaron) | `71c632d` + `32905c1` | **4 conflicted files:** `supabase.js`, `analysis.controller.js`, `auth.controller.js`, `Upload.jsx` | Every conflict was resolved to Aaron's side (`git diff 71c632d e7bf01b -- <4 files>` is empty). The resolution also removed baseline hunks in those files that had merged cleanly. **The result could not boot**: `auth.routes.js:8-9@e7bf01b` imports exports that don't exist. The frontend expected `explanation.factors` (`ScoreBreakdown.jsx@e7bf01b`), but the backend returned the in-memory shape. | R12, R13, R14, R15 |
| `5d2bea8` (Aditya) | `4fc97db` + `32905c1` | Empty | Result = `32905c1` + `4fc97db`'s 3 files. The edits don't overlap. | R27 KEEP |
| `72451d1` (Aditya) | `5d2bea8` + `314e494` | Empty | Result = `314e494`'s tree + `4fc97db`. This is how the reset reached `main` (§2/§3 regressions). | R28 REVERT (effect) |
| `cc0e637` (Aditya) | `ad4f694` + `d78b52a` | Empty | Result = `ad4f694` + `04835ca`/`d78b52a` hunks. Compiles without `CI`, and no lint warnings come from these hunks. | R41 KEEP |

**What `e7bf01b` dropped from `32905c1`:**
- **`supabase.js`:** the role warning and the service-key Authorization pin.
- **`auth.controller.js`:** `createUserScopedClient`, the `RESET_REDIRECT_URL` / `MIN_PASSWORD_LENGTH` constants, the per-request auth flows, and the token-gated `requestPasswordReset`/`resetPassword`. The unauthenticated `updatePassword` came back.
- **`analysis.controller.js`:**
  - imports: `crypto` and `{buildScoreRecord, SUBSCORE_KEYS}`;
  - config: `NLP_PARSE_URL`, `PARSER_VERSION`;
  - helpers: `MIME_BY_EXT`/`resolveContentType`, `describeSupabaseError`/`isRlsError`/`logPersistenceError`, `serializeCandidate`;
  - the persisting `analyzeResume`, and the Supabase-scoped `getCandidateAnalysis`/`getAllCandidates`.
- **`Upload.jsx`:** job selection and the hand-off to Processing.

---

## 6. Aditya's commits: summary

| Commit | Verdict | Notes |
|---|---|---|
| `4fc97db` | KEEP (R1) | Survived intact to HEAD |
| `04835ca`, `d78b52a` | KEEP (R2, R3) | Cosmetic. The Landing demo's hardcoded 82 and "10000+ candidates verified" predate them (I-0026). |
| `ad4f694` | Mixed (R29–R40) | Not really a merge: a single-parent commit with about 1.8k new lines. It was built on `72451d1`'s reset tree, so none of `32905c1`'s work is in it (`git grep` at `ad4f694`: no `explainability`, `buildScoreRecord`, `NLP_PARSE_URL` or `REACT_APP_API_BASE_URL`). **Worth keeping:** notifications, the shortlist workflow, real API data on the Dashboard. **Bugs to fix:** a tier-2-breaking import removal, three authorization holes (R32, R34, R35), and unreachable mock/random-score pages. |

---

## 7. Schema, DB, persistence and explainability

**Migrations** (`git diff --stat 32905c1 HEAD -- supabase`):
- **Removed:** `20260903_create_resumes_and_scores.sql` (−100 lines, R19).
- **Added:** `20260903_create_notifications.sql` (+36, R33).
- **Unchanged:** the other four (profiles, jobs/applications, admin role, suspension).

**Live project (read-only `count` queries with the service-role client, 2026-10-12):**
- Tables: `profiles` 9, `jobs` 2, `applications` 3, `resumes` 3, `scores` 3, `notifications` 9.
- Bucket `resumes`: private, `allowed_mime_types` = pdf and docx.
- Both 20260903 migrations are applied live (by hand, I-0010). At HEAD **the repo can no longer recreate** `resumes`, `scores` or the bucket.

**`applications`** (`20260830_create_jobs_and_applications.sql`):
- Schema:
  - unique `(candidate_id, job_id)` (`:42`);
  - status enum `submitted / under_review / shortlisted / rejected / withdrawn` (`:8-10`);
  - RLS: candidate insert-own on published jobs, recruiter select/update for own jobs.
- The baseline backend never used it (0 `from('applications')` hits at `32905c1`).
- At HEAD:
  - `71c632d` inserts on apply (`jobs.controller.js:119-120`);
  - `08afde3` read it (lost, R16);
  - `ad4f694` reads it (`analysis.controller.js:258,349`; `jobs.controller.js:158`) and updates it (`:230`, IDOR R32).
- The Dashboard's `'applied'` status doesn't exist in the enum (R38).

**RLS in practice:** every backend query uses the service-role client
(`supabase.js:42`), so RLS never applies to the API. Authorization must live in
the routes, and that is where R32, R34 and R35 fail. The `resumes`/`scores`
policies (baseline migration `:71-100`) and the notifications policies matter
only for direct browser access.

**Storage:**
- The bucket insert lives in the deleted migration (`:14-16@32905c1`). The MIME allow-list and 10 MB cap were set by hand and are in no migration (I-0001).
- Two path layouts coexist: baseline `<candidate>/…` and Aaron's `candidates/<candidate>/resume<ext>`. The R9 decision picks one. The test sweep already cleans both.
- `multer.memoryStorage()` has no size limit on either side (I-0025).

**Persistence at HEAD: broken.**
- Nothing writes `resumes` or `scores`. Analyze is in-memory (`allAnalyses`/`latestAnalysis`, `analysis.controller.js:114-115,221`), and it 500s anyway (R29).
- `ad4f694`'s readers query `scores` (live rows left from baseline-era runs) and show **0** for anyone without a row (R30).
- Baseline tier 2 wrote 1 `resumes` + 1 `scores` row per analyze and cleaned them up.

**Explainability at HEAD: absent.**
- No `Services/explainability.js`, no `ScoreBreakdown.jsx`.
- The NLP no longer returns `component_weights` or `jd_source`.
- The score is `Math.round(similarity*100)` (`analysis.controller.js:191`).
- The only "explainability" UI is the unreachable `ScoreExplainability.jsx`, with weights that disagree with the baseline service (R39).
- Before `314e494`: CHECKLIST 4.3 and 4.4 were DONE_CORRECTLY and 4.5 was partial (AUDIT@32905c1).

---

## 8. Docs that `314e494` deleted, and stale docs at HEAD

| Doc | At HEAD | Role (as written) | Row |
|---|---|---|---|
| `CHECKLIST.md` (187 lines @`32905c1`) | **Missing** | "Ground-truth feature list", derived only from `PROJECT_SOURCE_DOCS.md`: what *should* exist. CLAUDE.md calls this role `IDEAL_CHECKLIST.md`; the name differs. | R24 |
| `AUDIT.md` (396 @`32905c1`) | **Missing** | Status of each CHECKLIST item against code: what *does* exist. CLAUDE.md expects `AUDIT.md` and asks that it be kept updated. | R24 |
| `Docs/project_checklist.md` (62 @`32905c1`) | **Missing** | The team's self-reported checkboxes. CLAUDE.md: "Do NOT treat as accurate", use only as a pointer. | R25 |
| `Docs/IMPLEMENTATION-TRACKER.md` (258, `ad4f694`) | Present | A second team tracker: tech stack, done/todo lists, a Firestore migration plan. Overlaps `project_checklist.md` (self-reported status) and `CHECKLIST.md` (feature list). | R40 |
| `PROJECT_SOURCE_DOCS.md` | Present (restored in `4ed559d`) | The spec | — |
| `Docs/Architecture.md` (48) | Present (re-added) | A spec summary pasted from chat output; says MongoDB | R26 |

**Input for the tracker task (no decision here):**
- Four files describe "what exists or should exist", with three different trust levels:
  - **Spec-derived:** CHECKLIST.
  - **Code-verified:** AUDIT.
  - **Self-reported:** project_checklist, IMPLEMENTATION-TRACKER.
- IMPLEMENTATION-TRACKER's status claims conflict with AUDIT@`32905c1` and with HEAD code: custom NER, MongoDB models, recruiter charts and alerts (R40), plus Firestore (I-0008).
- CLAUDE.md's file names don't match the repo:
  - it says `IDEAL_CHECKLIST.md`, but the file is `CHECKLIST.md`;
  - it says `project_checklist.md` with no folder, but the file lives at `Docs/project_checklist.md`.

**Stale at HEAD (the owner's docs, not classified):**
- **`CODE_MAP.md`** (580 lines) was written against `32905c1`. It makes 33 references to things missing at HEAD (`explainability.js`, `NLP_PARSE_URL`, `jd_source`, `split_sections`, …). I-0002 already noted its stale Upload rows.
- **`REVIEW_BRIEF.md`** (727 lines) says "Every claim here traces to `AUDIT.md` or `CODE_MAP.md`". AUDIT.md is missing at HEAD, and it makes 93 references to missing items.
- Both become accurate again only if the apply restores `32905c1`'s behaviour. Until then they describe code that isn't on this branch.

---

## 9. Proposed apply order

**Step 0. Decisions first.** The owner marks the table. The team settles:
- **R6:** auth client;
- **R9/R15:** upload flow;
- **R38:** recruiter Dashboard;
- **R40:** tracker task (can run in parallel).

These decide what steps 2–4 hand-merge.

### Step 1: bring back the baseline lineage. Mechanism comparison (owner addition 2)

**Option (a): `git revert --no-commit 314e494`.** Simulated in memory with
`git merge-tree --write-tree --merge-base=314e494 HEAD 08afde3`. That command
writes objects only; no working tree, index or ref was touched.

- **Conflicts:** exactly **one** file has a textual conflict: recruiter `Dashboard.jsx`, 8 hunks (R38). These six auto-merge:
  - `jobs.controller.js`
  - `auth.Middleware.js`
  - `index.js`
  - `App.jsx`
  - `AuthContext.jsx`
  - `Login.jsx`
- **Comes back byte-identical to `32905c1`:**
  - the NLP (R17);
  - `explainability.js`, `ScoreBreakdown.jsx` and the candidate/recruiter pages (R18);
  - the migration (R19);
  - AUDIT, CHECKLIST and project_checklist (R24, R25);
  - the `/candidate/results` route and the `process.env` line in `Login.jsx`.
- **Deleted:** `mockData.js`, the Mongoose models and `mongoose`, `parse.routes.js`, `Architecture.md`, and the empty controllers (R20–R22, R26).
- **Re-applied automatically:** `08afde3` (R16).
- **Kept automatically:** everything from `ad4f694`, Aditya's UI work, and `71c632d` (the result still differs from `32905c1` in exactly those 27 files).
- **What (a) does NOT restore.** It only gets back to the `e7bf01b` + `08afde3` state, and `e7bf01b` had already lost the baseline in four files:
  1. `analysis.controller.js`: `buildScoreRecord` wiring, `resumes`/`scores` persistence, `NLP_PARSE_URL`, forwarding `required_skills`/`preferred_skills`, `resolveContentType`, error logging, the scoped readers (R14). **Without the skill forwarding, the restored NLP falls back to `jd_source = parsed_description`.**
  2. `auth.controller.js`: **after (a) alone the backend won't boot.** The restored `auth.routes.js` imports `requestPasswordReset`/`resetPassword`, which the current controller doesn't export. This was confirmed on the simulated tree, and it is the same failure as `e7bf01b`. The restore (R13) must land in the same step.
  3. `Config/supabase.js`: the Authorization pin (R5, R12).
  4. `Upload.jsx`: per R9.

  It also doesn't fix anything that `ad4f694` introduced (R29–R35, R39).

**Option (b): file-by-file `git restore --source=32905c1 -- <paths>`.**
- **Pros:**
  - Exact per-file control.
  - Restores the four `e7bf01b` files straight from the baseline.
  - Maps naturally onto one-module-per-commit.
- **Cons:**
  - It isn't an inverse of `314e494`, so history doesn't show "`314e494` undone". A reviewer has to check about 41 paths one by one.
  - It loses `08afde3`, which isn't in the baseline, unless that is re-applied by hand.
  - For the 8 files touched after the reset (`analysis.controller`, `jobs.controller`, middleware, `index.js`, `App.jsx`, `AuthContext`, `Login`, recruiter `Dashboard`), a blind restore silently drops `71c632d`/`ad4f694`/`4fc97db` work. They need hand-merging anyway.

**Recommendation: (a), followed in the same working session by (b) for exactly
three backend files:**
1. Run `git revert --no-commit 314e494` and resolve `Dashboard.jsx` per R38. Until R38 is decided, take the baseline side and mark the ad4f694 actions TODO.
2. Hand-merge `analysis.controller.js`, `auth.controller.js` (+ `auth.routes.js`) and `supabase.js` from `32905c1`, keeping the KEEP/KEEP-WITH-FIX hunks of R7, R10, R30 and R36.
3. Only then run the harness.

Why (a): it is one auditable inverse patch (`git show 314e494` vs the revert),
it re-applies `08afde3` for free, and it leaves a single conflict. Staging stays
with the owner, who can split the working tree into module-sized commits:
- `nlp-engine/` first: snapshots must **hash-match the baseline**;
- backend scoring + migration;
- auth;
- frontend;
- docs.

### Steps 2–7

2. **Security fixes (`ad4f694`):** R35 fail-closed `requireAuth`, R34 delete `/notifications/send`, R32 ownership check on shortlist. One small commit.
3. **Analyze path:** if R14's restore didn't already supersede R29, re-add the `path` import and the job lookup. Tier 2 must return 200 with all keys and persisted rows, and the teardown check must be all 0.
4. **Aaron's flow per the R9 decision:** R7/R10 fixes (content type, storage errors, env var) and R11 (exit on EADDRINUSE).
5. **ad4f694 keepers:** R30 (one handler, null not 0, `.limit(1)`, no `email`), R31 delete, R33 env var, R38 merged Dashboard, R39 delete the three mock pages.
6. **Env-var sweep (I-0012):** one `REACT_APP_API_BASE_URL` constant across the 10 `import.meta.env` files.
7. **After every step:** run `tests/run-suite.ps1 -Target current` (with `-Live` from step 3 on) and `sweep.mjs --check`. Lint warnings must not exceed the baseline's 6.

---

## 10. For the team

This section is written to be shared as is. It's about what happened to the
code, not about who did what wrong. This kind of git accident is common when
three people rewrite the same files in the same week.

**What happened**
- **3 Sept, three lines of work in flight at once:**
  - Anthony: saving each candidate's score to the database with an explanation, plus parser fixes.
  - Aaron: upload a resume once, view a job, apply.
  - Aditya: logout fix, loaders, notifications, a recruiter dashboard with shortlisting.
- **The first merge kept one side in four files.** Main was merged into Aaron's branch and four files conflicted. Each conflict was resolved by keeping Aaron's version of the file. That works for conflicting lines, but it also dropped Anthony's scoring code in those files.
- **The next commit put back an older copy of the whole project.** It saved a copy that exactly matches Aaron's branch from *before* that merge, so the merge was undone everywhere. It removed:
  - the parser fixes;
  - the scoring/explanation service;
  - a database migration;
  - three docs;
  - Aaron's own "already applied" badge from minutes earlier.

  To git this looked like an ordinary edit, so merging it into main raised no conflict and nobody was warned.
- **New work landed on the older code.** Aditya's later features were built on that state, so they sit on top of the older code too.
- **Today:** the main "analyze resume" request fails (one import line went missing), and the parser invents job history from phone numbers and skill names.

**What the plan changes for each person's work**
- **Aaron:**
  - Upload-once, the job detail page and Apply all **stay**, with small fixes: the file type sent to storage, handling storage errors, the API URL setting, and the server exiting cleanly when its port is taken.
  - The "already applied" badge comes back.
  - The singleton auth client vs the per-request client is a team choice, since both fix the same bug.
  - **Question for you:** did you have newer parser/NLP work locally that never got pushed? The pushed commit doesn't contain any.
- **Aditya:**
  - Logout, the loaders, notifications and the shortlist/reject workflow **stay**.
  - Shortlisting gets a check that the job belongs to the recruiter.
  - The open "send any notification" route is removed.
  - The login check goes back to rejecting a request when the profile lookup fails.
  - Three pages that no route reaches (alerts, ranking, score panel) would be removed, because they show sample or randomly generated scores.
  - The recruiter dashboard needs a short joint decision: your workflow and the score-explanation view should become one page.
- **Anthony:** the parser fixes, the scoring/explanation service, the migration and the docs come back. The three backend files where both versions changed need a careful hand-merge.
- **Everyone:** decide the upload flow together. Is it "analyze against a job" (scores for recruiters) or "upload once, then apply" (job-portal model)? Or both, scoring at apply time?

**Habits that would have caught this**
- After any merge, run `git diff --stat HEAD~1`. A 41-file diff on a commit you expected to touch three files is the warning sign.
- Don't copy project folders over the repo. Use `git stash` / branches instead.
- Run `tests/run-suite.ps1` before pushing to `main`. It now catches exactly these regressions.

---

## 11. Open questions

Team agreed not to push to main until the integration PR is open.

- **Q1 (Aaron):** is there unpushed local NLP/parsing work? (§3.1)
  - **Answer (2026-10-12):** No unpushed NLP work (Aaron). Restore proceeds.
- **Q2 (team):** upload flow: analyze per job, upload once then apply, or the middle ground? (R9, R15)
  - **Answer (2026-10-12):** Team agreed: upload once, apply runs analyze (see R9).
- **Q3 (team):** auth client: singleton `supabaseAuth` or per-request `createUserScopedClient`? (R6)
  - **Answer (2026-10-12):** Team chose supabaseAuth singleton with fixes; reset flow keeps a per-request client (see R6).
- **Q4 (Aditya + owner):** the merged recruiter Dashboard: workflow actions on top of the score/explanation view? (R38)
  - **Answer (2026-10-12):** Aditya agreed: baseline view now, merged page in follow-up (see R38).
- **Q5 (tracker task):** how CHECKLIST / AUDIT / project_checklist / IMPLEMENTATION-TRACKER relate, and the CLAUDE.md file-name mismatch (§8, R40)
  - **Answer (2026-10-12):** Tracker task.
- **Q6 (team):** should the Landing page's sample score and "10000+ verified" stats be labelled as examples? (I-0026)
  - **Answer (2026-10-12):** Remove the fake stat, label the demo score 'Example'; separate small task (I-0026).
