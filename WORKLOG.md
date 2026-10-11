# Work Log

One entry per prompt, appended at the end of the turn, newest at the bottom.
Max 15 lines per entry. When this file passes ~400 lines, move all but the
last 20 entries to `docs/worklog-archive/YYYY-MM.md` and keep a 5-line
rollup per archived month at the top of this file.

---

## L-0001 · 2026-10-12 · Task specs, worklog, prompt-capture hook, ISSUES.md restructure
- Prompt: set up task specs, worklog, a prompt-logging hook, CLAUDE.md
  session protocol, and restructure ISSUES.md (docs/config only).
- Task: ad-hoc (tooling setup)
- Done: tasks/TEMPLATE.md, WORKLOG.md created; .claude/settings.json +
  .claude/hooks/log-prompt.js added (schema verified against official docs);
  .claude/logs/ gitignored; CLAUDE.md got a 13-line Session protocol;
  ISSUES.md rebuilt as I-0001..I-0008 — 5 old entries re-verified vs. code
  (2 stale, moved to Resolved), 3 new issues found.
- Verification: hook schema confirmed against docs. Hook firing confirmed —
  test prompt "testing the hook now" wrote a matching line to
  .claude/logs/prompts.jsonl.
- Files changed: .gitignore, CLAUDE.md, ISSUES.md (mod); .claude/,
  WORKLOG.md, tasks/ (new) — per `git status --porcelain`.
- Issues logged: I-0006, I-0007, I-0008 new; I-0002, I-0003 resolved.
- Next: none — setup complete.
