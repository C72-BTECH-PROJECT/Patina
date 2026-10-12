# Work Log

One entry per prompt, appended at the end of the turn, newest at the bottom.
Max 15 lines per entry. When this file passes ~400 lines, move all but the
last 20 entries to `docs/worklog-archive/YYYY-MM.md` and keep a 5-line
rollup per archived month at the top of this file.

---

## L-0001 · 2026-10-12 · Task specs, worklog, prompt-capture hook, ISSUES.md restructure
- Prompt: set up task specs, worklog, a prompt-logging hook, CLAUDE.md
  session protocol, and restructure ISSUES.md (docs/config only).
- Task: ad-hoc (tooling setup)
- Done: tasks/TEMPLATE.md, WORKLOG.md created; .claude/settings.json +
  .claude/hooks/log-prompt.js added (schema verified against official docs);
  .claude/logs/ gitignored; CLAUDE.md got a 13-line Session protocol;
  ISSUES.md rebuilt as I-0001..I-0008 — 5 old entries re-verified vs. code
  (2 stale, moved to Resolved), 3 new issues found.
- Verification: hook schema confirmed against docs. Hook firing confirmed —
  test prompt "testing the hook now" wrote a matching line to
  .claude/logs/prompts.jsonl.
- Files changed: .gitignore, CLAUDE.md, ISSUES.md (mod); .claude/,
  WORKLOG.md, tasks/ (new) — per `git status --porcelain`.
- Issues logged: I-0006, I-0007, I-0008 new; I-0002, I-0003 resolved.
- Next: none — setup complete.

## L-0002 · 2026-10-12 · T-0001 baseline harness (paused before tier 2)
- Prompt: confirm 32905c1 baseline, build worktree, black-box harness (NLP/backend/frontend/manual), run vs baseline.
- Task: T-0001 (spec approved incl. 4 owner additions).
- Done: worktree ../patina-baseline @32905c1 (.env copies w/ ports 8100/5100, node_modules junctions);
  tests/ (6 synthetic fixtures + generator, pytest NLP suite + snapshots, node:test smoke + live
  analyze + scoped sweep, run-suite.ps1, README, MANUAL_SMOKE, BASELINE_RESULTS); .gitignore rules.
- Verification: NLP 10/10, snapshots identical across restarts; backend tier 1 7/7; CI=true
  frontend build FAILS (6 no-unused-vars). Red check = Supabase Preview migration error, not Actions.
- Files changed: .gitignore, ISSUES.md, WORKLOG.md (mod); tasks/T-0001-baseline-harness.md, tests/ (new).
- Issues logged: I-0009..I-0015 (HEAD analyze 500, Supabase auto-apply decision, NLP revert by
  314e494, import.meta.env under CRA, resumes table no migration, PROJECT_SOURCE_DOCS deleted, set-order contact fields).
- Next: owner creates t0001_cand/t0001_recr + tests/.env → run tier 2 (-Live); owner runs MANUAL_SMOKE.

## L-0003 · 2026-10-12 · T-0001 test accounts, signup bug, tier 2 against baseline
- Prompt: log browser-signup failure; create t0001_cand/t0001_recr via baseline API; run tier 2; fill Result.
- Task: T-0001 (all criteria resolved except 11, which waits on the owner's manual smoke).
- Done: I-0016 (one-word "Full Name" → misleading 400, same code at HEAD and 32905c1) and
  I-0017 (duplicate profiles insert vs trigger) logged. Accounts created via POST :5100/api/auth/signup
  after confirming no existing t0001_* profile/email; passwords generated into tests/.env only.
- Verification: both accounts email-confirmed (admin API). Tier 2 `tests 8 / pass 8`; teardown removed
  scores 1, resumes 1, jobs 1, storage 1; `sweep.mjs --check` all 0, exit 0.
- Files changed: ISSUES.md, WORKLOG.md, tasks/T-0001-baseline-harness.md, tests/BASELINE_RESULTS.md,
  tests/.env.example (mod); tests/.env (new, git-ignored).
- Next: owner runs tests/MANUAL_SMOKE.md (criterion 11). Then T-0002: run harness with -Target current and diff.

## L-0004 · 2026-10-12 · T-0001 criterion 11 (manual smoke vs baseline) recorded
- Prompt: start baseline stack for manual smoke; then record criterion 11 from MANUAL_SMOKE §A observations.
- Task: T-0001 (all 13 criteria now PASS; 11 with limited coverage).
- Done: baseline stack started detached (8100/5100/3100, PIDs in tests/.out/manual-stack.pids).
  Criterion 11 recorded: A1/A5 pass; A2 confirms hardcoded :5000 in Upload.jsx:121 only under the
  split-port setup (original single-stack setup and missing-credentials cause untested); A3–A4 not run;
  A6 inconclusive (job never seeded); A7 covered by read-only `sweep.mjs --check` = all 0.
- Verification: `node tests/backend/sweep.mjs --check` → all counts 0 (jobs: 0 explains A6), exit 0.
- Files changed: tasks/T-0001-baseline-harness.md, tests/BASELINE_RESULTS.md, WORKLOG.md (mod).
- Issues logged: none (A2 behaviour is baseline-only; HEAD hardcodes already in I-0012).
- Next: stop the baseline stack when done; T-0002 = run harness with -Target current and diff.

## L-0005 · 2026-10-12 · Restore PROJECT_SOURCE_DOCS.md; I-0014 resolved; I-0010 decision
- Prompt: restore PROJECT_SOURCE_DOCS.md from 32905c1 unedited, fix TEMPLATE.md, resolve I-0014, record I-0010 option (a).
- Task: ad-hoc (docs-only)
- Done: `git restore --source=32905c1 -- PROJECT_SOURCE_DOCS.md`; TEMPLATE.md spec-ref note fixed;
  I-0014 moved to Resolved; I-0008 got a note on the spec's MongoDB wording (doc not edited);
  I-0010 records owner's option (a) (auto-deploy disabled), stays OPEN.
- Verification: blob hash of working file == `git rev-parse 32905c1:PROJECT_SOURCE_DOCS.md` (6ef3f4a). Literal
  `git diff 32905c1 -- PROJECT_SOURCE_DOCS.md` prints a "deleted file" diff, not nothing: file is untracked
  (we don't stage). Will print nothing once the owner stages it.
- Files changed: ISSUES.md, tasks/TEMPLATE.md, WORKLOG.md (mod); PROJECT_SOURCE_DOCS.md (new, untracked).
- Issues logged: I-0014 resolved; I-0008, I-0010 updated. I-0010 auto-deploy setting is owner-reported, not verified.
- Next: owner commits PROJECT_SOURCE_DOCS.md + docs changes.

## L-0006 · 2026-10-12 · T-0002 integration review (baseline 32905c1 → HEAD)
- Prompt: read-only INTEGRATION_REVIEW.md classifying every teammate commit/merge hunk, harness vs baseline, 5 owner additions.
- Task: T-0002 (plan approved incl. additions 1-5).
- Done: harness on current (ports 8200/5200, owner's dev stack left running); 2 read-only review subagents
  (Aaron / Aditya), claims re-verified; 41-row table (9 KEEP, 7 KEEP-WITH-FIX, 20 REVERT, 5 NEEDS-TEAM-DECISION).
- Key findings: 314e494 tree == 71c632d (reset, nothing new; HEAD NLP == 365a09e); I-0009 is from ad4f694, not 71c632d;
  e7bf01b took Aaron's side in 4 files and could not boot; `git revert 314e494` alone also won't boot (auth exports).
- Verification: NLP 10/10 ×2 (hashes equal), tier 1 7/7, tier 2 500 `path is not defined`, CI build 21 warnings, sweep --check all 0.
- Files changed: ISSUES.md, WORKLOG.md (mod); INTEGRATION_REVIEW.md, tasks/T-0002-integration-review.md, tests/nlp/snapshots/current/ (new).
- Issues logged: I-0018..I-0022 (P0 security), I-0023..I-0026; notes on I-0001/4/7/8/9/11/12/13.
- Next: owner marks decisions in INTEGRATION_REVIEW.md §1; team answers Q1-Q6; then apply per §9.

## L-0007 · 2026-10-12 · T-0002 owner decisions recorded in INTEGRATION_REVIEW.md
- Prompt: fill the Owner decision column (R1-R41) and §11 answers with the team's final decisions (2026-10-12).
- Task: T-0002 (decisions step; nothing applied).
- Done: all 41 Owner decision cells filled verbatim from the prompt; "Answer (2026-10-12)" added under Q1-Q6;
  §11 note that the team won't push to main until the integration PR is open.
- Decisions of note: R6 = lazy supabaseAuth singleton (+ per-request client for session-setting reset);
  R9/R15 = upload once, apply runs analyze (T-apply; score-on-apply follow-up); R38 = baseline view now;
  R32/R34/R35 deferred to security task (I-0019/20/21, test-first); R40 to tracker task.
- Verification: script asserted 41 rows filled and 6 answers inserted; no other text edited.
- Files changed: INTEGRATION_REVIEW.md, WORKLOG.md (mod).
- Issues logged: none.
- Next: write task specs (T-apply, security, tracker, score-on-apply) for approval; then apply per §9.

## L-0008 · 2026-10-12 · T-0003 spec + Phase 1 (revert 314e494, hand-merge 4 backend files)
- Prompt: write the T-0003 apply-integration spec (+ owner criteria 10/11), then apply phase by phase, stopping after each.
- Task: T-0003 (Phase 1 done; Phases 3–4 and close-out pending owner review).
- Done: `git revert --no-commit 314e494` → `git reset -q` (nothing staged). Dashboard = 32905c1 + 04835ca loader.
  supabase.js restored; supabaseAuth lazy getter; auth.controller = baseline + R6 client swap; analysis.controller = baseline + HEAD storage handlers/getAllApplicants verbatim (197+/0-).
- Verification: NLP 10/10, f1–f6 + 3 private hashes = baseline; tier 1 7/7; **tier 2 PASS** (was 500); sweep 0 before/after;
  CI build 6 warnings (5 baseline + CandidateLayout:11, due in Phase 4); I-0018 probes 404/400; R6 no-anon-key probe 500 JSON, server up; npm ls OK.
- Files changed: 44 (38 tracked + 6 restored untracked), ISSUES.md, WORKLOG.md; new tasks/T-0003-apply-integration.md.
- Issues logged: I-0027 (404 handler always says "GET"). Issue statuses are updated at close-out.
- Next: owner reviews + commits Phase 1; then Phase 3 (§9 step 4: R7, R10, R11).

## L-0009 · 2026-10-12 · T-0003 Phase 3 (R7, R10, R11)
- Prompt: continue (Phase 1 committed as a7c74e4).
- Task: T-0003 (Phase 3 done; Phase 4 and close-out pending owner review).
- Done: R7: resolveContentType, 500 on a status storage error, extension-only check. R10: apply returns 500 on a storage error;
  JobDetail/Upload use REACT_APP_API_BASE_URL. R11: exit(1) on listen error and uncaughtException; watchdog removed.
- Verification: NLP 10/10, all hashes = baseline; tier 1 7/7; tier 2 PASS; sweep 0; CI still 6 warnings (same set).
  Probes: busy-port backend exits with code 1; .txt → 400; DOCX as octet-stream → 200 stored; status hasResume; swept to 0.
- Files changed: analysis.controller.js, jobs.controller.js, index.js, JobDetail.jsx, Upload.jsx; task file, WORKLOG.md.
- Issues logged: none new. The storage-error 500 branches are verified by diff only (no live outage).
- Next: owner commits Phase 3; then Phase 4 (R30, R31, R33, R39 + import.meta.env check).

## L-0010 · 2026-10-12 · T-0003 Phase 4 (R30, R31, R33, R39)
- Prompt: continue (Phase 3 committed as e9e4592).
- Task: T-0003 (Phase 4 done; close-out pending owner review).
- Done: R30 getAllApplicants (no DEBUG, null not 0, latest score via limit(1), batched profile names, no email column);
  R31 getAllApplications + route deleted; R33 env var in CandidateLayout/Notifications + unused `user` removed; R39 3 mock pages deleted.
- Verification: NLP hashes = baseline; tier 1 7/7; tier 2 PASS; sweep 0; **CI = exactly the 5 baseline CreateJob/Jobs warnings**;
  no import.meta.env left. Probe: unscored applicant → credibilityScore null; GET /api/jobs/applications → 404; swept to 0.
- Files changed: analysis.controller.js, jobs.controller.js, jobs.routes.js, CandidateLayout.jsx, Notifications.jsx, 3 deleted; ISSUES.md, task, WORKLOG.
- Issues logged: I-0028 (applicants email now empty; no caller).
- Next: owner commits Phase 4; then close-out (final Result, ISSUES statuses).

## L-0011 · 2026-10-12 · T-0003 close-out
- Prompt: continue (Phase 4 committed as 5446ebe).
- Task: T-0003 (complete: all 11 criteria PASS).
- Done: final per-criterion Result in the task file. ISSUES.md: I-0007/09/11/13/18/22/23/24 moved to Resolved with evidence re-checked
  at 5446ebe; notes on I-0001 (MIME/size cap still in no migration), I-0010 (migrations unguarded), I-0012 (3 hardcoded URLs left);
  I-0027/28 added to the Open table.
- Verification: greps/blob hashes re-run at HEAD (nlp diff empty, migration blob 8c9decd = 32905c1, no update-password, exit(1) at index.js:91,105).
- Files changed: ISSUES.md, tasks/T-0003-apply-integration.md, WORKLOG.md (docs only).
- Issues logged: none new.
- Next: owner runs tests/MANUAL_SMOKE.md on the restored UI; Prompt 4b (I-0019/20/21, test-first); tracker task (R40, AUDIT/CHECKLIST reconcile); score-on-apply + merged Dashboard (R9/R38, I-0028).

## L-0012 · 2026-10-12 · T-0004 shortlist ownership (I-0019), test-first
- Prompt: specs for I-0019/20/21/22 (T-0004..T-0007), then fix I-0019 test-first; owner added a status allow-list criterion.
- Task: T-0004 (complete: all 8 criteria PASS). T-0005..T-0007 specs written, not started.
- Done: created `t0001_recr2` (plus-alias email, admin-confirmed, password in tests/.env only). Test infra: sweep/guards for R2,
  C2 and `notifications`; profile snapshot, `--restore-profiles`, `profile-missing:*` in `--check`; lib/session.mjs.
  `live-shortlist-authz.test.mjs` (11 tests). Fix: ownership lookup via `jobs!inner(recruiter_id)` -> 404, allow-list is `shortlisted`/`rejected` only.
- Verification: red 4/11 failed (200 + row changed + notification created; unknown id 500; "submitted" accepted) -> green 11/11.
  Full harness: NLP 10/10, backend 19/19, frontend = same 5 CreateJob/Jobs CI warnings; sweep --check 0; restore-profiles twice identical.
- Files changed: jobs.controller.js; tests/backend/{lib/testdb,lib/session,sweep,live-shortlist-authz}.mjs, run-suite.ps1, README, .env.example; tasks/T-0004..0007; ISSUES, WORKLOG.
- Issues logged: I-0029 (malformed applicationId -> 500). I-0019 moved to Resolved.
- Next: owner commits T-0004; then T-0005 (I-0020).

## L-0013 · 2026-10-12 · T-0005 remove notifications/send (I-0020), test-first
- Prompt: T-0004 committed; continue with T-0005.
- Task: T-0005 (complete: all 5 criteria PASS).
- Done: `live-notifications-authz.test.mjs` (4 tests); deleted `POST /api/notifications/send` and the unused import; file added to `-Live` in run-suite.ps1.
- Verification: red 1/4 failed (candidate spoof → 200, delivered to the recruiter's inbox and DB) → green 4/4 (404, nothing delivered).
  Full harness: NLP 10/10, backend 23/23, frontend = same 5 CreateJob/Jobs CI warnings; sweep --check 0; grep finds no other caller.
- Files changed: backend/Routes/notification.routes.js; tests/backend/live-notifications-authz.test.mjs, tests/run-suite.ps1; tasks/T-0005; ISSUES, WORKLOG.
- Issues logged: none new. I-0020 moved to Resolved.
- Next: owner commits T-0005; then T-0006 (I-0021, fail-closed requireAuth).

## L-0014 · 2026-10-12 · T-0006 requireAuth fail-closed (I-0021), test-first
- Prompt: T-0005 committed; continue with T-0006.
- Task: T-0006 (complete: criteria 1-3, 5 PASS; 4 verified by diff only, as planned).
- Done: `live-auth-failclosed.test.mjs` (deletes/restores t0001_recr2's profile with snapshot + upsert-in-finally + after() restore);
  `requireAuth` now returns 401 on query error, thrown exception or missing profile.
- Verification: red (profile deleted) → jobs/mine 200 and notifications 200; green → 401/401, 200 again after restore.
  Crash recovery simulated: `--check` exit 1 with profile-missing:t0001_recr2: 1, `--restore-profiles` fixed it, `--check` exit 0.
  Full harness: NLP 10/10, backend 24/24, frontend = same 5 CreateJob/Jobs CI warnings; sweep --check 0.
- Files changed: backend/Middlewares/auth.Middleware.js; tests/backend/live-auth-failclosed.test.mjs, tests/run-suite.ps1; tasks/T-0006; ISSUES, WORKLOG.
- Issues logged: none new. I-0021 moved to Resolved.
- Next: owner commits T-0006; then T-0007 (I-0022 guard; needs t0001_cand2 created first).
