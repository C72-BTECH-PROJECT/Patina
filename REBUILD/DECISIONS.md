# Rebuild decisions

Status: **APPROVED by Anthony at Checkpoint 2, 2026-11-12, with the conditions and edits recorded in §0.** Written 2026-11-12 by the lead.
This file overrides older design notes in other docs where they conflict.

Evidence tags point into `REBUILD/inventory/`: `[BE §n]` services.backend.md, `[FE §n]` services.frontend.md, `[PY §n]` services.python.md, `[BL-nn]` baseline.md, `[SvR]` scope_vs_reality.md (F/B/P numbers are its §4 list of 48 fabricated or misleading outputs), `[PS]` promised_scope.md, `[docs §n]` docs.md, `[br]` branches.md.

Verdicts: **KEEP** (leave as is), **FIX** (same design, corrected), **REMOVE**, **REPLACE** (different design).

## 0. What needs your explicit yes

These are the decisions that delete a feature or a file, or change auth. Everything else below follows from Checkpoint 1.

| # | Decision | Section |
|---|---|---|
| Y1 | Remove the public `POST /api/analyze` route and the unreachable `Processing.jsx` page. Scoring runs on apply instead, plus a "score this application again" endpoint. | §4.1 |
| Y2 | Remove `GET /api/candidates` (score-centric list) and merge `GET /api/recruiter/applicants` into one applications API. One recruiter list. | §8.2 |
| Y3 | Remove the OpenRouter fallback. Gemini is the only LLM provider. | §6.1 |
| Y4 | Auth changes: a cheap session-check endpoint for the gateway pre-check; session id regenerated on login; `SESSION_SECRET` must be at least 32 characters or core refuses to start; exact-match username lookup; the login limiter counts failed attempts only. | §2 |
| Y5 | Assessment policy: one attempt per application, 15-minute server-enforced limit, 10 questions served from a generated pool of 20, only for jobs the candidate applied to, correct answers never shown to the candidate. | §6.2 |
| Y6 | Delete dead frontend files (`Card`, `Input`, `Logo`, `Skeleton` components, `AllCandidates.jsx` once the single view replaces it) and the unused dependencies `@tailwindcss/vite` (frontend) and `cors` (backend). | §8.1 |
| Y7 | The docs plan in §11: archive 30+ files into `Docs/archive/`, retire root `ROADMAP.md`, and change `tests/docs/check-trackers.mjs` in the same card. | §11 |
| Y8 | The stretch order in §12 (OCR first). | §12 |

**No database schema change is needed for list A.** Every list-A feature is designed onto the existing tables. No migration file is planned before Nov 18.

### Checkpoint 2 outcome (Anthony, 2026-11-12)

| # | Outcome | What changed in this file |
|---|---|---|
| Y1 | **Approved on a condition:** a scoring failure must still save the application, with a pending or failed status and a way to retry. | §4.1 apply row rewritten to state this as a requirement |
| Y2 | Approved | — |
| Y3 | Approved | — |
| Y4 | Approved | — |
| Y5 | **Approved with an addition:** the job's recruiter or an admin can reset a candidate's assessment attempt. | §6.2 gains the reset rule |
| Y6 | Approved | — |
| Y7 | Approved | — |
| Y8 | **Edited:** GitHub OAuth first, then OCR, flags, certificates, PFQS. | §12 reordered (card ids unchanged) |
| Teammate tasks | TM-1 to TM-5 approved. TM-1 must ship with a written labelling guide and use only public or consented resumes. | §4.3 test-set rule; the guide is `eval/LABELLING_GUIDE.md` |

`CUT.md` and `TASKS.md` were approved by the same go-ahead.

### Amendments after Checkpoint 2

| # | Date | Amendment (Anthony) | Where it lands |
|---|---|---|---|
| A1 | 2026-11-13 | **No live generation on the demo path.** The question pool is generated and stored in the background right after apply. The candidate sees a "preparing" state if it is not ready, and every candidate request answers at once (no request waits on the LLM; the former worst case was about 210 s). Consequences, with no schema change: a prepared pool is an `assessments` row with status `generated` and `answers` null; the 15-minute clock starts when the candidate presses Start and is stored as `started_at` inside `answers` (this replaces "start time = `assessments.created_at`" wherever it is written, including §6.2's "started when the questions are issued": issued now means at Start); in-flight and failed preparation state lives in core memory only and is never presented as a stored fact. | `TASKS.md` R-11, R-12, R-13, R-17, R-19 |
| A2 | 2026-11-13 | `GEMINI_MODELS` in `assessment-service/.env` stays (owner's choice). A verifier listed the key's models on both the native and the OpenAI-compatible endpoint: the code default (`gemini-3.5-flash`, `gemini-3.1-flash-lite`) and `gemini-3.5-flash-lite`, `gemini-3.8-flash` are all listed, as are all three configured ids. The code default was left unchanged. Listed is not the same as callable; no generation call was made in that check. | `LOG.md` |
| A3 | 2026-11-13 | O-5 answered: email confirmation is on; the demo GitHub account is `anthonyjennis`. | `TASKS.md` O-5, R-19, TM-4 |
| A4 | 2026-11-13 | **Scoring weights changed** after the manual test: resume 0.20 fixed, GitHub 0.35, assessment 0.45; a verification state on every score; GitHub capped so that the ceiling is 55 until the assessment is taken (option b); "Awaiting assessment" as the recruiter's primary state; a weights version on every stored score; a "sources disagree" flag inside R-28 if it fits. | §7.1 (W1 to W7); `TASKS.md` R-27, R-28 |
| A5 | 2026-11-13 | **Re-plan approved.** Batch 7 (R-27 to R-33, plus R-37) runs before the docs batch. S-1 OCR is dropped before Nov 18; S-2, S-4, S-5 and the job-description upload go to the roadmap. Teammates do documentation only. TM-1: Anthony labels alone, from an AI first pass made from the resume text only, and the results record the labels as "AI-drafted and human-checked, one labeller". TM-2: one full rehearsal on Nov 17 and a short run on the morning of the demo. TM-4: a demo set of three candidates that shows the weighting: Anthony's real resume with `anthonyjennis` (verified), a synthetic keyword-stuffed resume with no GitHub (low, unverified), a synthetic support-role resume with no GitHub (partly verified after the assessment). The two synthetic ones contain no real person's data; the real one is never committed. | `TASKS.md` re-plan, R-30, teammate table; §4.3 (one labeller replaces "two teammates and a third") |
| A6 | 2026-11-13 | **Issue triage.** Every open issue is NOW, BATCH or CLOSED; an issue closes only when its fix is verified, not when a card is assigned. The six low-severity security items stay BATCH and are fixed together under a "Security and privacy" heading in the roadmap; "account deletion leaves storage files behind" is a Track B privacy issue. | `CLAUDE.md` "Issue triage"; `ISSUES.md`; `TASKS.md` H-1, R-36, R-37 |
| A7 | 2026-11-13 | **Owner actions reported done by Anthony:** the test accounts are recreated (O-8); the GitHub OAuth app exists and its two values are in `backend/.env` (O-6; this is also his yes to S-3, which changes how a GitHub account is linked); custom SMTP through Gmail is configured in Supabase (O-7). None of the three was checked by an agent except O-8, whose check is the e2e run recorded in `LOG.md`. | `TASKS.md` O-6, O-7, O-8 |

## 1. Architecture and gateway (GR-2)

**The one target architecture, as built and as it will be presented:**

```
browser (React, :3000)
   |  every call goes to one origin
   v
gateway :5000        single entry point: CORS, rate limits, session pre-check,
   |                 security headers, aggregated health
   v
core :5001           loopback only. Owns the database, auth and sessions,
   |                 orchestration, composite scoring and explanation
   +--> nlp-engine :8000          parsing + parsing sub-score      (stateless, loopback, no DB)
   +--> github-evidence :8001     GitHub metrics + sub-score       (stateless, loopback, no DB)
   +--> assessment-service :8002  LLM generation + grading         (stateless, loopback, no DB)
   +--> Supabase                  Postgres, Auth, Storage (hosted) (reached only by core)
```

Where the SRS diagrams disagree `[PS C-2]`, this is the ruling: LLM calls live only in assessment-service; each Python service computes its own sub-score; the composite score and the explanation live in core.

| Choice | Verdict | Reason | Evidence | Risk |
|---|---|---|---|---|
| Gateway as a separate process (Aditya's commits, I-0080) | KEEP | It works and is the browser's only origin. | `[BL-07]`, `[BE §3]` | Low |
| Core listens on all interfaces | FIX | Bind `127.0.0.1` so the gateway is the only way in. | `[BL-23]` | Low. Tests that call :5001 run on the same machine. |
| Core as one orchestrating service that owns all data | KEEP until after Nov 18 | Checkpoint 1: no decomposition now. Splitting it is a roadmap item. | `[BE §3]` | It is a monolith; we say so. |
| Python services protected by start flags only | FIX | One start script is the only supported way to run them, always on loopback. Service-to-service tokens go to the roadmap. | `[BE §3]`, `[PY §3.1]` | Low on one machine |
| No one-command start; three run docs with three port stories | REPLACE | `scripts/start-all.ps1` and `stop-all.ps1`; one run guide in `README.md`. | `[BE]` top risk 1 | Low |
| Gateway session pre-check calls core `/api/auth/me` (2 Supabase queries, 2 s, fail-closed 503) | FIX | See §2. | `[BE §3]` | — |
| Gateway has no error handler, proxy timeout or security headers | FIX | Add all three. | `[BE §10]` | Low |

**What we claim to the evaluators, and what we do not.** We claim a gateway, an orchestrating core and three independently runnable, stateless services with HTTP contracts and failure isolation (a GitHub outage degrades the score; it does not break it). We do not claim per-service data stores, independent scaling of core (sessions are in process memory), or that the gateway routes to the Python services. The SRS claim (PS-054 to PS-057, PS-061) is therefore **partly met**, and `ARCHITECTURE.md` will say that in those words.

**MongoDB vs Supabase (PS-058), the justification Anthony presents:**

1. The data is relational. Users, jobs, applications, resumes, scores and assessments are linked by foreign keys, with rules such as "one application per candidate per job" and fixed status values. Postgres enforces these in the database. In MongoDB the application would have to.
2. The semi-structured parts (parsed entities, sub-scores, the explanation) are stored as JSONB columns, so we keep document flexibility where the data needs it.
3. Supabase supplies three things the SRS would otherwise have had us build and operate: authentication (password hashing, email confirmation, reset), private file storage for resumes with short-lived signed links, and row-level security policies on all 8 tables.
4. The schema is 17 versioned SQL migrations in the repo, so it is reproducible and reviewable.
5. Honest limits: the application reaches the database through core with a service key, so access control is enforced in core, and row-level security is a second layer against direct access `[BE §5]`. The "Repository" entity of the SRS is stored as a snapshot inside the score record, not as its own table.
6. Cost of the deviation: the stack is Postgres/Express/React/Node, not "MERN". It is standard Postgres, so it is not tied to the vendor.

## 2. Auth and sessions

| Choice | Verdict | Reason | Evidence | Risk |
|---|---|---|---|---|
| Password login through Supabase Auth, server-side Express session cookie | KEEP | Works and is verified. OAuth 2.0 login (0.4) is not built; shown as such. | `[SvR 0.4]` | Promise not met; stated |
| Sessions in process memory | KEEP until after Nov 18 | Fine for one instance. A core restart logs everyone out; the demo runbook says so. | `[BE §5]` | Demo: do not restart core mid-demo |
| Gateway pre-check via `/api/auth/me` | FIX | New `GET /api/auth/session` in core answers from the in-memory session only (no Supabase call). The gateway uses it. Core still does the full check, including suspension, on the real request. Removes the "slow Supabase → 503 for everything" failure. | `[BE §3]`, top risk 4 | Low; core remains the enforcement point |
| Login + signup share 20 attempts per 15 min per IP | FIX | Count failed attempts only (`skipSuccessfulRequests`), match the path case-insensitively, keep the limit configurable. One laptop switching demo accounts can no longer lock itself out. | `gateway/limits.js:11-43`, `[BE §10]` | Low |
| Username lookup with `ilike` (`_` and `%` are wildcards) | FIX | Exact match on the lowercased username. | `[BE §5]` | Low |
| No `session.regenerate()` on login | FIX | Standard session-fixation fix. | `[BE §5]` | Low |
| 6-character `SESSION_SECRET` and a hardcoded fallback | FIX | Require ≥32 characters; no fallback. Anthony sets the new value. | `[SvR 0.5]` | Core will not start until the secret is set |
| Usernames logged on every login attempt | REMOVE | Personal data in logs. | `[BE §10]` | None |
| Anyone can register as a recruiter | KEEP, stated | Recruiter verification is a roadmap item. | `[BE §5]` | Stated limitation |
| Role cached in the session until next login | KEEP | Roadmap. | `[BE §5]` | Low |

## 3. Data model and Supabase

| Choice | Verdict | Reason | Evidence | Risk |
|---|---|---|---|---|
| Supabase Postgres, 8 tables, 17 migrations (all applied, per Anthony 12 Nov) | KEEP | No drift between code and migrations. | `[BE §6]` | — |
| Evaluate overwrites the latest `scores` row in place | FIX | Insert a new row every time the score changes; the newest row is the score of record and the older rows are its history. No schema change. | `[SvR B13]`, `[BE §7]` | Readers must always take the newest row |
| Two NLP call-and-persist pipelines, two storage paths | REPLACE | One `resumePipeline` service used by upload, apply and assessment. | `[PY §4]` #3 | Medium: central refactor |
| Only a 300-character text preview is stored | KEEP | The full text is re-derived from the stored file when needed and never persisted (less personal data at rest). | `[PY §3.3]` | One extra parse per generation (under 1 s warm) |
| Repository as a snapshot inside `scores.subscores` | KEEP, stated | A table is a roadmap item. | `[SvR 0.2]` | Stated |
| Agents and live data | — | Agents never apply migrations and never delete live rows. Every verifier run that writes to Supabase ends with a list of leftover rows; Anthony runs the sweep. | Checkpoint 1 | — |

## 4. Resume parsing (nlp-engine) and the pipeline through core

### 4.1 Pipeline

| Choice | Verdict | Reason | Evidence | Risk |
|---|---|---|---|---|
| Upload only stores the file | FIX | Upload parses the file and shows the candidate what was read (skills, experience, education, links). | `[SvR §3]` hop 3 | Low |
| Apply only inserts an application | FIX | Apply saves the application first, then runs the existing scoring chain on the stored resume in the same request. **Condition of Y1:** a scoring failure never undoes or blocks the application. The apply response reports `scoring.status` as `scored` or `failed` with a reason; afterwards an application with no score reads as `pending` ("Not scored yet") in the candidate and recruiter views, and both the candidate and the job's recruiter can retry through `POST /api/applications/:id/score`. The state is derived from whether a score row exists, so no schema change is needed. The failure reason is returned by apply and by each retry but is not stored; storing it would need a new column and is not planned. | `[SvR 5.14]` | Apply takes a few seconds (GitHub has an 8 s budget) |
| Public `POST /api/analyze` | REMOVE (Y1) | No UI caller; lets a candidate create a score for a job they never applied to, which then exposes their contact data to that recruiter. Replaced by score-on-apply and `POST /api/applications/:id/score`. Its live tests move to the new endpoint. | `[BE §5]`, `[SvR A4]` | Medium: tests must move in the same card |
| Missing NLP similarity → "available" parsing score of 0 | FIX | Parsing becomes unavailable with a reason; weights redistribute. | `[SvR B1]` | Low |
| NLP call from core: no timeout, raw error text echoed | FIX | 30 s timeout through the shared internal HTTP client, request id forwarded, fixed error message. | `[BE §4]` O1 | Low |
| Parser version hardcoded in core | FIX | The service reports its own version. | `[SvR B13]` | Low |

### 4.2 Parser

| Choice | Verdict | Reason | Evidence | Risk |
|---|---|---|---|---|
| pdfplumber + spaCy + keyword/alias list + MiniLM similarity | KEEP | It is what exists and it is deterministic. It is **not** the promised custom-trained NER (1.5); shown honestly as a different technique. | `[PY §1.3]` | Promise not met; stated |
| Image-only or empty file → 200 "success", 0.0 "Poor Match" | FIX | Explicit `422 unreadable_document` with a reason. Upload shows "We can't read this file" and does not keep it. `.doc` and images → 415, not 500. | `[BL-32]`, `[SvR P1]` | Low |
| OCR | Not on list A | Stretch S-1; otherwise list B with the explicit error as the honest state. | `[SvR 1.2]` | The guide called OCR a must |
| Skill false positives ("github", express/spring/oracle as English words, `node.js`→javascript) and missing support tools (ServiceNow, Jira, ITIL, Nagios, Active Directory, Windows Server) | FIX | Tighten the rules and add the support vocabulary. Measured before and after on the evaluation set (§4.3). | `[SvR P3, P4, 1.17]` | Snapshots change; reviewed in the card |
| `jd` is a required field of `/parse` | FIX | Optional, so upload can parse without a job. No similarity is reported when it is absent. | `nlp-engine/app/main.py:56` | Low |
| Lemmatisation computed but not used (1.4), layers not chained (1.7), two-column layout (1.3), project extraction returns nothing (PS-010) | KEEP, stated | List B. The LLM receives the full resume text, so assessment questions can still refer to projects. | `[SvR 1.3, 1.4, 1.7]` | Stated |

### 4.3 The one measured evaluation

- **What:** parsing quality on a labelled set. **Unit:** one (resume, skill) pair. A skill is any technology, tool, language, framework or platform named in the resume, lower-cased and mapped through an alias table fixed before measuring.
- **Test set:** 30 IT resumes (at least 8 support/operations roles), each labelled by two teammates with disagreements settled by a third. **Only public or consented resumes are used:** files from the public Kaggle resume dataset the SRS names, or a resume whose owner has agreed in writing. Labels are human-checked; an AI first pass is allowed, unverified AI labels are not, and a consented resume is never pasted into an AI tool unless its owner agreed to that too. The rules the labellers follow are in `eval/LABELLING_GUIDE.md`. Resume files and label files stay out of git; the guide, the alias table, the script and the aggregate results are committed.
- **Metrics:** micro and macro precision, recall and F1 for skills; exact-match accuracy for email, GitHub URL and LinkedIn URL; parse time per resume (median and maximum).
- **Reported:** the numbers before and after the vocabulary fix, with the set size, in `eval/RESULTS.md`. We report whatever the numbers are. The SRS targets (≥85 %, F1 ≥ 0.80, ≤10 s) are compared against them, not assumed.
- **Possible extra, unverified:** the Hugging Face "Annotated NER PDF Resumes" set may already carry skill annotations. If its schema fits, the same script can report a second number on a larger sample. This is checked inside card R-20, not assumed.

## 5. GitHub evidence

| Choice | Verdict | Reason | Evidence | Risk |
|---|---|---|---|---|
| github-evidence service, contract v1, renormalising components | KEEP | The most solid service; 80 tests pass. | `[BL-12]`, `[PY §2]` | — |
| Account with repos but no commits in the window scores an available 0.0 | FIX | With repositories but no commits in the window, the whole GitHub sub-score is unavailable (`no_recent_public_activity`); the measured evidence (claims, languages, repositories) is still returned and shown. Rule under test: linking an inactive account gives exactly the same composite as linking none. (Refined by the lead during R-06, 2026-11-12: the first design left claim matching as the only scored component, which either inflated the sub-score to 1.0 or dropped the composite below "no account" when a claimed language was missing.) | `[SvR P7]` | Low |
| GitHub is optional; weights redistribute; score marked evidence-limited | KEEP | Works by API today; becomes visible through the UI with score-on-apply. | `[E11]` in `[SvR]` | — |
| Ownership of the linked account is not verified | Not on list A | The login comes from the resume, so a candidate can name someone else's account. On list A the explanation and the recruiter view carry a visible "ownership not verified" note. Verifying through a GitHub OAuth link is stretch S-3. If S-3 is not done, the demo states the limitation. | `[PY §2.3]` | Works against the anti-fraud claim; stated |
| `/health` reports `token_configured: true` as a constant | FIX | Report the real state. | `[SvR P6]` | Low |
| A positive live fetch was never run | FIX | The end-to-end check uses a demo resume that links a real, consenting account (Anthony's unless he names another). | `[BL-31]` | Depends on the GitHub API at demo time; a failure degrades honestly |
| Code-quality analysis: 8DFS, CodeQL/SonarQube, originality | Not built | List C. | `[SvR 2.6, PS-028, X-2]` | Stated |

## 6. LLM assessment and anti-cheating (GR-1)

### 6.1 Provider and generation

| Choice | Verdict | Reason | Evidence | Risk |
|---|---|---|---|---|
| Gemini through the OpenAI-compatible endpoint | KEEP, provider of record | Checkpoint 1. Anthony adds the key; nobody reads or prints it. | `[PY §3.3]` | Never observed working yet |
| OpenRouter fallback | REMOVE (Y3) | No key exists, so it can never be verified; it doubles the client code, hides the real Gemini error, and pushes the retry budget past core's timeout. Fallback is a list of Gemini models instead. | `[SvR P10]`, `[PY §3.3]` | If Gemini is down, generation fails with a clear message |
| Default model ids of unknown existence | FIX | The card lists the models the key can use and sets confirmed ids. | `[SvR PS-060]` | Needs the key first |
| Worst-case retry time exceeds core's 300 s timeout | FIX | Total budget capped below 240 s. | `[SvR 3.11]` | Low |
| LLM sees only the first 300 resume characters; GitHub data never included | FIX | Full parsed text (re-derived, capped) and the GitHub snapshot are passed in. | `[SvR R2]` | Low |
| Health says "healthy" with no key | FIX | Health reports whether an LLM key is configured (a boolean, never the key). | `[SvR P9]` | Low |
| Single prompt, fixed "easy to moderate" difficulty (no PFQS, 3.3/3.4) | KEEP, stated | Stretch S-5, else list B. | `[SvR 3.3]` | Named technique not built |
| Core logic has no tests | FIX | Generator, validator and evaluator get tests with a fake LLM. | `[PY §3.7]` | — |

### 6.2 Anti-cheating design (this section is the written GR-1 design)

Goal: the assessment result should reflect what the candidate knows, within the limits of an unproctored online test. Each threat has a control; what is not controlled is said plainly.

| Threat | Control | Where enforced | By Nov 18 |
|---|---|---|---|
| Learning the answers from one attempt and retaking | One attempt per application. The first completed attempt is the score of record. Correct options, ideal answers and explanations are never sent to the candidate; they see the total, a per-skill summary and right/wrong per question. The recruiter sees the full per-question detail. | core | A |
| Unlimited time to look things up | 15-minute limit, started when the questions are issued and checked on the server against the stored start time, with a 30 s grace period. The browser timer is display only. Late answers are not accepted: the server grades what was saved before the deadline. | core | A |
| Losing work on a reload, or reloading to restart the clock | Answers are saved to the server as the candidate works. A reload restores them and the remaining time. | core + frontend | A |
| Sharing questions between candidates | Questions are generated per candidate from their own resume and the job. The server serves a random 10 (6 multiple-choice, 4 short) of the 20 generated, in random order with shuffled options. The other 10 are never sent. | assessment-service | A |
| Reading the answer key | The key is stored in a table no browser role can read and is never in a response to the candidate. | core + DB (exists) | A (keep) |
| Steering the grader with instructions written in an answer | The grading prompt marks candidate text as untrusted data; output is validated against a schema; grades are limited to 0, 0.5 or 1. | assessment-service | A |
| A grading outage turning into a score | A failed grading call is an error, not a zero. The attempt stays "submitted, grading pending", the answers stay saved, and grading can be retried. | assessment-service + core | A |
| Taking the test for a job never applied to | Generation requires an application for that job. | core | A |
| Someone else taking the test; a second device; AI-written answers; tab switching | **Not controlled.** Proctoring, identity checks and AI-answer detection are out of scope before Nov 18 and are roadmap Track B. The recruiter view labels the result "unproctored online assessment". | — | C |

Settings (all configurable, defaults shown): `ASSESSMENT_MAX_ATTEMPTS=1`, `ASSESSMENT_TIME_LIMIT_MINUTES=15`, served questions 6 + 4.

**Resetting an attempt (added at Checkpoint 2).** One attempt is strict, so there is a controlled way out for a genuine problem such as a lost connection.
- Who: the recruiter who owns the job, or an admin. Never the candidate.
- What: the attempt (open or completed) is voided with a required reason. A voided attempt stays in the database with who voided it, when and why. It no longer counts toward the attempt limit or the score. The candidate is notified and can take a new assessment.
- Score: a new score row is written without the voided result, so the history shows the change.
- Storage: no schema change. The void record is kept inside the attempt's `evaluation` JSON and the row is closed. A dedicated column and a recruiter audit log (X-1) are roadmap items.
- UI: a reset button with a reason field in the recruiter drill-down. For admins the reset is available through the API only before Nov 18, because the admin page has no applications view; this is a known gap.
- The recruiter view shows that an attempt was reset and why, so a reset cannot quietly hide a poor result.

**Assessment and the score.** A graded attempt adds the assessment sub-score to the application's score as a new score row. If no score exists yet (scoring failed at apply), core runs the pipeline then; if parsing is still unavailable the composite comes from the assessment alone, marked evidence-limited. That is the GF-4 fallback.

## 7. Scoring and explainability

| Choice | Verdict | Reason | Evidence | Risk |
|---|---|---|---|---|
| Composite = weighted mean of available sub-scores, base weights 0.40 parsing / 0.35 GitHub / 0.25 assessment, renormalised over what is available | **REPLACED by §7.1 on 2026-11-13** (was KEEP) | Unit-tested and seen live. The weights are a design choice with no calibration behind them; the UI and the docs say "provisional". | `[BE §7]`, `[BL-15]` | Evaluators may ask why these weights |
| Stored explanation: factors, weights, evidence, per-skill table | KEEP | Real and stored today; never yet rendered with data. | `[SvR 4.5]` | Render check is in the UI card |
| Explanation carries only assessment totals | FIX | Per-question outcomes (skill, result, rubric points) are available to the recruiter drill-down. | `[SvR 3.12]` | Low |
| GitHub ownership | FIX | The explanation states the account came from the resume and is not verified. | §5 | — |
| Score colour bands hardcoded in five frontend files | REPLACE | Core emits one band with the composite; the frontend only renders it. The thresholds (80 / 60) are presentation labels, documented as uncalibrated. | `[SvR F25]` | Low |
| Inconsistency flags always "not available" (4.6) | KEEP honest panel | Building them is stretch S-2. | `[SvR 4.6]` | Promise not met unless S-2 lands |
| Support-role weighting (4.8), LinkedIn and certificate validation (4.10) | Not built | No such data exists in any row yet, so no weights or logic are invented for it. List C. | `[SvR 4.8, 4.10]` | Stated |

### 7.1 Weights and the verification rule (W1 to W7)

Status: **W1 to W3 APPROVED by Anthony on 2026-11-13, with option (b) for the open point in W2 and the additions W4 to W6 below. W7's threshold is the lead's proposal and is built as a configurable default until Anthony confirms it.** Written after his manual test (`MANUAL_TEST_2026-11-13.md`, MUST 1 and MUST 2). This section replaces the first row of the §7 table. Cards: `TASKS.md` R-27 (W1 to W5), R-28 (skill table, W7).

**As approved, in one place (this paragraph wins over the proposal text below where they differ):**
- Base weights: resume 0.20, GitHub 0.35, assessment 0.45. The resume's 0.20 never grows.
- Both independent sources available: 0.20 / 0.35 / 0.45.
- Assessment available, GitHub not: assessment 0.80. (GitHub is optional, GF-4.)
- **GitHub available, assessment not yet taken (option b): GitHub stays at 0.35 and the assessment's 0.45 is unearned. The ceiling is 55, which is the low band.** GitHub never absorbs the assessment's share.
- Neither: 0.20 × resume sub-score, ceiling 20.
- **Partly-verified cap (Anthony, 2026-11-14; weights version `w3-2026-11-14`):** a partly verified score (exactly one of GitHub and the assessment) is capped at 79, one point below the high band, so the high band needs two independent sources. Only the assessment-only case can reach it (GitHub alone is held at 55). The stored explanation keeps the uncapped composite in `partly_verified_cap` and the summary says why; the support worked case below becomes 79, medium. Code: `backend/Services/explainability.js` `partlyVerifiedCap`; test `Partly-verified cap: one independent source never reaches the high band; two can`.

| # | Addition (Anthony, 2026-11-13) | How it is built |
|---|---|---|
| W4 | Until a candidate's assessment is completed or has expired, recruiter views show **"Awaiting assessment"** as the primary state, with the partial score secondary. A bare low score is never shown for an applicant who has not been assessed. | Core emits `score_state: "awaiting_assessment"` while the assessment state is `not_prepared`, `preparing`, `unavailable`, `ready`, `in_progress` or `grading_pending`. The recruiter table and drill-down lead with the state; the composite appears smaller, labelled "partial score, résumé" or "partial score, résumé and GitHub". Ranking puts awaiting applicants in their own group below scored ones, so a partial number is never compared with a full one. A completed, expired-and-graded or used-up attempt ends the state. |
| W5 | Every stored score records the **weights version** it was computed with. | `explanation.weights_version` (first value `w2-2026-11-13`), beside the base weights already stored. No schema change. A row with no version is shown as "v1 (0.40 / 0.35 / 0.25)". The version string changes whenever a default weight or a rule of this section changes. |
| W6 | A **"sources disagree"** flag when GitHub evidence and the assessment differ sharply on the same skills, if it fits inside R-28 without delaying it; otherwise roadmap. | It fits: R-28 already builds the per-skill marks it needs. It is the last step of R-28 and is cut to the roadmap if R-28's own checks are not green first. Rule in W7. |
| W7 | Threshold for W6 (**proposed by the lead**). | Take the skills that GitHub marks `evidenced` and that the assessment asked at least one question on. If those questions carry **at least 2 points in total** and the candidate earned **25 % or less** of them, raise "Sources disagree: GitHub shows work in X and Y; the assessment on those skills earned n of m points." One flag per score, listing the skills. It never changes the score. It is not raised when either source is unavailable, or on fewer than 2 points (one question is too little to call a disagreement). The opposite case (assessment strong, nothing on GitHub) is not a disagreement: public code is optional. Both numbers are settings (`FLAG_DISAGREE_MIN_POINTS=2`, `FLAG_DISAGREE_MAX_SHARE=0.25`). |

**Lead ruling, 2026-11-13, for Anthony to overturn if he disagrees (found while building R-27):** when the résumé could not be measured and there is no assessment, GitHub gets only its own 0.35 (ceiling 35); it does not take the résumé's 0.20. This follows the rule that no source absorbs another's share before the assessment.

**The proposal as written on 2026-11-13 (kept for the reasoning):**

**What is wrong today (read in the code).** The resume sub-score is the parser's resume-to-job similarity (`explainability.js:225-340`). `aggregate` renormalises the base weights over whatever is available (`explainability.js:664-678`), so with no GitHub and no assessment the resume carries weight 1.0 and a resume that repeats the job's words scores in the high band. In the skill table a required skill that only the resume lists is counted as one confirming source and labelled "Evidenced" (`explainability.js:724`, `ScoreBreakdown.jsx:34-38`). Both are keyword matching presented as evidence.

**Principle (Anthony).** The resume decides what to verify. GitHub and the assessment decide how credible the candidate is.

| # | Proposal | Reason |
|---|---|---|
| W1 | Base weights: **resume 0.20, GitHub 0.35, assessment 0.45** (today 0.40 / 0.35 / 0.25). Still overridable through `CREDIBILITY_WEIGHTS`, still labelled provisional and uncalibrated. | Resume 0.20: it is self-reported, so it can only show relevance to the job, not truth; 0.20 is enough to order two equally verified candidates and too little to carry anyone. Assessment 0.45, the largest: it is the only source every candidate can produce (GitHub is optional, GF-4; support and maintenance candidates often have no public code, GF-3), it is taken under the §6.2 controls, and its questions come from the candidate's own claims. GitHub 0.35, below the assessment: it is real work over time, but ownership of the account is not verified until S-3, and public commits measure only public work. |
| W2 | **The resume's weight is fixed at 0.20 and never grows.** The other 0.80 belongs to the independent sources and is redistributed only between them, by the existing proportional logic: both available → 0.35 / 0.45; GitHub missing → assessment 0.80; assessment not yet taken → GitHub 0.80. With **no** independent source the 0.80 is not earned by anyone: composite = 0.20 × resume sub-score, so at most 20 of 100. | This is the smallest change that makes the acceptance check true. Redistribution stays for the case it was designed for (GF-4: a missing GitHub costs nothing once the assessment exists), and the one path that let a resume score 100 on its own is closed. |
| W3 | Every score carries a **verification state** beside the band: `unverified` (no independent source: "Résumé claims only. Nothing has been verified yet."), `partly_verified` (one), `verified` (both). The bands stay at 80 / 60. A stored score also records `unearned_weight` (0.80 or 0) so the explanation can say where the missing points are. | A number in the low band needs its reason next to it, or a recruiter reads "weak candidate" where the truth is "not assessed yet". This replaces the vaguer "evidence-limited" marker in the UI; the stored `evidence_limited` field stays for old rows. |

**Worked cases under W1 to W3** (resume / GitHub / assessment sub-scores on 0 to 100):

| Case | Sub-scores | Today | Proposed |
|---|---|---|---|
| Keyword-stuffed resume, no GitHub, no assessment | 95 / – / – | 95, high | **19, low, unverified** |
| Same resume, average assessment, no GitHub | 95 / – / 50 | 77.7, medium | 59, low, partly verified |
| Short resume, strong GitHub and assessment | 40 / 85 / 85 | 67, medium | **76, medium, verified** |
| Long skill list, weak GitHub and assessment | 95 / 30 / 30 | 56, low | 43, low, verified |
| Support candidate, no GitHub, strong assessment | 60 / – / 90 | 71.5, medium | 84, high, partly verified |

The two checks Anthony asked for hold: the stuffed resume lands in the lowest band and is labelled unverified, and strong GitHub plus a strong assessment (76) beats the long skill list (19 alone, 43 with weak evidence).

**Consequences to accept with the proposal.**
- Every candidate reads low and "unverified" between applying and finishing the assessment, unless a GitHub account answered. The candidate's result page then says what would verify it ("Take the assessment"). The recruiter list still ranks by composite, so unassessed applicants sort to the bottom with the label.
- The invariant "weights of the available sources sum to 1" becomes "sum to 1 when at least one independent source is available, otherwise 0.20 with 0.80 unearned". Unit tests and the end-to-end spec change in the same card.
- Scores already stored were computed with the old weights. They are not rewritten; a new row is written the next time an application is scored. No schema change: the new fields live in the existing `explanation` JSON.
- **Decided 2026-11-13: option (b).** The point as it was put to Anthony: while ownership is unverified, a candidate who names someone else's active GitHub account gets up to 0.80 of the score from it before the assessment. Options: (a) accept it and rely on the visible "ownership not verified" note until S-3 (what W2 says as written); (b) an unverified GitHub never absorbs the assessment's share, so before the assessment the ceiling is 0.20 + 0.35 = 55, low band. I recommend (b) if S-3 is not built by Nov 18 and (a) once it is; (b) is one extra condition in `aggregate`.

**Skill table (goes with W3; card R-28).** Three statuses only: **Claimed only** (the resume lists it and no independent source confirms it), **Evidenced** (GitHub or the assessment confirms it), **Not found** (the job asks for it and no source has it). The resume never counts as a confirming source. Each row shows one mark per source (Resume, GitHub, Assessment), each `confirmed`, `absent` or `unavailable`, in place of "N of 3 sources".

## 8. Frontend structure and UI

### 8.1 Structure

| Choice | Verdict | Reason | Evidence | Risk |
|---|---|---|---|---|
| Create React App | KEEP until after Nov 18 | Checkpoint 1. `CI=true npm run build` must pass. | `[BL-10]` | — |
| Three base-URL mechanisms, four credential mechanisms, a global `fetch` monkey-patch | REPLACE | One `src/lib/api.js` client: one base URL (`REACT_APP_API_BASE_URL`), credentials always included, one error shape. Every page uses it. | `[FE §3.2, 3.3]` | Medium: touches every page, so it goes first |
| API failures shown as empty lists | FIX | Every list has three distinct states: loading, empty, error. | `[SvR F17, F20, F23]` | Low |
| CSS variables used by score rings and charts are defined nowhere; `btn` and `badge` classes undefined | FIX | Define the tokens and classes once in `index.css`. | `[FE §9.2, 9.3]` | Needs a browser look |
| Dead components and dependencies | REMOVE (Y6) | Listed in `[FE §6]`. | — | Low |
| Visual redesign, Vite migration | After Nov 18 | Checkpoint 1. | — | — |

### 8.2 Screens

- **Fabricated content: REMOVE all of it** (F1 to F12, F21, F24): landing statistics, demo score, avatars and the "Connect GitHub" claim; the random "AI Suggestion" and the "3x" claim; the profile statistics and badge; the permanent unread dot and the dead search box. Where real data exists (applications per job) show it; where it does not, show nothing or an honest empty state.
- **Candidate:** Upload shows the parse result or the unreadable error. Apply shows the scoring state. The candidate dashboard becomes "My applications" (status, score state, assessment state) and replaces the static marketing page. Results is linked and is per application.
- **Recruiter: one application-centric view (REPLACE, Y2).** One API returns applications with candidate identity, status, the newest score and its band; one table component is used for "all applications" and for a single job, ranked by composite with unscored applications labelled "Not scored" and the reason. It has shortlist and reject actions (the backend route exists and already notifies the candidate) and opens the drill-down: composite → sub-scores → evidence, including assessment per-question outcomes, the evidence-limited marker and the GitHub ownership note. The candidate's name comes from their account profile, not the parsed resume; the job's location is no longer shown as the candidate's.
- **Broken items: FIX** the black-on-black and white-on-white controls, Recruiter Profile "unavailable" (role case), notifications "Mark read", the empty resend-confirmation email, "Skip verification", the admin suspension display, missing index and 404 routes.

## 9. Observability and health

| Choice | Verdict | Reason | Evidence |
|---|---|---|---|
| Core `/api/health` always says ok | FIX | Checks Supabase with a timeout and reports `ok` or `degraded`. | `[SvR B12]` |
| Gateway `/health` aggregate | KEEP + FIX | Reports each service and, for assessment, whether the LLM is configured. | `[BL-07]` |
| Logs: `console.log`, gateway logs no status or latency, NLP gets no request id | FIX | One line per request with id, status and latency at gateway and core; the request id reaches all three services. | `[BE §10]` |
| No error handler; HTML stack traces; raw Supabase and NLP messages in responses | FIX | One JSON error shape `{ error, message, requestId }`. Details go to the server log only. | `[BE §10]` V3 |
| No timeout on Supabase calls | FIX | 10 s timeout on the Supabase client; a timeout is a 503 with a plain message. | `[BE §4]` O7 |
| Uptime monitoring, load testing | Not built | List C. Not measured, and not claimed. | `[SvR 6.6, 6.7]` |

## 10. Security and privacy

| Choice | Verdict | Reason | Evidence |
|---|---|---|---|
| Secrets server-side, none in the bundle or the repo | KEEP | Verified. | `[SvR A1]` |
| Credential-shaped lines in `tests/.env.example` (I-0084) | FIX | Placeholders. Anthony checks and rotates the account. | `[br]` A2.4 |
| Upload type check by extension only | FIX | Check the file's leading bytes (PDF or DOCX zip). | `[BE §10]` |
| No security headers; `X-Powered-By` | FIX | `helmet` at the gateway; header off on both. | `[BE §10]` |
| Recruiter can see candidates who never applied | FIX | Gone with Y1 and Y2: a recruiter sees only applicants to their own jobs. | `[BE §5]` |
| Access control in core with the service key; RLS as second layer | KEEP | Stated honestly in §1. | `[BE §5]` |
| HTTPS (0.6), MFA, IP hashing, Burp testing, service-to-service tokens, recruiter verification | After Nov 18 | Roadmap Track B. The demo runs on `http://localhost`; stated. | `[SvR 0.6]` |
| Resume personal data | KEEP + state | Files in a private bucket with 60 s signed links; full text never stored; usernames removed from logs. A retention and deletion policy is Track B. | `[BE §2.1]` |

## 11. Paused branches and docs

**Branches.** `b3-backend-correctness` and `wip/t0033-paused` are the same commit and hold no code that `main` lacks `[br §0]`. **Verdict: discard both as branches; carry over their docs content.** The five issue entries I-0080 to I-0084 are copied into `ISSUES.md` (card R-26). T-0033 (test harness) is not resumed as a task; its fixes are done in card R-01. I-0080 is closed by the Checkpoint 1 decision to keep the gateway. Anthony deletes the branches when he chooses. `origin/aaron_v2` is ignored.

**Docs: one owner per kind of fact.**

| Kind of fact | Owner | Note |
|---|---|---|
| Session rules, map of owners | `CLAUDE.md` | Its source-of-truth list is rewritten to this table |
| Spec as written | `PROJECT_SOURCE_DOCS.md` | Frozen |
| Requirement ids | `CHECKLIST.md` | Unchanged |
| Verified status | `AUDIT.md` | Re-verified from the rebuild's results (card R-25). The only status document |
| Decisions | `REBUILD/DECISIONS.md` | This file |
| Architecture | `ARCHITECTURE.md` | Rewritten as built (card R-24); the old one is archived |
| Plan until Nov 18 | `REBUILD/TASKS.md` + `REBUILD/CUT.md` | During the rebuild, a card in `TASKS.md` is the task spec; `tasks/` is frozen |
| Plan after Nov 18 | `REBUILD/ROADMAP.md` | Written in Phase 4. Root `ROADMAP.md` is archived and the checker updated in the same card |
| Backlog | `ISSUES.md` | Resolved entries stay |
| Session log | `REBUILD/LOG.md` during the rebuild; `WORKLOG.md` gets one summary entry at handoff | `gateway/SESSION_LOG` is merged into `WORKLOG.md` |
| How to run | `README.md` | Absorbs `STEPS_TO_RUN_APP.md` and `Docs/HOW_TO_RUN_AND_TEST.md`; uses `REACT_APP_*` names; no status table |
| How to test | `tests/README.md`, `tests/MANUAL_SMOKE.md` | |
| Frozen evidence | `tests/BASELINE_RESULTS.md`, `REBUILD/inventory/` | Never edited |
| Schema operations | `Docs/SUPABASE_MIGRATIONS_RUNBOOK.md` | |
| Service contracts | `github-evidence/README.md`, `assessment-service/README.md`, `gateway/README.md` | The assessment README stays in place and keeps the lines its test reads |

**Archived to `Docs/archive/`:** `CODE_MAP.md` and `REVIEW_BRIEF.md` (both regenerated in Phase 4), `INTEGRATION_REVIEW.md`, old `ARCHITECTURE.md`, old `ROADMAP.md`, `STEPS_TO_RUN_APP.md`, `Docs/HOW_TO_RUN_AND_TEST.md`, `assessment-service/ASSESSMENT_IMPLEMENTATION_PLAN.md`, `gateway/PLAN.md`, `gateway/SESSION_LOG(4-11-26).md`, `frontend/README.md`, and all `tasks/T-*.md` (kept: `tasks/TEMPLATE.md`). Archiving is a move, not a deletion. The checker (`tests/docs/check-trackers.mjs`) is changed in the same card so that it no longer reads root `ROADMAP.md`, and every line cite into a moved file is repointed. `node tests/docs/check-trackers.mjs` must exit 0 at the end; it exits 1 today.

## 12. Stretch work (only after the end-to-end check passes)

In this order, as edited by Anthony at Checkpoint 2. The card ids are names and did not change, so the order is S-3, S-1, S-2, S-4, S-5. Each one upgrades a list-B item; none is promised.

1. **S-3 GitHub ownership** through a GitHub OAuth link. Needs an OAuth app from Anthony.
2. **S-1 OCR** for image-only PDFs (guide feedback 2). Needs Tesseract installed on the demo machine.
3. **S-2 Inconsistency flags** from data already in the explanation (claimed language not found on GitHub; low assessment result on a claimed skill).
4. **S-4 Certificates** extracted and shown as "claimed, not validated" (part of guide feedback 1).
5. **S-5 Two-step PFQS** generation with a stored plan and a difficulty field.
