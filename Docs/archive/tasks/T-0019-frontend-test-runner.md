# T-0019 — frontend-test-runner

> Status: **draft, awaiting owner approval** (written in T-0016, 2026-10-15).
> ROADMAP item P1-8. No dependencies. Third in the execution order. Owner's standing rule: it
> lands before any task that changes frontend pages (P2-3 is the first).
> Owner decision (2026-10-15): the tests live in `frontend/src/__tests__/`, and the docs checker
> accepts that path as test evidence.

## Context
The frontend has no tests:
- no `*.test.js(x)` under `frontend/src`, and no `src/setupTests.js`;
- `run-suite.ps1`'s `frontend` suite only runs `CI=true npm run build` (`tests/run-suite.ps1:152-160`);
- that build exits 1 today on the 5 known lint warnings (CreateJob/Jobs);
- `frontend/package.json` has a `test` script (`react-scripts test`), and `@testing-library/react`
  16, `jest-dom` 6 and `user-event` 13 are already installed (as dependencies).

Three AUDIT rows are `CODE_REVIEWED_UNTESTED` only for lack of a frontend runner:
- 5.6 recruiter filters;
- 5.10 evidence-limited display;
- 5.11 per-skill badges.

Their "Promote with" notes name the tests to write.

P2-3, P2-2 and P2-5 change these pages next. This task pins today's behaviour first, so those
changes are made under tests.

CRA 5's Jest only looks under `src/` and does not support overriding `roots`, so the tests cannot
live in `tests/frontend/`. AUDIT's DONE rule needs an existing `tests/…` path in the evidence
(`tests/docs/check-trackers.mjs:126-127`), and its "Promote with" rule needs a `tests/…` path
(`:120`). The owner chose to teach the checker the frontend path instead of citing
`run-suite.ps1` as a proxy.

## Goal
`tests/run-suite.ps1` runs the CRA test runner in CI mode as its own suite, and three
characterisation tests pin today's recruiter filters, evidence-limited display and per-skill
badges, promoting AUDIT 5.6, 5.10 and 5.11.

## Spec ref
- GF-4 (5.10), GF-5 / Objective 4 (5.11), Use Case (5.6); CHECKLIST 5.6, 5.10, 5.11.
- ROADMAP P1-8 and "Test backlog".

## Scope
**In:**
- **`tests/run-suite.ps1`:** a new suite, `frontend-test`, in the ValidateSet and the default
  list:
  - it runs `CI=true`, then `npx react-scripts test --watchAll=false --ci` in `frontend/`,
    logged to `tests/.out/$Target-frontend-test.log`, with the result under its own key;
  - it is separate from the `frontend` build suite, whose known lint failure would otherwise mask
    test failures;
  - it is skipped (result 0, "skipped") for `-Target baseline`, which has no tests;
  - the summary column is widened.
- **`frontend/src/setupTests.js`:** imports `@testing-library/jest-dom`. It polyfills
  `TextEncoder`/`TextDecoder` from `util` only if react-router v7 needs them under Jest 27's
  jsdom.
- **`frontend/src/__tests__/fixtures/analyses.js`:** three analyses in the exact shape of
  `serializeCandidate` (`backend/Controllers/analysis.controller.js:80-130`), plus a fourth for
  another job.
- **`frontend/src/__tests__/jobdetails-filters.test.jsx`** (5.6):
  - it renders `pages/recruiter/JobDetails.jsx` in a `MemoryRouter` at `/recruiter/jobs/:id`;
  - `useAuth` is mocked (`jest.mock('../context/AuthContext')`), so `authFetch` is a mock;
  - `global.fetch` is mocked for `/api/jobs/mine` and `/api/candidates`, matched by path suffix
    so a later base-URL change (P2-2) does not break it.
- **`frontend/src/__tests__/evidence-limited.test.jsx`** (5.10): `ScoreBreakdown` alone, and
  the evidence filter in JobDetails and in the recruiter Dashboard.
- **`frontend/src/__tests__/skill-evidence.test.jsx`** (5.11): `ScoreBreakdown` alone.
- Interactions use `fireEvent`, since user-event 13 is old and is not upgraded here.
- **`tests/docs/check-trackers.mjs`:**
  - the DONE rule accepts an existing `frontend/src/__tests__/…` path as the test reference;
  - the CODE_REVIEWED_UNTESTED "Promote with:" rule accepts `frontend/src/__tests__/…` as well as
    `tests/…`.
- **AUDIT.md:** "How to read" line 12 (the test-reference rule) and rows 5.6, 5.10, 5.11.
- **ROADMAP:** the test backlog paths are already set in T-0016.
- `tests/README.md` (suite table and command), ISSUES, WORKLOG.

**Out:**
- Changing any page or component. These are characterisation tests: they pin today's
  behaviour, bugs included (e.g. I-0053's per-candidate dedupe happens in the backend; the test
  pins the page's client-side `jobId` filter).
- Fixing the 5 lint warnings, or upgrading react-scripts or user-event.
- Tests for candidate pages (P2-3 writes its own).

## Files touched
- `frontend/src/setupTests.js` (new)
- `frontend/src/__tests__/{jobdetails-filters,evidence-limited,skill-evidence}.test.jsx` (new), `frontend/src/__tests__/fixtures/analyses.js` (new)
- `frontend/package.json`, only if a CRA-supported Jest key (`transformIgnorePatterns` or `moduleNameMapper`) is needed for an ESM dependency
- `tests/run-suite.ps1`, `tests/README.md`, `tests/docs/check-trackers.mjs`
- `AUDIT.md`, `ISSUES.md`, `WORKLOG.md`

## Moves
| Id | From → to | Promoting test |
|---|---|---|
| 5.6 Filtering | CRU → **DONE** | `frontend/src/__tests__/jobdetails-filters.test.jsx` |
| 5.10 Evidence-limited shown fairly | CRU → **DONE** | `frontend/src/__tests__/evidence-limited.test.jsx` |
| 5.11 Per-skill confidence | CRU → **DONE** | `frontend/src/__tests__/skill-evidence.test.jsx` |

## Acceptance criteria
1. **The runner is a suite.** `tests/run-suite.ps1 -Target current -Suites frontend-test`:
   - runs the three test files in CI mode and returns without entering watch mode;
   - prints `frontend-test 0` in the summary;
   - a failing test makes it print a non-zero value and exit 1.

   Checked by: the green and red logs.
2. **Baseline is skipped.** `-Target baseline -Suites frontend-test` → result 0 with a "skipped"
   line. Checked by: command output.
3. **5.6 filters.** In "jobdetails-filters.test.jsx", with the 4 fixture analyses (3 for job
   `J1`, 1 for job `J2`), checked by:
   - "lists only this job's analyses": 3 rows and the heading "3 of 3 candidates";
   - "min score hides rows below the threshold": setting `#min-score` to 60 leaves the rows
     scoring 60 or more, and the heading updates;
   - "skill filter keeps rows whose skill is matched": choosing a required skill in
     `#skill-filter` keeps only rows where that `skillEvidence` row is `matched`, not
     `claimed_only` or `missing`;
   - "evidence filter splits on evidenceLimited": `limited` and `complete` partition the rows.
4. **5.10 evidence-limited display.** In "evidence-limited.test.jsx", checked by:
   - "ScoreBreakdown shows the evidence-limited notice": the "Evidence-limited … redistributed,
     not counted as zero" text appears when `evidenceLimited: true`, and is absent for `false`;
   - an unavailable factor shows its `reason` and "—", not 0 points as a score;
   - "evidence filters place limited rows": a limited row appears under `limited` and not
     `complete`, in both JobDetails and the recruiter Dashboard.
5. **5.11 per-skill badges.** In "skill-evidence.test.jsx", checked by:
   - "one badge per skillEvidence row": three rows with statuses `matched`, `missing` and
     `claimed_only` render exactly the labels Evidenced, Not found and Claimed only, each next to
     its skill, with its "N of M source(s)" text;
   - "unknown status falls back to Claimed only".
6. **Checker accepts the frontend path.** Checked by: the checker run, red then green:
   - a DONE row whose only test reference is a missing `frontend/src/__tests__/nope.test.jsx`
     fails with "without an existing tests/ reference";
   - the real rows 5.6, 5.10 and 5.11 pass;
   - the CODE_REVIEWED_UNTESTED rule still rejects a "Promote with" naming neither path.
7. **Trackers.**
   - AUDIT 5.6, 5.10 and 5.11 are DONE_CORRECTLY, with `file:line` in the pages or components
     and the test file plus test names.
   - AUDIT "How to read" names both accepted test paths.
   - `tests/README.md` documents the suite.

   Checked by: `node tests/docs/check-trackers.mjs` → exit 0, 0 warnings.
8. **Production code untouched.** `git diff --stat -- frontend/src` lists only
   `setupTests.js` and `__tests__/`. Checked by: the command.

## Test plan
- **Write first:** the three tests and the fixture; the suite block in `run-suite.ps1`.
- **Red run** (`tests/.out/t0019-red.log`):
  1. Before any test file exists, `-Suites frontend-test` → exit 1: CRA reports "No tests found".
  2. Characterisation tests pass against today's code by design, so the red run uses three
     temporary mutations, each restored afterwards (SHA-256 equal before and after):
     - JobDetails' min-score comparison `>=` → `>` → "min score hides rows below the threshold"
       fails (a row at exactly 60);
     - `SKILL_STATUS.matched` label "Evidenced" → "Matched" → "one badge per skillEvidence row"
       fails;
     - the evidence-limited notice removed from `ScoreBreakdown` → "ScoreBreakdown shows the
       evidence-limited notice" fails.
  3. Checker red: criterion 6's missing-path row.
- **Green:** `tests/.out/t0019-green.log`.
- **Cannot be automated:** none.

## Regression
- `tests/run-suite.ps1 -Target current -Live`:
  - nlp 0, backend 0, github 0, docs 0, frontend-test 0;
  - frontend (build) = exactly the 5 known lint warnings, no new ones. The test files are linted
    with `react-app/jest`.

## Risks and rollback
- **Risk:** CRA 5's Jest 27 cannot load an ESM-only dependency (framer-motion, lucide-react or
  react-router v7).
  - Mitigation: the CRA-supported `transformIgnorePatterns` / `moduleNameMapper` keys in
    `package.json` (the only allowed `package.json` change).
  - If none works, stop and ask before mocking the dependency.
- **Risk:** React 19 under Jest 27 prints `act` warnings. Accepted if the tests pass. Warnings
  are listed in Result.
- **Rollback:** delete `frontend/src/__tests__/` and `setupTests.js`, then revert the
  `run-suite.ps1`, checker and AUDIT hunks.

---

## Result
<Filled at the end. One line per acceptance criterion.>
