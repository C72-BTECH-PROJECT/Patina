# AUDIT.md — Verified State of the Codebase

_Generated 2026-09-02 by module-by-module code read against CHECKLIST.md.
Classifications: DONE_CORRECTLY / DONE_BUT_BROKEN_OR_HACKY / STUBBED_OR_PARTIAL / MISSING.
project_checklist.md was NOT used as evidence._

## 1. Executive Summary

Patina is currently a **resume-parsing demo with a hiring-portal shell around it**, not the four-module explainable pipeline the spec describes. Only one of the four methodology algorithms exists in any real form: a Python/FastAPI NLP service that extracts text (pdfplumber/python-docx), runs spaCy preprocessing, does **keyword/regex skill matching** (not a trained NER model), and computes a genuine S-BERT semantic-similarity score against the job description. There is **no GitHub Aggregator service, no LLM/assessment engine, no unified scoring engine, and no explainability layer** — the "Credibility Score" is literally `round(semantic_similarity * 100)`. Analysis results now persist to Supabase `resumes` + `scores` tables (added 2026-09-03); there is still no `Repository` table (GitHub module unbuilt). Authentication is email/password (Supabase Auth + Express session), **not OAuth 2.0**, and there is no GitHub OAuth. The recruiter dashboard is half-wired to the in-memory analyses and half-driven by a hardcoded `mockData.js` (the job-details candidate list, GitHub stats, assessment breakdowns, and "flagged inconsistencies" are all mock). Guide feedback items (OCR, LinkedIn/certificates, maintenance-fair scoring, GitHub-optional weighting, explainability) are essentially unaddressed. Dead code is present: four Mongoose models and a `githubAggregator.js` helper that nothing imports.

## 2. Repo Inventory

### Services / directories that actually exist
| Path | What it is | State |
|---|---|---|
| `frontend/` | React 19 app, **Create React App** (`react-scripts@5.0.1`), TailwindCSS, framer-motion, recharts, react-router 7 | Runs; many pages are UI-only or mock-backed. Note: several files read `import.meta.env.VITE_*` (`recruiter/Dashboard.jsx:8`, `Jobs.jsx:7`, `context/AuthContext.jsx:4`) which is a **Vite** idiom and is `undefined` under CRA/webpack — falls back to `http://localhost:5000`. |
| `backend/` | Node.js/Express 5 (ESM), `express-session`, `multer`, `@supabase/supabase-js`, `node-fetch`, `form-data` | Runs; thin routing/forwarding layer + Supabase CRUD for auth/jobs/admin. |
| `nlp-engine/` | Python FastAPI microservice (`app/main.py`), spaCy `en_core_web_sm`, `sentence-transformers` (`all-MiniLM-L6-v2`), pdfplumber, python-docx, scikit-learn | The only real "processing" service. Single `POST /parse` endpoint. |
| `supabase/migrations/` | 5 SQL migrations: `profiles`, `jobs`+`applications`, admin role, profile suspension, `resumes`+`scores` (+ `resumes` storage bucket) | Schema now covers **User, Resume, Score** + jobs/applications. **Repository** entity still absent. |
| `Docs/` | `project_checklist.md` (stale, do not trust), `Architecture.md` (deleted in working tree) | — |

### Services the spec requires that DO NOT exist
- **GitHub Aggregator microservice** — absent. (`backend/Controllers/githubAggregator.js` exists but is imported by nothing; it only lists repo `.language` strings — no OAuth, no metrics, no file analysis.)
- **Generative AI / Assessment Engine** — absent entirely (no LLM SDK anywhere; `openai`/`gemini`/`anthropic` appear in zero source files).
- **Unified Scoring Engine / Explainability layer** — absent.

### Tech-stack notes
- **DB**: Supabase (Postgres). Backend uses the **service-role key** for all queries (`backend/Config/supabase.js`), RLS policies are defined but bypassed by the server.
- **Dead code**: ~~`backend/Models/*.Model.js` Mongoose schemas + `mongoose` dependency~~ — deleted 2026-09-03 (models directory removed, `mongoose` dropped from `package.json` + lockfile).
- **Auth**: `signup`/`login`/`me`/`logout` in `auth.controller.js`; session cookie `patina_session`; `SESSION_SECRET` has an insecure dev default.
- **No test suite** anywhere (backend `test` script = `exit 1`; no pytest; no measured metrics).
- **Transport**: hardcoded `http://localhost:*` throughout; no HTTPS/TLS config.

### Data flow that actually runs
`Upload.jsx` (pick job, paste JD, choose PDF/DOCX) → `Processing.jsx` `POST http://localhost:5000/api/analyze` (multipart: `resume`, `jobId`) → `analysis.controller.analyzeResume` looks up job in Supabase, forwards `resume`+`jd` to `http://localhost:8000/parse` → FastAPI returns entities + `semantic_analysis` → controller uploads the raw file to the `resumes` storage bucket, inserts a `resumes` row (parsed entities) and a `scores` row (`composite_score = round(similarity*100)`, named `parsing_semantic_alignment` sub-score, weights, explanation) → `Processing.jsx` navigates to `/candidate/dashboard` (a static marketing page). Recruiter `Dashboard.jsx` reads `GET /api/candidates`, now served from Supabase (`scores` ⨝ `resumes` ⨝ `profiles`, scoped to the recruiter's own jobs, latest score per candidate). `JobDetails.jsx` / `CandidateModal.jsx` still use `data/recruiter/mockData.js`.

---

## 3. Per-Module Assessment

### Module 0: Cross-Cutting Requirements

| Item | Classification | Evidence | Notes |
|---|---|---|---|
| 0.1 Microservices architecture | STUBBED_OR_PARTIAL | `frontend/`, `backend/`, `nlp-engine/` exist as 3 tiers; `analysis.controller.js:49` forwards files to FastAPI | Only the NLP service is separated. GitHub Aggregator and Assessment Engine microservices do not exist. 2 of 4 required Python services missing; the "architecture" is a 2-service prototype. |
| 0.2 Data layer (User/Resume/Repository/Score) | STUBBED_OR_PARTIAL | `20260903_create_resumes_and_scores.sql` adds `public.resumes` + `public.scores` (+ private `resumes` storage bucket); `analysis.controller.js` writes both on every analyze and reads them for `/api/candidates` and `/api/candidate-analysis`. `allAnalyses[]` deleted. | **User**, **Resume**, **Score** now persist. **Repository** still absent (GitHub module not built). Parsed data survives restart. |
| 0.3 Entity completeness (sub-scores persisted) | DONE_BUT_BROKEN_OR_HACKY | `resumes` stores raw file ref (storage object path) + parsed `skills`/`experience`/`education`/`projects`/`contact`/`project_links`. `scores.subscores` stores the named `parsing_semantic_alignment` sub-score with its components; `github_evidence`/`assessment_results` recorded as `null` with weight 0. `scores.weights` + `scores.explanation` persisted. | Structurally complete and re-explainable. Still only one real sub-score exists; `Repository` metadata has nowhere to go yet. OCR/layout quality of the parsed arrays unchanged (see 1.2/1.3). |
| 0.4 Auth: OAuth 2.0, two classes | DONE_BUT_BROKEN_OR_HACKY | `auth.controller.js` uses `supabase.auth.signInWithPassword` + Express session; `Middlewares/auth.Middleware.js` `requireRole()` separates CANDIDATE/RECRUITER/ADMIN; route guards e.g. `analysis.routes.js:7-9` | **Not OAuth 2.0** — username/password only. No Google/GitHub OAuth despite `project_checklist.md` claim. Role separation itself is enforced correctly server-side. |
| 0.5 Secrets server-side | DONE_CORRECTLY | `backend/.env.example` (Supabase keys only), `Config/supabase.js` reads `process.env`; `.env` gitignored; no GitHub/LLM keys exist because those integrations don't exist | Trivially satisfied — there are no GitHub/LLM keys yet. Frontend bundle contains no secrets. |
| 0.6 HTTPS | MISSING | `fetch('http://localhost:8000/parse')`, `http://localhost:5000` hardcoded in `Upload.jsx:195`, `Processing.jsx:277`, etc. | No TLS anywhere. |
| 0.7 Graceful degradation (retry + fallback) | MISSING | `analysis.controller.js:54-57` returns HTTP 502 on FastAPI failure; no retry, no fallback, no degraded score. `githubAggregator.js` catch returns `[]` silently | An NLP outage hard-fails the only pipeline. No external-call resilience. |
| 0.8 Concurrency / async queue | MISSING | `analyzeResume` is a synchronous request handler; `Processing.jsx` fakes progress with `setInterval` random increments (`Processing.jsx:265-271`) | No queue, no worker, no parallelism. |
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
| 1.14 Parsing sub-score emitted & persisted | DONE_BUT_BROKEN_OR_HACKY | `embedder.analyse` returns `similarity_score`, `skill_coverage`, `matched_skills`, etc.; `analysis.controller.buildScoreRecord` writes it to `scores.subscores.parsing_semantic_alignment` (value + weight + components) on every analyze. | Now persisted as a named sub-score with its components. Still the *only* input, so it also equals the composite until GitHub/assessment land. Underlying number quality unchanged (keyword-dominated, see 1.7). |

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

Whole-module note: **nothing in the repo addresses assessment.** No LLM SDK/HTTP calls, no question/answer/rubric data model, no candidate assessment UI, no route. `CandidateModal.jsx:250-289` renders an "AI Assessment" card **only from `mockData.js`** (`assessment.categories` hardcoded). `Processing.jsx` step 3 "Analyzing GitHub profile" and the pipeline steps are cosmetic.

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

Whole-module note: **no scoring engine, normalization, weighting config, or explainability layer exists.** The only "score" is `credibilityScore = Math.round(semanticSimilarity * 100)` (`analysis.controller.js:94`).

| Item | Classification | Evidence | Notes |
|---|---|---|---|
| 4.1 Three-input composite | DONE_BUT_BROKEN_OR_HACKY | `analysis.controller.js:92-94` — composite = NLP semantic similarity only | Comment at `analysis.controller.js:92-93` explicitly says GitHub/assessment weights "added only when those services exist." One input, not three. |
| 4.2 Normalisation before aggregation | MISSING | No aggregation step | — |
| 4.3 Weighted aggregation (documented, configurable, 0–100) | STUBBED_OR_PARTIAL | `embedder.py:117` has magic weights `0.60*skill_coverage + 0.40*semantic_score` inside the NLP service; `*100` in Node | Buried magic numbers inside the parser, not a documented/configurable scoring scheme. |
| 4.4 Sub-scores retained alongside composite | DONE_BUT_BROKEN_OR_HACKY | `scores.subscores` persists `parsing_semantic_alignment` (value/weight/components incl. matched/missing skills, coverage, reason) alongside `composite_score`; `github_evidence`/`assessment_results` stored as explicit `null`. `serializeCandidate` forwards `subScores`/`weights`/`explanation` to the frontend. | Retention + persistence now correct. Only one sub-score has real content; the frontend does not yet render the breakdown (5.7/5.8 unchanged). |
| 4.5 Explainability layer (FR-13, GF-5) | MISSING | `embedder.py` produces a `match_reason` string; no dedicated explainability layer, no per-factor contribution/direction/weight breakdown, no evidence citations | The project's headline deliverable is absent. |
| 4.6 Flagged inconsistencies computed | MISSING | `Application.Model.js:71-77` and `CandidateModal.jsx:292` render `flaggedInconsistencies` — **all from `mockData.js`**. No computation. Recruiter Dashboard "2 Flagged Applications" is a hardcoded string (`Dashboard.jsx:507`). | — |
| 4.7 Missing-evidence weight redistribution | MISSING | — | — |
| 4.8 Fair maintenance-work scoring | MISSING | — | — |
| 4.9 Bias mitigation via auditable explainability | MISSING | No explainability → mitigation not present | — |
| 4.10 LinkedIn + certificate validation (GF-1) | MISSING | `linkedin` regex-extracted in `ner.py:253` and stored, never validated or scored. No certificate parsing/OCR/credential-ID logic. | — |
| 4.11 Determinism / re-explainability | DONE_BUT_BROKEN_OR_HACKY | `scores` row persists `composite_score`, `subscores`, `weights` and an `explanation` object (per-factor direction/weight/contribution/evidence) at analyze time, so a stored score can be re-explained without re-running the parser. | Re-explainability now holds for the one real input. Full determinism of the composite awaits the actual weighted aggregation engine (4.2/4.3). |

### Module 5: Recruiter Dashboard & Candidate Portal

| Item | Classification | Evidence | Notes |
|---|---|---|---|
| 5.1 Web upload portal (validation, progress, errors) | STUBBED_OR_PARTIAL | `Upload.jsx` — drag/drop, `.pdf,.docx` filter, job select, error messages; `Processing.jsx` shows progress | Progress is a **fake random `setInterval`** (`Processing.jsx:265-271`), not real. Drop handler validates type but the "Choose File" path (`handleFileChange:237`) does not. Candidate must manually paste a JD even though the selected job already has `description`. No corrupt-file handling. |
| 5.2 GitHub auth + skippable | STUBBED_OR_PARTIAL | Skipping is the only path (no GitHub integration). `profiles.github_url` optional at signup. | "First-class skip" is accidental; connecting GitHub is impossible. |
| 5.3 Take assessment + session persistence | MISSING | No assessment UI/route in `App.jsx` | — |
| 5.4 Candidate visibility of submission/parse status | MISSING | After `POST /api/analyze`, `Processing.jsx:297` navigates to `/candidate/dashboard` = `candidate/Dashboard.jsx`, a static "About Patina" marketing page. Candidate never sees their parse result, score, or status. | Analysis response is fetched and `await resp.json()` result is **discarded** (`Processing.jsx:287`). |
| 5.5 Candidate rankings by composite score (FR-14) | DONE_BUT_BROKEN_OR_HACKY | `recruiter/Dashboard.jsx:249` sorts by `credibilityScore` desc; `GET /api/candidates` now returns Supabase `scores` scoped to the recruiter's jobs, ranked by composite, deduped to latest per candidate. Survives restart. | Still ranks by an NLP-similarity-only number. `JobDetails.jsx` ranking (`:143`) still uses `mockData.js`. Per-job filtering happens server-side now but the dashboard doesn't segment by job. |
| 5.6 Filtering (skill / score band / evidence) | STUBBED_OR_PARTIAL | `JobDetails.jsx` has a score slider + status tabs (`:117,137-143`) but operates on `mockData.js`. `recruiter/Dashboard.jsx:418` filter `<select>` has no `onChange` handler — inert. | — |
| 5.7 Score breakdown: skills / repo / assessment pillars | DONE_BUT_BROKEN_OR_HACKY | `CandidateModal.jsx` shows Skills / GitHub Analysis / AI Assessment sections | GitHub commits/repos/languages and assessment categories are read from mock candidate objects; for real analyses these fields don't exist so they render `0` / hidden. |
| 5.8 Audit drill-down (composite→sub-score→evidence) | MISSING | No drill-down; no evidence links; modal shows flat mock numbers | The stated "headline differentiator" is absent. |
| 5.9 Flagged inconsistencies surfaced with evidence | DONE_BUT_BROKEN_OR_HACKY | `CandidateModal.jsx:292-322` renders flags — from `mockData.js` only | No real flags computed (see 4.6). |
| 5.10 Evidence-limited candidates shown fairly | MISSING | No "assessment-only / evidence limited" indicator anywhere | — |
| 5.11 Per-skill confidence visualisation | DONE_BUT_BROKEN_OR_HACKY | `recruiter/Dashboard.jsx:195-200` "Top Skills" pie chart is **hardcoded** `skillsDistribution` (React 35 / Node 25 / Python 20 / Other 20). `CandidateModal` skill list shows `level` from mock. | No real per-skill confidence. |
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

- Parsed entities seed **nothing** downstream — extracted `github`/`linkedin`/`projects` are returned to the browser and dropped. `Processing.jsx:287` discards the parse response entirely.
- GitHub verification: not wired (dead helper only).
- Assessment generation: does not exist.
- Normalised weighted composite: does not exist; composite = parsing similarity × 100.
- Auditability to evidence: does not exist; nothing is persisted (`allAnalyses` is process memory), and there is no `Score`/`Resume`/`Repository` table.
- Recruiter dashboard: partly reads the in-memory analyses (`/api/candidates`), partly reads `mockData.js` (`JobDetails`, `CandidateModal` GitHub/assessment/flags, dashboard charts).

Per the checklist's own standard ("Four working modules that do not connect end to end do not satisfy the project's stated contribution"), the project has **one partially-working module** (parsing) and no integration. The actual contribution of the project is currently unrealised.

---

## 5. Guide-Feedback Compliance (GF-1 .. GF-5)

| GF | Requirement | Status | Evidence |
|---|---|---|---|
| GF-1 | LinkedIn + certificate validation | **MISSING** | LinkedIn URL regex-captured (`ner.py:245,253`) but never validated/scored; no certificate parsing, OCR, or credential-ID cross-reference anywhere. |
| GF-2 | OCR is a must | **MISSING** | `extractor.py` is pdfplumber/python-docx text extraction only; no OCR library in `nlp-engine/requirements.txt`; scanned PDFs yield empty entities. |
| GF-3 | Fair scoring for support/maintenance candidates | **MISSING** | No GitHub commit-type analysis, no distinct scoring matrix; scoring model doesn't exist. |
| GF-4 | GitHub must be optional | **STUBBED (accidental)** | Pipeline runs without GitHub only because GitHub is entirely unimplemented; no designed skip path, no weight redistribution, no "evidence unavailable" annotation. |
| GF-5 | Score explainability is crucial | **MISSING** | No explainability layer; `credibilityScore` is an opaque `similarity*100`. `embedder.py` emits a `match_reason` sentence and `matched/missing_skills`, but the Node layer forwards only `match_level` and nothing is shown to recruiters as a factor-by-factor breakdown. No drill-down (5.8), no flagged-inconsistency computation (4.6). |

---

## 6. Appendix: Concrete cruft / bugs found
- ~~`backend/Models/*.Model.js` + `mongoose` dep~~ — deleted 2026-09-03.
- `backend/Controllers/githubAggregator.js` — unused; `git status` shows `candidate.js` and `recruiter.js` controllers already deleted.
- `frontend` uses `import.meta.env.VITE_API_BASE_URL` under Create React App (`recruiter/Dashboard.jsx:8`, `recruiter/Jobs.jsx:7`, `context/AuthContext.jsx:4`) — always `undefined`, silently falls back to localhost. Either migrate to Vite or use `process.env.REACT_APP_*`.
- `frontend/src/data/recruiter/mockData.js` — drives `JobDetails.jsx` and all GitHub/assessment/flag UI in `CandidateModal.jsx`; contains plaintext passwords (`"123456"`).
- ~~`analysis.controller.js` `allAnalyses` / `latestAnalysis` / `latestJob` module-level mutable state~~ — removed 2026-09-03; replaced with `resumes`/`scores` Supabase persistence.
- `Processing.jsx` progress bar is simulated (`setInterval`, `Math.random()*8`); pipeline step labels ("Analyzing GitHub profile", "Generating credibility score") describe stages that don't run.
- `index.js:32` session secret defaults to `'patina-development-session-secret'` when unset (warns, doesn't fail, outside production).
