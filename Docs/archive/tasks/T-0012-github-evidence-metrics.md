# T-0012 — github-evidence-metrics

> Status: **implemented, 13/13 criteria PASS (13 with one noted deviation); awaiting the owner's commit** (written in T-0010,
> 2026-10-14). ROADMAP item P1-2. Depends on T-0011. The two open questions were answered
> on 2026-10-15 and four execution decisions were added the same day (see "Decisions").

## Context
After T-0011 the service returns a profile and a repository list. FR-6 asks for:
- repository count;
- commit frequency;
- code-quality indicators.

Objective 2 and CHECKLIST 2.4/2.5 add ownership (own work vs fork), consistency over
time, and a cross-check of the languages the resume claims. The literature review
and 2.7 require graded evidence feeding a weighted score, never a pass/fail gate.

This task computes those metrics and the GitHub sub-score inside the service. Code
quality (8DFS) is P1-6 and joins the formula later as one more component.

## Goal
`POST /v1/evidence` returns `languages`, `commit_activity`, `claims` and `sub_score`
as in ROADMAP §1.2, computed by a documented, deterministic formula, with partial
data labelled and the GitHub call budget bounded.

## Spec ref
- FR-6; Objective 2; CHECKLIST 2.4 (except quality), 2.5, 2.7, 2.13 (partial data
  labelled).
- GF-4: "no public repositories" is "unavailable", never 0.
- LR "graded, not binary".

## Scope
**In:**
- `github-evidence/app/metrics.py`: languages, commit activity, ownership.
- `github-evidence/app/claims.py` and `skill_languages.py`: the skill → GitHub
  language table.
- `github-evidence/app/scoring.py`: the formula and the `GITHUB_SUBSCORE_WEIGHTS`
  parsing.
- `github-evidence/app/main.py`: wiring.
- `github-evidence/tools/record_github.py`: also records `/languages` and `/commits` for
  the detail repos, and writes the account's `fetched_at` to the manifest (owner approval,
  2026-10-15; see decision 3).
- `github-evidence/README.md`: the formula, the weights, the call budget and the
  limitations.
- `tests/github/test_metrics.py`, `test_scoring.py`, `snapshots/octocat.json`, and
  new synthetic recordings.
- ISSUES and WORKLOG.

**Out:**
- 8DFS and code quality (P1-6).
- Maintenance signals such as PRs, reviews and commits to others' repos (P3-4).
- Core integration (T-0014). Any change outside `github-evidence/` and `tests/github/`.

## Draft formula, for approval
Each component is in [0, 1].
- **activity** = `min(1, ln(1 + authored_commits) / ln(1 + 200))`.
- **consistency** = `min(1, active_weeks / 26)`, where an active week has at least
  1 authored commit in the window.
- **ownership** = `min(1, owned_repos_with_authored_commits / 5)`.
- **corroboration** = `evidenced / (evidenced + not_found)` over the checkable
  claims. It is unavailable when no claim is checkable.

Weights:
- defaults: activity 0.25, consistency 0.25, ownership 0.20, corroboration 0.30;
- renormalised over the available components;
- overridable by `GITHUB_SUBSCORE_WEIGHTS` (JSON), with the same fallback rules as
  `CREDIBILITY_WEIGHTS`: unknown keys and negative or non-finite values are ignored,
  and a total ≤ 0 or invalid JSON falls back to the defaults with a warning.

These are **provisional starting values** (owner, 2026-10-15). They stay
env-configurable, the README documents them as provisional, and P3-12 calibrates them
against human ratings (6.4).

Other definitions:
- **Claim evidence (decision Q1):** a claimed language is `evidenced` if any owned,
  non-fork repository uses it, at any age. The sources are the `/languages` bytes of
  the detail repos plus the `language` field (primary language) that the repository
  list already carries for every owned, non-fork repo, archived or not. The second
  source costs no extra calls and keeps repos beyond the detail cap from being
  ignored. `not_found` means no such repo uses the language, never "too old".
- **Recency (decision Q1):** each claim carries `last_activity`, the most recent
  `pushed_at` among the owned, non-fork repos that use the language. It is reported
  only. It does not change the claim status or the corroboration component. Recency
  enters the sub-score through the **activity** component (authored commits in the
  window), which is unchanged.
- **Detail repos:** owned, non-fork repos, **archived ones included** (owner, 2026-10-15:
  archived repos are the candidate's work), the `GITHUB_DETAIL_REPOS` (default 10) most
  recently pushed. They get `/languages` and
  `/commits?author=<login>&since=<now − window_days>` calls, the commit list paginated.
- **No evidence:** if the user owns no non-fork repo, `sub_score.available` is false
  with `reason_code: "no_public_repositories"`. Never value 0.

## Decisions (owner, 2026-10-15; were open questions)
1. **Claim definition (Q1).** A claimed language counts as `evidenced` if any owned,
   non-fork repository uses it, at any age. Recency is reported separately (last
   activity per language) and feeds the activity component, not the claim status.
   `not_found` means no repository uses it at all, never "too old". This replaces
   the draft rule ("authored commits in the window"), which would have turned old
   but real work into `not_found`.
2. **Starting weights and saturation points (Q2).** Accepted as provisional starting
   values (weights 0.25 / 0.25 / 0.20 / 0.30; saturation at 200 commits, 26 weeks,
   5 repos). They stay env-configurable, are documented in the README as
   provisional, and P3-12 calibrates them against human ratings.

3. **Recorder and clock (owner, 2026-10-15).** The octocat recording held only the profile
   and the repo list, so `tools/record_github.py` is extended to record `/languages` and
   `/commits` for the detail repos (in scope by owner approval; the owner re-records).
   Tests never read the real clock: `now` is the account's `fetched_at` from the manifest,
   so results are identical on any day. The service takes an injectable clock. The real
   octocat account has 0 commits in the 365-day window (all pushes in 2024); the test
   asserts exactly that (the "inactive account" case) and still expects its languages to
   be `evidenced` under the any-age rule. Active-window commit math, no-repos, partial and
   deadline use synthetic scenarios marked `synthetic`; nothing hand-made is layered onto
   the real recording.
4. **Archived repos in the detail set (owner, 2026-10-15).** Archived owned non-fork repos
   are detail repos (same ordering and cap). If the detail set is nevertheless empty or no
   commit data could be fetched (`GITHUB_DETAIL_REPOS=0`, or every commit call failed),
   the commit-based components (activity, consistency, ownership) are **unavailable** with
   a reason (value null, weight 0, the rest renormalised), never 0. Ownership is included
   because it comes from the same commit data.

## Acceptance criteria
1. **Languages.** Bytes are summed per language over the detail repos; `share` sums
   to 1 ± 0.001; sorted by bytes descending — `test_language_breakdown` (recording).
2. **Commit activity.** `weekly` has exactly 52 integers. `authored_commits` equals
   the sum of the recorded commits inside the window, and `active_weeks` the count of
   non-zero weeks. A synthetic recording with commits across 2 pages is counted fully
   — `test_commit_activity`.
3. **Ownership.** `owned`/`forked`/`archived` counts match the recording. Forks get no
   detail calls; respx asserts their URLs were never requested. Archived owned non-fork
   repos do get them (decision 4). A user whose repos are all archived gets a computed
   sub-score; with an empty detail set the commit-based components are unavailable with a
   reason, not 0 — `test_ownership`, `test_all_archived`, `test_no_detail_repos`.
4. **Claims.** Checked by `test_claims`:
   - Each claimed skill maps through `skill_languages.py`.
   - Statuses are `evidenced`, `not_found` or `not_checkable`.
   - A language used only by an owned, non-fork repo last pushed 3 years ago (outside
     the window, no commits in it) is `evidenced`, with an old `last_activity`; a
     language used by no owned, non-fork repo is `not_found`; a language used only by
     a fork is `not_found`. A language that only the repository list's primary
     `language` shows (repo beyond the detail cap) is `evidenced`.
   - `last_activity` is the max `pushed_at` of the owned, non-fork repos using the
     language, and `null` for `not_found` and `not_checkable`.
   - Changing a repo's `pushed_at` leaves status and `corroboration` unchanged.
   - `react`, `docker` and `aws` are `not_checkable`, never `not_found`.
   - Matching ignores case and separators (`C++`, `c#`, `Golang` → `Go`).
5. **Formula.** Given fixed metrics, each component and the value match the
   formula above to 1e-9 — `test_subscore_formula`.
6. **Corroboration unavailable.** With corroboration unavailable, the other weights
   renormalise to sum to 1 — `test_subscore_formula`.
7. **Weights env.** A valid `GITHUB_SUBSCORE_WEIGHTS` overrides the defaults and
   `weights_source` is `"env"`. Invalid JSON, a negative value and an all-zero total
   fall back to the defaults with `weights_source: "default"` — `test_subscore_weights_env`.
8. **No evidence.** A user with only forks, and a user with zero repos, both get
   `sub_score.available: false`, `reason_code: "no_public_repositories"` and
   `value: null` — `test_no_repos`.
9. **Partial data.** Checked by `test_partial_upstream` and `test_deadline_partial`:
   - one detail repo's `/languages` fails twice (502) → 200, `status: "partial"`, and
     `limitations` names that repo; the sub-score is computed from the rest and
     carries `partial: true`;
   - the deadline hits after the repo list → the same, with
     `limitations: ["deadline_reached", …]`.
10. **Call budget.** For the octocat recording, the number of GitHub calls is at
    most `2 + 2 × detail_repos` plus the commit pages actually recorded (respx call
    count). The README states calls per candidate and candidates per hour at 5,000
    requests an hour — `test_call_budget`.
11. **Determinism.** Two runs on the same recordings give identical bodies once
    `request_id`, `fetched_at` and `rate_limit` are removed — `test_determinism`.
12. **Contract snapshot.** The octocat response, with the volatile fields removed,
    equals `tests/github/snapshots/octocat.json` (written in this task, reviewed in
    Result) — `test_contract_snapshot`.
13. **Regression.** All T-0011 tests still pass (`-Suites github` → 0), and `-Suites
    docs` → 0.

## Test plan
- **Write first:** `test_metrics.py` and `test_scoring.py`, plus the synthetic
  recordings (2-page commits, forks-only user, empty user, a failing `/languages`).
- **Red run:** against T-0011's service, the new tests fail on `KeyError:
  'languages'` / `'sub_score'` and the missing `app.scoring` module. Logged to
  `tests/.out/t0012-red.log`.
- **Green:** `tests/.out/t0012-green.log`.
- **Cannot be automated:** whether the formula is a fair first cut is the owner's
  judgement (open question 2). Its calibration is P3-12.

## Regression
- `tests/run-suite.ps1 -Target current -Suites github,docs`.

## Risks and rollback
- **Weights look arbitrary.** Mitigation: documented, env-overridable, labelled
  "provisional starting values", calibrated in P3-12; the explanation shows each
  component.
- **Old work corroborates the claim.** A stale repo makes a language `evidenced`.
  Accepted (owner, Q1): recency is shown in `last_activity` and scored through the
  activity component, not the claim.
- **The commits endpoint sees the default branch only, and `author=` matches the
  login or an email.** Mitigation: both are listed in `limitations` and the README.
- **Rollback:** revert the files inside `github-evidence/` and `tests/github/`; no
  data or schema involved.

---

## Result
Red: `tests/.out/t0012-red.log`, run after the tests and synthetic recordings existed and before any new `app/` module: exit 1, **29 failed, 45 passed, 6 skipped** (the 6 skipped are the octocat tests, PENDING). The failures are `TypeError: create_app() got an unexpected keyword argument 'clock'` (17), `ImportError: cannot import name 'scoring'` (8), `No module named 'app.skill_languages'`, the recorder's missing `now` argument and detail files, and the README without the budget lines. All 45 T-0011 tests that I had not touched passed. (A first red run showed 28 errors from a conftest bug of mine, calling `create_app(clock=None)` for every test; fixed before the log was saved.)
Green: `tests/.out/t0012-green.log` = `run-suite.ps1 -Target current` github suite, **80 passed, 0 skipped** after the owner re-recorded octocat (73 passed, 6 skipped before; the README budget check and the snapshot were the last two).
Full harness (`tests/.out/t0012-green-full.log`): nlp 0, backend 0, docs 0 (0 warnings), github 0, frontend 1 = the existing CI-mode ESLint warnings in `CreateJob.jsx` / `Jobs.jsx` (not touched; same as T-0011 and T-0013).

1. **PASS** - `test_language_breakdown` (synthetic/active: Python 6000, Go 4000, HTML 2000, Ruby 1000, Perl 500; shares sum to 1 ± 0.001; bytes descending; a fork's language absent) and `test_octocat_language_breakdown` on the real recording (CSS 14950, HTML 4338, JavaScript 48).
2. **PASS** - `test_commit_activity`: `weekly` has 52 ints and equals the hand-worked list; `authored_commits` 120 (119 in the weekly buckets + 1 inside the window but older than 52 weeks; the commit before the window is ignored); `active_weeks` 6; `app-main` has 116 across 2 pages (pages 1 and 2 requested, `author`, `since` and `per_page` asserted).
3. **PASS** - `test_ownership` (counts 5 listed / 4 owned / 1 forked / 1 archived; no URL under the fork was requested; the archived repo got `/languages` and `/commits`, per the owner's 2026-10-15 change), `test_all_archived` (a computed, available sub-score; activity = ln(4)/ln(201)), `test_no_detail_repos` (`GITHUB_DETAIL_REPOS=0`: 0 detail calls; activity, consistency and ownership unavailable with `reason: no_commit_data`, weight 0, value null; corroboration takes weight 1.0; with no claims too, `insufficient_evidence`).
4. **PASS** - `test_claims` (all rows of the criterion, incl. a 3-year-old repo `evidenced` with `last_activity` 2023-10-01, a language used by no repo and one used only by a fork `not_found` with `last_activity` null, `react`/`docker`/`aws` `not_checkable`, `Golang`/`go` → Go, corroboration 5/8), `test_claims_beyond_the_detail_cap_use_the_primary_language`, `test_claim_status_ignores_pushed_at`, `test_skill_to_language_table` (`C++`, `c#`, `Golang`, `Objective-C`), `test_octocat_languages_are_evidenced_at_any_age` (real 2024 repos, all `evidenced`).
5. **PASS** - `test_subscore_formula` (each component and the value within 1e-9 of the formula), plus `test_saturation_points`.
6. **PASS** - `test_subscore_formula_without_corroboration` (weights 0.25/0.70, 0.25/0.70, 0.20/0.70, sum 1 ± 1e-9).
7. **PASS** - `test_subscore_weights_env` (valid env → `env`; invalid JSON, a negative value, an all-zero total, NaN, a non-object and an unknown-only object → `default`, with a warning for invalid JSON) and `test_weights_env_reaches_the_response` (through the HTTP response).
8. **PASS** - `test_no_repos`: a forks-only user (2 GitHub calls, no detail calls) and a zero-repo user both get `available: false`, `reason_code: no_public_repositories`, `value: null`.
9. **PASS** - `test_partial_upstream` (`/languages` of one repo 502 twice → 200, `partial`, `repo_detail_failed:bad`, `sub_score.partial: true`, computed from the other repo) and `test_deadline_partial` (the repo's detail calls hang, deadline 1 s → 200 in under 3 s, `limitations[0] == "deadline_reached"`). Also `test_deadline_before_the_repo_list_is_still_a_timeout` (504, unchanged).
10. **PASS** - `test_call_budget` on the octocat recording: 14 GitHub calls = 2 + 2 × 6 detail repos (no extra commit pages); `test_call_budget_synthetic` (11 calls); `test_readme_states_the_budget`. README: 22 calls and about 227 candidates an hour for an ordinary account, 62 calls and 80 an hour at the 5-page cap.
11. **PASS** - `test_determinism` (two runs on synthetic/active, bodies equal without `request_id`, `fetched_at`, `rate_limit`). The octocat and synthetic runs use the pinned clock.
12. **PASS** - `test_contract_snapshot` against `tests/github/snapshots/octocat.json`, generated from the same code path as the test after the re-record (claims: html, css, javascript, react). Review notes below.
13. **PASS with one deviation** - `-Suites github` → 0, `-Suites docs` → 0. The deviation: "all T-0011 tests still pass" does not hold unchanged, because owned repos now trigger `/languages` and `/commits` calls. I changed T-0011 tests minimally: a detail stub (`mount_details_stub`) in `mount_small` and in the pagination, cap, low-water, retry and header tests; call counts filtered to the profile and repo-list calls; the `items` assertion relaxed to the five T-0011 keys; the recorder test expects the new files. `test_evidence_octocat` was replaced by `test_octocat_repository_counts` (same assertions, in `test_metrics.py`, because it needs the T-0012 files). No T-0011 assertion about errors, retries, headers, logging or request IDs was weakened.

Snapshot review (owner to check): octocat has 8 repos (2 forks), 6 detail repos, 0 authored commits, 0 active weeks, `weekly` all zeros. Languages CSS / HTML / JavaScript. Claims html, css, javascript are `evidenced` (last activity 2024-08), react is `not_checkable`. `sub_score` is available with value 0.3: activity, consistency and ownership are 0.0 and corroboration 1.0 (weight 0.30). Limitations: `public_repositories_only`, `default_branch_only`, `author_matched_by_login_or_email`. An inactive account scoring 0.30 is the formula working as specified; logged as I-0048 for P3-12.

Changes: new `github-evidence/app/{metrics,claims,skill_languages,scoring}.py`; edited `config.py`, `contract.py`, `github_client.py`, `main.py`, `tools/record_github.py`, `.env.example`, `README.md`; new `tests/github/{test_metrics,test_scoring}.py`, `snapshots/octocat.json`, five synthetic accounts (`recordings/synthetic/{active,forks,empty,partial,archived}/`, 27 files) and the 12 octocat detail files; edited `conftest.py`, `test_service.py`, `test_client.py`, `recordings/manifest.json` (new `accounts.<name>.fetched_at`); AUDIT (2.3, 2.4, 2.5, 2.7, 2.13), ISSUES (I-0047, I-0048), ROADMAP (P1-2 issue cell), `tests/README.md`, the spec (scope, decisions 3 and 4), WORKLOG. Nothing outside `github-evidence/` and `tests/github/` changed except those trackers.
Decisions beyond the spec (flagged in the plan, all in the README): `weekly` is the 52 weeks ending now, so a commit in the window but older than 52 weeks counts in `authored_commits` only; commit pagination is capped at 5 pages per repo (`commit_pages_capped:<repo>`); `GITHUB_CONCURRENCY` (default 5) is read; any failed detail call makes the response `partial`; the reported component `weight` is the renormalised one; `weights_source` is `env` only if a valid key applied; `sub_score` carries `partial`; `insufficient_evidence` when no component is available (I-0047); the recorder refuses to write if any detail call failed.
Cannot be automated: whether the formula is a fair first cut (owner; P3-12 calibrates it).
