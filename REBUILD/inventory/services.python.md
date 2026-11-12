# Inventory: Python pipeline services (nlp-engine, assessment-service, github-evidence)

Auditor: Phase 1 services auditor. Date 2026-11-12. Branch `rebuild/fable`, HEAD `6da8d3f`. All three
service trees are clean against HEAD (`git status` shows no changes under them), so every `path:line`
below is HEAD.

Labels: **[VERIFIED]** = I ran something and saw the result. **[READ]** = I read the code.
**[UNKNOWN]** = not settled. I started no servers and made no external API calls. The checks I ran were
pure-function imports with the services' own venvs. Scripts are in the session scratchpad, not in the repo.

All three services are **Python 3 + FastAPI + uvicorn** [READ]. None uses another framework.

---

## 0. Summary table

| | nlp-engine | github-evidence | assessment-service |
|---|---|---|---|
| Framework | FastAPI | FastAPI + httpx | FastAPI + OpenAI SDK |
| Port | 8000 (CLI flag only, no code default) | 8001 (CLI flag only) | 8002 (`config.py:44`, `python -m app`) |
| Deps pinned | No (`requirements.txt` unpinned) | Yes (`==` pins) | No (unpinned) |
| Env vars | none read | `GITHUB_TOKEN` (required) + 7 optional | `GEMINI_API_KEY`, `OPENROUTER_API_KEY` + 8 optional |
| `.env` on disk | none | yes, defines `GITHUB_TOKEN` only | **none** |
| Touches Supabase | No | No | No |
| Shares code with others | No | No | No |
| Caller | backend (2 places) + gateway health | backend (2 places) + gateway health | backend (1 module) + gateway health |
| Unit tests of core logic | snapshot/shape only | strong (recorded + synthetic) | **none** (only request-id and bind tests) |

---

## 1. nlp-engine

### 1.1 Entry point and runtime
- There is no `__main__` and no code default port. It starts as `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`
  from `nlp-engine/`: `tests/run-suite.ps1:87-89`, `STEPS_TO_RUN_APP.md:75`. Root `README.md:123` uses `uvicorn app.main:app --reload --port 8000` [READ].
- App object: `nlp-engine/app/main.py:12-16` [READ].
- Dependencies: `nlp-engine/requirements.txt:1-21`. Nothing is pinned: fastapi, uvicorn, python-multipart, pdfplumber, python-docx,
  spacy, sentence-transformers, scikit-learn, numpy, python-dotenv. `en_core_web_sm` is only a comment (`:12-13`) [READ].
  Installed: spacy 3.8.13, sentence-transformers 5.6.1 [VERIFIED, `venv/Scripts/python -c "import spacy, sentence_transformers"`].
- Env vars: none. Nothing in `nlp-engine/app` calls `os.getenv` or `os.environ`, and `python-dotenv` is unused [READ, grep].
  The run docs set `PYTHONHASHSEED=0`, `HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1` in the shell (`tests/run-suite.ps1:86`).
- Model files: spaCy `en_core_web_sm` is loaded **twice**, once at `app/preprocessor.py:7` and once at `app/ner.py:5`, so there are two copies
  in memory. Sentence-BERT `all-MiniLM-L6-v2` is loaded at import (`app/embedder.py:11`) from the HuggingFace cache. It is cached locally
  (`~/.cache/huggingface/hub/models--sentence-transformers--all-MiniLM-L6-v2` exists) [VERIFIED].
- There are two venvs, `nlp-engine/venv` and `nlp-engine/.venv`. The harness and the docs use `venv` (`tests/run-suite.ps1:58`) [VERIFIED, ls].
- `nlp-engine/uploads/` exists and is empty [VERIFIED].

### 1.2 Endpoints
| Method | Path | Handler | Request | Response | Callers |
|---|---|---|---|---|---|
| GET | `/` | `app/main.py:34-40` | none | `{status:"running", service, version}` | gateway health `gateway/health.js:25`; tests `tests/nlp/test_parse.py:73` |
| POST | `/parse` | `app/main.py:53-113` | multipart: `resume` file (required), `jd` text (required), `required_skills` and `preferred_skills` JSON-array strings (default `"[]"`) | `{status:"success", filename, raw_text_preview (first 300 chars), preprocessing{token_count, tokens_preview, noun_chunks_preview, sentence_count}, entities{candidate_name,email,phone,github,linkedin,skills,skill_count,experience,education,projects}, semantic_analysis{...see 1.4}}` | `backend/Controllers/analysis.controller.js:325` (POST /api/analyze); `backend/Controllers/assessment.controller.js:61` (on-demand parse during assessment generation); `tests/nlp/test_parse.py:63`; `tests/arch/nlp-outage-probe.mjs` |

[READ] There is a request-id middleware (`app/main.py:25-32`) that echoes `X-Request-ID` and logs nothing. There is no auth, no file-size
limit and no content-type check. The uploaded file's extension comes from the client-supplied filename (`:63`).

### 1.3 What it really does (POST /parse)
1. It writes the upload to `uploads/<uuid><ext>`, relative to the **current working directory** (`main.py:18-19,63-68`), and deletes it in `finally` (`:111-113`) [READ].
2. **Text extraction** (`app/extractor.py:27-36`) [READ, VERIFIED]:
   - `.pdf`: pdfplumber `page.extract_text()` per page, concatenated (`:5-12`). Pages with no text layer are skipped silently.
   - `.docx`: python-docx, `doc.paragraphs` only (`:14-20`). **Tables, headers and text boxes are ignored** [READ].
   - `.txt`: UTF-8 with `errors="replace"` (`:22-24`).
   - Any other extension raises `ValueError("Unsupported file type")` (`:36`). `.doc`, `.png` and `.jpg` all raise [VERIFIED by calling `extract_text`]. The endpoint does not catch it, so the result is an HTTP 500.
   - **OCR: does not exist.** There is no OCR package in `requirements.txt` and none installed in the venv (`pip list | grep -iE "tesser|ocr|easyocr|pdf2image|paddle"` → nothing) [VERIFIED]. The image-only fixture `tests/fixtures/f6_image_only.pdf` extracts **0 characters** [VERIFIED]. Its committed snapshot `tests/nlp/snapshots/current/f6_image_only.json` shows `status:"success"`, every entity empty, `similarity_score 0.0` and `"Poor Match"` [READ]. Guide feedback GF-2 (OCR is a must) is unmet.
   - Two-column PDFs: the columns are interleaved line by line. In `f5_multicolumn.pdf`, "CONTACT EXPERIENCE" and the email sit on one line, and the snapshot finds `experience = 0` [VERIFIED text; READ snapshot].
3. **Preprocessing** (`app/preprocessor.py:9-41`): spaCy tokens, lemmas, sentences and noun chunks. Only previews are returned (`main.py:88-93`). `noun_chunks` is passed to `analyse` and then deleted unused (`embedder.py:123`) [READ].
4. **Entities** (`app/ner.py:521-584`) [READ]:
   - **Name**: the first spaCy `PERSON` entity of two or more words **anywhere** in the document (`:525-532`). A referee's name can win.
   - **Skills**: a closed keyword list. `SKILL_KEYWORDS` has about 150 entries (`:7-55`), plus `SKILL_ALIASES` (`:59-75`) and the regexes `GENERIC_SKILL_PATTERNS` (`:78-84`). Matching is word-boundary regex (`extract_skills`, `:155-178`). A skill outside the list can never be detected. Checked on sample strings [VERIFIED]:
     - `"Built APIs with Node.js and Next.js"` → `javascript` is detected because the alias `js` matches inside `node.js`. A false positive.
     - `"Expert in Java Script"` → `java` **and** `javascript`. A false positive.
     - `"I will express my rust-free approach to Spring cleaning at Oracle with Apache"` → `rust, express, spring, oracle, apache`. English words become skills.
     - `"Worked with C, Go and R on Linux"` → only `linux`. C, Go and R are never detected (the list only has `golang` and `r language`).
     - `"Handled ticket triage, incident management, ServiceNow, Jira, Windows Server, Active Directory, SLA"` → `[]`.
     - The support fixture `f3_support_nogithub.pdf` contains `servicenow`, `jira`, `itil` and `nagios` in its text [VERIFIED], but the parser finds only `bash, linux, sql` (snapshot) [READ]. The support job's required skills include servicenow, jira and itil (`tests/fixtures/manifest.json`), so a support candidate **cannot** be matched on them. This is GF-3.
     - The keyword `github` (`:26`) is itself a "skill", and AUDIT 1.17 records it as a false positive from "not on GitHub".
   - **Skill normalisation** (`normalize_skill`, `:128-140`): `.strip(" .,:;/|()[]-")` removes the leading dot of `.net`, so it becomes `net` [VERIFIED]. `rest`, `api`, `apis` and `api development` all collapse to `rest api` (`:101-110`). Any mention of "API" therefore counts as "REST API".
   - **Experience** (`:378-412`): only lines under a recognised "experience" heading (`_CANONICAL_SECTIONS`, `:190-223`). A line becomes a job entry if it has a date span, a spaCy ORG, or is 12 words or fewer and does not start with an action verb. Bullets attach as highlights. With no heading the result is `[]`.
   - **Education** (`:415-440`): inside an education section, **any** non-bullet line of 14 words or fewer is kept. A sample with a LinkedIn/GitHub URL line under EDUCATION put the URL line into `education` [VERIFIED]. Without a section, lines matching `_STRONG_EDUCATION_RE` (`:255-261`) are kept.
   - **Projects** (`:443-518`): uses title heuristics and is scoped to the projects section.
   - **Certificates: not extracted.** "certifications" exists only as a heading alias (`:210-214`). Nothing reads that section and there is no `certifications` key in the output (`:573-584`) [READ; VERIFIED, the output keys were `candidate_name, education, email, experience, github, linkedin, phone, projects, skill_count, skills`].
   - **LinkedIn**: the first regex match of `linkedin.com/in/<id>` (`:548,571,578`). It is captured as a string only. There is no validation of the profile (GF-1 unmet).
   - **GitHub**: the first bare `github.com/<owner>` link, else the owner of the first repo link (`:547,557-569`). The owner regex allows `_` and `.`, which GitHub logins do not.
   - **Email and phone**: regexes at `:544-545`. A phone needs 10 or more digits (`:555`).
5. **Semantic analysis** (`app/embedder.py:109-196`): see 1.4.

**When parsing fails** [READ]: an unsupported type, a corrupt PDF or DOCX, or a missing filename raises an uncaught exception, and FastAPI returns 500 with the default body. **Empty text (scanned PDF) returns 200 `status:"success"`** with empty entities and a 0.0 score. There is no "unreadable" signal (AUDIT 1.15 agrees). A malformed `required_skills` JSON is silently treated as `[]` (`main.py:42-50`). The service then falls back to scraping skills from the JD text, which it does report as `jd_source:"parsed_description"`.

Concurrency: `parse_resume` is `async def` (`main.py:54`), but all its work is synchronous CPU work (pdfplumber, spaCy, S-BERT), so one parse blocks the event loop and every other request, including `GET /`. This is already recorded as ISSUES I-0037 [READ].

### 1.4 Scoring and explainability in nlp-engine
All in `app/embedder.py` [READ]:
- `resume_skills = normalize_skills(entities.skills)`. `jd_skills` = the normalised `required_skills + preferred_skills` when non-empty, with **preferred weighted the same as required** (`:88-106`, comment `:95-99`). Otherwise skills are scraped from `jd` with the same keyword list (`:106`).
- `skill_coverage = |matched| / |jd_skills|`, or `None` when `jd_skills` is empty (`:131-136`). Matching is exact on the canonical token, so a JD skill outside the keyword catalogue (e.g. `servicenow`) can only match if a resume line produces exactly that token, and extraction never produces it. Coverage is therefore capped for non-dev roles.
- `focused_similarity` = cosine(MiniLM(focused resume text), MiniLM(jd)). The focused text is "Candidate technical skills: …" plus up to 24 resume lines containing a detected skill (`:36-65`). `full_text_similarity` = cosine on the first 8000 characters (`:140`). Cosine is clamped to [0,1] (`:26-33`).
- `semantic_score = 0.65*focused + 0.35*full_text` (`:141-143`). **These 0.65/0.35 weights are not emitted in `component_weights`.**
- `final_score (= similarity_score) = 0.60*skill_coverage + 0.40*semantic_score` (`:17-18,147-159`), or `semantic_score` alone when coverage is None. Clamped and rounded to 4 decimals.
- `match_level` thresholds (`:68-85`): with coverage, Strong needs cov ≥0.75 and sem ≥0.55, Moderate needs cov ≥0.45 and sem ≥0.40, Weak needs final ≥0.30, otherwise Poor. Without coverage the cut-offs are sem 0.70/0.50/0.30.
- `match_reason` text (`:161-176`) is **derived from real inputs**: counts, missing-skill names and the JD source. It is not generic.
- `resume_embedding_size: 384` and `jd_embedding_size: 384` are hardcoded literals (`:184-185`).
- Backend use: `backend/Services/explainability.js:165-283` (`buildParsingSubScore`) carries these fields through. `similarity_score ?? 0` (`:167`) turns a missing score into 0 silently, in the backend.

### 1.5 Failure behaviour
| Dependency | Behaviour | Silent fallback? |
|---|---|---|
| spaCy model missing | import raises OSError and the service does not start (`tests/nlp/test_model_load.py:35-44`) | No, loud |
| MiniLM model missing (offline, no cache) | `SentenceTransformer(...)` at import fails and the service does not start [READ; not run] | No, loud |
| Unsupported or corrupt file | uncaught exception → 500 | No |
| Image-only or empty PDF | **200 success with empty entities and a 0.0 score** | **Yes: a fabricated "Poor Match" for an unreadable resume** |
| Malformed skill-list JSON | treated as `[]` → falls back to JD-text scraping | Partly (reported via `jd_source`) |
| Supabase / LLM / GitHub | not used | n/a |

### 1.6 Independence verdict
**A real, independently runnable service** [READ]. It is its own process with its own FastAPI app, venv, requirements and HTTP interface. It imports
nothing from other services and has no database connection, and the backend persists its output. Weak points: no start script in the tree,
unpinned dependencies, and a CWD-relative `uploads/` directory.

### 1.7 Tests
- `tests/nlp/test_parse.py:73` `test_service_is_up` and `:80` `test_parse_fixture` (6 fixtures plus optional private resumes). These assert **response
  shape only** and write snapshots. The docstring says snapshots are "NOT a statement that the output is correct" (`:5-7`) [READ].
- `tests/nlp/test_contact_determinism.py:48,73`: contact fields stay stable across hash seeds; GitHub link selection rules.
- `tests/nlp/test_model_load.py:36`: a missing spaCy model stops the import.
- There is no test of skill accuracy, OCR, certificates, the scoring formula or `match_level`.

---

## 2. github-evidence

### 2.1 Entry point and runtime
- Start: `venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8001` from `github-evidence/` (`github-evidence/README.md:18`, `app/main.py:4`).
  The module-level `app = create_app()` (`app/main.py:199-200`) loads `github-evidence/.env` first. Without `GITHUB_TOKEN` it raises `ConfigError` at import, and the process does not start (`app/config.py:62-64`) [READ].
- Dependencies: `requirements.txt` pins fastapi, starlette, uvicorn, httpx, pydantic and python-dotenv with `==`. `requirements-dev.txt` adds pytest, respx and pytest-socket [READ].
- Env var names: `GITHUB_TOKEN` (required). Optional: `GITHUB_API_URL`, `GITHUB_MAX_REPOS`, `GITHUB_HTTP_TIMEOUT_S`, `GITHUB_DEADLINE_S`, `GITHUB_MIN_REMAINING`, `GITHUB_DETAIL_REPOS`,
  `GITHUB_CONCURRENCY`, `GITHUB_SUBSCORE_WEIGHTS` (`app/config.py:61-76`). `github-evidence/.env` exists and defines only `GITHUB_TOKEN` [VERIFIED, variable names only].
- No CORS and no docs pages (`main.py:137`). It is designed as internal-only (DEC-5).

### 2.2 Endpoints
| Method | Path | Handler | Request | Response | Callers |
|---|---|---|---|---|---|
| GET | `/health` | `app/main.py:172-174` | none | `{status:"ok", service, contract_version:"1", token_configured:true}` (the last field is a constant, always true because the app cannot start without a token) | gateway `gateway/health.js:26`; `tests/github/test_service.py:59` |
| POST | `/v1/evidence` | `app/main.py:176-192` | `{username: GitHub login (validated, contract.py:11-16,53-58), claimed_skills?: ≤200 strings, window_days?: 1..730 (default 365)}` | `Evidence` (`contract.py:142-155`): profile, repositories (counts and items), languages, commit_activity, claims, sub_score, limitations, rate_limit. Errors use a fixed table (`contract.py:29-39`): 400/404/503/502/504/500 `{error, message}` | `backend/Services/githubEvidence.js:114-118` (`fetchGithubEvidence`), called from `backend/Controllers/analysis.controller.js:395` and `backend/Controllers/assessment.controller.js:258` |

### 2.3 What it really does
1. **Auth**: one server-side GitHub token sent as `Authorization: Bearer` (`github_client.py:163-177`). No redirects are followed, no cookies kept, and the environment proxy and netrc are ignored [READ].
2. **Data fetched** [READ]:
   - `GET /users/{login}` → profile; `public_repos` and `html_url` are required (`:179-184`).
   - `GET /users/{login}/repos?type=owner&sort=pushed`, paginated up to `GITHUB_MAX_REPOS` (default 100) (`:186-204`). **Owner repos only**: organisation repos and contributions to other people's repos are never seen.
   - For the `GITHUB_DETAIL_REPOS` (default 10) most recently pushed non-fork repos (`metrics.py:36-40`): `GET /repos/{login}/{repo}/languages` and `GET /repos/{login}/{repo}/commits?author={login}&since=<window>`, up to 5 pages of 100 (`github_client.py:241-265`, `MAX_COMMIT_PAGES` `:28`).
3. **Rate limits** [READ]: in-process `RateLimitState` (`:68-91`). Once remaining falls below `GITHUB_MIN_REMAINING` (default 100) the service refuses with 503 `github_rate_limited` without calling GitHub (`:139-141,237-238`). A 403/429 with remaining 0 → 503. A short secondary limit (≤1 s) is retried once. A 5xx or connection error is retried once with jitter (`:277-321`). Total deadline is 6 s (`config.py:51`, `:142-158`). A deadline hit after the repo list returns `status:"partial"` and is not an error.
4. **Skill → evidence matching** (`claims.py:24-55`, `skill_languages.py:21-62`) [READ, VERIFIED]: a claimed skill is mapped to a GitHub linguist **language** only. Frameworks and tools return `None` and become `not_checkable`, never counted. A language counts as `evidenced` if **any** owned non-fork repo of **any age** has it as the primary language or in `/languages`. This checks repository-level language presence, not that the candidate authored code in it. Mapping checks [VERIFIED]: `python→Python`, `golang→Go`, `bash→Shell`, `c#→C#`. But `sql`, `sass`, `jupyter`, `react`, `servicenow` and `r language` (the NLP's own canonical token) all map to `None`, so an NLP-claimed R skill can never be checked.
5. **Can a candidate claim someone else's GitHub?** **Yes** [READ]. The login comes from whatever `github.com/<x>` link appears in the resume text (`ner.py:557-569` → `backend/Services/githubEvidence.js:105`). There is no OAuth (AUDIT 2.2 MISSING; grep for `oauth` in backend/frontend code finds only unused env vars per ISSUES I-0039), no proof of control, and no cross-check with the account's email or name. A separate `profiles.github_url` column filled at signup (`supabase/migrations/20260823000000_create_profiles.sql:15`) is **not** used by the evidence path. Commit attribution uses `author=<login>`, so the evidence is that account's activity, whoever submitted the resume.

### 2.4 Scoring and explainability
`app/scoring.py` [READ; VERIFIED by calling `compute_subscore`]:
- `activity = min(1, ln(1+authored_commits)/ln(201))` (`:68-69`, saturation `:25`)
- `consistency = min(1, active_weeks/26)` (`:72-73`). Active weeks are counted over 52 weekly buckets (`metrics.py:61-69`).
- `ownership = min(1, owned_detail_repos_with_≥1_authored_commit/5)` (`:76-77`)
- `corroboration = evidenced/(evidenced+not_found)`, or `None` when no claim is checkable (`:80-82`)
- Default weights: activity 0.25, consistency 0.25, ownership 0.20, corroboration 0.30 (`:23`). They are marked "PROVISIONAL" (`:9-10`), can be overridden by `GITHUB_SUBSCORE_WEIGHTS` JSON (`:40-65`), and are renormalised over the available components (`:101-108`).
- `value = Σ value·weight`, in [0,1]. With no owned non-fork repo: `available:false, reason_code:"no_public_repositories"` (`:90-92`). Example [VERIFIED]: 50 commits, 10 weeks, 2 repos and 2 of 3 claims evidenced gives **0.5615**.
- **Fairness gap** [VERIFIED + READ]: an account with owned repos but **no commits in the 365-day window** scores an *available* **0.0**. The backend then weights it at 0.35 of the composite (`backend/Services/explainability.js:110-114`). A candidate with no GitHub link gets the weight redistributed and loses nothing. So **linking an older or inactive GitHub lowers a candidate's credibility below not linking one**, and maintenance or support work in employer or organisation repos is invisible (owner-only listing). This works against GF-3 and GF-4.
- Explanation: the service returns numbers, components, `limitations` codes (`main.py:78-87`) and `reason_code`. The prose is written in the backend (`explainability.js:361-456`) from those real values. `GITHUB_PRIVATE_WORK_NOTE` is fixed text.

### 2.5 Failure behaviour
| Dependency | Behaviour | Silent fallback? |
|---|---|---|
| No `GITHUB_TOKEN` | process refuses to start (`config.py:62-64`) | No |
| GitHub 401 | 503 `github_auth_failed` | No |
| User missing | 404 `github_user_not_found` | No |
| Rate limited | 503 `github_rate_limited` + `Retry-After` | No |
| Timeout before the repo list | 504 `github_timeout` | No |
| A detail call fails or the deadline hits mid-way | 200 `status:"partial"`, that repo's data `null`, `limitations` lists it (`main.py:54-56,86-87`) | No, labelled |
| No commit data at all | commit components `available:false` (not 0) | No |
| Backend side | `fetchGithubEvidence` never throws. Every failure becomes `{ok:false, reasonCode}` (`backend/Services/githubEvidence.js:100-129`) → sub-score "unavailable" | No |

This service follows the "no fabricated values" rule; its gap is fairness, not fabrication.

### 2.6 Independence verdict
**A real, independently runnable service, and the most complete of the three** [READ]. It has its own entry point, pinned dependencies, a versioned contract,
a fixed error table and its own venv. It shares no code and has no Supabase access. `tools/record_github.py` imports the service's own client
to record fixtures (`tools/record_github.py:28-31`) and is a dev tool only.

### 2.7 Tests (the most thorough of the three)
- `tests/github/test_service.py`: token required, health, response shape, pagination, repo cap, username validation, user not found, primary and secondary and low-water rate limits, upstream retry, deadline, auth failure, no echo of internals, a fixed 500, auth headers, request id, no CORS or docs, live calls blocked (pytest-socket), recordings scrubbed (`:42-393`).
- `tests/github/test_client.py`: settings, Link-header handling, cap/truncation, secondary-limit retry, low-water, connection retry, the recorder (`:40-199`).
- `tests/github/test_metrics.py`: language breakdown, commit activity, ownership, archived repos, claims (including beyond the detail cap and ignoring pushed_at), no repos, partial results, deadline, page cap, call budget, determinism, the octocat recording, contract snapshot (`:58-439`).
- `tests/github/test_scoring.py`: formula, saturation, zero versus missing, no corroboration, nothing available, no owned repo, partial flag, weights env (`:29-132`).
- Backend side: `tests/backend/github-evidence-client.test.mjs` (link normalisation, outcome mapping, retry, request-id) and `tests/backend/live-analyze-github.test.mjs` (stub on :8001).
- Not tested: fairness for inactive or organisation-only accounts, and identity spoofing.

---

## 3. assessment-service

### 3.1 Entry point and runtime
- Start: `python -m app` from `assessment-service/` → `app/__main__.py:7-13` → `uvicorn.run(app, host=HOST, port=PORT)`. The defaults are `127.0.0.1:8002`
  (`app/config.py:43-44`, env `ASSESSMENT_HOST` and `ASSESSMENT_PORT`). Docs, redoc and openapi are off (`app/main.py:22-24`) [READ].
- Dependencies: `requirements.txt` lists fastapi, uvicorn, pydantic, openai and python-dotenv, **unpinned**. `requirements-dev.txt` adds pytest==9.1.1. The venv is `assessment-service/.venv` [READ].
  **`STEPS_TO_RUN_APP.md:88` starts it with `.\venv\Scripts\python.exe`, but `assessment-service/venv` does not exist (only `.venv`) [VERIFIED, ls], so the documented command fails.**
- Env var names (`app/config.py`): `GEMINI_API_KEY`, `GEMINI_BASE_URL`, `GEMINI_MODELS` / `GEMINI_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_FREE_MODELS`,
  `ASSESSMENT_REQUEST_TIMEOUT_SECONDS`, `ASSESSMENT_MAX_RETRIES_PER_MODEL`, `ASSESSMENT_HOST`, `ASSESSMENT_PORT`. They are loaded from `assessment-service/.env` (`:6-7`).
  **No `.env` exists in `assessment-service/`, and no `.env` file in the repo defines `GEMINI_API_KEY` or `OPENROUTER_API_KEY`** [VERIFIED, names-only scan of `backend/.env`, `frontend/.env`, `github-evidence/.env`, `tests/.env`]. With the shell environment clear, the service starts but every generation fails (see 3.5). Whether the demo machine sets them in the shell is [UNKNOWN].

### 3.2 Endpoints
| Method | Path | Handler | Request | Response | Callers |
|---|---|---|---|---|---|
| GET | `/` | `app/main.py:46-51` | none | `{service, status:"healthy"}` | gateway `gateway/health.js:27` |
| POST | `/generate-assessment` | `app/main.py:54-76` | `AssessmentInput` (`schemas.py:6-21`): candidate_id, job_id, job_title, job_description ≤12000, required_skills/preferred_skills ≤50, resume_text ≤20000, resume_skills ≤100, resume_projects ≤30, experience_level, include_github, github_data | `{questions:{assessment_id,candidate_id,job_id,model_used,prompt_version,questions[20]}, answer_key:{assessment_id, answers[20]}}`. **Returns the answer key to the caller**; the backend strips it. 502 on LLM failure, 500 otherwise | `backend/Services/assessmentService.js:18-19` ← `backend/Controllers/assessment.controller.js:285` |
| POST | `/evaluate-assessment` | `app/main.py:79-94` | `EvaluateInput` (`schemas.py:90-94`): assessment_id, questions[], answer_key[], answers[{question_id, response}]. **The caller supplies the key**; the service is stateless | `{assessment_id, points_earned, points_possible, score (0-100), results[{question_id, question_type, skill, correct, points, max_points, feedback}], short_answer_graded}` | `backend/Services/assessmentService.js:21-22` ← `assessment.controller.js:436-439` |

There is no auth on the service. Its only protection is the loopback bind [READ].

### 3.3 What it really does
- **LLM provider and model** (`app/llm_client.py`, `app/config.py:9-31`) [READ, VERIFIED defaults]:
  - Primary: **Gemini through Google's OpenAI-compatible endpoint** (`GEMINI_BASE_URL` default `https://generativelanguage.googleapis.com/v1beta/openai/`). Default model list `["gemini-3.8-flash"]` (`config.py:15-22`). `.env.example` suggests `gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3.8-flash`. Whether these model ids exist is [UNKNOWN] (no API call made). Gemini is skipped entirely when `GEMINI_API_KEY` is empty (`llm_client.py:29-30`). Each model gets **one** try. Any exception, including invalid JSON, is swallowed and recorded as the type name only (`:52-53`).
  - Fallback: **OpenRouter** `https://openrouter.ai/api/v1` (`config.py:10`), default free models `openai/gpt-oss-20b:free, google/gemma-3-27b-it:free` (`config.py:24-31`). `.env.example` uses `openrouter/free`. 2 tries per model, with backoff of 1-8 s (`llm_client.py:86-120`).
  - Both paths: `temperature=0.3`, the system prompt "You generate technical assessments… return only valid JSON." (`:42,92`), `json.loads` of the raw content. No `response_format` / JSON mode, and no seed.
  - **If Gemini fails and `OPENROUTER_API_KEY` is empty, the error says "OPENROUTER_API_KEY is missing"** (`:71-74`) and the Gemini failures are dropped from the message.
- **Prompts** live in `app/prompts.py` [READ]:
  - Generation prompt (`:7-87`): a SECURITY block treats job, resume and GitHub content as untrusted (`:28-33`). It asks for exactly 20 questions: 10 MCQs `q1-q10` and 10 short answers `q11-q20`. **Difficulty is fixed to "easy to moderate"** (`:39`). "Prefer required job skills and skills claimed in the resume" (`:41`). Each question has a `source` of jd/resume/github and four options A-D. Short answers get an ideal answer and 2-4 key points. Inputs are truncated: JD to 12000 characters, resume to 12000, skills to 50/50/100, projects to 20. **`github_data` is not truncated** (`:11-21`).
  - Grading prompt (`:90-119`): grades 1.0/0.5/0.0 against the ideal answer and key points and returns `{grades:[{question_id, points, feedback}]}`. **It has no untrusted-input rule, and the candidate's free text is embedded verbatim** (`:98,117-118`), so a prompt-injected answer can steer its own grade (also ISSUES I-0067, AUDIT 3.6).
  - `PROMPT_VERSION = "assessment-v1"` is defined twice: `config.py:46` (used) and `prompts.py:4` (unused).
- **How questions tie to claimed skills** [READ]: only through the prompt instruction. The validator (`app/validators.py:18-233`) checks counts, ids, types, option labels, unique option text and key shape. It does **not** check that `skill` is in the job's or the candidate's skills, and it does **not** reject `source:"github"` when GitHub is disabled.
- **What resume text actually reaches the LLM** [READ]: the backend sends `resume_text = resumes.raw_text_preview` (`backend/Controllers/assessment.controller.js:129,141,164,275`). That field is the NLP's `raw_text[:300]` (`nlp-engine/app/main.py:87`). **The LLM sees at most the first 300 characters of the resume**, which is usually the name and contact block, plus the parsed `skills` and `projects` lists. The `.slice(0, 20000)` at `:164` is moot.
- **GitHub-sourced questions never happen in practice** [READ]: the controller reads `resume?.contact?.github` (`assessment.controller.js:255`), but the row it loaded selects only `skills, experience, projects, raw_text_preview, created_at` (`:119`), and `parseStoredResume` returns no `contact` either (`:72-78`). `githubLink` is therefore always `null`, `include_github` is always false, and the service then nulls `github_data` (`generator.py:76-77`).
- **Generation flow** (`app/generator.py:60-120`) [READ]: up to `MAX_RETRIES_PER_MODEL` (2) validation rounds. Each round is a full `generate_json` with its own model fallback, and validation errors are appended to the prompt for the retry (`:87-93`). On success the MCQ options are shuffled with `random.shuffle` and the key is remapped and re-checked (`:13-57`). The assessment id is a fresh `uuid4` (`:79`). No previous questions are passed in, so there is no de-duplication across attempts. The backend allows a 300 s generate timeout, with the comment "a free-tier LLM needs 2-4 minutes" (`backend/Services/assessmentService.js:11-13`).
- **Grading** (`app/evaluator.py:42-139`) [READ; VERIFIED offline with no keys]:
  - MCQ: deterministic, `response.strip().upper() == correct_option` (`:8-27`). Case-insensitive: `"b"` is accepted [VERIFIED].
  - Short answers: one batched LLM call (`:93-104`). Points are `float`, clamped to [0,1] and **not snapped** to {0, 0.5, 1} (`:113-116`). `correct` means points ≥0.999.
  - **If the LLM call fails, or a grade is missing, the short answer becomes `_unanswered` → 0 points, feedback "Not answered."** (`:103-111`), and it **still counts in `points_possible`**. Verified: a correct short answer with the LLM unavailable produced `points 0.0, feedback "Not answered.", score 50.0, short_answer_graded:false` [VERIFIED]. The backend then marks the attempt `completed` and folds the 50 into the credibility score (`assessment.controller.js:451-514`). An infrastructure failure becomes a 0 with a **false** "Not answered." message. The backend's explanation note does disclose it (`backend/Services/explainability.js:479-482`).
- **Scoring formula** (`evaluator.py:129-136`): every question has max 1 point, `score = round(Σpoints / Σmax × 100, 2)`. MCQs and short answers weigh the same. There is no per-skill or difficulty weighting.
- **Storage** [READ]: the service is stateless and stores nothing. The backend stores questions in `public.assessments.questions` and the key in `public.assessment_keys` (RLS on, no client policy, `assessment.controller.js:305-349`). Answers and evaluation go in `assessments.answers` and `assessments.evaluation` (`:452-464`).
- **Time limits**: **none** [READ]. There is no duration, start time or expiry in the service schemas, the backend controller or the frontend. A grep for `time_limit|timeLimit|countdown|expires_at|started_at|duration` finds only CSS/animation durations. An open attempt is resumed indefinitely (`assessment.controller.js:217-221`).

### 3.4 Anti-cheating (GR-1): state
**There is no anti-cheating design document** (AUDIT `GR-1` = MISSING; `ASSESSMENT_IMPLEMENTATION_PLAN.md:32` lists "A full anti-cheating/proctoring system" as out of scope; `assessment-service/README.md:288-289` says it is not implemented) [READ].

Measures that exist [READ]:
1. The answer key is never in the generate or resume response to the browser (`stripKey`, `assessment.controller.js:37-40,352`; the open-attempt resume returns only `questions`, `:220`). The key is kept in a table no client role can read (tests `tests/backend/live-answer-key-access.test.mjs:59-92`, live, which skip without accounts).
2. MCQ options are shuffled after generation (`generator.py:107`).
3. Questions are freshly generated per attempt (no static bank).
4. Single submission per attempt, enforced by an atomic DB claim (`assessment.controller.js:404-477`, `tests/backend/grading-claim.test.mjs`, `live-evaluate-once.test.mjs`).
5. A cap of 5 completed attempts per job (`:223-243`).

Measures that are absent [READ]:
- **No time limit** of any kind, server or client.
- No proctoring, no tab-switch, focus or visibility detection, no copy/paste blocking (grep for `visibilitychange|onPaste|onCopy|fullscreen|proctor` in `frontend/src` → none).
- No identity check that the person taking the test is the candidate (session only).
- **Correct answers are revealed right after submission.** For a wrong MCQ the feedback is `"Correct answer: <X>. <explanation>"`, and for a right one it is the explanation (`evaluator.py:12-18`, VERIFIED output `Correct answer: B. because B`). These results go to the browser (`assessment.controller.js:520-527`), which renders `r.feedback` (`frontend/src/pages/candidate/Assessment.jsx:273-275`). With 5 attempts on the same job and skills, attempt N leaks material for attempt N+1.
- **The latest attempt counts, not the first or the best** (`assessment.controller.js:197-199,487-514`), so a candidate can keep retrying.
- The short-answer grader is open to prompt injection (see 3.3).
- No plagiarism or LLM-written-answer detection, no answer-similarity checks, no question-pool or difficulty adaptivity (AUDIT 3.3/3.4 MISSING).
- No server-side record of when an attempt started, so speed anomalies cannot even be detected afterwards.

### 3.5 Failure behaviour
| Dependency | Behaviour | Silent fallback? |
|---|---|---|
| No LLM keys | generate → `AssessmentLLMError("OPENROUTER_API_KEY is missing…")` → 502 (`main.py:66-70`) → backend 502 "Assessment generation failed" | No (but the message hides the Gemini cause) |
| All models fail or invalid JSON after retries | 502 with a failure summary | No |
| Validation fails twice | 502 `AssessmentLLMError` (`generator.py:114-120`) | No |
| No static or mock question fallback | confirmed absent (AUDIT 3.2) | No |
| **Grading LLM fails** | **short answers scored 0 / "Not answered."**, `short_answer_graded:false`, score still computed and persisted | **Yes: an infrastructure failure becomes a 0 score** |
| Grading LLM returns a non-standard value (e.g. 0.73) | accepted (clamped only) | Partly |
| Any other exception | 500 fixed message | No |

### 3.6 Independence verdict
**A real, independently runnable, stateless service** [READ]. It has its own `__main__`, venv, requirements and loopback HTTP interface, shares no
code and has no Supabase access. It is "independent" but **operationally not ready**: no LLM key is configured in any `.env` on disk, its dependencies are unpinned,
the documented start command in `STEPS_TO_RUN_APP.md` points to a venv that does not exist, and its core logic has no tests.

### 3.7 Tests
- `tests/assessment/test_internal_only.py:15-46`: docs off, health answers, default bind 127.0.0.1:8002, `python -m app` runs uvicorn, README start commands.
- `tests/assessment/test_request_id.py:11-28`: request-id echo and replacement.
- **No test exercises `generator.py`, `validators.py`, `evaluator.py`, `prompts.py` or `llm_client.py`.** This is consistent with AUDIT 3.2 "promote with `tests/assessment/test_generator.py`", which does not exist.
- Backend-side: `tests/backend/assessment-service-client.test.mjs` (HTTP client, timeouts, retry), `assessment-generate.smoke.mjs` (401 guards), `assessment-evaluate-live.test.mjs` (input validation), `grading-claim.test.mjs`, `live-evaluate-once.test.mjs`, `live-evaluate-release.test.mjs`, `live-answer-key-access.test.mjs`. None checks question quality, the grading formula, the leakage of correct answers, or the 300-character resume.

---

## 4. Duplicated or contradicting implementations
1. **Skill vocabularies: two independent tables with different canonical forms.** NLP has `SKILL_KEYWORDS` + `SKILL_ALIASES` + `_EXTRA_NORMALISATION` (`nlp-engine/app/ner.py:7-125`). github-evidence has `_ALIASES` (`github-evidence/app/skill_languages.py:21-57`). NLP emits `golang`, `r language`, `net` and never `c`, `go` or `r`, so GH's C, R and `go` entries are unreachable from NLP-sourced claims, and `r language` is always `not_checkable` [VERIFIED]. The two normalisers differ (NLP strips punctuation at the ends; GH strips spaces, dots, `-` and `_` everywhere).
2. **Three GitHub-login parsers and validators plus two identity sources**: the NLP regex (`ner.py:547`, allows `_` and `.`), the backend `normaliseGithubLogin` + `LOGIN_RE` + `RESERVED` list (`backend/Services/githubEvidence.js:36-57`), and the service `_LOGIN` (`github-evidence/app/contract.py:11-16`). The identity itself comes either from the resume link (used) or from `profiles.github_url` at signup (`supabase/migrations/20260823000000_create_profiles.sql:15`, unused by evidence). Neither is verified.
3. **Two NLP call-and-persist pipelines in the backend**: `analysis.controller.js:319-391` and `assessment.controller.js:46-110`. Both POST `/parse`, both insert into `resumes`, both hardcode `PARSER_VERSION = 'nlp-engine@1.0.0'` (`analysis.controller.js:16`, `assessment.controller.js:34`) and `NLP_PARSE_URL` (`:15` / `:33`). They differ: the assessment copy drops `contact` from its return value (the cause of the GitHub bug in 3.3). The stored-file paths also differ: `/api/analyze` uploads to `<candidateId>/<uuid><ext>` (`analysis.controller.js:339`), while upload and assessment use `candidates/<candidateId>/resume<ext>` (`analysis.controller.js:157`, `assessment.controller.js:47,133`).
4. **Parsing-score weights in two places**: NLP `SKILL_COVERAGE_WEIGHT 0.60 / SEMANTIC_SCORE_WEIGHT 0.40` (`embedder.py:17-18`), and the backend fallback copy `0.6/0.4` (`backend/Services/explainability.js:189-192`). The NLP-internal `0.65/0.35` (`embedder.py:141-143`) is visible nowhere downstream.
5. **Weight-loading rules copied**: `github-evidence/app/scoring.py:40-65` mirrors the backend `readBaseWeights` (`explainability.js:116-135`). The copy is documented, but they can drift.
6. **Request-ID middleware implemented three times in Python** (`nlp-engine/app/main.py:23-32`, `assessment-service/app/main.py:32-43`, `github-evidence/app/main.py:143-161` + `contract.py:12`) plus `backend/Services/internalHttp.js`. Same regex rule, copied.
7. **Two LLM client loops in one file** (`llm_client.py:28-59` Gemini, `:62-128` OpenRouter) with duplicated message construction and different retry and error semantics.
8. **Two sources of job skills inside the NLP**: the structured `required_skills`/`preferred_skills` versus keyword-scraping of the JD markdown (`embedder.py:88-106`). The assessment prompt receives both the description and the lists.
9. **spaCy model loaded twice** (`preprocessor.py:7`, `ner.py:5`).
10. `PROMPT_VERSION` defined twice (`assessment-service/app/config.py:46`, `prompts.py:4`).
11. Two venvs in `nlp-engine/` (`venv`, `.venv`).
12. Two "resume text" notions: the NLP has the full text internally, but only `raw_text_preview` (300 characters) is persisted and reused, so the full text is never available to later stages.

No scoring logic is duplicated *between* the Python services. Composite aggregation exists only in the backend.

## 5. Dead code and hardcoded values
Dead or unused [READ]:
- `__main__` test blocks referring to a non-existent `sample_resume.pdf`: `extractor.py:38-44`, `preprocessor.py:43-67`, `ner.py:586-624`.
- `noun_chunks` parameter, deleted unused (`embedder.py:123`); `get_embedding` (`embedder.py:21-23`) has no caller [READ, grep within the service].
- `python-dotenv` in NLP requirements, never imported.
- `EvaluationResult` / `QuestionResult` schemas (`assessment-service/app/schemas.py:97-113`) are never applied to the output (AUDIT 3.6 agrees).
- `prompts.PROMPT_VERSION` (`prompts.py:4`).
- `"certifications"` and the `summary`/`achievements` section aliases (`ner.py:210-222`) are parsed but never output.
- `ASSESSMENT_IMPLEMENTATION_PLAN.md` is a stale plan (it says OpenRouter only, port 8001, grading out of scope).

Hardcoded values [READ]:
- NLP: skill keyword list (`ner.py:7-55`), aliases (`:59-125`), section headings (`:190-223`), action verbs (`:233-242`), education regex (`:255-261`), weights 0.60/0.40 and 0.65/0.35, match thresholds (`embedder.py:68-85`), 24 evidence lines, 8000-character cap, embedding size 384, model names `en_core_web_sm` and `all-MiniLM-L6-v2`, preview 300 characters (`main.py:87`), tokens 20, noun chunks 10.
- github-evidence: API version `2022-11-28`, `User-Agent patina-github-evidence/1`, page size 100, `MAX_COMMIT_PAGES 5`, retry jitter, secondary wait 1 s (`github_client.py:23-29`), weights and saturation points 200/26/5 (`scoring.py:23-27`), window 365 days, 52 weeks (`metrics.py:12-13`), defaults in `config.py:47-54`.
- assessment: Gemini and OpenRouter base URLs and default model ids (`config.py:10-31`), 20 questions = 10 MCQ + 10 short (`prompts.py:36-38`, `validators.py:44-70`), "easy to moderate", temperature 0.3, truncation caps, timeout 60 s, 2 retries. Backend: 5 attempts, 300 s / 120 s timeouts.
- Credentials: **none hardcoded in the three services** [READ]. `.env.example` files contain placeholders only (`your_gemini_api_key`, etc.). `github-evidence/.env` holds a real-looking `GITHUB_TOKEN` (gitignored; value not opened). `tools/record_github.py:36` refuses to write `ghp_`/`github_pat_` text into recordings.
- Sample data: `tests/github/recordings/` (octocat + synthetic accounts) and `tests/backend/fixtures/github-evidence-example-mokafor.json` are test-only and clearly labelled. No sample or mock data is served by any runtime path [READ].

## 6. Docs contradicted by code
- `ARCHITECTURE.md:92` says assessment-service is the "OpenAI SDK against OpenRouter … holds the OpenRouter key" and cites `config.py:31-32` for HOST/PORT. The code makes **Gemini primary** with OpenRouter as fallback (`llm_client.py:62-68`, commit `7fa7d1b`), and HOST/PORT are at `config.py:43-44`.
- `assessment-service/README.md:12-14,21,41,162-171,178,283-285` says "not yet wired into the backend", "OpenRouter" only, "No tests yet", "`tests/` is empty". The backend calls the service (`backend/Services/assessmentService.js`), Gemini is primary, tests exist under `tests/assessment/`, and `assessment-service/tests/` does not exist. README §10.4 (`:275-276`) has broken paths (`assessment-servicequirements-dev.txt`, `testsun-suite.ps1`).
- `assessment-service/ASSESSMENT_IMPLEMENTATION_PLAN.md:31,366-367` says automated grading is not in the first milestone and the port is 8001. The code grades (`evaluator.py`) and binds 8002.
- `STEPS_TO_RUN_APP.md:88` uses `assessment-service\venv\…`, but only `.venv` exists.
- `AUDIT.md` row 3.1 says "`include_github` defaults to false and is never set". The backend now does set it (`assessment.controller.js:253-280`). Because of the missing `contact` select it is still always false in practice, so the row's conclusion holds but its evidence is stale.
- `CODE_MAP.md:150` lists the NLP dependencies but not `numpy`; minor.

---

## Top risks for the rebuild (ordered by how badly they would hurt a live demo or a correctness review)
1. **Assessment generation will 502 on a fresh start**: no `GEMINI_API_KEY` or `OPENROUTER_API_KEY` in any `.env` on disk, unverifiable default model ids (`gemini-3.8-flash`), 2-4 minute free-tier latency (backend comment), and a run doc pointing at a non-existent venv. This is the most likely live-demo failure.
2. **No anti-cheating (GR-1)**: no time limit, no proctoring, correct answers shown after each attempt, 5 retries with the latest counted, and a prompt-injectable short-answer grader. A reviewer will find all of this in minutes.
3. **The LLM sees only the first 300 characters of the resume** (`raw_text_preview`). "Candidate-specific" questions are effectively JD- and skill-list-based. **GitHub-based questions can never occur** because `contact` is not selected.
4. **No OCR (GF-2)**, and scanned or image resumes return **200 "success" with a 0.0 "Poor Match"**, a fabricated result rather than an "unreadable" signal.
5. **Support and maintenance candidates are structurally under-scored (GF-3)**: the closed tech-keyword list misses ServiceNow, Jira, ITIL, Nagios, Windows Server and Active Directory, even when the job lists them (f3 fixture verified). On GitHub, owner-only repos plus a 365-day window make an inactive or organisation-only account score an *available* 0.0, which is worse than linking no GitHub.
6. **GitHub identity is unverified**: any candidate can put a famous developer's `github.com/<login>` in the resume and receive their evidence. There is no OAuth (AUDIT 2.2).
7. **A grading-LLM outage silently becomes 0 points** with "Not answered." feedback, is persisted as a completed attempt, and is folded into the credibility score.
8. **Skill-extraction false positives inflate scores**: `node.js` → `javascript`, `Java Script` → `java`, English words (express, spring, oracle, apache, rust), "github" as a skill, any "API" → "rest api". C, Go and R are never detected. The skill-coverage numbers on the dashboard are therefore unreliable.
9. **Assessment core logic is untested** (generator, validator, evaluator, prompts). NLP tests check shape only. Only github-evidence has real behavioural tests.
10. **Certificates (GF-1) are not extracted at all**, and LinkedIn is only a regex-captured URL. The NLP `/parse` also blocks its event loop (`async def` with synchronous work) and returns an uncaught 500 for `.doc` and image uploads.
