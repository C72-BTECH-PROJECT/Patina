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

## 2026-11-14 11:28 UTC - Evaluation run on `eval/labels/gold.csv`

**Stated limits (read before quoting any number below):**

- n = 20 résumés, all from the public Kaggle Resume Dataset named in the SRS. The labelling guide planned 30; this is 20.
- How they were chosen: by file name, not by content or layout. The first 12 files by name in the INFORMATION-TECHNOLOGY folder, plus the first 2 by name in each of ENGINEERING, FINANCE, HR and DESIGNER. None was skipped.
- Labels: AI-drafted from the résumé text only (the parser's output was never consulted) and checked against each PDF by one human labeller (Anthony). One labeller, so no inter-labeller agreement figure exists and none is reported.
- Labelling rulings R1–R7 and the per-row decisions are in `eval/labels/RULINGS.md`, committed beside the label set `eval/labels/gold.csv` (both committed on 2026-11-14; the résumé PDFs, the label draft and the review sheet are not). They were made before this run.
- Role mix: 11 of 20 are not IT roles (role type `other`), 9 are support/operations, and none is a development role. The numbers say little about development résumés.
- Frozen before the run: the alias table and the out-of-scope list (same SHA-256 as the 2026-11-12 smoke run, so unchanged since before labelling) and the parser vocabulary, taken after the owner-approved sas/statistics change (nlp-engine@2.3.0). Nothing was changed after seeing this run's misses.
- Two résumés have no gold skills; they count only through false finds.

### Reproducing this run

- Dataset: the public Kaggle "Resume Dataset" (`snehaanbhawal/resume-dataset`: PDF résumés in one folder per job category, `data/data/<CATEGORY>/<id>.pdf`). The PDFs are not in this repository; download the dataset and copy the 20 files below into `eval/resumes/`.
- The 20 file ids (12 from INFORMATION-TECHNOLOGY, 2 each from ENGINEERING, FINANCE, HR and DESIGNER, chosen by the rule in the limits above): `10030015`, `10089434`, `10219099`, `10247517`, `10265057`, `10399912`, `10466583`, `10549585`, `10553553`, `10641230`, `10694288`, `10748989`, `10839851`, `10840430`, `11441764`, `11580408`, `11584809`, `11957080`, `12045067`, `12334140` (each `<id>.pdf`).
- Labels and rulings: `eval/labels/gold.csv`, `eval/labels/RULINGS.md` (committed). Frozen inputs: `eval/aliases.json`, `eval/out_of_scope_terms.json`, `eval/vocabulary_frozen.json` (hashes below).
- Command, with nlp-engine@2.3.0 running on port 8000: `nlp-engine\venv\Scripts\python eval\run_parsing_eval.py --nlp-url http://127.0.0.1:8000 --vocabulary eval\vocabulary_frozen.json --sensitivity 10089434.pdf` (add `--no-write` to print without appending).

### Interpretation (written 2026-11-14 after the run; no number below was changed)

- **Extraction is accurate on the skills the parser knows.** Precision is 0.795: about four in five skills it reports are right. Recall on the gold skills that are in its vocabulary is 0.866 (58 of 67). 7 of the 15 false finds are the two naming mismatches listed under "Same skill, different name", not wrong extractions.
- **Vocabulary coverage is the limit.** 212 of the 279 gold skills (76 %) are outside the 180-skill vocabulary, so overall recall is 0.208 and F1 is 0.330. A fixed list cannot name the office, vendor-hardware, ERP, payroll and in-house products these résumés list. The SRS targets (accuracy ≥ 85 %, F1 ≥ 0.80) are **not met** on this sample.
- **This is the case for a parser that is not bound to a list**, which is what the SRS's trained NER model is for (CHECKLIST 1.5, list C in `REBUILD/CUT.md`). Adding words to the list after seeing these misses would only fit the list to this sample. The trained model is not built. Roadmap milestone A2 chooses the replacement by measurement between two options: (a) grounded LLM extraction at runtime, and (b) a spaCy NER model trained on public CVs that an LLM has labelled, which keeps runtime parsing local and sends no résumé text to an API (`REBUILD/DECISIONS.md` §0 A10). (This bullet was reworded on 2026-11-14 after that decision; no number changed.)
- **The sample has no development roles** (11 other, 9 support/operations, 0 development). These numbers say nothing measured about developer résumés, which are the product's main case. **The next evaluation is a developer-role sample.**
- **Roadmap for that next run:** join the two alias gaps (`exchange server` = `microsoft exchange`; `sccm` = `system center configuration manager`) in the alias table and in the parser's canonical names. The next run **must use a fresh sample**: these 20 résumés have now been seen, so any change made because of their misses cannot be measured on them. (Recorded in `REBUILD/ROADMAP.md`, milestone A2.)

- Label set: `eval/labels/gold.csv`, 20 resumes
- Sources: kaggle 20, consented 0, smoke 0
- Role types: development 0, other 11, support_operations 9
- Parser version (`parser_version` in /parse responses): nlp-engine@2.3.0
- Service version (`GET /` `version` field): 2.3.0
- Alias table: `eval/aliases.json`, 57 aliases, sha256 b23afa6e66fc
- Out-of-scope list: `eval/out_of_scope_terms.json`, 43 terms, sha256 b8582b81dc6d
- `jd` sent: no

### Skills

| | Precision | Recall | F1 | Resumes averaged (P / R / F1) |
|---|---|---|---|---|
| Micro (TP 58, FP 15, FN 221) | 0.795 | 0.208 | 0.330 | 20 / 20 / 20 |
| Macro (per-resume mean) | 0.745 | 0.162 | 0.235 | 12 / 18 / 18 |

Macro rules: precision averages resumes where the parser kept at least one skill; recall averages resumes with at least one gold skill; F1 = 2TP/(2TP+FP+FN) per resume, averaged over resumes where either side is non-empty (an unreadable resume with gold skills scores F1 0).
Out-of-scope terms removed from the parser's output: 5 in total.

#### Recall on gold skills the parser can name

Frozen vocabulary: `eval/vocabulary_frozen.json`, 180 skills, sha256 47b4908ebfe0; checked identical to the live `GET /skills/vocabulary` before the run. A gold skill is in the vocabulary when its canonical form (eval alias table applied) equals the canonical form of a vocabulary name or one of its spellings. Always read the two recall figures together: the first is what a recruiter gets; the second is how well the parser finds what it is built to find.

| Recall over | Gold skills | Found | Recall |
|---|---|---|---|
| All gold skills | 279 | 58 | 0.208 |
| Gold skills in the frozen vocabulary | 67 | 58 | 0.866 |

212 of 279 gold skills (0.760) are not in the vocabulary, so the parser cannot find them whatever the résumé says.

#### Same skill, different name (alias-table gaps; reported, not corrected)

7 false finds are the parser's canonical name for a gold skill it then counts as missed, because the frozen alias table does not join the two names. Each is counted once as a false find and once as a miss above: parser `exchange server` vs gold `microsoft exchange` (5 résumés); parser `sccm` vs gold `system center configuration manager` (2 résumés).

#### Sensitivity: the result with `10089434.pdf` excluded

`10089434.pdf` holds 62 of 279 gold skills (0.222), 16 of 58 correct finds, 3 of 15 false finds and 46 of 221 misses.

| Set | Resumes | Micro P | Micro R | Micro F1 | Macro P | Macro R | Macro F1 |
|---|---|---|---|---|---|---|---|
| All | 20 | 0.795 | 0.208 | 0.330 | 0.745 | 0.162 | 0.235 |
| Without `10089434.pdf` (TP 42, FP 12, FN 175) | 19 | 0.778 | 0.194 | 0.310 | 0.736 | 0.156 | 0.225 |

Without `10089434.pdf`: recall on all gold skills 0.194; recall on gold skills in the frozen vocabulary 0.857 (42 of 49).

| Role type | Resumes | Micro P | Micro R | Micro F1 |
|---|---|---|---|---|
| other | 11 | 0.917 | 0.164 | 0.278 |
| support_operations | 9 | 0.770 | 0.222 | 0.344 |

### Contact fields (exact match after normalisation)

Normalisation: email trimmed and lower-cased; GitHub and LinkedIn URLs trimmed, lower-cased, with a leading `http://`/`https://`, a leading `www.` and trailing `/` removed. Nothing else.

| Field | Resumes with the field in gold | Correct of those | Accuracy over all resumes (empty = empty counts as correct) | Parser value where gold is empty |
|---|---|---|---|---|
| email | 0 | 0 (n/a) | 20/20 (1.000) | 0 |
| github_url | 0 | 0 (n/a) | 20/20 (1.000) | 0 |
| linkedin_url | 0 | 0 (n/a) | 20/20 (1.000) | 0 |

### Parse time

Client-side wall clock per `POST /parse` on loopback, over the 20 resumes that returned HTTP 200: median 0.939 s, maximum 1.713 s.

### Resumes not parsed

None. Every resume returned HTTP 200 with text.

<details><summary>Per-resume detail</summary>

| Resume | Role | Status | TP | FP | FN | Missed | False finds |
|---|---|---|---|---|---|---|---|
| `10030015.pdf` | other | parsed | 0 | 0 | 2 | dasylab, labview | - |
| `10089434.pdf` | support_operations | parsed | 16 | 3 | 46 | .net framework, active directory federation services, asp.net mvc, backup exec, batch, bbars, blackberry enterprise server, cacti, cisco asa, data domain, dhcp, distributed file system, dns, enterprise vault, epolicy orchestrator, exchange activesync, forefront threat management gateway, iis, isa server, jsp, ldap, mcafee, microsoft exchange, microsoft office, nmap, ntfs, sharepoint, solarwinds, storsimple, system center configuration manager, systems management server, t-sql, tcp/ip, team foundation server, twinstrata, ubuntu, vb.net, vbscript, veeam, veritas netbackup, visual studio, vpn, vranger, vsphere, windows, zenmap | .net, exchange server, sccm |
| `10219099.pdf` | other | parsed | 0 | 0 | 5 | cavs ii, lss, microsoft office, promis, wds | - |
| `10247517.pdf` | support_operations | parsed | 2 | 3 | 37 | adtran, apple airport, apple keynote, apple numbers, apple pages, autocad, autodesk, barracuda message archiver, barracuda web filter, catalyst, cisco, dell powervault, dos, excel, hp procurve, juniper, macos, meraki, microsoft access, microsoft exchange, microsoft project, microsoft word, mitel, nortel, outlook, palo alto, powerpoint, publisher, riverbed, sap, shoretel, solidworks, sonicwall, sql server, system center configuration manager, visio, windows | exchange server, sccm, sql |
| `10265057.pdf` | other | parsed | 7 | 1 | 13 | ansoft designer, apple keynote, apple numbers, apple pages, awr microwave office, eagle, excel, labview, microsoft office, ni multisim, pcb artist, spice, spss | statistics |
| `10399912.pdf` | other | parsed | 0 | 0 | 5 | excel, microsoft word, outlook, peoplesoft, powerpoint | - |
| `10466583.pdf` | other | parsed | 0 | 0 | 0 | - | - |
| `10549585.pdf` | other | parsed | 2 | 0 | 3 | cics, dos, vpn | - |
| `10553553.pdf` | support_operations | parsed | 6 | 1 | 12 | acronis snap deploy, act, adobe acrobat, dentrix, dexis, macos, microsoft exchange, microsoft office, novell, symantec endpoint security, symantec ghost, windows | exchange server |
| `10641230.pdf` | support_operations | parsed | 11 | 0 | 10 | actionscript, adobe creative suite, batch, eaglesoft, macos, microsoft office, tcp/ip, ubuntu, windows, windows phone | - |
| `10694288.pdf` | other | parsed | 0 | 0 | 5 | banner, benefits eligibility system, peopleadmin, personnel management information system, vrs navigator | - |
| `10748989.pdf` | other | parsed | 0 | 0 | 4 | adobe indesign, autocad, rhino, sketchup | - |
| `10839851.pdf` | support_operations | parsed | 1 | 0 | 5 | avaya, cisco, microsoft office, remedy, tcp/ip | - |
| `10840430.pdf` | other | parsed | 0 | 0 | 1 | acas | - |
| `11441764.pdf` | other | parsed | 2 | 0 | 18 | adp, as400, dynamics ax, e-time heavy, easypay, excel, ezlabor, great plains, jd edwards, mas90, microsoft access, microsoft office, quickbooks, report smith, sap, sbt, timesaver, ultipro | - |
| `11580408.pdf` | support_operations | parsed | 3 | 3 | 26 | 3com, act, blackberry, c/side, cisco, coral, fortinet, freepbx, ipswitch imail, magento, microsoft access, microsoft exchange, microsoft office, microsoft sbs, navision, netgear, nortel, omd, sco unix, sql server, sybase, visio, webgui, windows, windows mobile, windows server | c, exchange server, sql |
| `11584809.pdf` | support_operations | parsed | 3 | 1 | 4 | macos, microsoft dynamics, microsoft exchange, vmware | exchange server |
| `11957080.pdf` | support_operations | parsed | 5 | 2 | 20 | adobe indesign, asp.net, crystal reports, dos, excel, groupwise, heat, heatweb-fs, microsoft access, microsoft office, microsoft word, netmotion, novell imanager, powerpoint, publisher, sap, t3 voicemail, unix, visual studio, windows | .net, vue.js |
| `12045067.pdf` | other | parsed | 0 | 0 | 0 | - | - |
| `12334140.pdf` | support_operations | parsed | 0 | 1 | 5 | basic, dos, lotus, novell netware, wordperfect | express.js |

</details>
