# Phase 1 inventory: documentation

Auditor: patina-auditor (docs). Date: 2026-11-12. Branch `rebuild/fable`, HEAD `6da8d3f`, working tree has `CLAUDE.md` modified and `.claude/agents/`, `REBUILD/` untracked.

Labels: **VERIFIED** = I ran it; **READ** = I read the text; **UNKNOWN** = not checked. No code was read to settle any contradiction; contradictions are recorded, not resolved.

How the file list was built (VERIFIED):
- `git ls-files '*.md'` → 60 tracked files.
- `git status --short` → untracked `.claude/agents/` (4 `.md`) and `REBUILD/`.
- `git ls-files --others --ignored --exclude-standard '*.md'` and `find . -name '*.md'` excluding `node_modules`, `venv`, `.venv`, `site-packages` → 2 more: `tests/.out/t0009-probe.md`, `tests/.out/t0015-probe.md` (gitignored generated output).
- Everything else that matched was inside dependency directories (`.venv/`, `nlp-engine/.venv`, `nlp-engine/venv`, `github-evidence/venv`, `assessment-service/.venv`); excluded. Note that a repo-root `.venv/` exists.
- `.obsidian/` contains no `.md` files (only `app.json`, `appearance.json`, `core-plugins.json`, `workspace.json`). `.obsidian/workspace.json:186-202` lists recently opened docs, including the deleted `Docs/Architecture.md` (cosmetic only).
- `REBUILD/` exists (`KICKOFF.md`, `LOG.md`, `PROGRESS.md`, `inventory/`). Excluded as instructed.
- Non-md items found: `Docs/scope/*.docx` (Objectives, Activity-2, Activity-3, Literature Review) and `Docs/C72 2nd sep.docx`, `Docs/C72_2nd_sep.pdf` exist on disk but are **gitignored** (`.gitignore` has `*.pdf`, `*.docx`), so they are not in git.

Total in scope: **66 files** (60 tracked, 4 untracked agent definitions, 2 ignored probe outputs).

Large files: `ISSUES.md` (1303 lines), `ARCHITECTURE.md` (862), `WORKLOG.md` (591), `ROADMAP.md` (546), `REVIEW_BRIEF.md` (727), `tasks/T-0030` (683) and `tasks/T-0031` (579). For these I read the headings, the opening sections and samples, not every line. For ISSUES.md I read the Open table in full and the status and module line of every `### I-NNNN` entry. For ROADMAP.md I read lines 1-165 and 337-546. For ARCHITECTURE.md I read lines 1-135 and 299-383. For WORKLOG.md I read the header, L-0029..L-0031 and L-0049..L-0052. For REVIEW_BRIEF.md I read lines 1-48 plus grep hits.

---

## 1. File table

Columns: **Lines** (`wc -l`), **Last commit** (`git log -1 --format='%ad %an' --date=short`), **Kind** (one of the brief's categories), **Depended on by** (M = machine dependency, a script or test that breaks; S = soft, other docs or code comments refer to it), **Proposal**.

### 1a. Root and `Docs/`

| Path | Lines | Last commit | Purpose (one sentence) | Kind | Depended on by | Proposal |
|---|---|---|---|---|---|---|
| `CLAUDE.md` | 104 | 2026-10-14 anthonyjennis (working tree modified: rebuild section appended) | Stable project memory: source-of-truth map, working agreements, session protocol, rebuild rules. | session rules | **M:** `tests/docs/check-trackers.mjs:142-146` checks that every backticked `*.md` it names exists. VERIFIED: it currently fails on `REBUILD/DECISIONS.md` (not yet written). S: Claude Code loads it every session. | **keep**: the one session-rules doc. Its "Source of truth" list must be rewritten to match the final set. |
| `CHECKLIST.md` | 227 | 2026-10-13 anthonyjennis | Spec-derived list of what should exist, ids 0.1..6.8, GR-n, X-n, plus the GF map. | spec | **M:** check-trackers reads it (`:65-69`). Ids must be unique; every id needs exactly one AUDIT row (`:94-95`); GR-1, GR-2, X-1, X-2 are required (`:40,96`); ROADMAP "Moves" ids must exist here (`:209-211`). S: code comments cite CHECKLIST ids (e.g. `backend/Services/explainability.js:3`, `frontend/src/components/recruiter/ScoreBreakdown.jsx:10`). | **keep**: the requirement-id registry. |
| `AUDIT.md` | 240 | 2026-11-05 anthonyjennis | One row per CHECKLIST id with status, evidence, spec id and delivered-by, plus the data model and the services table. | verified status | **M:** check-trackers (`:72-131`): status vocabulary, cites resolve, DONE rows need a `tests/` ref, a `Verified at commit:` line, GF-1..GF-5 rows; `--summary` regenerates its Summary table. S: CLAUDE.md, ROADMAP, ARCHITECTURE. | **keep**: the one status doc. It needs re-verification: it is stamped `2e87d44` (`AUDIT.md:7`) but contains later partial deltas, and it does not reflect gateway Part 2 or the Gemini change. |
| `ARCHITECTURE.md` | 862 | 2026-11-05 anthonyjennis | GR-2 audit: as-is units, calls, auth and data ownership; verdict; doc-vs-code table; decisions AD-1..3 and DEC-1..6; to-be design; M1-M7 migration; probe output. | decisions / architecture | **M:** check-trackers `:149-181`: every `file:line` cite resolves, Evidence cells need a cite or `P-n`, Verdict cells must be PASS, PARTIAL or FAIL, plus a real `Verified at commit:`. VERIFIED: it fails now with 10 cites into `backend/Routes/auth.routes.js` (24 lines) at `:17-21`, `:46-52`. Its cites into `README.md`, `PROJECT_SOURCE_DOCS.md`, `REVIEW_BRIEF.md`, `CODE_MAP.md`, `Docs/archive/*`, `tests/BASELINE_RESULTS.md` and `github-evidence/README.md` make those files machine dependencies. S: `tests/arch/nlp-outage-probe.mjs:3`. | **keep**: owns architecture. Move its DEC/AD decision record to `REBUILD/DECISIONS.md` once that is approved, and leave a pointer behind. |
| `ROADMAP.md` | 546 | 2026-11-05 anthonyjennis | Ordered build plan: Phase 0-3 item tables P0-1..P3-12 with dependencies, team assignments, test backlog, GF-1 feasibility. | roadmap / plan | **M:** check-trackers `:183-242`: the 8 item-table columns, Pn-m ids in dependency order, S/M/L sizes, CHECKLIST ids in Moves, T-ids in Task cells must exist in `tasks/`, every I-id anywhere must be a `### I-NNNN` heading in ISSUES.md, cites resolve. S: code comments cite "ROADMAP §1.2/§1.3/§1.4/§1.5" (`backend/Services/githubEvidence.js:4,70`, `backend/Services/explainability.js:72,359`, `github-evidence/app/github_client.py:3`, `tests/arch/nlp-outage-probe.mjs:51`). | **keep** for now. It competes with `REBUILD/PROGRESS.md` and the planned `REBUILD/TASKS.md`; the lead must pick one plan. If ROADMAP is retired, the checker's ROADMAP block must be edited in the same change. |
| `ISSUES.md` | 1303 | 2026-11-05 anthonyjennis | Out-of-scope problem log: an Open table (32 rows) with detail entries, and a Resolved section (47 entries). | backlog | **M:** check-trackers `:190` builds the issue-id set from `^### I-NNNN` headings, and `:231-238` reads tables whose first header is `id` with a `status` column (warnings only). ROADMAP names 63 I-ids, including resolved ones such as I-0051 and I-0070, so resolved entries cannot leave this file without ROADMAP edits. S: CLAUDE.md session protocol. | **keep**: the one backlog. The index is in §7 below. |
| `WORKLOG.md` | 591 | 2026-11-05 anthonyjennis | One entry per Claude session prompt, L-0001..L-0052 (2026-10-12 to 2026-11-04). | log / history | S: CLAUDE.md session protocol ("read the last 5 entries"). No machine dependency. Its own rule (`WORKLOG.md:4-6`) says to archive past ~400 lines into `docs/worklog-archive/`; not done (I-0064). | **keep** but trim: archive L-0001..L-0032 into the archive folder per its own rule. Gateway Part 2 and the Gemini change have no entry (see `gateway/SESSION_LOG`). |
| `PROJECT_SOURCE_DOCS.md` | 266 | 2026-10-12 anthonyjennis | Plain-text consolidation of Objectives, SRS and Literature Review: FR/NFR ids, the data model, GF context. | spec | **M:** ARCHITECTURE cites `PROJECT_SOURCE_DOCS.md:76-79,104-107,162,167,169,171`. S: CHECKLIST is derived from it; CLAUDE.md points at it; task template requires FR/NFR ids from it. | **keep**: frozen spec source. Note that its originals are `Docs/scope/*.docx`, which are gitignored. |
| `README.md` | 198 | 2026-11-04 anthonyjennis | Product overview, "Current implementation" status table, architecture sketch, local setup, API table, change log. | other (front door), but mostly how-to-run and an old status self-report | **M:** ARCHITECTURE cites `README.md:46-52,61,118-123,123`, so the file must keep at least 123 lines or those cites must change. S: CLAUDE.md does not name it. | **keep, rewrite**: make it the single front door and run guide, absorbing STEPS_TO_RUN_APP and HOW_TO_RUN_AND_TEST. Its status table (`:30-41`) is badly stale (see §3) and should go; status belongs in AUDIT. |
| `CODE_MAP.md` | 580 | 2026-10-12 anthonyjennis | File-by-file lookup table ("given a review question, find the file"), generated 2026-10-12. | other (code index), with a stale "quick truth" status block | **M:** ARCHITECTURE cites `CODE_MAP.md:19,500`. S: REVIEW_BRIEF is built on it; ROADMAP P0-7 plans to regenerate it. | **archive**: stale since T-0003 (I-0030) and it predates github-evidence, assessment and the gateway. Update the ARCHITECTURE §3.1 cites first. |
| `REVIEW_BRIEF.md` | 727 | 2026-10-12 anthonyjennis | Guide-review prep: a spoken state-of-project script, an end-to-end trace and Q&A. | other (presentation script), effectively a self-report | **M:** ARCHITECTURE cites `REVIEW_BRIEF.md:21-23,309-313`. S: ROADMAP P0-7. | **archive**: dangerous for the Nov 18 demo. It says GitHub and assessment are "designed, not built" and that there is "no test suite" (`REVIEW_BRIEF.md:10,14`). Update the ARCHITECTURE cite first. |
| `INTEGRATION_REVIEW.md` | 524 | 2026-10-12 anthonyjennis | T-0002 review of teammates' commits `32905c1`→`4ed559d`, with owner decisions R1..R40. | log / history (with old decisions) | S: CHECKLIST 5.14/5.15 cite "INTEGRATION_REVIEW R9/R38, Q2/Q4" (`CHECKLIST.md:163-164`); AUDIT 5.14 "deferred by INTEGRATION_REVIEW R9". No machine dependency. | **archive**: history; the R9 and R38 decisions already live in CHECKLIST 5.14/5.15. |
| `STEPS_TO_RUN_APP.md` | 129 | 2026-11-04 adi45264 | Aditya's six-terminal run guide including the gateway (core on 5001, gateway on 5000), env templates and tests. | how-to-run | Nothing references it (VERIFIED, `git grep`). | **merge into `README.md`**: it is the only run doc that knows about the gateway, but it hardcodes `C:\Users\Aditya\...`, uses the wrong assessment venv and a `VITE_` env var (see §4). |
| `Docs/HOW_TO_RUN_AND_TEST.md` | 99 | 2026-10-15 adi45264 | Assessment-centred run and test guide: 4 services, UI quiz test, API test, troubleshooting. | how-to-run | S: WORKLOG L-0037. No machine dependency. | **merge into `README.md`** (run steps, troubleshooting) and `tests/README.md` (API test). Its `/openapi.json → 200` health check is stale (§4). |
| `Docs/SUPABASE_MIGRATIONS_RUNBOOK.md` | 108 | 2026-11-04 anthonyjennis | How schema changes reach the shared Supabase project: `npx supabase db push --linked` only, repair, naming. | how-to-run (schema ops) | S: AUDIT 0.2, ISSUES, T-0030, T-0031. No machine dependency. | **keep**: it is the only correct migration procedure and contradicts README (§3). |
| `Docs/archive/IMPLEMENTATION-TRACKER.md` | 273 | 2026-10-12 anthonyjennis | Archived team tracker (Firestore plan, self-reported done items), with an archive banner. | team self-report | **M:** CLAUDE.md names it in backticks (checker `:142-146` requires it to exist); ARCHITECTURE cites `:29,:32`; check-trackers `:129` rejects DONE rows citing `Docs/archive`. S: CHECKLIST Appendix A, `tasks/TEMPLATE.md:15` (stale path). | **archive** (already). Leave in place; a move breaks CLAUDE.md and ARCHITECTURE checks. |
| `Docs/archive/project_checklist.md` | 68 | 2026-10-12 anthonyjennis | Archived team checkbox list, with an archive banner. | team self-report | **M:** as above (CLAUDE.md backticks; ARCHITECTURE cites `:13,:18`). | **archive** (already). Leave in place. |

### 1b. Service directories

| Path | Lines | Last commit | Purpose | Kind | Depended on by | Proposal |
|---|---|---|---|---|---|---|
| `assessment-service/README.md` | 290 | 2026-11-04 anthonyjennis | Service doc: where it fits, layout, API, schemas, config (OpenRouter), LLM behaviour, how to run and test, limitations. | how-to-run + service contract | **M: `tests/assessment/test_internal_only.py:46-59` reads this file.** It needs at least one `uvicorn ... app.main:app` or `python -m app` line; no line may contain `0.0.0.0`; any `--port` must be `--port 8002`; any `--host` must be `--host 127.0.0.1`; and the string `:8000` must not appear anywhere in the file. **M:** AUDIT GR-1 Evidence cites `assessment-service/README.md:288`. | **keep in place**: a rename or merge breaks the assessment suite. It does not mention the Gemini variables that `.env.example` now has (§3). |
| `assessment-service/ASSESSMENT_IMPLEMENTATION_PLAN.md` | 401 | 2026-10-14 aaronninan-2702 | Aaron's plan to take the standalone assessment service through integration. | roadmap / plan (stale) | **M:** AUDIT GR-1 Evidence cites `assessment-service/ASSESSMENT_IMPLEMENTATION_PLAN.md:32`, so the file must exist with ≥32 lines. | **archive**: superseded by the built integration; repoint the AUDIT GR-1 cite first. |
| `github-evidence/README.md` | 264 | 2026-10-15 anthonyjennis | Service doc: start, env vars, **Contract v1** (core ↔ github-evidence), tests. | how-to-run + service contract | **M:** ARCHITECTURE cites `github-evidence/README.md:18`. S: code comments name it as the contract (`backend/Services/githubEvidence.js:3,35`, `backend/Services/internalHttp.js:15`, `backend/Services/explainability.js:309`, `github-evidence/app/github_client.py:3`, `github-evidence/app/metrics.py:3`, `github-evidence/.env.example:4`). | **keep**: owns the github-evidence contract. |
| `gateway/README.md` | 13 | 2026-11-04 adi45264 | Gateway Part 1 summary: routes, env, the public-route rule. | how-to-run (service) | None found. | **keep**: tiny; extend with Part 2 facts after verification. |
| `gateway/PLAN.md` | 57 | 2026-11-04 adi45264 | Part 1 implementation plan and file ownership (Aaron vs Aditya). | roadmap / plan | None. `gateway/SESSION_LOG(4-11-26).md:58` says "Remove extra PLAN.md (not done per instruction)". | **merge into `tasks/T-0022-api-gateway.md`** (or archive). Its own author marked it for removal. |
| `gateway/SESSION_LOG(4-11-26).md` | 58 | 2026-11-04 adi45264 | Aditya's log of gateway Part 1, **Part 2 edits** (core PORT default 5001, CORS and rate limiter removed from core, request-id) and the **Gemini integration** in assessment-service. | log / history | None. | **merge into `WORKLOG.md`**, then archive. It is the only written record of Part 2 and Gemini; AUDIT, ARCHITECTURE and WORKLOG do not know about them. The parentheses in the filename are awkward for shell commands. |
| `frontend/README.md` | 70 | 2026-04-29 AjRagnarok | Unmodified Create React App boilerplate. | other | None. | **archive** (or replace with a three-line pointer to the root README). Holds no project facts. |

### 1c. `tests/`

| Path | Lines | Last commit | Purpose | Kind | Depended on by | Proposal |
|---|---|---|---|---|---|---|
| `tests/README.md` | 108 | 2026-11-05 anthonyjennis | Harness guide: baseline vs current targets and ports, setup, `run-suite.ps1` commands, per-suite data-safety table, sweep, snapshots. | how-to-run (tests) | S: `tests/run-suite.ps1:17`, ROADMAP Files cells, 18 docs. No machine dependency. | **keep**: owns "how to test". It is missing the `tests/gateway/` suite (§4). |
| `tests/MANUAL_SMOKE.md` | 164 | 2026-11-05 anthonyjennis | Manual browser smoke scripts A (baseline), B (HEAD at T-0001), C (integrated), D (merged 3-source score), each with an Observed column. | other (manual test script and record) | **M (indirect):** AUDIT rows use `tests/MANUAL_SMOKE.md` as their `tests/` reference (e.g. 5.1, 5.4, 5.5, 5.14), and check-trackers `:127-128` accepts any existing `tests/` path for DONE rows. S: `tests/backend/sweep.mjs:1,11`, `tests/.env.example:3`. | **keep**: basis for the demo smoke script. Section D's Observed column is empty (`tests/MANUAL_SMOKE.md:146-153`) although AUDIT 4.1 leans on it. |
| `tests/BASELINE_RESULTS.md` | 200 | 2026-10-12 anthonyjennis | What `32905c1` did under the T-0001 harness: timings, known-wrong outputs, f2-f4 scores. | verified status (historical evidence record) | **M:** AUDIT Evidence cites 14 line ranges in it (e.g. `:62-66`, `:78-79`, `:118`), and ARCHITECTURE cites `:64-65,:118`. Its line numbering must not change. | **keep in place**: an evidence artefact, not a narrative doc. |
| `tests/.out/t0009-probe.md` | 19 | untracked (gitignored) | Generated probe result table, P-1..P-3. | log / history (generated) | Written by `tests/arch/nlp-outage-probe.mjs:415`. | **leave**: generated output, not a doc. |
| `tests/.out/t0015-probe.md` | 29 | untracked (gitignored) | Generated probe result table, P-1..P-6 (latest 2026-11-04). | log / history (generated) | Same script. | **leave**. |

### 1d. `.claude/agents/` (untracked, created for the rebuild)

| Path | Lines | Last commit | Purpose | Kind | Depended on by | Proposal |
|---|---|---|---|---|---|---|
| `.claude/agents/patina-auditor.md` | 17 | untracked | Read-only investigator agent definition. | session rules (agent config) | Claude Code agent loader. | **keep**: configuration, not documentation. |
| `.claude/agents/patina-implementer.md` | 20 | untracked | Implementer agent; refers to `REBUILD/TASKS.md` (not yet written). | session rules (agent config) | same | **keep** |
| `.claude/agents/patina-mechanical.md` | 16 | untracked | Sonnet agent for judgement-free moves and renames. | session rules (agent config) | same | **keep** |
| `.claude/agents/patina-verifier.md` | 15 | untracked | Independent verifier agent. | session rules (agent config) | same | **keep** |

### 1e. `tasks/` (33 files), grouped

All task files: last commit by anthonyjennis. CLAUDE.md requires a spec here before code. **M:** check-trackers `:191` lists `tasks/` and fails if a ROADMAP item's Task cell names a `T-NNNN` with no `tasks/T-NNNN-*.md`. ROADMAP Task cells name (READ) T-0011..T-0015, T-0017..T-0022 and T-0029..T-0032; prose also names T-0010, T-0016 and T-0028. Moving any of those breaks the docs suite unless ROADMAP changes in the same edit. S: AUDIT "Delivered by" cells, `tests/backend/migration-guards.test.mjs:49` (comment naming T-0030), `supabase/migrations/20261103120300_drop_assessments_answer_key.sql:5` (comment naming T-0029).

The status in the "Status" column comes from the file's own `Status:` header and `## Result` section (READ). Several headers disagree with their own Result; see §3.

| Group | Files (lines) | Status per the files | Kind | Proposal |
|---|---|---|---|---|
| A. Done, Result filled, all criteria PASS | `T-0001-baseline-harness` (257), `T-0002-integration-review` (133), `T-0003-apply-integration` (376), `T-0004-shortlist-ownership` (56), `T-0005-notifications-send-removal` (38), `T-0006-requireauth-fail-closed` (42), `T-0007-analysis-isolation-guard` (42), `T-0008-tracker-reconciliation` (276), `T-0009-architecture-audit` (433), `T-0010-roadmap` (251), `T-0011-github-evidence-skeleton` (194), `T-0012-github-evidence-metrics` (224), `T-0013-parser-contact-determinism` (107), `T-0014-core-github-integration` (360), `T-0015-github-outage-probe` (141), `T-0016-next-six-specs` (170), `T-0023-integrate-main` (191, criterion 6 "awaiting the owner"), `T-0025-assessment-evaluate-loop` (87), `T-0026-assessment-resume-parse-fallback` (107), `T-0028-backlog-plan` (153), `T-0029-security-batch` (528), `T-0030-migrations-batch` (683), `T-0031-b3-backend-correctness` (579) | Result sections say PASS. T-0013 and T-0014 headers still say "awaiting owner commit"; T-0029's header still says "draft ... awaiting approval to execute" (`tasks/T-0029-security-batch.md:3`) while its Result says executed (`:497-498`). | task spec (closed; history) | **archive**: 23 files, history. Do it only when ROADMAP's Task cells are changed or ROADMAP is retired, because T-0011..T-0015 and T-0029..T-0031 are machine-referenced. Until then, keep in place. |
| B. Executed, Result incomplete | `T-0024-assessment-generate-only` (110): criterion 5, the manual UI check, is PENDING (`:91-92,108-109`). `T-0027-five-assessment-attempts` (86): criteria 1-2 PENDING (`:82-83`); WORKLOG L-0037 says "result pending". | partial | task spec | **archive** after the rebuild re-verifies the behaviour. Record the pending checks in AUDIT, not here. |
| C. Approved, in flight | `T-0022-api-gateway` (378): "Part 1 approved ... Part 2 draft, awaiting owner approval" (`:3`), Result empty. Part 1 code exists in `gateway/`; Part 2 edits were committed by a teammate in `2442ad4` and `636314c` (VERIFIED, `git log`). `T-0032-skill-vocabulary` (127): approved, owner Anurag, Result empty. | in progress | task spec | **keep**: active. T-0022 needs its status reconciled with what landed. |
| D. Draft, never started | `T-0017-link-annotations` (179), `T-0018-nlp-isolation` (230), `T-0019-frontend-test-runner` (176), `T-0020-score-on-apply` (352), `T-0021-one-api-base` (148): all "draft, awaiting owner approval" (`:3`), Result empty. | not started | task spec | **keep** as input to `REBUILD/TASKS.md`; archive once each is converted or dropped. ROADMAP Task cells reference all five. |
| Template | `TEMPLATE.md` (57) | n/a | task spec template | **keep**. Fix the stale path at `tasks/TEMPLATE.md:15` (`Docs/IMPLEMENTATION-TRACKER.md` is now under `Docs/archive/`). |

### 1f. Count by proposal (66 files)

- **keep: 28.** CLAUDE, CHECKLIST, AUDIT, ARCHITECTURE, ROADMAP, ISSUES, WORKLOG, PROJECT_SOURCE_DOCS, README, the runbook, 3 service READMEs (assessment, github-evidence, gateway), tests/README, MANUAL_SMOKE, BASELINE_RESULTS, TEMPLATE, 4 agents, and tasks groups C (2) and D (5).
- **merge: 4.** STEPS_TO_RUN_APP and HOW_TO_RUN_AND_TEST into README; gateway/PLAN into T-0022; gateway/SESSION_LOG into WORKLOG.
- **archive: 32.** CODE_MAP, REVIEW_BRIEF, INTEGRATION_REVIEW, ASSESSMENT_IMPLEMENTATION_PLAN, frontend/README, the 2 files already in `Docs/archive/`, tasks group A (23) and group B (2). Several of these are conditional on first editing cites or ROADMAP Task cells; see §5.
- **leave as generated output: 2** (`tests/.out/*.md`).

---

## 2. Overlaps (several documents holding the same kind of fact)

**A. "What is the current status" (9+ places).**
- `AUDIT.md`: machine-checked, last edited 2026-11-05.
- `README.md` "Current implementation" (`:28-41`): written Aug-Sep 2026.
- `CODE_MAP.md` "Quick truth check" (`:8-13`): 2026-10-12.
- `REVIEW_BRIEF.md` "Ground truth" (`:8-14`): 2026-10-12.
- `assessment-service/ASSESSMENT_IMPLEMENTATION_PLAN.md` §2 (`:39+`): 2026-10-14.
- `ARCHITECTURE.md` §0 and §2: architecture status.
- `Docs/archive/*`: self-reports.
- Task Result sections and `WORKLOG.md`: point-in-time.
- `gateway/SESSION_LOG(4-11-26).md`: the only record of gateway Part 2 and Gemini.

**Most trustworthy:** AUDIT.md. It is the only one with per-claim `file:line` evidence and a checker (READ). But it is stamped `Verified at commit: 2e87d44` (`AUDIT.md:7`) while rows carry T-0023..T-0031 deltas that were partly re-pointed by line diff rather than re-read (`AUDIT.md:38`). It has internal contradictions (§3) and knows nothing of the 2026-11-04 gateway Part 2 or the Gemini commits. Treat it as the best starting point, not as truth.

**B. "How the system is built" (architecture), 8 places.**
- `ARCHITECTURE.md`
- `AUDIT.md` "Services that actually run" (`:63-69`)
- `README.md` §Architecture (`:43-64`)
- `CODE_MAP.md`
- `REVIEW_BRIEF.md` §1 script
- `CLAUDE.md` "Architecture (as designed)"
- `PROJECT_SOURCE_DOCS.md` §3 (as specified)
- `gateway/PLAN.md` and `gateway/README.md`

**Most current and trustworthy:** ARCHITECTURE.md (2026-11-05, cites checked, per-section re-read log at `ARCHITECTURE.md:9-23`). It also predates gateway Part 2, and its docs check fails today.

**C. "How to run the app" (8 places, mutually inconsistent).**
- `README.md` Local setup (`:82-136`): oldest; no github-evidence, assessment or gateway.
- `STEPS_TO_RUN_APP.md`: newest, 2026-11-04; the only one with the gateway.
- `Docs/HOW_TO_RUN_AND_TEST.md`: 2026-10-15; no github-evidence, no gateway.
- `tests/MANUAL_SMOKE.md` §D start block (`:133-141`): five services, no gateway.
- `tests/README.md` (harness).
- `ARCHITECTURE.md` §1.2 table.
- `github-evidence/README.md` §Start.
- `assessment-service/README.md` §10.
- `frontend/README.md` (boilerplate).

**Most current:** STEPS_TO_RUN_APP.md for topology, but it is machine-specific and has wrong paths. **Most trustworthy per service:** the service READMEs; the assessment README's start commands are enforced by `tests/assessment/test_internal_only.py`. Whether core now listens on 5000 or 5001 is UNKNOWN from the docs (§3).

**D. "What we build next" (plan), 7+ places.**
- `ROADMAP.md`: owner-approved, machine-checked.
- `ARCHITECTURE.md` §5 M1-M7: mapped into ROADMAP P2-x.
- `assessment-service/ASSESSMENT_IMPLEMENTATION_PLAN.md` §4.
- `gateway/PLAN.md`.
- `Docs/archive/IMPLEMENTATION-TRACKER.md` "Implementation Order".
- `README.md` "Next milestone" (`:196-198`): stale.
- Draft tasks T-0017..T-0022.
- New: `REBUILD/PROGRESS.md` and the planned `REBUILD/TASKS.md`.

**Most current:** ROADMAP.md (Phase 0 added 2026-11-03, team assignments 2026-11-04). The rebuild will create a second plan unless ROADMAP is explicitly frozen or retired.

**E. Decisions (5 places).**
- `ARCHITECTURE.md` §3.2 (AD-1..AD-3) and §4 "Decisions recorded" (DEC-1..DEC-6, `:358-381`).
- `ROADMAP.md` "Decisions this roadmap rests on", "Defaults" and "Team assignments" (`:49-93`).
- Owner decisions inside task specs (e.g. D1-D5 in T-0014 and T-0031).
- `INTEGRATION_REVIEW.md` owner-decision column (R1..R40).
- `CLAUDE.md` (Supabase is authoritative).

**Most trustworthy:** ARCHITECTURE §4's DEC table (dated, owner-attributed). `REBUILD/DECISIONS.md` is meant to override all of these once approved (CLAUDE.md rebuild section).

**F. Spec / requirements (4 places).**
- `PROJECT_SOURCE_DOCS.md`: source.
- `CHECKLIST.md`: derived ids.
- `CLAUDE.md` "Known guide feedback" (GF-1..5, GR-1..2).
- `Docs/archive/project_checklist.md`: self-report.
- Plus the gitignored `Docs/scope/*.docx` originals.

No conflict in substance. GF and GR ids are defined in both CLAUDE.md and CHECKLIST.md.

**G. Backlog / known problems (6 places).**
- `ISSUES.md`
- `ROADMAP.md` Phase 0 "B4" table (`:123-139`)
- `AUDIT.md` "Known cruft at HEAD" (`:235-240`): stale, see §3.
- `assessment-service/README.md` §11 "Known limitations"
- `assessment-service/ASSESSMENT_IMPLEMENTATION_PLAN.md`
- `gateway/SESSION_LOG(4-11-26).md` "Remaining" (`:55-58`)

**Most trustworthy:** ISSUES.md. Every open entry was re-verified at `df98068` on 2026-11-03 (`ROADMAP.md:97`).

**H. Logs / history (6 places).**
- `WORKLOG.md`
- `gateway/SESSION_LOG(4-11-26).md`
- task Result sections
- `AUDIT.md` Changelog (`:37-45`)
- `README.md` Change log (`:188-194`, stops 2026-09-01)
- `INTEGRATION_REVIEW.md`

WORKLOG is the fullest record, but it has a hole for 2026-11-04/05 teammate work.

---

## 3. Contradictions (quoted; not resolved)

Ordered by how badly each would mislead a builder or the Nov 18 demo. All READ unless marked.

1. **Does an API gateway exist, and which port is core on?**
   - `AUDIT.md:67`: "Express backend | 5000, `backend/index.js` | Monolithic core and the browser's only API entry point. **Not a gateway**".
   - `AUDIT.md:212`: "**No API gateway exists.**"
   - `ARCHITECTURE.md:37`: "We don't have an API gateway yet; our Express server is currently the entry point".
   - `tests/README.md:8,10`: current backend 5000, "Current must use 8000/5000".
   - `Docs/HOW_TO_RUN_AND_TEST.md:13`: "Backend API | 5000 | `backend` | `node index.js`".
   - Versus `gateway/SESSION_LOG(4-11-26).md:35`: "backend/index.js: PORT default 5001, trust proxy 1, removed CORS".
   - And `STEPS_TO_RUN_APP.md:17`: `PORT=5001` for core, with the gateway on 5000 (`:31-34`).
   - Plus `ROADMAP.md:57`: "T-0022 Part 2 ... The project owner, with Aaron and Aditya | After T-0021 and B3", and `tasks/T-0022-api-gateway.md:3`: "Part 2 draft, awaiting owner approval".
   - Yet Part 2 edits are on `main` (VERIFIED: `git show --stat 2442ad4` touches `backend/index.js`, `backend/Routes/auth.routes.js`, `nlp-engine/app/main.py`). Which doc is right about the running topology is UNKNOWN.

2. **Which LLM provider assessment-service uses.**
   - `ARCHITECTURE.md:38`: "generates and grades a technical assessment with an LLM (OpenRouter)".
   - `ARCHITECTURE.md:65`: "holds OPENROUTER_API_KEY".
   - `assessment-service/README.md:162`: `OPENROUTER_API_KEY` is the key; there is no Gemini variable.
   - `Docs/HOW_TO_RUN_AND_TEST.md:19` and `STEPS_TO_RUN_APP.md:55`: OpenRouter only.
   - Versus `gateway/SESSION_LOG(4-11-26).md:44-46`: "Assessment service: Gemini integration ... Gemini tried first (multiple free models), OpenRouter as backup".
   - VERIFIED: `assessment-service/.env.example` now names `GEMINI_API_KEY`, `GEMINI_MODELS`, `GEMINI_BASE_URL` as well as the OpenRouter variables.
   - `CLAUDE.md:40` and `PROJECT_SOURCE_DOCS.md:107,157` say "OpenAI/Gemini".

3. **How many of the three Python services exist.** Self-contradiction in both core trackers:
   - `ARCHITECTURE.md:38`: "All three Python services we designed now run" vs `ARCHITECTURE.md:312-313`: "2 of the 3 designed services exist, and no API gateway exists".
   - `ARCHITECTURE.md:323`: "Validation (GitHub) and assessment are not built".
   - `AUDIT.md:77`: "All 3 Python services now exist as separate processes (T-0023)" vs `AUDIT.md:69`: "GitHub aggregator, assessment engine | none | Do not exist" and `AUDIT.md:233`: "GitHub and assessment do not exist".
   - `REVIEW_BRIEF.md:10`: "Designed, not built: GitHub evidence validation (Module 2), Generative AI assessment (Module 3)".
   - `CODE_MAP.md:10`: "No GitHub module, no LLM/assessment module".

4. **Does the app produce a score through the UI?**
   - `AUDIT.md:35`: "**No score is produced through the app's UI at HEAD** ... `POST /api/analyze`, has no reachable caller".
   - `AUDIT.md:172`: "**Nothing scores.**"
   - Versus `Docs/HOW_TO_RUN_AND_TEST.md:39,43`: "Your **latest** attempt counts toward the credibility score ... Recruiter dashboard shows the assessment pillar for the candidate".
   - And `STEPS_TO_RUN_APP.md:122`: "login as candidate/recruiter, upload resume, apply, analyze".
   - And `REVIEW_BRIEF.md:9`: "Live: resume parsing → semantic alignment → persisted, auditable credibility score, end to end".

5. **How to apply database migrations.**
   - `README.md:162`: "apply every SQL file in `supabase/migrations` through the Supabase SQL Editor, in filename order".
   - Versus `Docs/SUPABASE_MIGRATIONS_RUNBOOK.md:39-40`: "Migrations reach the shared project only through `npx supabase db push --linked`. Never paste a migration into the dashboard SQL editor."
   - Also `AUDIT.md:78`: "changes go only through `npx supabase db push --linked`".

6. **Database and persistence state in README.**
   - `README.md:38`: "Jobs are held in application memory".
   - `README.md:39`: "no tables or controller reads/writes are wired yet".
   - `README.md:50`: "Supabase (connection configured; tables pending)".
   - `README.md:61`: "Passport".
   - `README.md:41`: "LLM technical assessments | Planned".
   - Versus `AUDIT.md:47-61`: 7 tables and a bucket verified from migrations; Supabase is the only store.
   - Versus `ARCHITECTURE.md:335`: "No Passport". Already logged as I-0032.
   - Database choice itself: MongoDB appears only in `PROJECT_SOURCE_DOCS.md:106` (with the note that Supabase replaced it) and Firestore only in `Docs/archive/IMPLEMENTATION-TRACKER.md:32,75-118`. Every live doc agrees Supabase is the store.

7. **Assessment-service health check and API docs.**
   - `Docs/HOW_TO_RUN_AND_TEST.md:26,29`: "`Invoke-WebRequest http://127.0.0.1:8002/openapi.json` ... Expected: ... `8002 → 200`".
   - Versus `ARCHITECTURE.md:92`: "FastAPI docs and schema off (T-0029)".
   - Versus `tests/assessment/test_internal_only.py:15-17`: asserts `/openapi.json` returns 404.

8. **Assessment-service virtualenv directory.**
   - `STEPS_TO_RUN_APP.md:10`: `cd assessment-service; python -m venv venv`.
   - `STEPS_TO_RUN_APP.md:88`: `.\venv\Scripts\python.exe -m uvicorn`.
   - Versus `assessment-service/README.md:212`: `python -m venv assessment-service/.venv`.
   - Versus `Docs/HOW_TO_RUN_AND_TEST.md:12` and `tests/README.md:63`: `.venv`.
   - VERIFIED on disk: `assessment-service/.venv` exists; `assessment-service/venv` does not.

9. **Frontend API base variable.**
   - `STEPS_TO_RUN_APP.md:28`: `frontend/.env: VITE_API_BASE_URL=http://localhost:5000`.
   - Versus `tests/README.md:23`: "set `REACT_APP_API_BASE_URL`".
   - Versus ISSUES I-0012: reading `import.meta.env.VITE_*` under CRA is a bug.

10. **GF-4 tested or not.**
    - `AUDIT.md:228`: GF-4 "PARTIAL | Weight redistribution is ... untested with a second source".
    - Versus `AUDIT.md:163`: 4.7 "DONE_CORRECTLY ... `tests/backend/explainability.test.mjs` 'redistributes weights over available sources' (parsing alone → 1.0 ...; parsing + GitHub → 0.40/0.75 and 0.35/0.75)".

11. **Assessment page routed or not.**
    - `AUDIT.md:237`: "`frontend/src/pages/candidate/Assessment.jsx`: unrouted, calls non-existent routes".
    - Versus `AUDIT.md:178`: 5.3 "Route `frontend/src/App.jsx:65`".
    - Versus ISSUES I-0005 RESOLVED.
    - `AUDIT.md:236` and `:69` also name `backend/Controllers/githubAggregator.js`, which `ARCHITECTURE.md:129-130` says was deleted in T-0014 (VERIFIED missing).

12. **Count of CODE_REVIEWED_UNTESTED rows.**
    - `ROADMAP.md:406`: "Test backlog: the 11 CODE_REVIEWED_UNTESTED rows". Its table still lists 4.7.
    - Versus `AUDIT.md:32`: 10 CRU rows (VERIFIED, `node tests/docs/check-trackers.mjs --summary` gives 10). 4.7 is DONE_CORRECTLY.

13. **Number of migrations.**
    - `AUDIT.md:47`: "Data model (verified from `supabase/migrations/`, 6 files)".
    - `AUDIT.md:78`: "a fresh local replay of all 16 files".
    - VERIFIED on disk: 17 files (the 17th is `20261104120300_applicant_emails.sql`).

14. **Assessment module scheduled or built.**
    - `ROADMAP.md:456` ("Not scheduled"): "Assessment module (PFQS, rubrics, LLM service ...) | 3.1–3.13, GR-1, 5.3, 6.5 | GR-1 ... must be written before more of Module 3 is built".
    - `assessment-service/ASSESSMENT_IMPLEMENTATION_PLAN.md:3,30`: "Phase 1 implementation exists; testing, hardening, and integration remain"; "Not in the first integration milestone: Automated grading".
    - Versus `AUDIT.md:38`: Module 3 rows moved to PARTIAL/CRU after the T-0023 merge.
    - Versus `ARCHITECTURE.md:92`: generates and grades.

15. **Test suite existence.**
    - `REVIEW_BRIEF.md:14`: "No OCR, no custom-trained NER model, **no test suite**, no benchmarks".
    - Versus `tests/README.md:53-68`: 8 suites.
    - Versus `tasks/T-0031:3`: "All 16 criteria PASS", with backend 170+ tests.

16. **Schema gaps.**
    - `tests/README.md:98-100`: "`resumes` bucket (I-0001), `scores` table (I-0007), `resumes` table (I-0013) exist only in the live project, not in migrations".
    - Versus ISSUES (I-0001, I-0007, I-0013 all RESOLVED).
    - Versus `AUDIT.md:78`: migrations reproduce the live schema, `db diff` clean.

17. **Task numbers mean different things in different files.**
    - `WORKLOG.md:342,416,423,430`: headings "T-0016 assessment generate-only", "T-0017 evaluate loop", "T-0018 resume parse fallback", "T-0019 five attempts".
    - Versus `tasks/T-0016-next-six-specs.md`, `tasks/T-0017-link-annotations.md`, `tasks/T-0018-nlp-isolation.md`, `tasks/T-0019-frontend-test-runner.md`.
    - Explained at `WORKLOG.md:340` (renumbered to T-0024..T-0027 at the T-0023 merge). Log names in `tasks/T-0026:103` (`t0018-prefix.log`) and `tasks/T-0027:82` ("t0019 flow") still use the old numbers.

18. **Task header vs its own Result.**
    - `tasks/T-0029-security-batch.md:3`: "draft, owner decisions applied 2026-11-03; awaiting approval to execute" vs `:497`: "Executed 2026-11-03..04".
    - `tasks/T-0013:3` and `tasks/T-0014:3`: "awaiting owner commit" (the work has since been merged).

19. **Python version.**
    - `README.md:87`: "Python 3.11 or compatible".
    - Versus `ARCHITECTURE.md:90`: "Python 3.14 venv (README says 3.11)".
    - `README.md:126`: "do not create another virtual environment at the repository root". VERIFIED: a root `.venv/` exists, and so do both `nlp-engine/venv` and `nlp-engine/.venv` (I-0038).

20. **Assessment timeouts and retries in the run docs.**
    - `Docs/HOW_TO_RUN_AND_TEST.md:20`: `ASSESSMENT_REQUEST_TIMEOUT_SECONDS=240`, `ASSESSMENT_MAX_RETRIES_PER_MODEL=3`.
    - Versus `STEPS_TO_RUN_APP.md:57-58`: retries 2, timeout 60.
    - `ARCHITECTURE.md:121`: default 60.

21. **WORKLOG archive location.**
    - `WORKLOG.md:5`: `docs/worklog-archive/YYYY-MM.md`.
    - Versus `ROADMAP.md:360`: `Docs/worklog-archive/` (new).
    - Neither exists (VERIFIED). See the casing note in §5.

22. **"No deploy config" claim.**
    - `ARCHITECTURE.md:81-84`: a search for `*.toml` and others "returns nothing. The only script is `tests/run-suite.ps1`".
    - VERIFIED: `supabase/config.toml` and a root `package.json` (T-0030) now exist, as does a `gateway/` service.

Weights and formulas: no contradiction found. `CODE_MAP.md:216,521`, `tests/MANUAL_SMOKE.md:152` and `AUDIT.md:157,159` all say parsing 0.40 / GitHub 0.35 / assessment 0.25. The parsing sub-score is `0.6·skill_coverage + 0.4·semantic` in both `CODE_MAP.md:51` and `REVIEW_BRIEF.md:167,229` (READ; not checked against code).

---

## 4. Stale instructions (paths or commands pointing at things that no longer exist or no longer work)

Existence checked with `test -e` (VERIFIED); no commands were run.

| Doc:line | Instruction | Problem |
|---|---|---|
| `STEPS_TO_RUN_APP.md:5,73,80,87,93,100,107,113` | `cd C:\Users\Aditya\skill_validation_system\Patina...` | A machine-specific absolute path; wrong on every other machine. Same in `Docs/HOW_TO_RUN_AND_TEST.md:3`. |
| `STEPS_TO_RUN_APP.md:10,88` | `assessment-service ... python -m venv venv`, `.\venv\Scripts\python.exe` | `assessment-service/venv` does not exist; the real venv is `.venv` (VERIFIED). |
| `STEPS_TO_RUN_APP.md:26-29` | create `frontend/.env` with `VITE_API_BASE_URL` | No `frontend/.env.example` exists (VERIFIED). A `VITE_` variable is not read by CRA (I-0012). |
| `Docs/HOW_TO_RUN_AND_TEST.md:26,29` | health check `GET :8002/openapi.json` should return 200 | Docs are off since T-0029; the test asserts 404. |
| `README.md:162-168` | apply migrations through the SQL Editor | Forbidden by the runbook (`Docs/SUPABASE_MIGRATIONS_RUNBOOK.md:39-40`). The two migration files it names do exist. |
| `README.md:78` | "`Docs/` # Supporting architecture/research documentation" | `Docs/` now holds the runbook, the how-to and the archive; `Docs/Architecture.md` was deleted in `a7c74e4`. |
| `README.md:90-136` | setup covers backend, NLP and frontend only | No github-evidence, assessment-service or gateway steps. NLP `--reload` without `--host 127.0.0.1`. |
| `assessment-service/README.md:275` | `pip install -r assessment-serviceequirements-dev.txt` | The path is garbled: a `\r` swallowed the `\r` of `\requirements-dev.txt`. |
| `tests/README.md:98-100` | "Known schema gaps ... exist only in the live project" | False since T-0030 (§3 item 16). |
| `tests/README.md:35-45`; `tests/run-suite.ps1:39` | suites list `nlp, backend, frontend, docs, github, assessment` | `tests/gateway/` (3 test files, VERIFIED) is not in the harness or the README. It is run only by hand (`STEPS_TO_RUN_APP.md:114-115`). |
| `tasks/TEMPLATE.md:15` | cite `Docs/IMPLEMENTATION-TRACKER.md` | Moved to `Docs/archive/IMPLEMENTATION-TRACKER.md` (VERIFIED missing at the old path). |
| `ISSUES.md` I-0008 Module | `Docs/IMPLEMENTATION-TRACKER.md` | Same move. |
| `ISSUES.md` I-0041, I-0055, I-0066 Module | `supabase/migrations/20260903_create_resumes_and_scores.sql`, `20260823_create_profiles.sql`, `20261015_create_assessments.sql` | Renamed to 14-digit versions in T-0030 (e.g. `20260903000100_...`); the old paths are missing (VERIFIED for the first). |
| `AUDIT.md:69,236` | `backend/Controllers/githubAggregator.js` | Deleted (VERIFIED missing). |
| `AUDIT.md:80` (0.4 Notes) | "reset is token-gated (`backend/Routes/auth.routes.js:51-52`)" | The file has 24 lines. Not caught by the checker because the cite is in Notes, not Evidence. |
| `ARCHITECTURE.md:167-168,306,709-719` | cites `backend/Routes/auth.routes.js:17-21`, `:46-52` | Past end of file since `2442ad4` removed the in-memory rate limiter. **The docs suite fails on these (VERIFIED).** |
| `CLAUDE.md` (working tree, rebuild section) | names `REBUILD/DECISIONS.md` in backticks | The file does not exist yet, so **the docs suite fails (VERIFIED)**. |
| `WORKLOG.md:4-6` | "When this file passes ~400 lines, move ... to `docs/worklog-archive/`" | 591 lines; the folder does not exist (I-0064). |
| `tests/MANUAL_SMOKE.md:133-141` | five-terminal start, `cd backend; node index.js # port 5000` | No gateway; the port is now in doubt (§3 item 1). The Observed column for D1-D8 is empty. |
| `ROADMAP.md:121` (P0-3 Files) | `dev/null` (deleted) | Correctly describes a deletion that happened (VERIFIED missing); not stale. |
| `.claude/agents/patina-implementer.md` | refers to `REBUILD/TASKS.md` | Not written yet; expected in the rebuild. |

---

## 5. Machine-enforced constraints (what breaks if documents move)

### 5a. `tests/docs/check-trackers.mjs` (READ in full, 285 lines; VERIFIED run)

Run as the `docs` suite of `tests/run-suite.ps1` (`tests/run-suite.ps1:147-152`). It exits 1 on any problem.

**Current result (VERIFIED, `node tests/docs/check-trackers.mjs`): exit 1, 11 problems.** One comes from `CLAUDE.md` naming `REBUILD/DECISIONS.md`. Ten are ARCHITECTURE cites past the end of `backend/Routes/auth.routes.js`. The `--summary` counts match AUDIT's Summary table (91 rows: 12 DONE, 6 broken, 33 partial, 30 missing, 10 CRU, 0 claimed).

Hardcoded paths it reads: `CHECKLIST.md`, `AUDIT.md`, `CLAUDE.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `ISSUES.md` and the `tasks/` directory, all relative to the repo root (`:33-34`). A rename or move of any of these fails the suite unless the script changes.

Rules per file:
- **CHECKLIST.md** (`:64-69`):
  - Ids are the first cell of any table row matching `^\d+\.\d+[a-z]?$`, `GR-n` or `X-n`.
  - No duplicates.
  - GR-1, GR-2, X-1 and X-2 must exist (`:40,96`).
  - GF-n are not CHECKLIST ids for the checker.
- **AUDIT.md** (`:71-139`):
  - Rows come from tables whose first header starts `item` and that have a `status` column.
  - There must be a 1:1 mapping with CHECKLIST ids.
  - Status must be one of the six values (`:35-38`).
  - The `spec` and `delivered` cells must be non-empty.
  - Every `file:line` in the **Evidence** column must exist and be in range. The pattern is `citeRe` (`:100`); its extensions are only js, jsx, mjs, py, sql, md, json, ps1, txt and css (I-0042: `.yml`, `.toml`, `.ts` and paths with spaces are silently not checked).
  - CODE_REVIEWED_UNTESTED rows need a valid cite plus "Promote with: \`tests/...\` ... asserts" in Notes.
  - DONE_CORRECTLY rows need a valid cite plus an existing `tests/...` path, and must not cite `Docs/archive|project_checklist|IMPLEMENTATION-TRACKER`. That regex is case-sensitive, so a `docs/archive/` path would slip past it.
  - Rows GF-1..GF-5 must appear in some AUDIT table.
  - There must be a line `Verified at commit: <hash>`, and the hash must be a real commit.
- **CLAUDE.md** (`:141-146`): every backticked token ending in `.md` (except ones containing `<`, `>`, `*` or `NNNN`) must exist. Today that covers `CHECKLIST.md`, `AUDIT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `PROJECT_SOURCE_DOCS.md`, `WORKLOG.md`, `ISSUES.md`, `tasks/TEMPLATE.md`, `Docs/archive/project_checklist.md`, `Docs/archive/IMPLEMENTATION-TRACKER.md`, `REBUILD/KICKOFF.md`, `REBUILD/PROGRESS.md` and `REBUILD/DECISIONS.md` (missing). Rewriting CLAUDE.md's file list changes what is enforced; naming a not-yet-written file fails the suite.
- **ARCHITECTURE.md** (`:148-181`):
  - The file must exist.
  - Every `citeRe` match **anywhere in the file** must resolve. That covers `.md` cites into `README.md` (needs ≥123 lines), `PROJECT_SOURCE_DOCS.md` (≥171), `REVIEW_BRIEF.md` (≥313), `CODE_MAP.md` (≥500), `Docs/archive/IMPLEMENTATION-TRACKER.md` (≥32), `Docs/archive/project_checklist.md` (≥18), `tests/BASELINE_RESULTS.md` (≥118) and `github-evidence/README.md` (≥18).
  - Any table with an Evidence column needs a cite or `P-n` in every row.
  - Any Verdict column must hold PASS, PARTIAL or FAIL.
  - It needs a `Verified at commit:` line with a real hash.
- **ROADMAP.md** (`:183-242`):
  - The file must exist.
  - Item tables are those whose first header is `id` and that have a `size` column. They need the columns Id, Item, Depends on, Size, Files, Moves, Issues, Task.
  - Ids match `P[0-9]-n` and are unique; Size is S, M or L; dependencies must be defined in an earlier row; no cell may be empty.
  - Moves ids must be CHECKLIST ids, and Task T-ids must have `tasks/T-NNNN-*.md`.
  - **Every `I-NNNN` anywhere in the file must be a `### I-NNNN` heading in ISSUES.md**; ROADMAP currently names 63, including resolved ones.
  - Every cite must resolve.
  - Warnings only: open issues (from ISSUES tables whose first header is `id` with a `status` column) or CRU rows that no item maps.
- **ISSUES.md**: the `### I-NNNN` heading format and the Open table's `ID | ... | Status` header shape are parsed (`:190,231-238`).
- `--changes` reads `git show 32905c1:AUDIT.md` (history only).

### 5b. Other machine dependencies on `.md` files (VERIFIED by `git grep` over non-md tracked files)

- **`tests/assessment/test_internal_only.py:46-59`** reads `assessment-service/README.md`. It must contain a start-command line. No line may contain `0.0.0.0`; any `--port` must be `--port 8002`; any `--host` must be `--host 127.0.0.1`; `:8000` must appear nowhere. This is part of the `assessment` suite.
- **`tests/arch/nlp-outage-probe.mjs:415`** writes `tests/.out/t0009-probe.md` or `tests/.out/t0015-probe.md` (output, not input).
- **AUDIT and ARCHITECTURE evidence cites** make `tests/BASELINE_RESULTS.md`, `assessment-service/README.md:288` and `assessment-service/ASSESSMENT_IMPLEMENTATION_PLAN.md:32` checked inputs (see 5a).
- **Soft (comments only):**
  - `backend/Services/githubEvidence.js:3-4,35,70`, `backend/Services/internalHttp.js:11,15`, `backend/Services/explainability.js:72,309,359,644`, `github-evidence/app/github_client.py:3`, `github-evidence/app/metrics.py:3` and `github-evidence/.env.example:4` point at `github-evidence/README.md` or "ROADMAP §1.x / P-n".
  - `tests/backend/migration-guards.test.mjs:49` points at `tasks/T-0030-migrations-batch.md`.
  - `tests/backend/sweep.mjs:1,11` and `tests/.env.example:3` point at `MANUAL_SMOKE.md`.
  - `tests/run-suite.ps1:17,21` points at `tests/README.md`.
  - `.obsidian/workspace.json` lists recent files.
- **`.claude/settings.local.json`** runs the hook `.claude/hooks/log-prompt.js` (writes `.claude/logs/prompts.jsonl`); no `.md` dependency.
- No CI workflow exists (`.github/` absent, VERIFIED), so nothing else enforces docs.

### 5c. Casing hazard for the planned `docs/archive/`

The existing tracked folder is `Docs/` (capital D: `Docs/archive/*`, `Docs/HOW_TO_RUN_AND_TEST.md`, `Docs/SUPABASE_MIGRATIONS_RUNBOOK.md`). `git config core.ignorecase` is `true` here (VERIFIED). On this Windows checkout `docs/archive/x.md` resolves to `Docs/archive/x.md` on disk, but git can record new files under a differently cased path. A Linux clone would then get two folders, and check-trackers' `existsSync` and its case-sensitive `Docs/archive` ban (`:129`) would behave differently on Linux. Pick one casing, preferably the existing `Docs/`, or do an explicit `git mv Docs docs` in a single owner commit. `REBUILD/KICKOFF.md` already says `docs/scope/` for what is on disk as `Docs/scope/` (gitignored).

---

## 6. Proposed final set (input to the lead, not a decision)

One kind of fact per document:

| Document | Owns exactly | Notes |
|---|---|---|
| `CLAUDE.md` | Session rules and the map of which file owns what | Must list only files that exist (checker). Drop the duplicated GF/GR definitions or point them at CHECKLIST. |
| `PROJECT_SOURCE_DOCS.md` | The specification as written (frozen) | Plus the gitignored `Docs/scope/*.docx` originals. |
| `CHECKLIST.md` | Requirement ids and "done correctly" definitions (spec-derived) | Machine-checked. |
| `AUDIT.md` | Verified status, one row per id | The **only** status document. Remove README's status table, CODE_MAP's "truth check" and REVIEW_BRIEF's ground truth. |
| `REBUILD/DECISIONS.md` | Decisions (supersedes the ARCHITECTURE §3.2/§4 DEC/AD tables and ROADMAP "Defaults" once approved) | ARCHITECTURE keeps a pointer. |
| `ARCHITECTURE.md` | How the system is wired (as-is) and the target design | Machine-checked; re-verify after gateway Part 2. |
| One plan: either `ROADMAP.md` or `REBUILD/PROGRESS.md` + `REBUILD/TASKS.md` | What gets built next | Two live plans will diverge. If ROADMAP is retired, change check-trackers in the same commit. |
| `ISSUES.md` | Backlog of known problems | Resolved entries stay in the file (ROADMAP names them). |
| `WORKLOG.md` | Session log (recent entries only) | Archive older entries; absorb gateway SESSION_LOG. |
| `README.md` | Front door and how to run the whole stack | Absorb STEPS_TO_RUN_APP and HOW_TO_RUN_AND_TEST; no status table. |
| `tests/README.md` | How to run the tests | Add the gateway suite. |
| `tests/MANUAL_SMOKE.md` | Demo / manual smoke script with observed results | |
| `tests/BASELINE_RESULTS.md` | Frozen evidence record (cited by line) | Never edit line positions. |
| `Docs/SUPABASE_MIGRATIONS_RUNBOOK.md` | How schema changes are applied | |
| `github-evidence/README.md`, `assessment-service/README.md`, `gateway/README.md` | Per-service contract, config and start command | The assessment README is test-enforced. |
| `tasks/` (+ `TEMPLATE.md`) | Task specs | Or `REBUILD/TASKS.md` during the rebuild; choose one. |
| `Docs/archive/` | Everything else | CODE_MAP, REVIEW_BRIEF, INTEGRATION_REVIEW, the assessment plan, gateway PLAN and SESSION_LOG, frontend/README, the two old trackers, and closed task specs once ROADMAP no longer names them. |

---

## 7. ISSUES.md index

Source: the `ISSUES.md` Open table (`:21-56`, read in full) and the `**Status:**` and `**Module:**` line of all 79 `### I-NNNN` entries (READ). Ids I-0001..I-0079 are all present; there are 79 headings (VERIFIED, `grep -c '^### I-'`).

**By status:**
- OPEN: 32. Five are marked "partly fixed" or limited: I-0004, I-0012 and I-0045 (partly fixed), I-0039 (OAuth vars only) and I-0026 ("team decision").
- RESOLVED: 46.
- WONTFIX: 1 (I-0075).
- IN-PROGRESS: 0.

**Resolved, by resolving task:**

| Resolved by | Count | Ids |
|---|---|---|
| T-0031 | 13 | I-0016, 0025, 0027, 0028, 0029, 0059, 0062, 0063, 0065, 0071, 0072, 0073, 0079 |
| T-0029 | 8 | I-0017, 0055, 0056, 0058, 0060, 0061, 0066, 0069 |
| T-0003 | 8 | I-0007, 0009, 0011, 0013, 0018, 0022, 0023, 0024 |
| T-0030 | 4 | I-0001, 0010, 0041, 0057 |
| T-0004, T-0005, T-0006 | 1 each (3) | I-0019, 0020, 0021 |
| T-0028 | 2 | I-0051, 0070 |
| Other | 8 | I-0002, I-0003, I-0005, I-0008, I-0014, I-0015, I-0047, I-0049 |

The "Other" row breaks down as: superseded by a rewrite or an ad-hoc task (I-0002, I-0003, I-0014), `main`'s assessment work (I-0005), T-0008 (I-0008), T-0013 (I-0015), T-0014 (I-0047) and T-0015 (I-0049).

**Open, by severity:** P1: 3 (I-0012, I-0052, I-0067). P2: 14. P3: 15.

**Open, by module:**

| Module | Count | Ids |
|---|---|---|
| docs / trackers | 9 | I-0030, 0031, 0032, 0033, 0042, 0043, 0044, 0045, 0064 |
| backend | 8 | I-0034 (shared with NLP), 0035, 0036, 0039, 0053, 0074, 0076, 0078 |
| frontend | 6 | I-0006, 0012, 0026, 0040, 0054, 0068 |
| nlp-engine | 4 | I-0004, 0037, 0038, 0052 |
| github-evidence | 2 | I-0046, 0048 |
| tests / harness | 2 | I-0050, 0077 |
| assessment-service | 1 | I-0067 |

**Every open entry (id, severity, title of at most 12 words):**

| Id | Sev | Title |
|---|---|---|
| I-0004 | P3 | Invented and duplicate entries in `SKILL_KEYWORDS` (partly fixed) |
| I-0006 | P2 | Upload page validates file type only at submit, not selection |
| I-0012 | P1 | Frontend reads `VITE_*` under CRA; five pages hardcode localhost:5000 |
| I-0026 | P3 | Landing page demo score and stats read as real data |
| I-0030 | P2 | CODE_MAP describes the pre-T-0003 flow; misses upload/apply/applicants routes |
| I-0031 | P2 | REVIEW_BRIEF rests on stale CODE_MAP and AUDIT claims |
| I-0032 | P2 | README says tables pending, jobs in-memory; API and env incomplete |
| I-0033 | P3 | PROJECT_SOURCE_DOCS names MongoDB; code uses Supabase |
| I-0034 | P2 | NLP unauthenticated, CORS `*`, exposes `/docs`; analyze forwards any file |
| I-0035 | P2 | Core single-process only: MemoryStore sessions, in-memory limiter, no regeneration |
| I-0036 | P2 | NLP outage: raw 500, echoed 502, no timeout or retry |
| I-0037 | P2 | NLP `/parse` is async but CPU-bound; parses serialise |
| I-0038 | P2 | Unpinned requirements; three venvs; Python 3.14 vs README 3.11 |
| I-0039 | P3 | Backend cruft: unused OAuth env vars remain (rest removed T-0031) |
| I-0040 | P3 | Recruiter GitHub link is relative when the parsed link lacks a scheme |
| I-0042 | P3 | Docs checker skips `.yml`/`.yaml`/`.toml`/`.ts` cites and paths with spaces |
| I-0043 | P3 | ROADMAP P1-3 claims full GitHub path captured; only the profile is |
| I-0044 | P3 | ROADMAP §1.6 names `--disable-socket`; tests use `--allow-hosts` |
| I-0045 | P3 | Task specs cite ROADMAP §1.2 for a contract now in github-evidence README |
| I-0046 | P3 | Starlette TestClient deprecation warning with httpx |
| I-0048 | P2 | Inactive GitHub account scores 0.30 from corroboration alone; author-set dates trusted |
| I-0050 | P3 | Probe labels its login row "P-1 NLP down" when phase 1 is unselected |
| I-0052 | P1 | GitHub link only as a PDF hyperlink annotation is not read |
| I-0053 | P2 | Recruiter per-job list drops a candidate scored for another job |
| I-0054 | P3 | Recruiter Jobs page always shows "0 Applications Total" |
| I-0064 | P3 | WORKLOG.md past its ~400-line archive threshold |
| I-0067 | P1 | Short-answer grading prompt injectable; grading output not schema-checked |
| I-0068 | P2 | Frontend CI build fails on lint warnings; `AllCandidates` reads `import.meta.env` |
| I-0074 | P3 | Repeated shortlist or reject sends a duplicate notification |
| I-0076 | P3 | Unparseable multipart body gives a 500 HTML page on upload routes |
| I-0077 | P2 | `run-suite.ps1` silently tests whatever already listens on :5000 |
| I-0078 | P2 | Résumé uploads checked by extension only; a text file named `.pdf` passes |

Notes on the backlog:
- Nine of the 32 open issues are about documentation (I-0030..0033, 0042..0045, 0064). The consolidation can close most of them directly.
- No issue records the gateway Part 2 landing outside its task, the Gemini switch, or the currently failing docs suite. These are candidates for new ISSUES entries (not added here: this phase is inventory only).
