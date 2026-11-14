# Parsing evaluation (card R-20, DECISIONS 4.3)

- `LABELLING_GUIDE.md`: the labelling rules and CSV format (the contract; not edited by the harness).
- `run_parsing_eval.py`: runs the evaluation against a running nlp-engine and appends a dated section to `RESULTS.md`. Standard library only.
- `parsing_metrics.py`: the metric code with no I/O, tested by `tests/eval/test_metrics.py`.
- `aliases.json`, `out_of_scope_terms.json`: **freeze both before a measurement.** Do not edit them after looking at a run's misses and false finds, or between the before and after runs of the vocabulary fix. `RESULTS.md` records a SHA-256 prefix of each so a change is visible.
- `smoke/gold.csv`: hand labels for the six synthetic fixtures in `tests/fixtures/` (source `smoke`). This is a harness check only, never the evaluation result.
- `resumes/` is git-ignored: the PDFs are never committed. `labels/gold.csv` and `labels/RULINGS.md` are committed (labels of 20 public Kaggle résumés; `RESULTS.md` names the dataset and lists the file ids); everything else in `labels/` (drafts, review sheets, per-labeller files) is git-ignored.

Run from the repo root with the NLP service running (see `REBUILD/inventory/baseline.md` §2 for the start command):

```
nlp-engine\venv\Scripts\python eval\run_parsing_eval.py --nlp-url http://127.0.0.1:8000 --labeller-a eval\labels\aaron.csv --labeller-b eval\labels\anurag.csv
nlp-engine\venv\Scripts\python eval\run_parsing_eval.py --smoke --nlp-url http://127.0.0.1:8000
nlp-engine\venv\Scripts\python eval\run_parsing_eval.py --vocabulary eval\vocabulary_frozen.json --freeze-vocabulary
nlp-engine\venv\Scripts\python eval\run_parsing_eval.py --vocabulary eval\vocabulary_frozen.json --sensitivity 10089434.pdf --limit "..."
nlp-engine\venv\Scripts\python -m pytest tests\eval -q
```

`--no-write` prints the section without appending it. `--vocabulary` (a frozen `GET /skills/vocabulary` body, `vocabulary_frozen.json`, written once by `--freeze-vocabulary`) adds recall on the gold skills the parser can name, shown beside overall recall, and lists false finds that are the parser's name for a missed gold skill; the run stops if the live vocabulary differs from the frozen one. `--sensitivity FILE` adds the scores with that resume excluded. `--limit TEXT` prints a stated limit at the top of the section. The TM-1 run of 2026-11-14 used all three.

## Multiple-choice option report (card R-29)

`mcq_option_report.py` generates pools with the real assessment-service code and the configured Gemini key (a LIVE run: it calls the LLM), then prints the share of MCQs whose correct option is the longest, the MCQs rejected by the option rule in every round (not only the accepted one), outcome, rounds and seconds per pool, and the correct-answer position spread of the served MCQs. A pool that fails is recorded with its error code and the run continues. The input is one invented job and candidate. Its metric functions, and the run itself against a fake LLM, are tested offline in `tests/assessment/test_option_rule.py`. `--write` appends one dated section to `RESULTS.md`; `--save-json` writes only generated content (questions, options, answer keys, rejected MCQs with reasons) and per-round outcomes.

```
assessment-service\.venv\Scripts\python eval\mcq_option_report.py --pools 3 --save-json eval\mcq_pools.json --write
```
