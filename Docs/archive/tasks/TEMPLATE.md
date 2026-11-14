# T-NNNN — <slug>

> Copy this file to `tasks/T-NNNN-<slug>.md`, fill in everything through
> "Risks and rollback", and get it approved before writing any code.
> "Result" is filled in at the end of the task, not before.

## Goal
<One sentence. What changes, for whom, and why.>

## Spec ref
<FR-NN / NFR-NN / Feedback-N from PROJECT_SOURCE_DOCS.md.
PROJECT_SOURCE_DOCS.md is at the repo root (restored 2026-10-12 from 32905c1).
Cite FR/NFR ids from it. Otherwise cite one of:
  - CLAUDE.md "Known guide feedback" item # (1-5), or
  - Docs/IMPLEMENTATION-TRACKER.md feature #/section name.
If none applies, say so explicitly — do not leave this blank.>

## Scope
**In:**
- <bullet>

**Out:**
- <bullet — anything tempting to touch but deliberately not part of this task>

## Acceptance criteria
Each criterion must be measurable and paired with exactly how it's checked.
"Works correctly" / "functions as expected" is not a criterion.

1. <criterion> — checked by: <automated test file, OR exact command + expected
   output, OR manual steps I (the user) will perform>
2. ...

## Test plan
- Tests to write FIRST (must FAIL before the change, PASS after):
  - <test file/name> — asserts <behavior>
- Criteria that can't be automated, and why:
  - <criterion> — <reason: e.g. requires visual judgment, external API with no
    test double, etc.>

## Regression
Existing tests/harness that must still pass after this change:
- <test file or suite>

## Risks and rollback
- Risk: <what could break, blast radius>
- Rollback: <how to revert — e.g. "revert commit", "feature is additive/no
  migration to undo">

---

## Result
<Filled at the end. One line per acceptance criterion.>

1. PASS/FAIL — <evidence: command run + output excerpt, or note from manual check>
2. ...

No evidence recorded = FAIL, regardless of belief that it works.
