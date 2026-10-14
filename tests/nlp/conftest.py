"""Shared config for the black-box NLP suite.

Env:
  NLP_BASE_URL    service under test (default http://localhost:8000)
  SNAPSHOT_LABEL  required; snapshot subfolder name, e.g. "baseline" / "current"
"""

import json
import os
from pathlib import Path

import pytest

TESTS_DIR = Path(__file__).resolve().parent.parent
FIXTURES_DIR = TESTS_DIR / "fixtures"
PRIVATE_DIR = TESTS_DIR / "private"
OUT_DIR = TESTS_DIR / ".out"


def load_manifest():
    return json.loads((FIXTURES_DIR / "manifest.json").read_text(encoding="utf-8"))


def private_resumes():
    """Real resumes the user drops into tests/private/ (git-ignored)."""
    if not PRIVATE_DIR.is_dir():
        return []
    return sorted(
        p for p in PRIVATE_DIR.iterdir()
        if p.is_file() and p.suffix.lower() in (".pdf", ".docx")
    )


@pytest.fixture(scope="session")
def base_url():
    return os.environ.get("NLP_BASE_URL", "http://localhost:8000").rstrip("/")


@pytest.fixture(scope="session")
def snapshot_label():
    label = os.environ.get("SNAPSHOT_LABEL")
    if not label:
        pytest.exit("SNAPSHOT_LABEL is required (e.g. baseline or current)", returncode=2)
    return label


@pytest.fixture(scope="session")
def manifest():
    return load_manifest()


@pytest.fixture(scope="session")
def timings(snapshot_label):
    """Wall-clock seconds per /parse call (FR-3 / NFR-1 reference only).
    Written to tests/.out/ because timings are not deterministic and must not
    pollute the snapshot hashes."""
    data = {}
    yield data
    OUT_DIR.mkdir(exist_ok=True)
    (OUT_DIR / f"nlp-timings-{snapshot_label}.json").write_text(
        json.dumps(data, indent=2, sort_keys=True), encoding="utf-8"
    )
