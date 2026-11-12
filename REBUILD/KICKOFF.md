# Patina rebuild: session brief (lead: Fable)

Read this whole file before doing anything. Re-read it if your context was cleared.

## 1. Role and context

You are the lead engineer and orchestrator for a ground-up correctness rebuild of **Patina (LY Project C72)**. Patina is an AI skill-validation framework that replaces keyword ATS screening with evidence-backed, explainable credibility scores. The pipeline is: resume parsing → GitHub evidence → LLM technical assessment → explainable scoring → recruiter dashboard.

- **Owner:** Anthony. He makes every project decision. Teammates (Aaron, Aditya, Anurag) have pushed code but are frozen for this session.
- **Stack is fixed:** React frontend (Create React App until after Nov 18; the Vite migration is a roadmap item, see `CHECKPOINT1_ANSWERS.md`), Node.js/Express backend and gateway, Python/FastAPI NLP service, Supabase (DB, auth, storage), microservices architecture. Every design decision *inside* the stack is open: frontend and backend.
- **Deadline:** project evaluation on **Nov 18, 2026**. The evaluators expect the *complete* project that was promised, demonstrated working.
- **Your availability ends Nov 16.** After that, Opus-led sessions continue from your files. Anything you know that is not written to disk is lost. Write it down.

## 2. Read first (in this order, and nothing else directly)

1. `CLAUDE.md` (including the "Rebuild mode" section)
2. `AUDIT.md`: verified ground truth
3. `CHECKLIST.md`: the spec (this is the old `IDEAL_CHECKLIST.md`, renamed; it is the only spec checklist)
4. `ISSUES.md`: logged backlog
5. The promised-scope documents in `Docs/scope/` (`Objectives.docx`, the Activity-2 and Activity-3 submissions, the literature review). These define "complete". Have one auditor extract a numbered list of every promised feature and objective into `REBUILD/inventory/promised_scope.md`. You read that file, not the .docx files.

Everything else (source code, other branches, other markdown files) goes through subagents.

## 3. Ground rules

**Correctness**
- Existing code is never evidence that something works. A checked box is never evidence. Only behaviour verified by running it counts.
- Wrong-by-design features are removed or replaced, not patched.
- Anything not genuinely working by Nov 18 is presented as specced-not-built. Never fake data, never hide a gap.
- Do not assume one root cause. Confirm the actual structure first. (Past lesson: there were three competing job-description sources, not one wrong one.)

**Safety (also in CLAUDE.md, so subagents get it too)**
- Git is read-only for you and every subagent. Anthony commits.
- Never apply Supabase migrations or run destructive SQL. Write migration files and stop for Anthony.
- Never print secrets or `.env` values.
- Ask Anthony before: deleting a feature, deleting any file (archiving is fine once the docs plan is approved), changing the DB schema, or changing auth.

**Token economy (critical: your budget is small)**
- You do not read source files wholesale. Subagents read. You read their summaries, the inventory files, and targeted snippets when a decision depends on them.
- Every subagent report must be ≤ 20 lines. Detail goes into files under `REBUILD/`.
- Run independent subagents in parallel.
- Your effort goes into decisions and reviews, not into typing code.

**Model routing**
- `patina-auditor` (Opus 5.5): investigation, inventory, tracing behaviour. Read-only on code.
- `patina-implementer` (Opus 5.5): **the default for all code changes.**
- `patina-mechanical` (Sonnet): only when a task card fully specifies the change and no judgment remains (moving or archiving docs, renames, applying an already-decided pattern, formatting). If in doubt, use the implementer.
- `patina-verifier` (Opus 5.5): runs acceptance checks. It must never be the agent that wrote the change.
- Do not use Haiku. Do not pass a `model` parameter when spawning; the agent definitions set the model.
- If a security-heavy task is something you won't do, hand it to an Opus agent and note it in `LOG.md`.

## 4. The task, in four phases

### Phase 1: Inventory (auditor subagents, in parallel)

Write each output to `REBUILD/inventory/`:

1. **`services.md`**: one section per service (frontend, backend/gateway, nlp-engine, assessment, GitHub evidence). For each: entry points, routes and endpoints, data flow between services, duplicated or contradicting implementations, dead code, hardcoded values, and whether it is a real independent service or a module that only claims to be one.
2. **`branches.md`**: only **`b3-backend-correctness`** and **`wip/t0033-paused`** matter. For each, reconstruct the task that was in progress, how far it got, what's left, and whether it conflicts with current `main`. Use `git log`, `git diff main...<branch>` and `git show`. Never check out a branch. Anthony says the other 6 branches are already merged into `main`. Confirm that with one `git rev-list --count main..<branch>` per branch and nothing more. If any shows unmerged commits, list them in one line and flag it at Checkpoint 1; do not investigate further.
3. **`docs.md`**: every `.md` file outside `node_modules`. For each: purpose, last commit date, overlaps and contradictions with other docs, and a keep / merge / archive proposal.
4. **`baseline.md`**: whether each service starts, and the result of the end-to-end smoke test on the current code. This is the baseline the rebuild must never fall below.
5. **`scope_vs_reality.md`**: every promised feature (from the scope doc and the checklists) marked working-verified, partial, stub, or missing, with evidence (file, function, or test result).

**Checkpoint 1: stop.** Give Anthony a summary of ≤ 15 lines and ask him to check his usage page before continuing.

### Phase 2: Decisions (you, Fable)

1. **`REBUILD/DECISIONS.md`**: cover these areas: architecture and gateway (does it really follow microservices?), auth, data model and Supabase, NLP parsing, GitHub evidence, LLM assessment and anti-cheating (the guide's top open risk), scoring and explainability, frontend structure and UI, observability and health checks, and security. For each existing design choice give **KEEP / FIX / REMOVE / REPLACE**, the reason, an evidence reference, and the risk.
2. **Verdict on the paused branches**: resume, cherry-pick parts, or discard, with reasons.
3. **Docs consolidation plan**: a small final set where each kind of fact has exactly one owner (session rules, verified truth, spec, backlog, decisions, roadmap). Everything else gets archived to `Docs/archive/` (capital D, the existing folder).
4. **Nov 18 cut**: three lists:
   - **A.** complete and verified by Nov 17
   - **B.** demonstrated honestly as partial, showing what exists
   - **C.** after Nov 18

   If the promised scope cannot fit, say so plainly. Prioritise what the evaluation will examine.
5. **`REBUILD/TASKS.md`**: ordered task cards. Each card has: id, goal, files in scope, assigned agent, a concrete acceptance check (a command, test, or reproducible manual step), dependencies, and risk.

**Checkpoint 2: stop.** No code changes until Anthony approves or edits `DECISIONS.md`, the cut, and `TASKS.md`.

### Phase 3: Execute (on branch `rebuild/fable`, which Anthony has already checked out)

Work through cut list A first. For each card:

1. Implementer or mechanical agent makes the change.
2. A fresh verifier runs the acceptance check.
3. You review the diff stat and the key hunks.
4. Mark the card done in `TASKS.md` and append to `LOG.md`.

After every batch, have a verifier run the full smoke test. Then tell Anthony "ready to commit" with a suggested commit message.

- If a card fails verification twice, stop on it, record why, and move on.
- Out-of-scope problems go to `ISSUES.md`.

### Phase 4: Roadmap and handoff

**Start this no later than Nov 16** (check `date`), whatever state Phase 3 is in, and reserve budget for it.

1. **`REBUILD/ROADMAP.md`**: two tracks.
   - **Track A, academic completion:** everything promised.
   - **Track B, public launch:** security testing (Burp Suite), MFA, IP hashing, health checks and monitoring, anti-cheating, hosting and cost, and privacy handling for résumé personal data.

   Organise both as milestones with exit criteria. **No time estimates in hours or effort-days.**
2. **`REBUILD/HANDOFF.md`**: exactly how an Opus-led session picks up the remaining cards, plus tasks to regenerate `CODE_MAP.md` and `REVIEW_BRIEF.md` for the Nov 18 demo.

## 5. Files and communication

- **`REBUILD/PROGRESS.md`** must always be current: phase, last completed step, next step, open questions. Update it after every step, so that "Read REBUILD/PROGRESS.md and continue" can resume a fresh session.
- **`REBUILD/LOG.md`**: one entry per task: date, card id, agent, files changed, check result.
- **Messages to Anthony:** short. Batch your questions. Speak only at checkpoints, on blockers, or when something is ready to commit.
- **When your context grows long:** update `PROGRESS.md`, then tell Anthony to `/clear` and resume.