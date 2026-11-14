# T-0024 — assessment-generate-only

> Generate-only wiring: assessment-service → Express → candidate UI.
> No persistence, no score integration, no DB writes of any kind.

## Goal

A logged-in candidate can open an assessment page and see real, role-specific
questions generated for their job — replacing the current mock shell — with
nothing persisted anywhere yet.

## Spec ref

- `CHECKLIST.md` 3.7 (sequence, frontend→backend→generation steps present),
  5.3 (take assessment), 3.2 (no static bank — every instance generated).
- `PROJECT_SOURCE_DOCS.md` assessment module (§3 Sequence / Use Case "Take
  assessment"). Exact FR numbers to be confirmed against that doc during build;
  not invented here.

## Scope

**In:**
- `assessment-service/.env` from `.env.example` + a user-supplied
  `OPENROUTER_API_KEY`; service runs on port 8002.
- Backend `POST /api/assessment/generate` (CANDIDATE role, session auth) that
  forwards `{ jobId }` (+ resume context where already available) to the
  service and returns candidate questions only — never the answer key.
- Frontend route `/candidate/assessment` (candidate-only) + rewritten
  `Assessment.jsx`: loading / error / question-list states driven by the real
  endpoint. Answer submission stays disabled with an explicit "coming soon"
  note (evaluate is out of scope).
- Service smoke check (health + one real generation).

**Out:**
- `POST /api/assessment/evaluate`, answer submission/scoring — not built.
- Any DB migration or table (`assessments`), any persistence of results.
- Score integration (`explainability.js` assessment slot stays null).
- GR-1 anti-cheat hardening beyond server-side answer keys (follow-up task).
- Production deploy, gateway changes, GitHub-evidence work.

## Acceptance criteria

1. Service healthy locally — checked by: `GET http://localhost:8002/`
   returns `{"service": <name>, "status": "healthy"}`.
2. Real generation works — checked by: `POST http://localhost:8002/generate-assessment`
   with a valid `AssessmentInput` body returns 20 question items as JSON
   (no mock content).
3. Backend proxies generation for candidates — checked by: logged-in candidate
   `POST http://localhost:5000/api/assessment/generate` with `{ "jobId": <id> }`
   returns questions; logged-out request returns 401.
4. Answer key never leaks — checked by: backend response body contains no
   `answer_key` field (assert via curl output inspection).
5. UI shows real questions, zero mocks — checked by: manual steps —
   login as candidate → open `/candidate/assessment` → questions render;
   `MOCK_QUESTIONS` no longer referenced by `Assessment.jsx`
   (checked by: grep finds no `MOCK_QUESTIONS` in the file).
6. Service-down behavior is clean — checked by: with the service stopped,
   backend returns 502 with a JSON message (not a hang, not HTML).

## Test plan

- Tests to write FIRST (must FAIL before the change, PASS after):
  - `tests/backend/assessment-generate.smoke.mjs` — asserts criterion 3's
    401-when-logged-out and 502-with-JSON-when-service-down paths
    (no LLM key needed for these paths).
- Criteria that can't be automated, and why:
  - Criteria 2, 5 (real-question content) — require a live LLM key and
    visual judgment; verified manually by the user.

## Regression

Existing suites that must still pass after this change:
- `tests/backend/smoke.test.mjs` (backend still boots, existing routes intact).
- `tests/docs/check-trackers.mjs` (docs suite — run after any AUDIT/CHECKLIST
  touch; this task touches neither unless noted in Result).

## Risks and rollback

- Risk: new Express route could shadow existing `/api/*` routes — mitigated by
  registering under the distinct `/api/assessment` prefix and re-running the
  backend smoke test.
- Risk: LLM cost/latency on manual smoke — bounded: free-tier models only,
  one generation per check.
- Rollback: fully additive, no migration — revert the commit(s); service,
  route, and page disappear together.

---

## Result

(2026-10-14 session. Criteria 1–4, 6 PASS with live evidence; only the
manual UI check (5) remains with the owner. No evidence recorded = FAIL.)

1. PASS — `GET http://localhost:8002/` returned
   `{"service": "Patina AI Assessment Service", "status": "healthy"}`
   (fresh venv, `uvicorn app.main:app --port 8002`).
2. PASS — live `POST http://localhost:8002/generate-assessment` returned 20
   questions (`assessment_id 246baf7c-…`, model `openrouter/free`, Q1 MCQ on
   React from resume) plus a server-side `answer_key`. Note: free-tier model
   needed ~2–4 min; first attempt hit the 120 s client timeout, not a failure.
3. PASS — `node --test tests/backend/assessment-generate.smoke.mjs`:
   logged-out `POST /api/assessment/generate` → 401 with JSON message
   (route registered + CANDIDATE-guarded). Full backend suite 8/8.
4. PASS — authed `POST /api/assessment/generate` as candidate Myuser returned
   top-level keys `questions` only (20 questions, model `openrouter/free`);
   `answer_key` provably absent from the browser-facing body.
5. PENDING (manual) — page built at `/candidate/assessment`, `MOCK_QUESTIONS`
   removed (grep-clean); UI check awaits key.
6. PASS — with the service stopped, the same authed call returned a clean
   JSON 502: `{"message": "Assessment service is unavailable. …"}` (no hang).
