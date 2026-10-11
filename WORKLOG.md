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
