# T-0022 — api-gateway

> Status: **Part 1 approved (owner, 2026-11-04). Part 2 draft, awaiting owner approval.** Written
> in T-0016, 2026-10-15.
> ROADMAP item P2-4 (ARCHITECTURE §5 M3; DEC-1 thin Node gateway, DEC-2 forward-auth, DEC-5
> github-evidence internal). Depends on P2-2 (T-0021). Sixth in the execution order. It also
> uses T-0020's request-ID hand-off into the scoring attempt (criterion 7).
> Size L: if it grows past two weeks, split routing/auth/limits from health/request-ID.
> **Split into Part 1 and Part 2 by the owner, 2026-11-04.** See "Split and assignments".

## Split and assignments (owner, 2026-11-04)

### Part 1: `gateway/` only, offline tests. Assigned now
**Status: approved (owner, 2026-11-04).**

Branch: `gateway/part1`. Part 1 changes nothing outside `gateway/` and `tests/gateway/`. It does
not wait for T-0021, because it needs no running core, NLP or frontend: tests use stubs from
`tests/backend/lib/stub-server.mjs`.

| Owner | Files | Criteria |
|---|---|---|
| Aaron | `gateway/package.json`, `package-lock.json`, `index.js`, `public-routes.js`, `forwardAuth.js`, `requestId.js`, `tests/gateway/auth-routing.test.mjs` | 3, 4, 6, 9, 15 |
| Aditya | `gateway/limits.js`, `cors.js`, `health.js`, `static.js`, `.env.example`, `README.md`, `tests/gateway/edge.test.mjs` | 5 (offline half), 8, 10, 13, 16, and the port checks (criterion 11, first bullet) |

**The test file is split.** The single `gateway.test.mjs` this spec first named is replaced by
`auth-routing.test.mjs` (criteria 3, 4, 6, 9, 15) and `edge.test.mjs` (criteria 5, 8, 10, 13, 16).
The criteria below use the new names. `limits.js`, `cors.js` and `static.js` are new files; the first draft kept
that code in `index.js`.

**Only the offline half of these criteria is in Part 1.** The rest needs core or a browser, so it
moves to Part 2:

| Criterion | Part 1 | Part 2 |
|---|---|---|
| 5 | "auth/me is never limited" (`edge.test.mjs`) | "auth/me is fast and never limited": 100 calls and the p95, against real core |
| 6 | "hung auth check fails closed" | "suspended user gets core's 403" (`live-gateway.test.mjs`) |
| 9 | Both gateway responses | Correcting ARCHITECTURE §5 M3 |
| 10 | "login limit", "password reset limit", second client IP | The two `git grep … -- backend` checks: they pass only once core's `cors()` and limiter are removed |
| 11 | `git grep -n "8001" -- gateway` and `"8002"`: every hit is that service's health-URL default (in `index.js`, and the same value in `.env.example` or `README.md`) | "no route to github-evidence" |
| 13 | "serves the build" | The owner's MANUAL_SMOKE run |

**Part 1 is checked by:** `npm ci` in `gateway/`, then
`node --test tests/gateway/auth-routing.test.mjs tests/gateway/edge.test.mjs`. The harness `gateway`
suite is Part 2.

**Shared boundary (set by the owner, not to be negotiated):**

`createApp(config)` in `gateway/index.js` returns the Express app without listening. Importing
`index.js` must not listen either: `listen` runs only when the file is run directly.
`index.js` also exports `loadConfig(env = process.env)`, which builds the config below. Tests call
`createApp({ ...loadConfig({}), CORE_URL: stub.url })`.

Each key's name is also its env name:

| Key and env name | Default | Used by |
|---|---|---|
| `PORT` | `5000` | `listen` |
| `CORE_URL` | `http://localhost:5001` | Proxy, forward-auth, health (`GET /api/health`) |
| `NLP_URL` | `http://localhost:8000` | Health only (`GET /`) |
| `GITHUB_EVIDENCE_URL` | `http://localhost:8001` | Health only (`GET /health`) |
| `ASSESSMENT_URL` | `http://localhost:8002` | Health only (`GET /`) |
| `FRONTEND_URL` | `http://localhost:3000` | CORS |
| `FRONTEND_BUILD_DIR` | Unset | Static build; unset means non-API paths return 404 |
| `GLOBAL_RATE_LIMIT_MAX` | `300` | Global per-IP limit |
| `GLOBAL_RATE_LIMIT_WINDOW_MS` | `60000` | Global per-IP limit |
| `AUTH_RATE_LIMIT_MAX` | `20` | Login and signup |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Login and signup |
| `PASSWORD_RESET_RATE_LIMIT_MAX` | `5` | Request-password-reset, its own limiter because it sends emails |
| `PASSWORD_RESET_RATE_LIMIT_WINDOW_MS` | `900000` | Request-password-reset |

`ASSESSMENT_URL` is the gateway's name. Core's own variable for the same service is
`ASSESSMENT_SERVICE_URL`. `.env.example` (Aditya) lists every key above.

Each of Aditya's modules exports one mount function, and `createApp` calls them:
`mountCors(app, config)` in `cors.js`, `mountHealth(app, config)` in `health.js`,
`mountLimits(app, config)` in `limits.js`, `mountStatic(app, config)` in `static.js`.

**Middleware order in `createApp`, fixed:**

| # | Step | From |
|---|---|---|
| 1 | requestId | `requestId.js` (Aaron) |
| 2 | CORS | `mountCors` (Aditya) |
| 3 | `/health` | `mountHealth` (Aditya) |
| 4 | Rate limits | `mountLimits` (Aditya) |
| 5 | Public-route check + forward-auth | `public-routes.js`, `forwardAuth.js` (Aaron) |
| 6 | `/api` proxy | `index.js` (Aaron) |
| 7 | Static | `mountStatic` (Aditya) |

No step before the proxy may parse a body. `mountLimits` exempts `/api/auth/me`. Step 5 lets
non-`/api` paths through to step 7.

**`cors.js` must pass `origin` as a function, not the `FRONTEND_URL` string:**
`origin: (origin, cb) => cb(null, origin === config.FRONTEND_URL)`. With a string, the `cors` package
sends that origin and the credentials header to every caller
(`backend/node_modules/cors/lib/index.js:47`, `:166`), which fails "cors allows only the frontend".
With the function, a non-matching request gets no CORS headers (`:220-221`), and its preflight
continues to step 5, where `OPTIONS` is public, so it never gets the gateway's 401.

**Where the two owners depend on each other:** criterion 3 checks `GET /health` and non-API `GET`
from Aaron's test file against Aditya's modules, and `edge.test.mjs` needs Aaron's `createApp`.

### Part 2: core and NLP changes, live tests, harness, docs
Owner: the project owner, with Aaron and Aditya. It stays after T-0021 and B3 (T-0031).

- Everything in Scope outside `gateway/` and the offline tests: Core, NLP, `live-gateway.test.mjs`,
  Harness, Docs.
- Criteria 1, 2, 7, 12 and 14, the second half of 11, and the Part 2 column above.
- Add assessment-service to ARCHITECTURE §5 M3's aggregated health.
- **After B3, `resolveRequestId` is no longer in `analysis.controller.js`:** T-0031 (f) moves it to
  `backend/Services/internalHttp.js`. Part 2 moves it from there to `backend/Middlewares/requestId.js`.

## Context
There is no API gateway (GR-2, ARCHITECTURE §1.7, §2). Express is both the browser's only entry
point and the application:
- port 5000, `backend/index.js:20`;
- CORS at `backend/index.js:22-27`;
- an in-memory per-IP limiter on password-reset requests, `backend/Routes/auth.routes.js:17-44`;
- no `trust proxy`.

The owner decided the shape:
- **DEC-1:** a thin Node gateway (Express 5 + http-proxy-middleware + express-rate-limit + cors).
- **DEC-2:** until token auth exists (M5/M6), the gateway checks the session by forward-auth to
  core's `GET /api/auth/me`, under five mandatory constraints and an explicit public allowlist
  (ARCHITECTURE §5 M3).
- **DEC-5:** github-evidence gets no gateway route.

After T-0021 the frontend calls relative `/api` URLs through CRA's proxy to `:5000`. Putting the
gateway on `:5000` and moving core to `:5001` therefore needs no frontend change.

What already exists:
- github-evidence already resolves, logs and echoes `X-Request-ID`
  (`github-evidence/app/main.py:144-161`) and has `GET /health` (`:172`).
- Core resolves a request ID only inside analyze (`backend/Controllers/analysis.controller.js:15-19`);
  T-0020 moves that into the scoring path.
- NLP logs no request ID and still has `allow_origins=["*"]` (`nlp-engine/app/main.py:19-24`,
  I-0034).

## Goal
A gateway on `:5000` becomes the single client entry point, in front of core on `:5001`:
- it routes requests and checks auth by forward-auth (fail closed, explicit allowlist);
- it owns rate limits and CORS;
- it assigns a request ID that every service logs;
- it reports aggregated health (`degraded` when NLP, github-evidence or assessment-service is down).

## Spec ref
- GR-2, NFR-3/NFR-11/NFR-12; ARCHITECTURE §4.2, §4.6, §5 M3, DEC-1, DEC-2, DEC-5; CHECKLIST
  GR-2, 0.1.
- ISSUES I-0034 (NLP CORS half), I-0035 (rate-limiter half), I-0036 (health half).

## Scope
**In:**
- New `gateway/`, with every dependency exactly pinned:
  - `package.json`: express 5, http-proxy-middleware 3, express-rate-limit, cors.
  - `index.js`: `createApp(config)` for in-process tests, plus `listen` when run directly.
  - **Routing:** `pathFilter` for `/api`, with no body parser registered before the proxy (or
    multipart uploads and login hang). A custom `on.error` returns
    `502 {"error":"upstream_unavailable","service":"core"}`.
  - **`public-routes.js`:** the explicit allowlist of ARCHITECTURE §5 M3, deny by default.
  - **`forwardAuth.js`:** DEC-2's constraints:
    1. only `Cookie: patina_session=<value>` is sent to `GET <CORE_URL>/api/auth/me`;
    2. `/me` is never rate-limited, and no cookie means 401 without calling core;
    3. strict mapping: 200 → proxy; 401 → `401 {"source":"gateway"}`; 403 passed through;
       anything else, an error or more than 2 s → `503 {"error":"auth_unavailable"}`;
    4. no caching;
    5. M6 replaces it.
  - **`requestId.js`:** accept `^[A-Za-z0-9-]{1,64}$`, otherwise generate a UUID; set it on the
    proxied request and the response; log it.
  - **Rate limits (`limits.js`):** `express-rate-limit`, keyed on the client IP, with limits from env. There is
    a limit on login and signup, a separate limiter on request-password-reset (it sends emails),
    and a global per-IP limit;
    `/api/auth/me` is exempt.
  - **CORS (`cors.js`):** only at the gateway, `FRONTEND_URL` with credentials.
  - **`health.js`:** `GET /health` checks core `/api/health`, NLP `GET /`, github-evidence
    `GET /health` and assessment-service `GET /` on `:8002`, each with a 2 s timeout:
    - `200 {"status":"ok","services":{…}}`;
    - `200 "degraded"` when NLP, github-evidence or assessment-service is down;
    - `503` when core is down.
  - **Static build (`static.js`):** serves `frontend/build` (static files plus SPA fallback) when
    `FRONTEND_BUILD_DIR` exists; otherwise non-API paths return 404.
  - `.env.example` and `README.md` (routes, env, the allowlist rule). The README says limits are
    per IP, so a shared campus network may need higher values for a demo.
- **Core:**
  - `backend/index.js`: `PORT` default 5001, `app.set('trust proxy', 1)`, `cors()` removed, and a
    request-ID middleware;
  - `resolveRequestId` moves from `analysis.controller.js` to a new
    `backend/Middlewares/requestId.js`, which logs `request_id`, method, path, status, ms and the
    client IP, and echoes the ID;
  - `/api/health` gains a cheap Supabase readiness query (2 s), returning 503 if it fails;
  - `backend/Routes/auth.routes.js`: the in-memory limiter is removed (the gateway owns it);
  - `backend/.env.example`.
- **NLP** (`nlp-engine/app/main.py`):
  - a request-ID middleware logs `request_id`, method, path, status and ms per request, and
    echoes the ID;
  - the CORS middleware is removed, since only core calls NLP (I-0034's CORS half);
  - `/docs` is untouched (P2-6).
- **github-evidence:** no change. Its request-ID logging is verified by criterion 7.
- **Tests:**
  - `tests/gateway/auth-routing.test.mjs` and `tests/gateway/edge.test.mjs` (offline, stub core,
    NLP and github-evidence from `tests/backend/lib/stub-server.mjs`);
  - `tests/gateway/live-gateway.test.mjs` (`-Live`, real core, NLP and github-evidence).
- **Harness:**
  - a new `gateway` suite in `run-suite.ps1`;
  - the backend suite starts core on 5001 and the gateway on 5000 (`BACKEND_BASE_URL` stays
    `:5000`);
  - `tests/backend/lib/env.mjs` gains `coreBaseUrl()`;
  - the probe starts the gateway and goes through it.
- **Docs:**
  - ARCHITECTURE as-is refresh: §0, §1.1, §1.2, §1.7, §2 (a gateway exists, with cites);
  - §5 M3's draft "core stopped → `/api/jobs` 502" is corrected (criterion 9);
  - AUDIT GR-2 and 0.1; ISSUES; `tests/README.md`; WORKLOG.

**Out:**
- Token verification at the gateway (P2-8, M6), and JWT auth (P2-7).
- Containers and compose (P2-6), so core's `:5001` is still reachable from the host until M4.
- An assessment-service route. It is internal and called only by core, the same rule as DEC-5.
  `/health` does check it (see `health.js`).
- More than one gateway instance (ARCHITECTURE §4.5: in-memory limiter store, one instance).
- `/docs` on NLP (P2-6).

## Files touched
- `gateway/{package.json,package-lock.json,index.js,public-routes.js,forwardAuth.js,requestId.js,limits.js,cors.js,health.js,static.js,.env.example,README.md}` (new)
- `backend/index.js`, `backend/Routes/auth.routes.js`, `backend/Middlewares/requestId.js` (new), `backend/Controllers/analysis.controller.js` (import moved), `backend/Services/scoring.js` (uses the shared helper), `backend/.env.example`
- `nlp-engine/app/main.py`
- `tests/gateway/auth-routing.test.mjs` (new), `tests/gateway/edge.test.mjs` (new), `tests/gateway/live-gateway.test.mjs` (new), `tests/run-suite.ps1`, `tests/backend/lib/env.mjs`, `tests/arch/nlp-outage-probe.mjs`, `tests/README.md`
- `ARCHITECTURE.md`, `AUDIT.md`, `ISSUES.md`, `WORKLOG.md`

## Moves
| Id | From → to | Why |
|---|---|---|
| GR-2 | PART → PART (evidence) | A named gateway is the single entry point: 401 at the gateway, request ID across services. AUDIT's promote rule also needs `docker compose up` healthy (M4, P2-6) |
| 0.1 Microservices architecture | PART → PART (evidence) | Gateway in front of core; 2 of 3 Python services |
| I-0034 | note | NLP CORS removed; auth and `/docs` stay with P2-6 |
| I-0035 | note | The rate limiter moved to the gateway; sessions stay until P2-7 |
| I-0036 | OPEN → RESOLVED | Its last half, health blind to dependencies, is done (with T-0018) |

## Acceptance criteria
1. **The harness passes behind the gateway.** `tests/run-suite.ps1 -Target current -Live` →
   every suite 0 (the frontend build ≤ the 5 known warnings), with core on `:5001` and the
   gateway on `:5000`. Core's log shows the client address (`::1` or `127.0.0.1`), not the
   gateway's own socket address. Checked by: the harness log, plus a core log excerpt in Result.
2. **401 at the gateway.** Checked by `live-gateway.test.mjs` "unauthenticated protected route
   stops at the gateway":
   - `GET /api/jobs` with no cookie → `401 {"source":"gateway"}`, and core's log has no line for
     it;
   - with an unknown `patina_session` → 401 from the gateway, after exactly one
     `GET /api/auth/me` in core's log and no `GET /api/jobs`.
3. **Allowlist, deny by default.** Checked by `auth-routing.test.mjs` "allowlist entries reach core"
   and "everything else needs a session":
   - each allowlist entry (`POST` signup, login, logout, resend-confirmation,
     request-password-reset, reset-password; `GET /api/health`; `GET /health`; non-API `GET`;
     `OPTIONS`), called with no cookie, gets the upstream's answer, never the gateway's 401;
   - every protected route listed in ARCHITECTURE §5 M3, and `GET /api/nope`, gets
     `401 {"source":"gateway"}` with no cookie.
4. **Only the session cookie is forwarded.** A protected request carrying three cookies, an
   `Authorization` header and `X-Request-ID` produces a check request whose only client-derived
   header is `Cookie: patina_session=…`. Checked by: `auth-routing.test.mjs` "forward-auth sends only
   the session cookie" (stub core records headers).
5. **`/me` is fast and unlimited.** Offline half (Part 1): `edge.test.mjs` "auth/me is never
   limited": after the global per-IP limit is used up on other routes, `GET /api/auth/me` never
   returns 429. Live half (Part 2): `live-gateway.test.mjs` "auth/me is fast and never limited":
   - 100 calls to `GET /api/auth/me` with no or an unknown session → all 401, p95 under 50 ms;
   - after the global per-IP limit is exhausted on other routes, `/me` still never returns 429.
6. **Fails closed.** Checked by `auth-routing.test.mjs` "hung auth check fails closed" and
   `live-gateway.test.mjs` "suspended user gets core's 403":
   - the stub core's `/me` hangs → the protected request gets `503 {"error":"auth_unavailable"}`
     within 2.5 s, and the stub saw no proxied request;
   - a suspended user (`t0001_` test account, restored afterwards) gets core's 403.
7. **One request ID through every service.** Checked by `live-gateway.test.mjs` "request id
   reaches every service log":
   - an apply sent with `X-Request-ID: t0022-<random>` comes back with the same ID on the
     response;
   - the ID appears in the gateway log, the core log (the apply and its immediate scoring
     attempt, T-0020), the NLP log (`/parse`) and the github-evidence log (`/v1/evidence`; the
     service runs with a dummy token and a local GitHub stub, as in probe P-6);
   - an invalid ID (`bad id!`) is replaced by a UUID;
   - the forward-auth check carries no request ID. This is the documented exception
     (DEC-2 constraint 1).
8. **Aggregated health.** Checked by `edge.test.mjs` "health aggregates core, nlp,
   github-evidence and assessment-service":
   - all up → `200 {"status":"ok"}` with each service `up`;
   - NLP down → `200 "degraded"`;
   - github-evidence down → `200 "degraded"`;
   - assessment-service down → `200 "degraded"`;
   - core down → 503;
   - a hung dependency is reported `down` within 2.5 s.
9. **Core down.** Checked by `auth-routing.test.mjs` "core down":
   - a public route (`POST /api/auth/login`) → `502 {"error":"upstream_unavailable","service":"core"}`;
   - a protected route *with* a cookie → `503 {"error":"auth_unavailable"}`, because the
     forward-auth check cannot reach core and fails closed.

   This corrects ARCHITECTURE §5 M3's draft criterion "core stopped → `/api/jobs` returns 502",
   which cannot hold under DEC-2. ARCHITECTURE is updated to match.
10. **Rate limits in one hop.**
    - Login → 429 at limit + 1 from one client, with the limit set by env
      (`edge.test.mjs` "login limit").
    - Request-password-reset → 429 at its own limit + 1, and using up that limit does not block
      login (`edge.test.mjs` "password reset limit").
    - A second client IP is unaffected: the gateway listens on `127.0.0.1` and `::1`, and the
      test uses both.
    - `git grep -n "cors(" -- backend` → 0.
    - `git grep -n "passwordResetRequestLimiter" -- backend` → 0.

    Checked by: the test and the commands.
11. **github-evidence stays internal (DEC-5).**
    - `git grep -n "8001" -- gateway` → only the health-URL default.
    - `git grep -n "8002" -- gateway` → only the health-URL default (assessment-service gets no route).
    - `GET /v1/evidence` through the gateway with a valid session reaches core and gets core's
      404.

    Checked by: the command and `live-gateway.test.mjs` "no route to github-evidence".
12. **NLP CORS gone.** `git grep -n "allow_origins" -- nlp-engine/app` → 0, and the nlp suite
    is green. Checked by: the command and the harness.
13. **Frontend through the gateway.**
    - With `FRONTEND_BUILD_DIR` set to a temp dir holding `index.html` and `static/x.js`:
      `GET /` and `GET /candidate/jobs` return `index.html`, `GET /static/x.js` returns the
      file, and none of these needs a session (`edge.test.mjs` "serves the build").
    - The owner runs MANUAL_SMOKE B and C through `npm start` (the CRA proxy to `:5000`, now the
      gateway).

    Checked by: `edge.test.mjs` "serves the build", plus the owner's smoke run recorded in
    Result.
14. **Trackers.**
    - ARCHITECTURE's as-is describes the gateway with cites, and its §0 answer is updated.
    - AUDIT GR-2 and 0.1 cite the gateway and the tests.
    - I-0036 is resolved; I-0034 and I-0035 have notes.

    Checked by: `node tests/docs/check-trackers.mjs` → exit 0, 0 warnings.
15. **Request ID kept, replaced or echoed.** Checked by `auth-routing.test.mjs` "request id is kept,
    replaced or echoed":
    - a valid `X-Request-ID` reaches the stub core and comes back unchanged;
    - `bad id!` is replaced by a UUID;
    - with none, a UUID is generated.
16. **CORS allows only the frontend.** Checked by `edge.test.mjs` "cors allows only the frontend":
    - the `FRONTEND_URL` origin gets `Access-Control-Allow-Origin` plus credentials;
    - any other origin gets no CORS headers;
    - a preflight `OPTIONS` never gets the gateway's 401.

## Test plan
- **Write first:** `auth-routing.test.mjs` (criteria 3, 4, 6, 9, 15), `edge.test.mjs` (criteria 5,
  8, 10, 13, 16) and, in Part 2, `live-gateway.test.mjs` (criteria 2, 5, 6, 7, 11).
- **Red run** (`tests/.out/t0022-red.log`):
  - `auth-routing.test.mjs` and `edge.test.mjs` fail to import `gateway/index.js` (no module);
  - `live-gateway.test.mjs` against HEAD: `GET /api/jobs` with no cookie → core's 401 without
    `source: "gateway"`; `/health` → 404; no request ID in the NLP log; NLP still sends
    `Access-Control-Allow-Origin: *`.
- **Green:** `tests/.out/t0022-green.log`, the full harness, then the probe through the gateway
  (`node tests/arch/nlp-outage-probe.mjs` → exit 0).
- **Cannot be automated:** criterion 13's browser half, because CRA's dev proxy and cookies need a
  real browser.

## Regression
- Every existing live test passes unchanged through the gateway. They keep using
  `BACKEND_BASE_URL` (`:5000`), and session cookies pass through. T-0006's fail-closed and
  T-0004's authz tests matter most, because core's own `requireAuth` / `requireRole` must still
  run behind the gateway.
- Probe P-1..P-6 (as rewritten by T-0018 and T-0020) still pass through the gateway.
- `node tests/backend/sweep.mjs --check` → 0, and ports 5000, 5001, 8000 and 8001 are free after
  the run.

## Risks and rollback
- **Risk:** a body parser or proxy misconfiguration hangs multipart uploads or login. Mitigation:
  no body parser before the proxy (ARCHITECTURE §4.2), and the harness covers upload and login.
- **Risk:** a forgotten public route becomes 401.
  - Mitigation: the allowlist is derived from the routes that carry no auth middleware, and
    criterion 3 tests each entry.
  - Adding a public route to core means editing `gateway/public-routes.js` in the same change
    (`gateway/README.md` rule).
- **Risk:** `trust proxy` lets a client spoof `X-Forwarded-For` when calling core directly.
  - Accepted until M4, when core's port stops being published.
  - Core's `trust proxy` is `1` (one hop), and the gateway overwrites the header.
- **Rollback:** stop the gateway and run core on `:5000` (`PORT=5000`). Core's CORS and limiter
  removal are reverted together with the gateway change.

---

## Result
<Filled at the end. One line per acceptance criterion.>
