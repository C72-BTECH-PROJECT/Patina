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
| I-0001 | `resumes` storage bucket not in any migration | `supabase/migrations/`, `backend/Controllers/analysis.controller.js` | P1 | OPEN | 2026-08-31, pre-WORKLOG |
| I-0004 | AI-cruft / hallucinated entries in `SKILL_KEYWORDS` | `nlp-engine/app/ner.py` | P3 | OPEN | pre-WORKLOG (after an NLP fix, exact date not recorded) |
| I-0005 | `Assessment.jsx` unrouted, no backend, silently serves mock data | `frontend/src/pages/candidate/Assessment.jsx` | P1 | OPEN | pre-WORKLOG (after an NLP fix, exact date not recorded) |
| I-0006 | Upload.jsx: neither Choose-File nor drag-drop validates file type on selection, only at submit | `frontend/src/pages/candidate/Upload.jsx` | P2 | OPEN | 2026-10-12, L-0001 |
| I-0010 | Supabase Preview check fails on `main`; fixing it naively turns on auto-apply of migrations to production — **decision needed** | `supabase/migrations/`, Supabase GitHub integration | P1 | OPEN | 2026-10-12, T-0001 |
| I-0012 | HEAD frontend reads `import.meta.env.VITE_*` under CRA; 5 pages hardcode `localhost:5000` | `frontend/src/**` | P1 | OPEN | 2026-10-12, T-0001 |
| I-0015 | `ner.py` contact fields picked via `list(set(...))[0]` — nondeterministic across processes | `nlp-engine/app/ner.py` | P1 | OPEN | 2026-10-12, T-0001 |
| I-0016 | Signup rejects one-word "Full Name" with a misleading "all fields required" message | `frontend/src/pages/public/Login.jsx`, `backend/Controllers/auth.controller.js` | P1 | OPEN | 2026-10-12, T-0001 |
| I-0017 | Signup's explicit `profiles` insert duplicates the `on_auth_user_created` trigger and logs a pkey error on every signup | `backend/Controllers/auth.controller.js` | P3 | OPEN | 2026-10-12, T-0001 |
| I-0025 | `multer.memoryStorage()` without `limits`: upload size is unbounded and buffered in memory | `backend/Controllers/analysis.controller.js` | P2 | OPEN | 2026-10-12, T-0002 |
| I-0026 | Landing page's hardcoded demo score and "10000+ verified" stats read as real data | `frontend/src/pages/public/Landing.jsx` | P3 | OPEN | 2026-10-12, T-0002 |
| I-0027 | 404 handler always says "Cannot GET", whatever the method | `backend/index.js` | P3 | OPEN | 2026-10-12, T-0003 |
| I-0028 | `/api/recruiter/applicants` returns an empty email for applicants who have a profile | `backend/Controllers/analysis.controller.js` | P3 | OPEN | 2026-10-12, T-0003 |
| I-0029 | `shortlistCandidate` returns 500 (not 400/404) for a malformed, non-UUID `applicationId` | `backend/Controllers/jobs.controller.js` | P3 | OPEN | 2026-10-12, T-0004 |
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

---

### I-0001 — `resumes` storage bucket not in any migration
**Status:** OPEN
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

### I-0004 — AI-cruft / hallucinated entries in `SKILL_KEYWORDS`
**Status:** OPEN
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

### I-0005 — `Assessment.jsx` unrouted, no backend, silently serves mock data
**Status:** OPEN
**Severity:** P1
**Module:** `frontend/src/pages/candidate/Assessment.jsx`; no
`backend/Routes/assessment.routes.js` exists
**Spec ref:** Docs/IMPLEMENTATION-TRACKER.md §"Generative AI Assessment
Engine" (item 3) and §"Candidate Assessment UI" (item 8) — already tracked
there as a missing feature, not newly discovered.
**Evidence:**
- `frontend/src/App.jsx` has zero reference to `Assessment` — no route
  mounts it (grep for "Assessment" returns nothing).
- `backend/index.js:44-55` mounts only `auth`, `jobs`, `analysis` (`/api`),
  `parse`, `admin`, `notifications` — no assessment route exists.
- `Assessment.jsx:61` calls `fetch('http://localhost:5000/api/assessment/generate')`
  and `:104` calls `POST /api/assessment/evaluate`; both 404 against this
  backend and the component silently falls back to `MOCK_QUESTIONS`.
- The only other "assessment" hits in the backend are an unrelated comment
  (`analysis.controller.js:189`) and an unpopulated Mongoose schema field
  (`Models/Application.Model.js:49,83`).
**Impact:** The component is dead code from the app's perspective (no route
reaches it), and if it were ever wired up, it would quietly show mocked
questions/results as if they were real — a risk if this is ever used in a
live demo without that being noticed.
**Proposed fix:** Tracked at the tracker level (items 3 and 8). No fix here
— this entry exists so the silent-mock-fallback risk is visible outside the
tracker's checklist framing.

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

### I-0010 — Supabase Preview check fails on `main`; auto-apply decision needed
**Status:** OPEN — decision made (option a, 2026-10-12); stays OPEN until the migrations themselves are fixed
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

### I-0012 — HEAD frontend reads `import.meta.env` under CRA; hardcoded API URLs
**Status:** OPEN
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

### I-0015 — `ner.py` contact fields nondeterministic (`list(set(...))[0]`)
**Status:** OPEN
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

---

### I-0016 — Signup rejects a one-word "Full Name" with a misleading message
**Status:** OPEN
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

---

### I-0017 — Signup's explicit `profiles` insert duplicates the DB trigger
**Status:** OPEN
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

### I-0025 — Unbounded in-memory uploads
**Status:** OPEN
**Severity:** P2
**Module:** `backend/Controllers/analysis.controller.js` (both baseline and HEAD)
**Spec ref:** NFR-2 (concurrency)
**Evidence:** `multer({ storage: multer.memoryStorage() })` with no `limits`, at HEAD and at `32905c1`. Only the storage bucket enforces 10 MB, and only after the whole file has been buffered in the Node process.
**Impact:** Large uploads are held in memory before rejection, which is a memory-exhaustion risk under concurrent uploads.
**Proposed fix:** `limits: { fileSize: 10 * 1024 * 1024 }`, plus a 413 response on `LIMIT_FILE_SIZE`.

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

### I-0027 — 404 handler always says "Cannot GET", whatever the method
**Status:** OPEN
**Severity:** P3 (misleading message only)
**Module:** `backend/index.js`
**Spec ref:** n/a
**Evidence:** `index.js:68` (`:66@32905c1`, the same line) returns
`{ message: \`Cannot GET ${req.url}\` }` for every unmatched route. Found by the T-0003 probe:
`POST /api/auth/update-password` → `404 {"message":"Cannot GET /api/auth/update-password"}`.
**Impact:** A POST/PUT/DELETE to a missing route reports "GET", which misleads anyone debugging.
**Proposed fix:** Use `` `Cannot ${req.method} ${req.originalUrl}` ``. Not fixed in T-0003 (no row covers it).

---

### I-0028 — `/api/recruiter/applicants` returns an empty email for most applicants
**Status:** OPEN
**Severity:** P3 (no caller today)
**Module:** `backend/Controllers/analysis.controller.js` (`getAllApplicants`)
**Spec ref:** FR-14 (recruiter view), loosely
**Evidence:**
- **Before T-0003 (ad4f694):** the handler selected `profiles.email`, which doesn't exist. Every profile lookup failed, so every row fell back to `auth.admin.getUserById`, which supplied the email (an N+1).
- **After R30 fix 5 (T-0003 Phase 4):** names come from one `.in()` profiles query. Only candidates without a profile row fall back to the auth record, so `candidateInfo.email` is `''` for every candidate who has a profile.
- **Live probe:** the `t0001_cand` application row returned `email empty: True` (`tasks/T-0003-apply-integration.md`, Phase 4).
- **Callers:** nothing calls this endpoint now. The baseline Dashboard (R38) uses `/api/candidates`, whose email comes from the parsed resume contact.
**Impact:** None today. The merged application-centric Dashboard (score-on-apply follow-up) would show blank emails if it relies on this field.
**Proposed fix:** Decide in the score-on-apply task where applicant email comes from: the resume contact (as `serializeCandidate` does), or one batched auth lookup. Don't reintroduce a per-row N+1.

---

### I-0029 — `shortlistCandidate` 500s on a malformed `applicationId`
**Status:** OPEN
**Severity:** P3
**Module:** `backend/Controllers/jobs.controller.js`
**Spec ref:** n/a
**Evidence:** found during T-0004. Probe as `t0001_recr`: `POST /api/jobs/applications/shortlist {"applicationId":"not-a-uuid","status":"shortlisted"}` → `500 {"message":"Could not update application status."}` (after the T-0004 fix, the ownership lookup hits Postgres `22P02 invalid input syntax for type uuid` and takes the 500 branch).
**Impact:** A malformed id is a client error but is reported as a server error; no data is touched or leaked.
**Proposed fix:** Validate `applicationId` as a UUID before the lookup and return 400. Left out of T-0004 on purpose (Scope: Out).

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
- Validate the extension in `analyzeResume` too (or remove analyze once score-on-apply replaces it).

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
**Status:** OPEN
**Severity:** P3
**Module:** `backend/`, `dev/`
**Spec ref:** n/a (cleanup)
**Evidence (T-0009, `8e8e498`):**
- `bcrypt` is a dependency (`backend/package.json:17`) that nothing imports (grep `from 'bcrypt'`: 0).
- `backend/Middlewares/authCand.Middleware.js` and `authRec.Middleware.js` are tracked, 0-byte files.
- `backend/.env` defines `GOOGLE_CLIENT_ID/SECRET` and `GITHUB_CLIENT_ID/SECRET`, but no code reads them (grep: 0). They hint at OAuth that was never built (AUDIT 0.4).
- `backend/uploads/` is an empty local directory that no code references.
- `dev/null` is a tracked empty file (added in `f2a135c`), probably a shell redirect committed by accident on Windows.
- `backend/Controllers/githubAggregator.js` is already recorded as dead code (AUDIT 2.3).

**Impact:** confusion only; the unused env vars suggest OAuth exists.
**Proposed fix:** delete in a cleanup task; keep the OAuth variables only once M5/OAuth uses them.

---

## Resolved

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
