# T-0013 — parser-contact-determinism

> Status: **implemented 2026-10-15, awaiting owner commit** (spec written in T-0010, 2026-10-14; approved by owner).
> ROADMAP item P1-3.

## Context
ISSUES I-0015 (P1): `extract_entities` builds each of `email`, `phone`, `github` and
`linkedin` as `list(set(re.findall(...)))[0]` (`nlp-engine/app/ner.py:548-562`).
Python randomises string hashing per process, so with two or more matches the value
picked can change between restarts.

The harness pins `PYTHONHASHSEED=0` (`tests/run-suite.ps1:71`), which hides the bug
in tests.

Phase 1 makes the GitHub link the input to a whole sub-score (T-0014). A
nondeterministic link would make the same resume score differently after a restart,
which breaks 4.11.

The GitHub pattern also has two smaller problems:
- it keeps only the first path segment, so a repo link `github.com/acme/tool` reads
  as the profile `github.com/acme`;
- its character class can swallow a trailing `.` from a sentence.

## Goal
The parser returns the same contact fields for the same text in every process.
- Each field is the first match in document order.
- For GitHub, a bare profile link is preferred over a repository link.
- The output shape of `entities` is unchanged.

## Spec ref
- FR-2, FR-4 (username from the resume).
- CHECKLIST 2.1 (resume path) and 4.11 (determinism).
- ISSUES I-0015.

## Scope
**In:**
- `nlp-engine/app/ner.py`: the contact block of `extract_entities`.
- `tests/nlp/test_contact_determinism.py` (new).
- `tests/nlp/snapshots/current/`: regenerated only if output changes.
- `tests/README.md` (a row if needed); ISSUES (I-0015 → RESOLVED) and WORKLOG.

**Out:**
- Normalising the link to a login: that is core's job (T-0014).
- Any other entity, skill or section logic in `ner.py`.
- The `entities` keys and types.

## Acceptance criteria
1. **Same output under every hash seed.** For a synthetic text with two emails, two
   phones, two GitHub profile links (`github.com/zeta-dev` first, then
   `github.com/alpha-dev`) and two LinkedIn links, `extract_entities` run in five
   subprocesses with `PYTHONHASHSEED` = 0, 1, 2, 3, 4 returns identical
   `email/phone/github/linkedin`, each equal to the first match in document order —
   `test_contact_fields_same_under_every_hash_seed`.
   - The subprocesses use the `nlp-engine/venv` interpreter with cwd `nlp-engine/`.
2. **GitHub link rules.** Table test `test_github_link_rules`:

   | Text | `github` |
   |---|---|
   | `See https://github.com/alice.` | `https://github.com/alice` (trailing `.` dropped) |
   | `github.com/acme/tool … github.com/alice` | `github.com/alice` (a bare profile beats an earlier repo link) |
   | only `github.com/alice/proj` | `github.com/alice` (owner of the first repo link) |
   | `www.github.com/alice/` | `www.github.com/alice` |
   | no link | `None` |

3. **Shape unchanged.** `tests/nlp/test_parse.py` passes; it asserts the key sets,
   and `entities.github` is still `str | None`.
4. **Snapshots.** After `tests/run-suite.ps1 -Target current -Suites nlp`,
   `git diff --stat tests/nlp/snapshots/current` is either empty, or every changed
   line is in `entities.{email,phone,github,linkedin}`. Each change is listed and
   explained in Result.
   - Expected: none, since every fixture has one distinct value per field
     (`tests/nlp/snapshots/current/f1_dev_github.json`).
5. **Regression.** `-Suites nlp` → 0 and `-Suites backend -Live` → 0 (the live
   analyze tests consume `entities`).

## Test plan
- **Write first:** `tests/nlp/test_contact_determinism.py`.
- **Red run:** at HEAD, criterion 1 fails for at least one seed. With two values
  per field and four fields, the chance that all five seeds happen to pick the
  document-first value is about 1 in 10^6. The failing seeds and fields are recorded
  in Result. Criterion 2's repo-link and trailing-dot rows also fail at HEAD. Logged
  to `tests/.out/t0013-red.log`.
- **Green:** `tests/.out/t0013-green.log`.
- **Cannot be automated:** nothing.

## Regression
- `tests/run-suite.ps1 -Target current -Suites nlp,backend -Live`; snapshot diff as
  in criterion 4.

## Risks and rollback
- **Risk:** a real resume whose first GitHub link belongs to an organisation or
  someone else. Mitigation: the bare-profile preference handles the common case; core
  validates the login and records the source link in the evidence snapshot (T-0014),
  so a wrong pick is visible to the recruiter.
- **Rollback:** revert the `ner.py` hunk; no data is involved.

---

## Result
1. **PASS** - `test_contact_fields_same_under_every_hash_seed` green (`tests/.out/t0013-green.log`, 2 passed). Red at HEAD (`tests/.out/t0013-red.log`): every seed 0-4 differed - 0: email, phone, linkedin; 1: email, github, linkedin; 2: github, linkedin; 3: phone; 4: email, phone, github.
2. **PASS** - `test_github_link_rules` green (5 rows). Red at HEAD: the trailing-dot row (`https://github.com/alice.`). The two repo-link rows passed at HEAD under seed 0 by luck (set order happened to give `alice`; the old code never read the repo segment), so the spec's "repo-link row fails at HEAD" was not reproduced for that seed.
3. **PASS** - `nlp/test_parse.py` passes in the full run (12 passed with the 2 new tests = 10 + 2); `entities` keys untouched, `github` still `str | None`.
4. **PASS** - `git diff --stat tests/nlp/snapshots` is empty after the `current` nlp run.
5. **PASS** - `run-suite.ps1 -Target current -Suites nlp,backend,frontend,docs -Live` (`tests/.out/t0013-full-harness.log`): nlp 0, backend 0 (27 pass, 0 fail), docs 0. frontend 1 = the existing CI-mode ESLint warnings in `CreateJob.jsx` / `Jobs.jsx` (not touched by this task, same as T-0004..T-0007 Results).

Changes: `nlp-engine/app/ner.py:543-577` (contact block), `tests/nlp/test_contact_determinism.py` (new), `tests/README.md` (suite row), ISSUES I-0015 -> RESOLVED, AUDIT rows 2.1, 1.9, 4.11 (evidence only, statuses unchanged: 2.1 STUBBED_OR_PARTIAL, 4.11 CODE_REVIEWED_UNTESTED) and 1.16 (cite lines moved).
Notes: ROADMAP P1-3 says "full path captured" while this spec returns the repo owner; I followed the spec (see ISSUES I-0043).
