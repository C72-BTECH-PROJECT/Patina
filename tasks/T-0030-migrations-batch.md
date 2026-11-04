# T-0030 — migrations-batch (B2: I-0057, I-0010, I-0001, I-0041)

**Status:** DONE 2026-11-04 (`68763e0`; trackers uncommitted). Approved 2026-11-04 with five owner changes:
1. a fresh replay plus `db diff --linked` instead of guards and a double replay;
2. rename targets are decided per file after Phase B;
3. the CLI is installed as an npm devDependency;
4. D2: 5 MB, MIME types as live;
5. the dry-run gate is kept.

Phase A and Phase B are next (owner).

## Context
Read-only, 2026-11-04, at `edb1a37`.

- **No CLI project:** `supabase/` holds only `migrations/`. There is no `config.toml` or
  `.temp/`, and the CLI is not installed.
- **The root has no `package.json`.** There is a stray 91-byte `package-lock.json` with
  `packages: {}`, last touched by `7b6dd3d`. `npm i -D` creates `package.json` and fills
  the lock. Root `node_modules/` is git-ignored (`.gitignore:1`).
- **Docker:** installed (29.8.2), but the daemon is not running. Phase C needs it for the
  local stack and for `db diff`.
- **The Preview check still fails.** `gh api .../commits/edb1a37/check-runs`:
  `Supabase Preview | completed | failure`, summary `Remote migration versions not found in
  local migrations directory.` The project is `zzgymrxrwuuffyrbhify`.
- **Drift runs both ways:**
  - **Remote-only:** `20261015_allow_five_assessment_attempts.sql:2` says it was "Applied to
    the project via migration 'allow_five_assessment_attempts'", so it is probably recorded
    under its own remote timestamp. `create_assessments` probably is too (WORKLOG L-0035,
    L-0037).
  - **Local-only:** the four T-0029 versions (`20261103120000`..`120300`) were applied in
    the SQL editor, so they have no history row. The 2026-08/09 files say "Apply in the
    Supabase SQL Editor", so they probably have none either.
- **Duplicate versions (I-0057):** `20260903` (×2) and `20261015` (×2). In sorted order,
  allow-five comes before the create it depends on.
- **Bucket (I-0001):** `20260903_create_resumes_and_scores.sql:14-16` inserts `resumes`
  (private, `on conflict do nothing`). No migration sets `allowed_mime_types` or
  `file_size_limit`.
  - **Live `allowed_mime_types`:** pdf + docx, read on 2026-10-12. The exact array is
    recorded from B4 under "Recorded values" before C3 is written.
  - **Live size limit:** not known. I-0025's evidence says "the storage bucket enforces
    10 MB", which B4 confirms or refutes.
- **Stale comment (I-0041):** `20260903_create_resumes_and_scores.sql:48-53` describes
  `github_evidence` and `assessment_results` as `null`. The code stores full sub-score
  objects instead.

## Goal
Make the remote migration history match `supabase/migrations/` exactly, with unique 14-digit
versions, and show that the files rebuild the live schema: a fresh local replay with an
empty `db diff --linked`. The `resumes` bucket limits and the `scores.subscores`
description move into migrations.

## Spec ref
n/a (infrastructure). ROADMAP P0-2; AUDIT 0.2 (STUBBED_OR_PARTIAL); issues I-0057, I-0010,
I-0001 and I-0041.

## Scope
**In:**
- the CLI as a root devDependency, plus its init and link;
- a read-only drift report;
- renaming all eight 8-digit files;
- a fresh local replay and `db diff --linked`;
- a new migration, or an ISSUES entry, for each difference;
- the bucket and comment migrations;
- the history repair and the first `db push` (owner);
- `tests/backend/migration-guards.test.mjs` (extended);
- `Docs/SUPABASE_MIGRATIONS_RUNBOOK.md` (new);
- the trackers.

**Out:**
- **editing what an applied file says.** A file is only renamed, or guarded if it fails
  the fresh replay (see C2);
- the backend upload cap (I-0025, B3: multer 5 MB, see D2);
- I-0071 (B3);
- turning production auto-deploy back on.

## Rules for this task
- **Every command that writes to the remote project, or uses its credentials, is an owner
  step**, written below with the exact command and the expected output:
  - `link`;
  - `migration repair`;
  - `db push`;
  - `db diff --linked` (it reads with your password);
  - the dashboard.

  I run nothing against the remote.
- **All CLI commands are `npx supabase …`**, from the repo root. That uses the pinned
  devDependency.
- **Never** `db push --include-all`, and never `db reset --linked`.
- **No `db push` without a dry run** that lists exactly the three new B2 files (the bucket
  limits, the comment, and the function re-create; owner choice A, 2026-11-04).
  - If an old file were pushed to production, `20260823`'s `create or replace function
    public.handle_new_user()` would undo the T-0029 role fix.
  - Its `create policy` statements could overwrite policies edited by hand.
- **`migration repair` changes only `supabase_migrations.schema_migrations`.**
  `--status reverted` deletes a history row; it undoes no DDL.

---

## Phase A: CLI setup (owner; local files and credentials, no schema change)
A1. **Install and pin the CLI.**
- The version is `2.122.1`, a patch on 2.122.0 (2026-10-23).
- I skipped `3.0.0`: it is a new major version, released 2026-11-02.
```powershell
npm i -D --save-exact supabase@2.122.1
npx supabase --version
```
Expected:
- npm creates `package.json` with `"devDependencies": { "supabase": "2.122.1" }` and
  updates `package-lock.json`;
- the package's postinstall downloads the CLI binary;
- `npx supabase --version` prints `2.122.1`.

A2. **Init** (local files only):
```powershell
npx supabase init
```
- Answer **N** to the VS Code and IntelliJ Deno prompts.
- Expected: `Finished supabase init.`
- It creates `supabase/config.toml` and `supabase/.gitignore` (`.branches`, `.temp`).
- `supabase/migrations/` is unchanged.

A3. **Log in.** The token is stored in your user profile, not in the repo:
```powershell
npx supabase login
```
Expected: `You are now logged in. Happy coding!`

A4. **Link.** It asks for the database password and writes `supabase/.temp/`:
```powershell
npx supabase link --project-ref zzgymrxrwuuffyrbhify
```
- Expected: `Finished supabase link.`
- If it prints a local/remote config diff, paste it; it is not applied.

## Phase B: read-only drift report (owner runs, pastes the output)
B1. **The migration list:**
```powershell
npx supabase migration list
```
- The output is a table with columns `Local | Remote | Time (UTC)`.
- If the CLI refuses the duplicate local versions, that error is the "before" evidence.
  Paste it.

B2. **The remote history.** SQL editor:
```sql
select version, name, coalesce(array_length(statements, 1), 0) as n_statements
from supabase_migrations.schema_migrations order by version;
```

B3. **The statements of the remote-only versions** from B1/B2:
```sql
select version, name, statements
from supabase_migrations.schema_migrations
where version in ('<remote-only versions>');
```

B4. **The live bucket:**
```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'resumes';
```

B5. **What a push would do now:**
```powershell
npx supabase db push --linked --dry-run
```

**STOP after Phase B.** I fill in "Recorded values" and the rename table below, then the
repair list. You approve them before Phase C renames anything.

### Phase B outputs (owner, 2026-11-04)
- **A1–A4:** as expected (owner report). CLI `2.122.1`, linked to `zzgymrxrwuuffyrbhify`.
- **B1** `npx supabase migration list`. The CLI accepted the duplicate versions and printed
  them twice.

  | Local | Remote | Time (UTC) |
  |---|---|---|
  | `20260823` | — | `20260823` |
  | `20260830` | — | `20260830` |
  | `20260831` | — | `20260831` |
  | `20260901` | — | `20260901` |
  | `20260903` | — | `20260903` |
  | `20260903` | — | `20260903` |
  | `20261015` | — | `20261015` |
  | `20261015` | — | `20261015` |
  | — | `20261015004738` | 2026-10-15 00:47:38 |
  | — | `20261015034725` | 2026-10-15 03:47:25 |
  | `20261103120000` | — | 2026-11-03 12:00:00 |
  | `20261103120100` | — | 2026-11-03 12:01:00 |
  | `20261103120200` | — | 2026-11-03 12:02:00 |
  | `20261103120300` | — | 2026-11-03 12:03:00 |
- **B2** `schema_migrations`: exactly two rows.
  - `20261015004738`, named `20261015_create_assessments`, 1 statement;
  - `20261015034725`, named `allow_five_assessment_attempts`, 1 statement.

  They match the local 20261015 pair by name, and the remote order (create, then
  allow-five) is the correct dependency order. Whether they are R1 depends on B3 matching
  the statements.
- **B3:** both remote statements are **the local files' SQL, token for token**, compared with
  comments stripped and whitespace normalised. The only differences are comment lines that
  exist locally and not remotely:
  - `create_assessments`: the "Prerequisite / Apply in the SQL Editor" lines and the
    "One assessment per candidate per job" note;
  - `allow_five`: the "Applied to the project via migration" line.

  Both are **R1**.
- **B4:** `resumes` is `public: false`, `file_size_limit: 10485760` (10 MB),
  `allowed_mime_types: ["application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]`. This confirms
  I-0025's "bucket enforces 10 MB".
- **B5** `npx supabase db push --linked --dry-run`: `Remote migration versions not found in local
  migrations directory.`
  - The CLI suggests `migration repair --status reverted 20261015004738 20261015034725` and
    `supabase db pull`. **That is not followed:** R1 (rename) keeps the history true without
    deleting rows or pulling.
  - It also warns: "supabase db push will target the local database by default in the next
    major version. Pass --linked". So every `db push` below passes **`--linked`**
    explicitly.

### Recorded values (from B4; filled after Phase B)
| Field | Live value | Migration C3 sets |
|---|---|---|
| `public` | `false` | unchanged (`false`) |
| `allowed_mime_types` | `{application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document}` | exactly that array |
| `file_size_limit` | `10485760` (10 MB) | `10485760`: the live value is mirrored, because D2's 5 MB applied only to a null limit |

If B4 shows a limit that is not null (for example 10 MB, as I-0025's evidence claims), C3
mirrors it. I then ask whether B3's multer cap stays at 5 MB or matches the bucket.

### Rename table (D1; filled after Phase B, approved before Phase C)
**Rule (owner):**
- All eight 8-digit files are renamed.
- If the remote history already records a file under another version (B2/B3 statements
  match), the local file takes that remote version and name; no repair is needed.
- Every other file gets a new unique 14-digit version, `YYYYMMDD000000` or `…000100`, with
  dependency order kept: notifications before resumes_and_scores, and create_assessments
  before allow_five.

| Old file | Remote record (B2) | New file | Repair needed |
|---|---|---|---|
| `20260823_create_profiles.sql` | none | `20260823000000_create_profiles.sql` | R2 applied |
| `20260830_create_jobs_and_applications.sql` | none | `20260830000000_create_jobs_and_applications.sql` | R2 applied |
| `20260831_add_single_admin_role.sql` | none | `20260831000000_add_single_admin_role.sql` (the `add value` only) | R2 applied |
| (split out of it, owner option A) | none | `20260831000100_add_single_admin_index.sql` (the index, verbatim) | R2 applied, **only if the first diff shows the index live** |
| `20260901_add_profile_suspension.sql` | none | `20260901000000_add_profile_suspension.sql` | R2 applied |
| `20260903_create_notifications.sql` | none | `20260903000000_create_notifications.sql` | R2 applied |
| `20260903_create_resumes_and_scores.sql` | none | `20260903000100_create_resumes_and_scores.sql` | R2 applied |
| `20261015_create_assessments.sql` | `20261015004738` `20261015_create_assessments` (SQL identical) | `20261015004738_create_assessments.sql` | none (R1) |
| `20261015_allow_five_assessment_attempts.sql` | `20261015034725` `allow_five_assessment_attempts` (SQL identical) | `20261015034725_allow_five_assessment_attempts.sql` | none (R1) |
| `20261103120000`..`120300` (T-0029, already 14-digit) | none | unchanged | R2 applied |

**Notes on the rename table:**
- The CLI matches history by version only, so the file name after the version is free. The
  R1 files keep their local names (`_create_assessments`, not the remote
  `_20261015_create_assessments`).
- Resulting order: profiles → jobs → admin → suspension → notifications →
  resumes_and_scores → create_assessments (00:47:38) → allow_five (03:47:25) → T-0029. Every
  file sorts after what it depends on.

**Rename table approved by the owner as written (2026-11-04).**

### Repair list (proposed; Phase D, only after the first `db diff --linked` is reviewed)
```powershell
npx supabase migration repair --status applied 20260823000000 20260830000000 20260831000000 20260831000100 20260901000000 20260903000000 20260903000100 20261103120000 20261103120100 20261103120200 20261103120300
```
- No `reverted` rows: there is no R3, R4 or R5 case.
- The two remote rows stay as they are.

**Per-file existence check (R2 precondition; SQL editor, read-only).** Every column must be
`true`:
```sql
select
  to_regtype('public.patina_user_role') is not null                                as v20260823,
  to_regclass('public.jobs') is not null and to_regclass('public.applications') is not null as v20260830,
  exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
          where t.typname = 'patina_user_role' and e.enumlabel = 'admin')          as v20260831,
  exists (select 1 from information_schema.columns where table_schema = 'public'
          and table_name = 'profiles' and column_name = 'is_suspended')            as v20260901,
  to_regclass('public.notifications') is not null                                  as v20260903a,
  to_regclass('public.resumes') is not null and to_regclass('public.scores') is not null as v20260903b,
  to_regprocedure('public.assert_signup_role(text)') is not null                   as v20261103120000,
  to_regclass('public.assessment_keys') is not null                                as v20261103120100,
  to_regprocedure('public.claim_assessment_for_grading(uuid,uuid,interval)') is not null as v20261103120200,
  not exists (select 1 from information_schema.columns where table_schema = 'public'
          and table_name = 'assessments' and column_name = 'answer_key')           as v20261103120300;
```

**Result (owner, 2026-11-04): all ten columns are `true`.** This confirms the headline
objects only.

**Order and gating (owner, 2026-11-04):**
- Phase D runs only after the **first** `db diff --linked` (C5, run 1) has been reviewed
  and every difference explained. The diff, not the existence check, proves that policies,
  triggers, indexes, grants and functions match.
- If the diff shows that a file's content is not fully live, **that version is removed from
  the repair command** until the difference is resolved: by a new migration, or a decision
  recorded in ISSUES.
- The repair list above is therefore final only after that review.

**Other owner decisions recorded here:**
- Multer cap: 10 MB from one shared constant, reused by the frontend in B5 (I-0025,
  ROADMAP P0-3 (d), P0-4 (a)).
- The `.txt` path: checked in B3 (I-0072); the bucket is not widened.

### Phase C progress (2026-11-04)
- **C1 renames:** done with plain `mv` (unstaged), exactly as the approved table.
  - Living docs that cite the old names were re-pointed: ARCHITECTURE, AUDIT, README,
    `tests/MANUAL_SMOKE.md`, and one comment in `backend/Controllers/analysis.controller.js`.
  - Historical records keep the old names: ISSUES evidence, WORKLOG, `tasks/`,
    INTEGRATION_REVIEW, BASELINE_RESULTS.
  - CODE_MAP and REVIEW_BRIEF are regenerated in B6b.
  - Applied files' own "Prerequisite:" comments are not edited.
- **A1 finding:** the owner's `npm i -D` installed into the **home directory**, because the
  repo root had a `package-lock.json` but no `package.json`, so npm's prefix walked up.
  - Fixed locally: I added a minimal root `package.json` (`private`, tooling only) and
    re-ran `npm i -D --save-exact supabase@2.122.1` in the repo. `package.json` now has
    `"supabase": "2.122.1"`, `node_modules/` is ignored, and `npx supabase --version` prints
    `2.122.1` from the repo.
  - The home-directory copy is left for the owner to remove.
- **C3 / C4:** `20261104120000_resumes_bucket_limits.sql` (10 MB and the live MIME array)
  and `20261104120100_scores_subscores_comment.sql`.
- **C6:** `migration-guards` before the change: 4 of 9 fail
  (`tests/.out/t0030-before-guards.log`). After: 9/9 (`t0030-after-guards.log`).
- **C7:** `Docs/SUPABASE_MIGRATIONS_RUNBOOK.md`.
- **C2 attempt 1:** `npx supabase start` (full stack) was stopped by Claude Code for low
  system memory while it was still pulling images. No container started and no migration
  ran.
- **C2 attempt 2** (owner: app services stopped, `[analytics] enabled = false`, and a
  minimal stack via `npx supabase start -x
  realtime,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`;
  1.9 GB of RAM free): `20260823000000` and `20260830000000` applied, then **`20260831000000_add_single_admin_role.sql`
  failed at statement 1**: `ERROR: unsafe use of new value "admin" of enum type
  patina_user_role (SQLSTATE 55P04)`.
  - Cause: statement 0 `alter type … add value if not exists 'admin'`, then statement 1
    `create unique index … where role = 'admin'`, in the one transaction the CLI wraps
    around each file. Postgres forbids using an enum value in the transaction that added
    it.
  - Production has both because they were applied by hand in the SQL editor.
  - The CLI stopped its containers (exit 1). Log: `tests/.out/t0030-supabase-start.log`.
  - **Owner decision (2026-11-04): option A.** The index statement moved verbatim to the
    new `20260831000100_add_single_admin_index.sql`; the original keeps only `alter type …
    add value` plus a comment pointing to the new file. `20260831000100` joins the repair
    list, conditional on the diff showing the index live.
- **Scan of every migration** (comments stripped) for statements that cannot run in the
  CLI's per-file transaction:
  - `add value`: one, `20260831000000`;
  - its value `'admin'`: used only by that file's index;
  - none of `concurrently`, `vacuum`, `alter system`, `create`/`drop database`, `reindex`,
    `rename value`, or explicit `begin`/`commit`/`rollback`.

  **No other file needed splitting.**
- **Guard against recurrence:** `migration-guards` "a file that adds an enum value does
  nothing else in that transaction" (10/10 pass).
- **C2 attempt 3: PASS.** On the minimal stack (2.2 GB RAM free), `npx supabase start -x …`
  exited 0. All 15 migrations that existed then applied in version order on a fresh local database,
  `20260823000000` through `20261104120100`, including the split pair. The only other
  output was `no files matched pattern: supabase/seed.sql` (expected; no seed file). Log:
  `tests/.out/t0030-supabase-start.log`.
  - Guards added for the replay: **none.** The one failure was fixed by the approved split.
- **C5 run 1** (owner, 2026-11-04; `tests/.out/t0030-diff1-public.sql`,
  `t0030-diff1-auth-storage.sql`):
  - **auth, storage:** `No schema changes found`. The `on_auth_user_created` trigger and
    the storage objects match.
  - **public:** four statements.
    1. `COMMENT ON COLUMN public.scores.subscores IS NULL`: the live column has no comment,
       and the new `20261104120100` migration adds one. Expected; resolved by Phase E.
    2. `CREATE OR REPLACE FUNCTION public.assert_signup_role`;
    3. `… public.claim_assessment_for_grading`;
    4. `… public.handle_new_user`.

    Items 2–4 are all T-0029 functions, and their bodies are **identical to the local files
    once carriage returns are removed** (compared by script). So the difference is line
    endings only. The local T-0029 files are LF. `set_updated_at` (from the CRLF working
    copy of `20260823000000`) is *not* flagged. That fits live bodies that keep whatever
    line endings the SQL editor received, and a working tree whose line endings depend on
    the checkout: the git index is LF, `core.autocrlf=true` turns `20260823…` into CRLF
    on disk, and the files written in T-0029 stayed LF.
  - **No other difference:** no table, column, index (including the split
    `profiles_single_admin_role`), policy, trigger, grant or revoke. Every migrated object
    in public, auth and storage matches.
  - **Owner's `prosrc` check** covered every function in public, of which there are four.
    All four have `live_has_cr = true`, and `md5_without_cr` equals the latest local
    definition's body: `assert_signup_role` `092cfabe…`, `claim_assessment_for_grading`
    `e87ae417…`, `handle_new_user` `379c9b49…`, `set_updated_at` `98c445da…`. The
    line-ending explanation is confirmed.
- **Owner choice A (2026-11-04):**
  - **`.gitattributes`:** `supabase/migrations/*.sql text eol=lf`.
  - **Files on disk:** normalised without staging. Nine files had CRLF (the renamed ones
    and the split index); none has a CR byte now. Seven renamed files are byte-identical
    to their committed originals at `edb1a37`. `20260831000000` differs only by the
    approved split.
  - **`20261104120200_function_bodies_lf.sql`:** generated by script, byte for byte from
    each function's latest definition: `set_updated_at` from `20260823000000`;
    `assert_signup_role` and `handle_new_user` from `20261103120000`;
    `claim_assessment_for_grading` from `20261103120200`.
  - **Guards:** `migration-guards` adds "no migration file contains a carriage return"
    and "20261104120200 re-creates every public function verbatim". 12/12 pass.
  - **Runbook:** migrations are applied only by `npx supabase db push --linked`; never
    pasted into the SQL editor.
- **Replay 2:** `npx supabase db reset` (local) exit 0, all 16 migrations
  (`tests/.out/t0030-replay2.log`).
- **C5 run 2** (me, read-only, 2026-11-04; `tests/.out/t0030-diff2-*.sql`):
  - auth, storage: `No schema changes found`;
  - public: exactly `COMMENT ON COLUMN public.scores.subscores IS NULL` plus `CREATE OR
    REPLACE FUNCTION` for the four re-created functions, with `dropStatements: []`.

  This is the expected set, and nothing else differs.
- **Final repair list (for Phase D):** all eleven local-only versions. Every one is shown
  live by the diff.

### Phase D result (owner, 2026-11-04)
- **Repair:** `npx supabase migration repair --status applied` with the eleven versions
  printed `Repaired migration history: [20260823000000 … 20261103120300] => applied` and
  `Finished supabase migration repair.`
- **Migration list:** all 13 existing versions show Local = Remote. Only `20261104120000`,
  `20261104120100` and `20261104120200` are Local only.
- **Gate:** `npx supabase db push --linked --dry-run` printed `Would push these
  migrations:` followed by exactly the three B2 files. **Gate passed.**
- **CLI warning:** `migration repair` and `migration list` also say they will target the
  local database by default in the next major version. The runbook now uses `--linked`
  on every remote command, and bans `db reset --linked` (it wipes production; `db reset`
  is for the local stack only), at the owner's request.

### Phase E result (owner, 2026-11-04) and post-push checks
- **Push:** `npx supabase db push --linked` listed and applied exactly the three B2 files,
  then printed `Finished supabase db push.`
- **Migration list (`--linked`):** all 16 versions show Local = Remote.
- **Dry run:** `Remote database is up to date.`
- **Diffs after the push** (me, read-only; `tests/.out/t0030-diff3-*`): `public` and
  `auth,storage` both print `No schema changes found`, with an empty diff and no drop
  statements. Each shadow database applied all 16 migrations.
- **Counts reconciled:**
  - 16 files are in `supabase/migrations/`: 8 renamed, 1 split-off index, 4 from T-0029
    and 3 new in B2. That equals the 16 versions in the list.
  - Replay attempt 3 applied 15, because `20261104120200` did not exist yet. Replay 2 and
    every later shadow database applied 16 (counted from the `Applying migration` lines in
    the logs).
  - My earlier "17" and "18" were miscounts, now corrected above.
  - The `no files matched pattern: supabase/seed.sql` line is the seed step finding no
    file; it is not a migration.
- **Local stack:** stopped (`npx supabase stop`).
- **Regression** (`tests/.out/t0030-regression.log`), run with the backend and :8002 only:
  - 116 tests: 114 pass, 1 fail, 1 skipped, 0 todo.
  - The fail is I-0071, the shortlist control test, owned by B3.
  - The skip is `live-evaluate-release`, because :8002 is up.
  - The I-0057 `todo` is gone; it is now real tests.
  - Every T-0029 live test passes against the repaired database.
  - Not run: `live-analyze`, `live-analyze-github` and `live-analysis-isolation` (they need
    NLP, kept off for memory). T-0030 changed nothing on the analyze path.
  - `sweep --check`: nothing left. `check-trackers`: 0 warnings.
### How each B1 row is resolved
| Case | Resolution | Remote command? |
|---|---|---|
| **R1**: remote-only, same migration as a local file | Rename the local file to the remote `version_name` | none |
| **R2**: local-only, already applied by hand | `npx supabase migration repair --status applied <versions…>` | owner, Phase D |
| **R3**: remote-only, no local file, schema exists | Add `<version>_<name>.sql` with B3's statements verbatim. Never revert it. | none |
| **R4**: remote-only, verifiably superseded by a local file that also gets R2 | `npx supabase migration repair --status reverted <version>` | owner, Phase D |
| **R5**: local-only and not applied | Stop and ask | — |

R2 is checked per file, read-only, before it is listed: one `to_regclass` / `pg_type` /
`pg_policies` query for an object the file creates.

## Phase C: local work (me, after the rename table is approved; nothing remote)
C1. **Rename** exactly as the approved table says, with `git mv`.

C2. **Fresh local replay.** Docker Desktop must be running.
```powershell
npx supabase start      # first run pulls several GB of images
npx supabase db reset   # local only: applies every migration once, in version order
```
- The local database is the only target.
- **If a file fails here,** I add the smallest guard that lets it run. I record in Result
  which file failed, which statement, and why (for example, an object Supabase's local
  image already provides).
- No other edit to an applied file is allowed.

C3. **New `<ts>_resumes_bucket_limits.sql` (I-0001):**
```sql
update storage.buckets
   set file_size_limit = <Recorded values>,
       allowed_mime_types = <Recorded values, exactly as live>
 where id = 'resumes';
```
- The bucket row itself is created by the renamed `…create_resumes_and_scores`.
- On production the update changes only `file_size_limit`, and only when the live value is
  null (D2). It sets the MIME list to what is already there.

C4. **New `<ts>_scores_subscores_comment.sql` (I-0041):** `comment on column
public.scores.subscores is '…'`. The text describes the stored shape: each sub-score is an
object `{key, label, available, value, weight, reason, components, evidence}`, and an
unavailable one has `available: false, value: null, weight: 0`.
- The stale `--` lines in the old file stay as they are (no edits to applied files).
- The ISSUES entry notes that the database comment is now the source of truth.

C5. **Schema diff against the live database.** Owner step, because it uses the link
password:
```powershell
npx supabase db diff --linked
```
- Expected (the goal): `No schema changes found`.
- It compares the schema built from local migrations (on a local shadow database) with the
  linked remote. It writes nothing remote.
- **Before C3 and C4 are pushed, the diff will show those two changes.** So C5 runs twice:
  1. after C1 and C2, with C3 and C4 not yet created, to show the drift of the existing
     files;
  2. after Phase E: it must be empty.
- **Every difference in the first run is explained in Result,** with the object, the
  direction (local-only or remote-only) and the likely cause. It then gets either:
  - a new migration that makes the files reproduce the live schema (remote-only objects
    built by hand), or
  - an ISSUES entry, if it needs a decision (for example, a live object nobody can
    explain).

C6. **`tests/backend/migration-guards.test.mjs`:**
- the I-0057 `todo` becomes a real test: every file has a unique 14-digit version, and
  create_assessments sorts before allow_five;
- the bucket and comment migrations contain their statements;
- a new test: no 8-digit file remains;
- the T-0029 assertions keep passing.

C7. **`Docs/SUPABASE_MIGRATIONS_RUNBOOK.md`:**
- `npx supabase` with the pinned version;
- how to add a migration (`npx supabase migration new <name>`, a local `db reset`, the
  dry-run gate);
- the repair cases R1–R5;
- "never `--include-all`; never apply in the SQL editor without a `migration repair
  --status applied` right after";
- for teammates: the old 8-digit file names are gone, so do not apply them by hand.

**STOP after Phase C.** I report C2, the first C5 output with its explanations, C6, and
the Phase D repair list, now gated on the C5 review (see "Order and gating").

## Phase D: history repair (owner; history rows only)
These are the commands from the approved repair list. Their shape:
```powershell
npx supabase migration repair --status applied <R2 versions…>
npx supabase migration repair --status reverted <R4 versions…>   # only if listed
npx supabase migration list
```
- Expected for each repair: `Repaired migration history: [<versions>] => applied` (or
  `=> reverted`), then `Finished supabase migration repair.`
- Expected for the list: every version has Local and Remote filled, except the three new
  B2 files `20261104120000`, `20261104120100` and `20261104120200`.

Then the gate:
```powershell
npx supabase db push --linked --dry-run
```
- Expected: it would push exactly `20261104120000_resumes_bucket_limits.sql`,
  `20261104120100_scores_subscores_comment.sql` and
  `20261104120200_function_bodies_lf.sql`.
- **Anything else listed → stop, paste it, do not push.**

## Phase E: first CLI apply (owner; writes schema)
```powershell
npx supabase db push --linked
```
Expected:
- `Applying migration 20261104120000_resumes_bucket_limits.sql...`
- `Applying migration 20261104120100_scores_subscores_comment.sql...`
- `Applying migration 20261104120200_function_bodies_lf.sql...`
- `Finished supabase db push.`

Then:
- `npx supabase migration list --linked`: all rows in sync;
- `npx supabase db push --linked --dry-run`: `Remote database is up to date.`;
- B4 again;
- this comment check:
```sql
select col_description('public.scores'::regclass, attnum)
from pg_attribute
where attrelid = 'public.scores'::regclass and attname = 'subscores';
```
- the second run of C5: `npx supabase db diff --linked` → `No schema changes found`.

## Phase F: Preview check and the I-0010 setting (owner)
- You commit and push. I read `gh api …/commits/<sha>/check-runs`. Expected: `Supabase
  Preview | completed | success`.
- Confirm in Supabase dashboard → Integrations → GitHub that production deploys stay off
  (decision 2026-10-12, option a).

## Acceptance criteria
1. **The CLI is pinned and linked.** Checked by me, read-only:
   - `package.json` devDependencies has `"supabase": "2.122.1"`;
   - `npx supabase --version` prints `2.122.1`;
   - `supabase/config.toml` exists;
   - `supabase/.temp/project-ref` contains `zzgymrxrwuuffyrbhify`;
   - `git check-ignore supabase/.temp/project-ref` matches.
2. **Drift recorded.** The B1–B5 outputs, "Recorded values" and the rename table are in
   this file and were approved before C1. Every B1 row has a case R1–R5.
3. **Unique 14-digit versions, dependency order.** Checked by `migration-guards` "every
   migration has a unique 14-digit version" and "no 8-digit file remains". Before: `todo`
   (6 ≠ 8) and a failure. After: pass.
4. **Fresh replay.** Checked by: `npx supabase db reset` exits 0 on the local stack. Any
   guard that was needed is listed in Result with its file and reason; "none" is a valid
   answer.
5. **The live schema is reproduced.** Checked by: the second C5 run
   (`npx supabase db diff --linked`) prints `No schema changes found`. Every difference
   from the first run is explained in Result and resolved by a named migration or an
   ISSUES id.
6. **History repaired.** Checked by:
   - `npx supabase migration list` after Phase E: all rows in sync;
   - the Phase D dry run listed exactly the approved files;
   - after Phase E, `Remote database is up to date.`
7. **Bucket in a migration (I-0001).** Checked by: B4 after Phase E equals "Recorded
   values" (MIME types unchanged; 5 MB if they were null).
8. **Comment (I-0041).** Checked by: the `col_description` query returns the new text.
9. **Preview check green (I-0010).** Checked by: `gh api …/check-runs` on the B2 commit
   returns `success`, and the dashboard setting is confirmed.
10. **Regression.** Checked by:
    - the backend suite (offline + `-Live`, current services), as in T-0029: only I-0071
      fails (owned by B3), and the release test is skipped while :8002 is up;
    - the `docs` and `assessment` suites;
    - the T-0029 live tests, in particular.
11. **Trackers.** Checked by:
    - `check-trackers` passes;
    - I-0057, I-0001 and I-0041 are moved to Resolved;
    - I-0010 is moved only if criterion 9 passes;
    - AUDIT 0.2 is re-read;
    - ROADMAP P0-3 / I-0025 carries the 5 MB multer cap (done at approval).

## Test plan
- **Written first** (fails before the change): the `migration-guards` 14-digit and
  no-8-digit tests. They are offline and can be written now.
- **Not automatable, owner-run:** A1–A4, B1–B5, C5, D, E and F. They need your
  credentials, and some write to the remote. Each has its expected output above.
- **Needs Docker:** C2 and C5. Without Docker, criteria 4 and 5 are NOT RUN, never passed.

## Regression
- `tests/backend/*.test.mjs` offline and `-Live`;
- the `docs`, `assessment` and `github` suites;
- the T-0029 live tests.

## Risks and rollback
- **A wrong `repair --status applied`:** that file is skipped forever. Mitigation: the
  per-file existence check. Rollback: `npx supabase migration repair --status reverted <v>`.
- **A wrong `repair --status reverted`:** the next push re-runs that file. Mitigation:
  R4 only with proof, and the dry-run gate. Rollback: `repair --status applied <v>`.
- **An old file pushed to production:** this would undo the T-0029 role fix. Mitigation:
  the two-file dry run; `--include-all` is banned.
- **A renamed file on teammates' clones:** covered in the runbook and the commit message.
- **The CLI's postinstall downloads a binary** from GitHub releases. The version is pinned
  in `package.json` and the lock file.
- **Rollback of the code:** revert the commit. Renames change no schema, the two new
  migrations are additive, and history rows can be repaired back.

---

## Result
Executed 2026-11-04. Committed by the owner as `68763e0` (the migrations, `.gitattributes`,
`package.json`, `supabase/config.toml`, `migration-guards`). The trackers and the runbook
are uncommitted. CLI `supabase@2.122.1` (a pinned root devDependency). Every remote write
was an owner step: `link`, the `migration repair` of 11 versions, `db push --linked` of 3
files. Every phase's output is recorded above.

| # | Verdict | Evidence |
|---|---|---|
| 1 | **PASS** | `package.json` devDependency `"supabase": "2.122.1"`; `npx supabase --version` → `2.122.1` from the repo (after fixing the A1 install, which had gone to the home folder); `supabase/config.toml` (`project_id = "Patina"`); `supabase/.temp/project-ref` = `zzgymrxrwuuffyrbhify`; `git check-ignore` matches `supabase/.gitignore:3` |
| 2 | **PASS** | B1–B5 are recorded under "Phase B outputs". Every B1 row is classified: 2 remote-only rows are R1 (same SQL, files renamed to their versions); 10 local-only files are R2 (+1 from the split); no R3, R4 or R5. The rename table was approved before C1 |
| 3 | **PASS** | `migration-guards` "every migration has a unique 14-digit version" and "B2 renames match the approved table, in dependency order". Before: I-0057 `todo` (6 ≠ 8) and 4 failing new tests (`t0030-before-guards.log`). After: 12/12 (`t0030-after-guards.log`) |
| 4 | **PASS** | Fresh replay. `20260831` failed first (55P04, enum value used in the transaction that added it); fixed by the owner-approved split (option A), **not** a guard. A scan of every file found no other transaction-unsafe statement. Then replays applied 15 and 16 files, exit 0 (`t0030-supabase-start.log`, `t0030-replay2.log`). Guards added: **none** |
| 5 | **PASS** | First diff: the subscores comment plus 3 T-0029 function bodies, which differed only by CRLF. The owner's `prosrc` check confirmed all 4 public functions had CR and matched the local bodies without it. Fixed by `.gitattributes` (`eol=lf`), LF files on disk, and `20261104120200_function_bodies_lf.sql` (verbatim re-create of all 4). Pre-push diff: exactly the expected set. **Post-push: `public` and `auth,storage` → `No schema changes found`** (`t0030-diff3-*`) |
| 6 | **PASS** | Owner `npx supabase migration repair --status applied` ×11 → `=> applied`. Dry-run gate: exactly the 3 B2 files. Post-push `migration list --linked`: 16/16 in sync; `db push --linked --dry-run`: `Remote database is up to date.` |
| 7 | **PASS** | Owner B4 after the push: `public: false`, `file_size_limit: 10485760`, MIME `[application/pdf, …wordprocessingml.document]`, equal to "Recorded values" (live 10 MB mirrored; D2's 5 MB applied only to a null limit) |
| 8 | **PASS** | Owner `col_description` returns the new text ("Object keyed by parsing_semantic_alignment, github_evidence and assessment_results. …") |
| 9 | **PASS** | `gh api …/commits/68763e0/check-runs`: `Supabase Preview \| completed \| success` (08:34:15–08:34:22Z), the first green run; `edb1a37` was `failure`. The owner confirmed production deploys are off in the GitHub integration |
| 10 | **PASS (scoped)** | `t0030-regression.log`, backend and :8002 only (NLP off for memory): 116 tests, 114 pass, 1 skip (release test, :8002 up), 1 fail (**I-0071**, the shortlist control test, pre-existing, B3), 0 todo. Every T-0029 live test passes on the repaired database. Not run: `live-analyze`, `live-analyze-github`, `live-analysis-isolation` (need NLP; T-0030 does not touch that path). `docs` suite: 0 warnings |
| 11 | **PASS** | `check-trackers`: 0 warnings. I-0057, I-0010, I-0001 and I-0041 moved to Resolved with evidence. AUDIT 0.2 re-read: status unchanged (STUBBED_OR_PARTIAL, no Repository table); the evidence now includes the replay and the empty diff. ROADMAP P0-2 Task = T-0030; P0-3 (d) has the 10 MB shared constant; P0-4 (a) reuses it (I-0006); I-0072 is added to B3 |

**Deviations from the approved spec, all owner-approved during execution:**
- `20260831` was split into `…000000` and `…000100`; that is more than a rename;
- a third pushed file, `20261104120200_function_bodies_lf.sql`;
- `.gitattributes` and the LF normalisation;
- a root `package.json` was created, because the A1 install landed in the home folder;
- `db diff --linked` runs 2 and 3 were run by me (read-only, with the owner's stored CLI
  login), at the owner's request.

**Found along the way, fixed here:** 4 stale comma-list cites in AUDIT left over from the
T-0029 line shift (`analysis.controller.js:…,400-401` → `421-422`; `:360` → `381`; `:345` →
`366`, ×2). My T-0029 cite script only re-pointed the first number of a comma list.

**Left to the owner:** remove the stray CLI install from the home folder
(`cd ~; npm uninstall supabase`); and the prompt-log hook gap, noted in WORKLOG L-0042.
