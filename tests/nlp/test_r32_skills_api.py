"""R-32: the skill vocabulary read and the skills-from-text endpoint (offline).

- GET /skills/vocabulary lists the parser's canonical skill names, each with the
  spellings normalize_skill maps onto it; R (after R-21) and the support tools
  are in it; every name a job description can yield is in it.
- POST /skills/extract returns the skills of a fixture job description, in the
  same canonical form the parser uses for a job description; a wrong body is a
  400 JSON error; /parse is not changed.

Imports nlp-engine in-process through FastAPI's TestClient; run with the
nlp-engine venv interpreter. The sentence model is not loaded: app.embedder is
replaced by a module whose `analyse` raises, for the import of app.main only, so
a test that reached it would fail. Nothing here calls /parse.
"""

import sys
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / "tests" / "fixtures"
sys.path.insert(0, str(REPO / "nlp-engine"))

from app.ner import extract_skills, normalize_skills  # noqa: E402


@pytest.fixture(scope="module")
def client():
    def _analyse(*_args, **_kwargs):
        raise AssertionError("the skills endpoints must not use the sentence model")

    fake = types.ModuleType("app.embedder")
    fake.analyse = _analyse
    saved = {name: sys.modules.get(name) for name in ("app.embedder", "app.main")}
    sys.modules["app.embedder"] = fake
    sys.modules.pop("app.main", None)
    try:
        import app.main as main  # noqa: PLC0415
        yield TestClient(main.app), main
    finally:
        for name, module in saved.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module


def _vocabulary(client):
    http, _ = client
    response = http.get("/skills/vocabulary")
    assert response.status_code == 200
    body = response.json()
    assert body["parser_version"].startswith("nlp-engine@")
    return {entry["name"]: entry["aliases"] for entry in body["skills"]}


def test_vocabulary_has_r_and_the_support_tools(client):
    vocab = _vocabulary(client)
    for name in ("r", "go", "c", "python", "servicenow", "jira", "itil", "active directory", "rest api"):
        assert name in vocab, name
    assert "github" not in vocab


def test_vocabulary_names_are_canonical_and_carry_their_aliases(client):
    vocab = _vocabulary(client)
    assert list(vocab) == sorted(vocab), "names are sorted"
    assert "js" in vocab["javascript"]
    assert "postgres" in vocab["postgresql"]
    assert "golang" in vocab["go"]
    assert "node.js" in vocab["nodejs"]
    # An alias is never also a name, and no name lists itself.
    for name, aliases in vocab.items():
        assert name not in aliases
        assert not set(aliases) & set(vocab), name


def test_sas_and_statistics_are_in_the_vocabulary(client):
    # Owner decision 2026-11-14 (nlp-engine@2.3.0): sas outright, statistics in context.
    vocab = _vocabulary(client)
    assert "sas" in vocab
    assert "statistics" in vocab


@pytest.mark.parametrize("text, expected", [
    ("Analysis in SAS and SPSS.", ["sas"]),
    ("Required: SAS, R and statistics.", ["r", "sas", "statistics"]),
    ("Applied statistics and Bayesian methods.", ["statistics"]),
    ("Compiled sales statistics for the Bureau of Labor Statistics.", []),
    ("Styled with Sass.", ["sass"]),
])
def test_sas_anywhere_and_statistics_only_in_context(text, expected):
    assert sorted(extract_skills(text)) == expected


@pytest.mark.parametrize("jd, expected", [
    ("dev", ["python", "javascript", "react", "django", "fastapi", "postgresql", "redis",
             "aws", "docker", "kubernetes", "git", "sql", "rest api"]),
    ("support", ["python", "bash", "linux", "servicenow", "jira", "itil", "nagios", "splunk",
                 "cloudwatch", "active directory", "windows server", "sql"]),
])
def test_extract_returns_the_skills_of_a_fixture_description(client, jd, expected):
    http, _ = client
    text = (FIXTURES / "jds" / f"{jd}.txt").read_text(encoding="utf-8")
    response = http.post("/skills/extract", json={"text": text})
    assert response.status_code == 200
    body = response.json()
    assert body["skills"] == expected
    # The same canonical form the parser derives for a job description (app/embedder.py).
    assert body["skills"] == normalize_skills(extract_skills(text))


def test_every_extracted_skill_is_in_the_vocabulary(client):
    http, _ = client
    vocab = _vocabulary(client)
    for jd in ("dev", "support"):
        text = (FIXTURES / "jds" / f"{jd}.txt").read_text(encoding="utf-8")
        for skill in http.post("/skills/extract", json={"text": text}).json()["skills"]:
            assert skill in vocab, skill


def test_extract_finds_r_in_context_and_nothing_in_empty_text(client):
    http, _ = client
    body = http.post("/skills/extract", json={"text": "Statistical modelling in R, reporting in Excel."}).json()
    assert body["skills"] == ["r"]
    assert http.post("/skills/extract", json={"text": ""}).json()["skills"] == []


@pytest.mark.parametrize("payload", [{}, {"text": 12}, {"text": None}, {"words": "python"}])
def test_extract_rejects_a_wrong_body_with_400(client, payload):
    http, _ = client
    response = http.post("/skills/extract", json=payload)
    assert response.status_code == 400
    assert response.json()["error"] == "invalid_request"


def test_extract_rejects_text_over_the_limit(client):
    http, main = client
    response = http.post("/skills/extract", json={"text": "x" * (main.SKILLS_TEXT_LIMIT + 1)})
    assert response.status_code == 400
    assert response.json()["error"] == "text_too_long"
