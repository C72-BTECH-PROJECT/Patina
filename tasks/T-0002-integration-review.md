# T-0002 — integration-review

## Goal
Produce `INTEGRATION_REVIEW.md`: a change-by-change, evidence-backed decision
document (KEEP / KEEP-WITH-FIX / REVERT / NEEDS-TEAM-DECISION) for every
teammate commit and merge resolution between baseline `32905c1` and HEAD
(`Anthony_V2` @ `4ed559d`), plus a proposed apply order. The owner marks
decisions; nothing is applied in this task.

## Spec ref
PROJECT_SOURCE_DOCS.md (restored from 32905c1): FR-1, FR-2, FR-3/NFR-1, NFR-5,
plus CLAUDE.md "Known guide feedback" #2, #3, #4, #5. Standing decisions are read
from `git show 32905c1:AUDIT.md` / `32905c1:CHECKLIST.md` (both deleted at HEAD
by 314e494; read-only, not restored here).

## Scope
**In:**
- Run the T-0001 harness against current (`-Target current`, tiers 1+2,
  frontend build) and diff against `tests/BASELINE_RESULTS.md` + baseline
  snapshots.
- Classify every hunk group of: 4fc97db, 04835ca, d78b52a, ad4f694 (Aditya);
  71c632d, 08afde3, 314e494 (Aaron); merges e7bf01b, 5d2bea8, 72451d1, cc0e637
  (conflict resolutions via `git show --remerge-diff`).
- Deep review of 314e494 (fixture by fixture vs the four 32905c1 parsing fixes)
  and 71c632d.
- Schema/DB: migrations, `applications`, RLS, storage, persistence,
  explainability service.
- Owner additions (approval message):
  1. Confirm explicitly whether 314e494 adds anything beyond 71c632d's tree; if
     not, open question for Aaron: unpushed local NLP work?
  2. Apply step 1: compare (a) `git revert --no-commit 314e494` (gets back only
     to e7bf01b + 08afde3 state — say what must still be restored afterwards)
     vs (b) file-by-file restore from 32905c1; recommend one.
  3. Rows for docs 314e494 deleted (AUDIT.md, CHECKLIST.md,
     Docs/project_checklist.md); note CODE_MAP.md / REVIEW_BRIEF.md staleness;
     record relation to Docs/IMPLEMENTATION-TRACKER.md as input to the tracker
     task (no decision here).
  4. KEEP for clean merges (5d2bea8, 72451d1, cc0e637) needs harness or code
     evidence, not just an empty remerge-diff.
  5. A short, blame-free "For the team" section shareable with Aaron and Aditya.
- New out-of-scope problems → ISSUES.md; notes on existing entries where root
  cause is found.

**Out:**
- Any code, config, migration or harness change. Restoring any file. Staging,
  committing, branching.
- Deciding the tracker reconciliation (I-0008) — only inputs recorded.

## Acceptance criteria
1. Harness ran against current; recorded pytest counts, backend tier 1 x/7,
   tier 2 outcome, frontend build exit + warnings — checked by:
   `tests/.out/current-*.log`; `node tests/backend/sweep.mjs --check` all 0
   before and after.
2. All 6 synthetic + 3 private snapshots diffed vs baseline; no PII from private
   resumes in committed files — checked by: `rg` for each fixture id in
   INTEGRATION_REVIEW.md; manual read of the private rows.
3. All 11 teammate SHAs appear in the summary table — checked by: `rg -c <sha>
   INTEGRATION_REVIEW.md` for each.
4. Every row has exactly one of the four classes and ≥1 concrete cite (harness
   diff, failing test, `file:line@sha`, spec ref); KEEP-WITH-FIX states the
   exact fix; NEEDS-TEAM-DECISION gives both sides — checked by: manual read;
   `rg -i "looks fine"` returns nothing.
5. e7bf01b conflict hunks classified individually; 5d2bea8/72451d1/cc0e637
   record empty remerge-diff AND harness/code evidence for their class
   (owner addition 4) — checked by: manual read of the merges section.
6. 314e494 section: tree-hash proof, explicit "adds nothing beyond 71c632d"
   statement + open question for Aaron, fixture-by-fixture table for the four
   fixes; 71c632d at same depth; 4fc97db, 04835ca, d78b52a, ad4f694 present —
   checked by: manual read.
7. Schema/DB section covers migrations, `applications`, RLS, storage,
   persistence, explainability at HEAD — checked by: manual read.
8. Apply order present, with the (a) revert vs (b) restore comparison and a
   recommendation (owner addition 2) — checked by: manual read.
9. Docs rows (AUDIT.md, CHECKLIST.md, Docs/project_checklist.md) +
   CODE_MAP/REVIEW_BRIEF staleness + tracker relation (owner addition 3);
   "For the team" section (owner addition 5) — checked by: manual read.
10. No code changed — checked by: `git status --porcelain` lists only
    INTEGRATION_REVIEW.md, tasks/T-0002-integration-review.md, ISSUES.md,
    WORKLOG.md, tests/nlp/snapshots/current/ (plus already-untracked
    PROJECT_SOURCE_DOCS.md if still untracked).

## Test plan
- Tests to write FIRST: none — review task, no behaviour change. Uses the
  unchanged T-0001 harness.
- Criteria that can't be automated: 4–9 (judgment about classification and
  completeness of the document).

## Regression
- `tests/run-suite.ps1 -Target current` is the measurement itself; the baseline
  results in `tests/BASELINE_RESULTS.md` are the comparison.

## Risks and rollback
- Risk: tier 2 writes to the shared Supabase project (scoped to t0001_ accounts,
  swept before/after, aborts above 50 rows).
- Rollback: delete INTEGRATION_REVIEW.md, this file, the snapshots/current
  folder; revert ISSUES.md/WORKLOG.md hunks. No code touched.

---

## Result

1. **PASS.** Harness ran against the current tree.
   - **Deviation:** the owner's dev stack held ports 8000/5000/3000 and was not stopped, so a scratchpad runner mirroring `run-suite.ps1 -Target current` used NLP 8200 / backend 5200, with the same test files and env pins.
   - **NLP:** `10 passed in 5.86s`; rerun after restart `10 passed in 3.99s`. All 9 snapshot hashes equal between the two runs.
   - **Backend tier 1:** 7/7.
   - **Backend tier 2:** FAIL, `HTTP 500 {"error":"path is not defined"}` (`tests/.out/current-backend-tests.log`).
   - **Frontend:** `CI=true` build exits 1 with 21 warnings; the build without CI compiles.
   - **Sweep:** `sweep.mjs --check` all 0 before the run, after teardown, and at the end of the session.
2. **PASS.** All 9 fixture ids appear in INTEGRATION_REVIEW.md §3.3. The private rows give only counts, shapes and title first words. A grep for private file names, project names, emails and phones in INTEGRATION_REVIEW.md and ISSUES.md returns nothing.
3. **PASS.** Every SHA appears in the summary-table rows (`grep '^| R'`): 4fc97db 3, 04835ca 3, d78b52a 2, ad4f694 13, 71c632d 11, 08afde3 4, 314e494 12, e7bf01b 4, 5d2bea8 1, 72451d1 3, cc0e637 1.
4. **PASS (self-check; owner to confirm by reading).**
   - 41 rows, each with exactly one class and at least one `file:line@sha`, harness or spec cite.
   - KEEP-WITH-FIX rows state the fix. NEEDS-TEAM-DECISION rows give both sides.
   - `grep -ci "looks fine"` returns 0.
   - Every REVERT or KEEP-WITH-FIX claim taken from the two review subagents was re-checked with targeted `git show`/`grep` before writing.
5. **PASS.**
   - §5 and rows R12–R15 cover e7bf01b's conflict hunks.
   - 5d2bea8 (R27), 72451d1 (R28) and cc0e637 (R41) each record the empty remerge-diff plus code or harness evidence. 72451d1 is classified REVERT (effect), not KEEP.
6. **PASS.**
   - §3.1: tree-hash proof, the explicit "adds nothing new" statement, and Q1 for Aaron.
   - §3.3: fixture-by-fixture tables for the 4 fixes plus the education leak.
   - §4: 71c632d.
   - Aditya: R1–R3 and R29–R40.
7. **PASS.** §7 covers migrations, the live DB (read-only counts), `applications`, RLS, storage, persistence and explainability.
8. **PASS.** §9 compares (a) and (b). Option (a) was simulated with `git merge-tree` (1 conflict). It also found that (a) alone leaves the backend unable to boot. Recommendation: (a), then hand-merge 3 backend files.
9. **PASS.** R24–R26 and §8 cover the docs, CODE_MAP/REVIEW_BRIEF staleness and the tracker inputs, with no decision taken. §10 is "For the team".
10. **PASS.** `git status --porcelain` shows:
    - `M ISSUES.md`, `M WORKLOG.md`
    - `?? INTEGRATION_REVIEW.md`, `?? tasks/T-0002-integration-review.md`, `?? tests/nlp/snapshots/current/`

    No code was changed. Notes:
    - `git merge-tree` wrote unreferenced objects to `.git/objects` (no ref, index or working-tree change).
    - The git-ignored `frontend/build/` was rebuilt by the build suite.
