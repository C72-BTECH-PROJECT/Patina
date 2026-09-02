# AUDIT.md — Verified State of the Codebase

_Generated 2026-09-02 by module-by-module code read against CHECKLIST.md.
Classifications: DONE_CORRECTLY / DONE_BUT_BROKEN_OR_HACKY / STUBBED_OR_PARTIAL / MISSING.
project_checklist.md was NOT used as evidence._

_Partial re-audit 2026-09-03: reviewed only the files changed by the
`aditya-ui-work` merge (97b7461 / f270666 — "quiet-intelligence light theme
and fix auth flow") plus a check that Task 1 persistence survived the merge.
Everything outside that diff is unchanged from the 2026-09-02 pass. Changes
below are marked **[UI merge 2026-09-03]**._

_Task 2 (explainability) 2026-09-03: reclassified only the items touched by
the explainability work — `nlp-engine/app/embedder.py`,
`backend/Services/explainability.js` (new), `backend/Controllers/analysis.controller.js`,
`frontend/src/components/recruiter/{ScoreBreakdown,CandidateModal}.jsx`,
`frontend/src/pages/recruiter/{Dashboard,JobDetails}.jsx`, and the deletion of
`frontend/src/data/recruiter/mockData.js`. Changes are marked
**[Explainability 2026-09-03]**._

_Candidate loop (CHECKLIST 5.4) 2026-09-03: reviewed only the files changed
closing the candidate result loop — `frontend/src/pages/candidate/{Processing,Results}.jsx`,
`frontend/src/App.jsx` (Results now routed), `backend/Controllers/analysis.controller.js`
(serializer now forwards parsed `experience`/`education`), the deletion of
`backend/Routes/parse.routes.js` (+ its wiring in `backend/index.js` and doc row
in `README.md`), and the env-var convention sweep across
`frontend/src/{context/AuthContext,pages/recruiter/Jobs,pages/admin/Dashboard,pages/candidate/CandidateJobs,pages/public/Login}.jsx`
(all now `process.env.REACT_APP_API_BASE_URL`). Changes are marked
**[Candidate loop 2026-09-03]**._

### What the UI merge changed (summary)
- **mockData.js dependency shrank, was not reintroduced.** `CandidateModal.jsx`
  no longer imports `mockData.js`; its GitHub / AI-Assessment / Flagged-
  Inconsistencies sections are now gated on `candidate.assessment` /
  `candidate.flaggedInconsistencies?.length`, so for real Supabase-backed
  analyses they render nothing instead of fake numbers. `recruiter/Dashboard.jsx`
  has no mockData import. **`JobDetails.jsx` is now the only `mockData.js`
  consumer** and was not touched by the merge (still 100% mock, still the old
  dark `text-white` theme).
- **Dashboard data shape is wire-compatible with Task 1.** `recruiter/Dashboard.jsx`
  now consumes `/api/candidates` items as `{ id, candidate:{name,location,…},
  credibilityScore, verifiedSkills }` — exactly what `analysis.controller.serializeCandidate`
  returns. No mock fallback for the candidate list.
- **Two new candidate pages.** `pages/candidate/Assessment.jsx` is still dead
  code (unrouted, no backend). **[Candidate loop 2026-09-03]** `pages/candidate/Results.jsx`
  was **rewritten and routed** at `/candidate/results`: `Processing.jsx` now
  navigates there with the analyze response in `location.state`, and the page
  falls back to `GET /api/candidate-analysis`. It renders the candidate's own
  parsed entities, composite score, and the same `ScoreBreakdown.jsx` factor
  drill-down recruiters see — no second breakdown component, no aliased
  sub-scores.
- **New unauthenticated password-reset endpoint** `POST /api/auth/update-password`
  (`auth.controller.updatePassword`, wired to public `ResetPassword.jsx` at
  `/reset-password`): took `{ username, newPassword }`, no token / no email
  verification / no current-password / no rate limit, then called the
  **service-role** `supabase.auth.admin.updateUserById(id,{password,email_confirm:true})`.
  Anyone who knew a username could take over that account. **FIXED 2026-09-03**
  — endpoint removed and replaced with a proper two-step Supabase recovery flow
  (see 0.4 and the appendix).
- **Task 1 persistence survived intact.** `analysis.controller.js` was only ever
  touched by `c27037f` (Task 1's own commit); the UI merge did not modify it.
  `supabase/migrations/20260903_create_resumes_and_scores.sql` is present and
  complete (resumes + scores tables, `resumes` storage bucket, indexes, RLS).
  `Config/supabase.js` — 97b7461 briefly simplified the dotenv resolution, but
  the merged file keeps Task 1's explicit `../.env` + `override:true` version.
- **Minor merge positives (no classification change):** `index.js` now throws on
  missing `SESSION_SECRET` in production; `requireRole` returns the `requireAuth`
  promise instead of a fire-and-forget `await`; admin overview logs which query
  failed. New light-theme component library (`components/{Badge,Button,Card,
  EmptyState,Input,Logo,Skeleton,Spinner}.jsx`) + reworked `index.css` /
  `tailwind.config.js`. `CandidateModal.jsx` still uses old `glass-card` /
  `corner-decoration` / `bg-white/5` utilities that survive but are dark-tuned —
  cosmetic mismatch, not a functional break.

### What the explainability task changed (summary)
- **`mockData.js` is deleted**, along with its last importer. `JobDetails.jsx` was
  rewritten against `GET /api/jobs/mine` + `GET /api/candidates`; the hardcoded
  `skillsDistribution` pie, `weeklyApplications` bars, "Welcome back, Amit",
  "3 Pending Reviews" and "2 Flagged Applications" are gone from
  `recruiter/Dashboard.jsx`. No mock data remains anywhere in `frontend/src`.
- **New `backend/Services/explainability.js`** — a dedicated explainability
  layer. It normalises each evidence source to a 0-100 sub-score, redistributes
  the weight of sources that produced nothing (instead of scoring them zero),
  and emits a persisted explanation record with per-factor direction, weight,
  point contribution and cited evidence. The old inline `buildScoreRecord` in
  `analysis.controller.js` was deleted, not duplicated.
- **The Node mapping stopped dropping NLP output.** `jd_skills`, `resume_skills`,
  `focused_score`, `full_text_score` and the component weights now survive into
  the persisted sub-score alongside `matched_skills` / `missing_skills` /
  `skill_coverage` / `match_reason`. `embedder.py` emits its own
  `component_weights` so the 0.60/0.40 split is stated by the service that
  applies it rather than re-hardcoded in Node.
- **Composite values are unchanged** (weight redistribution over a single
  available source yields weight 1.0), so no score moved.
- **`serializeCandidate` gained the sub-score interface** `nlpScore` /
  `githubScore` / `assessmentScore` (null, never 0, when a source has no
  evidence) plus `skillEvidence`, `flags`, `flagsAvailable`,
  `flagsUnavailableReason`, `matchLevel`. It **dropped** `verifiedSkills`,
  `matchPercentage`, `semantic_similarity`, `match_level`, `raw_text_preview` —
  the constant `level: 'Unverified'` fabrication is gone (see appendix for the
  knock-on to the unrouted `Results.jsx`).

### What the candidate-loop task changed (summary)
- **The candidate now sees their own result.** `Processing.jsx` was rewritten:
  it POSTs to `/api/analyze` via `XMLHttpRequest` (real `upload.onprogress`
  drives the progress ring; `withCredentials` set because XHR bypasses the
  app-wide fetch wrapper), then navigates to the newly-routed
  `/candidate/results` with the analyze response in `location.state`. The
  `setInterval` + `Math.random()` fake progress bar is gone; the phase after
  upload is an honest indeterminate "Analyzing" state because the server does
  not stream sub-progress. Pipeline step labels are cut to the two that run
  (Uploading, Analyzing) — "Analyzing GitHub profile" / "Generating credibility
  score" are deleted.
- **`Results.jsx` migrated to the live contract and routed.** It reads the
  `serializeCandidate` shape (`credibilityScore`, `explanation`, `skillEvidence`,
  `evidenceLimited`, `matchLevel`, parsed `extractedSkills`/`experience`/
  `education`/`projects`) and renders the composite, the parsed entities, and
  `components/recruiter/ScoreBreakdown.jsx` verbatim — the same drill-down the
  recruiter modal uses. The old dead reads (`verifiedSkills`, `matchPercentage`,
  `semantic_similarity`, `match_level`), the aliased `githubScore`/
  `assessmentScore`, the hardcoded mock result object and the non-existent
  `.badge` classes are all gone.
- **`serializeCandidate` forwards `experience` and `education`** (already
  persisted on `resumes`, previously dropped by the mapper) so the candidate
  view can show the full parsed entity set. No score field changed.
- **`backend/Routes/parse.routes.js` deleted** — the second, parallel
  resume→FastAPI forwarder (`POST /api/parse`) that persisted nothing. Its
  `import`/`app.use` in `backend/index.js` and its `README.md` API-surface row
  are removed. Nothing imported it.
- **Env-var convention unified.** Every remaining `import.meta.env.VITE_API_BASE_URL`
  (`AuthContext.jsx`, `recruiter/Jobs.jsx`, `admin/Dashboard.jsx`,
  `candidate/CandidateJobs.jsx`, `public/Login.jsx`) is now
  `process.env.REACT_APP_API_BASE_URL`, matching the two recruiter pages the
  explainability task had already migrated. `frontend/.env` (gitignored) updated
  to the new var name. No `import.meta` references remain in `frontend/src`.

## 1. Executive Summary

Patina is currently a **resume-parsing demo with a hiring-portal shell around it**, not the four-module explainable pipeline the spec describes. Only one of the four methodology algorithms exists in any real form: a Python/FastAPI NLP service that extracts text (pdfplumber/python-docx), runs spaCy preprocessing, does **keyword/regex skill matching** (not a trained NER model), and computes a genuine S-BERT semantic-similarity score against the job description. There is **no GitHub Aggregator service and no LLM/assessment engine**. **[Explainability 2026-09-03]** There *is* now a real aggregation + explainability layer (`backend/Services/explainability.js`): documented configurable weights, normalise-then-weight aggregation, weight redistribution away from sources that produced no evidence, and a persisted per-factor explanation (direction, weight, point contribution, cited evidence) that the recruiter dashboard renders as a composite → sub-score → evidence drill-down. Numerically the score is still `round(semantic_similarity * 100)`, because parsing is the only source feeding it — the machinery around it is now correct, the inputs are not yet there. Analysis results now persist to Supabase `resumes` + `scores` tables (added 2026-09-03); there is still no `Repository` table (GitHub module unbuilt). Authentication is email/password (Supabase Auth + Express session), **not OAuth 2.0**, and there is no GitHub OAuth. **[UI merge 2026-09-03]** The UI merge added an unauthenticated `POST /api/auth/update-password` that let anyone reset any account's password by username alone (account-takeover hole); **this was fixed 2026-09-03** — replaced by a two-step email-recovery flow (`request-password-reset` + token-gated `reset-password`), no service-role password writes (see 0.4). A new `Assessment.jsx` candidate page exists but is a pure UI shell (5 hardcoded questions, no `/api/assessment` route) and is not even routed in `App.jsx`. **[Candidate loop 2026-09-03]** `Results.jsx` is now rewritten, routed at `/candidate/results`, and reached from `Processing.jsx` — the candidate finally sees their own parsed entities, composite score and the recruiter-grade factor breakdown; the fake `setInterval`/`Math.random()` progress bar is replaced by real XHR upload progress plus an honest indeterminate analyze state; and the dead `parse.routes.js` forwarder is deleted. **[Explainability 2026-09-03]** `mockData.js` is **deleted** and the recruiter surface is fully Supabase-backed: `Dashboard.jsx`, `JobDetails.jsx` and `CandidateModal.jsx` all read `GET /api/candidates` / `GET /api/jobs/mine`, and every panel with no evidence behind it (GitHub, assessment, inconsistency flags) renders the stored reason it is empty rather than a zero or a fabricated number. Of the guide-feedback items, **GF-5 (explainability) is now largely addressed and GF-4's weight-redistribution half is implemented**; OCR, LinkedIn/certificates and maintenance-fair scoring remain unaddressed. Dead code is present: four Mongoose models and a `githubAggregator.js` helper that nothing imports.

## 2. Repo Inventory

### Services / directories that actually exist
| Path | What it is | State |
|---|---|---|
| `frontend/` | React 19 app, **Create React App** (`react-scripts@5.0.1`), TailwindCSS, framer-motion, recharts, react-router 7 | Runs; many pages are UI-only or mock-backed. **[Candidate loop 2026-09-03]** The env-var convention is unified — all API-base reads now use the CRA-correct `process.env.REACT_APP_API_BASE_URL` (no `import.meta.env` left in `frontend/src`). |
| `backend/` | Node.js/Express 5 (ESM), `express-session`, `multer`, `@supabase/supabase-js`, `node-fetch`, `form-data` | Runs; thin routing/forwarding layer + Supabase CRUD for auth/jobs/admin. |
| `nlp-engine/` | Python FastAPI microservice (`app/main.py`), spaCy `en_core_web_sm`, `sentence-transformers` (`all-MiniLM-L6-v2`), pdfplumber, python-docx, scikit-learn | The only real "processing" service. Single `POST /parse` endpoint. |
| `supabase/migrations/` | 5 SQL migrations: `profiles`, `jobs`+`applications`, admin role, profile suspension, `resumes`+`scores` (+ `resumes` storage bucket) | Schema now covers **User, Resume, Score** + jobs/applications. **Repository** entity still absent. |
| `Docs/` | `project_checklist.md` (stale, do not trust), `Architecture.md` (deleted in working tree) | — |

### Services the spec requires that DO NOT exist
- **GitHub Aggregator microservice** — absent. (`backend/Controllers/githubAggregator.js` exists but is imported by nothing; it only lists repo `.language` strings — no OAuth, no metrics, no file analysis.)
- **Generative AI / Assessment Engine** — absent entirely (no LLM SDK anywhere; `openai`/`gemini`/`anthropic` appear in zero source files).
- **Unified Scoring Engine / Explainability layer** — **[Explainability 2026-09-03]** now present as `backend/Services/explainability.js` (in-process module in the Node layer, not a separate microservice). Owns normalisation, weighting, weight redistribution and the persisted explanation record. New sources plug in by returning the documented sub-score shape.

### Tech-stack notes
- **DB**: Supabase (Postgres). Backend uses the **service-role key** for all queries (`backend/Config/supabase.js`), RLS policies are defined but bypassed by the server.
- **Dead code**: ~~`backend/Models/*.Model.js` Mongoose schemas + `mongoose` dependency~~ — deleted 2026-09-03 (models directory removed, `mongoose` dropped from `package.json` + lockfile).
- **Auth**: `signup`/`login`/`me`/`logout` in `auth.controller.js`; session cookie `patina_session`; `SESSION_SECRET` has an insecure dev default.
- **No test suite** anywhere (backend `test` script = `exit 1`; no pytest; no measured metrics).
- **Transport**: hardcoded `http://localhost:*` throughout; no HTTPS/TLS config.

### Data flow that actually runs
`Upload.jsx` (pick job, paste JD, choose PDF/DOCX) → `Processing.jsx` `POST http://localhost:5000/api/analyze` (multipart: `resume`, `jobId`) → `analysis.controller.analyzeResume` looks up job in Supabase, forwards `resume`+`jd` to `http://localhost:8000/parse` → FastAPI returns entities + `semantic_analysis` (now including `jd_skills`, `resume_skills` and `component_weights`) → controller uploads the raw file to the `resumes` storage bucket, inserts a `resumes` row (parsed entities) and a `scores` row built by `Services/explainability.buildScoreRecord` (composite, all three sub-scores in a uniform shape, redistributed weights, and the full explanation record incl. per-skill evidence) → `Processing.jsx` navigates to `/candidate/dashboard` (a static marketing page). **[Explainability 2026-09-03]** Recruiter `Dashboard.jsx`, `JobDetails.jsx` and `CandidateModal.jsx` all read `GET /api/candidates` (Supabase `scores` ⨝ `resumes` ⨝ `profiles`, scoped to the recruiter's own jobs, latest score per candidate) plus `GET /api/jobs/mine`; `CandidateModal` renders the persisted explanation verbatim via `components/recruiter/ScoreBreakdown.jsx`. No mock source remains on the recruiter path.

---

## 3. Per-Module Assessment

### Module 0: Cross-Cutting Requirements

| Item | Classification | Evidence | Notes |
|---|---|---|---|
| 0.1 Microservices architecture | STUBBED_OR_PARTIAL | `frontend/`, `backend/`, `nlp-engine/` exist as 3 tiers; `analysis.controller.js:49` forwards files to FastAPI | Only the NLP service is separated. GitHub Aggregator and Assessment Engine microservices do not exist. 2 of 4 required Python services missing; the "architecture" is a 2-service prototype. |
| 0.2 Data layer (User/Resume/Repository/Score) | STUBBED_OR_PARTIAL | `20260903_create_resumes_and_scores.sql` adds `public.resumes` + `public.scores` (+ private `resumes` storage bucket); `analysis.controller.js` writes both on every analyze and reads them for `/api/candidates` and `/api/candidate-analysis`. `allAnalyses[]` deleted. | **User**, **Resume**, **Score** now persist. **Repository** still absent (GitHub module not built). Parsed data survives restart. |
| 0.3 Entity completeness (sub-scores persisted) | STUBBED_OR_PARTIAL | `resumes` stores raw file ref (storage object path) + parsed `skills`/`experience`/`education`/`projects`/`contact`/`project_links`. **[Explainability 2026-09-03]** `scores.subscores` now stores **all three** named sub-scores in one uniform shape (`{key,label,available,value,weight,reason,components,evidence}`); unavailable sources are `available:false, value:null, weight:0` with a stored human reason instead of a bare `null`. `scores.weights` + `scores.explanation` (factors, per-skill evidence, flag state, weighting scheme) persisted. | `Resume` and `Score` are now complete and re-explainable from disk alone. **`Repository` still has no table** (GitHub module unbuilt) — that is the only thing keeping this off DONE_CORRECTLY. OCR/layout quality of the parsed arrays unchanged (see 1.2/1.3). |
| 0.4 Auth: OAuth 2.0, two classes | DONE_BUT_BROKEN_OR_HACKY | `auth.controller.js` uses `supabase.auth.signInWithPassword` + Express session; `Middlewares/auth.Middleware.js` `requireRole()` separates CANDIDATE/RECRUITER/ADMIN; route guards e.g. `analysis.routes.js:7-9` | **Not OAuth 2.0** — username/password only. No Google/GitHub OAuth despite `project_checklist.md` claim. Role separation itself is enforced correctly server-side. **[UI merge 2026-09-03]** New unauthenticated endpoint `POST /api/auth/resend-confirmation` (benign). The UI merge also added `POST /api/auth/update-password`, which accepted `{username,newPassword}` with no verification and called service-role `supabase.auth.admin.updateUserById` — an account-takeover hole. **FIXED 2026-09-03** (`auth.controller.js`, `auth.routes.js`, `ResetPassword.jsx`): `update-password` removed; no service-role key is used to change a password anywhere. Replaced by a standard two-step Supabase recovery flow — (1) `POST /api/auth/request-password-reset` resolves a username/email to the account email server-side and calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<frontend>/reset-password' })`; it always returns the same generic 200 (no account enumeration) and is rate-limited to 5 requests / 15 min per IP (in-memory limiter in `auth.routes.js`). (2) `POST /api/auth/reset-password` takes `{ newPassword }` plus the recovery credentials from the emailed link (`tokenHash`, or `accessToken`+`refreshToken`), exchanges them for a user session on an **anon-key** client via `verifyOtp({type:'recovery'})` / `setSession()`, calls `updateUser({ password })`, then `signOut()`s the recovery session. A raw username is never trusted for the password change. `ResetPassword.jsx` is now a two-mode page (request-link mode / set-new-password mode, the latter triggered by recovery params in the URL, which it strips from history after reading). Requires `SUPABASE_ANON_KEY` in `backend/.env` (returns 500 "Password reset is not available right now" if unset). Classification held at BROKEN_OR_HACKY for the role model (still username/password, not OAuth 2.0); the takeover vulnerability is resolved. |
| 0.5 Secrets server-side | DONE_CORRECTLY | `backend/.env.example` (Supabase keys only), `Config/supabase.js` reads `process.env`; `.env` gitignored; no GitHub/LLM keys exist because those integrations don't exist | Trivially satisfied — there are no GitHub/LLM keys yet. Frontend bundle contains no secrets. |
| 0.6 HTTPS | MISSING | `fetch('http://localhost:8000/parse')`, `http://localhost:5000` hardcoded in `Upload.jsx:195`, `Processing.jsx:277`, etc. | No TLS anywhere. |
| 0.7 Graceful degradation (retry + fallback) | MISSING | `analysis.controller.js:54-57` returns HTTP 502 on FastAPI failure; no retry, no fallback, no degraded score. `githubAggregator.js` catch returns `[]` silently | An NLP outage hard-fails the only pipeline. No external-call resilience. |
| 0.8 Concurrency / async queue | MISSING | `analyzeResume` is a synchronous request handler. **[Candidate loop 2026-09-03]** `Processing.jsx` no longer fakes progress (real XHR upload progress + honest indeterminate analyze state), but the request is still one blocking round-trip. | No queue, no worker, no parallelism. |
| 0.9 Scope discipline | DONE_CORRECTLY | Nothing attempts soft-skill or degree-registrar validation | Satisfied by omission. |

### Module 1: Resume Parsing & Semantic Extraction

| Item | Classification | Evidence | Notes |
|---|---|---|---|
| 1.1 PDF + DOCX ingestion | DONE_CORRECTLY | `nlp-engine/app/extractor.py:22-29` dispatches `.pdf`→pdfplumber, `.docx`→python-docx; both reach the same `extract_entities`/`analyse`. Frontend `accept=".pdf,.docx"` (`Upload.jsx:423`) | Both formats reach identical downstream output. |
| 1.2 OCR for scanned resumes (GF-2) | MISSING | `extractor.py` has no OCR; no tesseract/pytesseract/easyocr in `requirements.txt`. A scanned PDF → `page.extract_text()` returns `None` → empty string → empty entities | Guide called OCR mandatory. Absent. |
| 1.3 Layout-aware extraction | DONE_BUT_BROKEN_OR_HACKY | `extractor.py:5-12` uses pdfplumber but just concatenates `page.extract_text() + "\n"` per page | pdfplumber is used, but column/section/table structure is discarded — it's a naive full-text dump. `ner.py` then re-segments by `\n` lines. Fails the "preserves columns/tables" bar. |
| 1.4 Preprocessing (tokenize + lemmatize) | DONE_CORRECTLY | `nlp-engine/app/preprocessor.py:8-33` — spaCy pipeline, `token.lemma_.lower()`, stopword/punct filtering, sentences, noun_chunks | Actually implemented. Note: preprocessed tokens are computed but **not used** by NER (`main.py:51` calls `extract_entities(raw_text)` on raw text; only `noun_chunks` is passed onward and `embedder.analyse` deletes it — `embedder.py:93`). |
| 1.5 Custom/trained NER model | DONE_BUT_BROKEN_OR_HACKY | `ner.py:4` loads stock `en_core_web_sm`; skills come from a **hardcoded `SKILL_KEYWORDS` list (~150 entries) + regex** (`ner.py:6-108`); projects/education via keyword+heuristic line scanning (`ner.py:176-239`) | No custom NER model, no HF "Annotated NER PDF Resumes" dataset, no training. Skill extraction is exactly the dictionary lookup the spec calls insufficient. Only PERSON/ORG/DATE use the pretrained model. |
| 1.6 Semantic embeddings (S-BERT) | DONE_CORRECTLY | `nlp-engine/app/embedder.py:11` `SentenceTransformer("all-MiniLM-L6-v2")`; `compute_similarity` uses real normalized embeddings + cosine (`embedder.py:19-26`) | Genuine sentence embeddings. Model is MiniLM not S-BERT proper, but "or equivalent" is allowed. This is the strongest-built piece. |
| 1.7 Hybrid layering (layout→NER→embeddings together) | DONE_BUT_BROKEN_OR_HACKY | Layers exist but don't feed each other: layout dump → raw text; NER = keyword regex on raw text; embeddings computed from `resume_skills` list + regex-matched "evidence lines" (`embedder.py:29-58`), not from NER-structured entities | The final score blends `skill_coverage` (keyword intersection) 60% + semantic 40% (`embedder.py:117`) — so keyword matching dominates, the opposite of the LR guidance. |
| 1.8 Layout robustness across diverse templates | STUBBED_OR_PARTIAL | Line-based heuristics in `ner.py` (`looks_like_heading`, uppercase/colon detection at `ner.py:203-225`) | Will work on simple single-column resumes; no test set, no evidence of multi-template robustness. |
| 1.9 Project-link extraction | STUBBED_OR_PARTIAL | `ner.py:244-254` regex-extracts first `github.com/...` and `linkedin.com/in/...`; returned as `entities.github`/`entities.linkedin` (`main.py:74-75`) | Links are extracted, but only the first of each, and **nothing downstream consumes them** (no GitHub module). Portfolio URLs not handled. |
| 1.10 Structured JSON contract | STUBBED_OR_PARTIAL | `main.py:60-85` returns a stable JSON shape; `analysis.controller.js:61-122` maps it | Contract exists but is unversioned and consumed by only one caller (Node). No Aggregator/Assessment consumers exist. |
| 1.11 Extraction accuracy ≥85% measured | MISSING | No evaluation script, no labelled sample, no metric recorded | — |
| 1.12 Skill-classification F1 ≥0.80 measured | MISSING | No measurement | — |
| 1.13 Latency ≤10s measured | MISSING | No benchmark. (First request also lazy-loads spaCy + MiniLM.) | — |
| 1.14 Parsing sub-score emitted & persisted | DONE_BUT_BROKEN_OR_HACKY | `embedder.analyse` returns `similarity_score`, `skill_coverage`, `matched_skills`, `missing_skills`, `jd_skills`, `resume_skills`, `focused_score`, `full_text_score`, `match_reason` and (**[Explainability 2026-09-03]**) `component_weights`; `Services/explainability.buildParsingSubScore` carries **all** of them into `scores.subscores.parsing_semantic_alignment` plus a structured `evidence[]` array. | Nothing the NLP service computes is dropped by Node any more. Still the *only* input, so it also equals the composite until GitHub/assessment land. Underlying number quality unchanged (keyword-dominated, see 1.7) — that is what keeps this at BROKEN_OR_HACKY. |

### Module 2: GitHub Evidence Validation

Whole-module note: **no GitHub Aggregator microservice exists.** `backend/Controllers/githubAggregator.js` is the only GitHub code; it is imported by nothing (`grep` confirms only self + `project_checklist.md`), has no auth, no pagination, no rate-limit handling, and only collects `repo.language` + `repo.topics` strings.

| Item | Classification | Evidence | Notes |
|---|---|---|---|
| 2.1 Username acquisition (resume or input) | STUBBED_OR_PARTIAL | Resume path: `ner.py:244,253` regex. Input path: `profiles.github_url` column (`20260823_*.sql:16`) captured at signup | Both capture points exist, but neither is used for anything and there's no fallthrough logic. |
| 2.2 OAuth 2.0 GitHub auth | MISSING | No GitHub OAuth client, no `/auth/github` route, no `passport`/oauth lib | — |
| 2.3 Repository retrieval via GitHub API | STUBBED_OR_PARTIAL | `githubAggregator.js:21` `fetch('https://api.github.com/users/${username}/repos?per_page=100')` | Unauthenticated (60 req/hr), single page, no GraphQL, dead code. |
| 2.4 Core metrics (commit freq, language, ownership, consistency, quality) | MISSING | `githubAggregator.js` computes only a `Set` of languages. No commits, no fork/ownership check, no time-series, no quality flags | — |
| 2.5 Claim cross-referencing against parsed languages | MISSING | Nothing compares GitHub data to resume skills | — |
| 2.6 8DFS heuristic (static analysis, boilerplate filtering) | MISSING | No file fetching, no complexity/smell approximation anywhere | — |
| 2.7 Graded not binary | MISSING | No GitHub scoring of any kind | — |
| 2.8 GitHub optional / assessment-only fallback | STUBBED_OR_PARTIAL | Pipeline "works" without GitHub only because GitHub is entirely absent; `analysis.controller.js:82-90` marks all skills `verified:false` | Optionality is accidental, not designed. No weight redistribution, no dashboard annotation. |
| 2.9 Fairness for maintenance/support work (GF-3) | MISSING | No commit-type analysis, no scoring model | — |
| 2.10 Private-repo limitation acknowledged | MISSING | No score explanation exists | — |
| 2.11 Repository entity persisted | MISSING | No `repositories` table | — |
| 2.12 GitHub sub-score emitted | MISSING | — | — |
| 2.13 Resilience (retry + fallback) | DONE_BUT_BROKEN_OR_HACKY | `githubAggregator.js:23-26,45-48` swallows all errors and returns `[]` | "Partial data labelled partial" is not done — failures are silent, and the code is dead anyway. |

### Module 3: Generative AI Assessment

Whole-module note: **still no real assessment engine.** No LLM SDK/HTTP calls, no question/answer/rubric data model, no `/api/assessment` route in `backend/index.js`, no persistence. **[Candidate loop 2026-09-03]** `Processing.jsx`'s cosmetic "Analyzing GitHub profile" / "Generating credibility score" steps are now deleted — the screen lists only the two stages that actually run.

**[UI merge 2026-09-03]** A new `frontend/src/pages/candidate/Assessment.jsx` appeared. It is a **UI shell, classify STUBBED_OR_PARTIAL and it moves no 3.x item off MISSING**: it `fetch`es `http://localhost:5000/api/assessment/generate` and POSTs `/api/assessment/evaluate`, but **neither route exists**, so it always falls back to 5 hardcoded `MOCK_QUESTIONS` (React/Node/Mongo/Python/System-Design, with static rubric strings). Real countdown timer, answers in component state, on submit → `/candidate/results`. **Not wired into `App.jsx`** (no `/candidate/assessment` route) so it is unreachable in the app. No candidate-specific generation, no PFQS plan, no LLM, no rubric evaluation, no results storage. `CandidateModal.jsx`'s "AI Assessment" card is now gated on `candidate.assessment` and renders nothing for real analyses (no longer mock-fed).

| Item | Classification | Evidence | Notes |
|---|---|---|---|
| 3.1 Candidate-specific generation | MISSING | No generation code | — |
| 3.2 Static banks eliminated | MISSING | No assessment at all | — |
| 3.3 PFQS framework (2-step plan→questions) | MISSING | "PFQS" appears only in spec/checklist docs | — |
| 3.4 Difficulty control via stored plan | MISSING | — | — |
| 3.5 Rubric-based evaluation | MISSING | — | — |
| 3.6 Hallucination constraints | MISSING | — | — |
| 3.7 Sequence conformance + results stored | MISSING | No `assessment` route in `backend/index.js`; `Application.Model.js:49-61` defines an `assessment` shape but the model is dead Mongoose code | — |
| 3.8 Rubric calibration (APPS dataset) | MISSING | — | — |
| 3.9 ≥0.75 correlation measured | MISSING | — | — |
| 3.10 Parallel execution | MISSING | — | — |
| 3.11 LLM resilience | MISSING | — | — |
| 3.12 Assessment sub-score emitted | MISSING | — | — |
| 3.13 Standalone sufficiency | MISSING | — | — |

### Module 4: Unified Credibility Scoring

Whole-module note: **[Explainability 2026-09-03]** `backend/Services/explainability.js` now provides the scoring/explainability engine: normalise-to-0-100 → weight → aggregate, with `BASE_WEIGHTS` (parsing 0.40 / GitHub 0.35 / assessment 0.25, overridable via the `CREDIBILITY_WEIGHTS` env var) renormalised across only the sources that produced evidence. Numerically the composite is still `round(semanticSimilarity * 100)` because parsing is the sole available source and therefore takes weight 1.0 — the aggregation is real, the other two inputs are not.

| Item | Classification | Evidence | Notes |
|---|---|---|---|
| 4.1 Three-input composite | DONE_BUT_BROKEN_OR_HACKY | `Services/explainability.buildScoreRecord` composes over all three sub-score slots, but only `parsing_semantic_alignment` ever reports `available:true`. | One input, not three. The aggregation is now general — adding a source is a `buildXSubScore()` returning the documented shape — but GitHub/assessment still produce nothing. |
| 4.2 Normalisation before aggregation | STUBBED_OR_PARTIAL | **[Explainability 2026-09-03]** `explainability.aggregate()` weights sub-scores that are already normalised to a common 0-100 scale by their builders (`toPoints()`); `buildParsingSubScore` does the 0..1 → 0-100 conversion. | Implemented and documented, but only ever exercised on one already-0-100 source, so normalisation across genuinely heterogeneous scales is unproven. |
| 4.3 Weighted aggregation (documented, configurable, 0–100) | DONE_CORRECTLY | **[Explainability 2026-09-03]** `explainability.BASE_WEIGHTS` states the scheme in one place and is overridable per deployment via `CREDIBILITY_WEIGHTS` (JSON, validated, falls back on bad input). `embedder.py` now exports `SKILL_COVERAGE_WEIGHT`/`SEMANTIC_SCORE_WEIGHT` and emits them as `component_weights`, so the 0.60/0.40 split is stated by the service that applies it and shown in the UI rather than re-hardcoded in Node. Output is 0-100. | The weighting scheme is explicit, documented, configurable and persisted with every score (`explanation.weighting_scheme`). Only one weight is currently non-zero, but that is 4.1's gap, not this one. |
| 4.4 Sub-scores retained alongside composite | DONE_CORRECTLY | **[Explainability 2026-09-03]** `scores.subscores` persists all three entries in one uniform shape alongside `composite_score`; `serializeCandidate` forwards `subScores`/`weights`/`explanation`/`skillEvidence` plus `nlpScore`/`githubScore`/`assessmentScore`, and `CandidateModal.jsx` → `ScoreBreakdown.jsx` renders the stored record verbatim. | Stored, forwarded and displayed. Unavailable sources keep `value:null` and a stored reason — never a zero. |
| 4.5 Explainability layer (FR-13, GF-5) | STUBBED_OR_PARTIAL | **[Explainability 2026-09-03]** `backend/Services/explainability.js` emits a persisted `explanation` record: `summary`, `factors[]` with `direction` (raises/lowers/neutral/sole/unavailable), `weight`, `weight_pct`, `contribution` in composite points, and a typed `evidence[]` per factor (`skill_set` items for matched/missing job skills; `metric` items for coverage, semantic, focused and full-text similarity, each with its within-factor weight and a plain-language note), plus `skill_evidence[]`, `unavailable_evidence[]` and `weighting_scheme`. Rendered by `frontend/src/components/recruiter/ScoreBreakdown.jsx`. | The layer itself is built and is the real thing, not a UI garnish. It is STUBBED only because two of three evidence sources have nothing to cite — no repo metrics, no rubric outcomes. Reassess to DONE_CORRECTLY when a second source lands and its evidence renders. |
| 4.6 Flagged inconsistencies computed | MISSING | `explainability.buildFlags()` exists and returns an explicit `{flags:[], flags_available:false, flags_unavailable_reason}` state; the hardcoded "2 Flagged Applications" / "3 Pending Reviews" strings are **deleted** from `recruiter/Dashboard.jsx`. | Still no computation — every real flag the spec names ("claimed language absent from all repos", "seniority contradicted by assessment") needs an evidence source that does not exist. The insertion point and the honest empty state are in place; the logic is not. |
| 4.7 Missing-evidence weight redistribution | DONE_CORRECTLY | **[Explainability 2026-09-03]** `explainability.aggregate()` renormalises `BASE_WEIGHTS` over `available` sub-scores only, so an absent source costs nothing rather than scoring zero; `evidence_limited` is persisted and surfaced as an "Evidence-limited" badge on the modal and candidate rows, a dashboard stat, and an explanatory panel. | Verified by smoke test: with parsing alone the weight redistributes 0.40 → 1.0 and the composite is unchanged. Becomes meaningfully exercised once a second source exists. |
| 4.8 Fair maintenance-work scoring | MISSING | — | — |
| 4.9 Bias mitigation via auditable explainability | STUBBED_OR_PARTIAL | **[Explainability 2026-09-03]** Every score is now auditable per candidate: the stored explanation names each contributing factor, its weight and its evidence, and the recruiter UI exposes that drill-down (5.8). Scoring inputs are technical only. | The stated mitigation mechanism now exists. It is partial in the same way 4.5 is — it can only audit the one evidence source that produces data. |
| 4.10 LinkedIn + certificate validation (GF-1) | MISSING | `linkedin` regex-extracted in `ner.py:253` and stored, never validated or scored. No certificate parsing/OCR/credential-ID logic. | — |
| 4.11 Determinism / re-explainability | DONE_CORRECTLY | **[Explainability 2026-09-03]** The `scores` row persists `composite_score`, all three `subscores`, the redistributed `weights` and a versioned `explanation` (`version`, `generated_at`, factors, evidence, skill evidence, weighting scheme). `ScoreBreakdown.jsx` renders that stored record rather than re-deriving anything in the browser, and shows the stored timestamp and format version. `resumes.parser_version` records the producing parser. | A stored score is fully re-explainable offline. Aggregation is pure and deterministic given the sub-scores (`aggregate()` has no time/random inputs); the upstream parser's determinism is a separate Module 1 concern. |

### Module 5: Recruiter Dashboard & Candidate Portal

| Item | Classification | Evidence | Notes |
|---|---|---|---|
| 5.1 Web upload portal (validation, progress, errors) | STUBBED_OR_PARTIAL | `Upload.jsx` — drag/drop, `.pdf,.docx` filter, job select, error messages. **[Candidate loop 2026-09-03]** `Processing.jsx` progress is now **real** — XHR `upload.onprogress` for the upload, an honest indeterminate state for the (un-streamed) server analyze, and a real error panel on non-2xx / network failure. | The fake random progress is fixed. Still open: the "Choose File" path (`handleFileChange`) doesn't validate type; candidate must manually paste a JD even though the selected job already has `description`; no corrupt-file handling. |
| 5.2 GitHub auth + skippable | STUBBED_OR_PARTIAL | Skipping is the only path (no GitHub integration). `profiles.github_url` optional at signup. | "First-class skip" is accidental; connecting GitHub is impossible. |
| 5.3 Take assessment + session persistence | MISSING | No assessment route in `App.jsx`. | **[UI merge 2026-09-03]** `Assessment.jsx` now exists as an unrouted UI shell with no backend (`/api/assessment/*` 404s → 5 hardcoded questions). No session persistence, no results storage. Still MISSING. |
| 5.4 Candidate visibility of submission/parse status | DONE_CORRECTLY | **[Candidate loop 2026-09-03]** `Processing.jsx` keeps the analyze response and navigates to `/candidate/results` (now routed in `App.jsx` under `CandidateLayout`) with it in `location.state`; `Results.jsx` also falls back to `GET /api/candidate-analysis` when opened directly. It renders the candidate's parsed skills/experience/education/projects, the composite score with match level and evidence-limited badge, the stored explanation summary, and `components/recruiter/ScoreBreakdown.jsx` — the identical composite→factor→evidence drill-down the recruiter modal shows. Loading / "no analysis yet" / load-error states are all handled; parse failures surface an error panel on the processing screen. | The loop is closed end to end: upload → analyze → persisted score → the candidate's own audit view, reusing the recruiter breakdown component (no second implementation) and reading only fields the API actually emits. It shows one real evidence source because that is all the pipeline produces (4.1), not because the page hides anything. |
| 5.5 Candidate rankings by composite score (FR-14) | DONE_CORRECTLY | `GET /api/candidates` returns Supabase `scores` scoped to the recruiter's jobs, ranked by composite, deduped to latest per candidate. `recruiter/Dashboard.jsx` ranks across all jobs; **[Explainability 2026-09-03]** `JobDetails.jsx` was rewritten to filter that same list to one `jobId` — its `mockData.js` ranking is gone. | Ranking and comparison are real end to end and survive restart. That the composite currently has one input is 4.1's gap, not this item's. |
| 5.6 Filtering (skill / score band / evidence) | DONE_CORRECTLY | **[Explainability 2026-09-03]** `JobDetails.jsx` filters on all three axes the spec names: minimum-score slider, evidenced-skill `<select>` built from the skills these résumés were actually scored against, and an evidence-availability `<select>` (all / fully evidenced / evidence-limited). The fake `applied/shortlisted/rejected` status tabs (no backing data) and the inert dashboard `<select>` (no `onChange`) were both deleted. | Filters operate on persisted skill evidence, not on a client-side guess. |
| 5.7 Score breakdown: skills / repo / assessment pillars | STUBBED_OR_PARTIAL | **[Explainability 2026-09-03]** `ScoreBreakdown.jsx` renders all three pillars as `explanation.factors`, each with its sub-score, weight %, point contribution and direction. The parsing pillar expands into matched/missing job skills and the four similarity metrics; the GitHub and assessment pillars render an explicit "Evidence not available" panel carrying the stored reason. | The three pillars and their intermediate evidence are now visible and real. Partial only because two pillars have no data upstream — by design they show why, not a zero. |
| 5.8 Audit drill-down (composite→sub-score→evidence) | STUBBED_OR_PARTIAL | **[Explainability 2026-09-03]** `CandidateModal.jsx` opens from both the dashboard and `JobDetails.jsx` and drills composite → factor (weight, contribution, direction) → typed evidence items (skill lists, each similarity metric with its within-factor weight and note) → per-skill evidence table. Footer states when the explanation was stored and its format version. | The drill-down mechanism is complete and reads the persisted record verbatim. It cannot yet reach "which repo, which commit metric, which rubric line" because those sources do not exist. |
| 5.9 Flagged inconsistencies surfaced with evidence | STUBBED_OR_PARTIAL | **[Explainability 2026-09-03]** `ScoreBreakdown.jsx` has a Flagged-inconsistencies section with three states: flags present, none found, or an explicit "Inconsistency detection not available" panel quoting the backend's stored reason. The dashboard's "Attention required" panel does the same. | Presentation is correct and honest; the flags themselves are still not computed (4.6). |
| 5.10 Evidence-limited candidates shown fairly | DONE_CORRECTLY | **[Explainability 2026-09-03]** `evidenceLimited` drives an "Evidence-limited" badge on candidate rows and in the modal, a dashboard stat card, and a summary line stating that missing sources had their weight redistributed rather than being scored as zero. Each unavailable source shows its own stored reason. | A candidate without GitHub/assessment reads as evidence-limited with an explanation, not as a low or blank score. |
| 5.11 Per-skill confidence visualisation | DONE_CORRECTLY | **[Explainability 2026-09-03]** The hardcoded `skillsDistribution` pie and `weeklyApplications` bars are **deleted**. `ScoreBreakdown.jsx` renders a per-skill table (skill → Evidenced / Not found / Claimed only, plus "confirmed by N of M available sources"); `recruiter/Dashboard.jsx` shows a real cross-candidate "Skill evidence" summary (evidenced/required per skill) and a last-7-days chart computed from each score's `created_at`. The constant `level: 'Unverified'` field is gone from the serializer. | Per-skill confidence is real but currently coarse — with one evidence source a skill is confirmed by 1 of 1 or 0 of 1. It gets finer automatically as sources are added; no code change needed. |
| 5.12 Bias-free presentation | DONE_CORRECTLY | Ranking views show name/score/skills/location only; no demographic fields | Location is shown but no protected attributes. Satisfied. |

### Module 6: Evaluation & Evidence of Correctness

| Item | Classification | Evidence | Notes |
|---|---|---|---|
| 6.1 Extraction accuracy 85–90% measured | MISSING | No eval harness, no labelled data in repo | — |
| 6.2 Skill F1 ≥0.80 measured | MISSING | — | — |
| 6.3 Processing ≤10s benchmarked (incl. OCR) | MISSING | No benchmark; no OCR path | — |
| 6.4 GitHub ≥0.7 correlation with human judgement | MISSING | No GitHub module | — |
| 6.5 LLM ≥0.75 correlation, APPS-calibrated | MISSING | No LLM module | — |
| 6.6 ≥100 concurrent users load test | MISSING | — | — |
| 6.7 Uptime ≥95% monitored + graceful-failure verified | MISSING | No monitoring; graceful failure not implemented (0.7) | — |
| 6.8 Datasets used as specified (§8) | MISSING | No Kaggle/HF/APPS dataset usage; skills are a hand-written list in `ner.py:6` | — |

---

## 4. Integration Requirement Assessment

**The end-to-end explainable pipeline does not connect.** What exists is a single linear hop:

`resume upload → Express → FastAPI parse (text + keyword skills + S-BERT similarity) → number → in-memory array → recruiter dashboard list`

Against the required pipeline (parsed entities seed **both** GitHub verification **and** assessment generation; both feed **one normalised weighted composite**; composite is **auditable back to evidence** on the dashboard):

- Parsed entities seed **nothing** downstream — extracted `github`/`linkedin`/`projects` are returned to the browser but no GitHub or assessment module consumes them. **[Candidate loop 2026-09-03]** `Processing.jsx` no longer discards the analyze response — it is persisted server-side and shown to the candidate on `/candidate/results` — but it still feeds no further pipeline stage because none exists.
- GitHub verification: not wired (dead helper only).
- Assessment generation: does not exist.
- Normalised weighted composite: **[Explainability 2026-09-03]** the aggregation engine exists (normalise → weight → redistribute), but with one input the composite still equals parsing similarity × 100.
- Auditability to evidence: **[Explainability 2026-09-03]** now real for the evidence that exists — `resumes` and `scores` persist, and the stored `explanation` drives the dashboard drill-down down to matched/missing skills and each similarity metric. It cannot reach repo or rubric evidence because neither is produced.
- Recruiter dashboard: **[Explainability 2026-09-03]** entirely Supabase-backed. `mockData.js` is deleted; `Dashboard.jsx`, `JobDetails.jsx` and `CandidateModal.jsx` render only persisted data, with explicit "evidence not available" states where a source produced nothing.

Per the checklist's own standard ("Four working modules that do not connect end to end do not satisfy the project's stated contribution"), the project has **one partially-working module** (parsing) and no integration. The actual contribution of the project is currently unrealised.

---

## 5. Guide-Feedback Compliance (GF-1 .. GF-5)

| GF | Requirement | Status | Evidence |
|---|---|---|---|
| GF-1 | LinkedIn + certificate validation | **MISSING** | LinkedIn URL regex-captured (`ner.py:245,253`) but never validated/scored; no certificate parsing, OCR, or credential-ID cross-reference anywhere. |
| GF-2 | OCR is a must | **MISSING** | `extractor.py` is pdfplumber/python-docx text extraction only; no OCR library in `nlp-engine/requirements.txt`; scanned PDFs yield empty entities. |
| GF-3 | Fair scoring for support/maintenance candidates | **MISSING** | No GitHub commit-type analysis, no distinct scoring matrix; scoring model doesn't exist. |
| GF-4 | GitHub must be optional | **PARTIAL** | **[Explainability 2026-09-03]** The scoring half is now designed rather than accidental: an absent source keeps `value:null` with weight 0, its weight is redistributed across what remains, and the dashboard annotates the candidate as evidence-limited with the reason. Still missing the other half — there is no way to *connect* GitHub at all (2.2), so the "skip" path has nothing to skip. |
| GF-5 | Score explainability is crucial | **LARGELY ADDRESSED** | **[Explainability 2026-09-03]** Dedicated layer (`backend/Services/explainability.js`) persists a per-factor explanation — direction, weight, point contribution, cited evidence — with every score; `ScoreBreakdown.jsx` renders it as a composite → sub-score → evidence drill-down reachable from the dashboard and the job view, plus a per-skill evidence table. Remaining gaps are upstream, not in the explainability layer: only one of three factors has evidence to cite (4.5), and flag computation is still absent (4.6). |

---

## 6. Appendix: Concrete cruft / bugs found
- ~~`backend/Models/*.Model.js` + `mongoose` dep~~ — deleted 2026-09-03.
- `backend/Controllers/githubAggregator.js` — unused; `git status` shows `candidate.js` and `recruiter.js` controllers already deleted.
- ~~`frontend` uses `import.meta.env.VITE_API_BASE_URL` under Create React App~~ — **RESOLVED 2026-09-03 (candidate-loop task)**: every API-base read is now `process.env.REACT_APP_API_BASE_URL` (`AuthContext.jsx`, `recruiter/Jobs.jsx`, `admin/Dashboard.jsx`, `candidate/CandidateJobs.jsx`, `public/Login.jsx` migrated to join the two recruiter pages already done). `grep import.meta frontend/src` is now empty; `frontend/.env` (gitignored) renamed the var. `AuthContext`'s same-origin check and the pages' request URLs now read the same variable.
- ~~`frontend/src/data/recruiter/mockData.js`~~ — **deleted 2026-09-03** (explainability task) along with its last importer. The plaintext `"123456"` passwords went with it. `JobDetails.jsx` was rewritten against the API and moved onto the light theme.
- ~~**[UI merge 2026-09-03]** `POST /api/auth/update-password` — unauthenticated account takeover: `{username,newPassword}` → service-role `updateUserById` with `email_confirm:true`. No token, no rate limit.~~ **FIXED 2026-09-03**: endpoint deleted; `updatePassword` and every `admin.updateUserById` call removed from the reset path. Replaced by `POST /api/auth/request-password-reset` (rate-limited 5/15min per IP, generic response, sends `resetPasswordForEmail`) + `POST /api/auth/reset-password` (verifies the emailed recovery token on an anon-key client, then `updateUser({password})`). `ResetPassword.jsx` reworked to the two-step flow. Note: now depends on `SUPABASE_ANON_KEY` being set in `backend/.env` (only listed as "if needed" in `.env.example`).
- **[UI merge 2026-09-03]** `frontend/src/pages/candidate/Assessment.jsx` — still added-but-never-routed; calls non-existent `/api/assessment/*` routes and always uses 5 hardcoded `MOCK_QUESTIONS`. Dead on arrival. (`Results.jsx` was in the same state; **fixed** below.)
- ~~**[Explainability 2026-09-03]** `Results.jsx` is out of date with the API contract and unrouted~~ — **RESOLVED 2026-09-03 (candidate-loop task)**: rewritten against the `serializeCandidate` shape (`credibilityScore`, `explanation.factors`, `skillEvidence`, `evidenceLimited`, `matchLevel`, `extractedSkills`/`experience`/`education`/`projects`), routed at `/candidate/results`, and reached from `Processing.jsx`. It reuses `components/recruiter/ScoreBreakdown.jsx` for the breakdown — no second component. The dead field reads, aliased `githubScore`/`assessmentScore`, mock fallback object and non-existent `.badge` classes are gone.
- ~~**[UI merge 2026-09-03]** `CandidateModal.jsx` still references `glass-card` / `corner-decoration` / `bg-white/5` / `accent-*` utilities~~ — resolved 2026-09-03: `CandidateModal.jsx` was rewritten onto the light-theme tokens (`card`, `bg-muted`, `text-foreground`, `text-success|warning|destructive`) and now delegates its body to `components/recruiter/ScoreBreakdown.jsx`. Its fake "Send Offer" button was dropped; contact is a real `mailto:` link.
- ~~`analysis.controller.js` `allAnalyses` / `latestAnalysis` / `latestJob` module-level mutable state~~ — removed 2026-09-03; replaced with `resumes`/`scores` Supabase persistence.
- ~~`Processing.jsx` progress bar is simulated (`setInterval`, `Math.random()*8`); pipeline step labels ("Analyzing GitHub profile", "Generating credibility score") describe stages that don't run.~~ — **RESOLVED 2026-09-03 (candidate-loop task)**: real XHR `upload.onprogress` for the upload phase, an honest indeterminate ring for the un-streamed server analyze, and the step list cut to the two stages that run. Note: under React 18 StrictMode the analyze effect still runs twice in dev (the first XHR is aborted on cleanup) — same class of double-fire the old fetch had; dev-only.
- `backend/Routes/parse.routes.js` (`POST /api/parse`) — a second resume→FastAPI forwarder that persisted nothing. **DELETED 2026-09-03 (candidate-loop task)**, along with its `import`/`app.use` in `backend/index.js` and its `README.md` API-surface row. Nothing imported it.
- `index.js:32` session secret defaults to `'patina-development-session-secret'` when unset (warns, doesn't fail, outside production).
