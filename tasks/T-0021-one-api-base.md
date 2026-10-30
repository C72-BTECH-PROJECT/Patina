# T-0021 — one-api-base

> Status: **draft, awaiting owner approval** (written in T-0016, 2026-10-15).
> ROADMAP item P2-2 (ARCHITECTURE §5 M2, ISSUES I-0012). Depends on P1-8 (T-0019). Fifth in
> the execution order, after P2-3 (T-0020), which deletes `Processing.jsx` and changes three of
> the pages touched here.

## Context
Each frontend page declares its own base URL. Read at `af8947d`:
- **13 files** use `process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000'`, e.g.
  `frontend/src/context/AuthContext.jsx:4`, `frontend/src/pages/candidate/JobDetail.jsx:6` and
  `frontend/src/pages/recruiter/JobDetails.jsx:11`.
- **`frontend/src/pages/public/ResetPassword.jsx:6`** hardcodes `'http://localhost:5000'` with no
  env lookup.
- **Three direct literal calls:** `pages/candidate/Assessment.jsx:61,104` and
  `pages/recruiter/CreateJob.jsx:211`.
- **A global `window.fetch` patch** (`frontend/src/context/AuthContext.jsx:18-37`) adds
  `credentials: "include"` to calls that start with the base. That is how cookies reach a
  cross-origin `:5000` from the CRA dev server on `:3000`.
- `import.meta.env` is no longer used anywhere (I-0012's first half is already gone).
- `frontend/package.json` has no `proxy`.

M2's aim:
- the browser uses one relative base, so it never names a service port;
- in development, CRA's proxy forwards `/api` to `:5000`;
- requests are then same-origin, so cookies flow without the patch.

That is also what lets P2-4 put the gateway on `:5000` without any frontend change.

## Goal
The frontend takes its API base from one module, calls relative `/api/...` URLs that CRA's dev
proxy forwards, sends cookies without patching `window.fetch`, and contains no hardcoded service
URL.

## Spec ref
- GR-2 (ARCHITECTURE §5 M2), I-0012; CHECKLIST GR-2.

## Scope
**In:**
- New `frontend/src/config/api.js`:
  - `export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || ''`;
  - `export function apiUrl(path)`;
  - `export function apiFetch(path, init)`, which prefixes the base and defaults
    `credentials: 'include'`, harmless same-origin and needed only if the env var points
    elsewhere.
- `frontend/package.json`: `"proxy": "http://localhost:5000"`.
- `context/AuthContext.jsx`:
  - the `window.fetch` patch and `__patinaFetchWrapped` are removed;
  - `withCredentialsFetch` is replaced by `apiFetch`, and `authFetch` keeps its name and
    contract for callers.
- Every file that declares `API_BASE_URL` imports from `config/api.js` instead. That is 13 once
  T-0020 has deleted `Processing.jsx`; the exact list is re-counted with `git grep` at execution
  and pasted in Result. The 5 literal calls (ResetPassword ×2, Assessment ×2, CreateJob ×1) go
  through `apiFetch`.
- New `frontend/src/__tests__/api-config.test.js`.
- `tests/README.md` and `MANUAL_SMOKE.md` notes: dev runs use `npm start` with the proxy; no
  `REACT_APP_API_BASE_URL` is needed.
- AUDIT GR-2 evidence, ISSUES (I-0012 resolved), WORKLOG.

**Out:**
- The gateway (P2-4), and serving the build from it.
- Deleting `Assessment.jsx` (P3-14). Its two calls are only re-pointed so the grep criterion
  holds.
- Behaviour changes on any page, and fixing the 5 known lint warnings, except where a touched
  line *is* one of them.

## Files touched
- `frontend/src/config/api.js` (new), `frontend/src/__tests__/api-config.test.js` (new)
- `frontend/src/context/AuthContext.jsx`, `frontend/src/components/layouts/CandidateLayout.jsx`
- `frontend/src/pages/admin/Dashboard.jsx`
- `frontend/src/pages/public/{Login,ResetPassword}.jsx`
- `frontend/src/pages/candidate/{CandidateJobs,JobDetail,Notifications,Results,Upload,Assessment}.jsx`
- `frontend/src/pages/recruiter/{Dashboard,JobDetails,Jobs,CreateJob}.jsx`
- `frontend/package.json`
- `tests/README.md`, `tests/MANUAL_SMOKE.md`, `AUDIT.md`, `ISSUES.md`, `WORKLOG.md`

## Moves
| Id | From → to | Why |
|---|---|---|
| GR-2 | PART → PART (evidence) | M2 done: one API base, no service ports in the browser |
| I-0012 | OPEN → RESOLVED | — |

## Acceptance criteria
1. **No service URL in the browser code.**
   `git grep -nE "localhost:[0-9]+|:8000|:5001" -- frontend/src` → 0 lines. Checked by: the
   command.
2. **One place reads the env var.** `git grep -l "REACT_APP_API_BASE_URL" -- frontend/src` →
   exactly `frontend/src/config/api.js`. Checked by: the command.
3. **One declaration.** `git grep -n "const API_BASE_URL" -- frontend/src` → only
   `config/api.js`. Checked by: the command.
4. **No fetch patch.** `git grep -nE "window\.fetch *=|__patinaFetchWrapped" -- frontend/src` → 0.
   Checked by: the command.
5. **The helper.** Checked by `frontend/src/__tests__/api-config.test.js`:
   - "base is relative by default": `API_BASE_URL === ''` and `apiUrl('/api/jobs') === '/api/jobs'`;
   - "env var overrides the base": with `REACT_APP_API_BASE_URL=http://x:1` and the module
     re-imported (`jest.isolateModules`), `apiUrl('/api/jobs') === 'http://x:1/api/jobs'`;
   - "apiFetch sends credentials": the mocked `fetch` receives `credentials: 'include'`, and a
     caller's own `credentials` wins.
6. **Dev proxy.** `frontend/package.json` has `"proxy": "http://localhost:5000"`. Checked by:
   `node -e "console.log(require('./frontend/package.json').proxy)"` → `http://localhost:5000`.
7. **Existing frontend tests unchanged and green.** `tests/run-suite.ps1 -Suites frontend-test`
   → 0, with T-0019's and T-0020's tests unmodified (they match fetch by path suffix). Checked by:
   the suite log, plus `git diff --stat -- frontend/src/__tests__` showing only the new file.
8. **Build.** `CI=true npm run build` shows no new lint warnings: the 5 known ones or fewer.
   Checked by: the `frontend` suite log.
9. **It works in a browser (manual).** The owner runs `npm start` (`:3000`) with core on `:5000`
   and no `REACT_APP_API_BASE_URL`:
   - the current-tree sections of `tests/MANUAL_SMOKE.md` pass: B (login sets the session
     cookie through the proxy, pages load) and C (the integrated flow: upload, apply, and the
     score status from T-0020). Section A targets the baseline worktree and does not apply.
     ARCHITECTURE §5 M2's draft said "A/B"; that wording is corrected here;
   - DevTools shows requests to `localhost:3000/api/...` only.

   Checked by: the owner's run, recorded in Result.
10. **Trackers.** AUDIT GR-2 cites `frontend/src/config/api.js` and the grep results; I-0012 is
    resolved. Checked by: `node tests/docs/check-trackers.mjs` → exit 0, 0 warnings.

## Test plan
- **Write first:** `api-config.test.js` (criterion 5).
- **Red run** (`tests/.out/t0021-red.log`):
  - `api-config.test.js` fails: there is no `config/api.js` module;
  - the grep counts at HEAD (measured at `af8947d` in T-0016) are recorded:
    - criterion 1: 17 lines (13 env fallbacks, `ResetPassword`'s constant, 3 literal calls);
    - criterion 2: 13 files;
    - criterion 4: 3 lines.

  All are red against their targets.
- **Green:** `tests/.out/t0021-green.log`.
- **Cannot be automated:** criterion 9. The cookie flow through CRA's dev proxy needs a real
  browser session.

## Regression
- `tests/run-suite.ps1 -Target current -Live`: nlp 0, backend 0, github 0, docs 0,
  frontend-test 0; frontend build ≤ 5 known warnings.
- MANUAL_SMOKE sections B and C (criterion 9).

## Risks and rollback
- **Risk:** CRA's `package.json` proxy does not forward requests whose `Accept` is `text/html`,
  so a page reload on an `/api` URL would not be proxied. Only `fetch` calls go to `/api`, so
  this is accepted.
- **Risk:** someone sets `REACT_APP_API_BASE_URL` to a cross-origin URL. `apiFetch` still sends
  credentials, and core's CORS (moved to the gateway in P2-4) must allow that origin.
- **Rollback:** revert the frontend files. No backend or data change.

---

## Result
<Filled at the end. One line per acceptance criterion.>
