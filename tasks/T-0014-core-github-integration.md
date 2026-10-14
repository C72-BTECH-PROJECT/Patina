# T-0014 — core-github-integration

> Status: **spec only, awaiting owner approval** (written in T-0010, 2026-10-14).
> ROADMAP item P1-4. Depends on T-0012 and T-0013. No code until the criteria are
> approved.

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
- ROADMAP §1.2 to §1.4.

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
<Filled at the end. One line per acceptance criterion.>
