# T-0029 — security-batch

> Status: **draft, awaiting owner approval** (written in T-0028, 2026-11-03).
> ROADMAP item P0-1 (B1, Phase 0). First in the execution order. Depends on nothing.
> All facts below were re-verified at `df98068` in T-0028.

## Context
The T-0023 merge brought in six security defects. All are still present at `df98068`:

| Issue | Sev | What is wrong at HEAD |
|---|---|---|
| I-0055 | P0 | `handle_new_user()` (`supabase/migrations/20260823_create_profiles.sql:36-66`) casts `raw_user_meta_data ->> 'role'` straight into `profiles.role` (`:58`). `admin` was added to the enum in `20260831_add_single_admin_role.sql:5`, so a direct GoTrue signup with the public anon key and `data.role = 'admin'` creates an admin profile whenever no admin exists. The single-admin unique index (`:8-10`) only stops a second one. |
| I-0066 | P0 | `public.assessments.answer_key` (`20261015_create_assessments.sql:10-33`) is readable through RLS. The candidate policy (`:50-52`) and the recruiter policy (`:54-62`) cover every column. A candidate who signs in to GoTrue directly reads the answer key of an open attempt from PostgREST. assessment-service returns `answer_key` (`assessment-service/app/main.py:35-38`), has no auth, and leaves the docs on. |
| I-0061 | P2 | assessment-service FastAPI app (`assessment-service/app/main.py:10-17`) keeps `/docs`, `/redoc` and `/openapi.json` on. Its bind address depends on the command line (the README says `--port 8000`). |
| I-0056 | P0 | `GET /api/resume/candidate/:candidateId` (`backend/Routes/analysis.routes.js:13`) only checks `requireRole('RECRUITER')`. `getCandidateResume` (`backend/Controllers/analysis.controller.js:205-234`) signs a 60 s URL for any candidate id, with no ownership check and no UUID check. |
| I-0058 | P1 | `signup()` (`backend/Controllers/auth.controller.js:207-274`) returns 201 even when the profile insert fails (`:267-269` only logs). No check confirms that a `profiles` row exists. |
| I-0017 | P3 | That insert (`auth.controller.js:257-265`) duplicates the `on_auth_user_created` trigger, so every signup logs a `profiles_pkey` error. |
| I-0069 | P2 | `evaluate` reads `status` (`assessment.controller.js:346-358`), grades, then updates with `.eq('status','generated')` (`:396-406`) without checking the row count. Two concurrent submits are both graded and both folded into the score, and the second is never saved. |

## Goal
Close the six B1 security defects. Each fix ships with a test that fails on `df98068`
and passes after the fix. Live tests touch only `t0001_` accounts.

## Spec ref
- NFR-8 (auth, two user classes) and NFR-9 (secrets server-side), from
  PROJECT_SOURCE_DOCS.md.
- CLAUDE.md guide-review item `GR-1` (the answer-key part of anti-cheating) and `GR-2`
  (internal services stay internal, DEC-5).
- ISSUES I-0055, I-0056, I-0058, I-0017, I-0061, I-0066, I-0069.

## Design

### (a) I-0055: signup role allow-list
- **New migration** `supabase/migrations/20261103a_restrict_signup_role.sql`. The prefix is
  unique, so it does not add to I-0057. Applied migrations are never edited.
  - `create or replace function public.handle_new_user()` keeps the same signature,
    `security definer` and `search_path = ''`. The trigger keeps working and does not
    need to be re-created.
  - It reads `v_role := new.raw_user_meta_data ->> 'role'`.
  - `if v_role is null or v_role not in ('candidate', 'recruiter') then raise exception
    'invalid signup role' using errcode = '22023'; end if;`
  - The rest of the insert is unchanged. It casts `v_role` to the enum.
- **Effect.** GoTrue rolls back the `auth.users` insert, so no user and no profile are
  created. The backend's `signup()` already sends only `candidate` or `recruiter`, after
  its own role check.
- **Admin promotion stays manual** (the SQL in the comment of `20260831`). It is an
  `update`, not an insert, so the trigger does not see it.
- **Remote step (owner).** Apply the migration with the SQL editor or `supabase db push`.
  If the duplicate prefixes (I-0057, B2) block `db push`, use the SQL editor, then
  `supabase migration repair --status applied 20261103a`.
  - The prefix is not a pure date. If the CLI rejects `20261103a`, use a 14-digit
    `20261103120000`. B2 settles the naming convention.

### (b) I-0066 + I-0061: no path from a candidate to an answer key
Proposed design (owner to approve or replace):
- **Separate key table, new migration** `20261103b_assessment_answer_keys.sql`:
  - `create table public.assessment_keys (assessment_id uuid primary key references
    public.assessments(id) on delete cascade, answer_key jsonb not null, created_at
    timestamptz not null default timezone('utc', now()))`.
  - `alter table ... enable row level security`, with **no policy at all**. Also
    `revoke all on public.assessment_keys from anon, authenticated`. The service role
    bypasses RLS, so only the backend can read the table.
  - Copy and drop, in one transaction: `insert into public.assessment_keys
    (assessment_id, answer_key) select id, answer_key from public.assessments;` then
    `alter table public.assessments drop column answer_key;`.
  - The recruiter policy then stops exposing keys too. The candidate policy stays, so a
    candidate can still read their own questions, answers and score.
- **Rejected alternative:** a column-level `revoke select (answer_key)`. Supabase grants
  table-level `select` to `authenticated`, so this needs a revoke of the whole table plus
  a re-grant of every other column. Any column added later is silently left out. A
  separate table cannot leak by omission.
- **Backend** (`assessment.controller.js`):
  - Generate inserts the attempt and then the key row. If the key insert fails, it
    deletes the attempt, so no attempt exists without a key.
  - Evaluate reads the key from `assessment_keys` with the service-role client.
  - `stripKey` stays, as a second guard on every response.
- **assessment-service, internal only (DEC-5, as github-evidence already is):**
  - `FastAPI(..., docs_url=None, redoc_url=None, openapi_url=None)`.
  - A new `app/__main__.py` runs uvicorn on `ASSESSMENT_HOST` (default `127.0.0.1`) and
    `ASSESSMENT_PORT` (default `8002`), read in `app/config.py`. The documented start
    command becomes `python -m app`.
  - The README's three `--port 8000` commands become that command. That is the README
    half of I-0060; the owner may keep it in B3 instead (ROADMAP, proposed change 4).
  - There is no internal auth token, the same model as NLP and github-evidence. It is
    revisited in P2-6.
- **Out of scope, a question for P0-5 (GR-1 design):** what the candidate may see
  **after** grading (correct options, ideal answers). This task guarantees only that no
  key for an attempt reaches the candidate before that attempt is graded, and that none
  is readable from the database at any time.

### (c) I-0056: résumé URL only for the candidate's recruiters
- `getCandidateResume`:
  1. Validates `candidateId` against the UUID regex. A non-UUID gets 400
     `{ error: 'invalid_candidate_id' }` before any storage call.
  2. Checks that the candidate applied to one of this recruiter's jobs. It reuses the
     shortlist pattern (`jobs.controller.js:268-279`):
     `.from('applications').select('id, job:jobs!inner(recruiter_id)')`,
     `.eq('candidate_id', candidateId)`, `.eq('job.recruiter_id', req.session.userId)`,
     `.limit(1)`.
  3. With no match, it answers **404** `{ error: 'not_found' }`. That is the same answer
     as "no résumé", so the endpoint does not reveal whether a candidate exists.
- This adds no migration: `jobs.recruiter_id` and `applications(candidate_id, job_id)`
  already exist (`20260830_create_jobs_and_applications.sql:14,37-38`).

### (d) I-0058 + I-0017: signup only succeeds with a profile
- Delete the explicit `profiles` insert (`auth.controller.js:257-265`). The trigger is the
  only writer (I-0017).
- After `signUp` returns a user, call a new `backend/Services/signupProfile.js`
  `ensureProfileOrRollback(adminClient, userId)`:
  - It selects `profiles.id` for the user with the service-role client.
  - If the row is found, it returns `{ ok: true }`.
  - If the row is missing, or the select errors, it calls
    `adminClient.auth.admin.deleteUser(userId)` and returns `{ ok: false }`. If the
    delete itself fails, the user id is logged (only the id) and `ok` is still `false`.
- `signup()` answers **500** `{ message: 'Signup failed. Please try again.' }` when
  `ok` is false, and 201 only when it is true.
- The client is passed in as a parameter, so the unit test needs no module mocking.

### (e) I-0069: one grade per attempt
- **Recommended: claim first.** A new migration, `20261103c_assessment_grading_claim.sql`:
  - Status check becomes `('generated', 'grading', 'completed')`, plus a `grading_started_at
    timestamptz` column.
  - The one-open-attempt index is recreated with `where status in ('generated',
    'grading')`, so generate cannot open a second attempt while one is being graded.
- **Evaluate:**
  1. Claim with `update ... set status = 'grading', grading_started_at = now() where
     id = $1 and candidate_id = $2 and (status = 'generated' or (status = 'grading' and
     grading_started_at < now() - interval '10 minutes'))`, with `.select('id')`.
  2. If no row comes back, answer 409 `{ error: 'already_submitted' }` and make no service
     call.
  3. If grading fails, set `status` back to `generated`.
  4. Completion does `update ... where status = 'grading'` and checks that exactly one row
     changed.
  - 10 minutes is longer than the backend's longest evaluate wait. A crashed grader's
    claim expires, so an attempt cannot stay stuck.
- **Generate:** an attempt in `grading` counts as open. It answers 409 `{ error:
  'grading_in_progress' }` instead of handing out the attempt again.
- **Cheaper alternative, if the owner prefers no migration:** keep grading first, but
  complete with `.eq('status','generated').select('id')`, and answer 409 when 0 rows
  change. Only one grade is saved or returned, but the LLM can grade one attempt twice.
  The claim-first design meets "graded only once" as written, which the alternative does
  not.

## Scope
**In:**
- the three migrations above;
- `backend/Controllers/{auth,analysis,assessment}.controller.js`;
- `backend/Services/signupProfile.js` (new);
- `assessment-service/app/{main,config}.py` and `assessment-service/app/__main__.py` (new);
- `assessment-service/README.md` (start commands) and
  `assessment-service/requirements-dev.txt` (new: pytest, httpx);
- the tests listed below;
- the `assessment` suite in `tests/run-suite.ps1`, documented in `tests/README.md`;
- the tracker updates in AUDIT.md, ISSUES.md, ROADMAP.md and WORKLOG.md.

**Out:**
- B2's migration renames, idempotency and bucket limits (I-0057, I-0010, I-0001);
- an internal service token (P2-6);
- what the candidate sees after grading (P0-5);
- the I-0067 prompt-injection fix (after P0-5);
- the email source for applicants (I-0028, B3);
- any frontend change. B1 runs before T-0019, and none of these fixes needs a page
  change.
  - The candidate page already shows backend errors. The new 409 texts will be checked by
    hand in the UI.

## Acceptance criteria
Every automated test below must **fail on `df98068`** (recorded in Result as "before")
and **pass after the fix**.

Rules for the live tests:
- They read accounts from `tests/.env` (`t0001_` usernames only) and seed rows through the
  service role, tagged `[T-0001 TEST]`.
- They remove what they create: `auth.admin.deleteUser`, and `sweep` for jobs, applications,
  assessments and storage.
- They skip, rather than pass, when their accounts are missing.

1. **I-0055: role allow-list.** Checked by:
   - **Static:** `tests/backend/migration-guards.test.mjs`, test "latest
     handle_new_user() rejects roles other than candidate/recruiter". It finds the
     newest migration that defines `public.handle_new_user` and asserts that it contains
     `not in ('candidate', 'recruiter')` and a `raise exception`. Before the fix, it finds
     only `20260823`'s direct cast, so it fails. The file name matches the one T-0020 and
     B2 plan to extend.
   - **Live:** `tests/backend/live-signup-role.test.mjs`. Through the service role,
     `auth.admin.createUser` with `email_confirm: true` sends no confirmation email and
     runs the same trigger as an anon signup. For each case, the username is
     `t0001_role_<ts>`:
     - `role: 'admin'` → error, no `auth.users` row and no `profiles` row for that email;
     - `role: 'superuser'` → error;
     - no role → error;
     - `role: 'candidate'` → `profiles.role = 'candidate'`, as a positive control, then
       deleted.
   - **Caveat:** the "before" run fails on the `admin` case only if the project has no
     admin. If an admin exists, the old function also errors, on the single-admin index.
     The static test is the guaranteed fail-before. The Result records which case
     applied.
2. **I-0066: no answer key for a candidate.** Checked by
   `tests/backend/live-answer-key-access.test.mjs`. Setup: seed an open attempt for C on a
   fresh test job through the service role, with a known key, then sign C in **directly
   to GoTrue** with the anon key (`SUPABASE_ANON_KEY` from `backend/.env`), the way an
   attacker would.
   - (i) `GET /rest/v1/assessments?id=eq.<id>&select=*` with C's token returns the row
     with **no `answer_key` field**. Before the fix the field is present, so the test
     fails.
   - (ii) `GET /rest/v1/assessment_keys?assessment_id=eq.<id>` with C's token returns
     no row (401, 403 or an empty array).
   - (iii) The same two reads with R's token, as the job's recruiter: no key.
   - (iv) `POST /api/assessment/generate` through the backend as C: the response body,
     searched recursively, holds no `answer_key`, `correct_option` or `ideal_answer`
     key. This is a regression guard for `stripKey`.
3. **I-0061 + the service half of I-0066: internal only.** Checked by
   `tests/assessment/test_internal_only.py`, using TestClient with no port and no LLM:
   - `GET /docs`, `/redoc` and `/openapi.json` → 404. Today they return 200, so the test
     fails before the fix.
   - `app.config` exposes `HOST == "127.0.0.1"` and `PORT == 8002` by default.
   - `app/__main__.py` passes those to `uvicorn.run`, checked with uvicorn monkeypatched.
     It fails before the fix, because neither the module nor the settings exist.
   - It runs in the new `assessment` suite, with the venv at `assessment-service/.venv`
     and `requirements-dev.txt`. The suite has its own pytest call, for the same reason
     as the `github` suite.
4. **I-0056: résumé URL authorisation.** Checked by `tests/backend/live-resume-authz.test.mjs`
   (needs R, R2 and C). Setup: R creates a test job, C uploads the fixture résumé and
   applies.
   - R `GET /api/resume/candidate/<C>` → 200 with a URL.
   - **R2 → 404.** Before the fix it is 200, so the test fails.
   - R, with `not-a-uuid` → **400**. Before the fix it is not 400, so the test fails.
   - R, with a random UUID → 404.
   - R2, with C's id after C also applies to an R2 job → 200. This positive control
     shows the check uses the recruiter's own jobs.
5. **I-0058 + I-0017: signup needs a profile.**
   - `tests/backend/signup-profile.test.mjs` (offline, fake client) checks
     `ensureProfileOrRollback`:
     - profile present → `{ ok: true }` and `deleteUser` not called;
     - profile missing → `deleteUser(userId)` called once and `{ ok: false }`;
     - select errors → rollback as well;
     - `deleteUser` fails → `{ ok: false }`, and the error is not thrown.
     - It fails before the fix, because the module does not exist.
   - The same file has a source guard: `backend/Controllers/auth.controller.js` contains
     no `from('profiles').insert`. It fails before the fix (`:257-265`).
   - **Not live:** the backend signup sends a real confirmation email (`signUp` with the
     anon key), and a missing profile cannot be produced against the real trigger. The
     path is covered by the unit test plus the owner's one manual UI signup (criterion 7).
6. **I-0069: one grade per attempt.** Checked by `tests/backend/live-evaluate-once.test.mjs`.
   It needs :8002 running. MCQ-only answers are graded deterministically, with no LLM.
   - Setup: seed one open MCQ-only attempt for C, then fire **5 concurrent**
     `POST /api/assessment/evaluate` for it.
   - After the fix: exactly one 200 and four 409s; the row is `completed` once; the
     `scores` row's assessment value equals the 200's score.
   - Before the fix: two or more 200s, so the test fails.
   - A sixth submit after completion → 409.
   - It skips when :8002 is down.
7. **Manual (owner), after the remote migrations:**
   - signup of a new candidate in the UI → 201, and the user can log in;
   - the backend log shows no `profiles_pkey` error;
   - one assessment generate and submit in the UI still works end to end.
8. **Trackers.** `node tests/docs/check-trackers.mjs` passes. ISSUES moves I-0055, I-0056,
   I-0058, I-0017, I-0061, I-0066 and I-0069 to Resolved, with these tests as evidence.

## Test plan
- **Written first, run on `df98068`, failures recorded:**
  - `migration-guards.test.mjs`
  - `live-signup-role.test.mjs`
  - `live-answer-key-access.test.mjs`
  - `test_internal_only.py`
  - `live-resume-authz.test.mjs`
  - `signup-profile.test.mjs`
  - `live-evaluate-once.test.mjs`
- **Order of the fixes:**
  1. (b), because its migration changes the table that (e) seeds;
  2. (e);
  3. (a);
  4. (c);
  5. (d).
- **Run lists in `tests/run-suite.ps1`:**
  - `migration-guards` and `signup-profile` go into the offline backend list;
  - the four `live-*` files go into the `-Live` list;
  - `test_internal_only.py` goes into the new `assessment` suite.
- **Cannot be automated:** criterion 7, the UI signup and the quiz round trip. A real
  confirmation email and a real LLM are involved.

## Regression
- `tests\run-suite.ps1 -Target current` (nlp, backend, frontend, docs, github, plus the new
  assessment suite) with `-Live`.
  - The frontend suite keeps its known lint failures: I-0068, plus 5 older ones.
- `tests/backend/assessment-generate.smoke.mjs`, `assessment-evaluate-live.test.mjs` and
  `live-auth-failclosed.test.mjs`.

## Risks and rollback
- **Data migration in (b).** Dropping `assessments.answer_key` is irreversible without the
  copy.
  - The migration copies first, in the same transaction.
  - Rollback is a new migration that adds the column back and copies it from
    `assessment_keys`.
  - The owner takes a `pg_dump` of `assessments` before applying.
- **Admin signup.** After (a), no signup path can create an admin. Promotion stays
  manual SQL, as intended.
- **Stuck claim in (e).** A crashed grader leaves `grading`. The 10-minute reclaim limits
  it. Rollback is a migration that maps `grading` back to `generated` and restores the old
  check and index.
- **Remote apply order:** (b), then (e), then (a). The backend code for (b) and (e) needs
  its migrations first. Deploy the code only after the owner confirms they are applied.
  Otherwise generate fails on the missing `assessment_keys` table. That failure is safe,
  but the feature is down.
- **Code rollback:** revert the commit. The migrations are additive, apart from (b)'s
  drop, which is covered above.

---

## Result
<Filled at the end of T-0029. One line per acceptance criterion, with the "before" failure
and the "after" pass.>
