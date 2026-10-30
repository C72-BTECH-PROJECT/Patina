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

## L-0015 · 2026-10-12 · T-0007 analysis-isolation regression guard (I-0022)
- Prompt: T-0006 committed; continue with T-0007.
- Task: T-0007 (complete: all 5 criteria PASS). No production code changed; no red run (I-0022 was already fixed in T-0003).
- Done: created `t0001_cand2` (plus-alias email, admin-confirmed, password in tests/.env only); `live-analysis-isolation.test.mjs` (3 tests, real analyze via NLP);
  added to `-Live` in run-suite.ps1; I-0022 note in ISSUES.md.
- Verification: passes at HEAD 3/3. Detector check: filter removed temporarily → cand2 got 200 with C's email/GitHub/id; restored, controller diff empty.
  Full harness: NLP 10/10, backend 27/27, frontend = same 5 CreateJob/Jobs CI warnings; sweep --check 0; no allAnalyses/latestAnalysis.
- Files changed: tests/backend/live-analysis-isolation.test.mjs, tests/run-suite.ps1, tests/README.md; tasks/T-0007; ISSUES, WORKLOG.
- Issues logged: none new.
- Next: owner commits T-0007. Remaining from L-0011: tracker task (R40, AUDIT/CHECKLIST), score-on-apply + merged Dashboard (R9/R38, I-0028); I-0029 (bad UUID 500) is open.

## L-0016 · 2026-10-12 · Manual smoke section C (integrated), stack run and closed
- Prompt: add section C to MANUAL_SMOKE.md, seed the job, start the stack on 3000/5000/8000, leave it running; then "done".
- Task: none (manual verification support; no code changed).
- Done: section C (C1-C16, predictions only; A and B untouched). Seeded job bbd5d81f-fd02-4311-aa7d-ba238199c39e. Ports were free; started NLP/backend/frontend.
  On "done": stopped all three process trees, ports free, ran sweep.mjs.
- Verification: sweep removed applications 1, jobs 1, storage candidates/<C>/ 1 (scores/resumes/notifications 0); remaining all 0, exit 0.
  Consistent with C3/C7 (resume stored, application created) and "no score yet".
- Observations: the owner filled the Observed column (committed in af4fad4): C1-C15 all matched the predictions. C16 filled with the sweep result.
- Files changed: tests/MANUAL_SMOKE.md (Observed note and C16), WORKLOG.md.
- Issues logged: none.
- Next: PR description for Anthony_V2 -> main.

## L-0017 · 2026-10-12 · PR description for Anthony_V2 -> main
- Prompt: smoke observations committed (all matched); write PR_DESCRIPTION.md, not committed.
- Task: none (docs only).
- Done: PR_DESCRIPTION.md (what happened, per person from §10, R6/R9/R38, T-0004..T-0007 red/green table, harness before/now, after-you-pull, open items).
  Corrected my earlier "observations not provided" note in MANUAL_SMOKE.md and L-0016 now that the owner's observations are committed; C16 filled.
- Verification: facts re-checked against the repo: main's code == 4ed559d's code (git diff empty); mongoose gone from package.json and no imports; SUPABASE_ANON_KEY read lazily in supabaseAuth.js;
  figures copied from the T-0004..T-0007 Results.
- Files changed: PR_DESCRIPTION.md (new, untracked by request), tests/MANUAL_SMOKE.md, WORKLOG.md.
- Issues logged: none.
- Next: owner opens the PR; then tracker task and score-on-apply.

## L-0018 · 2026-10-12 · T-0008 tracker reconciliation (CHECKLIST / AUDIT / archive)
- Prompt: one source of truth for exists/should-exist; owner answered D1 as recommended and added GR-1, GR-2 and the `docs` suite.
- Task: T-0008 (complete: 12/12 criteria PASS).
- Done: CHECKLIST = spec list, AUDIT = verified status (91 rows, added Spec/Delivered-by, CODE_REVIEWED_UNTESTED + CLAIMED_UNVERIFIED, data model); trackers to Docs/archive/ with headers;
  CLAUDE.md names fixed; new items 1.15-1.17, 4.12, 5.13-5.15, GR-1, GR-2, X-1, X-2; `tests/docs/check-trackers.mjs` + `docs` suite in run-suite.ps1.
- Verification: docs suite green (91/91); red 85 problems before the rewrite; red again with one CHECKLIST id removed, then restored. 25 status changes in the task Result.
  Four read-only agents re-verified rows at 2e87d44; I re-read the DONE rows and the apply/upload/App.jsx cites. Full harness not run (docs only).
- Findings: no score is produced through the UI at HEAD (Upload stores a file, Apply inserts a row, `/api/analyze` has no reachable caller); 12 rows lost DONE_CORRECTLY, 9 only for lack of a test (now CODE_REVIEWED_UNTESTED, each naming its promoting test; only GR-2 is CLAIMED_UNVERIFIED).
- Files changed: AUDIT.md, CHECKLIST.md, CLAUDE.md, ISSUES.md, tests/run-suite.ps1, tests/README.md; new tasks/T-0008, tests/docs/, Docs/archive/; two Docs/ files moved.
- Issues logged: I-0030 (CODE_MAP), I-0031 (REVIEW_BRIEF), I-0032 (README), I-0033 (spec MongoDB wording); I-0008 resolved; note on I-0001.
- Next: owner commits T-0008; then the architecture audit (GR-2), score-on-apply and merged dashboard (5.14, 5.15).

## L-0019 · 2026-10-12 · T-0009 architecture audit (GR-2): as-is, verdict, to-be, migration
- Prompt: GR-2 audit (API gateway? microservices as the SRS claims?): ARCHITECTURE.md + plan; owner approved D1–D4, rewrote the §0 brief, M1–M4 marked "minimum that answers GR-2".
- Task: T-0009 (criteria 1-9, 14-18 PASS; 10-12 content PASS, owner judgement; 13 Mermaid render pending owner).
- Done: ARCHITECTURE.md (187 cites; as-is, 7-row verdict, drift + accepted deviations, to-be, compose draft, M1–M9); `tests/arch/nlp-outage-probe.mjs`; check-trackers now checks ARCHITECTURE.md cites/verdicts.
- Findings: no gateway; Express = monolithic core + browser's only API; 1 of 3 services; sessions in MemoryStore (NFR-3 FAIL); NLP down → analyze 500 (not 502), hung → no reply in 20 s; NLP serialises parses.
- Verification: checker green + 3 red checks; docs suite 0; probe exit 0 twice, sweep --check 0, ports free; greps per criteria.
- Files changed: AUDIT, CHECKLIST, CLAUDE.md, ISSUES, WORKLOG, tests/README.md, tests/docs/check-trackers.mjs (mod); ARCHITECTURE.md, tasks/T-0009, tests/arch/ (new).
- Issues logged: I-0034..I-0039; notes on I-0012, I-0031, I-0032, I-0033 (SRS docx says "MERN stack"). AUDIT 1.1 cite is in the upload handler (in I-0034).
- Owner decisions, recorded in ARCHITECTURE.md §4 "Decisions recorded":
  - DEC-1: thin Node gateway, accepted.
  - DEC-2: M3 forward-auth via `/api/auth/me`, accepted. Constraints: only the session cookie is forwarded; `/me` has no limiter and fast 401s; explicit allowlist, deny by default; fails closed; M6 replaces it.
  - DEC-3: JWT target, accepted; timing set by the roadmap.
  - DEC-4: GitHub evidence and assessment as Python services, accepted in principle; owners TBD.
  - Checker: 205 cites OK.
- Next: owner checks Mermaid render and §0; commits; roadmap task sequences M1–M4 vs score-on-apply (5.14) and M5+; team assigns owners for DEC-4.

## L-0020 · 2026-10-14 · T-0010 roadmap (ROADMAP.md, DEC-5/DEC-6, Phase 1 specs T-0011..T-0015)
- Prompt: three-phase roadmap (GitHub microservice → existing features as microservices + score-on-apply/merged dashboard → improvements), then specs for the first Phase 1 tasks; docs only.
- Task: T-0010 (12/12 criteria PASS; 6-8 and the content half of 10 are the owner's judgement). Owner answers: stateless first; DEC-5 internal only; coverage = warning; FE runner → P1-8.
- Done: ROADMAP.md (35 items: P1-1..9, P2-1..9, P3-1..17; contract v1, GF-4 reasons, rate limits, recorded-response tests, LinkedIn/cert feasibility, Mermaid graph); checker ROADMAP rules;
  ARCHITECTURE DEC-3 timing (M5 = P2-7, after M4), DEC-5, DEC-6, §4.1/4.2/4.3/4.4/M8 de-routed; CLAUDE.md pointer; specs T-0011..T-0015 (unapproved).
- Verification: red (ROADMAP missing) exit 1; reds for size XL, forward dependency, 2.99/I-9999 → exit 1; warning run exit 0 with 2 warnings; each restored, SHA-256 equal.
  Final checker 0 warnings, ARCHITECTURE 205 cites OK; run-suite docs 0.
- Files changed: ARCHITECTURE.md, CLAUDE.md, ISSUES.md, WORKLOG.md, tests/README.md, tests/docs/check-trackers.mjs (mod); ROADMAP.md, tasks/T-0010..T-0015 (new).
- Issues logged: I-0040 (relative GitHub link), I-0041 (stale migration comment), I-0042 (checker skips .yml/.toml cites). Noted, not edited: ARCHITECTURE §0 pt 5 order vs the roadmap.
- Next: owner reviews ROADMAP and commits; approves T-0011 (needs a GitHub token + octocat recording) and T-0013 (no deps); T-0012 has 2 open questions; team assigns DEC-4 owners.

## L-0021 · 2026-10-15 · T-0010 open questions answered (T-0012 Q1/Q2, §0 point 5, DEC-4)
- Prompt: record the owner's answers to T-0010's open questions; docs only, ad-hoc, no new spec.
- Task: none (follow-up to T-0010 and T-0012; T-0012 still awaits criteria approval).
- Done: T-0012 Q1 = any owned non-fork repo at any age is `evidenced`; recency reported as `last_activity`, scored via activity only; Q2 weights provisional, env-configurable, P3-12 calibrates.
  ARCHITECTURE §0 pt 5 = roadmap order, one line. DEC-4: owner builds github-evidence. `/api/analyze` stays with P2-3.
- Also: ROADMAP claim-status text and open question 1 aligned (they contradicted Q1); T-0010 Result follow-up note.
- My choice, for the owner to check: "any owned non-fork repo" is covered beyond the 10 detail repos by the repo list's primary `language` field (no extra calls); added to T-0012.
- Files changed: tasks/T-0012, tasks/T-0010, ARCHITECTURE.md, ROADMAP.md, WORKLOG.md.
- Issues logged: none.
- Next: owner approves T-0012 criteria (and T-0011, T-0013); commits.

## L-0022 · 2026-10-15 · T-0013 parser contact determinism (I-0015)
- Prompt: execute the approved T-0013 spec: tests first, red log, implement, full harness, Result, AUDIT, WORKLOG; no commits.
- Task: T-0013 (5/5 criteria PASS).
- Done: `ner.py` contact block uses document order (no `set()`); GitHub prefers a bare profile link, else the first repo link's owner, trailing `.` stripped; new `tests/nlp/test_contact_determinism.py`.
- Verification: red `tests/.out/t0013-red.log` (all seeds 0-4 differed, trailing-dot row failed); green `t0013-green.log`; full harness nlp 0, backend 0 (27/27), docs 0, snapshots diff empty; frontend 1 = the existing CreateJob/Jobs CI lint warnings.
- Findings: the spec's repo-link rows passed at HEAD under seed 0 by luck (only the trailing-dot row was red); noted in Result.
- Files changed: nlp-engine/app/ner.py, tests/nlp/test_contact_determinism.py (new), tests/README.md, ISSUES.md, AUDIT.md (2.1, 1.9, 4.11 evidence; 1.16 cite), tasks/T-0013, WORKLOG.md.
- Issues logged: I-0043 (ROADMAP wording); I-0015 resolved.
- Next: owner commits T-0013; T-0014 (core GitHub integration) consumes `entities.github`.

## L-0023 · 2026-10-15 · T-0011 github-evidence service skeleton (P1-1)
- Prompt: execute the approved T-0011 spec: tests first, red log, implement, full harness, Result, AUDIT, WORKLOG; no commits. The owner then asked for the octocat recorder to be run.
- Task: T-0011 (16/16 criteria PASS; criterion 4 passed once the octocat recording was made).
- Done: `github-evidence/` FastAPI service on :8001 (contract v1 health + `POST /v1/evidence`, httpx client with pagination/cap, primary/secondary/low-water rate limits, one retry, deadline, request ID, safe errors, no CORS/docs), owner-run recorder, README (ROADMAP §1.2 moved; core-side lines stay as a pointer); `tests/github/` with 11 synthetic recordings and the real octocat recording (8 repos, 2 forks); new `github` suite in `run-suite.ps1`.
- Verification: red `tests/.out/t0011-red.log` (`No module named 'app.main'`); green `t0011-green.log` 46 passed, 0 skipped (45 + 1 skipped before the recording); full harness nlp 0, backend 0 (27/27), docs 0 (0 warnings), github 0, frontend 1 = the existing CreateJob/Jobs CI lint warnings.
- Findings: httpx logs request URLs at INFO (muted, or the API URL leaks into logs); the spec's 150-repo case needs `GITHUB_MAX_REPOS` above its default of 100; "after 2 calls" read as 2 attempts at the failing request.
- Files changed: new github-evidence/, tests/github/ (incl. recordings/octocat/); tests/run-suite.ps1, tests/README.md, ROADMAP.md (§1.2, P1-1/P1-2 issue cells), AUDIT.md (2.3, 2.13 evidence only, statuses unchanged), ISSUES.md, tasks/T-0011, WORKLOG.md.
- Issues logged: I-0044 (ROADMAP §1.6 flag), I-0045 (specs cite ROADMAP §1.2), I-0046 (TestClient httpx deprecation); I-0043 cite moved to `ROADMAP.md:218`.
- Next: owner commits T-0011; T-0012 (metrics) builds on this client.

## L-0024 · 2026-10-15 · T-0012 github-evidence metrics and sub-score (P1-2)
- Prompt: execute the approved T-0012 spec: tests first, red log, implement, full harness, Result, AUDIT, WORKLOG; no commits. Owner changes during planning: archived owned repos are detail repos; an empty detail set makes activity/consistency/ownership unavailable (never 0); the recorder is extended and the owner re-records octocat; tests pin the clock to the manifest `fetched_at`; octocat is the real inactive-account case; active-window, no-repos, partial and deadline use synthetic accounts.
- Task: T-0012 (13/13 criteria PASS; 13 with a noted deviation: T-0011 tests were edited minimally for the new detail calls).
- Done: `metrics.py`, `claims.py`, `skill_languages.py`, `scoring.py`; detail calls (`/languages`, paginated `/commits`) with a semaphore and a 5-page cap; `status: partial` with named limitations; injectable clock; recorder records detail files and `fetched_at`; README (formula, provisional weights, budget 22 calls / ~227 candidates an hour, limitations).
- Verification: red `tests/.out/t0012-red.log` (29 failed, 45 passed, 6 skipped); green `t0012-green.log` 80 passed, 0 skipped; full harness nlp 0, backend 0, docs 0 (0 warnings), github 0, frontend 1 = the existing CreateJob/Jobs lint warnings.
- Findings: octocat's 2024 pushes give 0 commits in the window, and the account still scores 0.30 from corroboration (formula as specified); spec criterion 13 cannot hold literally; commit dates are author-set.
- Files changed: github-evidence/app (4 new, 5 mod), tools/record_github.py, .env.example, README; tests/github (2 new test files, snapshot, 5 synthetic accounts, 12 octocat files, conftest, 2 tests, manifest); AUDIT (2.3, 2.4, 2.5, 2.7, 2.13), ISSUES, ROADMAP, tests/README.md, tasks/T-0012, WORKLOG.
- Issues logged: I-0047 (ROADMAP §1.3 lacks `insufficient_evidence`), I-0048 (calibration notes for P3-12).
- Next: owner reviews the snapshot and formula and commits (suggested split: service code + tests + recordings, then trackers); T-0014 maps `sub_score` and `insufficient_evidence`; P1-6 adds code quality.

## L-0025 · 2026-10-15 · T-0014 core GitHub integration (P1-4)
- Prompt: execute the approved T-0014 spec: tests first, red log, implement, full harness, Result, AUDIT, WORKLOG; no commits. Owner decisions in planning: D1 10th reason `insufficient_evidence` (I-0047); D2 fixture = synthetic/active replayed through the real service, login renamed, marked synthetic; D3 404 only by error code; D4 4 ARCHITECTURE cites rewritten as history. Approval added: frontend = exactly the 5 known warnings; a pending manual real-token check.
- Task: T-0014 (12/12 criteria PASS; manual end-to-end check with the owner's token pending).
- Done: `backend/Services/internalHttp.js` (timeout over the whole call, one retry on connect errors, typed errors without body/URL), `githubEvidence.js` (login normalisation, 10 reason codes); `explainability.js` (`buildGithubSubScore` with snapshot and public-repos note, per-skill `sources.github`, flags stay unavailable, `buildScoreRecord(nlp, { github })`); analyze forwards/generates `X-Request-ID`; `githubAggregator.js` deleted; `.env.example` names.
- Tests: `explainability.test.mjs`, `github-evidence-client.test.mjs`, `live-analyze-github.test.mjs`, `lib/stub-server.mjs`, fixture + `make-github-evidence-fixture.py` (byte-stable); `run-suite.ps1` (current only).
- Verification: red `tests/.out/t0014-red.log` (29/39; C9 already passed at HEAD); green `t0014-green.log` 66/66; full harness `t0014-full-harness.log`: nlp 0, backend 0, docs 0, github 0 (80), frontend = exactly the 5 known lint warnings; sweep --check 0; both greps 0 lines.
- Files changed: backend/Services/{internalHttp,githubEvidence}.js (new), explainability.js, Controllers/analysis.controller.js, .env.example, githubAggregator.js (deleted); tests/backend (5 new), tests/run-suite.ps1, tests/README.md; AUDIT.md (17 rows, 38 cites re-pointed, summary 3→11 DONE), ARCHITECTURE.md (4 cites), ROADMAP.md (§1.3 row), ISSUES.md, tasks/T-0014, WORKLOG.md.
- Issues logged: I-0049 (ARCHITECTURE as-is refresh for the GitHub path; unmapped in ROADMAP → 1 checker warning). I-0047 resolved; I-0039 githubAggregator part done; I-0045 T-0014 cite fixed.
- Next: owner reviews the reason texts, commits (suggested split: backend + tests, then trackers), runs the manual real-token check, decides where I-0049 goes (P1-5?); then T-0015 (outage probe).

## L-0026 · 2026-10-15 · T-0015 outage probe P-4..P-6 (P1-5) + I-0049
- Prompt: execute the approved T-0015 spec: tests first, red log, implement, full harness, Result, AUDIT, WORKLOG; no commits. Owner additions: map I-0049 to P1-5 and resolve it (ARCHITECTURE as-is GitHub path with cites, P-4..P-6 in the appendix); docs suite at 0 warnings.
- Task: T-0015 (7/7 criteria PASS).
- Done: `tests/arch/nlp-outage-probe.mjs` gains asserting phases P-4 (service down), P-5 (service hung, TCP stub), P-6 (real github-evidence, dummy token, local 403 GitHub stub); `hangStub` helper (P-2 now uses it); `check` rows print expected/observed/PASS|FAIL; exit 1 on any FAIL; default phases 1-6; table to `t0015-probe.md`. The probe starts NLP for P-4..P-6 so the score is produced. ROADMAP §1.2: core → service 8 s confirmed.
- Verification: red (`GITHUB_EVIDENCE_TIMEOUT_MS=60000`) `tests/.out/t0015-red.log`: P-5 analyze FAIL, exit 1; green `t0015-green.log` (phases 1-6, exit 0) and `t0015-green-456.log` (9/9 PASS); full harness `t0015-full-harness.log`: nlp 0, backend 0 (66/66), github 0 (80), docs 0, frontend 1 = the 5 known lint warnings; final docs run 0 warnings (`t0015-docs.log`); sweep --check 0, ports 5000/8000/8001 free.
- Measured: down 0.7-1.2 s, hung 8.6-8.7 s, rate-limited 0.9 s then 0.6 s with 0 more GitHub requests.
- Files changed: tests/arch/nlp-outage-probe.mjs, tests/README.md, ROADMAP.md (§1.2, P1-5 row, P2-1/P2-9 issue cells), ARCHITECTURE.md (GitHub path, shifted cites, Appendix A.2), AUDIT.md (0.7, 2.8, 2.13, GR-2 evidence), ISSUES.md, tasks/T-0015, WORKLOG.md. No production code.
- Issues logged: I-0050 (probe login row label), I-0051 (AUDIT 0.1/GR-2 "1 of 3 services"). I-0049 resolved.
- Next: owner commits (suggested split: probe + README, then ARCHITECTURE/AUDIT/ROADMAP/ISSUES/task/WORKLOG); ARCHITECTURE's verified-at hash is still `8e8e498` because the work is uncommitted, so re-stamp it after the commit; then P1-6 (8DFS).

## L-0027 · 2026-10-15 · T-0014 manual real-token check
- Prompt: run the pending manual check with the real services and GitHub API on `tests/private/Anthony_Jennis_Resume`; show only the sub-score facts; sweep, stop services, record. No commits.
- Task: T-0014 manual check - NOT EXERCISED (not a pass or a fail of the code).
- Done: confirmed env presence (URL set, token set, not printed); started NLP, github-evidence, backend; seeded, logged in as `t0001_cand`, analyzed; swept (recount 0); stopped all three, ports free.
- Result: HTTP 200, GitHub sub-score unavailable with `no_github_link`; github-evidence never called. The PDF's GitHub link is a hyperlink annotation behind the word "GitHub", which text extraction does not read. Weights fell back to parsing 1.0 (GF-4 behaviour confirmed). Rate limit 4997/5000 (untouched).
- Files changed: tasks/T-0014 (Result), ISSUES.md, WORKLOG.md. No production code, no tests.
- Issues logged: I-0052 (P1, link annotations not extracted).
- Next: owner decides - re-run with a résumé that prints the URL as text, or fix I-0052 first (needs a roadmap slot; unmapped, so the docs checker may warn).

## L-0028 · 2026-10-15 · T-0014 manual check, second run
- Prompt: re-run the manual check with `tests/private/resume.pdf` against the test job. No commits.
- Task: T-0014 manual check - PASS (L-0027's run was not exercised, I-0052).
- Result: `github=ok`, GitHub sub-score available 26.23/100 for `Arya-A-Nair` (35 owned repos, 10 languages, claims 3 evidenced / 2 not_found / 18 not_checkable), weights GitHub 0.4667 / parsing 0.5333, composite 36.74, same request id in the service log. Rate limit 4975/5000 (22 calls, as budgeted). Swept (0 remaining), services stopped, ports free.
- Files changed: tasks/T-0014 (Result), WORKLOG.md. No code.
- Next: owner commits T-0014; I-0052 still needs a roadmap slot.

## L-0029 · 2026-10-15 · T-0016 specs for the next six roadmap items (docs only)
- Prompt: re-stamp ARCHITECTURE at HEAD; specs for P2-1, P1-8, P2-3, P2-2, P2-4 with an execution order; P2-3 depends on P1-8; 0 warnings. Owner answers: I-0052 → new P1-10, first (spec too); backfill pending; FE tests in `frontend/src/__tests__/` + checker rule.
- Task: T-0016 (8/8 criteria PASS; criterion 5 content is the owner's judgement).
- Done: ARCHITECTURE verified at `af8947d` (49 cites re-read, all OK; 2 missing cites added); ROADMAP P1-10 row, Execution order line, P2-3 deps, rows/§1.2/backlog/Q4/graph aligned, Task cells; draft specs T-0017 (P1-10), T-0018 (P2-1), T-0019 (P1-8), T-0020 (P2-3), T-0021 (P2-2), T-0022 (P2-4).
- Key choices: NLP timeout 5 s (p95 1.16 s × 1.35 × 3); NLP 500 = `nlp_error`, not unavailable; P2-3 periodic re-score job + SKIP LOCKED lease + fenced write, trigger-created pending row, `/api/analyze` removed; P2-4 corrects M3's "core down → 502" draft.
- Verification: red `tests/.out/t0016-red.log` (8 problems); green `t0016-docs.log`: 91 rows, 230 cites, 36 items, 0 warnings; run-suite docs 0; per-spec count 65/65 criteria with "Checked by".
- Files changed: ARCHITECTURE.md, ROADMAP.md, ISSUES.md, WORKLOG.md (mod); tasks/T-0016..T-0022 (new). No code.
- Issues logged: I-0053 (per-job list drops candidates → P2-3), I-0054 (Jobs count hardcoded 0 → P2-5); I-0052 mapped to P1-10.
- Next: owner reviews and approves T-0017 first (execution order); commits (suggested: ARCHITECTURE stamp, then ROADMAP/ISSUES/specs/WORKLOG).

> L-0030..L-0037 were written on `main` (2026-10-14/15) as L-0023..L-0030 and renumbered at the T-0023 merge, because `Anthony_V3` had already used L-0023..L-0029. Entry text is unchanged, so their T-0016..T-0019 mean the assessment specs now at T-0024..T-0027 (mapping in L-0038).

## L-0030 · 2026-10-14 · T-0016 assessment generate-only (partial, key-independent work)
- Prompt: plan then build assessment wiring, generate-only scope approved.
- Task: T-0016 (spec written + approved; Result partial: criteria 1, 3 PASS; 2, 4, 5, 6 PENDING).
- Done: `backend/Controllers/assessment.controller.js` + `Routes/assessment.routes.js`
  (new, `POST /api/assessment/generate`, CANDIDATE-only, answer_key stripped);
  `backend/index.js` registers `/api/assessment`; `Assessment.jsx` rewritten
  (job picker → real questions, zero mocks) + `/candidate/assessment` route;
  `tests/backend/assessment-generate.smoke.mjs` (new); service venv + boot verified.
- Verification: backend suite 8/8 (7 existing + 1 new, fresh server :5100);
  service `GET /` healthy; keyless generate → clean 502 JSON (designed path).
  Stale dev server on :5000 left untouched; test servers stopped after runs.
- Files changed: backend/ (2 new, index.js mod), frontend Assessment.jsx + App.jsx
  (mod), tests/backend/assessment-generate.smoke.mjs (new), tasks/T-0016, WORKLOG.md.
  Uncommitted per protocol. assessment-service/.venv/ is gitignored.
- Issues logged: none new.
- Next: owner supplies OPENROUTER_API_KEY → live criteria 2, 4, 5, 6; then commit.

## L-0031 · 2026-10-14 · Session rollup: pull, password reset, T-0016 build
- Prompt: pull teammates' changes into aditya-ui-work; one-off authorized password
  reset; history + assessment reviews; plan + build T-0016 (generate-only, approved).
- Pull: `origin/main` had all but 2 Anthony_V3 commits; stashed tree (`stash@{0}`
  kept); merged main (`323c3cc`, 2 conflicts resolved with main) + Anthony_V3
  (`4dc0097`); stash restored (backend kept both sides, Dashboard kept main's,
  old variant stays in stash); reset to dirty tree. 8 ahead / 0 behind main.
- Password: verified user `17856516…` then set `pass123` via Auth Admin API;
  read-only resumed, no keys printed.
- T-0016: new assessment controller + routes + `index.js` wiring; `Assessment.jsx`
  rewritten (no mocks) + `/candidate/assessment` route; new smoke test; Supabase
  skills + MCP config added (owner runs `opencode mcp auth supabase`).
- Verification: backend 8/8 on fresh :5100 (stale :5000 server untouched);
  service healthy, keyless call → clean 502 JSON; `node --check` clean.
  Live criteria 2, 4, 5, 6 pending owner's key. All uncommitted; `.venv` gitignored.
- Next: key → live checks → commit; decide `stash@{0}`; review
  `frontend/package-lock.json` (modified before this session).

## L-0032 · 2026-10-14 · T-0016 live verification (key supplied, all green)
- Prompt: verify criteria 2, 4, 6 live after owner added the key.
- Key rescue: owner put the real key in tracked `.env.example`; moved it to
  ignored `assessment-service/.env` (copied, values never printed) and restored
  the template via `git checkout` — repo has zero tracked `.env` files again.
- Done: direct live generation → 20 questions (`openrouter/free`, answer key
  server-side); authed backend generate as Myuser → `{questions}` only, NO
  `answer_key`; service-down retry → clean JSON 502. T-0016 Result updated
  (1–4, 6 PASS; 5 manual UI with owner).
- Findings: (a) free-tier generation needs 2–4 min — backend's 120 s abort may
  cut slow calls (watch item for T-0017); (b) first attempt failed only because
  NLP was still cold-booting (HF weights) and the assessment service had died
  unnoticed — rerun with health-gated boots passed; (c) Upload page stores a
  file while analyze/proxy need the parsed `resumes` row — one approved
  `/api/analyze` run as Myuser (score 64.68, fixture f1) bridged it.
- Writes (all explicitly approved): one analyze run (resumes+scores rows as
  Myuser). Everything else read-only; test servers stopped after runs.
- Next: owner does manual UI check (criterion 5) → commit; then T-0017 evaluate.

## L-0033 · 2026-10-14 · Assessment nav item (T-0016 follow-up)
- Prompt: assessment page had no entry point in the UI; add it.
- Done: "Assessment" item (`/candidate/assessment`, ListChecks icon) added to
  the candidate navbar in `CandidateLayout.jsx` (import + navItems entry).
- Verification: code-only change following the existing nav pattern; visual
  check rides on the owner's manual UI pass (T-0016 criterion 5).
- Files changed: frontend/src/components/layouts/CandidateLayout.jsx (mod),
  uncommitted.
- Next: owner UI check → commit.

## L-0034 · 2026-10-14 · Assessment options clickable (practice mode)
- Prompt: MCQ options were dead divs; make them clickable.
- Done: options are now toggle buttons with selected styling; short-answer
  got a draft textarea + word count; nav dots mark answered questions.
  All state is local-only — still zero submission/persistence (T-0016 scope).
- Verification: code follows existing patterns; visual check rides on the
  owner's UI pass. Bottom note reworded to "Practice mode".
- Files changed: frontend/src/pages/candidate/Assessment.jsx (mod), uncommitted.
- Next: owner UI check → commit; then T-0017 evaluate.

## L-0035 · 2026-10-15 · T-0017 evaluate loop complete
- Prompt: finish the evaluate loop (submit → server-side score → persisted → credibility fold-in).
- Done: service POST /evaluate-assessment (MCQ deterministic incl. `_mcq_result` string-index fix; short answers LLM rubric); backend generate/evaluate controllers (nested payload, 409/open-attempt resume); Assessment.jsx submit→score UI; migration 20261015_create_assessments applied; rebuildScoreRecord folds latest attempt.
- Verification: smoke 2/2; assessment-evaluate-live.test.mjs added (skips w/o tests/.env); owner UI-tested submit→score; scores row fd263c50 (job a103c197) composite 51.34 with assessment_results 30 available:true ("3 of 10 correct").
- Files changed: assessment-service/app/*, backend/Controllers/assessment.controller.js + Routes/assessment.routes.js (new), explainability.js, Assessment.jsx, assessments migration, tasks/T-0017, smoke/live tests.
- Next: T-0018 (quiz demanded a resume right after upload).

## L-0036 · 2026-10-15 · T-0018 resume parse fallback (quiz from stored NLP + JD)
- Prompt: quiz "asks to add resume every time" though uploaded; quiz must use the stored NLP parse + JD, never re-upload.
- Done: generateAssessment resolves the resume from Supabase (resolveResumeForAssessment); file-but-no-row (or file newer than row) → download Storage file → NLP /parse (same contract as /analyze) → persist a resumes row → use it; 502/500/400 mapping; stored-result fallback when NLP is down.
- Verification: pre-fix repro (fresh t0001_cand18: upload 200, rows 0, generate → 400 "Upload a resume first" — tests/.out/t0018-prefix.log); post-fix rows 0→1 (preview 300, file_ref set), unchanged file → stays 1, re-upload → 2; smoke 2/2; owner UI run 04:01 parsed resume.pdf → row ba4a2c79.
- Ops: a 401-squatter on :8000 found and cleared (nlp-engine has no auth — 401s are never ours); all four ports killed/restarted (3000/5000/8000/8002).
- Next: T-0019 five-attempt limit.

## L-0037 · 2026-10-15 · T-0019 five attempts + quiz outage fixes + run/test doc
- Prompt: 5 attempts per user per job (latest score counts); then a doc for running/testing everything.
- Done: dropped assessments_candidate_job_completed_idx (migration allow_five_assessment_attempts applied; file added); generate resumes an open attempt, regenerates while <5 completed, else 409 {attempts_used, max_attempts, latest score}; Assessment.jsx Retake button + "up to 5 attempts" copy; backend generate abort 120s→300s; assessment-service .env timeout 60→240, retries 2→3 (untracked); docs/HOW_TO_RUN_AND_TEST.md.
- Root causes (quiz 502s): OpenRouter free slugs rotated (gpt-oss-20b:free → 404 "unavailable for free"); openrouter/free router itself returns 200; 60 s service timeout too short for long generations.
- Verification: node --check clean; smoke 2/2; t0019 flow (2 LLM rounds + 409-limit) relaunched after the timeout fix — result pending, T-0019 Result to be updated.
- Next: flow result → T-0019 Result → AUDIT/CHECKLIST/ISSUES updates.

## L-0038 · 2026-10-31 · T-0023 integrate `main` into `Anthony_V3` (merge resolved, unstaged)
- Prompt: execute approved T-0023 (a)-(j): resolve the 3 conflicts, keep V3 `login()`, rename main's specs, delta-audit main, trackers; owner stages and commits.
- Task: T-0023 (criteria 1-3, 5 PASS; 4 PASS but 1 test needs the DB, I-0070; 6 written, not run).
- Done: one `buildScoreRecord(nlp, { github, assessmentEvaluation })`; `rebuildScoreRecord` keeps the stored GitHub entry, fallback `not_collected_for_score`; V3 `login()` restored; specs moved; 3 new explainability tests; assessment smoke in the offline suite; AUDIT 16 rows, ARCHITECTURE assessment-service, 124+14 cites re-pointed.
- Id mapping (commit messages cannot change; `3f53f80` says "T-0016-T-0019"; main's L-0030..L-0037 and both 20261015 migrations keep the old ids):

  | main's id | now | spec |
  |---|---|---|
  | T-0016 | T-0024 | `tasks/T-0024-assessment-generate-only.md` |
  | T-0017 | T-0025 | `tasks/T-0025-assessment-evaluate-loop.md` |
  | T-0018 | T-0026 | `tasks/T-0026-assessment-resume-parse-fallback.md` |
  | T-0019 | T-0027 | `tasks/T-0027-five-assessment-attempts.md` |
- Verification: `t0023-full-harness.log` nlp 0 (12), docs 0 (18 warnings), github 0 (80), backend 45/46, frontend 1 (5 known + 4 new lint); explainability 9/9; Supabase project host does not resolve (DNS ENOTFOUND).
- Issues logged: I-0055..I-0070 (P0: I-0055, I-0056, I-0066, I-0070); I-0010 updated; I-0005 resolved.
- Next: owner fixes I-0070, `git add` + commit; then I-0055 spec; decide I-0056/I-0066 fixes and I-0065.
