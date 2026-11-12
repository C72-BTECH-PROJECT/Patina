# Services inventory (top level)

Final Phase 1 auditor, 2026-11-12, `rebuild/fable` = `6da8d3f`. This file joins the three part files into one inventory and does not copy them:
- `[FE]` `services.frontend.md`
- `[BE]` `services.backend.md` (core, gateway, Supabase)
- `[PY]` `services.python.md`
- `[BL-nn]` `baseline.md`

Labels: VERIFIED (ran), READ (code), UNKNOWN.

## 1. Runtime components

| Component | Language / framework | Port (bind) | Entry point | Start command (VERIFIED in baseline) | Real independent service? | Part file |
|---|---|---|---|---|---|---|
| frontend | JS, React 19 on Create React App (`react-scripts 5.0.1`), Tailwind 3 | 3000 (0.0.0.0) | `frontend/src/index.js` → `App.jsx` | `frontend/`: `BROWSER=none npm start` ([BL-08]) | Client app, its own deployable. All API calls go to one origin (the gateway). | [FE §1], [FE §3] |
| gateway | Node 24, Express 5.2.1, http-proxy-middleware 3.0.5 | 5000 (all interfaces) | `gateway/index.js` | `gateway/`: `node index.js`, no env needed ([BL-07]) | Yes, a real process. But it is a **single-upstream edge proxy** (only `/api/*` → core). | [BE §1.3], [BE §2.2], [BE §3] |
| backend core | Node 24, Express 5 (ESM), express-session, supabase-js | 5001 (all interfaces) | `backend/index.js` | `backend/`: `node index.js` ([BL-06]) | Yes, but a **monolith**: 29 routes, all DB access, orchestration, MemoryStore sessions (only one instance can run). | [BE §1.2], [BE §2.1] |
| nlp-engine | Python 3.14, FastAPI + uvicorn, spaCy 3.8 (`en_core_web_sm`), sentence-transformers (MiniLM), pdfplumber, python-docx | 8000 (127.0.0.1 via CLI flag only) | `nlp-engine/app/main.py` | `nlp-engine/`: `PYTHONHASHSEED=0 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000` (~14 s, [BL-03]) | Yes. Stateless, no DB. Unpinned dependencies; root `.venv` cannot run it ([BL-02]). | [PY §1] |
| github-evidence | Python 3.14, FastAPI + httpx | 8001 (127.0.0.1 via CLI flag only) | `github-evidence/app/main.py` | `github-evidence/`: `venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001` ([BL-04]) | Yes. Stateless, versioned contract, pinned dependencies; the most complete service. | [PY §2] |
| assessment-service | Python 3.14, FastAPI + OpenAI SDK (Gemini OpenAI-compatible, OpenRouter fallback) | 8002 (127.0.0.1 default; `ASSESSMENT_HOST` overrides) | `assessment-service/app/__main__.py` | `assessment-service/`: `.venv\Scripts\python.exe -m app` ([BL-05]) | Yes. Stateless. **Not operational**: no LLM key, so every generate gives 502 ([BL-26], [BL-27]). | [PY §3] |

Not runtime components:
- **Supabase** is a hosted external dependency (Postgres + Auth + Storage), reached only by core ([BE §6]).
- The root `package.json` holds the Supabase CLI only.
- There is no compose file, Dockerfile or one-command start ([BE §1.1]).

## 2. Cross-service data flow

```
 browser (React :3000)
    |  REST + cookie patina_session   REACT_APP_API_BASE_URL (default http://localhost:5000)
    v
 gateway :5000 --(forward-auth GET /api/auth/me, 2 s)--> core
    |  proxy /api/* only, no timeout                       ^
    v                                                      |
 core :5001  --POST /parse (analyze: no timeout; assessment path: 60 s)--> nlp-engine :8000
    |        --POST /v1/evidence (8 s, 1 conn retry)--> github-evidence :8001 --HTTPS--> api.github.com
    |        --POST /generate-assessment (300 s) | /evaluate-assessment (120 s)--> assessment-service :8002 --HTTPS--> Gemini / OpenRouter
    +--supabase-js (service-role key, no timeout)--> Supabase (Postgres, Auth, Storage)
 browser --signed Storage URL (60 s)--> Supabase Storage   (recruiter résumé download only)
 gateway /health --2 s each--> core /api/health, nlp /, github-evidence /health, assessment /
```

| # | Caller → callee | Path | Env var (default) | Timeout / retry | Failure behaviour | Source |
|---|---|---|---|---|---|---|
| 1 | Browser → gateway | every `/api/*` | `REACT_APP_API_BASE_URL` (`http://localhost:5000`) in 14 files; literal in `ResetPassword.jsx:6` and `CreateJob.jsx:211`; `import.meta.env.VITE_API_BASE_URL` in `AllCandidates.jsx:8`, which compiles to the literal (VERIFIED by grep) | none / none | per page; several pages turn errors into empty lists | [FE §3] |
| 2 | Gateway → core (auth pre-check) | `GET /api/auth/me` with the session cookie only | `CORE_URL` (`http://localhost:5001`) | 2 s / none | 401 → 401 `{source:"gateway"}`; 403 passed through; other or timeout → 503 `auth_unavailable` | [BE §2.2] #5 |
| 3 | Gateway → core (proxy) | `/api/*` | `CORE_URL` | none / none | 502 `upstream_unavailable` | [BE §2.2] #6 |
| 4 | Gateway → all (health) | `/api/health`, `/`, `/health`, `/` | `CORE_URL`, `NLP_URL`, `GITHUB_EVIDENCE_URL`, `ASSESSMENT_URL` | 2 s each | 503 only if core is down; otherwise reachability booleans | [BE §2.2] #3 |
| 5 | Core → NLP (analyze) | `POST /parse` multipart | `NLP_PARSE_URL` (`http://localhost:8000/parse`) | **none** / none | non-2xx → 502 echoing the upstream body; unreachable → 500 with raw error; hang → no response | [BE §4] O1 |
| 6 | Core → NLP (assessment on-demand parse) | `POST /parse` | `NLP_PARSE_URL` | 60 s / none | stale parse used if one exists, else 502 | [BE §4] O2 |
| 7 | Core → github-evidence | `POST /v1/evidence` | `GITHUB_EVIDENCE_URL` (`http://localhost:8001`), `GITHUB_EVIDENCE_TIMEOUT_MS` (8000) | 8 s / 1 retry on connection error | never throws; reason code → sub-score unavailable | [BE §4] O3-O4 |
| 8 | Core → assessment-service | `POST /generate-assessment`, `/evaluate-assessment` | `ASSESSMENT_SERVICE_URL` (`http://localhost:8002`) | 300 s and 120 s / 1 retry on connection error | 502 fixed message, upstream body hidden | [BE §4] O5-O6 |
| 9 | Core → Supabase | PostgREST, Storage, Auth | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | none / none | mostly 500 with raw message; several silent defaults ([scope_vs_reality] §4 B5-B9) | [BE §4] O7-O9 |
| 10 | github-evidence → GitHub | REST `/users`, `/repos`, `/languages`, `/commits` | `GITHUB_TOKEN` (required), `GITHUB_API_URL`, `GITHUB_HTTP_TIMEOUT_S` (4), `GITHUB_DEADLINE_S` (6) | 4 s per request, 6 s total / 1 retry on 5xx or connection error | typed 4xx/5xx table; deadline mid-way → 200 `partial` | [PY §2.3]; READ `github-evidence/app/config.py:50-76` |
| 11 | assessment-service → LLM | OpenAI-compatible chat completions | `GEMINI_API_KEY`, `GEMINI_BASE_URL`, `GEMINI_MODELS`, `OPENROUTER_API_KEY`, `OPENROUTER_FREE_MODELS`, `ASSESSMENT_REQUEST_TIMEOUT_SECONDS` (60), `ASSESSMENT_MAX_RETRIES_PER_MODEL` (2) | 60 s per call, SDK `max_retries=0`; Gemini 1 try per model, OpenRouter 2 tries per model, up to 2 validation rounds | 502 with a summary; grading failure → silent 0 points | [PY §3.3]; READ `llm_client.py:31-36,78-83` |

**Timeout budget mismatch (READ, settled here).** With default config, one generate can spend about 2 × (60 + 2 × 2 × 60) s plus backoff, which exceeds 600 s. Core gives up at 300 s (`backend/Services/assessmentService.js:13`). Core then returns 502 while the service keeps calling paid or free-tier models.

### Inconsistencies between the part files (settled by reading code)

1. **`?unread=true` on notifications.**
   - [FE §3.4] row 22 says the query parameter is ignored.
   - The code honours it: `backend/Routes/notification.routes.js:8` and `backend/Controllers/notification.controller.js:26-28`. [BE §2.1] #25 is right.
2. **Logged-out `GET /api/auth/me`.**
   - [FE §3.1] says the gateway answers 401.
   - `gateway/forwardAuth.js:7` exempts that route from forward-auth, so core's `requireAuth` answers 401 (with core's body). [BE §2.2] is right. The outcome (401 → logged out) is the same.
3. **assessment-service loopback.**
   - [BE §3] says the service "enforces" 127.0.0.1 in code.
   - It is only a default: `assessment-service/app/config.py:43` lets `ASSESSMENT_HOST` override it. [PY §3.1] is right.
4. **Gateway offline test count.**
   - [BE §3] verdict says "8 offline tests".
   - The two files hold 6 + 6 = 12 ([BE §11]); [BL-18] ran 12/12.
5. **Frontend base-URL sites.**
   - [FE §3.2] counts 14 env + 2 literal + 1 Vite read; [BE §3] says "16 files define `API_BASE_URL`".
   - Both are right: 16 files define the constant (14 env, `ResetPassword.jsx` literal, `AllCandidates.jsx` Vite read), and `CreateJob.jsx:211` uses an inline literal. VERIFIED by grep.
6. **Resume text sent to the LLM.**
   - [BE §9] lists a "résumé text cut 20 000 chars".
   - [PY §3.3] shows the text is `raw_text_preview`, at most 300 chars (`nlp-engine/app/main.py:87`). It is read at `assessment.controller.js:129,145`, so the 20 000 cut at `:170` never binds. [PY] is right.
7. **Env names for the same downstream differ between the Node units:** `NLP_PARSE_URL` (core, includes `/parse`) vs `NLP_URL` (gateway, base only); `ASSESSMENT_SERVICE_URL` vs `ASSESSMENT_URL` ([BE §1.3]). Not a file disagreement, but a trap for the rebuild.

No disagreement on ports, callers or paths was left unsettled.

## 3. Microservices verdict against the SRS claim (GR-2)

- **Truly independent:** nlp-engine, github-evidence and assessment-service. Each has its own process, venv and HTTP contract, shares no code, and needs no database ([PY §1.6, 2.6, 3.6]; started alone in [BL-03] to [BL-05]). They are stateless compute services, not the SRS's DB-owning services ([scope_vs_reality] PS-057).
- **Monolith:** backend core. It holds auth, jobs, applications, notifications, admin, storage, assessment orchestration and composite scoring. It is the only holder of DB credentials, and it keeps sessions in process memory, so it cannot be scaled to two instances ([BE §3], [BE §5]).
- **What the gateway does:** CORS for one origin; in-memory per-IP rate limits; a deny-by-default session pre-check that calls core `/api/auth/me` (2 s, fail-closed 503); aggregated `/health`; proxying `/api/*` to core; optional static SPA ([BE §2.2]).
- **What the gateway does not do:**
  - It has no auth of its own and adds no `X-Forwarded-For`.
  - It routes to no Python service (`GET :5000/v1/evidence` → 404, [BL-07] notes).
  - It has no proxy timeout, no error handler and no security headers.
  - The rate limiter can be bypassed with case variants by a logged-in user ([BE §3], VERIFIED V2).
- **What can bypass it:**
  - Core on :5001 listens on all interfaces and answers directly ([BL-23]). It has no CORS, so a browser cannot use it with credentials, but any script can, and it has no rate limits.
  - The Python services have no authentication. They are protected only by binding 127.0.0.1, set by start flags (NLP, github-evidence) or a default (assessment).
- **Verdict:** the system is "edge proxy → monolithic core → three stateless internal compute services". The SRS claims "React → Node/Express API Gateway → three Python microservices, each with DB access, scaling independently" (PS-054..PS-057, PS-061). Independent scaling is not met, and neither is per-service data ownership. The gateway is real but covers one upstream. The fix half of GR-2 has not started ([scope_vs_reality] GR-2, move 10).

## 4. Duplicated or contradicting implementations, and dead code

Duplicated or contradicting, across services:
- **Recruiter "who are the candidates":** `/api/candidates` (score rows, includes non-applicants) vs `/api/recruiter/applicants` (application rows, mostly unscored). [FE §5] #1, [BE §8] #1.
- **Two NLP call-and-persist pipelines in core** (analyze vs assessment on-demand parse). They differ in timeout, in the `contact` return (which causes the GitHub-question bug) and in storage paths (`<uid>/<uuid>.<ext>` vs `candidates/<uid>/resume.<ext>`). [BE §8] #2-4, [PY §4] #3.
- **Skill vocabularies:** NLP `SKILL_KEYWORDS`/aliases vs github-evidence `_ALIASES`, with different canonical forms (`golang`, `r language`, `net`). [PY §4] #1.
- **GitHub-login parsing:** three parsers (NLP regex, core `normaliseGithubLogin`, service `_LOGIN`) and two identity sources (resume link, unused `profiles.github_url`). [PY §4] #2.
- **Parsing-score weights:** 0.60/0.40 in NLP and as a core fallback copy. The NLP-internal 0.65/0.35 is hidden. Weight-loading code is mirrored in core and github-evidence. [PY §4] #4-5.
- **Request-ID logic:** gateway, core middleware, `internalHttp.js`, and three Python copies. [BE §8] #5, [PY §4] #6.
- **Auth checked twice;** the public-route list is maintained by hand in two places. [BE §8] #6.
- **Health:** gateway `/health` (aggregate) vs core `/api/health` (checks nothing). assessment health says "healthy" without a key. [BE §8] #7, [PY §3.2].
- **Score of record for an assessment:** `assessments.score` vs the sub-score in the latest `scores` row. [BE §8] #9.
- **Score banding:** the frontend 80/60 colour bands (×5) are independent of NLP `match_level`. [FE §5] #7.
- **Frontend wiring:** 3 base-URL mechanisms and 4 credential mechanisms (including a global `fetch` monkey-patch). [FE §5] #5.
- **Run docs disagree on the core port:** README / HOW_TO_RUN / harness say 5000; STEPS / code say 5001. [BE §8] #12, [BL] §9.

Dead code (pointers):
- **Frontend** [FE §6]:
  - Never imported: `Card`, `Input`, `Logo`, `Skeleton`.
  - Unreachable: `Processing.jsx` (the only `/api/analyze` caller).
  - Unlinked: `Results.jsx`, `AllCandidates.jsx`.
  - Dead body: recruiter `Profile.jsx`.
  - Also ~20 unused CSS classes and the `@tailwindcss/vite` dependency.
- **Backend** [BE §9]:
  - The `cors` dependency.
  - The shortlist route, which has no UI caller, so all notifications are unreachable.
  - Unused `GOOGLE_*`/`GITHUB_CLIENT_*` env names.
  - Gateway working notes (`PLAN.md`, `SESSION_LOG`).
- **Python** [PY §5]:
  - `__main__` blocks referencing a missing sample.
  - `get_embedding` and the `noun_chunks` path.
  - Unused `python-dotenv` in NLP.
  - Unapplied `EvaluationResult` schemas.
  - The duplicate `PROMPT_VERSION`.
  - Certification-heading aliases that are never output.
  - A stale `ASSESSMENT_IMPLEMENTATION_PLAN.md`.

## 5. Where to find what

| Topic | Frontend | Backend / gateway / data | Python services |
|---|---|---|---|
| Commands the auditor ran | [FE §0] | [BE] header V1-V4 | [PY] header |
| Routes / endpoints | [FE §1.3] route table | [BE §2.1] core (29), [BE §2.2] gateway | [PY §1.2], [PY §2.2], [PY §3.2] |
| What each screen or endpoint really does | [FE §2] | [BE §2.1], [BE §7] scoring | [PY §1.3], [PY §2.3], [PY §3.3] |
| Outbound calls | [FE §3.4] call table | [BE §4] O1-O11 | per-service "Callers" columns |
| Auth and sessions | [FE §4] | [BE §5] | none (no auth on the services) |
| Data model, migrations, RLS | — | [BE §6] | — |
| Scoring and explainability | [FE §8] | [BE §7] | [PY §1.4], [PY §2.4], [PY §3.3] formula |
| Failure behaviour | [FE §9.4] | [BE §4], [BE §10] | [PY §1.5], [PY §2.5], [PY §3.5] |
| Anti-cheat (GR-1) | [FE §2.15] | [BE §5] last bullet | [PY §3.4] |
| Hardcoded values | [FE §7] | [BE §9] | [PY §5] |
| UI styling and broken flows | [FE §9] | — | — |
| Observability and security | — | [BE §10] | — |
| Tests | [FE §10] | [BE §11] | [PY §1.7], [PY §2.7], [PY §3.7] |
| Docs contradicted by code | [FE] end | [BE] end | [PY §6] |
| Top risks | [FE] end | [BE] end | [PY] end |
| Promise status, pipeline, fabricated outputs | → `scope_vs_reality.md` | | |
