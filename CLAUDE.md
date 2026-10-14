# AI-Automated Skill Validation and Credibility Framework — Project Memory

Read this file at the start of every session. It contains only stable facts
about the project — not feature status.

## Source of truth (one file per question)
- **What should exist:** `CHECKLIST.md` (root). Spec-derived item list with
  ids (0.1 ... 6.8, `GF-n`, `GR-n`). The only place item ids are defined.
- **What actually exists and its real condition:** `AUDIT.md` (root). One row
  per CHECKLIST id: status, evidence, spec id, delivered-by task/commit.
- **A status of DONE_CORRECTLY needs `file:line` evidence plus a test name or
  harness result.** Same bar for every author. Code read at HEAD but with no
  test is `CODE_REVIEWED_UNTESTED` (the row names the test that would promote it);
  a claim nobody has checked is `CLAIMED_UNVERIFIED`. `node tests/docs/check-trackers.mjs` (the `docs`
  suite of `tests/run-suite.ps1`) enforces this; run it after editing either file.
- **How the system is wired, and the target architecture:** `ARCHITECTURE.md`
  (root). Its as-is claims cite `file:line` at its verified-at commit, and the
  `docs` suite checks that the cites resolve. Its §4–§5 (to-be, migration) are
  proposals, not status; status stays in AUDIT.md.
- **What gets built next, and in what order:** `ROADMAP.md` (root). A plan,
  never status; the `docs` suite checks its dependency order and ids.
- `Docs/archive/project_checklist.md` and `Docs/archive/IMPLEMENTATION-TRACKER.md`
  are archived team self-reports (T-0008). Do NOT treat them as accurate:
  checked boxes there are not evidence. They are history, not a pointer.

## What this project is
Replaces keyword-based ATS with a multi-layer pipeline: resume parsing (NLP)
→ GitHub evidence validation → LLM-generated technical assessment → unified
"Credibility Score" with explainability, shown on a recruiter dashboard.
Full spec: PROJECT_SOURCE_DOCS.md.

## Architecture (as designed)
- Frontend: React (Landing, Login, Candidate Dashboard, Upload, Recruiter
  views)
- Backend: Node.js/Express (routing, CORS, middleware, forwards files to
  FastAPI)
- NLP microservice: Python/FastAPI
- DB: Supabase (SRS originally specified MongoDB — Supabase is the actual
  implementation choice; treat Supabase as authoritative)
- External APIs: GitHub API, an LLM provider (OpenAI/Gemini)

## Known guide feedback (must eventually be reflected somewhere in the plan)
Numbered 1-5 here = `GF-1`..`GF-5` in CHECKLIST.md/AUDIT.md.
1. LinkedIn + certificate validation
2. OCR is a must
3. Fair scoring for support/maintenance-only candidates, not just development
4. GitHub must be optional
5. Score explainability is crucial

Guide-review items, owner-reported (no written source in the repo):
- `GR-1` (guide review, Sep 2026): before the LLM/PFQS assessment module is
  built, design a mechanism that prevents candidates from cheating on it.
- `GR-2` (guide feedback, Oct 2026): identify the API gateway and verify the
  system actually follows the microservices architecture claimed in the SRS;
  fix it if it doesn't. Audited in T-0009; findings and the migration plan
  are in `ARCHITECTURE.md`.

## Working agreements for this repo
- Never mark something as done, correct, or complete without actually
  reading the relevant code first. A checked box in any team checklist
  (including the archived ones) is not sufficient evidence.
- When auditing or building, use a subagent for file-reading/grepping across
  many files so the main session context only receives a summary, not raw
  file contents.
- Update AUDIT.md / CHECKLIST.md yourself as status changes — don't
  ask the user to do it manually.
- Work on one module at a time. Don't touch files outside the scoped module
  unless the task explicitly requires it.
- Prefer deleting/consolidating duplicate or AI-generated cruft over adding
  a third version of something that already exists twice.
- Small, frequent commits with clear messages. No sprawling multi-module
  diffs in one commit.
- NEVER run git commit, git push, git checkout -b, or create pull requests.
  Do not stage files. Write code only and leave the working tree dirty —
  the user handles all version control themselves. If you think a commit
  boundary makes sense, say so in your summary and stop.

## Session protocol
- **Start:** read CLAUDE.md, the last 5 entries in WORKLOG.md, and the
  ISSUES.md entries for the module being touched. Never read the whole log.
- **Before code:** write a task spec in `tasks/T-NNNN-<slug>.md` (see
  `tasks/TEMPLATE.md`). Wait for the user's approval of the acceptance
  criteria before implementing anything.
- **During:** if you find a problem outside the current task's scope, add a
  new ISSUES.md entry — do not fix it silently out of scope.
- **End:** run the task's verification steps, fill in the task's "Result"
  section with PASS/FAIL + evidence per criterion, then append one entry to
  WORKLOG.md (format and length limit defined there).
- Never commit, push, or open PRs (existing rule above — kept here as a
  reminder since this section is read every session).