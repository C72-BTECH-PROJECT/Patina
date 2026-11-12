"""R-05: the honest /parse contract (black-box, against NLP_BASE_URL).

- no extractable text -> 422 {error: "unreadable_document", reason}
  with reason no_text_layer | empty | corrupt; never a 200 with a score
- .doc, images and other unsupported types -> 415 JSON, not a 500
- `jd` optional; without it `semantic_analysis` is null (no score of any kind)
- raw_text (capped at 20,000 chars) and parser_version on every success
- malformed required_skills / preferred_skills -> 400
- embedding size comes from the model, not a literal (subprocess, no service)

These cases do not apply to the 32905c1 baseline tree and are skipped there.
"""

import json
import os
import subprocess
from pathlib import Path

import pytest
import requests

from conftest import FIXTURES_DIR, load_manifest

NLP_DIR = Path(__file__).resolve().parents[2] / "nlp-engine"
VENV_PY = NLP_DIR / "venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
RAW_TEXT_LIMIT = 20_000

PDF = "application/pdf"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
# First bytes of an OLE2 compound file, which is what a legacy Word .doc is.
OLE_HEADER = bytes.fromhex("D0CF11E0A1B11AE1") + b"\x00" * 504
# Signature plus IHDR start of a PNG.
PNG_BYTES = bytes.fromhex("89504E470D0A1A0A0000000D49484452") + b"\x00" * 64


@pytest.fixture(autouse=True)
def _current_tree_only(snapshot_label):
    if snapshot_label == "baseline":
        pytest.skip("R-05 contract is not part of the 32905c1 baseline service")


@pytest.fixture(scope="module")
def dev_jd():
    jd = load_manifest()["jds"]["dev"]
    return {
        "jd": (FIXTURES_DIR / jd["file"]).read_text(encoding="utf-8"),
        "required_skills": json.dumps(jd["required_skills"]),
        "preferred_skills": json.dumps(jd["preferred_skills"]),
    }


def _post(base_url, name, content, mime, data=None):
    files = {"resume": (name, content, mime)}
    return requests.post(f"{base_url}/parse", files=files, data=data or {}, timeout=120)


def _fixture_bytes(name):
    return (FIXTURES_DIR / name).read_bytes()


def _assert_unreadable(r, reason):
    assert r.status_code == 422, f"HTTP {r.status_code}: {r.text[:300]}"
    body = r.json()
    assert body["error"] == "unreadable_document"
    assert body["reason"] == reason
    # Nothing that could be read as a score.
    assert "semantic_analysis" not in body and "similarity_score" not in json.dumps(body)


# --- 422 unreadable_document -------------------------------------------------

def test_image_only_pdf_is_no_text_layer(base_url, dev_jd):
    r = _post(base_url, "f6_image_only.pdf", _fixture_bytes("f6_image_only.pdf"), PDF, dev_jd)
    _assert_unreadable(r, "no_text_layer")


def test_image_only_pdf_without_jd_is_no_text_layer(base_url):
    r = _post(base_url, "f6_image_only.pdf", _fixture_bytes("f6_image_only.pdf"), PDF)
    _assert_unreadable(r, "no_text_layer")


@pytest.mark.parametrize("name,mime", [("empty.pdf", PDF), ("empty.docx", DOCX), ("empty.txt", "text/plain")])
def test_zero_byte_file_is_empty(base_url, dev_jd, name, mime):
    _assert_unreadable(_post(base_url, name, b"", mime, dev_jd), "empty")


def test_blank_txt_is_empty(base_url, dev_jd):
    _assert_unreadable(_post(base_url, "blank.txt", b"  \n\t\n ", "text/plain", dev_jd), "empty")


@pytest.mark.parametrize("name,mime,content", [
    ("broken.pdf", PDF, b"%PDF-1.4 this is not really a pdf"),
    ("broken.docx", DOCX, b"this is not a zip archive"),
    ("legacy-renamed.docx", DOCX, OLE_HEADER),
], ids=["broken-pdf", "not-a-zip-docx", "ole-doc-renamed-docx"])
def test_unopenable_file_is_corrupt(base_url, dev_jd, name, mime, content):
    _assert_unreadable(_post(base_url, name, content, mime, dev_jd), "corrupt")


# --- 415 unsupported type ----------------------------------------------------

@pytest.mark.parametrize("name,mime,content", [
    ("resume.doc", "application/msword", OLE_HEADER),
    ("resume.png", "image/png", PNG_BYTES),
    ("resume.jpg", "image/jpeg", b"\xff\xd8\xff\xe0" + b"\x00" * 64),
    ("resume", "application/octet-stream", b"no extension"),
], ids=["doc", "png", "jpg", "no-extension"])
def test_unsupported_type_is_415_json(base_url, dev_jd, name, mime, content):
    r = _post(base_url, name, content, mime, dev_jd)
    assert r.status_code == 415, f"HTTP {r.status_code}: {r.text[:300]}"
    body = r.json()
    assert body["error"] == "unsupported_file_type"
    assert body["supported"] == [".pdf", ".docx", ".txt"]


# --- jd optional, raw_text, parser_version ----------------------------------

def test_parse_without_jd_returns_entities_and_no_similarity(base_url):
    r = _post(base_url, "f1_dev_github.pdf", _fixture_bytes("f1_dev_github.pdf"), PDF)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
    body = r.json()
    assert body["status"] == "success"
    assert body["entities"]["skills"], "entities should still be extracted without a jd"
    assert body["entities"]["email"]
    assert body["semantic_analysis"] is None
    assert "similarity_score" not in json.dumps(body)


def test_blank_jd_counts_as_absent(base_url):
    r = _post(base_url, "f1_dev_github.pdf", _fixture_bytes("f1_dev_github.pdf"), PDF, {"jd": "   "})
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
    assert r.json()["semantic_analysis"] is None


def test_raw_text_and_parser_version_present(base_url, dev_jd):
    r = _post(base_url, "f1_dev_github.pdf", _fixture_bytes("f1_dev_github.pdf"), PDF, dev_jd)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
    body = r.json()
    assert isinstance(body["raw_text"], str) and body["raw_text"].strip()
    assert body["raw_text"].startswith(body["raw_text_preview"])
    assert len(body["raw_text_preview"]) <= 300
    assert len(body["raw_text"]) > len(body["raw_text_preview"])
    assert body["raw_text_truncated"] is False
    assert isinstance(body["parser_version"], str) and body["parser_version"]
    assert body["semantic_analysis"]["similarity_score"] is not None

    health = requests.get(f"{base_url}/", timeout=10).json()
    assert health["parser_version"] == body["parser_version"]


def test_raw_text_is_capped(base_url):
    line = "Python developer with SQL and Docker experience at Example Corp.\n"
    text = line * (RAW_TEXT_LIMIT // len(line) + 50)
    r = _post(base_url, "long.txt", text.encode("utf-8"), "text/plain")
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
    body = r.json()
    assert len(body["raw_text"]) == RAW_TEXT_LIMIT
    assert body["raw_text_truncated"] is True
    assert text.strip().startswith(body["raw_text"])


# --- 400 malformed skill lists -----------------------------------------------

@pytest.mark.parametrize("field", ["required_skills", "preferred_skills"])
@pytest.mark.parametrize("value", ["not json", '{"python": 1}', "[1, 2]", '"python"', "[python, sql]"])
def test_malformed_skill_list_is_400(base_url, dev_jd, field, value):
    data = dict(dev_jd, **{field: value})
    r = _post(base_url, "f1_dev_github.pdf", _fixture_bytes("f1_dev_github.pdf"), PDF, data)
    assert r.status_code == 400, f"HTTP {r.status_code}: {r.text[:300]}"
    body = r.json()
    assert body["error"] == "invalid_skill_list"
    assert body["field"] == field


def test_missing_resume_field_is_400_not_422(base_url, dev_jd):
    r = requests.post(f"{base_url}/parse", data=dev_jd, timeout=30)
    assert r.status_code == 400, f"HTTP {r.status_code}: {r.text[:300]}"
    assert r.json()["error"] == "invalid_request"


# --- embedding size read from the model --------------------------------------

EMBED_PROBE = """
import json
import numpy as np
import sentence_transformers

class FakeModel:
    def __init__(self, *args, **kwargs):
        pass
    def get_embedding_dimension(self):
        return 7
    def encode(self, texts, normalize_embeddings=True):
        single = isinstance(texts, str)
        rows = [np.full(7, 1 / np.sqrt(7)) for _ in ([texts] if single else texts)]
        return rows[0] if single else np.array(rows)

sentence_transformers.SentenceTransformer = FakeModel
from app.embedder import analyse
out = analyse("Python and SQL developer", "Python developer", skills=["python", "sql"])
print("@@" + json.dumps([out["resume_embedding_size"], out["jd_embedding_size"]]))
"""


def test_embedding_size_is_read_from_the_model():
    env = dict(os.environ, HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1")
    done = subprocess.run(
        [str(VENV_PY), "-c", EMBED_PROBE], cwd=NLP_DIR, env=env,
        capture_output=True, text=True, timeout=300,
    )
    assert done.returncode == 0, done.stderr[-2000:]
    line = [l for l in done.stdout.splitlines() if l.startswith("@@")][-1]
    assert json.loads(line[2:]) == [7, 7]
