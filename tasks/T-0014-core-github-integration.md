# T-0014 — core-github-integration

> Status: **implemented 2026-10-15, awaiting the owner's commit** (spec written in
> T-0010, 2026-10-14; approved 2026-10-15). ROADMAP item P1-4. Depends on T-0012 and
> T-0013.

## Owner changes during execution (2026-10-15, decided while planning)
The spec could not be followed literally in four places. The owner decided each one,
and the criteria below are read with these changes:
- **D1 (I-0047).** The service can also answer `sub_score.available: false` with
  `reason_code: insufficient_evidence`. That is a 10th reason code: the client passes
  the service's code through, criteria 2 and 5 each gain that row, and ROADMAP §1.3
  gains it. I-0047 is resolved.
- **D2 (fixture).** No recordings existed for `example-mokafor`. The fixture is the real
  service's answer when it replays `synthetic/active` in process, with the login
  rewritten in memory (`tests/backend/fixtures/make-github-evidence-fixture.py`). It
  carries a `_source` marker saying it is synthetic, and so does `tests/README.md`.
  `tests/github` is untouched.
- **D3 (404).** Only a 404 whose `error` is `github_user_not_found` maps to
  `github_user_not_found`. Any other 404 (wrong URL or route) is `service_error`.
- **D4 (ARCHITECTURE cites).** Deleting `githubAggregator.js` breaks 4 cites in
  ARCHITECTURE.md, and the docs suite requires them to resolve. Only those 4 are
  rewritten as history; the full as-is refresh is I-0049.

Owner clarification at approval:
- Criterion 12's frontend build is green when it shows exactly the 5 known
  CreateJob/Jobs warnings recorded in T-0003..T-0012. Any further warning is a FAIL.
- The Result gets a pending manual check: a real end-to-end run with the owner's token.

## Context
The scoring engine was built for several sources:
- the sub-score shape is uniform;
- `aggregate()` renormalises weights over the available sources
  (`backend/Services/explainability.js:275-289`).

GitHub is hard-coded "unavailable" (`backend/Services/explainability.js:447`), and
`buildScoreRecord(nlpJson)` takes only the NLP result (`:444`). Three smaller gaps
show up once a second source exists:
- `buildSkillEvidence` hard-codes `sources.github: null` (`:318`);
- `buildFlags` would tell recruiters "No contradictions were found" while no
  contradiction logic exists (`:358-360`);
- core has no timeout anywhere: the NLP call can hang for good (ISSUES I-0036).

After T-0012 the service produces a sub-score. This task makes core call it during
`POST /api/analyze` and fold the result into the composite. Every failure becomes
"unavailable with a reason", never 0 (GF-4, ROADMAP §1.3).

## Goal
A resume with a GitHub link gets a GitHub sub-score in its stored score, and the
weights redistribute when it is unavailable. One without a link, or scored while the
service is down, slow or rate-limited, gets a GitHub sub-score that is "unavailable"
with a stated reason, and the analyze call still returns 200.

## Spec ref
- FR-4, FR-12; GF-4, GF-5.
- CHECKLIST 2.1, 2.3, 2.5, 2.7, 2.8, 2.10, 2.12, 2.13, 4.1, 4.2, 4.5, 4.7, 0.3, 0.5, 0.7.
- ROADMAP §1.2 (core-side timeouts and variables) to §1.4; the service contract is in
  `github-evidence/README.md` ("Contract v1"; I-0045).

## Scope
**In:**
- `backend/Services/internalHttp.js` (new). One JSON-over-HTTP helper for calls to
  internal services:
  - an `AbortController` timeout;
  - one retry on connection errors only;
  - forwards `X-Request-ID`;
  - typed errors (`timeout`, `unreachable`, `bad_status`, `bad_body`) that never
    carry the upstream body or URL.

  P2-1 (M1) reuses it for NLP.
- `backend/Services/githubEvidence.js` (new):
  - `normaliseGithubLogin(link)`;
  - `fetchGithubEvidence({ githubLink, claimedSkills, requestId })` →
    `{ ok: true, evidence }` or `{ ok: false, reasonCode }`;
  - the env vars `GITHUB_EVIDENCE_URL` and `GITHUB_EVIDENCE_TIMEOUT_MS`.
- `backend/Services/explainability.js`:
  - `buildGithubSubScore(result)`;
  - `buildScoreRecord(nlpJson, { github } = {})`. Without `github` it keeps today's
    output, with reason code `service_disabled`;
  - `sources.github` per skill;
  - `buildFlags` stays "not available" when GitHub is present;
  - the reason texts from ROADMAP §1.3.
- `backend/Controllers/analysis.controller.js`, in `analyzeResume`:
  - takes the request ID from the incoming `X-Request-ID` if valid, otherwise
    generates a UUID, and logs it;
  - calls `fetchGithubEvidence` after the NLP reply, with `entities.github` and the
    parsed skills;
  - passes the result to `buildScoreRecord`.
- `backend/.env.example` (two names); `backend/Controllers/githubAggregator.js`
  (deleted).
- Tests:
  - `tests/backend/explainability.test.mjs` (new, offline);
  - `tests/backend/github-evidence-client.test.mjs` (new, offline);
  - `tests/backend/live-analyze-github.test.mjs` (new, `-Live`);
  - `tests/backend/lib/stub-server.mjs` (new): an HTTP stub bound on 127.0.0.1 and ::1;
  - `tests/backend/fixtures/github-evidence-example-mokafor.json`: a service
    response produced by T-0012's service from synthetic recordings for the fixture
    login `example-mokafor`, plus a one-line regeneration command;
  - `tests/run-suite.ps1`: the two offline files run in the default backend suite,
    the live file under `-Live`;
  - `tests/README.md`.
- AUDIT.md rows per ROADMAP P1-4 "Moves", with evidence. 2.1 Notes: "profile
  `github_url` path: future, never written (no UI field)".
- ISSUES (I-0039: the githubAggregator part) and WORKLOG.

**Out:**
- The NLP timeout and the 503 (P2-1, M1); the helper is written so P2-1 only wires it.
- Score-on-apply (P2-3).
- Any frontend change, including the GitHub UI (P1-9) and I-0040.
- Contradiction flags (P1-9). A migration (DEC-6: stateless first).

## Acceptance criteria
1. **Login normalisation.** `normaliseGithubLogin` maps:
   - `github.com/example-mokafor`, `https://www.github.com/example-mokafor/` and
     `http://github.com/example-mokafor/ledgerly` → `example-mokafor`;
   - `github.com/orgs/acme`, `github.com/features`, `github.com/-bad` and `""` → null.

   Checked by: `github-evidence-client.test.mjs` "normalises GitHub links".
2. **Client outcomes, offline,** against `lib/stub-server.mjs`, each mapped to the
   right `reasonCode` — `github-evidence-client.test.mjs` "maps every service
   outcome":
   - 200 → `ok: true`;
   - 404 → `github_user_not_found`;
   - 503 `github_rate_limited` → `github_rate_limited`;
   - 503 other → `service_unavailable`;
   - 502 → `service_unavailable`;
   - 400/504/500 → `service_error`;
   - invalid JSON → `service_error`;
   - a 200 whose `sub_score.available` is false → `no_public_repositories`;
   - connection refused (after exactly one retry) → `service_unavailable`;
   - a hanging stub with `GITHUB_EVIDENCE_TIMEOUT_MS=300` → `timeout` in under
     1,300 ms, with no retry;
   - an empty or invalid link → `no_github_link` / `invalid_github_link` with **zero**
     stub requests;
   - `GITHUB_EVIDENCE_URL=""` → `service_disabled` with zero requests.
3. **Request ID and body.** The stub receives
   `{"username","claimed_skills","window_days":365}` and the caller's `X-Request-ID`
   unchanged. No error object or log line contains the stub's response body —
   `github-evidence-client.test.mjs` "forwards the request id and leaks nothing".
4. **Weight redistribution: AUDIT 4.7's promoting assertions.** Checked by
   `explainability.test.mjs` "redistributes weights over available sources":
   - parsing alone → parsing weight 1.0, GitHub and assessment weight 0,
     `evidence_limited: true`;
   - parsing plus GitHub → weights 0.40/0.75 and 0.35/0.75 (± 1e-4), and the
     composite is the weighted sum.
5. **Unavailable is never zero.** For each of the 9 reason codes in ROADMAP §1.3, the
   GitHub sub-score has `available: false`, `value: null`, a non-empty `reason` and
   `components.reason_code` equal to the code — `explainability.test.mjs` "every
   GitHub reason is unavailable, never zero".
6. **Available GitHub sub-score.** Checked by `explainability.test.mjs` "builds the
   GitHub sub-score":
   - from the fixture response, `value` = `round2(sub_score.value × 100)`;
   - `components` holds the evidence snapshot: username, request ID, `fetched_at`,
     `contract_version`, repositories summary, languages, commit activity, claims,
     limitations and the component weights;
   - every evidence item has `type` and `label`; every `metric` value is in [0, 1];
   - one evidence note says public repositories only, and that private work is not
     counted against the candidate (2.10).
7. **Per-skill GitHub source.** `skillEvidence` rows carry `sources.github` =
   `evidenced` / `not_found` / `not_checkable` from the claims, or `null` when GitHub
   is unavailable. `evidence_sources_confirming` counts GitHub only for `evidenced`
   — `explainability.test.mjs` "fills the GitHub source per skill".
8. **No false all-clear.** With GitHub available, `flags_available` is false and its
   reason says contradiction checks are not built yet. The output never says "no
   contradictions" — `explainability.test.mjs` "does not claim there are no
   contradictions".
9. **Every factor has evidence.** Each factor's `evidence` is an array, for every
   combination of available sources. `ScoreBreakdown.jsx` maps over it — checked by
   `explainability.test.mjs` "every factor has an evidence array".
10. **End to end, live.** Checked by `live-analyze-github.test.mjs` (`-Live`; real
    NLP and Supabase; the stub on :8001 replays the fixture; GitHub is never called):
    - `t0001_cand` analyzes f1 with `X-Request-ID: t0014-<random>` → 200;
      `subScores.github_evidence.available: true`; the stub saw username
      `example-mokafor` and that request ID;
    - the stored score, read back through `GET /api/candidate-analysis`, has the same
      sub-score;
    - f3 (no link) → 200 with `reason_code: "no_github_link"`, parsing weight 1.0,
      and zero stub requests;
    - stub stopped → f1 → 200 with `reason_code: "service_unavailable"`.
11. **Cruft and secrets.** Checked by:
    - `git grep -n githubAggregator -- backend` → 0 lines;
    - `git grep -n GITHUB_TOKEN -- backend frontend/src` → 0 lines;
    - `backend/.env.example` lists `GITHUB_EVIDENCE_URL` and
      `GITHUB_EVIDENCE_TIMEOUT_MS`.
12. **Regression and trackers.** Checked by:
    - `tests/run-suite.ps1 -Target current -Live` → nlp, backend (old + new),
      frontend build, docs and github all 0;
    - `node tests/backend/sweep.mjs --check` → 0;
    - AUDIT rows updated with file:line plus test evidence, and the checker passes.

## Test plan
- **Write first:** `explainability.test.mjs`, `github-evidence-client.test.mjs` and
  `live-analyze-github.test.mjs`.
- **Red run.** Logged to `tests/.out/t0014-red.log`:
  - the client test fails on `ERR_MODULE_NOT_FOUND` for
    `backend/Services/githubEvidence.js`;
  - the explainability test fails criteria 4-9, because `buildScoreRecord` ignores
    its second argument and GitHub stays at its hard-coded unavailable value;
  - the live test fails criterion 10 (`available: false`) while the stub is up.
- **Green:** `tests/.out/t0014-green.log`.
- **Cannot be automated:** whether the reason texts read well to a recruiter (owner
  review of the strings in `explainability.js`).

## Regression
- The full harness with `-Live`, as in criterion 12; the existing `live-analyze`
  and `live-analysis-isolation` tests in particular.

## Risks and rollback
- **Risk:** `localhost` resolves to ::1 first on Windows, and a stub bound only on
  127.0.0.1 is refused. Mitigation: the stub binds both families, as the T-0009 probe
  does.
- **Risk:** analyze gets slower by up to `GITHUB_EVIDENCE_TIMEOUT_MS` (8 s) when the
  service hangs. Accepted for the synchronous path. P1-5 measures it. ROADMAP §1.2
  records the plan for when the gateway exists.
- **Risk:** the first unit tests that import backend modules. Mitigation:
  `explainability.js` has no imports; `githubEvidence.js` imports only Node built-ins
  or `node-fetch` from `backend/node_modules`.
- **Rollback:** revert the backend hunks and restore `githubAggregator.js` from git.
  No migration: scores written meanwhile hold a richer jsonb that the old code renders
  as before.

---

## Result
**12/12 criteria PASS** (2026-10-15). They are read with owner changes D1-D4 above. One
manual check is pending for the owner (below).

- **Red:** `tests/.out/t0014-red.log`, backend suite `-Live` at HEAD code: 39 tests,
  29 pass, 10 fail.
  - The client test fails with `ERR_MODULE_NOT_FOUND` for `backend/Services/githubEvidence.js`.
  - The explainability test fails criteria 4-8. **Deviation from the test plan:** criterion 9
    ("every factor has an evidence array") already passed at HEAD, so it is a regression guard
    rather than a red test.
  - The live test fails criterion 10: f1 `available: false`; f3 and service-down have
    `components: null`, so there is no `reason_code`.
- **Green:** `tests/.out/t0014-green.log` (backend suite `-Live`, 66/66). Full harness:
  `tests/.out/t0014-full-harness.log`.

1. **PASS.** `github-evidence-client.test.mjs` "normalises GitHub links": the 3 links →
   `example-mokafor`; `orgs/acme`, `features`, `-bad`, `""`, `null` and `undefined` →
   null. Code: `backend/Services/githubEvidence.js:50`.
2. **PASS.** "maps every service outcome", 20 sub-tests:
   - every row of the criterion, plus D1 (`insufficient_evidence`), D3 (`404 not_found` →
     `service_error`) and "200 without sub_score" → `service_error`;
   - refused port → `service_unavailable`, with exactly 1 "retrying once" log line;
   - socket reset → the stub sees exactly 2 requests;
   - hang with 300 ms → `timeout` in 308 ms, 1 request;
   - empty, null and invalid links and `GITHUB_EVIDENCE_URL=""` → 0 connections.
3. **PASS.** "forwards the request id and leaks nothing", 5 sub-tests:
   - the body is exactly `{username, claimed_skills, window_days:365}`, and `X-Request-ID`
     arrives unchanged;
   - for 4 leaky answers (502 JSON, 500 text, 200 bad JSON, 404 with an unsafe `error`),
     neither the sentinel body nor the stub port appears in the result, the captured console
     lines, or `postJson`'s thrown error (message, stack, own fields).
4. **PASS.** `explainability.test.mjs` "redistributes weights over available sources":
   - parsing alone, and parsing with GitHub `timeout` → parsing 1, GitHub and assessment 0,
     `evidence_limited`;
   - parsing + GitHub → 0.5333/0.4667 (±1e-4), and the composite is the weighted sum.
5. **PASS.** "every GitHub reason is unavailable, never zero", all 10 codes (D1):
   - each has `available: false`, `value: null`, weight 0, a distinct non-empty reason and
     `components.reason_code`;
   - the composite equals the parsing-only composite;
   - no `github` argument → `service_disabled` with the old text.
6. **PASS.** "builds the GitHub sub-score":
   - value 51.38 = round2(0.51377 × 100);
   - the snapshot holds username, request ID, `fetched_at`, contract version, status,
     repositories, languages, commit activity, claims, limitations and component weights,
     with no `_source`;
   - 4 metrics in [0,1], plus 2 skill sets;
   - the first note says "Public repositories only… not counted against the candidate";
   - a partial answer stays available and names `repo_detail_failed:lib-core`.
7. **PASS.** "fills the GitHub source per skill":
   - python `evidenced` (confirming 2), javascript `not_found` (0), react `not_checkable`
     (1), kubernetes (not claimed) null;
   - all rows null when GitHub is unavailable.
8. **PASS.** "does not claim there are no contradictions": with GitHub available,
   `flags_available: false` and the reason says "not built yet"; neither record matches
   `/no contradictions/i`. Code: `backend/Services/explainability.js:543-565`.
9. **PASS.** "every factor has an evidence array": 13 GitHub inputs × 3 NLP inputs, 3
   factors each. `ScoreBreakdown.jsx:158` maps over it. This criterion was not red at HEAD
   (see Red above).
10. **PASS.** `live-analyze-github.test.mjs`, 4 sub-tests, real NLP and Supabase, stub on
    :8001:
    - f1 with `X-Request-ID: t0014-<hex>` → 200, GitHub available, 51.38; the stub saw
      `example-mokafor`, f1's skills and the ID;
    - `GET /api/candidate-analysis` returns a deep-equal sub-score;
    - f3 → `no_github_link`, parsing weight 1, 0 stub requests;
    - stub closed → f1 → 200 with `service_unavailable`;
    - the backend log has `[analyze] request_id=… github=ok|no_github_link|service_unavailable`
      and one `ECONNREFUSED; retrying once` line per refused call, with no URL.
11. **PASS.**
    - `git grep -n githubAggregator -- backend` → 0 lines (exit 1);
    - `git grep -n --untracked GITHUB_TOKEN -- backend frontend/src` → 0 lines (exit 1;
      `--untracked` covers the new files);
    - `backend/.env.example:9,11` list `GITHUB_EVIDENCE_URL` and `GITHUB_EVIDENCE_TIMEOUT_MS`.
12. **PASS.** `tests/run-suite.ps1 -Target current -Live`:
    - nlp 0 (12 passed), backend 0 (66/66, counting sub-tests), docs 0, github 0
      (80 passed);
    - frontend: the build exits 1 with exactly the 5 known warnings (CreateJob `Plus`, `X`;
      Jobs `MapPin`, `Users`, `Sparkles`) and nothing new. That is PASS per the owner's
      clarification;
    - `node tests/backend/sweep.mjs --check` → 0;
    - AUDIT rows updated with `file:line` plus test names; `check-trackers` exit 0 (91/91,
      ARCHITECTURE 203 cites). It prints 1 warning: I-0049 is open but not in any ROADMAP
      item row. Mapping it is the owner's call; P1-5 is the natural home.
    - The fixture regenerates byte-identical (SHA-256 `86fa1d2f…` before and after).

**AUDIT moves**, each only as far as the evidence supports:
- To DONE_CORRECTLY: 2.3, 2.5, 2.7, 2.10, 2.12, 2.13, 4.2, 4.7.
- 0.7 MISSING → PARTIAL (GitHub path only; NLP is I-0036/P2-1); 2.11 MISSING → PARTIAL
  (snapshot, no table).
- Unchanged status with new evidence: 0.3 PART, 0.5 CRU, 2.1 PART (note added), 2.4 PART
  (quality is P1-6), 2.8 PART, 4.1 BROKEN (2 of 3 inputs), 4.5 PART; 4.6 text only.
- 38 other cites into the two edited backend files were re-pointed to their shifted lines.
- Summary: 3 → 11 DONE.

**Cannot be automated.** Owner review of the reason texts and evidence notes in
`backend/Services/explainability.js:75-95,302-346,563`.

**Manual check: PASS on the second run (see Result below; first run blocked by I-0052).** Run the real github-evidence
service with your token and analyze one resume that has a real GitHub link, to confirm a
real sub-score end to end:
1. Stop anything on :8001. Start the service as in `github-evidence/README.md` "Start"
   (`cd github-evidence; venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8001`),
   with `GITHUB_TOKEN` in `github-evidence\.env`.
2. Start NLP and the backend as usual (`GITHUB_EVIDENCE_URL` unset = `http://localhost:8001`).
   The service binds 127.0.0.1 only. If the backend logs `github=service_unavailable`,
   set `GITHUB_EVIDENCE_URL=http://127.0.0.1:8001` in `backend/.env` and note it here: it
   would mean `localhost` resolved to ::1 only.
3. As a candidate, analyze a resume whose GitHub link is a real account (for example your
   own).
4. Expect in the recruiter drill-down: GitHub Evidence available with a 0-100 value, metrics
   and the public-repositories note. The backend log shows `github=ok`, and the service log
   shows the same `request_id`.
5. Record PASS/FAIL here.

Result: **PASS (2026-10-15, second run)**. The first run (`tests/private/Anthony_Jennis_Resume.pdf`)
was NOT EXERCISED: its GitHub link is a hyperlink annotation behind the text "GitHub", so the backend
returned `no_github_link` and never called the service (I-0052, P1, open). The second run used
`tests/private/resume.pdf` with the real services and token.
- Setup: `backend/.env` has `GITHUB_EVIDENCE_URL=http://127.0.0.1:8001`; `github-evidence/.env` has
  `GITHUB_TOKEN` set (presence only). NLP :8000, github-evidence :8001, backend :5000 started.
- Run: seeded the `[T-0001 TEST]` job, logged in as `t0001_cand`, `POST /api/analyze`, request id
  `manual-t0014`, HTTP 200. Backend log `github=ok`; the same request id is in the service log.
- GitHub sub-score: **available, 26.23 / 100**, status `complete`, not partial. Weights: GitHub 0.4667,
  parsing 0.5333, assessment 0. Composite 36.74.
- Username used: `Arya-A-Nair` (taken from the link on that résumé; it is not the owner's account).
- Repositories: 55 listed, 35 owned, 20 forks, 0 archived, 35 considered, 10 in detail. Languages: 10
  (PHP, JavaScript, TypeScript, CSS, Python, C, HTML, Jupyter Notebook, Dockerfile, DataWeave).
- Claims: 3 evidenced, 2 not_found, 18 not_checkable.
- Recruiter-facing summary text: "Credibility 36.74/100. Résumé ↔ Job Semantic Alignment contributes 53%
  of the score at 45.94/100 - Matched 5 of 9 job skills ...; missing: sql, rest api, redis, aws. GitHub
  Evidence contributes 47% of the score at 26.23/100. Assessment Results was not available, so its
  weight was redistributed across the remaining evidence rather than scored as zero." The per-metric
  GitHub drill-down text was not captured in this run (data swept); the API-level sub-score, counts and
  weights above are the evidence.
- GitHub rate limit after the run (GET /rate_limit, free call): core 4975 / 5000 remaining; this run
  used 22 calls (25 used, 3 before it), matching the README budget of 22 calls per candidate.
- Cleanup: sweep removed 1 score, 1 resume, 1 job, 1 storage object; recount all 0. All three services
  stopped; ports 5000, 8000, 8001 have no listeners.
