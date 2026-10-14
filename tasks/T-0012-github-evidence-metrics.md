# T-0012 — github-evidence-metrics

> Status: **spec only, awaiting owner approval of the acceptance criteria**
> (written in T-0010, 2026-10-14). ROADMAP item P1-2. Depends on T-0011. The two open
> questions were answered by the owner on 2026-10-15 (see "Decisions"); no code until
> the criteria are approved.

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
- **Detail repos:** owned, non-fork, non-archived repos, the `GITHUB_DETAIL_REPOS`
  (default 10) most recently pushed. They get `/languages` and
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

## Acceptance criteria
1. **Languages.** Bytes are summed per language over the detail repos; `share` sums
   to 1 ± 0.001; sorted by bytes descending — `test_language_breakdown` (recording).
2. **Commit activity.** `weekly` has exactly 52 integers. `authored_commits` equals
   the sum of the recorded commits inside the window, and `active_weeks` the count of
   non-zero weeks. A synthetic recording with commits across 2 pages is counted fully
   — `test_commit_activity`.
3. **Ownership.** `owned`/`forked`/`archived` counts match the recording. Forks and
   archived repos get no detail calls; respx asserts their URLs were never requested
   — `test_ownership`.
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
<Filled at the end. One line per acceptance criterion.>
