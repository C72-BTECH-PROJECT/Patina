# T-0005 — notifications-send-removal

## Goal
No logged-in user can create arbitrary notifications for another user. Fixes I-0020.

## Spec ref
None (authorization hardening). INTEGRATION_REVIEW.md R34; ISSUES I-0020.

## Scope
**In:** delete `POST /api/notifications/send` and the now-unused `sendNotification` import in `backend/Routes/notification.routes.js`.
**Out:** `sendNotification` itself (still used by `shortlistCandidate`), `GET /` and `POST /:id/read`, the notifications RLS policy.

## Acceptance criteria
1. Candidate `t0001_cand` `POST /api/notifications/send {userId:<R>, type, message:<unique marker>}` → 404 (route gone), and recruiter R's `GET /api/notifications` has no row with that marker — `tests/backend/live-notifications-authz.test.mjs`.
2. Unauthenticated `POST /send` → not 2xx (404) — same file.
3. Control: `GET /api/notifications` as C → 200 `{notifications, unreadCount}`; `POST /api/notifications/:id/read` on C's own seeded notification → 200 — same file.
4. `grep -rn "notifications/send" frontend/src backend tests` finds only the test; output recorded.
5. T-0004's live file still passes (server-side notification path intact); full harness + `sweep.mjs --check` green.

## Test plan
- Write FIRST: `tests/backend/live-notifications-authz.test.mjs`. Red = criterion 1 (200 today; marker present for R). Criteria 2–3 pass today.

## Regression
T-0004 live file, tier 1/2, NLP, frontend build, sweep `--check`.

## Risks and rollback
- Risk: an external caller not in this repo. Rollback: restore the route.

---

## Result
1. PASS — red `tests/.out/t0005-red.log`: `{"http":200,"inInbox":true,"inDb":true}`; green `tests/.out/t0005-green.log`: `{"http":404,"inInbox":false,"inDb":false}`.
2. PASS — unauthenticated `POST /send` → status ≥ 400 and nothing inserted (both runs; it was already 401 before, now 404).
3. PASS — `GET /api/notifications` as C → 200 `{notifications, unreadCount}` with the seeded row; `POST /:id/read` → 200 and `read=true`; recruiter marking C's notification → 404, row unchanged (both runs).
4. PASS — `grep -rn "notifications/send" frontend/src backend tests` (js/jsx/mjs, no node_modules) matches only `tests/backend/live-notifications-authz.test.mjs`; the frontend only calls `GET /api/notifications` and `POST /api/notifications/:id/read`.
5. PASS — `live-shortlist-authz` 11/11 in the same run as the new file (15/15); full harness `tests/.out/t0005-full-harness.log`: NLP 10/10, backend 23/23, frontend CI build exits 1 on the same 5 CreateJob/Jobs warnings; `sweep.mjs --check` exit 0.

Not covered: callers outside this repo.
