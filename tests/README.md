# Test harness (T-0001)

Black-box tests that run unchanged against two trees:

| Target | Tree | NLP | Backend core | Gateway | Frontend (manual) |
|---|---|---|---|---|---|
| `baseline` | `../patina-baseline` (git worktree, detached at `32905c1`) | 8100 | 5100 | none | 3100 |
| `current` | this repo | 8000 | 5001 (`127.0.0.1`) | 5000 | 3000 |

Current (I-0080, kept by the rebuild): the gateway owns :5000 and is the only
public entry; core listens on `127.0.0.1:5001` behind it. The backend suite
and the `live-*` tests talk to **core directly** (`tests/backend/lib/env.mjs`:
`BACKEND_BASE_URL`, default = `CORE_BASE_URL`, default `http://127.0.0.1:5001`),
because they assert core's own answers and the gateway's deny-by-default 401
would mask them. Gateway tests use `GATEWAY_BASE_URL` (default
`http://localhost:5000`). The harness refuses to start if a port it needs is
already in use, so it never tests a process it did not start.
The baseline ports come from the worktree's **copied** `backend/.env`
(`PORT`, `NLP_PARSE_URL`, `FRONTEND_URL` appended), because
`backend/Config/supabase.js` loads `.env` with `override:true` — shell env
vars cannot override it.

## One-time setup

```powershell
# baseline worktree (from the repo root)
git worktree add ../patina-baseline 32905c1
# then copy backend/.env and frontend/.env into it, append to the copy:
#   PORT=5100 / NLP_PARSE_URL=http://localhost:8100/parse / FRONTEND_URL=http://localhost:3100
# and set REACT_APP_API_BASE_URL=http://localhost:5100 in its frontend/.env.
# node_modules: junction both from this repo (lockfile deltas are additive only)
New-Item -ItemType Junction -Path ..\patina-baseline\backend\node_modules  -Target backend\node_modules
New-Item -ItemType Junction -Path ..\patina-baseline\frontend\node_modules -Target frontend\node_modules

# test deps into the NLP venv
nlp-engine\venv\Scripts\python -m pip install -r tests\requirements.txt

# (re)generate fixtures — byte-stable, so no diff unless content changed
nlp-engine\venv\Scripts\python tests\fixtures\make_fixtures.py
```

## Running

```powershell
powershell -File tests\run-suite.ps1 -Target baseline                 # nlp + backend tier 1 + frontend build + docs + github (skipped: no service in baseline)
powershell -File tests\run-suite.ps1 -Target baseline -Suites nlp
powershell -File tests\run-suite.ps1 -Target baseline -Suites backend -Live   # + tier 2 (writes to Supabase)
powershell -File tests\run-suite.ps1 -Target current -Suites github         # github-evidence service vs recorded/synthetic GitHub responses (T-0011), no services, network blocked
powershell -File tests\run-suite.ps1 -Target current -Suites assessment     # assessment-service in process: docs off, 127.0.0.1:8002 bind (T-0029), no LLM, no port
powershell -File tests\run-suite.ps1 -Target current -Suites docs           # CHECKLIST/AUDIT/CLAUDE.md/ARCHITECTURE.md/ROADMAP.md drift check (T-0008..T-0010), no services
powershell -File tests\run-suite.ps1 -Target current -Suites backend        # NLP :8000 + core :5001, tests talk to core directly
powershell -File tests\run-suite.ps1 -Target current -Suites gateway        # core :5001 + gateway :5000, every tests\gateway\*.test.mjs (R-01), no writes
powershell -File tests\run-suite.ps1 -Suites e2e                            # R-19 Playwright against the stack already running from scripts\start-all.ps1 (run alone; -Target defaults to current)
cd gateway; npm test                                                          # offline gateway tests only (no services); `npm run test:live` needs core + gateway running
node tests\arch\nlp-outage-probe.mjs                                          # outage probe: P-1..P-3 NLP down/hung/busy (T-0009, descriptive), P-4..P-6 github-evidence down/hung/rate-limited (T-0015, asserting; exit 1 on a FAIL); starts its own core (no gateway), NLP and github-evidence, ports 5001/8000/8001 must be free; `--phase N` is repeatable
```

The script starts NLP (`PYTHONHASHSEED=0`, HF offline), backend core and,
for the gateway suite, the gateway from the chosen tree, waits for each
health URL (`:8000/`, `:5001/api/health`, `:5000/health`), runs the suites,
kills the processes it started, and logs to `tests/.out/` (git-ignored).

## Suites and data safety

| Suite | Files | Supabase |
|---|---|---|
| NLP | `nlp/test_parse.py`, `nlp/test_contact_determinism.py`, `nlp/test_model_load.py` | None — the NLP service has no Supabase client. The determinism test runs `extract_entities` in child processes (venv interpreter, `PYTHONHASHSEED` 0-4) and needs no running service (T-0013). |
| Backend tier 1 | `backend/smoke.test.mjs` | No writes; one `profiles` read (unknown-username login). |
| Gateway (R-01) | `gateway/auth-routing.test.mjs`, `gateway/edge.test.mjs` (offline: in-process gateway, stub upstreams on random loopback ports), `gateway/live-gateway.test.mjs` (against the gateway the harness started on :5000, core on :5001) | None. `cd gateway; npm test` runs the two offline files only; a new offline gateway test file must be added to that script too. Skipped for `-Target baseline`. |
| Backend unit (T-0014) | `backend/explainability.test.mjs`, `backend/github-evidence-client.test.mjs`, `backend/lib/stub-server.mjs`, `backend/fixtures/github-evidence-example-mokafor.json` | None, and no network beyond loopback. Import this repo's `backend/Services/*.js` directly. The client test runs against `lib/stub-server.mjs`, an HTTP stub bound on 127.0.0.1 and ::1, never the real service. Run in the default backend suite for `-Target current` only. |
| Backend tier 2 | `backend/live-analyze.test.mjs`, `backend/live-analyze-github.test.mjs` (T-0014) | **Live.** Dedicated `t0001_cand` / `t0001_recr` accounts (`tests/.env`), a job tagged `[T-0001 TEST]`, sweep before and after. `live-analyze-github` binds a github-evidence stub on **:8001** (core's default `GITHUB_EVIDENCE_URL`) that replays the fixture, so stop any real github-evidence service first; GitHub is never called. `-Target current` only. |
| Backend unit (T-0029) | `backend/migration-guards.test.mjs`, `backend/signup-profile.test.mjs`, `backend/grading-claim.test.mjs` | None. `migration-guards` reads `supabase/migrations/*.sql` (comments stripped) and checks the T-0029 migrations and the `handle_new_user` role rule; since T-0030 also: every file has a unique 14-digit version in the approved rename order, a file that adds an enum value does nothing else, no file contains a CR, the bucket-limits and `scores.subscores` comment migrations, and `20261104120200_function_bodies_lf.sql` re-creates every public function verbatim. The other two drive `backend/Services/{signupProfile,gradingClaim}.js` with fakes. |
| Backend tier 2, security (T-0029) | `backend/live-resume-authz.test.mjs`, `backend/live-answer-key-access.test.mjs`, `backend/live-evaluate-once.test.mjs`, `backend/live-evaluate-release.test.mjs`, `backend/live-signup-role.test.mjs`, `backend/lib/assessment.mjs` | **Live.** Same accounts and sweep (the sweep now also deletes C's `assessments`; their `assessment_keys` rows go by cascade). Attempts are seeded MCQ-only through the service role, so grading needs :8002 but no LLM. `live-answer-key-access` signs C and R in **directly to GoTrue** with the anon key from `backend/.env` and queries PostgREST with their own tokens (the attacker's view). `live-evaluate-release` runs only while :8002 is down. `live-signup-role` needs migration M1 applied; it creates auth users `t0001_role_*` with `auth.admin.createUser` (`email_confirm: true`, so no email is sent) and deletes them in teardown. `-Target current` only. |
| Backend unit (T-0031) | `backend/upload-limits.test.mjs`, `backend/applicant-identity.test.mjs`, `backend/assessment-service-client.test.mjs`, `backend/backend-cruft.test.mjs` | None, and no network beyond loopback. `upload-limits` runs the real `resumeUpload` middleware on a small Express app, including a real 10 MB body, and pins the constant to the bucket migration. `applicant-identity` drives `applicantIdentity.js` with a fake client. `assessment-service-client` uses `lib/stub-server.mjs`. |
| Backend tier 2, T-0031 | `backend/live-applicants.test.mjs`, `backend/live-upload-gates.test.mjs` | **Live.** Same accounts and sweep. `live-applicants` needs `applicant_emails` applied; it signs C in directly to GoTrue to prove the RPC is refused. `live-upload-gates` sends 10 MB + 1 byte, but each case stops before storage even if the cap regresses (owner, 2026-11-04: no 10 MB upload to the shared bucket). Its `.txt` cases use a tagged job. `-Target current` only. |
| Assessment (T-0029, T-0031) | `assessment/test_internal_only.py`, `assessment/test_request_id.py`, `assessment/conftest.py` | None, and no network: `assessment-service/.venv` (`requirements-dev.txt`), its own pytest call, FastAPI `TestClient`, `PYTHON_DOTENV_DISABLED=1` so the service's `.env` (OpenRouter key) is never read. Skipped for `-Target baseline`. |
| Frontend | `CI=true npm run build` | None. |
| GitHub evidence | `github/test_service.py`, `github/test_client.py`, `github/test_metrics.py`, `github/test_scoring.py`, `github/recordings/`, `github/snapshots/` | None, and no network: `github-evidence/venv`, its own pytest call, FastAPI `TestClient`, every test inside `respx.mock(assert_all_mocked=True)`, and `--allow-hosts=127.0.0.1,::1` (pytest-socket) so any other connect raises. Recordings are listed in `recordings/manifest.json` (`recorded` or `synthetic`, dated) and scrubbed to allow-listed headers. The `octocat` tests in `test_metrics.py` use the owner's real recording (`github-evidence/tools/record_github.py octocat`; T-0012 also records `/languages` and `/commits`) and skip if it is absent. Tests never read the real clock: the service clock is pinned to the account's `fetched_at` in the manifest. `synthetic/<name>/` folders are whole fake accounts (active, forks, empty, partial, archived). After re-recording octocat, regenerate `snapshots/octocat.json`. Skipped for `-Target baseline`. |
| Docs | `docs/check-trackers.mjs` | None. Also checks that every `file:line` in `ARCHITECTURE.md` resolves (T-0009), and that `ROADMAP.md` items list Depends on/Size/Files/Moves/Issues/Task, depend only on earlier items, use S/M/L, and name only existing CHECKLIST, issue and task ids (T-0010). An open issue or a CODE_REVIEWED_UNTESTED row that no item maps prints a `warning:` line but does not fail. |
| Architecture probe (not in the default suites) | `arch/nlp-outage-probe.mjs` | **Live.** One `[T-0001 TEST]` job and one upload under `resumes/candidates/<C>/`, swept before and after. With NLP down or hung, analyze stops before any write; P-1/P-2 refuse to run if :8000 answers. P-1..P-3 print a table only (T-0009). **P-4..P-6 (T-0015) assert**: each row prints expected, observed and PASS/FAIL, and the probe exits 1 if any fails. They run real analyzes (NLP started by the probe, so scores and resumes rows are written and swept) with github-evidence down (nothing on :8001), hung (a TCP stub) or rate-limited (the real service, dummy `GITHUB_TOKEN`, `GITHUB_API_URL` on a local 403 stub: no request leaves the machine). They refuse to run if :8001 answers. `GITHUB_EVIDENCE_TIMEOUT_MS=60000` in the probe's environment makes P-5 FAIL (the red run). Table: `.out/t0015-probe.md` when P-4..P-6 run, else `.out/t0009-probe.md`. |
| E2E (R-19, not in the default suites) | `e2e/*.spec.mjs`, `e2e/shot.mjs` | **Live, nothing swept.** `spine.spec.mjs` writes through the app as the `t0001_` test accounts (one job, one application, resume replace, notification, assessment attempt, score rows) and spends one LLM generation and one grading call per run; `unreadable.spec.mjs` writes nothing (the upload is refused); `signup.spec.mjs` is opt-in and creates an unconfirmed auth user. Every run prints the rows it created. `smoke.spec.mjs` writes nothing. Needs the stack from `scripts/start-all.ps1`; run `-Suites e2e` alone. See "End-to-end browser checks". |
| Manual | `MANUAL_SMOKE.md` | Live, via the UI — finish with `node tests/backend/sweep.mjs`. |

The sweep (`backend/lib/testdb.mjs`) deletes only: `assessments` (T-0029), `scores`, `resumes`,
`applications` where `candidate_id = <t0001_cand id>`; storage objects under
`resumes/<C>/` and `resumes/candidates/<C>/`; `jobs` where
`recruiter_id = <t0001_recr id> AND title LIKE '[T-0001 TEST]%'`. It aborts
if a username lacks the `t0001_` prefix, a role is wrong, or any single delete
would exceed 50 rows/objects. `node tests/backend/sweep.mjs --check` is
read-only.

Cross-user tests (T-0004..T-0007) add `t0001_recr2` and `t0001_cand2`,
set in `tests/.env` (see `.env.example`). When configured, the sweep and its
guards cover them too: candidate ids for `scores/resumes/applications`/storage,
recruiter ids for `[T-0001 TEST]` jobs, and all test ids for `notifications`.
Every run snapshots the t0001_ `profiles` rows to
`tests/.out/t0001-profile-snapshots.json`. `sweep.mjs --check` exits 1 with
`profile-missing:<username>: 1` if a t0001_ profile row is gone, and
`sweep.mjs --restore-profiles` upserts the rows back from the snapshot
(idempotent).

**`backend/fixtures/github-evidence-example-mokafor.json` is synthetic.**
`example-mokafor` is the fixture login on `fixtures/f1_dev_github.pdf`, not a
real GitHub account. The file is the real github-evidence service's answer when
it replays `github/recordings/synthetic/active` in process, with `synth-active`
rewritten to `example-mokafor` in memory. The clock is pinned to that set's
manifest `fetched_at`, and the claimed skills are f1's parsed skills from the NLP
snapshot. Its `_source` field says the same. Regenerate it (deterministic) with:

    github-evidence\venv\Scripts\python tests\backend\fixtures\make-github-evidence-fixture.py

Known schema gaps this depends on (not fixed here): `resumes` bucket (I-0001),
`scores` table (I-0007), `resumes` table (I-0013) exist only in the live
project, not in migrations.

## End-to-end browser checks (R-19, `tests/e2e/`)

Playwright Test (pinned `1.65.0`, Chromium only) against the stack **already
running** from `scripts/start-all.ps1`. Nothing here starts, stops or
configures a service; the e2e stack is the real one (no
`ASSESSMENT_PREPARE_ON_APPLY=false`, live LLM and GitHub).

```powershell
cd tests\e2e; npm ci; npx playwright install chromium     # one time
powershell -File scripts\start-all.ps1                    # the stack (frontend :3000, gateway :5000)
powershell -File tests\run-suite.ps1 -Suites e2e          # = cd tests\e2e; npx playwright test
node tests\e2e\shot.mjs --role candidate --path /candidate/dashboard --out tests\e2e\output\shots\cand-dash.png
```

- `playwright.config.mjs`: base URL `E2E_BASE_URL` (default
  `http://localhost:3000`), one worker, serial, no retries, 3 min per test
  (a spec that waits on the assessment pool raises its own limit), 45 min per
  run; screenshot and trace kept on failure. Everything goes to
  `tests/e2e/output/` (git-ignored; HTML report in `output/report/`).
- `global-setup.mjs` checks the frontend and `GATEWAY_BASE_URL/health`
  (default `http://localhost:5000/health`) and fails in one sentence naming
  what is down. `E2E_SKIP_GATEWAY_CHECK=1` checks the frontend only, for
  trying a spec that needs no API; the suite never sets it.
- `lib/auth.mjs`: `loginAs(page, role)` logs in through the real login page
  as the test candidate or test recruiter (`TEST_CANDIDATE_*` /
  `TEST_RECRUITER_*` from `tests/.env`, read with `tests/backend/lib/env.mjs`;
  values are never printed). `newRoleContext(browser, role)` gives each role
  its own browser context. Selectors prefer `data-testid`, then labels.
- `lib/leftovers.mjs`: `recordLeftover(kind, id, note)` and
  `recordFromResponses(page, {...})` record the Supabase rows a run creates
  (`output/leftover-rows.jsonl`); `global-teardown.mjs` prints them at the
  end of every run. Nothing is deleted; Anthony runs the sweep.
- `lib/diagnostics.mjs`: console errors, uncaught page errors, failed
  requests and HTTP >= 400 responses of a page.
- `fixtures/index.mjs`: references to `tests/fixtures/f1_dev_github.pdf`
  (text PDF) and `f6_image_only.pdf` (image-only); no copies.
- `shot.mjs` (for verifiers' browser passes):
  `node tests/e2e/shot.mjs --role candidate|recruiter|none --path /route --out file.png [--wait <selector>] [--timeout <s>]`.
  Logs in when a role is given, opens the route, saves a full-page screenshot
  and `file.txt` next to it (final URL, console errors, failed requests).
  Exit 0 = screenshot taken, 1 = stack down, login failed or `--wait` timed
  out (the failure state is still captured), 2 = bad arguments.
- `lib/network.mjs`: observes (never intercepts) the API responses a page
  received: `actAndWait` (click and wait for the response it caused),
  `recordApiResponses` (every response of a browser context, bodies read),
  `findFieldNames` (the answer-key field scan).
- `lib/pages.mjs`: `chooseResumeFile` (Upload page, through its own "Browse
  files" button and the file chooser) and `checkDrilldown` (the recruiter
  drill-down invariants, see below).
- `lib/provider.mjs`: provider failures (below).

### Specs

Spec files run in path order, one worker, no retries: `signup`, `smoke`,
`spine`, `unreadable`.

- `smoke.spec.mjs`: landing renders, login form shows. Writes nothing.
- `spine.spec.mjs` (the definition of done for batch 4): one test, two
  browser contexts (recruiter and candidate), seven named `test.step`s:
  1. recruiter creates a job titled `[E2E <UTC timestamp>]` through
     CreateJob (skills Python, SQL, PostgreSQL, Docker);
  2. candidate uploads the resume and sees the parsed skills (equal to the
     upload response's);
  3. candidate applies (the apply response must say `scored`), sees the
     composite on the job page, the row in My applications and the Result
     page's composite and band;
  4. recruiter sees the row with its score, opens the drill-down, closes it,
     shortlists (`notified: true`); the candidate's Notifications page shows
     the shortlist notification for that job;
  5. candidate opens the assessment from the row; the script waits on
     `[data-testid=assessment-state]` going from `preparing` (or
     `unavailable`) to `ready`, presses Start, answers the first half (first
     option for a choice, a fixed sentence for a text answer, each saved by
     the page), reloads, checks that the answers and a still-running,
     not-reset clock are restored, answers the rest, submits and waits for
     the graded result;
  6. no answer-key field (`correct_option`, `correct_answer`,
     `ideal_answer`, `key_points`, `recruiter_feedback`, `answer_key`) in any
     API response the candidate's browser received during the run, nor in the
     HTML of the assessment result and the Result page; an assessment or
     result body that could not be read fails the check;
  7. recruiter reloads and reopens the drill-down: a new score row whose
     assessment sub-score is available.
  Assertions are on states and invariants only, never on LLM text or score
  values: every score shown is a number from 0 to 100 and equals what the
  page's own response carried; the weights shown sum to 1 within 0.001 and
  equal the response's; an available sub-score has weight above 0, an
  unavailable one shows no value and has weight 0; when the GitHub sub-score
  is available, all three are after step 7; statuses go submitted ->
  shortlisted and assessment -> completed. The account need not be clean: the
  job is found by its unique title and the application by the id the apply
  response carried. Each step's duration, the preparing -> ready time and
  the grading time are printed (`e2e ...` lines) and kept as the
  `step-timings` annotation in the HTML report.
- `unreadable.spec.mjs`: the candidate uploads `f6_image_only.pdf` and sees
  `resume-unreadable` (422 `unreadable_document`, `stored: false`); after a
  reload the page shows the same resume on file as before (same
  `updatedAt`). It runs after the spine, and the spine uploads its own resume
  first anyway.
- `signup.spec.mjs` (opt-in, `E2E_SIGNUP=1`; otherwise skipped with the
  reason printed): sign-up through the UI up to the "Account created /
  confirm your email" screen (email confirmation is on, O-5). Each run
  creates a real unconfirmed auth user that an agent cannot delete and
  sends a confirmation email; the address is printed with the leftovers.

### Switches (environment)

| Variable | Default | Effect |
|---|---|---|
| `E2E_RESUME` | fixture f1 | The resume the spine uploads (path, absolute or relative to the repo root; `.pdf`/`.docx`), e.g. the demo resume that links a live GitHub account. |
| `E2E_POOL_WAIT_S` | 240 | Bound for the assessment pool to become `ready`. |
| `E2E_GRADING_WAIT_S` | 240 | Bound from Submit to the graded result. |
| `E2E_SIGNUP` | off | `1` runs `signup.spec.mjs`. |
| `E2E_SIGNUP_EMAIL` | `patina-e2e-signup-{ts}@example.com` | Sign-up address template; must contain `{ts}`. A plus-address on a mailbox you own avoids a bounced confirmation email. |
| `E2E_SPINE_UNTIL` | off | Debug only: stop the spine after step N **by failing** (never a pass). Steps 1-2 spend no LLM call; apply (step 3) starts the pool generation. |
| `E2E_BASE_URL`, `GATEWAY_BASE_URL`, `E2E_SKIP_GATEWAY_CHECK` | | See above. |

### Reading a failure

- **Product failure**: any other failed assertion. The message names the
  invariant; screenshots of both contexts, the trace
  (`npx playwright show-trace tests\e2e\output\test-results\<test>\trace.zip`)
  and `error-context.md` are under `tests/e2e/output/test-results/`.
- **Provider failure**: the LLM provider did not answer within a bound. The
  error starts with `PROVIDER FAILURE (not a product failure):`, the test
  carries a `provider-failure` annotation, and after the leftover rows the
  run prints `e2e: N provider failure(s) ...`. Two cases: the pool still read
  `preparing` or `unavailable` at `E2E_POOL_WAIT_S` (the message lists the
  states seen and the server's last `reason`), or grading was still pending
  (or the evaluate request still running) at `E2E_GRADING_WAIT_S`. The run
  still exits 1; retry once, then look at `tests/.out/start-all/assessment-service.*.log`.
- The leftover rows (jobs, resumes, applications, notifications,
  assessments, scores, sign-up addresses) are printed at the end of every
  run, pass or fail; nothing is deleted.

## Snapshots

`nlp/snapshots/<label>/<fixture>.json` is the full `/parse` response
(sorted keys). They are a **reference to diff revisions against, not an
oracle** — see `BASELINE_RESULTS.md` for which baseline outputs are known
wrong. Real resumes in `tests/private/` are tested too; their snapshots go to
`tests/private/snapshots/` (git-ignored, contain personal data).
