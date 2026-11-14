# T-0016 — next-six-specs

> Status: **approved 2026-10-15** (owner approved the plan in planning mode). Docs only.
> Planning task: re-stamps ARCHITECTURE.md, sets the execution order in ROADMAP.md, and writes
> the specs for the next six roadmap items as **unapproved drafts** (T-0017..T-0022).

## Owner answers (2026-10-15, while planning)
- **I-0052** gets a new Phase 1 item, **P1-10** (S, no dependencies), and goes **first** in the
  execution order. Its spec is written in this task. It also reads LinkedIn links from the same
  annotations, and adds a fixture whose GitHub link exists only as a PDF annotation (the red run).
- **P2-3 backfill:** applications that exist before the migration get a `pending` score row.
- **P1-8 test location:** `frontend/src/__tests__/` (CRA's Jest only looks under `src/`); P1-8
  teaches the docs checker that this path counts as test evidence.

## Context
- HEAD is `af8947d`. It contains the T-0014/T-0015 work that T-0015 verified while it was still
  uncommitted, so ARCHITECTURE.md's stamp (`8e8e498`) is stale.
- The docs checker shows one warning: I-0052 is in no ROADMAP row.
- The owner set the order of the next items: P1-10, then P2-1, P1-8, P2-3, P2-2, P2-4, then the
  rest of Phase 1 (P1-6, P1-7, P1-9), then the remaining Phase 2 items. The owner's standing rule:
  the frontend test runner (P1-8) lands before any task that changes frontend pages. P2-3 changes
  candidate pages, so it now depends on P1-8.

Spec ids follow the execution order:

| Spec | Item |
|---|---|
| T-0017 | P1-10 link targets from PDF annotations and DOCX hyperlinks |
| T-0018 | P2-1 M1 NLP failure isolation |
| T-0019 | P1-8 frontend test runner and characterisation tests |
| T-0020 | P2-3 score-on-apply |
| T-0021 | P2-2 M2 one frontend API base |
| T-0022 | P2-4 M3 gateway |

## Goal
The next six items each have a spec at the T-0011..T-0015 standard, ROADMAP records their order
and dependencies, and every tracker passes the docs suite with 0 warnings.

## Spec ref
- GR-2 (ARCHITECTURE §5 M1–M3), GF-4 (P1-10, P2-1, P2-3), NFR-12, R9 (score-on-apply).
- ROADMAP.md Phase 1 and Phase 2; ISSUES I-0052.

## Scope
**In:**
- `ARCHITECTURE.md`: "Verified at commit" → `af8947d`; the refresh paragraph rewritten to say what
  was re-read and where.
- `ROADMAP.md`:
  - new P1-10 row;
  - an "Execution order" line;
  - P2-3 depends on P1-8 (row, graph, track text);
  - the P2-1, P1-8, P2-3, P2-4 and P2-5 rows aligned with the specs;
  - Task cells T-0017..T-0022;
  - §1.2 timeout lines, the test backlog paths, open question 4.
- `ISSUES.md`: new I-0053 and I-0054 (found while planning), a mapping note on I-0052.
- `tasks/T-0016..T-0022`, `WORKLOG.md`.

**Out:**
- Any application or test code, and the checker. P1-8's checker rule is built in T-0019.
- AUDIT.md and CHECKLIST.md: a planning task moves no status.
- Approving the six specs: each gets its own approval before any code.

## Acceptance criteria
1. **The stamp is HEAD.** ARCHITECTURE.md line 7 names the hash that
   `git rev-parse --short HEAD` prints (`af8947d`). The refresh paragraph says which cites were
   re-read at that commit. Checked by: `Select-String "Verified at commit"`, plus the read-only
   agent's re-read list in Result.
2. **The order is in ROADMAP.** An "Execution order" line lists P1-10, P2-1, P1-8, P2-3, P2-2,
   P2-4, then P1-6, P1-7, P1-9, then P2-5..P2-9, and every item comes after everything in its
   "Depends on". Checked by: grep, plus the dependency table in Result (the checker does not read
   lines outside tables).
3. **P2-3 depends on P1-8.** The row's "Depends on" lists `P1-8` and the graph has
   `P1_8 --> P2_3`. Checked by: grep, plus the checker (exit 0, which rejects forward
   dependencies).
4. **The six specs exist at the standard.** Each of T-0017..T-0022 has: Context, Goal, Spec ref,
   Scope (In/Out), Files touched, Moves, numbered acceptance criteria each with "Checked by",
   named tests, a Test plan that describes the red run, Regression, Risks and rollback, and an
   empty Result. Checked by: a read-only PowerShell count per spec (headings present; criteria
   count = "Checked by" count); the table goes in Result.
5. **Per-item content** is what the owner asked for. It includes P2-1's timeout numbers, P2-3's
   retry choice, two-replica safety and the `/api/analyze` decision with reasons, and P2-4's
   criteria from ARCHITECTURE §5 M3. Checked by: owner review, plus a grep for the named items.
6. **Trackers.** The Task cells point at existing files, and I-0052, I-0053 and I-0054 are mapped.
   Checked by: `node tests/docs/check-trackers.mjs` → exit 0 and **0 warnings**;
   `tests/run-suite.ps1 -Target current -Suites docs` → 0.
7. **Docs only.** Checked by: `git status --porcelain` lists only ARCHITECTURE.md, ROADMAP.md,
   ISSUES.md, WORKLOG.md and `tasks/T-0016..T-0022`.
8. **WORKLOG.** Checked by: L-0029 is appended and is at most 15 lines.

## Test plan
- **Red run.** The six Task cells are set before the spec files exist. The checker must then
  exit 1 with "task … does not exist" (`tests/.out/t0016-red.log`). Writing the specs turns it
  green. Today's I-0052 warning must disappear once P1-10 maps it.
- **Green:** `tests/.out/t0016-docs.log` (checker) and the docs suite.
- **Cannot be automated:** whether each spec says what the owner wants (criterion 5).

## Regression
- The checker still matches 91 AUDIT rows.
- ARCHITECTURE.md's cite count stays at 228 or higher, and every cite resolves.

## Risks and rollback
- **Risk:** the re-stamp claims more than was read. Mitigation: the paragraph names what was
  re-read at `af8947d`, and what was last read at `8e8e498`.
- **Rollback:** revert the doc hunks and delete `tasks/T-0017..T-0022`.

---

## Result

Logs: red `tests/.out/t0016-red.log`, green `tests/.out/t0016-docs.log`.

1. **PASS — the stamp is HEAD.**
   - `Select-String "Verified at commit"` gives ``Verified at commit: `af8947d` (branch `Anthony_V3`).``, and `git rev-parse --short HEAD` gives `af8947d`.
   - The refresh paragraph now lists what was read where.
   - A read-only agent re-read all **49** cites into the six named files at `af8947d`: `analysis.controller.js` 30, `run-suite.ps1` 3, `ner.py` 1, `internalHttp.js` 5, `githubEvidence.js` 10, `explainability.js` 0. Every one supports its sentence.
   - The agent found two claims without a cite. Both are added and verified at `af8947d`:
     - `backend/Services/githubEvidence.js:103`: an empty URL gives `service_disabled`;
     - `backend/Controllers/analysis.controller.js:422-423`: the recruiter-candidates `scores` read.
2. **PASS — the order is in ROADMAP.** The "Execution order" line sits under "How to read this". Dependency check (every "Depends on" is earlier in the order or already done):

   | # | Item | Depends on | OK |
   |---|---|---|---|
   | 1 | P1-10 | — | yes |
   | 2 | P2-1 | P1-4 (done) | yes |
   | 3 | P1-8 | — | yes |
   | 4 | P2-3 | P2-1 (#2), P1-8 (#3) | yes |
   | 5 | P2-2 | P1-8 (#3) | yes |
   | 6 | P2-4 | P2-2 (#5) | yes |
   | 7 | P1-6 | P1-2 (done) | yes |
   | 8 | P1-7 | P1-6 (#7) | yes |
   | 9 | P1-9 | P1-4 (done), P1-8 (#3) | yes |
   | 10 | P2-5 | P2-3 (#4), P1-8 (#3) | yes |
   | 11 | P2-6 | P2-4 (#6), P1-4 (done) | yes |
   | 12 | P2-7 | P2-6 (#11) | yes |
   | 13 | P2-8 | P2-4 (#6), P2-7 (#12) | yes |
   | 14 | P2-9 | P2-6, P2-7, P2-3 (all earlier) | yes |
3. **PASS — P2-3 depends on P1-8.**
   - The P2-3 row's "Depends on" cell is `P2-1, P1-8`.
   - The graph has `P1_8 --> P2_3` and a `P1_10` node.
   - The product track reads P2-1 → P1-8 → P2-3 → P2-5.
   - The checker exits 0.
4. **PASS — the six specs exist at the standard.** A PowerShell count over each spec checked that all 11 headings are present (Context, Goal, Spec ref, Scope, Files touched, Moves, Acceptance criteria, Test plan, Regression, Risks and rollback, Result) and that the Test plan describes a red run. The first count found 3 criteria without "Checked by" (T-0018 #6 and #7, T-0022 #13); each got one, and the recount is below.

   | Spec | Criteria | With "Checked by" | Headings missing | Red run |
   |---|---|---|---|---|
   | T-0017 | 10 | 10 | none | yes |
   | T-0018 | 11 | 11 | none | yes |
   | T-0019 | 8 | 8 | none | yes |
   | T-0020 | 12 | 12 | none | yes |
   | T-0021 | 10 | 10 | none | yes |
   | T-0022 | 14 | 14 | none | yes |
5. **PASS on content; the owner's judgement is pending.** A grep finds each named item:
   - P2-1: `1.16 s` and `Retry-After: 30` (T-0018);
   - P2-3: `SKIP LOCKED`, `lease_owner` and the `/api/analyze` removal with reasons (T-0020);
   - P2-4: `auth_unavailable`, `source":"gateway"` and `degraded` (T-0022);
   - P1-10: `annotation` (T-0017).
6. **PASS — trackers.**
   - `node tests/docs/check-trackers.mjs` → exit 0: "ids 91/91 matched, 91 rows OK; ARCHITECTURE.md 230 cites OK; ROADMAP.md 36 items OK, 0 warning(s)".
   - `tests/run-suite.ps1 -Target current -Suites docs` → `docs 0`.
   - Red, before the spec files and issues existed: exit 1 with 8 problems (6 "names task T-00NN, which has no tasks/…", plus I-0053 and I-0054 not in ISSUES).
   - The I-0052 warning is gone: P1-10 maps it.
7. **PASS — docs only.** `git status --porcelain` lists `ARCHITECTURE.md`, `ISSUES.md` and `ROADMAP.md` (modified) and `tasks/T-0016..T-0022` (new). `WORKLOG.md` joins them with L-0029. The `tests/.out/` logs are git-ignored.
8. **PASS — WORKLOG.** L-0029 is appended, 15 lines or fewer.

**Regression.** AUDIT rows are still 91/91. ARCHITECTURE cites went from 228 to 230: the two added ones.

**Findings and deviations from the approved plan.**
- **T-0018 classifies an NLP 500 as `nlp_error` (502), not `nlp_unavailable`.** The plan outline said "5xx → 503". A résumé that crashes the parser fails on every retry, and P2-3 retries `nlp_unavailable` forever. Only a timeout, a refused connection or an NLP 503 count as unavailable.
- **T-0021 checks MANUAL_SMOKE sections B and C, not "A/B".** Section A targets the baseline worktree. ARCHITECTURE §5 M2's draft wording is corrected in the spec.
- **T-0022 criterion 9 corrects §5 M3's draft.** "Core down → `/api/jobs` 502" cannot hold under DEC-2's fail-closed check: a protected route with a cookie gets `503 auth_unavailable`.
- **Logged:** I-0053 (per-job list drops candidates, mapped to P2-3) and I-0054 (Jobs page count hardcoded to 0, mapped to P2-5).
