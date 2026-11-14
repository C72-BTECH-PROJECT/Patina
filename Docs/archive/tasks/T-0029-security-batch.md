# T-0029 — security-batch

> Status: **draft, owner decisions applied 2026-11-03; awaiting approval to execute**
> (written in T-0028). ROADMAP item P0-1 (B1, Phase 0). First in the execution order.
> Depends on nothing. All facts below were re-verified at `df98068` in T-0028.

## Context
At `df98068`, B1 holds seven open issues:

| Issue | Sev | What is wrong at HEAD |
|---|---|---|
| I-0055 | P0 | `handle_new_user()` (`supabase/migrations/20260823_create_profiles.sql:36-66`) casts `raw_user_meta_data ->> 'role'` straight into `profiles.role` (`:58`). `admin` was added to the enum in `20260831_add_single_admin_role.sql:5`, so a direct GoTrue signup with the public anon key and `data.role = 'admin'` creates an admin profile whenever no admin exists. The single-admin unique index (`:8-10`) only stops a second one. |
| I-0066 | P0 | `public.assessments.answer_key` (`20261015_create_assessments.sql:10-33`) is readable through RLS. The candidate policy (`:50-52`) and the recruiter policy (`:54-62`) cover every column. A candidate who signs in to GoTrue directly reads the key of an open attempt from PostgREST. assessment-service returns `answer_key` (`assessment-service/app/main.py:35-38`), with no auth. |
| I-0061 | P2 | assessment-service FastAPI app (`assessment-service/app/main.py:10-17`) keeps `/docs`, `/redoc` and `/openapi.json` on. Its bind address depends on the command line. |
| I-0060 | P2 | `assessment-service/README.md:249`, `:252` and `:270` start it on `--port 8000` (NLP's port). The backend's default is :8002 (`assessment.controller.js:11-12`), and `ASSESSMENT_SERVICE_URL` is not in `backend/.env.example`. Moved here from B3 by T-0028. |
| I-0056 | P0 | `GET /api/resume/candidate/:candidateId` (`backend/Routes/analysis.routes.js:13`) checks only `requireRole('RECRUITER')`. `getCandidateResume` (`backend/Controllers/analysis.controller.js:205-234`) signs a 60 s URL for any candidate id, with no ownership check and no UUID check. |
| I-0058 / I-0017 | P1 / P3 | `signup()` (`backend/Controllers/auth.controller.js:207-274`) inserts into `profiles` (`:257-265`), duplicating the `on_auth_user_created` trigger, so a `profiles_pkey` error is logged every time. A failed insert is only logged (`:267-269`), and the response is still 201 (`:271`). |
| I-0069 | P2 | `evaluate` reads `status` (`assessment.controller.js:346-358`), grades, then updates with `.eq('status','generated')` (`:396-406`) without checking the row count. Concurrent submits are all graded: each costs an LLM call against the free-model rate limits, and each is folded into the score. Only the first is saved. |

### Who reads `answer_key` today (grep at `df98068`, asked for by the owner)
`grep -rn "answer_key\|answerKey" frontend/src`: **no matches.** No frontend code reads it.

`grep -rn "answer_key\|answerKey\|stripKey" backend --include=*.js` (outside node_modules):
```
backend/Controllers/assessment.controller.js:21:const stripKey = (data) => {
backend/Controllers/assessment.controller.js:22:  const { answer_key: _withheld, ...candidateView } = data;
backend/Controllers/assessment.controller.js:265:    // model_used, prompt_version, questions: [...] }, answer_key =
backend/Controllers/assessment.controller.js:269:    const answerBundle = data.answer_key || {};
backend/Controllers/assessment.controller.js:286:        answer_key: answerBundle,
backend/Controllers/assessment.controller.js:313:    return res.json({ assessmentId: inserted.id, ...stripKey(data) });
backend/Controllers/assessment.controller.js:348:      .select('id, candidate_id, job_id, questions, answer_key, status, score')
backend/Controllers/assessment.controller.js:362:    const answerKey = assessment.answer_key?.answers ?? [];
backend/Controllers/assessment.controller.js:375:          answer_key: answerKey,
```

**What these lines do:**
- `:269` and `:286` write the key. `:348` and `:362` read it for grading. `:375` forwards it to
  assessment-service.
- The one response built from the service's generate payload strips the key (`:313`).

**The other `assessments` selects return no key column:**
- `assessment.controller.js:185` (`id, questions`), `:202` (`id, score, completed_at`),
  `:291` (insert `.select('id')`), `:298` (`id, questions`);
- `analysis.controller.js:386` (`evaluation`).

**`tests/`:** no file mentions `answer_key`.

**Key-derived content after grading.** It is not a key read, but evaluate's response
`results[].feedback` holds "Correct answer: X" for wrong MCQ answers
(`assessment-service/app/evaluator.py:16`). It is returned once, for a completed attempt,
and retakes get new questions. Whether it should be shown is a question for P0-5, the GR-1
design.

**After the fix,** the same grep must show:
- frontend: still no matches;
- backend: no `answer_key` in any `select` on `assessments`, and no `answer_key` in any
  `res.json`. The only reads are from `assessment_keys`, plus the `stripKey` guard.

Criterion 3 runs this grep.

## Goal
Close the B1 issues. Each fix ships with an automated test that fails on `df98068` and
passes after it. For I-0055 the gate that fails first is the static test (owner decision
6). Live tests touch only `t0001_` accounts.

## Spec ref
- NFR-8 (auth, two user classes) and NFR-9 (secrets server-side), from
  PROJECT_SOURCE_DOCS.md.
- CLAUDE.md `GR-1` (the answer-key part of anti-cheating) and `GR-2` (internal services stay
  internal, DEC-5).
- ISSUES I-0055, I-0056, I-0058, I-0017, I-0060, I-0061, I-0066, I-0069.

## Migrations: names and apply order
Rules:
- Every new file has a full `YYYYMMDDHHMMSS` prefix (owner decision 7).
- The existing versions are 8-digit (`20260823` … `20261015`), so these collide with none,
  and they add nothing to I-0057.
- `migration-guards.test.mjs` asserts that the prefixes are unique.
- Applied migrations are never edited.

| # | File | Fix | Who applies, when |
|---|---|---|---|
| M1 | `supabase/migrations/20261103120000_restrict_signup_role.sql` | (a) | Owner, any time |
| M2 | `supabase/migrations/20261103120100_create_assessment_keys.sql` | (b), step 1 | Owner, before the backend deploy |
| M3 | `supabase/migrations/20261103120200_assessment_grading_claim.sql` | (e) | Owner, before the backend deploy |
| M4 | `supabase/migrations/20261103120300_drop_assessments_answer_key.sql` | (b), step 2 | Owner, **only after** checking M2's copy in the dashboard and taking the backup |

The version order is the apply order, so `supabase db push` never needs `--include-all`. If
the duplicate 8-digit prefixes (I-0057, B2) block `db push`:
1. apply the file in the SQL editor;
2. run `supabase migration repair --status applied <version>`.

## Design

### (a) I-0055: signup role allow-list (M1)
- A new function `public.assert_signup_role(p_role text) returns public.patina_user_role`
  (`immutable`, `set search_path = ''`):
  - If `p_role is null or p_role not in ('candidate', 'recruiter')`, it runs `raise
    exception 'invalid signup role: %', coalesce(p_role, '<null>') using errcode =
    '22023'`.
  - Otherwise it returns `p_role::public.patina_user_role`.
  - Grants: `revoke execute ... from public, anon, authenticated`, then `grant execute ...
    to service_role`. The test calls it through the service role. The trigger can always
    call it, because it runs as its owner (`security definer`).
- `create or replace function public.handle_new_user()`:
  - keeps the signature, `security definer` and `search_path = ''`;
  - the only change: `role` becomes
    `public.assert_signup_role(new.raw_user_meta_data ->> 'role')`.

  The trigger itself is not re-created.
- **Effect:** GoTrue rolls back the `auth.users` insert, so no user and no profile are
  created. Admin promotion stays manual SQL (the comment in `20260831`). It is an
  `update`, so the trigger never sees it.
- **Why a separate function** (owner decision 6: assert the specific error):
  - GoTrue hides trigger errors behind a generic message ("Database error creating new
    user" / "…saving new user"). So the specific error cannot be asserted through signup.
  - Through PostgREST RPC, the function the trigger uses returns its `22023` code and its
    message.
  - The static test proves the trigger calls that function. Together they pin the
    rejection to our fix, not to the single-admin index.
  - The live test still logs the raw GoTrue error. If GoTrue does pass the message
    through, the test asserts it there as well.

### (b) I-0066 + I-0061 (+ I-0060): no path from a candidate to an answer key
**Data: a separate `assessment_keys` table, RLS on, no policies, in two migrations** (owner
decision 4).
- **M2 `create_assessment_keys`**, in one transaction:
  - It creates `public.assessment_keys`:
    - `assessment_id uuid primary key references public.assessments(id) on delete cascade`;
    - `answer_key jsonb not null`;
    - `created_at timestamptz not null default timezone('utc', now())`.
  - It runs `alter table public.assessment_keys enable row level security;` and creates
    **no policy**. It also runs `revoke all on public.assessment_keys from anon,
    authenticated;`. The service role bypasses RLS, so only the backend can read the table.
  - `insert into public.assessment_keys (assessment_id, answer_key) select id, answer_key
    from public.assessments;`
  - **The migration verifies the copy.** A `do $$ … $$` block compares `count(*)` of both
    tables, and `raise exception 'assessment_keys copy mismatch: % assessments, % keys'`
    if they differ. The whole migration then rolls back.
    - `answer_key` is `not null` today, so every row copies.
  - `alter table public.assessments alter column answer_key drop not null;`. Without this,
    the new backend, which writes keys only to `assessment_keys`, could not insert attempts
    before M4.
- **Owner step, after the M2 check in the dashboard and before M4.** This is the backup the
  owner specified, with **two added lines (T-0028 finding):**
  - A table created in `public` from the SQL editor has RLS off. Supabase's default grants
    give `anon` and `authenticated` access to it. Without the two lines, the backup would
    put every answer key on the Data API, the leak this task closes.
  ```sql
  create table public.assessments_answer_key_backup as
    select id, answer_key from public.assessments;
  alter table public.assessments_answer_key_backup enable row level security;
  revoke all on public.assessments_answer_key_backup from anon, authenticated;
  ```
  - The owner drops the backup once the round trip in criterion 8 has passed.
- **M4 `drop_assessments_answer_key`**, applied only after the owner's check and the
  backup:
  1. Re-copies any attempt created between M2 and the backend deploy: `insert …
     select id, answer_key from public.assessments a where a.answer_key is not null and
     not exists (select 1 from public.assessment_keys k where k.assessment_id = a.id)`.
  2. Verifies that every `assessments` row has a key row, and raises if not.
  3. Runs `alter table public.assessments drop column answer_key;`. The recruiter policy
     stops exposing keys too. The candidate policy stays: a candidate still reads their own
     questions, answers and score.
- **Rejected alternative:** a column-level `revoke select (answer_key)`. It needs a revoke
  of the whole table plus a re-grant of every other column, and any column added later is
  silently left out. A separate table cannot leak by omission.
- **Remaining window:** from M2 to M4, existing rows still hold `answer_key` in the
  readable table. Keep that window short. New attempts written after the deploy have
  `null` there.

**Backend** (`assessment.controller.js`), deployed after M2 and M3, before M4:
- **Generate** inserts the attempt without `answer_key`, then inserts the key row with the
  same id. If the key insert fails, it deletes the attempt and answers 502, so no attempt
  exists without a key.
- **Evaluate** reads the key with `from('assessment_keys').select('answer_key')
  .eq('assessment_id', id).single()`, using the service-role client.
  - With no key row (an attempt created by old code between M2 and the deploy, before
    M4's re-copy), it answers 409 `{ error: 'key_unavailable' }` and releases the claim.
- No `select` on `assessments` names `answer_key` any more. That is required, because M4
  drops the column.
- `stripKey` stays, as a second guard on the generate response.

**assessment-service, internal only (DEC-5, as github-evidence already is):**
- `FastAPI(..., docs_url=None, redoc_url=None, openapi_url=None)`.
- `app/config.py` reads `ASSESSMENT_HOST` (default `127.0.0.1`) and `ASSESSMENT_PORT`
  (default `8002`). A new `app/__main__.py` runs `uvicorn.run(app, host=..., port=...)`.
- The documented start command becomes `.\.venv\Scripts\python -m app`. The README's
  three `--port 8000` commands are replaced (I-0060). `backend/.env.example` gains
  `ASSESSMENT_SERVICE_URL=http://localhost:8002` (I-0060).
- There is no internal auth token: the same model as NLP and github-evidence, revisited in
  P2-6.

**Out of scope:** what the candidate sees after grading (P0-5).

### (c) I-0056: résumé URL only for the candidate's recruiters
`getCandidateResume`:
1. A `candidateId` that fails the UUID regex gets 400 `{ error: 'invalid_candidate_id' }`,
   before any database or storage call.
2. It checks for an application by that candidate to one of this recruiter's jobs, using
   the shortlist pattern (`jobs.controller.js:268-279`):
   - `.from('applications').select('id, job:jobs!inner(recruiter_id)')`
   - `.eq('candidate_id', candidateId)`, `.eq('job.recruiter_id', req.session.userId)`,
     `.limit(1)`
3. With no match it answers 404 `{ error: 'not_found' }`. "No résumé" gets the same answer,
   so the endpoint does not reveal whether a candidate exists.

This needs no migration: `jobs.recruiter_id` and `applications(candidate_id, job_id)`
already exist (`20260830_create_jobs_and_applications.sql:14,37-38`).

### (d) I-0058 + I-0017: signup only succeeds with a profile
- Delete the explicit `profiles` insert (`auth.controller.js:257-265`). The trigger is the
  only writer.
- After `signUp` returns a user, call
  `ensureProfileOrRollback(adminClient, userId)`, in a new
  `backend/Services/signupProfile.js`:
  - It selects `profiles.id` for that user.
  - If the row is found, it returns `{ ok: true }`.
  - If the row is missing, or the select errors, it calls
    `adminClient.auth.admin.deleteUser(userId)` and returns `{ ok: false }`. If the delete
    also fails, it logs the user id (only the id) and `ok` stays `false`.
- `signup()` answers 500 `{ message: 'Signup failed. Please try again.' }` unless `ok` is
  true.
- The client is a parameter, so the unit test needs no module mocking.

### (e) I-0069: one grade per attempt: claim, release, reclaim (M3)
**M3 `assessment_grading_claim`:**
- The status check becomes `('generated', 'grading', 'completed')`. Today's constraint is
  inline and unnamed (`20261015_create_assessments.sql:20-21`), so Postgres named it
  `assessments_status_check`. M3 confirms the name in `pg_constraint` and raises if it
  differs, before it drops and re-adds the constraint.
- It adds `grading_started_at timestamptz`.
- `assessments_candidate_job_open_idx` is recreated `where status in ('generated',
  'grading')`, so generate cannot open a second attempt while one is being graded.
- **Claim function** `public.claim_assessment_for_grading(p_assessment_id uuid,
  p_candidate_id uuid, p_stale_after interval) returns table (id uuid, job_id uuid,
  questions jsonb, grading_started_at timestamptz)`. It is one atomic statement:
  ```sql
  update public.assessments a
     set status = 'grading', grading_started_at = now()
   where a.id = p_assessment_id
     and a.candidate_id = p_candidate_id
     and (a.status = 'generated'
          or (a.status = 'grading' and a.grading_started_at < now() - p_stale_after))
  returning a.id, a.job_id, a.questions, a.grading_started_at;
  ```
  - The `generated` branch is the owner's `UPDATE … SET status='grading' WHERE id=$1 AND
    status='generated' RETURNING`. The second branch is the stale reclaim.
  - Under READ COMMITTED, a second concurrent `update` waits on the row lock, then
    re-checks `WHERE` against the committed row (`grading`, a fresh timestamp). It matches
    nothing and returns 0 rows.
  - The function uses the database clock, so the clocks of several backend processes do
    not matter.
  - Grants: `revoke execute … from public, anon, authenticated`, then `grant … to
    service_role`.

**Evaluate:**
1. **Claim.** Call it via `rpc(...)` with `p_stale_after = '10 minutes'`.
   - 10 minutes is the constant `GRADING_STALE_AFTER`. It is more than 5× the backend's
     evaluate abort of 120 s (`assessment.controller.js:378`), so no live grader is ever
     treated as stale.
   - With 0 rows, answer 409 `{ error: 'already_submitted' }`. There is **no service call**,
     so no LLM call is spent.
2. **Grade.** Call assessment-service.
3. **Release on failure.** On a service error, a timeout or `key_unavailable`, run
   `update … set status = 'generated', grading_started_at = null where id = $1 and status =
   'grading' and grading_started_at = $claimed_at`, then answer 502.
   - Matching on `$claimed_at` means a slow grader can never release a claim that a reclaim
     has since taken over.
4. **Complete.** Run `update … set status = 'completed', answers, score, evaluation,
   completed_at where id = $1 and status = 'grading' and grading_started_at =
   $claimed_at`, with `.select('id')`.
   - With 0 rows, this grader was stale and has been superseded: answer 409, and fold
     nothing into the score.
   - Only with 1 row is the score rebuilt and the result returned.

**Generate:** an attempt in `grading` counts as open. Generate answers 409 `{ error:
'grading_in_progress' }` instead of handing the attempt out again.

The cheaper "grade first, then check the row count" option is out (owner decision 5):
double grading wastes free-model calls.

## Scope
**In:**
- M1–M4;
- `backend/Controllers/{auth,analysis,assessment}.controller.js`;
- `backend/Services/{signupProfile,gradingClaim}.js` (new);
- `backend/.env.example`;
- `assessment-service/app/{main,config}.py` and `assessment-service/app/__main__.py` (new);
- `assessment-service/README.md` (start commands) and
  `assessment-service/requirements-dev.txt` (new: pytest, httpx);
- the tests below;
- the `assessment` suite in `tests/run-suite.ps1`, documented in `tests/README.md`;
- the tracker updates in AUDIT.md, ISSUES.md, ROADMAP.md and WORKLOG.md.

**Out:**
- B2: the 8-digit duplicates, idempotency and bucket limits (I-0057, I-0010, I-0001);
- an internal service token (P2-6);
- what the candidate sees after grading (P0-5);
- the I-0067 prompt-injection fix (after P0-5);
- the email source for applicants (I-0028, B3);
- any frontend change. B1 runs before T-0019. The candidate page already shows backend
  error messages, and the new 409 texts are checked by hand (criterion 9).

## Acceptance criteria
"Before" means the test was run on `df98068` and failed. "After" means it passes once the
fix, and its migration where it has one, is in place.

Rules for the live tests:
- They read accounts from `tests/.env` (`t0001_` usernames only) and seed through the
  service role, tagged `[T-0001 TEST]` (one fresh test job per run).
- They clean up with `auth.admin.deleteUser` and `sweep`.
- They **skip**, rather than pass, when their accounts or services are missing.

1. **I-0055: the fail-first gate is static.** `tests/backend/migration-guards.test.mjs`:
   - "latest handle_new_user() takes its role from assert_signup_role": it finds the
     newest migration (by version) that defines `public.handle_new_user` and asserts that
     the role comes from `public.assert_signup_role(`. Before: only `20260823`'s direct
     cast exists, so it fails.
   - "assert_signup_role allows only candidate and recruiter": that migration defines the
     function with `not in ('candidate', 'recruiter')`, `raise exception 'invalid signup
     role` and `errcode = '22023'`. Before: it does not exist, so it fails.
   - "migration version prefixes are unique": every 14-digit prefix is unique and shares no
     prefix with an 8-digit file. Before: the M-files do not exist, so the T-0029 file
     names are absent and the test fails.
     - The 8-digit duplicates are reported as a skipped `todo` for I-0057, not a failure.
2. **I-0055: live, after the owner applies M1.** `tests/backend/live-signup-role.test.mjs`:
   - **Specific error, independent of any admin:** service-role
     `rpc('assert_signup_role', { p_role })`:
     - `'admin'` → error with code `22023` and a message starting `invalid signup role`;
     - `'superuser'` → the same;
     - `null` → the same;
     - `'candidate'` → returns `'candidate'`.
     - It does not depend on the single-admin index, so it cannot pass "because an admin
       exists".
   - **Not exposed to clients (owner addition at approval):** an **anon-key**
     `rpc('assert_signup_role', { p_role: 'candidate' })` is refused (PostgREST `42501`
     permission denied, or `PGRST202` not found when the schema cache hides it). M1
     revokes execute from `public, anon, authenticated`.
   - **End to end:** `auth.admin.createUser` with `email_confirm: true`. It sends no
     email, and the trigger is the same as for an anon signup. Username
     `t0001_role_<ts>`:
     - `role: 'superuser'` → error; no `auth.users` row and no `profiles` row for that
       email;
     - `role: 'admin'` → the same;
     - `role: 'candidate'` → `profiles.role = 'candidate'` (signup still works), then
       deleted.
     - The raw GoTrue error text is logged. If it contains `invalid signup role`, it is
       also asserted.
     - The test records whether an admin profile exists, so the Result can say which case
       applied.
3. **I-0066: no answer key for a candidate, after M2, the deploy and M4.**
   `tests/backend/live-answer-key-access.test.mjs`. Setup: seed an open attempt for C
   (key row with a known value), then sign C in **directly to GoTrue** with the anon key
   (`SUPABASE_ANON_KEY` from `backend/.env`).
   - (i) `GET /rest/v1/assessments?id=eq.<id>&select=*` with C's token: the row has
     **no `answer_key` field**. Before: it is present.
   - (ii) `GET /rest/v1/assessment_keys?assessment_id=eq.<id>` with C's token: no row
     (401, 403 or `[]`). Before: the table does not exist (404), so the test fails.
   - (iii) The same two reads with R's token, as the job's recruiter: no key.
   - (iv) `POST /api/assessment/generate` through the backend as C: searched
     recursively, the response holds no `answer_key`, `correct_option`, `ideal_answer` or
     `key_points` key.
   - (v) The grep from "Who reads `answer_key` today", re-run and pasted in Result:
     frontend 0 matches; backend: no `select` on `assessments` naming `answer_key`, and no
     `res.json` carrying it.
   - (vi) **M2's self-check:** applying M2 in a scratch copy, with one row's key nulled
     beforehand, raises `assessment_keys copy mismatch`. This is a manual SQL step,
     recorded in Result.
4. **I-0061 and the service half of I-0066/I-0060: internal only.**
   `tests/assessment/test_internal_only.py`, using TestClient (no port, no LLM):
   - `GET /docs`, `/redoc` and `/openapi.json` → 404. Before: 200.
   - `app.config` defaults are `HOST == "127.0.0.1"` and `PORT == 8002`.
   - `app/__main__.py` passes them to `uvicorn.run`, checked with uvicorn monkeypatched.
     Before: neither exists.
   - Every `uvicorn`/`python -m app` command in `assessment-service/README.md` binds
     127.0.0.1 on :8002. Before: `--port 8000`.
   - It runs in the new `assessment` suite (venv `assessment-service/.venv`, with
     `requirements-dev.txt`). The suite has its own pytest call, for the same reason as the
     `github` suite.
5. **I-0056: résumé URL authorisation.** `tests/backend/live-resume-authz.test.mjs` (needs R,
   R2 and C). Setup: R creates a test job; C uploads the fixture résumé and applies.
   - R `GET /api/resume/candidate/<C>` → 200 with a URL.
   - **R2 → 404.** Before: 200.
   - R with `not-a-uuid` → **400**. Before: not 400.
   - R with a random UUID → 404.
   - R2, after C applies to an R2 job → 200 (positive control).
6. **I-0058 + I-0017: signup needs a profile.** `tests/backend/signup-profile.test.mjs`
   (offline, fake client):
   - profile present → `{ ok: true }`, and `deleteUser` is not called;
   - profile missing → `deleteUser(userId)` is called once, and the result is
     `{ ok: false }`;
   - the select errors → rollback as well;
   - `deleteUser` fails → `{ ok: false }`, nothing is thrown;
   - **source guard:** `auth.controller.js` contains no `from('profiles').insert`.
     Before: `:257-265`.
   - Before, the module does not exist, so the test fails.
   - **Not live:** a backend signup sends a real confirmation email, and a missing profile
     cannot be produced against the real trigger. Covered by criterion 9.
7. **I-0069: one grade per attempt.**
   - **Offline:** `tests/backend/grading-claim.test.mjs` tests
     `backend/Services/gradingClaim.js` `gradeOnce({ claim, grade, complete, release })`
     with fakes:
     - claim → `null`: 409, and `grade` is never called;
     - `grade` throws: `release(claimedAt)` is called once, and the result is 502;
     - `complete` → 0 rows (superseded): 409, the result is not returned, and nothing is
       folded into the score;
     - the happy path: `complete` with the same `claimedAt`, then the result.
     - Before: the module does not exist.
   - **Static, in `migration-guards.test.mjs`:** M3 allows `grading` in the status check,
     recreates the open index with `status in ('generated', 'grading')`, and defines
     `claim_assessment_for_grading` with both the `generated` and the stale branch.
     Before: absent.
   - **Live, after M3:** `tests/backend/live-evaluate-once.test.mjs` (needs :8002; MCQ-only
     answers are graded deterministically, with no LLM).
     - **Concurrency:** 5 concurrent `POST /api/assessment/evaluate` on one seeded open
       attempt → exactly one 200 and four 409s. The row is `completed`, and the
       `scores.subscores.assessment_results` value equals the 200's score. Before: two or
       more 200s.
     - **Fresh claim is respected:** seed `status = 'grading', grading_started_at = now()`.
       Evaluate → 409, and generate for that job → 409 `grading_in_progress`. Before: the
       seed violates the status check, so the test fails.
     - **Stale claim is reclaimed:** seed `status = 'grading', grading_started_at = now() -
       11 minutes`. Evaluate → 200, and the row is `completed`.
     - A submit after completion → 409.
   - **Live, service down:** `tests/backend/live-evaluate-release.test.mjs`. It runs only
     when :8002 is unreachable and skips otherwise; the owner stops :8002 for one run.
     Evaluate on a seeded open attempt → 502, and the row is back to `generated` with
     `grading_started_at` null. A second evaluate claims it again (502 again, not 409).
8. **Round trip, after M4 (owner, manual):** one assessment generate and submit in the UI
   still works end to end.
9. **Manual (owner):**
   - a new candidate signs up in the UI → 201 and can log in;
   - the backend log has no `profiles_pkey` error;
   - a double-clicked Submit shows the 409 text, not a second score.
10. **Trackers.** `node tests/docs/check-trackers.mjs` passes. ISSUES moves I-0055, I-0056,
    I-0058, I-0017, I-0060, I-0061, I-0066 and I-0069 to Resolved, with these tests as
    evidence.

## Test plan
- **Written first and run on `df98068`, with the failures recorded:**
  - `migration-guards.test.mjs`
  - `signup-profile.test.mjs`
  - `grading-claim.test.mjs`
  - `test_internal_only.py`
  - `live-resume-authz.test.mjs`
  - `live-answer-key-access.test.mjs`
  - `live-evaluate-once.test.mjs`
- **`live-signup-role.test.mjs`** runs after M1, by owner decision 6. Its "before" is the
  static gate.
- **Order of the fixes:**
  1. M2 + M3 and the assessment code ((b), (e));
  2. assessment-service ((b) service half, I-0060, I-0061);
  3. M1 (a);
  4. (c);
  5. (d);
  6. M4, last.
- **Run lists in `tests/run-suite.ps1`:**
  - offline backend list: `migration-guards`, `signup-profile`, `grading-claim`;
  - `-Live` list: the five `live-*` files;
  - the new `assessment` suite: `test_internal_only.py`.
- **Cannot be automated:** criteria 8 and 9 (a real confirmation email, a real LLM, the UI),
  and criterion 3 (vi) (a scratch-database SQL check).

## Regression
- `tests\run-suite.ps1 -Target current -Live` (nlp, backend, frontend, docs, github, and
  the new assessment suite).
  - The frontend suite keeps its known lint failures: I-0068, plus 5 older ones.
- `tests/backend/assessment-generate.smoke.mjs`, `assessment-evaluate-live.test.mjs`,
  `live-auth-failclosed.test.mjs` and `explainability.test.mjs`.

## Risks and rollback
- **M4 drops a column.** Three safeguards:
  - M2 verifies the copy;
  - M4 re-copies and re-verifies before dropping;
  - the owner takes the locked-down backup first.

  Rollback is a new migration that adds `answer_key` back and fills it from
  `assessment_keys`, or from the backup table.
- **The backup table is itself a leak if it is left open.** The two lock-down lines are
  part of the owner step, not optional. Drop the table after criterion 8.
- **Deploy order:** M2 and M3 → backend deploy → M4.
  - If the backend deploys before M2 or M3, generate fails on the missing table, and
    evaluate fails on the missing function. Safe, but the feature is down.
  - If M4 runs before the deploy, the old code's `select ... answer_key` fails. Grading is
    down until the deploy.
- **A stuck claim:** a crashed grader leaves `grading`. The next evaluate after 10 minutes
  reclaims it (criterion 7, stale case).
  - Rollback of M3 is a migration that maps `grading` → `generated` and restores the old
    check and index.
- **Admin signup:** after M1, no signup path can create an admin. Promotion stays manual
  SQL, as intended.
- **Code rollback:** revert the commit. M1–M3 are additive. M4 is covered above.

---

## Result
Executed 2026-11-03..04. Owner applied M1–M3 (SQL editor, 2026-11-04; check: 5 assessments
= 5 keys, RLS on, 0 policies, status check has `grading`, anon/authenticated lack execute on
both functions and select on `assessment_keys`, service_role can claim). Owner copy check
(0 attempts without a key, 0 mismatches), locked-down backup (`assessments_answer_key_backup`,
5 rows, anon/authenticated read false), then M4 (`answer_key` gone, 5 = 5). The M-versions
are not in `schema_migrations` (owner decision; noted in I-0057/I-0010 for B2). Logs in
`tests/.out/t0029-*`. Committed by the owner as `edb1a37`.

| # | Verdict | Before (`df98068`) | After |
|---|---|---|---|
| 1 | **PASS** | `migration-guards`: handle_new_user/assert/prefix tests fail (`t0029-before-offline.log`, 19 offline failures in all) | all pass; I-0057 duplicates reported as `todo` (`t0029-after-offline.log`, 56 pass, 0 fail, 1 todo) |
| 2 | **PASS** | static gate only (owner decision 6) | `live-signup-role` 10/10: RPC admin/superuser/null → `22023 invalid signup role`; candidate, recruiter accepted; **anon RPC refused**; createUser with superuser/admin/no role → error, no user, no profile; candidate signup works (`t0029-after-live-signup-role.log`) |
| 3 | **PASS** (i)–(v); (vi) **ACCEPTED GAP** | (i), (iii) `answer_key` returned to C and R; (ii) 404 PGRST205 (no table); (iv) passed (regression guard); (v) backend select names `answer_key` | `live-answer-key-access` 5/5 after M4 (`t0029-after-live-answer-key-access.log`; before M4, (i) and (iii) still failed on the null column, as expected). (v) grep: frontend 0; backend only `assessment.controller.js:32` (stripKey), `:286` (service response), `:332` (key-table insert), `:405`, `:409` (key-table read), `:425` (service request). (vi) not run (needs a scratch database). **Known, accepted gap (owner, 2026-11-04):** the raise is pinned by `migration-guards`, and the real copy matched 5 = 5 (owner check: 0 attempts without a key, 0 mismatches); accepted as evidence |
| 4 | **PASS** | 4 of 5 fail (docs 200, no HOST/PORT, no `__main__`, README `:8000`) | 5/5 (`t0029-after-assessment.log`; `run-suite.ps1 -Suites assessment` exit 0). Live: `python -m app` listens on 127.0.0.1:8002 only |
| 5 | **PASS** | R2 → 200 with URL; `not-a-uuid` → 404 | `live-resume-authz` 5/5 (`t0029-after-live-resume-authz.log`) |
| 6 | **PASS** (offline) | module absent; insert at `auth.controller.js:257-265` | `signup-profile` 6/6, incl. source guard and the `identities: []` existing-account case (no rollback, enumeration-safe) |
| 7 | **PASS** | concurrency: 200 ×5; fresh/stale seeds rejected (no `grading_started_at`, status check) | `grading-claim` 7/7 offline; `live-evaluate-once` 3/3 (one 200 + four 409, score 50 folded once, later submit 409; fresh claim → 409 + generate `grading_in_progress`; 11-min-old claim reclaimed); `live-evaluate-release` 1/1 with :8002 stopped (502, row back to `generated`, retry claims again). Before, the release test also passed (old code never left `generated`): a regression guard, as the spec says |
| 8 | **PASS (owner, manual)** | — | Owner, 2026-11-04: UI generate + submit after M4 works. Backup table `assessments_answer_key_backup` dropped afterwards |
| 9 | **PASS (owner, manual)** | — | Owner, 2026-11-04: UI signup → 201 and login; no `profiles_pkey` in the backend log; double-clicked Submit shows the 409 text, not a second score |
| 10 | **PASS** | — | `check-trackers` OK, 0 warnings. I-0055, I-0056, I-0058, I-0017, I-0060, I-0061, I-0066, I-0069 moved to Resolved |

**Regression** (live services, not `run-suite` for backend/nlp: :5000/:8000 were in use):
backend offline + all `-Live` files, 115 tests: 112 pass, 1 todo (I-0057), 1 skipped
(release, :8002 up), **1 fail: `live-shortlist-authz` control, rejection now sends a
notification** — added by `3f53f80`, predates T-0029, logged as **I-0071** (mapped to P0-3);
NLP 12/12; `github` and `assessment` suites exit 0; frontend build fails on the 9 known lint
warnings (I-0068 + 5 older), no frontend change in T-0029. Sweep `--check`: nothing left.

**Found during execution:** the first live run hit yesterday's backend still on :5000 (the
sandbox's `netstat` does not see other processes' sockets); found by process command line,
replaced, re-run. Not a code issue.
