# github-evidence

Internal Python service that fetches a GitHub user's public profile and repository list
and answers in **contract v1**. It is stateless (DEC-6), internal only (DEC-5: core calls
it, the browser never does) and holds the only copy of the GitHub token (NFR-9).

This is the skeleton from T-0011 (ROADMAP P1-1). Language, commit and claim metrics and
the sub-score arrive in T-0012 (P1-2); core integration in T-0014 (P1-4).

## Start

```powershell
python -m venv github-evidence\venv
github-evidence\venv\Scripts\python -m pip install -r github-evidence\requirements.txt
copy github-evidence\.env.example github-evidence\.env      # then put your token in .env

cd github-evidence
venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

The start command is `uvicorn app.main:app --host 127.0.0.1 --port 8001`. The service
refuses to start without `GITHUB_TOKEN`: the error names the variable and never prints a
value. `.env` is read at start only, never inside tests, and is gitignored.

Create the token as a fine-grained personal access token with **public repositories
read-only** access and nothing else.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `GITHUB_TOKEN` | none; the service refuses to start without it | Fine-grained token, public read only. Lives only in this service's env (NFR-9) |
| `GITHUB_API_URL` | `https://api.github.com` | Tests and the outage probe point it at stubs |
| `GITHUB_MAX_REPOS` | 100 | Repositories listed. Pagination stops here and `truncated` is set |
| `GITHUB_HTTP_TIMEOUT_S` | 4 | Timeout per GitHub call |
| `GITHUB_DEADLINE_S` | 6 | Deadline for the whole request |
| `GITHUB_MIN_REMAINING` | 100 | Low-water mark for the rate limit |
| `GITHUB_DETAIL_REPOS`, `GITHUB_CONCURRENCY`, `GITHUB_SUBSCORE_WEIGHTS` | reserved | Arrive with T-0012 (ROADMAP §1.2 listed them). **Not read yet** |

Core-side variables (`GITHUB_EVIDENCE_URL`, `GITHUB_EVIDENCE_TIMEOUT_MS`) belong to core
and stay in ROADMAP §1.2.

## Contract v1 (core ↔ github-evidence)

### `GET /health`

`200 {"status":"ok","service":"github-evidence","contract_version":"1","token_configured":true}`.
It makes no GitHub call.

### `POST /v1/evidence`

- Request headers:
  - `Content-Type: application/json`;
  - `X-Request-ID`, optional.
- Request ID rules:
  - it is accepted only if it matches `^[A-Za-z0-9-]{1,64}$`; otherwise a UUID is generated;
  - it is echoed on every response (the `X-Request-ID` header, and `request_id` in a 200
    body) and written in every log line for the request;
  - core forwards the ID it received or generated. Once the gateway exists (P2-4), the
    gateway generates it.
- Request body:

```json
{ "username": "octocat", "claimed_skills": ["python", "react", "docker"], "window_days": 365 }
```

`username` is a GitHub login: 1 to 39 ASCII letters, digits and single hyphens, with no
hyphen at either end. Anything else, including a missing or non-string field, is `400
invalid_request` and no GitHub call is made. `claimed_skills` and `window_days` are
accepted and validated (`window_days` 1..730) but unused until T-0012.

- `200` body in this version (the P1-2 metric fields are added by T-0012):

```json
{
  "contract_version": "1",
  "request_id": "3f6c…",
  "username": "octocat",
  "status": "complete",
  "fetched_at": "2026-10-14T10:00:00Z",
  "profile": { "public_repos": 8, "html_url": "https://github.com/octocat" },
  "repositories": {
    "listed": 8, "owned": 6, "forked": 2, "archived": 0, "considered": 6, "truncated": false,
    "items": [ { "name": "hello-world", "fork": false, "archived": false,
                 "pushed_at": "2026-09-30T08:00:00Z", "primary_language": "Python" } ]
  },
  "limitations": ["public_repositories_only"],
  "rate_limit": { "remaining": 4780, "reset_at": "2026-10-14T11:00:00Z" }
}
```

- `listed` is every repository returned (up to the cap), `forked` those with `fork: true`,
  `owned` the rest, and `considered` the owned, non-fork repositories (archived ones are
  counted in `archived` and stay in `considered`). `truncated` is true only when the cap
  was reached while GitHub still had more pages; `limitations` then also holds
  `repository_list_capped:<cap>`.
- `status: "partial"` means some per-repo calls failed, or the 6 s deadline hit after the
  profile and repository list arrived. It is part of the contract and cannot occur yet:
  this version makes no per-repo calls, and a deadline hit while the list is incomplete
  is `504 github_timeout`.
- **Target shape** (moved here from ROADMAP §1.2; T-0012 fills the metric fields, so these
  are not returned yet):

```json
{
  "repositories": { "items": [ { "name": "hello-world", "fork": false, "pushed_at": "…",
                                 "primary_language": "Python", "authored_commits_window": 12,
                                 "languages": { "Python": 12345 } } ] },
  "languages": [ { "name": "Python", "bytes": 12345, "share": 0.62 } ],
  "commit_activity": { "window_days": 365, "authored_commits": 120, "active_weeks": 30, "weeks": 52, "weekly": [0, 3, 1] },
  "claims": [ { "skill": "python", "language": "Python", "status": "evidenced", "share": 0.62, "repos": ["hello-world"],
                "last_activity": "2026-09-30T08:00:00Z" },
              { "skill": "react", "language": null, "status": "not_checkable" } ],
  "sub_score": { "available": true, "value": 0.64, "reason_code": null, "weights_source": "default",
    "components": [ { "key": "activity", "value": 0.7, "weight": 0.25, "available": true } ] },
  "limitations": ["public_repositories_only", "default_branch_only", "detail_repos_capped:10"]
}
```

- Claim statuses:
  - `evidenced`: any owned, non-fork repo uses the claimed language, at any age.
    `last_activity` (latest `pushed_at` among those repos) is reported per claim and does
    not change the status;
  - `not_found`: a checkable language that no owned, non-fork repo uses (never "too old");
  - `not_checkable`: frameworks and tools that language statistics cannot show. These are
    never counted against the candidate.

### Errors

Always `{"error": "<code>", "message": "<fixed safe text>"}`, plus `X-Request-ID`. They
never echo GitHub's body, the token or an internal URL (the lesson of I-0036).

| HTTP | `error` | When |
|---|---|---|
| 400 | `invalid_request` | Body or login fails validation (no GitHub call is made) |
| 404 | `github_user_not_found` | GitHub answers 404 for the user |
| 503 | `github_rate_limited` | Primary or secondary limit, or below the low-water mark; carries `Retry-After` when the wait is known |
| 503 | `github_auth_failed` | GitHub rejects our token (a misconfiguration) |
| 502 | `github_upstream_error` | GitHub 5xx or connection errors after one retry, an unexpected 4xx, or a body that is not the expected JSON |
| 504 | `github_timeout` | The deadline passed (or one GitHub call timed out) before the profile and repository list arrived |
| 404 / 405 | `not_found` / `method_not_allowed` | Unknown route or method (`/docs`, `/redoc`, `/openapi.json` do not exist) |
| 500 | `internal_error` | Anything unexpected; the cause goes to the log by type name only |

### Timeouts (service side; P1-5 measures them)

4 s per GitHub call and a 6 s deadline per request. Core's own timeout is longer than the
deadline so the service can still answer `partial`; see ROADMAP §1.2.

### GitHub calls and rate limits

- **Calls per request:** `GET /users/{login}`, then `GET /users/{login}/repos?type=owner&sort=pushed&direction=desc&per_page=100&page=N`
  until the list ends or the cap is reached. The `Link` header only tells us that another
  page exists; its URL is never followed, so the token cannot be sent to another host.
- **Every request carries** `Authorization: Bearer`, `X-GitHub-Api-Version: 2022-11-28`
  and a `User-Agent`. No cookie is stored or sent. The token is never logged.
- **Tracking.** `x-ratelimit-remaining` and `x-ratelimit-reset` are read from every reply
  and kept in process.
- **Low-water mark.** When a new request arrives and the last reply said `remaining` is
  below `GITHUB_MIN_REMAINING` (and the window has not reset), the service answers 503 at
  once, without calling GitHub, with `Retry-After` = reset − now.
- **Primary limit hit** (403 or 429 with `x-ratelimit-remaining: 0`): no retry. 503 with
  `Retry-After` = reset − now.
- **Secondary limit** (403 or 429 with a `retry-after` header): one retry, only if the wait
  is at most 1 s and fits the deadline; otherwise 503 with GitHub's `Retry-After`.
- **5xx and connection errors:** one retry with jitter (50 to 250 ms), inside the deadline.
  A call that times out is not retried.
- **Budget:** about 2 to 3 calls per candidate in this version; 5,000 per hour per token.

## Tests

`tests/github/`, run with `tests\run-suite.ps1 -Target current -Suites github`. They run in
process through FastAPI's `TestClient` against recorded and synthetic GitHub responses and
never reach the live API: every test runs inside `respx.mock(assert_all_mocked=True)`, and
run-suite passes `--allow-hosts=127.0.0.1,::1` to pytest-socket.

Install the test dependencies with `pip install -r github-evidence\requirements-dev.txt`.

### Recordings

`tests/github/recordings/manifest.json` lists every recording with `source: recorded |
synthetic` and a date. A recording is one JSON file:

```json
{ "request":  { "method": "GET", "path": "/users/octocat", "query": {} },
  "response": { "status": 200, "headers": { "content-type": "…" }, "body": { } } }
```

Only these response headers are kept: `content-type`, `link`, `etag`, `retry-after` and
`x-ratelimit-*`. A test fails if any file holds `authorization`, `ghp_`, `github_pat_`,
`gho_` or `Bearer`.

- `synthetic/` is hand-made from GitHub's documented shapes: 150 repositories over two
  pages with `Link`, a 404, 401, 403, a 502, and primary and secondary limit replies.
- `octocat/` is recorded once by the owner:

```powershell
# token in github-evidence\.env, then:
github-evidence\venv\Scripts\python github-evidence\tools\record_github.py octocat
```

  The recorder calls the same endpoints through the service's own client, writes
  `tests/github/recordings/octocat/` and adds the files to the manifest. The octocat
  recording was made on 2026-10-15; `test_evidence_octocat` skips with a PENDING message if
  it is absent. Re-run the recorder to refresh it; the manifest date changes.
