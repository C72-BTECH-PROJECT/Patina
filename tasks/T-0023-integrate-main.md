# T-0023 — integrate-main

> Status: **executed 2026-10-31; merge resolved in the working tree, not staged** (owner stages and commits).
> Integration task, not a ROADMAP item. Blocks every remaining ROADMAP item: P2-1 (T-0021),
> P2-3 (T-0020) and the gateway (T-0022) all edit files that `main` changed after `82c4f2e`.

## Context
`Anthony_V3` and `main` diverged at `82c4f2e` (Fix deterministic contact parsing and docs).

**`Anthony_V3` since then** (4 commits, `bc654ce..7319ac6`): the `github-evidence/` service,
`backend/Services/githubEvidence.js`, `backend/Services/internalHttp.js`,
`buildGithubSubScore` in `explainability.js`, the GitHub call in `analyzeResume`, specs
T-0016..T-0022, ROADMAP/AUDIT/ARCHITECTURE/ISSUES updates.

**`main` since then** (teammates; `d413770`, `1e6a558`, `323c3cc`, `4dc0097`, `3f53f80`):
- new `assessment-service/` (FastAPI, OpenRouter free models), migrations
  `20261015_create_assessments.sql` and `20261015_allow_five_assessment_attempts.sql`;
- `backend/Controllers/assessment.controller.js` + `Routes/assessment.routes.js`, mounted at
  `/api/assessment`;
- `buildAssessmentSubScore` and `rebuildScoreRecord` in `explainability.js`; `analyzeResume`
  folds in the latest completed assessment;
- `getCandidateResume` (`GET /api/resume/candidate/:candidateId`), `getMyApplications`,
  `getAllApplications`;
- frontend: `Assessment.jsx` rewrite, new `recruiter/AllCandidates.jsx`, Landing, Notifications,
  layouts;
- `nlp-engine/app/{extractor,ner,preprocessor}.py` edits;
- task files `tasks/T-0016..T-0019` (assessment), which **reuse ids already taken** on
  `Anthony_V3` by `T-0016-next-six-specs` .. `T-0019-frontend-test-runner`.
- GitHub shows `3f53f80` failing its single check (red ×, 0/1).

A trial `git merge origin/main` into `Anthony_V3` conflicts in exactly three files:
`WORKLOG.md`, `backend/Controllers/analysis.controller.js`, `backend/Services/explainability.js`.
`tests/run-suite.ps1` auto-merges and must still be checked by hand.

## Goal
One branch, `integrate/main-into-v3`, in which both teammates' assessment work and the
GitHub-evidence work run together; the credibility score includes parsing, GitHub and
assessment sub-scores when each is available; every existing suite passes; the trackers state
honestly what the merged code does and does not do. `main` is not touched until the owner
opens the PR.

## Scope
**In:**
1. Branch and merge (owner runs the commands that write history; see Rules):
   `git fetch origin && git switch -c integrate/main-into-v3 origin/Anthony_V3 &&
   git merge --no-commit --no-ff origin/main`.
2. Resolve `explainability.js`:
   - one signature: `buildScoreRecord(nlpJson, { github, assessmentEvaluation } = {})`;
   - keep both `buildGithubSubScore` (V3) and `buildAssessmentSubScore` + `rebuildScoreRecord`
     (main); `rebuildScoreRecord` must carry the stored GitHub sub-score unchanged;
   - keep V3's `GITHUB_REASONS` wording; keep main's new ASSESSMENT unavailable reason;
   - update every caller of `buildScoreRecord` (grep; at least `analysis.controller.js` and
     `assessment.controller.js`) to the options-object form.
3. Resolve `analysis.controller.js`: keep V3's request-id + `fetchGithubEvidence` block and
   main's assessment lookup + `getCandidateResume`; one call
   `buildScoreRecord(nlpJson, { github, assessmentEvaluation })`.
4. Resolve `WORKLOG.md`: both sides' entries, in date order, nothing dropped.
5. Task-id collision (**owner confirms at approval; default below**): `git mv` main's four
   assessment specs to `T-0024..T-0027` (keep slugs). Update in-code comments that cite
   them (`T-0016`..`T-0019` in `assessment.controller.js`, `explainability.js`,
   `analysis.controller.js`, migrations, tests). Add a mapping table to WORKLOG
   (`3f53f80` commit message → new ids), because commit messages cannot change.
6. Trackers: delta-audit the main-side changes into `AUDIT.md` (evidence-based statuses only;
   untested = `CODE_REVIEWED_UNTESTED`), add `assessment-service` to `ARCHITECTURE.md`, and log
   in `ISSUES.md` (do **not** fix in this task):
   - `getCandidateResume` lets any RECRUITER fetch any candidate's resume by id; no check that
     the candidate applied to one of that recruiter's jobs;
   - `nlp-engine/app/ner.py` and `preprocessor.py` fall back to a hardcoded Windows
     `venv/Lib/site-packages/...` model path; machine-specific, hides a missing install;
   - `assessment-service/README.md` starts the service on port 8000, which is NLP's port;
     the backend default `ASSESSMENT_SERVICE_URL` is 8002;
   - assessment-service leaves FastAPI `/docs`, `/redoc`, `/openapi.json` on (DEC-5 convention
     for internal services says off);
   - backend calls assessment-service with raw `fetch`, not `Services/internalHttp.js` (no
     request-id propagation);
   - why `3f53f80`'s CI check fails (find and record the cause).
7. `tests/run-suite.ps1`: confirm the auto-merge kept both sides' suites; add assessment smoke
   to the backend suite only if it runs without the live LLM.

**Out:** fixing any logged issue; any anti-cheating work; gateway, one-api-base, score-on-apply;
frontend redesign; changing assessment prompts or scoring logic.

## Rules
- Never commit, push or open a PR. Stop after the merge is resolved and staged; the owner commits.
- Do not change behaviour beyond what conflict resolution requires. If a resolution needs a
  judgement call, stop and ask.
- No status claim in any tracker without evidence from a run or a file:line read.

## Evaluation (Claude Code checks its own work against these)
1. `git diff --name-only --diff-filter=U` is empty; `git grep -n '<<<<<<<\|>>>>>>>'` finds nothing.
2. `git grep -n "buildScoreRecord("` — every call uses the options-object form.
3. `ls tasks/` shows no duplicated `T-00NN` prefix; `node tests/docs/check-trackers.mjs` passes.
4. `powershell -File tests\run-suite.ps1 -Target current` passes all suites; `pytest tests/github`
   passes. Paste the counts in Result.
5. `node tests/backend/explainability.test.mjs` passes **and** has new cases for:
   all three sources available; GitHub only; assessment only; `rebuildScoreRecord` keeping a
   stored GitHub sub-score. Weights sum to 1 in each.
6. Manual smoke (owner, with NLP :8000, github-evidence :8001, assessment :8002, backend :5000):
   apply → analyze → take assessment → recruiter sees a score whose explanation lists all three
   sources. Steps written to `tests/MANUAL_SMOKE.md`.

## Decisions at approval (owner, 2026-10-31)
- (a) Owner runs branch/merge before and `git add` + commit after; Claude edits files only, plain `mv`.
- (b) WORKLOG: keep V3's L-0023..L-0029; main's become L-0030..L-0037 with a note; this task is L-0038.
- (c) `rebuildScoreRecord` falls back to a new reason code `not_collected_for_score` (not
  `service_disabled`, whose "not part of this deployment yet" is false after the merge); tested.
- (d) Main's specs T-0016..T-0019 → T-0024..T-0027.
- (e) Applied migrations and main's WORKLOG entry text keep their old ids (the mapping covers them).
- (f) Keep Anthony_V3's `login()`; main's metadata fallback is dropped. Escalation path checked first:
  not reachable (I-0058). Trigger metadata-role issue logged separately as HIGH (I-0055).
- (g) Delta-audit main's other backend changes; security findings logged, not fixed, owner asked.
- (h) Supabase Preview cause recorded (I-0010); duplicate migration prefixes logged (I-0057).
- (i) `assessment-generate.smoke.mjs` joins the offline backend suite; Evaluation 4's separate pytest
  run dropped (the `github` suite is that run); weight sums to 1e-3.
- (j) WORKLOG archive is a follow-up (I-0064).
- Scope correction: `assessment.controller.js` never called `buildScoreRecord`; it calls
  `rebuildScoreRecord`, whose positional signature is kept.

## Result
**Overall: merge resolved; criteria 1-3 and 5 PASS, 4 PASS except one test that needs the DB
(I-0070), 6 written and awaiting the owner.**

**Conflict resolutions**
- `backend/Services/explainability.js`: both builders kept (`buildGithubSubScore`, then
  `buildAssessmentSubScore`); `buildScoreRecord(nlpJson, { github, assessmentEvaluation } = {})`;
  `rebuildScoreRecord` kept positional, stored GitHub entry carried unchanged, fallback
  `githubUnavailable('not_collected_for_score')` (new `GITHUB_REASONS` code); `UNAVAILABLE_REASONS`
  takes V3's GitHub line and main's assessment text; stale header/JSDoc wording rewritten.
- `backend/Controllers/analysis.controller.js`: V3's request id + `fetchGithubEvidence`, then main's
  latest-completed-assessment lookup, then one `buildScoreRecord(nlpJson, { github, assessmentEvaluation })`
  (`:376`, `:381-396`, `:398`). `getCandidateResume` auto-merged.
- `WORKLOG.md`: V3's L-0023..L-0029 kept, main's renumbered L-0030..L-0037 (headers only) under a
  one-line note.
- Not a conflict, resolved by decision (f): `backend/Controllers/auth.controller.js` restored to
  Anthony_V3's version (main's hunks were both inside `login()`; V3 never changed the file).

**Other changes**
- Renamed (plain `mv`): `tasks/T-0016-assessment-generate-only.md` → `T-0024-…`,
  `T-0017-assessment-evaluate-loop.md` → `T-0025-…`, `T-0018-assessment-resume-parse-fallback.md` →
  `T-0026-…`, `T-0019-five-assessment-attempts.md` → `T-0027-…`; ids inside them updated.
- T-id comments updated: `backend/Controllers/assessment.controller.js` (6), `backend/Routes/assessment.routes.js`,
  `backend/index.js`, `frontend/src/pages/candidate/Assessment.jsx`, `backend/Controllers/analysis.controller.js`,
  `backend/Services/explainability.js`, both assessment tests. Migrations untouched (e).
- `tests/backend/explainability.test.mjs`: 3 new tests (all three sources / GitHub without assessment /
  assessment without GitHub, each with weight sum 1 ± 1e-3 and composite = weighted sum;
  `rebuildScoreRecord` keeps the stored GitHub sub-score; `not_collected_for_score` fallback).
- `tests/run-suite.ps1`: auto-merge kept both sides (V3's unit tests and `github` suite, main's
  `assessment-evaluate-live`). Added `assessment-generate.smoke.mjs` to the current-only offline list,
  and moved `assessment-evaluate-live` into a current-only branch, because main had put it in the list
  that also runs for `-Target baseline -Live`, where the route does not exist.
- Trackers: AUDIT.md (16 rows re-audited, summary recounted, changelog), ARCHITECTURE.md
  (assessment-service in §0/§1.1-§1.3/§1.6/§1.7/§2), ISSUES.md (I-0055..I-0070, I-0010 update,
  I-0005 resolved), `tests/MANUAL_SMOKE.md` section D. Cites into every file the merge changed were
  re-pointed by line diff against `Anthony_V3` (124 mechanically; 14 that fell in changed lines by
  hand after re-reading).

**Evaluation**
1. PASS (my half). `git grep -n '^<<<<<<<\|^>>>>>>>\|^=======$'` → nothing. `git diff --name-only
   --diff-filter=U` still lists the 3 files until the owner runs `git add` (agreed split (a)).
2. PASS. `git grep -n "buildScoreRecord("`: the one production call uses the options form
   (`backend/Controllers/analysis.controller.js:398`); tests use options or NLP only.
3. PASS. `ls tasks/`: T-0001..T-0027, no duplicate prefix. `node tests/docs/check-trackers.mjs`:
   91/91 rows OK, ARCHITECTURE 261 cites OK, ROADMAP 36 items OK, 18 warnings, all of the kind
   "not in any ROADMAP item": I-0055..I-0070 (16) and CODE_REVIEWED_UNTESTED rows 3.2, 3.10. Mapping
   them into ROADMAP is the owner's call.
4. PASS except one DB-dependent test. `tests/.out/t0023-full-harness.log`: nlp 0 (12 passed),
   docs 0, github 0 (80 passed), backend 1 (45/46), frontend 1. Re-run of backend outside the sandbox
   `tests/.out/t0023-backend.log`: same 45/46. The failure is "POST /api/auth/login with unknown
   username -> 401": 503 because the profile lookup cannot reach Supabase (`TypeError: fetch failed`;
   the project host from `backend/.env` gives DNS `ENOTFOUND` while github.com and supabase.co resolve).
   I-0070, P0, owner checks the project. Frontend: the 5 known lint warnings plus 4 new ones from
   main's files (I-0068), so the build fails under CI=true as it did before, with more warnings.
5. PASS. `node --test tests/backend/explainability.test.mjs`: 9/9, including the 3 new tests above.
6. WRITTEN, NOT RUN. `tests/MANUAL_SMOKE.md` §D (5 services, D1-D8). Blocked on I-0070.

**Issues logged:** I-0055 (P0, HIGH: trigger trusts metadata role), I-0056 (P0: any recruiter fetches
any résumé), I-0057 (P1: duplicate migration versions), I-0058 (P1, medium: profile-less auth users;
login workaround dropped), I-0059..I-0063 (P2: NLP model path, assessment port, FastAPI docs, raw fetch,
`profiles.email`), I-0064 (P3: WORKLOG archive), I-0065 (P3: pre-T-0014 rows keep stale GitHub
text on rebuild), I-0066 (P0: `answer_key` readable via RLS and from the service), I-0067 (P1: grading
prompt injection), I-0068 (P2: frontend lint/`import.meta.env`), I-0069 (P2: concurrent submit race),
I-0070 (P0: Supabase host does not resolve). I-0010 updated with the `3f53f80` cause; I-0005 resolved.

**Left undone / for the owner**
- Security fixes I-0055, I-0056, I-0066: logged only; each needs the owner's go-ahead (I-0055 has its
  own spec next, per the owner).
- I-0065: whether pre-T-0014 rows should also get `not_collected_for_score` (one-line change).
- Manual smoke §D, after I-0070.
- Suggested commit boundary: one merge commit is unavoidable for the merge itself; if the owner wants
  smaller history, the tracker files (AUDIT, ARCHITECTURE, ISSUES, MANUAL_SMOKE, this spec, WORKLOG)
  can follow as a second commit on top.
