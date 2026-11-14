# ARCHITECTURE.md: Patina as built

Verified at commit: `bd5aa4b` (branch `rebuild/fable`). Written 2026-11-14.

This document describes what runs today. Every as-built statement cites `file:line` at that commit, and
`node tests/docs/check-trackers.mjs` checks that each cite resolves. Status of features lives in `AUDIT.md`,
decisions and their reasons in `REBUILD/DECISIONS.md`, the plan after Nov 18 in the roadmap (§8). The
pre-rebuild version of this file is kept as `Docs/archive/ARCHITECTURE_2026-11-05.md`.

## 0. Answer for the guide (GR-2)

**Which component is the API gateway?** The `gateway/` process on port 5000. It is the only origin the browser
calls (`frontend/src/lib/api.js:43`) and the only process that listens beyond loopback
(`scripts/start-all.ps1:67`). It does CORS, rate limits, a session pre-check, security headers, per-route
timeouts, a JSON error contract and an aggregated health check, then proxies `/api/*` to core
(`gateway/index.js:82-123`).

**Does the system follow the microservices architecture the SRS claims?** **Partly.** There is a gateway, one
orchestrating core service, and three independently runnable, stateless Python services with HTTP contracts
and failure isolation. Core is a monolith: it owns all data, all auth and all orchestration, and keeps
sessions in its own memory. There is no per-service data store, core cannot be scaled to two instances, and
the gateway routes only to core, never directly to the Python services. The claim-by-claim verdict is in §6.

## 1. Diagram

```
browser (React dev server :3000)
   |  every API call goes to one origin, with the session cookie
   v
gateway :5000        the only entry point: request id, security headers, CORS,
   |                 rate limits, session pre-check, per-route timeouts, /health
   v
core :5001           loopback only. Owns the database, auth and sessions,
   |                 orchestration, the composite score and its explanation
   +--> nlp-engine :8000          parsing + résumé-to-job similarity   (stateless, loopback, no DB)
   +--> github-evidence :8001     GitHub metrics + GitHub sub-score    (stateless, loopback, no DB)
   +--> assessment-service :8002  LLM question generation + grading    (stateless, loopback, no DB)
   +--> Supabase (hosted)         Postgres, Auth, Storage              (reached only by core)

github-evidence --> api.github.com          assessment-service --> Gemini (OpenAI-compatible endpoint)
```

Six local processes. One command starts them and waits for each to be healthy
(`scripts/start-all.ps1:44-75`); one command stops them (`scripts/stop-all.ps1:1-20`).

## 2. What each unit is responsible for

| Unit | Port, bind | Responsibility | Holds state? | Evidence |
|---|---|---|---|---|
| frontend (`frontend/`) | 3000 | React single-page app (Create React App). One API client, credentials always included. Renders what core returns; it does not recompute scores or bands. | No | `frontend/src/lib/api.js:43`, `frontend/src/lib/api.js:94`, `frontend/src/App.jsx:44-84` |
| gateway (`gateway/`) | 5000, all interfaces | Single entry point. Deny-by-default public-route list, session pre-check, rate limits, helmet headers, CORS for the one frontend origin, proxy to core with per-route timeouts, aggregated `/health`. No business logic, no database. | No | `gateway/index.js:77-126`, `gateway/public-routes.js:3-12` |
| core (`backend/`) | 5001, loopback | Auth and sessions, every database and storage call, the résumé pipeline, scoring on apply, assessment orchestration (attempt policy, timer, answer key, reset), the composite score, bands, verification state and explanation, notifications, admin. | Yes: Supabase, plus in-memory sessions and in-flight pool preparation | `backend/index.js:37-39`, `backend/index.js:62-81`, `backend/Services/explainability.js:725-748` |
| nlp-engine (`nlp-engine/`) | 8000, loopback | Text extraction (pdfplumber, python-docx), skill extraction from a fixed vocabulary with aliases, contact and section extraction, MiniLM similarity to the job. Reports its own parser version. | No | `nlp-engine/app/main.py:189`, `nlp-engine/app/main.py:48`, `nlp-engine/app/embedder.py:11`, `nlp-engine/app/extractor.py:19-20` |
| github-evidence (`github-evidence/`) | 8001, loopback | Reads one public GitHub account through the REST API; returns repositories, languages, authored-commit activity, claim checks and a sub-score, or "unavailable" with a reason. | No | `github-evidence/app/main.py:179`, `github-evidence/app/scoring.py:23`, `github-evidence/app/scoring.py:102-103` |
| assessment-service (`assessment-service/`) | 8002, loopback | Generates a 20-question pool with Gemini, validates it, serves a random 10; grades multiple choice deterministically and short answers with the LLM under a schema. The only place an LLM is called. | No | `assessment-service/app/main.py:59`, `assessment-service/app/main.py:97`, `assessment-service/app/config.py:73-76` |
| Supabase (hosted) | — | Postgres (8 tables, 17 migrations), Auth (password hashing, email confirmation, reset), private Storage bucket for résumé files. | Yes | `supabase/migrations/20260823000000_create_profiles.sql:8`, `supabase/migrations/20261103120100_create_assessment_keys.sql:15` |

Where the SRS diagrams disagree with each other, the ruling is `REBUILD/DECISIONS.md` §1: LLM calls live only
in assessment-service; each Python service computes its own sub-score; the composite and the explanation live
in core.

## 3. Calls between units, with timeouts

Each caller's timeout sits just above the callee's own budget, so the callee's own error arrives first.

| From → to | Call | Timeout | On failure | Evidence |
|---|---|---|---|---|
| browser → gateway | every `/api/*` request | browser default | the API client raises one error shape | `frontend/src/lib/api.js:94` |
| gateway → core | session pre-check `GET /api/auth/session` | 2 s | 401 without a session; 503 `auth_unavailable` if core does not answer | `gateway/forwardAuth.js:31`, `gateway/forwardAuth.js:42` |
| gateway → core | proxy, standard routes | 60 s | 504 `upstream_timeout` with `may_still_complete: true`; 502 if core is unreachable | `gateway/index.js:34`, `gateway/index.js:58-63`, `gateway/index.js:67-71` |
| gateway → core | proxy, `POST /api/assessment/evaluate` | 130 s | same | `gateway/index.js:36`, `gateway/index.js:114` |
| gateway → core | proxy, `POST /api/assessment/generate` | 310 s | same (the route now answers at once; generation runs in the background) | `gateway/index.js:35`, `gateway/index.js:113` |
| gateway → core and the three services | `/health` aggregate | 2 s each | 503 only when core is down; otherwise 200 `ok` or `degraded` with one boolean per service | `gateway/health.js:31-45` |
| core → nlp-engine | `POST /parse` (multipart file, optional job text) | 30 s | parsing sub-score "unavailable" with a reason; an upload gets a fixed error message | `backend/Services/resumePipeline.js:37-39`, `backend/Services/resumePipeline.js:275` |
| core → nlp-engine | `GET /skills/vocabulary`, `POST /skills/extract` (job form) | 30 s | "suggestions unavailable" | `backend/Controllers/skills.controller.js:120`, `backend/Controllers/skills.controller.js:187` |
| core → github-evidence | `POST /v1/evidence` (login, claimed skills, 365-day window) | 8 s (service deadline 6 s) | GitHub sub-score "unavailable"; scoring continues | `backend/Services/githubEvidence.js:16-18`, `backend/Services/githubEvidence.js:119` |
| core → assessment-service | `POST /generate-assessment` | 300 s (service budget 210 s) | background preparation records a failure in memory; the candidate sees "unavailable", never a hung request | `backend/Services/assessmentService.js:54`, `assessment-service/app/config.py:43` |
| core → assessment-service | `POST /evaluate-assessment` | 120 s (service grading budget 100 s) | the attempt stays "submitted, grading pending"; never a zero | `backend/Services/assessmentService.js:55`, `assessment-service/app/evaluator.py:39` |
| core → Supabase | every query, auth and storage call | 10 s | 503 `database_timeout` | `backend/Config/supabase.js:82` |
| github-evidence → GitHub API | profile, repositories, languages, commits by `author` since the window start | inside the 6 s deadline | "unavailable" with a reason code | `github-evidence/app/github_client.py:252`, `github-evidence/app/config.py:51` |
| assessment-service → Gemini | chat completion per model in `GEMINI_MODELS` | 120 s per call, inside the budget | 502 with a fixed code; nothing is served | `assessment-service/app/config.py:23-25`, `assessment-service/app/config.py:44` |

All internal calls go through one client with a whole-call timeout, one retry on connection errors only, and
the caller's request id forwarded (`backend/Services/internalHttp.js:110-114`). The request id is created at
the gateway (`gateway/requestId.js:13`) and echoed by all three Python services
(`nlp-engine/app/main.py:77-82`, `github-evidence/app/main.py:145-156`, `assessment-service/app/main.py:40`).

The gateway never calls a Python service except for `/health`. A browser cannot reach core or a Python service
directly: they bind 127.0.0.1 (`backend/index.js:39`, `scripts/start-all.ps1:49`, `scripts/start-all.ps1:55`,
`scripts/start-all.ps1:62`).

## 4. Authentication and sessions

1. **Sign-up and login** go to core. Core looks the username up with an exact, case-insensitive match
   (`backend/Controllers/auth.controller.js:76-88`), checks suspension, and verifies the password with
   Supabase Auth (`backend/Controllers/auth.controller.js:373`). Supabase stores the password hash and sends
   the confirmation and reset emails.
2. **Session.** On success core regenerates the session id (`backend/Controllers/auth.controller.js:390`) and
   sets an `httpOnly`, `sameSite=lax` cookie named `patina_session`, valid for one day
   (`backend/index.js:46-57`). The store is express-session's default in-process memory store: no `store`
   option is passed. A core restart logs everyone out.
3. **Secret.** Core refuses to start unless `SESSION_SECRET` is at least 32 characters
   (`backend/index.js:23-32`).
4. **Gateway pre-check.** For any non-public `/api/*` route the gateway requires the cookie and asks core's
   `GET /api/auth/session`, which answers from memory with no database call
   (`gateway/forwardAuth.js:11-46`, `backend/Controllers/auth.controller.js:117`). Public routes are an
   explicit list; everything else is denied by default (`gateway/public-routes.js:3-12`).
5. **Enforcement is in core.** Every protected route runs `requireRole`, which re-reads the profile and
   rejects a suspended account (`backend/Middlewares/auth.Middleware.js:5-48`). Ownership checks (a recruiter
   sees only applicants to their own jobs) are in the controllers.
6. **Rate limits at the gateway.** Login and sign-up: 20 failed attempts per 15 minutes per IP, successes not
   counted. Password-reset requests: 5 per 15 minutes. Everything else: 300 per minute
   (`gateway/limits.js:22-46`).

Not built: OAuth 2.0 login, MFA, HTTPS (the demo runs on `http://localhost`), recruiter verification, an
external session store. These are roadmap Track B.

## 5. Data ownership

Core is the only process that talks to Supabase. It uses the service-role key for data
(`backend/Config/supabase.js:30-31`) and the anon key only for the password check
(`backend/Config/supabaseAuth.js:25-26`). So access control is enforced in core's code; the row-level-security
policies on all 8 tables are a second layer against direct database access, not the primary one.

| Table | Holds | Created in |
|---|---|---|
| `profiles` | account, role, suspension | `supabase/migrations/20260823000000_create_profiles.sql:8` |
| `jobs`, `applications` | job posts; one application per candidate per job, with status | `supabase/migrations/20260830000000_create_jobs_and_applications.sql:12`, `supabase/migrations/20260830000000_create_jobs_and_applications.sql:35` |
| `notifications` | per-user messages | `supabase/migrations/20260903000000_create_notifications.sql:6` |
| `resumes`, `scores` | parsed entities per upload; one new score row per scoring, newest = score of record (sub-scores and explanation as JSONB) | `supabase/migrations/20260903000100_create_resumes_and_scores.sql:18`, `supabase/migrations/20260903000100_create_resumes_and_scores.sql:41` |
| `assessments` | prepared pools and attempts (questions served, answers with `started_at`, evaluation) | `supabase/migrations/20261015004738_create_assessments.sql:10` |
| `assessment_keys` | answer keys and unserved pool questions; row-level security on with no policy for any browser role | `supabase/migrations/20261103120100_create_assessment_keys.sql:15-21` |

Résumé files sit in a private Storage bucket, one key per upload, and reach a recruiter only as a 60-second
signed link (`backend/Controllers/analysis.controller.js:273`). The full résumé text is never stored; it is
re-derived from the file when needed. The three Python services have no database client and keep nothing
between requests. Core keeps two things in memory only: sessions, and the state of in-flight or failed pool
preparation (`backend/Services/assessmentService.js:1-11`).

The SRS "Repository" entity is not its own table: the GitHub snapshot is stored inside the score row.

**Why Supabase (Postgres) and not the MongoDB the SRS names** (`REBUILD/DECISIONS.md` §1, PS-058):

1. The data is relational: users, jobs, applications, résumés, scores and assessments are linked by foreign
   keys, with rules such as one application per candidate per job. Postgres enforces these in the database.
2. The semi-structured parts (parsed entities, sub-scores, the explanation) are JSONB columns, so document
   flexibility is kept where the data needs it.
3. Supabase supplies authentication, private file storage with signed links, and row-level security, which
   the SRS would otherwise have had us build and operate.
4. The schema is 17 versioned SQL migrations in `supabase/migrations/`, so it is reproducible and reviewable.
5. Cost of the deviation: the stack is Postgres/Express/React/Node, not "MERN". It is standard Postgres, so
   it is not tied to the vendor.

## 6. Microservices verdict, claim by claim

| SRS claim | Verdict | What is true | Evidence |
|---|---|---|---|
| An API gateway is the single entry point | PASS | One origin for the browser; core and the Python services bind loopback. | `gateway/index.js:104-116`, `backend/index.js:39` |
| The gateway handles cross-cutting concerns | PASS | Request id, security headers, CORS, rate limits, session pre-check, timeouts, error contract, health. | `gateway/index.js:82-102`, `gateway/limits.js:22-46` |
| Services are independently runnable with HTTP contracts | PARTIAL | True for the three Python services: each starts alone, has its own environment and tests, and is called only over HTTP. Core is not one of several peers; it is the one orchestrator. | `nlp-engine/app/main.py:189`, `github-evidence/app/main.py:179`, `assessment-service/app/main.py:59` |
| Failure isolation | PASS | GitHub down: that sub-score is unavailable and scoring continues. Grader down: the attempt stays pending. Parser down: the application is still saved and can be scored again. | `backend/Services/githubEvidence.js:105-120`, `backend/Controllers/jobs.controller.js:254-257`, `backend/Services/assessmentService.js:54-55` |
| Each service owns its data | FAIL | One database, reached only by core. The Python services are stateless, so they own no data at all. | `backend/Config/supabase.js:30-31` |
| Services scale independently | FAIL | Core keeps sessions and preparation state in process memory, so it runs as exactly one instance. The Python services could be replicated; this was never tried. | `backend/index.js:46-57`, `backend/Services/assessmentService.js:1-11` |
| The gateway routes to each service | FAIL | The gateway proxies only to core; core calls the services. | `gateway/index.js:40-44`, `gateway/index.js:110-116` |
| Service-to-service authentication | FAIL | None. The Python services trust any caller on loopback; they are protected by their bind address only. | `scripts/start-all.ps1:49`, `scripts/start-all.ps1:62` |
| Deployed as separate units (containers) | FAIL | Six local processes started by a script. No containers, no deployment. | `scripts/start-all.ps1:44-75` |

**What we claim:** a gateway, an orchestrating core, and three independently runnable, stateless services with
HTTP contracts and failure isolation. **What we do not claim:** per-service data stores, independent scaling
of core, gateway routing to the Python services, or a deployed system. The SRS claim (PS-054 to PS-057,
PS-061) is therefore **partly met**.

## 7. Where the scoring rules live

The composite score, its weights (résumé 0.20, GitHub 0.35, assessment 0.45), the ceiling of 55 before the
assessment, the partly-verified cap at 79, the bands and the verification state are all in one file in core:
`backend/Services/explainability.js:173-190` (weights, version, cap), `backend/Services/explainability.js:725-748`
(weight plan), `backend/Services/explainability.js:144` (bands), `backend/Services/explainability.js:1050-1058`
(cap). Scoring runs on apply (`backend/Controllers/jobs.controller.js:254-257`) and writes a new `scores` row
each time (`backend/Services/scoringPipeline.js:193-194`). The reasons for each rule are in
`REBUILD/DECISIONS.md` §7.1. `CODE_MAP.md` is the file-by-file lookup table.

## 8. Target after Nov 18

Not status, and not built. The plan is `REBUILD/ROADMAP.md` (written in Phase 4, Nov 15–16); until it exists
the list is `REBUILD/CUT.md` list C and card H-1 in `REBUILD/TASKS.md`. The architecture items on it: an
external session store so core can run as more than one instance; splitting core (auth, applications, scoring
orchestration); service-to-service authentication; containers and a compose file; HTTPS; a queue for pool
preparation in place of in-memory state.
