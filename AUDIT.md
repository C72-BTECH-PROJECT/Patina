# AUDIT.md — Verified State of the Codebase

Status of every `CHECKLIST.md` item against the code. One row per CHECKLIST id.
`node tests/docs/check-trackers.mjs` (the `docs` suite of `tests/run-suite.ps1`)
fails if a row is missing, a cite is stale, or a DONE row lacks evidence.

Verified at commit: `2e87d44` (branch `Anthony_V3`; code identical to `7c83293`, the merge of PR #3). Re-audited 2026-10-12 by T-0008.
Earlier passes (2026-09-02/03, against `32905c1`) are in git history; their notes that still hold are carried into the rows below.

## How to read a row
- **Status:** `DONE_CORRECTLY` / `DONE_BUT_BROKEN_OR_HACKY` / `STUBBED_OR_PARTIAL` / `MISSING` / `CODE_REVIEWED_UNTESTED` / `CLAIMED_UNVERIFIED`.
- **`DONE_CORRECTLY` needs both** a `file:line` that exists at the verified commit **and** a `tests/` reference (test, harness result or manual-smoke step). Same bar for every author.
- **`CODE_REVIEWED_UNTESTED`:** the code was read at the verified commit and a `file:line` is cited, but no test or harness result exercises it. Judged correct on reading, not proven. Each such row names, in Notes, the test that would promote it (`Promote with: ...`).
- **`CLAIMED_UNVERIFIED`:** a claim nobody has checked against code or tests (an owner-reported item, a self-report, an absence not yet looked for). No code-read is implied.
- Evidence is code read at the verified commit, not any team checklist. `Docs/archive/*` is history and is never evidence.
- `Delivered by`: the task or commit that put the behaviour in its current state. `unattributed<=32905c1` = could not be tied to one commit. `n/a: not built` = nothing to attribute.

## Summary

<!-- SUMMARY:START -->
| Group | DONE_CORRECTLY | BROKEN_OR_HACKY | PARTIAL | MISSING | CODE_REVIEWED_UNTESTED | CLAIMED_UNVERIFIED | Total |
|---|---|---|---|---|---|---|---|
| Module 0 | 0 | 1 | 3 | 3 | 2 | 0 | 9 |
| Module 1 | 2 | 5 | 5 | 5 | 0 | 0 | 17 |
| Module 2 | 0 | 1 | 3 | 9 | 0 | 0 | 13 |
| Module 3 | 0 | 0 | 0 | 13 | 0 | 0 | 13 |
| Module 4 | 1 | 1 | 3 | 4 | 3 | 0 | 12 |
| Module 5 | 0 | 0 | 8 | 3 | 4 | 0 | 15 |
| Module 6 | 0 | 0 | 1 | 7 | 0 | 0 | 8 |
| GR | 0 | 0 | 1 | 1 | 0 | 0 | 2 |
| Appendix A | 0 | 0 | 0 | 2 | 0 | 0 | 2 |
| **All** | **3** | **8** | **24** | **47** | **9** | **0** | **91** |
<!-- SUMMARY:END -->

**One-line state of the project.** A Python NLP service parses a resume and scores it against a job; a Node layer persists and explains that score (parsing is the only evidence source); a recruiter UI renders the stored explanation. **No score is produced through the app's UI at HEAD**: the Upload page only stores the file, Apply only inserts an `applications` row, and the sole scoring path, `POST /api/analyze`, has no reachable caller (`frontend/src/pages/candidate/Processing.jsx:175`; nothing navigates to `/candidate/processing`). GitHub validation, the LLM assessment, OCR, LinkedIn/certificates, support-role fairness and OAuth are not built.

## Changelog
- **2026-10-12, T-0009:** GR-2 audited in `ARCHITECTURE.md` (verified at `8e8e498`, code identical to `2e87d44`): `CLAIMED_UNVERIFIED` → `STUBBED_OR_PARTIAL`. The "Services that actually run" table no longer calls Express a gateway. 0.1 Notes updated. 0.7 Evidence corrected: an unreachable NLP gives 500, not 502 (probe P-1). Statuses of 0.1 and 0.7 unchanged. No other row was re-verified.
- **2026-10-12, T-0008:** every row re-verified at `2e87d44`; added the `Spec`, `Delivered by` columns and the CODE_REVIEWED_UNTESTED and CLAIMED_UNVERIFIED statuses (nine code-read rows are CODE_REVIEWED_UNTESTED; only `GR-2` is CLAIMED_UNVERIFIED); added items 1.15-1.17, 4.12, 5.13-5.15, `GR-1`, `GR-2`, `X-1`, `X-2`; replaced the Firestore/MongoDB content with the verified Supabase data model (below).
- **2026-10-12, T-0003..T-0007:** `314e494` reverted and the `32905c1` lineage restored (T-0003, `a7c74e4`); upload-once/apply flow kept (`71c632d`); shortlist ownership (T-0004, `57ef325`); `POST /api/notifications/send` removed (T-0005, `7d3c318`); `requireAuth` fails closed (T-0006, `7cdfe3c`); analysis-isolation guard (T-0007, `fe9cc44`). Mongoose models and the `parse.routes.js` forwarder are gone.
- **2026-09-02/03 (pre-T-0001):** original audit, UI merge, explainability, candidate-loop and parsing/JD-source passes, from which the file-level facts below were kept.

## Data model (verified from `supabase/migrations/`, 6 files)

Supabase Postgres is the only data store. No Firestore, Firebase or MongoDB store or dependency exists in the code (ISSUES I-0008; Mongoose was removed in T-0003). The only hits are technology names used as skill keywords or sample text (`nlp-engine/app/ner.py:19`, `frontend/src/pages/recruiter/CreateJob.jsx:10`).

| Table or bucket | Columns and notes | Migration | RLS |
|---|---|---|---|
| `profiles` | id (FK `auth.users`), username, first_name, last_name, role (`patina_user_role`: candidate, recruiter, admin), phone, github_url, company_name, verification_info, onboarding_completed, is_suspended, suspended_at, created_at, updated_at | `supabase/migrations/20260823_create_profiles.sql`, `20260831_add_single_admin_role.sql`, `20260901_add_profile_suspension.sql` | yes |
| `jobs` | id, recruiter_id (FK profiles), title, description, required_skills[], preferred_skills[], experience_level, location, status (draft, published, closed) | `supabase/migrations/20260830_create_jobs_and_applications.sql` | yes |
| `applications` | id, candidate_id, job_id, status (submitted, under_review, shortlisted, rejected, withdrawn), submitted_at. **No score column or link** | same | yes |
| `notifications` | id, user_id, type, message, read, data jsonb, created_at | `supabase/migrations/20260903_create_notifications.sql` | yes |
| `resumes` | id, candidate_id, job_id (nullable), file_name, file_ref, raw_text_preview, contact jsonb, skills[], experience, education, projects jsonb, project_links[], parser_version | `supabase/migrations/20260903_create_resumes_and_scores.sql:18` | yes (read policies only) |
| `scores` | id, resume_id, candidate_id, job_id, composite_score, subscores, weights, explanation jsonb, evidence_limited. **Keyed to resume/candidate/job, not to an application** | same, `:41` | yes (read policies only) |
| storage bucket `resumes` | private; created at `supabase/migrations/20260903_create_resumes_and_scores.sql:14-16`. No mime allow-list or size limit in the migration (ISSUES I-0001 note) | same | n/a (service role) |

Old tracker concept → actual: `users` → `auth.users` + `profiles`; `job_descriptions` → `jobs`; `parsed_profiles` → columns on `resumes` (not a separate table); `credibility_scores` → `scores`; `audit_logs`, `github_metrics`, `assessments` → **no table** (gaps: X-1, 2.11, 3.12). Every table and column the backend queries exists in a migration.

## Services that actually run
| Service | Port and entry | State |
|---|---|---|
| React app (CRA) | 3000, `frontend/` | Runs; recruiter pages read persisted scores; candidate Processing and Assessment pages are unreachable |
| Express backend | 5000, `backend/index.js` | Monolithic core and the browser's only API entry point. **Not a gateway** (ARCHITECTURE.md §1.7, GR-2). Calls NLP only from `POST /api/analyze` (`backend/Controllers/analysis.controller.js:262`); every Supabase table and the bucket go through its service-role client |
| FastAPI NLP service | 8000, `nlp-engine/app/main.py` | The only real service; `POST /parse` |
| GitHub aggregator, assessment engine | none | Do not exist. `backend/Controllers/githubAggregator.js` is imported by nothing |

---

## Module 0: Cross-Cutting Requirements

| Item | Spec | Status | Evidence | Delivered by | Notes |
|---|---|---|---|---|---|
| 0.1 Microservices architecture | §2.1, NFR-3, GR-2 | STUBBED_OR_PARTIAL | `backend/Controllers/analysis.controller.js:262` (Express forwards the upload to FastAPI); `nlp-engine/app/main.py:48` (separate `/parse`); no other service exists (`backend/Controllers/githubAggregator.js` is unused) | Express forward: `a7c74e4` (T-0003); NLP service: unattributed<=32905c1 | 1 of the 3 Python services exists. No asserting test exercises the architecture beyond the NLP hop (`tests/backend/live-analyze.test.mjs:52`); `tests/arch/nlp-outage-probe.mjs` characterises its outage behaviour. Express is not a gateway; it is the monolithic core (GR-2, ARCHITECTURE.md §1.7, T-0009). |
| 0.2 Data layer (User/Resume/Repository/Score) | §3, §3.1 | STUBBED_OR_PARTIAL | `supabase/migrations/20260903_create_resumes_and_scores.sql:18,41`; writes at `backend/Controllers/analysis.controller.js:304-305,332-333`; `tests/backend/live-analyze.test.mjs:52` | `c27037f`; restored `a7c74e4` (T-0003) | User, Resume and Score persist. **Repository** has no table. See the data model above. |
| 0.3 Entity completeness (sub-scores persisted) | §3.1 | STUBBED_OR_PARTIAL | `supabase/migrations/20260903_create_resumes_and_scores.sql:18-39,41-62`; `backend/Services/explainability.js:58-62`; response keys asserted in `tests/backend/live-analyze.test.mjs:60-63` | resumes/scores: `c27037f`; sub-score shape: `a7c74e4` (T-0003) | All three sub-score slots are stored in a uniform shape; GitHub and assessment are persisted as unavailable with a reason. No Repository entity. |
| 0.4 Auth: OAuth 2.0, two user classes | NFR-8, §5 | DONE_BUT_BROKEN_OR_HACKY | `backend/Controllers/auth.controller.js:333` (password sign-in; no OAuth code); `backend/Middlewares/auth.Middleware.js:5-28` (fails closed), `:41-47` (`requireRole`); `backend/Routes/analysis.routes.js:7-12`; tests: `tests/backend/live-auth-failclosed.test.mjs:52`, `tests/backend/live-shortlist-authz.test.mjs:114`, `tests/backend/live-analysis-isolation.test.mjs:84`, `tests/backend/smoke.test.mjs:50` | role gating: unattributed<=32905c1; token-gated reset: `a7c74e4` (T-0003); fail-closed: `7cdfe3c` (T-0006); shortlist ownership: `57ef325` (T-0004); `notifications/send` removed: `7d3c318` (T-0005) | **Not OAuth 2.0**: email and password only, no Google or GitHub login. Role separation is enforced server-side and now tested. The unauthenticated `update-password` takeover is gone (`git grep update-password` in backend and `frontend/src`: empty); reset is token-gated (`backend/Routes/auth.routes.js:51-52`). |
| 0.5 Secrets server-side | NFR-9 | CODE_REVIEWED_UNTESTED | `backend/Config/supabase.js:14-15` and `backend/Config/supabaseAuth.js:25-26` read keys from `process.env`; `.gitignore:11` ignores `**/.env`; `git ls-files` lists only `.env.example` templates | unattributed<=32905c1 | Read-verified, untested. No GitHub or LLM keys exist. `backend/.env.example` omits `SESSION_SECRET`, `PORT`, `NLP_PARSE_URL`, `NODE_ENV`, `CREDIBILITY_WEIGHTS` (README issue). Promote with: `tests/backend/secrets-hygiene.test.mjs` - asserts `git ls-files` lists no `.env` except `*.env.example`, no tracked source under `backend/`, `frontend/src`, `nlp-engine/` contains a JWT-shaped string, and `frontend/src` never references `SUPABASE_SERVICE_ROLE_KEY`. |
| 0.6 HTTPS | NFR-10 | MISSING | `backend/index.js:37` (cookie `secure` only in production); `backend/Controllers/analysis.controller.js:12` (NLP over `http://localhost:8000`) | n/a: not built | No TLS config anywhere. |
| 0.7 Graceful degradation (retry + fallback) | NFR-12, §7 | MISSING | `backend/Controllers/analysis.controller.js:262-269` (one `fetch`, no retry, no timeout; a non-2xx NLP reply → 502 that echoes the upstream body); `backend/Controllers/analysis.controller.js:357-359` (NLP unreachable → **500** with the raw error text, not 502: probe P-1). NLP hung → no response within 20 s (P-2). Both measured by `tests/arch/nlp-outage-probe.mjs` (ARCHITECTURE.md Appendix A) | n/a: not built | Only the storage upload is tolerated (`:272-292`). An NLP outage hard-fails the only scoring path; login, jobs and upload are unaffected (P-1). ISSUES I-0036. Unavailable sub-scores carry a stated reason (`backend/Services/explainability.js:72-76`). |
| 0.8 Concurrency / async queue | NFR-2, NFR-4, NFR-11 | MISSING | `backend/Controllers/analysis.controller.js:231-269` (synchronous handler); one analyze call took 3.37 s (`tests/BASELINE_RESULTS.md:118`) | n/a: not built | No queue or worker; no concurrency test. |
| 0.9 Scope discipline | Objectives §Exclusions | CODE_REVIEWED_UNTESTED | `backend/Services/explainability.js:58-62` (the only scored dimensions are parsing, GitHub and assessment; none for soft skills or degrees); grep of `backend/Controllers`, `backend/Services`, `nlp-engine/app`, `frontend/src` for soft-skill and degree-verification logic: no hits | n/a | Read-verified by absence, untested. Promote with: `tests/docs/scope-guard.test.mjs` - asserts no source under `backend/Controllers`, `backend/Services`, `nlp-engine/app`, `frontend/src` matches a soft-skill or degree-verification term list, so adding such logic fails the test. |

## Module 1: Resume Parsing & Semantic Extraction

The NLP engine at HEAD is byte-identical to `32905c1` (`git diff 32905c1 HEAD --stat -- nlp-engine` is empty). `tests/nlp/test_parse.py` asserts response **shape** and snapshots only and says so (`tests/nlp/test_parse.py:5-7`); it is not an accuracy test.

| Item | Spec | Status | Evidence | Delivered by | Notes |
|---|---|---|---|---|---|
| 1.1 PDF + DOCX ingestion | FR-1 | DONE_CORRECTLY | `nlp-engine/app/extractor.py:22-29`; `backend/Controllers/analysis.controller.js:209` (rejects other types); `tests/nlp/test_parse.py:93-103` (f1 PDF and f2 DOCX both 200, same keys); `tests/BASELINE_RESULTS.md:76-77` | `5565829`; restored `a7c74e4` (T-0003) | DOCX reads `doc.paragraphs` only, so tables are ignored (`nlp-engine/app/extractor.py:17`). |
| 1.2 OCR for scanned resumes | GF-2 | MISSING | `nlp-engine/requirements.txt:1-21` (no OCR package); `nlp-engine/app/extractor.py:9-12` (pages with no text layer are skipped); `tests/BASELINE_RESULTS.md:81` (f6: HTTP 200, score 0.0) | n/a: not built | The guide called OCR mandatory. |
| 1.3 Layout-aware extraction | M-1 | DONE_BUT_BROKEN_OR_HACKY | `nlp-engine/app/extractor.py:8-11` (per-page `extract_text()` concatenation); `tests/BASELINE_RESULTS.md:80` (f5 two-column: sidebar interleaved, experience empty); `tests/nlp/test_parse.py:93` | `5565829`; restored `a7c74e4` (T-0003) | pdfplumber is used but column and table structure is discarded. |
| 1.4 Preprocessing (tokenize + lemmatize) | M-1 | DONE_BUT_BROKEN_OR_HACKY | `nlp-engine/app/preprocessor.py:13-21` (spaCy lemmas); `nlp-engine/app/main.py:67-68` (computed, but NER receives `raw_text`); `nlp-engine/app/embedder.py:123` (`noun_chunks` deleted); `tests/nlp/test_parse.py:23` | `5565829`; restored `a7c74e4` (T-0003) | Implemented but feeds nothing before entity extraction; output is only echoed as `token_count` and previews. Was DONE_CORRECTLY in the old audit, which recorded the same fact; downgraded on the checklist wording "applied before entity extraction". |
| 1.5 Custom/trained NER model | FR-2, M-1 | DONE_BUT_BROKEN_OR_HACKY | `nlp-engine/app/ner.py:6-54` (hardcoded `SKILL_KEYWORDS`), `:154-177` (regex matching), `:377-517` (section-scoped experience, education, projects); `tests/BASELINE_RESULTS.md:76-85` | `2c271cd`, `365a09e`, `32905c1`; restored `a7c74e4` (T-0003) | Stock `en_core_web_sm` for PERSON and ORG only; no trained model, no HF dataset. Fixtures show projects empty in all 6 fixtures and the 3 private resumes, f1 name null, f1 title and organisation swapped, non-US phone numbers null, DOCX bullets split. The 2026-09-03 fixes (no fabricated experience, normalised skills) are in place. |
| 1.6 Semantic embeddings (S-BERT) | M-1, LR | DONE_CORRECTLY | `nlp-engine/app/embedder.py:11` (`all-MiniLM-L6-v2`), `:26-33` (normalised embeddings, cosine), `:138-143`; `tests/nlp/test_parse.py:28-33`; `tests/BASELINE_RESULTS.md:91-92` | `a00a99e`, `365a09e`; restored `a7c74e4` (T-0003) | MiniLM, an allowed equivalent. The test asserts the score keys exist, not their quality. Final score is 60% keyword coverage and 40% semantic (`nlp-engine/app/embedder.py:152-155`), see 1.7. |
| 1.7 Hybrid layering | LR | DONE_BUT_BROKEN_OR_HACKY | `nlp-engine/app/main.py:68-77`; `nlp-engine/app/embedder.py:57-65,152-155`; `tests/BASELINE_RESULTS.md:87-92` | `365a09e`, `32905c1`; restored `a7c74e4` (T-0003) | Layers do not feed each other; keyword coverage dominates (the f3 and f4 scores are driven by vocabulary, not embeddings). |
| 1.8 Layout robustness across templates | Scope | STUBBED_OR_PARTIAL | `nlp-engine/app/ner.py:263-312` (heading heuristics); `tests/BASELINE_RESULTS.md:77,79-81` (f5, f2/f4, f6 failures); `tests/fixtures/manifest.json` | parser `32905c1`; sample set T-0001 (`bcfa21c`) | A varied sample set now exists and it shows layout failures. |
| 1.9 Project-link extraction | Objective 1 | STUBBED_OR_PARTIAL | `nlp-engine/app/ner.py:543-577` (first LinkedIn match; GitHub bare profile preferred, else first repo link's owner; document order since T-0013, tests `test_contact_fields_same_under_every_hash_seed`, `test_github_link_rules`); `backend/Controllers/analysis.controller.js:301,316` (persisted as `project_links`) | `2c271cd`; persistence `a7c74e4` (T-0003) | Persisted, but nothing consumes it. No portfolio URLs. |
| 1.10 Structured JSON contract | DFD L1 | STUBBED_OR_PARTIAL | `nlp-engine/app/main.py:79-104`; `tests/nlp/test_parse.py:22-33`; consumed at `backend/Controllers/analysis.controller.js:292-330` and `backend/Services/explainability.js:444-446` | `32905c1`; restored `a7c74e4` (T-0003) | Stable shape, tested. Version is a hardcoded constant (`backend/Controllers/analysis.controller.js:13`), not emitted by the service. |
| 1.11 Extraction accuracy measured | FR-2, NFR-5 | MISSING | Grep for accuracy and eval code in `nlp-engine`, `tests`: only the disclaimer at `tests/nlp/test_parse.py:5-7` | n/a: not built | The harness is a regression tool, not a measurement. |
| 1.12 Skill-classification F1 measured | NFR-6 | MISSING | Same search; skills are a hand-written list (`nlp-engine/app/ner.py:6`) | n/a: not built | — |
| 1.13 Latency measured | FR-3, NFR-1 | STUBBED_OR_PARTIAL | `tests/BASELINE_RESULTS.md:62-66` (`/parse` 0.26-1.16 s warm), `:118` (analyze 3.37 s); `tests/nlp/test_parse.py:81-83` | harness T-0001 (`bcfa21c`) | Ad-hoc timings, no pass or fail threshold, cold start not measured. Was MISSING. |
| 1.14 Parsing sub-score emitted and persisted | §3.1 | DONE_BUT_BROKEN_OR_HACKY | `nlp-engine/app/embedder.py:178-195`; `backend/Services/explainability.js:140-260` (`buildParsingSubScore`, value at `:243`); `backend/Controllers/analysis.controller.js:330-343`; `tests/backend/live-analyze.test.mjs:57-66` | `32905c1`, `fdd22c3`; restored `a7c74e4` (T-0003) | Nothing the NLP service computes is dropped. Job skills come from the stored job's structured arrays, description scraped only as fallback. Still keyword-coverage dominated (1.7). `preferred_skills` are matched like required ones (no weight yet; no data to justify one). |
| 1.15 Unreadable input is signalled | GF-2, NFR-12 | MISSING | `tests/BASELINE_RESULTS.md:81` (f6: image-only PDF, 200, score 0.0); `nlp-engine/app/main.py:65-104` (never checks `raw_text`); `backend/Services/explainability.js:242` (parsing sub-score is always `available: true`) | n/a: not built | Inferred from code for the backend path; only the NLP-level f6 result is tested. |
| 1.16 LinkedIn URL and certificates extracted | GF-1, Objective 1 | STUBBED_OR_PARTIAL | `nlp-engine/app/ner.py:546,558,577` (LinkedIn URL regex only); `nlp-engine/app/ner.py:209-213` ("certifications" is only a section-heading alias, never output) | `2c271cd` (regex) | LinkedIn captured and stored; no certificate extraction at all. |
| 1.17 Support/maintenance skill coverage | GF-3 | MISSING | `nlp-engine/app/ner.py:6-54` (no ServiceNow, Jira, ITIL, Nagios, Active Directory, Splunk, PL/SQL, Windows Server, CloudWatch); `tests/BASELINE_RESULTS.md:78-79` (f3 Weak 0.4138, f4 Weak 0.4354) | n/a: not built | Also: the keyword "github" at `nlp-engine/app/ner.py:25` makes f4 list GitHub as a skill from "not on GitHub" (`tests/BASELINE_RESULTS.md:79`, a false positive). |

## Module 2: GitHub Evidence Validation

Whole-module: **no GitHub Aggregator exists.** `backend/Controllers/githubAggregator.js` (49 lines) is imported nowhere, unauthenticated, single page, and only collects repository language and topic strings. Nothing in `tests/` references GitHub except the `github` entity key (`tests/nlp/test_parse.py:25`). No T-number touched this module.

| Item | Spec | Status | Evidence | Delivered by | Notes |
|---|---|---|---|---|---|
| 2.1 Username acquisition | FR-4 | STUBBED_OR_PARTIAL | `nlp-engine/app/ner.py:543-577` (resume path, deterministic since T-0013; `tests/nlp/test_contact_determinism.py::test_contact_fields_same_under_every_hash_seed`, `::test_github_link_rules`); `supabase/migrations/20260823_create_profiles.sql:15,24-26,60` (`github_url` column); `backend/Controllers/auth.controller.js:43` | `2c271cd`, `f2a135c`; resume path `T-0013` | Both capture points exist; the resume path now returns the first match in document order, bare GitHub profile preferred (I-0015 resolved); nothing consumes them (the frontend never reads `githubUrl`) and there is no fallthrough. |
| 2.2 OAuth 2.0 GitHub auth | §5, NFR-8 | MISSING | Grep `passport` `oauth` `octokit` `signInWithOAuth` over `backend` and `frontend/src`: no hits | n/a: not built | — |
| 2.3 Repository retrieval via API | FR-5 | STUBBED_OR_PARTIAL | `backend/Controllers/githubAggregator.js:21` (unauthenticated `api.github.com/users/${username}/repos?per_page=100`) | `2c271cd` | Dead code, no pagination or rate-limit handling. |
| 2.4 Core metrics | FR-6, Objective 2 | MISSING | `backend/Controllers/githubAggregator.js:30-43` (builds a set of languages only) | n/a: not built | No commits, ownership, consistency or quality. |
| 2.5 Claim cross-referencing | Objective 2 | MISSING | Grep `githubAggregator` `fetchGitHubLanguages` over `backend`, `frontend/src`, `tests`: only the definition at `backend/Controllers/githubAggregator.js:10`; `backend/Services/explainability.js:318-319` hard-codes the GitHub evidence per skill to null | n/a: not built | — |
| 2.6 8DFS heuristic | FR-7, M-2 | MISSING | Grep `8DFS` `cyclomatic` `boilerplate` over `backend`, `frontend/src`, `nlp-engine/app`: no hits | n/a: not built | — |
| 2.7 Graded, not binary | LR, GF-4 | MISSING | `backend/Services/explainability.js:19-56` (contract comment only; no GitHub scorer) | n/a: not built | — |
| 2.8 GitHub optional / assessment-only fallback | GF-4, §7 | STUBBED_OR_PARTIAL | `backend/Services/explainability.js:275-292` (weights renormalised over available sources), `:427,446-448`; `frontend/src/pages/recruiter/Dashboard.jsx:285` (evidence-limited hint) | `fdd22c3`, `32905c1`; restored `a7c74e4` (T-0003) | The redistribution is generic and designed, but is only exercised with a single source; optionality works because the source does not exist. Untested. |
| 2.9 Fairness for maintenance/support work | GF-3 | MISSING | Grep `maintenance` `commit.?type` over `backend`, `nlp-engine/app`: no hits | n/a: not built | See 1.17 and 4.12 for the evidence it fails today. |
| 2.10 Private-repo limitation acknowledged | §2.3 | MISSING | `backend/Services/explainability.js:73-74` states only that the aggregator is not deployed | n/a: not built | — |
| 2.11 Repository entity persisted | §3.1 | MISSING | Grep `repositories` over `supabase/`: no hits | n/a: not built | — |
| 2.12 GitHub sub-score emitted | §3.1 | MISSING | `backend/Services/explainability.js:447` (always `unavailableSubScore(GITHUB)`) | n/a: not built | — |
| 2.13 Resilience (retry + fallback) | NFR-12 | DONE_BUT_BROKEN_OR_HACKY | `backend/Controllers/githubAggregator.js:23-26,45-48` (errors swallowed, returns an empty list) | `2c271cd` | No retry and no partial-data label; the code is never called. |

## Module 3: Generative AI Assessment

Whole-module: **no assessment engine.** Grep `openai` `gemini` `anthropic` `llm` `/api/assessment` over `backend` (excluding `node_modules`), `nlp-engine/app`, `supabase`, `tests` finds only comments and labels in `backend/Services/explainability.js`, the pass-through at `backend/Controllers/analysis.controller.js:116`, and a skill-keyword string. `frontend/src/pages/candidate/Assessment.jsx` is a UI shell: it calls `/api/assessment/generate` and `/evaluate` (`:61,104`), which do not exist, falls back to a static `MOCK_QUESTIONS` bank (`:62-70`) and is not routed (`frontend/src/App.jsx:54-62`). ISSUES I-0005. No T-number touched this module. Anti-cheat (GR-1) is tracked separately below.

| Item | Spec | Status | Evidence | Delivered by | Notes |
|---|---|---|---|---|---|
| 3.1 Candidate-specific generation | FR-8, Objective 3 | MISSING | Module-wide negative search above | n/a: not built | — |
| 3.2 Static banks eliminated | Objective 3 | MISSING | `frontend/src/pages/candidate/Assessment.jsx:62-70` (static fallback bank, always taken) | n/a: not built | The shell is the opposite of the requirement. |
| 3.3 PFQS framework | FR-9, M-3 | MISSING | Grep `PFQS` over `backend`, `frontend/src`, `nlp-engine/app`, `supabase`: no hits | n/a: not built | — |
| 3.4 Difficulty control | FR-9 | MISSING | Module-wide negative search | n/a: not built | — |
| 3.5 Rubric-based evaluation | FR-10, LR | MISSING | `frontend/src/pages/candidate/Assessment.jsx:104-111` (POST to a route that does not exist; failure swallowed) | n/a: not built | — |
| 3.6 Hallucination constraints | §7 | MISSING | Module-wide negative search | n/a: not built | — |
| 3.7 Sequence conformance, results stored | §3 | MISSING | `frontend/src/pages/candidate/Assessment.jsx:61,104`; no assessment route in `backend/Routes/` (admin, analysis, auth, jobs, notification); no table in `supabase/` | n/a: not built | The old audit's reference to a Mongoose `Application.Model.js` is stale; it is deleted. |
| 3.8 Rubric calibration (APPS) | §8 | MISSING | Grep `APPS` `calibrat` over `backend`, `nlp-engine/app`, `tests`: no hits | n/a: not built | — |
| 3.9 Correlation target measured | FR-11, NFR-7 | MISSING | Grep `correlation` `pearson` `spearman` over `backend`, `tests`, `nlp-engine/app`: no hits | n/a: not built | — |
| 3.10 Parallel execution | NFR-4 | MISSING | Module-wide negative search | n/a: not built | — |
| 3.11 LLM resilience | NFR-12 | MISSING | Module-wide negative search | n/a: not built | — |
| 3.12 Assessment sub-score emitted | §3.1 | MISSING | `backend/Services/explainability.js:448` (always unavailable), comment `:54-56` | n/a: not built | — |
| 3.13 Standalone sufficiency | §7 | MISSING | No assessment code | n/a: not built | — |

## Module 4: Unified Credibility Scoring

`backend/Services/explainability.js` and `frontend/src/components/recruiter/*` are byte-unchanged since `32905c1` (restored by `a7c74e4`, T-0003). **No `tests/` file covers the explainability math** (no unit test of `aggregate`, weights, flags or `ScoreBreakdown.jsx`). The only scoring-adjacent tests are `tests/backend/live-analyze.test.mjs:52-70` (response keys), `tests/backend/live-analysis-isolation.test.mjs` (API isolation) and the manual smoke `tests/MANUAL_SMOKE.md` C10-C13 (which saw **no score anywhere in the UI**). Rows that read as correct but have no test are CLAIMED_UNVERIFIED.

| Item | Spec | Status | Evidence | Delivered by | Notes |
|---|---|---|---|---|---|
| 4.1 Three-input composite | FR-12, M-4 | DONE_BUT_BROKEN_OR_HACKY | `backend/Services/explainability.js:444-466` (GitHub and assessment hard-coded unavailable) | `fdd22c3`; restored `a7c74e4` (T-0003) | One input, not three. Adding a source is a builder returning the documented shape. |
| 4.2 Normalisation before aggregation | M-4 | STUBBED_OR_PARTIAL | `backend/Services/explainability.js:114` (`toPoints`), `:243` | `fdd22c3`; restored `a7c74e4` (T-0003) | Only one source exists to normalise. |
| 4.3 Weighted aggregation, documented and configurable | Objective 4 | CODE_REVIEWED_UNTESTED | `backend/Services/explainability.js:85-110` (`BASE_WEIGHTS`, `CREDIBILITY_WEIGHTS` override with fallback), `:275-292` (`aggregate`), `:427-431` (`weighting_scheme`) | `fdd22c3`; restored `a7c74e4` (T-0003) | Read-verified, untested: no test of the weights or the env override. Was DONE_CORRECTLY. Promote with: `tests/backend/explainability.test.mjs` - asserts `BASE_WEIGHTS` is parsing 0.40 / github 0.35 / assessment 0.25 with no env; that `CREDIBILITY_WEIGHTS` JSON overrides them (child process, since it is read at import); and that invalid JSON, negative values and an all-zero total fall back to the defaults. |
| 4.4 Sub-scores retained alongside composite | §3.1, LR | DONE_CORRECTLY | `backend/Services/explainability.js:451-466`; `backend/Controllers/analysis.controller.js:335-341` (persisted), `:104-116` (serialized); `supabase/migrations/20260903_create_resumes_and_scores.sql:41-60`; `tests/backend/live-analyze.test.mjs:60-63` | `fdd22c3`, `c27037f`; restored `a7c74e4` (T-0003) | Stored, forwarded, rendered verbatim. Unavailable sources keep a null value and a stored reason, never a zero. The test checks the keys exist, not their content. |
| 4.5 Explainability layer | FR-13, GF-5, LR | STUBBED_OR_PARTIAL | `backend/Services/explainability.js:398-432` (factors with direction, weight, contribution, evidence), `:300` (`buildSkillEvidence`); `tests/backend/live-analyze.test.mjs:60-63` | `fdd22c3`, `32905c1`; restored `a7c74e4` (T-0003) | The layer is real. Partial because two of three sources have nothing to cite. |
| 4.6 Flagged inconsistencies computed | Scope | MISSING | `backend/Services/explainability.js:345-360` (`buildFlags` always returns no flags; the available branch is a placeholder) | n/a: not built | Honest empty state exists; the logic does not. |
| 4.7 Missing-evidence weight redistribution | GF-4, 2.8 | CODE_REVIEWED_UNTESTED | `backend/Services/explainability.js:275-292` (renormalises over available sources), `:427` (`evidence_limited`) | `fdd22c3`; restored `a7c74e4` (T-0003) | Read-verified, untested. The old "verified by smoke test" claim has no committed test and manual smoke produced no score. Only ever exercised with one source (weight 1.0). Was DONE_CORRECTLY. Promote with: `tests/backend/explainability.test.mjs` - asserts `aggregate()` with only the parsing sub-score available returns that score with weight 1.0 and gives github/assessment weight 0 (not scored as zero), that parsing+github renormalise to 0.40/0.75 and 0.35/0.75, and that `buildExplanation` sets `evidence_limited`. |
| 4.8 Fair maintenance-work scoring | GF-3 | MISSING | Grep `maintenance` in `backend/Services/explainability.js`: no scoring logic | n/a: not built | — |
| 4.9 Bias mitigation via auditable explainability | Objective 4 | STUBBED_OR_PARTIAL | `backend/Services/explainability.js:398-432`; `frontend/src/components/recruiter/ScoreBreakdown.jsx:215-250` | `fdd22c3`; restored `a7c74e4` (T-0003) | Auditable for the one source that produces data. |
| 4.10 LinkedIn and certificate validation | GF-1 | MISSING | `backend/Controllers/analysis.controller.js:297,301` (LinkedIn stored only) | n/a: not built | No validation, scoring or certificate logic. See 1.16. |
| 4.11 Determinism / re-explainability | §3.1 | CODE_REVIEWED_UNTESTED | `backend/Services/explainability.js:275-292` (pure), `:420` (`generated_at = new Date()`); `backend/Controllers/analysis.controller.js:335-341`; parser input `nlp-engine/app/ner.py:543-577` (`test_contact_fields_same_under_every_hash_seed`) | `fdd22c3`; restored `a7c74e4` (T-0003); parser input T-0013 | Read-verified, untested. The composite is deterministic, and its contact input is now too (T-0013); the stored explanation is not byte-reproducible because of the timestamp. Was DONE_CORRECTLY. Promote with: `tests/backend/explainability.test.mjs` - asserts `buildScoreRecord(fixture)` run twice on the same NLP JSON gives deep-equal composite, sub-scores and explanation once `generated_at` is removed, and that `generated_at` is the only differing field. |
| 4.12 Fairness of support-role scores measured | GF-3 | MISSING | `tests/BASELINE_RESULTS.md:78-79,89-92` (f3 0.4138 and f4 0.4354 below off-profile f2 at 0.48; cause is skill coverage, not the semantic score) | n/a: not built | The fixtures already show the gap; nothing measures or fixes it. |

## Module 5: Recruiter Dashboard & Candidate Portal

The reachable app flow at HEAD (R9, T-0003): Upload page stores the file (`frontend/src/pages/candidate/Upload.jsx:157`, `/api/resume/upload`, `backend/Controllers/analysis.controller.js:197-227`, no parsing, no `resumes` or `scores` rows) → Apply inserts an `applications` row (`backend/Controllers/jobs.controller.js:102-146`). **Nothing scores.** The recruiter pages read `GET /api/candidates` (scores only) and `GET /api/jobs/mine`; they show "No candidates scored yet" after a real apply (`tests/MANUAL_SMOKE.md` C12-C13, owner-observed). `GET /api/recruiter/applicants` exists (`backend/Controllers/analysis.controller.js:444-537`) but no frontend file calls it.

| Item | Spec | Status | Evidence | Delivered by | Notes |
|---|---|---|---|---|---|
| 5.1 Web upload portal | §2.2 | STUBBED_OR_PARTIAL | `frontend/src/pages/candidate/Upload.jsx:20-28,143-148` (type checked at submit only), `:157`; `backend/Controllers/analysis.controller.js:207-210` (server rejects non-PDF and non-DOCX); `tests/MANUAL_SMOKE.md` C2-C4 | T-0003 (`a7c74e4`, `e9e4592`) | Upload and validation work. No progress indicator, no corrupt-file handling; the old real-progress feature lives in the now-unreachable `Processing.jsx`. ISSUES I-0006. |
| 5.2 GitHub authentication, skippable | Use Case, GF-4 | STUBBED_OR_PARTIAL | `frontend/src/components/recruiter/CandidateModal.jsx:132-140` (a GitHub link); no connect UI in `frontend/src` | n/a | Skipping is the only path; connecting is impossible. |
| 5.3 Take assessment | Use Case | MISSING | `frontend/src/pages/candidate/Assessment.jsx:61,104`; `frontend/src/App.jsx:54-62` (no assessment route) | n/a: not built | Unrouted UI shell, no backend. |
| 5.4 Candidate visibility of submission/parse status | §2.2 | STUBBED_OR_PARTIAL | `frontend/src/pages/candidate/Upload.jsx:100` (resume status), `frontend/src/App.jsx:58` (Results routed), `frontend/src/pages/candidate/Results.jsx:103`; `tests/backend/live-analysis-isolation.test.mjs` (API only); `tests/MANUAL_SMOKE.md` C3, C10 ("No analysis yet") | T-0003 (`a7c74e4`) | Upload status is visible. The parse or score status is not reachable: the only callers of `/candidate/results` are `Processing.jsx:201` and `Assessment.jsx:112`, and nothing navigates to either. Was DONE_CORRECTLY. |
| 5.5 Candidate rankings by composite | FR-14 | STUBBED_OR_PARTIAL | `backend/Controllers/analysis.controller.js:390-442` (`GET /api/candidates`, latest score per candidate at `:417-423`); `frontend/src/pages/recruiter/Dashboard.jsx:197`, `frontend/src/pages/recruiter/JobDetails.jsx:88`; `tests/MANUAL_SMOKE.md` C12-C13 | `fdd22c3`; T-0003 (`a7c74e4`) | The ranking API and pages exist, but the app creates no scores and applicants never appear in it. No test of `/api/candidates`. Was DONE_CORRECTLY. |
| 5.6 Filtering | Use Case | CODE_REVIEWED_UNTESTED | `frontend/src/pages/recruiter/JobDetails.jsx:78-80,111-125,128-135` (min-score, skill, evidence filters) | `fdd22c3`; restored `a7c74e4` (T-0003) | Read-verified, untested; manual smoke saw an empty list, so the filters never ran on data. Was DONE_CORRECTLY. Promote with: `tests/frontend/jobdetails-filters.test.jsx` - asserts that, with three mocked analyses, the min-score filter hides rows below the threshold, the skill filter keeps only rows whose skill row is `matched`, and the evidence filter splits rows on `evidenceLimited`. Needs a frontend test step (`react-scripts test`) in `tests/run-suite.ps1`; the `frontend` suite is build-only today. |
| 5.7 Score breakdown: skills, repo, assessment pillars | FR-15, GF-5 | STUBBED_OR_PARTIAL | `frontend/src/components/recruiter/ScoreBreakdown.jsx:215-250` (factors), `:167` ("Evidence not available" panel) | `fdd22c3`; restored `a7c74e4` (T-0003) | All three pillars render; two have no data upstream. Never seen with data in smoke. |
| 5.8 Audit drill-down | Use Case, GF-5 | STUBBED_OR_PARTIAL | `frontend/src/components/recruiter/CandidateModal.jsx:68,187`; `frontend/src/components/recruiter/ScoreBreakdown.jsx:173-263,296-299` | `fdd22c3`; restored `a7c74e4` (T-0003) | Cannot reach repo or rubric evidence because those sources do not exist. |
| 5.9 Flagged inconsistencies surfaced | Scope | STUBBED_OR_PARTIAL | `frontend/src/components/recruiter/ScoreBreakdown.jsx:270-290`; `frontend/src/pages/recruiter/Dashboard.jsx:221-224` | `fdd22c3`; restored `a7c74e4` (T-0003) | Presentation is honest; flags are never computed (4.6). |
| 5.10 Evidence-limited candidates shown fairly | GF-4 | CODE_REVIEWED_UNTESTED | `frontend/src/components/recruiter/ScoreBreakdown.jsx:231-237`; `frontend/src/pages/recruiter/Dashboard.jsx:89,284-285`; `frontend/src/pages/recruiter/JobDetails.jsx:115-116` | `fdd22c3`; restored `a7c74e4` (T-0003) | Read-verified, untested; never rendered with data in smoke. Was DONE_CORRECTLY. Promote with: `tests/frontend/evidence-limited.test.jsx` - asserts `ScoreBreakdown` renders the "Evidence-limited ... redistributed, not counted as zero" notice for `evidenceLimited: true` and not for `false`, and that the Dashboard and JobDetails evidence filters place such a row correctly. Same frontend-runner prerequisite as 5.6. |
| 5.11 Per-skill confidence visualisation | Objective 4 | CODE_REVIEWED_UNTESTED | `frontend/src/components/recruiter/ScoreBreakdown.jsx:31-41`; `frontend/src/pages/recruiter/Dashboard.jsx:135-166,329-361` | `fdd22c3`; restored `a7c74e4` (T-0003) | Read-verified, untested. Was DONE_CORRECTLY. Promote with: `tests/frontend/skill-evidence.test.jsx` - asserts `ScoreBreakdown` renders one badge per `skillEvidence` row with the labels Evidenced / Not found / Claimed only for `matched` / `missing` / `claimed_only`. Same frontend-runner prerequisite as 5.6. |
| 5.12 Bias-free presentation | Objective 4 | CODE_REVIEWED_UNTESTED | `backend/Controllers/analysis.controller.js:88-96` (candidate fields: name, location, contact); `frontend/src/components/recruiter/CandidateModal.jsx:123-145` | unattributed<=32905c1 | Read-verified, untested. No protected attributes shown; contact details are shown in the modal. Was DONE_CORRECTLY. Promote with: `tests/backend/live-analyze.test.mjs` (extend the existing live test) - asserts the `candidate` object returned for an analysed resume has only the keys name, location, email, phone, github, linkedin and none of gender, age, dob, photo, nationality. |
| 5.13 Certificates and LinkedIn shown with evidence | GF-1 | MISSING | Grep `certificate` over `frontend/src`: no UI | n/a: not built | New item. |
| 5.14 Score-on-apply | R9, FR-12, FR-14 | MISSING | `backend/Controllers/jobs.controller.js:102-146` (apply inserts a row, never scores); `supabase/migrations/20260903_create_resumes_and_scores.sql:41-60` (`scores` has no `application_id`); `frontend/src/pages/candidate/Processing.jsx:175` (only `/api/analyze` caller, unreachable); `tests/MANUAL_SMOKE.md` C10, C12 | n/a: deferred by INTEGRATION_REVIEW R9 | New item. Pieces exist: the analyze endpoint and scoring engine work, and analyze can score a job the candidate never applied to. Each analyze run also stores a second unpruned copy of the file (`backend/Controllers/analysis.controller.js:276-286`). |
| 5.15 Merged application-centric recruiter dashboard | R38, FR-14, FR-15 | STUBBED_OR_PARTIAL | `backend/Routes/jobs.routes.js:17` and `backend/Controllers/jobs.controller.js:158-207` (shortlist and reject, owner-scoped); `tests/backend/live-shortlist-authz.test.mjs`; `backend/Controllers/analysis.controller.js:444-537` (applicants API, no UI caller); `frontend/src/pages/recruiter/Dashboard.jsx:197-198` (score view only) | shortlist API: T-0004 (`57ef325`); score view: `fdd22c3`; deferred by R38 | New item. Backend pieces exist; no UI for shortlist, reject or applicants; applicants are invisible to the recruiter. The old mock and random-score pages were deleted (`5446ebe`). |

## Module 6: Evaluation & Evidence of Correctness

No evaluation harness exists beyond the regression suite in `tests/`. Nothing here is measured.

| Item | Spec | Status | Evidence | Delivered by | Notes |
|---|---|---|---|---|---|
| 6.1 Extraction accuracy measured | FR-2, NFR-5 | MISSING | `tests/nlp/test_parse.py:5-7` (snapshots are not correctness); `tests/BASELINE_RESULTS.md:74-81` lists known-wrong outputs | n/a: not built | — |
| 6.2 Skill F1 measured | NFR-6 | MISSING | No F1 code or held-out data in `tests/` or `nlp-engine/app` | n/a: not built | — |
| 6.3 Processing latency benchmarked, incl. OCR | FR-3, NFR-1 | STUBBED_OR_PARTIAL | `tests/BASELINE_RESULTS.md:62-66,118`; `tests/nlp/test_parse.py:81-83` | harness T-0001 (`bcfa21c`) | Reference timings only; no OCR path exists, f6 returns an empty result in 0.03 s. Was MISSING. |
| 6.4 GitHub correlation with human judgement | LR | MISSING | No GitHub module | n/a: not built | — |
| 6.5 LLM correlation, APPS-calibrated | FR-11, NFR-7 | MISSING | No LLM module | n/a: not built | — |
| 6.6 100 concurrent users load test | NFR-2 | MISSING | No k6, locust or autocannon anywhere | n/a: not built | — |
| 6.7 Uptime monitored, graceful failure verified | NFR-11, NFR-12 | MISSING | Only `GET /api/health` (`backend/index.js:62`, `tests/backend/smoke.test.mjs:19`) | n/a: not built | — |
| 6.8 Datasets used as specified | §8 | MISSING | Skills are a hand-written list (`nlp-engine/app/ner.py:6`); the live GitHub call is dead code | n/a: not built | — |

## Guide-review items (owner-reported)

| Item | Spec | Status | Evidence | Delivered by | Notes |
|---|---|---|---|---|---|
| GR-1 Assessment anti-cheat design | GR-1 (guide review, Sep 2026) | MISSING | The only related code is a client-side 30-minute countdown in `frontend/src/pages/candidate/Assessment.jsx:57,82-97`, unrouted and not enforced server-side. Grep `proctor` `cheat` `visibilitychange` `plagiar` over code: nothing relevant | n/a: not built | No written source in the repo; recorded as the owner stated it. Design is required before Module 3 is built. |
| GR-2 Microservices / API gateway verified | GR-2 (guide feedback, Oct 2026), NFR-3 | STUBBED_OR_PARTIAL | Audited in `ARCHITECTURE.md` at `8e8e498` (T-0009). **No API gateway exists.** Express is the monolithic core and the browser's only API: no proxy dependency (`backend/package.json:15-25`) and one downstream URL (`backend/Controllers/analysis.controller.js:12`). 1 of the 3 SRS services exists (`nlp-engine/app/main.py:48`). Sessions in the in-process MemoryStore block a second core replica (`backend/index.js:30-41`). NLP down → analyze 500; NLP hung → no response within 20 s, while login, jobs and upload keep working (`tests/arch/nlp-outage-probe.mjs`, output in ARCHITECTURE.md Appendix A). Verdict on 7 criteria: 1 PASS, 5 PARTIAL, 1 FAIL (NFR-3). | audit: T-0009; architecture: unattributed<=32905c1 | The verification half is done. The "fix it" half is ARCHITECTURE.md §5 M1–M4, "the minimum that answers GR-2": NLP isolation, one API base, a real gateway, one-command start. None of it has started. Promote to DONE_CORRECTLY when tests show: 401 at the gateway for an unauthenticated protected route; NLP stopped → analyze 503 while login, jobs and upload stay 200; `X-Request-ID` in the logs of gateway, core and NLP; `docker compose up` brings every service to healthy. |

## Appendix A items (team-proposed, not in the spec)

| Item | Spec | Status | Evidence | Delivered by | Notes |
|---|---|---|---|---|---|
| X-1 Recruiter audit log | Archived tracker | MISSING | No `audit_logs` table in `supabase/migrations/`; no audit write in `backend/Controllers/jobs.controller.js` | n/a: not built | — |
| X-2 Code-originality signals | Archived tracker | MISSING | Grep `moss` `codebert` `diversity` `plagiar` over `backend`, `frontend/src`, `nlp-engine/app`, `supabase`, `tests`: no hits | n/a: not built | — |

## Guide-Feedback Compliance (GF-1 .. GF-5)

| GF | Requirement | Status | Evidence |
|---|---|---|---|
| GF-1 | LinkedIn + certificate validation | MISSING | LinkedIn URL is regex-captured and stored only (1.16, 4.10); no certificate logic anywhere. |
| GF-2 | OCR is a must | MISSING | No OCR dependency; an image-only PDF returns 200 with score 0.0 and no unreadable signal (1.2, 1.15). |
| GF-3 | Fair scoring for support/maintenance candidates | MISSING | No support-role scoring; f3 and f4 score Weak because the vocabulary lacks their tools (1.17, 2.9, 4.8, 4.12). |
| GF-4 | GitHub must be optional | PARTIAL | Weight redistribution is designed and generic (2.8, 4.7, 5.10) but untested with a second source, and the GitHub path to skip does not exist (2.2). |
| GF-5 | Score explainability is crucial | PARTIAL | The layer is built and stored per score (4.4 DONE, 4.5, 5.7, 5.8 partial), but no score is produced through the app's UI at HEAD (5.14) and flags are not computed (4.6). Was LARGELY ADDRESSED. |

## Integration Requirement Assessment

The explainable end-to-end pipeline does not connect. At HEAD: resume upload stores a file; apply records an application; scoring happens only through a direct `POST /api/analyze` that the UI no longer reaches; one evidence source (parsing) feeds the composite; GitHub and assessment do not exist. Parsed entities seed nothing downstream: `entities.github` and LinkedIn are stored as `contact` and `project_links` and read by nothing (`backend/Controllers/analysis.controller.js:297,301`). The recruiter drill-down can show matched and missing skills and the similarity metrics for scores that exist, and nothing deeper. Per the CHECKLIST standard, the project has one partially-working module (parsing, with known quality gaps) and the score-on-apply link (5.14) and merged dashboard (5.15) still to build.

## Known cruft at HEAD (verified)
- `backend/Controllers/githubAggregator.js`: unused (2.3).
- `frontend/src/pages/candidate/Assessment.jsx`: unrouted, calls non-existent routes (3.x, I-0005).
- `frontend/src/pages/candidate/Processing.jsx`: routed but unreachable; its XHR progress and `/api/analyze` call have no caller.
- `backend/index.js:32`: session secret falls back to a hardcoded default outside production (warns, does not fail).
- `nlp-engine/app/ner.py`: "github" as a skill keyword (1.17); AI-cruft keywords (I-0004).
