# Overnight run: design cards D-4 to D-10 (unattended)

Anthony is asleep from about 03:00 to 08:00 IST and **cannot answer anything**. Every decision you need is in this file. Where something is still unclear, take the more conservative option (do less, change less), write down what you chose, and carry on. Never stop to wait for input. If you run out of safe work, finish the report in step 6 and stop.

Read first: `CLAUDE.md`, `REBUILD/PROGRESS.md`, `Docs/design-refs/DESIGN_SPEC.md` (§10 cards, §11 test hooks), `REBUILD/TASKS.md` (R-35a to R-35k). Re-read this file and `PROGRESS.md` whenever your context is compacted.

## 1. Scope

Branch `design/refresh` only. D-1, D-2 and D-3 are done and committed.

| Order | Card | Run it? |
|---|---|---|
| 1 | D-4 Auth screens | Yes |
| 2 | D-5 Results page + score ring (e2e after) | Yes |
| 3 | D-6 ScoreBreakdown + drill-down | Yes |
| 4 | D-7 Candidate pages | **YES** |
| 5 | D-8 Recruiter and admin pages | **YES** |
| 6 | D-10 Verification pass | Yes, always, even if earlier cards failed |
| — | D-9 Landing | **No.** It needs O-10, which Anthony has not done |

## 2. Decision already made: the status chip colours

Green is reserved for evidence and verification, so the application statuses use the brand blue in steps:

- **Submitted / Applied:** `outline` (neutral).
- **Under review:** soft primary (`bg-primary/10 text-primary border-primary/20`).
- **Shortlisted:** filled primary (`bg-primary text-primary-foreground border-transparent`), with the lucide `Star` icon.
- **Rejected:** `destructive` (soft red).

Labels, `data-status` values and test ids stay unchanged.

Apply this mapping in whichever card restyles that status chip (D-7 for the candidate dashboard, D-8 for the recruiter table). If D-7 and D-8 are both NO, and all statuses map from one variant definition, change only that mapping as part of D-6. Otherwise leave it and note it in the report.

## 3. Protocol for every card

1. **Back up first.** Copy every file the card lists to `REBUILD/backup/<card>/`, keeping the same relative paths. This is the only undo, because git stays read-only.
2. **Build.** Use a Sonnet subagent (`patina-mechanical`), giving it the card text from the spec verbatim plus the §11 hooks.
3. **Check.** Run the card's own check plus the global check **G** (spec §10.1).
4. **If the check fails:**
   - Give Sonnet one fix attempt.
   - If it still fails, give an Opus subagent (`patina-implementer`) one attempt.
   - If it still fails, restore the card's files from its backup, re-run **G** to confirm the tree is green again, mark the card **RESTORED** with the reason, and move to the next card.

   The cards touch different files, so one failure does not block the others.
5. **Record.** Take the card's screenshots (spec), update `REBUILD/PROGRESS.md`, and add a row to `REBUILD/LOG.md` before starting the next card.

## 4. The e2e spine

Run it after D-5 and once in D-10. Never more than that.

- Start the stack with `scripts\start-all.ps1` in its own background shell. **Never pipe it** into `Select-Object` or anything else that buffers.
- Check readiness by port and health endpoint.
- If the stack is already running and healthy, reuse it.
- If the spine fails:
  - **A known capture flake** (an unread polled body, with no answer-key field seen): re-run it once.
  - **A second failure, or a real failure** caused by D-5 (for example the ring number and the stored composite disagree): restore D-5 from its backup, re-run the spine to confirm the baseline passes again, and mark D-5 RESTORED.
- Never edit a test to make it pass.

## 5. Hard rules (these override everything else)

- **Git is read-only:** no commit, checkout, restore, stash, reset, merge or push.
- **No changes to dependencies:** `package.json` and the lock files stay as they are.
- **Live Supabase:** no writes except what the e2e suite itself does, and **no deletes**. Count the leftover test rows and list them for Anthony's sweep.
- **Do not touch** routes, data fetching, prop contracts, API calls, the backend or the Python services.
- **Every §11 test hook stays byte-identical.**
- **No new features.** No D-9. No work on `main` or any other branch.
- **Never print secrets.**
- **Keep it lean:**
  - no separate verifier agents;
  - Sonnet for building, Opus only as the fallback above;
  - don't re-read large files you've already summarised;
  - the main session coordinates and checks, it doesn't write the code.

## 6. The final report, then stop

Write `REBUILD/MORNING_REPORT.md`:

1. A table with one row per card: PASS, RESTORED (with the reason), or SKIPPED.
2. Test totals from the last **G** run, and every e2e run with its result.
3. The screenshot paths.
4. Files changed per card, grouped as suggested commits (one per card).
5. Leftover live test rows, by table, for Anthony's sweep.
6. Anything you decided because this file didn't cover it, and anything that is still unverified.
7. What D-10 found: contrast results, any remaining `framer-motion` importers, and the reduced-motion item that needs Anthony's manual check.

Leave the stack running, so Anthony can look at http://localhost:3000 when he wakes up. Then stop. Do not start anything else.
