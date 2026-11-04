# Supabase migrations runbook

Written in T-0030 (B2, 2026-11-04). It covers how schema changes reach the shared
project (`zzgymrxrwuuffyrbhify`) without the history drifting again.

## Tooling
- The CLI is a pinned root devDependency: `supabase@2.122.1` in `package.json`.
- Always run `npx supabase …` from the repo root, never a global install. A different
  CLI version can change behaviour; for example, `db push` targets the local database by
  default from v3.
- One-time setup per machine:
  ```powershell
  npm ci                                              # installs the pinned CLI
  npx supabase login                                  # token stored in your user profile
  npx supabase link --project-ref zzgymrxrwuuffyrbhify  # asks for the DB password; writes supabase/.temp/ (git-ignored)
  ```
- Local stack (Docker Desktop running): `npx supabase start`, then `npx supabase db reset`.
  The reset re-applies every migration to the **local** database only.
- **Low-memory machines (8 GB):** the full stack was killed for memory on the owner's
  laptop (T-0030). For a migration replay or `db diff`, start only what migrations need:
  Postgres (always started), `gotrue` (it owns `auth.users`) and `storage-api` (it owns
  `storage.buckets`). Stop the app services first.
  ```powershell
  npx supabase start -x realtime,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
  ```
  - The names are the `--exclude` choices of CLI 2.122.1 (`npx supabase start --help`).
  - `supabase/config.toml` also has `[analytics] enabled = false`, which affects local
    only.
  - Stop the stack with `npx supabase stop`.

## Always pass `--linked` to remote commands
CLI 2.122.1 warns that `db push`, `migration list` and `migration repair` will target the
**local** database by default in the next major version. Always write
`npx supabase db push --linked`, `npx supabase migration list --linked` and
`npx supabase migration repair --linked …`, so a CLI upgrade cannot silently change the
target. (`db reset` is the opposite: never `--linked`.)

## The one rule
**Migrations reach the shared project only through `npx supabase db push --linked`.**
Never paste a migration into the dashboard SQL editor.
- Pasting is how both T-0030 problems got in:
  - **History drift:** the editor records no row in `schema_migrations`, so the Preview
    check and `db push` broke (I-0010, I-0057).
  - **CRLF function bodies:** the editor stores whatever line endings it is given, and
    Postgres keeps function bodies byte for byte. `db diff --linked` then reports
    unchanged functions as changed. `20261104120200_function_bodies_lf.sql` had to
    re-create all four.
- `.gitattributes` keeps `supabase/migrations/*.sql` LF on every checkout, and
  `tests/backend/migration-guards.test.mjs` fails on any CR. Keep both.
- Read-only SQL in the editor (checks, `select`s) is fine.

## File names
- `supabase/migrations/<14-digit version>_<name>.sql`. The version must be unique. The
  CLI matches remote history by version only; the name is free text.
- Create one with `npx supabase migration new <name>`. Never reuse a date-only (8-digit)
  version.
- **T-0030 renamed the old 8-digit files** (`20260823_…` → `20260823000000_…`, and so on).
  Do not apply the old names by hand, and do not restore them from an old branch.
  - The 20261015 pair carries the versions the remote history already had:
    `20261015004738_create_assessments` and `20261015034725_allow_five_assessment_attempts`.
- Applied files are not edited. A fix is a new migration.

## Adding a schema change
1. `npx supabase migration new <name>`, then write the SQL.
2. Locally: `npx supabase db reset`. It must finish without errors.
3. `npx supabase db diff --linked`. Before your push it shows exactly your change and
   nothing else.
4. **Dry run, always:**
   ```powershell
   npx supabase db push --linked --dry-run
   ```
   It must list only your new file(s). If it lists anything else, stop.
5. `npx supabase db push --linked`.
6. `npx supabase migration list --linked` shows every row in sync, and
   `npx supabase db diff --linked` prints `No schema changes found`.

## Never
- `npx supabase db push --include-all`. It would re-run old files on production; for
  example, `20260823000000_create_profiles.sql` would recreate `handle_new_user()`
  without the T-0029 signup-role check.
- **`npx supabase db reset --linked`. It wipes the production database** (the shared
  project every teammate, the demo and the live tests use). `db reset` is for the
  **local stack only**: run it as plain `npx supabase db reset`, with no `--linked`, and
  only while `npx supabase start` is running.
- Applying a migration in the dashboard SQL editor (see "The one rule"). If it ever
  happens in an emergency, run `npx supabase migration repair --linked --status applied
  <version>` right after, and check `npx supabase db diff --linked`.

## Repairing history
`migration repair` only writes `supabase_migrations.schema_migrations`. It never creates or
drops schema.

| Situation | Action |
|---|---|
| Remote-only version, same SQL as a local file under another version | Rename the local file to the remote version |
| Local-only file whose schema is already live (applied by hand) | `npx supabase migration repair --linked --status applied <version>`, after `db diff --linked` shows that the file's content is live |
| Remote-only version with no local file | Add `<version>_<name>.sql` with the statements from `schema_migrations`. Never mark it reverted. |
| Remote-only version proven superseded by a local file | `npx supabase migration repair --linked --status reverted <version>`. This deletes the history row only. |
| Local-only file whose schema is **not** live | Do not repair; it is a real pending migration |

Ignore the CLI's generic advice to "repair --status reverted … and db pull" when a remote
version is missing locally. Check the case first using the table above.

## Production auto-deploy
Production deploys from the Supabase GitHub integration are **off** (owner decision
2026-10-12, I-0010). Schema reaches production only through the steps above. The
**Supabase Preview** check on GitHub replays the migrations; it fails whenever local
files and remote history disagree.
