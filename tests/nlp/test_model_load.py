"""T-0031 (g): I-0059. The spaCy model loads by package name only, and a missing
model stops the import. Each module is imported in a subprocess with `spacy.load`
patched to record its argument and raise OSError. No service, no real model load.
"""
import json
import subprocess
import sys
from pathlib import Path

import pytest

NLP_DIR = Path(__file__).resolve().parents[2] / "nlp-engine"

PROBE = """
import importlib, json, sys
import spacy

calls = []

def fake_load(name, *args, **kwargs):
    calls.append(str(name))
    raise OSError("model missing")

spacy.load = fake_load
try:
    importlib.import_module(sys.argv[1])
except OSError:
    raised = True
else:
    raised = False
print(json.dumps({"raised": raised, "calls": calls}))
"""


@pytest.mark.parametrize("module", ["app.ner", "app.preprocessor"])
def test_missing_model_stops_import_after_one_load_by_name(module):
    done = subprocess.run(
        [sys.executable, "-c", PROBE, module],
        cwd=NLP_DIR, capture_output=True, text=True, timeout=120,
    )
    assert done.returncode == 0, done.stderr[-500:]
    result = json.loads(done.stdout.strip().splitlines()[-1])
    assert result["raised"] is True
    assert result["calls"] == ["en_core_web_sm"]
