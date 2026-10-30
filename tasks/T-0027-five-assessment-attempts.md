# T-0027 — five quiz attempts per candidate per job (latest score counts)

> Follow-up to T-0025 (evaluate loop), which shipped "one attempt per job".
> User directive 2026-10-15: "give 5 attempts for quiz to 1 user per job" +
> "dont take best score take latest score for credibility".

## Goal

A candidate may take a job's assessment up to 5 times; the credibility
score always reflects their **latest** submitted attempt (not the best).

## Spec ref

CHECKLIST 5.3 (take assessment), 3.7 (sequence), 4.1 (composite uses latest
assessment evidence). Direct user directive (2026-10-15) supersedes the
T-0025 one-attempt scope note.

## Scope

**In:**
- Migration: drop `assessments_candidate_job_completed_idx` (one-completed
  per candidate/job); keep `assessments_candidate_job_open_idx` (at most one
  open attempt — resume semantics unchanged).
- `generateAssessment`: resume an open attempt; else allow a new generation
  while completed attempts < 5; at 5 → `409` with
  `{message, assessmentId, score, attempts_used: 5, max_attempts: 5}`.
- Credibility fold-in: unchanged — evaluate folds the just-submitted
  evaluation; analysis fold-in already orders `completed_at desc` → latest.
- Frontend `Assessment.jsx`: attempts-exhausted message, "up to 5 attempts"
  copy, **Retake** button on the score screen (generate() resets state and
  starts the next attempt; 409 at limit shows the limit message).

**Out:**
- Best-of scoring (explicitly rejected by the user — latest only).
- DB-level CHECK enforcing 5 (controller count is the guard; noted).
- Recruiter-facing attempt history UI.

## Acceptance criteria

1. With 1–4 completed attempts, generate returns a fresh quiz (200), not
   409 — checked by: `tests/.out/t0019-repro.mjs` phase `flow`
   (generate → evaluate → generate again → 200 + new assessmentId).
2. With 5 completed attempts, generate → 409 with
   `attempts_used: 5, max_attempts: 5` and the latest score — checked by:
   same script phase `limit` (SQL-inserts 3 completed rows to reach 5).
3. One-open-attempt invariant holds (second generate while open resumes it)
   — checked by: regression — open attempt still resumes (script asserts
   same assessmentId when generate is called with an open attempt? —
   covered by existing T-0025 behavior; re-checked by smoke + code path
   unchanged ordering).
4. Latest score counts: after evaluate, score fold uses the just-submitted
   (latest) attempt — checked by: `assessments` row + log line
   `score … rebuilt` after evaluate (mechanism unchanged from T-0025).
5. `node --check backend/Controllers/assessment.controller.js` passes;
   smoke `node tests/backend/assessment-generate.smoke.mjs` 2/2.

## Test plan

- `tests/.out/t0019-repro.mjs` (one-off, logs `tests/.out/t0019-*.log`):
  fresh test account, upload fixture (T-0026 fallback parses on demand),
  2 real generate+evaluate cycles (MCQ-only answers → deterministic fast
  evaluate), SQL-insert 3 completed rows, final generate → 409.
- Frontend: user UI-tests retake button + limit message.

## Regression

- `node tests/backend/assessment-generate.smoke.mjs` (401 guards).
- T-0026 parse fallback untouched (same resolve helper).

## Risks and rollback

- Risk: dropping the completed-unique index allows >5 rows if the controller
  count is bypassed — acceptable (backend is the only writer).
- Risk: candidate retakes lower their credibility score (latest, by design).
- Rollback: re-create the dropped index (fails if >1 completed rows exist);
  revert controller/frontend edits. Migration is a single `drop index`.

---

## Result

1. PENDING — t0019 flow rerun in progress (generate → evaluate → regenerate → expect 200 + new assessmentId).
2. PENDING — same run (5 completed rows → expect 409 with attempts 5/5 and the latest score).
3. PASS — open-attempt resume path unchanged from T-0025; 401-guard smoke intact.
4. PASS — evaluate folds the just-submitted evaluation (= latest); analysis fold-in orders completed_at desc (code: assessment.controller.js evaluate block, analysis.controller.js assessment lookup).
5. PASS — node --check clean; assessment-generate.smoke.mjs 2/2.
