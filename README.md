# Patina

Final-year project C72: an AI-automated skill validation and credibility framework. Patina replaces keyword
screening with evidence. A candidate's résumé says what they claim; public GitHub activity and a generated
technical assessment say how much of it holds; the recruiter sees one credibility score with the reasons for it.

This file is the one run guide. It does not carry project status.

| Question | Where to look |
|---|---|
| What is verified to work | `AUDIT.md` |
| What the spec asks for | `CHECKLIST.md`, `PROJECT_SOURCE_DOCS.md` |
| How it is built, and the honest microservices verdict | `ARCHITECTURE.md` |
| Why each design decision was made (weights, caps, anti-cheating, Supabase) | `REBUILD/DECISIONS.md` |
| What is in and out for the Nov 18 evaluation | `REBUILD/CUT.md` |
| Where a given piece of code is | `CODE_MAP.md` |
| Demo script and prepared answers | `REVIEW_BRIEF.md` |
| Parsing evaluation numbers | `eval/RESULTS.md` |
| Known defects | `ISSUES.md` |

## What runs

Six local processes. The browser talks only to the gateway.

| Process | Port | Folder | Runtime |
|---|---|---|---|
| frontend (React dev server) | 3000 | `frontend/` | Node |
| gateway (the only entry point) | 5000 | `gateway/` | Node |
| core (auth, data, orchestration, scoring) | 5001, loopback | `backend/` | Node |
| nlp-engine (résumé parsing) | 8000, loopback | `nlp-engine/` | Python |
| github-evidence | 8001, loopback | `github-evidence/` | Python |
| assessment-service (LLM questions and grading) | 8002, loopback | `assessment-service/` | Python |

Plus a hosted Supabase project (Postgres, Auth, Storage), reached only by core.

## Prerequisites

- Windows with PowerShell 5.1 or newer (the start and stop scripts are PowerShell).
- Node.js 18 or newer (developed on 24) with npm.
- Python 3.11 or newer (developed on 3.14).
- A Supabase project with every migration in `supabase/migrations/` applied
  (see `Docs/SUPABASE_MIGRATIONS_RUNBOOK.md`).
- A Gemini API key for the assessment. Without it everything else runs and the assessment reports itself
  unavailable.
- Optional: a GitHub token for github-evidence. Without it the GitHub API's unauthenticated rate limit applies.

## One-time setup

From the repository root, in PowerShell.

**1. Node dependencies**

```powershell
cd backend;  npm install; cd ..
cd gateway;  npm install; cd ..
cd frontend; npm install; cd ..
```

**2. Python environments.** The folder names matter: the start script looks for exactly these.

```powershell
python -m venv nlp-engine\venv
nlp-engine\venv\Scripts\python -m pip install -r nlp-engine\requirements.txt
nlp-engine\venv\Scripts\python -m spacy download en_core_web_sm

python -m venv github-evidence\venv
github-evidence\venv\Scripts\python -m pip install -r github-evidence\requirements.txt

python -m venv assessment-service\.venv
assessment-service\.venv\Scripts\python -m pip install -r assessment-service\requirements.txt
```

**3. Download the sentence model once.** `start-all.ps1` starts nlp-engine offline, so the MiniLM model must
already be in the local cache:

```powershell
nlp-engine\venv\Scripts\python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
```

**4. Environment files.** Copy each `.env.example` to `.env` in the same folder and fill it in. Never commit
a `.env` file. Variable names only:

| File | Required | Optional |
|---|---|---|
| `backend/.env` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SESSION_SECRET` (at least 32 characters, or core refuses to start) | `PORT` (5001), `FRONTEND_URL`, `NLP_PARSE_URL`, `ASSESSMENT_MAX_ATTEMPTS` (1), `ASSESSMENT_TIME_LIMIT_MINUTES` (15), `ASSESSMENT_PREPARE_RETRIES` (2). Leave `ASSESSMENT_PREPARE_ON_APPLY` unset. |
| `assessment-service/.env` | `GEMINI_API_KEY` | `GEMINI_MODELS`, `GEMINI_BASE_URL`, and the `ASSESSMENT_*` settings listed in its `.env.example` |
| `github-evidence/.env` | — | `GITHUB_TOKEN`, and the `GITHUB_*` settings listed in its `.env.example` |
| `frontend/.env` | — | `REACT_APP_API_BASE_URL` (default `http://localhost:5000`, the gateway) |
| `gateway/.env` | — | none needed; defaults are in `gateway/index.js`. Names are listed in `gateway/.env.example`. |
| `tests/.env` | only for the test suites: `TEST_CANDIDATE_USERNAME`, `TEST_CANDIDATE_PASSWORD`, `TEST_RECRUITER_USERNAME`, `TEST_RECRUITER_PASSWORD` | |

## Start and stop

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-all.ps1
```

`start-all.ps1` starts the six processes, waits until each answers its health check, runs one warm-up parse
through nlp-engine, and prints a status table. Expect about a minute; the frontend dev server is the slowest.
When it prints `all services up`, open **http://localhost:3000**.

- It exits 1 and names the service if anything did not come up, and stops what it started.
- It refuses to start if a Patina port is already in use or a previous run is still up.
- `-NoFrontend` skips the React dev server. `-KeepOnFailure` leaves processes running after a failed start.
- Logs: `tests\.out\start-all\<service>.out.log` and `.err.log`.
- **Do not pipe this command** into `Select-Object`, `Out-String`, `tail` or similar: the pipe waits for the
  servers to exit, and they never do.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-all.ps1
```

`stop-all.ps1` stops exactly the processes `start-all.ps1` recorded in `tests\.out\start-all\pids.json`, and
prints one row per service with the state of its port. If the frontend's listener was never recorded (for
example `start-all` was interrupted before the dev server answered), it stops the `node.exe` process listening
on port 3000. Anything else on a Patina port is reported, not stopped.

Health checks, if you want to look yourself:

| URL | Answers |
|---|---|
| `http://127.0.0.1:5000/health` | the gateway's aggregate: `ok` or `degraded`, one boolean per service |
| `http://127.0.0.1:5001/api/health` | core, including a database check |
| `http://127.0.0.1:8000/` | nlp-engine and its parser version |
| `http://127.0.0.1:8001/health` | github-evidence, and whether a token is configured |
| `http://127.0.0.1:8002/` | assessment-service, and whether an LLM key is configured |

## First use

1. Open `http://localhost:3000`, choose a role and sign up. Email confirmation is on in the project's
   Supabase settings, so confirm the address from the email before logging in.
2. As a recruiter: create a job with required skills.
3. As a candidate: upload a résumé (PDF or DOCX with a text layer), open the job, apply. The score appears
   with the application. Then take the assessment from the same job; pool preparation runs in the background
   after apply and usually takes under a minute.
4. As the recruiter: open **Applications**, then a row, for the drill-down.

Synthetic demo résumés with invented people are in `tests/fixtures/demo/` (see its `README.md`).

## Tests

All commands run from the repository root. The suites start and stop their own services, so **run
`stop-all.ps1` first**; the ports must be free. The one exception is `e2e`, which needs the stack running.

```powershell
# The default suites (nlp, backend, gateway, frontend, docs, github, assessment). They write nothing to Supabase;
# core still needs backend\.env and a reachable Supabase project to start.
powershell -File tests\run-suite.ps1 -Target current

# One suite
powershell -File tests\run-suite.ps1 -Target current -Suites backend

# Adds the tests that write to Supabase as the test accounts in tests\.env
powershell -File tests\run-suite.ps1 -Target current -Suites backend -Live

# End-to-end through the browser (Playwright). Start the stack first.
cd tests\e2e; npm ci; npx playwright install chromium; cd ..\..      # one time
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-all.ps1
powershell -File tests\run-suite.ps1 -Suites e2e

# Docs consistency check alone
node tests\docs\check-trackers.mjs
```

The end-to-end run drives the whole spine as a recruiter and a candidate (create job, upload, apply, score,
drill-down, shortlist, assessment with a mid-way reload, answer-key leak scan, re-score). It writes real rows
through the app as the test accounts and prints what it created; `node tests\backend\sweep.mjs --check` lists
leftovers. Details: `tests/README.md`. The parsing evaluation is separate: `eval/README.md`.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `start-all: FAILED before starting anything: … port … is already in use` | A previous stack or another program holds the port. Run `scripts\stop-all.ps1`; if the port is still held, the message names the PID. |
| `core did not come up` and `core.err.log` says `SESSION_SECRET is not set` or `too short` | Set a random `SESSION_SECRET` of at least 32 characters in `backend/.env`. |
| `nlp-engine did not come up` | First run without the cached model (setup step 3), or the spaCy model is missing (step 2). See `tests\.out\start-all\nlp-engine.err.log`. |
| Status table shows core `degraded` | Core is up but its database check failed: check `SUPABASE_URL`, the keys, and the network. |
| Everyone is logged out | Core was restarted. Sessions are kept in core's memory. Log in again. |
| Assessment stays "unavailable" | No `GEMINI_API_KEY`, or the provider refused the call. `http://127.0.0.1:8002/` reports whether a key is configured; the reason is in `assessment-service.err.log`. |
| GitHub evidence "unavailable" | No link on the résumé, the account has no public commits in the last year, or the GitHub API rate limit was hit (set `GITHUB_TOKEN`). The score is still computed without it. |
| Upload says the file cannot be read | The PDF has no text layer (a scan). OCR is not built. Use a text PDF or DOCX. |
| A request returns 504 with `may_still_complete` | The gateway stopped waiting; core may still finish. Reload the page to read the real state before retrying. |
| The terminal hangs after `start-all.ps1` | The command was piped. Run it unpiped. |

## Repository layout

```
frontend/            React app (Create React App)
gateway/             API gateway
backend/             core service
nlp-engine/          résumé parser
github-evidence/     GitHub metrics service
assessment-service/  LLM assessment service
supabase/migrations/ database schema, 17 versioned SQL files
scripts/             start-all.ps1, stop-all.ps1
tests/               all test suites and fixtures; run-suite.ps1
eval/                parsing evaluation: harness, labels, results
REBUILD/             the Nov 2026 rebuild: decisions, cut, task cards, log
Docs/                scope documents, runbooks, archive of superseded docs
```

## Rules for contributors

- A feature is "done" only with `file:line` evidence and a test or harness result in `AUDIT.md`.
- Database changes are migration files in `supabase/migrations/`; nothing is changed by hand in the dashboard.
- Secrets live only in `.env` files, which are git-ignored.
- Out-of-scope problems go to `ISSUES.md` with a triage tag (rule in `CLAUDE.md`).
