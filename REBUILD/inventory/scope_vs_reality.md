# Scope vs reality (Phase 1 synthesis)

Auditor: final Phase 1 auditor, 2026-11-12. Branch `rebuild/fable` = `main` = `6da8d3f`. Working tree outside `REBUILD/` unchanged.

Inputs, cited by short name:
- `[PS]` `promised_scope.md` (PS-001..PS-079, C-1..C-13).
- `[FE §n]` `services.frontend.md`.
- `[BE §n]` `services.backend.md`.
- `[PY §n]` `services.python.md`.
- `[BL-nn]`, `[E01..E19]` `baseline.md` checks and smoke-pass steps.
- `[AUDIT x.y]` the older `AUDIT.md` row. Used as a lead only; see §5 for where I differ from it.

Labels: **VERIFIED** = someone ran it (a baseline check, a behavioural test, or one of my checks below). **READ** = code read only. **UNKNOWN** = not established.

## Method and the rules I applied

1. **UI cap.** A behaviour that is produced only by a direct API call is at most `PARTIAL`, with gap size `wiring`. This applies to everything on the scoring path. The only call that writes a `scores` row is `POST /api/analyze`, and no UI path calls it ([FE §2.9]; my check A4). It also applies to internal properties (normalisation, resilience, retention) that only ever run inside that call.
2. **Never observed.** Some code is real (not a placeholder) but was never seen working, only because of configuration: there is no LLM key ([BL-26], [BL-27]). I mark that code `PARTIAL` and say "never observed" in the evidence. I use `STUB` only for placeholder, fake, shape-only or output-discarded code.
3. **Named techniques and measured targets.** A named technique (custom NER, PFQS, 8DFS, CodeQL/SonarQube, OCR, OAuth 2.0, HTTPS) is not met by a different technique. A numeric target is not met without a recorded measurement.
4. **Merged ids.** Where a PS promise and a CHECKLIST item are the same promise, they share one row. "PS-0nn (part)" means the PS promise is split across several CHECKLIST rows. GF-1..GF-5 have roll-up rows in the guide-feedback block. Those roll-ups overlap the module rows they summarise.

My own side-effect-free checks (VERIFIED unless marked READ):
- **A1 (keys).** `git ls-files | grep .env` lists only the five `*.env.example` files. A pattern scan of `frontend/build/static/js/*.js` and of tracked non-md files found 0 hits for each of: JWT prefix `eyJhbGciOi`, `ghp_`, `github_pat_`, `AIza`, `sk-or-v1`, `service_role`, `supabase.co`. Counts only; no values were printed.
- **A2 (scope).** `git grep -niE "soft[ _-]?skill|registrar|degree[ _-]?verif|verify[ _-]?degree"` over `backend/Controllers`, `backend/Services`, `nlp-engine/app`, `github-evidence/app`, `assessment-service/app` and `frontend/src` gives 0 hits. The NLP skill list (`nlp-engine/app/ner.py:7-55`) has no soft-skill terms.
- **A3 (datasets).** A grep for `kaggle|Annotated_NER|Mehyaar|IT Job Posts|it-job-roles|APPS` outside `.md`/`.docx` gives only false positives (`'apps'` in a GitHub reserved-name list, a test variable `apps`). There are no tracked `.csv`/`.jsonl`/`.parquet` files.
- **A4 (UI reach).** A grep of `frontend/src` for `candidate/processing|candidate/results|/api/analyze|applications/shortlist` finds only the route `App.jsx:57` and `Processing.jsx:175,201`. Nothing navigates to Processing, and nothing calls shortlist.
- **A5 (base URLs).** `REACT_APP_API_BASE_URL` is read in 14 files. `VITE_API_BASE_URL` is read in 1 (`AllCandidates.jsx:8`). A hardcoded `http://localhost:5000` appears in 2 (`ResetPassword.jsx:6`, `CreateJob.jsx:211`).
- **R1–R7 (READ).**
  - R1: `nlp-engine/app/main.py:70-73` computes `preprocess(raw_text)` but calls `extract_entities(raw_text)`.
  - R2: `backend/Controllers/assessment.controller.js:46-110` (`parseStoredResume`) parses the stored file and **inserts a `resumes` row** from a UI-triggered path. `:117-119` selects no `contact`. `:129,145` take the resume text from `raw_text_preview` (≤300 chars, `nlp-engine/app/main.py:87`). `:164-170` answers an empty text with 400 "Upload a resume first".
  - R3: `assessment.controller.js:484-516` folds an assessment only into an *existing* score row.
  - R4: `backend/Routes/notification.routes.js:8` honours `?unread=true`.
  - R5: `gateway/forwardAuth.js:7` lets `GET /api/auth/me` bypass forward-auth.
  - R6: `assessment-service/app/config.py:43` (`ASSESSMENT_HOST` env-overridable). `llm_client.py:31-36,78-83` (OpenAI client `max_retries=0`, 60 s per call).
  - R7: `backend/Controllers/analysis.controller.js:97-98` (name falls back to "Candidate"; location = job location) and `:590` (`skills: []`).

Column "UI?" means: can a person clicking through the app trigger and see this behaviour today?

---

## Main table

### Cross-cutting and architecture

| IDs | Promise | Status | Evidence | UI? | Gap to "done correctly" | Size |
|---|---|---|---|---|---|---|
| PS-001 | Replace keyword ATS screening with evidence-based validation of each claimed skill | PARTIAL | Skills are matched against a closed ~150-keyword list with exact-token coverage, which is 60 % of the parsing score (READ `ner.py:7-55,155-178`, `embedder.py:17-18`). The only live score is 100 % parsing factor ([E11]: 84.84, weights parsing 1). GitHub language cross-check exists but never ran positively live ([BL-31] NOT RUN). Assessment is blocked ([BL-26]). | no | Skills are still keyword-matched. Evidence sources other than parsing never reach a UI-visible score. | build-large |
| PS-002 (CHECKLIST "Integration Requirement", no id) | Parsing, GitHub evidence, assessment and explanation form one connected pipeline (the stated research contribution) | PARTIAL | `/api/analyze` chains NLP → storage → `resumes` → github-evidence → latest assessment → `scores`, and recruiter APIs read it back (VERIFIED [E11], [E12], [E15], [E16]). Breaks: no UI caller of analyze (A4); generate 502 ([BL-26]); assessment never receives GitHub (R2); evaluate folds only into an existing row (R3). | no | Connect apply/upload to scoring, unblock the assessment, and let evaluate create a score. | wiring |
| 0.1, PS-054 | Microservices architecture: React, Node routing, independently deployable Python NLP/GitHub/Assessment services, each scaling independently | PARTIAL | The three Python services start and answer alone ([BL-03], [BL-04], [BL-05]). Gateway ([BL-07]). Core is a monolith with 29 routes, all DB access, orchestration and MemoryStore sessions (READ [BE §2.1], [BE §3]). Core is reachable directly on all interfaces ([BL-23]). | n/a | Core cannot run twice (sessions in memory). The services own no data. Independent scaling is never shown. The gateway fronts only core. | build-large |
| PS-053 | Web-based distributed application | WORKING-VERIFIED | Six processes on five ports, browser bundle → gateway → core → three services ([BL-03] to [BL-08]); cross-process flow [BL-25]. | yes | — | — |
| PS-055 | React presentation layer | WORKING-VERIFIED | CRA `react-scripts 5.0.1`, React 19, served on :3000 ([BL-08]); production build exits 0 with 9 lint warnings ([BL-09]). The `CI=true` build fails ([BL-10]). The brief says Vite; the code is CRA ([FE §1.1]). | yes | (Tooling: CI build red; Vite-vs-CRA decision pending.) | — |
| PS-056 | A Node/Express "API Gateway" routes the frontend's REST calls to the NLP Engine, Assessment Engine and GitHub Aggregator | PARTIAL | The browser calls the gateway on :5000 (bundle has only that origin, [BL-08] notes; A5). The gateway proxies `/api/*` to core only; `GET :5000/v1/evidence` → 404 ([BL-07] notes; READ `gateway/index.js:51-63`). Core, not the gateway, calls the three services (READ [BE §4] O1-O6). | n/a | The SRS's single gateway box is two processes (edge proxy + orchestrating core). Either route through the gateway or document DEC-5. | fix |
| PS-057 | Three Python services (NLP Engine, Assessment Engine "Logic & Scoring", GitHub Aggregator), each reading/writing the DB | PARTIAL | All three exist and run ([BL-03] to [BL-05]). None touches Supabase (READ [PY §0]); core does all persistence ([BE §3]). Composite scoring is in core, not in the Assessment Engine (READ `backend/Services/explainability.js`). | n/a | Data ownership differs from the SRS; decide and document, or move persistence. | fix |
| PS-058 | Data layer is MongoDB (MERN) | MISSING | Supabase Postgres is the only store (READ [BE §6]; [BL-21] counts Supabase rows). This is an owner decision in CLAUDE.md; no signed scope document mentions Supabase ([PS] C-1). | n/a | Record the Supabase decision and its reason for the evaluators. No code change. | fix |
| PS-061 | Each microservice scales independently (NFR-3) | PARTIAL | The Python services are stateless separate processes ([BL-03] to [BL-05]; READ [PY §1.6, 2.6, 3.6]). Core holds sessions in MemoryStore (READ `backend/index.js:27-38`). The gateway's rate limits and github-evidence's rate-limit state are in process memory (READ [BE §10], [PY §2.3]). No replica was ever run. | n/a | External session store, deployable units, and a scaling demonstration. | build-large |
| 0.2, PS-059 | Supabase persists four entities: User, Resume, Repository, Score | PARTIAL | `profiles`, `resumes` and `scores` are written (VERIFIED [E11], [BL-21] after-smoke counts). There is no Repository table; GitHub data is only a snapshot inside `scores.subscores` (READ [BE §6.2], `explainability.js:420-452`). Migrations 11, 12 and 17 must be applied; their applied state is UNKNOWN ([BE §6.3]). | partly | Repository entity as its own table. | build-small |
| 0.3, PS-044 (part) | Resume stores file ref + parsed arrays; Repository stores metrics; Score stores composite + three sub-scores | PARTIAL | A `resumes` row with `file_ref`, skills, experience, education and projects, and a `scores` row with `subscores`, `weights` and `explanation`, were written and read back ([E11], [E12]). Only a 300-char text preview is persisted (READ `nlp-engine/app/main.py:87`). No Repository entity. | partly (a `resumes` row is written via the assessment path, R2; a score only by direct API) | Repository table; score creation reachable from the UI. | build-small |
| 0.4, PS-064, PS-052 | OAuth 2.0 authentication; two user classes with separate capabilities | PARTIAL | Roles work: recruiter/candidate logins ([E03], [E06]), role-gated routes, gateway 401 without session ([BL-22]). Auth is password + express-session; Supabase tokens are discarded (READ [BE §5]). `GOOGLE_*`/`GITHUB_CLIENT_*` env names exist but no code reads them ([BL] §1.3). Anyone can self-register as a recruiter (READ [BE §5]). Live authz suites not run ([BL-29]). | yes | OAuth 2.0 not built. Changing auth needs Anthony's approval. | build-small |
| 0.5, PS-065 | API keys held server-side; none in the bundle or the repo | WORKING-VERIFIED | A1 (0 key-pattern hits in the bundle and tracked files; only `.env.example` tracked). Keys live in `backend/.env` and `github-evidence/.env` (names only, [BL] §1.3). Side issues outside "API keys": credential-shaped test lines in tracked `tests/.env.example` (I-0084, [branches] A2.4); hardcoded session-secret fallback `backend/index.js:29`; `SESSION_SECRET` is 6 characters ([BL] §1.3). | n/a | — | — |
| 0.6, PS-066 | All data transmitted over HTTPS | MISSING | Every hop is `http://localhost` (READ [BE §1], [BE §9]). Cookie `secure` only when `NODE_ENV=production`, which is unset (READ `backend/index.js:27-38`). Third-party calls (GitHub, Gemini, OpenRouter) use `https` base URLs (READ [PY §2.3, 3.3]). | n/a | TLS on the browser-facing hop (gateway) and a secure cookie. | build-small |
| 0.7, PS-067, PS-068 (part) | Every external call has retry + fallback; failures degrade with a stated reason, never a crash or a complete-looking score | PARTIAL | GitHub: failure → "unavailable" with a reason; score still produced (VERIFIED [E11] `github_user_not_found`; [BL-12]; [BL-15] github-evidence-client). NLP from analyze: no timeout, no retry, raw error echoed (READ [BE §4] O1). LLM: no key → clean 502 ([BL-26], [BL-27]). Grading LLM failure → short answers scored 0 "Not answered." and persisted (VERIFIED offline, [PY §3.3]). Image-only resume → success with 0.0 ([BL-32]). | partly | NLP timeout/retry; no silent zeros from grading or unreadable input. | fix |
| 0.8 | ≥100 concurrent users, parallel assessment, ≥95 % uptime, long work queued/async | MISSING | No queue or worker (READ [BE §2.1]). NLP `/parse` blocks its event loop (`async def` with synchronous CPU work, READ [PY §1.3], I-0037). Single-process MemoryStore core. No load test ([BL-29] NOT RUN; none exists). | n/a | Queue/async for parse and generation, plus the measurements in 6.6/6.7. | build-large |
| 0.9, PS-006 | Technical roles only; no soft-skill validation; no registrar degree checks | WORKING-VERIFIED | A2 (0 hits; no soft-skill keywords). Tension: GF-1 certificates and GF-3 support roles sit near the exclusions ([PS] C-9). | n/a | — | — |
| PS-060 | An external LLM provider (OpenAI/Gemini) generates questions and evaluates answers | PARTIAL | Gemini via an OpenAI-compatible endpoint, with OpenRouter as fallback (READ [PY §3.3], `llm_client.py`). **Never observed:** no `GEMINI_API_KEY` or `OPENROUTER_API_KEY` anywhere, so every generate gives 502 ([BL-26], [BL-27]). Default model id `gemini-3.8-flash` existence UNKNOWN. An owner-reported earlier UI run (WORKLOG L-0035 via [AUDIT 3.7]) was not re-verified. | yes (fails) | Configure a key, confirm the model ids, observe one generate and one evaluate. | fix |
| PS-078 | Literature survey of ≥10 papers with comparative study | WORKING-VERIFIED | A2 summarises 12 papers; LR adds the comparison (VERIFIED by opening the docx, [PS] §1). | n/a | — | — |
| PS-079 | Activity-3 deliverable: objectives, SRS, datasets, methodology, four diagrams | WORKING-VERIFIED | A3 contains all of these plus a signed guide-remark page (VERIFIED, [PS] §1). Its content contradicts the build in places (MongoDB, LLM placement; [PS] C-1, C-2). | n/a | — | — |

### Parsing

| IDs | Promise | Status | Evidence | UI? | Gap to "done correctly" | Size |
|---|---|---|---|---|---|---|
| 1.1, PS-009 | Accept PDF and DOCX; both reach the same structured output | PARTIAL | f1 PDF and f2 DOCX both parse to full entity sets ([BL-17]). Upload accepts both (client check `Upload.jsx:18-26`, server extension gate; READ [FE §2.8], [BE §2.1] #20). A PDF upload was VERIFIED ([E09]); DOCX upload was not run. DOCX tables, headers and text boxes are ignored (READ `extractor.py:14-20`). From the UI, parsing happens only inside assessment generation, and its result is never shown (R2). | partly | Parse output reachable and visible from the UI; DOCX tables. | wiring |
| 1.2, PS-073 (part) | OCR for scanned/image resumes | MISSING | No OCR package installed or listed (VERIFIED [PY §1.3]). f6 image-only → 0 tokens, 0 skills, 0.0 ([BL-32]). | no | Detect no-text-layer pages and OCR them through the same pipeline. Needs the Tesseract binary on the demo machine. | build-small |
| 1.3, PS-012 | Layout-aware extraction (pdfplumber / IBM DocLing) preserving columns and tables | PARTIAL | pdfplumber `extract_text()` per page (READ `extractor.py:5-12`). Two-column f5 comes out interleaved, with experience = 0 ([BL-17]; VERIFIED [PY §1.3]). No DocLing. DOCX tables dropped. | n/a | Column/table-aware extraction. | fix |
| 1.4, PS-013 | Tokenisation and lemmatisation applied before entity extraction | STUB | spaCy runs (`token_count` 95 for f1, [BL-17]), but entity extraction receives `raw_text`, not the preprocessed text (R1). Only previews are returned. | n/a | Feed preprocessing into extraction, or drop the claim. | fix |
| 1.5, PS-014 | Custom-trained NER (HF "Annotated NER PDF Resumes", 5,029 CVs) | MISSING | Instead: closed keyword list + aliases + regex; stock `en_core_web_sm` used for PERSON/ORG only (READ [PY §1.3]). The dataset is absent (A3). | n/a | Train and evaluate a model on the named dataset. | research/measurement |
| PS-010 (rel. 1.5, 1.9) | Extract skills, experience, projects, project links, education | PARTIAL | Skills 3–15, experience 0–5 and education 1–3 per fixture ([BL-17]). **Projects = 0 in all 6 fixtures** ([BL-17]). Skill false positives (`node.js`→javascript, "express"/"spring"/"oracle" from English) and misses (C, Go, R) VERIFIED by [PY §1.3]. The name heuristic can pick a referee (READ). | no (never shown to a candidate; recruiter sees it only for API-created scores) | Fix project extraction and skill precision; surface the output. | fix |
| 1.9 | Project links (GitHub/portfolio) extracted as structured fields | PARTIAL | GitHub found for f1, f2 and f5 ([BL-17]); determinism tests pass ([BL-17] suite). GitHub link consumed by analyze ([E11]). `project_links` is just `[github, linkedin]` (R7 area, `analysis.controller.js:364`). No portfolio or repo-level project links; projects empty. | no | Per-project links and portfolio URLs. | fix |
| 1.6, PS-015 | S-BERT vectors so synonyms and different vocabulary match | PARTIAL | `all-MiniLM-L6-v2` (a Sentence-BERT model) embeds focused resume text and the JD; `similarity_score` values recorded ([BL-17]). Skill matching itself is exact-token: `servicenow` in the JD never matches (VERIFIED [PY §1.3-1.4]). | no | Embedding-based skill/entity matching. | fix |
| 1.7, PS-016 | Hybrid layers: layout extraction feeds NER, NER output is embedded | PARTIAL | The layers coexist but do not feed each other (R1; READ `embedder.py:36-65`). Final = 0.60 keyword coverage + 0.40 semantic (READ `embedder.py:17-18,147-159`). | n/a | Chain the layers. | fix |
| 1.8, PS-011 | Works across diverse layouts, shown on a varied sample | PARTIAL | Single-column f1–f4 parse; multicolumn f5 loses experience; image-only f6 yields nothing ([BL-17]). Six synthetic fixtures only. | n/a | Layout fixes plus a varied real sample. | fix |
| 1.10, PS-017 | Stable, versioned JSON contract consumed downstream | PARTIAL | Output byte-identical to committed snapshots ([BL-17]); consumed by core ([E11]). The version is a hardcoded `'nlp-engine@1.0.0'` in core, never emitted by the service (READ [BE §8] #3). The DFD "Aggregator" is core. | n/a | Service-emitted contract version. | fix |
| 1.14, PS-018 | Parsing Semantic Alignment sub-score emitted, persisted and feeding the composite | PARTIAL | Persisted as `subScores.parsing_semantic_alignment` 84.84 with matched 9/10, coverage 0.9, semantic 0.7709 ([E11], [E12]). Only via direct API (A4). | no | UI trigger. | wiring |
| 1.15, PS-073 (part) | Unreadable input reported as unreadable, never as a successful 0.0 | MISSING | f6 → 200 "success", "Poor Match" 0.0 ([BL-32]). Core marks parsing `available:true` and maps a missing similarity to 0 (READ `explainability.js:166-167`). On the assessment path an empty text says "Upload a resume first" (R2). | no | Explicit unreadable status end to end. | fix |
| 1.16, PS-072 (part) | LinkedIn URL captured; certificates extracted as entities | PARTIAL | LinkedIn URL captured by regex and stored in `contact` (READ `ner.py:548,578`; `analysis.controller.js:355-364`). No certificate output (VERIFIED output keys, [PY §1.3]). | no | Certificate extraction. | build-small |
| 1.17, PS-074 (part) | Vocabulary covers support/ops tools so support candidates are not under-scored | MISSING | f3 text contains servicenow, jira, itil and nagios; the parser finds bash, linux, sql (VERIFIED [PY §1.3]). f3 0.4138 and f4 0.4354 "Weak" ([BL-17]). T-0032 (vocabulary) is approved but not built ([docs] §1e). | no | Support vocabulary and skill normalisation. | fix |

### GitHub evidence

| IDs | Promise | Status | Evidence | UI? | Gap to "done correctly" | Size |
|---|---|---|---|---|---|---|
| 2.1, PS-022 | GitHub username from the resume or from user input, with fall-through | PARTIAL | Resume path: `example-mokafor` extracted and sent to github-evidence ([E11]). User-input path: no UI field; `profiles.github_url` is never written (READ [BE §6.3]). | no | Input field plus fall-through. | build-small |
| 2.2, PS-023 | Candidate authenticates GitHub via OAuth 2.0 | MISSING | No OAuth code; `GITHUB_CLIENT_*` names set but unused ([BL] §1.3; READ [FE §4]). Identity is unverified: anyone can name someone else's GitHub (READ [PY §2.3]). | no | GitHub OAuth flow (also proves account ownership). | build-small |
| 2.3, PS-024 | Real-time repo data via the GitHub REST/GraphQL API; rate limits and pagination handled | PARTIAL | Pagination, rate-limit and recorded-octocat tests pass ([BL-12], 80/80). One live call: `GET /users/example-mokafor` → 404, handled ([E11]). A real account was never fetched today ([BL-31] NOT RUN). Owner repos only; no raw code files fetched (READ [PY §2.3]). Not UI-reachable. | no | UI trigger; a positive live run; org/contributed repos. | wiring |
| 2.4, PS-025 | Repo count, commit frequency, language breakdown, ownership, consistency, code-quality indicators | PARTIAL | First five computed and tested ([BL-12] `test_metrics`, `test_scoring`; VERIFIED example 0.5615, [PY §2.4]). No code-quality indicators. Ownership = owned repos only. | no | Code quality (see 2.6); UI trigger. | build-large |
| 2.5, PS-026 | Verify code contributions in the claimed languages and confirm authorship from commits | PARTIAL | Claimed skill → linguist language → present in any owned repo of any age ([BL-12] `test_claims`; mapping VERIFIED [PY §2.3]). This checks repo-level language presence, not authored code in that language; frameworks/tools are `not_checkable`; `r language` is never checkable (VERIFIED). | no | Authorship-level check; identity proof (2.2). | fix |
| 2.6, PS-027 | 8DFS heuristic: up to 8 core files per repo, skip boilerplate, approximate complexity and smells | MISSING | Nothing (READ [AUDIT 2.6] grep; no file content fetched, [PY §2.3]). C-6: "5-10" vs "up to 8". | no | Fetch, select and analyse core files. | build-large |
| PS-028 | Static analysis with CodeQL / SonarQube | MISSING | Nothing (READ). | no | Needs a clone and build of every candidate repo plus a CodeQL/SonarQube install, at minutes per repo. | out of reach |
| 2.7, PS-029 | Graded evidence metrics feeding a weighted score; never a pass/fail gate | PARTIAL | Four graded components renormalised ([BL-12] `test_scoring`). Unavailable → weight 0, not 0 ([E11]; [BL-15] explainability). But an account with repos and no commits in 365 days scores an *available* 0.0 at 35 % weight, so linking an inactive GitHub scores lower than linking none (VERIFIED [PY §2.4]). Only via direct API. | no | UI trigger; treat no-activity as unavailable. | wiring |
| 2.8, PS-075 (part) | No GitHub → still scored via assessment-only fallback; weights redistribute; stated as unavailable | PARTIAL | Redistribution seen live: weights `{parsing 1, github 0, assessment 0}`, `evidenceLimited=true` ([E11]). The assessment fallback cannot run: generate 502 ([BL-26]); evaluate never creates a score (R3). | no | Score creation from the UI, working assessment, evaluate-creates-score. | wiring |
| 2.9, PS-074 (part) | Credit maintenance/support work (bug fixes, third-party contributions, PR reviews, small commits) | MISSING | None (READ). Owner-only listing and the 365-day window make org-only/inactive accounts invisible or 0.0 (READ, VERIFIED [PY §2.4]). | no | PR/issue/review signals; org and contributed repos. | build-small |
| 2.10, PS-068 (part) | Private-repo limitation stated in the explanation | PARTIAL | A "public repositories only" note is on every available GitHub explanation (READ `explainability.js:306,402-411`; [BL-15] "builds the GitHub sub-score"). Never seen in a live available GitHub score ([BL-31]). | no | UI trigger. | wiring |
| 2.11, PS-059 (part) | Repository entity persisted against the candidate | PARTIAL | Snapshot inside `scores.subscores.github_evidence.components` (READ `explainability.js:427-443`). No table. | no | Repository table. | build-small |
| 2.12, PS-044 (part) | GitHub Evidence sub-score emitted with its metrics | PARTIAL | Emitted every analyze; the unavailable form was seen live ([E12]); the available form only in tests ([BL-12], [BL-15]). | no | UI trigger plus a positive live run. | wiring |
| 2.13, PS-067 (part) | Retry + fallback on GitHub failure; partial data labelled | PARTIAL | Service retries 5xx/connection once, enforces a 6 s deadline, labels `partial` ([BL-12] `test_upstream_retry`, `test_deadline`, rate-limit tests). Core maps every outcome to a reason ([BL-15]). Live 404 handled ([E11]). Only runs inside analyze. | no | UI trigger. | wiring |
| X-2 | Code-originality signals (MOSS, CodeBERT, repo diversity) | MISSING | None (READ [AUDIT X-2]). Not in the signed scope ([PS] §5). | no | Not in scope; needs external tools and models. | out of reach |

### Assessment

| IDs | Promise | Status | Evidence | UI? | Gap to "done correctly" | Size |
|---|---|---|---|---|---|---|
| 3.1, PS-032 | Questions generated from this candidate's skills and specific projects (and verified GitHub projects) | PARTIAL | Payload carries job, resume skills, projects and resume text (READ `assessment.controller.js:265-278`). But the resume text is the ≤300-char preview (R2), projects are always empty ([BL-17]), and GitHub is never included (`contact` not selected, R2). Never observed ([BL-26]). | yes (fails) | Full text, projects, GitHub; a test that questions cite the candidate's projects. | fix |
| 3.2, PS-031, PS-033 (part) | LLM engine replaces static banks; each set unique | PARTIAL | No static or mock bank (`grep -i mock` → 0, VERIFIED [FE §7]). Fresh `uuid4` and LLM call per attempt (READ `generator.py:79,96`). Never observed generating ([BL-26]). No de-duplication across attempts (READ). | yes (fails) | Configure the LLM; test uniqueness. | fix |
| 3.3, PS-034 | PFQS: an LLM answer-plan step that then drives question generation | MISSING | Single prompt returns questions and answers together (READ `generator.py:96`, `prompts.py:7-87`). | no | Two-step plan → questions, plan stored. | build-small |
| 3.4, PS-034 (part) | Difficulty controlled by the plan and observable | MISSING | Fixed sentence "easy to moderate" (READ `prompts.py:39`); no difficulty field. | no | Comes with 3.3. | build-small |
| 3.5, PS-035 | Evaluation against explicit predefined rubrics; not open-ended chat grading | PARTIAL | Ideal answer + 2–4 key points stored in `assessment_keys` (READ). MCQ grading deterministic (VERIFIED offline, [PY §3.3]). Rubrics are generated per attempt by the same LLM, not predefined. Short-answer grading never observed. | yes (fails before this step) | Predefined/stable rubric; observed grading. | fix |
| 3.6, PS-036 | Rubric + constraints bound LLM scoring (schema, range, justification) | PARTIAL | Generation schema-validated (READ `validators.py`). Grading output not schema-enforced; grades not snapped to {0, 0.5, 1}; candidate text embedded with no untrusted-input rule (prompt injection, I-0067) (READ [PY §3.3]). | n/a | Schema-constrained grading; injection guard. | fix |
| 3.7, PS-037 | Sequence: request → parsed projects → PFQS plan → questions → answers → rubric grading → stored | PARTIAL | Every step except PFQS exists (READ [AUDIT 3.7], [BE §2.1] #27-28). Today the chain breaks at generate: 502 ([BL-26]); later steps not reached ([BL-28]). | yes (fails) | LLM config, PFQS. | fix |
| 3.8, PS-040 | Rubrics calibrated/fine-tuned with APPS | MISSING | No dataset (A3). APPS has coding problems + unit tests, not graded interview answers, so it cannot calibrate this format ([PS] C-13). | n/a | Needs a decision to drop or replace APPS. | out of reach |
| 3.10, PS-038 | Generation/evaluation run in parallel; one slow call does not serialise others | PARTIAL | Service endpoints are plain `def` (threadpool); backend calls are async (READ [AUDIT 3.10]). The on-demand NLP parse blocks the NLP event loop (READ I-0037). Never measured. | n/a | Concurrency probe. | research/measurement |
| 3.11, PS-068 (part) | LLM variability handled: validation, retry, defined fallback, failure surfaced | PARTIAL | Validation rounds and model fallback (READ). No key → clean 502 ([BL-27]). Grading failure → silent 0 "Not answered.", persisted and folded (VERIFIED offline, [PY §3.3]). The error text hides Gemini failure causes (READ `llm_client.py:71-74`). Worst-case retry budget (~2 × (60 + 4 × 60) s plus backoff) exceeds core's 300 s timeout (R6 + `backend/Services/assessmentService.js:13`). | n/a | No silent zero; budget below the caller timeout. | fix |
| 3.12, PS-044 (part) | Assessment Results sub-score persisted with per-question rubric outcomes | PARTIAL | `buildAssessmentSubScore` tested ([BL-15] "combines parsing, GitHub and assessment"). Never produced live ([BL-28]). Per-question outcomes are only in `assessments.evaluation`, not in the score (READ [AUDIT 3.12]). | no | Live path; per-question outcomes in the explanation. | wiring |
| 3.13, PS-075 (part) | Assessment path alone yields a valid score when GitHub is absent | PARTIAL | Parsing + assessment renormalisation tested ([BL-15]). In the running system an assessment never creates a score row (R3), and generate fails ([BL-26]). | no | Evaluate creates a score when none exists. | wiring |
| PS-007 | Dynamic practical challenges that test skills in real time | MISSING | Only MCQ + short answer; no timer, sandbox or coding task (READ [PY §3.3-3.4]). | no | Undefined in the SRS FRs; record as not built or build a sandbox. | build-large |

### Scoring and explainability

| IDs | Promise | Status | Evidence | UI? | Gap to "done correctly" | Size |
|---|---|---|---|---|---|---|
| 4.1, PS-041 | Composite from all three inputs | PARTIAL | Three-input computation unit-tested ([BL-15]). Live: parsing-only composite ([E11]). Assessment input unreachable ([BL-26]); GitHub positive never live ([BL-31]). | no | All three combined in a live, UI-triggered run. | wiring |
| 4.2, PS-042 (part) | Sub-scores normalised to a common scale before weighting | PARTIAL | 0–1 → 0–100 for each source; NLP 0.8484 → 84.84 ([E11]); [BL-15]. Only via direct API. | no | UI trigger. | wiring |
| 4.3, PS-042 (part) | Explicit, documented, configurable weighting → 0–100 Credibility/Truth Score | PARTIAL | Base 0.40/0.35/0.25, stored per score in `explanation.weighting_scheme` ([E11] keys; READ `explainability.js:110-135`). `CREDIBILITY_WEIGHTS` override is untested. The weights are unjustified anywhere; the github-evidence internal weights are "PROVISIONAL" (READ). | no | UI trigger; weight rationale; override test. | wiring |
| 4.4, PS-044 | Three sub-scores stored alongside the composite | PARTIAL | Read back: `subScores` with all three slots, `weights`, `explanation` ([E12]). Only via direct API. | no | UI trigger. | wiring |
| 4.5, PS-043 | Explainability layer: factors, direction, weight, cited evidence | PARTIAL | Stored explanation has factors, summary, skill_evidence, weighting_scheme ([E11] keys); "every factor has evidence" ([BL-15]). Flags not computed (4.6). Assessment evidence is totals only. The NLP-internal 0.65/0.35 weights are not exposed (READ [PY §1.4]). Never rendered in a browser; score-ring CSS variables undefined ([FE §9.3] VERIFIED absent, rendering UNKNOWN). | no | UI trigger, flags, deeper evidence, rendering check. | wiring |
| 4.6, PS-045 | Claim-vs-evidence inconsistencies computed as flags | MISSING | `buildFlags` always returns unavailable with an honest reason (READ `explainability.js:630-652`). | no | Rules such as claimed language `not_found` and low assessment per skill. | build-small |
| 4.7, PS-075 (part) | Missing GitHub → weights redistribute, score marked evidence-limited, never scored as zero | PARTIAL | Seen live ([E11] weights, `evidenceLimited=true`); [BL-15] "every GitHub reason is unavailable, never zero". Exception: an inactive linked account scores an available 0.0 ([PY §2.4]). Only via direct API. | no | UI trigger; no-activity → unavailable. | wiring |
| 4.8, PS-074 (part) | Weighting does not disadvantage support/maintenance candidates | MISSING | No profile-type logic (READ [BE §7]). | no | Support evidence and scoring. | build-small |
| 4.9, PS-005 (part) | Technical merit only; per-candidate auditable explanation as bias mitigation | PARTIAL | Per-candidate stored explanation ([E11]). No fairness measure; skill false positives skew it ([PY §1.3]). Only via direct API. | no | UI trigger; fairness evidence. | wiring |
| 4.10, PS-072 (part) | LinkedIn and certificates validated and folded into the composite | MISSING | LinkedIn stored only; no certificate or validation logic (READ [AUDIT 4.10], [PY §1.3]). | no | Real LinkedIn validation is blocked by LinkedIn API restrictions; only a URL/identity-consistency check and certificate-URL checks are buildable. | build-large |
| 4.11 | Same inputs → same composite; stored score re-explainable | PARTIAL | NLP output reproducible (byte-identical snapshots, [BL-17]); composite pure (READ). The explanation carries a timestamp. Evaluate overwrites the score row in place, losing the pre-assessment composite (READ `assessment.controller.js:498-508`). GitHub input changes over time. | n/a | Score history; determinism test. | fix |
| PS-046 | A distinct Scoring Engine process writes "Scoring Records"; the Aggregator forwards skills to the LLM module | PARTIAL | Scoring is a module inside core (READ `explainability.js`); records in `scores` ([E11]). No separate process; the "Aggregator" is core. The SRS diagrams disagree on this ([PS] C-2). | n/a | Decide and document as-built. | fix |

### Dashboard and portal

| IDs | Promise | Status | Evidence | UI? | Gap to "done correctly" | Size |
|---|---|---|---|---|---|---|
| 5.1, PS-008 | Web upload of PDF/DOCX with validation, progress, clear errors | PARTIAL | Upload stores the file ([E09]; READ `Upload.jsx:157`); 10 MB cap tested ([BL-15] upload-limits). No progress, no corrupt-file handling, no parse feedback; a status error is shown as "No resume uploaded yet" (READ [FE §2.8]). | yes | Progress, errors, parse feedback. | fix |
| 5.2, PS-023 (part), PS-075 (part) | Candidate can connect GitHub via OAuth, or skip as a first-class path | PARTIAL | Skipping is implicit: upload, apply and assessment never need GitHub ([E09], [E10]). Connect is impossible; no GitHub UI anywhere (READ [FE §2.1, 2.13]). | partly | Connect + explicit skip. | build-small |
| 5.3, PS-037 (part) | Candidate takes the assessment; session persists across interruption | PARTIAL | Page routed and in the nav (READ `App.jsx:65`, `CandidateLayout.jsx:16`). Generate → 502 today ([BL-26]). The server resumes questions; answers are React state only, lost on reload despite the "resumed" copy (READ [FE §2.15]). | yes (fails) | LLM config; persist in-progress answers. | fix |
| 5.4 | Candidate sees submission/parse status | PARTIAL | Resume status shown ([E08]; READ `Upload.jsx:100`). Results is unlinked and nothing creates a score (A4); the candidate "Dashboard" is static copy (READ [FE §2.7]). | partly | Link Results; status after apply. | wiring |
| 5.5, PS-048 | Recruiters see candidates ranked by composite and can compare | PARTIAL | `/api/candidates` sorted by composite ([E15], 1 API-created entry). In a UI-only flow it is empty ([FE §2.16]). JobDetails drops candidates whose latest score is for another job (READ [FE §2.18]). No compare view. | yes (empty) | Scores from UI; per-job ranking. | wiring |
| 5.6, PS-050 | Filter by skill, score band, evidence availability | PARTIAL | JobDetails filters exist (READ `JobDetails.jsx:111-126`) but never ran on data. AllCandidates status filter never matches (`submitted` vs `applied`, READ [FE §2.19]). | yes (no data) | Data; fix the vocabulary; tests. | fix |
| 5.7, PS-047 (part), PS-049 | Per candidate: skills matched, repo metrics, assessment results, not just a number | PARTIAL | `ScoreBreakdown` renders the stored explanation (READ [FE §8.2]). Never rendered with data in a browser. Two pillars never populated live. Ring/chart CSS variables undefined ([FE §9.3]). | yes (no data) | Scores from UI; CSS vars; browser check. | wiring |
| 5.8, PS-051 | Drill composite → sub-score → specific evidence (repo, metric, rubric line) | PARTIAL | Factor → evidence items → skill table (READ `ScoreBreakdown.jsx:59-210`). No per-repo/commit or rubric-line depth (READ [AUDIT 3.12]). | yes (no data) | Deeper evidence. | build-small |
| 5.9, PS-045 (part) | Inconsistency flags shown with their evidence | MISSING | Honest "not available" panel only (READ `ScoreBreakdown.jsx:268-293`); flags are never computed (4.6). | yes (empty state) | Depends on 4.6. | build-small |
| 5.10, PS-075 (part) | No-GitHub candidates shown as evidence-limited, not blank or low | PARTIAL | `evidenceLimited` and an unavailable-reason panel are rendered (READ [FE §8.2]); data seen ([E11]). Only for API-created scores. | yes (no data) | UI trigger; browser check. | wiring |
| 5.11, PS-047 (part) | Per-skill confidence visualised | PARTIAL | Skill table and dashboard skill chart (READ [FE §8.2], `recruiter/Dashboard.jsx:168-184`). Never rendered with data; chart colours use undefined CSS variables. | yes (no data) | Data; CSS. | wiring |
| 5.12, PS-005 (part) | Ranking view shows technical merit only | PARTIAL | No protected attributes in the payload (READ R7 area). Names are shown in rankings; "location" is the job's (R7). | yes (no data) | Decide on name display; fix location. | fix |
| 5.13, PS-072 (part) | LinkedIn and certificate evidence shown with its contribution | MISSING | Only a raw LinkedIn link in the modal's contact row (READ [FE §2.22]); no certificates, no contribution. | no | Depends on 1.16/4.10. | build-small |
| 5.14 | Apply runs analysis and persists a score linked to the application | MISSING | Apply inserts only an `applications` row ([E10]; READ `jobs.controller.js:103-157`). | no | Call the existing analyze pipeline from apply on the stored file. | wiring |
| 5.15 | One application-centric recruiter view: score, status, shortlist/reject, drill-down | PARTIAL | `/api/recruiter/applicants` lists applicants incl. unscored ([E16]). Page unlinked; `skills: []` hardcoded (R7); null score renders red-blank; shortlist API has no UI caller (A4). | partly (URL only) | Merge the two lists; link the page; shortlist UI. | wiring |
| X-1 | Recruiter audit log | MISSING | No table or writes (READ [AUDIT X-1]). Not in the signed scope. | no | Table and writes. | build-small |

### Evaluation and measurement

| IDs | Promise | Status | Evidence | UI? | Gap to "done correctly" | Size |
|---|---|---|---|---|---|---|
| 1.11, 6.1, PS-019 | Extraction accuracy ≥85 % measured | MISSING | NLP tests are shape-only and say so (READ `tests/nlp/test_parse.py:5-7`); no labelled set. | n/a | Labelled sample + metric. | research/measurement |
| 1.12, 6.2, PS-020 | Skill classification F1 ≥0.80 measured | MISSING | No F1 code or held-out data (READ). No "skill classification" task exists ([PS] §4). | n/a | Define the task, label data, measure. | research/measurement |
| 1.13, 6.3, PS-021 | ≤10 s per resume, measured (incl. OCR) | PARTIAL | Warm `/parse` 0.019–0.621 s on 6 synthetic fixtures ([BL-17]); analyze 1.33 s ([E11]); cold NLP start ~14 s ([BL-03]). Not a recorded benchmark; no real sample; no OCR path. | n/a | Benchmark on a real sample, incl. OCR. | research/measurement |
| 6.4, PS-030 | GitHub evaluation ≥0.7 correlation with human judgement | MISSING | No human-rated profiles; the source itself says there is no ground truth ([PS] §4). | n/a | A small honest pilot is possible; a credible result is not. | research/measurement |
| 3.9, 6.5, PS-039 | LLM grading ≥0.75 correlation with human grading | MISSING | No graded answer set; grading never observed ([BL-28]). | n/a | Human-graded sample. | research/measurement |
| 6.6, PS-062 | ≥100 concurrent users (load test) | MISSING | No load tool or run (READ [AUDIT 6.6]). Expected limits: NLP event-loop blocking; MemoryStore; gateway login limit of 20 per 15 min per IP ([BE §10]). | n/a | Load test after async fixes. | research/measurement |
| 6.7, PS-063 | ≥95 % uptime monitored | MISSING | No deployment or monitoring; health endpoints are shallow (core `/api/health` checks nothing, READ `backend/index.js:63-70`). | n/a | No deployment exists to monitor, and a 6-day local window is not an uptime measurement. | out of reach |
| 6.8, PS-069, PS-070 | Named datasets used: Kaggle resume, HF NER, Kaggle JD sets, live GitHub API, APPS | PARTIAL | Only the live GitHub API is used ([E11] real call). No resume, JD or APPS dataset in the repo (A3). | n/a | Dataset use or an honest record of not used. | research/measurement |
| 4.12, PS-074 (part) | Support-role fairness measured on paired fixtures | MISSING | The gap is visible: f3 0.4138 and f4 0.4354 vs off-profile f2 0.4779 ([BL-17]); nothing measures or fixes it. | n/a | Paired-fixture measurement after 1.17/2.9/4.8. | research/measurement |
| PS-071 | Each module and the full pipeline evaluated with fitting metrics | MISSING | Regression and shape tests only; no matching-quality or GitHub-coverage metric (READ). | n/a | Evaluation plan + runs. | research/measurement |
| PS-003 | Reduces manual screening time and effort | MISSING | No baseline or study. The automation it depends on is covered by other rows. | n/a | Needs a baseline and a user study; it can only be argued qualitatively. | out of reach |
| PS-004 | Reduces hiring fraud / resume inflation | MISSING | No fraud data. GitHub identity is unverified, so a candidate can borrow someone else's evidence (READ [PY §2.3]), which works against this claim. | n/a | Needs fraud data; the identity fix (2.2) is the buildable part. | out of reach |

### Guide feedback (roll-ups; they overlap the module rows they cite)

| IDs | Promise | Status | Evidence | UI? | Gap to "done correctly" | Size |
|---|---|---|---|---|---|---|
| GF-1, PS-072 | LinkedIn and certificates validated | MISSING | Rows 1.16 (URL only), 4.10, 5.13. | no | Extraction + validation + display. | build-large |
| GF-2, PS-073 | OCR is a must | MISSING | Rows 1.2, 1.15 ([BL-32]). | no | OCR + unreadable status. | build-small |
| GF-3, PS-074 | Fair scoring for support-project candidates | MISSING | Rows 1.17, 2.9, 4.8, 4.12 (VERIFIED vocabulary and GitHub gaps). | no | Vocabulary, GitHub signals, measurement. | build-small |
| GF-4, PS-075 | GitHub optional; assessment-only fallback | PARTIAL | Rows 2.8, 3.13, 4.7, 5.2, 5.10. Redistribution works by API ([E11]); the fallback is blocked. | partly | Wiring + LLM config + evaluate-creates-score. | wiring |
| GF-5 (PS-043) | Score explainability is crucial | PARTIAL | Rows 4.4, 4.5, 5.7, 5.8, 5.9. The stored explanation is real ([E11]) but never reachable from the UI. | no | UI path to a score; flags; render check. | wiring |
| GR-1, PS-076, PS-033 (part) | Anti-cheat design written before the assessment module, then implemented | MISSING | No design; the module was built first. Ad-hoc: key stripped, options shuffled, 5 attempts, single grading claim (READ [PY §3.4]). Absent: timer, proctoring, identity. Correct answers revealed after submit (VERIFIED offline `Correct answer: B.`). Latest attempt counts. Injectable grader. | partly | Written design + server timer + no answer reveal + injection guard. | build-small |
| GR-2, PS-077 | Identify the gateway, verify the microservices claim, fix gaps | PARTIAL | Gateway identified (`gateway/`, :5000, [BL-07]); verified in this inventory and `services.md`. Not fixed: core directly reachable ([BL-23]); single-upstream proxy; monolithic core; Python services unauthenticated, loopback only by start flag (READ [BE §3]). | n/a | Bind core to loopback, gateway as sole entry, one-command start, written verdict. | build-small |

---

## 1. Totals

There are 110 rows: 105 CHECKLIST/PS rows plus 5 GF roll-ups. Every PS-001..PS-079 and every one of the 91 CHECKLIST ids appears at least once.

| Module | Rows | WORKING-VERIFIED | PARTIAL | STUB | MISSING |
|---|---|---|---|---|---|
| Cross-cutting and architecture | 20 | 6 | 11 | 0 | 3 |
| Parsing | 15 | 0 | 10 | 1 | 4 |
| GitHub evidence | 15 | 0 | 10 | 0 | 5 |
| Assessment | 13 | 0 | 9 | 0 | 4 |
| Scoring and explainability | 12 | 0 | 9 | 0 | 3 |
| Dashboard and portal | 16 | 0 | 12 | 0 | 4 |
| Evaluation and measurement | 12 | 0 | 2 | 0 | 10 |
| Guide feedback (GF-1..5 roll-ups, GR-1, GR-2) | 7 | 0 | 3 | 0 | 4 |
| **All rows** | **110** | **6** | **66** | **1** | **37** |
| All rows excluding the 5 GF roll-ups | 105 | 6 | 64 | 1 | 34 |

How to read the totals:
- **The six WORKING-VERIFIED rows are all off the scoring path:** web app runs (PS-053), React layer (PS-055), secrets (0.5), scope exclusions (0.9), and the two academic deliverables (PS-078, PS-079). No product feature that an evaluator would score is WORKING-VERIFIED through the UI.
- **27 rows have gap size `wiring`.** For 7 of them the mechanism itself was seen working, by direct API call or a behavioural test, and the only gap is that no UI path triggers scoring: 1.14, 2.10, 2.12, 2.13, 4.2, 4.4, 5.10. One wiring change (5.14, score-on-apply) is the precondition for all 27.
- **Ten rows depend only on a missing LLM key** (PARTIAL, "never observed"): PS-060, 3.1, 3.2, 3.5, 3.7, 3.12, 3.13, 5.3, and the assessment halves of 4.1 and GF-4.
- **Measured targets: none is met.** 1.13/6.3 has ad-hoc timings only. 1.11, 1.12, 3.9, 4.12, 6.4, 6.5, 6.6 and 6.7 have no measurement at all.

## 2. Guide feedback, honest current state

**GF-1 (LinkedIn and certificate validation): not built.**
- The parser captures a LinkedIn URL with a regex, and core stores it in `resumes.contact`.
- Nothing extracts certificates. Nothing validates either one, folds it into the score, or shows it as evidence; the recruiter modal shows only a raw link.
- Honest validation of LinkedIn is limited by LinkedIn's API restrictions. What can realistically be built is certificate extraction plus checks of credential URLs and identity consistency. Rows 1.16, 4.10, 5.13.

**GF-2 (OCR is a must): not built, and the current behaviour is misleading.**
- There is no OCR dependency. An image-only PDF parses to 0 characters, and the service answers 200 "success" with a 0.0 "Poor Match" ([BL-32]).
- Core would store that as an *available* parsing score of 0.
- On the assessment path, the same resume produces "Upload a resume first".
- Adding OCR is a small build, but it needs the Tesseract binary on the demo machine. Rows 1.2, 1.15.

**GF-3 (fair scoring for support-project candidates): not built, and the gap is measurable today.**
- The skill list misses ServiceNow, Jira, ITIL, Nagios, Active Directory and Windows Server. The f3/f4 support fixtures score "Weak" (0.41–0.44), below an off-profile developer (0.48) ([BL-17]).
- GitHub makes it worse. Only owned repos are listed, and only the last 365 days count. An inactive or org-only account therefore gets an *available* 0.0 at 35 % weight, which scores lower than linking no GitHub at all ([PY §2.4]).
- T-0032 (vocabulary) is approved but not built. Rows 1.17, 2.9, 4.8, 4.12.

**GF-4 (GitHub optional): the scoring half works by direct API; the fallback half does not run.**
- With no usable GitHub, analyze still produces a score. The weights renormalise, the score is marked evidence-limited, and a reason is stored ([E11]).
- The promised assessment-only fallback cannot run today. Generation 502s for lack of an LLM key, and a completed assessment only updates an existing score row; it never creates one.
- No UI path produces any score. Rows 2.8, 3.13, 4.7, 5.2, 5.10.

**GF-5 (score explainability is crucial): built in the backend, invisible in the app.**
- Every analyze stores a real explanation: factors with weight, contribution and evidence, a per-skill evidence table, the weighting scheme, and an honest "flags not available" reason ([E11], [BL-15]).
- The recruiter `ScoreBreakdown` renders it as stored. But no UI action creates a score, the explanation has never been rendered in a browser with data, and the score-ring colours reference CSS variables that do not exist.
- Inconsistency flags are not computed. Rows 4.4, 4.5, 5.7, 5.8, 5.9.

**GR-1 (anti-cheat designed before the assessment module): not met.**
- The module was built without a written design.
- What exists is ad hoc: the answer key is kept from the browser, MCQ options are shuffled, there are 5 attempts per job and one grading claim per attempt.
- What is missing: any time limit (server or client), proctoring, and identity checks.
- What is worse:
  - Correct answers are revealed after every submission ("Correct answer: B").
  - The latest attempt is the one that counts.
  - The short-answer grader embeds candidate text with no injection guard.

**GR-2 (identify the gateway, verify microservices, fix): verified, not fixed.**
- The gateway is `gateway/` on :5000, and the browser calls only it. It is a single-upstream edge proxy in front of core, adding CORS, rate limits and a session pre-check (which itself calls core).
- Core is a monolith that owns all data, sessions and orchestration. It also answers directly on :5001 on every interface ([BL-23]).
- The three Python services are real, independent and stateless. They are reached only through core, have no authentication, and are kept to loopback only by their start flags.
- Full verdict in `services.md` §3.

## 3. The end-to-end pipeline as it stands

| # | Hop | State | Evidence |
|---|---|---|---|
| 1 | Sign up / log in (candidate, recruiter) | **Works through the UI** | [E03], [E06] (same API calls the UI makes; READ `AuthContext.jsx:41,73`). Bugs on the side: resend-confirmation sends an empty email; recruiter Profile always says "unavailable" ([FE §2.3, 2.20]). |
| 2 | Recruiter creates a job | **Works through the UI** (with defects) | [E05]; READ `CreateJob.jsx:202-215`. Primary buttons may be black on black (READ, browser check needed); skills only from a hardcoded list of 20. |
| 3 | Candidate uploads a resume | **Works through the UI: stores the file only** | [E09]; READ `Upload.jsx:157` → `analysis.controller.js:258-285`. No parse, no score. |
| 4 | Candidate applies to a job | **Works through the UI: inserts an application only** | [E10]; READ `jobs.controller.js:103-157`. No scoring (5.14). |
| 5 | Parse | **Only by direct API call** (`POST /api/analyze`, [E11]) | No UI caller (A4). One UI side path: opening Assessment → generate parses the stored file and inserts a `resumes` row (R2). Nothing displays that row. |
| 6 | GitHub evidence | **Only by direct API call** | Called once inside analyze ([E11]; real GitHub `GET /users/example-mokafor` → 404, handled as unavailable). Never called from the assessment path (`contact` not selected, R2). A positive live fetch was never run ([BL-31]). |
| 7 | Assessment generate / take / grade | **Broken** | The UI page exists. Generate → 502 "Assessment generation failed" because no LLM key exists ([BL-26], [BL-27]). Evaluate never reached ([BL-28]). Even with a key, the LLM sees ≤300 resume characters and no GitHub data (R2). |
| 8 | Credibility score | **Only by direct API call** | Analyze → 84.84, 100 % parsing factor, evidence-limited ([E11], [E12]). Evaluate folds an assessment only into an existing score row (R3). |
| 9 | Recruiter views | **UI works, but shows no score from a UI-only flow** | APIs return data when a score exists ([E15], [E16]). In a UI-only flow, Dashboard says "No candidates scored yet"; Jobs shows "0 Applications Total" (hardcoded); `/recruiter/candidates` (unlinked) lists applicants with a blank red score and no skills ([FE §2.16-2.19]). |
| 10 | Candidate result view | **Unlinked** | `/candidate/results` is reachable only by typing the URL; it shows the latest score if one exists ([FE §2.10]). |

**What a person clicking through the app today can see:**
- The landing page, including invented statistics.
- Signup and login.
- Job lists and job details.
- Resume upload with a stored-file confirmation.
- Apply with an "Applied" state.
- An empty notifications page.
- The assessment page, ending in "Assessment generation failed".
- As a recruiter: job creation, a job list showing 0 applications, and an empty scored-candidates dashboard.

**What they cannot see:**
- Any parsed resume content or any credibility score.
- Any explanation or breakdown.
- Any GitHub evidence.
- Any assessment question or grade.
- Any inconsistency flag.
- Any shortlist or reject action.

**Caveat about live data:** the baseline smoke pass left one API-created test job, application and score (84.84) in the shared Supabase project. Until it is swept (`node tests/backend/sweep.mjs`), `t0001_recr` will see one scored candidate. That score was not produced through the UI.

## 4. Fabricated or misleading output inventory

These are all the places where the running system shows or stores an invented, hardcoded, defaulted or silently zeroed value. There are **48 items**: 25 frontend, 13 backend, 10 Python. Labels are READ unless marked.

Frontend:
- F1. `frontend/src/pages/public/Landing.jsx:61,118`: a demo Credibility Score fixed at 82, with a "✓ Verified" pill (`:149`).
- F2. `Landing.jsx:170-174`: "10000+ Candidates Verified", "500+ Companies Using", "95% Accuracy Rate".
- F3. `Landing.jsx:305-310`: "Trusted by 500+ companies", 5 stars, "4.9/5".
- F4. `Landing.jsx:295`: four stock avatars from `i.pravatar.cc` presented as users.
- F5. `Landing.jsx:264,347-349`: "Connect GitHub … instant credibility scores". There is no GitHub connect, and no UI path to a score.
- F6. `frontend/src/pages/recruiter/Profile.jsx:97,108`: "5 Jobs Posted", "2 Candidates Hired" (hidden by the broken role guard at `:24`, but shipped).
- F7. `recruiter/Profile.jsx:57,63,114`: a Verified/Not Verified badge from `user.isVerified`, which the backend never sends.
- F8. `recruiter/Jobs.jsx:125`: `count={0}` gives "0 Applications Total" on every job (VERIFIED by grep).
- F9. `recruiter/CreateJob.jsx:232` and `:461-465`: an "AI Suggestion" shown when `Math.random() > 0.7`, with canned text and no model (VERIFIED by grep).
- F10. `CreateJob.jsx:540`: "Detailed job descriptions … receive 3x more qualified applications" (unsourced).
- F11. `components/layouts/RecruiterLayout.jsx:62-65`: a permanent unread red dot on a bell with no handler.
- F12. `RecruiterLayout.jsx:53-60`: a search box with no state or handler.
- F13. `pages/candidate/Results.jsx:155`: a missing or NaN score renders as 0.
- F14. `Results.jsx:190-191`: a hardcoded summary sentence when `explanation.summary` is absent.
- F15. `recruiter/AllCandidates.jsx:192-194`: an unscored (null) score renders blank in "destructive" red.
- F16. `AllCandidates.jsx:76-87,137-141`: stored status `submitted` is shown in amber, and the status filter vocabulary (`applied|shortlisted|rejected`) never matches it.
- F17. `recruiter/Dashboard.jsx:200-201`: an API failure becomes `[]`, shown as "No candidates scored yet".
- F18. `recruiter/Dashboard.jsx:136-161`: "Applications scored, last 7 days" is bucketed by score creation time, not application date.
- F19. `recruiter/Dashboard.jsx:267`: "Active jobs" counts every owned job, whatever its status.
- F20. `candidate/Upload.jsx:106-107`: a status-check failure is shown as "No resume uploaded yet".
- F21. `Upload.jsx:395`: "Your resume is stored securely" (copy, not a verified property).
- F22. `candidate/Assessment.jsx:234-236,484-486`: "counts toward your credibility score" (no score row exists in a UI-only flow) and "the same attempt is resumed" (answers are lost on reload).
- F23. `candidate/Notifications.jsx:18-20`: non-OK responses are ignored and shown as empty.
- F24. `candidate/CandidateProfile.jsx:42`: always "Location not set" (the backend user object has no location).
- F25. Score colour bands hardcoded at 80/60 in five files (`Results.jsx:20-21`, `recruiter/Dashboard.jsx:17-18`, `JobDetails.jsx:13-14`, `CandidateModal.jsx:24-25`, `AllCandidates.jsx:53-57`), independent of the backend `matchLevel`. A badge can carry the colour of another level.

Backend:
- B1. `backend/Services/explainability.js:166-167` (and `clamp01` at `:137`): a missing `similarity_score` becomes an *available* parsing sub-score of 0, weighted 40–100 %.
- B2. `backend/Controllers/analysis.controller.js:590`: `skills: []` hardcoded for every applicant (R7).
- B3. `analysis.controller.js:97`: candidate name falls back to "Candidate".
- B4. `analysis.controller.js:98`: `candidate.location` is the **job's** location, rendered as the candidate's (`CandidateModal.jsx:117-121`).
- B5. `backend/Controllers/notification.controller.js:32-35`: a DB error returns `{notifications: [], unreadCount: 0}`.
- B6. `analysis.controller.js:569-576`: an applicant score-lookup error is ignored and becomes `credibilityScore: null` ("not scored").
- B7. `analysis.controller.js:402-415`: a Supabase `{error}` on the assessment lookup is not checked and is treated as "no assessment".
- B8. `backend/Services/applicantIdentity.js:26-27`: applicant emails are blank on an RPC error.
- B9. `analysis.controller.js:228-238`: a storage-list error becomes 404 "no résumé".
- B10. `assessment.controller.js:143-145`: a failed re-parse silently falls back to a stale parse.
- B11. `assessment.controller.js:164-170`: an empty-text (scanned) resume answers "Upload a resume first", which misstates the cause (READ, new in this synthesis).
- B12. `backend/index.js:63-70`: `/api/health` always returns `ok` and checks nothing.
- B13. `analysis.controller.js:16` and `assessment.controller.js:34`: `PARSER_VERSION = 'nlp-engine@1.0.0'` is hardcoded and never reported by the service. Related: evaluate overwrites the latest score row in place (`assessment.controller.js:498-508`), so a recruiter cannot see that the composite changed.

Python:
- P1. `nlp-engine/app/main.py:70-104` (no empty-text check): an image-only or empty PDF gives 200 "success", empty entities, similarity 0.0, "Poor Match" (VERIFIED [BL-32]).
- P2. `nlp-engine/app/main.py:42-50`: a malformed skill-list JSON silently becomes `[]` and falls back to JD scraping (reported only through `jd_source`).
- P3. `nlp-engine/app/ner.py:26`: "github" counts as a skill (the f4 false positive "not on GitHub").
- P4. `ner.py:59-125,155-178`: alias and keyword rules invent skills: `node.js`→javascript, "Java Script"→java, the English words express/spring/oracle/apache/rust, and any "API"→"rest api" (VERIFIED [PY §1.3]).
- P5. `nlp-engine/app/embedder.py:184-185`: embedding sizes 384 are hardcoded literals (accurate for MiniLM today, not read from the model).
- P6. `github-evidence/app/main.py:172-174`: `/health` reports `token_configured: true` as a constant.
- P7. `github-evidence/app/scoring.py` with owner-only listing (`github_client.py:186-204`): an account with repos but no commits in the window scores an *available* 0.0 at 35 % weight. The value is computed, not invented, but it scores linking lower than not linking (VERIFIED [PY §2.4]).
- P8. `assessment-service/app/evaluator.py:103-111`: a grading-LLM failure or a missing grade gives 0 points with "Not answered." feedback. The attempt is persisted as completed and folded into the score (VERIFIED offline [PY §3.3]).
- P9. `assessment-service/app/main.py:46-51`: health says "healthy" with no LLM key, and `gateway/health.js` therefore reports assessment `true` ([BL-05], [BL-07]).
- P10. `assessment-service/app/llm_client.py:71-74`: the error says "OPENROUTER_API_KEY is missing" and drops the Gemini failure reasons. Related: `backend/Controllers/assessment.controller.js:129,145,275` sends the ≤300-char `raw_text_preview` as `resume_text`, so questions labelled `source: "resume"` come from a preview plus skill lists.

## 5. Disagreements with `AUDIT.md`

Status disagreements:

| CHECKLIST id | AUDIT | This file | Reason |
|---|---|---|---|
| 0.5 | CODE_REVIEWED_UNTESTED | WORKING-VERIFIED | Key-pattern scan of the bundle and tracked files run (A1). |
| 0.9 | CODE_REVIEWED_UNTESTED | WORKING-VERIFIED | Scope grep run (A2). |
| 1.1 | DONE_CORRECTLY | PARTIAL | Parse output is not reachable or visible from the UI; DOCX tables dropped. |
| 1.5 | DONE_BUT_BROKEN_OR_HACKY | MISSING | The named technique (custom-trained NER) does not exist; a keyword list is a different technique, not a broken one. |
| 1.6 | DONE_CORRECTLY | PARTIAL | Embeddings are not used for skill matching (synonyms like servicenow never match, VERIFIED [PY §1.4]); UI-unreachable. |
| 2.3 | DONE_CORRECTLY | PARTIAL | UI-unreachable; no positive live fetch today ([BL-31]); no raw code files. |
| 2.5 | DONE_CORRECTLY | PARTIAL | Checks repo-level language presence, not authorship; GitHub identity unverified; UI-unreachable. |
| 2.7 | DONE_CORRECTLY | PARTIAL | UI cap; inactive account scores an available 0.0. |
| 2.10, 2.12, 2.13 | DONE_CORRECTLY | PARTIAL | Mechanism VERIFIED, but it runs only inside the UI-unreachable analyze call (UI cap). |
| 4.1 | DONE_CORRECTLY | PARTIAL | Three inputs never combined in a live run: assessment 502, no positive GitHub. |
| 4.2, 4.4 | DONE_CORRECTLY | PARTIAL | UI cap (mechanism VERIFIED by [E11]/[E12]). |
| 4.7 | DONE_CORRECTLY | PARTIAL | UI cap; inactive-GitHub 0.0 exception. |
| 5.9 | STUBBED_OR_PARTIAL | MISSING | No flag is computed anywhere; the panel is an honest empty state, not a partial feature. |
| 6.8 | MISSING | PARTIAL | The live GitHub API is used ([E11] real call); AUDIT says that call is dead code (stale). |

CODE_REVIEWED_UNTESTED rows (3.2, 3.10, 4.3, 4.11, 5.6, 5.10, 5.11, 5.12) map to PARTIAL here. That is a different scheme, not a disagreement. 4.11 adds VERIFIED NLP determinism ([BL-17]); 5.6 adds the AllCandidates status-vocabulary bug.

Stale AUDIT evidence even where the status agrees:
- `AUDIT.md:63-69`, "Services that actually run": says Express on 5000 is the browser's entry, "Not a gateway", and that the GitHub aggregator and assessment engine "do not exist". Today the gateway is on 5000, core on 5001, and all three Python services run ([BL-03] to [BL-07]).
- Module 2 header (`:113`) "no GitHub Aggregator exists", and Module 3 header (`:133`) "no assessment engine … MOCK_QUESTIONS … not routed": both false at HEAD ([FE] "Docs contradicted by code").
- Data model (`:47-61`): "6 files" and no `assessments` table. Today there are 17 migrations, including `assessments` and `assessment_keys` ([BE §6.1]).
- 1.9: "nothing consumes it". Analyze consumes the GitHub link ([E11]).
- 3.1: "`include_github` … never set". It is set, but always false because of the `contact` select (R2).
- 3.7 / 5.3: no mention that generation fails today for lack of a key ([BL-26]).
- 6.4 / 6.5: "No GitHub module" / "No LLM module". Both modules exist; the targets are still unmeasured.
- GR-2: "No API gateway exists". `gateway/` exists since `636314c` ([BE §1.3]).
- GF-4 note: "untested with a second source". A second source is tested ([BL-15], [E11]).
- 0.5 note: "No LLM key exists". The assessment-service reads its keys server-side; none is configured ([BL] §1.3).

## 6. Cheapest high-value moves

Input to planning, not a plan. All are `wiring` or small `fix`.

1. **Score on apply (5.14).** Have apply (or an explicit "analyse for this job" action) run the existing analyze pipeline on the stored resume. This is the precondition for every scoring, explanation and recruiter-view row to work from the UI (27 `wiring` rows). Size: wiring.
2. **Configure an LLM key and confirm the model ids** (`assessment-service/.env`; Anthony supplies the secret). This moves 3.1/3.2/3.5/3.7/5.3/PS-060 from never-observed to observable, and unblocks 4.1 three-input. Size: fix (config).
3. **Evaluate creates a score row when none exists** (`assessment.controller.js:484-516`). This gives the GF-4 assessment-only fallback (2.8, 3.13). Size: wiring.
4. **Assessment inputs:** select and return `contact` (`assessment.controller.js:117-119`, `parseStoredResume` return), and send the full parsed text instead of the 300-char preview (re-parse the stored file; avoids a schema change). This makes 3.1 candidate-specific and enables GitHub-sourced questions. Size: fix.
5. **Honest unreadable input (1.15, GF-2 honesty).** The NLP service returns an explicit unreadable status when the text is empty; core marks parsing unavailable instead of `?? 0` (`explainability.js:166-167`). This removes B1, P1 and B11. Size: fix. OCR itself (1.2) is build-small.
6. **Remove fabricated UI values** F1–F12 (Landing statistics, CreateJob random "AI", Jobs `count={0}` → real counts, Profile statistics, red dot, dead search box). Evaluators will see these first. Size: fix.
7. **Make existing recruiter and candidate views reachable and correct:**
   - link Results and `/recruiter/candidates` in the navs;
   - fix the recruiter Profile role case;
   - align the status vocabulary (`submitted`);
   - render a null score as "not scored";
   - drop the hardcoded `skills: []`;
   - add the shortlist/reject buttons (API exists, owner-scoped).

   This moves 5.4, 5.15 and 5.6 forward. Size: wiring.
8. **Define the missing CSS variables** (`--primary`, `--border`, `--muted`, `--success` …) so score rings and charts render (5.7, 5.11, GF-5). Needs a browser check first. Size: fix.
9. **Support vocabulary (T-0032, already approved) and an inactive linked GitHub treated as unavailable rather than 0.0** (1.17, 2.7, 4.7, GF-3 partial). Size: fix.
10. **GR-2 hardening:** bind core to 127.0.0.1 (`backend/index.js:80`) so the gateway is the only entry, and write the as-built architecture verdict (gateway = edge proxy, core = orchestrator, DEC-5). Size: fix.
