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
