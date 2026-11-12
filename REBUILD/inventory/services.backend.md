# Inventory: Node side and data layer (`backend/`, `gateway/`, `supabase/`, root `package.json`)

Auditor: Phase 1 inventory, 2026-11-12. Branch `rebuild/fable`, HEAD `6da8d3f` (working tree: only `CLAUDE.md`, `.claude/agents/`, `REBUILD/` dirty; no Node or SQL file modified).

Labels: **VERIFIED** = I ran something (command and result given). **READ** = I read the code at HEAD. **UNKNOWN** = not checkable from the repo.
Nothing in `.env` files was printed; only variable names are listed.

What I ran (all read-only, no app started, no DB touched):
- V1: `node --test --test-reporter=tap --test-concurrency=1` on the 9 offline backend tests + 2 offline gateway tests (`tests/backend/{explainability,grading-claim,github-evidence-client,assessment-service-client,applicant-identity,signup-profile,migration-guards,upload-limits,backend-cruft}.test.mjs`, `tests/gateway/{auth-routing,edge}.test.mjs`) → **100 tests, 100 pass, 0 fail**, exit 0. None of these load `backend/.env`.
- V2: an in-process gateway probe (scratch script; `createApp()` from `gateway/index.js` against a stub "core" on a random port). Results are quoted where used (§3).
- V3: an in-process Express 5.2.1 probe using `backend/node_modules/express`, NODE_ENV unset: malformed JSON body → **400 text/html with stack trace**; an async handler throw → **500 text/html with stack trace**.
- V4: variable names in `backend/.env` (names only): `SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ANON_KEY SESSION_SECRET GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET GITHUB_CLIENT_ID GITHUB_CLIENT_SECRET GITHUB_EVIDENCE_URL`. There is **no `PORT`** and **no `NODE_ENV`**. `gateway/.env` does not exist (only `gateway/.env.example`).

---

## 1. Entry points

### 1.1 Root `package.json`
READ `package.json:1-8`: tooling only, one devDependency `supabase` CLI `2.122.1`. No scripts, no workspaces. Nothing starts the stack as a whole; there is no Dockerfile/compose/Procfile (READ: `git ls-files` shows none).

### 1.2 `backend/` ("core")
| Item | Value | Evidence |
|---|---|---|
| Start | `npm start` = `node index.js`; `npm run dev` = nodemon | READ `backend/package.json:6-9` |
| Module type | ESM | READ `backend/package.json:14` |
| Port | `process.env.PORT \|\| 5001` | READ `backend/index.js:22`. `backend/.env` has no `PORT` (V4), so it binds **5001** unless the shell sets `PORT`. |
| Bind address | none given → all interfaces | READ `backend/index.js:80` (`app.listen(PORT)`) |
| Env loading | `dotenv.config({ path: backend/.env, override: true })`, done inside `Config/supabase.js` and `Config/supabaseAuth.js` (ESM import order means it runs before `index.js` reads `PORT`/`SESSION_SECRET`) | READ `backend/Config/supabase.js:12`, `backend/Config/supabaseAuth.js:9` |
| Boot hard-fail | throws if `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` missing; throws if `SESSION_SECRET` missing **and** `NODE_ENV=production` | READ `backend/Config/supabase.js:17-21`, `backend/index.js:13-18` |
| Boot log | logs decoded role of the service key **and the Supabase project URL** | READ `backend/Config/supabase.js:40` |
| Shutdown | SIGINT/SIGTERM graceful close, 10 s force; uncaughtException → exit 1; unhandledRejection → log only | READ `backend/index.js:104-128` |

Env variable names the backend reads (code), with default:
- `PORT` (5001), `SESSION_SECRET` (hardcoded dev fallback, see §9), `NODE_ENV` (unset → cookie not `secure`, dev error pages), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (lazy; only auth flows fail without it).
- `NLP_PARSE_URL` (`http://localhost:8000/parse`) — READ `analysis.controller.js:15`, `assessment.controller.js:33`.
- `GITHUB_EVIDENCE_URL` (`http://localhost:8001`; empty string = disabled), `GITHUB_EVIDENCE_TIMEOUT_MS` (8000) — READ `Services/githubEvidence.js:16-17,59-66`.
- `ASSESSMENT_SERVICE_URL` (`http://localhost:8002`) — READ `Services/assessmentService.js:9,16`.
- `FRONTEND_URL` (`http://localhost:3000`; used only for email redirect links) — READ `auth.controller.js:9-10`.
- `CREDIBILITY_WEIGHTS` (JSON; read once at import) — READ `Services/explainability.js:116-135`.
- `backend/.env.example` names: `PORT SESSION_SECRET SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_ANON_KEY NLP_PARSE_URL FRONTEND_URL` (V4-style grep). It omits `ASSESSMENT_SERVICE_URL`, `GITHUB_EVIDENCE_URL`, `GITHUB_EVIDENCE_TIMEOUT_MS`, `CREDIBILITY_WEIGHTS`, `NODE_ENV`.
- `backend/.env` holds `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET` that **no code reads** (READ: grep of `backend/**/*.js` finds no `GOOGLE_`/`GITHUB_CLIENT`).

Dependencies: `@supabase/supabase-js`, `cors` (**unused**: not imported since commit `2442ad4`), `dotenv`, `express@5`, `express-session`, `form-data`, `multer`, `node-fetch` (READ `backend/package.json:15-24`). No `engines` pin.

### 1.3 `gateway/`
| Item | Value | Evidence |
|---|---|---|
| Start | `npm start` = `node index.js`; listens only when run as main | READ `gateway/package.json:7-9`, `gateway/index.js:71-77` |
| Port | `PORT \|\| 5000` | READ `gateway/index.js:14,75` |
| Bind | all interfaces | READ `gateway/index.js:76` |
| Env loading | **none** (no dotenv dependency; reads `process.env` only). A `gateway/.env` file would be silently ignored. | READ `gateway/package.json:11-16`, `gateway/index.js:12-28` |
| Created | 2026-11-04, commits `636314c` ("gateway auth-edge") and `2442ad4` ("gateway part2 safe edits"), which also removed CORS and the rate limiter from the backend and moved it to 5001 | VERIFIED `git show --stat 636314c 2442ad4` |
| Deps | `cors 2.8.6`, `express 5.2.1`, `express-rate-limit 7.5.0`, `http-proxy-middleware 3.0.5`; `engines.node >=18`; `node_modules` present locally | READ `gateway/package.json:11-19`; VERIFIED `ls gateway/node_modules` |

Env names (code, with default): `PORT` 5000, `CORE_URL` `http://localhost:5001`, `NLP_URL` `http://localhost:8000`, `GITHUB_EVIDENCE_URL` `http://localhost:8001`, `ASSESSMENT_URL` `http://localhost:8002`, `FRONTEND_URL` `http://localhost:3000`, `FRONTEND_BUILD_DIR` (none), `GLOBAL_RATE_LIMIT_MAX` 300, `GLOBAL_RATE_LIMIT_WINDOW_MS` 60000, `AUTH_RATE_LIMIT_MAX` 20, `AUTH_RATE_LIMIT_WINDOW_MS` 900000, `PASSWORD_RESET_RATE_LIMIT_MAX` 5, `PASSWORD_RESET_RATE_LIMIT_WINDOW_MS` 900000 (READ `gateway/index.js:12-28`). `gateway/.env.example` lists the same 13 names.

Note: the same downstream has different variable names in the two Node units: `ASSESSMENT_SERVICE_URL` (backend) vs `ASSESSMENT_URL` (gateway); `NLP_PARSE_URL` (backend, includes `/parse`) vs `NLP_URL` (gateway, base only). READ.

---

## 2. Route tables

### 2.1 Backend (29 routes). Global middleware, in order (READ `backend/index.js:24-75`)
1. `requestIdMiddleware` (keeps a valid `X-Request-ID` or makes a UUID; logs one `[core]` line per finished response) — `backend/Middlewares/requestId.js:7-18`
2. `express.json()` (default 100 kb limit, no custom error handling)
3. `express-session` (cookie `patina_session`, httpOnly, sameSite lax, `secure` only if `NODE_ENV=production`, 1 day, **default MemoryStore**) — `backend/index.js:27-38`
4. debug logger (second log line per request) — `backend/index.js:42-45`
5. routers; `GET /api/health`; JSON 404 catch-all. **No CORS, no rate limiting, no error-handling middleware, no security headers** (READ).

Auth middleware semantics (READ `backend/Middlewares/auth.Middleware.js`): `requireAuth` = session has `userId` AND a `profiles` row exists AND `is_suspended=false` (fails closed on DB error → 401; suspended → destroys session, 403). `requireRole(...r)` = `requireAuth` + `req.session.role ∈ r` (role cached in session at login).

All "Supabase" below = the single **service-role** client (RLS bypassed) unless stated.

| # | Method + path | Handler | Middleware | What it does | Downstream |
|---|---|---|---|---|---|
| 1 | POST `/api/auth/signup` | `auth.controller.js:208` | none | validates name/username(`^[A-Za-z0-9_]{3,30}$`)/email/password≥8/role∈{candidate,recruiter}; `auth.signUp` with metadata; then verifies trigger-created profile, deletes auth user if missing | Supabase Auth (anon client) `signUp`; `profiles` select; `auth.admin.deleteUser` (service) — `Services/signupProfile.js:14-39` |
| 2 | POST `/api/auth/login` | `auth.controller.js:271` | none | profile by `ilike(username)`; suspended → 403; email via admin API; `signInWithPassword`; stores `userId/email/role` in session; **Supabase tokens discarded** | `profiles`; `auth.admin.getUserById`; Auth `signInWithPassword` (anon) |
| 3 | GET `/api/auth/me` | `auth.controller.js:59` | requireAuth | returns profile | `profiles` (`select *`) |
| 4 | POST `/api/auth/logout` | `auth.controller.js:72` | none | destroys session, clears cookie | — |
| 5 | POST `/api/auth/resend-confirmation` | `auth.controller.js:80` | none | resend signup email | Auth `resend` (anon) |
| 6 | POST `/api/auth/request-password-reset` | `auth.controller.js:107` | none (limit only at gateway) | username via `ilike` → email via admin API → `resetPasswordForEmail`; always 200 generic | `profiles`; `auth.admin.getUserById`; Auth (anon) |
| 7 | POST `/api/auth/reset-password` | `auth.controller.js:160` | none | `verifyOtp(recovery)` or `setSession` on a fresh anon client, then `updateUser({password})` | Auth (fresh anon client) |
| 8 | GET `/api/jobs` | `jobs.controller.js:20` | requireRole(CANDIDATE,RECRUITER,ADMIN) | published jobs | `jobs` |
| 9 | GET `/api/jobs/mine` | `jobs.controller.js:31` | requireRole(RECRUITER) | own jobs (all statuses) | `jobs` |
| 10 | POST `/api/jobs` | `jobs.controller.js:42` | requireRole(RECRUITER) | create job; `status` taken from body unvalidated (default `published`) | `jobs` insert |
| 11 | GET `/api/jobs/my-applications` | `jobs.controller.js:159` | requireRole(CANDIDATE) | own applications | `applications` |
| 12 | POST `/api/jobs/applications/shortlist` | `jobs.controller.js:179` | requireRole(RECRUITER) | ownership-checked status → shortlisted/rejected, sends notification | `applications` (+`jobs!inner`), `notifications` insert. **No frontend caller** (READ: grep of `frontend/src` for `shortlist` finds only CSS class names) |
| 13 | GET `/api/jobs/:id` | `jobs.controller.js:76` | requireRole(all 3) | published job + `applied` flag for candidates | `jobs`, `applications` |
| 14 | POST `/api/jobs/:id/apply` | `jobs.controller.js:103` | requireRole(CANDIDATE) | requires a `candidates/<uid>/resume*` storage object; inserts application. **Does not score.** | Storage `resumes` list; `jobs`; `applications` insert |
| 15 | POST `/api/analyze` | `analysis.controller.js:287` | requireRole(CANDIDATE) → `resumeUpload` (multer memory, 10 MB) | extension check (.pdf/.docx); published job; NLP parse; store raw file; insert `resumes`; GitHub evidence; latest completed assessment; build + insert `scores`; return serialized candidate | NLP `POST /parse`; Storage upload `<uid>/<uuid>.<ext>`; `resumes`; github-evidence `POST /v1/evidence`; `assessments`; `scores` |
| 16 | GET `/api/candidate-analysis` | `analysis.controller.js:451` | requireRole(CANDIDATE) | own latest score (+resume, job) | `scores` (+`resumes`,`jobs`) |
| 17 | GET `/api/candidates` | `analysis.controller.js:477` | requireRole(RECRUITER) | latest score per candidate across recruiter's jobs, sorted by composite | `jobs`, `scores` (+`resumes`+`profiles`) |
| 18 | GET `/api/recruiter/applicants` | `analysis.controller.js:531` | requireRole(RECRUITER) | applications for recruiter's jobs + name/email + latest score per (candidate,job) | `jobs`, `applications`, `profiles`, RPC `applicant_emails`, `scores` (one query per application) |
| 19 | GET `/api/resume/status` | `analysis.controller.js:180` | requireRole(CANDIDATE) | has a `candidates/<uid>/resume*` object? | Storage list |
| 20 | POST `/api/resume/upload` | `analysis.controller.js:258` | requireRole(CANDIDATE) → `resumeUpload` | upsert `candidates/<uid>/resume.<ext>`, prune others. No parse. | Storage upload/list/remove |
| 21 | GET `/api/resume/candidate/:candidateId` | `analysis.controller.js:207` | requireRole(RECRUITER) | UUID check; candidate must have applied to one of recruiter's jobs; 60 s signed URL | `applications`(+`jobs!inner`), Storage list + `createSignedUrl` |
| 22 | GET `/api/admin/overview` | `admin.controller.js:16` | requireRole(ADMIN) (router-level) | counts + user lists; **returns the Supabase project host** in JSON | `profiles`, `jobs` |
| 23 | GET `/api/admin/users?role=` | `admin.controller.js:56` | requireRole(ADMIN) | users by role | `profiles` |
| 24 | PATCH `/api/admin/users/:userId/suspension` | `admin.controller.js:77` | requireRole(ADMIN) | toggle `is_suspended` (not on admins); `userId` not UUID-validated | `profiles` update |
| 25 | GET `/api/notifications?unread=` | inline `notification.routes.js:7-11` → `notification.controller.js:19` | requireAuth | own notifications; **DB error → silently `{notifications:[],unreadCount:0}`** | `notifications` |
| 26 | POST `/api/notifications/:id/read` | inline `notification.routes.js:13-19` → `notification.controller.js:43` | requireAuth | mark own as read (scoped by `user_id`) | `notifications` update |
| 27 | POST `/api/assessment/generate` | `assessment.controller.js:178` | requireRole(CANDIDATE) | resume open attempt or (if <5 completed) generate: resolve resume text (parse stored file on demand), optional GitHub, call assessment-service, insert `assessments` + `assessment_keys`, return questions without key | `jobs`, `assessments`, `resumes`, Storage list/download, NLP `/parse`, github-evidence, assessment-service `/generate-assessment`, `assessment_keys` |
| 28 | POST `/api/assessment/evaluate` | `assessment.controller.js:367` | requireRole(CANDIDATE) | validate; ownership; atomic claim RPC; load key; grade via service; complete under claim; fold into latest `scores` row (in-place update); return per-question results | RPC `claim_assessment_for_grading`, `assessment_keys`, assessment-service `/evaluate-assessment`, `assessments` update, `scores` update |
| 29 | GET `/api/health` | `backend/index.js:63-70` | none | always `{status:'ok'}`; checks nothing | — |

### 2.2 Gateway. Middleware order (READ `gateway/index.js:30-69`)
1. `requestId` (validate/replace `X-Request-ID`, echo, one log line with method+url only) — `gateway/requestId.js:5-13`
2. CORS: allow only `origin === FRONTEND_URL`, credentials — `gateway/cors.js:3-9`
3. `GET /health` aggregated — `gateway/health.js:16-33`
4. Rate limits (in-memory, per `req.ip`): `/api/auth/request-password-reset` 5/15 min; `/api/auth/login` + `/api/auth/signup` 20/15 min (shared counter); everything 300/min; `/api/auth/me` exempt from all — `gateway/limits.js:11-45`
5. Forward-auth: if not public (allowlist of 6 auth POSTs + 2 health GETs, all non-`/api/` paths, all OPTIONS), require a `patina_session` cookie and call core `GET /api/auth/me` with only that cookie, 2 s timeout: 200 → continue; 401 → 401; 403 → pass through; anything else/timeout → 503 `auth_unavailable`. `GET /api/auth/me` itself skips this. — `gateway/forwardAuth.js:4-36`, `gateway/public-routes.js:3-21`
6. Proxy: every path starting `/api` → `CORE_URL`, `changeOrigin`, on error 502 `{error:'upstream_unavailable', service:'core'}`; no body parser before it (streams uploads); no proxy timeout; no `xfwd` — `gateway/index.js:51-63`
7. Static SPA from `FRONTEND_BUILD_DIR` if it exists; else non-API paths 404 — `gateway/static.js:5-21`

| Method + path | Behaviour | Downstream |
|---|---|---|
| GET `/health` | parallel 2 s checks; 503 if core down, else 200 `ok`/`degraded` | core `/api/health`, NLP `/`, github-evidence `/health`, assessment `/` |
| ANY `/api/*` | limits → forward-auth → proxy | core only |
| GET non-API | static/SPA or 404 | filesystem |

There is **no gateway route to NLP, github-evidence or assessment-service** (by design, DEC-5 in `gateway/README.md:14`). READ.

---

## 3. Gateway reality check (GR-2)

What it actually does (READ + VERIFIED V1/V2):
- It is a **single-upstream reverse proxy** in front of core, adding CORS, rate limiting, a session pre-check and an aggregated health check. It routes to exactly one service. VERIFIED (V2): `GET /api/jobs` without cookie → 401 at gateway, core never saw it; with a cookie core accepts → 200, and core saw an extra `GET /api/auth/me` first.
- **It has no auth of its own.** The pre-check is a callback into core's `/api/auth/me` (which runs `requireAuth` + `loadProfile`: 2 Supabase queries). So every authenticated API call costs 1 extra HTTP hop and 2 extra Supabase round trips, and must finish within 2 s or the user gets 503 (READ `forwardAuth.js:20`, `auth.Middleware.js:15-19`, `auth.controller.js:49-53`). Core still re-checks auth on every route, so the gateway is defence in depth, not the enforcement point.
- Rate limits: VERIFIED (V2, `AUTH_RATE_LIMIT_MAX=3`): 4th `POST /api/auth/login` → 429. Case-variant bypass VERIFIED: `POST /api/auth/Login` with a valid session cookie → 200 at core (Express routing is case-insensitive, the limiter matches the exact lowercase path). Without a session cookie, case variants and trailing slashes get 401 at the gateway (VERIFIED), so the bypass needs an account.
- No `X-Forwarded-For` is added (VERIFIED V2: core saw `xff=-`), so core's per-request logs show the gateway's IP for every user; `app.set('trust proxy', 1)` in core (`backend/index.js:21`) only matters for clients that call core directly (and lets them spoof `req.ip`, which only affects logs).
- Logging: one request line per request, no status or latency; no error handler; no security headers (READ).
- Upstream failure: core down → 502 JSON (READ `index.js:55-60`; test "core down" passes, V1).

Which clients go through it: the React app. Every frontend API base defaults to `http://localhost:5000` = gateway port (READ: 16 files define `API_BASE_URL` defaulting to it, e.g. `frontend/src/context/AuthContext.jsx:4`; `ResetPassword.jsx:6` hardcodes it and `CreateJob.jsx:211` uses a literal URL; `AllCandidates.jsx:8` uses `import.meta.env.VITE_API_BASE_URL` in a CRA app — flagged to the frontend auditor). Because core no longer sends CORS headers (READ `backend/index.js`, no `cors`), a browser on :3000 **cannot** use core on :5001 directly with credentials; the gateway is therefore mandatory for the browser in practice (READ, inferred from CORS rules; not run in a browser).

Bypass: core listens on all interfaces at :5001 with no CORS and no rate limiting (READ `backend/index.js:80`); any non-browser client (curl, scripts, the test suite) can call every core route directly with a session cookie, skipping the gateway's limits. The Python services are not reachable through the gateway at all; they are called only by core (READ: `analysis.controller.js:325`, `assessment.controller.js:61`, `Services/githubEvidence.js:114`, `Services/assessmentService.js:18-22`). Their protection is binding to 127.0.0.1 (assessment-service enforces this in code; NLP and github-evidence only via the start command — READ `tests/assessment/test_internal_only.py:24-31`, `STEPS_TO_RUN_APP.md:75-88`); none has authentication.

Is core acting as orchestrator/gateway? **Yes, as orchestrator.** `POST /api/analyze` sequences NLP → Storage → `resumes` → github-evidence → `assessments` → scoring → `scores` (READ `analysis.controller.js:305-443`); `POST /api/assessment/generate` sequences Storage → NLP → `resumes` → github-evidence → assessment-service → `assessments`/`assessment_keys` (READ `assessment.controller.js:187-352`). Core is the only component with database credentials (READ: no Supabase client in the Python services, `grep -i supabase` hits only a skill keyword in `nlp-engine/app/ner.py:22`; frontend has no Supabase client). It also holds all sessions in process memory.

**Verdict:**
- `gateway/`: a **real, independently runnable service** (own manifest, own deps, starts on :5000, 8 offline tests pass in-process — V1). But it is a thin edge proxy for one upstream, not an API gateway over several microservices, and its auth depends on calling core.
- `backend/`: a **real, independently runnable service that is a monolith** ("core"): 29 routes across auth, jobs, applications, notifications, admin, storage, assessment orchestration and scoring, all DB access, in-memory sessions (cannot run two copies).
- The system is **"edge proxy → monolithic core → three stateless internal compute services"**, not microservices in the SRS sense (no per-service data ownership, no service reachable except through core, core is a single point of failure for auth, data and orchestration).

---

## 4. Outbound calls from the Node side

| # | Caller (file:line) | Target | Timeout / retry | Error handling → user-facing result |
|---|---|---|---|---|
| O1 | `analysis.controller.js:325` (`POST /api/analyze`) | NLP `NLP_PARSE_URL` multipart (`resume`, `jd`=job.description, `required_skills`, `preferred_skills`) | **none / none** (plain `node-fetch`) | non-2xx → 502 **echoing the raw upstream body** `FastAPI error: <status> <body>` (`:326-331`); unreachable → caught at `:444-446` → 500 with raw error text incl. the internal URL; hang → no response ever (ARCHITECTURE P-2 says no response in 20 s; not re-run). No fallback value. |
| O2 | `assessment.controller.js:61` (`generate`, on-demand parse) | NLP `/parse` | 60 s abort / none | throws → if a stale parse exists, **silently uses the stale parse** (`:143-145`, logged as warning); else 502 fixed message. |
| O3 | `Services/githubEvidence.js:114` via `internalHttp.postJson` (`:70-117`) | github-evidence `POST /v1/evidence` `{username, claimed_skills≤200, window_days:365}` | 8 s whole call (`GITHUB_EVIDENCE_TIMEOUT_MS`) / 1 retry on connection errors only | never throws; every failure → reason code → GitHub sub-score `available:false, value:null, weight:0` with a stated reason (`explainability.js:291-297`). No zero, no fabrication. Response 200. |
| O4 | `assessment.controller.js:258` (generate) | same as O3 | same | failure ignored (`include_github:false`). **Bug (READ):** `githubLink = resume?.contact?.github` (`:255`) but `resume` comes from a select without `contact` (`:119`) or from `parseStoredResume`, which returns no `contact` (`:72-78`). So the link is always null and **GitHub-based questions are never requested**. |
| O5 | `Services/assessmentService.js:18-19` | assessment-service `POST /generate-assessment` | 300 s / 1 retry on connection error | any InternalHttpError → 502 fixed message, upstream body never echoed (`assessmentService.js:31-37`); malformed payload → 502 (`assessment.controller.js:300-303`). |
| O6 | `Services/assessmentService.js:21-22` | assessment-service `POST /evaluate-assessment` | 120 s / same | 502 fixed message; grading claim released (`gradingClaim.js:43-50`). |
| O7 | everywhere (`supabase.from/.rpc/.storage`) | Supabase PostgREST/Storage, service-role key | **no timeout, no retry** (supabase-js defaults) | per handler: mostly 500 with the **raw Supabase error message in the JSON** (e.g. `analysis.controller.js:388,437,462,486,500,553`, `assessment.controller.js:209,232,335,395`, `jobs.controller.js:71,170`); auth middleware fails closed (401). Silent cases: notifications list → empty list (`notification.controller.js:32-35`); applicant emails → blank (`applicantIdentity.js:26-27`, logged); applicant score lookup error ignored → `credibilityScore:null` (`analysis.controller.js:569-576`); `getCandidateResume` storage list error ignored → 404 (`:228-238`); `pruneOldResumes` list error ignored; assessment lookup in analyze: a query error is **not** caught (supabase-js returns `{error}`; only throws are caught, `:402-415`) → silently treated as "no assessment"; score fold-in after evaluate failure only logged (`assessment.controller.js:509-518`). |
| O8 | `auth.controller.js:239,328,92,139,184-193` | Supabase Auth with anon key (shared lazy client; fresh client for reset) | none | errors mapped to 400/401/403; `resend`/`signup`/`reset` echo the Supabase error message (`:98,200,255`). |
| O9 | `auth.controller.js:133,305`, `signupProfile.js:33` | Supabase Auth admin API (service role) | none | login → 401; reset → swallowed; rollback failure logged. |
| O10 | `gateway/forwardAuth.js:38-48` | core `GET /api/auth/me` | 2 s / none | 503 `auth_unavailable` |
| O11 | `gateway/health.js:3-14` | core, NLP, github-evidence, assessment | 2 s each | boolean |

No Node code calls GitHub or an LLM provider directly (READ: only O3–O6 reach services that do). No `Math.random`, mock or default-score code on the Node side (READ: grep of `backend/` finds none). Fabrication risks are listed in §7.

---

## 5. Auth and authorisation, end to end

- **Mechanism (READ):** server-side Express session, not JWT. Login verifies the password with Supabase `signInWithPassword` and then **discards the Supabase tokens**; it stores `userId`, `email`, `role` in the session (`auth.controller.js:341-344`). No `Authorization` header is read anywhere. Sessions live in the default **MemoryStore**: a core restart logs everyone out; core cannot be scaled to two copies.
- **Role:** `profiles.role` (enum candidate/recruiter/admin) is copied to `req.session.role` at login and never re-read. A role change in the DB takes effect only at next login. Suspension is re-checked on every request (`auth.Middleware.js:15-36`).
- **Role assignment:** signup role from the request body, limited to candidate/recruiter in the backend (`auth.controller.js:7,219`) and in the DB trigger via `assert_signup_role` (migration `20261103120000`). **Anyone can self-register as a recruiter**; `verification_info`/company are stored but never checked. Admin = one manual SQL promotion; a partial unique index allows one admin (`20260831000100`).
- **Unprotected core routes:** the 6 auth POSTs (signup, login, logout, resend-confirmation, request-password-reset, reset-password) and `GET /api/health`. Everything else requires a session (READ §2.1). At the gateway, the same set is public (`public-routes.js:3-12`) and must be kept in sync by hand.
- **Service-role key:** the one shared client in `Config/supabase.js:54-62` is used for **every** DB, storage and RPC call, so **RLS never applies to the app's own traffic**; all authorisation is application code. The anon key is used only for Supabase Auth user flows. RLS policies only protect direct PostgREST access by someone who signs in to Supabase Auth themselves with their own credentials (the live tests do exactly this, `tests/backend/live-answer-key-access.test.mjs`).
- **Cross-user access, route by route (READ):**
  - Ownership correctly enforced: shortlist (`jobs.controller.js:196-208`), resume signed URL (`analysis.controller.js:214-226`), notifications read/mark (`notification.controller.js:23,48`), evaluate (`assessment.controller.js:397`), candidate-analysis (own id), applicants (own jobs).
  - **`GET /api/candidates` exposes candidates who never applied.** It lists every `scores` row for the recruiter's jobs (`analysis.controller.js:493-497`), and any candidate can create a score against any published job via `/api/analyze` without applying (`:305-310`, no application check). The recruiter then sees that candidate's parsed contact data (email, phone, GitHub, LinkedIn), skills, experience and education (`serializeCandidate`, `:79-129`). Whether this is intended is a product decision; it is not gated by an application.
  - Login and reset look up usernames with **`ilike`, where `_` is a single-character wildcard** (`auth.controller.js:129,283`). Usernames may contain `_` (`:8`). Consequence: a username like `a_b` also matches `aXb`; if both exist, `maybeSingle()` errors and login returns **503 "Authentication setup is incomplete"** for that user (`:286-290`); entering `%` as a username does the same. This is not an auth bypass (the password is still checked against the matched account's email), but it is a correctness and availability bug. READ only (no DB to verify).
  - Login without `req.session.regenerate()` (session fixation; low risk with SameSite=Lax and `saveUninitialized:false`). READ.
  - Suspended → 403 at login reveals that a username exists. READ `auth.controller.js:298-303`.
- **Answer-key exposure after submit:** evaluate returns `evaluation.results` to the candidate unchanged (`assessment.controller.js:526`); the MCQ feedback contains `Correct answer: X` plus the explanation (READ `assessment-service/app/evaluator.py:15-18`). With 5 attempts per job, each regenerated, the impact depends on how similar the regenerated questions are: UNKNOWN. Relevant to GR-1 (anti-cheating); the Node side has no time limit, no proctoring and no attempt-duration check (`created_at` stored, never compared). READ.

---

## 6. Data model (`supabase/`)

### 6.1 Migrations, in order (17 files; READ each)
| # | File | Creates / changes |
|---|---|---|
| 1 | `20260823000000_create_profiles.sql` | enum `patina_user_role`(candidate, recruiter); table `profiles`; unique index on `lower(username)`; fn `handle_new_user()` (security definer) + trigger `on_auth_user_created` on `auth.users`; fn `set_updated_at()` + trigger `profiles_set_updated_at`; RLS on; policy "Users can read their own profile" (select, authenticated) |
| 2 | `20260830000000_create_jobs_and_applications.sql` | enums `job_status`(draft, published, closed), `application_status`(submitted, under_review, shortlisted, rejected, withdrawn); tables `jobs`, `applications` (unique (candidate_id, job_id)); indexes; updated_at triggers; RLS on; policies: published jobs readable by anon+authenticated; recruiters manage own jobs (ALL); candidates read/insert own applications; recruiters read/update applications for own jobs |
| 3 | `20260831000000_add_single_admin_role.sql` | enum value `admin` |
| 4 | `20260831000100_add_single_admin_index.sql` | unique partial index `profiles_single_admin_role` (one admin) |
| 5 | `20260901000000_add_profile_suspension.sql` | `profiles.is_suspended`, `suspended_at`; index (role, is_suspended) |
| 6 | `20260903000000_create_notifications.sql` | table `notifications`; 3 indexes; RLS; policies: read own; recruiters insert for their applicants. No update policy. |
| 7 | `20260903000100_create_resumes_and_scores.sql` | storage bucket `resumes` (private); tables `resumes`, `scores`; indexes incl. (job_id, composite_score desc); RLS; policies: candidates read own resumes/scores; recruiters read resumes/scores whose `job_id` is one of their jobs |
| 8 | `20261015004738_create_assessments.sql` | table `assessments` (id supplied by service, `answer_key` NOT NULL, status check generated/completed); unique open index; unique completed index; RLS; candidates read own, recruiters read for own jobs |
| 9 | `20261015034725_allow_five_assessment_attempts.sql` | drops the unique completed index |
| 10 | `20261103120000_restrict_signup_role.sql` | fn `assert_signup_role(text)` (execute revoked from public/anon/authenticated, granted to service_role); `handle_new_user()` now uses it |
| 11 | `20261103120100_create_assessment_keys.sql` | table `assessment_keys` (RLS on, no policy, all revoked from anon/authenticated); copies keys; verifies count; `assessments.answer_key` made nullable |
| 12 | `20261103120200_assessment_grading_claim.sql` | `assessments.grading_started_at`; status check adds `grading`; open index now covers generated+grading; fn `claim_assessment_for_grading(uuid,uuid,interval)` (service_role only) |
| 13 | `20261103120300_drop_assessments_answer_key.sql` | re-copies missing keys, verifies, drops `assessments.answer_key` (header says apply only after owner backup) |
| 14 | `20261104120000_resumes_bucket_limits.sql` | bucket `resumes`: `file_size_limit` 10485760, MIME allow-list pdf+docx |
| 15 | `20261104120100_scores_subscores_comment.sql` | column comment on `scores.subscores` |
| 16 | `20261104120200_function_bodies_lf.sql` | re-creates 4 functions with LF bodies (no behaviour change) |
| 17 | `20261104120300_applicant_emails.sql` | fn `applicant_emails(uuid[])` reading `auth.users` (security definer, service_role only) |

VERIFIED (V1): `migration-guards.test.mjs` passes (unique 14-digit versions, enum-add isolation, bucket limit, comment, signup-role, assessment_keys, claim fn, applicant_emails grants, no CR, LF re-creation).

### 6.2 Objects and columns of note
- **Tables (8):** `profiles`(id→auth.users, username, first/last_name, role, phone, github_url, company_name, verification_info, onboarding_completed, is_suspended, suspended_at, timestamps), `jobs`(recruiter_id, title 2-160, description ≥20 chars, required_skills (≥1), preferred_skills, experience_level, location, status default **draft**), `applications`, `notifications`(user_id, type, message, read, data jsonb), `resumes`(candidate_id, job_id nullable, file_name, file_ref, raw_text_preview, contact jsonb, skills text[], experience/education/projects jsonb, project_links, parser_version), `scores`(resume_id, candidate_id, job_id, composite_score numeric(5,2), subscores, weights, explanation jsonb, evidence_limited), `assessments`(questions, answers, score numeric(5,2), evaluation, model_used, prompt_version, status, grading_started_at, completed_at), `assessment_keys`(assessment_id PK/FK, answer_key).
- **Views:** none. **Schemas/roles:** none created; everything in `public`.
- **Functions (5):** `handle_new_user`, `set_updated_at`, `assert_signup_role`, `claim_assessment_for_grading`, `applicant_emails`. **Triggers (4):** `on_auth_user_created`, `profiles_set_updated_at`, `jobs_set_updated_at`, `applications_set_updated_at`.
- **Storage:** one private bucket `resumes`; **no `storage.objects` RLS policies** in any migration (so only the service role can touch objects; fine for current code). READ.
- **RLS:** on for all 8 tables; policies as in §6.1.

### 6.3 Used vs defined (READ, grep of `backend/`)
- Every table is used by the code. RPCs used: `claim_assessment_for_grading` (`assessment.controller.js:408`), `applicant_emails` (`applicantIdentity.js:26`). `assert_signup_role` only via trigger and live tests.
- Defined but never written by the app: `profiles.phone`, `profiles.github_url` (signup never sends them, so always null though `/me` returns them), `profiles.onboarding_completed`; `profiles.verification_info` written, never read; `resumes.project_links` written, never read; `application_status` values `under_review`, `withdrawn` never set; `job_status` `closed`/`draft` never set by any route except via the unvalidated `status` body field of `POST /api/jobs`.
- **Schema drift:** none found between code and migrations at the column level (every column the code selects/inserts exists in some migration). The code **depends on migrations 11, 12 and 17 being applied**: without 11 the generate insert fails (answer_key NOT NULL / no `assessment_keys`); without 12 evaluate fails (no RPC, no `grading` status); without 17 emails are blank (logged). READ.
- **Applied state: UNKNOWN.** `supabase/.temp/linked-project.json` exists locally (gitignored), so the CLI was linked to a project, which proves nothing about applied versions. Comments in migrations 9, 14 and 16 *claim* live state; those are claims, not evidence. `supabase/config.toml` is local-dev config only (e.g. `enable_confirmations=false`, `minimum_password_length=6`); the hosted project's settings are UNKNOWN.

---

## 7. Scoring on the Node side

All composite scoring lives in core: `backend/Services/explainability.js`, called from `analysis.controller.js:417` (new score) and `assessment.controller.js:498` (rebuild). READ; unit tests VERIFIED passing (V1, 11 tests in `explainability.test.mjs`).

**Inputs:**
- P (parsing) = `round2(clamp01(semantic_analysis.similarity_score ?? 0) × 100)` (`explainability.js:165-168,268`). `similarity_score` is computed by nlp-engine (Python auditor's scope). `component_weights` fallback 0.6 skill coverage / 0.4 semantic if the service omits them (`:189-192`; display only).
- G (GitHub) = `round2(clamp01(sub_score.value) × 100)` when github-evidence returns a valid sub-score in [0,1] (`githubEvidence.js:84-94`, `explainability.js:417`); otherwise unavailable with a reason code.
- A (assessment) = `round2(clamp01(evaluation.score / 100) × 100)` when `evaluation.score` is finite (`:466-469,523`). Source: the latest completed `assessments.evaluation` for (candidate, job) at analyze time (`analysis.controller.js:401-415`), or the just-graded evaluation at evaluate time.

**Weights:** base `{parsing 0.40, github 0.35, assessment 0.25}` (`explainability.js:110-114`), overridable by env `CREDIBILITY_WEIGHTS` (read once at import, `:116-135`; not set in `backend/.env`, V4). For each *available* source, `w_i = round4(base_i / Σ_available base_j)`; unavailable sources get weight 0 (`:551-561`).

**Composite:** `round2(Σ_available value_i × w_i)` (`:563-564`), stored in `scores.composite_score` with `subscores`, `weights`, `explanation` (incl. `weighting_scheme.base_weights`), `evidence_limited` (= fewer than 3 sources available, `:718`). Explanation factors: direction raises/lowers if value differs from composite by >0.5 (`:656-662`). Inconsistency flags: always `flags_available:false` with a stated reason (`:630-652`).

**Persistence:** analyze inserts a new `scores` row each time; evaluate **updates the latest row in place** (`assessment.controller.js:499-508`), so the previous composite is lost (no history of the pre-assessment score). If evaluate runs before any analyze, no score row is touched; the assessment is folded in at the next analyze.

**Fabrication risks (rebuild forbids fabricated results):**
- If NLP returns no `semantic_analysis` or no `similarity_score`, the parsing sub-score is **`available:true` with value 0** (`:166-167`, `?? 0`, and `clamp01(Number(n)||0)` turns NaN into 0, `:137`). That is a fabricated zero carrying 40–100 % of the composite. READ.
- `getAllApplicants` returns **`skills: []` hardcoded** for every applicant (`analysis.controller.js:590`), which a UI would render as "no skills". READ.
- Notifications list returns an empty list on DB error (§4 O7). READ.
- `assessment_mcq` metric value 0 when there are no MCQs (`explainability.js:498`; display only).
- No GF-3 (support/maintenance fairness) adjustment exists in the Node scoring; the only lever is weight redistribution when GitHub is unavailable. READ.

---

## 8. Duplicated or contradicting implementations (READ)

1. **Two recruiter candidate lists from different sources of truth.** `GET /api/candidates` = from `scores` (includes non-applicants, excludes applicants who were never analysed, one row per candidate across all jobs, `analysis.controller.js:505-510`); `GET /api/recruiter/applicants` = from `applications` (+ per-row score lookup). Dashboard and JobDetails use the first, AllCandidates the second (grep of `frontend/src`). They can disagree on who the candidates are.
2. **Two résumé storage conventions in one bucket.** `/api/resume/upload`: `candidates/<uid>/resume.<ext>` (upsert, pruned). `/api/analyze`: `<uid>/<uuid>.<ext>` (append-only, never pruned) (`analysis.controller.js:157` vs `:339`). Apply, status and assessment only look at the first, so a candidate who only used analyze "has no résumé" for apply (`jobs.controller.js:107-123`).
3. **Two copies of NLP call + `resumes` insert**: `analysis.controller.js:319-383` (no timeout, echoes body) and `assessment.controller.js:46-110` (60 s timeout). `NLP_PARSE_URL` and `PARSER_VERSION='nlp-engine@1.0.0'` declared twice (`analysis:15-16`, `assessment:33-34`); the version is a hardcoded string, not reported by the service.
4. **Two "latest parsed résumé" semantics**: analyze writes a row per (candidate, job); generate reads the latest row for the candidate regardless of job (`assessment.controller.js:117-123`) and may write another row tagged with the assessment's job.
5. **Request-ID logic three times**: `gateway/requestId.js`, `backend/Middlewares/requestId.js`, `Services/internalHttp.js:17-21` (same regex). Core logs two lines per request (`index.js:42-45` + requestId).
6. **Auth checked twice**: gateway forward-auth (calls core `/me`) and core `requireAuth`; public-route list duplicated by hand (`gateway/public-routes.js` vs `backend/Routes/auth.routes.js`).
7. **Two health endpoints**: gateway `/health` (aggregates) and core `/api/health` (checks nothing).
8. **Env name mismatch for the same targets** (§1.3).
9. **Score of record for an assessment**: `assessments.score` and the `assessment_results` sub-score inside `scores.subscores`; the second is updated only on the latest score row for that job.
10. **Password minimum** duplicated (`auth.controller.js:11` constant and literal `8` at `:225`).
11. **Rate limiting** used to live in core (`auth.routes.js`, removed in `2442ad4`); the comment at `auth.controller.js:105-106` still says it is there.
12. Run docs: `STEPS_TO_RUN_APP.md` (gateway on 5000, core on 5001) vs `Docs/HOW_TO_RUN_AND_TEST.md:13` (backend on 5000, no gateway) vs `README.md:49,105,136` (Express on 5000).

---

## 9. Dead code and hardcoded values (READ; location and kind only)

Dead / unused:
- `cors` dependency in `backend/package.json:17` (not imported).
- `POST /api/jobs/applications/shortlist` has no frontend caller, so shortlisting, rejection and therefore all notifications are unreachable from the UI (only `jobs.controller.js:222-237` creates notifications).
- Startup banner listing 5 of 29 routes (`backend/index.js:84-86`); no-op try/catch in health (`:63-70`).
- `gateway/PLAN.md`, `gateway/SESSION_LOG(4-11-26).md`: working notes inside the service directory.
- Unused env names in `backend/.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (V4).
- `GITHUB_REASONS.service_disabled` text says the GitHub service "is not part of this deployment yet" (`explainability.js:88-89`); reachable only if `GITHUB_EVIDENCE_URL` is set to empty.

Credential-like values: hardcoded session secret fallback `backend/index.js:29` (used whenever `NODE_ENV` ≠ production and `SESSION_SECRET` unset). No keys or tokens hardcoded in Node code (READ grep). `supabase/.temp/*` (gitignored, local) identifies the linked project. `backend/.env` is not tracked (VERIFIED `git ls-files` shows no `.env`).

Hardcoded URLs/ports: `localhost:8000/parse` (`analysis:15`, `assessment:33`), `localhost:8001` (`githubEvidence.js:16`, `gateway/index.js:17`, `health.js:19`), `localhost:8002` (`assessmentService.js:9`, `gateway/index.js:18`, `health.js:20`), `localhost:5001` (`gateway/index.js:15`, `forwardAuth.js:5`, `health.js:17`), `localhost:3000` (`auth.controller.js:9`, `gateway/index.js:19`, `cors.js:4`), ports 5000/5001 defaults.

Hardcoded thresholds/limits: weights 0.40/0.35/0.25 (`explainability.js:110-114`); component weights 0.6/0.4 (`:189-192`); positive/negative cut 0.5 and 50 (`:220,234,347,491`); factor band ±0.5 (`:659-660`); `MAX_ATTEMPTS=5` (`assessment.controller.js:223`); grading stale 10 min (`:28`); generate 300 s / evaluate 120 s (`assessmentService.js:13-14`); NLP 60 s (`assessment.controller.js:64`); GitHub 8 s, 365 days, 200 skills (`githubEvidence.js:17-19`); résumé text cut 20 000 chars (`assessment.controller.js:164`); 10 MB upload (`Config/uploadLimits.js:4`); signed URL 60 s (`analysis.controller.js:243`); storage list limits 100/20; session 1 day (`index.js:36`); gateway limits 300/min, 20 and 5 per 15 min, 2 s auth/health timeouts.

---

## 10. Observability and security posture

| Area | State | Evidence |
|---|---|---|
| Health | core `/api/health` always `ok` (no DB/NLP check); gateway `/health` aggregates 4 services, 503 only if core down | READ `backend/index.js:63-70`, `gateway/health.js:22-33`; gateway test passes (V1) |
| Logging | `console.log` only; core: request-id line with status/ms/IP + a debug line; gateway: request line only; **usernames logged on every login attempt** (`auth.controller.js:278,294`); Supabase project URL/host logged at boot and on admin overview (`supabase.js:40`, `admin.controller.js:39`) | READ |
| Request IDs | generated/propagated core → github-evidence and assessment-service; **not** sent to NLP (plain fetch) | READ `internalHttp.js:74`, `analysis.controller.js:325` |
| Error handling | no error middleware in core or gateway; Express 5 default handler returns **HTML with stack traces** while `NODE_ENV` is unset (it is not in `backend/.env`, V4) — e.g. any malformed JSON body, or `loadProfile` throwing after sign-in (`auth.controller.js:341`). Many JSON errors echo raw Supabase/NLP messages (§4 O1, O7) | VERIFIED V3; READ |
| CORS | gateway only, exact origin `FRONTEND_URL` + credentials (`127.0.0.1:3000` would be refused); core none | READ `gateway/cors.js`; test passes (V1) |
| Input validation | hand-written per handler; UUID checks only on 3 params (`candidateId`, `applicationId`, `assessmentId`); `jobs` POST `status` unvalidated (DB enum rejects, raw message echoed); `admin` `userId` unvalidated; no length caps on job text/skills beyond DB checks; `express.json` 100 kb default | READ |
| File upload | multer memory storage, 10 MB (+1) cap with JSON 413; **type check by file extension only** (no magic bytes; client MIME ignored; storage content type derived from extension) | READ `resumeUpload.js:9-26`, `analysis.controller.js:23-38`; `upload-limits.test.mjs` passes (V1) |
| Rate limiting | gateway only, in-memory, per IP; 20 login+signup per 15 min **shared by everyone on one IP** (a demo laptop logging in as several roles can hit it); case-variant bypass with a session (V2); core has none | READ `gateway/limits.js`; VERIFIED V2 |
| Sessions/cookies | MemoryStore; httpOnly; SameSite=Lax; `secure` false outside production; no regenerate on login | READ `backend/index.js:27-38` |
| Security headers | none (no helmet; `X-Powered-By: Express` default on both) | READ |
| Secrets | service-role key only in core env; anon key never sent to browser; Python services hold their own keys; core logs the key *role* but not the key | READ |
| Timeouts | none on Supabase calls; none on analyze's NLP call; none on gateway proxy | READ |

---

## 11. Tests touching the Node side (names read; offline ones run in V1)

Offline (run by `tests/run-suite.ps1 -Suites backend`, current target; all **pass**, V1):
- `tests/backend/explainability.test.mjs` (11): weight redistribution, GitHub reasons never zero, GitHub sub-score, per-skill GitHub status, no false "no contradictions", 3-source combine, rebuild keeps stored GitHub, I-0065 stale-text rebuild, every factor has evidence.
- `tests/backend/github-evidence-client.test.mjs` (3 + subtests): link normalisation, every service outcome → reason code, request-id forwarded and no body leak (local stub).
- `tests/backend/assessment-service-client.test.mjs` (10): request id, 300/120 s timeouts, no upstream body leak, one retry on connection error, no retry on timeout, non-JSON → 502, URL read per call, controller has no direct service call.
- `tests/backend/grading-claim.test.mjs` (7): claim/grade/complete/release state machine with fakes.
- `tests/backend/applicant-identity.test.mjs` (5), `signup-profile.test.mjs` (6), `upload-limits.test.mjs` (4), `migration-guards.test.mjs` (13), `backend-cruft.test.mjs` (removed files, no bcrypt).
- `tests/gateway/auth-routing.test.mjs` (6): allowlist reaches core, others 401, only the session cookie forwarded, hung auth → fail closed, core down, request id. `tests/gateway/edge.test.mjs` (6): health aggregation, login limit, CORS, `/auth/me` unlimited, static build, 404 without build.

Need running services (not run by me):
- `tests/backend/smoke.test.mjs` (9 black-box route checks) and `assessment-generate.smoke.mjs` (2) against `BACKEND_BASE_URL` (default **:5000 = gateway**, `tests/backend/lib/env.mjs:29-30`); through the gateway, "401 without session" is answered by the gateway and proves nothing about core.
- `tests/backend/live-*.test.mjs` (13 files: analyze, analyze-github, analysis-isolation, answer-key-access, applicants, auth-failclosed, evaluate-once, evaluate-release, notifications-authz, resume-authz, shortlist-authz, signup-role, upload-gates) and `assessment-evaluate-live.test.mjs`: need `tests/.env` accounts; each `{ skip }`s without them. They write to the shared Supabase project.
- `tests/gateway/live-gateway.test.mjs` (2): needs gateway :5000 and core :5001.
- `tests/arch/nlp-outage-probe.mjs`: ARCHITECTURE probes P-1..P-6 (assumes backend on 5000, `:32`).
- **Harness mismatch (READ):** `tests/run-suite.ps1:54,60,103` starts core with no `PORT` and waits for `http://localhost:5000/api/health`, but core now defaults to 5001 and `backend/.env` has no `PORT` (V4). Unless the shell sets `PORT=5000`, `run-suite.ps1 -Suites backend` will time out waiting for health (or, if a gateway is already on 5000, test through it). Not run (instructed not to run the whole suite).
- No test covers: `/api/candidates` vs applicants disagreement, the `ilike` wildcard, `generate` GitHub-link bug, analyze NLP timeout, error-page leakage, notifications-on-error, the case-variant rate-limit bypass.

---

## Docs contradicted by code

- `ARCHITECTURE.md:37`, `:259-281` (§1.7), `:309-313` (§2): "no API gateway exists", "browser calls only Express (port 5000)". A gateway exists since `636314c` (2026-11-04) and core defaults to 5001 (`backend/index.js:22`).
- `ARCHITECTURE.md:89` (§1.2): backend port `PORT || 5000`. Now 5001.
- `ARCHITECTURE.md:256-257`: backend allows one CORS origin (`backend/index.js:23-28`). Core has no CORS; it is in `gateway/cors.js`.
- `ARCHITECTURE.md:167-168`, `:306`: rate limiter in `backend/Routes/auth.routes.js`. Removed in `2442ad4`; now `gateway/limits.js`.
- `ARCHITECTURE.md:74` (diagram): assessment calls are "raw fetch, no request id". They go through `postJson` with `X-Request-ID` (`Services/assessmentService.js:18-22`).
- `ARCHITECTURE.md:119`: `ASSESSMENT_SERVICE_URL` is in `backend/.env.example:15`. That file has 6 lines and no such name.
- `ARCHITECTURE.md:173,187-188` (§1.5): "six tables"; `resumes` and `scores` written by analyze only. There are 8 tables; `assessment.controller.js:81` inserts `resumes`, `:499-508` updates `scores`.
- `AUDIT.md:67`, `:212`: "Express backend 5000 ... Not a gateway / No API gateway exists".
- `CODE_MAP.md:163-164` (middleware order with cors), `:500` (bcrypt dependency; removed), `:518` (PORT default 5000).
- `README.md:49,105,136` and `Docs/HOW_TO_RUN_AND_TEST.md:13`: Express API on port 5000, no gateway step.
- `STEPS_TO_RUN_APP.md:31-37`: "gateway/.env". The gateway does not load any `.env` file.
- `tests/run-suite.ps1:15` "backend 5000 (HEAD hardcodes both)" and `tests/arch/nlp-outage-probe.mjs:32`. Core defaults to 5001.
- `gateway/README.md:3`, `gateway/package.json:5`: "standalone, offline tests". It is now the frontend's default API entry point.
- `backend/Controllers/auth.controller.js:105-106`: "rate-limited in auth.routes.js". It is not.
- `backend/Services/internalHttp.js:9-11`: claims core no longer echoes the NLP service's raw error text (I-0036). `analysis.controller.js:326-331` still does.

---

## Top risks for the rebuild (ordered by damage to a live demo, then to a correctness/security review)

1. **Start-up topology is fragile and the docs disagree.** The browser works only through the gateway on :5000 (core has no CORS); core must be on :5001; three run docs and the test harness give three different port stories (§Docs). A presenter who follows `HOW_TO_RUN_AND_TEST.md` or `run-suite.ps1` gets a dead UI or a failing suite. (§1, §3, §11)
2. **Recruiter views disagree about who the candidates are.** `/api/candidates` (dashboard, job details) is built from scores and includes candidates who never applied; `/api/recruiter/applicants` is built from applications, and apply never triggers scoring, so applicants show `credibilityScore: null` and `skills: []` unless they separately ran analyze. (§2.1 #14/#17/#18, §8.1, §7)
3. **The `/api/analyze` NLP call has no timeout and echoes raw upstream text.** If NLP is cold (15–45 s start) or hung, the request never returns; if it is down, the user sees a 500 with the internal URL. (§4 O1)
4. **Every authenticated request is fail-closed on a 2 s round trip through core and Supabase** (gateway forward-auth → core `/me` → 2 queries). On slow venue Wi-Fi, the whole app returns 503 `auth_unavailable`. Supabase calls have no timeouts anywhere. (§3, §4 O7/O10)
5. **Login rate limit 20 per 15 min per IP, shared by login and signup.** One demo laptop switching between candidate, recruiter and admin accounts (plus any smoke test) can lock itself out with 429. In-memory, so it clears only on a gateway restart. (§10)
6. **Fabricated or silent values in scoring paths:** a missing NLP `similarity_score` becomes an "available" parsing score of 0 weighted at 40–100 %; notifications show empty on DB error; applicant skills are always `[]`; analyze silently ignores an assessment-lookup error. (§7, §4 O7)
7. **Information leakage on errors.** With NODE_ENV unset, malformed JSON or an unhandled throw returns an HTML stack trace (VERIFIED V3). Many handlers return raw Supabase/NLP error text. Admin overview returns the Supabase project host. Usernames are logged on every login attempt. (§10)
8. **Authorisation rests entirely on app code with the service-role key** (RLS is bypassed for all app traffic). Specific gaps: recruiters see any candidate who analysed against their job without applying; anyone can self-register as a recruiter; roles are cached in the session; MCQ answer keys are returned after each of 5 attempts (GR-1). (§5)
9. **`ilike` username lookup**: `_`/`%` are wildcards, so some real usernames (allowed to contain `_`) can make login and reset fail with a misleading 503. (§5)
10. **Assessment generation ignores GitHub** because of the `contact` select bug (`assessment.controller.js:119` vs `:255`), and it depends on migrations 11/12 being applied, which is UNKNOWN. (§4 O4, §6.3)
