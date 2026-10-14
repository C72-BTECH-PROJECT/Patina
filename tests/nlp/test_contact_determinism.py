"""T-0013 / ISSUES I-0015: contact fields of extract_entities are deterministic.

Runs extract_entities in child processes with the nlp-engine venv interpreter
(cwd nlp-engine/), so no service is needed and PYTHONHASHSEED can be varied.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
NLP_DIR = REPO / "nlp-engine"
VENV_PY = NLP_DIR / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
FIELDS = ("email", "phone", "github", "linkedin")

CHILD = (
    "import json, sys\n"
    "from app.ner import extract_entities\n"
    "texts = json.loads(sys.stdin.read())\n"
    "print('@@' + json.dumps([{k: extract_entities(t)[k] for k in %r} for t in texts]))\n"
) % (FIELDS,)

TWO_OF_EACH = (
    "Jane Doe\n"
    "zeta.first@example.com | alpha.second@example.com\n"
    "Phone: +1 415-555-0101, alt 212-555-0199\n"
    "GitHub: https://github.com/zeta-dev and https://github.com/alpha-dev\n"
    "LinkedIn: https://linkedin.com/in/zeta-in and https://linkedin.com/in/alpha-in\n"
    "Summary: backend developer with Python experience.\n"
)


def run_child(texts, seed):
    env = dict(os.environ, PYTHONHASHSEED=str(seed), HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1")
    proc = subprocess.run(
        [str(VENV_PY), "-c", CHILD], input=json.dumps(texts), cwd=NLP_DIR,
        env=env, capture_output=True, text=True, timeout=300,
    )
    assert proc.returncode == 0, proc.stderr[-2000:]
    line = [l for l in proc.stdout.splitlines() if l.startswith("@@")][-1]
    return json.loads(line[2:])


def test_contact_fields_same_under_every_hash_seed():
    expected = {
        "email": "zeta.first@example.com",
        "phone": "+14155550101",
        "github": "https://github.com/zeta-dev",
        "linkedin": "https://linkedin.com/in/zeta-in",
    }
    results = {seed: run_child([TWO_OF_EACH], seed)[0] for seed in range(5)}
    diffs = {
        seed: {k: r[k] for k in FIELDS if r[k] != expected[k]}
        for seed, r in results.items()
    }
    diffs = {s: d for s, d in diffs.items() if d}
    assert not diffs, f"fields differing from first-in-document-order, by PYTHONHASHSEED: {diffs}"


GITHUB_ROWS = [
    ("See https://github.com/alice.", "https://github.com/alice"),
    ("github.com/acme/tool and later github.com/alice", "github.com/alice"),
    ("Project: github.com/alice/proj", "github.com/alice"),
    ("Profile www.github.com/alice/", "www.github.com/alice"),
    ("No link in this resume.", None),
]


def test_github_link_rules():
    got = run_child([t for t, _ in GITHUB_ROWS], 0)
    bad = [(t, e, g["github"]) for (t, e), g in zip(GITHUB_ROWS, got) if g["github"] != e]
    assert not bad, f"(text, expected, got): {bad}"
