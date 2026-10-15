# T-0011 — github-evidence-skeleton

> Status: **implemented 2026-10-15; all 16 criteria PASS** (octocat recorded by the owner the same day) (spec written in T-0010, 2026-10-14, approved by the owner).
> ROADMAP item P1-1.

## Context
ROADMAP Phase 1 builds GitHub validation as its own internal Python service.
- DEC-4: GitHub evidence is its own Python service.
- DEC-5: it is internal only; core calls it and the browser never does.
- DEC-6: it starts stateless.

Today `backend/Controllers/githubAggregator.js` is dead code: unauthenticated, one
page, nothing imports it (AUDIT 2.3). This task builds the service's skeleton:
- the contract v1 surface;
- a GitHub REST client that handles the token, pagination, rate limits, retries and
  a deadline;
- a test harness that never touches the live API.

Metrics and the sub-score are T-0012 (P1-2). Core integration is T-0014 (P1-4).

## Goal
A FastAPI service `github-evidence/` on :8001 that, for a valid GitHub login,
returns the public profile and repository list through the GitHub REST API with
`GITHUB_TOKEN`, answering in contract v1. It is tested only against recorded and
synthetic GitHub responses.

## Spec ref
- FR-4 (the username input side: login validation), FR-5 (repository retrieval).
- CHECKLIST 2.3 and 2.13 (service half); NFR-9 (the key stays server-side); NFR-12.
- ROADMAP §1.2 (contract), §1.5 (rate limits), §1.6 (tests).

## Scope
**In:**
- `github-evidence/app/`: `main.py` (FastAPI app, routes), `config.py` (env),
  `contract.py` (request and response models, error codes), `github_client.py`
  (httpx client, pagination, rate-limit state, retries, deadline).
- `github-evidence/requirements.txt` and `requirements-dev.txt`. Both pinned: pytest,
  respx and pytest-socket in the dev file.
- `github-evidence/README.md`: start command, env var table, contract v1. ROADMAP
  §1.2 is moved here and replaced in ROADMAP by a pointer.
- `github-evidence/.env.example` (names only).
- `github-evidence/tools/record_github.py`: the owner-run recorder.
- `tests/github/`: `conftest.py`, `test_service.py`, `test_client.py`,
  `recordings/manifest.json`, `recordings/octocat/`, `recordings/synthetic/`.
- `tests/run-suite.ps1` (new `github` suite), `tests/README.md` (suite row).
- ISSUES and WORKLOG.

**Out:**
- Language, commit and claim metrics, and the sub-score (T-0012).
- Any change under `backend/ frontend/ nlp-engine/ supabase/`.
- A Dockerfile (P2-6) and a database schema (P1-7).
- An internal auth token between core and the service (ROADMAP default: network
  isolation, revisited in P2-6).

## Acceptance criteria
1. **Layout and pinned dependencies.** Checked by:
   - every non-comment, non-blank line in both requirements files is `name==version`:
     `grep -vE '^\s*(#|$)' github-evidence/requirements*.txt | grep -vc '=='` → 0;
   - `.env.example` lists names with no values;
   - the README has the start command
     (`uvicorn app.main:app --host 127.0.0.1 --port 8001`), the env table and the
     contract v1;
   - ROADMAP §1.2 is a pointer to the README.
2. **Token required at boot.** With `GITHUB_TOKEN` unset, creating the app raises an
   error that names the variable and contains no value — `test_requires_token`.
3. **Health.** `GET /health` → 200 with `status`, `service`, `contract_version: "1"`
   and `token_configured: true`, and no GitHub call (respx records 0) — `test_health`.
4. **Happy path on a real recording.** `POST /v1/evidence {"username":"octocat"}`
   against the owner's octocat recording → 200, `status: "complete"`, and
   `repositories.listed/owned/forked` equal to the counts in the recording —
   `test_evidence_octocat`.
   - Needs the owner step below. Until it is done this criterion is PENDING, not
     PASS.
5. **Pagination and cap.** Checked by `test_pagination` and `test_repo_cap`:
   - a synthetic 150-repo user over two pages, with a `Link: rel="next"` header →
     `listed: 150` after exactly 2 list calls;
   - with `GITHUB_MAX_REPOS=100` → `listed: 100`, `truncated: true`, and no further
     call.
6. **Login validation.** Each of these gets 400 `invalid_request`, and respx
   records zero outbound calls — `test_invalid_username`:
   - `""`, `"-alice"`, `"alice-"`, `"a--b"`;
   - a 40-character name;
   - `"github.com/alice"`;
   - a missing `username` field.
7. **Unknown user.** GitHub 404 → 404 `github_user_not_found` — `test_user_not_found`.
8. **Rate limits** (ROADMAP §1.5):
   - **Primary:** 403 with `x-ratelimit-remaining: 0` and a reset 600 s ahead → 503
     `github_rate_limited`, `Retry-After` within 600 ± 2, exactly 1 GitHub call —
     `test_rate_limit_primary`.
   - **Secondary:** 429 with `retry-after: 60` → 503 well before 60 s (the test
     asserts under 2 s), 1 GitHub call — `test_rate_limit_secondary`.
   - **Low-water mark:** after a reply with `x-ratelimit-remaining` below
     `GITHUB_MIN_REMAINING`, the next request → 503 with 0 GitHub calls —
     `test_rate_limit_low_water`.
9. **Upstream failures.**
   - `test_upstream_retry`: 502 then 200 → 200 after 2 calls; 502 twice → 502
     `github_upstream_error` after 2 calls.
   - `test_deadline`: a GitHub mock that never answers, with
     `GITHUB_DEADLINE_S=1` → 504 `github_timeout` in under 2 s.
   - `test_auth_failed`: GitHub 401 → 503 `github_auth_failed`.
10. **Nothing leaks.** Every error body has exactly the keys `error` and `message`,
    with fixed text. Neither the response nor the captured logs contain the token,
    the GitHub error body's marker text or `GITHUB_API_URL` — `test_no_echo`.
11. **Outbound headers.** Every GitHub request carries `Authorization: Bearer
    <token>`, `X-GitHub-Api-Version: 2022-11-28` and a `User-Agent`; no cookie is
    sent — `test_auth_headers`.
12. **Request ID.** Checked by `test_request_id`:
    - a valid `X-Request-ID` is echoed on the response and appears in the log record;
    - an invalid one (`bad id\n`, 65 characters) is replaced by a UUID.
13. **Internal-only hygiene.** Checked by `test_no_cors_no_docs`:
    - `OPTIONS` with an `Origin` header gets no `access-control-allow-origin`;
    - `/docs`, `/redoc` and `/openapi.json` → 404.
14. **The live API is never reached.** Checked by `test_live_call_blocked`, which
    asserts a direct connection attempt to `api.github.com:443` raises pytest-socket's
    blocked-connection error:
    - run-suite calls pytest with `--allow-hosts=127.0.0.1,::1` (pytest-socket);
    - the conftest wraps every test in `respx.mock(assert_all_mocked=True)`.

    (`--allow-hosts` is used instead of `--disable-socket` because the Windows event
    loop needs a loopback socket pair.)
15. **Recordings are scrubbed and labelled.** Checked by `test_recordings_scrubbed`:
    - every file under `tests/github/recordings/` holds only the allow-listed
      headers (`content-type`, `link`, `etag`, `x-ratelimit-*`, `retry-after`);
    - no file contains `authorization`, `ghp_`, `github_pat_`, `gho_` or `Bearer`;
    - `manifest.json` lists every file with `source: recorded|synthetic` and a date.
16. **Suite wiring.** Checked by:
    - `tests/run-suite.ps1 -Target current -Suites github` → github 0;
    - `-Target baseline -Suites github` prints "skipped (no github-evidence in
      baseline)" and exits 0;
    - `-Suites docs` → 0;
    - `git status --porcelain` shows nothing under `backend/ frontend/ nlp-engine/ supabase/`.

**Owner step (criterion 4):** create a fine-grained token with public read only, put
it in `github-evidence/.env` (gitignored), and run
`github-evidence/venv/Scripts/python github-evidence/tools/record_github.py octocat`
once. The recorder calls the same endpoints as the service, keeps only the
allow-listed headers, and writes `tests/github/recordings/octocat/` plus a manifest
entry.

## Test plan
- **Write first:** `tests/github/test_service.py` and `test_client.py` (criteria
  2-15), with `conftest.py` and the synthetic recordings.
- **Red run:** pytest against an empty `github-evidence/app/` → collection fails
  with `ModuleNotFoundError: No module named 'app.main'` and the suite exits non-zero.
  Logged to `tests/.out/t0011-red.log`, with the first error line quoted in Result.
- **Green:** all of the above pass; logged to `tests/.out/t0011-green.log`.
- **Cannot be automated:** criterion 4 until the owner records octocat; the README
  content in criterion 1 (read by me and the owner).

## Regression
- `tests/run-suite.ps1 -Target current -Suites docs`.
- No other suite is affected: no file changes under `backend/ frontend/ nlp-engine/`.

## Risks and rollback
- **pytest-socket and the Windows event loop:** `--disable-socket` breaks asyncio's
  socket pair. Mitigation: `--allow-hosts=127.0.0.1,::1`, which still blocks any
  non-loopback connect.
- **Synthetic recordings drift from the real API.** Mitigation: they are shaped from
  the octocat recording and GitHub's documented examples; the manifest dates make
  re-recording visible.
- **Token leak.** Mitigation: `**/.env` is already gitignored (`.gitignore:11`), the
  recorder scrubs headers, and criterion 15 tests it.
- **Rollback:** the service is additive. Delete `github-evidence/` and `tests/github/`,
  and revert the run-suite and README hunks.

---

## Result
Green: `tests/.out/t0011-green.log` = `run-suite.ps1 -Target current -Suites github`, **46 passed, 0 skipped** after the octocat recording (45 passed, 1 skipped before it).
Red: `tests/.out/t0011-red.log`, run before any `app/*.py` existed (only an empty `app/__init__.py`): exit 1, 15 failed + 29 errors, 2 passed (`test_live_call_blocked`, `test_recordings_scrubbed`). First error line: `E       ModuleNotFoundError: No module named 'app.main'`. It surfaces at test time, not at collection as the spec predicted, because the tests import the app lazily inside fixtures and tests.

1. **PASS** - `grep -vhE '^\s*(#|$)' github-evidence/requirements*.txt | grep -vc '=='` → 0. `.env.example` has only `GITHUB_TOKEN=` (no value) and commented names. README has the start command (`github-evidence/README.md:21`), the env table and contract v1. ROADMAP §1.2 is a pointer (`ROADMAP.md:93-98`). I kept the core-side timeouts and core env vars under the pointer, since they are not the service's contract.
2. **PASS** - `test_requires_token` (unset and blank token; message names `GITHUB_TOKEN`).
3. **PASS** - `test_health` (exact body, 0 respx calls).
4. **PASS** - `test_evidence_octocat` against the owner's recording (`tests/github/recordings/octocat/{user,repos_p1}.json`, recorded 2026-10-15: 8 repositories, 2 forks, headers `content-type`, `etag`, `x-ratelimit-*` only): 200, `complete`, `listed/owned/forked` equal to the recording's counts. Before the recording it skipped as PENDING.
5. **PASS** - `test_pagination` (150 repos, 2 list calls, `GITHUB_MAX_REPOS=200`) and `test_repo_cap` (cap 100 → `listed` 100, `truncated`, 1 list call even with page 2 mounted). The spec's first case needs the cap raised, because the default is 100.
6. **PASS** - `test_invalid_username` (the 7 listed inputs plus a non-string and a list; each 400 `invalid_request`, 0 calls), `test_invalid_body_is_400`, `test_valid_username_boundaries` (1 and 39 chars, `a-b` accepted).
7. **PASS** - `test_user_not_found`.
8. **PASS** - `test_rate_limit_primary` (Retry-After within 600 ± 2, 1 call), `test_rate_limit_secondary` (503 in under 2 s, `Retry-After: 60`, 1 call), `test_rate_limit_low_water` (second request makes 0 calls). Also `test_client.py`: a short secondary wait (≤ 1 s) is retried once, and the low-water block lifts when the window resets.
9. **PASS** - `test_upstream_retry`, `test_deadline` (`GITHUB_DEADLINE_S=1` → 504 in under 2 s), `test_auth_failed`. I read "after 2 calls" as 2 attempts at the failing request (the first endpoint is tried twice): in the 502-then-200 case the whole request makes 3 GitHub calls (user ×2, list ×1), and in the 502-twice case exactly 2.
10. **PASS** - `test_no_echo` (5 GitHub error kinds, a hard 502, a 400 and a success: bodies are exactly `{error, message}` with the fixed text, and neither responses nor captured logs hold the token, `GHBODY-MARKER` or the API URL; it asserts that records were captured). It needed the `httpx` logger muted: httpx logs the URL at INFO (`github-evidence/app/github_client.py:30`). `test_unexpected_error_is_fixed_500` covers the catch-all.
11. **PASS** - `test_auth_headers` (Bearer token, `X-GitHub-Api-Version: 2022-11-28`, own User-Agent; caller `Cookie`/`Authorization` headers and a GitHub `Set-Cookie` never reach a later request).
12. **PASS** - `test_request_id` (valid ID echoed on header, body and log record; `bad id\n`, 65 chars, a space and empty each replaced by a UUID).
13. **PASS** - `test_no_cors_no_docs`.
14. **PASS** - `test_live_call_blocked` under `--allow-hosts=127.0.0.1,::1`, with every test inside `respx.mock(assert_all_mocked=True)` (`tests/github/conftest.py`). The test connects by host name, so pytest-socket blocks it before any DNS lookup. I did not run it without the flag, to avoid a real connection to api.github.com.
15. **PASS** - `test_recordings_scrubbed` (11 synthetic files, manifest complete, allow-listed headers only, none of the five forbidden strings). The offline `test_recorder_scrubs_and_writes` (not a criterion) checks the recorder's scrubbing, manifest update and re-record behaviour, because I cannot run the recorder against the live API.
16. **PASS** - `-Suites github` → github 0; `-Target baseline -Suites github` prints "skipped (no github-evidence in baseline)" and exits 0; `-Suites docs` → 0 (final run 0 warnings); `git status --porcelain -- backend frontend nlp-engine supabase` is empty.

Full harness (`run-suite.ps1 -Target current -Live`, `tests/.out/t0011-full-harness.log`): nlp 0 (12 passed), backend 0 (27/27), docs 0, github 0, frontend 1 = the existing CI-mode ESLint warnings in `CreateJob.jsx` / `Jobs.jsx` (not touched; same as the T-0004..T-0013 Results). `git diff --stat tests/nlp/snapshots` is empty.

**Owner step (criterion 4):** done. The recorder ran live against GitHub (exit 0, 2 files, manifest entries `source: recorded`); `test_recordings_scrubbed` passes on the new files. The full harness above ran before the recording, and the github suite was re-run after it (46 passed).

Changes: new `github-evidence/` (`app/{config,contract,github_client,main}.py`, `tools/record_github.py`, `requirements*.txt`, `.env.example`, `README.md`) and `tests/github/`. Edited `tests/run-suite.ps1` (new `github` suite, also in the default list), `tests/README.md`, `ROADMAP.md` (§1.2 pointer; P1-1/P1-2 Issues cells), `AUDIT.md` (2.3, 2.13 evidence only; statuses unchanged; changelog and module note), `ISSUES.md` (I-0044..I-0046; I-0043 cite moved to `ROADMAP.md:218`).
Decisions beyond the spec: `python-dotenv` pinned so the owner's `.env` loads at start (never in tests); the `Link` header is only a "next page exists" signal and its URL is never followed; the low-water check is at request admission; other 4xx from GitHub → 502 `github_upstream_error`; `considered` = owned non-fork repos (archived included).
