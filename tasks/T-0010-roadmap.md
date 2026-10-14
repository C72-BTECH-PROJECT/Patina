# T-0010 — roadmap

> Approved by the owner 2026-10-14 (plan approval, no amendments). The answers to
> the four planning questions are recorded verbatim below, before any other file
> was changed.

## Owner answers at planning (verbatim)
- **Data** ("Where should the GitHub service keep its data in Phase 1?"):
  > Stateless first (Recommended)
- **Route** ("ARCHITECTURE §4.1/§4.4 route a browser-facing /api/github/* to this
  service through the gateway. Your brief says the browser never calls it. How
  should I record that?"):
  > DEC-5: internal only (Recommended)
- **Checker** ("Should the docs checker validate ROADMAP.md?"):
  > Extend the checker, but "every open issue is mapped in ROADMAP" should be a
  > warning, not a failure. Issues get logged mid-session all the time, and the docs
  > suite shouldn't go red until ROADMAP is updated. Dependency order, id existence
  > and S/M/L stay hard failures, each with a red run.
- **Frontend runner** ("When should it come?"):
  > Pull the frontend runner + the three characterisation tests forward to just
  > before the first task that changes frontend pages. If P1-6 (GitHub evidence UI)
  > is the first, it goes before P1-6, at the end of Phase 1.

Effect:
- the coverage rules (open issues, CODE_REVIEWED_UNTESTED rows) are warnings;
- I apply the same reasoning to the CODE_REVIEWED_UNTESTED rule;
- the runner becomes P1-8 and the GitHub evidence UI P1-9, at the end of Phase 1;
- P2-2 (M2) and P3-14 also depend on P1-8, because they change frontend files.

## Context
T-0009 answered GR-2 with `ARCHITECTURE.md`; DEC-1..DEC-4 are accepted. It left
two things to "the roadmap task": the M5+ order and DEC-3's timing.

AUDIT.md at `2e87d44`:
- no score is produced through the UI;
- Module 2 (GitHub) is 9 MISSING, 3 PARTIAL and 1 BROKEN;
- 9 rows are CODE_REVIEWED_UNTESTED.

The owner's brief: one plan in three phases, in this order:
1. the GitHub validation module as a microservice;
2. the existing features as microservices, plus score-on-apply and the merged dashboard;
3. improvements to the built modules.

Then test-first specs for the first Phase 1 tasks. Next free number: T-0010.

## Goal
A dependency-correct `ROADMAP.md` in three phases, where every item names its
dependencies, size, files touched and the CHECKLIST/AUDIT ids it moves, plus
test-first specs for the first Phase 1 tasks (T-0011..T-0015).

## Spec ref
- GR-2: ARCHITECTURE §5 "M5 onward, sequenced by the roadmap task", and DEC-3's timing.
- DEC-4 (GitHub evidence and assessment as Python services).
- CHECKLIST Module 2 (FR-4..FR-7), GF-1..GF-5, 5.14 and 5.15 (R9, R38).
- The 9 CODE_REVIEWED_UNTESTED rows of AUDIT.md.
- No FR or NFR is changed.

## Scope
**In:**
- `ROADMAP.md` (new, root).
- This spec. `tasks/T-0011..T-0015-*.md`: specs only, with an empty Result.
- `tests/docs/check-trackers.mjs` (ROADMAP rules) and `tests/README.md` (docs-suite row).
- `ARCHITECTURE.md`, to-be text only (no as-is text, no cite changes):
  - §4 "Decisions recorded": DEC-3 timing points to ROADMAP P2-7. DEC-5 (github-evidence
    is internal only). DEC-6 (it starts stateless; its schema arrives with 8DFS).
    "Still proposals: the M5+ order" points to ROADMAP.
  - §4.1 diagram, §4.2 routing row, §4.3 open question, §4.4 GitHub row, §5 M8
    row: no browser-facing `/api/github/*` (DEC-5).
- `CLAUDE.md`: one "Source of truth" line pointing to `ROADMAP.md`.
- `ISSUES.md`: I-0040..I-0042 (found while planning; logged, not fixed).
- `WORKLOG.md`: L-0020.

**Out:**
- Any change under `backend/ frontend/ nlp-engine/ supabase/`.
- Creating `github-evidence/`.
- AUDIT.md status changes: nothing is built.
- Specs for P1-6 onward, Phase 2 or Phase 3.
- `PROJECT_SOURCE_DOCS.md`.
- Commits and staging.

## Acceptance criteria
1. **Sections.** ROADMAP has:
   - how to read it: a plan, not status; the size legend (S ≤1 day, M 2–4 days,
     L 1–2 weeks or split); the status abbreviations;
   - decisions and defaults;
   - Phase 1, including the contract, data, rate limits and tests;
   - Phase 2 and Phase 3;
   - not scheduled;
   - a dependency graph.

   Checked by: `grep -n "^## " ROADMAP.md`.
2. **Columns and sizes (hard).** Every item row has Id, Item, Depends on, Size,
   Files, Moves, Issues and Task, and Size is S, M or L. Checked by: the checker;
   red: one size set to `XL` → exit 1, then restored.
3. **Dependency order (hard).** Ids are unique, and every `Pn-m` in "Depends on" is
   defined in an earlier row. Checked by: the checker; red: a row moved above its
   dependency → exit 1, then restored.
4. **Ids exist (hard).** Every CHECKLIST id in Moves exists in CHECKLIST.md, and
   every `I-NNNN` exists in ISSUES.md. Checked by: the checker; red: `2.99` and
   `I-9999` → exit 1, then restored.
5. **Coverage (warning).** Every OPEN issue in ISSUES.md's Open table and every
   CODE_REVIEWED_UNTESTED AUDIT row is mapped in ROADMAP. A missing mapping prints a
   `warning:` line and exits 0. Checked by a warning run: drop one mapping → exit 0
   with the warning, then restored. At hand-in there are zero warnings.
6. **Phase 1 content.** The contract v1 (endpoints, request/response JSON, error
   table, timeout, request-ID, env vars), the data decision, rate-limit handling,
   tests on recorded responses with the live API blocked, the GF-4 reason table and
   the probe extension. Checked by: owner review.
7. **Phase 2 content.** M1–M7 plus 5.14 and 5.15 in dependency order, with DEC-3's
   timing and its rationale. Checked by: the checker (order) and owner review.
8. **Phase 3 content.** Checked by: owner review. It has:
   - parser items: projects, multi-column, support vocabulary plus a GF-3 measure;
   - OCR;
   - LinkedIn/certificates, with an honest feasibility section;
   - the remaining promoting tests;
   - the open issues and the stale docs.
9. **ARCHITECTURE.md.** It has the DEC-3 timing, DEC-5 and DEC-6 rows. Checked by:
   - `grep -n "api/github" ARCHITECTURE.md` → hits only in the DEC-5 row and the
     notes that explain it;
   - the checker still passes (no cite changed).
10. **Specs.** T-0011..T-0015 each have every TEMPLATE section, numbered criteria
    with "checked by", named tests, a described red run and an empty Result.
    Checked by: heading counts per file and owner review.
11. **Docs suite.** Checked by:
    - `node tests/docs/check-trackers.mjs` → exit 0 with no warnings;
    - `tests/run-suite.ps1 -Target current -Suites docs` → docs 0.
12. **Scope.** `git status --porcelain` lists only in-scope files, and the WORKLOG
    entry has at most 15 lines.

## Test plan
- **Write first:** the ROADMAP rules in `tests/docs/check-trackers.mjs`.
  - Red = ROADMAP.md absent → `ROADMAP.md is missing`, exit 1
    (`tests/.out/t0010-red.log`).
  - Green on the finished doc.
- **Red runs on the finished doc** (criteria 2-4): each edit is undone and the
  SHA-256 is compared with the original.
- **Warning run** (criterion 5): same restore and hash check.
- **Cannot be automated:** criteria 6-8 and the content half of 10 need judgement.

## Regression
- The docs suite's existing AUDIT, CHECKLIST, CLAUDE.md and ARCHITECTURE.md checks,
  unchanged in behaviour.

## Risks and rollback
- **Risk:** a ROADMAP rule turns out too strict for later edits. Mitigation: the
  rules check structure, ids and order only, never prose, and coverage is a warning.
- **Risk:** the ARCHITECTURE.md edits touch the to-be text the owner approved in
  T-0009. Mitigation: only the lines DEC-5 contradicts change, and each is listed in
  Result.
- **Rollback:** delete ROADMAP.md and the new specs; revert the checker,
  ARCHITECTURE.md, CLAUDE.md and ISSUES.md hunks. No code or data is involved.

---

## Result

Red run, before ROADMAP.md existed (`tests/.out/t0010-red.log`):
`check-trackers: 1 problem(s) - ROADMAP.md is missing`, exit 1.
Green (`tests/.out/t0010-green.log`): `… ARCHITECTURE.md 205 cites OK; ROADMAP.md 35 items OK, 0 warning(s)`, exit 0.

1. **PASS.** `grep -n "^## " ROADMAP.md` gives 8 sections:
   - How to read this (sizes, status abbreviations, the checker);
   - Decisions this roadmap rests on;
   - Phase 1 (§1.1 shape, §1.2 contract, §1.3 GF-4, §1.4 data, §1.5 rate limits,
     §1.6 tests, §1.7 items, §1.8 FR coverage);
   - Phase 2; Phase 3; Not scheduled; Open questions; Dependency graph (Mermaid).
2. **PASS.** Every item table has all 8 columns (35 items: 9, 9 and 17).
   - Red A: P1-3's size set to `XL` → `ROADMAP.md: P1-3 has size "XL" (want S, M or L)`, exit 1.
   - Restored; SHA-256 matches. All red output is in `tests/.out/t0010-red-checks.log`.
3. **PASS.**
   - Red B: the P1-4 row moved above P1-2 → `P1-4 depends on P1-2, which is not
     defined in an earlier row` and the same for P1-3, exit 1.
   - Restored; SHA-256 matches.
4. **PASS.**
   - Red C: `2.10` → `2.99` in P1-4's Moves and `I-0040` → `I-9999` in P1-9's Issues →
     `P1-4 moves 2.99, which is not a CHECKLIST id` and `ROADMAP.md names I-9999,
     which is not in ISSUES.md`, exit 1.
   - It also printed `warning: open issue I-0040 is not in any ROADMAP.md item row`,
     as expected.
   - Restored; SHA-256 matches.
5. **PASS.**
   - Warning run: `I-0037` dropped from P2-1 and `5.12` from P3-1's Moves → two
     `warning:` lines and exit 0 (`… 35 items OK, 2 warning(s)`).
   - Restored; SHA-256 matches. Final run: 0 warnings.
6. **PASS (content); the owner judges it.** ROADMAP §1.2-§1.6 and P1-5.
7. **PASS (order checked by the checker); the owner judges the content.** P2-1..P2-9
   and "Order, tracks and DEC-3". M5 is P2-7, after M4, with three reasons.
8. **PASS (content); the owner judges it.** P3-1..P3-17; the test-backlog table
   maps all 9 CODE_REVIEWED_UNTESTED rows; the LinkedIn/certificates feasibility
   section; I-0030..I-0033 in P3-17.
9. **PASS.**
   - `grep -c "api/github" ARCHITECTURE.md` → 0.
   - DEC-3 timing, DEC-5 and DEC-6 rows are added. §4.1 edge, §4.2 routing, §4.3 open
     question (now M9 only), §4.4 GitHub row and §5 M8 row are changed.
   - Checker: 205 ARCHITECTURE cites OK, the same count as L-0019.
10. **PASS (structure); the owner judges the content.** T-0011..T-0015 each have
    8/8 template headings (Goal, Spec ref, Scope, Acceptance criteria, Test plan,
    Regression, Risks and rollback, Result).
    - Every criterion names its test or command.
    - Every Test plan describes its red run: T-0015's red is a mutation
      (`GITHUB_EVIDENCE_TIMEOUT_MS=60000`), because the behaviour exists by then.
    - Every Result is empty.
11. **PASS.**
    - `node tests/docs/check-trackers.mjs` → exit 0, 0 warnings.
    - `tests/run-suite.ps1 -Target current -Suites docs` → `docs 0`.
12. **PASS.** `git status --porcelain`:
    - modified: ARCHITECTURE.md, CLAUDE.md, ISSUES.md, tests/README.md,
      tests/docs/check-trackers.mjs, and WORKLOG.md (L-0020 is appended after this
      Result);
    - new: ROADMAP.md and tasks/T-0010..T-0015;
    - nothing under `backend/ frontend/ nlp-engine/ supabase/`, nothing staged.

### Changes from the approved plan (additive, listed for the owner)
- **ROADMAP has an extra "Open questions for the owner and the team" section**: DEC-4
  owners, the GitHub token, the recorded account, `/api/analyze`, GF-1 scope, I-0033.
- **The checker also requires** that a `T-NNNN` in a Task cell has a `tasks/` file,
  and that every `I-NNNN` anywhere in ROADMAP exists, not just in Issues cells. Both
  are "ids exist" rules and hard failures.
- **P3-13 depends on P1-8**, because it edits `Login.jsx` (I-0016). This is the owner's
  "runner before frontend changes" rule.
- **ARCHITECTURE.md:** two headings also point to ROADMAP now:
  - §4.3: "timing in `ROADMAP.md` P2-7";
  - §5: "M5 onward, sequenced in `ROADMAP.md`".
- **T-0012 carries two open questions for its approval:** the claim definition, and
  the starting weights and saturation points.

### Found, not fixed
- I-0040 (relative GitHub link in CandidateModal), I-0041 (stale `scores.subscores`
  comment in a migration) and I-0042 (the checker skips `.yml/.toml/.ts` cites).
  All are in ISSUES.md and mapped in ROADMAP.
- **ARCHITECTURE.md §0, point 5 (the owner's guide answer)** still lists the gateway
  and compose before "the GitHub and assessment services". The owner's brief puts the
  GitHub service first. I did not edit the owner's §0 text; the owner decides whether
  §0 should mention the new order.

Suggested commit boundary: one commit for T-0010 (all files above). The owner commits.
