# T-0033 — test-harness

## Paused (2026-11-05)

**Status:** draft, not approved, nothing implemented. The owner paused this task. Everything below
this section is draft v2 and assumes `48707d2` stays; if the merge is reverted, it needs the edits
listed here before approval.

**Open decision: what happens to `48707d2` (I-0080).** Both options keep suite-scoped ports, D2 and the
lint work unchanged.

| | **A. Owner's leaning: keep `636314c`, owner reverts `7fa7d1b` and `2442ad4`** | **B. `48707d2` stays** |
|---|---|---|
| Core's port | Returns to :5000 | Stays on :5001 |
| D1 | `run-suite` sets `PORT=5000` explicitly and refuses both 5000 and 5001 | `run-suite` sets `PORT=5001` explicitly and refuses both 5000 and 5001 |
| D3 | Dropped: the 10 cites resolve again, so criterion 14 goes | Stands, as it needs approval: re-point the 8 route cites and rewrite `ARCHITECTURE.md:167-168` |
| Criterion 7 and F3 | Expected `PORT` becomes 5000 | As written |
| Criterion 9 | The log line to match becomes `http://localhost:5000` | As written |
| Criterion 13 setup | No gateway needed: core on 5000 again serves the frontend directly | Needs the gateway and `npm ci` in `gateway/` |

Check these before reverting under option A:
- `2442ad4` is not core-only. It also changes `gateway/index.js` (the Windows direct-run fix),
  `gateway/.env.example` and the gateway session log, and adds `tests/gateway/live-gateway.test.mjs`,
  which needs `coreBaseUrl()` from `tests/backend/lib/env.mjs`. The revert removes all of these.
- `backend/index.js` and `backend/Controllers/assessment.controller.js` were conflict-resolved in
  `48707d2`, so they carry B3 work alongside these changes. Check both after reverting.
- All three commits are on `origin/b3-backend-correctness` and also on `main`, `origin/main` and
  `origin/aditya-ui-work`, so a revert must be new commits, not a history rewrite. Reverting on this
  branch alone leaves them on `main` until this branch merges there.
- After the revert, re-check I-0080 to I-0083 and the findings below, since F1, F2 and F9 should no
  longer hold. Run `check-trackers` to confirm rather than assuming.

**Pending, owner:** the I-0084 credential check. Does the `Myuser` / `pass123` login in
`tests/.env.example:6-7` exist on the shared Supabase project? If it does, it is in git history and
needs rotating. Not tested by me.

**First step on resume:** read the current branch and the state of `2442ad4` and `7fa7d1b` to see which
option was taken, then run `node tests/docs/check-trackers.mjs` and rewrite D1, D3 and the affected
criteria to match. After that, get the criteria approved. No code before that approval.

---

> Status: **draft v2, not approved.** D1 and D2 were decided assuming `48707d2` stays (see Paused).
> **D3 is open and depends on the owner's decision on I-0080.** Criteria 8 and 14 assume it stays.

## Goal
Make `tests/run-suite.ps1` refuse to run when a port the selected suites use is already taken, and
make a clean run exit 0, so that a passing run always describes the code in this tree.

## Spec ref
No FR/NFR applies (test harness). Source: ISSUES I-0077 and I-0068, plus the harness clause of
ROADMAP P2-6 ("`run-suite.ps1` refuses occupied ports, I-0077"), pulled forward by the owner.
Related: I-0080 to I-0083.

## Findings

| # | Finding | Evidence | How it was established |
|---|---------|----------|------------------------|
| F1 | `run-suite` cannot reach the backend at HEAD. Core defaults to 5001 and `run-suite` waits on 5000, so the wait should time out and throw, skipping the backend suite and every suite after it, with no summary. | `backend/index.js:22`, no `PORT` in `backend/.env`; `tests/run-suite.ps1:54`, `:103` | Read from the code, **not run** |
| F2 | **The docs suite fails at HEAD:** `check-trackers` exits 1 with 10 problems, all `ARCHITECTURE.md` cites to lines `48707d2` removed from `backend/Routes/auth.routes.js`. Lint and ports alone therefore cannot give exit 0. | `ARCHITECTURE.md:167-168`, `:709-714`, `:719` | Measured at `7c89da7` |
| F3 | Passing `PORT=5001` does not guarantee 5001. `backend/Config/supabase.js:12` loads `.env` with `override:true`, so a `PORT` line in `backend/.env` wins, and `README.md:105` tells people to add `PORT=5000`. | Criterion 7 handles this | Read from the code |
| F4 | `live-evaluate-once` needs :8002 up, `live-evaluate-release` needs it down, and `run-suite` does not start that service. | `tests/backend/live-evaluate-once.test.mjs:17`, `tests/backend/live-evaluate-release.test.mjs:21` | Read from the code |
| F5 | A connection cannot reveal the PID. Connecting decides whether the port is taken; `Get-NetTCPConnection` names the owner. A failed lookup must still refuse. | Criterion 6 | Design note |
| F6 | A refused connect on loopback takes about 2 s here (2013–2055 ms, 10 of 10), so probes must run in parallel. | Probe run 2026-11-05 | Measured |
| F7 | The 9 lint warnings are exactly those in I-0068. | `npx eslint --ext .js,.jsx src`: 0 errors, 9 warnings | Measured at `7c89da7` |
| F8 | The two `navigate` removals also stop the layouts re-rendering on navigation. Neither layout reads the location, so output should not change. Criterion 13 checks this. | `CandidateLayout.jsx:10`, `RecruiterLayout.jsx:8` | Read from the code |
| F9 | The browser check needs the gateway. `frontend/.env:1` targets :5000 and core no longer sends CORS headers, so the frontend cannot use core directly. | I-0082 | Read from the code |
| F10 | Other suites at HEAD: github 80/80, assessment 12/12, offline backend 88/88. NLP, frontend and the live backend suites have not run since `48707d2`. | This session | Measured |

## Decisions

- **D1, decided.** Core stays on :5001. `run-suite` sets `PORT=5001` explicitly when it starts the
  backend and does not rely on the `index.js` default. :5000 and :5001 are both refused.
- **D2, decided.** `-AllowPort 8002` is approved, with the freshness rule in Scope.
- **Port scope, decided.** Refuse only the ports the selected suites use.
- **D3, open: the 10 broken cites (F2).**
  - **If `48707d2` stays (recommended, and assumed here):** T-0033 re-points the 8 route cites to
    `backend/Routes/auth.routes.js:15-21` and rewrites the now-false limiter bullet at
    `ARCHITECTURE.md:167-168`. Docs only, and limited to what the checker flags. The wider refresh
    stays with I-0083 and T-0022 Part 2.
  - **If it is reverted:** the cites become valid again and criterion 14 is dropped, but D1 and F1
    must be revisited, because core returns to :5000.

## Scope
**In:**
- **Port guard**, new `tests/lib/port-guard.ps1`, dot-sourced by `tests/run-suite.ps1`, running
  before any service starts. Ports by selected suite:

  | Suite | `current` | `baseline` |
  |-------|-----------|------------|
  | `nlp` | 8000 | 8100 |
  | `backend` | 5000, 5001, 8000 | 5100, 8100 |
  | `backend -Live` | adds 8001, 8002 | no addition |
  | `frontend`, `docs`, `github`, `assessment` | none | none |

  The list is from reading the code: non-Live backend tests use ephemeral stubs (`port: 0`), and the
  `github` and `assessment` suites bind nothing.
- **Detection:** a TCP connect to `127.0.0.1` and `::1`, in parallel, within about 2.5 s.
- **Attribution:** `Get-NetTCPConnection -State Listen`, never `netstat`.
- **Refusal:** print every occupied port with address, PID, process name and start time, start
  nothing, and exit **2**, which is distinct from test failures (exit 1).
- **Explicit port:** `$bePort = 5001` for `current`. `$env:PORT` is set immediately before the backend
  starts and removed straight after, so it does not reach the test processes. `baseline` gets its own
  `$bePort`.
- **`.env` conflict (F3):** if the target tree's `backend/.env` has a `PORT` line that differs from
  `$bePort`, refuse with exit 2 and say why. Only that line is read or printed.
- **`-AllowPort 8002`**, accepting only that value:
  - Print the listener's PID, process name and start time.
  - Refuse (exit 2) if it started before the newest file under `assessment-service/app/`, ignoring
    `__pycache__`, and print both timestamps.
  - Refuse if the PID or start time cannot be read, because freshness then cannot be shown.
  - Refuse if nothing is listening. *Not in your decision, added:* otherwise `live-evaluate-once`
    skips silently, which is what the flag exists to prevent.
  - When the selected suites do not use :8002, print that the flag has no effect.
- **`-PreflightOnly`**, *added:* run the guard, then exit without starting anything. With guards scoped
  by suite, this is the only way to test the pass paths without starting services.
- **Lint:** remove these unused bindings and nothing else:
  - `frontend/src/components/layouts/CandidateLayout.jsx`: `navigate`, and the `useNavigate` import
  - `frontend/src/components/layouts/RecruiterLayout.jsx`: `navigate`, and the `useNavigate` import
  - `frontend/src/pages/recruiter/AllCandidates.jsx`: `Filter`, `ExternalLink`
  - `frontend/src/pages/recruiter/CreateJob.jsx`: `Plus`, `X`
  - `frontend/src/pages/recruiter/Jobs.jsx`: `MapPin`, `Users`, `Sparkles`
- **Docs (D3):** the 10 cites in `ARCHITECTURE.md`.
- **Docs and trackers:** `tests/README.md` (ports table, how to run the guard test), the header comment
  in `tests/run-suite.ps1`, ISSUES, ROADMAP P2-6, WORKLOG.

**Out:**
- Decisions and fixes for I-0080 to I-0084, filed 2026-11-05, apart from D3's 10 cites.
- The `import.meta.env` line, `AllCandidates.jsx:8`, half of I-0068. Changing it changes behaviour, and
  it is T-0021's work. Its note moves to I-0012 when I-0068 closes.
- Starting the gateway, a `gateway` suite, and `tests/gateway/*` in `run-suite` (T-0022 Part 2).
- Failing when a started process exits, the second half of I-0077's proposed fix. Only a listener
  appearing between the check and the bind gets through. Recorded in the I-0077 resolution.
- Killing the process that holds a port. The script reports it and never stops it.
- Confirming that the :8002 listener really is assessment-service. The script shows the name and
  start time only.
- **Any other failure a clean run reveals.** NLP, frontend and live backend are unverified (F10). I
  stop and report rather than widening the task.

## Acceptance criteria
"Clean run" means no listeners on the guarded ports and no changes in the tree beyond T-0033's.
Because I never commit, the tree will show T-0033's own edits; you can repeat criterion 9 after your
commit.

**Port guard**

1. **Refuses when :5000 is occupied, starts nothing, exits 2, and names the PID.** Checked by:
   ```powershell
   $s = New-Object Net.Sockets.TcpListener([Net.IPAddress]::Loopback, 5000); $s.Start(); "holder PID $PID"
   powershell -File tests\run-suite.ps1 -Target current -Suites backend; "exit=$LASTEXITCODE"
   $s.Stop()
   ```
   Expected: output names `:5000` and the holder PID, `exit=2`, no `== starting` line.
2. **Each port the suites use refuses on its own,** per the Scope table: 5000, 5001, 8000 for
   `backend`; 8000 for `nlp`; 8001 and 8002 for `backend -Live`; and 5100, 8100 for `baseline`. Checked
   by `tests/harness/port-guard.test.mjs`.
3. **Ports a suite does not use are not refused.** With all of them held: `-Suites docs`, `frontend`,
   `github` and `assessment` pass the guard. `-Suites nlp` passes with :5000 held. `-Suites backend`
   without `-Live` passes with :8002 held. Same test file, using `-PreflightOnly`.
4. **Detection works on each bind shape:** `127.0.0.1`, `::1` only, and Node's default dual-stack
   `listen(port)`, which is how `backend/index.js:80` binds. Same test file.
5. **All occupied ports are listed, not just the first.** Two held at once: both appear. Same test file.
6. **A failed owner lookup still refuses.** With `Get-PortOwner` overridden to return nothing, the port
   is reported with `PID unknown`, and exit is 2. A PID whose process has gone prints
   `(process not found)`. Same test file. `netstat` absent:
   `Select-String -Path tests\run-suite.ps1,tests\lib\port-guard.ps1 -Pattern 'netstat'` → no matches.

**Explicit port**

7. **`run-suite` sets the port, and a conflicting `.env` is refused.** A test sets
   `PORT=5000` in a temporary `.env` fixture and the guard exits 2 naming the `.env` conflict, with no
   other `.env` content in the output. `$env:PORT` is empty once the backend has started. Same test
   file, plus criterion 9's log check.

**Allowing :8002**

8. **`-AllowPort 8002` applies the freshness rule.** Unit cases, against a temporary source folder:
   newest file older than the listener → passes and prints PID and start time; newer → exit 2 and
   prints both timestamps; `__pycache__` newer → passes; unreadable start time → exit 2. In the run:
   :8002 free with the flag → exit 2; `-AllowPort 5000` → rejected at parameter binding. Same test file.
   Then against the real service, by hand:
   ```powershell
   powershell -File tests\run-suite.ps1 -Target current -Suites backend -Live -AllowPort 8002 -PreflightOnly; "exit=$LASTEXITCODE"
   (Get-Item assessment-service\app\main.py).LastWriteTime = Get-Date
   powershell -File tests\run-suite.ps1 -Target current -Suites backend -Live -AllowPort 8002 -PreflightOnly; "exit=$LASTEXITCODE"
   ```
   Expected: `exit=0` with the PID and start time, then `exit=2` after the timestamp bump. The file's
   content does not change. Finally, a full `-Live -AllowPort 8002` pass on a freshly started service,
   in which `live-evaluate-once` runs rather than skips.

**Exit code**

9. **A clean run exits 0, using the suite's own backend.** Checked by:
   ```powershell
   powershell -File tests\run-suite.ps1 -Target current; "exit=$LASTEXITCODE"
   Select-String -Path tests\.out\current-backend.out.log -Pattern 'Server running on http://localhost:5001'
   Select-String -Path tests\.out\current-backend.err.log -Pattern 'already in use'
   ```
   Expected: `exit=0`; every suite in the summary shows 0; the first search matches; the second finds
   nothing. Then repeat with `-Live`, with the same result, 5 skips or fewer and the skip reasons
   recorded. `-Live` writes to Supabase under the `t0001_` accounts, as before.
10. **The guard adds at most 3 s.** Measured from `-PreflightOnly` with all ports free.

**Lint**

11. **Zero warnings, and a passing CI build.** From `frontend/`:
    `npx eslint --ext .js,.jsx --max-warnings 0 src; "exit=$LASTEXITCODE"` → `exit=0`, and
    `$env:CI='true'; npm run build; "exit=$LASTEXITCODE"; Remove-Item Env:CI` → `exit=0`.
12. **The diff removes unused bindings and nothing else.** `git diff --numstat -- frontend` must show
    exactly: `1 2` CandidateLayout, `1 2` RecruiterLayout, `1 1` AllCandidates, `1 1` CreateJob, `1 1`
    Jobs. Every added line is an import line with names only removed, shown in the Result.
13. **Navigation still works in both layouts (F8).** Manual, since the frontend has no tests.

    Setup (F9), with the gateway on defaults, and `npm ci` in `gateway/` first (`node_modules` is
    git-ignored): NLP on 8000, core on 5001, `node index.js` in `gateway/`, `npm start` in `frontend/`.
    Record the console once before the lint edits.

    **`CandidateLayout`, signed in as `t0001_cand`, starting at `/candidate/dashboard`:**

    | Click | Expected route |
    |-------|----------------|
    | Jobs | `/candidate/jobs` |
    | A job in the list | `/candidate/jobs/:id` |
    | Assessment (open only; generating calls the LLM) | `/candidate/assessment` |
    | Profile | `/candidate/profile` |
    | Notifications | `/candidate/notifications` |
    | About | `/candidate/dashboard` |
    | Logo, from any other route | `/candidate/dashboard` |
    | Browser Back | the previous route |

    **`RecruiterLayout`, signed in as `t0001_recr`, starting at `/recruiter/dashboard`:**

    | Click | Expected route |
    |-------|----------------|
    | Jobs | `/recruiter/jobs` |
    | A job in the list | `/recruiter/jobs/:id` |
    | Create-job button | `/recruiter/create-job` |
    | Profile avatar | `/recruiter/profile` |
    | Dashboard | `/recruiter/dashboard` |
    | Logo, from any other route | `/recruiter/dashboard` |
    | Create-job button at phone width | `/recruiter/create-job` |
    | Browser Back | the previous route |
    | Open `/recruiter/candidates` by URL (no link in the app goes here) | the page renders |
    | A candidate's job link on that page | `/recruiter/jobs/:id` |

    Pass, at each step: the URL changes, the page content changes, the nav bar stays, and the console
    has no new errors compared with the recording.
    `/candidate/results`, `/candidate/upload` and `/candidate/processing` are out: the first is reached
    only from the analyze flow, and the other two are outside the layout.

**Docs (D3)**

14. **The docs suite passes.** `node tests/docs/check-trackers.mjs` → exit 0, 0 problems; the diff in
    `ARCHITECTURE.md` touches only `:167-168`, `:709-714` and `:719`.

## Test plan
- Tests to write FIRST (must FAIL before the change, PASS after):
  - `tests/harness/port-guard.test.mjs` (`node:test`), which holds real sockets from Node and spawns
    `run-suite.ps1`, using its own `process.pid` for the PID assertion. Refusal cases need no flag,
    because the guard runs before anything starts; pass cases use `-PreflightOnly`. It stops with a
    clear message if a guarded port is busy when it starts.
  - Expected red at HEAD: refusal cases fail, and the `-AllowPort` and `-PreflightOnly` cases fail at
    parameter binding.
- Before-runs to record first:
  - `run-suite -Target current -Suites backend` at HEAD, to turn F1 into an observed failure.
- Standalone, not a default suite: run by hand, like `tests/arch/nlp-outage-probe.mjs`, and documented
  in `tests/README.md`. It holds these ports itself, so it cannot run alongside the suite's services.
- Criteria that can't be automated, and why:
  - Criterion 13: needs a signed-in browser, and the frontend has no test runner until P1-8.
  - Criterion 8's real-service steps: they need a live assessment-service.

## Regression
- `tests/run-suite.ps1 -Target current` and `-Live`: all suites. Last known counts, before `48707d2`:
  nlp 14/14, github 80/80, assessment 12/12, backend 167 pass and 5 skip with :8002 down, 171 pass and 1
  skip with it up.
- `tests/nlp/snapshots/current/` unchanged.

## Risks and rollback
- **More red behind F1.** Handled by the Out rule. In particular, the backend suite goes straight to
  core, which no longer has CORS or a limiter. My grep of `tests/backend` for CORS and 429 assertions
  found none, but that is not a run.
- **False freshness refusals.** `git checkout` or a sync that rewrites a file updates its timestamp,
  and a `uvicorn --reload` parent keeps its old start time. Both refuse; restarting the service clears
  it. A change to `assessment-service/.env` is not detected.
- **Suite-scoped refusal leaves the docs and frontend suites unguarded,** which is correct, since they
  use no port. It also means criterion 3 must stay in sync when a suite gains a port.
- **Conflict with T-0022 Part 2,** which owns the same `run-suite` lines. When the gateway joins the
  backend suite, :5000 becomes used rather than only refused, and the table stays valid.
- **A hung listener** with a full backlog does not accept a connect, so it reads as free. The bind then
  fails, or the health wait does. Accepted; rare.
- **Frontend merge conflicts,** small, limited to the listed import lines, if T-0021 lands first.
- **Rollback:** revert the change. No migration and no data.

## At close
- ISSUES: resolve I-0077 and I-0068 with evidence, and move the `import.meta.env` note to I-0012.
- ROADMAP: P2-6, note the `run-suite` clause as delivered by T-0033. Place I-0080 to I-0084 in
  ROADMAP rows after the I-0080 decision; until then the docs suite prints a warning for each, which
  does not affect its exit code.
- Suggested commit boundary, for you: guard and test; explicit port; lint; ARCHITECTURE cites.

---

## Result
<Filled at the end. One line per acceptance criterion.>

No evidence recorded = FAIL, regardless of belief that it works.
