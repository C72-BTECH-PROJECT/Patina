# T-0008 — tracker-reconciliation

> Approved by the owner 2026-10-12 with the D1 answer and additions below.

## Context
Four files claim to say what exists or should exist, at three trust levels
(INTEGRATION_REVIEW §8, R40, Q5). CLAUDE.md names two of them wrongly
(`IDEAL_CHECKLIST.md` → file is `CHECKLIST.md`; `project_checklist.md` → file is
`Docs/project_checklist.md`). `AUDIT.md` is byte-identical to `32905c1`, so it
predates T-0003..T-0007. `Docs/IMPLEMENTATION-TRACKER.md` plans Firestore (never
implemented, I-0008) and claims "MongoDB models", "Custom NER" and recruiter
charts/alerts as done; the code contradicts all three. Next free number: T-0008
(T-0001..T-0007 exist).

## Goal
One source of truth for "what should exist" and "what verifiably exists", every
status backed by evidence and mapped to a spec id and a delivering task/commit,
with the Firestore/MongoDB drift removed and I-0008 resolved.

## Spec ref
CLAUDE.md "Known guide feedback" 1-5 (= `GF-1..GF-5` as labelled in CHECKLIST.md
line 8; PROJECT_SOURCE_DOCS.md has them unnumbered at lines 51-59);
INTEGRATION_REVIEW R40, R9, R38, Q5; ISSUES I-0008. No FR/NFR is changed.

## Scope
**In:** CLAUDE.md (names only); CHECKLIST.md; AUDIT.md; the two other tracker
files (archive/merge per D1); ISSUES.md (resolve I-0008, new stale-doc entries);
the task's own Result; WORKLOG entry; one small doc-consistency check script
(`tests/docs/check-trackers.mjs`, read-only, so criteria 4-6 are re-runnable)
and its wiring into `tests/run-suite.ps1` as a `docs` suite (owner addition).
**Out:** any code or migration; fixing CODE_MAP/REVIEW_BRIEF/README/
PROJECT_SOURCE_DOCS (list only); editing the spec's MongoDB wording; building
OCR/LinkedIn/anti-cheat/score-on-apply (only adding them as spec items);
commits, staging (owner does VCS). Pre-existing dirty files (`ISSUES.md` edit,
`PR_DESCRIPTION.md`) are the owner's; I only append to ISSUES.md.

## D1 answer (owner, 2026-10-12, verbatim)
> D1: approved as recommended. CHECKLIST.md and AUDIT.md stay at the root;
> Docs/project_checklist.md and Docs/IMPLEMENTATION-TRACKER.md go to
> Docs/archive/ with the headers you proposed, after IMPLEMENTATION-TRACKER's
> missing features are diffed into CHECKLIST. Record this as the D1 answer
> and proceed without stopping. I'm informing Aditya myself.

Owner additions (same message):
- Guide-review items, owner-reported, **no written source** (record as such):
  - GR-1: "Before the LLM/PFQS assessment module is built, design a mechanism
    that prevents candidates from cheating on it." (guide review, Sep 2026)
  - GR-2 (new): "Identify the API gateway and verify the system actually
    follows the microservices architecture claimed in the SRS; fix it if it
    doesn't." (guide feedback, Oct 2026). Status: unverified, pending the
    architecture audit, which is the next task.
- Add `tests/docs/check-trackers.mjs` to `tests/run-suite.ps1` as a `docs`
  suite (no live services), so tracker drift fails the harness from now on.

## Step 1 — PROPOSAL (approved as D1 above)

| File | Role | Proposed action |
|---|---|---|
| `CHECKLIST.md` (root) | **Spec-derived list.** The only place item ids live. | Keep, same name. Add items (step 4). Header keeps the GF-n definition. |
| `AUDIT.md` (root) | **Code-verified status.** One row per CHECKLIST id. | Keep, rewrite in place (git holds the 32905c1 version). Add a one-screen summary table on top (this is what the team reads). New columns: spec id, status, evidence, delivered by, verified-at commit. |
| `Docs/project_checklist.md` | self-reported | **Archive** to `Docs/archive/project_checklist.md` with header: "self-reported, superseded by AUDIT.md on 2026-10-12, boxes are not evidence". Not regenerated: a second derived file is a third copy to drift. |
| `Docs/IMPLEMENTATION-TRACKER.md` | self-reported + Firestore plan | **Archive** to `Docs/archive/` with header stating why (Firestore plan never implemented; three done-claims contradicted by code). Before archiving I diff its "Missing Features" (lines 56-154) against CHECKLIST and add any item CHECKLIST lacks; its Supabase-table content is replaced by the verified data model in AUDIT (step 5). |
| `CLAUDE.md` | | `IDEAL_CHECKLIST.md` → `CHECKLIST.md`; `project_checklist.md` → `Docs/project_checklist.md` (archived path after D1); say AUDIT.md/CHECKLIST.md exist (drop "if they don't exist, stop"); add "GF-n = Known guide feedback n" and the evidence rule ("DONE needs file:line + test/harness result, same bar for every author"). |

Alternatives for the owner: keep `project_checklist.md` as a team-facing summary
auto-derived from AUDIT (more files, more drift); or merge IMPLEMENTATION-TRACKER's
tech-stack/free-tier/perf sections into README instead of archiving. I recommend
the table above (fewest files; CLAUDE.md prefers consolidating).

## Steps 2-6 (after D1)

**2. Bring AUDIT.md up to HEAD.** Re-verify module by module (CLAUDE.md: one
module at a time; read-only Explore agents read the code, I spot-check every
file:line I record). Status vocabulary: the existing four plus
`CLAIMED_UNVERIFIED` for anything I cannot confirm (including Aditya's and
Aaron's self-reports, same bar as everyone). Each `DONE_CORRECTLY` row needs
file:line at HEAD plus a test name or harness result. Existing DONE rows with no
line evidence today (4.1-4.7, 5.x, 1.5, 1.14, 0.2, 0.3, 0.5, 2.4) are
re-verified or downgraded. Fold the 135-line dated preamble into a short
changelog. T-0003..T-0007 effects to record: apply flow and `/api/analyze`
restored (R9), explainability.js and ScoreBreakdown restored (4.5/5.7), token-
gated reset (0.4), shortlist ownership (T-0004), `notifications/send` removed
(T-0005), fail-closed `requireAuth` (T-0006), analysis isolation (T-0007),
mongoose gone, `scores`/`resumes` migration present (I-0007/I-0013 stale).

**3. Mapping.** Every AUDIT row: spec id (FR/NFR/GF/M/LR/§) and "delivered by"
(T-number and/or commit; pre-T-0001 work gets the commit found via `git log`,
else `unattributed ≤32905c1`).

**4. Missing spec items to add to CHECKLIST (and a MISSING/PARTIAL row in AUDIT).**
- GF-2 OCR: 1.2 exists; add "unreadable input is signalled, not a 200 with score
  0.0" (tests/BASELINE_RESULTS.md:80, f6).
- GF-1 LinkedIn/certificates: 4.10 is the only item; add LinkedIn URL and
  certificate extraction to Module 1 and display in Module 5.
- GF-3 support/maintenance: 2.9/4.8 exist; add skill-vocabulary coverage for
  support roles and a fairness measurement; cite f3 Weak 0.4138 and f4 Weak
  0.4354 (BASELINE_RESULTS.md:78-79) and the below-off-profile-developer result
  (:89-92: 0.41/0.44 vs f2 0.48, cause `skill_coverage`, not semantic score).
- GF-4 GitHub optional: covered (2.7, 2.8, 4.7, 5.2, 5.10); verify, and note the
  f4 "not on GitHub" false positive (:79).
- GF-5 explainability: covered (4.4, 4.5, 5.7); re-verify against HEAD.
- Assessment anti-cheat: **no written source in the repo** (grep: only
  "un-cheatable" meaning non-reusable questions, spec lines 29/71/204, CHECKLIST
  3.2). Added as `GR-1` using the owner's wording above, marked owner-reported.
- `GR-2` microservices/API gateway (owner-reported, Oct 2026): added as a
  CHECKLIST item (extends 0.1) with AUDIT status `CLAIMED_UNVERIFIED`, pending
  the architecture-audit task. 0.1's own AUDIT row is not re-judged here beyond
  what I read in the code; the gateway question is left to that task.
- Score-on-apply (R9) and merged recruiter dashboard (R38): new items in
  Module 5 (FR-12, FR-14, FR-15), status `STUBBED_OR_PARTIAL`/`MISSING` per the
  code, cites INTEGRATION_REVIEW R9/R38/Q2/Q4.

**5. Data model, resolve I-0008.** Replace Firestore/MongoDB content with a
verified Supabase table list in AUDIT (from `supabase/migrations/`, 6 files):
`profiles` (+ `patina_user_role`, admin, suspension), `jobs`, `applications`,
`notifications`, `resumes` (+ private bucket `resumes`), `scores`. Mapping of
the tracker's names: `users` → `auth.users` + `profiles`; `job_descriptions` →
`jobs`; `parsed_profiles` → columns on `resumes` (skills, experience, education,
projects, contact; not a separate table); `credibility_scores` → `scores`
(composite + subscores/weights/explanation jsonb); `audit_logs`, `github_metrics`,
`assessments` → none (gaps). I-0008's table (ISSUES.md:178-188) is stale on
`scores`, and its note at :205 (CHECKLIST/AUDIT "missing at HEAD") is stale;
both are corrected in the resolution. I-0008 moves to Resolved with evidence.
Also noted: I-0001 (bucket) is partly stale: bucket is created in
`20260903_create_resumes_and_scores.sql:14-16`; it lacks a mime allow-list and
size limit in the migration. I add a note to I-0001, I do not resolve it.

**6. Stale docs, list only.** New ISSUES entries (none exists as a standalone):
- `CODE_MAP.md`: written at 32905c1; 33 refs to items missing at HEAD at review
  time (INTEGRATION_REVIEW §8); stale rows noted in I-0002.
- `REVIEW_BRIEF.md`: "every claim traces to AUDIT.md or CODE_MAP.md"; 93 refs
  to missing items at review time.
- `README.md`: says tables/persistence are pending (lines 5, 39, 40, 50, 160,
  198) and jobs are in-memory (38, 149-150), all false (jobs.controller.js:57
  inserts to Supabase); API table omits ~12 routes; env block omits
  `NLP_PARSE_URL`, `CREDIBILITY_WEIGHTS`, `REACT_APP_API_BASE_URL`; corrupted
  tree glyphs (76-78); changelog ends 2026-09-01.
- `PROJECT_SOURCE_DOCS.md`: MongoDB wording vs Supabase (from I-0008 note).
- Minor, folded into the I-0008 resolution text, not separate: INTEGRATION_REVIEW
  §8 says `Docs/Architecture.md` is present; it was deleted again in `a7c74e4`.
Each entry re-verified against HEAD when written.

## Acceptance criteria
1. D1 decision recorded in the task file (owner's answer verbatim) before any
   file other than the task file is changed — checked by: manual (you decide);
   `git diff --name-only` at the time of D1 shows no tracker files changed.
2. CLAUDE.md references only files that exist — checked by: `grep -n
   "IDEAL_CHECKLIST" CLAUDE.md` → no output; each backticked `*.md` path in
   CLAUDE.md passes `test -f`.
3. Archived files exist under `Docs/archive/` each starting with a header giving
   the reason and date, and no longer exist at their old paths — checked by:
   `head -5` of each + `test ! -f` on the old path.
4. Every CHECKLIST id has exactly one AUDIT row and vice versa — checked by:
   `node tests/docs/check-trackers.mjs` → "ids: N/N matched", exit 0.
5. Every `DONE_CORRECTLY` row has a `file:line` that exists (file present, line
   ≤ length) and a test/harness reference; every row has a spec id and a
   "delivered by" — checked by: same script, exit 0; plus I spot-read all
   `DONE_CORRECTLY` cites and list them in Result.
6. Nothing in AUDIT is marked DONE on the strength of a checkbox in
   project_checklist/IMPLEMENTATION-TRACKER — checked by: script fails if a row
   cites only those files as evidence.
7. New spec items from step 4 exist in CHECKLIST with ids and in AUDIT with a
   status — checked by: grep of each GF/GR/R9/R38 tag in both files.
8. No Firestore/Firebase/MongoDB claims remain outside `Docs/archive/` and
   ISSUES/WORKLOG history — checked by: `grep -rniE "firestore|firebase|mongo"
   *.md Docs/*.md` (excluding PROJECT_SOURCE_DOCS.md, which is out of scope and
   listed as an issue) → only intentional mentions, each listed in Result.
9. I-0008 is under Resolved with evidence; four new stale-doc entries exist
   with evidence — checked by: grep `ISSUES.md` for the ids.
10. Status-change report exists in the task Result: one line per changed item,
    `id: old → new, reason` — checked by: line count equals the count of rows
    whose status differs from AUDIT@32905c1 (script diff).
11. Docs-only: `git diff --name-only` lists only `*.md` files,
    `tests/docs/check-trackers.mjs` and `tests/run-suite.ps1`; no commit, no staging, nothing under
    `backend/ frontend/ nlp-engine/ supabase/` — checked by: that command.
12. The `docs` suite runs from the harness and fails on drift — checked by:
    `powershell -File tests
un-suite.ps1 -Target current -Suites docs` → exit
    0 with no services started; with one CHECKLIST id temporarily removed it
    exits 1 (then restored).

## Test plan
- Write `tests/docs/check-trackers.mjs` first; it must fail against the current
  AUDIT (missing new ids, old statuses, no `delivered by` column) and pass at the
  end. Criteria 1, 7 (wording) and the OCR/anti-cheat source question are manual.
- No code runtime is exercised, so no live/stack runs.

## Regression
Docs-only. `tests/run-suite.ps1` tier 1 is not re-run unless any file under
`tests/` other than the new script changes (it will not).

## Risks and rollback
- Risk: honest re-verification will downgrade many AUDIT rows that read DONE;
  expect a longer status-change list. Line numbers rot, so each row records the
  HEAD commit it was verified at.
- Risk: the anti-cheat item rests on an owner-reported source with no document.
- Risk: archiving hides Aditya's roadmap; mitigated by diffing it into CHECKLIST
  first and keeping the archive copy.
- Rollback: all changes are text files in the dirty tree; `git checkout --` the
  files or restore from `Docs/archive/`; no migration or code to undo.

---

## Result
Verified at HEAD `2e87d44` (branch `Anthony_V3`). Nothing committed or staged (`git diff --cached --name-only` → 0 lines).

1. PASS — D1 answer recorded verbatim in "D1 answer" above. The owner gave it in the same message as the spec approval; no tracker file was changed before it was recorded (first change after: the archive step).
2. PASS — `grep -n "IDEAL_CHECKLIST" CLAUDE.md` → no output; the backticked `*.md` paths in CLAUDE.md all pass `test -f` (AUDIT.md, CHECKLIST.md, Docs/archive/IMPLEMENTATION-TRACKER.md, Docs/archive/project_checklist.md, tasks/TEMPLATE.md). The script re-checks this on every run.
3. PASS — `Docs/archive/project_checklist.md` and `Docs/archive/IMPLEMENTATION-TRACKER.md` each start with an "ARCHIVED 2026-10-12 (T-0008)" header with the reason; `test ! -f` on `Docs/project_checklist.md` and `Docs/IMPLEMENTATION-TRACKER.md` → both gone.
4. PASS — `node tests/docs/check-trackers.mjs` → `ids 91/91 matched, 91 rows OK, verified at 2e87d44`, exit 0. Red run before AUDIT was rewritten: 85 problems, exit 1.
5. PASS — same script exit 0: every row has a spec id and "delivered by"; every cite points at an existing file and a line within it; the 3 DONE_CORRECTLY rows (1.1, 1.6, 4.4) each have a valid cite and an existing `tests/` reference. Spot-read by me: `nlp-engine/app/extractor.py:22-29`, `tests/nlp/test_parse.py:93-103`, `nlp-engine/app/embedder.py:11,26-33,138-143`, `backend/Services/explainability.js:451-466`, `backend/Controllers/analysis.controller.js:104-116,335-341`, `supabase/migrations/20260903_create_resumes_and_scores.sql:41-60`, `tests/backend/live-analyze.test.mjs:52-70`. Also read (for the downgrades and new rows): `backend/Controllers/jobs.controller.js:102-146`, `backend/Controllers/analysis.controller.js:262-269`, `frontend/src/App.jsx:50-64`, `frontend/src/pages/candidate/Upload.jsx:150-175`. The other cites come from the four Explore agents' reads and are range-checked by the script, not individually re-read by me. Caveat: the tests behind 1.1 and 1.6 assert response shape and snapshots, not correctness.
6. PASS — the script fails if a DONE_CORRECTLY row cites `Docs/archive`, `project_checklist` or `IMPLEMENTATION-TRACKER`; no row does.
7. PASS — CHECKLIST has 1.15, 1.16, 1.17, 4.12, 5.13, 5.14, 5.15, GR-1, GR-2, X-1, X-2 and the updated GF map; AUDIT has a row for each plus GF-1..GF-5 (script requires GR-1, GR-2, X-1, X-2 and GF-1..GF-5).
8. PASS — `grep -rniE "firestore|firebase|mongo" --include=*.md` outside `Docs/archive/` hits only intentional mentions, each listed in the I-0008 resolution (CHECKLIST 0.2, CLAUDE.md, AUDIT, REVIEW_BRIEF, PROJECT_SOURCE_DOCS, history files, `tests/BASELINE_RESULTS.md:25`). Code has no Firestore, Firebase or MongoDB store; hits are skill keywords and sample text.
9. PASS — I-0008 is under Resolved with evidence; I-0030 (CODE_MAP), I-0031 (REVIEW_BRIEF), I-0032 (README), I-0033 (PROJECT_SOURCE_DOCS MongoDB wording) exist with evidence re-checked at HEAD. A note was added to I-0001 (partly stale), not resolved.
10. PASS — `node tests/docs/check-trackers.mjs --changes` prints 25 `id: old -> new` lines (list below); AUDIT rows whose status differs from `32905c1` = 25.
11. PASS — `git status --short`: only `AUDIT.md CHECKLIST.md CLAUDE.md ISSUES.md tests/run-suite.ps1 tests/README.md` modified, `Docs/*` two files moved to `Docs/archive/`, `tasks/T-0008-…md` and `tests/docs/` new. Nothing under `backend/ frontend/ nlp-engine/ supabase/`.
12. PASS — `powershell -File tests\run-suite.ps1 -Target current -Suites docs` → `docs 0`, no services started. With CHECKLIST row 3.13 temporarily removed → `AUDIT row 3.13 has no CHECKLIST id`, `docs 1`; CHECKLIST restored, check green again. `docs` is also in the default `-Suites` list. Not run: the full multi-suite harness (docs-only change; the other suites are untouched).

### Status changes (item: old → new, reason)
Rule applied: DONE_CORRECTLY needs a valid `file:line` **and** an existing `tests/` reference (approved in this spec; owner confirmed after T-0008 that the stricter bar stands, "or" was a wording mistake). All 12 downgrades from DONE_CORRECTLY are listed; 9 are for "no test", not for wrong code, and those 9 carry the status `CODE_REVIEWED_UNTESTED` (owner request after T-0008: code read at HEAD, file:line cited, no test yet). `CLAIMED_UNVERIFIED` is left for unchecked claims (only GR-2). Each CODE_REVIEWED_UNTESTED row names its promoting test in AUDIT Notes ("Promote with: ...").

- 0.5: DONE_CORRECTLY → CODE_REVIEWED_UNTESTED — secrets handling read and judged correct (`backend/Config/supabase.js:14-15`, `.gitignore:11`); no test; promote with `tests/backend/secrets-hygiene.test.mjs`.
- 0.9: DONE_CORRECTLY → CODE_REVIEWED_UNTESTED — satisfied by absence; negative grep only, no test; promote with `tests/docs/scope-guard.test.mjs`.
- 1.4: DONE_CORRECTLY → DONE_BUT_BROKEN_OR_HACKY — preprocessing runs but feeds nothing (`nlp-engine/app/main.py:68`, `embedder.py:123`); stricter reading of "before entity extraction". Judgement call.
- 1.13: MISSING → STUBBED_OR_PARTIAL — ad-hoc timings exist (`tests/BASELINE_RESULTS.md:62-66,118`), no threshold.
- 1.15: (new) → MISSING — image-only PDF returns 200, score 0.0, no unreadable signal.
- 1.16: (new) → STUBBED_OR_PARTIAL — LinkedIn URL regex only; no certificate extraction.
- 1.17: (new) → MISSING — support-role tools absent from the skill list (f3/f4).
- 4.3: DONE_CORRECTLY → CODE_REVIEWED_UNTESTED — read and judged correct; no test of weights or the env override; promote with `tests/backend/explainability.test.mjs`.
- 4.7: DONE_CORRECTLY → CODE_REVIEWED_UNTESTED — read and judged correct; the old "verified by smoke test" has no committed test, and smoke produced no score; promote with `tests/backend/explainability.test.mjs`.
- 4.11: DONE_CORRECTLY → CODE_REVIEWED_UNTESTED — no determinism test; `generated_at` makes the stored explanation non-reproducible byte for byte; promote with `tests/backend/explainability.test.mjs`.
- 4.12: (new) → MISSING — fairness not measured; f3/f4 score below off-profile f2.
- 5.4: DONE_CORRECTLY → STUBBED_OR_PARTIAL — Results is routed but nothing navigates to Processing or Results since T-0003; the candidate cannot reach score status in the UI (`tests/MANUAL_SMOKE.md` C3, C10).
- 5.5: DONE_CORRECTLY → STUBBED_OR_PARTIAL — ranking API and pages exist, but the app creates no scores and applicants never appear (C12-C13).
- 5.6: DONE_CORRECTLY → CODE_REVIEWED_UNTESTED — filters read and judged correct; never run on data; promote with `tests/frontend/jobdetails-filters.test.jsx`.
- 5.10: DONE_CORRECTLY → CODE_REVIEWED_UNTESTED — as 5.6; promote with `tests/frontend/evidence-limited.test.jsx`.
- 5.11: DONE_CORRECTLY → CODE_REVIEWED_UNTESTED — as 5.6; promote with `tests/frontend/skill-evidence.test.jsx`.
- 5.12: DONE_CORRECTLY → CODE_REVIEWED_UNTESTED — no test; contact fields shown in the modal, no protected attributes; promote with `tests/backend/live-analyze.test.mjs (extend)`.
- 5.13: (new) → MISSING — no certificate/LinkedIn evidence UI.
- 5.14: (new) → MISSING — score-on-apply (R9): apply never scores; `scores` has no `application_id`.
- 5.15: (new) → STUBBED_OR_PARTIAL — merged dashboard (R38): shortlist API exists (T-0004) and applicants API exists, no UI uses either.
- 6.3: MISSING → STUBBED_OR_PARTIAL — reference timings in BASELINE_RESULTS; no OCR path to time.
- GR-1: (new) → MISSING — owner-reported anti-cheat design; only a client-side countdown exists in the unrouted Assessment.jsx.
- GR-2: (new) → CLAIMED_UNVERIFIED — owner-reported microservices/API-gateway check; pending the architecture audit.
- X-1: (new) → MISSING — no audit-log table or writes.
- X-2: (new) → MISSING — no MOSS, CodeBERT or repo-diversity code.

Unchanged (re-verified, same status): 0.1-0.4, 0.6-0.8, 1.1-1.3, 1.5-1.12, 1.14, 2.1-2.13, 3.1-3.13, 4.1, 4.2, 4.4-4.6, 4.8-4.10, 5.1-5.3, 5.7-5.9, 6.1, 6.2, 6.4-6.8. Evidence cites were re-pointed to HEAD line numbers (for example the NLP forward moved from `analysis.controller.js:49` to `:262`). GF table: GF-5 LARGELY ADDRESSED → PARTIAL (no score reachable through the UI); GF-1..GF-4 unchanged in status.

### Archived tracker diff (Docs/archive/IMPLEMENTATION-TRACKER.md "Missing Features" → CHECKLIST)
| Tracker item | Lands in |
|---|---|
| DB migration to Supabase + Firestore | 0.2, 0.3 (Firestore half dropped: never implemented, I-0008) |
| GitHub OAuth, fetch, 8DFS, metrics, complexity, private repos | 2.2-2.6, 2.10 |
| Plagiarism (MOSS), AI-code detection (CodeBERT), repo diversity | X-2 (new, not in spec) |
| LLM integration, PFQS, assessment endpoint and UI | 3.1-3.7, 5.3 |
| Score normalisation, weights, explainability, flags | 4.2-4.6, 5.7-5.9 |
| Google / GitHub OAuth, JWT | 0.4, 2.2 (JWT: session auth used instead, covered by 0.4) |
| Audit log auto-insertion on recruiter actions | X-1 (new, not in spec) |
| Backend endpoints for GitHub, assessment, score | 2.x, 3.7, 4.x |
| OCR | 1.2 (+1.15) |
| LinkedIn, certificates, support/maintenance scoring | 1.16, 4.10, 5.13; 1.17, 2.9, 4.8, 4.12 |
| Free-tier feasibility, performance targets | 6.x (targets); free-tier table not carried (cost note, not a requirement) |

### Found, not fixed
- `nlp-engine/app/ner.py:25` makes "github" a skill keyword, so "not on GitHub" yields a skill match (f4, `tests/BASELINE_RESULTS.md:79`). Recorded in AUDIT 1.17 notes; no separate ISSUES entry (it is documented in the baseline results).
- Each `POST /api/analyze` stores a second unpruned copy of the file (`backend/Controllers/analysis.controller.js:276-286`). Recorded in AUDIT 5.14 notes.
- `backend/.env.example` omits five variables the code reads (AUDIT 0.5, ISSUES I-0032).

---

## Execution notes
- Order actually followed: spec copied to `tasks/`, D1 recorded (owner answered upfront, so no stop), check script written (red: 85 problems), trackers archived, CLAUDE.md fixed, four read-only Explore agents re-verified modules (0 and 6, 1, 2 and 3, 4 and 5), CHECKLIST items added, AUDIT rewritten, ISSUES updated, docs suite wired into `tests/run-suite.ps1`, Result filled.
- Verification: `node tests/docs/check-trackers.mjs` (add `--changes` or `--summary`), `powershell -File testsun-suite.ps1 -Target current -Suites docs`, plus the greps in the criteria above.
- Commit boundary: one commit fits all of this (docs plus the check script). Suggested split if preferred: (1) archive + CLAUDE.md, (2) CHECKLIST + AUDIT + check script + run-suite, (3) ISSUES.
