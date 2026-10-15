# github-evidence

Internal Python service that fetches a GitHub user's public profile and repository list
and answers in **contract v1**. It is stateless (DEC-6), internal only (DEC-5: core calls
it, the browser never does) and holds the only copy of the GitHub token (NFR-9).

T-0011 (ROADMAP P1-1) built the skeleton; T-0012 (P1-2) added the language, commit and claim
metrics and the sub-score. Core integration is T-0014 (P1-4).

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
| `GITHUB_DETAIL_REPOS` | 10 | Owned, non-fork repos (archived included), most recently pushed first, that get `/languages` and `/commits` calls. 0 turns the detail calls off |
| `GITHUB_CONCURRENCY` | 5 | Detail calls in flight at once |
| `GITHUB_SUBSCORE_WEIGHTS` | unset | JSON that overrides the sub-score weights (see "Sub-score"). Invalid values fall back to the defaults |

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
invalid_request` and no GitHub call is made. `claimed_skills` (up to 200 strings, optional) are
the resume's skills to cross-check; `window_days` (1..730, default 365) is the commit window.

- `200` body (`sub_score` is explained under "Sub-score"):

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
  "languages": [ { "name": "Python", "bytes": 12345, "share": 0.62 } ],
  "commit_activity": { "available": true, "window_days": 365, "authored_commits": 120, "active_weeks": 30,
                       "weeks": 52, "weekly": [0, 3, 1] },
  "claims": [ { "skill": "python", "language": "Python", "status": "evidenced", "share": 0.62,
                "repos": ["hello-world"], "last_activity": "2026-09-30T08:00:00Z" },
              { "skill": "react", "language": null, "status": "not_checkable", "share": null,
                "repos": [], "last_activity": null } ],
  "sub_score": { "available": true, "value": 0.64, "reason_code": null, "weights_source": "default",
                 "partial": false,
                 "components": [ { "key": "activity", "value": 0.7, "weight": 0.25, "available": true, "reason": null } ] },
  "limitations": ["public_repositories_only", "default_branch_only", "author_matched_by_login_or_email"],
  "rate_limit": { "remaining": 4780, "reset_at": "2026-10-14T11:00:00Z" }
}
```

(`weekly` above is shortened; it always has 52 integers. Each `items` entry also carries
`authored_commits_window` and `languages` (bytes per language), both `null` for repos without
detail data. `repositories` also carries `detailed` and `with_authored_commits`.)

- `listed` is every repository returned (up to the cap), `forked` those with `fork: true`,
  `owned` the rest, and `considered` the owned, non-fork repositories (archived ones are
  counted in `archived` and stay in `considered`). `truncated` is true only when the cap
  was reached while GitHub still had more pages; `limitations` then also holds
  `repository_list_capped:<cap>`.
- `status: "partial"` means some per-repo calls failed, or the 6 s deadline hit after the
  profile and repository list arrived. Then `limitations` names what is missing
  (`repo_detail_failed:<repo>`, `deadline_reached`) and `sub_score.partial` is true. A deadline
  hit while the repository list is incomplete is still `504 github_timeout`.
- Claim statuses:
  - `evidenced`: any owned, non-fork repo uses the claimed language, at any age.
    `last_activity` (latest `pushed_at` among those repos) is reported per claim and does
    not change the status;
  - `not_found`: a checkable language that no owned, non-fork repo uses (never "too old");
  - `not_checkable`: frameworks and tools that language statistics cannot show. These are
    never counted against the candidate.

### Metrics

- **Owned** means "not a fork". **Detail repos** are the `GITHUB_DETAIL_REPOS` most recently pushed owned repos.
  Archived ones are included: they are the candidate's work. Forks get no detail call. If more owned
  repos exist, `limitations` has `detail_repos_capped:<n>`.
- **Languages:** bytes from `/languages`, summed over the detail repos; `share` sums to 1.
- **Commit activity:** commits authored by the login (`/commits?author=<login>&since=<now - window_days>`),
  up to 5 pages of 100 per repo (`commit_pages_capped:<repo>` if more). `weekly` is the last 52 weeks
  ending now, oldest first; a commit inside the window but older than 52 weeks counts in
  `authored_commits` only. `active_weeks` is the number of non-zero weeks. With no detail repos or no
  successful commit call, `commit_activity.available` is false and the numbers are `null`, never 0.
- **Claims:** each claimed skill is mapped to a GitHub language (`app/skill_languages.py`; case,
  spaces, `-`, `_` and `.` are ignored, so `Golang` is `Go`, `C++` and `C#` stay distinct).
  - `evidenced`: any owned, non-fork repo uses it at any age, from the repo list's primary
    `language` (all owned repos) or `/languages` (detail repos).
  - `not_found`: no owned, non-fork repo uses it. A language used only by a fork is `not_found`.
  - `not_checkable`: frameworks and tools (react, docker, aws ...).
  - `last_activity` is the latest `pushed_at` among those repos. It is reported only and changes
    neither the status nor the score.

### Sub-score

A graded number in [0, 1], never a pass/fail gate. **The weights and saturation points below are
provisional starting values** (owner, 2026-10-15); P3-12 calibrates them against human ratings.

| Component | Formula | Default weight |
|---|---|---|
| `activity` | `min(1, ln(1 + authored_commits) / ln(1 + 200))` | 0.25 |
| `consistency` | `min(1, active_weeks / 26)` | 0.25 |
| `ownership` | `min(1, owned_repos_with_authored_commits / 5)` | 0.20 |
| `corroboration` | `evidenced / (evidenced + not_found)` over the checkable claims | 0.30 |

- The value is the weighted sum, with the weights renormalised over the available components. An
  unavailable component has `value: null` and `weight: 0`, and `reason` says why
  (`no_commit_data`, `no_checkable_claims`). The `weight` reported is the one actually used.
- `GITHUB_SUBSCORE_WEIGHTS` is JSON such as `{"corroboration": 0.5}`. Keys you give replace the
  defaults; unknown keys and negative or non-numeric values are ignored; a total of 0 or invalid
  JSON (logged as a warning) falls back to the defaults. `weights_source` is `env` only if at least
  one key was applied, else `default`. Same rules as `CREDIBILITY_WEIGHTS` in core.
- `sub_score.available: false` with `reason_code`:
  - `no_public_repositories`: the user owns no non-fork repo (GF-4: unavailable, never 0);
  - `insufficient_evidence`: owned repos exist but no component could be computed.
- An inactive account with real, corroborated claims is available and low, not unavailable.

### Limitations

- Public repositories only. Commits are read from each repo's default branch only, and
  `author=<login>` matches the commit author's login or email, so commits under another email are missed.
- Maintenance work (PRs, reviews, commits to others' repos) is not scored yet (P3-4); code quality
  is P1-6.
- Claims only cover languages: a frameworks-only resume yields no corroboration.

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
- **Calls per candidate:** 1 profile + 1 repo-list page (per 100 repos) + 2 per detail repo
  (`/languages` and the first commit page) + extra commit pages. With the defaults that is
  `2 + 2 x 10 = 22` calls for an ordinary account, so about **227 candidates per hour** at 5,000
  requests an hour. The bound is `2 + 10 + 10 x 5 = 62` calls (80 candidates per hour) when every
  detail repo hits the 5-page commit cap. Forks and repos beyond the cap cost nothing. Detail calls
  stop once the remaining quota is below `GITHUB_MIN_REMAINING`.

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
  recording also holds `languages_<repo>.json` and `commits_<repo>_p<N>.json` for the detail
  repos (T-0012). The recorder stores the run's time as `accounts.octocat.fetched_at` in the
  manifest, and the tests pin the service clock to it, so results do not depend on the day they run.
  The octocat tests skip with a PENDING message if the recording is absent. Re-run the recorder to
  refresh it; the manifest date and `fetched_at` change, and `snapshots/octocat.json` must be
  regenerated.
- The `synthetic/<name>/` folders (active, forks, empty, partial, archived) are whole fake accounts
  with the same file layout, pinned the same way.
