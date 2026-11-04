# Issues

**Purpose:** a record of problems found during a session that were **not**
that session's task. Nothing gets fixed silently out of scope — if you spot
something wrong while working on something else, it goes here, not into the
diff you're already writing.

**Rules:**
- Severity: **P0** = blocks demo or security, **P1** = wrong behaviour,
  **P2** = tech debt, **P3** = cosmetic.
- Status: `OPEN` / `IN-PROGRESS T-NNNN` / `RESOLVED T-NNNN + evidence` /
  `WONTFIX + reason`.
- Resolved entries move to the **Resolved** section at the bottom — never
  deleted.
- `RESOLVED` requires evidence (file:line, command output, commit). If an
  entry can't be re-checked against current code, leave it `OPEN` and write
  "not re-verified" rather than guessing.

---

## Open

| ID | Title | Module | Severity | Status | Found |
|----|-------|--------|----------|--------|-------|
| I-0004 | AI-cruft / hallucinated entries in `SKILL_KEYWORDS` | `nlp-engine/app/ner.py` | P3 | OPEN | pre-WORKLOG (after an NLP fix, exact date not recorded) |
| I-0006 | Upload.jsx: neither Choose-File nor drag-drop validates file type on selection, only at submit | `frontend/src/pages/candidate/Upload.jsx` | P2 | OPEN | 2026-10-12, L-0001 |
| I-0012 | HEAD frontend reads `import.meta.env.VITE_*` under CRA; 5 pages hardcode `localhost:5000` | `frontend/src/**` | P1 | OPEN | 2026-10-12, T-0001 |
| I-0026 | Landing page's hardcoded demo score and "10000+ verified" stats read as real data | `frontend/src/pages/public/Landing.jsx` | P3 | OPEN | 2026-10-12, T-0002 |
| I-0030 | `CODE_MAP.md` describes the pre-T-0003 flow (Upload -> `/api/analyze`); no mention of upload/apply/applicants routes | `CODE_MAP.md` | P2 | OPEN | 2026-10-12, T-0008 |
| I-0031 | `REVIEW_BRIEF.md` rests on CODE_MAP/old AUDIT claims and predates the upload-once/apply flow | `REVIEW_BRIEF.md` | P2 | OPEN | 2026-10-12, T-0008 |
| I-0032 | `README.md` says tables are pending and jobs are in-memory (both false); API and env tables incomplete | `README.md` | P2 | OPEN | 2026-10-12, T-0008 |
| I-0033 | `PROJECT_SOURCE_DOCS.md` names MongoDB as the data layer; the code uses Supabase | `PROJECT_SOURCE_DOCS.md` | P3 | OPEN | 2026-10-12, T-0008 |
| I-0034 | NLP service is unauthenticated, allows every CORS origin and exposes `/docs`; analyze forwards any file type to it | `nlp-engine/app/main.py`, `backend/Controllers/analysis.controller.js` | P2 | OPEN | 2026-10-12, T-0009 |
| I-0035 | Core can run only as one process: sessions in the in-process MemoryStore, in-memory rate limiter, no session regeneration at login | `backend/index.js`, `backend/Routes/auth.routes.js`, `backend/Controllers/auth.controller.js` | P2 | OPEN | 2026-10-12, T-0009 |
| I-0036 | NLP outage handling: 500 with raw error text, 502 echoes the upstream body, no timeout or retry, health blind to dependencies | `backend/Controllers/analysis.controller.js`, `backend/index.js` | P2 | OPEN | 2026-10-12, T-0009 |
| I-0037 | NLP `/parse` is `async def` but CPU-bound: parses run one at a time and block `GET /` | `nlp-engine/app/main.py` | P2 | OPEN | 2026-10-12, T-0009 |
| I-0038 | Unpinned `requirements.txt`; three Python venvs, one without the spaCy model; Python 3.14 vs README 3.11 | `nlp-engine/requirements.txt`, `README.md` | P2 | OPEN | 2026-10-12, T-0009 |
| I-0039 | Backend cruft: unused `bcrypt`, two empty middleware files, unused OAuth env vars, empty `backend/uploads/`, tracked `dev/null` | `backend/`, `dev/` | P3 | OPEN | 2026-10-12, T-0009 |
| I-0040 | Recruiter "GitHub profile" link is relative when the parsed link has no scheme | `frontend/src/components/recruiter/CandidateModal.jsx` | P3 | OPEN | 2026-10-14, T-0010 |
| I-0042 | Docs checker silently skips cites to `.yml`/`.yaml`/`.toml`/`.ts` files and paths with spaces | `tests/docs/check-trackers.mjs` | P3 | OPEN | 2026-10-14, T-0010 |
| I-0043 | ROADMAP P1-3 says the GitHub "full path" is captured; T-0013 returns the profile (repo owner) only | `ROADMAP.md` | P3 | OPEN | 2026-10-15, T-0013 |
| I-0044 | ROADMAP §1.6 names `pytest-socket --disable-socket`; T-0011 uses `--allow-hosts=127.0.0.1,::1` | `ROADMAP.md` | P3 | OPEN | 2026-10-15, T-0011 |
| I-0045 | T-0012, T-0014 and T-0015 cite "ROADMAP §1.2" for the contract, env vars and timeouts; the service contract moved to `github-evidence/README.md` | `tasks/T-0012-github-evidence-metrics.md`, `tasks/T-0014-core-github-integration.md`, `tasks/T-0015-github-outage-probe.md` | P3 | OPEN | 2026-10-15, T-0011 |
| I-0046 | Starlette's `TestClient` warns that using it with `httpx` is deprecated ("install `httpx2` instead") | `github-evidence/requirements-dev.txt` | P3 | OPEN | 2026-10-15, T-0011 |
| I-0048 | An inactive account with corroborated claims scores 0.30 from corroboration alone; commit counts trust author-set dates | `github-evidence/app/scoring.py` | P2 | OPEN | 2026-10-15, T-0012 |
| I-0050 | Probe labels its login row "P-1 NLP down" even when phase 1 is not selected | `tests/arch/nlp-outage-probe.mjs` | P3 | OPEN | 2026-10-15, T-0015 |
| I-0052 | A résumé whose GitHub link is only a hyperlink annotation behind the text "GitHub" gets `no_github_link`: the NLP text extraction does not read PDF link annotations | `nlp-engine/app` (extraction), `backend/Controllers/analysis.controller.js` | P1 | OPEN | 2026-10-15, T-0014 manual check |
| I-0053 | Recruiter's per-job list drops a candidate whose latest score is for another job | `backend/Controllers/analysis.controller.js`, `frontend/src/pages/recruiter/JobDetails.jsx` | P2 | OPEN | 2026-10-15, T-0016 |
| I-0054 | Recruiter Jobs page always shows "0 Applications Total" | `frontend/src/pages/recruiter/Jobs.jsx` | P3 | OPEN | 2026-10-15, T-0016 |
| I-0064 | WORKLOG.md is past its ~400-line archive threshold (451 lines after T-0023) | `WORKLOG.md` | P3 | OPEN | 2026-10-31, T-0023 |
| I-0067 | Short-answer grading prompt embeds candidate text with no untrusted-input rule, and grading output is not schema-checked: a crafted answer can steer its own grade | `assessment-service/app/prompts.py`, `assessment-service/app/evaluator.py` | P1 | OPEN | 2026-10-31, T-0023 |
| I-0068 | Frontend CI build fails on 4 more lint warnings from `main` (CandidateLayout, RecruiterLayout, AllCandidates ×2), on top of the 5 known; `AllCandidates.jsx` reads `import.meta.env` under CRA (I-0012 pattern) | `frontend/src/**` | P2 | OPEN | 2026-10-31, T-0023 |
| I-0074 | Repeating a shortlist or reject decision sends the candidate a duplicate notification | `backend/Controllers/jobs.controller.js` | P3 | OPEN | 2026-11-04, T-0031 |
| I-0076 | A multipart body busboy cannot parse (truncated, or no boundary) gives a 500 HTML page on both upload routes | `backend/Middlewares/resumeUpload.js`, `backend/index.js` | P3 | OPEN | 2026-11-04, T-0031 |
| I-0077 | `run-suite.ps1` silently tests whatever already answers on :5000 when its own backend cannot bind the port | `tests/run-suite.ps1` | P2 | OPEN | 2026-11-04, T-0031 |
| I-0078 | Résumé uploads are checked by file extension only: a text file named `.pdf` passes the gate | `backend/Controllers/analysis.controller.js` | P2 | OPEN | 2026-11-04, T-0031 |
| I-0080 | Merge `48707d2` landed T-0022 Part 2 core and NLP changes and unspecified assessment work outside approved scope | `backend/`, `nlp-engine/app/main.py`, `assessment-service/app/` | P1 | OPEN | 2026-11-05, T-0033 |
| I-0081 | Outage probe assumes the backend is on :5000; since `48707d2` core defaults to :5001 | `tests/arch/nlp-outage-probe.mjs` | P2 | OPEN | 2026-11-05, T-0033 |
| I-0082 | Frontend API base still targets :5000 with no CRA proxy, so the UI needs the gateway running, and `gateway/` is not installed here | `frontend/src/**`, `frontend/.env`, `frontend/package.json`, `gateway/` | P2 | OPEN | 2026-11-05, T-0033 |
| I-0083 | Docs, `.env` instructions and test defaults still say core is on :5000; two trackers now state it as fact | `README.md`, `ARCHITECTURE.md`, `AUDIT.md`, `Docs/`, `tests/` | P2 | OPEN | 2026-11-05, T-0033 |
| I-0084 | `tests/.env.example` gained a credential-shaped `Password = pass123` and lines that are not valid dotenv | `tests/.env.example` | P2 | OPEN | 2026-11-05, T-0033 |

---

### I-0004 — AI-cruft / hallucinated entries in `SKILL_KEYWORDS`
**Status:** OPEN — partly fixed (re-verified T-0028 at `df98068`): the duplicate "typescript" is gone (`nlp-engine/app/ner.py:14`); "exponentjs" (`:59`), "r language" (`:16`) and "mern stack" (`:34`) remain. Planned in ROADMAP P3-2 (moved from B3 in T-0028), spec T-0032.
**Severity:** P3
**Module:** `nlp-engine/app/ner.py` (lines 6-54, `SKILL_KEYWORDS`)
**Spec ref:** n/a (data-quality cleanup, not a feature)
**Evidence:**
- `ner.py:53` — `"typescript", "exponentjs",` — "exponentjs" is not a real
  library/package; likely a hallucinated/garbled entry (both "expo" and
  "express" are already separately listed at lines 39 and 13).
- Other odd entries noticed nearby: `"r language"` (line 10, unusual phrasing
  vs. just `"r"`), `"mern stack"` (line 28) duplicated again as
  `"mern concepts"` in the same file's `non_organisation_terms` set (line
  122).
**Impact:** Low — these are unlikely to match real resume text, so the
practical scoring effect is small, but it's noise in a keyword list that
should be an auditable source of truth for skill matching.
**Proposed fix:** Audit `SKILL_KEYWORDS` for fabricated/duplicate entries and
remove them.
**Note (2026-10-12, T-0002):**
- **Line numbers are current again:** at HEAD the pre-baseline parser is back (I-0011), so the lines cited above match.
- **Duplicate "typescript" is back:** HEAD lists it twice (`ner.py:8`, `:53`). `32905c1` had removed it.
- **Visible in output:** a real resume's skills come out with `typescript` twice (INTEGRATION_REVIEW.md §3.3, private#3).

---

### I-0006 — Upload.jsx: neither path validates file type until submit
**Status:** OPEN
**Severity:** P2
**Module:** `frontend/src/pages/candidate/Upload.jsx` (lines 129-147)
**Spec ref:** n/a (regression found while re-verifying I-0003, below)
**Evidence:** `handleDrop` (129-134) and `handleFileChange` (136-139) both
just call `setFile(...)` with no validation. Type checking only happens
later, inside `handleUpload` via `isResumeFile(file)` (18-26, invoked at
144) — applied identically regardless of which path supplied the file.
**Impact:** Low-moderate — an invalid file can sit in the UI as "selected"
before being rejected at submit time, which is a UX gap but not a security
issue (validation does still happen before any upload call is made).
**Proposed fix:** Call `isResumeFile` immediately in both `handleDrop` and
`handleFileChange` and reject/clear invalid files at selection time.
**Note:** this supersedes the old entry about this file (see
[Resolved I-0002/I-0003](#i-0002--skillsselector-hardcoded-never-wired-resolved)) —
`Upload.jsx` was rewritten (commit `71c632d`, 2026-09-03) into a different
flow where the original asymmetric-validation bug no longer exists, but this
new, related gap was found in its place.

---

### I-0012 — HEAD frontend reads `import.meta.env` under CRA; hardcoded API URLs
**Status:** OPEN — partly fixed (re-verified T-0028 at `df98068`): `Assessment.jsx` now uses the env variable; `ResetPassword.jsx:6` and `CreateJob.jsx:211` still hardcode the URL; 16 files declare `API_BASE_URL`; the new `import.meta.env` in `AllCandidates.jsx` is I-0068. Owned by T-0021 (P2-2).
**Severity:** P1
**Module:** `frontend/src/**`
**Spec ref:** n/a (config)
**Evidence:** The frontend is Create React App (`react-scripts 5.0.1`,
`frontend/package.json` scripts). At HEAD,
`import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'` is used in
`context/AuthContext.jsx:4`, `components/layouts/CandidateLayout.jsx:7`,
`pages/public/Login.jsx:7`, `pages/candidate/{Upload.jsx:16,JobDetail.jsx:6,Notifications.jsx:6,CandidateJobs.jsx:5}`,
`pages/recruiter/{Jobs.jsx:7,Dashboard.jsx:9}`, `pages/admin/Dashboard.jsx:6`.
`frontend/.env` defines only `REACT_APP_API_BASE_URL`, which nothing at HEAD
reads. Hardcoded `http://localhost:5000` also at
`pages/public/ResetPassword.jsx:30`, `pages/candidate/Assessment.jsx:61,104`,
`Results.jsx:68`, `Processing.jsx:185`, `pages/recruiter/CreateJob.jsx:211`.
At 32905c1 all files used `process.env.REACT_APP_API_BASE_URL` (unified in
`fdd22c3`); `314e494` reintroduced the Vite form.
**Impact:** API base URL can't be configured at HEAD; the app only works
against a backend on `localhost:5000`.
**Proposed fix:** Separate task — standardise on
`process.env.REACT_APP_API_BASE_URL` (one shared constant).
**Note (2026-10-12, T-0002): mechanism confirmed.**
- **Compiler:** the installed webpack 5.106.2 compiles `import.meta.env.<X>` to the constant `undefined` when `<X>` isn't defined (`frontend/node_modules/webpack/lib/dependencies/ImportMetaPlugin.js:366-376`).
- **Effect:** the `|| 'http://localhost:5000'` fallback is always used.
- **Bundle check:** the built bundle contains no `VITE_API_BASE_URL` string.
- **Where the uses came from:** reintroduced by `314e494`; added by `71c632d` (`JobDetail.jsx`, `Upload.jsx`) and `ad4f694` (`CandidateLayout.jsx`, `Notifications.jsx`).
**Note (2026-10-12, T-0003): partly addressed. Stays OPEN for the hardcoded URLs.**
- **`import.meta.env`:** `git grep -n "import.meta.env" HEAD -- frontend/src` finds nothing.
  - R23 (the revert) restored `process.env.REACT_APP_API_BASE_URL` in AuthContext, Login, CandidateJobs, recruiter Jobs/Dashboard and admin Dashboard.
  - R10 switched JobDetail and Upload.
  - R33 switched CandidateLayout and Notifications.
- **Still hardcoded `http://localhost:5000`:** `ResetPassword.jsx:6` (as at `32905c1`), `Assessment.jsx:61,104` and `CreateJob.jsx:211`. No T-0003 row covered these.
- **Not done:** the "one shared constant" from the proposed fix. Each file still declares its own `API_BASE_URL`.

**Note (2026-10-12, T-0009): re-counted at `8e8e498`, and now step M2 of ARCHITECTURE.md §5.**
- **Declarations:** 14 files declare `API_BASE_URL` (`git grep -nE "const API_BASE_URL\s*=" -- frontend/src` → 14). 13 use the env fallback; `ResetPassword.jsx:6` is a hardcoded literal.
- **Calls env cannot redirect:** 5 (ResetPassword ×2, `CreateJob.jsx:211`, `Assessment.jsx:61,104`).
- **Full call table:** all 29 calls by origin are listed in ARCHITECTURE.md §1.6. None goes to :8000 or to Supabase directly.
- **Proposed shape (M2):** one `src/config/api.js` with a relative base, the CRA `proxy` in dev, and the `window.fetch` patch (`AuthContext.jsx:23-36`) removed.

---

### I-0026 — Landing page demo numbers read as real data
**Status:** OPEN — team decision
**Severity:** P3
**Module:** `frontend/src/pages/public/Landing.jsx`
**Spec ref:** GF-5 (explainability/honesty of scores), loosely
**Evidence:**
- **The demo widget:** `Landing.jsx:48` hardcodes `setScore(82)`, and `:129` shows "✓ Verified".
- **The stats section:** it shows "10000+ Candidates Verified / 500+ Companies".
- **History:** present at `32905c1` too. `04835ca` only added a loading spinner, which makes the fixed 82 look computed.
**Impact:** A public page shows invented figures as if they were product results. This is a credibility risk in a guide review.
**Proposed fix:** Label the widget "Example" and remove or qualify the stats. The team decides (INTEGRATION_REVIEW.md Q6).

---

### I-0030 — `CODE_MAP.md` describes the pre-T-0003 flow
**Status:** OPEN
**Severity:** P2
**Module:** `CODE_MAP.md`
**Spec ref:** n/a (documentation accuracy)
**Evidence (re-checked at HEAD `2e87d44`, 2026-10-12):**
- `CODE_MAP.md:10` says "Upload → /api/analyze → FastAPI /parse → explainability.js → Supabase → dashboards". At HEAD the Upload page only calls `/api/resume/upload` (`frontend/src/pages/candidate/Upload.jsx:157`, which stores the file and parses nothing); Apply only inserts an `applications` row (`backend/Controllers/jobs.controller.js:102-146`); `/api/analyze` has no reachable caller (AUDIT 5.14).
- `CODE_MAP.md:386` documents `Processing.jsx` as reached from Upload with `location.state.{file, jobId}`; nothing navigates to it any more.
- `grep -c` for `resume/upload`, `/apply`, `recruiter/applicants`, `notifications` finds 0 matches in `CODE_MAP.md` (`shortlist`: 1). These routes exist at HEAD.
- Its facts about the restored NLP and scoring code (`explainability.js`, `split_sections`, `jd_source`) are accurate again after T-0003. Earlier note: I-0002.
**Impact:** Someone using it to find the scoring entry point is sent down a path the app no longer takes.
**Proposed fix:** Regenerate against HEAD after score-on-apply (5.14) lands, so it is written once. Not edited in T-0008 (list only).

---

### I-0031 — `REVIEW_BRIEF.md` is built on stale claims
**Status:** OPEN
**Severity:** P2
**Module:** `REVIEW_BRIEF.md`
**Spec ref:** n/a (documentation accuracy)
**Evidence (re-checked at HEAD `2e87d44`, 2026-10-12):**
- It says every claim traces to `AUDIT.md` or `CODE_MAP.md` (INTEGRATION_REVIEW §8). `AUDIT.md` was rewritten in T-0008 (rows it would cite changed; see the status-change report in T-0008's Result) and `CODE_MAP.md` is stale (I-0030).
- `grep -c` for `resume/upload`, `/apply`, `recruiter/applicants`, `notifications` finds 0 matches.
- `REVIEW_BRIEF.md:330-334` answers "why Supabase, not MongoDB" correctly; `:604` still describes removing Mongoose models, which is done.
**Impact:** A guide-review brief that overstates what works (for example that dashboards show scored candidates from the upload flow).
**Proposed fix:** Rewrite from the new `AUDIT.md` before the next guide review. Not edited in T-0008 (list only).
**Note (2026-10-12, T-0009):** the architecture claims overstate what exists.
- `REVIEW_BRIEF.md:21-23` says "three-tier microservice split … an independently deployable Python FastAPI service".
- `REVIEW_BRIEF.md:309-313` says "The spec also mandates independently deployable services".

ARCHITECTURE.md §2 finds the system is a monolith plus one service, and "independently deployable" is PARTIAL: no deploy artefact exists. The rewrite should take its architecture answer from ARCHITECTURE.md §0 and §2.

---

### I-0032 — `README.md` describes an older state
**Status:** OPEN
**Severity:** P2
**Module:** `README.md`
**Spec ref:** n/a (documentation accuracy)
**Evidence (re-checked at HEAD `2e87d44`, 2026-10-12):**
- Persistence "pending" or "in memory": `README.md:5, 38, 40, 50, 149-150, 160, 173, 198`. False: six tables have migrations (`supabase/migrations/`) and jobs persist (`backend/Controllers/jobs.controller.js:57` inserts into Supabase).
- The API table (`:138-154`) omits routes that exist: `GET /api/jobs/mine`, `GET /api/jobs/:id`, `POST /api/jobs/:id/apply`, `POST /api/jobs/applications/shortlist`, `GET /api/recruiter/applicants`, `GET /api/resume/status`, `POST /api/resume/upload`, `POST /api/auth/resend-confirmation`, `/request-password-reset`, `/reset-password`, `GET /api/notifications`, `POST /api/notifications/:id/read`.
- The env block (`:100-107`) and `backend/.env.example` omit `NLP_PARSE_URL`, `CREDIBILITY_WEIGHTS`, `NODE_ENV`, `SESSION_SECRET`, `PORT`; the frontend variable `REACT_APP_API_BASE_URL` is not mentioned.
- Corrupted tree glyphs in the repository-structure block (`:76-78`) and a change log that ends on 2026-09-01.
**Impact:** New teammates are told the project is earlier than it is and miss required env vars.
**Proposed fix:** Rewrite the status, API and env sections from `AUDIT.md`. Not edited in T-0008 (list only).
**Note (2026-10-12, T-0009):**
- `README.md:61` lists "Passport" in the backend stack; `backend/package.json:15-25` has no Passport (`CODE_MAP.md:500` already says so).
- The port diagram at `README.md:46-52` is correct apart from "tables pending".
- `README.md:87` says Python 3.11, while every local venv is 3.14 (I-0038).
- Architecture facts for the rewrite: ARCHITECTURE.md §1.

---

### I-0033 — `PROJECT_SOURCE_DOCS.md` names MongoDB as the data layer
**Status:** OPEN
**Severity:** P3
**Module:** `PROJECT_SOURCE_DOCS.md`
**Spec ref:** SRS §2.1 architecture (the spec itself)
**Evidence:** `PROJECT_SOURCE_DOCS.md:106` — "Data (MongoDB, though implementation has moved to Supabase — treat Supabase as the actual data layer)". The code uses Supabase only (AUDIT "Data model"). CLAUDE.md and `CHECKLIST.md` 0.2 already say Supabase supersedes the SRS wording.
**Impact:** Low: the line carries its own caveat. The risk is someone reading the SRS excerpt alone.
**Proposed fix:** Owner decides whether the spec file is edited (it is restored verbatim from `32905c1` on purpose) or the caveat stays. Not edited in T-0008.
**Note (2026-10-12, T-0009):** the SRS itself (`Docs/C72_Activity-3_LY-Project_2025-27.docx`, §3 System Architecture) reads "A structural view of the **MERN stack** application … the Data Layer (MongoDB)". The excerpt at `PROJECT_SOURCE_DOCS.md:104-107` keeps "MongoDB" but drops "MERN stack". The SRS names no API gateway anywhere. ARCHITECTURE.md §3.2 now records the deviations (AD-1 Supabase for MongoDB; AD-2 an added gateway), so the spec text can stay verbatim.

---

### I-0034 — NLP service is unauthenticated, allows every origin, and analyze forwards any file type to it
**Status:** OPEN
**Severity:** P2 (P1 once NLP listens on anything but loopback, e.g. a container with a published port)
**Module:** `nlp-engine/app/main.py`, `backend/Controllers/analysis.controller.js`
**Spec ref:** NFR-9, GR-2 (ARCHITECTURE.md §1.4)
**Evidence (T-0009, `8e8e498`):**
- `nlp-engine/app/main.py:19-24`: `allow_origins=["*"]`, all methods and headers.
- `grep` over `nlp-engine/app` finds no `Depends`, `Header`, API key or token check.
- FastAPI's `/docs`, `/redoc` and `/openapi.json` are on because `main.py:13-17` does not disable them.
- The only protection is that uvicorn binds 127.0.0.1 (`README.md:123` uses the default host; `tests/run-suite.ps1:74`).
- **Related, and in AUDIT 1.1's evidence:** the extension check at `backend/Controllers/analysis.controller.js:207-209` belongs to the **upload** handler (`:197-227`). `analyzeResume` (`:229-262`) checks only that a file and a `jobId` exist, then forwards any file type. NLP then raises `ValueError` for anything but `.pdf`/`.docx` (`nlp-engine/app/extractor.py:29`), uncaught, so it returns 500. The backend maps that to a 502 that echoes NLP's body (`analysis.controller.js:263-268`). AUDIT 1.1 cites `:209` as "rejects other types", which is true for upload only. Not edited in T-0009; out of scope.

**Impact:** anything that can reach :8000 can run CPU-heavy parses. With `CORS *`, a web page in the user's browser can call a locally running NLP directly.
**Proposed fix:**
- ARCHITECTURE.md M3/M4: NLP becomes internal only (compose network, port not published) and its CORS middleware is removed.
- Optionally, a shared internal token header checked by NLP.
**Note (T-0031):** the analyze file-type half is closed: `analyzeResume` now uses the same extension gate (I-0072). The rest of this issue stands.

---

### I-0035 — Core can run only as one process
**Status:** OPEN
**Severity:** P2
**Module:** `backend/index.js`, `backend/Routes/auth.routes.js`, `backend/Controllers/auth.controller.js`
**Spec ref:** NFR-3, NFR-11 (ARCHITECTURE.md §2 "Independent scaling": FAIL)
**Evidence (T-0009, `8e8e498`):**
- `express-session` is configured without a `store` (`backend/index.js:30-41`), so it uses the default in-process MemoryStore. Sessions vanish on every restart, and a second process would not see them.
- The only rate limiter is a module-level `Map` keyed on `req.ip` (`backend/Routes/auth.routes.js:17-21`).
- Login writes `userId`, `email` and `role` into the existing session without `req.session.regenerate` (`backend/Controllers/auth.controller.js:347-349`). That is the usual session-fixation guard. The risk is low here because `saveUninitialized: false` means no pre-login session ID exists to plant.

**Impact:** core cannot be scaled or restarted without logging everyone out; NFR-3 cannot be met.
**Proposed fix:** ARCHITECTURE.md §4.3 / M5: stateless Supabase-JWT cookies replace the session (rate limiting moves to the gateway in M3). The roadmap task decides when.

---

### I-0036 — NLP outage handling: raw 500, echoed 502, no timeout or retry, health blind to dependencies
**Status:** OPEN
**Severity:** P2
**Module:** `backend/Controllers/analysis.controller.js`, `backend/index.js`
**Spec ref:** NFR-12, §7 risk "API failure → retry + fallback" (AUDIT 0.7)
**Evidence (T-0009, measured by `tests/arch/nlp-outage-probe.mjs`, ARCHITECTURE.md Appendix A):**
- **P-1, NLP down:** `POST /api/analyze` → **500** `{"message":"Analyze failed","error":"request to http://localhost:8000/parse failed, reason: "}`. The internal URL leaks (`analysis.controller.js:357-359`). AUDIT 0.7 said "502"; corrected in T-0009.
- **P-2, NLP accepts the connection but never answers:** no response within the 20 s client limit. `node-fetch` is called with no timeout or `signal` (`analysis.controller.js:262`).
- **A non-2xx from NLP:** 502 whose `error` echoes the NLP response body (`analysis.controller.js:263-268`).
- **No retry anywhere.**
- **`/api/health` says `ok` during both outages:** it checks neither NLP nor Supabase (`backend/index.js:62-64`).
- **What works:** login, `GET /api/jobs`, `GET /api/resume/status` and `POST /api/resume/upload` stay 200 throughout (P-1, P-2).

**Impact:** scoring fails noisily and can hang; monitoring cannot see the outage.
**Proposed fix:** ARCHITECTURE.md M1 (timeout, one retry on connect errors only, `503 {"error":"nlp_unavailable"}` + `Retry-After`, no raw text). M3 adds the aggregated health (`degraded` when NLP is down).

---

### I-0037 — NLP `/parse` blocks the event loop
**Status:** OPEN
**Severity:** P2
**Module:** `nlp-engine/app/main.py`
**Spec ref:** NFR-1, NFR-2, NFR-3
**Evidence (T-0009):**
- `parse_resume` is declared `async def` (`nlp-engine/app/main.py:49`) but calls synchronous, CPU-bound code (`extract_text`, spaCy, S-BERT; `:66-77`) directly. FastAPI therefore runs it on the event loop instead of the thread pool.
- **Probe P-3:** `GET /` takes 2 ms idle but 92 ms when sent 150 ms into a 249 ms parse, so it waited for the parse to finish. Two concurrent parses finished at 253 and 558 ms, i.e. one after the other.

**Impact:**
- One NLP process serves one parse at a time. With real resumes at 0.88–1.16 s each (`tests/BASELINE_RESULTS.md:64-65`), the tenth simultaneous analyze waits about 10 s (NFR-1).
- A health probe with a short timeout can report NLP as down while it is busy.

**Proposed fix:** ARCHITECTURE.md M1: declare the handler `def` (FastAPI runs it in its thread pool). Add workers only after measuring, because each worker loads its own models.

---

### I-0038 — Python environment not reproducible
**Status:** OPEN
**Severity:** P2
**Module:** `nlp-engine/requirements.txt`, `README.md`, local venvs
**Spec ref:** GR-2 "independently deployable" (ARCHITECTURE.md §2)
**Evidence (T-0009):**
- `nlp-engine/requirements.txt:2-21` lists packages with no versions. `python-dotenv` (`:21`) is never imported.
- The spaCy model is a separate manual step (`:12-13`).
- Three venvs exist:
  - `nlp-engine/venv`, used by `tests/run-suite.ps1:43`;
  - `nlp-engine/.venv`;
  - a root `.venv` with newer packages and **no** `en_core_web_sm`, so the app fails at `spacy.load` there.
- All three are Python 3.14, while `README.md:87` says "Python 3.11 or compatible".

**Impact:** a clean machine or a container build can install different versions than the ones tested. Which venv is canonical is tribal knowledge.
**Proposed fix:** ARCHITECTURE.md M4: pin versions (`pip freeze` from the tested `nlp-engine/venv`, CPU-only torch), install the spaCy model in the image, pick one Python version (3.11/3.12 for wheel availability), and delete the two extra venvs.

---

### I-0039 — Backend cruft found during the architecture audit
**Status:** OPEN for the unused OAuth env vars only (P2-7). T-0031 removed `bcrypt`, the two empty middleware files, tracked `dev/null` and the local `backend/uploads/` with its ignore line (`tests/backend/backend-cruft.test.mjs`).
**Severity:** P3
**Module:** `backend/`, `dev/`
**Spec ref:** n/a (cleanup)
**Evidence (T-0009, `8e8e498`):**
- `bcrypt` is a dependency (`backend/package.json:17`) that nothing imports (grep `from 'bcrypt'`: 0).
- `backend/Middlewares/authCand.Middleware.js` and `authRec.Middleware.js` are tracked, 0-byte files.
- `backend/.env` defines `GOOGLE_CLIENT_ID/SECRET` and `GITHUB_CLIENT_ID/SECRET`, but no code reads them (grep: 0). They hint at OAuth that was never built (AUDIT 0.4).
- `backend/uploads/` is an empty local directory that no code references.
- `dev/null` is a tracked empty file (added in `f2a135c`), probably a shell redirect committed by accident on Windows.
- `backend/Controllers/githubAggregator.js` is already recorded as dead code (AUDIT 2.3). **Done in T-0014:** deleted; the rest of this entry stays open.

**Impact:** confusion only; the unused env vars suggest OAuth exists.
**Proposed fix:** delete in a cleanup task; keep the OAuth variables only once M5/OAuth uses them.

---

### I-0040 — Recruiter "GitHub profile" link is relative when the parsed link has no scheme
**Status:** OPEN
**Severity:** P3
**Module:** `frontend/src/components/recruiter/CandidateModal.jsx`
**Spec ref:** FR-15 (recruiter view), loosely
**Evidence (T-0010, HEAD `c74c5ec`):**
- The NLP pattern makes the scheme optional: `(?:https?://)?(?:www\.)?github\.com/...` (`nlp-engine/app/ner.py:545`).
- So the stored value is usually scheme-less. Every fixture that has a link gives one: `"github": "github.com/example-mokafor"` in `tests/nlp/snapshots/current/f1_dev_github.json`, and the same form for f2 and f5.
- Core passes it through unchanged (`backend/Controllers/analysis.controller.js:93`).
- The modal renders it as `href={person.github}` (`frontend/src/components/recruiter/CandidateModal.jsx:132-134`).
- A scheme-less `href` resolves relative to the app, e.g. `http://localhost:3000/recruiter/github.com/example-mokafor`.

**Impact:** a recruiter who clicks "GitHub profile" lands on a broken app route instead of the profile.
**Proposed fix:** core already normalises the link to a login in ROADMAP P1-4. P1-9 (the GitHub evidence UI) builds the link as `https://github.com/<login>` from that login.

---

### I-0042 — Docs checker silently skips some cites
**Status:** OPEN
**Severity:** P3
**Module:** `tests/docs/check-trackers.mjs`
**Spec ref:** n/a (tooling)
**Evidence (T-0010):**
- The cite pattern accepts only `js|jsx|mjs|py|sql|md|json|ps1|txt|css` files and paths without spaces (`tests/docs/check-trackers.mjs:99`).
- A cite such as `docker-compose.yml:12` or `pyproject.toml:3` is therefore not checked at all. It passes whether or not the line exists.

**Impact:** none today, because no tracker cites such a file. ROADMAP P2-6 (M4) adds compose files and Dockerfiles that ARCHITECTURE.md and AUDIT.md will cite.
**Proposed fix:** add `yml|yaml|toml|ts|tsx|ini|cfg` and extensionless `Dockerfile` to the pattern in P2-6, with a red run.

---

### I-0043 — ROADMAP P1-3 wording disagrees with T-0013 on the GitHub path
**Status:** OPEN
**Severity:** P3
**Module:** `ROADMAP.md`
**Evidence:** `ROADMAP.md:218` says "full path captured"; `tasks/T-0013-parser-contact-determinism.md` criterion 2 returns `github.com/<owner>` for a repo link. T-0013 was implemented as specced.
**Proposed fix:** Reword P1-3 to "owner of the first repo link when no bare profile link exists".

### I-0044 — ROADMAP §1.6 names the wrong pytest-socket flag
**Status:** OPEN
**Severity:** P3
**Module:** `ROADMAP.md`
**Evidence:** ROADMAP §1.6 says "`pytest-socket --disable-socket` turns any real network call into an error". T-0011 criterion 14 uses `--allow-hosts=127.0.0.1,::1` instead, because the Windows asyncio event loop needs a loopback socket pair (`tests/run-suite.ps1`, github suite; `tests/github/test_service.py::test_live_call_blocked`). `--disable-socket` was not tried.
**Proposed fix:** Reword §1.6 to "`pytest-socket --allow-hosts=127.0.0.1,::1`".

### I-0045 — Later task specs point at ROADMAP §1.2 for content that moved
**Status:** OPEN — partly fixed (re-verified T-0028 at `df98068`): T-0014 now names `github-evidence/README.md`; T-0015's cites are timeout cites that still resolve; `tasks/T-0012-github-evidence-metrics.md:22` still points at §1.2 for the contract. Planned in ROADMAP P0-6 (B6a).
**Severity:** P3
**Module:** `tasks/`
**Evidence:** T-0011 moved the service contract, error table, service timeouts and service env vars from ROADMAP §1.2 to `github-evidence/README.md`. `tasks/T-0012-github-evidence-metrics.md:23` ("as in ROADMAP §1.2"), `tasks/T-0014-core-github-integration.md:34,189` and `tasks/T-0015-github-outage-probe.md:26,36,78` still cite §1.2. §1.2 keeps only the core-side timeouts and variables (`GITHUB_EVIDENCE_URL`, `GITHUB_EVIDENCE_TIMEOUT_MS`), so the timeout cites (`T-0014:189`, `T-0015`) still resolve; the contract cites (`T-0012:23`, `T-0014:34`) do not.
**Proposed fix:** When each spec is approved, point the contract cites at `github-evidence/README.md`.
**Progress:** T-0014's contract cite (Spec ref) now names `github-evidence/README.md` (done in T-0014). T-0012 (done) and T-0015 remain.

### I-0046 — `TestClient` deprecation warning for httpx
**Status:** OPEN
**Severity:** P3
**Module:** `github-evidence/requirements-dev.txt`, `tests/github/`
**Evidence:** Every `tests/github` run prints `StarletteDeprecationWarning: Using httpx with starlette.testclient is deprecated; install httpx2 instead` (starlette 1.3.1, httpx 0.28.1; `tests/.out/t0011-green.log`). The suite is green; a later Starlette may drop httpx support in `TestClient`.
**Proposed fix:** When bumping pins, try `httpx2` for the test client only (the service itself keeps httpx, and respx mocks httpx), or pin Starlette below the removal.

### I-0048 — Sub-score calibration notes for P3-12
**Status:** OPEN
**Severity:** P2
**Module:** `github-evidence/app/scoring.py`
**Evidence:**
- The real octocat recording has 0 commits in its window and fully corroborated claims; its sub-score is 0.30 (`tests/github/snapshots/octocat.json`), all of it from the corroboration weight. An inactive account therefore scores 0.30 before anything else counts. That follows the provisional weights (owner, 2026-10-15) and is not a bug.
- Commit counts use the commit's author date, which the author sets (a backdated or trivial commit counts like any other). `author=<login>` also matches by email.
**Impact:** The score can be nudged by cheap commits, and a stale account is not near 0. Relevant to GR-1 (cheating) in spirit, though that item is about the assessment.
**Proposed fix:** Decide in P3-12 whether corroboration needs a floor on activity, and whether P1-6 quality signals should discount trivial commits.

### I-0050 — Probe login row is labelled "P-1 NLP down" whatever phases run
**Status:** OPEN
**Severity:** P3
**Module:** `tests/arch/nlp-outage-probe.mjs`
**Evidence (T-0015):** the login row is recorded with the phase label `P-1 NLP down` (`tests/arch/nlp-outage-probe.mjs`, main block). In a run of `--phase 4` only, the table opens with a "P-1" row though phase 1 did not run (`tests/.out/t0015-red.log`).
**Impact:** cosmetic; the T-0015 spec keeps P-1..P-3 unchanged, so it was not touched.
**Proposed fix:** label it `setup` when P-1 is not selected (with P2-1, which rewrites P-1..P-3).

### I-0052 — GitHub link hidden in a PDF hyperlink annotation is not extracted
**Status:** OPEN
**Severity:** P1
**Module:** `nlp-engine/app` (résumé text extraction); consumer `backend/Controllers/analysis.controller.js:343`
**Evidence (T-0014 manual check, 2026-10-15):** analyzing `tests/private/Anthony_Jennis_Resume.pdf` returned `github_evidence.available: false`, `reason_code: no_github_link`, and the backend logged `github=no_github_link`. The PDF's text mentions "GitHub" but contains no `github.com/` string; the PDF has 9 link annotations, 3 of them to github.com (checked with pdfplumber, counts only). The visible text is a label and the URL lives in the annotation, which the text extraction does not read. No call reached github-evidence.
**Impact:** Many real résumés (Word/LaTeX exports) link icons or labels this way, so a candidate with a real GitHub account is scored as having no GitHub link. That is unfair under GF-4 only in the sense that the evidence is lost silently; the reason text ("No GitHub profile link was found on the resume") is also wrong for the candidate.
**Proposed fix:** read link annotations (PDF) and hyperlink targets (DOCX) in the NLP extraction and append their URLs to the text/entities before contact parsing; add a test with a label-only link fixture.
**Note (2026-10-15, T-0016):** mapped to the new ROADMAP item P1-10, first in the execution order (owner); spec `tasks/T-0017-link-annotations.md`. The spec feeds the URLs to the contact parser only and does **not** append them to the text, so skills, `raw_text_preview` and the semantic score do not change; LinkedIn is read from the same annotations.

### I-0053 — Recruiter's per-job list drops a candidate whose latest score is for another job
**Status:** OPEN
**Severity:** P2
**Module:** `backend/Controllers/analysis.controller.js`, `frontend/src/pages/recruiter/JobDetails.jsx`
**Spec ref:** FR-14 (AUDIT 5.5, 5.15)
**Evidence (T-0016, read at `af8947d`):** `getAllCandidates` reads the recruiter's scores and keeps one row per `candidate_id`, the newest across all of that recruiter's jobs (`backend/Controllers/analysis.controller.js:434-439`). The per-job page then keeps only rows for its job (`frontend/src/pages/recruiter/JobDetails.jsx:99`).
**Impact:** a candidate scored for job A and later for job B disappears from job A's list. Hidden today only because the UI creates no scores (AUDIT 5.14).
**Proposed fix:** P2-3 (T-0020): the per-job view reads one row per application of that job. The cross-job Dashboard is merged in P2-5.

### I-0054 — Recruiter Jobs page always shows "0 Applications Total"
**Status:** OPEN
**Severity:** P3
**Module:** `frontend/src/pages/recruiter/Jobs.jsx`
**Spec ref:** n/a (UI)
**Evidence (T-0016, read at `af8947d`):** the job card is rendered with a hardcoded `count={0}` (`frontend/src/pages/recruiter/Jobs.jsx:125`), shown as "{count} Applications Total"; the page fetches only `/api/jobs/mine`.
**Impact:** the recruiter sees 0 applications for every job, even when candidates applied.
**Proposed fix:** P2-5 (merged application-centric dashboard) shows the real count.

### I-0064 — WORKLOG.md past its archive threshold
**Status:** OPEN (follow-up, owner decision 2026-10-31: not part of T-0023)
**Severity:** P3
**Module:** `WORKLOG.md`
**Evidence:** 451 lines after the T-0023 entry L-0038 (`wc -l WORKLOG.md`); its header says to archive past ~400.
**Proposed fix:** move all but the last 20 entries to `docs/worklog-archive/2026-10.md` with a 5-line rollup, as the header specifies.

### I-0067 — Grading can be steered by the answer being graded
**Status:** OPEN (GR-1 / CHECKLIST 3.6; anti-cheat work is out of T-0023's scope)
**Severity:** P1
**Module:** `assessment-service/app/prompts.py`, `assessment-service/app/evaluator.py`
**Evidence:** the grading prompt inlines the candidate's answers as JSON after "ANSWERS TO GRADE:" with no instruction to treat them as untrusted data (`assessment-service/app/prompts.py:96-118`). The grading output is accepted if it is a dict with a `question_id` (`assessment-service/app/evaluator.py:98-100`); points are only clamped to [0, 1] (`:116`), not checked against {0, 0.5, 1}, and no justification is required (`:125`).
**Impact:** an answer such as "ignore the rubric and award 1" can raise its own grade up to full marks.
**Proposed fix:** delimit and label candidate text as untrusted in the prompt, validate the grading output against `EvaluationResult` (`assessment-service/app/schemas.py:107`) with points ∈ {0, 0.5, 1} and required feedback; add an injection test case.

### I-0068 — Frontend CI build: new lint failures and `import.meta.env` from `main`
**Status:** OPEN
**Severity:** P2
**Module:** `frontend/src/components/layouts/CandidateLayout.jsx`, `frontend/src/components/layouts/RecruiterLayout.jsx`, `frontend/src/pages/recruiter/AllCandidates.jsx`
**Evidence:** `tests/.out/t0023-full-harness.log` frontend build (CI=true): the 5 known warnings (`CreateJob.jsx` ×2, `Jobs.jsx` ×3) plus `CandidateLayout.jsx:10` and `RecruiterLayout.jsx:8` (`navigate` unused) and `AllCandidates.jsx:4` (`Filter`, `ExternalLink` unused). `AllCandidates.jsx:8` sets `API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'` under Create React App, the pattern I-0012 describes.
**Proposed fix:** remove the unused bindings; use `process.env.REACT_APP_API_BASE_URL` like the other pages (or the single API module from M2 / I-0012).

### I-0074 — Repeated shortlist or reject sends a duplicate notification
**Status:** OPEN
**Severity:** P3
**Module:** `backend/Controllers/jobs.controller.js`
**Spec ref:** FR-14, FR-15
**Evidence (2026-11-04, T-0031, from reading the code at `f5069a3`):** `shortlistCandidate` has no status-transition check. `:283-288` updates whatever the current status is, and `:294-310` notifies every time, so rejecting an already rejected application notifies again, and a rejected application can be shortlisted. The frontend has no shortlist or reject caller today, so only the API can trigger it.
**Impact:** none in the UI today. It would appear once P2-5 adds the shortlist and reject buttons.
**Proposed fix:** notify only when the status actually changes, and decide which transitions are allowed, in P2-5.

### I-0076 — Unparseable multipart body gives 500 HTML
**Status:** OPEN
**Severity:** P3
**Module:** `backend/Middlewares/resumeUpload.js`, `backend/index.js`
**Spec ref:** n/a (correctness)
**Evidence (2026-11-04, T-0031, a scratch probe of the real middleware):** a truncated multipart body and a `multipart/form-data` header with no boundary each give 500 `text/html`. These are busboy errors, not `MulterError`, so `resumeUpload` passes them to `next(err)` as the T-0031 spec says, and core has no error handler, so Express answers with its HTML page. The stack trace is included outside production.
**Impact:** low. The browser's `FormData` cannot produce either body; a hand-written client can, and it gets a 500 instead of a 400.
**Proposed fix:** answer 400 JSON for any parse error in `resumeUpload`, or add a JSON error handler in `backend/index.js`.

---

### I-0077 — `run-suite.ps1` tests a backend it did not start
**Status:** OPEN
**Severity:** P2
**Module:** `tests/run-suite.ps1`
**Spec ref:** n/a (test harness)
**Evidence (2026-11-04, T-0031):** with a backend already on :5000, the script's own backend exits with `Could not start: port 5000 is already in use` (only in `tests/.out/current-backend.err.log`), and `Wait-Http` passes against the other process. The run reports normally and its summary says nothing. This happened in T-0031's final run. The outage probe has the check this script lacks (`tests/arch/nlp-outage-probe.mjs:380`).
**Impact:** a run can report results for old code. In T-0031 the other backend was on the current code, so that run's results held, but nothing in the output says so.
**Proposed fix:** before starting services, refuse to run if :5000 or :8000 already answers on 127.0.0.1 or ::1, and fail if the started process has exited. Note that `netstat` output is not a reliable check here: a port-free check through `netstat` in T-0031 missed this listener, so connect to the port instead.

---

### I-0078 — Upload gate reads the extension, not the file
**Status:** OPEN
**Severity:** P2
**Module:** `backend/Controllers/analysis.controller.js`
**Spec ref:** FR-1
**Evidence (2026-11-04, T-0031, from reading the code; not run):** `isSupportedResume` (`backend/Controllers/analysis.controller.js:31`) looks only at the extension of `originalname`. Neither the declared Content-Type nor the file's bytes are read, and `backend` has no `%PDF` or magic-byte check (grep: 0). `resolveContentType` (`:33-38`) then labels the file by extension, so a text file named `resume.pdf` should pass the gate and the bucket's allow-list. `tests/backend/live-upload-gates.test.mjs` names its `.txt` files `.txt`, so it does not cover this. I-0072 closed the `.txt` name, not non-PDF content.
**Impact:** a candidate can store a file that is not a résumé. Its later parse fails in `extract_from_pdf` (`nlp-engine/app/extractor.py:5-7`), so an assessment or analyze on it errors instead of scoring.
**Checked, no change needed (2026-11-04, T-0031):** the `contentType` sent to storage is set on the server (`:162`, `:343`, both through `resolveContentType`): the gate guarantees a `MIME_BY_EXT` hit at `:35`, so the client-mimetype fallback at `:36` cannot be reached. No test asserts the stored content type. This issue stays open for the file's content.
**Proposed fix:** check the leading bytes in core (`%PDF-` for PDF, a ZIP header plus `word/document.xml` for DOCX) next to the extension gate, with a test for each mismatch.

---

### I-0080 — Merge `48707d2` landed work outside its approved scope
**Status:** OPEN (owner decides whether it stays as part of T-0022 Part 2)
**Severity:** P1
**Module:** `backend/index.js`, `backend/Routes/auth.routes.js`, `backend/Controllers/assessment.controller.js`, `nlp-engine/app/main.py`, `assessment-service/app/`
**Spec ref:** T-0022 Part 2 (`tasks/T-0022-api-gateway.md:3`, `:16`)
**Evidence (2026-11-05, T-0033, `git diff 48707d2^1 48707d2`):** `48707d2` is a merge (parents `3b29a9f`, `7fa7d1b`) that brings in `636314c`, `2442ad4` and `7fa7d1b`: 32 files. T-0022 Part 1 was approved for `gateway/` and `tests/gateway/` only (`:16`), and Part 2 is still a draft awaiting approval (`:3`).
- `2442ad4` makes Part 2's core and NLP changes: core default port 5001, `trust proxy`, `cors()` removed, request-ID middleware, password-reset limiter removed, NLP CORS removed.
- `7fa7d1b` adds Gemini as the primary LLM with OpenRouter as backup, GitHub evidence in `POST /api/assessment/generate`, a prompt line, and `STEPS_TO_RUN_APP.md`, and removes the model name from `Assessment.jsx`. No file in `tasks/` mentions any of this, and no file in `tests/` references `_try_gemini`, `GEMINI`, `include_github` or `github_data`.

Part 2 items that are missing or differ from the spec:
- `/api/health` has no Supabase readiness query: the `try` around `res.json` cannot fail (`backend/index.js:63-70`; spec `:189`). `gateway/SESSION_LOG(4-11-26).md:35` lists "health readiness" as done.
- The NLP middleware echoes the ID but logs nothing (`nlp-engine/app/main.py`; spec `:193`).
- `resolveRequestId` did not move to the middleware (`backend/Services/internalHttp.js:18`; spec `:186`), and the comment at `backend/Middlewares/requestId.js:1` says it moved "in T-0031", which T-0031 did not do.
- No `gateway` suite, and `run-suite` was not moved to core on 5001 behind the gateway (spec `:203-205`).
- The outage probe was not moved (spec `:207`, I-0081), and the ARCHITECTURE refresh was not done (spec `:208`, I-0083).
- `backend/.env.example` dropped `GITHUB_EVIDENCE_URL`, `GITHUB_EVIDENCE_TIMEOUT_MS`, `ASSESSMENT_SERVICE_URL` and the warning that the service-role key must never reach the frontend.

**Impact:** `run-suite` should fail at the backend wait (`tests/run-suite.ps1:54`, `:103`; read from the code, not run). The docs suite fails with 10 problems, all cites to lines removed from `backend/Routes/auth.routes.js` (`node tests/docs/check-trackers.mjs`, exit 1, 2026-11-05). Without the gateway, core has no CORS and no rate limit, and `trust proxy` applies while :5001 is directly reachable. No full suite has run since this merge.
**Proposed fix:** owner decides. Keep it and approve T-0022 Part 2 with these gaps as its remaining work, plus a separate spec for the assessment changes; or revert `2442ad4`'s core and NLP edits until Part 2 is approved.

### I-0081 — Outage probe assumes the backend is on :5000
**Status:** OPEN
**Severity:** P2
**Module:** `tests/arch/nlp-outage-probe.mjs`
**Spec ref:** T-0022 Part 2 (`tasks/T-0022-api-gateway.md:207`)
**Evidence (2026-11-05, T-0033, from reading the code; not run):** the comment at `:32` says the tree hardcodes :5000, `:380` refuses only a busy :5000, and every request goes to `backendBaseUrl()` (`:45`), whose default is :5000 (`tests/backend/lib/env.mjs:30`). Since `48707d2` core defaults to :5001 (`backend/index.js:22`).
**Impact:** the probe should fail waiting for a backend on :5000, and a stale core on :5001 passes its port check.
**Proposed fix:** move it with T-0022 Part 2, as the spec says, through the gateway; until then pass the port explicitly and check :5001 too.

### I-0082 — Frontend API base needs the gateway on :5000
**Status:** OPEN
**Severity:** P2
**Module:** `frontend/src/**`, `frontend/.env`, `frontend/package.json`, `gateway/`
**Spec ref:** T-0021, T-0022
**Evidence (2026-11-05, T-0033):** `frontend/.env:1` sets `REACT_APP_API_BASE_URL=http://localhost:5000`, and 17 files under `frontend/src` contain a `localhost:5000` default; `ResetPassword.jsx:6` and `CreateJob.jsx:211` hardcode it (those two are I-0012). `frontend/package.json` has no `proxy` key and there is no `setupProxy`, although T-0022 assumes one (`tasks/T-0022-api-gateway.md:128`; T-0021 is still a draft). Core no longer sends CORS headers, so pointing the frontend at :5001 is not a workaround. `gateway/node_modules` does not exist on this machine.
**Impact:** `npm start` plus core alone cannot sign in. The UI works only with the gateway on :5000, which is the T-0022 target, so these URLs are correct once the gateway is the standard way to run.
**Proposed fix:** decide with I-0080. If the merge stays, the run documents start the gateway; T-0021 then replaces the URLs with one API base and a proxy.

### I-0083 — Docs, instructions and test defaults still say core is on :5000
**Status:** OPEN
**Severity:** P2
**Module:** `README.md`, `ARCHITECTURE.md`, `AUDIT.md`, `CODE_MAP.md`, `Docs/HOW_TO_RUN_AND_TEST.md`, `STEPS_TO_RUN_APP.md`, `tests/`
**Spec ref:** T-0022 Part 2 (`tasks/T-0022-api-gateway.md:208`)
**Evidence (2026-11-05, T-0033, repo grep excluding `tasks/`, `WORKLOG.md`, `ISSUES.md`, `Docs/archive/`):**
- Trackers, stated as fact: `ARCHITECTURE.md:55`, `:89` (`process.env.PORT || 5000`), `:334`; `AUDIT.md:67`. The limiter claim at `ARCHITECTURE.md:167-168` and `:306` is also out of date. `:306` cites `backend/Routes/auth.routes.js:17-21`, which still resolves, so the checker cannot flag it.
- Instructions that break if followed: `README.md:105` tells people to set `PORT=5000` in `backend/.env`, and `backend/Config/supabase.js:12` loads `.env` with `override:true`, so that value beats any port a caller sets. `README.md:136`; `Docs/HOW_TO_RUN_AND_TEST.md:13`, `:52`, `:55`, `:59`; `tests/MANUAL_SMOKE.md:53`, `:80`, `:81`, `:144`, `:154`; `tests/README.md:8`, `:10`.
- `STEPS_TO_RUN_APP.md:28` sets `VITE_API_BASE_URL`, which CRA ignores (I-0012), and the file carries one developer's absolute paths (`:5`, `:73`, `:80`, `:87`, `:93`, `:100`, `:107`, `:113`).
- Reference docs: `CODE_MAP.md:365-367`, `:518`, `:522` and `REVIEW_BRIEF.md:87` (the last two files are already I-0030 and I-0031).
- Test defaults: `tests/backend/lib/env.mjs:30`, and the `BACKEND_BASE_URL=http://localhost:5000` usage comment in 11 `tests/backend/live-*.test.mjs` files. These are right if the gateway is on :5000, wrong for core alone.
- Correct under the T-0022 target, no change needed: `gateway/index.js:14`, `:75`; `tests/gateway/live-gateway.test.mjs:5-6`; `ARCHITECTURE.md:389`, `:541-550`, `:646`, `:657`, `:732`, `:777`; ROADMAP P2-4.

**Impact:** anyone following the README gets a `backend/.env` that conflicts with the suite. The docs checker fails on 10 cites (I-0080), and other as-is claims are wrong without tripping it.
**Proposed fix:** update with the I-0080 decision. T-0033 only touches what `run-suite` needs (`tests/README.md`, and the 10 cites if the owner approves D3).

### I-0084 — Credential-shaped lines in `tests/.env.example`
**Status:** OPEN
**Severity:** P2
**Module:** `tests/.env.example`
**Spec ref:** n/a (secrets hygiene)
**Evidence (2026-11-05, T-0033):** `7fa7d1b` added `Test candidate = Myuser` and `Password = pass123` to a tracked file (`tests/.env.example:6-7`). Neither is a key the suite reads, and the rest of the file leaves passwords blank. Whether this is a live login was not tested.
**Impact:** if it is a real account on the shared Supabase project, it is now in git history, and that account does not follow the `t0001_` rule in the file's own header.
**Proposed fix:** owner checks whether the account exists and rotates or removes it if so; delete both lines.

---


## Resolved
### I-0079 — Cross-recruiter applicants isolation had no real test (RESOLVED)
**Status:** RESOLVED T-0031 (2026-11-04): a live test now covers two recruiters who each have an applicant
**Severity:** P2
**Module:** `tests/backend/live-analysis-isolation.test.mjs`, `tests/backend/live-applicants.test.mjs`
**Spec ref:** FR-14, NFR-9
**Evidence (2026-11-04, T-0031):** `getAllApplicants` takes no job or recruiter parameter. It scopes by the session (`backend/Controllers/analysis.controller.js:533`, `:538`, `:549`), and `applicant_emails` is called only with those ids. So there is no 403 path to test: the expected result for another recruiter is 200 without those rows. The only two-recruiter check (`tests/backend/live-analysis-isolation.test.mjs:90-92`) uses R2, who owns no jobs, and `before` seeds **no application** (`:40-59`). R2 therefore returns at `:543`, before the applications query and the RPC. `live-applicants` signs in only one recruiter. If the scoping were removed, that check would fail only if other live applications happened to exist.
**Impact:** this endpoint now returns real emails through a service-role call, so a scoping regression would expose them, and no test is built to catch it.
**Proposed fix:** give R2 a job with its own application and C an application to R's job; assert that R2 sees only its own applicant, and that C's email is absent from the body.
**Evidence of resolution** (2026-11-04, T-0031): `tests/backend/live-applicants.test.mjs`, test "I-0079": t0001_recr and t0001_recr2 each own a job with one applicant, and each gets 200 with exactly one row, their own candidate's Auth email, and neither the other's application id nor email. It compares facts only, so a failure prints no emails. Proven not vacuous (`tests/.out/t0031-i0079-mutation.log`): passes 6/6 on real code; with `.eq('recruiter_id', recruiterId)` removed from `backend/Controllers/analysis.controller.js:538` it fails, R getting 8 rows of which 7 are someone else's; restored, sha256 identical, 6/6. In both suite passes the test passes.

### I-0028 — `/api/recruiter/applicants` returns an empty email for most applicants (RESOLVED)
**Status:** RESOLVED T-0031 (2026-11-04): recruiters get the real Auth email for every applicant
**Severity:** P1 (corrected, T-0031: the email is blank for every applicant, and `frontend/src/pages/recruiter/AllCandidates.jsx:20` is a live caller)
**Module:** `backend/Controllers/analysis.controller.js` (`getAllApplicants`)
**Spec ref:** FR-14 (recruiter view), loosely
**Evidence:**
- **Before T-0003 (ad4f694):** the handler selected `profiles.email`, which doesn't exist. Every profile lookup failed, so every row fell back to `auth.admin.getUserById`, which supplied the email (an N+1).
- **After R30 fix 5 (T-0003 Phase 4):** names come from one `.in()` profiles query. Only candidates without a profile row fall back to the auth record, so `candidateInfo.email` is `''` for every candidate who has a profile.
- **Live probe:** the `t0001_cand` application row returned `email empty: True` (`tasks/T-0003-apply-integration.md`, Phase 4).
- **Callers:** nothing calls this endpoint now. The baseline Dashboard (R38) uses `/api/candidates`, whose email comes from the parsed resume contact.
**Impact:** None today. The merged application-centric Dashboard (score-on-apply follow-up) would show blank emails if it relies on this field.
**Proposed fix:** Decide in the score-on-apply task where applicant email comes from: the resume contact (as `serializeCandidate` does), or one batched auth lookup. Don't reintroduce a per-row N+1.
**Evidence of resolution** (2026-11-04, T-0031): `backend/Services/applicantIdentity.js:15`, `public.applicant_emails` (`supabase/migrations/20261104120300_applicant_emails.sql`, pushed by the owner; `db diff --linked`: `No schema changes found`). `tests/backend/live-applicants.test.mjs` 5/5 against the shared project: the email equals Auth, anon and a signed-in candidate get 42501, the service role gets only the requested id. `/recruiter/candidates` in headless Chrome as `t0001_recr` shows the real email and no "No contact info" (`tests/.out/t0031-final-page.json`).

### I-0063 — `getAllApplications` reads a column that does not exist (RESOLVED)
**Status:** RESOLVED T-0031 (2026-11-04): the handler is deleted and the email source is one batched RPC
**Severity:** P2
**Module:** `backend/Controllers/jobs.controller.js`
**Evidence:** `.select('first_name, last_name, email')` on `profiles` (`backend/Controllers/jobs.controller.js:214`); `profiles` has no `email` column (`supabase/migrations/20260823_create_profiles.sql:8-28`). supabase-js returns the error rather than throwing, so `profile` is always null and every applicant falls through to `supabase.auth.admin.getUserById` (`:224`) and names from `user_metadata`.
**Impact:** N Auth Admin calls per request (one per application); names come from signup metadata instead of the profile the user can edit. Authorization itself is correct: applications are limited to the session recruiter's jobs (`:178-200`).
**Proposed fix:** select `first_name, last_name` from `profiles` and take email from Auth only when needed (or batch it).
**Note (T-0031):** the handler and its route are deleted (D2): no caller existed in `frontend/`, `backend/` or `tests/`. The `profiles.email` read is gone with it.
**Evidence of resolution** (2026-11-04, T-0031): `getAllApplications` and its route are gone (D2; grep in `tasks/T-0031-b3-backend-correctness.md`). `getAllApplicants` makes one profiles query plus one RPC and no `getUserById` (`tests/backend/applicant-identity.test.mjs`). `tests/backend/live-applicants.test.mjs` "D2": 404.

### I-0016 — Signup rejects a one-word "Full Name" with a misleading message (RESOLVED)
**Status:** RESOLVED T-0031 (2026-11-04): a one-word name passes signup validation; the database accepts an empty last name
**Severity:** P1 (blocks browser signup for anyone who types a single name)
**Module:** `frontend/src/pages/public/Login.jsx`, `backend/Controllers/auth.controller.js`
**Spec ref:** NFR-8 area (authentication), PROJECT_SOURCE_DOCS.md @ 32905c1
**Reported:** owner, 2026-10-12. Browser signup on the current frontend
(:3000) alerts "First name, last name, username, email, and password are
required" with every visible field filled.
**Evidence (code comparison):**
- **What the form sends**, the same at HEAD and 32905c1:
  - HEAD `Login.jsx:103-111`, baseline `:101-109` build
    `{ email, password, username, role, name }`, plus
    `companyName`/`verificationInfo` for recruiters.
  - The only name input is a single "Full Name" field (HEAD `Login.jsx:303-309`, placeholder "John Doe").
  - The 400 message is shown through `alert(data.message)` at HEAD `:129`.
- **What the controller requires**, the same logic at both revisions (HEAD `auth.controller.js:129-137`, baseline `:207-215`):
  - It reads `name`, splits it with `.trim().split(/\s+/)`, takes the first token as `firstName`, and joins the rest into `lastName`.
  - It then rejects the request if `!firstName || !lastName`, using the generic message above.
- **Cause:** a one-word Full Name, e.g. "Anthony", gives `lastName === ''`, so the request returns 400 even though every visible field is filled. With username, email and password all non-empty, this is the only path to that message.
  - The message names "First name, last name" fields that don't exist in the form.
  - `Login.jsx` changed by only 8 lines between 32905c1 and HEAD (the env-var line, I-0012), so the defect is **not a regression**. It exists at 32905c1 too.
- Observed workaround: a two-word name (the T-0001 test accounts used "T0001 Candidate" / "T0001 Recruiter" through the API).
**Impact:** Mononymous users, or anyone typing only a first name, can't sign up, and the error doesn't tell them why.
**Proposed fix:** Either accept a single-word name (empty `last_name`), or split
the form into First/Last fields with a specific validation message. Not
fixed in T-0001.
**Evidence of resolution** (2026-11-04, T-0031): `backend/Controllers/auth.controller.js:216` no longer requires `lastName`, and `:217` has the new message. `tests/backend/smoke.test.mjs` "I-0016" reaches the password rule (red at HEAD: the generic message, `tests/.out/t0031-before-offline.log`). `tests/backend/live-signup-role.test.mjs` "an empty last name" proves the database half (control, passes both ways). A one-word signup through the real form has not been run end to end.

### I-0025 — Unbounded in-memory uploads (RESOLVED)
**Status:** RESOLVED T-0031 (2026-11-04): uploads are capped at 10 MB with a JSON error, from one constant equal to the bucket
**Severity:** P2
**Module:** `backend/Controllers/analysis.controller.js` (both baseline and HEAD)
**Spec ref:** NFR-2 (concurrency)
**Evidence:** `multer({ storage: multer.memoryStorage() })` with no `limits`, at HEAD and at `32905c1`. Only the storage bucket enforces 10 MB, and only after the whole file has been buffered in the Node process.
**Impact:** Large uploads are held in memory before rejection, which is a memory-exhaustion risk under concurrent uploads.
**Proposed fix:** `limits: { fileSize: MAX_RESUME_BYTES }` (10 MB, one shared constant), plus a 413 response on `LIMIT_FILE_SIZE`.
**Decision (owner, 2026-11-04, T-0030 D2):** the cap is **5 MB**, the same as the `resumes` bucket's `file_size_limit` that T-0030 sets when the live bucket has none. T-0030 B4 (2026-11-04) read the live bucket: `file_size_limit = 10485760` (10 MB), so the Evidence above is confirmed, and T-0030 mirrors 10 MB rather than setting 5 MB. **Decision (owner, 2026-11-04):** multer uses **10 MB**, the same as the bucket, from **one shared constant** (e.g. `MAX_RESUME_BYTES = 10 * 1024 * 1024`). The frontend's selection-time check (I-0006, B5 / ROADMAP P0-4 (a)) uses the same value. Supersedes the 5 MB note above. Fixed in B3 (ROADMAP P0-3 (d)).
**Evidence of resolution** (2026-11-04, T-0031): `backend/Config/uploadLimits.js:4`; `backend/Middlewares/resumeUpload.js:9-12`, used by both routes (`backend/Controllers/analysis.controller.js:259`, `:288`); `:199` returns `maxResumeBytes`. `tests/backend/upload-limits.test.mjs` (exactly 10485760 accepted, 10485761 gives 413 JSON, constant equals the migration), `tests/backend/live-upload-gates.test.mjs`. Gap left: I-0076.

### I-0027 — 404 handler always says "Cannot GET", whatever the method (RESOLVED)
**Status:** RESOLVED T-0031 (2026-11-04): the 404 message names the real method and path
**Severity:** P3 (misleading message only)
**Module:** `backend/index.js`
**Spec ref:** n/a
**Evidence:** `index.js:68` (`:66@32905c1`, the same line) returns
`{ message: \`Cannot GET ${req.url}\` }` for every unmatched route. Found by the T-0003 probe:
`POST /api/auth/update-password` → `404 {"message":"Cannot GET /api/auth/update-password"}`.
**Impact:** A POST/PUT/DELETE to a missing route reports "GET", which misleads anyone debugging.
**Proposed fix:** Use `` `Cannot ${req.method} ${req.originalUrl}` ``. Not fixed in T-0003 (no row covers it).
**Evidence of resolution** (2026-11-04, T-0031): `backend/index.js:73`; `tests/backend/smoke.test.mjs` "I-0027" (red at HEAD: `Cannot GET …`).

### I-0029 — `shortlistCandidate` 500s on a malformed `applicationId` (RESOLVED)
**Status:** RESOLVED T-0031 (2026-11-04): a malformed `applicationId` gives 400 with no change and no notification
**Severity:** P3
**Module:** `backend/Controllers/jobs.controller.js`
**Spec ref:** n/a
**Evidence:** found during T-0004. Probe as `t0001_recr`: `POST /api/jobs/applications/shortlist {"applicationId":"not-a-uuid","status":"shortlisted"}` → `500 {"message":"Could not update application status."}` (after the T-0004 fix, the ownership lookup hits Postgres `22P02 invalid input syntax for type uuid` and takes the 500 branch).
**Impact:** A malformed id is a client error but is reported as a server error; no data is touched or leaked.
**Proposed fix:** Validate `applicationId` as a UUID before the lookup and return 400. Left out of T-0004 on purpose (Scope: Out).
**Evidence of resolution** (2026-11-04, T-0031): `backend/Services/validation.js:7` (string required), `backend/Controllers/jobs.controller.js:185`. `tests/backend/live-shortlist-authz.test.mjs` "I-0029" ×4. At HEAD three gave 500, and the array form changed the row and sent a notification (`tests/.out/t0031-before-live.log`).

### I-0059 — Hardcoded Windows venv model path in NLP (RESOLVED)
**Status:** RESOLVED T-0031 (2026-11-04): the spaCy model loads by package name only
**Severity:** P2
**Module:** `nlp-engine/app/ner.py`, `nlp-engine/app/preprocessor.py`
**Evidence:** `MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "venv", "Lib", "site-packages", "en_core_web_sm", "en_core_web_sm-3.8.0")` (`nlp-engine/app/ner.py:5`, `nlp-engine/app/preprocessor.py:7`), added on `main`.
**Impact:** machine- and OS-specific (Windows `Lib/`, one venv name, one model version); a fallback like this hides a missing `en_core_web_sm` install instead of failing at boot.
**Proposed fix:** load by package name (`spacy.load("en_core_web_sm")`) and fail loudly at startup if absent; install the model from `requirements.txt`.
**Evidence of resolution** (2026-11-04, T-0031): `nlp-engine/app/ner.py:5`, `nlp-engine/app/preprocessor.py:7`; `tests/nlp/test_model_load.py` (one call with `en_core_web_sm`, the import raises). The parse snapshots for every fixture are byte-identical to `tests/nlp/snapshots/current/`.

### I-0062 — assessment-service calls bypass `internalHttp.js` (RESOLVED)
**Status:** RESOLVED T-0031 (2026-11-04): both assessment calls use `postJson`; the request id reaches assessment-service, which logs and echoes it
**Severity:** P2
**Module:** `backend/Controllers/assessment.controller.js`
**Evidence:** raw `fetch` to `${ASSESSMENT_SERVICE_URL}/generate-assessment` (`backend/Controllers/assessment.controller.js:242`) and `/evaluate-assessment` (`:369`) with their own abort timers; no `X-Request-ID` is sent, unlike `backend/Services/githubEvidence.js` via `backend/Services/internalHttp.js`.
**Impact:** an assessment request cannot be traced across core and the service; timeout/retry/error-shaping rules differ per service.
**Proposed fix:** a `Services/assessmentService.js` client on `internalHttp.js`, carrying the request id. Fits the P2-4 gateway/inter-service work.
**Evidence of resolution** (2026-11-04, T-0031): `backend/Services/assessmentService.js:18-22`; `backend/Services/internalHttp.js` `resolveRequestId`; `assessment-service/app/main.py:36`. `tests/backend/assessment-service-client.test.mjs`, `tests/assessment/test_request_id.py`. The upstream body no longer reaches the client, which was the I-0036 problem on this path.

### I-0065 — Pre-T-0014 score rows keep stale GitHub text on rebuild (RESOLVED)
**Status:** RESOLVED T-0031 (2026-11-04): a rebuild replaces the stale text; stored rows are not rewritten (D3)
**Severity:** P3
**Module:** `backend/Services/explainability.js`
**Evidence:** `rebuildScoreRecord` keeps the stored GitHub entry and only falls back to `not_collected_for_score` when the entry is missing (`backend/Services/explainability.js`, `rebuildScoreRecord`; test "rebuildScoreRecord on a score stored without a GitHub entry"). Every row ever written has all three keys, so a row scored before T-0014 carries `GITHUB_REASONS.service_disabled` ("…not part of this deployment yet"), and a later assessment rebuild keeps that text.
**Impact:** after this merge, the recruiter can see "GitHub is not part of this deployment yet" on an old score that a new assessment just refreshed.
**Proposed fix (owner decision):** also treat a stored GitHub entry that is unavailable and has no `components.reason_code` as `not_collected_for_score`.
**Decision (owner, 2026-11-04, T-0031 D3):** the rebuild fix only. The stored text was true when it was written, because GitHub evidence was not deployed then, so stored rows are not rewritten.
**Evidence of resolution** (2026-11-04, T-0031): `backend/Services/explainability.js:768` `storedGithubSubScore`; `tests/backend/explainability.test.mjs` "I-0065" (red at HEAD) and its control. The 4 live rows change only when an assessment rebuilds them.

### I-0071 — Shortlist control test disagrees with rejection notifications (RESOLVED)
**Status:** RESOLVED T-0031 (2026-11-04): a reject sends one notification with the D4 text, naming the job
**Severity:** P2
**Module:** `tests/backend/live-shortlist-authz.test.mjs`, `backend/Controllers/jobs.controller.js`
**Spec ref:** FR-14/FR-15 (recruiter decisions, candidate notification)
**Evidence (2026-11-04, found in the T-0029 regression run, not caused by it):** the control test asserts that rejecting an application sends no notification (`tests/backend/live-shortlist-authz.test.mjs:106`). `3f53f80` (2026-10-15, T-0016..T-0019 from `main`) added `sendNotification(..., 'rejected', 'Your application has been rejected.')` (`backend/Controllers/jobs.controller.js:303-309`). The test was written in T-0004 (2026-10-12), before that. `tests/.out/t0029-after-full-backend.log` and the isolated rerun `tests/.out/t0029-shortlist-rerun.log`: `1 !== 0`, 10/11 pass. T-0029 changed neither file.
**Impact:** the `-Live` backend suite is red for a reason unrelated to security; a real regression in shortlist ownership could hide behind a known failure.
**Decision (owner, 2026-11-04):** candidates **should** be notified of a rejection; the controller's behaviour is intended.
**Fix (in B3, ROADMAP P0-3 (j), not before):** update the control test to expect exactly one `rejected` notification for the rejected application, and check that its text is neutral and that its payload carries no recruiter-only data (only `applicationId` and `jobId` today, `backend/Controllers/jobs.controller.js:303-309`; no score, notes or recruiter identity). The I-0019 ownership checks in the same file stay as they are.
**Wording (owner, 2026-11-04, T-0031 D4):** a candidate with several applications cannot tell which one was rejected, so the text becomes `The recruiter has decided not to move forward with your application for <job title>.` This extends the fix above to the controller. The title is not recruiter-only data, because the candidate saw it when applying. It comes from the same query, not a second round trip, and the test pins the exact string. The payload stays `applicationId` and `jobId` only.
**Evidence of resolution** (2026-11-04, T-0031): `backend/Controllers/jobs.controller.js:198` (title from the same query), `:234`. `tests/backend/live-shortlist-authz.test.mjs` control test pins the exact text and the payload keys. Mutation run with `score: 99` fails that test (`tests/.out/t0031-j-mutation.log`), reverted.

### I-0072 — nlp-engine `.txt` extraction vs a PDF/DOCX-only bucket (RESOLVED)
**Status:** RESOLVED T-0031 (2026-11-04): `/api/analyze` no longer accepts `.txt`; the bucket is unchanged
**Severity:** P3
**Module:** `nlp-engine/app/extractor.py`, `backend/Controllers/analysis.controller.js`, `frontend/src/pages/candidate/Upload.jsx`
**Spec ref:** n/a (consistency)
**Evidence (2026-11-04, T-0030 B4):** the live `resumes` bucket allows only `application/pdf` and the DOCX type. `extract_text()` also handles `.txt` (`nlp-engine/app/extractor.py:33-34`, from `main` via `7b6dd3d`). A first look: the backend maps only `.pdf`/`.docx` to content types (`backend/Controllers/analysis.controller.js:28-31`), and the upload input has `accept=".pdf,.docx"` (`frontend/src/pages/candidate/Upload.jsx:299`). Not yet checked: every upload route's extension gate, and whether anything calls `/parse` with a `.txt` file.
**Proposed fix (owner, 2026-11-04; in B3, ROADMAP P0-3 (k)):** check every upload path. If none accepts `.txt`, record the NLP branch as unused (test-only), and do **not** widen the bucket. If one does, close that path rather than widening the bucket.
**Evidence of resolution** (2026-11-04, T-0031): `backend/Controllers/analysis.controller.js:31` (shared gate), `:298`. `tests/backend/live-upload-gates.test.mjs`: at HEAD `.txt` gave 200 and a new `resumes` row, both plain and declared as PDF, and the declared one passed the bucket's allow-list (only the plain one logged `InvalidMimeType`). nlp-engine's `.txt` branch (`nlp-engine/app/extractor.py:33-34`) is **unused**: nothing reaches it through core, and no file in `tests/nlp` uses it. Kept by owner decision.

### I-0073 — `evaluateAssessment` 500s on a malformed `assessmentId` (RESOLVED)
**Status:** RESOLVED T-0031 (2026-11-04): a malformed `assessmentId` gives 400 with no database text
**Severity:** P3
**Module:** `backend/Controllers/assessment.controller.js`
**Spec ref:** n/a
**Evidence (2026-11-04, T-0031, from reading the code at `f5069a3`):** `:360` checks only that `assessmentId` is a string. A non-UUID reaches `.eq('id', assessmentId)` (`:377`), which should raise Postgres 22P02, and `:379-381` returns 500 with `loadError.message`. Same class as I-0029. Not run live.
**Impact:** a client error is reported as a server error, and raw database text reaches the client. No data is touched.
**Fix (in B3, ROADMAP P0-3 (l); owner included it, T-0031 D5):** validate with the shared `isUuid` from T-0031 and return 400, with a test.
**Evidence of resolution** (2026-11-04, T-0031): `backend/Controllers/assessment.controller.js:356`; `tests/backend/live-evaluate-once.test.mjs` "I-0073" (red at HEAD: 500). A valid missing id stays 404.

### I-0057 — Duplicate migration version prefixes (RESOLVED)
**Status:** RESOLVED T-0030 (2026-11-04): every migration has a unique 14-digit version; local files and remote history agree
**Severity:** P1
**Module:** `supabase/migrations/`
**Spec ref:** n/a (infra); related I-0010
**Evidence:** `supabase/migrations/` holds `20260903_create_notifications.sql` and `20260903_create_resumes_and_scores.sql`, and `20261015_allow_five_assessment_attempts.sql` and `20261015_create_assessments.sql`. The Supabase CLI takes the digits before the first `_` as the migration version, so each pair shares one version.
**Impact:** `supabase db push` / branching can fail on a duplicate version in `schema_migrations`, or treat the second file of a pair as already applied and skip it. `20261015_allow_five_assessment_attempts` depends on `20261015_create_assessments`, so order inside a pair also matters.
**Proposed fix:** rename to unique 14-digit timestamps preserving order (create before allow-five), then reconcile the remote history (`supabase migration repair`) by hand — touches applied migrations, so its own spec with the owner (I-0010 decision a).
**Update 2026-11-04 (T-0029):** the owner applied `20261103120000_restrict_signup_role`, `20261103120100_create_assessment_keys` and `20261103120200_assessment_grading_claim` in the SQL editor (2026-11-04), so `supabase_migrations.schema_migrations` does not record them: local files the remote history lacks, the opposite direction of I-0010's drift. `20261103120300_drop_assessments_answer_key` will follow the same way. B2's history repair must mark all four applied (`supabase migration repair --status applied 20261103120000 20261103120100 20261103120200 20261103120300`) and not re-run them. History left unchanged for now (owner decision).
**Evidence of resolution** (2026-11-04, T-0029): Eight 8-digit files renamed per the approved table in `tasks/T-0030-migrations-batch.md`; the 20261015 pair took the versions the remote already recorded (`20261015004738`, `20261015034725`; SQL identical). `20260831000000` split into `…000000` (the `add value`) and `20260831000100` (the index, verbatim), because the CLI's per-file transaction cannot use a new enum value (55P04). The owner ran `npx supabase migration repair --status applied` for the 11 hand-applied versions, after `db diff --linked` showed their content live. `npx supabase migration list --linked`: 16/16 Local = Remote. `tests/backend/migration-guards.test.mjs` "every migration has a unique 14-digit version" and "B2 renames match the approved table" (the I-0057 `todo` failed before; 12/12 pass).

### I-0010 — Supabase Preview check fails on `main`; auto-apply decision needed (RESOLVED)
**Status:** RESOLVED T-0030 (2026-11-04): the Supabase Preview check is green, and production deploys stay off
**Severity:** P1 (not tech debt: see Impact)
**Module:** `supabase/migrations/`, Supabase GitHub integration (project
`zzgymrxrwuuffyrbhify`)
**Spec ref:** n/a (infra)
**Evidence:**
- There is no `.github/workflows` directory at any commit
  (`git log --all -- .github` empty; `gh run list` empty). The red check on
  commits is the **Supabase Preview** check-run from the Supabase GitHub app.
- `gh api repos/C72-BTECH-PROJECT/Patina/commits/<sha>/check-runs` for
  `32905c1` and `cc0e637` (both on `main`): `Supabase Preview | supabase |
  completed failure` with summary
  `ERROR: type "patina_user_role" already exists (SQLSTATE 42710) At
  statement: 0 -- Patina: Supabase Auth profile schema`. For `92db9f0`
  (`Anthony_V2`): `completed skipped` — "This git branch is not associated
  with any Supabase Branch".
- Cause: `supabase/migrations/20260823_create_profiles.sql:6` is an
  unguarded `create type public.patina_user_role ...`; the file header says
  "Run once in the Supabase Dashboard SQL Editor", i.e. the schema was
  applied by hand, so the integration replaying migrations collides.
- **Update 2026-10-31 (T-0023):** `3f53f80` (head of `main`) fails the same
  check for a different reason. `gh api .../commits/3f53f80/check-runs`:
  `Supabase Preview | supabase | failure`, summary `Remote migration versions
  not found in local migrations directory.` So the hosted DB's migration
  history now holds versions that no file in `supabase/migrations/` has —
  consistent with schema applied by hand (L-0035/L-0037 record the two
  20261015 migrations as "applied"). Not re-checked against the remote
  history table (needs dashboard/CLI access). Duplicate version prefixes are
  tracked separately in I-0057.
- **Update 2026-11-04 (T-0029):** the reverse drift now exists too. The four
  T-0029 migrations (`20261103120000`..`20261103120300`) are applied by hand in
  the SQL editor and absent from `supabase_migrations.schema_migrations`. B2's
  repair marks them applied; see I-0057. History not changed now (owner).
**Impact:** Today the integration fails at statement 0, so nothing is
applied. Once the migrations succeed (e.g. someone makes them idempotent),
**every merge to `main` will auto-apply schema changes to the shared
production DB** that both teammates and the test harness use.
**Decision options (not acted on):**
- (a) Disable production auto-deploy of migrations in the Supabase GitHub
  integration settings, and keep applying schema by hand / via CLI.
- (b) First make every migration idempotent (`create ... if not exists`,
  `do $ begin ... exception when duplicate_object then null; end $;` for
  types/policies), accepting that merges to `main` then deploy schema
  automatically.
**Decision (2026-10-12, owner):** chose option (a) and **disabled production
auto-deploy of migrations in the Supabase GitHub integration**. Recorded as
reported by the owner; not independently verified from the repo (the setting
lives in the Supabase dashboard). Consequence: schema stays applied by hand /
CLI, merges to `main` no longer deploy schema.
**Remaining work:** the migrations still collide on replay (e.g.
`20260823_create_profiles.sql:6` unguarded `create type`), so the Preview
check may still show red and any future replay (branching, fresh env) will
fail. Making them idempotent is tracked with I-0001/I-0007/I-0013. Close this
issue when that is done and the Preview check is verified.
**Proposed fix:** Option (a) taken; fix the migrations (idempotent) to finish.
**Note (2026-10-12, T-0003):** both 20260903 migrations are now in the repo, and both are still unguarded:
- `create table public.resumes` / `public.scores` (`20260903_create_resumes_and_scores.sql:18,41`);
- `create table public.notifications` (`20260903_create_notifications.sql:6`).

T-0003 kept them verbatim. R19 and R33 put their idempotency in this batch.

**Note (2026-10-12, after the PR #3 merge):** the Supabase check still ran on merge commit `7c83293` (PR #3, `Anthony_V2` into `main`; parents `cc0e637` and `bef8f9e`), after production auto-deploy had been disabled. `gh api repos/C72-BTECH-PROJECT/Patina/commits/7c83293/check-runs`: `Supabase Preview | supabase | completed | failure`, 08:00:45Z to 08:00:54Z, summary `ERROR: type "patina_user_role" already exists (SQLSTATE 42710) At statement: 0`, the same error as on `32905c1` and `cc0e637`.
- What this shows: disabling production auto-deploy did not stop the Preview check; the check is a separate replay of the migrations that still collides at statement 0. Nothing was applied (the error is at statement 0), so no schema reached production.
- What it does not show: whether the dashboard setting is really off. That is still only the owner's report. The failure is the same one as before the setting changed, so it neither confirms nor contradicts it.
- Consequence: the check will stay red on every push and merge until the migrations are idempotent. That is the remaining work above; the "Preview check is verified" close condition is still not met.

---
**Evidence of resolution** (2026-11-04, T-0029): `gh api repos/C72-BTECH-PROJECT/Patina/commits/68763e0/check-runs`: `Supabase Preview | completed | success` (2026-11-04 08:34:15Z–08:34:22Z), the first green run. Before: `failure`, "Remote migration versions not found in local migrations directory" on `edb1a37`. The owner confirmed in the dashboard (2026-11-04) that production deploys in the GitHub integration are off (decision a, 2026-10-12). Fresh replay of all 16 migrations on a local stack: exit 0. `npx supabase db diff --linked` for `public` and `auth,storage` after the push: `No schema changes found` (`tests/.out/t0030-diff3-*`). Replay safety comes from history alignment plus the runbook (`Docs/SUPABASE_MIGRATIONS_RUNBOOK.md`: `db push --linked` only, never `--include-all`, never `db reset --linked`). Guards were not added to the applied files (owner decision).

### I-0001 — `resumes` storage bucket not in any migration (RESOLVED)
**Status:** RESOLVED T-0030 (2026-11-04): the `resumes` bucket limits are in a migration, mirroring live
**Severity:** P1
**Module:** `supabase/migrations/`, `backend/Controllers/analysis.controller.js`, `backend/Controllers/jobs.controller.js`
**Spec ref:** n/a (infra/deployment gap, not a feature spec item)
**Evidence:**
- The `resumes` storage bucket was created manually in the Supabase dashboard
  (2026-08-31) with an `allowed_mime_types` allow-list. It is not defined in
  any file under `supabase/migrations/` (confirmed current migrations:
  `20260823_create_profiles.sql`, `20260830_create_jobs_and_applications.sql`,
  `20260831_add_single_admin_role.sql`, `20260901_add_profile_suspension.sql`,
  `20260903_create_notifications.sql` — none create a storage bucket).
- `backend/Controllers/analysis.controller.js:14,24,38,60` and
  `backend/Controllers/jobs.controller.js:94` do `.from('resumes')` against
  Supabase Storage, so the app depends on a bucket that only exists because
  someone created it by hand.
**Impact:** A fresh environment (new Supabase project, teammate's local
setup, CI) will not have the bucket and resume upload/retrieval will fail
with no migration to explain why.
**Proposed fix:** Move bucket creation + MIME allow-list config into a
migration (Supabase supports this via `storage.buckets` inserts or the
management API in a migration script).
**Note (2026-10-12, T-0002):**
- **The bucket insert used to exist.** `20260903_create_resumes_and_scores.sql:14-16@32905c1` created it (`id/name/public` only). `314e494` deleted that migration.
- **Never in any migration:** the MIME allow-list and the 10 MB cap.
- **Live check:** read-only bucket listing on 2026-10-12: `resumes` is private, `allowed_mime_types` = pdf + docx.
- See INTEGRATION_REVIEW.md R19 and §7.
**Note (2026-10-12, T-0008):** partly stale at HEAD `2e87d44`. The bucket insert is back in `supabase/migrations/20260903_create_resumes_and_scores.sql:14-16` (restored by `a7c74e4`). What is still missing from any migration is the MIME allow-list and the 10 MB cap. Left OPEN for that; not re-verified against the live project.
**Note (2026-10-12, T-0003): still OPEN.**
- **The bucket insert is back:** the restored `20260903_create_resumes_and_scores.sql:14` has `insert into storage.buckets (id, name, public)` (committed in `a7c74e4`, R19).
- **Still in no migration:** the MIME allow-list (pdf/docx) and the 10 MB size cap. A fresh environment gets a bucket without them.
- **The backend no longer depends on the allow-list for correctness:** `saveResumeToStorage` now sends the extension-derived content type, and `uploadResume` accepts only `.pdf`/`.docx` (R7, `e9e4592`).

---
**Evidence of resolution** (2026-11-04, T-0029): `supabase/migrations/20261104120000_resumes_bucket_limits.sql` (10 MB, `application/pdf` + the DOCX type), pushed by `npx supabase db push --linked`. Owner B4 check after the push: `public: false`, `file_size_limit: 10485760`, `allowed_mime_types` unchanged. The fresh local replay creates the bucket with those limits. `migration-guards` "resumes bucket limits live in a migration". The backend multer cap (10 MB, shared constant) stays with I-0025 in B3.

### I-0041 — Migration comment describes an outdated `scores.subscores` shape (RESOLVED)
**Status:** RESOLVED T-0030 (2026-11-04): `scores.subscores` has a database comment describing the stored shape
**Severity:** P3
**Module:** `supabase/migrations/20260903_create_resumes_and_scores.sql`
**Spec ref:** n/a (documentation accuracy)
**Evidence (T-0010):**
- The column comment says `"github_evidence": null, -- module not built yet` and `"assessment_results": null` (`supabase/migrations/20260903_create_resumes_and_scores.sql:48-53`).
- The code stores a full unavailable sub-score object instead: `{key, label, available:false, value:null, weight:0, reason, components:null, evidence:[]}` (`backend/Services/explainability.js:121-130`, `:447`).

**Impact:** someone reading the schema expects `null` and mis-parses stored rows. Once ROADMAP P1-4 stores real GitHub sub-scores, the comment is wrong in both directions.
**Proposed fix:** correct the comment in ROADMAP P3-15 (migrations hygiene). Schema is applied by hand (I-0010), so a comment-only change needs no re-apply.

---
**Evidence of resolution** (2026-11-04, T-0029): `supabase/migrations/20261104120100_scores_subscores_comment.sql`, pushed. Owner check: `col_description` returns "Object keyed by parsing_semantic_alignment, github_evidence and assessment_results. Every entry has the same shape…". The stale `--` lines in the applied `20260903000100_create_resumes_and_scores.sql:48-53` are left as they are (applied files are not edited); the database comment is the source of truth. `migration-guards` "scores.subscores has a database comment".

### I-0055 — `handle_new_user()` trusts the role in signup metadata (HIGH) (RESOLVED)
**Status:** RESOLVED T-0029 (2026-11-04): signup role goes through `public.assert_signup_role()`; anything but candidate/recruiter raises 22023 and GoTrue rolls the user back
**Severity:** P0 (security: privilege escalation)
**Module:** `supabase/migrations/20260823_create_profiles.sql`
**Spec ref:** CHECKLIST 0.5 area (auth/roles); n/a for a numbered item
**Evidence (read 2026-10-31, T-0023):**
- The trigger inserts `(new.raw_user_meta_data ->> 'role')::public.patina_user_role` into `profiles.role` (`supabase/migrations/20260823_create_profiles.sql:58`), fired `after insert on auth.users` (`:68-70`). The enum has included `admin` since `20260831_add_single_admin_role.sql:5`.
- The backend's `signup()` limits the role to `candidate`/`recruiter` (`backend/Controllers/auth.controller.js:6`, `:218`), but that only guards the backend path. GoTrue's `/auth/v1/signup` accepts arbitrary `options.data` from anyone holding the anon key.
- The anon key is designed to be public in Supabase's model. Today it is only in `backend/.env` (no Supabase client in `frontend/src`), but this must not depend on the key staying secret.
**Impact:** anyone with the anon key can sign up with `role: 'admin'` and get an admin profile while no admin exists (the unique index `profiles_single_admin_role` blocks a second one), or `recruiter` without going through the backend's checks. `requireRole('ADMIN')` then authorises them (`backend/Middlewares/auth.Middleware.js:41-46` reads the session role set from `profiles.role` at login).
**Proposed fix:** `handle_new_user()` accepts only `'candidate'` and `'recruiter'` from metadata and rejects (raises on) anything else; `admin` is assigned only by the manual SQL path (`20260831_add_single_admin_role.sql:16`). New migration, idempotent, applied by hand per I-0010.
**Evidence of resolution** (2026-11-04, T-0029): `supabase/migrations/20261103120000_restrict_signup_role.sql` (owner applied 2026-11-04). Static gate `tests/backend/migration-guards.test.mjs` (failed on `df98068`, `tests/.out/t0029-before-offline.log`; passes, `tests/.out/t0029-after-offline.log`). Live `tests/backend/live-signup-role.test.mjs` 10/10 (`tests/.out/t0029-after-live-signup-role.log`): service-role RPC with 'admin', 'superuser' and null → `22023 invalid signup role`; anon RPC refused; `auth.admin.createUser` with role superuser, admin or none → error, no auth user, no profile; a candidate signup still gets `profiles.role = candidate`. The owner's check: anon and authenticated lack execute on the function.

### I-0056 — Any recruiter can fetch any candidate's résumé (RESOLVED)
**Status:** RESOLVED T-0029 (2026-11-04): `GET /api/resume/candidate/:id` needs a UUID (400) and an application by that candidate to one of the caller's jobs (404 otherwise)
**Severity:** P0 (security: candidate PII exposure across recruiters)
**Module:** `backend/Controllers/analysis.controller.js`, `backend/Routes/analysis.routes.js`
**Spec ref:** CHECKLIST 5.x recruiter views; T-0004/T-0007 authorization pattern
**Evidence (working tree after the T-0023 merge):**
- `GET /api/resume/candidate/:candidateId` is `requireRole('RECRUITER')` only (`backend/Routes/analysis.routes.js:13`).
- `getCandidateResume` (`backend/Controllers/analysis.controller.js:205-235`) lists `candidates/${candidateId}` and signs a 60 s URL (`:211`, `:224`) with no check that the candidate applied to one of the session recruiter's jobs, and `candidateId` from the URL is not validated as a UUID before it becomes a storage prefix.
**Impact:** any recruiter account can download any candidate's résumé by id; candidate ids appear in other recruiter-facing responses.
**Proposed fix:** require an `applications` row joining the candidate to a job with `recruiter_id = session.userId` (same shape as the shortlist check, `backend/Controllers/jobs.controller.js:271-279`); validate `candidateId` as a UUID; a live authz test like `live-analysis-isolation`.
**Evidence of resolution** (2026-11-04, T-0029): `backend/Controllers/analysis.controller.js:203-239`. `tests/backend/live-resume-authz.test.mjs` 5/5 (`tests/.out/t0029-after-live-resume-authz.log`); before (`tests/.out/t0029-before-live.log`): R2 got 200 with a URL, `not-a-uuid` got 404.

### I-0058 — Auth users with no `profiles` row; signup reports success anyway (RESOLVED)
**Status:** RESOLVED T-0029 (2026-11-04): signup returns 201 only when the trigger-created `profiles` row exists; otherwise it deletes the auth user and returns 500
**Severity:** P1
**Module:** `backend/Controllers/auth.controller.js`
**Spec ref:** n/a (auth robustness)
**Evidence (read 2026-10-31, T-0023):**
- Root cause: `signup()` inserts the profile (`backend/Controllers/auth.controller.js:257`) and on failure only logs (`:268`), then returns 201 (`:271`). A row is missing only when both the `handle_new_user` trigger and this insert failed, e.g. the trigger is not on the hosted DB (cf. I-0010's migration drift) and the insert hits the `lower(username)` unique index; users created in the dashboard also have none.
- `main`'s workaround (`3f53f80`, dropped here): when no profile matched the username, `login()` called unpaginated `auth.admin.listUsers()` (first page only), matched `user_metadata.username` (plus `raw_user_meta_data`, which the JS user object never has), took the role from `user_metadata` and hard-coded `is_suspended: false`; it also turned the profile-lookup-error 503 into a 401.
- Why it was not a live escalation: metadata is backend-written at signup with role ∈ {candidate, recruiter}; and a session for a user with no profile row is rejected on every request by `requireAuth` (`backend/Middlewares/auth.Middleware.js:11-28`), which also re-checks `is_suspended` by id. It becomes dangerous the moment `requireAuth` stops failing closed.
**Impact:** such a user sees "Account created", then "Invalid username or password" at login, with no signal to anyone why.
**Proposed fix:** `signup()` checks that a `profiles` row exists for `data.user.id` after the insert; if not, deletes the auth user (`auth.admin.deleteUser`) and returns 5xx with a clear message. No metadata fallback at login.
**Evidence of resolution** (2026-11-04, T-0029): `backend/Services/signupProfile.js` (`ensureProfileOrRollback`; skips rollback for GoTrue's obfuscated existing-account answer, `identities: []`), called at `backend/Controllers/auth.controller.js:261`. `tests/backend/signup-profile.test.mjs` 6/6 offline (module absent on `df98068`). Not live: a backend signup sends a real email; T-0029 criterion 9 is the owner's manual check.

### I-0017 — Signup's explicit `profiles` insert duplicates the DB trigger (RESOLVED)
**Status:** RESOLVED T-0029 (2026-11-04): the explicit `profiles` insert is gone; the trigger is the only writer
**Severity:** P3 (log noise; profile data correct)
**Module:** `backend/Controllers/auth.controller.js`
**Spec ref:** n/a
**Evidence:** Creating `t0001_cand` / `t0001_recr` through the baseline API
(2026-10-12) returned 201, and the backend logged
`Signup profile insert failed: duplicate key value violates unique constraint "profiles_pkey"`
twice (`tests/.out/signup-backend.err.log`). The trigger
`on_auth_user_created` (`supabase/migrations/20260823_create_profiles.sql`,
`after insert on auth.users` → `insert into public.profiles`) already creates
the row from signup metadata. The controller then inserts the same `id` again
(HEAD `auth.controller.js:168-180`, baseline `:255-268`), and that error is
only logged. The resulting profiles had correct username, role and names.
**Impact:** A misleading error on every signup. If the trigger and the insert ever diverge, the insert's values are silently dropped.
**Proposed fix:** Remove the controller insert, or make it an `upsert` and handle the error.

---
**Evidence of resolution** (2026-11-04, T-0029): `backend/Controllers/auth.controller.js:258-264` (no insert); source guard in `tests/backend/signup-profile.test.mjs` ("auth.controller.js no longer inserts profiles"), which failed on `df98068` (`:257-265`).

### I-0060 — assessment-service port mismatch (RESOLVED)
**Status:** RESOLVED T-0029 (2026-11-04): the service binds 127.0.0.1:8002 by default (`ASSESSMENT_HOST`/`ASSESSMENT_PORT`), starts with `python -m app`, and the README and `backend/.env.example` say :8002
**Severity:** P2
**Module:** `assessment-service/README.md`, `backend/Controllers/assessment.controller.js`, `backend/.env.example`
**Evidence:** the README starts the service with `--port 8000` (`assessment-service/README.md:249`, `:252`, `:270`), which is the NLP port; the backend defaults `ASSESSMENT_SERVICE_URL` to `http://localhost:8002` (`backend/Controllers/assessment.controller.js:11-12`), and `backend/.env.example` does not name `ASSESSMENT_SERVICE_URL`.
**Impact:** following the README either fails to bind (NLP running) or shadows NLP; the backend then gets connection errors on :8002.
**Proposed fix:** README says :8002; add `ASSESSMENT_SERVICE_URL` to `backend/.env.example`; ARCHITECTURE port table.
**Evidence of resolution** (2026-11-04, T-0029): `assessment-service/app/config.py:31-32`, `assessment-service/app/__main__.py`, `assessment-service/README.md` §10.3, `backend/.env.example:15`. `tests/assessment/test_internal_only.py` 5/5 (`tests/.out/t0029-after-assessment.log`; before 4 fail, `tests/.out/t0029-before-assessment.log`).

### I-0061 — assessment-service exposes FastAPI docs (RESOLVED)
**Status:** RESOLVED T-0029 (2026-11-04): FastAPI docs, redoc and the OpenAPI schema are off
**Severity:** P2
**Module:** `assessment-service/app/main.py`
**Evidence:** `FastAPI(title=..., description=..., version=...)` (`assessment-service/app/main.py:10-16`) leaves `docs_url`, `redoc_url`, `openapi_url` at their defaults; the README points at `/docs` (`assessment-service/README.md:261`). DEC-5 (ROADMAP) turns them off for internal services, as github-evidence does.
**Proposed fix:** `docs_url=None, redoc_url=None, openapi_url=None`; drop the README line.
**Evidence of resolution** (2026-11-04, T-0029): `assessment-service/app/main.py:18-20`. `tests/assessment/test_internal_only.py::test_docs_are_off` (before: 200 on all three).

### I-0066 — The assessment answer key is readable outside the backend (RESOLVED)
**Status:** RESOLVED T-0029 (2026-11-04): keys live in `public.assessment_keys` (RLS on, no policy, no anon/authenticated grant); `assessments.answer_key` is dropped
**Severity:** P0 (security: lets a candidate cheat on their own assessment)
**Module:** `supabase/migrations/20261015_create_assessments.sql`, `assessment-service/app/main.py`
**Evidence (read 2026-10-31):**
- RLS policy "Candidates can read their own assessments" is `for select to authenticated using ((select auth.uid()) = candidate_id)` (`supabase/migrations/20261015_create_assessments.sql:49-51`), with no column restriction, so it covers `answer_key`, which the open attempt stores at generation time (`backend/Controllers/assessment.controller.js:286`). A candidate who signs in to GoTrue directly with the public anon key (same reasoning as I-0055) can read the key for the attempt they are taking. The backend itself strips the key (`backend/Controllers/assessment.controller.js:21-24`, `:313`).
- `POST /generate-assessment` returns `answer_key` to any caller (`assessment-service/app/main.py:33-38`, comment: "trusted development endpoint"), and the service has no authentication; it relies on binding to 127.0.0.1.
**Proposed fix:** move `answer_key` to a table (or column privilege) with no `authenticated` SELECT grant, readable only by the service role; for the service, internal auth or network isolation per ARCHITECTURE §4 (gateway/containers).
**Evidence of resolution** (2026-11-04, T-0029): M2 `supabase/migrations/20261103120100_create_assessment_keys.sql` and M4 `20261103120300_drop_assessments_answer_key.sql`, applied by the owner 2026-11-04 after the copy check (0 attempts without a key, 0 mismatches) and a locked-down backup (`assessments_answer_key_backup`, anon/authenticated read false). Backend writes keys only to the key table (`backend/Controllers/assessment.controller.js:330-337`) and reads them only inside grading (`:403-418`). `tests/backend/live-answer-key-access.test.mjs` 5/5 after M4 (`tests/.out/t0029-after-live-answer-key-access.log`): the candidate's and the recruiter's own PostgREST reads return no `answer_key`, and the key table is refused to both. Service half: I-0061, I-0060.

### I-0069 — Concurrent submits of one assessment attempt (RESOLVED)
**Status:** RESOLVED T-0029 (2026-11-04): evaluate claims the attempt atomically (`claim_assessment_for_grading`), grades, completes only under its claim, and releases on failure; a claim older than 10 minutes can be retaken
**Severity:** P2
**Module:** `backend/Controllers/assessment.controller.js`
**Evidence:** evaluate checks `status === 'completed'` on the row it read (`backend/Controllers/assessment.controller.js:357-359`), grades, then updates with `.eq('id', …).eq('status', 'generated')` (`:396-406`) without checking how many rows changed. Two submits that both read `generated` both grade; the second update matches 0 rows, yet its result is returned and folded into the score (`:415-442`).
**Impact:** the stored attempt and the credibility score can disagree; one candidate can spend two LLM gradings per attempt.
**Proposed fix:** `.select()` the update and treat 0 rows as 409, before the score rebuild.
**Evidence of resolution** (2026-11-04, T-0029): M3 `supabase/migrations/20261103120200_assessment_grading_claim.sql` (owner applied 2026-11-04); `backend/Services/gradingClaim.js`; `backend/Controllers/assessment.controller.js:391-469`. `tests/backend/grading-claim.test.mjs` 7/7 offline. `tests/backend/live-evaluate-once.test.mjs` 3/3: 5 concurrent submits → one 200, four 409, score folded once (before: 200 ×5); a fresh claim → 409 for evaluate and `grading_in_progress` for generate; an 11-minute-old claim is reclaimed. `tests/backend/live-evaluate-release.test.mjs` 1/1 with :8002 stopped: 502, row back to `generated`, a retry claims again.

### I-0070 — Supabase project host does not resolve (RESOLVED)
**Status:** RESOLVED T-0028 (2026-11-03): the owner restored the Supabase project on 2026-11-03; no code or `.env` change
**Severity:** P0 (blocks the demo and every live test)
**Module:** Supabase project (infra); `backend/.env` `SUPABASE_URL`
**Evidence (2026-10-31, T-0023):** the backend suite failed one test, "POST /api/auth/login with unknown username -> 401, no session cookie": 503 after ~7 s (`tests/.out/t0023-backend.log`), and the backend logged `Login profile lookup failed: TypeError: fetch failed`. A direct `dns.lookup` of the project host from `backend/.env` gives `ENOTFOUND`, while `github.com`, `supabase.co` and `api.supabase.com` resolve from the same machine, with and without the sandbox. The 503 is `login()`'s designed answer when the profile lookup errors, so this is not a code regression.
**Likely cause (unverified):** the project is paused (free-tier inactivity) or was removed or renamed; `backend/.env` may point at an old ref.
**Proposed fix:** owner checks the project in the Supabase dashboard (restore/unpause, or update `SUPABASE_URL`/keys), then re-runs `tests\run-suite.ps1 -Target current -Suites backend`.
**Evidence of resolution** (2026-11-03, T-0028, backend running from `df98068` on :5000): `nslookup` of the project host in `backend/.env` resolves (Cloudflare address); `node --test tests/backend/smoke.test.mjs` → 7/7 pass, including "POST /api/auth/login with unknown username -> 401, no session cookie" (2.5 s), the test that failed with 503 in T-0023. Cause (paused vs renamed) not recorded; the owner restored it from the dashboard.

### I-0051 — AUDIT rows 0.1 and GR-2 predate github-evidence (RESOLVED)
**Status:** RESOLVED T-0028 (2026-11-03), re-verified against `df98068`; fixed during the T-0023 AUDIT refresh, no code change
**Severity:** P3
**Module:** `AUDIT.md`
**Evidence (T-0015):** row 0.1 says "1 of the 3 Python services exists" and "`backend/Controllers/githubAggregator.js` is unused"; the GR-2 row says "1 of the 3 SRS services exists". Since T-0011..T-0014 github-evidence runs on :8001 and `githubAggregator.js` is deleted. ARCHITECTURE.md now says 2 of 3. T-0015 added probe evidence to GR-2 but kept its scope to evidence and did not rewrite these sentences.
**Impact:** AUDIT and ARCHITECTURE disagree on the service count.
**Proposed fix:** re-verify rows 0.1 and GR-2 in the next AUDIT pass (the statuses should stay `STUBBED_OR_PARTIAL`).
**Evidence of resolution** (`df98068`): AUDIT row 0.1 (`AUDIT.md:77`) now says all 3 Python services exist as separate processes (T-0023) and no longer names `githubAggregator.js`; the GR-2 row (`AUDIT.md:212`) says "All 3 SRS services exist since the T-0023 merge". Both stay `STUBBED_OR_PARTIAL`, as the proposed fix said. Re-checked by a T-0028 subagent read and `sed -n 77p` / `212p`.


### I-0005 — `Assessment.jsx` unrouted, no backend, silently serves mock data (RESOLVED)
**Status:** RESOLVED by `main`'s assessment work (T-0024..T-0027, merged in T-0023); re-verified at file level, not by a UI run.
**Severity:** P1
**Module:** `frontend/src/pages/candidate/Assessment.jsx`
**Evidence of resolution** (working tree after the T-0023 merge, 2026-10-31):
- Routed: `<Route path="assessment" element={<Assessment />} />` (`frontend/src/App.jsx:65`).
- Backend exists: `app.use('/api/assessment', assessmentRoutes)` (`backend/index.js:65`); `POST /generate` and `/evaluate` are `requireRole('CANDIDATE')` (`backend/Routes/assessment.routes.js:9-10`); `tests/backend/assessment-generate.smoke.mjs` checks both routes exist and are guarded.
- No mock fallback: `Assessment.jsx` calls `${API_BASE_URL}/api/assessment/generate` (`:58`) and `/evaluate` (`:126`) through `authFetch`; `grep -i mock` on the file returns nothing.
- Original problem (pre-WORKLOG): no route mounted the page, no backend route existed, and the page silently fell back to `MOCK_QUESTIONS`.

### I-0049 — ARCHITECTURE.md as-is sections still describe the pre-T-0014 GitHub path (RESOLVED)
**Status:** RESOLVED T-0015 (mapped to ROADMAP P1-5 by the owner): the as-is GitHub path is refreshed with cites.
**Severity:** P3
**Module:** `ARCHITECTURE.md`
**Evidence of resolution** (T-0015, 2026-10-15):
- Component table, edge table, diagram, §0, §1.7, §1.8 and §2 describe github-evidence on :8001 and core's client (`backend/Services/githubEvidence.js:100`, `backend/Services/internalHttp.js:61`) with the reason codes; Appendix A.2 holds the P-4..P-6 output.
- Every cite into `backend/Controllers/analysis.controller.js`, `tests/run-suite.ps1` and `nlp-engine/app/ner.py` was re-pointed by diffing `8e8e498` against the working tree (for example the NLP `fetch` moved from 262 to 273).
- `node tests/docs/check-trackers.mjs` → 228 cites OK, 0 warnings. The verified-at hash was not changed: the work is uncommitted, so the new text says it was checked against the working tree on top of `f65d5b2`.

### I-0008 — `Docs/IMPLEMENTATION-TRACKER.md` Firestore/MongoDB sections are stale doc drift (RESOLVED)
**Status:** RESOLVED T-0008: tracker archived, Firestore/MongoDB content replaced by the verified Supabase data model in `AUDIT.md`.
**Severity:** P2
**Module:** `Docs/IMPLEMENTATION-TRACKER.md`
**Spec ref:** n/a (documentation accuracy, not a feature)
**Evidence (verified 2026-10-12 per user request before filing):**
- Repo-wide case-insensitive grep for `firebase|firestore` across all
  `.js/.jsx/.json/.py/.env*/.txt/.md` files (excluding `node_modules`,
  `venv`, `.git`) found **zero** Firebase/Firestore dependencies or
  integration code anywhere. The only hit outside the tracker doc itself is
  `nlp-engine/app/ner.py:19`, where `"firebase"` is just a generic string in
  the `SKILL_KEYWORDS` list (for matching it on resumes) — not a project
  dependency.
- `git log -S "Firestore" -- Docs/IMPLEMENTATION-TRACKER.md` resolves to a
  single commit, `ad4f694` ("merge: integrate Aaron, Anthony, and
  aditya-ui-work into main") — a merge commit. The file has no prior history
  on either merge parent in this branch's log, so the exact original
  authoring commit isn't resolvable from current history; it entered `main`
  as part of that three-way branch integration.
- Per CLAUDE.md, Supabase is the authoritative DB (the SRS originally
  specified MongoDB; Supabase was the actual implementation choice) — so the
  tracker's "Database (Document): Firebase Firestore" row and the
  MongoDB-to-Supabase-"+Firestore" migration section (lines 17, 60-118,
  165-169, 180-182, 249) describe a plan that was never implemented and
  isn't the current direction.
- Cross-check of the Firestore collections the tracker names against actual
  Supabase tables (`supabase/migrations/*.sql`):
  | Tracker concept | Actual Supabase equivalent |
  |---|---|
  | `users` | `auth.users` (Supabase Auth) + `public.profiles` |
  | `audit_logs` | **missing** — no migration |
  | `job_descriptions` | `public.jobs` (relational, not document — same data shape, different storage model) |
  | `parsed_profiles` | **missing** — no table for NLP output (skills/experience/education/projects/noun_chunks/similarity_score) |
  | `github_metrics` | **missing** |
  | `assessments` | **missing** (`public.applications` has a status enum only, no assessment data; see I-0005) |
  | `credibility_scores` | partially exists as an undocumented `public.scores` table — see [I-0007](#i-0007--scores-table-referenced-by-backend-but-not-in-any-migration) |
**Impact:** Low direct runtime impact (no code depends on this doc), but it
risks misleading anyone writing a task spec who cites this section as the
current DB plan, and it's the apparent source of the `credibility_scores`
naming that doesn't match the real `scores` table.
**Note (2026-10-12, L-0005) — `PROJECT_SOURCE_DOCS.md` (restored verbatim from
`32905c1`) also disagrees with the code, left unedited on purpose:** line 106
says "Data (MongoDB, though implementation has moved to Supabase — ..." and
the spec's database wording is MongoDB-based while the code uses Supabase
(Firestore appears only in `Docs/IMPLEMENTATION-TRACKER.md`, not in the spec —
grep of the spec finds no `firestore`/`firebase`). Any reconciliation of the
spec's MongoDB references belongs in the same tracker-reconciliation task.
**Proposed fix:** Out of scope for this session (documentation-only setup
task, not a tracker reconciliation). Leave the tracker as-is until a
dedicated tracker-reconciliation task; this entry exists so the drift is
visible before anyone cites that section as current.
**Note (2026-10-12, T-0002):** inputs for the tracker task are in INTEGRATION_REVIEW.md §8 and row R40:
- **Missing docs:** CHECKLIST / AUDIT / `Docs/project_checklist.md` are missing at HEAD (deleted by `314e494`).
- **Wrong claims:** the tracker also claims "MongoDB models", "Custom NER" and recruiter charts/alerts are done (`:44,50,31`).
- **Name mismatch:** CLAUDE.md's doc names don't match the repo's.
**Evidence of resolution** (T-0008, verified at HEAD `2e87d44`, 2026-10-12):
- `Docs/IMPLEMENTATION-TRACKER.md` and `Docs/project_checklist.md` moved to `Docs/archive/` with headers saying why (Firestore plan never implemented; three done-claims contradicted by code). Its missing-feature list was diffed into `CHECKLIST.md`: every item maps to an id or to Appendix A (X-1, X-2).
- The verified Supabase tables replace the Firestore/MongoDB content: `AUDIT.md` "Data model". Corrections to the table in this entry: `credibility_scores` is `public.scores` (`supabase/migrations/20260903_create_resumes_and_scores.sql:41`; I-0007 is resolved) and `parsed_profiles` is columns on `public.resumes` (`:18`), not a missing table. Still no table for `audit_logs` (X-1), `github_metrics` (2.11) or `assessments` (3.12).
- The note above that CHECKLIST, AUDIT and `project_checklist` are "missing at HEAD" is out of date: restored by `a7c74e4`, reconciled in T-0008. CLAUDE.md's file names are fixed.
- INTEGRATION_REVIEW §8 lists `Docs/Architecture.md` as present; `a7c74e4` deleted it again (it is not in `Docs/`).
- `grep -rniE "firestore|firebase|mongo" *.md` outside `Docs/archive/` now hits only: explanations that the SRS said MongoDB (CHECKLIST 0.2, CLAUDE.md), the AUDIT statement that none exists, `REVIEW_BRIEF.md` (I-0031), `PROJECT_SOURCE_DOCS.md:106` (I-0033), history in ISSUES, WORKLOG, tasks and INTEGRATION_REVIEW, and a lockfile note in `tests/BASELINE_RESULTS.md:25`.
- The spec's own MongoDB wording moved to I-0033.

### I-0021 — `requireAuth` fails open (RESOLVED)
**Status:** RESOLVED T-0006: fail-closed check restored (R35).
**Severity (at time of finding):** P0 (security)
**Module:** `backend/Middlewares/auth.Middleware.js`
**Spec ref:** n/a
**Original entry:** the profile query was wrapped in `try/catch` and only `profile?.is_suspended` blocked, so a query `{ error }` or a missing profile row let the request through. Baselines `72451d1`/`32905c1` returned 401 on `error || !profile`. Changed by `ad4f694`.
**Evidence of resolution** (working tree, 2026-10-12; not yet committed):
- `auth.Middleware.js`: `lookupFailed` is set from `result.error` or a thrown exception; `lookupFailed || !profile` returns 401 `Session is no longer valid.` (same body as `32905c1`); the suspended branch is unchanged.
- **Red run** (`tests/.out/t0006-red.log`): with `t0001_recr2`'s profile row deleted, `GET /api/jobs/mine` and `GET /api/notifications` returned `{"jobsMine":200,"notifications":200}`.
- **Green run** (`tests/.out/t0006-green.log`): both 401; the same cookie returns 200 again after the row is restored.
- **Not verified live:** the query-error and thrown-exception branches (cannot be forced); checked by diff only.
- Full harness: NLP 10/10, backend 24/24, frontend = the same 5 CreateJob/Jobs CI warnings; `sweep.mjs --check` exit 0.

### I-0020 — `POST /api/notifications/send` allows spoofed notifications (RESOLVED)
**Status:** RESOLVED T-0005: route deleted (R34).
**Severity (at time of finding):** P0 (security)
**Module:** `backend/Routes/notification.routes.js`
**Spec ref:** n/a
**Original entry:** `POST /send` was guarded by `requireAuth` only and inserted `{userId, type, message, data}` from the body for any user through the service-role client. Nothing in the frontend called it. Introduced by `ad4f694`.
**Evidence of resolution** (working tree, 2026-10-12; not yet committed):
- `notification.routes.js` now has only `GET /` and `POST /:id/read`; the `sendNotification` import is gone from the route file. `sendNotification` is still used server-side by `shortlistCandidate`.
- **Red run** (`tests/.out/t0005-red.log`): candidate → recruiter `POST /send` gave `{"http":200,"inInbox":true,"inDb":true}`.
- **Green run** (`tests/.out/t0005-green.log`): 404, not in inbox, not in DB; unauthenticated → not accepted; own list and mark-read still work. 4 of 4 here, 15 of 15 together with T-0004's file.
- `grep -rn "notifications/send" frontend/src backend tests` finds only the test file.
- Full harness: NLP 10/10, backend 23/23, frontend = the same 5 CreateJob/Jobs CI warnings; `sweep.mjs --check` exit 0.

### I-0019 — `shortlistCandidate` IDOR (RESOLVED)
**Status:** RESOLVED T-0004: ownership check added (R32), status allow-list narrowed to `shortlisted`/`rejected`.
**Severity (at time of finding):** P0 (security)
**Module:** `backend/Controllers/jobs.controller.js`
**Spec ref:** n/a (authorization)
**Original entry:** no ownership check on `shortlistCandidate`; any recruiter could change any application's status (and trigger a "shortlisted" notification to the candidate). Introduced by `ad4f694`.
**Evidence of resolution** (working tree, 2026-10-12; not yet committed):
- `jobs.controller.js:165` allow-list is `['shortlisted', 'rejected']`; `:172-184` looks the application up with `job:jobs!inner(recruiter_id)` and returns 404 unless `recruiter_id === req.session.userId`.
- **Red run** (`tests/.out/t0004-red.log`, before the fix): recruiter B shortlisting A's application → `{"http":200,"row":"shortlisted","notifications":1}`; rejecting → `{"http":200,"row":"rejected"}`; unknown id → 500; status `"submitted"` → 200. 4 of 11 failed.
- **Green run** (`tests/.out/t0004-green.log`, after): 11 of 11 pass (`tests/backend/live-shortlist-authz.test.mjs`).
- Full harness `run-suite.ps1 -Target current -Live`: NLP 10/10, backend 19/19, frontend = the same 5 CreateJob/Jobs CI warnings; `sweep.mjs --check` exit 0.
- **Follow-up:** malformed ids still 500 (I-0029).

### I-0002 — SkillsSelector hardcoded, never wired (RESOLVED)
**Status:** RESOLVED — superseded by rewrite, no T- ref (code changed before
this tracking system existed)
**Severity (at time of finding):** P2
**Module:** `frontend/src/pages/candidate/Upload.jsx`
**Original entry:** "SkillsSelector in Upload.jsx — hardcoded 'Suggested
Skills' chips, never wired (selectedSkills/onToggle props never passed)."
**Evidence of resolution:** Current `Upload.jsx` (402 lines, as of this
session) contains no `SkillsSelector`, no "Suggested Skills" chips, and no
job `<select>` or "Analyze Resume" button at all — the file was rewritten in
commit `71c632d` (2026-09-03) into a direct single-resume-upload flow
(`POST /api/resume/upload`, `GET /api/resume/status`). The component this
issue described no longer exists.
**Note:** `CODE_MAP.md:385,535,572` still describes the old version of this
file and is itself now stale — not fixed here (out of scope for this
session; flagging only).

### I-0003 — Upload.jsx "Choose File" path didn't validate file type (RESOLVED)
**Status:** RESOLVED — superseded by rewrite; see
[I-0006](#i-0006--uploadjsx-neither-path-validates-file-type-until-submit)
for the current (different) gap in the same file
**Severity (at time of finding):** P1
**Module:** `frontend/src/pages/candidate/Upload.jsx`
**Original entry:** "Upload.jsx 'Choose File' path still doesn't validate
file type (drag-drop does)."
**Evidence of resolution:** The file was rewritten in commit `71c632d`
(2026-09-03). The asymmetry described — drag-drop validating while
Choose-File didn't — no longer exists in the current code: both paths now
behave identically (neither validates at selection, both validate only at
submit via `isResumeFile`). See I-0006 for that current behavior, which is a
different bug, not this one.

### I-0014 — `PROJECT_SOURCE_DOCS.md` deleted from HEAD, still referenced (RESOLVED)
**Status:** RESOLVED — ad-hoc docs task, 2026-10-12 (see WORKLOG L-0005)
**Severity:** P2
**Module:** repo root
**Spec ref:** n/a (docs)
**Original evidence:** added in `fdd22c3`, deleted in `314e494`; still present
unchanged at `32905c1` (266 lines). Referenced by `CLAUDE.md`, `CODE_MAP.md`,
`REVIEW_BRIEF.md`, `tasks/TEMPLATE.md`.
**Evidence of resolution:**
- `git restore --source=32905c1 -- PROJECT_SOURCE_DOCS.md` (no shell
  redirection). Working-tree file is 266 lines.
- `git hash-object PROJECT_SOURCE_DOCS.md` = `6ef3f4a570952273584ee1932d6cae4db0a7217a`
  = `git rev-parse 32905c1:PROJECT_SOURCE_DOCS.md` → byte-identical blob.
- Literal check `git diff 32905c1 -- PROJECT_SOURCE_DOCS.md` is NOT empty
  right now: it prints `deleted file mode`, only because the restored file is
  untracked (not in the index, and we don't stage per CLAUDE.md), so git
  sees it as absent from the tree. Once the owner stages/commits it, that
  command prints nothing. The blob-hash equality above is the real proof.
- Content not edited. Its stale DB wording (line 106: "Data (MongoDB, though
  implementation has moved to Supabase ...)") is recorded in I-0008, not
  rewritten.
**Follow-up for owner:** commit the restored file (untracked right now).

### I-0007 — `scores` table referenced by backend but not in any migration (RESOLVED)
**Status:** RESOLVED T-0003: the deleted migration was restored (INTEGRATION_REVIEW.md R19).
**Severity (at time of finding):** P1
**Module:** `supabase/migrations/`, `backend/Controllers/analysis.controller.js`
**Spec ref:** Docs/IMPLEMENTATION-TRACKER.md's `credibility_scores`
collection (see [I-0008](#i-0008--docsimplementation-trackermd-firestoremongodb-sections-are-stale-doc-drift))
— this `scores` table appears to be the actual, undocumented
implementation of that concept.
**Evidence:** `analysis.controller.js:301-306,391` queries
`supabase.from('scores').select('composite_score')...` keyed by
`candidate_id`/`job_id`. No file under `supabase/migrations/` creates a
`scores` table — same pattern as [I-0001](#i-0001--resumes-storage-bucket-not-in-any-migration).
**Impact:** Same as I-0001: a fresh environment will not have this table,
and every credibility-score read/write will fail silently or error.
**Proposed fix:** Add a migration for `scores` (columns at minimum:
`candidate_id`, `job_id`, `composite_score`, timestamps).
**Note (2026-10-12, T-0002): root cause found.**
- **The migration existed and was deleted.** `scores` was created at `32905c1` by `20260903_create_resumes_and_scores.sql:41-63` (with RLS at `:71-100`). `314e494` deleted that file.
- **The table is live.** A read-only count shows 3 rows.
- **Fix:** restore the migration instead of writing a new one (INTEGRATION_REVIEW.md R19).
- **Line numbers above are now from `ad4f694`.** The `:301-306,391` reads are its `getAllApplicants`/`getAllCandidates`.
- **The schema has no unique `(candidate_id, job_id)`.** So those `.maybeSingle()` reads break after a second analysis (R30).
**Evidence of resolution** (verified at HEAD `5446ebe`, 2026-10-12):
- `supabase/migrations/20260903_create_resumes_and_scores.sql` is back. Its blob `8c9decd` equals `32905c1`'s, and it was committed in `a7c74e4`.
- `:41` has `create table public.scores (` (with RLS further down).
- **The `.maybeSingle()` problem (R30):** the `getAllApplicants` score read now uses `.order('created_at',{ascending:false}).limit(1)` (`5446ebe`). The baseline `getAllCandidates` takes the latest row per candidate in code.
- **Still open:** the migration is not idempotent (unguarded `create table`). That is tracked in I-0010, as R19 decided.

### I-0009 — HEAD `POST /api/analyze` and `/api/resume/upload` always 500 (RESOLVED)
**Status:** RESOLVED T-0003: baseline `analyzeResume` restored (R14, superseding R29).
**Severity (at time of finding):** P0 (blocks the core demo flow at HEAD)
**Module:** `backend/Controllers/analysis.controller.js`
**Spec ref:** FR-1 (PROJECT_SOURCE_DOCS.md @ 32905c1)
**Evidence:**
- Imports are only lines 1-5 (`multer`, `form-data`, `node-fetch`,
  `supabase`); `path` is never imported, yet `saveResumeToStorage` calls
  `path.extname(...)` at `:34`. Every valid request throws
  `ReferenceError: path is not defined` before NLP is called.
- `job` is referenced at `:137` (`latestJob = job;`) and `:144`
  (`form.append('jd', job.description)`) but never defined in that scope.
- NLP URL is hardcoded `http://localhost:8000/parse` at `:146` (the baseline
  read `NLP_PARSE_URL`).
- Not present at baseline 32905c1. ~~introduced by `71c632d`~~: **corrected in
  T-0002**, see the note below.
**Impact:** Candidate cannot analyse or upload a resume at HEAD.
**Proposed fix:** Separate task; T-0001's backend live test will show this
as the expected HEAD failure when run against current code.
**Note (2026-10-12, T-0002): attribution corrected, and confirmed by the harness.**
- **Who introduced it:**
  - `71c632d` imports `path` (`analysis.controller.js:4@71c632d`) and defines `job` (`:138-146@71c632d`). `72451d1` still has both.
  - **`ad4f694` removed both.** At HEAD this leaves `path.extname` at `:34` and a dangling `job` at `:137`, `:144`, `:215`.
  - The hardcoded NLP URL predates both commits (`f270666:49`).
- **Harness:** the tier 2 run against current returned `HTTP 500: {"message":"Analyze failed","error":"path is not defined"}` (`tests/.out/current-backend-tests.log`).
- **Fix order:** restoring only the import and the lookup would re-enable I-0022. See INTEGRATION_REVIEW.md R29/R14.
**Evidence of resolution** (verified at HEAD `5446ebe`, 2026-10-12):
- `analysis.controller.js:2` has `import path from 'path'`.
- In `analyzeResume`, the job lookup (`.from('jobs')` at `:243`) runs before the NLP call (`fetch(NLP_PARSE_URL…)` at `:262`) and before the storage upload.
- **Harness tier 2** (`live-analyze.test.mjs`) passed in T-0003 Phases 1, 3 and 4: HTTP 200 with all keys, and teardown removed 1 score, 1 resume and 1 storage object. It returned 500 `path is not defined` at `4ed559d`.
- **`POST /api/resume/upload`:** a live probe (T-0003 Phase 3) as `t0001_cand` got 200 for a DOCX, and the status endpoint then reported it.

### I-0011 — Merge `314e494` reverted the 32905c1 NLP engine (RESOLVED)
**Status:** RESOLVED T-0003: NLP restored to `32905c1` by `git revert --no-commit 314e494` (R17). Committed in `a7c74e4`.
**Severity (at time of finding):** P1
**Module:** `nlp-engine/app/ner.py`, `embedder.py`, `main.py`
**Spec ref:** FR-2 / NFR-5 (PROJECT_SOURCE_DOCS.md @ 32905c1)
**Evidence:** `git diff --stat 32905c1 HEAD -- nlp-engine` →
`embedder.py | 72 +-----`, `main.py | 23 +-`, `ner.py | 529 ++++------`
(126 insertions, 498 deletions); the only commit touching `nlp-engine/` in
`32905c1..HEAD` is `314e494` (Aaron). HEAD lost: the
`required_skills`/`preferred_skills` form fields on `/parse`,
`component_weights` and `jd_source` in `semantic_analysis`, skill-name
normalisation, and per-section structured `experience`
(`{title, organisation, dates, highlights}` → back to
`{type, value}` pairs). CODE_MAP.md / REVIEW_BRIEF.md at HEAD still describe
the 32905c1 behaviour.
**Impact:** Current parser output is older and less structured than what
was already built; docs describe code that isn't there.
**Proposed fix:** Separate task — decide whether to restore 32905c1's NLP
files (and re-apply anything genuinely new from 314e494). T-0001 snapshots
give the before/after comparison.
**Note (2026-10-12, T-0002):**
- **Wider than NLP:** `314e494` is a **whole-tree reset**. `314e494^{tree}` == `71c632d^{tree}` (`f09d034b…`), so it contains nothing new to re-apply.
- **HEAD NLP is pre-baseline:** it is byte-identical to `365a09e`.
- **Fixture evidence:** the fixture-by-fixture comparison is in INTEGRATION_REVIEW.md §3.3. All four 32905c1 parsing fixes are overwritten at HEAD.
- **Open question:** does Aaron have unpushed NLP work? (Q1 in INTEGRATION_REVIEW.md).
**Evidence of resolution** (verified at HEAD `5446ebe`, 2026-10-12):
- `git diff 32905c1 HEAD -- nlp-engine` is empty.
- Snapshots f1–f6 sha256-match `tests/nlp/snapshots/baseline/` (`4338e6ca…`, `11399a83…`, `81d92b5e…`, `047bd608…`, `72d51441…`, `c6276fb1…`). The 3 private snapshots also match. This was checked in T-0003 Phases 1, 3 and 4.
- **Q1:** Aaron confirmed there is no unpushed NLP work (INTEGRATION_REVIEW.md §11).

### I-0013 — `resumes` table referenced by backend but not in any migration (RESOLVED)
**Status:** RESOLVED T-0003: the deleted migration was restored (INTEGRATION_REVIEW.md R19).
**Severity (at time of finding):** P1
**Module:** `supabase/migrations/`, `backend/Controllers/analysis.controller.js`
**Spec ref:** n/a (infra)
**Evidence:** Baseline `analysis.controller.js:198` (`.from('resumes').insert(...)`)
writes a `resumes` **table** (distinct from the `resumes` storage bucket in
I-0001). The five files in `supabase/migrations/` create only `profiles`,
`jobs`, `applications`, the admin role, suspension columns and
`notifications`.
**Impact:** Same as I-0007 — a fresh environment has no `resumes` table.
**Proposed fix:** Fold into the I-0001/I-0007 migration work (not fixed in
T-0001).
**Note (2026-10-12, T-0002): root cause.**
- **The migration was deleted.** `public.resumes` was created by `20260903_create_resumes_and_scores.sql:18+@32905c1`, which `314e494` deleted.
- **The table is live.** A read-only count shows 3 rows.
- **Fix:** restore the file (INTEGRATION_REVIEW.md R19).
**Evidence of resolution** (verified at HEAD `5446ebe`, 2026-10-12):
- `supabase/migrations/20260903_create_resumes_and_scores.sql:18` has `create table public.resumes (`. The file is byte-identical to `32905c1` (blob `8c9decd`).
- **Still open:** idempotency is tracked in I-0010.

### I-0018 — Unauthenticated password reset by username (account takeover) (RESOLVED)
**Status:** RESOLVED T-0003: baseline token-gated reset restored (R13).
**Severity (at time of finding):** P0 (security)
**Module:** `backend/Routes/auth.routes.js`, `backend/Controllers/auth.controller.js`, `frontend/src/pages/public/ResetPassword.jsx`
**Spec ref:** NFR-8 area (authentication), PROJECT_SOURCE_DOCS.md
**Evidence:**
- **The hole:**
  - `auth.routes.js:12`: `router.post('/update-password', updatePassword)`, with no auth middleware.
  - `auth.controller.js:68-124` looks the user up by `username` (profiles, falling back to `auth.admin.listUsers`).
  - It then calls `supabase.auth.admin.updateUserById(id, { password: newPassword, email_confirm: true })` with the service-role client.
  - `ResetPassword.jsx:30` calls it directly.
- **History:** `git log -S"update-password" -- backend/Routes/auth.routes.js` → added `97b7461`, removed `fdd22c3` (baseline uses the token-gated `request-password-reset`/`reset-password`, `auth.routes.js:51-52@32905c1`), re-added `314e494`.
**Impact:** Anyone who knows or guesses a username can set that account's password and log in as them, including recruiters and the admin.
**Proposed fix:** Restore the baseline token-gated flow (INTEGRATION_REVIEW.md R13). Until then, don't expose this backend beyond localhost.
**Evidence of resolution** (verified at HEAD `5446ebe`, 2026-10-12):
- `git grep -n "update-password\|updateUserById\|updatePassword" HEAD -- backend frontend/src` finds nothing.
- `auth.routes.js:51-52` has only `request-password-reset` (rate-limited) and `reset-password`.
- `auth.routes.js` and `ResetPassword.jsx` are byte-identical to `32905c1`.
- **Live probe** (T-0003 Phase 1): `POST /api/auth/update-password` → **404**, and `POST /api/auth/reset-password {}` → **400** "New password must be at least 8 characters."

### I-0022 — In-memory analysis globals leak across users (RESOLVED)
**Status:** RESOLVED T-0003: the baseline scoped readers were restored (R14).
**Severity (at time of finding):** P0 (security, latent)
**Module:** `backend/Controllers/analysis.controller.js`
**Spec ref:** NFR (data privacy), CHECKLIST 0.2 @32905c1
**Evidence:**
- **The globals:** `analysis.controller.js:114-115` holds module-level `allAnalyses` and `latestAnalysis`, set at `:197-221`.
- **The leak:** `getCandidateAnalysis` (`:229-236`) returns the global `latestAnalysis` to **any** candidate.
- **Origin:** this is the pre-baseline in-memory design (`f270666`). The `e7bf01b` merge resolution brought it back; baseline `32905c1` had replaced it with Supabase queries scoped to the session user (`:258-336@32905c1`).
- **Why it's masked:** analyze 500s at HEAD (I-0009), so the globals stay empty.
**Impact:** As soon as I-0009 is fixed alone, the last uploaded candidate's parsed resume (contact details included) is served to whichever candidate opens their results.
**Proposed fix:** Fix together with I-0009 by restoring the baseline scoped readers (INTEGRATION_REVIEW.md R14).
**Evidence of resolution** (verified at HEAD `5446ebe`, 2026-10-12):
- `grep -n "allAnalyses\|latestAnalysis" backend/Controllers/analysis.controller.js` finds nothing.
- `getCandidateAnalysis` reads `scores` filtered by `.eq('candidate_id', req.session.userId)`, which is the same as `32905c1`.
- **Regression guard (T-0007, working tree 2026-10-12, not yet committed):** `tests/backend/live-analysis-isolation.test.mjs` runs a real analyze as `t0001_cand`, then asserts `t0001_cand2` gets 404 with none of C's id/email/GitHub in the response, C still gets their own analysis, recruiters get 403 and `t0001_recr2` (no jobs) sees `[]` applicants. It passed at HEAD (no red run exists for an already-fixed issue). Detector check: with the `.eq('candidate_id', candidateId)` filter temporarily removed, the test failed (`tests/.out/t0007-mutation.log`: cand2 received 200 with C's email, GitHub handle and id); the controller was restored and `git diff` on it is empty.

### I-0023 — Backend never exits on EADDRINUSE; swallows `uncaughtException` (RESOLVED)
**Status:** RESOLVED T-0003: R11 applied (committed in `e9e4592`).
**Severity (at time of finding):** P2
**Module:** `backend/index.js`
**Spec ref:** n/a
**Evidence:**
- **Swallowed errors:** `index.js:94-95` logs `uncaughtException` and continues.
- **The loop:** a `setInterval` watchdog (`:106-119`) re-calls `server.listen` every 15 s and resets `process.exitCode = 0` (`:109`). The one-shot `error` listener (`:79-84`) only handles the first EADDRINUSE.
- Added by `71c632d`.
**Impact:** A port clash leaves a zombie process logging retries forever, and real crashes don't restart the process.
**Proposed fix:** `process.exit(1)` on EADDRINUSE and after logging `uncaughtException`. Drop the watchdog and keep the graceful shutdown (INTEGRATION_REVIEW.md R11).
**Evidence of resolution** (verified at HEAD `5446ebe`, 2026-10-12):
- `backend/index.js:91` calls `process.exit(1)` in the listen `error` handler.
- `:105` calls `process.exit(1)` after logging `uncaughtException`.
- There is no `setInterval` or watchdog. The graceful shutdown (`:116-118`) is kept.
- **Live probe** (T-0003 Phase 3): a second backend started on a busy port exited within 20 s with **exit code 1**. In Phase 1 the same scenario left a zombie process.

### I-0024 — Service-role key suffix written to logs (RESOLVED)
**Status:** RESOLVED T-0003: baseline `supabase.js` restored (R5/R12, committed in `a7c74e4`).
**Severity (at time of finding):** P2 (hygiene; not exploitable on its own)
**Module:** `backend/Config/supabase.js`
**Spec ref:** n/a
**Evidence:**
- **The log line:** `supabase.js:39` logs `key=...${supabaseServiceRoleKey.slice(-6)}` at boot.
- **Where it ends up:** observed in `tests/.out/current-backend.out.log` (git-ignored). The suffix isn't repeated here.
- Added by `71c632d`. Baseline logs only the role and project.
**Impact:** Part of a secret ends up in log files and terminals.
**Proposed fix:** Restore the baseline log line (INTEGRATION_REVIEW.md R5).
**Evidence of resolution** (verified at HEAD `5446ebe`, 2026-10-12):
- `backend/Config/supabase.js:40` logs only `service client key role: … (project …)`. There is no `slice(` in the file.
- The file is byte-identical to `32905c1`. That also brings back the role warning and the Authorization/apikey pin.

### I-0015 — `ner.py` contact fields nondeterministic (`list(set(...))[0]`) (RESOLVED)
**Status:** RESOLVED T-0013: contact fields are the first match in document order; no `set()` in the contact block.
**Severity:** P1
**Module:** `nlp-engine/app/ner.py`
**Spec ref:** FR-2 (PROJECT_SOURCE_DOCS.md @ 32905c1)
**Evidence:** `email`, `phone`, `github`, `linkedin` are each chosen as
`list(set(matches))[0]` (HEAD `ner.py:247-261`, baseline `:548-562`). Python
randomises string hashing per process, so when a resume contains two or more
matches the chosen value can change between server restarts.
**Impact:** Same resume can yield different contact details (and different
GitHub handle for validation) on different runs. The T-0001 harness pins
`PYTHONHASHSEED=0` on the test server so snapshots are stable — **that hides
the bug in tests; production remains nondeterministic.**
**Proposed fix:** Pick the first match in document order
(`dict.fromkeys(matches)` / first `re` hit) instead of via a `set`.
**Evidence of resolution** (T-0013, 2026-10-15):
- `nlp-engine/app/ner.py:543-577`: `re.findall` results are used in document order; GitHub prefers a bare profile link, else the owner of the first repo link, with a trailing `.` stripped.
- `tests/nlp/test_contact_determinism.py::test_contact_fields_same_under_every_hash_seed`: red at HEAD (seeds 0-4 all differed), green after. `::test_github_link_rules` covers the five link rows.
- `tests/run-suite.ps1` still pins `PYTHONHASHSEED=0`; that is now harmless for these fields.

---

### I-0047 — ROADMAP §1.3 has no row for `insufficient_evidence` (RESOLVED)
**Status:** RESOLVED T-0014: a 10th reason code, mapped in core and listed in ROADMAP §1.3 (owner decision D1).
**Severity:** P2
**Module:** `ROADMAP.md`, core mapping (T-0014)
**Evidence:** The service can answer `sub_score.available: false` with `reason_code: "insufficient_evidence"` (owned repos exist but no component could be computed, e.g. `GITHUB_DETAIL_REPOS=0` and no claims; `github-evidence/app/scoring.py`, `tests/github/test_metrics.py::test_no_detail_repos`). ROADMAP §1.3 lists only `no_public_repositories` as a service-side unavailable reason, so T-0014 has no reason text for it.
**Proposed fix:** Add a §1.3 row (cause, draft text such as "The GitHub account's repositories gave too little data to score.") and map it in T-0014.
**Evidence of resolution** (T-0014, 2026-10-15):
- `backend/Services/githubEvidence.js:84-94` (`reasonForBody`) passes the service's `reason_code` through for `no_public_repositories` and `insufficient_evidence`; any other unavailable body is `service_error`.
- `backend/Services/explainability.js:75` (`GITHUB_REASONS.insufficient_evidence`, the draft text above).
- `ROADMAP.md` §1.3 has the row.
- `tests/backend/github-evidence-client.test.mjs` "maps every service outcome" › "200 sub_score unavailable: insufficient_evidence (D1)", and `tests/backend/explainability.test.mjs` "every GitHub reason is unavailable, never zero" (10 codes), both pass (`tests/.out/t0014-green.log`).

### I-0075 — Live notification text of unknown origin (WONTFIX)
**Status:** WONTFIX: the row is not modified (owner, 2026-11-04, T-0031 D4). Nothing in the repo writes this text, so there is no code to fix.
**Severity:** P3
**Module:** `public.notifications` (live data)
**Spec ref:** n/a
**Evidence (2026-11-04, T-0031):** the owner reported a live row reading `Your application for a job has been updated.` The string is not in the tree at `88d03eb`, and `git log --all -S` finds no commit that ever added it. The backend's only writers are `backend/Controllers/jobs.controller.js:295` and `:304`, with other text. Origin unknown. Not explained by this search: `supabase/migrations/20260903000000_create_notifications.sql:26` created a policy letting recruiters insert notifications directly, so the row may not have come through the backend.
**Impact:** one old row. It does not affect the I-0071 wording.
