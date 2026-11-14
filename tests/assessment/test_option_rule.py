"""R-29 (MUST 3): multiple-choice options that do not give the answer away.

Every generation test uses the fake LLM from test_generation (app.llm_client._complete
is replaced; no network, no key). The eval report's metric functions are checked
offline; its live part is never run here.
"""
import copy
import importlib
import importlib.util
import json
import random
import time

import pytest

from conftest import HERE
from test_generation import llm, make_payload, request_body  # noqa: F401  (llm is a fixture)

REPO = HERE.parents[1]


def opt(n: int, label: str) -> dict:
    """An option of exactly n characters, two words, no punctuation."""
    return {"label": label, "text": "x " + "y" * (n - 2)}


def options(correct_len: int, distractor_lens=(20, 20, 20)) -> list[dict]:
    """Correct option is A."""
    return [opt(correct_len, "A")] + [
        opt(n, label) for n, label in zip(distractor_lens, "BCD")
    ]


def with_long_correct(payload: dict, qids: set[str]) -> dict:
    """Make the correct option (B) of each named MCQ far longer than its distractors."""
    payload = copy.deepcopy(payload)
    for question in payload["questions"]:
        if question["question_id"] in qids:
            n = int(question["question_id"][1:])
            question["options"][1]["text"] = (
                f"OPT-{n:02d}-B because it is the fully qualified and detailed answer"
            )
    return payload


def tell(opts, correct="A", ratio=1.25, gap=10):
    from app.validators import mcq_option_tell

    return mcq_option_tell(opts, correct, max_length_ratio=ratio, min_length_gap=gap)


def texts(correct: str, *distractors: str) -> list[dict]:
    """Correct option is A, the distractors B-D."""
    return [{"label": "A", "text": correct}] + [
        {"label": label, "text": text} for label, text in zip("BCD", distractors)
    ]


# ── the rule: ratio AND character gap ───────────────────────────────────────

def test_a_real_tell_26_characters_against_16_is_rejected():
    reason = tell(options(26, (16, 16, 16)))      # 1.62x and 10 characters longer
    assert reason is not None
    assert "1.62x and 10.0 characters longer" in reason


def test_rejected_only_when_both_the_ratio_and_the_gap_are_exceeded():
    # distractor mean 20: 30 is 1.5x and +10 -> rejected; 29 is 1.45x but +9 -> kept
    assert tell(options(30)) is not None
    assert tell(options(29)) is None
    # distractor mean 40: 50 is +10 but exactly 1.25x -> kept; 51 is 1.275x and +11 -> rejected
    assert tell(options(50, (40, 40, 40))) is None
    assert tell(options(51, (40, 40, 40))) is not None
    assert tell(options(20)) is None
    assert tell(options(24, (10, 20, 30))) is None  # mean 20 -> 1.2x


def test_only_the_correct_option_is_judged_not_a_long_distractor():
    assert tell(options(20, (60, 20, 20))) is None


@pytest.mark.parametrize("correct, distractors", [
    ("PATCH", ("POST", "PUT", "GET")),                                # live false rejection
    ("ls -la", ("cd", "pwd", "rm")),
    ("O(n log n)", ("O(n)", "O(1)", "O(n^2)")),
    ("HEALTHCHECK", ("EXPOSE", "VOLUME", "ENTRYPOINT")),
    ("Repeatable read", ("Read uncommitted", "Read committed", "Serializable")),
    ("Repeatable read", ("Serializable", "Snapshot", "Read committed")),  # 1.32x, +3.7
])
def test_short_options_a_few_characters_longer_are_not_rejected(correct, distractors):
    assert tell(texts(correct, *distractors)) is None


@pytest.mark.parametrize("correct, distractors", [
    ("Serializable", ("Read uncommitted", "Read committed", "Repeatable read")),
    ("3", ("two", "four", "five")),
    ("x == y", ("x is y", "x equals y", "x matches y")),
    ("Use an index.", ("Use a cursor", "Use a trigger", "Use a view")),
])
def test_form_is_not_judged_only_length(correct, distractors):
    # The form rule (punctuation, bare number, code-like, single word) was withdrawn.
    assert tell(texts(correct, *distractors)) is None


def test_threshold_is_configurable(monkeypatch):
    import app.config as config

    assert config.MCQ_MAX_LENGTH_RATIO == 1.25
    assert tell(options(30), ratio=1.6) is None
    for value, ok in (("1.6", True), ("0.9", False)):
        monkeypatch.setenv("ASSESSMENT_MCQ_MAX_LENGTH_RATIO", value)
        try:
            if ok:
                importlib.reload(config)
                assert config.MCQ_MAX_LENGTH_RATIO == 1.6
            else:
                with pytest.raises(ValueError):
                    importlib.reload(config)
        finally:
            monkeypatch.delenv("ASSESSMENT_MCQ_MAX_LENGTH_RATIO")
            importlib.reload(config)
    assert config.MCQ_MAX_LENGTH_RATIO == 1.25


def test_min_length_gap_is_configurable(monkeypatch):
    import app.config as config

    assert config.MCQ_MIN_LENGTH_GAP == 10
    assert tell(options(29), gap=5) is not None   # 1.45x and +9
    assert tell(options(30), gap=11) is None      # 1.5x but only +10
    for value, ok in (("4", True), ("-1", False)):
        monkeypatch.setenv("ASSESSMENT_MCQ_MIN_LENGTH_GAP", value)
        try:
            if ok:
                importlib.reload(config)
                assert config.MCQ_MIN_LENGTH_GAP == 4
            else:
                with pytest.raises(ValueError):
                    importlib.reload(config)
        finally:
            monkeypatch.delenv("ASSESSMENT_MCQ_MIN_LENGTH_GAP")
            importlib.reload(config)
    assert config.MCQ_MIN_LENGTH_GAP == 10


# ── generation with the fake LLM ────────────────────────────────────────────

def _served_mcqs(questions, answers):
    for q, a in zip(questions, answers):
        if q["question_type"] == "mcq":
            yield q, a


def test_batch_with_long_correct_options_is_rejected_and_regenerated(client, llm):
    bad = with_long_correct(make_payload(), {f"q{i}" for i in range(1, 6)})  # 5 valid < 6
    llm.responses = [(json.dumps(bad), "stop"), (json.dumps(make_payload()), "stop")]
    r = client.post("/generate-assessment", json=request_body())
    assert r.status_code == 200, r.text
    assert len(llm.calls) == 2

    second_prompt = llm.calls[1][1][1]["content"]
    assert "FAILED VALIDATION" in second_prompt
    assert "Only 5 of 10 multiple-choice questions passed the option rule" in second_prompt
    for i in range(1, 6):
        assert f"q{i}: the correct option is" in second_prompt

    body = r.json()
    for q, a in _served_mcqs(body["questions"]["questions"], body["answer_key"]["answers"]):
        assert tell(q["options"], a["correct_option"]) is None
    assert "fully qualified" not in r.text   # nor the round log
    assert "round_log" not in r.text


def test_round_log_records_rejections_from_every_round_also_on_failure(llm):
    from app.generator import generate_pool
    from app.llm_client import AssessmentLLMError

    five_bad = json.dumps(with_long_correct(make_payload(), {f"q{i}" for i in range(1, 6)}))
    two_bad = json.dumps(with_long_correct(make_payload(), {"q1", "q2"}))
    wrong_count = json.dumps({"questions": [], "answers": []})   # fails the schema
    llm.responses = [(wrong_count, "stop"), (five_bad, "stop"), (two_bad, "stop")]
    log = []
    pool = generate_pool(request_body(), round_log=log)
    assert [e["outcome"] for e in log] == ["schema_invalid", "option_rule_failed", "accepted"]
    assert [len(e["rejected"]) for e in log] == [0, 5, 2]
    first = log[1]["rejected"][0]
    assert first["question_id"] == "q1" and first["correct_option"] == "B"
    assert "fully qualified" in first["options"][1]["text"]
    assert "characters longer" in first["reason"]
    assert pool.round_log is log and pool.rounds == 3
    assert set(pool.rejected) == {"q1", "q2"}   # served pool: accepted round only
    assert len(pool.questions_json["questions"]) == 18

    llm.calls.clear()
    llm.responses = [(five_bad, "stop")]
    log = []
    with pytest.raises(AssessmentLLMError) as failure:
        generate_pool(request_body(), round_log=log)
    assert failure.value.code == "llm_invalid_output"
    assert [len(e["rejected"]) for e in log] == [5, 5, 5]


def test_rejected_mcqs_are_dropped_and_never_served_when_6_remain(llm):
    from app.generator import generate_assessment

    bad = with_long_correct(make_payload(), {f"q{i}" for i in range(1, 5)})  # 6 valid
    llm.responses = [(json.dumps(bad), "stop")]
    for seed in range(5):
        questions, answers = generate_assessment(request_body(), rng=random.Random(seed))
        stems = sorted(
            q["question"][9:11] for q, _ in _served_mcqs(questions["questions"], answers["answers"])
        )
        assert stems == ["05", "06", "07", "08", "09", "10"]
    assert len(llm.calls) == 5  # one round each: no regeneration needed


def test_a_pool_that_never_has_6_valid_mcqs_fails_and_is_never_served_short(client, llm):
    import app.config as config

    bad = with_long_correct(make_payload(), {f"q{i}" for i in range(1, 6)})
    llm.responses = [(json.dumps(bad), "stop")]
    r = client.post("/generate-assessment", json=request_body())
    assert r.status_code == 502
    assert r.json()["error"] == "llm_invalid_output"
    assert "option rule" in r.json()["message"]
    assert "questions" not in r.json()
    assert len(llm.calls) == config.MAX_VALIDATION_ROUNDS == 3


def test_regeneration_stays_inside_the_time_budget(client, llm, monkeypatch):
    import app.config as config

    monkeypatch.setattr(config, "GENERATION_BUDGET_SECONDS", 0.5)
    monkeypatch.setattr(config, "MIN_CALL_SECONDS", 0.3)
    bad = json.dumps(with_long_correct(make_payload(), {f"q{i}" for i in range(1, 6)}))
    llm.responses = [lambda model: time.sleep(0.3) or (bad, "stop")]
    r = client.post("/generate-assessment", json=request_body())
    assert r.status_code == 502
    assert "no time left in the budget" in r.json()["message"]
    assert len(llm.calls) == 1


# ── the option shuffle ──────────────────────────────────────────────────────

def test_correct_option_position_is_uniform_over_2000_seeded_shuffles():
    from app.generator import _shuffle_mcq_options

    question = {
        "question_id": "q1", "question_type": "mcq", "question": "?",
        "options": [{"label": label, "text": f"text-{label}"} for label in "ABCD"],
    }
    answer = {"question_id": "q1", "correct_option": "A", "explanation": "e"}
    rng = random.Random(2029)
    counts = dict.fromkeys("ABCD", 0)
    for _ in range(2000):
        q = {"questions": [copy.deepcopy(question)]}
        a = {"answers": [copy.deepcopy(answer)]}
        _shuffle_mcq_options(q, a, rng)
        label = a["answers"][0]["correct_option"]
        assert next(o["text"] for o in q["questions"][0]["options"] if o["label"] == label) == "text-A"
        counts[label] += 1
    shares = {label: n / 2000 for label, n in counts.items()}
    assert all(0.22 <= share <= 0.28 for share in shares.values()), shares


# ── the prompt ──────────────────────────────────────────────────────────────

def test_prompt_asks_for_options_of_similar_length_and_form(monkeypatch):
    import app.config as config
    from app.prompts import PROMPT_VERSION, build_generation_prompt

    assert PROMPT_VERSION == "assessment-v3"
    prompt = build_generation_prompt(request_body())
    assert "All four options must be of similar length" in prompt
    assert "more than 1.25 times the average length" in prompt
    assert "same grammatical form" in prompt
    assert "plausible" in prompt
    monkeypatch.setattr(config, "MCQ_MAX_LENGTH_RATIO", 1.5)
    assert "more than 1.5 times" in build_generation_prompt(request_body())


# ── the eval report's metrics (offline) ─────────────────────────────────────

def _load_report():
    spec = importlib.util.spec_from_file_location(
        "mcq_option_report", REPO / "eval" / "mcq_option_report.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_report_metrics_count_longest_and_positions():
    report = _load_report()
    mcqs = [
        (options(40), "A"),            # strictly longest
        (options(20), "A"),            # tied longest
        (options(10), "A"),            # not longest
        (options(20, (10, 10, 30)), "A"),
    ]
    stats = report.longest_option_stats(mcqs)
    assert stats["n"] == 4
    assert stats["correct_strictly_longest"] == 1
    assert stats["correct_tied_longest"] == 1
    assert stats["share_strictly_longest"] == 0.25
    assert report.position_spread(["A", "B", "B", "D"]) == {
        "A": 0.25, "B": 0.5, "C": 0.0, "D": 0.25,
    }


def test_report_input_matches_the_service_schema():
    from app.schemas import AssessmentInput

    AssessmentInput.model_validate(_load_report().SYNTHETIC_INPUT)


def test_report_records_a_failed_pool_and_keeps_the_others(llm):
    """The live path, driven by the fake LLM: pool 2 fails, pools 1 and 3 are kept."""
    report = _load_report()
    good = json.dumps(make_payload())
    five_bad = json.dumps(with_long_correct(make_payload(), {f"q{i}" for i in range(1, 6)}))
    script = [five_bad, good, five_bad, five_bad, five_bad, good]  # pool 1: 2 rounds; 2: 3; 3: 1
    llm.responses = [lambda model: (script[len(llm.calls) - 1], "stop")]

    runs, saved = report.run_live(3, rng=random.Random(7))
    assert [r["failed"] for r in runs] == [None, "llm_invalid_output", None]
    assert [r["rounds"] for r in runs] == [2, 3, 1]
    assert [r["rejected_all_rounds"] for r in runs] == [5, 15, 0]
    assert [len(r["served_mcqs"]) for r in runs] == [6, 0, 6]
    assert [s["outcome"] for s in saved] == ["ok", "failed", "ok"]
    dumped = json.dumps(saved)
    for marker in ("eval-r29", "Invented Candidate", "assessment_id", "candidate_id", "job_id"):
        assert marker not in dumped

    section = report.render(runs, ratio_limit=1.25, gap_limit=10)
    assert "3 pools, 1 failed" in section
    assert "| 2 | - | failed (llm_invalid_output) | 3 |" in section
    assert "Served MCQs: 12;" in section
