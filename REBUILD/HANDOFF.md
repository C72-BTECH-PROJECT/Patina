# Handoff

Written 2026-11-14 at commit `07c5137` on branch `rebuild/fable` (card H-2). For an Opus-led session that
continues this project without the session that wrote it. Everything that session knew and that matters is in
the files named here. If this file and `CLAUDE.md` disagree, `CLAUDE.md` wins; tell Anthony about the
disagreement.

**The next session runs on Opus.** The session that wrote this file (Fable) has finished its last task in
the rebuild; nothing it knew is needed beyond what is written here.

Start a session with: "Read `REBUILD/HANDOFF.md` and `REBUILD/PROGRESS.md` and continue."

---

## 1. Read first, in this order

| # | File | What you take from it | How much to read |
|---|---|---|---|
| 1 | `CLAUDE.md` | The rules. Loaded automatically; read the "Rebuild mode" and "Issue triage" sections again. | All |
| 2 | `REBUILD/HANDOFF.md` | This file | All |
| 3 | `REBUILD/PROGRESS.md` | Where the work stands. The top block is the newest and wins. | The top two blocks |
| 4 | `REBUILD/ROADMAP.md` | What gets built next and each milestone's exit criteria | The milestone you are in |
| 5 | `REBUILD/TASKS.md` | The card you are picking up. Cards are `R-n` (rebuild), `S-n` (stretch), `H-n` (handoff), `O-n` (Anthony's own actions) | That card and the cards it depends on |
| 6 | `REBUILD/DECISIONS.md` | Why things are the way they are. §0 is the amendment table (A1 to A8) and overrides older text. §6.2 anti-cheating, §7.1 weights and caps. | §0, then the section for your module |
| 7 | `ISSUES.md` | Open entries for the module you are touching | Only those. Search by file name; never read the whole file |
| 8 | `ARCHITECTURE.md`, `CODE_MAP.md` | How it is wired; where a thing is | Look up, do not read through |

Do not use as evidence: `AUDIT.md` (not re-verified since the rebuild; its rewrite is the first card of roadmap A1), the root
`ROADMAP.md` (pre-rebuild plan), anything in `Docs/archive/`, and any checked box anywhere.

Read source files through a subagent when the question spans many files, so your own context receives a
summary. Read a single known file yourself.

## 2. The rules (from `CLAUDE.md`; this is a reminder, not a replacement)

- **Anthony commits.** Git is read-only for you: no `commit`, `push`, `checkout -b`, no staging, no pull
  requests. Leave the tree dirty, say where the commit boundaries are, and stop.
- **Never apply a Supabase migration or run destructive SQL.** Write the migration file; Anthony applies it.
- **Never print, copy or open secrets.** `.env` files are not read. Variable names only.
- **Ask Anthony before** deleting a feature or a file, changing the database schema, or changing
  authentication. `REBUILD/ROADMAP.md` marks such items **[ask]**. A yes given for one item does not carry
  to the next.
- **Only verified behaviour counts.** Existing code and checked boxes are not evidence. "Done" needs a
  `file:line` and a test name or harness result.
- **Never fabricate.** No invented data, no stubbed result made to look complete, no number that was not
  measured. An unbuilt feature is shown as not built.
- **One module at a time.** A problem outside the card's scope becomes an `ISSUES.md` entry, tagged in the
  same edit. It is not fixed silently.
- **Prefer deleting or merging duplicates** over adding another version (and ask before the deletion).
- **`REBUILD/DECISIONS.md` overrides** older design notes in other docs where they conflict.
- **Servers:** never pipe `scripts\start-all.ps1`, or any command that launches a server, into
  `Select-Object`, `Out-String`, `tail`, `head` or `Sort-Object`. Run it unpiped or in the background and
  check readiness by health URL: `http://127.0.0.1:5000/health`, `:5001/api/health`, `:8000/`, `:8001/health`,
  `:8002/`, `:3000/`.
- **Keep the trackers current yourself:** a new top block in `REBUILD/PROGRESS.md`, one row in
  `REBUILD/LOG.md`, the card's status in `REBUILD/TASKS.md`, and `node tests/docs/check-trackers.mjs` after
  any doc edit. Anthony does not do this by hand.

**The protocol.** The `REBUILD/` files are the session protocol (Anthony, 2026-11-14; decision A9, and
`CLAUDE.md` "Session protocol" now says the same): cards in `REBUILD/TASKS.md`, state in
`REBUILD/PROGRESS.md`, results in `REBUILD/LOG.md`. The old `tasks/` folder and `WORKLOG.md` are in
`Docs/archive/` as history; do not add to them. **Write the card with its acceptance check and get Anthony's
approval of that check before writing code.**

Older docs and code comments still name `tasks/T-NNNN-...` paths; those files are now under
`Docs/archive/tasks/` (`ISSUES.md`, entry of 2026-11-14).

## 3. Issue triage

Every open entry in `ISSUES.md` carries exactly one tag, written in the same edit that logs the entry.

| Tag | When | What happens |
|---|---|---|
| **NOW** | On the demo path, or a wrong or invented output, or a security or data problem | It gets a card, and the tag names it: `NOW → R-33` |
| **BATCH** | Small and none of the above | Not worked alone; cleared in a scheduled sweep. `BATCH·demo` if a rehearsal can touch it |
| **CLOSED** | With a one-line reason | Only when the fix is **verified**: a `file:line`, a grep, a test, or a check result. Assigning a card does not close anything |

- The only closures without a fix: a duplicate of a named entry, an entry that is not a defect, a refusal
  recorded as a decision.
- An issue that a card or the roadmap will fix stays NOW or BATCH and names its owner in a "Fix owned by" note.
- A sweep fixes or closes each item. It never re-tags an item NOW to skip it.
- A BATCH item that turns out to give a wrong output or expose data is re-tagged NOW at once and gets a card.
- Sweeps: after the Nov 17 rehearsal (`BATCH·demo`, card R-36); milestone A1 (the whole backlog); the end of
  every later milestone (what was logged since).

`ISSUES.md` has two formats: a table of numbered `I-NNNN` entries at the top with detail sections below, and
dated bullets near the end (the rebuild's entries). New entries go at the end as bullets:
`- **[BATCH]** (card, date, severity) what, where as file:line, the fix.`

## 4. Model routing

| Work | Model | Agent |
|---|---|---|
| Leading the session (the next session and every one after it); any decision; any code change; any audit; anything that needs judgement | **Opus** | the lead, `patina-implementer`, `patina-auditor` |
| Work that is **fully specified** and needs no judgement: moving or archiving docs, renames, applying a pattern that is already decided, regenerating a lookup doc from a written spec | **Sonnet** | `patina-mechanical` |
| Anything | **never Haiku** | |

- If a Sonnet task turns out to need a decision, the agent stops and reports; the lead decides or hands it to
  an Opus agent. Do not let it guess.
- Check what a Sonnet agent returns before relying on it. For a doc with line references, resolve every
  reference by script (the method is in the `REBUILD/LOG.md` row of 2026-11-14 for `CODE_MAP.md`).
- Agent definitions are in `.claude/agents/`. A subagent starts cold: give it the card, the files, the check
  and the rules in §2. Its report is not Anthony's approval of anything.

## 5. Verification policy

- **The implementer runs the tests.** The agent that makes a change runs the suites for the module it touched
  and reports the counts and the failures as they are. There is no separate verifier agent by default
  (`patina-verifier` exists; use it only when Anthony asks for an independent check).
- **One end-to-end run per batch**, at the end of the batch, not per card. If it fails, read the failure
  before re-running; a pass on re-run is reported as "failed once, passed on re-run", with the cause if known.
- **Anthony checks the UI by hand.** When a UI check is due, start the stack for him, tell him exactly which
  screen and what he should see, and stop. Do not claim a screen works because a test passed.
- **Report honestly.** "Not run", "not seen live" and "unit-tested only" are written as such in
  `REBUILD/LOG.md` and in the summary.

Commands (details in `README.md` and `tests/README.md`):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\stop-all.ps1      # suites need the ports free
powershell -File tests\run-suite.ps1 -Target current -Suites backend           # one suite: nlp|backend|gateway|frontend|docs|github|assessment
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\start-all.ps1     # unpiped
powershell -File tests\run-suite.ps1 -Suites e2e                               # needs the stack running
node tests\docs\check-trackers.mjs
```

Baseline on 2026-11-14: backend 274/274, nlp 145 plus eval 12, frontend 121, gateway 33, assessment 91, e2e
5 passed and 1 opt-in skip. Docs check: 6 problems, all stale `AUDIT.md` cites. A change that lowers any of
these is not finished.

## 6. Things that cost time if you do not know them

- **Restarting core logs every browser out.** Sessions are in its memory. Never restart it during a demo or
  while Anthony is checking a screen.
- **The live suites and the end-to-end run write real rows** to the one Supabase project, as the `t0001_`
  test accounts. `node tests\backend\sweep.mjs --check` lists leftovers. There is no separate test database
  yet (roadmap B4).
- **Pool preparation is slow and variable**: 6.5 s to 88 s across runs. It runs in the background after
  apply. `ASSESSMENT_PREPARE_ON_APPLY` must stay unset in `backend/.env`.
- **A 504 with `may_still_complete`** means the gateway stopped waiting, not that core failed. Read the state
  before retrying.
- **The end-to-end run has one known flake**: Playwright once could not read the body of a polled
  `GET /api/assessment/status` response (`ISSUES.md`, `BATCH·demo`, 2026-11-14).
- **An unscoped recursive `grep -r` over the repository hangs** on `node_modules` and the virtual
  environments. Use the search tool, or name the folders.
- **Editing docs with a script on Windows:** open files with `newline=''` so line endings are kept, use raw
  strings for Windows paths, and never open a file for writing before the new content exists. One slip on
  2026-11-14 emptied `REBUILD/DECISIONS.md`; it was restored from `git show HEAD:<path>`, which is allowed
  (read-only git).
- **`backend/index.js` has stale comments and a startup message** listing routes that no longer exist
  (`ISSUES.md`, owner R-33). Trust `backend/Routes/`, not those comments.
- **The parser is `nlp-engine@2.3.0`**, a fixed vocabulary of 180 skills. The evaluation inputs are frozen and
  hashed (`eval/vocabulary_frozen.json`); do not edit them to improve a number. A new run uses new files.
- **The 20 gold résumés have been seen.** They are a development set from now on (roadmap A2).

## 7. What is open, in order

**Before Nov 18** (demo-critical only; nothing else is started)

1. **Anthony stages the verified candidate himself** (his own résumé with his GitHub link), following
   `REVIEW_BRIEF.md` §1. A score with GitHub evidence available has never been run live by anyone. If it
   misbehaves, that is a NOW issue and the only code work that matters before the demo. He writes the
   composite and band into `REVIEW_BRIEF.md` §1.
2. **Nov 17 rehearsal** (TM-2): the 10-minute script in `REVIEW_BRIEF.md` §2. **The demo runs from `main`
   after Anthony's merge of `rebuild/fable`** (decision A12), so the rehearsal is on `main` after that merge.
3. **Fixes from the rehearsal**, then the `BATCH·demo` sweep (card R-36; 21 entries on 2026-11-14). A fix
   that needs more than a few lines, a schema change or an auth change is not made here; it goes to the roadmap.
4. **Demo morning:** `start-all`, check `http://127.0.0.1:5000/health`, a short run of the script, and do not
   restart core afterwards. The runbook, the fallback for each outside service, and the answers are
   `REVIEW_BRIEF.md` §1, §2 and §4.

**After Nov 18:** `REBUILD/ROADMAP.md`, starting at A1. Open cards that already exist in `REBUILD/TASKS.md`:
R-25 (the `AUDIT.md` rewrite, first), R-22 and R-26 (docs batch), R-33 (the stale comments), R-34, R-35, S-1
to S-5. Cards for everything else on the roadmap are still to be written; write each one when its milestone
starts, not before.

## 8. Decided, and still waiting on Anthony

**Decided on 2026-11-14** (`REBUILD/DECISIONS.md` §0, A9 to A12; do not reopen):

- `AUDIT.md` is re-verified by a full rewrite, as the first card of A1; untouched rows reset to unverified.
- The `REBUILD/` files are the session protocol.
- The six security items in roadmap A1 are accepted.
- Parsing is chosen by measurement between runtime LLM extraction and an LLM-taught spaCy NER model. The
  upload notice is approved and needed only if the first wins. O*NET Technology Skills by default, ESCO for
  broader skills; licences confirmed before use.
- Proctoring is tab-switch and focus-loss signals only; camera and identity checks are out of scope.
- The design refresh stays in Track B unless the design branch merges before Nov 18.
- The demo runs from `main` after Anthony's merge. He stages the verified candidate himself.

**Still open**

| Question | Where it is laid out |
|---|---|
| The Kaggle dataset name in `eval/RESULTS.md`. Anthony's answer of 2026-11-14 arrived with the name left as a placeholder, so the file still carries the unconfirmed name. Ask him for it; change nothing until he gives it. | `eval/RESULTS.md`, "Reproducing this run" |
| O-9: run `tests/backend/purge-orphan-resume-files.mjs --apply` (six orphan files) | `REBUILD/TASKS.md` O-9 |
| Deleting the dead code listed in `CODE_MAP.md` §13 | `ISSUES.md`, entry of 2026-11-14 |
| Confirming the O*NET and ESCO licences (at the start of A2) | `REBUILD/ROADMAP.md` A2 |

## 9. End of every session

1. Run the checks for what you touched (§5) and the docs check.
2. Update the card's status and result in `REBUILD/TASKS.md`.
3. Add a new top block to `REBUILD/PROGRESS.md`; take "this block is the newest and wins" off the previous one.
4. Append one row to `REBUILD/LOG.md`: date, card, who, files, result with counts, and what was not verified.
5. Log out-of-scope findings in `ISSUES.md`, tagged.
6. Tell Anthony: what changed, what was and was not verified, the suggested commit boundaries, and what you
   need from him. Then stop. He commits.
