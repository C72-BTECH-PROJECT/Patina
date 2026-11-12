# Checkpoint 1: Anthony's answers and direction for Phase 2

Read this after `KICKOFF.md` and `PROGRESS.md`. Where it conflicts with `KICKOFF.md`, this file wins.

## Answers to your questions

1. **Spec checklist:** `CHECKLIST.md` is the old `IDEAL_CHECKLIST.md`, renamed. It is the only spec checklist. Fix the brief's references.
2. **CRA vs Vite:** Keep Create React App until after Nov 18. The brief was wrong to call Vite the fixed stack. Migration to Vite is a roadmap item, done together with the UI redesign after the evaluation. Before Nov 18 do only these:
   - make `CI=true npm run build` pass by fixing the lint warnings
   - correct `STEPS_TO_RUN_APP.md` to use the `REACT_APP_*` variable names
3. **Gateway commits (I-0080):** Keep Aditya's gateway work. Fix the test harness to the current ports (gateway 5000, backend 5001), and make sure CORS and rate limiting live in the gateway.
4. **`origin/aaron_v2`:** Ignore it. Do not investigate.
5. **LLM key:** Anthony adds the key to `assessment-service/.env` himself.
   - Treat **Gemini** as the provider of record, since that is what `.env.example` names. Make OpenRouter a documented fallback, or remove it, in `DECISIONS.md`.
   - Never read or print the key.
6. **Live migrations `20261103120100` and `20261103120200`:**
   - Status: both applied on live Supabase (checked in dashboard, 12 Nov). Later migrations through 20261104120300 are also applied.
   - If they are not applied, list them in `DECISIONS.md` as something Anthony runs himself. Never apply them.
7. **Test data:** Anthony runs `node tests/backend/sweep.mjs` himself. From now on, every verifier run that writes to live Supabase ends by reporting the leftover rows, and Anthony runs the sweep. Agents never delete live rows.
8. **Credential in `tests/.env.example` lines 6–7:** Anthony checks whether it is a live account and rotates the password if it is. Add an A-list card that replaces it with placeholders.

## Direction for Phase 2

**The realistic goal.** With 6 of 110 rows verified, "everything promised by Nov 18" will not happen, and the plan must say so plainly. The goal is:

- a **working, verified demo spine through the UI**, and
- an **honest, measured account** of everything else.

**The spine is list A's core.** It must work by clicking through the UI, with no direct API calls:

1. Candidate signs up and logs in.
2. Candidate uploads a resume, and parsing runs.
3. Candidate applies, and **scoring runs automatically on apply**. Wire up the existing analyze pipeline; do not build a new one.
4. The candidate sees their result.
5. The recruiter sees one application-centric dashboard (agreed with the team on 2026-10-12) with score, explanation drill-down, and working shortlist/reject.
6. The candidate takes the LLM assessment with basic anti-cheating, and the result joins the score.

Make this flow a **scripted end-to-end check the verifier can re-run**, with Playwright or an equivalent you choose. That script is the definition of done for list A.

**Also on list A. These are cheap, and each one fixes a demo risk or a rule violation:**

- Remove all 48 fabricated or misleading outputs. Where real data does not exist, show an honest empty state.
- Remove silent fallbacks:
  - A grading-LLM outage must surface as an error or a pending state, never as 0.
  - A missing NLP similarity score must count as unavailable, not as 0.
  - Database errors in notifications must surface, not come back as an empty list.
- An image-only PDF must return an explicit "can't read this file" error, not 200 with a score of 0.0. Real OCR goes on list B or C.
- Return no stack traces or raw Supabase errors to clients.
- Fix demo fragility:
  - the login rate limit must not lock out one laptop switching between demo accounts
  - the 2-second session check must not cause 503s
- The backend must bind so it is reachable only through the gateway.
- Basic anti-cheating:
  - never reveal correct answers after an attempt
  - enforce a time limit on the server
  - set a sensible attempt policy
  - randomise questions from a pool

  Proctoring is out of scope before Nov 18.
- Fix the broken UI items (contrast bugs, Recruiter Profile, mark-read, the empty resend email). This is **not** the visual redesign, which comes after Nov 18.

**Architecture.** Do not plan a decomposition of the backend before Nov 18. Name one honest target architecture:

- gateway as the single entry point
- backend as the core/orchestration service that owns the database
- three internal-only Python services

Write it into `DECISIONS.md` and the new `ARCHITECTURE.md`. Splitting the backend further is a roadmap item.

**MongoDB vs Supabase.** Do not migrate. Write a short, defensible justification for the substitution in `DECISIONS.md`: Postgres behind Supabase, row-level security, auth and storage included. Anthony will present it.

**GitHub ownership.** Anyone can currently claim another person's GitHub. Decide whether verifying ownership through a GitHub OAuth link fits on list A. If it doesn't, the demo must state the limitation.

**The heavy ML promises** (custom NER on 5,029 CVs, CodeQL/SonarQube, ≥85% accuracy, F1 ≥ 0.80, and the rest):

- Do not build them before Nov 18.
- Instead, propose **one small measured evaluation**: a labelled set of resumes and parsing precision/recall/F1 on it, with the unit and the test set defined. One real number beats unmeasured claims in front of evaluators.
- Everything else from this group goes on list B or C, with an honest status.

**Teammates.** Aaron, Aditya and Anurag are frozen from pushing code but available for non-code work. They mostly use web-chat AI without local file access, so their tasks should be light but real. Examples:

- labelling resumes for the evaluation set
- manual test passes against the demo script
- the MongoDB justification and other presentation material

Put their tasks in `TASKS.md` with an owner.

**Keep `DECISIONS.md` lean.** Give full depth only to areas that change what gets built before Nov 18. Everything after Nov 18 gets a short entry and goes to the roadmap. Budget matters more than coverage now.

**Docs.** Archive to `Docs/archive/`, not `docs/archive/`. Respect the hardcoded paths in `tests/docs/check-trackers.mjs` and `tests/assessment/test_internal_only.py`: either update those tests in the same card, or leave the files they reference in place.

**Exams start Nov 23.** No task should depend on Anthony after Nov 18 except committing.
