# T-0018 — nlp-isolation

> Status: **draft, awaiting owner approval** (written in T-0016, 2026-10-15).
> ROADMAP item P2-1 (ARCHITECTURE §5 M1). Depends on P1-4 (T-0014, done). Second in the
> execution order, after T-0017.

## Context
Core calls NLP with one bare `fetch`:
- `fetch(NLP_PARSE_URL, { method: 'POST', body: form })` at
  `backend/Controllers/analysis.controller.js:273`;
- no timeout, no retry, no request ID.

Measured by the probe (ARCHITECTURE Appendix A.1, I-0036):
- **NLP down (P-1):** analyze → 500 whose body leaks the internal URL
  (`backend/Controllers/analysis.controller.js:373-375`).
- **NLP hung (P-2):** no response at all within 20 s.
- **NLP non-2xx:** 502 that echoes the upstream body (`:274-279`).
- **DB insert failures:** they also echo `error.message` (`:334-338`, `:363-367`).
- **NLP itself (P-3, I-0037):** `/parse` is `async def` (`nlp-engine/app/main.py:48-49`) but
  awaits nothing. Every parse therefore blocks the event loop, and `GET /` waits behind it.

T-0014 built `backend/Services/internalHttp.js` for the github-evidence call:
- `postJson`, `:61-108`, with one AbortController timeout over the whole call;
- one retry, on connection errors only (`:79-84`);
- typed `InternalHttpError` without body or URL (`:14-29`).

This task puts the NLP call on the same rails. It also matters for P2-3 (T-0020): the background
scorer must never hang on NLP.

## Goal
An NLP outage or hang turns into a fast, clean `503 {"error":"nlp_unavailable"}` with
`Retry-After`; no raw error text reaches a client on any analyze path; NLP stops serialising
`GET /` behind parses; and the probe's P-1..P-3 rows assert this.

## Spec ref
- NFR-12, §7 risk "API failure → retry + fallback"; NFR-1 (timeout budget).
- CHECKLIST 0.7, GR-2; ARCHITECTURE §4.8, §5 M1; ISSUES I-0036, I-0037, I-0050.

## The timeout: 5 s, and the numbers behind it
**Samples.** These are all the single, warm `/parse` timings recorded in the repo:
- `tests/BASELINE_RESULTS.md:64-65` (T-0001): f1 0.95 s, f2 0.38, f3 0.34, f4 0.40, f5 0.26,
  f6 0.03; three private résumés 0.88–1.16 s;
- ARCHITECTURE Appendix A.1 (T-0009): 320 ms (first call), 261 ms, 249 ms;
- Appendix A.2 / T-0015 Result: 296, 313 and 351 ms.

**Calculation.**
1. p95 of these 15 samples, by nearest rank, is the largest: **1.16 s**.
2. T-0015 measured NLP about 35% slower than T-0009 on the same fixture
   (351 / 261 = 1.35): 1.16 × 1.35 ≈ **1.6 s**.
3. **Margin for queueing.** NLP runs parses one at a time today (P-3: two concurrent parses
   finished at 253 and 558 ms, and in T-0015 at 950 ms). Even as a plain `def`, CPU-bound
   threads share cores and the GIL. Allowing two parses queued ahead of this one gives
   3 × 1.6 = 4.8 s, rounded up to **5 s**.

**Consequences.**
- Worst-case analyze = 5 s NLP + 8 s GitHub + ≈0.5 s writes ≈ 13.5 s. That is under the gateway's
  planned 20 s (ARCHITECTURE §4.8), so ROADMAP §1.2's "≥ 25 s if analyze stays" no longer applies.
- `Retry-After: 30` (`NLP_RETRY_AFTER_S`). NLP start-up takes 15–46 s (P-3), so a client that
  retries sooner would mostly hit the same outage.

**Confirmation.** Criterion 8 re-measures, and the value is raised if the new numbers need it.

## Scope
**In:**
- `internalHttp.js`:
  - `postJson` and a new `postForm(url, form, { timeoutMs, requestId })` share one internal
    send function (timeout over the whole call, one retry on connection errors after 100 ms,
    typed errors);
  - `postForm` serialises the multipart body once (`form.getBuffer()` and `form.getHeaders()`),
    so the retry resends identical bytes;
  - `postJson`'s behaviour is unchanged.
- New `backend/Services/nlpClient.js`:
  - `parseResume({ buffer, fileName, jd, requiredSkills, preferredSkills }, { requestId })`
    reads `NLP_PARSE_URL` (default unchanged) and `NLP_TIMEOUT_MS` (default 5000) on every
    call;
  - `classifyNlpError(err)` gives `nlp_unavailable` for a timeout, a connection error or an
    NLP 503, and `nlp_error` for any other non-2xx or an invalid body;
  - `nlpErrorResponse(err)` → `503 {"error":"nlp_unavailable"}` + `Retry-After` for the first,
    `502 {"error":"nlp_error"}` for the second.

  An NLP 500 is `nlp_error`, not "unavailable". A résumé that crashes the parser fails the same
  way on every retry, so calling it "unavailable, retry in 30 s" would be false. This matters for
  P2-3's retry rules.
- `analysis.controller.js` `analyzeResume`:
  - uses `nlpClient` and forwards the request ID to NLP;
  - every error response is a fixed `{"error":"<code>"}`: `nlp_unavailable`, `nlp_error`,
    `internal_error` (DB failures and anything else), plus the existing 400/404 validation
    codes;
  - no `err.message`, upstream body or URL is sent;
  - raw errors are logged server-side with the request ID.
- `nlp-engine/app/main.py`: `async def parse_resume` → `def parse_resume`, so FastAPI runs it in
  its thread pool. The body awaits nothing today, so nothing else changes.
- `backend/.env.example`: names `NLP_PARSE_URL`, `NLP_TIMEOUT_MS`, `NLP_RETRY_AFTER_S`.
- New `tests/arch/nlp-parse-timing.mjs`: 20 sequential warm parses per committed fixture
  (f1-f5, f7), plus `tests/private/*` if present; prints p50 and p95.
- Probe `tests/arch/nlp-outage-probe.mjs`:
  - P-1, P-2 and P-3 assert;
  - new row P-1b (recovery);
  - the login row is labelled `setup` when phase 1 is not selected (I-0050).
- Docs: ARCHITECTURE §0 point 4, §1.8, §2 (failure-isolation verdict row), §4.8 (the value and
  the numbers above), a new Appendix A.3 (the asserting P-1..P-3 run); ROADMAP §1.2; AUDIT 0.7
  and GR-2; ISSUES; WORKLOG.

**Out:**
- Aggregated health (`degraded` when NLP is down). That is the gateway's job (P2-4); I-0036
  keeps that half open.
- More NLP workers (I-0037 says measure first; each worker loads its own models).
- Apply and score-on-apply (P2-3), and NLP authentication or CORS (P2-4, P2-6).

## Files touched
- `backend/Services/internalHttp.js`, `backend/Services/nlpClient.js` (new), `backend/Controllers/analysis.controller.js`, `backend/.env.example`
- `nlp-engine/app/main.py`
- `tests/backend/nlp-client.test.mjs` (new), `tests/nlp/test_parse_concurrency.py` (new), `tests/arch/nlp-parse-timing.mjs` (new), `tests/arch/nlp-outage-probe.mjs`, `tests/run-suite.ps1` (adds `nlp-client.test.mjs` to the offline backend list), `tests/README.md`
- `ARCHITECTURE.md`, `ROADMAP.md` (§1.2), `AUDIT.md`, `ISSUES.md`, `WORKLOG.md`

## Moves
| Id | From → to | Why |
|---|---|---|
| 0.7 Graceful degradation | PART → **DONE** | Both internal dependencies now degrade: GitHub with a reason (T-0014/T-0015), NLP with retry and a clean 503, asserted by unit tests and the probe |
| GR-2 | PART → PART (evidence) | M1 done; M2–M4 remain |
| I-0036 | OPEN → OPEN (note) | Everything resolved except "health blind to dependencies", which moves to P2-4 |
| I-0037, I-0050 | OPEN → RESOLVED | — |

## Acceptance criteria
1. **`postForm` isolation.** Against `tests/backend/lib/stub-server.mjs`, checked by
   `tests/backend/nlp-client.test.mjs`:
   - service down → exactly 2 connection attempts, then `InternalHttpError` kind
     `unreachable` ("postForm retries once on a refused connection");
   - service hung → exactly 1 connection, and kind `timeout` within `timeoutMs` + 200 ms
     ("postForm does not retry a timeout");
   - the retried request's body is byte-identical to the first ("postForm resends identical
     bytes");
   - `X-Request-ID` is forwarded ("postForm forwards the request id").
2. **`postJson` unchanged.** Every test in `tests/backend/github-evidence-client.test.mjs` passes
   unmodified. Checked by: that file, same pass count as T-0014's green log.
3. **Error classification.** Checked by `nlp-client.test.mjs` "classifies NLP failures" and
   "maps errors to fixed responses":
   - timeout, refused connection and an NLP 503 → `nlp_unavailable`;
   - an NLP 500 whose body is `Traceback … SECRET-TOKEN`, an NLP 422 and a non-JSON 200 →
     `nlp_error`;
   - `nlpErrorResponse` gives exactly `503 {"error":"nlp_unavailable"}` with `Retry-After: 30`,
     or `502 {"error":"nlp_error"}`;
   - `SECRET-TOKEN`, `localhost` and `/parse` appear in no error message or response.
4. **No raw text on any analyze path.** Every `res.status(…).json(…)` in `analyzeResume` sends a
   fixed code.
   Checked by:
   - `git grep -nE "error: *(String\(|err|.*\.message|\`)" -- backend/Controllers/analysis.controller.js`
     → 0 lines in `analyzeResume`; the list of its `res.status` calls is reviewed in Result;
   - the probe's P-1 body check (criterion 6).
5. **NLP no longer blocks `GET /`.** Checked by `tests/nlp/test_parse_concurrency.py`:
   - `git grep -n "async def parse_resume" -- nlp-engine` → 0;
   - "test_health_answers_during_parse": a `GET /` sent 100 ms into a `/parse` of f1 returns
     before that parse does;
   - "test_concurrent_parses_match_snapshots": two concurrent parses (f1 and f3) return the
     same JSON as their `snapshots/current` files. This guards thread safety.
6. **P-1, NLP down (asserting).** The probe row "P-1 NLP down / POST /api/analyze" checks:
   - 503 within `NLP_TIMEOUT_MS` (5000) + 1000 ms;
   - the body is exactly `{"error":"nlp_unavailable"}`, with `Retry-After: 30`;
   - the body contains none of `localhost`, `8000`, `parse`, `FetchError`, `ECONNREFUSED`;
   - login, `GET /api/jobs`, `GET /api/resume/status` and `POST /api/resume/upload` → 200.

   Checked by: the probe output (`tests/.out/t0018-green.log`), each row PASS.
7. **P-2, NLP hung (asserting).** With `hangStub` on :8000:
   - analyze → 503 `nlp_unavailable` within 6000 ms;
   - the stub saw exactly 1 connection;
   - `GET /api/jobs`, sent 1 s after analyze started → 200 before analyze returns.

   Checked by: the probe output, each row PASS.
8. **The timeout is confirmed from new measurements.** Run `node tests/arch/nlp-parse-timing.mjs`
   on the dev laptop:
   - if p95 × 1.35 × 3 ≤ 5 s, `NLP_TIMEOUT_MS` stays 5000;
   - otherwise the default is raised to that product, rounded up to the next second.

   The numbers and the decision go in Result, ARCHITECTURE §4.8 and ROADMAP §1.2. Checked by:
   the script output, pasted in Result.
9. **P-1b, recovery.** After P-1, the probe starts NLP. Analyze f1 → 200 with the same core
   process (core's PID unchanged). Checked by: the probe row "P-1b NLP restarted".
10. **P-3 asserts, and the I-0050 label is fixed.**
    - P-3's "GET / sent 150 ms into a /parse" row asserts that `GET /` returned first.
    - A run with only `--phase 4` labels the login row `setup`.
    - `node tests/arch/nlp-outage-probe.mjs` (phases 1-6) exits 0, and `--phase 1` with
      `NLP_TIMEOUT_MS=60000` exits 1.

    Checked by: the probe output, `tests/.out/t0018-green.log`.
11. **Trackers.**
    - ARCHITECTURE: §0 point 4, §1.8, §2 and §4.8 describe the new NLP path with cites, and
      Appendix A.3 holds the run.
    - AUDIT 0.7 → DONE_CORRECTLY, with `file:line` and the test names.
    - GR-2 gains evidence.
    - I-0037 and I-0050 are resolved; I-0036 gets a note.

    Checked by: `node tests/docs/check-trackers.mjs` → exit 0, 0 warnings.

## Test plan
- **Write first:**
  - `nlp-client.test.mjs` (criteria 1-3);
  - `test_parse_concurrency.py` (criterion 5);
  - the probe's asserting P-1/P-1b/P-2/P-3 rows (criteria 6, 7, 9, 10).
- **Red run** (`tests/.out/t0018-red.log`):
  - `nlp-client.test.mjs` fails to import `nlpClient.js` (no module), and `postForm` is missing;
  - "test_health_answers_during_parse" fails: `GET /` returns after the parse;
  - probe at HEAD: P-1 → 500 with the raw URL (FAIL); P-2 → no response within 20 s (FAIL);
    P-3 ordering FAIL; exit 1.
- **Green:** `tests/.out/t0018-green.log` (unit + nlp), then the probe (phases 1-6).
- **Cannot be automated:** none. The probe and the timing script are live, manual runs, as in
  T-0009 and T-0015.

## Regression
- `tests/run-suite.ps1 -Target current -Live`:
  - nlp 0, with snapshots unchanged (`def` must not change output);
  - backend 0, including `live-analyze*.test.mjs` with NLP up;
  - github 0, docs 0;
  - frontend = the 5 known lint warnings.
- Probe P-4..P-6 still PASS. Their bounds use the NLP time, which is now capped by the timeout.

## Risks and rollback
- **Risk:** spaCy or sentence-transformers are not safe under concurrent threads.
  - Mitigation: "test_concurrent_parses_match_snapshots".
  - If it fails, the handler keeps `def` but serialises the model calls with a lock. `GET /`
    still stops blocking.
- **Risk:** 5 s is too tight under a real burst of parses, causing spurious 503s.
  - Mitigation: criterion 8's re-measurement.
  - P2-3's scorer caps itself at 2 parses per core, and a 503 there only delays a score; it never
    loses one.
- **Rollback:** revert the backend files and `main.py`. No data or schema change.

---

## Result
<Filled at the end. One line per acceptance criterion.>
