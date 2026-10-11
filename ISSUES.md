# Issues

**Purpose:** a record of problems found during a session that were **not**
that session's task. Nothing gets fixed silently out of scope — if you spot
something wrong while working on something else, it goes here, not into the
diff you're already writing.

**Rules:**
- Severity: **P0** = blocks demo or security, **P1** = wrong behaviour,
  **P2** = tech debt, **P3** = cosmetic.
- Status: `OPEN` / `IN-PROGRESS T-NNNN` / `RESOLVED T-NNNN + evidence` /
  `WONTFIX + reason`.
- Resolved entries move to the **Resolved** section at the bottom — never
  deleted.
- `RESOLVED` requires evidence (file:line, command output, commit). If an
  entry can't be re-checked against current code, leave it `OPEN` and write
  "not re-verified" rather than guessing.

---

## Open

| ID | Title | Module | Severity | Status | Found |
|----|-------|--------|----------|--------|-------|
| I-0001 | `resumes` storage bucket not in any migration | `supabase/migrations/`, `backend/Controllers/analysis.controller.js` | P1 | OPEN | 2026-08-31, pre-WORKLOG |
| I-0004 | AI-cruft / hallucinated entries in `SKILL_KEYWORDS` | `nlp-engine/app/ner.py` | P3 | OPEN | pre-WORKLOG (after an NLP fix, exact date not recorded) |
| I-0005 | `Assessment.jsx` unrouted, no backend, silently serves mock data | `frontend/src/pages/candidate/Assessment.jsx` | P1 | OPEN | pre-WORKLOG (after an NLP fix, exact date not recorded) |
| I-0006 | Upload.jsx: neither Choose-File nor drag-drop validates file type on selection, only at submit | `frontend/src/pages/candidate/Upload.jsx` | P2 | OPEN | 2026-10-12, L-0001 |
| I-0007 | `scores` table referenced by backend code but not created in any migration | `supabase/migrations/`, `backend/Controllers/analysis.controller.js` | P1 | OPEN | 2026-10-12, L-0001 |
| I-0008 | `Docs/IMPLEMENTATION-TRACKER.md` Firestore/MongoDB sections are stale doc drift | `Docs/IMPLEMENTATION-TRACKER.md` | P2 | OPEN | 2026-10-12, L-0001 |

---

### I-0001 — `resumes` storage bucket not in any migration
**Status:** OPEN
**Severity:** P1
**Module:** `supabase/migrations/`, `backend/Controllers/analysis.controller.js`, `backend/Controllers/jobs.controller.js`
**Spec ref:** n/a (infra/deployment gap, not a feature spec item)
**Evidence:**
- The `resumes` storage bucket was created manually in the Supabase dashboard
  (2026-08-31) with an `allowed_mime_types` allow-list. It is not defined in
  any file under `supabase/migrations/` (confirmed current migrations:
  `20260823_create_profiles.sql`, `20260830_create_jobs_and_applications.sql`,
  `20260831_add_single_admin_role.sql`, `20260901_add_profile_suspension.sql`,
  `20260903_create_notifications.sql` — none create a storage bucket).
- `backend/Controllers/analysis.controller.js:14,24,38,60` and
  `backend/Controllers/jobs.controller.js:94` do `.from('resumes')` against
  Supabase Storage, so the app depends on a bucket that only exists because
  someone created it by hand.
**Impact:** A fresh environment (new Supabase project, teammate's local
setup, CI) will not have the bucket and resume upload/retrieval will fail
with no migration to explain why.
**Proposed fix:** Move bucket creation + MIME allow-list config into a
migration (Supabase supports this via `storage.buckets` inserts or the
management API in a migration script).

---

### I-0004 — AI-cruft / hallucinated entries in `SKILL_KEYWORDS`
**Status:** OPEN
**Severity:** P3
**Module:** `nlp-engine/app/ner.py` (lines 6-54, `SKILL_KEYWORDS`)
**Spec ref:** n/a (data-quality cleanup, not a feature)
**Evidence:**
- `ner.py:53` — `"typescript", "exponentjs",` — "exponentjs" is not a real
  library/package; likely a hallucinated/garbled entry (both "expo" and
  "express" are already separately listed at lines 39 and 13).
- Other odd entries noticed nearby: `"r language"` (line 10, unusual phrasing
  vs. just `"r"`), `"mern stack"` (line 28) duplicated again as
  `"mern concepts"` in the same file's `non_organisation_terms` set (line
  122).
**Impact:** Low — these are unlikely to match real resume text, so the
practical scoring effect is small, but it's noise in a keyword list that
should be an auditable source of truth for skill matching.
**Proposed fix:** Audit `SKILL_KEYWORDS` for fabricated/duplicate entries and
remove them.

---

### I-0005 — `Assessment.jsx` unrouted, no backend, silently serves mock data
**Status:** OPEN
**Severity:** P1
**Module:** `frontend/src/pages/candidate/Assessment.jsx`; no
`backend/Routes/assessment.routes.js` exists
**Spec ref:** Docs/IMPLEMENTATION-TRACKER.md §"Generative AI Assessment
Engine" (item 3) and §"Candidate Assessment UI" (item 8) — already tracked
there as a missing feature, not newly discovered.
**Evidence:**
- `frontend/src/App.jsx` has zero reference to `Assessment` — no route
  mounts it (grep for "Assessment" returns nothing).
- `backend/index.js:44-55` mounts only `auth`, `jobs`, `analysis` (`/api`),
  `parse`, `admin`, `notifications` — no assessment route exists.
- `Assessment.jsx:61` calls `fetch('http://localhost:5000/api/assessment/generate')`
  and `:104` calls `POST /api/assessment/evaluate`; both 404 against this
  backend and the component silently falls back to `MOCK_QUESTIONS`.
- The only other "assessment" hits in the backend are an unrelated comment
  (`analysis.controller.js:189`) and an unpopulated Mongoose schema field
  (`Models/Application.Model.js:49,83`).
**Impact:** The component is dead code from the app's perspective (no route
reaches it), and if it were ever wired up, it would quietly show mocked
questions/results as if they were real — a risk if this is ever used in a
live demo without that being noticed.
**Proposed fix:** Tracked at the tracker level (items 3 and 8). No fix here
— this entry exists so the silent-mock-fallback risk is visible outside the
tracker's checklist framing.

---

### I-0006 — Upload.jsx: neither path validates file type until submit
**Status:** OPEN
**Severity:** P2
**Module:** `frontend/src/pages/candidate/Upload.jsx` (lines 129-147)
**Spec ref:** n/a (regression found while re-verifying I-0003, below)
**Evidence:** `handleDrop` (129-134) and `handleFileChange` (136-139) both
just call `setFile(...)` with no validation. Type checking only happens
later, inside `handleUpload` via `isResumeFile(file)` (18-26, invoked at
144) — applied identically regardless of which path supplied the file.
**Impact:** Low-moderate — an invalid file can sit in the UI as "selected"
before being rejected at submit time, which is a UX gap but not a security
issue (validation does still happen before any upload call is made).
**Proposed fix:** Call `isResumeFile` immediately in both `handleDrop` and
`handleFileChange` and reject/clear invalid files at selection time.
**Note:** this supersedes the old entry about this file (see
[Resolved I-0002/I-0003](#i-0002--skillsselector-hardcoded-never-wired-resolved)) —
`Upload.jsx` was rewritten (commit `71c632d`, 2026-09-03) into a different
flow where the original asymmetric-validation bug no longer exists, but this
new, related gap was found in its place.

---

### I-0007 — `scores` table referenced by backend but not in any migration
**Status:** OPEN
**Severity:** P1
**Module:** `supabase/migrations/`, `backend/Controllers/analysis.controller.js`
**Spec ref:** Docs/IMPLEMENTATION-TRACKER.md's `credibility_scores`
collection (see [I-0008](#i-0008--docsimplementation-trackermd-firestoremongodb-sections-are-stale-doc-drift))
— this `scores` table appears to be the actual, undocumented
implementation of that concept.
**Evidence:** `analysis.controller.js:301-306,391` queries
`supabase.from('scores').select('composite_score')...` keyed by
`candidate_id`/`job_id`. No file under `supabase/migrations/` creates a
`scores` table — same pattern as [I-0001](#i-0001--resumes-storage-bucket-not-in-any-migration).
**Impact:** Same as I-0001: a fresh environment will not have this table,
and every credibility-score read/write will fail silently or error.
**Proposed fix:** Add a migration for `scores` (columns at minimum:
`candidate_id`, `job_id`, `composite_score`, timestamps).

---

### I-0008 — `Docs/IMPLEMENTATION-TRACKER.md` Firestore/MongoDB sections are stale doc drift
**Status:** OPEN
**Severity:** P2
**Module:** `Docs/IMPLEMENTATION-TRACKER.md`
**Spec ref:** n/a (documentation accuracy, not a feature)
**Evidence (verified 2026-10-12 per user request before filing):**
- Repo-wide case-insensitive grep for `firebase|firestore` across all
  `.js/.jsx/.json/.py/.env*/.txt/.md` files (excluding `node_modules`,
  `venv`, `.git`) found **zero** Firebase/Firestore dependencies or
  integration code anywhere. The only hit outside the tracker doc itself is
  `nlp-engine/app/ner.py:19`, where `"firebase"` is just a generic string in
  the `SKILL_KEYWORDS` list (for matching it on resumes) — not a project
  dependency.
- `git log -S "Firestore" -- Docs/IMPLEMENTATION-TRACKER.md` resolves to a
  single commit, `ad4f694` ("merge: integrate Aaron, Anthony, and
  aditya-ui-work into main") — a merge commit. The file has no prior history
  on either merge parent in this branch's log, so the exact original
  authoring commit isn't resolvable from current history; it entered `main`
  as part of that three-way branch integration.
- Per CLAUDE.md, Supabase is the authoritative DB (the SRS originally
  specified MongoDB; Supabase was the actual implementation choice) — so the
  tracker's "Database (Document): Firebase Firestore" row and the
  MongoDB-to-Supabase-"+Firestore" migration section (lines 17, 60-118,
  165-169, 180-182, 249) describe a plan that was never implemented and
  isn't the current direction.
- Cross-check of the Firestore collections the tracker names against actual
  Supabase tables (`supabase/migrations/*.sql`):
  | Tracker concept | Actual Supabase equivalent |
  |---|---|
  | `users` | `auth.users` (Supabase Auth) + `public.profiles` |
  | `audit_logs` | **missing** — no migration |
  | `job_descriptions` | `public.jobs` (relational, not document — same data shape, different storage model) |
  | `parsed_profiles` | **missing** — no table for NLP output (skills/experience/education/projects/noun_chunks/similarity_score) |
  | `github_metrics` | **missing** |
  | `assessments` | **missing** (`public.applications` has a status enum only, no assessment data; see I-0005) |
  | `credibility_scores` | partially exists as an undocumented `public.scores` table — see [I-0007](#i-0007--scores-table-referenced-by-backend-but-not-in-any-migration) |
**Impact:** Low direct runtime impact (no code depends on this doc), but it
risks misleading anyone writing a task spec who cites this section as the
current DB plan, and it's the apparent source of the `credibility_scores`
naming that doesn't match the real `scores` table.
**Proposed fix:** Out of scope for this session (documentation-only setup
task, not a tracker reconciliation). Leave the tracker as-is until a
dedicated tracker-reconciliation task; this entry exists so the drift is
visible before anyone cites that section as current.

---

## Resolved

### I-0002 — SkillsSelector hardcoded, never wired (RESOLVED)
**Status:** RESOLVED — superseded by rewrite, no T- ref (code changed before
this tracking system existed)
**Severity (at time of finding):** P2
**Module:** `frontend/src/pages/candidate/Upload.jsx`
**Original entry:** "SkillsSelector in Upload.jsx — hardcoded 'Suggested
Skills' chips, never wired (selectedSkills/onToggle props never passed)."
**Evidence of resolution:** Current `Upload.jsx` (402 lines, as of this
session) contains no `SkillsSelector`, no "Suggested Skills" chips, and no
job `<select>` or "Analyze Resume" button at all — the file was rewritten in
commit `71c632d` (2026-09-03) into a direct single-resume-upload flow
(`POST /api/resume/upload`, `GET /api/resume/status`). The component this
issue described no longer exists.
**Note:** `CODE_MAP.md:385,535,572` still describes the old version of this
file and is itself now stale — not fixed here (out of scope for this
session; flagging only).

### I-0003 — Upload.jsx "Choose File" path didn't validate file type (RESOLVED)
**Status:** RESOLVED — superseded by rewrite; see
[I-0006](#i-0006--uploadjsx-neither-path-validates-file-type-until-submit)
for the current (different) gap in the same file
**Severity (at time of finding):** P1
**Module:** `frontend/src/pages/candidate/Upload.jsx`
**Original entry:** "Upload.jsx 'Choose File' path still doesn't validate
file type (drag-drop does)."
**Evidence of resolution:** The file was rewritten in commit `71c632d`
(2026-09-03). The asymmetry described — drag-drop validating while
Choose-File didn't — no longer exists in the current code: both paths now
behave identically (neither validates at selection, both validate only at
submit via `isResumeFile`). See I-0006 for that current behavior, which is a
different bug, not this one.
