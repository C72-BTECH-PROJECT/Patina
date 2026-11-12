# Parsing evaluation (card R-20, DECISIONS 4.3)

- `LABELLING_GUIDE.md`: the labelling rules and CSV format (the contract; not edited by the harness).
- `run_parsing_eval.py`: runs the evaluation against a running nlp-engine and appends a dated section to `RESULTS.md`. Standard library only.
- `parsing_metrics.py`: the metric code with no I/O, tested by `tests/eval/test_metrics.py`.
- `aliases.json`, `out_of_scope_terms.json`: **freeze both before a measurement.** Do not edit them after looking at a run's misses and false finds, or between the before and after runs of the vocabulary fix. `RESULTS.md` records a SHA-256 prefix of each so a change is visible.
- `smoke/gold.csv`: hand labels for the six synthetic fixtures in `tests/fixtures/` (source `smoke`). This is a harness check only, never the evaluation result.
- `resumes/` and `labels/` are git-ignored. Put the TM-1 resume files in `resumes/` and `gold.csv` (plus `aaron.csv` and `anurag.csv`) in `labels/`.

Run from the repo root with the NLP service running (see `REBUILD/inventory/baseline.md` §2 for the start command):

```
nlp-engine\venv\Scripts\python eval\run_parsing_eval.py --nlp-url http://127.0.0.1:8000 --labeller-a eval\labels\aaron.csv --labeller-b eval\labels\anurag.csv
nlp-engine\venv\Scripts\python eval\run_parsing_eval.py --smoke --nlp-url http://127.0.0.1:8000
nlp-engine\venv\Scripts\python -m pytest tests\eval -q
```

`--no-write` prints the section without appending it.
