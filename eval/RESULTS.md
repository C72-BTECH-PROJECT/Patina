# Parsing evaluation results

Written by `eval/run_parsing_eval.py` (card R-20, DECISIONS 4.3). Each run appends one dated section below. Sections are
never edited by hand. Only counts and skill names appear here: no resume text, no contact values, and consented
resumes are not named.


## 2026-11-12 07:21 UTC - SMOKE SET on synthetic fixtures (NOT the evaluation result)

> **This is not the evaluation result.** It is a harness check on the six synthetic fixtures in `tests/fixtures/`, hand-labelled by the R-20 implementer. The fixtures were written for the test harness, not sampled from real resumes, so these numbers say nothing about Patina's parsing accuracy and must not be quoted as such. The evaluation result needs the 30-resume TM-1 set.

- Label set: `eval/smoke/gold.csv`, 6 resumes
- Sources: kaggle 0, consented 0, smoke 6
- Role types: development 4, other 0, support_operations 2
- Parser version (`parser_version` in /parse responses): nlp-engine@2.0.0
- Service version (`GET /` `version` field): 2.0.0
- Alias table: `eval/aliases.json`, 57 aliases, sha256 b23afa6e66fc
- Out-of-scope list: `eval/out_of_scope_terms.json`, 43 terms, sha256 b8582b81dc6d
- `jd` sent: no

### Skills

| | Precision | Recall | F1 | Resumes averaged (P / R / F1) |
|---|---|---|---|---|
| Micro (TP 39, FP 6, FN 18) | 0.867 | 0.684 | 0.765 | 6 / 6 / 6 |
| Macro (per-resume mean) | 0.882 | 0.614 | 0.644 | 5 / 6 / 6 |

Macro rules: precision averages resumes where the parser kept at least one skill; recall averages resumes with at least one gold skill; F1 = 2TP/(2TP+FP+FN) per resume, averaged over resumes where either side is non-empty (an unreadable resume with gold skills scores F1 0).
Out-of-scope terms removed from the parser's output: 3 in total.

| Role type | Resumes | Micro P | Micro R | Micro F1 |
|---|---|---|---|---|
| development | 4 | 0.861 | 0.775 | 0.816 |
| support_operations | 2 | 0.889 | 0.471 | 0.615 |

### Contact fields (exact match after normalisation)

Normalisation: email trimmed and lower-cased; GitHub and LinkedIn URLs trimmed, lower-cased, with a leading `http://`/`https://`, a leading `www.` and trailing `/` removed. Nothing else.

| Field | Resumes with the field in gold | Correct of those | Accuracy over all resumes (empty = empty counts as correct) | Parser value where gold is empty |
|---|---|---|---|---|
| email | 6 | 5 (0.833) | 5/6 (0.833) | 0 |
| github_url | 4 | 3 (0.750) | 5/6 (0.833) | 0 |
| linkedin_url | 1 | 1 (1.000) | 6/6 (1.000) | 0 |

### Parse time

Client-side wall clock per `POST /parse` on loopback, over the 5 resumes that returned HTTP 200: median 0.186 s, maximum 0.199 s.

### Resumes not parsed

- `f6_image_only.pdf`: rejected as unreadable (HTTP 422, reason `no_text_layer`); counted as zero found skills.

<details><summary>Per-resume detail</summary>

| Resume | Role | Status | TP | FP | FN | Missed | False finds |
|---|---|---|---|---|---|---|---|
| `f1_dev_github.pdf` | development | parsed | 13 | 1 | 1 | ecs | github |
| `f2_dev_github.docx` | development | parsed | 9 | 3 | 1 | spring boot | github, javascript, spring |
| `f3_support_nogithub.pdf` | support_operations | parsed | 3 | 0 | 6 | active directory, itil, jira, nagios, servicenow, windows server | - |
| `f4_support_nogithub.docx` | support_operations | parsed | 5 | 1 | 3 | cloudwatch, pl/sql, splunk | github |
| `f5_multicolumn.pdf` | development | parsed | 9 | 1 | 1 | eks | github |
| `f6_image_only.pdf` | development | unreadable | 0 | 0 | 6 | django, docker, git, postgresql, python, rest | - |

</details>

## 2026-11-13 16:31 UTC - R-29 multiple-choice option report (LIVE, 3 pools, 0 failed)

Option rule: an MCQ is rejected when its correct option is more than 1.25x the distractors' mean length AND at least 10 characters longer. Input: one invented job and candidate (`eval/mcq_option_report.py`).

| Pool | Model | Outcome | Rounds | Seconds | MCQs rejected by the option rule (all rounds) |
|---|---|---|---|---|---|
| 1 | gemini-3.1-flash-lite | ok | 1 | 20.7 | 1 |
| 2 | gemini-3.5-flash-lite | ok | 1 | 13.3 | 0 |
| 3 | gemini-3.1-flash-lite | ok | 1 | 17.9 | 0 |

- Kept pool MCQs: 29; correct option strictly longest: 6 (20.7 %); tied longest: 5; mean correct/distractor length ratio: 0.97
- Served MCQs: 18; correct option strictly longest: 4 (22.2 %)
- Served correct-answer position: A 33.3 %, B 27.8 %, C 16.7 %, D 22.2 %
- Limits of this run: 18 served questions are too few to judge the position spread (the 2,000-shuffle unit test is the evidence for that); the card asked for 36 multiple-choice questions and this run kept 29 and served 18; no pool-preparation time was recorded before the rule existed, so there is no before-and-after timing, only these times against the 6.5 s to 88 s seen in earlier end-to-end runs.

## 2026-11-14 01:40 UTC - SMOKE SET on synthetic fixtures (NOT the evaluation result)

> **This is not the evaluation result.** It is a harness check on the six synthetic fixtures in `tests/fixtures/`, hand-labelled by the R-20 implementer. The fixtures were written for the test harness, not sampled from real resumes, so these numbers say nothing about Patina's parsing accuracy and must not be quoted as such. The evaluation result needs the 30-resume TM-1 set.

- Label set: `eval/smoke/gold.csv`, 6 resumes
- Sources: kaggle 0, consented 0, smoke 6
- Role types: development 4, other 0, support_operations 2
- Parser version (`parser_version` in /parse responses): nlp-engine@2.1.0
- Service version (`GET /` `version` field): 2.1.0
- Alias table: `eval/aliases.json`, 57 aliases, sha256 b23afa6e66fc
- Out-of-scope list: `eval/out_of_scope_terms.json`, 43 terms, sha256 b8582b81dc6d
- `jd` sent: no

### Skills

| | Precision | Recall | F1 | Resumes averaged (P / R / F1) |
|---|---|---|---|---|
| Micro (TP 39, FP 6, FN 18) | 0.867 | 0.684 | 0.765 | 6 / 6 / 6 |
| Macro (per-resume mean) | 0.882 | 0.614 | 0.644 | 5 / 6 / 6 |

Macro rules: precision averages resumes where the parser kept at least one skill; recall averages resumes with at least one gold skill; F1 = 2TP/(2TP+FP+FN) per resume, averaged over resumes where either side is non-empty (an unreadable resume with gold skills scores F1 0).
Out-of-scope terms removed from the parser's output: 3 in total.

| Role type | Resumes | Micro P | Micro R | Micro F1 |
|---|---|---|---|---|
| development | 4 | 0.861 | 0.775 | 0.816 |
| support_operations | 2 | 0.889 | 0.471 | 0.615 |

### Contact fields (exact match after normalisation)

Normalisation: email trimmed and lower-cased; GitHub and LinkedIn URLs trimmed, lower-cased, with a leading `http://`/`https://`, a leading `www.` and trailing `/` removed. Nothing else.

| Field | Resumes with the field in gold | Correct of those | Accuracy over all resumes (empty = empty counts as correct) | Parser value where gold is empty |
|---|---|---|---|---|
| email | 6 | 5 (0.833) | 5/6 (0.833) | 0 |
| github_url | 4 | 3 (0.750) | 5/6 (0.833) | 0 |
| linkedin_url | 1 | 1 (1.000) | 6/6 (1.000) | 0 |

### Parse time

Client-side wall clock per `POST /parse` on loopback, over the 5 resumes that returned HTTP 200: median 0.106 s, maximum 0.121 s.

### Resumes not parsed

- `f6_image_only.pdf`: rejected as unreadable (HTTP 422, reason `no_text_layer`); counted as zero found skills.

<details><summary>Per-resume detail</summary>

| Resume | Role | Status | TP | FP | FN | Missed | False finds |
|---|---|---|---|---|---|---|---|
| `f1_dev_github.pdf` | development | parsed | 13 | 1 | 1 | ecs | github |
| `f2_dev_github.docx` | development | parsed | 9 | 3 | 1 | spring boot | github, javascript, spring |
| `f3_support_nogithub.pdf` | support_operations | parsed | 3 | 0 | 6 | active directory, itil, jira, nagios, servicenow, windows server | - |
| `f4_support_nogithub.docx` | support_operations | parsed | 5 | 1 | 3 | cloudwatch, pl/sql, splunk | github |
| `f5_multicolumn.pdf` | development | parsed | 9 | 1 | 1 | eks | github |
| `f6_image_only.pdf` | development | unreadable | 0 | 0 | 6 | django, docker, git, postgresql, python, rest | - |

</details>

## 2026-11-14 01:49 UTC - SMOKE SET on synthetic fixtures (NOT the evaluation result)

> **This is not the evaluation result.** It is a harness check on the six synthetic fixtures in `tests/fixtures/`, hand-labelled by the R-20 implementer. The fixtures were written for the test harness, not sampled from real resumes, so these numbers say nothing about Patina's parsing accuracy and must not be quoted as such. The evaluation result needs the 30-resume TM-1 set.

- Label set: `eval/smoke/gold.csv`, 6 resumes
- Sources: kaggle 0, consented 0, smoke 6
- Role types: development 4, other 0, support_operations 2
- Parser version (`parser_version` in /parse responses): nlp-engine@2.2.0
- Service version (`GET /` `version` field): 2.2.0
- Alias table: `eval/aliases.json`, 57 aliases, sha256 b23afa6e66fc
- Out-of-scope list: `eval/out_of_scope_terms.json`, 43 terms, sha256 b8582b81dc6d
- `jd` sent: no

### Skills

| | Precision | Recall | F1 | Resumes averaged (P / R / F1) |
|---|---|---|---|---|
| Micro (TP 48, FP 0, FN 9) | 1.000 | 0.842 | 0.914 | 6 / 6 / 6 |
| Macro (per-resume mean) | 1.000 | 0.784 | 0.807 | 5 / 6 / 6 |

Macro rules: precision averages resumes where the parser kept at least one skill; recall averages resumes with at least one gold skill; F1 = 2TP/(2TP+FP+FN) per resume, averaged over resumes where either side is non-empty (an unreadable resume with gold skills scores F1 0).
Out-of-scope terms removed from the parser's output: 3 in total.

| Role type | Resumes | Micro P | Micro R | Micro F1 |
|---|---|---|---|---|
| development | 4 | 1.000 | 0.800 | 0.889 |
| support_operations | 2 | 1.000 | 0.941 | 0.970 |

### Contact fields (exact match after normalisation)

Normalisation: email trimmed and lower-cased; GitHub and LinkedIn URLs trimmed, lower-cased, with a leading `http://`/`https://`, a leading `www.` and trailing `/` removed. Nothing else.

| Field | Resumes with the field in gold | Correct of those | Accuracy over all resumes (empty = empty counts as correct) | Parser value where gold is empty |
|---|---|---|---|---|
| email | 6 | 5 (0.833) | 5/6 (0.833) | 0 |
| github_url | 4 | 3 (0.750) | 5/6 (0.833) | 0 |
| linkedin_url | 1 | 1 (1.000) | 6/6 (1.000) | 0 |

### Parse time

Client-side wall clock per `POST /parse` on loopback, over the 5 resumes that returned HTTP 200: median 0.103 s, maximum 0.134 s.

### Resumes not parsed

- `f6_image_only.pdf`: rejected as unreadable (HTTP 422, reason `no_text_layer`); counted as zero found skills.

<details><summary>Per-resume detail</summary>

| Resume | Role | Status | TP | FP | FN | Missed | False finds |
|---|---|---|---|---|---|---|---|
| `f1_dev_github.pdf` | development | parsed | 13 | 0 | 1 | ecs | - |
| `f2_dev_github.docx` | development | parsed | 10 | 0 | 0 | - | - |
| `f3_support_nogithub.pdf` | support_operations | parsed | 9 | 0 | 0 | - | - |
| `f4_support_nogithub.docx` | support_operations | parsed | 7 | 0 | 1 | pl/sql | - |
| `f5_multicolumn.pdf` | development | parsed | 9 | 0 | 1 | eks | - |
| `f6_image_only.pdf` | development | unreadable | 0 | 0 | 6 | django, docker, git, postgresql, python, rest | - |

</details>

## 2026-11-14 - R-21 before and after, on the smoke set (synthetic fixtures; NOT the evaluation result)

Written by hand by the R-21 implementer to pair the two harness sections above. Both numbers come from
`eval/run_parsing_eval.py --smoke`; nothing here was computed by hand.

- **What the set is.** `eval/smoke/gold.csv`: the six synthetic resumes f1-f6 that this project wrote for its own
  test harness (`tests/fixtures/make_fixtures.py`), hand-labelled by the R-20 implementer. It is **not** the labelled
  real-resume set (TM-1, 30 resumes): on 2026-11-14 `eval/resumes/` does not exist and there are no TM-1 labels.
  **No claim about Patina's precision, recall or F1 on real resumes follows from these numbers.**
- **Same set, same tables.** Both runs used the same six labels, `eval/aliases.json` (sha256 b23afa6e66fc) and
  `eval/out_of_scope_terms.json` (sha256 b8582b81dc6d); neither file was edited between or after the runs.
- **Before** = section "2026-11-14 01:40 UTC" (`nlp-engine@2.1.0`, the working tree after R-30, before any R-21
  change). **After** = section "2026-11-14 01:49 UTC" (`nlp-engine@2.2.0`).
- **How it was run.** No service was started: the harness was driven against nlp-engine in-process through FastAPI's
  `TestClient`, with its two HTTP calls redirected to it. The harness's "on loopback" wording in the parse-time lines
  is therefore inaccurate for these two runs; the times are in-process.

| Smoke set (6 synthetic resumes) | Micro P | Micro R | Micro F1 | Macro F1 | TP / FP / FN |
|---|---|---|---|---|---|
| Before (2.1.0) | 0.867 | 0.684 | 0.765 | 0.644 | 39 / 6 / 18 |
| After (2.2.0) | 1.000 | 0.842 | 0.914 | 0.807 | 48 / 0 / 9 |

- **Why it moved.** False finds removed: `github` x4 (URLs, "not on GitHub"), `javascript` from "Node.js", `spring`
  from "Spring Boot". Finds added: the support tools of f3 (servicenow, jira, itil, nagios, active directory,
  windows server), `spring boot` (f2), `splunk` and `cloudwatch` (f4).
- **Read with care.** The fixtures' misses were known before the vocabulary was chosen (the 2026-11-12 section lists
  them), and f3 names exactly the support tools the card adds. The after figures on this set are expected to look good
  and are optimistic: they show the new rules do what they were written to do, not how the parser does on resumes it
  was not tuned against. That number needs the TM-1 set.
- **Still missed after:** `ecs`, `eks` (AWS service names, not in the vocabulary), `pl/sql` (not added: a language,
  not a support tool; logged in `ISSUES.md`), and all of f6 (image-only, no OCR).
