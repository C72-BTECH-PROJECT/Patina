# T-0028 — backlog-plan

> Status: **executed 2026-11-03** (docs only). The owner's prompt set the acceptance
> criteria, so no separate approval round was needed. One deviation was approved
> mid-task: a one-line checker change to accept `P0-n` ids.

## Goal
Re-verify every open issue at `df98068`, resolve the ones already fixed, and assign every
remaining open issue to exactly one Phase 0 batch in ROADMAP.md. Then draft T-0029 for B1.

## Spec ref
None directly. This is planning. It serves CLAUDE.md `GR-1` (P0-5) and ROADMAP's
coverage rule.

## Scope
**In:**
- ROADMAP.md (Phase 0, the execution order, re-mapping the old rows, retiring P3-13..P3-17);
- ISSUES.md;
- `tasks/T-0028-backlog-plan.md` and `tasks/T-0029-security-batch.md`;
- WORKLOG.md;
- `tests/docs/check-trackers.mjs`: the `P[1-9]` → `P[0-9]` change only. The owner chose
  this over a docs-only workaround.

**Out:** all code, migrations and config. AUDIT.md and CHECKLIST.md are unchanged: no
status moved.

## Acceptance criteria
1. Every open issue is re-verified against `df98068`, and the ones already fixed move to
   Resolved with evidence. Checked by: the Result table below, and the ISSUES.md diff.
2. ROADMAP has a Phase 0 section that maps every remaining open issue to exactly one
   batch, plus AUDIT rows 3.2 and 3.10. Checked by: the mapping script in Result.
3. The execution order line reads B1 → B2 → B3 → T-0019 → T-0020 → T-0021 → B5 → GR-1
   design → B6, then the rest. Checked by: ROADMAP "How to read this".
4. `tasks/T-0029-security-batch.md` exists in TEMPLATE format. It covers I-0055, I-0066
   (with I-0061), I-0056, I-0058 with I-0017, and I-0069, each with a test that fails
   before the fix. Checked by: reading the file.
5. `node tests/docs/check-trackers.mjs` passes with 0 warnings. Checked by: running it.

## Test plan
Docs task. The checker is the only automated check.

## Regression
`node tests/docs/check-trackers.mjs` (the `docs` suite).

## Risks and rollback
Docs only. Revert the files. The checker change only widens the accepted ids.

---

## Result

1. **PASS.** Subagent reads plus direct checks at `df98068`:
   - **Resolved, 2:**
     - **I-0070:** the project host resolves (`nslookup`), and
       `node --test tests/backend/smoke.test.mjs` passes 7/7. That includes "unknown
       username → 401", which was 503 in T-0023.
     - **I-0051:** `AUDIT.md:77` and `:212` already say all 3 services exist.
   - **Partly fixed, still open, status notes added:** I-0004, I-0012, I-0039, I-0045.
   - **Still present:** the other 45, listed below with their current lines.

   | Issue | Evidence at `df98068` |
   |---|---|
   | I-0055 | `20260823_create_profiles.sql:58` direct cast; no later migration redefines `handle_new_user` |
   | I-0056 | `analysis.routes.js:13`, `analysis.controller.js:205-234` (no ownership or UUID check) |
   | I-0066 | `20261015_create_assessments.sql:50-62` (both policies cover all columns); `assessment-service/app/main.py:35-38` |
   | I-0061 | `assessment-service/app/main.py:10-17` (no docs URLs disabled) |
   | I-0058 / I-0017 | `auth.controller.js:257-271` (insert, log only, then 201) |
   | I-0069 | `assessment.controller.js:346-358`, `:396-407` (no row-count check) |
   | I-0057 | `20260903_*` ×2, `20261015_*` ×2 |
   | I-0010 | unguarded `create` in every migration except `20260831` and `20260901` |
   | I-0001 | bucket row exists (`20260903_create_resumes_and_scores.sql:14-16`); no MIME list or size cap |
   | I-0041 | `20260903_create_resumes_and_scores.sql:52-53` |
   | I-0063 | `jobs.controller.js:214`, `:224` |
   | I-0028 | `analysis.controller.js:542`, `:554`, `:567` |
   | I-0029 | `jobs.controller.js:256-272` |
   | I-0027 | `backend/index.js:73` |
   | I-0025 | `analysis.controller.js:11` |
   | I-0053 | `analysis.controller.js:486-491`; `JobDetails.jsx:99` |
   | I-0065 | `explainability.js:776` |
   | I-0062 | `assessment.controller.js:242`, `:369` |
   | I-0060 | `assessment-service/README.md:249`, `:252`, `:270`; no `ASSESSMENT_SERVICE_URL` in `backend/.env.example` |
   | I-0059 | `ner.py:5`, `preprocessor.py:7` |
   | I-0067 | `prompts.py:116-117`; `evaluator.py:99-100`, `:116` |
   | I-0006 | `Upload.jsx:129-138` (validation only at `:144`) |
   | I-0016 | `auth.controller.js:212-216` |
   | I-0026 | `Landing.jsx:61`, `:171`, `:305` |
   | I-0040 | `ner.py:552`; `CandidateModal.jsx:132-134` |
   | I-0054 | `Jobs.jsx:125` (`count={0}`) |
   | I-0068 | `AllCandidates.jsx:4`, `:8`; `CandidateLayout.jsx:10`; `RecruiterLayout.jsx:8` |
   | I-0052 | no annotation reading in `nlp-engine/app`; T-0017 still a draft |
   | I-0048 | `github-evidence/app/scoring.py:23` |
   | I-0034 | `nlp-engine/app/main.py:13-24`; `analysis.controller.js:271-284` |
   | I-0035 | `backend/index.js:31-42`; `auth.routes.js:18`; `auth.controller.js:347-349` |
   | I-0036 | `analysis.controller.js:306-312`, `:427`; `index.js:67-69` |
   | I-0037 | `nlp-engine/app/main.py:49` (`async def`) |
   | I-0038 | unpinned `nlp-engine/requirements.txt`; 3 venvs; `README.md:87` says 3.11 |
   | I-0030 / I-0031 / I-0032 / I-0033 | `CODE_MAP.md:10`; `REVIEW_BRIEF.md:21-23`; `README.md:50`, `:87`; `PROJECT_SOURCE_DOCS.md:106` |
   | I-0042 | `tests/docs/check-trackers.mjs:99` (cite regex) |
   | I-0043 / I-0044 | ROADMAP P1-3 row; ROADMAP §1.6 `--disable-socket` |
   | I-0046 | `github-evidence/requirements-dev.txt:5` (warning not re-run) |
   | I-0050 | `tests/arch/nlp-outage-probe.mjs:393` |
   | I-0064 | WORKLOG.md 451 lines before this entry |
2. **PASS.** All 49 open issues map to exactly one batch:
   - P0-1: 7 issues
   - P0-2: 4
   - P0-3: 12
   - P0-4: 6
   - P0-5: 1
   - P0-6: 11
   - B4: 8, through their owning rows (P2-1, P2-2, P2-3, P2-4, P2-6, P2-7, P1-10, P3-12).
     I-0034, I-0035 and I-0036 are split across their owning specs on purpose.

   3.2 and 3.10 → P3-1. P3-13..P3-17 are retired, and their issues are re-mapped. The
   proposed batch changes (9) are listed in ROADMAP and **not applied**.
3. **PASS, with a flagged conflict.**
   - The line is written as the owner gave it.
   - The dependency check against "Depends on" finds one violation: P2-3 (T-0020)
     depends on P2-1 (T-0018), which the line runs after it. The proposed order is
     `B3 → T-0019 → T-0018 → T-0020 → T-0021`. The owner decides.
   - Every other step comes after its dependencies.
4. **PASS.** T-0029 covers (a)–(e), and each criterion names a test that fails before the
   fix, plus the "before" signal.
   - The fail-before of the live I-0055 test depends on whether the project already has
     an admin. That is stated, and the static migration test is the guaranteed one.
5. **PASS.** `check-trackers: ids 91/91 matched, 91 rows OK, verified at 2e87d44;
   ARCHITECTURE.md 261 cites OK; ROADMAP.md 37 items OK, 0 warning(s)`. The run before
   T-0028 had 18 warnings.
