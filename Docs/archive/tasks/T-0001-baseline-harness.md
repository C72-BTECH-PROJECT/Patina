# T-0001 — baseline-harness

## Goal
Build a black-box test harness in `tests/` that runs unchanged against a baseline worktree at `32905c1` (alternate ports) and against current code. Record baseline behaviour in `tests/BASELINE_RESULTS.md` as a reference to diff later, not as a correctness oracle.

## Spec ref
`PROJECT_SOURCE_DOCS.md` as of `32905c1`. It was deleted from HEAD; see I-0014.
- FR-1: PDF and DOCX accepted. Fixtures cover both.
- FR-2 / NFR-5: entity extraction at ≥85% accuracy. The baseline is recorded per fixture and isn't scored yet.
- FR-3 / NFR-1: ≤10 s per résumé. Wall-clock time per `/parse` call is recorded in BASELINE_RESULTS but not asserted.
- Guide feedback #2 (OCR), #3 (support-only fairness), #4 (GitHub optional): the fixtures are chosen for these.

**PROJECT_SOURCE_DOCS.md search:**
- It isn't in the working tree, under `..` (depth 3), or in `~/.claude`.
- Added in `fdd22c3` (yours, 2026-09-03). Deleted by `314e494` (Aaron, "feat: NLP engine updates…"). It exists unchanged at `32905c1` (266 lines), so `git show 32905c1:PROJECT_SOURCE_DOCS.md` recovers it.
- It is not restored in this task. It's logged as I-0014. The baseline worktree will contain it, but that copy is only for reading.

## Findings that shape this task (verified this session)
- **Baseline confirmed.** `32905c1` is your last commit before the merges and an ancestor of HEAD. Four commits in `32905c1..HEAD` weren't on your list: `71c632d` (Aaron), `4fc97db`, `04835ca`, `d78b52a` (Aditya). All four are teammate work and correctly sit outside the baseline. You approved `32905c1`.
- **HEAD's NLP code is older than baseline's.** `314e494` reverted the baseline's NLP work: `git diff --stat 32905c1 HEAD -- nlp-engine` shows +126/−498 lines across `ner.py`, `embedder.py` and `main.py`. HEAD drops `required_skills`/`preferred_skills` form fields, `component_weights`, `jd_source` and the structured `experience` entries.
- **HEAD `POST /api/analyze` always returns 500.** `analysis.controller.js:34` uses `path` without importing it, and `job` is undefined at `:137` and `:144`. It also hardcodes `http://localhost:8000/parse` at `:146`.
- **NLP service** makes no Supabase, LLM or GitHub calls and reads no env vars. Its only network access is the HF model fetch, which `HF_HUB_OFFLINE=1` disables. It has no OCR, so image-only PDFs come back with empty text. `list(set(...))[0]` in `ner.py` makes `email`, `phone`, `github` and `linkedin` depend on hash order, so the server runs with `PYTHONHASHSEED=0`.
- **Backend** uses a session cookie (`patina_session`), not Bearer tokens. MongoDB isn't needed. `Config/supabase.js` loads `.env` with `override:true`, so `PORT` and `NLP_PARSE_URL` must be set **inside** the worktree's copied `.env`, not in the shell. Baseline's dependencies are HEAD's minus `mongoose`.
- **Frontend** is CRA (`react-scripts 5.0.1`), with identical `package.json` at both revisions. HEAD reads `import.meta.env.VITE_API_BASE_URL` under CRA, and five pages hardcode `localhost:5000`.
- **"Failing check" (step 3c):** there is **no `.github/workflows` and there never was** (`git log --all -- .github` is empty, `gh run list` is empty). The red check is **Supabase Preview**, the Supabase GitHub integration on project `zzgymrxrwuuffyrbhify`. On `main` commits (`cc0e637`, and already at `32905c1`) it applies `supabase/migrations/` to the production project. It fails with `ERROR: type "patina_user_role" already exists (SQLSTATE 42710)` because `20260823_create_profiles.sql:6` runs an unguarded `create type`, and the schema was originally applied by hand in the SQL editor. Non-main branches like `Anthony_V2` show "skipped". **Caveat:** if those migrations ever start succeeding, merging to `main` will auto-apply schema changes to the shared DB.

## Scope
**In:**
- `git worktree add ../patina-baseline 32905c1` (detached). Copy `backend/.env` and `frontend/.env` into it. In the **worktree copy only**, set `PORT=5100`, `NLP_PARSE_URL=http://localhost:8100/parse` and `FRONTEND_URL=http://localhost:3100`.
- Reuse dependencies:
  - Junction `node_modules` into the worktree for `backend` and `frontend` after confirming the lockfile diff is only `mongoose` / none. Fall back to `npm ci` inside the worktree.
  - Use `nlp-engine/venv`'s Python (canonical per README:126).
  - Install `pytest` and `fpdf2` into that venv, listed in `tests/requirements.txt`.
- Ports: baseline runs NLP on 8100, backend on 5100, frontend on 3100. Current runs on 8000 / 5000 / 3000 (forced: HEAD hardcodes 8000 and 5000).
- New files:
  - `tests/README.md` (how to run)
  - `tests/run-suite.ps1 -Target baseline|current`: starts NLP and backend from the right tree and ports, waits for health, runs the suites, stops the processes, writes logs to `tests/.out/`
  - `tests/.env.example`
  - `tests/fixtures/`: `make_fixtures.py`, `manifest.json`, `jds/dev.txt`, `jds/support.txt`, and six synthetic résumés (fictional names, `example.com` emails, `github.com/example-*` links):
    1. `f1_dev_github.pdf`: single-column developer with GitHub and LinkedIn
    2. `f2_dev_github.docx`: DOCX developer with GitHub
    3. `f3_support_nogithub.pdf`: support/maintenance only, no GitHub (feedback #3 and #4)
    4. `f4_support_nogithub.docx`: support/maintenance only, DOCX, no GitHub
    5. `f5_multicolumn.pdf`: two-column layout (sidebar skills/contact)
    6. `f6_image_only.pdf`: text rendered as an image, to show the OCR gap (feedback #2)
  - `tests/nlp/conftest.py` and `tests/nlp/test_parse.py` (pytest)
  - `tests/nlp/snapshots/baseline/*.json`
  - `tests/backend/smoke.test.mjs`, `tests/backend/live-analyze.test.mjs`, `tests/backend/lib/testdb.mjs`, `tests/backend/sweep.mjs` (node:test, zero new npm deps)
  - `tests/MANUAL_SMOKE.md`, `tests/BASELINE_RESULTS.md`
- `.gitignore` additions: `tests/private/`, `tests/.out/`, `!tests/fixtures/*.pdf`, `!tests/fixtures/*.docx`.
- ISSUES.md entries (log only, no fixes):
  - I-0009 (P0 for demo): HEAD analyze 500, from the missing `path` import and undefined `job`.
  - I-0010 (**P1**): Supabase Preview migration failure, written as a **decision you need to make**:
    - (a) turn off auto-apply / production deploys in the Supabase GitHub integration, or
    - (b) make every migration idempotent first (`if not exists`, `do $$ … exception when duplicate_object`), knowing that each merge to `main` will then apply schema changes to the production DB automatically.

    No recommendation is acted on in this task.
  - I-0011 (P1): `314e494` reverted the baseline NLP engine.
  - I-0012 (P1): HEAD frontend uses `import.meta.env` under CRA, plus hardcoded `localhost:5000`.
  - I-0013 (P1): the `resumes` **table** has no migration either. Same pattern as I-0001 and I-0007.
  - I-0014 (P2): `PROJECT_SOURCE_DOCS.md` was deleted by `314e494`. It can be recovered from `32905c1` and is referenced by CLAUDE.md, CODE_MAP.md, REVIEW_BRIEF.md and tasks/TEMPLATE.md.
  - I-0015 (P1): `ner.py` picks `email`, `phone`, `github` and `linkedin` with `list(set(...))[0]` (HEAD `:247-261`, baseline `:548-562`). Contact fields therefore depend on per-process hash order. The tests pin `PYTHONHASHSEED=0`, which hides this; production is still nondeterministic.
- One WORKLOG entry: L-0002.

**Out:**
- Any change under `backend/`, `frontend/`, `nlp-engine/` or `supabase/`.
- Fixing I-0001, I-0007 or the new issues.
- Creating a CI workflow.
- Running the suites against current code (next task: run the suite with `-Target current` and diff against the baseline snapshots).
- Committing, staging or creating branches.

## Suite design and data-safety choice per suite

**a. NLP (pytest): no Supabase at all.**
- `NLP_BASE_URL` (default `http://localhost:8000`) and `SNAPSHOT_LABEL` (required) come from env.
- `GET /` returns 200.
- Each manifest entry is POSTed to `/parse` as multipart `resume` + `jd` + `required_skills` + `preferred_skills`. That matches the baseline backend's request; HEAD ignores the last two.
- Assertions:
  - HTTP status
  - `status` key
  - the common key contract: `filename`, `raw_text_preview`, `preprocessing{…}`, `entities{candidate_name,email,phone,github,linkedin,skills,skill_count,experience,education,projects}`, `semantic_analysis{similarity_score,…,matched_skills,missing_skills,match_reason}`
- The full JSON is written to `tests/nlp/snapshots/<label>/<fixture>.json`, pretty-printed with sorted keys.
- Files in `tests/private/*.pdf|docx`, if present, run with `jds/dev.txt` and their snapshots go to `tests/private/snapshots/<label>/`. Those are git-ignored because the snapshots contain personal data.

**b. Backend (node:test, global `fetch`/`FormData`): `BACKEND_BASE_URL`.**
- *Tier 1, no writes:*
  - `GET /api/health` returns 200 `{status:"ok"}`
  - unknown path returns 404
  - `POST /api/auth/login {}` returns 400
  - `POST /api/auth/signup {}` returns 400
  - login as `t0001_nonexistent` returns 401 (a single read of `profiles`, no writes)
  - `POST /api/analyze` with no cookie returns 401
  - `GET /api/jobs` with no cookie returns 401
- *Tier 2, live: dedicated test accounts + temporary job.*
  - The test self-skips if `tests/.env` is missing credentials. Process: I pause before tier 2 and ask you to create the accounts. SKIPPED goes into the results only if you say so.
  - The service-role key and URL are read from `backend/.env` and never copied or logged. The client comes from `backend/node_modules/@supabase/supabase-js` via `createRequire`.
  - **You fill in `tests/.env`** (verified ignored: `git check-ignore -v tests/.env` → `.gitignore:11:**/.env`):
    - `TEST_CANDIDATE_USERNAME=t0001_cand`
    - `TEST_CANDIDATE_PASSWORD=…`
    - `TEST_RECRUITER_USERNAME=t0001_recr`
  - You create both accounts once via `/signup`. Plus-addressing works for the emails, e.g. `anthonyjennisnadar+t0001cand@gmail.com`. Usernames must match `^[A-Za-z0-9_]{3,30}$` (`auth.controller.js:6`).
  - Why a recruiter account owns the job: `jobs.recruiter_id` is an FK to `profiles(id)` (`20260830_…sql:14`), and the RLS policy "Recruiters can manage their own jobs" requires `profiles.role = 'recruiter'` (`:62-78`). Service role bypasses RLS, but the schema clearly intends recruiter ownership, so a candidate-owned job isn't acceptable.
  - **Guards (abort, delete nothing)** if any of these fail:
    - either username doesn't start with `t0001_`
    - either profile isn't found
    - the roles aren't `candidate` / `recruiter`
    - any delete would remove more than 50 rows or objects
  - *Setup:*
    1. sweep
    2. insert job `{recruiter_id: R, title: '[T-0001 TEST] harness job', description: <≥20 chars>, required_skills: ['python','sql'], preferred_skills: [], status: 'published'}`
    3. log in as the candidate and keep the cookie
  - *Test:* `POST /api/analyze` with multipart `resume=f1_dev_github.pdf` and `jobId`. Expect 200 and the keys `id, resumeId, candidateId, jobId, credibilityScore, subScores, weights, explanation, extractedSkills`.
  - *Teardown:* sweep, then assert all counts below are 0.
  - **Exact sweep (`tests/backend/lib/testdb.mjs`).** `C` and `R` are looked up with `profiles.select('id,role').eq('username', …)`. Nothing broader is deleted.
    ```js
    await sb.from('scores').delete().eq('candidate_id', C);
    await sb.from('resumes').delete().eq('candidate_id', C);
    await sb.from('applications').delete().eq('candidate_id', C);
    // storage: baseline path `${C}/<uuid><ext>`, HEAD path `candidates/${C}/resume<ext>`
    for (const prefix of [C, `candidates/${C}`]) {
      const { data } = await sb.storage.from('resumes').list(prefix, { limit: 100 });
      const paths = (data ?? []).filter(o => o.id).map(o => `${prefix}/${o.name}`);
      if (paths.length) await sb.storage.from('resumes').remove(paths);
    }
    await sb.from('jobs').delete().eq('recruiter_id', R).like('title', '[T-0001 TEST]%');
    ```
    - In SQL terms these are `delete from scores where candidate_id = C`, the same for `resumes` and `applications`, and `delete from jobs where recruiter_id = R and title like '[T-0001 TEST]%'`. Job deletion is AND, stricter than "user ID **or** tag".
    - Before each delete, a `count` select with the same filter enforces the 50-row guard.
  - `node tests/backend/sweep.mjs` runs the same sweep on its own, for after a manual smoke run.

**c. Frontend: no data.**
- Runs `CI=true npm run build` in `<tree>/frontend`.
- Records the exit code plus every warning and error line. CRA with `CI=true` treats ESLint warnings as errors.
- This is a local reproduction, since no workflow exists. Step 3c above explains the real red check.

**d. `tests/MANUAL_SMOKE.md`: writes real rows, so it uses the test accounts and finishes with `sweep.mjs`.**
- Numbered steps for both targets:
  - baseline: frontend `PORT=3100`, `REACT_APP_API_BASE_URL=http://localhost:5100` (shell env beats `.env` in CRA)
  - current: 3000 / 5000
- Flow: start services → log in as `t0001_cand` → `/candidate/upload` → pick fixture + job → processing → result page (`/candidate/results` at baseline; HEAD goes to `/candidate/dashboard`) → log out → log in as `t0001_recr` → `/recruiter/dashboard` and `/recruiter/jobs/:id` → check the candidate appears → run the sweep.
- Expected result at each step for each target.
- Warning: localhost cookies ignore the port, so use a separate browser profile or incognito window per target.

## Acceptance criteria
1. Baseline SHA confirmed. Checked by: the git output recorded in Findings (done this session).
2. Worktree exists at `32905c1`, clean. Checked by:
   - `git -C ../patina-baseline rev-parse HEAD` is `32905c19f28af8c1cd9ce4522b6870c39fa33dbb`
   - `git -C ../patina-baseline status --porcelain` is empty
   - `git -C ../patina-baseline check-ignore backend/.env frontend/.env` lists both
3. No app code changed, nothing staged. Checked by:
   - `git status --porcelain -- backend frontend nlp-engine supabase` is empty
   - `git diff --cached --name-only` is empty
4. Fixtures are synthetic and committable; private files are ignored. Checked by:
   - `python tests/fixtures/make_fixtures.py` regenerates all 6
   - `git check-ignore tests/fixtures/f1_dev_github.pdf` exits 1 (not ignored)
   - `git check-ignore tests/private/5.jpg tests/private/snapshots/x.json tests/.env` lists all three
5. The NLP suite runs against baseline. Checked by:
   - `tests/run-suite.ps1 -Target baseline` runs pytest with `NLP_BASE_URL=http://localhost:8100 SNAPSHOT_LABEL=baseline`
   - pytest summary recorded
   - 6 files in `tests/nlp/snapshots/baseline/`
   - any shape failure recorded as FAIL with its message, not hidden
6. Baseline NLP output is deterministic. Checked by: a second run gives identical SHA-256 for every snapshot (hash table recorded in BASELINE_RESULTS). Differences, if any, are listed as non-determinism findings.
7. Backend tier 1 against `:5100`: the 7 tests pass. Checked by: `node --test tests/backend/smoke.test.mjs` summary recorded.
8. Backend tier 2 against `:5100` passes **and leaves nothing behind**. Checked by:
   - the node:test summary
   - the post-teardown counts printed by `sweep.mjs --check`: 0 scores, 0 resumes and 0 applications for C; 0 objects under both storage prefixes; 0 tagged jobs for R
   - **Before running tier 2 I stop and tell you**, so you can create `t0001_cand` and `t0001_recr` and fill in `tests/.env`. It is recorded as SKIPPED only if you say so.
9. Frontend baseline build result recorded. Checked by: the exit code of `CI=true npm run build` in `../patina-baseline/frontend`, plus every warning/error line, in BASELINE_RESULTS.
10. The red check is explained with evidence. Checked by: the BASELINE_RESULTS "CI" section quotes the `gh api …/check-runs` output for `32905c1` and `cc0e637`.
11. `tests/MANUAL_SMOKE.md` exists with the steps above for both targets. Checked by: **you**, by following it once against baseline.
12. `tests/BASELINE_RESULTS.md` has:
    - environment (SHA, Node, Python, package versions)
    - per-suite results
    - a per-fixture table of known-wrong outputs: e.g. `f6` empty text with no OCR, `f5` column interleaving, `f3`/`f4` support-candidate scoring, wrong name/skill extraction seen in snapshots

    Checked by: reading the file. Each "known-wrong" claim cites the snapshot field.
13. ISSUES.md has I-0009 through I-0015 with evidence, and I-0010 is P1 with the decision options. WORKLOG has L-0002. Checked by: reading both files.

## Test plan
- This task builds tests instead of changing behaviour, so "fail before, pass after" doesn't apply. Each suite is shown to work by running it against baseline (criteria 5–9).
- Can't be automated: criterion 11, the browser flow, because it needs visual judgment and an email-confirmed login. The tier-2 precondition (creating the two accounts) needs your email confirmation.

## Regression
None existing; there are no tests in the repo. This suite becomes the regression harness.

## Risks and rollback
- **Live DB writes in tier 2 and the manual smoke.** Mitigations: the username-prefix and role guards, the 50-row cap, filters scoped to C, R and the tag, and a sweep both before and after. Residual risk: during the test a real candidate browsing jobs could briefly see the "[T-0001 TEST]" published job.
- **Junctioned `node_modules`.** CRA/webpack symlink resolution could break the baseline build. Fallback: `npm ci` inside the worktree, which leaves the main tree untouched.
- **pytest/fpdf2 installed into `nlp-engine/venv`.** Additive only.
- Rollback:
  - `git worktree remove ../patina-baseline`
  - delete `tests/`
  - revert the 4 `.gitignore` lines and the ISSUES/WORKLOG additions
  - `pip uninstall pytest fpdf2`

---

## Result
_2026-10-12. All 13 criteria are PASS; none are FAIL. Criterion 9 is a PASS for "result recorded"; the build itself fails, which is the recorded result. Criterion 11 passed with limited coverage: A3–A4 not exercised, A6 inconclusive (job not seeded)._

1. PASS. `git log --oneline --graph 32905c1..HEAD` plus authors recorded in Findings. The owner approved 32905c1.
2. PASS (re-checked after tier 2):
   - `git -C ../patina-baseline rev-parse HEAD` → `32905c19f28af8c1cd9ce4522b6870c39fa33dbb`
   - `status --porcelain` → 0 lines
   - `check-ignore` lists `backend/.env` and `frontend/.env`
3. PASS (re-checked after tier 2):
   - `git status --porcelain -- backend frontend nlp-engine supabase` → 0 lines
   - `git diff --cached --name-only` → 0 lines

   Unrelated: `.obsidian/workspace.json` and `Docs/Architecture.md` (line endings only) were modified at 03:14 by Obsidian, not by this task.
4. PASS:
   - `make_fixtures.py` regenerates all 6 files byte-identically (sha256 diff empty)
   - `git check-ignore tests/fixtures/f1_dev_github.pdf tests/fixtures/f2_dev_github.docx` exits 1
   - `tests/private/5.jpg`, `tests/private/snapshots/x.json` and `tests/.env` are all ignored
5. PASS:
   - `run-suite.ps1 -Target baseline -Suites nlp` → `10 passed in 5.72s` (6 synthetic + 3 private)
   - 6 snapshots in `tests/nlp/snapshots/baseline/`
   - all contain `jd_source`, which proves the 32905c1 code was the one tested
6. PASS. The second run (server restarted) gave identical SHA-256 for all 9 snapshots. This depends on `PYTHONHASHSEED=0` (I-0015).
7. PASS. `tests 7 / pass 7 / fail 0` against `:5100`. The backend log shows `Server running on http://localhost:5100`. All 7 passed again in the tier-2 run.
8. **PASS.**
   - Accounts:
     - Browser signup on :3000 failed for the owner (I-0016), so `t0001_cand` and `t0001_recr` were created via `POST :5100/api/auth/signup`. Both returned HTTP 201.
     - Pre-check: no `t0001_*` profiles and neither email in `auth.users`.
     - Passwords exist only in `tests/.env`, which is git-ignored and untracked.
     - The owner confirmed both emails. `auth.admin.getUserById` shows `confirmed: true` for both.
   - `run-suite.ps1 -Target baseline -Suites backend -Live` → `tests 8 / pass 8 / fail 0 / skipped 0`, including `✔ POST /api/analyze forwards to NLP and returns the scored candidate (3373ms)`.
   - Pre-run sweep removed all 0.
   - Teardown sweep removed `scores 1, resumes 1, applications 0, jobs 1, storage <C>/ 1, storage candidates/<C>/ 0`, exactly one analyze run plus the tagged job.
   - Remaining after teardown: all 0.
   - Independent `node tests/backend/sweep.mjs --check` → `scores 0, resumes 0, applications 0, jobs 0, storage:<C>/ 0, storage:candidates/<C>/ 0`, exit 0.
   - Backend stderr has only a `form-data` deprecation warning.
9. PASS (result recorded): `CI=true npm run build` exit 1, with the 6 `no-unused-vars` errors listed in BASELINE_RESULTS. The non-CI build succeeds.
10. PASS. BASELINE_RESULTS "Why commits show a failing check" quotes check-runs for 32905c1, cc0e637 and 92db9f0.
11. **PASS, with limited coverage.** MANUAL_SMOKE.md exists for both targets, and the owner followed section A once against baseline (3100/5100/8100). Observations are in MANUAL_SMOKE.md §A:
    - **A1 PASS.** `t0001_cand` signed in and was redirected as expected.
    - **A2: predicted failure observed, cause only partly confirmed.**
      - "Select Job" showed "Failed to fetch" and Analyze Resume stayed disabled.
      - DevTools: `GET http://localhost:5000/api/jobs` → `net::ERR_CONNECTION_REFUSED`. This confirms the hardcoded `:5000` in `Upload.jsx:121`.
      - **Limitation:** this was observed only because the backend ran on **:5100** and nothing listened on :5000. It does **not** show that the upload page was broken in its original single-stack setup (backend on :5000).
      - The second predicted cause, the missing `credentials:'include'` against a session-protected `GET /api/jobs`, was **not tested**.
    - **A3–A4 not run** (skipped per A2's instruction). The browser analyze → results path was not exercised at baseline. The backend analyze route is covered by criterion 8.
    - **A5 PASS.** `t0001_recr` signed in and `/recruiter/dashboard` loaded. It was empty, as expected with no analysis.
    - **A6 INCONCLUSIVE (procedure miss, not a code finding).**
      - `/recruiter/jobs` was empty.
      - `node tests/backend/sweep.mjs --check` afterwards shows `jobs: 0` for `t0001_recr`, so the `--seed-job` precondition wasn't run and there was no job to list.
    - **A7 not run by the owner.** `sweep.mjs --check` (read-only, run by Claude) → all 0, exit 0, so nothing was left to clean.

    No new ISSUES entry. The A2 behaviour is baseline-only: `Upload.jsx` was rewritten at HEAD. HEAD's remaining hardcoded `:5000` calls are already in I-0012. Section B (current) was not part of this criterion.
12. PASS. BASELINE_RESULTS has environment, per-suite results including tier 2, and a per-fixture known-wrong table, with each claim citing a snapshot field.
13. PASS. ISSUES I-0009 to I-0015 added (I-0010 is P1 with decision options (a)/(b)), plus I-0016 (signup one-word name) and I-0017 (duplicate profile insert) found during account creation. WORKLOG has L-0002 and L-0003.

## Commit boundary suggestion (you commit, not me)
1. `.gitignore` + `tests/fixtures/` + generator
2. `tests/nlp/` + baseline snapshots
3. `tests/backend/`
4. `tests/*.md`, ISSUES, WORKLOG, `tasks/T-0001`
