"""R-07: Gemini-only generation, bounded time, served draw (D§6.1, D§6.2).

Every test uses a fake LLM: app.llm_client._complete is replaced, so nothing
touches the network and no real key is read (conftest disables .env loading).
"""
import importlib
import json
import random
import re
import time

import pytest

try:  # the openai SDK in this venv is built on httpx2
    import httpx2 as httpx
except ImportError:  # pragma: no cover
    import httpx
from openai import RateLimitError

from conftest import SERVICE_DIR

FAKE_KEY = "AIzaFAKE-not-a-real-key-0123456789"
MODELS = ["fake-model-a", "fake-model-b"]


# ── fixtures ────────────────────────────────────────────────────────────────

def make_payload(github_source_on=None):
    """A valid 20-question generation (10 MCQ q1-q10, 10 short q11-q20).

    Every question, option and key entry carries a unique marker so a test can
    prove an undrawn question appears nowhere in a response.
    """
    questions, answers = [], []
    for i in range(1, 11):
        qid = f"q{i}"
        questions.append({
            "question_id": qid,
            "question_type": "mcq",
            "question": f"MCQ-STEM-{i:02d} what does this do?",
            "skill": "python",
            "source": "github" if github_source_on == qid else "jd",
            "options": [
                {"label": label, "text": f"OPT-{i:02d}-{label}"} for label in "ABCD"
            ],
        })
        answers.append({
            "question_id": qid,
            "correct_option": "B",
            "explanation": f"MCQ-EXPL-{i:02d}",
        })
    for i in range(11, 21):
        qid = f"q{i}"
        questions.append({
            "question_id": qid,
            "question_type": "short_answer",
            "question": f"SA-STEM-{i:02d} explain this.",
            "skill": "sql",
            "source": "github" if github_source_on == qid else "resume",
        })
        answers.append({
            "question_id": qid,
            "ideal_answer": f"SA-IDEAL-{i:02d}",
            "key_points": [f"SA-KP-{i:02d}-1", f"SA-KP-{i:02d}-2"],
        })
    return {"questions": questions, "answers": answers}


def request_body(**overrides):
    body = {
        "candidate_id": "cand-test-1",
        "job_id": "job-test-1",
        "job_title": "Backend Engineer",
        "job_description": "Build APIs in Python and SQL.",
        "required_skills": ["python", "sql"],
        "resume_text": "Invented Candidate. Python developer, 3 years, SQL.",
        "resume_skills": ["python", "sql"],
    }
    body.update(overrides)
    return body


@pytest.fixture()
def llm(monkeypatch):
    """Configure a fake key and models; returns a controller for the fake LLM."""
    import app.config as config
    import app.llm_client as llm_client

    monkeypatch.setattr(config, "GEMINI_API_KEY", FAKE_KEY)
    monkeypatch.setattr(config, "GEMINI_MODELS", list(MODELS))

    class Fake:
        def __init__(self):
            self.responses = []   # consumed in order; the last one repeats
            self.calls = []       # (model, messages, timeout)

        def __call__(self, model, messages, timeout):
            self.calls.append((model, messages, timeout))
            item = self.responses[min(len(self.calls), len(self.responses)) - 1]
            if callable(item):
                return item(model)
            if isinstance(item, BaseException):
                raise item
            return item

    fake = Fake()
    monkeypatch.setattr(llm_client, "_complete", fake)
    return fake


def served(response_json):
    return response_json["questions"]["questions"], response_json["answer_key"]["answers"]


# ── the served draw ─────────────────────────────────────────────────────────

def test_serves_6_mcq_and_4_short_from_20_with_matching_key(client, llm):
    llm.responses = [(json.dumps(make_payload()), "stop")]
    r = client.post("/generate-assessment", json=request_body())
    assert r.status_code == 200, r.text
    questions, answers = served(r.json())

    assert len(questions) == 10
    assert sum(q["question_type"] == "mcq" for q in questions) == 6
    assert sum(q["question_type"] == "short_answer" for q in questions) == 4
    assert [q["question_id"] for q in questions] == [f"q{i}" for i in range(1, 11)]
    # The key is exactly the served set, in the same order, matching each type.
    assert [a["question_id"] for a in answers] == [q["question_id"] for q in questions]
    for q, a in zip(questions, answers):
        if q["question_type"] == "mcq":
            assert set(a) == {"question_id", "correct_option", "explanation"}
        else:
            assert set(a) == {"question_id", "ideal_answer", "key_points"}


def test_key_still_points_at_the_correct_option_text_after_shuffle(client, llm):
    llm.responses = [(json.dumps(make_payload()), "stop")]
    questions, answers = served(client.post("/generate-assessment", json=request_body()).json())
    for q, a in zip(questions, answers):
        if q["question_type"] != "mcq":
            continue
        number = re.search(r"MCQ-STEM-(\d\d)", q["question"]).group(1)
        assert a["explanation"] == f"MCQ-EXPL-{number}"  # key travelled with its question
        correct = next(o["text"] for o in q["options"] if o["label"] == a["correct_option"])
        assert correct == f"OPT-{number}-B"


def test_undrawn_questions_appear_nowhere_in_the_response(client, llm):
    llm.responses = [(json.dumps(make_payload()), "stop")]
    r = client.post("/generate-assessment", json=request_body())
    text = r.text
    questions, _ = served(r.json())
    served_numbers = {re.search(r"-(\d\d) ", q["question"]).group(1) for q in questions}
    assert len(served_numbers) == 10
    for i in range(1, 21):
        n = f"{i:02d}"
        markers = [f"STEM-{n}", f"OPT-{n}-", f"MCQ-EXPL-{n}", f"SA-IDEAL-{n}", f"SA-KP-{n}-"]
        present = [m for m in markers if m in text]
        if n in served_numbers:
            assert present, f"served question {n} missing"
        else:
            assert not present, f"undrawn question {n} leaked: {present}"


def test_draw_differs_across_seeds():
    from app.generator import draw_served_questions
    from app.validators import validate_assessment

    q, a = validate_assessment(make_payload(), "c", "j", "aid", "m", "v",
                               github_supplied=False)
    draws = set()
    for seed in range(8):
        sq, sa = draw_served_questions(q, a, random.Random(seed))
        assert len(sq["questions"]) == 10 and len(sa["answers"]) == 10
        draws.add(tuple(x["question"] for x in sq["questions"]))
    assert len(draws) > 1, "every seed served the same questions in the same order"


def test_same_seed_gives_the_same_draw(llm):
    from app.generator import generate_assessment

    llm.responses = [(json.dumps(make_payload()), "stop")]
    first, _ = generate_assessment(request_body(), rng=random.Random(42))
    second, _ = generate_assessment(request_body(), rng=random.Random(42))
    assert [x["question"] for x in first["questions"]] == [x["question"] for x in second["questions"]]


def test_served_counts_are_configurable(client, llm, monkeypatch):
    import app.config as config

    monkeypatch.setattr(config, "SERVED_MCQ", 3)
    monkeypatch.setattr(config, "SERVED_SHORT", 2)
    llm.responses = [(json.dumps(make_payload()), "stop")]
    questions, answers = served(client.post("/generate-assessment", json=request_body()).json())
    assert sum(q["question_type"] == "mcq" for q in questions) == 3
    assert sum(q["question_type"] == "short_answer" for q in questions) == 2
    assert len(answers) == 5


def test_served_set_carries_the_prompt_version_and_model(client, llm):
    from app.prompts import PROMPT_VERSION

    llm.responses = [(json.dumps(make_payload()), "stop")]
    bundle = client.post("/generate-assessment", json=request_body()).json()["questions"]
    assert bundle["prompt_version"] == PROMPT_VERSION
    assert bundle["model_used"] == MODELS[0]


# ── failures name the cause, never the key ──────────────────────────────────

def test_invalid_json_from_every_model_is_502_with_the_cause(client, llm):
    llm.responses = [("this is not json {", "stop")]
    r = client.post("/generate-assessment", json=request_body())
    assert r.status_code == 502
    body = r.json()
    assert body["error"] == "llm_invalid_output"
    for model in MODELS:
        assert f"{model}: invalid JSON" in body["message"]
    assert len(llm.calls) == len(MODELS)  # one call per model, then stop


def test_truncated_output_says_so(client, llm):
    llm.responses = [('{"questions": [', "length")]
    body = client.post("/generate-assessment", json=request_body()).json()
    assert "cut off at the token limit" in body["message"]


def test_falls_through_to_the_next_model(client, llm):
    llm.responses = [("nope", "stop"), (json.dumps(make_payload()), "stop")]
    r = client.post("/generate-assessment", json=request_body())
    assert r.status_code == 200
    assert r.json()["questions"]["model_used"] == MODELS[1]


def test_provider_error_names_model_and_status_and_redacts_the_key(client, llm):
    response = httpx.Response(429, request=httpx.Request("POST", "https://example.invalid"))
    llm.responses = [RateLimitError(
        f"Quota exceeded for key={FAKE_KEY} (also {FAKE_KEY})", response=response, body=None
    )]
    r = client.post("/generate-assessment", json=request_body())
    assert r.status_code == 502
    body = r.json()
    assert body["error"] == "llm_unavailable"
    assert f"{MODELS[0]}: HTTP 429" in body["message"]
    assert "Quota exceeded" in body["message"]
    assert FAKE_KEY not in r.text
    assert "AIza" not in r.text


def test_no_key_means_503_not_configured(client, monkeypatch):
    import app.config as config

    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
    r = client.post("/generate-assessment", json=request_body())
    assert r.status_code == 503
    assert r.json()["error"] == "llm_not_configured"
    assert "GEMINI_API_KEY" in r.json()["message"]


def test_a_hanging_model_is_cut_off_by_the_wall_clock_budget(llm, monkeypatch):
    import app.config as config
    from app.llm_client import AssessmentLLMError, generate_json

    monkeypatch.setattr(config, "MIN_CALL_SECONDS", 0.05)
    monkeypatch.setattr(config, "REQUEST_TIMEOUT_SECONDS", 0.3)
    llm.responses = [lambda model: time.sleep(3) or ("{}", "stop")]
    started = time.monotonic()
    with pytest.raises(AssessmentLLMError) as info:
        generate_json("p", deadline=time.monotonic() + 0.5)
    elapsed = time.monotonic() - started
    assert elapsed < 1.5, elapsed
    assert f"{MODELS[0]}: timed out" in str(info.value)
    assert "time budget used up" in str(info.value) or f"{MODELS[1]}: timed out" in str(info.value)


def test_every_call_timeout_fits_inside_the_budget(llm, monkeypatch):
    import app.config as config
    from app.llm_client import generate_json

    monkeypatch.setattr(config, "REQUEST_TIMEOUT_SECONDS", 500.0)
    llm.responses = [("not json", "stop")]
    deadline = time.monotonic() + 100
    with pytest.raises(Exception):
        generate_json("p", deadline=deadline)
    assert all(timeout <= 100 for _, _, timeout in llm.calls)


@pytest.mark.parametrize("value", ["231", "300", "0"])
def test_budget_above_230_seconds_is_refused(monkeypatch, value):
    import app.config as config

    monkeypatch.setenv("ASSESSMENT_GENERATION_BUDGET_SECONDS", value)
    try:
        with pytest.raises(ValueError):
            importlib.reload(config)
    finally:
        monkeypatch.delenv("ASSESSMENT_GENERATION_BUDGET_SECONDS")
        importlib.reload(config)
    assert config.GENERATION_BUDGET_SECONDS < 240


# ── GitHub-source rule and GitHub truncation ────────────────────────────────

def test_validator_rejects_github_source_without_github_data():
    from app.validators import AssessmentValidationError, validate_assessment

    payload = make_payload(github_source_on="q4")
    with pytest.raises(AssessmentValidationError, match="q4 has source 'github'"):
        validate_assessment(payload, "c", "j", "aid", "m", "v", github_supplied=False)
    validate_assessment(payload, "c", "j", "aid", "m", "v", github_supplied=True)


def test_github_source_is_corrected_in_a_second_round(client, llm):
    llm.responses = [
        (json.dumps(make_payload(github_source_on="q12")), "stop"),
        (json.dumps(make_payload()), "stop"),
    ]
    r = client.post("/generate-assessment", json=request_body(include_github=False))
    assert r.status_code == 200
    second_prompt = llm.calls[1][1][1]["content"]
    assert "FAILED VALIDATION" in second_prompt and "q12 has source 'github'" in second_prompt


def test_github_source_in_every_round_is_502(client, llm):
    llm.responses = [(json.dumps(make_payload(github_source_on="q1")), "stop")]
    r = client.post("/generate-assessment", json=request_body())
    assert r.status_code == 502
    assert r.json()["error"] == "llm_invalid_output"
    assert "source 'github'" in r.json()["message"]


def test_github_source_allowed_when_github_data_supplied(client, llm):
    llm.responses = [(json.dumps(make_payload(github_source_on="q1")), "stop")]
    r = client.post("/generate-assessment", json=request_body(
        include_github=True, github_data={"login": "invented-user", "repos": 3}))
    assert r.status_code == 200


def test_github_data_is_truncated_in_the_prompt():
    from app.prompts import GITHUB_DATA_MAX_CHARS, build_generation_prompt

    huge = {"repos": [{"name": f"repo-{i}", "readme": "x" * 500} for i in range(200)]}
    prompt = build_generation_prompt(request_body(include_github=True, github_data=huge))
    context = json.loads(prompt.split("CANDIDATE AND JOB DATA:", 1)[1])
    assert isinstance(context["github_data"], str)
    assert len(context["github_data"]) <= GITHUB_DATA_MAX_CHARS
    assert context["github_data"].endswith("[truncated]")
    assert 'Never use the source "github"' not in prompt


def test_prompt_forbids_github_source_when_absent():
    from app.prompts import build_generation_prompt

    prompt = build_generation_prompt(request_body(include_github=True, github_data=None))
    context = json.loads(prompt.split("CANDIDATE AND JOB DATA:", 1)[1])
    assert context["github_data"] is None
    assert 'Never use the source "github"' in prompt


# ── R-07 verifier notes (fixed in R-08) ─────────────────────────────────────

def test_a_shuffle_self_check_failure_is_502_not_500(client, llm, monkeypatch):
    import app.generator as generator
    from app.validators import AssessmentValidationError

    def broken(*args, **kwargs):
        raise AssessmentValidationError("Option shuffling corrupted answer q1.")

    monkeypatch.setattr(generator, "_shuffle_mcq_options", broken)
    llm.responses = [(json.dumps(make_payload()), "stop")]
    r = client.post("/generate-assessment", json=request_body())
    assert r.status_code == 502
    assert r.json()["error"] == "llm_invalid_output"
    assert "shuffling" in r.json()["message"]


def test_round_two_transport_failure_keeps_the_round_one_reason(client, llm):
    response = httpx.Response(429, request=httpx.Request("POST", "https://example.invalid"))
    llm.responses = [
        (json.dumps(make_payload(github_source_on="q5")), "stop"),
        RateLimitError("Quota exceeded", response=response, body=None),
    ]
    r = client.post("/generate-assessment", json=request_body())
    assert r.status_code == 502
    message = r.json()["message"]
    assert "HTTP 429" in message
    assert "Earlier round failed validation" in message and "q5 has source 'github'" in message


# ── health, prompt version, provider ────────────────────────────────────────

@pytest.mark.parametrize("key, expected", [("", False), (FAKE_KEY, True)])
def test_health_reports_llm_configured_without_the_key(client, monkeypatch, key, expected):
    import app.config as config

    monkeypatch.setattr(config, "GEMINI_API_KEY", key)
    r = client.get("/")
    assert r.status_code == 200
    assert r.json()["llm_configured"] is expected
    assert FAKE_KEY not in r.text


def test_exactly_one_prompt_version_definition():
    hits = [
        (path.name, line)
        for path in (SERVICE_DIR / "app").glob("*.py")
        for line in path.read_text(encoding="utf-8").splitlines()
        if re.match(r"\s*PROMPT_VERSION\s*=", line)
    ]
    assert len(hits) == 1, hits
    assert hits[0][0] == "prompts.py"


def test_no_second_llm_provider_remains():
    for path in [*(SERVICE_DIR / "app").glob("*.py"), SERVICE_DIR / "README.md",
                 SERVICE_DIR / ".env.example"]:
        assert "openrouter" not in path.read_text(encoding="utf-8").lower(), path.name
