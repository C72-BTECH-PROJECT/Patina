"""Black-box tests for the FastAPI NLP service (POST /parse).

Each fixture resume + its job description is posted exactly the way the
32905c1 backend forwards it (resume, jd, required_skills, preferred_skills;
older services ignore the two skill fields). The full response is saved as a
snapshot under snapshots/<SNAPSHOT_LABEL>/ — snapshots are a reference for
diffing revisions, NOT a statement that the output is correct.

Only the response *shape* common to 32905c1 and HEAD is asserted, plus, for
the current tree only, the R-05 contract (unreadable fixtures answer 422 and a
successful parse carries raw_text and parser_version). The fuller R-05 cases
are in test_parse_contract.py.
"""

import json
import time

import pytest
import requests

from conftest import FIXTURES_DIR, PRIVATE_DIR, load_manifest, private_resumes

SNAPSHOT_ROOT = FIXTURES_DIR.parent / "nlp" / "snapshots"

TOP_KEYS = {"status", "filename", "raw_text_preview", "preprocessing", "entities", "semantic_analysis"}
PREPROCESSING_KEYS = {"token_count", "tokens_preview", "noun_chunks_preview", "sentence_count"}
ENTITY_KEYS = {
    "candidate_name", "email", "phone", "github", "linkedin",
    "skills", "skill_count", "experience", "education", "projects",
}
SEMANTIC_KEYS = {
    "similarity_score", "focused_score", "full_text_score", "match_level",
    "resume_embedding_size", "jd_embedding_size", "semantic_score",
    "skill_coverage", "resume_skills", "jd_skills", "matched_skills",
    "missing_skills", "match_reason",
}

# R-05: fields added after 32905c1, and fixtures with no extractable text.
# The baseline worktree (SNAPSHOT_LABEL=baseline) predates both.
R05_TOP_KEYS = {"raw_text", "parser_version"}
EXPECTED_UNREADABLE = {"f6_image_only": "no_text_layer"}

MIME = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _cases():
    manifest = load_manifest()
    cases = [
        pytest.param(FIXTURES_DIR / f["file"], f["jd"], False, id=f["id"])
        for f in manifest["fixtures"]
    ]
    cases += [
        pytest.param(p, "dev", True, id=f"private:{p.name}")
        for p in private_resumes()
    ]
    return cases


def _post(base_url, resume_path, jd_cfg):
    jd_text = (FIXTURES_DIR / jd_cfg["file"]).read_text(encoding="utf-8")
    with open(resume_path, "rb") as fh:
        files = {"resume": (resume_path.name, fh, MIME[resume_path.suffix.lower()])}
        data = {
            "jd": jd_text,
            "required_skills": json.dumps(jd_cfg["required_skills"]),
            "preferred_skills": json.dumps(jd_cfg["preferred_skills"]),
        }
        return requests.post(f"{base_url}/parse", files=files, data=data, timeout=120)


def _write_snapshot(label, resume_path, is_private, payload):
    root = (PRIVATE_DIR / "snapshots") if is_private else SNAPSHOT_ROOT
    out = root / label / f"{resume_path.stem}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n", encoding="utf-8")


def test_service_is_up(base_url):
    r = requests.get(f"{base_url}/", timeout=10)
    assert r.status_code == 200
    assert r.json().get("status") == "running"


@pytest.mark.parametrize("resume_path,jd_key,is_private", _cases())
def test_parse_fixture(base_url, snapshot_label, manifest, timings, resume_path, jd_key, is_private):
    started = time.perf_counter()
    r = _post(base_url, resume_path, manifest["jds"][jd_key])
    timings[resume_path.name] = round(time.perf_counter() - started, 3)

    # Snapshot first, so even a failing response is captured for comparison.
    try:
        body = r.json()
    except ValueError:
        body = {"_non_json_body": r.text}
    payload = body if r.status_code == 200 else {"_http_status": r.status_code, "_body": body}
    _write_snapshot(snapshot_label, resume_path, is_private, payload)

    r05 = snapshot_label != "baseline"
    unreadable_reason = None if is_private else EXPECTED_UNREADABLE.get(resume_path.stem)
    if r05 and unreadable_reason:
        assert r.status_code == 422, f"HTTP {r.status_code}: {r.text[:300]}"
        assert body.get("error") == "unreadable_document"
        assert body.get("reason") == unreadable_reason
        return

    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
    assert body.get("status") == "success"
    assert TOP_KEYS <= body.keys(), f"missing top-level keys: {TOP_KEYS - body.keys()}"
    assert PREPROCESSING_KEYS <= body["preprocessing"].keys()
    assert ENTITY_KEYS <= body["entities"].keys(), f"missing entity keys: {ENTITY_KEYS - body['entities'].keys()}"
    assert SEMANTIC_KEYS <= body["semantic_analysis"].keys(), (
        f"missing semantic keys: {SEMANTIC_KEYS - body['semantic_analysis'].keys()}"
    )
    assert body["filename"] == resume_path.name
    assert isinstance(body["entities"]["skills"], list)
    assert body["entities"]["skill_count"] == len(body["entities"]["skills"])
    if r05:
        assert R05_TOP_KEYS <= body.keys(), f"missing R-05 keys: {R05_TOP_KEYS - body.keys()}"
        assert body["raw_text"].startswith(body["raw_text_preview"])
