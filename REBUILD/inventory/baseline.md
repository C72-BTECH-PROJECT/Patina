# Baseline: what runs today (Phase 1 inventory)

- **Taken:** 2026-11-12 (local time ~01:00–01:35 IST), Windows 11, Git Bash + Windows PowerShell 5.1.
- **Code:** branch `rebuild/fable` at `6da8d3f` (identical to `main` at `6da8d3f`; `git rev-parse HEAD main`). Working tree before and after: ` M CLAUDE.md`, `?? .claude/agents/`, `?? REBUILD/` (no change from this audit outside `REBUILD/`; see §8).
- **Labels:** VERIFIED = I ran it and saw the result. READ = I read the code/doc only. UNKNOWN = not established.
- **Rule for later verifiers:** the rebuild must not fall below §6. Every `BL-nn` row is a command you can re-run; compare against "observed today".
- Raw logs of this run are in the auditor's session scratchpad (not in the repo); everything needed to re-run is in this file.

---

## 1. Prerequisites

### 1.1 Tool versions (VERIFIED)

| Tool | Version | Path |
|---|---|---|
| node | v24.12.0 | `C:\Program Files\nodejs\node` |
| npm | 11.13.0 | |
| python (global) | 3.14.0 | `C:\Python314\python` |
| PowerShell used by harness | Windows PowerShell 5.1 (`powershell`) | |

### 1.2 Dependencies per service (VERIFIED by `ls` and `pip list`; nothing was installed by this audit)

| Service | Deps present? | Interpreter / env actually used | Notes |
|---|---|---|---|
| frontend | `frontend/node_modules` present | node 24 | **Create React App** (`react-scripts 5.0.1`, `frontend/package.json` scripts), **not Vite**. `@tailwindcss/vite` is listed as a dependency but there is no `vite.config.*`. |
| backend | `backend/node_modules` present | node 24 | ESM, Express 5. |
| gateway | `gateway/node_modules` present | node 24 | Express 5 + http-proxy-middleware 3.0.5. No `dotenv` dependency. |
| nlp-engine | `nlp-engine/venv` (py3.14): fastapi 0.141.1, uvicorn 0.52.1, spacy 3.8.13, **en_core_web_sm 3.8.0**, sentence-transformers 5.6.1, torch 2.13.0, pdfplumber, python-docx, pytest 9.1.1 | `nlp-engine\venv\Scripts\python.exe` | A second env `nlp-engine/.venv` has the same packages minus pytest. The **root `.venv`** (py3.14, newer fastapi/spacy/torch) has **no `en_core_web_sm`**: `.venv/Scripts/python.exe -c "import spacy; spacy.load('en_core_web_sm')"` → `OSError: [E050] Can't find model 'en_core_web_sm'` (VERIFIED). The root `.venv` therefore cannot run the NLP service. The model `all-MiniLM-L6-v2` is in the local HF cache (service starts with `HF_HUB_OFFLINE=1`). |
| assessment-service | `assessment-service/.venv` (py3.14): fastapi 0.162.0, uvicorn 0.54.0, openai 3.42.1, pytest 9.1.1 | `assessment-service\.venv\Scripts\python.exe` | There is **no** `assessment-service/venv` (the name `STEPS_TO_RUN_APP.md` uses). |
| github-evidence | `github-evidence/venv` (py3.14): fastapi 0.141.1, uvicorn 0.52.1, httpx 0.28.1, pytest 9.1.1, pytest-socket 0.8.1 | `github-evidence\venv\Scripts\python.exe` | |
| repo root | `node_modules` (Supabase CLI 2.122.1 only, `package.json`) | | Root `package.json` has no scripts; it is tooling only. |

### 1.3 Env files and variable names (VERIFIED by name and value length only; no value was read out)

| Service | File | Names set (non-empty) | Required by code but missing | Notes |
|---|---|---|---|---|
| backend | `backend/.env` exists | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SESSION_SECRET` (length 6, short), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_EVIDENCE_URL` | none | Hard-required (READ): `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (`backend/Config/supabase.js` throws at import), `SUPABASE_ANON_KEY` (`backend/Config/supabaseAuth.js:25-28`, throws on login), `SESSION_SECRET` (warn in dev, throw in production, `backend/index.js:13-18`). Optional with defaults: `PORT` (5001, `backend/index.js:22`), `NLP_PARSE_URL` (`http://localhost:8000/parse`), `FRONTEND_URL` (`http://localhost:3000`), `ASSESSMENT_SERVICE_URL` (`http://localhost:8002`), `GITHUB_EVIDENCE_URL` (`http://localhost:8001`), `GITHUB_EVIDENCE_TIMEOUT_MS`, `CREDIBILITY_WEIGHTS`, `NODE_ENV`. `GOOGLE_*` / `GITHUB_CLIENT_*` are set but **no backend code reads them** (READ: `grep process.env` over `backend/`). `.env.example` names: `PORT SESSION_SECRET SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ANON_KEY NLP_PARSE_URL FRONTEND_URL`; the real `.env` has no `PORT`, `NLP_PARSE_URL`, `FRONTEND_URL` (defaults apply). `supabase.js` loads `.env` with `override:true`, so shell env cannot override these. |
| gateway | **no `gateway/.env`** | n/a | none | `gateway/.env.example` lists 13 names (`PORT CORE_URL NLP_URL GITHUB_EVIDENCE_URL ASSESSMENT_URL FRONTEND_URL FRONTEND_BUILD_DIR GLOBAL_RATE_LIMIT_MAX ... PASSWORD_RESET_RATE_LIMIT_WINDOW_MS`) with no `=`. All have defaults in `gateway/index.js:12-28`. **The gateway never loads a `.env` file** (READ: no dotenv import or dependency), so a `gateway/.env` would be ignored; only process env counts. |
| nlp-engine | none | n/a | none | No env read by code. Harness sets `PYTHONHASHSEED=0`, `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`. |
| github-evidence | `github-evidence/.env` exists | `GITHUB_TOKEN` | none | `GITHUB_TOKEN` is hard-required: `github-evidence/app/config.py:64` raises `ConfigError` at import. Optional: `GITHUB_API_URL`, `GITHUB_MAX_REPOS`, `GITHUB_HTTP_TIMEOUT_S`, `GITHUB_DEADLINE_S`, `GITHUB_MIN_REMAINING`, `GITHUB_DETAIL_REPOS`, `GITHUB_CONCURRENCY`, `GITHUB_SUBSCORE_WEIGHTS`. |
| assessment-service | **no `assessment-service/.env`** | none | **`GEMINI_API_KEY` and `OPENROUTER_API_KEY` both missing** (also not set in shell, user or machine env) | Service starts without them (keys are only checked per request, `assessment-service/app/llm_client.py:62-73`), but every generate call fails (see BL-26). `.env.example` names: `GEMINI_API_KEY GEMINI_MODELS GEMINI_BASE_URL OPENROUTER_API_KEY OPENROUTER_FREE_MODELS ASSESSMENT_MAX_RETRIES_PER_MODEL ASSESSMENT_REQUEST_TIMEOUT_SECONDS`. Optional `ASSESSMENT_HOST` (127.0.0.1), `ASSESSMENT_PORT` (8002). |
| frontend | `frontend/.env` exists | `REACT_APP_API_BASE_URL` | none | Read in 10+ files, default `http://localhost:5000` (e.g. `frontend/src/context/AuthContext.jsx:4`). The production bundle contains only `http://localhost:5000` (17 occurrences in `build/static/js/main.*.js`), i.e. **the browser talks to the gateway**, not to core. |
| tests | `tests/.env` exists | `TEST_CANDIDATE_USERNAME/PASSWORD`, `TEST_RECRUITER_USERNAME/PASSWORD`, `TEST_RECRUITER2_USERNAME/PASSWORD`, `TEST_CANDIDATE2_USERNAME/PASSWORD` (all 8 set) | none | All four `t0001_*` profiles exist in Supabase (`sweep.mjs --check`, BL-21). |

### 1.4 Ports before starting (VERIFIED)
`Get-NetTCPConnection -State Listen` on 3000, 5000, 5001, 8000, 8001, 8002, 5100, 8100: **all free** before the audit.

---

## 2. Each service on its own (all VERIFIED)

Started one at a time with a PowerShell `Start-Process -PassThru -WindowStyle Hidden` wrapper that redirects stdout/stderr to files and polls the health URL every 0.5 s. "Ready" = first 2xx from the health URL, measured from process start.

| Service | Exact start command (cwd) | Starts? | Binds | Ready in | Health result | Startup warnings / errors |
|---|---|---|---|---|---|---|
| nlp-engine | (`nlp-engine/`) env `PYTHONHASHSEED=0 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1`; `venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000` | Yes | 127.0.0.1:8000 | ~14 s (model load) | `GET /` → 200 `{"status":"running","service":"NLP Parser Microservice","version":"1.0.0"}` | None. stderr: `Loading weights: 100% 103/103`, uvicorn startup lines. (First attempt failed only because my wrapper passed `PYTHONHASHSEED` wrongly: `Fatal Python error: config_init_hash_seed` — wrapper bug, not the service.) |
| github-evidence | (`github-evidence/`) `venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001` (token from `github-evidence/.env`) | Yes | 127.0.0.1:8001 | 1.3 s | `GET /health` → 200 `{"status":"ok","service":"github-evidence","contract_version":"1","token_configured":true}` | None. No GitHub call at startup. |
| assessment-service | (`assessment-service/`) `.venv\Scripts\python.exe -m app` | Yes | 127.0.0.1:8002 | 2.7 s | `GET /` → 200 `{"service":"Patina AI Assessment Service","status":"healthy"}` | None. **Health says healthy although no LLM key is configured**; health does not reflect the ability to generate. |
| backend (core) | (`backend/`) `node index.js` | Yes | **`::` (all interfaces) :5001** | 0.7 s | `GET /api/health` → 200 `{"status":"ok","timestamp":...}` | stdout: dotenv banner `injected env (9) from .env` (printed twice), `[supabase] service client key role: service_role (project <SUPABASE_URL>)` (the boot line prints the Supabase project URL), `Server running on http://localhost:5001`. stderr at first multipart request: `DeprecationWarning: form-data doesn't follow the spec and requires special treatment` (node-fetch issue 1167). |
| gateway | (`gateway/`) `node index.js` (no env vars, all defaults) | Yes | **`::` (all interfaces) :5000** | 0.7 s | `GET /health` → 200 `{"status":"ok","services":{"core":true,"nlp":true,"github-evidence":true,"assessment-service":true}}` | stdout `gateway listening on 5000`. Health probes core `/api/health`, NLP `/`, github-evidence `/health`, assessment `/` (`gateway/health.js`). |
| frontend (dev) | (`frontend/`) env `BROWSER=none`; `npm start` (= `react-scripts start`) | Yes | **0.0.0.0:3000** | 10.3 s | `GET /` → 200 HTML (`<link rel="icon" href="/Patina.png" />`); `GET /login` → 200 (SPA fallback) | `Compiled successfully!` (no lint warnings shown in dev, unlike the build). stderr: `[DEP0176] fs.F_OK is deprecated`, `Browserslist: caniuse-lite is 7 months old`, `DEP_WEBPACK_DEV_SERVER_ON_AFTER_SETUP_MIDDLEWARE` / `..._ON_BEFORE_SETUP_MIDDLEWARE` deprecations. |
| frontend (build) | (`frontend/`) `npm run build` | **Builds, with warnings**, exit 0, 39 s | n/a | n/a | `build/static/js/main.7adf8bda.js` 266.87 kB gzip, `main.49f95eb7.css` 7.78 kB | `Compiled with warnings.` 9 `no-unused-vars` ESLint warnings: `CandidateLayout.jsx:10:9 navigate`, `RecruiterLayout.jsx:8:9 navigate`, `AllCandidates.jsx:4:29 Filter`, `:4:108 ExternalLink`, `CreateJob.jsx:4:10 Plus`, `:4:16 X`, `Jobs.jsx:4:21 MapPin`, `:4:29 Users`, `:4:50 Sparkles`. Also `DEP0176`, Browserslist-old. |
| frontend (build, CI) | harness: `CI=true npm run build` | **Fails**, exit 1, 52 s | | | | `Treating warnings as errors because process.env.CI = true.` → `Failed to compile.` with the same 9 warnings. |

Process tree note (VERIFIED): each venv `python.exe` is a launcher; the listening process is its child (e.g. NLP launcher PID 18824 → server PID 15504). `npm.cmd start` → cmd → node → node (listening). Stop with `taskkill /PID <launcher> /T /F`.

Topology observations (VERIFIED by probes, READ for cause):
- Core listens on all interfaces at :5001 and answers directly without the gateway: `curl http://localhost:5001/api/jobs` → 401 `{"message":"Not authenticated"}`. The gateway is in the browser's path (bundle points at :5000) but nothing stops a client bypassing it.
- For every protected `/api/*` request the gateway first calls core `GET /api/auth/me` (`gateway/forwardAuth.js`), so core logs two requests per call (seen in the smoke-pass log).
- Gateway does not route to github-evidence or the assessment service; it proxies only `/api/*` to core (`gateway/index.js` proxy `pathFilter`). `GET :5000/v1/evidence` → 404 `Not found` (static fallback).
- `FRONTEND_BUILD_DIR` unset → gateway `GET /` → 404 (it does not serve the frontend by default).
- CORS preflight `OPTIONS :5000/api/auth/login` with `Origin: http://localhost:3000` → 204, `Access-Control-Allow-Origin: http://localhost:3000`, `Allow-Credentials: true`.

---

## 3. Existing automated tests

### 3.1 What `tests/run-suite.ps1` defines (READ: `tests/run-suite.ps1`, `tests/README.md`)

`powershell -File tests\run-suite.ps1 -Target {baseline|current} [-Suites ...] [-Live]`. Default suites: nlp, backend, frontend, docs, github, assessment.

| Suite | What it runs | Needs | Writes |
|---|---|---|---|
| nlp | starts NLP (`nlp-engine\venv`) on 8000; `pytest tests/nlp` (`test_parse.py`, `test_contact_determinism.py`, `test_model_load.py`) | NLP service; `SNAPSHOT_LABEL` | **Overwrites tracked snapshots** `tests/nlp/snapshots/<label>/*.json` (and git-ignored `tests/private/snapshots/`, `tests/.out/nlp-timings-*.json`) |
| backend | starts NLP + core, waits for **`http://localhost:5000/api/health`**; `node --test` on `smoke.test.mjs` + 9 offline unit tests + `assessment-generate.smoke.mjs` | NLP + core | none (one Supabase `profiles` read) |
| backend `-Live` | adds ~15 `live-*.test.mjs` files | Supabase test accounts, some need :8002, some need :8001 free | **Writes and deletes** in the shared Supabase project (sweep deletes rows of the t0001 accounts) |
| frontend | `CI=true npm run build` | node_modules | `frontend/build` (git-ignored) |
| docs | `node tests/docs/check-trackers.mjs` | nothing | none |
| github | `github-evidence\venv` `pytest tests/github --allow-hosts=127.0.0.1,::1` | nothing (network blocked) | none |
| assessment | `assessment-service\.venv` `pytest tests/assessment` | nothing (no LLM, no port) | none |

Also outside the script: `tests/gateway/*.mjs` (2 offline files + 1 live file), `tests/arch/nlp-outage-probe.mjs` (live, writes+sweeps), `tests/backend/sweep.mjs` (`--check` is read-only), `tests/MANUAL_SMOKE.md` (manual UI).

### 3.2 Results (VERIFIED unless marked)

| Suite / command | Result | Duration | Failures (first line) |
|---|---|---|---|
| `node tests/docs/check-trackers.mjs` | **FAIL**, exit 1, `check-trackers: 11 problem(s)` | <1 s | (1) `CLAUDE.md names a file that does not exist: REBUILD/DECISIONS.md` — caused by the uncommitted rebuild section in `CLAUDE.md`; (2–11) `ARCHITECTURE.md: cite backend/Routes/auth.routes.js:{17-44,46,47,48,48,49,50,51,51,52} is past end of file (24 lines)` — stale cites in committed `ARCHITECTURE.md`. So at committed HEAD the suite would report 10 problems. |
| `run-suite.ps1 -Target current -Suites docs` | FAIL, exit 1 (same 11 problems) | 1 s | as above |
| `run-suite.ps1 -Target current -Suites github` | **PASS**, `80 passed, 3 warnings in 28.21s` | 32 s | 0 failed, 0 skipped. Warnings: `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated`, `anyio.abc.BlockingPortal alias is deprecated`. |
| `run-suite.ps1 -Target current -Suites assessment` | **PASS**, `12 passed in 1.79s` | 4 s | 0 |
| `run-suite.ps1 -Target current -Suites frontend` | **FAIL**, exit 1 | 52 s | `Failed to compile.` (9 `no-unused-vars` warnings promoted to errors by `CI=true`) |
| `run-suite.ps1 -Target current -Suites backend` (the documented command) | **FAIL**, exit 1 | 89 s | `Backend did not become healthy on http://localhost:5000` (`run-suite.ps1:103`). Cause (VERIFIED from `tests/.out/current-backend.out.log`): core started fine and logged `Server running on http://localhost:5001`; the harness polls :5000 (`run-suite.ps1:54`, "HEAD hardcodes both") but core now defaults to 5001 (`backend/index.js:22`). No tests ran. Harness killed its processes; ports free afterwards. |
| Backend suite files run directly against core: `BACKEND_BASE_URL=http://localhost:5001 node --test --test-concurrency=1 tests/backend/smoke.test.mjs tests/backend/{explainability,github-evidence-client,migration-guards,signup-profile,grading-claim,upload-limits,applicant-identity,assessment-service-client,backend-cruft}.test.mjs tests/backend/assessment-generate.smoke.mjs` | **PASS**, `tests 99, pass 99, fail 0, skipped 0` | 3 s | 0 (needs core on :5001 and NLP up) |
| Same black-box files through the gateway: `BACKEND_BASE_URL=http://localhost:5000 node --test --test-concurrency=1 tests/backend/smoke.test.mjs tests/backend/assessment-generate.smoke.mjs` | FAIL, `tests 11, pass 7, fail 4` | 1 s | `unknown route -> 404` (got 401); `I-0027: unknown route with POST -> 404 naming the real method` (got 401); `POST /api/assessment/generate without session -> 401` (`expected a JSON error message`: gateway 401 body is `{"source":"gateway"}`); `POST /api/assessment/evaluate without session -> 401` (same). Expected: these tests assert core's behaviour; the gateway deny-by-default answers first. Recorded so nobody mistakes it for a regression. |
| NLP suite, run so it writes nothing in the repo (see 3.3) | **PASS**, `11 passed, 3 deselected in 32.23s` | 33 s | 0. 3 deselected = the 3 private resumes in git-ignored `tests/private/` (excluded on purpose: personal data, machine-specific). |
| `node --test tests/gateway/auth-routing.test.mjs tests/gateway/edge.test.mjs` (offline) | **PASS**, `tests 12, pass 12` | 5 s | 0 |
| `node --test tests/gateway/live-gateway.test.mjs` (needs core :5001 + gateway :5000) | **PASS**, `tests 2, pass 2` | <1 s | 0 |
| `node --test "tests/gateway/*.mjs"` (STEPS form, services up) | **PASS**, `tests 14, pass 14` | ~5 s | 0 |
| `cd gateway && npm test` (= `node --test ../tests/gateway/`) | **FAIL**, `tests 1, fail 1` | <1 s | `Error: Cannot find module '...\Patina\tests\gateway'` — Node 24 `--test` does not accept a directory argument. |

Totals for what ran green-or-red as designed: **github 80/80, assessment 12/12, NLP 11/11, backend (direct to :5001) 99/99, gateway 14/14 → 216 passed, 0 failed**; plus **docs FAIL (11 problems)**, **frontend CI build FAIL**, **harness backend suite FAIL to start (port mismatch)**, gateway `npm test` FAIL (Node 24 directory arg).

### 3.3 How the NLP suite was run without touching tracked files

`test_parse.py` writes every `/parse` response into `tests/nlp/snapshots/<SNAPSHOT_LABEL>/` (tracked). To avoid modifying tracked files I ran pytest with a one-file plugin that, after collection, rebinds `test_parse.SNAPSHOT_ROOT`, `test_parse.PRIVATE_DIR` and `conftest.OUT_DIR` to a temp directory. Assertions are unchanged. Plugin (put it in any directory `$P` on `PYTHONPATH`, e.g. a temp dir, as `nlp_redirect.py`):

```python
import os, sys
from pathlib import Path
DEST = Path(os.environ["BASELINE_SNAPSHOT_DIR"])
def pytest_collection_finish(session):
    for name, mod in list(sys.modules.items()):
        if mod is None: continue
        if name.split(".")[-1] == "test_parse" and hasattr(mod, "SNAPSHOT_ROOT"):
            mod.SNAPSHOT_ROOT = DEST / "nlp-snapshots"; mod.PRIVATE_DIR = DEST / "private-snapshots-unused"
        if name.split(".")[-1] == "conftest" and hasattr(mod, "OUT_DIR"):
            mod.OUT_DIR = DEST / "nlp-out"
```

Command (Git Bash, NLP running on :8000):
`PYTHONPATH=<win path of $P> BASELINE_SNAPSHOT_DIR=<win path of temp dir> NLP_BASE_URL=http://127.0.0.1:8000 SNAPSHOT_LABEL=current nlp-engine/venv/Scripts/python.exe -m pytest tests/nlp -v -p no:cacheprovider -p nlp_redirect -k "not private"`

**Result: the six fresh `/parse` snapshots are byte-identical** (`diff --strip-trailing-cr`) to the committed `tests/nlp/snapshots/current/*.json` (last changed in `a7c74e4`, 2026-10-12). Per-fixture output today (VERIFIED):

| Fixture | JD | skills | experience | education | projects | github found | match_level | similarity_score | tokens | /parse time |
|---|---|---|---|---|---|---|---|---|---|---|
| f1_dev_github.pdf | dev | 15 | 2 | 1 | 0 | yes | Strong Match | 0.8484 | 95 | 0.621 s (first call) |
| f2_dev_github.docx | dev | 14 | 5 | 1 | 0 | yes | Weak Match | 0.4779 | 67 | 0.254 s |
| f3_support_nogithub.pdf | support | 3 | 2 | 1 | 0 | no | Weak Match | 0.4138 | 81 | 0.268 s |
| f4_support_nogithub.docx | support | 6 | 4 | 1 | 0 | no | Weak Match | 0.4354 | 80 | 0.231 s |
| f5_multicolumn.pdf | dev | 10 | 0 | 3 | 0 | yes | Moderate Match | 0.6906 | 58 | 0.187 s |
| f6_image_only.pdf | dev | **0** | 0 | 0 | 0 | no | Poor Match | **0.0** | **0** | 0.019 s |

`f6_image_only` "passes" because the test asserts only response shape; the service extracts no text from an image-only PDF (no OCR, GF-2). `projects` is 0 for every fixture.

### 3.4 Suites not run, and why

| Suite | Why not run |
|---|---|
| `run-suite.ps1 -Suites nlp` (as written) | Overwrites tracked `tests/nlp/snapshots/current/*.json`. Ran the same tests with writes redirected instead (3.3). |
| `run-suite.ps1 -Target baseline ...` | Needs the `../patina-baseline` worktree at `32905c1` (git worktree add is not allowed for this audit). Not checked whether it exists. |
| `run-suite.ps1 -Suites backend -Live` (all `live-*.test.mjs`) | Writes to the shared Supabase project **and its sweep deletes rows** (`tests/backend/lib/testdb.mjs` `sweep()`); some create/delete auth users (`live-signup-role`). Deletion is outside this audit's constraints. |
| `node tests/arch/nlp-outage-probe.mjs` | Live: creates and **sweeps (deletes)** a job, upload, scores and resumes rows. |
| `node tests/backend/sweep.mjs` (no flag) | Deletes data. Only `--check` (read-only) was run. |
| `tests/MANUAL_SMOKE.md` | Manual browser walk-through; replaced by the API-level smoke pass in §4 (no browser automation available). |

---

## 4. End-to-end smoke pass (VERIFIED)

There is no automated end-to-end test that is safe to run (the live suites delete data), so I ran a minimal API pass that follows the UI's call sequence (`Upload.jsx` → `/api/resume/upload`, `JobDetail.jsx` → `/api/jobs/:id/apply`, `Processing.jsx` → `/api/analyze`, `Assessment.jsx` → `/api/assessment/generate`, recruiter pages → `/api/candidates`, `/api/recruiter/applicants`) **through the gateway at :5000**, which is where the frontend bundle points. All six services were up (gateway health `ok`, all four upstreams `true`). Accounts: `t0001_recr` / `t0001_cand` from `tests/.env`. Resume: synthetic fixture `tests/fixtures/f1_dev_github.pdf`. JD: `tests/fixtures/jds/dev.txt` with the manifest's `dev` skills.

The script (Node 24, `fetch`, cookie `patina_session` carried by hand) printed only status codes, key names and counts. Each step = one HTTP request:

| Step | Request (via :5000) | Status | Response (one line, no personal data) |
|---|---|---|---|
| E01 | `GET /health` | 200 | `{"status":"ok","services":{core,nlp,github-evidence,assessment-service all true}}` |
| E02 | `GET /api/health` | 200 | `status=ok` |
| E03 | `POST /api/auth/login` (recruiter) | 200 | body `{user}`, `Set-Cookie: patina_session` issued, role `RECRUITER`, 563 ms |
| E04 | `GET /api/auth/me` (recruiter) | 200 | `{user}`, role `RECRUITER` |
| E05 | `POST /api/jobs` `{title:"[T-0001 TEST] rebuild baseline smoke 2026-11-11", description:<dev JD>, skills:[6], preferredSkills:[4], experienceLevel:"2-5 years", location:"Remote"}` | 201 | job id returned, `status=published`, title tagged. **WRITE** |
| E06 | `POST /api/auth/login` (candidate) | 200 | `{user}`, cookie issued, role `CANDIDATE` |
| E07 | `GET /api/jobs` (candidate) | 200 | 4 published jobs visible, including the test job |
| E08 | `GET /api/resume/status` | 200 | `{hasResume,fileName,updatedAt,maxResumeBytes}`, `hasResume=false` |
| E09 | `POST /api/resume/upload` (multipart, f1 PDF) | 200 | `{message:"Resume uploaded successfully",fileName,size}`. **WRITE** (storage `resumes/candidates/<C>/`) |
| E10 | `POST /api/jobs/<jobId>/apply` | 201 | application row `{id,candidate_id,job_id,status,submitted_at,updated_at}`. **WRITE** |
| E11 | `POST /api/analyze` (multipart `jobId` + f1 PDF) | 200 | 1.33 s. Candidate record with `credibilityScore, matchLevel, subScores, weights, explanation, evidenceLimited=true, ...`. NLP `/parse` called once (200); github-evidence `/v1/evidence` called once → **404 `github_user_not_found`** (fixture login `example-mokafor` is synthetic); core logs `github=github_user_not_found`. **WRITE** (storage `resumes/<C>/<uuid>.pdf`, `resumes` row, `scores` row) |
| E12 | `GET /api/candidate-analysis` | 200 | the stored record (same keys as E11) |
| E13 | `POST /api/assessment/generate {jobId}` | **502** | `{"message":"Assessment generation failed"}`. Core: `[assessment] generate failed: ... kind=bad_status status=502`. Service: `POST /generate-assessment status=502`. **Chain breaks here.** |
| E14 | `GET /api/notifications` (candidate) | 200 | `{notifications,unreadCount}`, unread 0 |
| E15 | `GET /api/candidates` (recruiter) | 200 | 1 entry, for the test job, same record shape as E11 |
| E16 | `GET /api/recruiter/applicants` | 200 | 1 entry `{id,candidateId,jobId,jobTitle,candidateInfo,credibilityScore,skills,status,applicationId,appliedAt}` |
| E17 | `GET /api/jobs/mine` (recruiter) | 200 | 1 job |
| E18/E19 | `POST /api/auth/logout` ×2 | 200 | `{message}` |

Total wall time 4.3 s. A read-only follow-up (login as candidate, `GET /api/candidate-analysis`, logout) recorded the stored score:

- `credibilityScore = 84.84`, `matchLevel = "Strong Match"`, `evidenceLimited = true`.
- `weights = {github_evidence: 0, assessment_results: 0, parsing_semantic_alignment: 1}`: with GitHub and assessment unavailable, the whole score is the NLP factor (= NLP `similarity_score` 0.8484 × 100).
- `subScores.github_evidence`: `value null, available false, reason "The GitHub account named on the resume does not exist.", reason_code github_user_not_found`.
- `subScores.assessment_results`: `value null, available false, reason "No assessment has been completed ..."`.
- `subScores.parsing_semantic_alignment`: `value 84.84`, matched 9 of 10 job skills (missing `kubernetes`), skill_coverage 0.9 (weight 0.6), semantic_score 0.7709 (weight 0.4).
- `explanation` keys: `flags,factors,summary,version,composite,generated_at,skill_evidence,flags_available,evidence_limited,weighting_scheme,unavailable_evidence,flags_unavailable_reason`.

**Where the chain breaks and why.** Login, job creation, upload, apply, NLP parse, GitHub-evidence call, scoring, score retrieval and both recruiter views all work through the gateway. It breaks at **assessment generation (E13)**: `assessment-service` has no `.env` and neither `GEMINI_API_KEY` nor `OPENROUTER_API_KEY` is set anywhere, so the service returns 502. Confirmed by calling the service directly (no LLM call is made when both keys are empty): `curl -X POST http://127.0.0.1:8002/generate-assessment -H "Content-Type: application/json" -d '{"candidate_id":"bl-probe","job_id":"bl-probe","job_title":"probe","job_description":"probe","resume_text":"probe"}'` → **502 `{"detail":"OPENROUTER_API_KEY is missing from assessment-service/.env"}`**. Core hides that reason from the client (`"Assessment generation failed"`). Assessment evaluation and a score with an assessment factor were therefore not reachable. GitHub evidence was reached but no real GitHub data was scored because the fixture's account does not exist; a positive GitHub path was not exercised (no fixture names a real account).

Side observation (VERIFIED + READ): `POST /api/assessment/generate` made **no** github-evidence call (github-evidence log shows one `/v1/evidence` POST in the whole run, from E11). READ cause: `resolveResumeForAssessment` selects `skills, experience, projects, raw_text_preview, created_at` from `resumes` (`backend/Controllers/assessment.controller.js:118-119`) but the code then reads `resume?.contact?.github` (`:255`), which is never selected, so `include_github` is always false. Out of scope here; flagged for ISSUES.md by the lead.

**External calls made by the whole audit:** GitHub API: 1 `/v1/evidence` request, which per `github-evidence/app/github_client.py:180,301` is one `GET /users/example-mokafor` that returned 404 (READ for the exact count). LLM provider: **0** (no key; the service raises before calling). Supabase (live shared project): 3 logins as test accounts (+2 unknown-username login reads from the two `smoke.test.mjs` runs), the reads/writes listed in §4 and §5, and two `sweep.mjs --check` read-only count passes.

### 4.1 Data created in Supabase by this audit (VERIFIED with `node tests/backend/sweep.mjs --check`)

Before the smoke pass every count was 0 and all four t0001 profiles existed. After it:

| Table / storage | Rows/objects | What |
|---|---|---|
| `jobs` | 1 | id `f20490b3-83c5-4703-93db-36ac910506c1`, title `[T-0001 TEST] rebuild baseline smoke 2026-11-11` (UTC date), owner `t0001_recr`, **status published (visible to every candidate in the live project, including on `main`)** |
| `applications` | 1 | `t0001_cand` → that job |
| `resumes` | 1 | parse of f1 for `t0001_cand` |
| `scores` | 1 | composite 84.84 for that resume |
| storage `resumes/<C>/` | 1 | `<uuid>.pdf` (f1 fixture copy) |
| storage `resumes/candidates/<C>/` | 1 | `resume.pdf` (f1 fixture copy) |
| `notifications`, `assessments` | 0 | |

**Not cleaned up by me** (deletion is outside my constraints). To remove exactly these, the lead/Anthony can run `node tests/backend/sweep.mjs` (deletes only t0001-account rows and `[T-0001 TEST]` jobs, with a 50-row guard), then `node tests/backend/sweep.mjs --check` should exit 0. `sweep.mjs --check` currently exits 1 because of these rows.

---

## 5. Processes started and stopped (VERIFIED)

| Service | Launcher PID | Listening PID | Stopped with | After |
|---|---|---|---|---|
| nlp-engine | 18824 | 15504 | `taskkill /PID 18824 /T /F` | :8000 free |
| github-evidence | 18712 | 5932 | `taskkill /PID 18712 /T /F` | :8001 free |
| assessment-service | 6296 | 18964 | `taskkill /PID 6296 /T /F` | :8002 free |
| backend | 18952 | 18952 | `taskkill /PID 18952 /T /F` | :5001 free |
| gateway | 18748 | 18748 | `taskkill /PID 18748 /T /F` | :5000 free |
| frontend dev | 3460 (npm.cmd) | 1568 (node) | `taskkill /PID 3460 /T /F` (killed 1568, 18184, 7268) | :3000 free |
| harness `-Suites backend` run | (its own NLP + backend) | | killed by the harness `finally` block | :5000/:5001/:8000 free |

Final check: ports 3000, 5000, 5001, 8000, 8001, 8002 all free; no `node`/`python`/`cmd` process with `Patina` in its command line remains.

---

## 6. Baseline table (re-run line by line)

Run from the repo root in Git Bash unless noted. "Services up" = §7 steps 1–6 running. Status today: PASS / FAIL / NOT RUN.

| ID | Command | Observed today | Status |
|---|---|---|---|
| BL-01 | `node --version; npm --version; python --version` | v24.12.0 / 11.13.0 / 3.14.0 | PASS |
| BL-02 | `nlp-engine/venv/Scripts/python.exe -c "import spacy; spacy.load('en_core_web_sm')"` | loads (exit 0); same command with root `.venv` → `OSError [E050]` | PASS (nlp venv) |
| BL-03 | Start NLP: (`nlp-engine/`) `PYTHONHASHSEED=0 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000`; then `curl http://127.0.0.1:8000/` | ready ~14 s; 200 `{"status":"running","service":"NLP Parser Microservice","version":"1.0.0"}` | PASS |
| BL-04 | Start github-evidence: (`github-evidence/`) `venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001`; `curl http://127.0.0.1:8001/health` | ready 1.3 s; 200 `{"status":"ok","service":"github-evidence","contract_version":"1","token_configured":true}` | PASS |
| BL-05 | Start assessment: (`assessment-service/`) `.venv\Scripts\python.exe -m app`; `curl http://127.0.0.1:8002/` | ready 2.7 s; 200 `{"service":"Patina AI Assessment Service","status":"healthy"}` | PASS |
| BL-06 | Start core: (`backend/`) `node index.js`; `curl http://localhost:5001/api/health` | ready 0.7 s on `:::5001`; 200 `{"status":"ok",...}` | PASS |
| BL-07 | Start gateway: (`gateway/`) `node index.js`; `curl http://localhost:5000/health` | ready 0.7 s on `:::5000`; 200 `{"status":"ok","services":{"core":true,"nlp":true,"github-evidence":true,"assessment-service":true}}` | PASS |
| BL-08 | Start frontend dev: (`frontend/`) `BROWSER=none npm start`; `curl -o /dev/null -w "%{http_code}" http://localhost:3000/` | ready 10.3 s on `0.0.0.0:3000`; 200 HTML; "Compiled successfully!" | PASS |
| BL-09 | (`frontend/`) `npm run build` | exit 0, "Compiled with warnings", 9 `no-unused-vars`; main.js 266.87 kB gz | PASS (with 9 warnings) |
| BL-10 | `powershell -NoProfile -ExecutionPolicy Bypass -File tests/run-suite.ps1 -Target current -Suites frontend` | exit 1, "Failed to compile" (CI=true, same 9 warnings) | FAIL |
| BL-11 | `node tests/docs/check-trackers.mjs` | exit 1, 11 problems (1 from uncommitted CLAUDE.md naming `REBUILD/DECISIONS.md`, 10 stale `ARCHITECTURE.md` cites into `backend/Routes/auth.routes.js`) | FAIL |
| BL-12 | `powershell -NoProfile -ExecutionPolicy Bypass -File tests/run-suite.ps1 -Target current -Suites github` | `80 passed, 3 warnings`, exit 0, ~32 s | PASS |
| BL-13 | `powershell -NoProfile -ExecutionPolicy Bypass -File tests/run-suite.ps1 -Target current -Suites assessment` | `12 passed`, exit 0, ~4 s | PASS |
| BL-14 | `powershell -NoProfile -ExecutionPolicy Bypass -File tests/run-suite.ps1 -Target current -Suites backend` (ports 5000/5001/8000 free) | exit 1 after ~89 s, `Backend did not become healthy on http://localhost:5000`; core actually up on 5001 | FAIL |
| BL-15 | Services up (at least NLP + core): `BACKEND_BASE_URL=http://localhost:5001 node --test --test-concurrency=1 tests/backend/smoke.test.mjs tests/backend/explainability.test.mjs tests/backend/github-evidence-client.test.mjs tests/backend/migration-guards.test.mjs tests/backend/signup-profile.test.mjs tests/backend/grading-claim.test.mjs tests/backend/upload-limits.test.mjs tests/backend/applicant-identity.test.mjs tests/backend/assessment-service-client.test.mjs tests/backend/backend-cruft.test.mjs tests/backend/assessment-generate.smoke.mjs` | `tests 99, pass 99, fail 0` | PASS |
| BL-16 | Services up: `BACKEND_BASE_URL=http://localhost:5000 node --test --test-concurrency=1 tests/backend/smoke.test.mjs tests/backend/assessment-generate.smoke.mjs` | `tests 11, pass 7, fail 4` (gateway answers 401 `{"source":"gateway"}` for unknown/protected routes) | FAIL (expected; documents gateway vs core contract) |
| BL-17 | Services up (NLP on :8000): NLP suite with writes redirected (§3.3 command) | `11 passed, 3 deselected`; 6 snapshots byte-identical to `tests/nlp/snapshots/current/` | PASS |
| BL-18 | `node --test tests/gateway/auth-routing.test.mjs tests/gateway/edge.test.mjs` | `tests 12, pass 12` | PASS |
| BL-19 | Services up: `node --test "tests/gateway/*.mjs"` | `tests 14, pass 14` | PASS |
| BL-20 | `cd gateway && npm test` | `Cannot find module '...\tests\gateway'`, 1 fail | FAIL |
| BL-21 | `node tests/backend/sweep.mjs --check` (read-only) | before smoke: all 0, exit 0; after smoke: jobs 1, applications 1, resumes 1, scores 1, 2 storage objects, exit 1 | PASS before / FAIL after (until swept) |
| BL-22 | Services up: `curl -i http://localhost:5000/api/jobs` | 401 `{"source":"gateway"}` | PASS |
| BL-23 | Services up: `curl http://localhost:5001/api/jobs` (core direct, bypassing gateway) | 401 `{"message":"Not authenticated"}` (core reachable on all interfaces) | PASS (records exposure) |
| BL-24 | Services up: `curl -s -D - -o /dev/null -X OPTIONS http://localhost:5000/api/auth/login -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST"` | 204, `Access-Control-Allow-Origin: http://localhost:3000`, `Allow-Credentials: true` | PASS |
| BL-25 | Services up: smoke steps E01–E12, E14–E19 through :5000 (§4) | all 200/201 as in §4; analyze → score 84.84 "Strong Match", `evidenceLimited=true`, github `github_user_not_found` | PASS |
| BL-26 | Services up: smoke step E13 `POST /api/assessment/generate {jobId}` as candidate | 502 `{"message":"Assessment generation failed"}` | FAIL (no LLM key) |
| BL-27 | Services up: `curl -X POST http://127.0.0.1:8002/generate-assessment -H "Content-Type: application/json" -d '{"candidate_id":"bl-probe","job_id":"bl-probe","job_title":"probe","job_description":"probe","resume_text":"probe"}'` | 502 `{"detail":"OPENROUTER_API_KEY is missing from assessment-service/.env"}` | FAIL (no LLM key) |
| BL-28 | Assessment evaluate, assessment-weighted score | not reachable (BL-26) | NOT RUN |
| BL-29 | `run-suite.ps1 -Suites backend -Live`, `tests/arch/nlp-outage-probe.mjs` | would delete Supabase rows (sweep) | NOT RUN |
| BL-30 | `run-suite.ps1 -Target baseline` | needs `../patina-baseline` worktree | NOT RUN |
| BL-31 | GitHub evidence for a real GitHub account | no fixture names a real account; not attempted | NOT RUN |
| BL-32 | Image-only resume (`f6_image_only.pdf`) via `/parse` | 200 but 0 tokens, 0 skills, score 0.0 (no OCR) | PASS (shape) / feature absent |

---

## 7. How to reproduce this baseline

Windows, from the repo root `C:\Users\Anthony Jennis Nadar\OneDrive\Documents\GitHub\Patina`, PowerShell. Each service in its own terminal (or `Start-Process -PassThru` and keep the PID). Required env: `backend/.env` (Supabase URL, service-role key, anon key, session secret), `github-evidence/.env` (`GITHUB_TOKEN`), `tests/.env` (t0001 accounts). Assessment generation additionally needs `assessment-service/.env` with `GEMINI_API_KEY` or `OPENROUTER_API_KEY` (absent today).

0. Check ports free: `foreach ($p in 3000,5000,5001,8000,8001,8002) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue }`
1. Offline suites (no services): `node tests\docs\check-trackers.mjs`; `powershell -File tests\run-suite.ps1 -Target current -Suites github`; `... -Suites assessment`; `node --test tests\gateway\auth-routing.test.mjs tests\gateway\edge.test.mjs`; `cd frontend; npm run build`.
2. NLP: `cd nlp-engine; $env:PYTHONHASHSEED='0'; $env:HF_HUB_OFFLINE='1'; $env:TRANSFORMERS_OFFLINE='1'; .\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000` (wait ~15 s)
3. github-evidence: `cd github-evidence; .\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001`
4. assessment-service: `cd assessment-service; .\.venv\Scripts\python.exe -m app`
5. core: `cd backend; node index.js` (binds 5001; do **not** set `PORT=5000`, the gateway needs it)
6. gateway: `cd gateway; node index.js` (binds 5000; defaults are correct, no env needed)
7. frontend: `cd frontend; $env:BROWSER='none'; npm start` (3000)
8. Health: `curl http://localhost:5000/health` → `"status":"ok"` with all four `true`.
9. Tests needing services: BL-15, BL-16, BL-17, BL-19.
10. Smoke pass: run the E01–E19 sequence of §4 through `http://localhost:5000` as `t0001_recr` / `t0001_cand` (any HTTP client that keeps the `patina_session` cookie). Expect §4's statuses.
11. Data check: `node tests\backend\sweep.mjs --check`; clean up the smoke data with `node tests\backend\sweep.mjs` (deletes t0001 rows only) if you are allowed to.
12. Stop: `taskkill /PID <launcher> /T /F` for each; confirm the six ports are free. (STEPS §6's port loop does not include 3000.)

---

## 8. Working tree and side effects

- `git status --short` before and after: identical (` M CLAUDE.md`, `?? .claude/agents/`, `?? REBUILD/`). No tracked file changed.
- Git-ignored outputs that this audit overwrote (normal harness behaviour): `tests/.out/current-{docs,github,assessment,frontend-build,backend.out,backend.err,nlp.out,nlp.err}.log` (a copy of the previous `tests/.out/` was taken first, in the session scratchpad), `frontend/build/` (rebuilt, same file names), `__pycache__` dirs. `tests/.out/t0001-profile-snapshots.json` was rewritten by `sweep.mjs --check` with identical content.
- No dependency was installed or upgraded.
- Supabase: rows and objects listed in §4.1 (not cleaned up).

---

## 9. Docs that were wrong (VERIFIED unless marked READ)

| Doc:line | Says | Reality |
|---|---|---|
| `STEPS_TO_RUN_APP.md:4` (and every `cd`) | `cd C:\Users\Aditya\skill_validation_system\Patina` | Hard-coded path of another developer's machine. |
| `STEPS_TO_RUN_APP.md:8` | NLP install = `pip install -r requirements.txt` | `en_core_web_sm` is not in `requirements.txt` (only a comment, `nlp-engine/requirements.txt`); without `python -m spacy download en_core_web_sm` the service cannot import (`OSError [E050]`, seen with root `.venv`). |
| `STEPS_TO_RUN_APP.md:10,88` | assessment-service uses `venv` (`.\venv\Scripts\python.exe -m uvicorn ... --port 8002`) | The installed env is `assessment-service/.venv`; `assessment-service/venv` does not exist, so the command as written fails on this machine. The harness and `assessment-service/README.md` use `.venv` and `python -m app`. |
| `STEPS_TO_RUN_APP.md:27-28` | `frontend/.env`: `VITE_API_BASE_URL=...` | Frontend is Create React App; code reads `REACT_APP_API_BASE_URL` (READ). The real `frontend/.env` uses `REACT_APP_API_BASE_URL`. A `VITE_` variable would be ignored. |
| `STEPS_TO_RUN_APP.md:31+` | Create `gateway/.env` | The gateway never loads a `.env` file (READ: no dotenv); only process env (or defaults) apply. Defaults already match the intended ports. |
| `STEPS_TO_RUN_APP.md:116` and `tests/run-suite.ps1:12-15,54`, `tests/README.md:10` | `run-suite.ps1 -Target current -Suites backend`; "current = backend 5000 (HEAD hardcodes both)" | Fails: core defaults to 5001 (`backend/index.js:22`); the harness waits on 5000 and aborts (BL-14). With the gateway on 5000, pointing the harness at 5000 also fails 4 tests (BL-16). |
| `STEPS_TO_RUN_APP.md:114` | `node --test "tests/gateway/*.mjs"` | Passes only with core + gateway running (it includes `live-gateway.test.mjs`); not stated. |
| `STEPS_TO_RUN_APP.md:124-128` | stop loop over 8000,8001,8002,5000,5001 | Leaves the frontend dev server on 3000 running. |
| `STEPS_TO_RUN_APP.md` tests/.env block | example test passwords | Do not match the configured ones (different lengths); fine as placeholders but labelled as if real. |
| `gateway/package.json:9` | `"test": "node --test ../tests/gateway/"` | Fails on Node 24 (`Cannot find module ...\tests\gateway`) (BL-20). |
| `tests/run-suite.ps1` param `-Suites` (array) | README implies several suites can be chosen | With `powershell -File`, `-Suites docs,github,assessment` is rejected (`does not belong to the set`); only one suite per call works in `-File` mode. |
| `README.md:105,113,136` | backend `PORT=5000`, `npm run dev`, "API at http://localhost:5000" | Core defaults to 5001 and the gateway owns 5000; setting `PORT=5000` would collide with the gateway. README does not mention the gateway, github-evidence or assessment-service at all. |
| `README.md:61` | Backend stack includes Passport | No `passport` dependency in `backend/package.json` (READ). |
| `README.md:126` | do not create a virtual environment at the repo root | A root `.venv` exists and lacks the spaCy model (cannot run NLP). |
| Lead brief / `CLAUDE.md` "React (Vite) frontend" | Vite | Create React App (`react-scripts`), port 3000. |
| `ARCHITECTURE.md` (10 cites) | `backend/Routes/auth.routes.js:17-52` | File has 24 lines (BL-11). |
