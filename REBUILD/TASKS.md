# Rebuild task cards

Status: **APPROVED by Anthony at Checkpoint 2, 2026-11-12.** His conditions are written into the cards they affect: Y1 → R-10 and R-13; Y5 reset → R-12 and R-18; Y8 stretch order → the stretch section; TM-1 guide and consent rule → TM-1 and R-20. The full record is `DECISIONS.md` §0.

Read `REBUILD/DECISIONS.md` first; cards refer to its sections as `D§n`. Inventory files are under `REBUILD/inventory/`; `SvR` is `scope_vs_reality.md`, and `F`, `B`, `P` numbers are its §4 list.

## Rules for every card

- Git is read-only. No commits, no staging, no branch changes.
- Never apply a migration, never delete live Supabase rows, never read or print a secret or `.env` value.
- Stay inside the card's files. A problem outside them goes to `ISSUES.md`, not into the diff.
- No fabricated values and no silent fallbacks. If something cannot be done honestly, stop and report.
- Every behaviour change comes with a test in `tests/`.
- Report in 20 lines or fewer: files changed, check result, anything left open.
- A verifier that wrote to live Supabase ends its report with the leftover rows. Anthony runs the sweep.
- The implementer never verifies its own card. After each batch a verifier re-runs the baseline table (`inventory/baseline.md` §6) and, once it exists, the end-to-end check (R-19). The rebuild must never fall below the baseline.

Status values: `todo`, `doing`, `done` (verifier passed), `failed` (two failed verifications; reason recorded), `dropped`.

## Order and dates

| Batch | Cards | Target | Can run in parallel |
|---|---|---|---|
| 0 | O-1 to O-6 (Anthony), TM-1 starts | Nov 12 | — |
| 1 | R-01; R-02 → R-03 → R-04 | Nov 13 | R-01 beside the chain; all of batch 2 beside batch 1 |
| 2 | R-05; R-06; R-07 → R-08; R-20 | Nov 13 | All four lanes |
| 3 | R-09 → R-10 → R-11 → R-12 → R-13 | Nov 14 | Serial (same controllers) |
| 4 | R-14, then R-15, R-16, R-17 together, then R-18, then R-19 (moved in from batch 5 by Anthony, 2026-11-13: batch 4 is not done until the scripted browser check of the full spine passes). R-19's Playwright scaffolding (`tests/e2e/` only) may be built beside R-14 so the batch-4 verifiers can use it for their browser passes. | Nov 15 | As stated |
| 5 | R-21 | Nov 15–16 | — |
| 6 | R-22 → R-23, R-24, R-25, R-26 | Nov 16 | After R-22 |
| Stretch | S-3, S-1, S-2, S-4, S-5, in that order | Only after R-19 passes | — |
| Phase 4 | H-1 to H-4 | Starts Nov 16 whatever else is open | — |
| Nov 17 | Buffer, TM-2 rehearsal, fixes from it (Opus-led) | | |

Suggested commit points for Anthony: one after each batch passes its verifier run.

### Re-plan of 2026-11-13 (after Anthony's manual test; this table replaces the rows for batches 5, 6 and Stretch above)

**Status: APPROVED by Anthony on 2026-11-13 with changes (D§0 amendments A4 to A7): TM-2 is one full rehearsal on Nov 17 plus a short run on demo morning; TM-4 is the three-candidate demo set described in R-30; R-37 added (triage item promoted to NOW); `DECISIONS.md` §7.1 approved with option (b) and W4 to W6.** Source: `MANUAL_TEST_2026-11-13.md`. The teammates now do documentation only, so TM-1, TM-2 and TM-4 are Anthony's (see the teammate table).

| Batch | Cards | Target | Lanes |
|---|---|---|---|
| 4b (prerequisite) | O-8 (Anthony runs the account repair), then one verifier run of the e2e spine | Nov 14, first | — |
| 7 (MUST) | core: R-27 → R-28 · assessment-service: R-29 · nlp-engine: R-30 → R-21 · frontend: R-31 + R-37 → R-33 → R-32 | Nov 14–15 | Four lanes side by side; at most two NLP-loading agents at once. Batch ends with the batch smoke and the e2e suite twice. |
| 6 (docs) | R-22 → R-23, R-24, R-25, R-26 | Nov 16 | Unchanged; runs beside Phase 4 |
| Phase 4 | H-1 to H-4 | Starts Nov 16 whatever else is open | — |
| After every MUST is verified, in this order | S-3 (GitHub OAuth), SHOULD-1 as R-34, SHOULD-3 token refresh as R-35 | Nov 15–17 | One at a time |
| Nov 17 | Buffer, Anthony's TM-2 rehearsal, fixes from it (Opus-led). **Then the `BATCH·demo` sweep (R-36).** | | |

**What drops off to make room**

| Item | Was | Now |
|---|---|---|
| S-1 OCR | Stretch 2 | Dropped before Nov 18 (Anthony, 2026-11-13). List B: the explicit "can't read this file" error. GF-2 stays unmet and is said so. |
| S-2 inconsistency flags | Stretch 3 | Roadmap. R-28's "Claimed only" status shows the main signal it would have raised; the flags panel stays "not computed". |
| S-4 certificates, S-5 two-step PFQS | Stretch 4, 5 | Roadmap. |
| SHOULD-2 job-description upload | New | Roadmap (AFTER). It does not fit. |
| SHOULD-3 token-level visual refresh | New | Last in line; built only if every MUST and S-3 are verified by Nov 16. Otherwise roadmap with the full redesign. |
| TM-1 two labellers plus a third settling disagreements | D§4.3 | One labeller (Anthony), so no agreement figure is reported and `eval/RESULTS.md` says the labels were made by one person. This weakens A4 and is stated. If the labels do not exist by Nov 15, A4 moves to list B under the slip rule in `CUT.md` and R-21 ships with its unit tests only. |
| TM-2 manual pass on Nov 16 and Nov 17 | Two passes | One full rehearsal on Nov 17 and a short run on the morning of the demo (Anthony's change). The manual test of Nov 13 was in effect the first. |
| TM-4 three demo resumes | Aaron | A demo set of three candidates that shows the weighting (Anthony's change): his real resume with `anthonyjennis`; a synthetic keyword-stuffed resume, no GitHub; a synthetic support-role resume, no GitHub. The two synthetic files are built inside R-30. The image-only case keeps using fixture f6. |
| AFTER items of the manual test | — | Roadmap H-1: claim-grounded scenario questions; company and recruiter verification; full redesign with the Vite migration. |

Nothing on list A is dropped. At risk, in this order if the MUST batch overruns Nov 15: SHOULD-3, SHOULD-1, S-3, then A4 (the measurement).

**Where each manual-test item landed**

| Item | Card | Already tracked as |
|---|---|---|
| §0 data repair | O-8, `tests/backend/repair-test-accounts.mjs` | new |
| §0 custom SMTP | O-7 | new |
| MUST 1 weights | R-27, `DECISIONS.md` §7.1 | replaces D§7 row 1; `CUT.md` list B "Weights (4.3)" |
| MUST 2 skill table | R-28 | new (bug confirmed at `explainability.js:724`) |
| MUST 3 longest option | R-29 | new |
| MUST 4 parsing | R-30 | embedded links = `ISSUES.md` I-0052 (open since Oct 15), closed by this card |
| MUST 5 recruiter signup | R-31 | R-15 made "Skip verification" work; it is now removed |
| MUST 6 job skills input | R-32 | new |
| Worst-case 504 | R-33 | new |
| SHOULD 1 | R-34 | new |
| SHOULD 3 | R-35 | D§8.1 "visual redesign after Nov 18" stands for the full redesign |

---

## Batch 0: owner prerequisites (Anthony)

| Id | Action | Blocks |
|---|---|---|
| O-1 | Put `GEMINI_API_KEY` in `assessment-service/.env`. **Done 2026-11-12** (the file exists and the name has a value; the value was not read). | R-07, R-08, R-11, R-12, R-19 |
| O-2 | Check whether the account in `tests/.env.example` lines 6–7 is live; rotate its password if so. | — (R-01 replaces the lines either way) |
| O-3 | Run `node tests/backend/sweep.mjs` to clear the baseline's test rows. | — |
| O-4 | After R-04 lands: set a random `SESSION_SECRET` of at least 32 characters in `backend/.env`. | Core start after R-04 |
| O-5 | **Answered 2026-11-13:** (a) email confirmation is ON in the live Supabase project, so `signup.spec.mjs` goes only as far as the "confirm your email" state; (b) the demo resume links the GitHub account `anthonyjennis`. | R-19, TM-4 |
| O-6 | **Done (reported by Anthony, 2026-11-13): the app exists and both values are in `backend/.env`. Not checked by an agent; S-3's live link is the check.** Create a GitHub **OAuth App** (not a GitHub App) for S-3. Settings: Application name `Patina (local demo)`; Homepage URL `http://localhost:3000`; Authorization callback URL `http://localhost:5000/api/github/callback`; Enable Device Flow off. Then "Generate a new client secret" and put `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` in `backend/.env` (names only here; the values are never read or printed by an agent). No scope is requested: S-3 only reads the login of the account that authorised. Tesseract (S-1) is no longer needed: S-1 was dropped on 2026-11-13. | S-3 |
| O-7 | **Done (reported by Anthony, 2026-11-13): custom SMTP through Gmail is configured. Still open: the delivery check below has not been run by anyone on record, and `signup.spec.mjs` has not been run with `E2E_SIGNUP=1`.** Custom SMTP before the demo (added 2026-11-13). Supabase's built-in sender delivers only to addresses on the project's organisation team and is limited to 2 emails an hour, so a sign-up by an evaluator would never get its confirmation email. In the Supabase dashboard: Authentication → Emails → SMTP Settings → enable custom SMTP with a provider account (sender address, host, port, user, password), then raise Authentication → Rate Limits → "emails sent per hour". Check: sign up with an address that is not on the Supabase team and receive the confirmation email. If it is not done by Nov 17, the demo uses only accounts confirmed in advance and says so. | Live sign-up in the demo; `signup.spec.mjs` beyond the "confirm your email" state |
| O-8 | **Done (Anthony ran `--apply`, 2026-11-13); the confirming e2e run is in `LOG.md`.** Recreate the test accounts (added 2026-11-13). The four `t0001_` accounts are missing from Authentication and from `profiles` (counts in `LOG.md`). Run `node tests/backend/repair-test-accounts.mjs` (dry run), then with `--apply`, then `node tests/backend/sweep.mjs --check`. It creates the accounts already confirmed, sends no email, deletes nothing. | Every live suite, the e2e suite, every verifier browser pass, the sweep |
| O-9 | **Orphaned résumé files (added 2026-11-13; triage NOW, a data problem).** 6 files in 4 folders of the `resumes` bucket belong to owners with no account (`ISSUES.md`, data-repair entry). **Decided 2026-11-13: guarded script, written.** Run `node tests/backend/purge-orphan-resume-files.mjs` (dry run; it listed exactly the 6 files on 2026-11-13), then with `--apply`. It deletes only files in an owner folder whose id has no auth user, no profile and no `resumes` row, and stops above 25 files. No agent runs `--apply`. | — |

---

## Batch 1: foundations

### R-01 · Test harness on the current ports; placeholder credentials
- **Status:** DONE 2026-11-12 (verified: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** none · **Risk:** low
- **Goal:** the harness works with gateway :5000 and core :5001 (I-0080 decision); no credential-shaped text in tracked files.
- **Files:** `tests/run-suite.ps1`, `tests/backend/lib/env.mjs`, `tests/arch/nlp-outage-probe.mjs`, `tests/.env.example`, `tests/README.md`, `gateway/package.json`.
- **Do:** start core on 5001 and wait on its real health URL; backend unit and smoke suites target core directly, gateway suites target the gateway; add a `gateway` suite if none exists; make `npm test` in `gateway/` work on Node 24; replace `tests/.env.example` lines 6–7 with placeholders (I-0084).
- **Check:** `powershell -File tests/run-suite.ps1 -Suites backend` runs more than 0 tests and exits 0; the gateway suite exits 0; `cd gateway; npm test` exits 0; `git grep -nE "t0001_.*@|password\s*=" tests/.env.example` shows placeholders only.

### R-02 · One-command start and stop; core on loopback
- **Status:** DONE 2026-11-12 (verified: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** none · **Risk:** low
- **Goal:** D§1. One script starts all six processes correctly; core is unreachable except through the gateway.
- **Files:** `scripts/start-all.ps1`, `scripts/stop-all.ps1` (new), `backend/index.js` (listen host only).
- **Do:** core listens on `HOST` (default `127.0.0.1`). The start script launches nlp-engine from `nlp-engine\venv` and github-evidence from its venv with `--host 127.0.0.1`, assessment-service from `.venv`, core, gateway and the frontend, using the commands verified in `inventory/baseline.md` §2; it waits for each health URL, prints one status table, and fails loudly naming the service that did not come up. It prints no env values. The stop script stops only what the start script started.
- **Check:** `scripts/start-all.ps1` → gateway `GET :5000/health` reports all four services up; `curl http://127.0.0.1:5001/api/health` answers; the same request to the machine's LAN address on :5001 is refused; `scripts/stop-all.ps1` leaves ports 3000, 5000, 5001, 8000, 8001, 8002 free.

### R-03 · Error contract, timeouts and real health in core and gateway
- **Status:** DONE 2026-11-12 (verified: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** R-02 · **Risk:** medium (touches every handler's error path)
- **Goal:** D§9. No stack trace, raw Supabase text or upstream text ever reaches a client; health tells the truth.
- **Files:** `backend/index.js`, `backend/Middleware/errorHandler.js` (new), `backend/Config/supabase.js`, `backend/Services/internalHttp.js`, error branches in `backend/Controllers/*.js`, `gateway/index.js`, `gateway/health.js`, `gateway/requestId.js`, `tests/backend/`, `tests/gateway/`.
- **Do:** final JSON error middleware in core and gateway, shape `{ error, message, requestId }`; replace every response that echoes `error.message` from Supabase, NLP or a caught exception with a fixed message and log the detail with the request id (list in `inventory/services.backend.md` §4 O1, O7, O8); 10 s timeout on the Supabase client → 503; core `/api/health` checks Supabase with a 2 s timeout and reports `ok` or `degraded`; gateway logs status and latency, adds a proxy timeout, `helmet`, and turns off `x-powered-by` (core too); remove the lines that log usernames and the Supabase host.
- **Check:** new tests pass: malformed JSON body → 400 JSON with no `stack` or `at ` text; a handler forced to throw → 500 JSON; a stubbed Supabase error → response body contains none of the stub's message; health `degraded` when the Supabase stub fails. `git grep -n "error.message" backend/Controllers` shows no line that feeds a response.

### R-04 · Auth and edge hardening
- **Status:** DONE 2026-11-12 (verified: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** R-03 · **Risk:** medium (auth change, approved as Y4)
- **Goal:** D§2. The demo cannot lock itself out or 503 on a slow database; known auth defects fixed.
- **Files:** `gateway/limits.js`, `gateway/forwardAuth.js`, `gateway/public-routes.js`, `backend/Routes/auth.routes.js`, `backend/Controllers/auth.controller.js`, `backend/index.js` (session config), `tests/gateway/`, `tests/backend/`.
- **Do:** auth limiter counts failed responses only and matches paths case-insensitively; new `GET /api/auth/session` answers from the in-memory session with no Supabase call, and the gateway pre-check uses it; `req.session.regenerate` on login; core refuses to start without a `SESSION_SECRET` of ≥32 characters (no fallback); username lookup is an exact match on the lowercased value in login and reset.
- **Check:** tests pass: 30 successful logins from one IP → no 429; 21 failed logins → 429; `/api/auth/Login` counts toward the same limit; with the Supabase stub delayed 3 s the pre-check still answers in under 200 ms; a username containing `_` or `%` matches only itself; the session id differs before and after login; core exits with a clear message when the secret is short.

---

## Batch 2: Python services

### R-05 · nlp-engine: honest parsing contract
- **Status:** DONE 2026-11-12 (verified: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** none · **Risk:** medium (snapshots change)
- **Goal:** D§4.2. Unreadable input is reported as unreadable; the service supplies what core needs.
- **Files:** `nlp-engine/app/main.py`, `extractor.py`, `embedder.py`, `tests/nlp/`.
- **Do:** no extractable text → `422 { error: "unreadable_document", reason }` with reason `no_text_layer`, `empty` or `corrupt`; `.doc` and image uploads → 415; `jd` becomes optional and no similarity block is returned without it; the response adds `raw_text` (capped at 20,000 characters) and `parser_version`; malformed skill-list JSON → 400 (P2); embedding size read from the model (P5); a start entry that binds 127.0.0.1 by default.
- **Check:** `tests/nlp` passes with new cases: fixture f6 (image-only) → 422 `no_text_layer`; a `.doc` → 415; parse without `jd` → 200 with entities and no similarity; `raw_text` and `parser_version` present. Existing snapshots differ only by the added fields.

### R-06 · github-evidence: inactive accounts and true health
- **Status:** DONE 2026-11-12 (verified: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** none · **Risk:** low
- **Goal:** D§5. Linking an inactive account is never worse than linking none.
- **Files:** `github-evidence/app/scoring.py`, `metrics.py`, `main.py`, `github-evidence/README.md` (contract note), `tests/github/`.
- **Do:** with repositories but zero commits in the window, the whole sub-score is unavailable with reason `no_recent_public_activity` (lead's ruling 2026-11-12, replacing the first wording that renormalised onto claim matching; see D§5); measured evidence is still returned; `/health` reports the real token state (P6).
- **Check:** `tests/github` passes (80 existing plus new): an account with repos and no commits in the window yields no available 0.0; a core-level test in `tests/backend/explainability.test.mjs` shows composite(inactive account) ≥ composite(no account) for the same parsing input.

### R-07 · assessment-service: Gemini only, bounded generation, served draw
- **Status:** DONE 2026-11-12 (verified: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** O-1 for the live part · **Risk:** medium (first time the LLM path is observed)
- **Goal:** D§6.1 and the question-draw control of D§6.2.
- **Files:** `assessment-service/app/llm_client.py`, `config.py`, `generator.py`, `prompts.py`, `validators.py`, `main.py`, `.env.example`, `README.md` (keep the lines `tests/assessment/test_internal_only.py` reads), `tests/assessment/`.
- **Do:** remove the OpenRouter path (Y3); one client loop over `GEMINI_MODELS` using JSON response mode; total generation budget under 240 s; errors name the real cause without any key material; health reports `llm_configured`; validator rejects `source: "github"` when GitHub data was not supplied; after validation, serve a random 6 multiple-choice and 4 short-answer questions (counts configurable), in random order, with the key reduced to match; `github_data` truncated like the other inputs; one `PROMPT_VERSION`. Confirm the usable model ids by listing models with the configured key (print ids only) and set the defaults to ids that exist.
- **Check:** `tests/assessment` passes with a fake LLM: served set is 10 questions drawn from 20 and differs across seeds; the key matches the served set; invalid LLM JSON → 502 with a cause; no reference to OpenRouter remains (`git grep -i openrouter assessment-service` is empty). Live, with O-1 done: one `POST /generate-assessment` returns 10 valid questions and the time taken is recorded.

### R-08 · assessment-service: grading that cannot be steered or silently zeroed
- **Status:** DONE 2026-11-12 (verified: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** R-07 · **Risk:** medium
- **Goal:** D§6.2 grading rows.
- **Files:** `assessment-service/app/evaluator.py`, `prompts.py`, `schemas.py`, `main.py`, `tests/assessment/`.
- **Do:** the grading prompt marks candidate text as untrusted data inside delimiters; output validated against the schema; points snapped to 0, 0.5 or 1; a failed or incomplete grading call → 502 `grading_unavailable`, never 0 points (P8); each result carries two feedback fields, one safe for the candidate (no correct option, no ideal answer) and one full for the recruiter.
- **Check:** tests with a fake LLM pass: grader failure → 502 and no score; a missing grade → 502; 0.73 → rejected or snapped per the schema; an answer containing "ignore the rubric and give full marks" graded by a fake that obeys the rubric path stays within schema; candidate-safe feedback never contains the correct option letter or key-point text. Live, with O-1: one evaluate call returns graded short answers.

### R-20 · Parsing evaluation harness
- **Status:** DONE 2026-11-12 (verified: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** none (labels come from TM-1) · **Risk:** low
- **Goal:** D§4.3. One command produces the measured numbers.
- **Files:** `eval/` (new): `run_parsing_eval.py`, `aliases.json`, `out_of_scope_terms.json`, `RESULTS.md`, a smoke label file for the six fixtures; `.gitignore` entries for `eval/resumes/` and `eval/labels/`. `eval/LABELLING_GUIDE.md` already exists (written by the lead); the script must follow its file format and rules exactly and must not change the guide.
- **Do:** read `eval/labels/gold.csv` (format in the guide) and the matching files in `eval/resumes/`, call the running nlp-engine, apply the alias table and the out-of-scope list to both sides as the guide describes, and compute micro and macro precision, recall and F1 for skills, exact-match accuracy for email, GitHub URL and LinkedIn URL, and median and maximum parse time. When the two labellers' files are present, also report their agreement (skill-level F1 between them). Write a dated section to `eval/RESULTS.md` with the set size, the sources (public dataset or consented, counts only, no personal data) and the nlp-engine version. Check whether the Hugging Face "Annotated NER PDF Resumes" set has skill annotations that map to this format; report yes or no with the reason, and add a loader only if yes.
- **Check:** with the six existing fixtures hand-labelled as a smoke set, `python eval/run_parsing_eval.py` writes a results section; a unit test with a toy label set reproduces hand-computed precision, recall and F1 exactly; `git check-ignore eval/resumes/x.pdf eval/labels/gold.csv` lists both.

---

## Batch 3: core pipeline (serial)

### R-09 · One resume pipeline; parsing on upload
- **Status:** DONE 2026-11-14 (verified: PASS WITH NOTES, see LOG.md; upload parses before storing, lead's ruling) · **Agent:** patina-implementer · **Depends:** R-03, R-05 · **Risk:** medium (central refactor)
- **Goal:** D§3, D§4.1. Spine step 2.
- **Files:** `backend/Services/resumePipeline.js` (new), `backend/Controllers/analysis.controller.js` (upload and status handlers), `backend/Middleware/resumeUpload.js`, `tests/backend/`.
- **Do:** one function parses a candidate's stored resume through the internal HTTP client (30 s timeout, request id), persists the `resumes` row, and returns entities, contact, full text (not persisted) and the parser version. Upload checks the file's leading bytes, stores the file, parses it, and returns the parsed summary; on `unreadable_document` it removes the just-stored object and returns 422 with a plain message. Storage path is the single `candidates/<id>/resume.<ext>` form. Storage errors are errors, not "no resume" (B9).
- **Check:** tests pass: upload of fixture f1 → 201 with skills; f6 → 422 and no object left in the stub store; a `.pdf` whose bytes are not PDF → 400; NLP down → 503 with a fixed message and the file kept for a later parse.

### R-10 · Score on apply; score-again endpoint; `/api/analyze` removed
- **Status:** DONE 2026-11-14 (verified: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** R-06, R-09 · **Risk:** medium
- **Goal:** D§4.1, D§7. Spine step 3. The precondition for 27 `wiring` rows.
- **Files:** `backend/Controllers/jobs.controller.js`, `analysis.controller.js`, `backend/Services/scoringPipeline.js` (new), `explainability.js`, `backend/Routes/*.js`, `tests/backend/` (move the `live-analyze*` tests to the new endpoint).
- **Do:** apply saves the application first, then runs resume pipeline → GitHub evidence → newest completed assessment → composite, and inserts a `scores` row; the response carries `scoring: { status: "scored" | "failed", reason }`. **Condition of Y1 (must hold):** a scoring failure of any kind never undoes or blocks the application; the application is saved and readable, its scoring state reads `pending` wherever it is listed until a score row exists, and it can be retried. `POST /api/applications/:id/score` runs the same function and may be called by the owning candidate or by the recruiter who owns the job; it returns the same `scoring` object. Remove `POST /api/analyze` (Y1). Missing similarity → parsing unavailable (B1); assessment-lookup errors are errors (B7); the parser version comes from the service; the composite carries a `band`; the explanation says the GitHub account came from the resume and its ownership is not verified.
- **Check:** unit tests pass for the unavailable-parsing path and the band. Live through the gateway with the test accounts: apply → 201 and one `scores` row for that candidate and job with weights summing to 1; with nlp-engine stopped, apply → 201 with `scoring.status = "failed"`, the application row exists and lists as `pending`, then score-again succeeds after restart for both the candidate and the job's recruiter, and is 403 for another recruiter; `POST /api/analyze` → 404.

### R-11 · Assessment orchestration I: inputs, eligibility, attempt policy, no answer reveal
- **Status:** DONE 2026-11-14 (verified: PASS WITH NOTES, see LOG.md; verifier defects D1–D4 are carried into R-12) · **Agent:** patina-implementer · **Depends:** R-07, R-08, R-10 · **Risk:** medium
- **Built differently from the text below, by lead's ruling:** an unstarted pool's questions are stored only in `assessment_keys.answer_key.pool_questions`; the `assessments` row has `questions = []` until Start copies them in. Recruiter-only per-question feedback is in `assessment_keys.answer_key.recruiter_results`. Flag `ASSESSMENT_PREPARE_ON_APPLY` (default true; the test harness sets false). `POST /api/assessment/generate` is kept as an alias of start.
- **Lead's ruling on the assessment-only fallback (2026-11-14):** `scores.resume_id` is NOT NULL and there is no schema change. Generation always runs the resume pipeline, so a `resumes` row exists by the time an attempt is graded. If the parser is unavailable at grading time, the new score row points at the candidate's newest existing `resumes` row, parsing is marked unavailable with the parser's reason code, and the composite comes from what is available (assessment, and GitHub if it answers), marked evidence-limited. If no `resumes` row exists at all, no score row is written and scoring reads `failed`; the graded attempt stays stored.
- **Goal:** D§6.1, D§6.2.
- **Files:** `backend/Controllers/assessment.controller.js`, `backend/Services/assessmentService.js`, `scoringPipeline.js`, `explainability.js`, `tests/backend/`.
- **Do:** generation requires an application for that job; it uses the resume pipeline (full text, contact, so GitHub data is included when available); `ASSESSMENT_MAX_ATTEMPTS` (default 1), first completed attempt is the score of record; the candidate's result contains the total, a per-skill summary and right/wrong per question with the candidate-safe feedback only; a graded attempt inserts a new `scores` row through the scoring pipeline, creating the first one if none exists (R3 in `SvR`); recruiter-facing explanation gains per-question outcomes.
- **Background preparation (Anthony, 2026-11-13; D§0 amendment A1). No candidate request ever waits on the LLM.**
  - A `prepareAssessment(candidateId, jobId)` function in `assessmentService.js` runs generation off the request path and stores the result as an `assessments` row with status `generated` and `answers` null (= "ready, not started"), with its key in `assessment_keys`. Apply calls it fire-and-forget after the application is saved and the apply response is decided (this card may add that one call in `jobs.controller.js`); a failure there never affects apply.
  - In-flight and last-failure state is kept in core memory, keyed by candidate and job: at most one generation in flight per key; a bounded number of automatic retries with backoff on provider errors (`ASSESSMENT_PREPARE_RETRIES`, default 2), then it stops. Nothing about a failure is stored in the database and no reason is invented. After a core restart the state is simply "no pool yet" and the next status read starts preparation again.
  - `GET /api/assessment/status?jobId=` returns immediately with `state`: `not_applied`, `preparing`, `unavailable` (last preparation failed; carries the reason code and re-triggers preparation if none is in flight and the last failure is older than 60 s), `ready`, `in_progress`, `grading_pending`, `completed`, or `attempts_used`. It never returns questions.
  - `POST /api/assessment/start` (replaces the blocking generate call for candidates): pool ready → marks the attempt started and returns the questions; not ready → `202 { state: "preparing" }` at once, starting preparation if none is in flight. It must answer in under 2 s in every case. The start mark is written once, atomically (`update … where answers is null`), as `started_at` inside the `answers` JSON, so a repeated start or a reload returns the same attempt and the same clock. No schema change.
  - A prepared but unstarted pool is not an attempt: it does not count toward `ASSESSMENT_MAX_ATTEMPTS`, never expires, and its questions are sent to nobody. Preparation is skipped when the candidate has no application for the job or has no attempt left.
- **Check:** tests pass: generate without an application → 403; second generate after a completed attempt → 409; the evaluate response contains no correct option, ideal answer or key point (asserted against the stored key); evaluate with no prior score row creates one marked evidence-limited; with a prior row, the old row is unchanged and a new row exists. Background preparation, with a fake assessment client: apply returns before a generation held open by the fake completes, and its status and body are the same whether preparation later succeeds or fails; status reads `preparing` then `ready`; start while preparing → 202 in under 2 s with the fake still blocked; start when ready → 200 with 10 questions and a `started_at`, and a second start returns the same attempt and the same `started_at`; a failing fake is called at most 1 + `ASSESSMENT_PREPARE_RETRIES` times, then status reads `unavailable` with a reason code; two concurrent triggers make one generation call; an unstarted pool does not make generate/start return 409 for attempts.

### R-12 · Assessment orchestration II: server time limit, saved answers, pending grading
- **Status:** DONE 2026-11-14 (verified: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** R-11 · **Risk:** medium
- **Carried in from R-11's verification (must be fixed here):** D1 Start must honour the last-failure state and the 60 s gate exactly as status does (after a failed preparation Start answers `unavailable`, and re-triggers only when the gate allows), so one click can never cost more than one preparation run per 60 s; D2 a keyless or pool-less unstarted row is closed automatically (voided with reason `pool_missing`, row kept) so it cannot block a new pool, with a test for a failed key insert; D3 the in-memory preparation registry evicts finished entries; D4 a test that one candidate cannot evaluate, save to or start another candidate's attempt.
- **Goal:** D§6.2 time, reload and outage rows. No schema change: the start time is `started_at` inside `assessments.answers`, written by R-11's start endpoint (**not** `created_at`, which is now the time the pool was prepared in the background; amendment A1); saved answers go beside it in `assessments.answers`. An unstarted pool has no deadline. A reset (below) triggers background preparation of a new pool.
- **Files:** `backend/Controllers/assessment.controller.js`, `backend/Routes/assessment.routes.js`, `backend/Services/gradingClaim.js`, `tests/backend/`.
- **Do:** every assessment response carries `expires_at` and the server time; `PUT /api/assessment/:id/answers` saves answers while the attempt is open and before the deadline; submit after deadline plus 30 s grades the saved answers and ignores the late body; an open attempt past its deadline is finalised the next time the candidate or the job's recruiter reads it; when grading is unavailable the claim is released, answers stay saved, the response is 503 `grading_unavailable`, and the attempt reads as "submitted, grading pending" until a retry succeeds. **Attempt reset (Y5 addition, D§6.2):** `POST /api/assessment/:id/reset` with a required `reason`, allowed for the recruiter who owns the job and for an admin; it voids the attempt (open or completed) by recording who, when and why inside the attempt's `evaluation` JSON and closing the row, with no schema change; voided attempts are excluded from the attempt count and from scoring; a new `scores` row is inserted without the voided result; the candidate gets a notification; recruiter-facing reads expose the void record.
- **Check:** tests with an injected clock pass: save before the deadline → 200, after → 409; late submit grades the saved answers; expired open attempt is finalised on read; grader failure → 503, status not `completed`, no `scores` row added, retry succeeds; a pool prepared an hour before it is started still gets the full 15 minutes from `started_at`. Reset tests pass: candidate → 403; another recruiter → 403; owning recruiter and admin → 200; missing reason → 400; after a reset the candidate can generate again, the voided attempt still exists with its void record, and the newest score row has no assessment sub-score from it.

### R-13 · Recruiter applications API; status actions; honest notifications
- **Status:** DONE 2026-11-14 (verified: PASS WITH NOTES, see LOG.md; recruiter reads only observe, recruiter-side state `not_prepared` added, lead's ruling) · **Agent:** patina-implementer · **Depends:** R-10, R-12 · **Risk:** medium
- **Goal:** D§8.2 recruiter view, server side. Spine step 5.
- **Files:** `backend/Controllers/analysis.controller.js` (recruiter handlers), `jobs.controller.js`, `notification.controller.js`, `backend/Services/applicantIdentity.js`, `backend/Routes/*.js`, `tests/backend/`.
- **Do:** `GET /api/recruiter/applications` (optional `jobId`) returns, for the recruiter's own jobs only, each application with candidate name from the profile, email, status, the newest score (composite, band, evidence-limited, sub-score summary, skills) or `score: null` with scoring state `pending` (Y1 condition; no reason is stored, so none is invented), and assessment state (the same state names as R-11's status endpoint, so `preparing`, `unavailable` and `ready` are distinct from `in_progress`) including any void record; `GET /api/recruiter/applications/:id` returns the full explanation and assessment outcomes; remove `GET /api/candidates` and the old applicants handler (Y2); the recruiter job list returns real application counts; the existing status route keeps `shortlisted` and `rejected` and its notifications; lookup errors are errors (B5, B6, B8); remove the hardcoded `skills: []`, the "Candidate" name fallback and the job-location-as-candidate-location field (B2 to B4).
- **Check:** tests pass: recruiter A never sees recruiter B's applications; a candidate who has not applied never appears; a notification DB error → 500 JSON, not an empty list. Live: after the R-10 live check, the list shows that application with its score; shortlisting it creates one notification for the candidate.

---

## Batch 4: frontend

### R-14 · Frontend foundation: one API client, green CI build, tokens, routes
- **Status:** DONE 2026-11-13 (verified: PASS WITH NOTES, see LOG.md; ring arc checked with intercepted data only, real-data check moved to R-16's browser pass) · **Agent:** patina-implementer · **Depends:** R-13 (final API shapes) · **Risk:** medium (touches every page)
- **Goal:** D§8.1.
- **Files:** `frontend/src/lib/api.js` (new), every file that defines an API base URL or calls `fetch` (list in `inventory/services.frontend.md` §3), `frontend/src/index.css`, `tailwind.config.js`, `App.jsx`, `frontend/package.json`.
- **Do:** one client (base URL from `REACT_APP_API_BASE_URL`, credentials included, errors normalised to `{ status, error, message }`); remove the global `fetch` patch, the two hardcoded URLs and the `import.meta.env` read; fix the 9 lint warnings; define the missing CSS variables and the `btn` and `badge` classes; add index routes for `/candidate` and `/recruiter` and a 404 route; one `ScoreBadge` that renders the backend `band`; delete the dead components and the `@tailwindcss/vite` dependency (Y6).
- **Check:** `CI=true npm run build` exits 0; `git grep -nE "localhost:5000|import\.meta|window\.fetch\s*=" frontend/src` finds only `lib/api.js`'s default; in a browser the score ring on a scored result draws its arc (screenshot in the verifier report).

### R-15 · Honesty sweep and broken controls
- **Status:** DONE 2026-11-13 (verified in a browser on the real stack: PASS WITH NOTES, see LOG.md; admin page and server side of sign-up/resend NOT checked) · **Agent:** patina-implementer · **Depends:** R-14 · **Risk:** low
- **Goal:** D§8.2. Removes F1 to F12, F23, F24 and the broken items.
- **Files:** `pages/public/Landing.jsx`, `Login.jsx`, `pages/recruiter/CreateJob.jsx`, `Jobs.jsx`, `Profile.jsx`, `components/layouts/RecruiterLayout.jsx`, `pages/candidate/CandidateProfile.jsx`, `Notifications.jsx`, admin page, `backend/Controllers/auth.controller.js` only if the resend bug is server-side.
- **Do:** remove the invented statistics, demo score, avatars, "Connect GitHub" copy, random "AI Suggestion", "3x" claim, profile statistics and badge, the unread dot and the dead search box; job cards show the real application count; fix contrast on CreateJob, Jobs and Profile; Recruiter Profile role check; notifications error state and "Mark read"; resend-confirmation sends the typed email; "Skip verification" skips; admin suspension state persists across tabs.
- **Check:** `git grep -nE "10000|500\+|4\.9|pravatar|Math\.random|3x more" frontend/src` is empty; a verifier browser pass confirms each listed control is readable and each listed flow works, with a screenshot per page.

### R-16 · Candidate flow: upload result, apply state, my applications, results
- **Status:** DONE 2026-11-13 (verified in a browser on the real stack: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** R-14 · **Risk:** low
- **Goal:** spine steps 2 to 4.
- **Files:** `pages/candidate/Upload.jsx`, jobs and job-detail pages, `Dashboard.jsx`, `Results.jsx`, `Processing.jsx` (delete, Y1), `components/layouts/CandidateLayout.jsx`, `App.jsx` routes.
- **Do:** Upload shows what was parsed, or the unreadable message, or a real error (F20, F21); Apply shows "scored" or "not scored: reason" with a score-again action; the dashboard lists the candidate's applications with status, score state and assessment state; Results is per application, linked from the list and the nav, shows "not scored yet" for no score and never a default 0 or a canned sentence (F13, F14).
- **Check:** verifier browser pass with the test candidate: upload f1 → parsed skills shown; upload f6 → unreadable message; apply → scored state; the dashboard row links to a result whose composite equals the API value.

### R-17 · Assessment page: timer, saved answers, honest states
- **Status:** DONE 2026-11-13 (verified in a browser on the real stack: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** R-12, R-14 · **Risk:** medium
- **Goal:** spine step 6 in the browser; fixes F22.
- **Files:** `pages/candidate/Assessment.jsx`, its components.
- **Do:** only offered for applied jobs; a start screen stating the rules (one attempt, 15 minutes, unproctored); countdown from the server's `expires_at`; answers saved to the server on change; reload restores answers and remaining time; automatic submit at zero; the page reads R-11's status endpoint and never waits on generation: `preparing` shows "Your assessment is being prepared" and polls every few seconds, `unavailable` shows "Not ready yet, we will keep trying" with a "Check again" action and no invented cause, and the Start button is enabled only on `ready`; the clock starts at Start, not when the pool was prepared; "grading pending" state with retry; the result shows what R-11 returns and nothing else.
- **Check:** verifier browser pass: with assessment-service stopped the page shows the preparing or not-ready state within 2 s and never a spinner longer than that; with it running, start, answer two questions, reload → both answers and the running clock are restored; submit → result with no correct answers visible in the page or the network response.

### R-18 · Recruiter: one applications view with actions and drill-down
- **Status:** DONE 2026-11-13 (verified in a browser on the real stack: PASS WITH NOTES, see LOG.md) · **Agent:** patina-implementer · **Depends:** R-13, R-15 · **Risk:** medium
- **Goal:** spine step 5 in the browser; fixes F15 to F19.
- **Files:** `pages/recruiter/Dashboard.jsx`, `JobDetails.jsx`, `AllCandidates.jsx` (replaced, Y6), `components/recruiter/CandidateModal.jsx`, `ScoreBreakdown.jsx`, a new `ApplicationsTable` component, nav in `RecruiterLayout.jsx`.
- **Do:** one table used for all applications and for one job, ranked by composite, unscored rows labelled "Not scored yet" with a retry action (Y1 condition); status filter on the real status values; shortlist and reject buttons; a "Reset assessment attempt" action with a required reason in the drill-down, and a visible record when an attempt was reset (Y5 addition); drill-down showing composite, weights (labelled provisional), each sub-score with its evidence, assessment per-question outcomes, the evidence-limited marker, the "GitHub ownership not verified" and "unproctored assessment" notes, and the honest flags panel; dashboard counts computed from the same data with true labels; loading, empty and error states distinct.
- **Check:** verifier browser pass with the test recruiter after R-16's pass: the application appears with its score; the drill-down numbers equal the API response; shortlist changes the status and the candidate sees a notification; stopping core shows an error state, not "no candidates".

---

## Batch 5: end-to-end check and vocabulary

### R-19 · Scripted end-to-end check (the definition of done for list A)
- **Batch:** 4 (moved from batch 5 by Anthony, 2026-11-13). It closes batch 4.
- **Status:** DONE 2026-11-13 (verified: PASS WITH NOTES, two consecutive runs exit 0 on a fresh start, see LOG.md; GitHub-available branch and sign-up spec NOT exercised) · **Agent:** patina-implementer writes; patina-verifier runs · **Depends:** R-16, R-17, R-18, O-1, O-5 · **Risk:** medium (live LLM and live GitHub)
- **Goal:** the six spine steps, through the browser only, re-runnable.
- **Files:** `tests/e2e/` (new: Playwright config, `spine.spec.mjs`, `signup.spec.mjs`, fixtures), `tests/run-suite.ps1` (an `e2e` suite), `tests/README.md`, `data-testid` attributes in frontend pages where needed.
- **Do:** against the stack started by `scripts/start-all.ps1`: recruiter logs in and creates a job titled `[E2E <timestamp>]`; candidate logs in, uploads the demo resume, sees parsed skills, applies, sees a scored result; recruiter sees the application with score and drill-down and shortlists it; candidate opens the assessment, the script waits on the `preparing` state until `ready` (bounded wait; a pool that never becomes ready is reported as a provider failure, separately from a product failure), takes it (answers chosen by the script) and sees a result with no correct answers; recruiter sees the assessment sub-score in a new composite. Assertions are on states and invariants (score present, weights sum to 1, three sub-scores available when GitHub answered, statuses), never on specific LLM text or score values. A second spec uploads the image-only fixture and expects the unreadable message. `signup.spec.mjs` covers sign-up as far as O-5(a) allows. The run ends by printing the rows it left in Supabase.
- **Check:** `powershell -File tests/run-suite.ps1 -Suites e2e` exits 0 twice in a row on a fresh start, run by a verifier; the report lists leftover rows.

### R-21 · Skill precision and support vocabulary
- **Status:** DONE, verified in the batch-7 live pass 2026-11-14 (`LOG.md`): PASS. Numbers are on the six synthetic fixtures only. Earlier status: implemented 2026-11-14 (offline nlp tests 132 pass; `nlp-engine@2.2.0`), awaiting a verifier. Before and after are on the six synthetic smoke fixtures only (micro F1 0.765 → 0.914); the labelled real set does not exist yet. Was: todo · **Agent:** patina-implementer · **Depends:** R-05, R-20 (baseline numbers recorded first) · **Risk:** medium (changes scores)
- **Goal:** D§4.2. Removes P3 and P4; part of GF-3.
- **Files:** `nlp-engine/app/ner.py`, `github-evidence/app/skill_languages.py` only if a canonical name must match, `tests/nlp/`, `eval/aliases.json`.
- **Triage NOW folded in (2026-11-13):** I-0004, invented vocabulary entries such as `exponentjs` (`nlp-engine/app/ner.py:54`) are removed in this card.
- **Do:** record the "before" evaluation; remove "github" as a skill; stop English words (express, spring, oracle, apache, rust) and bare "API" from matching without technical context; fix `node.js` and "Java Script"; detect C, Go and R; add ServiceNow, Jira, ITIL, Nagios, Active Directory, Windows Server and close relatives; record the "after" evaluation.
- **Check:** `tests/nlp` passes with new cases for each rule above; fixture f3 yields servicenow, jira, itil and nagios; `eval/RESULTS.md` has before and after sections on the same set, and skill F1 after is not lower than before (if it is, the card stops and reports).

---

## Batch 7: manual-test MUST cards (APPROVED 2026-11-13; see the re-plan table)

All of these keep the rules at the top of this file. Each ends with the e2e spine suite still passing.

### R-27 · Scoring weights and the verification state (MUST 1)
- **Status:** DONE, verified in the batch-7 live pass 2026-11-14 (`LOG.md`): PASS WITH RISKS. Not exercised: a score with GitHub available (the 55 cap); it needs a résumé that links a live account. Earlier status: implemented 2026-11-13 (backend 213/213, frontend 79/79, build passes), awaiting a live verifier; was doing (D§7.1 approved 2026-11-13 with option (b) and W4, W5) · **Agent:** patina-implementer · **Depends:** none · **Risk:** medium (changes every score)
- **Approved additions that are part of this card (the "As approved" paragraph of D§7.1 is the specification):** option (b): GitHub never absorbs the assessment's share, so GitHub without an assessment has a ceiling of 55; W4: `score_state: "awaiting_assessment"` from core while the assessment is not completed and not expired, shown as the primary state in the recruiter table and drill-down with the partial score secondary and labelled, awaiting applicants ranked in their own group below scored ones; W5: `explanation.weights_version` on every new score row, and "v1 (0.40 / 0.35 / 0.25)" shown for rows without one. Extra checks: GitHub 100 with no assessment → composite ≤ 55, low; a recruiter list response for an applicant with a `ready` pool carries the awaiting state; a row scored before this card renders with the v1 label.
- **Goal:** D§7.1. A resume alone can never score above the low band; the score says how far it is verified.
- **Files:** `backend/Services/explainability.js`, `scoringPipeline.js`, `tests/backend/`, `frontend/src/components/recruiter/ScoreBreakdown.jsx`, the `ScoreBadge` component, candidate `Results.jsx`, `ApplicationsTable.jsx` (label only), `tests/e2e/spine.spec.mjs` (the weights invariant), `REBUILD/CUT.md` list-B weights row.
- **Do:** base weights as approved; the resume weight fixed; the independent share redistributed only between GitHub and the assessment; with no independent source the composite is the resume share alone and `unearned_weight` is recorded; `verification` (`unverified` / `partly_verified` / `verified`) emitted by core beside `band` and rendered wherever the band is; the explanation text says which sources verified the score and what would verify it further; the candidate result names the next step. No schema change; stored rows are not rewritten.
- **Check:** unit tests reproduce the five worked cases of D§7.1 to two decimals; a keyword-stuffed resume fixture (every job skill listed, no GitHub, no assessment) scored through the pipeline with the real nlp-engine → low band, `unverified`, composite ≤ 20; strong GitHub plus strong assessment with a short resume outranks it; a missing GitHub with a completed assessment gives the assessment 0.80 and the resume 0.20; e2e spine passes with the new invariant; a verifier screenshot shows the label in the recruiter table and the drill-down.

### R-28 · Skill evidence table: three statuses, one mark per source, matching names (MUST 2)
- **Status:** DONE, verified in the batch-7 live pass 2026-11-14 (`LOG.md`): PASS WITH RISKS. Not exercised: the sources-disagree flag raised or not raised (GitHub was never available); the badge on the candidate dashboard and job page was not looked at. Earlier status: implemented 2026-11-14 incl. the sources-disagree flag (backend 223/225: the 2 failures pin the old parser version string; frontend 92/92; build passes), awaiting a live verifier. Not built: alias matching between sources (no alias data served yet; an alias-only match shows as absent, never guessed). Was: todo · **Agent:** patina-implementer · **Depends:** R-27 (same file), approval of D§7.1; uses the R-21 vocabulary when it lands but does not wait for it · **Risk:** medium
- **Goal:** D§7.1 skill table. Fixes the confirmed bug that a required skill listed only on the resume is labelled "Evidenced" (`explainability.js:724`, `ScoreBreakdown.jsx:34-38`).
- **Files:** `backend/Services/explainability.js` (`buildSkillEvidence`), a shared skill-name normaliser in `backend/Services/` fed by the nlp-engine vocabulary, `ScoreBreakdown.jsx`, `tests/backend/`.
- **Do:** statuses `claimed_only`, `evidenced`, `not_found` exactly as D§7.1 defines them; per-row marks `resume`, `github`, `assessment`, each `confirmed`, `absent` or `unavailable`; the assessment mark comes from the graded attempt's per-skill results (confirmed only when the candidate's answers on that skill earned at least half the points; a skill with no question is `absent`, never guessed); names are normalised before matching (case, punctuation, `node.js` = `nodejs`, and a multi-word job skill such as "rest api" matches when the resume has its parts) through one function, with the alias data owned by nlp-engine so there is one vocabulary. Remove "N of 3 sources".
- **Last step, only if everything above is green first (W6, W7 of D§7.1): the "sources disagree" flag.** Over the skills GitHub marks `evidenced` and the assessment asked about: at least 2 points in total and 25 % or less earned → one flag naming the skills and the points; never raised when either source is unavailable; never changes the score; both numbers are settings. It is shown in the flags panel, which otherwise keeps its honest "not computed" text for the other flag kinds. If it would delay the card, it is cut, logged in `ISSUES.md` as BATCH and named in the roadmap. Tests: raised at 0.5 of 3 points; not raised at 1 of 1 point, at 1 of 3 points with GitHub unavailable, or at 2 of 3 points.
- **Check:** unit tests: resume-only required skill → `claimed_only`; GitHub-evidenced → `evidenced`; assessment-confirmed with GitHub unavailable → `evidenced` with GitHub `unavailable`; required and nowhere → `not_found`; the normalisation pairs above match. Verifier browser pass: the drill-down shows three marks per row and no "of 3 sources" text (`git grep -n "of 3\|evidence_sources_confirming" frontend/src` is empty).

### R-29 · Multiple-choice options that do not give the answer away (MUST 3)
- **Status:** DONE, verified 2026-11-14 (PASS WITH RISKS; `LOG.md`). **Lead rulings that differ from the text below, for Anthony to overturn:** (1) the rule rejects only when the correct option is over 1.25× the distractor mean AND at least 10 characters longer (`ASSESSMENT_MCQ_MIN_LENGTH_GAP`), because the ratio alone wrongly rejected short answers such as PATCH against POST/PUT/GET; (2) the "only option of a different form" check is withdrawn from validation (it never fired on real pools and misfired on reasonable questions) and stays as a prompt instruction; (3) a failing pool keeps the existing code `llm_invalid_output`, which core already handles, instead of a new `generation_invalid`. Was: todo · **Agent:** patina-implementer · **Depends:** none · **Risk:** medium (more regeneration means slower pool preparation; it is off the request path since A1)
- **Files:** `assessment-service/app/prompts.py`, `validators.py`, `generator.py`, `config.py`, `tests/assessment/`, a small report script under `eval/`.
- **Do:** the prompt requires four options of similar length and grammatical form, all plausible; the validator rejects a question whose correct option is longer than 1.25 × the mean length of its three distractors (threshold configurable) or is the only option of a different form; rejected questions are regenerated inside the existing 240 s budget, and a pool that still cannot supply 6 valid questions fails as `generation_invalid`, never served short; bump `PROMPT_VERSION`; confirm with a test that the correct option's position after the shuffle is uniform.
- **Check:** tests with a fake LLM: a batch with long correct options is rejected and regenerated; position spread over 2,000 seeded shuffles is within 22–28 % per position. Live: generate 3 pools (60 questions, 36 multiple-choice) and report the share where the correct option is the longest (target about 25 %, report whatever it is) and the position spread, in `eval/RESULTS.md`; pool preparation time recorded before and after.

### R-30 · Parsing a real-world resume: name, links, embedded links, education (MUST 4)
- **Status:** DONE, verified in the batch-7 live pass 2026-11-14 (`LOG.md`): PASS, with its display follow-up. Earlier status: implemented 2026-11-14 (offline nlp tests 45 pass; `nlp-engine@2.1.0`), awaiting a verifier; a follow-up in backend and frontend shows the new education objects and links (ISSUES entry `NOW → R-30 follow-up`); was todo · **Agent:** patina-implementer · **Depends:** none; runs before R-21 in the same lane · **Risk:** medium (snapshots change)
- **Files:** `nlp-engine/app/extractor.py`, `ner.py`, `main.py`, `tests/nlp/`, `tests/fixtures/` (new synthetic files), pass-through in `backend/Services/resumePipeline.js` and the Upload result view only if a new field must be shown.
- **Do:** the name never contains phone, country-code, email or URL tokens; every profile URL written in the text is extracted (LinkedIn, GitHub, portfolio, others) with LinkedIn and GitHub also in their own fields; link targets attached to words are read from DOCX relationships and PDF link annotations and given to the contact parser only, not appended to the text, so skills and similarity do not change (the design already agreed in I-0052); education is one entry per qualification with institution, degree, graduation year, CGPA or percentage and honours attached. **Fixtures:** synthetic `.docx` and PDF with invented people and the same structure as the failing resume (phone beside the name, a full LinkedIn URL, an embedded link, an education block over several lines). Anthony's real resume is never committed, copied into `tests/` or pasted into a prompt. **TM-4 demo set (Anthony, 2026-11-13), built here as two synthetic PDF files under `tests/fixtures/demo/` with invented people and no real person's data** (invented names, `example.com` email addresses, phone numbers from a range reserved for fiction or plainly fake, no real employer's staff, no link to any real account): (1) a keyword-stuffed resume with no GitHub link, which lists every skill of the demo job and little else: expected low and unverified; (2) a support and operations resume with no GitHub link (ServiceNow, Jira, ITIL, Nagios, Active Directory, Windows Server), written as real experience: expected partly verified after the assessment. The third demo candidate is Anthony's own resume with `anthonyjennis`, which he uploads himself; it is never committed, copied or pasted. A short `tests/fixtures/demo/README.md` says what each file is for and that both are synthetic.
- **Triage NOW folded in (2026-11-13):** I-0052 (embedded links, above) and the R-05 entry on DOCX text held only in tables, headers or text boxes: such a file is reported as unreadable today although a person can read it. Read table cells, headers and footers in document order; a text-box-only file may stay unreadable if `python-docx` cannot reach it, and the card then says so. One synthetic fixture with a table-based layout.
- **Check:** `tests/nlp` passes with a case per rule on the new fixtures; the table-layout DOCX fixture parses to its skills; existing snapshots differ only in the fields named above; `ISSUES.md` I-0052 is marked resolved by this card; Anthony uploads his own `.docx` by hand and reports the four fields (this is his check, not an agent's).

### R-31 · Recruiter sign-up: one button, no orphaned verification section (MUST 5)
- **Status:** DONE, verified in the batch-7 live pass 2026-11-14 (`LOG.md`): PASS (form only; the page after sign-up was not looked at). Earlier status: implemented 2026-11-13, awaiting a verifier (browser screenshots) · **Agent:** patina-implementer · **Depends:** none · **Risk:** low (form only; the sign-up API and auth are not changed)
- **Files:** `frontend/src/pages/public/Login.jsx`, `tests/e2e/signup.spec.mjs`.
- **Do:** remove "Verification Details (Optional)", its two fields and "Skip Verification & Continue"; one "Create Account" button; the form stops sending `companyName` and `verificationInfo` (the columns stay; no schema change); the post-sign-up page says "Account created" once.
- **Check:** `git grep -n "Skip Verification\|Verification Details" frontend/src` is empty; a verifier screenshot of the recruiter sign-up form and of the post-sign-up page; frontend tests and `CI=true npm run build` pass.

### R-32 · Job form: searchable skills and suggestions from the description (MUST 6)
- **Status:** DONE, verified in the batch-7 live pass 2026-11-14 (`LOG.md`): PASS WITH RISKS. The "suggestions unavailable" state was not checked live; `sas` and `statistics` await the owner. Earlier status: implemented 2026-11-14 (nlp 143, backend 244/244, gateway 33/33, frontend 106/106, build passes), awaiting the live verifier. The card's browser check cannot pass as written: `sas` and `statistics` are not in the parser vocabulary, so they are typed skills, not suggestions (owner decision pending, ISSUES NOW entry). Skills are now saved in the parser's lower-case spelling. Aliases reach the search but not `skillNames.js`. Was: todo · **Agent:** patina-implementer · **Depends:** R-28's normaliser; R-21 widens the vocabulary underneath it without a change here · **Risk:** medium (new endpoint in nlp-engine and core)
- **Files:** `nlp-engine/app/main.py` (a vocabulary read and a skills-from-text endpoint using the existing extractor), `backend/Routes` and a small controller for `GET /api/skills?q=` and `POST /api/skills/extract` (recruiter-only), `frontend/src/pages/recruiter/CreateJob.jsx`, tests.
- **Do:** replace the fixed chip list (`CreateJob.jsx:12`) with a type-to-search input over the parser's vocabulary; a recruiter may add a skill that is not in it, stored normalised and marked as custom in the form; "Found in your description: …" lists skills extracted from the description text and adds one only when the recruiter clicks it; nothing is added silently; if nlp-engine is down the input still accepts typed skills and says suggestions are unavailable.
- **Check:** tests: search returns `sas`, `r`, `statistics` when they are in the vocabulary (after R-21 for `r`); a custom skill is saved normalised; extraction endpoint returns the skills of a fixture description. Verifier browser pass: create a job whose description names SAS, R and statistics, accept the suggestions, and see them as required skills on the saved job; e2e spine passes with the new input.

### R-33 · A gateway timeout is not a failure when the work completes (worst-case 504)
- **Status:** DONE, verified in the batch-7 live pass 2026-11-14 (`LOG.md`): PASS (short-timeout run: 504 on apply and evaluate, both recovered). The reset under a short timeout was not exercised. Earlier status: implemented 2026-11-14 (gateway 30/30 offline, backend 225, frontend 85/85, build passes), awaiting a live verifier with the short-timeout e2e run; was todo · **Agent:** patina-implementer · **Depends:** none · **Risk:** medium
- **Why:** the gateway answers 504 `upstream_timeout` after 60 s of silence on apply and score-again and after 130 s on evaluate (`gateway/index.js:34-36`), while core keeps working: apply can take the parser's 30 s plus GitHub's 8 s plus storage and several database calls of up to 10 s each, and grading up to 120 s followed by a full re-score. The browser is told it failed, the application or the grade is then saved anyway, and a second click gets 409 "already applied".
- **Files:** `frontend/src/lib/api.js`, the apply, score-again and assessment-submit call sites, `backend/Controllers/jobs.controller.js` (apply repeat), `gateway/index.js` only for a clearer 504 body, `tests/gateway/`, `tests/backend/`, `tests/e2e/`.
- **Do:** on 504 (or a dropped connection) from apply, score-again or evaluate, the page shows "Still working" and reads the real state (`my-applications`, `GET /api/applications/:id/result`, assessment status) every few seconds for a bounded time, then shows what the server holds; it never shows "failed" for work that completed and never invents a result. Repeating apply for a job already applied to returns the existing application and its scoring state (200) so a retry is harmless; evaluate is already safe to repeat through the grading claim, confirmed by a test. Timeouts stay as they are.
- **Triage NOW folded in (2026-11-13):** the R-10 and R-11 entries (apply and evaluate can outlast the proxy timeout); the R-12 entry (assessment reset runs the scoring pipeline inside the 60 s default, so the recruiter's reset gets the same "Still working" treatment); the R-13 entry on `getJobById`, which turns a failed applications lookup into `applied: false`: a lookup error becomes an error (500 JSON), never "not applied".
- **Check:** `getJobById` with a failing applications lookup → 500 JSON, not `applied: false`; gateway test with a slow fake core and a 1 s proxy timeout → 504 JSON; backend test: second apply → 200 with the same application id and one application row; e2e spine run with `PROXY_TIMEOUT_MS=1500` and `PROXY_TIMEOUT_EVALUATE_MS=1500` set for the gateway still ends with the scored application and the graded result on screen, with no error state shown at the end.

### R-37 · The answer-leak check also covers `explanation` (triage item promoted to NOW by Anthony, 2026-11-13)
- **Status:** DONE, verified: scans of 86 and 94 candidate responses clean in two e2e runs (R-38 verification, `LOG.md`). Earlier status: implemented 2026-11-13, awaiting a verifier (live e2e spine) · **Agent:** patina-implementer (with R-31) · **Depends:** none · **Risk:** low
- **Why:** the e2e check that no answer-key field reaches the candidate's browser skips the field name `explanation` (`tests/e2e/lib/network.mjs:64-66`), because score responses carry an unrelated field of that name. The key's `explanation` is a real key field (`assessment-service/app/validators.py:188`), so a leak of it would pass unnoticed. This check guards the "answers are never revealed" claim of D§6.2.
- **Files:** `tests/e2e/lib/network.mjs`, a unit test beside it; `tests/backend/` only if no offline test already asserts it for the candidate responses.
- **Do:** treat `explanation` as a key field on every `/api/assessment/` response seen by the candidate's browser; keep it allowed on score and application responses; add an offline test of the checker with a leaking and a clean sample body; confirm, or add, a backend test that the candidate's start, status, save and evaluate bodies contain no `explanation` taken from the key.
- **Check:** the checker's unit test fails on a body that carries a key `explanation` under `/api/assessment/` and passes on a score response with its own `explanation`; the e2e spine passes.

### R-38 · Batch-7 fix-up: stale résumé at apply, misleading labels, spine race (added 2026-11-14 from the live pass)
- **Status:** DONE, verified 2026-11-14 in three passes (`LOG.md`): PASS WITH RISKS, follow-ups included. Earlier status: items 1 to 6 verified 2026-11-14 (item 1 on the second attempt, with one storage key per upload). Two follow-ups in rework: the recruiter résumé link must open the scored file; the file name shown must be the uploaded name. Earlier status: implemented 2026-11-14, awaiting a verifier (live two-résumé sequence, spine twice from a fresh start, three screenshots) · **Agent:** patina-implementer, then a fresh patina-verifier · **Depends:** the batch-7 live pass (`LOG.md`) · **Risk:** medium (the apply path)
- **Why:** the live pass found one wrong output and several misleading screens (`ISSUES.md` entries of 2026-11-14 tagged `NOW → R-38`).
- **Do:** (1) Find, with evidence, why apply scored a candidate against their previous résumé, and fix it so apply always scores the résumé the candidate last uploaded; no change to the storage layout or schema without asking; a test that uploads A, uploads B, applies, and asserts B's content was scored. (2) Candidate result page: no "Strong Match" style label from the parser beside a low or unverified composite (show the parser's figure as "résumé match to the job description", not as a verdict); no GitHub note when there is no GitHub; the summary once. Recruiter table: not both "Evidence-limited" and the verification badge. Flags panel: titled for what it is, with the sources-disagree line shown as raised, not raised or not run, and the other flag kinds still honestly "not built". (3) Spine race at `spine.spec.mjs:270-279`: wait for the read-back the page really makes; do not weaken the assertion. (4) `getJobById`: a failed job lookup is a 500, not 404 (R-33 entry). (5) Cold start: nlp-engine loads its model at start-up and reports ready only then, or `start-all.ps1` waits for a warm parse; the first upload after start must not get 503. (6) Show LinkedIn and GitHub under Contact after upload when the parser returns them.
- **Check:** the new upload-A-upload-B-apply test; backend, frontend, gateway and nlp offline suites; a verifier repeats the two-résumé sequence live, runs the unmodified spine twice on a fresh start (first run cold), and screenshots the three screens.

### R-34 · Job location: work mode and city (SHOULD 1; only after every MUST is verified)
- **Status:** todo · **Agent:** patina-implementer · **Depends:** R-32 (same file) · **Risk:** low
- **Do:** a work-mode select (On-site, Hybrid, Remote) and a city field in `CreateJob.jsx`; saved into the existing `location` column as one string (`Hybrid · Pune`, `Remote`), so there is no schema change; city required unless Remote.
- **Check:** verifier browser pass creating one job per mode; e2e spine passes.

### R-35 · Token-level visual refresh (SHOULD 3; last, only if everything above is verified by Nov 16)
- **Status:** todo · **Agent:** patina-implementer · **Depends:** all MUST cards, S-3 · **Risk:** medium (touches every screen's look)
- **Do:** palette, type scale, spacing and the three accent colours in `tailwind.config.js` and `index.css` (today all three accents are `#0a0a0a`); the auth screens; `ScoreBreakdown` as the centrepiece. No layout is restructured, no figure is invented. Anthony's references are in his claude.ai project doc `claude/redesign-references.md`; he supplies them or the palette, since an agent cannot read that doc from the repo.
- **Check:** e2e spine passes after each change; text contrast at least 4.5:1 on every changed token; verifier screenshots of landing, login, recruiter table, drill-down, candidate result.

### R-36 · Nov 17 sweep of the `BATCH·demo` issues
- **Status:** todo · **Agent:** patina-implementer, one per service; a fresh patina-verifier · **Depends:** the Nov 17 rehearsal · **Risk:** low if each fix stays small
- **Goal:** the triage rule in `CLAUDE.md`. Every `ISSUES.md` entry tagged `BATCH·demo` (18 on 2026-11-13, plus any logged since) is fixed or closed with a reason.
- **Do:** take the entries in the order the rehearsal makes them matter; a fix that needs more than a few lines, a schema change or an auth change is not made here: it is closed with "roadmap" and named in `REBUILD/ROADMAP.md`. Update each entry's tag in the same edit.
- **Check:** `grep -c "BATCH·demo" ISSUES.md` counts only the rule text; the e2e spine suite and the batch smoke pass afterwards.

---

## Batch 6: docs

### R-22 · Archive and merge docs; update the checker
- **Status:** todo · **Agent:** patina-mechanical for the moves, patina-implementer for the checker · **Depends:** Y7 · **Risk:** medium (machine-checked paths)
- **Goal:** D§11.
- **Files:** the files listed under "Archived" in D§11, `tests/docs/check-trackers.mjs`, `CLAUDE.md` (source-of-truth list), `AUDIT.md` and `tasks/TEMPLATE.md` cites into moved files, `WORKLOG.md` (absorb `gateway/SESSION_LOG`).
- **Do:** move, never delete; drop the root-ROADMAP block from the checker; repoint every cite into a moved file; leave `assessment-service/README.md` and `tests/BASELINE_RESULTS.md` where they are.
- **Check:** `node tests/docs/check-trackers.mjs` reports no missing-file or unresolved-cite problem caused by a move (problems that remain belong to R-24 and R-25 and are listed); `pytest tests/assessment` still passes.

### R-23 · README as the one run guide
- **Status:** todo · **Agent:** patina-implementer · **Depends:** R-02, R-22 · **Risk:** low
- **Do:** rewrite `README.md`: what Patina is, prerequisites, `scripts/start-all.ps1`, env variable names per service (`REACT_APP_*` for the frontend; names only), how to run the tests and the end-to-end check, troubleshooting, pointers to `AUDIT.md` for status. No status table. Update `gateway/README.md` and the stale parts of `assessment-service/README.md` without touching its test-read lines.
- **Check:** a verifier follows the README alone on a stopped machine and reaches a logged-in page; `git grep -n VITE_ -- "*.md" ":!Docs/archive"` is empty.

### R-24 · ARCHITECTURE.md as built
- **Status:** todo · **Agent:** patina-implementer · **Depends:** R-13, R-22 · **Risk:** low
- **Do:** replace with a short as-built document: the D§1 diagram, per-service responsibilities, the call table with timeouts, auth flow, data ownership, the microservices verdict in D§1's words, the MongoDB justification, and "target after Nov 18" as a pointer to the roadmap. Every as-is claim cites `file:line` at the current commit.
- **Check:** `node tests/docs/check-trackers.mjs` reports no ARCHITECTURE problem.

### R-25 · AUDIT.md re-verified
- **Decision A9 (2026-11-14):** this is the first card of roadmap milestone A1, done as a full rewrite; a row the rebuild never touched is reset to `CLAIMED_UNVERIFIED`. Verification follows the handoff policy (the implementer runs the docs check; no separate verifier unless Anthony asks).
- **Status:** todo · **Agent:** patina-implementer writes; patina-verifier spot-checks 10 rows · **Depends:** R-19 · **Risk:** medium
- **Do:** rewrite every row from `inventory/scope_vs_reality.md` plus `REBUILD/LOG.md` results at the current commit. `DONE_CORRECTLY` only with `file:line` evidence and a test or end-to-end result. Fix the stale "Services that actually run" and data-model sections.
- **Check:** `node tests/docs/check-trackers.mjs` exits 0; the verifier's 10 sampled rows match the code and the cited tests.

### R-26 · ISSUES.md brought up to date
- **Status:** todo · **Agent:** patina-implementer · **Depends:** R-19 · **Risk:** low
- **Do:** copy entries I-0080 to I-0084 from commit `389df2d` (`git show 389df2d:ISSUES.md`, read-only); mark as resolved every issue a rebuild card fixed, citing the card; add issues logged during the rebuild.
- **Check:** every `I-NNNN` named in any kept doc is a heading in `ISSUES.md`; the docs checker exits 0.

---

## Stretch (only after R-19 passes)

**Order, as edited by Anthony at Checkpoint 2: S-3 (GitHub OAuth), S-1 (OCR), S-2 (flags), S-4 (certificates), S-5 (PFQS).** The ids are names, not positions.

| Id | Goal | Files | Check | Needs |
|---|---|---|---|---|
| S-1 | OCR for pages with no text layer, through the same pipeline; the result is marked "read by OCR". | `nlp-engine/app/extractor.py`, requirements, `tests/nlp/` | Fixture f6 parses to its known text; a blank image still → 422; parse time recorded in `eval/RESULTS.md`. | O-6 Tesseract |
| S-2 | Inconsistency flags: claimed language not found on GitHub; assessment result on a claimed skill below half. Each flag cites its evidence. | `backend/Services/explainability.js`, `ScoreBreakdown.jsx`, `tests/backend/` | Unit tests per rule; no flag is raised when the evidence source is unavailable. | — |
| S-3 | GitHub ownership through an OAuth link; the verified login is stored in `profiles.github_url` and preferred over the resume link; the "not verified" note disappears only then. | new `backend/Controllers/github.controller.js`, routes, candidate profile page | Live link with a real account; a resume naming another account is flagged as unverified. | O-6 OAuth app; Anthony's yes (auth-adjacent) |
| S-4 | Certificates extracted from the certifications section and shown as "claimed, not validated". | `nlp-engine/app/ner.py`, pipeline pass-through, recruiter drill-down | Fixture with a certifications section yields the entries; none affects the score. | — |
| S-5 | Two-step generation: an answer plan with difficulty, then questions from the plan; the plan is stored with the attempt. | `assessment-service/app/generator.py`, `prompts.py` | Tests with a fake LLM show two calls and a stored plan; live generation stays inside the time budget. | — |

---

## Phase 4 (starts Nov 16 at the latest)

| Id | Output | Agent |
|---|---|---|
| H-1 | **Written 2026-11-14; the six security items are placed in Track A milestone A1 on Anthony's instruction of that date, not Track B as below.** `REBUILD/ROADMAP.md`: Track A (academic completion: lists B and C) and Track B (public launch), as milestones with exit criteria and no time estimates. **The first milestone of Track A is the sweep of the whole BATCH backlog in `ISSUES.md` (57 entries on 2026-11-13), and every later milestone ends with a short sweep (triage rule in `CLAUDE.md`).** **Track B carries a "Security and privacy" heading whose items are fixed together (Anthony, 2026-11-13):** grader-supplied ids repeated in grading error messages (R-08 verifier entry); the session endpoint reporting a suspended user as logged in, and login revealing that a suspended username exists (R-04 entries; an auth change); the spoofable client IP in core's log and sign-ups not limited per IP (R-04 verifier entry); the unauthenticated NLP service and service-to-service authentication (I-0034); commit counts that trust author-set dates (I-0048); account deletion leaving storage files behind, with the retention and deletion policy (privacy entry of 2026-11-13); the assessments read policy (R-11 entry); single-process core and the external session store (I-0035). Each names its `ISSUES.md` entry, which stays BATCH until the fix is verified. **Track A also carries the next parsing evaluation (Anthony, 2026-11-14):** a developer-role sample on fresh files (the 20 TM-1 résumés have been seen and are not reused); before it, join the alias gaps `exchange server` = `microsoft exchange` and `sccm` = `system center configuration manager` in `eval/aliases.json` and the parser's canonical names; the trained NER model of the SRS (1.5) is the answer to vocabulary coverage (76 % of gold skills outside the list, `eval/RESULTS.md`). | lead |
| H-2 | **Written 2026-11-14.** `REBUILD/HANDOFF.md`: how an Opus-led session picks up the open cards; the Nov 17 rehearsal; the demo runbook. | lead |
| H-3 | `CODE_MAP.md` regenerated from the code at the final commit. | patina-auditor |
| H-4 | `REVIEW_BRIEF.md` regenerated: demo script, the honest status table from `CUT.md`, expected questions with answers that cite `AUDIT.md`. **Must include this Q&A (Anthony, 2026-11-13; I-0048):** "Can a candidate fake GitHub activity with backdated commits?" → "Yes, today: commit counts trust the dates the author sets, and account ownership is taken from the resume unless the candidate links it through GitHub sign-in. That is why GitHub is capped at 0.35 of the score, cannot lift anyone out of the low band without the assessment, and is shown with its evidence; checking push times against commit dates is on the roadmap under Security and privacy." | patina-auditor, reviewed by Anthony |

---

## Teammate tasks (no code, no pushes)

**Changed 2026-11-13 (Anthony): the teammates do documentation only. TM-1 and TM-2 are now Anthony's; TM-4 is built inside R-30. TM-3 and TM-5 stay with Anurag.** TM-1 with one labeller: all 30 resumes come from the public Kaggle set, so an AI first pass is allowed under D§4.3; the first pass must read the resume text and must not be made from the parser's own output; Anthony checks every label; `eval/RESULTS.md` states "labels AI-drafted from the resume text and human-checked; one labeller, no agreement figure" (approved 2026-11-13). The lead makes the first pass as soon as the 30 files are in `eval/resumes/` (the folder was empty on 2026-11-13). TM-2 is one full rehearsal on Nov 17 and a short run on the morning of the demo. TM-4 is the three-candidate demo set in R-30. The rows below are kept as first approved.

| Id | Owner | Task | Output | Due |
|---|---|---|---|---|
| TM-1 | Aaron and Anurag label; Aditya settles disagreements | Follow `eval/LABELLING_GUIDE.md` exactly; Anthony sends it with the task. Build a set of 30 IT resumes (at least 8 support or operations roles) from **public or consented sources only**: the public Kaggle resume dataset named in the SRS, or a resume whose owner agreed in writing. Both labellers label all 30 independently; Aditya settles every disagreement against the resume. An AI first pass is allowed, every label must be checked by the person, and a consented resume is never pasted into an AI tool without its owner's agreement. | The two labellers' CSV files, `gold.csv`, the 30 source files and the consent notes, sent to Anthony (not committed) | Nov 14 |
| TM-2 | Aditya | Manual pass of the demo script (the steps of R-19 by hand, plus the pages it does not cover) on a clean start. Record what happened at each step, with screenshots of anything wrong. | A filled copy of the script | Nov 16, repeated Nov 17 |
| TM-3 | Anurag | Slides for the MongoDB-to-Supabase justification and the architecture, from `DECISIONS.md` §1, using its wording for what is and is not claimed. | Slides for Anthony to review | Nov 16 |
| TM-4 | Aaron | Three demo resumes as real PDF files with invented people, clearly synthetic: a developer whose resume links `github.com/anthonyjennis` (O-5(b)); a support-engineer with no GitHub; a scanned (image-only) copy of one of them. These are test inputs, not results. | Three files, sent to Anthony | Nov 14 |
| TM-5 | Anurag | The honest-status slide: lists A, B and C from `CUT.md`, updated on Nov 17 to what was actually verified. | One slide | Nov 17 |
