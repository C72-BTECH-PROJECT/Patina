# T-0032 — skill-vocabulary (ROADMAP P3-2)

**Status:** approved (owner, 2026-11-04). Owner: Anurag. Pulled forward from Phase 3; runs
alongside B3 (T-0031).

Line numbers are at `f5069a3`.

## Goal
Make the parser recognise support and maintenance tools, and remove false skills, so a support
candidate is not marked down for vocabulary the parser does not know.

## Spec ref
Feedback-3 / GF-3 (fair scoring for support and maintenance candidates); CHECKLIST 1.17;
issue I-0004.

## Scope
**In:**

The three lists in `nlp-engine/app/ner.py`, and nothing else in that file:

| List | Change |
|---|---|
| `SKILL_KEYWORDS` (`:12`) | Remove `"exponentjs"` (`:59`), `"mern stack"` (`:34`), `"r language"` (`:16`) and `"github"` (`:31`) |
| `SKILL_KEYWORDS` | Add `servicenow`, `jira`, `itil`, `nagios`, `splunk`, `cloudwatch`, `active directory`, `windows server`, `incident management`, `pl/sql`, `shell scripting`, `powershell` |
| `SKILL_ALIASES` (`:64`) | Add `"r": ("r language", "r programming", "rstudio")`. **Do not list `"r"` as a variant, and do not add `"r"` to `SKILL_KEYWORDS`:** either would match a bare "r" |
| `GENERIC_SKILL_PATTERNS` (`:83`) | Add `"github": r"\bgithub\b(?!\.(?:com|io)\b)"` |

Plus:
- New `tests/nlp/test_skill_vocabulary.py`.
- Regenerated `tests/nlp/snapshots/current/`.
- At close, per the session protocol: AUDIT 1.17, I-0004, the task Result, WORKLOG.

None of the twelve new terms is in the list today, and the list has no duplicates (148 entries,
checked at `f5069a3`).

**Out:**
- **`nlp-engine/app/ner.py:1-10`.** B3's I-0059 edits the model load there.
- `_EXTRA_NORMALISATION`, `extract_skills`, `nlp-engine/app/embedder.py` and every scoring weight.
- Fixtures and job descriptions (P3-3).
- Re-scoring stored rows. Live `scores` rows change only when a résumé is analysed again.
- The "not on GitHub" false positive (see Risks).

## Acceptance criteria

1. **The lists match the Scope table.** Checked by: `git diff -- nlp-engine/app/ner.py` touches only
   those three lists.
2. **The six vocabulary cases pass.** Checked by: `tests/nlp/test_skill_vocabulary.py`.
3. **The nlp suite passes.** Checked by: `powershell -File tests\run-suite.ps1 -Target current
   -Suites nlp` → 0. This run also regenerates the snapshots.
4. **Snapshot diffs touch only skill fields and the scores computed from them.** See "Snapshot
   diffs" for the exact lists. Checked by: reviewing `git diff -- tests/nlp/snapshots/current/`.
5. **The PR shows f3 and f4 before and after:** skills, `skill_coverage`, `similarity_score` and
   `match_level`. Checked by: a table in the PR description.
6. **Trackers.** Checked by: `node tests/docs/check-trackers.mjs` → 0 warnings.

## Snapshot diffs

Changing the skills cannot leave every other field untouched. `skill_coverage` is computed from the
matched skills, and `similarity_score` is 60% coverage. `focused_score` embeds the résumé lines that
mention a detected skill. So the rule is two lists:

| May change | Must not change |
|---|---|
| `entities.skills`, `entities.skill_count` | `raw_text_preview`, `preprocessing.*` |
| `semantic_analysis`: `resume_skills`, `matched_skills`, `missing_skills`, `skill_coverage`, `focused_score`, `semantic_score`, `similarity_score`, `match_level`, `match_reason` | `entities`: `candidate_name`, `email`, `phone`, `github`, `linkedin`, `experience`, `education`, `projects` |
| | `semantic_analysis`: `full_text_score`, `jd_skills`, `resume_embedding_size`, `jd_embedding_size` |

Any change in the right-hand column fails criterion 4 and should be reported, not explained away.

**Expected result.** This is a simulation, not the task's evidence: the list changes applied in
memory to all six fixtures on 2026-11-04, with `ner.py` unchanged.

| Fixture | Skills | `skill_coverage` | `similarity_score` | `match_level` |
|---|---|---|---|---|
| f1 | 15 → 14 (loses `github`, URL only) | Unchanged | 0.8484 → 0.8582 | Unchanged |
| f2 | 14 → 13 (loses `github`) | Unchanged | 0.4779 → 0.4763 | Unchanged |
| f3 | 3 → 10 | 0.30 → 0.70 | 0.4138 → 0.6654 | **Weak → Moderate** |
| f4 | 6 → 10 | 0.30 → 0.40 | 0.4354 → 0.4991 | Unchanged (Weak) |
| f5 | 10 → 9 (loses `github`) | Unchanged | 0.6906 → 0.6905 | Unchanged |
| f6 | No change | No change | No change | No change |

A large gap from this table is worth a look before accepting the new snapshots. With the changes
applied, the simulation also gave the required result for all six test cases below.

## Test plan

Tests to write FIRST. `tests/nlp/test_skill_vocabulary.py` imports `extract_skills` from `app.ner`
directly, so it needs no running service:

| Case | Input | Asserts | At HEAD |
|---|---|---|---|
| Support terms found | Text with the eleven new terms other than `pl/sql` | Each one is in the result | Fails |
| PL/SQL line found | `Wrote PL/SQL packages` | `pl/sql` is in the result (`sql` also appears, which is expected) | Fails |
| GitHub URL | `github.com/alice` | No `github` | Fails |
| GitHub Actions | `GitHub Actions` | `github` is in the result | Passes (control) |
| R | `R programming and RStudio` | `r` is in the result | Fails |
| Bare R | `J. R. Smith, R&D team` | No `r` | Passes (control) |

Four cases go red first. The two controls guard against over-correcting. Save the red run to
`tests/.out/t0032-red.log`.

Criteria that can't be automated: 4 and 5 need a reviewer to read the diff.

## Regression
- `powershell -File tests\run-suite.ps1 -Target current -Suites nlp,docs`.
- `node --test tests/backend/explainability.test.mjs`. It reads the f1 snapshot, so a changed
  snapshot can affect it.
- `tests/nlp/test_contact_determinism.py`: contact fields must not change.

## Risks and rollback
- **Scores go up or down on purpose.** f3's level changes, and the three developer fixtures lose
  `github` when it came only from a URL. Anyone comparing old scores to new should expect this.
- **The list order changes.** Generic patterns run after keywords (`nlp-engine/app/ner.py:170`), so
  `github` moves toward the end of `skills`, and `r` comes last. Nothing depends on the order, but it
  makes the snapshot diff slightly larger.
- **A known limit: "not on GitHub" still counts.** AUDIT 1.17 records f4 listing GitHub from that
  sentence. The pattern excludes only `.com` and `.io`, so this false positive remains, and the
  simulation agrees (f4 loses no skills). **Accepted by the owner (2026-11-04) as a recorded known
  limit.** Do not widen the pattern; record it in AUDIT 1.17 at close.
- **AUDIT 1.17 records the real result at close (owner, 2026-11-04).** ROADMAP's MIS→DONE is an
  expectation, not a target, and f4 stays Weak in the simulation. Do not force DONE_CORRECTLY.
- **Rollback:** revert the commit. There is no migration, and stored scores are untouched.

---

## Result
<Filled at the end. One line per acceptance criterion.>
