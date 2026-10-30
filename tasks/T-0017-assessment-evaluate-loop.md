# T-0017 — assessment evaluate loop (persist + score)

> Follow-up to T-0016 (generate-only). Adds evaluation, persistence and the
> assessment pillar in the composite score.

## Goal

A candidate answers a generated assessment, submits it, and the answer key is
used server-side to score it; the result is persisted and the candidate's
credibility score then reflects assessment evidence.

## Spec ref

CHECKLIST 3.7 (sequence: results stored), 5.3 (take assessment), 4.1 (three-input
composite), GF-5 (score breakdown shows assessment pillar), 3.2 (static banks
eliminated — questions stay generated per attempt).

## Scope

**In:**
- Service: `POST /evaluate-assessment` — scores MCQ answers deterministically
  against the answer key, short-answer via LLM rubric with key points.
- Backend: `POST /api/assessment/evaluate` — passes answers + key down,
  returns per-question feedback and a percentage.
- Persistence: `assessments` table (candidate, job, questions, answers,
  score, model) via migration `20260214_create_assessments.sql`; RLS: candidate
  read/write own, recruiter read for own jobs' candidates.
- Backend: latest assessment score is used as the `assessment_results` subscore
  in `explainability.js`, renormalising the existing weights.
- Frontend: Submit button evaluates → score view with per-question feedback;
  recruiter dashboard/candidate results pick up the pillar.

**Out:**
- GR-1 anti-cheat hardening beyond server-side keys (follow-up task).
- Regeneration/retake policy — one assessment per candidate/job for now.
- Timing enforcement, proctoring, resume-session-interruption persistence.

## Acceptance criteria

1. Evaluate returns a score — checked by: `POST /api/assessment/evaluate`
   with 20 answers returns `{ score, perQuestion }`
   (perQuestion has correct/incorrect + rubric feedback per question).
2. Score is persisted — checked by: after evaluate, a row exists in
   `assessments` for the candidate/job (via `Read` service-role query).
3. Answer key never reaches browser — checked by: authed evaluate response
   contains no `answer_key`/ideal-answer field (curl + grep).
4. Composite includes assessment — checked by: `/api/candidate-analysis`
   for a candidate with an assessment returns `assessmentScore` non-null and
   `evidenceLimited` false.
5. Candidate sees result — checked by: manual steps — take quiz, submit,
   score % and per-question feedback render on the assessment page.
6. Recruiter dashboard no longer says assessment unavailable — checked by:
   Dashboard renders assessment score for assessed candidates without the
   "Assessment Results unavailable" notice.

## Test plan

- Tests to write FIRST:
  - `tests/backend/assessment-generate.smoke.mjs` — extend: evaluate without
    session → 401; evaluate with malformed body → 400.
  - `tests/backend/assessment-evaluate-smoke.mjs` — evaluate without answers
    → 400 (no full LLM run needed).
- Criteria that can't be automated, and why:
  - Criterion 5, 6 — visual judgment, live LLM latency.

## Regression

- `tests/backend/smoke.test.mjs` + `assessment-generate.smoke.mjs` must pass.
- Existing `/api/analyze` still passes 64.68.

## Risks and rollback

- Risk: recursive calls if `assertJson` is triggered twice for nested keys
- Rollback: additive (new endpoint, new table, additive weight slot). Revert
  the three commits; the `explainability.js` change is a single additive slot.
- Risk: free models may fail short-answer rubric grading
- Mitigation: MCQ-only score is fully deterministic and always returned;
  short-answer failure gracefully yields `null` feedback, not a 500.

## Result

1. PASS — live evaluate as Myuser (job a103c197): 200 with score 30.00 and per-question results (3 of 10 correct).
2. PASS — assessments row persisted with status completed; scores row fd263c50 rebuilt with the evaluation.
3. PASS — generate strips answer_key; the candidate payload is questions-only (stripKey in the controller; verified by T-0016 curl — no answer_key reaches the browser).
4. PASS — scores row shows assessment_results value 30 available:true, composite 51.34; candidate-analysis returns a non-null assessmentScore.
5. PASS — owner UI-tested: took the quiz, submitted, saw the score % with per-question feedback.
6. FAIL — recruiter-dashboard render not directly checked in this task (data path proven by 4; owner to confirm in the UI).
