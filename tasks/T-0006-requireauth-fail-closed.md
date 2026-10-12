# T-0006 — requireauth-fail-closed

## Goal
`requireAuth` rejects the request when the profile lookup errors, throws, or the profile row is missing. Fixes I-0021.

## Spec ref
None (authentication). INTEGRATION_REVIEW.md R35; ISSUES I-0021.

## Scope
**In:** `requireAuth` in `backend/Middlewares/auth.Middleware.js`: 401 on `error || !profile`, 401 if the query throws; suspended branch unchanged.
**Out:** `requireRole`, session lifetime, the suspended 403 body.

## Acceptance criteria
1. With `t0001_recr2` logged in and its `profiles` row deleted, `GET /api/jobs/mine` and `GET /api/notifications` with the old cookie → 401 — `tests/backend/live-auth-failclosed.test.mjs`.
2. Control, same file: before the delete `GET /api/jobs/mine` → 200; after the row is restored (upsert) the same cookie → 200 again (the 401 was caused by the missing profile; the session is not destroyed by this 401).
3. Safety of the live test:
   - (a) it refuses to run unless the profile is a `t0001_` username with 0 jobs/applications/notifications;
   - (b) the full row is written to `tests/.out/t0001-profile-snapshots.json` before the delete;
   - (c) the restore is an upsert in `finally`, and is asserted afterwards;
   - (d) if the process dies mid-test, `node tests/backend/sweep.mjs --check` exits 1 reporting `profile-missing:t0001_recr2`, and `node tests/backend/sweep.mjs --restore-profiles` re-inserts the row. I simulate this once (delete the row, run both) and record the output.
4. The query-error and thrown-exception branches are verified by diff only (they cannot be forced live); the Result says so.
5. Full harness + `sweep.mjs --check` green (profile present, all 0).

## Test plan
- Write FIRST: `tests/backend/live-auth-failclosed.test.mjs`. Red = criterion 1 (200 today).

## Regression
T-0004/T-0005 live files, tier 1/2, NLP, frontend build, sweep `--check`.

## Risks and rollback
- Risk: a user with no profile row is now locked out (intended; the signup trigger creates profiles, see I-0017). Rollback: revert the middleware.

---

## Result
(filled at the end)
