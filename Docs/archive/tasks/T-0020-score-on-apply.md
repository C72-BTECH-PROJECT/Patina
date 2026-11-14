# T-0020 — score-on-apply

> Status: **draft, awaiting owner approval** (written in T-0016, 2026-10-15).
> ROADMAP item P2-3 (AUDIT 5.14, INTEGRATION_REVIEW R9). Depends on P2-1 (T-0018: `nlpClient`,
> the 5 s timeout) and P1-8 (T-0019: the frontend runner). Fourth in the execution order.
> Size L: if it grows past two weeks, split it into backend/migration and frontend halves.
> Owner decision (2026-10-15): applications that exist before the migration are backfilled as
> `pending`.

## Context
No score is produced through the app's UI (AUDIT summary, 5.14):
- **Apply only inserts a row.** `applyToJob` (`backend/Controllers/jobs.controller.js:102-156`)
  checks that a stored résumé exists, inserts an `applications` row and returns 201.
- **Analyze has no reachable caller.** `POST /api/analyze` (`analyzeResume`,
  `backend/Controllers/analysis.controller.js:238-378`) is the only scorer. Its only caller is
  `frontend/src/pages/candidate/Processing.jsx:175`, and nothing navigates there.
- **Analyze has side effects of its own.** It parses an *uploaded* file, stores a second copy of
  it every time (`:285-301`), and can score a job the candidate never applied to.
- **Scores are not keyed to applications.** `scores` has no `application_id` and no status
  (`supabase/migrations/20260903_create_resumes_and_scores.sql:41-62`). The recruiter pages read
  one score per *candidate* across all jobs (`getAllCandidates`, `:406-458`), so the per-job list
  can drop applicants (I-0053).

ARCHITECTURE §4.4 sets the constraint: apply must not depend on NLP being up. It returns 201
with the score "pending" and scores later. Otherwise an NLP outage turns into "candidates can't
apply".

## Goal
Applying to a job creates the application (201) and a linked score that is `pending` until
scoring completes. Scoring runs in the background, retries until NLP is back, is done exactly once
per application even with two core replicas, and its result is visible to the candidate (score and
explanation) and to the recruiter (per application, in the existing per-job view).

## Spec ref
- R9, FR-12, FR-14; NFR-12, NFR-2/NFR-11 (async), GF-4, GF-5.
- CHECKLIST 5.14, 5.4, 0.8, 0.7, 5.5; ARCHITECTURE §4.4, §4.5 ("no event bus"); ISSUES I-0010
  (migration rules), I-0053, I-0034.

## Decisions in this spec
**1. Data: scores link to applications through one idempotent migration** (I-0010's rules).
- **Applying it:**
  - every statement is guarded (`if not exists`, `create or replace`, `drop … if exists` before
    `create trigger`, and constraints inside `do $$ … exception when duplicate_object … $$`);
  - it is applied by hand or the Supabase CLI. Production auto-deploy stays off (I-0010
    option a);
  - running it a second time changes nothing.
- **`scores` gains:**
  - `application_id uuid references applications(id) on delete cascade`;
  - `status text not null default 'scored'`, checked in (`pending`, `scored`, `failed`);
  - `status_reason text`, `attempts int not null default 0`, `next_attempt_at timestamptz`;
  - `lease_owner text`, `lease_until timestamptz`, `request_id text`;
  - `updated_at timestamptz not null default now()`.
- `composite_score` and `resume_id` become nullable, with a check: `status = 'scored'` implies both
  are present.
- **Indexes:** a unique partial index on `application_id where application_id is not null` (one
  score per application), and a partial index on `next_attempt_at where status = 'pending'`.
- **Trigger** `after insert on applications`: inserts the `pending` score row in the same
  transaction. So no application can exist without its score row, whatever inserts it.
- **`claim_due_scores(p_owner text, p_limit int, p_lease_seconds int, p_application_id uuid default null)`:**
  - `update scores … where id in (select id … where status = 'pending' and next_attempt_at <= now() and (lease_until is null or lease_until < now()) [and application_id = p_application_id] order by next_attempt_at limit p_limit for update skip locked) returning *`;
  - `security definer`, with execute revoked from `public`, `anon` and `authenticated` and granted
    to `service_role`;
  - each claim sets `lease_owner`, `lease_until = now() + lease` and `attempts = attempts + 1`.
- **Backfill (owner):** one `pending` row (`next_attempt_at = now()`) for every application not
  `withdrawn` that has none, guarded by `not exists`. Old analyze-made scores (no
  `application_id`) stay as unlinked history; they are not attached to applications, because they
  may come from a different file.

**2. Retry mechanism (recommended): a periodic re-score job in every core process, with lease
claims.**
- **How it runs:**
  - `backend/Services/scoring.js` exports `startScoringJob()`, called from `backend/index.js`;
  - the first tick runs at boot, then one every `SCORING_TICK_MS` (default 15000);
  - each tick claims up to `SCORING_CONCURRENCY` (default 2) due rows with a lease of
    `SCORING_LEASE_S` (default 60) and scores them;
  - apply also fires an immediate attempt for its own row (`claim_due_scores(…, p_application_id)`)
    without awaiting it, so the happy path does not wait for a tick.
- **Why this one:**
  - **A boot re-queue alone** recovers only when core restarts. An NLP outage while core stays up
    would leave rows pending until someone restarts it.
  - **On-demand re-score** (on a page view) makes reads write, and it depends on someone looking.
    Nobody looks at a backfilled application.
  - **The periodic job** recovers from an NLP outage and from a core crash mid-score (the lease
    expires and another tick reclaims the row) with one mechanism. Its first tick *is* the boot
    re-queue. It costs one indexed query per tick per replica, and needs no event bus or broker
    (ARCHITECTURE §4.5 rules those out).
- **Safe with two core replicas:**
  - `FOR UPDATE SKIP LOCKED` lets concurrent claims skip each other's rows, so each due row goes
    to exactly one replica;
  - the lease stops a row being reclaimed while it is being scored;
  - the final write is `update … where id = $1 and lease_owner = $me`. A replica whose lease
    expired (e.g. it stalled) cannot overwrite the result of the replica that reclaimed the row.
  - Lease 60 s ≈ 4× the worst-case score time (5 s NLP + 8 s GitHub + ~2 s storage and writes).
  - Concurrency 2 per replica stays inside T-0018's timeout margin (two parses queued ahead).

**3. Scoring** (`backend/Services/scoring.js`, `scoreApplication(row, deps)`; logic extracted
from `analyzeResume`; dependencies injectable for offline tests):
1. Load the application and the job.
2. Download the stored résumé `candidates/<candidate_id>/resume.<ext>`, the file `applyToJob`
   already requires. This is the file present at scoring time; a re-upload between apply and
   scoring is what gets scored. That limitation is documented, and P2-5 can revisit it.
3. Call `nlpClient.parseResume` with the job's JD and skills and the row's request ID.
4. Insert a `resumes` row. `file_ref` is the stored path; no second storage copy is made.
5. Call `fetchGithubEvidence`, then `buildScoreRecord(nlpJson, { github })`.
6. Do the fenced final update: `status = 'scored'` plus the score fields, lease cleared.

**4. Outcomes.** "Pending until scoring completes" means a transient cause never turns into
`failed`.

| Cause | Status | `status_reason` | Next attempt |
|---|---|---|---|
| `nlp_unavailable` (timeout, refused, NLP 503) | stays `pending` | `nlp_unavailable` | backoff 30 s, 1 min, 2 min, 5 min, then every 15 min; never earlier than NLP's `Retry-After`; no attempt limit |
| `nlp_error` (NLP 4xx/5xx, bad body) | `pending`, then `failed` after 3 attempts | `resume_unprocessable` | 1 min, 5 min |
| no stored résumé | `failed` at once | `resume_missing` | — |
| job deleted | row is removed by cascade | — | — |
| anything else (DB, storage) | `pending`, then `failed` after 5 attempts | `internal_error` | backoff as above |
| GitHub down, slow or rate-limited | `scored` (GF-4: the GitHub sub-score is unavailable with its reason) | — | — |

The candidate-facing texts:
- `nlp_unavailable`: "Your application is in. Scoring is waiting for the résumé parser and will
  retry automatically."
- `resume_unprocessable`: "We could not read your résumé file. Upload a new PDF or DOCX…"
- `resume_missing`: "No résumé was found…"
- `internal_error`: "Scoring failed; the team has been notified."

**5. API and UI**
- **Apply** (`POST /api/jobs/:id/apply`):
  - 201 `{ …application, score: { status: "pending" } }`;
  - it never calls NLP, GitHub or the storage download; the existing check that a résumé exists
    stays;
  - a duplicate apply is still 409.
- **`GET /api/candidate-analysis?jobId=`** (candidate, own rows only):
  - `{ status: "pending" | "failed", reason, reasonText }`, or the scored analysis in
    `serializeCandidate`'s shape plus `status: "scored"`;
  - 404 when the candidate has no application for that job;
  - without `jobId`, today's behaviour (the latest scored row).
- **`GET /api/candidates?jobId=`** (recruiter, owner of the job): one row per application of that
  job, with score fields when scored and `status` / `reasonText` otherwise. This fixes I-0053 for
  the per-job view. Without `jobId`, today's per-candidate behaviour stays for the Dashboard until
  P2-5.
- **Candidate `JobDetail.jsx`:**
  - after apply, and on any later visit, it shows the application's score status;
  - while pending it polls `candidate-analysis?jobId=` every 5 s for up to 2 minutes, then shows
    "still pending, check back later";
  - scored → the score, plus "See explanation" linking to `/candidate/results?jobId=<id>`;
  - failed → the reason text.
- **`Results.jsx`** reads `jobId` from the query and renders `ScoreBreakdown`; without it, as
  today.
- **Recruiter `JobDetails.jsx`** calls `/api/candidates?jobId=<id>`:
  - pending and failed rows are listed with a "Scoring…" / "Not scored" badge in place of a
    number;
  - the min-score filter excludes them once the threshold is above 0;
  - this is the only recruiter page changed. The full merged dashboard is P2-5.
- `Processing.jsx` and its route (`frontend/src/App.jsx:55`) are deleted.

**6. `/api/analyze`: removed.** Why:
1. It is the only path that scores a job the candidate never applied to. It also stores a second,
   unpruned copy of the file on every call (AUDIT 5.14). Both are faults, not features.
2. Keeping it means two scoring paths that can drift. The tier-2 tests would keep exercising the
   one users never hit, while the one they do hit goes untested.
3. Nothing is lost for testing. The scoring logic is unit-tested through `scoring.js` with
   injected fakes, and the live tests drive the real path (upload → apply → poll), which takes
   about the same time.
4. The gateway-timeout caveat for a synchronous NLP + GitHub request (ROADMAP §1.2) disappears.

The cost is migrating the tests that call analyze, listed under Scope.

## Scope
**In:**
- **The migration and the scoring service:**
  - `supabase/migrations/<date>_score_on_apply.sql` (decision 1);
  - `backend/Services/scoring.js` (decisions 2-4), started from the boot path in
    `backend/index.js`;
  - `backend/.env.example` names `SCORING_TICK_MS`, `SCORING_CONCURRENCY`, `SCORING_LEASE_S`.
- **`backend/Controllers/jobs.controller.js`:** the apply response, plus the fire-and-forget
  attempt.
- **`backend/Controllers/analysis.controller.js`:**
  - `analyzeResume` and its storage write are deleted;
  - `getCandidateAnalysis` gains `?jobId=`, and `getAllCandidates` gains `?jobId=`;
  - `getAllApplicants` reads the score by `application_id` instead of candidate + job.
- **`backend/Routes/analysis.routes.js`:** the `/analyze` route is removed.
- **Frontend:**
  - `pages/candidate/{JobDetail,Results}.jsx` and `pages/recruiter/JobDetails.jsx`;
  - `App.jsx`, with `pages/candidate/Processing.jsx` deleted;
  - tests under `frontend/src/__tests__/` (T-0019's runner).
- **Tests that call analyze, migrated** to a new `tests/backend/lib/score.mjs` helper,
  `uploadApplyAndWait(cookie, fixture, jobId, { timeoutMs })`:
  - `live-analyze.test.mjs` is replaced by `live-score-on-apply.test.mjs`;
  - `live-analyze-github.test.mjs`, including T-0017's f7 subtest;
  - `live-analysis-isolation.test.mjs`, if it creates scores through analyze;
  - the probe's P-1, P-2 and P-4..P-6;
  - `run-suite.ps1` lists change accordingly.
- **Docs:** ARCHITECTURE as-is (the apply → score path, with cites; §1.3, §1.6, §2 rows touched
  by it), AUDIT, ISSUES, `tests/README.md`, WORKLOG.

**Out:**
- The merged recruiter dashboard, shortlist/reject UI and the Dashboard page (P2-5).
- Re-scoring when the candidate uploads a new résumé after scoring.
- Load or scaling evidence beyond the two-replica correctness test (P2-9).
- Making the six older migrations idempotent (P3-15).

## Files touched
- `supabase/migrations/<date>_score_on_apply.sql` (new)
- `backend/Services/scoring.js` (new), `backend/Controllers/jobs.controller.js`, `backend/Controllers/analysis.controller.js`, `backend/Routes/analysis.routes.js`, `backend/index.js`, `backend/.env.example`
- `frontend/src/pages/candidate/JobDetail.jsx`, `frontend/src/pages/candidate/Results.jsx`, `frontend/src/pages/candidate/Processing.jsx` (deleted), `frontend/src/App.jsx`, `frontend/src/pages/recruiter/JobDetails.jsx`
- `frontend/src/__tests__/{candidate-score-status,results-by-job}.test.jsx` (new), `frontend/src/__tests__/jobdetails-filters.test.jsx`, `frontend/src/__tests__/fixtures/analyses.js`
- `tests/backend/scoring.test.mjs` (new), `tests/backend/migration-guards.test.mjs` (new), `tests/backend/live-score-on-apply.test.mjs` (new), `tests/backend/lib/score.mjs` (new), `tests/backend/live-analyze.test.mjs` (deleted), `tests/backend/live-analyze-github.test.mjs`, `tests/backend/live-analysis-isolation.test.mjs` (if it uses analyze), `tests/arch/nlp-outage-probe.mjs`, `tests/run-suite.ps1`, `tests/README.md`
- `ARCHITECTURE.md`, `AUDIT.md`, `ISSUES.md`, `WORKLOG.md`

## Moves
| Id | From → to | Why |
|---|---|---|
| 5.14 Score-on-apply | MIS → **DONE** | Apply creates a linked pending score that is scored in the background (live test, probe) |
| 5.4 Candidate visibility of status | PART → **DONE** | The candidate sees pending, scored or failed per application (frontend + live tests) |
| 0.8 Concurrency / async queue | MIS → PART | Async scoring with SKIP LOCKED claims, correct with two replicas; no load test (P2-9) |
| 0.7 Graceful degradation | DONE (evidence) | Apply during an NLP outage → 201, scored once NLP is back |
| 5.5 Rankings | PART (evidence) | Applicants now appear in the per-job ranking; Dashboard ranking is still per candidate (P2-5) |
| 0.2, 0.3 | PART (evidence) | `scores.application_id` and status persisted |
| 5.1 | PART (note) | `Processing.jsx` deleted |
| I-0053 | OPEN → RESOLVED | Per-job view is per application |
| I-0034 | note | The analyze file-type half is gone with analyze |

## Acceptance criteria
1. **The migration is guarded and replay-safe.**
   - Checked by `tests/backend/migration-guards.test.mjs` "every DDL statement is guarded": every
     `create table|index|type`, `add column`, `add constraint`, `create trigger` and
     `create function` in the new file is guarded.
   - Checked manually by the owner: apply the file twice in the Supabase SQL editor. The second run
     raises no error, and `select status, count(*) from scores group by 1` is the same after both
     runs. Recorded in Result.
2. **Every application has exactly one score row.** Checked by `live-score-on-apply.test.mjs`
   "trigger creates the pending row":
   - inserting an application directly with the service client creates one `pending` row with
     its `application_id`;
   - a second insert for the same row is impossible (unique index);
   - after the backfill, `select count(*) from applications a where status <> 'withdrawn' and not exists (select 1 from scores s where s.application_id = a.id)`
     → 0 (Result).
3. **Apply never waits for NLP.** Checked by `live-score-on-apply.test.mjs` "apply returns 201
   with a pending score", with NLP's URL pointed at a closed port:
   - apply → 201 in under 2 s;
   - `score.status == "pending"`;
   - a duplicate apply → 409.
4. **Scored in the background, and visible.** Checked by "applied job gets scored and is
   visible", with real NLP and the github-evidence stub:
   - within 30 s, `candidate-analysis?jobId=` returns `status: "scored"`, with a `credibilityScore`
     and `explanation.factors`;
   - the recruiter's `candidates?jobId=` lists one row per application;
   - the stored `resumes.file_ref` is the stored path, and no new storage object is created
     (storage listing count unchanged).
5. **NLP outage → pending, then scored without a restart.** Checked by "NLP outage: pending, then
   scored". It starts its own core process (spare port, `SCORING_TICK_MS=1000`), with
   `NLP_PARSE_URL` pointing at a counting stub that replays `tests/nlp/snapshots/current/f1_dev_github.json`:
   - with the stub closed: apply → 201, and the row stays `pending` with
     `status_reason: "nlp_unavailable"`;
   - after the stub starts, the row becomes `scored` within 10 s;
   - the core process is never restarted (same PID).
6. **Exactly once with two replicas.** Checked by "two replicas score each application exactly
   once": two core processes share the DB and one counting stub NLP, with 6 applications (6 test
   jobs), and both tick every 500 ms:
   - all 6 rows are `scored`;
   - the stub received exactly 6 `/parse` requests;
   - each row's `lease_owner` was one of the two;
   - there are 0 duplicate `resumes` rows per application.
7. **Outcome mapping and fence (offline).** Checked by `tests/backend/scoring.test.mjs`, with
   injected fakes:
   - "maps outcomes to status": every row of the outcome table in decision 4, including
     `Retry-After` overriding a shorter backoff and "no attempt limit" for `nlp_unavailable`;
   - "a stale lease cannot overwrite": the final update with a different `lease_owner` changes
     nothing;
   - "GitHub down still scores".
8. **Candidate UI.** Checked by `frontend/src/__tests__/candidate-score-status.test.jsx` and
   `results-by-job.test.jsx`:
   - JobDetail shows "Scoring in progress" for pending, the reason text for failed, and the
     score plus a link to `/candidate/results?jobId=…` for scored;
   - it polls while pending and stops on unmount;
   - Results renders `ScoreBreakdown` for the `jobId` it is given.
9. **Recruiter per-job view.** Checked by `frontend/src/__tests__/jobdetails-filters.test.jsx`,
   updated on purpose:
   - pending and failed rows are listed with their badge and are hidden by a min score above 0;
   - every other assertion from T-0019 still holds. Each changed assertion is listed in Result.
10. **`/api/analyze` is gone.**
    - `git grep -n "/analyze" -- backend/Routes frontend/src` → 0;
    - `POST /api/analyze` → 404;
    - `Processing.jsx` no longer exists.

    Checked by: the commands and `smoke.test.mjs` (new 404 case).
11. **The probe shows apply during an outage.** P-1 (NLP down):
    - apply → **201** within 2 s;
    - the score is `pending` with `nlp_unavailable`;
    - login, jobs and upload → 200;
    - after NLP starts, the row becomes `scored` without a core restart.

    P-2 (NLP hung): apply → 201 within 2 s, and the row is still `pending` after 6 s. P-4..P-6
    keep their assertions through apply + poll. Checked by: `node tests/arch/nlp-outage-probe.mjs`
    → exit 0 (`tests/.out/t0020-probe.md`).
12. **Trackers.** Checked by `node tests/docs/check-trackers.mjs` → exit 0, 0 warnings:
    - AUDIT 5.14 and 5.4 are DONE_CORRECTLY with `file:line` and the tests; 0.8 is PART; the
      evidence notes in the Moves table are added;
    - ARCHITECTURE's as-is apply/score path has cites;
    - I-0053 is resolved.

## Test plan
- **Write first:**
  - `scoring.test.mjs`, `migration-guards.test.mjs`, `live-score-on-apply.test.mjs`, `lib/score.mjs`;
  - the two new frontend tests and the updated filter test;
  - the probe's apply-based P-1/P-2.
- **Red run** (`tests/.out/t0020-red.log`):
  - at HEAD: apply → 201 but no score row is ever created, so criteria 2-6 fail;
  - `scoring.js` and the migration do not exist, so criteria 1 and 7 fail;
  - the frontend status tests fail;
  - the probe's P-1 finds no score.
  - **Two-replica mutation:** temporarily replace the claim with a plain select-then-update
    (no `SKIP LOCKED`, no lease). Criterion 6 then sees more than 6 parses. Restore it (SHA-256
    equal).
- **Green:** `tests/.out/t0020-green.log`, then the full harness and the probe.
- **Cannot be automated:** applying the migration (and replaying it) in the hosted Supabase
  project. The owner does it by hand (I-0010), before the live tests.

## Regression
- `tests/run-suite.ps1 -Target current -Live`:
  - nlp 0, backend 0 (with the migrated live tests), github 0, docs 0, frontend-test 0;
  - frontend build ≤ the 5 known lint warnings.
- T-0006's authz tests still pass:
  - a candidate cannot read another candidate's score (`live-analysis-isolation.test.mjs`);
  - a recruiter sees only their own jobs' applications.
- `node tests/backend/sweep.mjs --check` → 0 after the run. Score rows cascade with their
  applications.

## Risks and rollback
- **Risk:** the migration is applied to the shared Supabase project that teammates use.
  Mitigation:
  - it is additive (new nullable columns, a new function and a trigger);
  - the backfill touches only rows without a score;
  - the owner applies it by hand and checks the replay first.
- **Risk:** the backfill scores every existing application at once. That is about 22 GitHub calls
  each (ROADMAP §1.5).
  - Mitigation: concurrency 2 per replica.
  - github-evidence's low-water mark turns a rate limit into `github_rate_limited`, never a
    failure (GF-4).
- **Risk:** the timer keeps the test process alive or races the sweep. Mitigation:
  - `startScoringJob()` returns a stop function, and live tests stop their extra core processes
    before sweeping;
  - the job is disabled when `SCORING_TICK_MS=0`, so the offline smoke test does not start it.
- **Rollback:**
  - revert the code; the application keeps working without the job;
  - the migration is additive. Dropping the trigger and the function is a two-line script,
    written into the migration's header comment.

---

## Result
<Filled at the end. One line per acceptance criterion.>
