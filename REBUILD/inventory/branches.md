# Inventory: git branches (Phase 1)

Auditor: branches. Date: 2026-11-12. Repo HEAD: `rebuild/fable` = `main` = `origin/main` = `6da8d3f`.
All git use was read-only (`branch -a -vv`, `log`, `show`, `diff`, `rev-list`, `rev-parse`,
`merge-base`, `reflog show`). No fetch was run, so `origin/*` refs are as last fetched locally.

Labels: **VERIFIED** = I ran a command and saw the result. **READ** = I read code or docs (at the
cited ref) but did not run the behaviour. **UNKNOWN** = not established.

---

## 0. Headline (read this if nothing else)

1. **`b3-backend-correctness` (local) and `wip/t0033-paused` (local and origin) are the same commit,
   `389df2d`.** VERIFIED (`git rev-parse`). `origin/b3-backend-correctness` is one commit behind at
   `7c89da7` (local is ahead 1, behind 0; `git rev-list --left-right --count`).
2. **No code on either branch is missing from `main`.** The trees of `48707d2`, `7c89da7`, `1995c48`
   and `main` (`6da8d3f`) are byte-identical (all tree `9c9c3537…`). VERIFIED (`git rev-parse <c>^{tree}`
   and empty `git diff --stat` between each pair). The "Add gateway and Gemini assessment support"
   commit `48707d2` is a local merge with the *same two parents* (`3b29a9f`, `7fa7d1b`) as the GitHub
   merge `1995c48`, with the same result; its message describes content that arrived from `main`
   (`7fa7d1b` / `2442ad4` / `636314c`), not new work.
3. **The only thing not in `main` is `389df2d`: three docs files, +396 lines, 0 deletions:**
   `tasks/T-0033-test-harness.md` (new, 306 lines), `ISSUES.md` (+70: I-0080..I-0084),
   `WORKLOG.md` (+20: L-0053, L-0054). No code, schema, auth, endpoint or test change. VERIFIED
   (`git diff --stat main...wip/t0033-paused`).
4. **No conflict with `main`.** `main` has not changed since the merge base `1995c48` (tree-identical;
   `git diff --name-only 1995c48..main` is empty). VERIFIED.
5. **T-0033 never started implementation** (draft v2, not approved, paused). Nothing of it exists on
   any branch. Its real value is the findings it recorded about `main` as it stands today, several
   of which I re-checked on `main` (section 1.6).

---

## Part A1: `b3-backend-correctness`

### A1.1 Refs, merge base, ahead/behind, commits (VERIFIED)

| Ref | Tip | Merge base with `main` | Ahead of `main` | Behind `main` |
|---|---|---|---|---|
| `b3-backend-correctness` (local) | `389df2d` | `1995c48` | 3 | 1 |
| `origin/b3-backend-correctness` | `7c89da7` | `1995c48` | 2 | 1 |

The "behind 1" commit is `6da8d3f` itself (the PR #7 merge commit, parents `7fa7d1b` + `1995c48`);
it carries no content change relative to `1995c48`.

Commits ahead of `main` (`git log main..b3-backend-correctness`):

| Hash | Date | Author | Subject | Content not in `main`? |
|---|---|---|---|---|
| `389df2d` | 2026-11-05 01:39 +0530 | anthonyjennis | Draft test harness task and record blockers | **Yes** (docs only, see A2) |
| `7c89da7` | 2026-11-05 00:45 +0530 | anthonyjennis | Merge branch 'b3-backend-correctness' of https://github.com/C72-BTECH-PROJECT/Patina into b3-backend-correctness | No (tree = `main`) |
| `48707d2` | 2026-11-05 00:45 +0530 | anthonyjennis | Add gateway and Gemini assessment support (merge, parents `3b29a9f` + `7fa7d1b`) | No (tree = `main`) |

Reflog (`git reflog show b3-backend-correctness`, VERIFIED) shows the life of the branch: created
from `f5069a3`, fast-forwarded to `88d03eb`, `278e2dd` (T-0031 spec approved), `3b29a9f` (Harden
backend correctness and service clients), local merge `48707d2` of `7fa7d1b`, `git pull` that
produced `7c89da7` (merging the GitHub-side `1995c48`), then `389df2d`.

### A1.2 Task that was in progress

The branch was created for **T-0031, "B3: backend correctness" (ROADMAP P0-3)**. READ:
`main:tasks/T-0031-b3-backend-correctness.md:1`, `:3` ("Status: DONE 2026-11-04 on branch
`b3-backend-correctness` … All 16 criteria PASS"), Result section from `:435`. WORKLOG mentions:
`main:WORKLOG.md:508`, `:519`, `:535`, `:546`, `:549` (L-0050..L-0052 close it).
Scope (from the task's section headings, READ, `:79-336`): I-0063/I-0028 applicant email and names,
I-0029 malformed application id, I-0027 404 message, I-0025 10 MB upload cap, I-0065 stale GitHub
text, I-0062 assessment calls over `internalHttp`, I-0059 spaCy model by package name, I-0039 cruft,
I-0016 one-word name, I-0071 rejection notification, I-0072 `.txt` on upload paths, I-0073 malformed
`assessmentId`, plus migration `20261104120300_applicant_emails.sql`.

### A1.3 How far it got

- T-0031 is **fully merged** into `main`: `278e2dd` and `3b29a9f` are ancestors of `main` via `1995c48`
  / `6da8d3f`. VERIFIED (`git log --graph`; `git rev-list --count main..origin/b3-backend-correctness`
  gives commits but `git diff main...origin/b3-backend-correctness` is empty).
- Its Result table records 16/16 PASS (READ, `main:tasks/T-0031-b3-backend-correctness.md:446-461`).
  I did not re-run any of it. **Caveat (VERIFIED in part):** that evidence was gathered on `3b29a9f`,
  *before* `7fa7d1b`/`2442ad4` were merged in. At least criterion 14 ("`check-trackers` 0 problems")
  no longer holds on `main`: `node tests/docs/check-trackers.mjs` on the current tree exits **1** with
  11 problems, 10 of them ARCHITECTURE.md cites to `backend/Routes/auth.routes.js:17-52`, a file now
  24 lines long (the 11th is `REBUILD/DECISIONS.md` named in the uncommitted CLAUDE.md edit). The other
  15 T-0031 criteria are UNKNOWN on today's `main`; the task's live-suite results predate the merge.
- The T-0031 task file still says "uncommitted" at `:3`; it was in fact committed in `3b29a9f`. READ.

### A1.4 What is left

Nothing of T-0031 is outstanding on the branch. What is left is consequential: the post-merge
regressions recorded in `389df2d` (I-0080..I-0083), which live only on the branch (see A2).

### A1.5 What it changes vs `main`

`git diff --stat main...b3-backend-correctness` = the same 3 docs files as `wip/t0033-paused`
(A2.5). `git diff --stat main...origin/b3-backend-correctness` is **empty**. VERIFIED.

### A1.6 Conflict with `main`

None. `1995c48..main` changes no files. VERIFIED.

### A1.7 Options, factually

- **Resume:** there is no unfinished B3 work to resume; resuming the branch means resuming T-0033.
- **Cherry-pick:** only `389df2d` carries content (same as A2.7). The two merge commits carry nothing.
- **Discard:** deleting `b3-backend-correctness` (local) loses nothing as long as `wip/t0033-paused`
  (local + origin) is kept, because it points to the same commit. Deleting
  `origin/b3-backend-correctness` loses nothing at all (tree = `main`).

---

## Part A2: `wip/t0033-paused`

### A2.1 Refs, merge base, ahead/behind, commits (VERIFIED)

| Ref | Tip | Merge base with `main` | Ahead | Behind |
|---|---|---|---|---|
| `wip/t0033-paused` (local) | `389df2d` | `1995c48` | 3 | 1 |
| `origin/wip/t0033-paused` | `389df2d` | same | 3 | 1 |

Local and origin are identical. The branch was created from HEAD at `389df2d` (`git reflog show
wip/t0033-paused`: "branch: Created from HEAD"), i.e. it is a bookmark of `b3-backend-correctness`.
Commits ahead: the same three as A1.1; only `389df2d` has content.

### A2.2 Task that was in progress: T-0033 "test-harness"

Source: `wip/t0033-paused:tasks/T-0033-test-harness.md` (READ), WORKLOG L-0053/L-0054
(`389df2d` diff, appended after `main:WORKLOG.md:589`), ISSUES I-0080..I-0084.

- **Goal** (`T-0033:46-48`): make `tests/run-suite.ps1` refuse to run when a port the selected suites
  use is already taken, and make a clean run exit 0, "so that a passing run always describes the code
  in this tree". Source issues: I-0077 (run-suite silently tests whatever already answers on :5000)
  and I-0068 (9 frontend lint warnings), plus the harness clause of ROADMAP P2-6 (`:50-53`).
- **Planned scope** (`:84-125`): new `tests/lib/port-guard.ps1` dot-sourced by `run-suite.ps1`;
  suite-scoped port table (`:89-94`); TCP-connect detection + `Get-NetTCPConnection` attribution;
  exit 2 on refusal; explicit `PORT=5001` for the suite's backend; refuse a conflicting `PORT` in
  `backend/.env`; `-AllowPort 8002` with a source-freshness rule; `-PreflightOnly`; remove 9 unused
  frontend imports/bindings in 5 files; re-point 10 broken ARCHITECTURE.md cites (D3).
- **Why it paused** (`:3-39`): while drafting, the author found that the merge `48707d2` (= what is now
  on `main`) brought in Aditya's `636314c` / `2442ad4` / `7fa7d1b`, which moved core to :5001, removed
  CORS and the password-reset limiter from core, and added Gemini assessment work, outside any
  approved task (I-0080, P1). The harness design depends on which port core lives on, so the owner
  paused pending a decision. Two options are tabulated at `:12-19`:
  **A** (owner's leaning, `:12`, L-0054): keep `636314c`, revert `7fa7d1b` and `2442ad4` (core back to
  :5000); **B**: keep the merge (core stays :5001, gateway needed for the UI).
- Also pending: the owner's check of a credential-shaped username/password pair in
  `tests/.env.example:6-7` (I-0084, `T-0033:33-35`). I did not print the values.

### A2.3 How far it got (all READ from the diff; nothing can be VERIFIED without checking it out)

`T-0033:5`: "draft, not approved, nothing implemented". Confirmed against `main` (VERIFIED by
`git ls-tree` / `git show main:`): no `tests/lib/` or `tests/harness/` directory; `tests/run-suite.ps1`
has no `AllowPort`, `PreflightOnly` or `port-guard` reference and still sets `$bePort = 5000`
(`main:tests/run-suite.ps1:54`); `CandidateLayout.jsx:2`, `:10` still import/assign `useNavigate`;
`Jobs.jsx:4` still imports `MapPin`, `Sparkles`; `ARCHITECTURE.md:167-168` still cites the removed lines.

| # | Criterion (T-0033 line) | State |
|---|---|---|
| 1 | Refuses when :5000 occupied, exit 2, names PID (`:147-153`) | Untouched |
| 2 | Each used port refuses on its own (`:154-156`) | Untouched (test file not written) |
| 3 | Unused ports not refused (`:157-159`) | Untouched |
| 4 | Detection on each bind shape (`:160-161`) | Untouched |
| 5 | All occupied ports listed (`:162`) | Untouched |
| 6 | Failed owner lookup still refuses; no `netstat` (`:163-166`) | Untouched |
| 7 | run-suite sets port; conflicting `.env` refused (`:170-173`) | Untouched |
| 8 | `-AllowPort 8002` freshness rule (`:177-189`) | Untouched |
| 9 | Clean run exits 0 (`:193-201`) | Untouched; blocked by F1/F2 below |
| 10 | Guard adds ≤ 3 s (`:202`) | Untouched |
| 11 | ESLint 0 warnings + CI build (`:206-208`) | Untouched (baseline measured: 9 warnings, F7) |
| 12 | Diff removes unused bindings only (`:209-211`) | Untouched |
| 13 | Manual navigation check in both layouts (`:212-249`) | Untouched |
| 14 | Docs suite passes (`:253-254`) | Untouched; currently fails (VERIFIED, see A1.3) |

What *was* done: the spec itself (draft v2 with decisions D1, D2, port scope "decided"; D3 open),
ten findings F1–F10 (`:57-68`), five new issues, two worklog entries. Result section empty (`:303-306`).

### A2.4 What is left

1. Owner decision on I-0080 (option A revert vs option B keep). Per `T-0033:37-39` the first step on
   resume is to read the state of `2442ad4`/`7fa7d1b`, run `check-trackers`, rewrite D1/D3 and the
   affected criteria, and get approval. As of today neither revert has happened: `main` still has
   `app.set('trust proxy', 1)` and `PORT = process.env.PORT || 5001` at `main:backend/index.js:21-22`.
   VERIFIED (`git show main:backend/index.js`).
2. Owner's I-0084 credential check (`tests/.env.example:6-7` still present on `main`; VERIFIED that the
   two non-dotenv lines exist; whether the account is live is UNKNOWN).
3. Approval of the 14 criteria, then the whole implementation (guard script, test file, run-suite
   edits, lint edits, ARCHITECTURE cites, tests/README), then the Result section.
4. Note for the rebuild: T-0033's design targets the old `tests/run-suite.ps1` harness; whether the
   rebuild keeps that harness is a lead decision.

### A2.5 What it changes (`git diff --stat main...wip/t0033-paused`, VERIFIED)

| Area | Files | Lines |
|---|---|---|
| Backend / NLP / assessment / github-evidence / gateway / frontend | none | 0 |
| Tests | none | 0 |
| Schema / migrations | none | 0 |
| Auth | none | 0 |
| Docs / trackers | `tasks/T-0033-test-harness.md` (new), `ISSUES.md`, `WORKLOG.md` | +396 / −0 |

Key hunks, in words:
- `ISSUES.md`: five rows inserted after I-0078 in the open table (`389df2d:ISSUES.md:57-61`) and five
  detail sections inserted before "## Resolved" (`:511-575`, heading at `:577`):
  - **I-0080 (P1)**: merge `48707d2` landed T-0022 Part 2 core/NLP changes and unspecified assessment
    work outside approved scope. Lists Part 2 gaps: `/api/health` has no real readiness check (try
    around `res.json` cannot fail; same code on `main:backend/index.js:63-70`, READ), NLP request-ID
    middleware logs nothing, `resolveRequestId` not moved, no gateway suite, `backend/.env.example`
    dropped `GITHUB_EVIDENCE_URL`, `GITHUB_EVIDENCE_TIMEOUT_MS`, `ASSESSMENT_SERVICE_URL` and the
    service-role-key warning. No tests reference the Gemini path (`_try_gemini`, `GEMINI`,
    `include_github`, `github_data`).
  - **I-0081 (P2)**: `tests/arch/nlp-outage-probe.mjs` assumes core on :5000.
  - **I-0082 (P2)**: frontend targets :5000, no CRA proxy, core sends no CORS, so the UI needs the
    gateway running; `gateway/node_modules` absent on the author's machine.
  - **I-0083 (P2)**: README/ARCHITECTURE/AUDIT/Docs/tests still say core is on :5000; `README.md:105`
    + `backend/Config/supabase.js:12` (`override:true`) make a `.env` `PORT` beat the caller's.
  - **I-0084 (P2)**: credential-shaped lines added to tracked `tests/.env.example` by `7fa7d1b`.
- `WORKLOG.md`: L-0053 (T-0033 drafted, `48707d2` reviewed, I-0080..84 filed; measured: eslint 9
  warnings, github 80/80, assessment 12/12, offline backend 88/88, docs exit 1; NLP, frontend and live
  suites not run since the merge) and L-0054 (paused; owner leaning option A).
- `tasks/T-0033-test-harness.md`: the spec described in A2.2–A2.3.

For context only (already on `main`, not part of either branch's delta), the merge `48707d2` brought
32 files, +2091/−133 (`git diff --stat 48707d2^1 48707d2`, VERIFIED): new `gateway/` service (index,
forwardAuth, limits, cors, health, requestId, static, public-routes, package + lockfile, PLAN/README/
SESSION_LOG), `tests/gateway/` (auth-routing, edge, live-gateway), `backend/index.js`,
`backend/Routes/auth.routes.js` (−limiter), `backend/Middlewares/requestId.js` (new),
`backend/Controllers/assessment.controller.js`, `backend/.env.example`, `nlp-engine/app/main.py`,
`assessment-service/app/{config,llm_client,prompts}.py` + `.env.example` (Gemini primary, OpenRouter
fallback), `frontend/src/pages/candidate/Assessment.jsx` (−1 line), `STEPS_TO_RUN_APP.md`,
`tests/.env.example`, `tests/backend/lib/env.mjs`, `github-evidence/.env.example`. Other auditors
covering those services should treat this as `main`'s current state.

### A2.6 Conflict with current `main` (VERIFIED)

- Files changed `1995c48..main`: **none**. Files changed `1995c48..wip/t0033-paused`: `ISSUES.md`,
  `WORKLOG.md`, `tasks/T-0033-test-harness.md`. Overlap: none, so no region conflict today.
- Id collisions: `main`'s ISSUES has no I-0080..I-0084 (`git show main:ISSUES.md | grep -c I-008` → 0)
  and its WORKLOG ends at L-0052 (`main:WORKLOG.md:582`); `main:tasks/` has no T-0033. So the ids are
  free on `main` today. If the rebuild adds ISSUES/WORKLOG entries on `rebuild/fable` before taking
  this commit, the ids and insertion points (end of the open table, before "## Resolved", end of
  WORKLOG) will collide textually.

### A2.7 What each option involves (facts, no verdict)

- **Resume T-0033 as written:** requires the I-0080 decision first, then rewriting D1/D3 and several
  criteria, approval, and implementation of a PowerShell port guard + Node test + lint + doc fixes.
  The spec's findings F1/F2/F9 describe `main` as it is today (core :5001 vs harness :5000; docs
  suite red), so they apply to the rebuild's starting point whatever is decided. Its criteria are
  tied to the existing `run-suite.ps1` harness and the `t0001_` live accounts.
- **Cherry-pick `389df2d`:** a docs-only commit (+396/−0) that applies cleanly onto `main` /
  `rebuild/fable` as of now (no overlapping changes since the base). Brings the I-0080..I-0084 records
  and the T-0033 draft into the tracked history. The two merge commits on the branch carry no content
  and need not be taken.
- **Discard both branches:** loses only `389df2d`'s three docs (the T-0033 draft and issues
  I-0080..I-0084 with their evidence). No code is lost: everything else on both branches is
  tree-identical to `main`. The underlying problems I-0080..I-0084 describe would remain on `main`
  unrecorded in `ISSUES.md`.

---

## Part B: every other branch

One `git rev-list --count main..<branch>` per branch (VERIFIED, run 2026-11-12, no fetch):

| Branch | `main..branch` count |
|---|---|
| `Anthony` (upstream `origin/Anthony` gone) | 0 |
| `Anthony_V2` | 0 |
| `Anthony_V3` | 0 |
| `docs/team-assignments` | 0 |
| `feat/resume-score-persistence` (upstream gone) | 0 |
| `integrate/main-into-v3` | 0 |
| `origin/Aaron` | 0 |
| **`origin/aaron_v2`** | **1** |
| `origin/aditya-ui-work` | 0 |
| `origin/Anthony_V2` | 0 |
| `origin/Anthony_V3` | 0 |
| `origin/docs/team-assignments` | 0 |
| `origin/main` | 0 |

`git branch -a` showed no branches beyond the ones listed in the brief plus `b3-backend-correctness`,
`origin/b3-backend-correctness`, `wip/t0033-paused`, `origin/wip/t0033-paused` (Part A), `main`,
`origin/main`, `origin/HEAD -> origin/main` and `rebuild/fable` (= `main`).

**FLAG: `origin/aaron_v2` has 1 commit not in `main`:** `364acb8 2026-10-15 aaronninan-2702 | nlp fixed`.
Not investigated further, per the brief.
