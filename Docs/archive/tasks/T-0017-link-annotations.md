# T-0017 — link-annotations

> Status: **draft, awaiting owner approval** (written in T-0016, 2026-10-15).
> ROADMAP item P1-10, first in the execution order. No dependencies. Resolves I-0052.

## Context
The T-0014 manual check scored the owner's own résumé
(`tests/private/Anthony_Jennis_Resume.pdf`) with GitHub "unavailable: `no_github_link`"
(L-0027, I-0052). The PDF shows the word "GitHub" with a clickable link behind it. It has 9 link
annotations, 3 of them to github.com, but no `github.com/` string in its text.
- `nlp-engine/app/extractor.py:5-12` reads only `page.extract_text()`.
- `nlp-engine/app/extractor.py:14-20` reads only paragraph text.
- So `ner.py`'s contact regexes (`nlp-engine/app/ner.py:546-570`) never see the link.

Word and LaTeX exports often link a label or an icon like this. The candidate's GitHub evidence
is then lost silently (GF-4), and the reason text shown is wrong. LinkedIn has the same problem.

What is installed (checked in T-0016):
- pdfplumber 0.11.10, whose `Page.hyperlinks` returns URI annotations with positions;
- python-docx 1.2.0, whose `Paragraph.hyperlinks` gives each link's `.address`.

`nlp-engine/requirements.txt` pins neither (I-0038).

## Goal
A GitHub or LinkedIn link that exists only as a clickable link in the résumé file (a PDF URI
annotation or a DOCX hyperlink) reaches `entities.github` / `entities.linkedin`, with the
`/parse` output shape and everything derived from the text unchanged.

## Spec ref
- FR-4 (username from the resume), GF-4, GF-1 (LinkedIn URL); CHECKLIST 2.1, 1.16, 1.9.
- ISSUES I-0052; ROADMAP P1-10.

## Scope
**In:**
- `extractor.py`: new `extract_links(file_path) -> list[str]`. It returns http(s) link targets
  in document order, with duplicates removed (first kept) and `mailto:`/other schemes dropped:
  - PDF: `page.hyperlinks` across pages, sorted by page number, then `top`, then `x0`;
  - DOCX: `paragraph.hyperlinks[*].address` over `doc.paragraphs`, the same paragraphs the text
    extractor reads.
- `main.py`: calls `extract_links` next to `extract_text` and passes the result to
  `extract_entities(raw_text, links=links)`.
- `ner.py`:
  - `extract_entities(text, links=())` collects GitHub and LinkedIn candidates from the text
    matches in document order, followed by matches inside each link target, in link order;
  - T-0013's GitHub rule then runs unchanged over that combined list: the first bare profile
    link wins, otherwise the first repo link's owner, with the trailing `.` stripped;
  - LinkedIn is the first match in the combined list;
  - `email` and `phone` are unchanged.
- **The link URLs are never added to the text.** I-0052's proposed fix suggested appending them;
  this spec departs from that on purpose. Appending would change `raw_text_preview`, the skills
  (the "github" false positive, I-0004) and the semantic score.
- `requirements.txt`: lower bounds `pdfplumber>=0.11` and `python-docx>=1.2`, the versions whose
  APIs this uses. Full pinning stays with P2-6 (I-0038).
- Fixtures (`tests/fixtures/make_fixtures.py`, byte-stable like f1-f6, dev JD), both for a
  synthetic "Priya Linkwell":
  - `f7_github_link_annotation.pdf`: single column. The labels "GitHub" and "LinkedIn" are fpdf2
    `cell(..., link=...)` cells pointing at `https://github.com/example-plinkwell` and
    `https://www.linkedin.com/in/example-plinkwell`. It also has a `mailto:` link. No URL text
    appears anywhere on the page.
  - `f8_github_hyperlink.docx`: the same labels as DOCX hyperlinks, built with oxml, since
    python-docx has no public "add hyperlink" call.
  - Both are listed in `tests/fixtures/manifest.json`, so `test_parse` snapshots them
    automatically.
- `tests/backend/live-analyze-github.test.mjs`: one new subtest.
- AUDIT rows 2.1, 1.16, 1.9 (evidence), `tests/README.md` (fixture list), ISSUES, WORKLOG.

**Out:**
- Links in DOCX tables, headers and footers (the text extractor skips them too).
- Portfolio URLs and the projects section (P3-7).
- Using any other link (e.g. a repo link to a different owner) as extra evidence.
- OCR (P3-6), and certificate extraction (P3-9).
- Backend changes: core already normalises whatever `entities.github` holds
  (`backend/Services/githubEvidence.js:50`).

## Files touched
- `nlp-engine/app/extractor.py`, `nlp-engine/app/ner.py`, `nlp-engine/app/main.py`, `nlp-engine/requirements.txt`
- `tests/fixtures/make_fixtures.py`, `tests/fixtures/manifest.json`, `tests/fixtures/f7_github_link_annotation.pdf` (new), `tests/fixtures/f8_github_hyperlink.docx` (new)
- `tests/nlp/test_link_annotations.py` (new); `tests/nlp/snapshots/current/f7_github_link_annotation.json`, `f8_github_hyperlink.json` (new)
- `tests/backend/live-analyze-github.test.mjs`
- `tests/README.md`, `AUDIT.md`, `ISSUES.md`, `WORKLOG.md`

## Moves
| Id | From → to | Why |
|---|---|---|
| 2.1 Username acquisition | PART → PART (evidence) | Links behind labels are now read; the user-input path (`profiles.github_url`, OAuth) is still missing |
| 1.16 LinkedIn and certificates | PART → PART (evidence) | LinkedIn is read from annotations too; certificates are still not extracted |
| 1.9 Project-link extraction | PART → PART (evidence) | GitHub and LinkedIn links behind labels reach the structured fields; portfolio URLs are still missing |
| I-0052 | OPEN → RESOLVED | — |

## Acceptance criteria
1. **PDF link targets.** `extract_links` on f7 returns exactly
   `["https://github.com/example-plinkwell", "https://www.linkedin.com/in/example-plinkwell"]`:
   document order, `mailto:` dropped. On f1 it returns `[]` (no annotations).
   Checked by: `tests/nlp/test_link_annotations.py` "test_extract_links_pdf".
2. **DOCX link targets.** The same list for f8, and `[]` for f2.
   Checked by: "test_extract_links_docx".
3. **Annotation-only links reach the entities.** `POST /parse` on f7 and on f8 returns
   `entities.github == "https://github.com/example-plinkwell"` and `entities.linkedin ==
   "https://www.linkedin.com/in/example-plinkwell"`.
   Checked by: "test_parse_annotation_only_links" (HTTP against the running NLP, like
   `test_parse.py`).
4. **One selection rule over text plus links.** `extract_entities(text, links=...)` gives:
   - text bare profile A, plus a link to bare profile B → A (text first);
   - text repo link `github.com/x/repo`, plus a link to bare profile B → B (bare profile wins);
   - no text match, links `[github.com/x/repo, github.com/y]` → `github.com/y`;
   - a link with a trailing `.` → stripped;
   - T-0013's text-only table still passes unchanged.

   Checked by: "test_link_precedence" plus `tests/nlp/test_contact_determinism.py`
   "test_github_link_rules".
5. **Nothing derived from the text changes.**
   - `extract_entities(text)` equals `extract_entities(text, links=[])`.
   - f7's `raw_text_preview` contains no `github.com` or `linkedin.com`.
   - The f1-f6 snapshots are byte-identical:
     `git diff --exit-code -- tests/nlp/snapshots/current/f1_dev_github.json` (and f2..f6) → 0.

   Checked by: "test_links_do_not_touch_text" and the `git diff` command.
6. **Deterministic.** The f7 and f8 contact fields are identical under `PYTHONHASHSEED` 0-4.
   Checked by: "test_link_fields_same_under_every_hash_seed" (child processes, as in
   `test_contact_determinism.py`).
7. **Fixtures are byte-stable.** Running `python tests/fixtures/make_fixtures.py` twice gives the
   same SHA-256 for f7 and f8, and f1-f6 are unchanged. Checked by: `Get-FileHash` before and
   after, pasted in Result.
8. **End to end through core.** A new subtest in `tests/backend/live-analyze-github.test.mjs`,
   "f7: an annotation-only GitHub link reaches github-evidence": analyze f7, and the stub on :8001
   receives `username: "example-plinkwell"`. The score's GitHub sub-score is not
   `no_github_link`. Checked by: that subtest (`-Live`).
9. **The owner's résumé (manual).** The owner re-runs the T-0014 manual check on
   `tests/private/Anthony_Jennis_Resume.pdf`. `entities.github` is a github.com link, and the
   sub-score reason is not `no_github_link`. Checked by: the owner's run, recorded in Result
   (private file, not committed).
10. **Trackers.**
    - AUDIT 2.1, 1.16 and 1.9 cite the new code (`file:line`) and the tests; statuses
      unchanged.
    - I-0052 moves to Resolved with evidence.
    - `tests/README.md` lists f7 and f8.

    Checked by: `node tests/docs/check-trackers.mjs` → exit 0, 0 warnings.

## Test plan
- **Write first:**
  - `tests/nlp/test_link_annotations.py` (criteria 1-6);
  - the f7/f8 generator code and manifest entries;
  - the live subtest (criterion 8).
- **Red run.** At HEAD with the new fixtures generated:
  - `extract_links` does not exist (ImportError, criteria 1, 2, 4-6 fail);
  - `/parse` on f7 returns `entities.github: null` (criterion 3 fails);
  - the live subtest sees `no_github_link` and no stub request.

  Logged to `tests/.out/t0017-red.log`.
- **Green:** `tests/.out/t0017-green.log`.
- **Cannot be automated:** criterion 9. It uses the owner's private résumé, which is
  git-ignored.

## Regression
- `tests/run-suite.ps1 -Target current -Live`:
  - nlp: the f1-f6 snapshots are unchanged; f7/f8 snapshots are new;
  - backend 0, github 0, docs 0;
  - frontend = the 5 known lint warnings.
- `-Target baseline -Suites nlp` still runs. The manifest now lists f7/f8, so the baseline also
  writes `snapshots/baseline/f7…, f8…`. At baseline they show `github: null`, which is the
  expected contrast.

## Risks and rollback
- **Risk:** a résumé links a *different* person's profile behind a label (e.g. "inspired by
  @someone"), and it now gets picked.
  - Mitigation: printed text links still come first.
  - Only a bare profile beats a repo link, and that is already T-0013's rule.
  - The recruiter sees the login in the GitHub sub-score.
- **Risk:** pdfplumber's annotation order differs between versions. Mitigation: the explicit
  sort (page, top, x0), and criterion 6.
- **Risk:** the unpinned venv has an older python-docx without `Paragraph.hyperlinks`.
  Mitigation: the lower bound in `requirements.txt`, plus a clear ImportError in the test.
- **Rollback:** revert the three `nlp-engine/app` files. The fixtures and tests are additive.

---

## Result
<Filled at the end. One line per acceptance criterion.>
