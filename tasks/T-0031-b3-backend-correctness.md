# T-0031 — b3-backend-correctness (B3: ROADMAP P0-3)

**Status:** DONE 2026-11-04 on branch `b3-backend-correctness`, uncommitted. All 16 criteria PASS.
The D1 migration is pushed. D1–D5 decided (owner, 2026-11-04). The clean run is in the Result.
I-0079, found in review, is resolved here. I-0078 stays open: file content is not checked.

All line numbers are at `f5069a3`. Several in ISSUES.md have shifted; the ones here replace
them.

## Re-verification summary

| Issue | Holds at HEAD? | What changed from the issue text | Migration? |
|---|---|---|---|
| I-0063 | Yes | `GET /api/jobs/applications` has no caller at all (frontend or tests) | Yes (D1) |
| I-0028 | Yes, **worse than recorded** | Email is blank for **every** applicant, and the endpoint **has** a caller, so "P3, no caller" is wrong | Yes (D1) |
| I-0029 | Yes | `:275-278` is the 500 branch | No |
| I-0027 | Yes | Now `backend/index.js:73` | No |
| I-0025 | Yes, **plus 2 gaps** | Multer has no error handler, and its limit is off by one | No |
| I-0065 | Yes, **real data** | **All 4 live score rows** carry the stale text, and the proposed fix alone does not change what recruiters see on them | No |
| I-0062 | Yes | The calls are at `:259` and `:422`, and assessment-service ignores `X-Request-ID` | No |
| I-0059 | Yes | The fallback is unused: the venv loads the model by name | No |
| I-0039 | Yes | `backend/uploads/` is not tracked | No |
| I-0016 | Yes | The database accepts an empty last name, so backend-only is right | No |
| I-0071 | Yes | The wording changes (D4), so the controller changes too | No |
| I-0072 | **Finding: one path accepts `.txt`** | `POST /api/analyze` has no extension gate | No |

**One migration** (I-0063/I-0028, D1). The bucket does not change.

## Owner decisions (2026-11-04)

| Id | Decision |
|---|---|
| D1 | Applicant email comes from Auth, through one batched RPC. It takes `uuid[]` and returns only `(id, email)` for those ids. Execute is revoked from `public`, `anon` and `authenticated`; only `service_role` can call it (the `assert_signup_role` pattern from T-0029). A test shows it is refused for anon and authenticated and works for the backend. Migration under the runbook: 14-digit version, `npx supabase db push --linked`, **stop before the push for the owner** |
| D2 | Delete `getAllApplications` and its route. Paste the grep proving nothing in `frontend/`, `backend/` or `tests/` calls it into the Result. Fix `tests/MANUAL_SMOKE.md:64` |
| D3 | Option A, the rebuild fix alone. The stored text was true when it was written (GitHub evidence was not deployed then), so stored rows are not rewritten. Recorded in I-0065 |
| D4 | New wording, because a candidate with several applications cannot tell which one was rejected: `The recruiter has decided not to move forward with your application for <job title>.` The title is not recruiter-only data: the candidate saw it when applying. The data still holds only the application and job ids. The title comes from the same query, not a second round trip. The test pins the exact string using a fixture job title. The unexplained live row (`Your application for a job has been updated.`) is logged in ISSUES as unknown origin and not modified |
| D5 | I-0073 is in B3, with its test |

Defaults accepted: the shared constant in the backend, returned as `maxResumeBytes`; exactly 10 MB
accepted; the assessment-service middleware.

**Tracker edits made after the merge of `origin/main` (`88d03eb`):** P0-3 Task cell, I-0073 and (l)
in ROADMAP, the D3 reasoning in I-0065, the D4 note in I-0071, and I-0075 (unknown-origin row,
WONTFIX).

## Goal
Fix the twelve B3 backend defects so recruiters see real applicant emails, malformed input
gets correct client errors, uploads are bounded and PDF/DOCX on every route, and assessment
calls can be traced.

## Spec ref
FR-14, FR-15 (recruiter view, candidate notification), FR-13 and GF-5 (explainability text),
NFR-2 (I-0025), NFR-12 (I-0062), FR-1 (PDF/DOCX ingestion). ROADMAP P0-3; AUDIT 0.7, 5.1, 5.15.
I-0029, I-0027 and I-0039 have no spec ref (correctness and cleanup).

## Scope
**In:** ROADMAP P0-3 (a)–(k), the twelve issues below; I-0073 (l); tracker updates at close.

**Out:**
- All frontend changes. The selection-time size check is P0-4 (a).
- The OAuth env vars (P2-7). I-0039 stays open for them.
- The NLP call's raw `fetch` (`backend/Controllers/assessment.controller.js:55`, multipart,
  P2-1) and the per-row `scores` query (`backend/Controllers/analysis.controller.js:593`).
- Removing `/api/analyze` (T-0020), and direct access to NLP `/parse` (I-0034, P2-6).
- Pinning NLP requirements or installing the model from `requirements.txt` (I-0038, P2-6).
- **The keyword lists in `nlp-engine/app/ner.py`, and `tests/nlp/snapshots/current/`.** P3-2 is
  pulled forward to Anurag (owner, 2026-11-04). B3 must not touch them.
- Deleting nlp-engine's `.txt` branch: the owner's decision is to record it, not remove it.
- Duplicate notifications on a repeated decision (I-0074, P2-5).

---

## Issue by issue

Tier: **offline** needs no database; **smoke** needs the backend running; **live** needs the
backend and the shared project (`-Live`). "At HEAD" is predicted from the code, except I-0071,
which is already logged. Step 1 of execution records the real results.

### (a) I-0063, I-0028: applicant email and names

**Verified:**
- `backend/Controllers/jobs.controller.js:214` selects `profiles.email`, which does not exist
  (`supabase/migrations/20260823000000_create_profiles.sql:8-28`). The error is ignored, so
  `:222` always takes the Auth fallback per row, and names come from metadata.
- **Removing the column alone would copy I-0028 into this handler:** the profile would load,
  the fallback would stop, and the email would go blank.
- In `getAllApplicants`, the Auth fallback at `backend/Controllers/analysis.controller.js:575`
  runs only for a candidate with no profile, and `applications.candidate_id` has a foreign key
  to `profiles` (`supabase/migrations/20260830000000_create_jobs_and_applications.sql:37`). The
  branch cannot run, so the email at `:588` is `''` for every row.
- **I-0028's "no caller" is stale.** `frontend/src/pages/recruiter/AllCandidates.jsx:20` calls
  it, and `:179` shows "No contact info". The route is live at `/recruiter/candidates`
  (`frontend/src/App.jsx:73`). AUDIT 5.15's "no UI caller" is stale too.

**Fix (D1, D2):**
- New migration: `public.applicant_emails(p_candidate_ids uuid[])` returns only `(id, email)`,
  only for those ids, from `auth.users`, `security definer`, `set search_path = ''`.
- **Execute is revoked from `public`, `anon` and `authenticated`, and granted to
  `service_role` only.** Supabase grants new `public` functions to `anon` by default, and
  without the revoke any visitor could read emails through PostgREST. This is the T-0029
  `assert_signup_role` lesson.
- New `backend/Services/applicantIdentity.js`: `loadApplicantIdentities(client, candidateIds)`,
  one profiles query plus one RPC, client passed in like `signupProfile.js`.
- `getAllApplicants` uses it. The dead metadata fallback goes.
- An RPC error is logged and the email stays `''`, so the page still lists applicants. The
  error is checked explicitly: ignoring it is how I-0063 happened.
- Delete `getAllApplications` and its route.

**Tests:**
| Test | Tier | At HEAD | After |
|---|---|---|---|
| New `live-applicants.test.mjs`: `/api/recruiter/applicants` email equals the Auth email for a candidate with a profile | live | Fails (`''`) | Passes |
| Same file: `applicant_emails` refused for anon and for a signed-in candidate | live | Fails (no function) | Passes |
| Same file: `applicant_emails` works for the backend (service role), returning only the requested ids | live | Fails (no function) | Passes |
| Same file: recruiter `GET /api/jobs/applications` is 404 | live | Fails (200) | Passes |
| New `applicant-identity.test.mjs`, fake client: one RPC, zero `getUserById`; RPC error logged, blank email, no throw | offline | Fails (no module) | Passes |
| `migration-guards`: the new function is `security definer`, and revoked from the three roles | offline | Fails | Passes |

### (b) I-0029: malformed application id

**Verified:** `backend/Controllers/jobs.controller.js:258` checks presence only. The lookup at
`:269-273` raises 22P02, and `:275-278` returns 500.

**Fix:** move `UUID_RE` (`backend/Controllers/analysis.controller.js:203`) into a shared
`isUuid(value)` that also requires a string, because `String()` would accept `['<uuid>']`. Use it
at both places. Answer 400 with the `:213` shape: `invalid_application_id` and a message.

**Tests:** in `live-shortlist-authz`, ids `'not-a-uuid'`, `123`, `{}` and `['<valid uuid>']`
give 400, with the row unchanged and no notification. At HEAD: 500 for the first three, and the
array form reaches the update. The existing valid-but-missing case stays 404.

### (c) I-0027: 404 message

**Verified:** `backend/index.js:73` hardcodes `GET`.

**Fix:** `` `Cannot ${req.method} ${req.originalUrl}` ``.

**Test:** in `smoke.test.mjs`, `POST /api/t0001-no-such-route` gives
`Cannot POST /api/t0001-no-such-route`. Fails at HEAD (`Cannot GET …`).

### (d) I-0025: 10 MB upload cap

**Verified:**
- `backend/Controllers/analysis.controller.js:11` sets no limit. Two routes use it (`:261`,
  `:293`), and those are the only multer uses.
- The live bucket is `10485760`, the same as
  `supabase/migrations/20261104120000_resumes_bucket_limits.sql`.
- **Probed in a scratch script against this multer (2.1.1):**
  1. **No error handling.** `index.js` has none, so a limit error comes back as **500 with an
     HTML page**, not 413. `Upload.jsx`'s `res.json()` then fails with a parse error.
  2. **Off by one.** Busboy fires at `fileSize === limit`
     (`backend/node_modules/busboy/lib/types/multipart.js:476`), so a file of exactly the limit
     is refused. `limits.fileSize = N + 1` accepts N and refuses N + 1.

**Fix:**
- New `backend/Config/uploadLimits.js`: `MAX_RESUME_BYTES = 10 * 1024 * 1024`, the one constant.
- New `backend/Middlewares/resumeUpload.js`: multer with `fileSize: MAX_RESUME_BYTES + 1` and a
  comment saying why. `LIMIT_FILE_SIZE` gives 413 JSON (`Resume must be 10 MB or smaller.`),
  other multer errors give 400 JSON, and anything else goes to `next(err)`. Both routes use it.
- `getMyResumeStatus` adds `maxResumeBytes`.

**Tests:**
| Test | Tier | At HEAD | After |
|---|---|---|---|
| New `live-upload-gates.test.mjs`: 10 MB + 1 byte to `/api/resume/upload` and `/api/analyze` gives 413 JSON | live | Fails (400 / 400) | Passes |
| New `upload-limits.test.mjs`, small Express app: exactly 10485760 bytes accepted; 10485761 gives 413 JSON; wrong field name gives 400 JSON, never HTML | offline | Fails (no module) | Passes |
| Same file: the constant equals `file_size_limit` in the bucket migration | offline | Fails | Passes |
| `/api/resume/status` returns `maxResumeBytes` | live | Fails | Passes |

**No live bucket upload (owner, 2026-11-04).** No 10 MB upload to the shared production bucket: the
bucket half of the boundary is the offline test pinning the constant to the migration's
`file_size_limit`, and the multer boundary tests are the runtime half. The live 413 test above sends
an over-limit file that multer rejects, so it never reaches storage.

### (e) I-0065: stale GitHub text on rebuild

**Verified:** `backend/Services/explainability.js:776` keeps any stored entry. Live counts: 4
score rows, all `unavailable` with no `reason_code` and the "not part of this deployment" text,
created 2026-09-02 to 2026-10-14. So this is real data, not a speculative path.

**Fix (D3 = A):** treat a stored entry with `available === false` and no
`components.reason_code` as `githubUnavailable('not_collected_for_score')`. Update the comment at
`:90`.

**Tests:** in `explainability.test.mjs`, a stored pre-T-0014 entry (`components: null`, the old
reason) rebuilds to `not_collected_for_score`, with no "not part of this deployment". Fails at
HEAD. Controls that pass both ways: a real `service_disabled` with a reason code stays, and an
available entry stays.

Note: the replacement text says re-analysing would include GitHub, but nothing in the UI
navigates to `/candidate/processing`. It stays true at the API level, and T-0020 rebuilds this flow.

### (f) I-0062: assessment calls over `internalHttp`

**Verified:**
- Raw `fetch` at `backend/Controllers/assessment.controller.js:259` and `:422`.
- `:277` and `:435` return up to 500 characters of upstream body to the browser, the I-0036
  problem. `Assessment.jsx` does not read that `error` field.
- **assessment-service has no request-id handling at all,** so sending the header alone traces
  nothing.

**Fix:**
- New `backend/Services/assessmentService.js` on `postJson`, reading the URL per call. Timeouts
  stay 300 s (generate) and 120 s (evaluate).
- Move `resolveRequestId` from `backend/Controllers/analysis.controller.js:16-19` to
  `internalHttp.js`, and use it in both controllers.
- Errors: `timeout` and `unreachable` keep today's "unavailable" 502; `bad_status` keeps its
  502 message but drops the `error` body; `bad_body` becomes a 502 (it is a 500 today, through
  the outer catch).
- `assessment-service/app/main.py`: middleware that validates the id like github-evidence
  (`github-evidence/app/main.py:143-161`), logs it and echoes it.

**Tests:**
| Test | Tier | At HEAD | After |
|---|---|---|---|
| New `assessment-service-client.test.mjs`, stub server: `X-Request-ID` sent; a sentinel upstream body never appears in the error; one retry on connection error, none on timeout | offline | Fails (no module) | Passes |
| Same file: the controller has no `fetch` to the assessment URL | offline | Fails | Passes |
| New `tests/assessment/test_request_id.py`: a valid id is echoed, an invalid one replaced | offline | Fails (no header) | Passes |

### (g) I-0059: spaCy model by package name

**Verified:** `nlp-engine/app/ner.py:5-10` and `nlp-engine/app/preprocessor.py:7-12`. Run in the
venv: `spacy.load('en_core_web_sm')` works (spaCy 3.8.13, model 3.8.0), so the fallback is not
needed here.

**Fix:** in both files, delete `MODEL_PATH` and the `try`, and call
`spacy.load("en_core_web_sm")` directly. `import os` stays, because both files use it at `:595`
and `:53`. A missing model then stops the service at startup with spaCy's own error.

**Boundary:** in `ner.py` this edits only `:5-10`, above `SKILL_KEYWORDS` (`:12`). Everything from
there down belongs to P3-2 (Anurag). Do not touch the keyword lists.

**Test:** new `tests/nlp/test_model_load.py`, in a subprocess with `spacy.load` patched to record
its argument and raise `OSError`. Importing each module must raise, after exactly one call with
`en_core_web_sm`. Fails at HEAD (two calls, the second with the venv path).

### (h) I-0039: cruft

**Verified:**
- `bcrypt` is at `backend/package.json:17` and `backend/package-lock.json:167`, with no importer.
- `backend/Middlewares/authCand.Middleware.js`, `authRec.Middleware.js` and `dev/null` are
  tracked, 0 bytes, and unreferenced outside CODE_MAP.md (stale, I-0030).
- `backend/uploads/` is empty and git-ignored (`.gitignore:14`), so it is not a tracked change.

**Fix:** `npm uninstall bcrypt` in `backend/`. Delete the three tracked files, the local empty
folder and the ignore line. The issue stays OPEN for the OAuth vars.

**Test:** new `backend-cruft.test.mjs`: the three files are gone, and `bcrypt` is in neither
`package.json` nor the lock. Fails at HEAD.

### (i) I-0016: one-word name

**Verified:** `backend/Controllers/auth.controller.js:216` requires `lastName`, and
`frontend/src/pages/public/Login.jsx:107` sends one `name`. `profiles.last_name` is `not null`
with no check, and the trigger stores the metadata value as given, so `''` is valid. **No
migration.** But no row has an empty last name today (0 of 14), so that path has never run live.

**Fix:** drop `!lastName` from `:216`. New message: `Name, username, email, and password are
required.` Display code already trims or filters.

**Tests:**
- `smoke.test.mjs`: one-word name with a 5-character password gets the **password** message. This
  reaches the next check without creating a user or sending email. Fails at HEAD (generic
  message).
- `live-signup-role`: `auth.admin.createUser` with `last_name: ''` creates a profile with `''`.
  Passes before and after; it proves the database half, so it is a control rather than a red test.

### (j) I-0071: rejection notification

**Verified:** `tests/backend/live-shortlist-authz.test.mjs:106` expects 0, while
`backend/Controllers/jobs.controller.js:303-309` sends one. `notificationsFor` (`:73`) does not
select `message`, so it needs that column.

**Fix (D4):**
- The ownership lookup (`:269-273`) already joins `jobs`, so it adds the title: `job:jobs!inner(recruiter_id,
  title)`. No second round trip.
- `:303-309` sends `The recruiter has decided not to move forward with your application for
  <job title>.` with the data unchanged: `applicationId` and `jobId` only. `type` stays `rejected`.
- `notificationsFor` also selects `message`.

**Test:** in `live-shortlist-authz`, the control test expects exactly one notification with
`type: 'rejected'`, the exact string built from the fixture title
(`The recruiter has decided not to move forward with your application for [T-0001 TEST] harness job.`,
from `insertTestJob`), and `deepEqual(Object.keys(data).sort(), ['applicationId', 'jobId'])` with those
two values. The I-0019 checks stay as they are.

**Red and green:** the current test already fails (`1 !== 0`,
`tests/.out/t0029-after-full-backend.log`), and the new one fails at HEAD on the wording. The payload
assertion passes at HEAD, so temporarily add `score: 99` to the payload, confirm it fails, revert,
and record the output.

### (k) I-0072: `.txt` on every upload path

| Path | Gate | `.txt` result |
|---|---|---|
| `POST /api/resume/upload` | `backend/Controllers/analysis.controller.js:270-273` | Refused, 400 |
| **`POST /api/analyze`** | **None** (`:293-305`) | **Accepted: parsed, scored, saved** |
| Assessment on-demand parse | Reads stored files only | No upload |
| `Upload.jsx` | `:18-26` plus `accept` at `:299` | Refused, UI only |
| NLP `:8000/parse` directly | `nlp-engine/app/extractor.py:33-34` | Accepted, but not an app path; I-0034, P2-6 |

**Finding:** `/api/analyze` is a real gap, reachable by any signed-in candidate with a direct POST.
No UI page navigates there. The storage step at `:341-347` then fails softly, and the score is
still written with `file_ref` null. And `resolveContentType` (`:34-39`) falls back to the
client's declared type, so a `.txt` declared as `application/pdf` should pass the bucket's
allow-list. That last point comes from reading the code and was not run against the live bucket.

**Fix (owner's rule: close the path, do not widen the bucket):** apply the same extension gate in
`analyzeResume`, before any job lookup, through one shared helper. No bucket or migration change.

**Recording:** no file in `tests/nlp` uses `.txt`, so the branch is **unused**, not "test-only" as
ROADMAP (k) says. Nothing reaches it through core after the gate. Live data needs no cleanup: 0 of 6
`resumes` rows have another extension.

**Overlap:** this closes I-0034's analyze file-type half now, instead of at T-0020. The B4 table and
I-0034 are updated at close.

**Tests:** in `live-upload-gates.test.mjs`, `.txt` to `/api/analyze` gives 400, both plain and
declared as `application/pdf`, with no new `resumes` row. Fails at HEAD (200, on a tagged test job,
removed by the sweep). `.txt` to `/api/resume/upload` gives 400 (control, passes at HEAD).

### (l) I-0073: malformed `assessmentId`

**Verified:** `backend/Controllers/assessment.controller.js:360` checks only that it is a string. A
non-UUID reaches `:377`, and `:379-381` returns 500 with the database error text. Read from the code,
not yet run live.

**Fix:** use the shared `isUuid` from (b) at `:360` and answer 400 with
`invalid_assessment_id` and a message, the same shape as (b).

**Test:** in `live-evaluate-once`, `assessmentId: 'not-a-uuid'` gives 400, and the body contains no
database text. Fails at HEAD (500). A valid id that does not exist stays 404.

---

## Migration (D1)

One new file, `npx supabase migration new applicant_emails`, following
`Docs/SUPABASE_MIGRATIONS_RUNBOOK.md`, which gives it a 14-digit version. I write the file and run
the local step if Docker is available, then **stop before the push**. The owner runs every
`--linked` step.

1. `npx supabase db reset` on the local stack (the runbook's low-memory `-x` list on 8 GB). Never
   `--linked`.
2. `npx supabase db diff --linked` shows only `applicant_emails`.
3. `npx supabase db push --linked --dry-run` lists **only the new file**. Anything else: stop.
4. `npx supabase db push --linked`.
5. `npx supabase migration list --linked` is in sync, and `db diff --linked` prints
   `No schema changes found`.

Never the SQL editor, never `--include-all`, and no edits to the file after it is applied. Push
**before** running the new backend, or emails stay blank (logged, no crash). A fix or rollback is
a new migration that drops the function.

## Acceptance criteria

1. **(a)** `/api/recruiter/applicants` returns the Auth email for an applicant with a profile, with
   no `getUserById`, and the RPC is refused for anon and candidates — checked by:
   `live-applicants.test.mjs`, `applicant-identity.test.mjs`, `migration-guards`.
2. **(a, D2)** `GET /api/jobs/applications` is gone — checked by: `live-applicants.test.mjs`, and the
   grep over `frontend/`, `backend/` and `tests/` pasted into the Result.
3. **(b)** A malformed `applicationId` gives 400 with no change and no notification; a valid missing
   id stays 404 — checked by: `live-shortlist-authz.test.mjs`.
4. **(c)** The 404 message names the real method — checked by: `smoke.test.mjs`.
5. **(d)** Exactly 10 MB is accepted, one byte more gives 413 JSON on both routes, and the one
   constant equals the bucket migration — checked by: `upload-limits.test.mjs`,
   `live-upload-gates.test.mjs`.
6. **(e)** A pre-T-0014 row rebuilds to `not_collected_for_score` — checked by:
   `explainability.test.mjs`.
7. **(f)** Both assessment calls go through `postJson` with a request id, the service echoes it, and
   no upstream body reaches the client — checked by: `assessment-service-client.test.mjs`,
   `test_request_id.py`.
8. **(g)** The model loads by name only and a missing model stops startup — checked by:
   `test_model_load.py`.
9. **(h)** The cruft is gone, and I-0039 stays OPEN for the OAuth vars — checked by:
   `backend-cruft.test.mjs`.
10. **(i)** A one-word name passes validation and the database accepts `''` — checked by:
    `smoke.test.mjs`, `live-signup-role.test.mjs`.
11. **(j)** A reject sends one `rejected` notification with the exact D4 text including the job title,
    with only `applicationId` and `jobId`, and no extra query — checked by:
    `live-shortlist-authz.test.mjs`, the recorded mutation run, and reading the diff at `:269-273`.
12. **(k)** No core upload route accepts `.txt`, and the bucket is unchanged — checked by:
    `live-upload-gates.test.mjs`; `git diff` shows no bucket migration.
13. **Migration, if any** — checked by: owner's runbook output, ending in `No schema changes found`.
14. **Trackers** — checked by: `node tests/docs/check-trackers.mjs` with 0 warnings. AUDIT cites
    re-pointed; AUDIT 5.15 and `tests/MANUAL_SMOKE.md:64` corrected; ROADMAP (k) wording fixed.
15. **Manual (owner):** as `t0001_recr`, `/recruiter/candidates` shows real emails instead of "No
    contact info" (needs a look at the page).
16. **(l)** A malformed `assessmentId` gives 400 with no database text, and a valid missing id stays
    404 — checked by: `live-evaluate-once.test.mjs`.

## Test plan

- **Execution order:**
  1. Write every test. Run them at HEAD and save the output to `tests/.out/t0031-before-*.log`. Any
     test that does not fail as predicted is reported before fixing.
  2. Apply the fixes one letter at a time, in small groups.
  3. Migration (owner), if D1 stands.
  4. Run everything. Save to `tests/.out/t0031-after-*.log`.
- **Add to `tests/run-suite.ps1`:** `upload-limits`, `applicant-identity`,
  `assessment-service-client`, `backend-cruft` (offline); `live-applicants`, `live-upload-gates`
  (`-Live`).
- **Tests in this spec that cannot go red at HEAD:** I-0071's payload assertion and I-0016's database
  control. Both are explained above.
- **Weak red:** "fails (no module)" only shows the file is absent. Each of those fixes also has a
  behaviour test at the live or smoke tier, except I-0062, which relies on the stub tests and the
  static `fetch` check.

## Regression

- `tests/run-suite.ps1 -Target current -Suites nlp,backend,docs,github,assessment -Live`. T-0030's
  baseline: 114/116, with I-0071 the known failure and one release-test skip; I-0071 must now pass.
- `live-analyze`, `live-analyze-github`, `live-analysis-isolation` and `tests/arch/nlp-outage-probe`
  all upload PDFs, so the new gate does not touch them.
- `live-resume-authz` (it shares `UUID_RE`), `live-evaluate-once`, `live-evaluate-release`.
- Frontend is unchanged, so no frontend suite is needed.

## Risks and rollback

- **`applicant_emails` exposes emails if the revoke is wrong.** Guarded twice: static and live anon
  and candidate refusal. Rollback: a new migration that drops it.
- **`postJson` retries on `ECONNRESET` and socket hang-up.** A connection dropped mid-generation
  could repeat a slow LLM call. It stays inside the same 300 s budget, and generation has no side
  effect before core stores it.
- **Candidates lose the `error` detail on a failed assessment.** It was the upstream body, and the UI
  does not show it.
- **Deleting `GET /api/jobs/applications`** breaks any caller outside this repo. None is known.
- **`bcrypt` removal changes the lockfile.** Review the diff: only bcrypt and packages only it needs
  should go.
- **Rollback:** every code fix reverts by commit. The owner chooses commit boundaries; suggested
  groups are (c)(i)(j), (b)(k), (d), (a) + migration, (e), (f), (g), (h).

---

## Result

Filled 2026-11-04 and updated after the owner's migration push. All 16 criteria PASS. Nothing is
committed. Every `--linked` command was the owner's.

Logs are in `tests/.out/`: before: `t0031-before-{offline,live,nlp,assessment}.log`; after:
`t0031-after-{backend-prepush,nlp,github,assessment,release}.log`; `t0031-j-mutation.log`;
`t0031-local-{start,reset,roles}.log`.

| # | Verdict | Evidence |
|---|---|---|
| 1 | **PASS** | `live-applicants` 5/5 against the shared project after the push (`t0031-final-current-backend-tests.log`): the applicants endpoint returns the Auth email; anon gets 42501 and a signed-in candidate 403 with 42501; the service role gets only `(id, email)` for the existing requested id. `applicant-identity` 5/5 (one RPC, zero `getUserById`, RPC error logged, blank email, no throw); `migration-guards` new test. Before the push these failed with `PGRST202`. Local replay: `proacl` = `{postgres=X/postgres,service_role=X/postgres}` (`t0031-local-roles.log`) |
| 2 | **PASS** | `live-applicants` "D2" 404 (red at HEAD: 200). Grep below |
| 3 | **PASS** | `live-shortlist-authz` "I-0029" ×4. At HEAD: 500, 500, 500, and the array form **changed the row and sent a notification** (`{"http":200,"row":"shortlisted","notifications":1}`). Valid missing id stays 404 |
| 4 | **PASS** | `smoke` "I-0027" (red at HEAD: `Cannot GET …`) |
| 5 | **PASS** | `upload-limits` 4/4 with real 10485760 and 10485761 byte bodies; `live-upload-gates` 413 JSON on both routes; constant equals the migration. See deviation 2 |
| 6 | **PASS** | `explainability` "I-0065" (red at HEAD), control passes both ways |
| 7 | **PASS** | `assessment-service-client` 10/10, `test_request_id.py` 7/7. In the logs: `[assessment] evaluate failed: request_id=… kind=unreachable`, and `assessment_service request request_id=…` on the service side. Stopped service: `live-evaluate-release` 1/1 on the new client |
| 8 | **PASS** | `test_model_load.py` 2/2 (red at HEAD: two calls, the second with the venv path). A fresh parse of every fixture is byte-identical to `tests/nlp/snapshots/current/` (written to a temporary label, diffed, deleted; `current` untouched) |
| 9 | **PASS** | `backend-cruft` 4/4. All three files were 0 bytes before deletion; `backend/uploads/` was empty. The lockfile lost only `bcrypt`, `node-addon-api` and `node-gyp-build`. I-0039 stays OPEN for the OAuth vars |
| 10 | **PASS** | `smoke` "I-0016" reaches the password rule (red at HEAD); `live-signup-role` "an empty last name" passes (control, both ways) |
| 11 | **PASS** | `live-shortlist-authz` control test. Mutation: `score: 99` in the payload gives `actual: [ 'applicationId', 'jobId', 'score' ]`, 1 fail (`t0031-j-mutation.log`), reverted. Diff: the title is added to the select at `backend/Controllers/jobs.controller.js:198`, no new query |
| 12 | **PASS** | `live-upload-gates`: `.txt` 400 on both routes, plain and declared as PDF, no new `resumes` row. At HEAD both analyze cases gave 200 and a row. `git status`: no bucket migration |
| 13 | **PASS** | Owner's runbook output, 2026-11-04: dry run listed only `20261104120300_applicant_emails.sql`; `Applying migration 20261104120300_applicant_emails.sql...`, `Finished supabase db push.`; `migration list --linked` 17 of 17 in sync; final `db diff --linked`: `No schema changes found`. The pre-push diff printed `DROP FUNCTION "public"."applicant_emails"(uuid[])`, not the create I predicted: it named only this object, in the opposite direction, and the post-push diff settles it |
| 14 | **PASS** | `check-trackers` 0 warnings. 168 cites re-pointed by a line map from the diff, because the checker only catches cites past end of file. 21 cites on deleted code rewritten by hand. AUDIT 5.15 and `tests/MANUAL_SMOKE.md:64` corrected, ROADMAP (k) reworded |
| 15 | **PASS** | Checked by me in headless Chrome, not by the owner's own eye: signed in through the real login form as `t0001_recr`, opened `/recruiter/candidates` with one seeded application (`t0031-final-page.json`, screenshot reviewed). The page shows `T0001 Candidate`, the Auth email, the tagged job, and no "No contact info". `/api/recruiter/applicants` answered 200 then 304. The console had two 401s; neither was that call. Data swept afterwards |
| 16 | **PASS** | `live-evaluate-once` "I-0073" (red at HEAD: 500); valid missing id 404 |

**D2 grep.** At HEAD (`git grep -nE "getAllApplications|/api/jobs/applications([^/]|$)" HEAD -- frontend/src frontend/public backend tests`):
```
backend/Controllers/jobs.controller.js:178:export const getAllApplications = async (req, res) => {
backend/Routes/jobs.routes.js:10:  getAllApplications,
backend/Routes/jobs.routes.js:19:router.get('/applications', requireRole('RECRUITER'), getAllApplications);
tests/MANUAL_SMOKE.md:64:| B6 | ... `/api/jobs/applications`). No applicant ...
```
The definition, its route and one manual-smoke note: no caller. Now (`grep -rnE` over the same paths):
```
tests/backend/live-applicants.test.mjs:101:test('D2: recruiter GET /api/jobs/applications is 404', ...
tests/backend/live-applicants.test.mjs:102:  const r = await api(cookieR, 'GET', '/api/jobs/applications');
```

**Regression, before the push (superseded by Final verification).**

| Suite | Result |
|---|---|
| Backend, offline + live | 171 tests: 166 pass, 1 skip (release test, service up), **4 fail**, all `applicant_emails` (criterion 1). I-0071, the known T-0030 failure, passes |
| `live-evaluate-release` | 1/1 with the assessment service stopped |
| NLP | 14/14 |
| github | 80/80 |
| assessment | 12/12 |
| docs | 0 problems, 0 warnings |
| `tests/arch/nlp-outage-probe.mjs` | Not run at this point; see Final verification |

**Clean run, after the push (these numbers replace every earlier run).** Preflight by real
connects: 5000, 8000, 8001, 8002 and 3000 all closed. `tests/run-suite.ps1` started its own backend,
shown by the process that owned :5000:

| Pass | Backend on :5000 | Parent (`run-suite.ps1`) | Port errors |
|---|---|---|---|
| 1: full suite, :8002 down | PID 21120, `node.exe index.js`, started 20:24:56 | PID 22144 | 0 |
| 2: backend suite, :8002 up (current code, started and stopped by me) | PID 17248, `node.exe index.js`, started 20:29:54 | PID 20544 | 0 |

| Suite | Pass 1, :8002 down | Pass 2, :8002 up |
|---|---|---|
| backend, 171 tests, before the I-0079 test | 166 pass, 0 fail, 5 skip | 170 pass, 0 fail, 1 skip |
| **backend, 172 tests, final (below)** | **167 pass, 0 fail, 5 skip** | **171 pass, 0 fail, 1 skip** |
| nlp | 14/14 | not in this pass |
| github | 80/80 | not in this pass |
| assessment | 12/12 | not in this pass |
| docs | 0 warnings | not in this pass |
| frontend | **exit 1:** the 9 lint warnings of I-0068, CI warnings as errors; `frontend/` unchanged | not in this pass |
| `node tests/arch/nlp-outage-probe.mjs`, the real script | exit 0, every P-4..P-6 assertion PASS | not in this pass |

Each skip is covered by the other pass: the 5 in pass 1 need :8002 up, and the 1 in pass 2 needs it
down. So all 171 backend tests passed on a backend the suite started. P-1..P-3 are descriptive and show
the known I-0036 behaviour. `git status` is clean on `tests/nlp/snapshots`, `tests/arch` and
`frontend`. Logs: `t0031-clean-*.log`, `t0031-clean2-*.log`.

The monitor reported no :5000 owner from 20:25:33 in pass 1. That was a gap in
`Get-NetTCPConnection`, not an outage: the backend's own log has 88 `[API]` lines, the last at
20:26:38, and it logged no port error.

**Final backend run, after the I-0079 test (`-Suites backend -Live`).** Only that test file changed
since the run above, so the other suites and the probe were not rerun. Preflight closed on 5000,
8000, 8001 and 8002 both times, and there were 0 port errors.

| Pass | Backend on :5000 | Parent (`run-suite.ps1`) | Result |
|---|---|---|---|
| :8002 down | PID 7200, started 21:24:13 | PID 21600 | 172 tests: 167 pass, 0 fail, 5 skip |
| :8002 up | PID 21300, started 21:30:42, listener confirmed with `netstat -ano` | PID 20796 | 172 tests: 171 pass, 0 fail, 1 skip |

The skips are the same as before, each covered by the other pass, so all 172 passed on a backend the
suite started. The :8002-up pass ran twice with the same counts: the first time my monitor caught
only `pid=0`, which proves nothing, so I reran it and matched the backend by its parent process.
Logs: `t0031-third-*`.

**I-0079 proof:** the test passed 6/6 on real code. With the recruiter filter removed at
`analysis.controller.js:538`, it failed: R got 8 rows, 7 of them someone else's. Restored, the
sha256 is identical (`432e63fc…`) and it passes 6/6. Log: `t0031-i0079-mutation.log`, which has no
email in it. Two earlier attempts stopped on my script's anchor before changing the file.

**Superseded:** the first post-push run went through the owner's `npm start`, not the suite's backend,
and the first probe run used a scratchpad copy. Both are replaced by the table above. Their
logs (`t0031-final-*`) stay for the record. That collision is why I-0077 exists.

**Review answers, 2026-11-04:**
- **Applicants scoping:** by session, not by a 403. It had no real test; it does now (I-0079, resolved).
- **Over-limit tests:** the red came from `assert413`, which expects status 413. The test table now
  says `Fails (400 / 400)`, changed at the owner's request after review. Criterion 5 never changed.
- **`.txt` declared as PDF:** fixed by the filename extension alone, not the declared Content-Type and
  not magic bytes (I-0078).
- **Storage `contentType`:** set on the server, so nothing changed. Both uploads
  (`analysis.controller.js:162`, `:343`) use `resolveContentType`, which returns `MIME_BY_EXT[ext]` at
  `:35`. The gate requires that same lookup with the same lowercasing (`:31`, `:34`), so the
  client-mimetype fallback at `:36` cannot be reached. No test asserts the stored type.

**Deviations from the spec:**
1. **Migration version set by hand: `20261104120300`,** not from `npx supabase migration new`. The
   clock was 11:0x UTC, so the CLI would have produced a version older than the applied
   `20261104120200`, and `db push` would then ask for `--include-all`, which the runbook forbids.
2. **The live over-limit tests go red at HEAD with 400/400, not the 500/400 this spec first said.**
   The explanation for that 500, a 10 MB body refused by the production bucket at HEAD, is inferred
   from the code, not observed: sending one is what the owner ruled out. So each case stops before
   storage even if the cap regresses: the upload case is named `.txt` and the analyze case has no
   `jobId`. Both still assert 413 after the fix. The test table was corrected to 400/400.
3. **The pre-push regression ran on my own ports (5050/8050/8052),** because two orphaned T-0030
   listeners held :5000 and :8002. The owner stopped them; the clean run above is on default ports.
4. **Added beyond the spec:** `assessmentFailure` in `assessmentService.js`, so the "no upstream
   body" rule has a direct offline test; and `backend/Services/validation.js` as the home of `isUuid`.

**Found:**
- **Confirmed by running it:** a `.txt` declared as PDF got through the bucket's allow-list at HEAD.
  The spec had this from reading the code. Only the plain `.txt` logged `InvalidMimeType`.
- **I-0076 (new, P3, P2-1):** a multipart body busboy cannot parse gives 500 HTML. As the spec says,
  it goes to `next(err)`, so I logged it instead of changing that.
- **I-0077 (new, P2, P2-6):** `run-suite.ps1` silently tests whatever already answers on :5000.
- **I-0078 (new, P2, P2-3):** the upload gate reads the extension only.
- **I-0079 (new, resolved here):** no real test of cross-recruiter applicants isolation.
- **Local stack:** the first `supabase start` failed with `supabase_storage_Patina container is not
  ready: unhealthy` while NLP and the backend were running, and worked once they were stopped.

**Suggested commit groups:** as in Risks, (c)(i)(j), (b)(k), (d), (a) + migration, (e), (f), (g), (h),
then trackers. `isUuid` belongs with (b), and (l) goes with (b) because it needs `isUuid`. The I-0079
test is in `tests/backend/live-applicants.test.mjs`, so it goes with (a) + migration. I-0079's entry in
`ISSUES.md` and this file go in trackers. No code changed for I-0079 or `contentType`.
