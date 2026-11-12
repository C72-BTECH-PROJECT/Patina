"""Unit tests for eval/parsing_metrics.py (card R-20). No service needed.

Run from the repo root:
    nlp-engine\\venv\\Scripts\\python -m pytest tests/eval -q

Every expected value below was computed by hand from the toy set; the
assertions use exact Fractions, not approximate floats.
"""

import sys
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "eval"))

import parsing_metrics as pm  # noqa: E402

ALIASES = {"postgres": "postgresql", "js": "javascript", "k8s": "kubernetes"}
OUT_OF_SCOPE = ["machine learning", "communication"]

# Toy set. Gold uses the guide's cell format; predictions are raw parser output.
TOY = [
    # A: gold {python, django, postgresql, git}
    #    pred {python, django, postgresql(<-postgres), docker}; "machine learning" removed
    #    TP 3 (python, django, postgresql), FP 1 (docker), FN 1 (git)
    ("python; django; postgresql; git", ["Python", "django", "postgres", "docker", "Machine Learning"]),
    # B: gold {java, spring boot, mysql}; pred {java, javascript}
    #    TP 1, FP 1, FN 2
    ("java; spring boot; mysql", ["java", "JavaScript"]),
    # C: unreadable resume: gold {linux, bash}; nothing found. TP 0, FP 0, FN 2
    ("linux; bash", []),
    # D: gold empty; only an out-of-scope term found, which is removed. All zero.
    ("", ["communication"]),
]


def toy_counts():
    out = []
    for gold_cell, pred in TOY:
        gold, _ = pm.skill_set(pm.split_gold_skills(gold_cell), ALIASES)
        predicted, _ = pm.skill_set(pred, ALIASES, OUT_OF_SCOPE)
        out.append(pm.compare_skills(gold, predicted))
    return out


def test_per_resume_counts():
    assert [(c.tp, c.fp, c.fn) for c in toy_counts()] == [(3, 1, 1), (1, 1, 2), (0, 0, 2), (0, 0, 0)]


def test_out_of_scope_removed_from_prediction_only():
    kept, removed = pm.skill_set(["Machine Learning", "python"], ALIASES, OUT_OF_SCOPE)
    assert kept == {"python"} and removed == {"machine learning"}
    gold, _ = pm.skill_set(pm.split_gold_skills("machine learning; python"), ALIASES)
    assert gold == {"machine learning", "python"}


def test_micro_exact():
    # TP 4, FP 2, FN 5 -> P 4/6 = 2/3, R 4/9, F1 = 8/(8+2+5) = 8/15
    # check: 2*(2/3)*(4/9) / (2/3 + 4/9) = (16/27) / (10/9) = 8/15
    m = pm.micro_prf(toy_counts())
    assert m.precision == Fraction(2, 3)
    assert m.recall == Fraction(4, 9)
    assert m.f1 == Fraction(8, 15)


def test_macro_exact():
    # P over resumes with >= 1 prediction (A, B): (3/4 + 1/2) / 2 = 5/8
    # R over resumes with >= 1 gold skill (A, B, C): (3/4 + 1/3 + 0) / 3 = 13/36
    # F1 over resumes with either side non-empty (A, B, C):
    #   A 6/8 = 3/4, B 2/5, C 0 -> (3/4 + 2/5 + 0) / 3 = 23/60
    m = pm.macro_prf(toy_counts())
    assert (m.precision, m.n_precision) == (Fraction(5, 8), 2)
    assert (m.recall, m.n_recall) == (Fraction(13, 36), 3)
    assert (m.f1, m.n_f1) == (Fraction(23, 60), 3)


def test_empty_everything_is_undefined_not_zero():
    m = pm.micro_prf([pm.compare_skills(set(), set())])
    assert m.precision is None and m.recall is None and m.f1 is None


def test_skill_normalisation_keeps_punctuation():
    assert pm.normalise_skill("  .NET ") == ".net"
    assert pm.normalise_skill("C#") == "c#"
    assert pm.normalise_skill("Spring   Boot") == "spring boot"
    assert pm.canonical_skill("K8s", ALIASES) == "kubernetes"


def test_contact_normalisation_and_accuracy():
    assert pm.normalise_url("https://www.GitHub.com/Example-A/") == "github.com/example-a"
    assert pm.normalise_url("linkedin.com/in/x") == "linkedin.com/in/x"
    assert pm.normalise_email(" A@Example.com ") == "a@example.com"
    pairs = [
        ("github.com/example-a", pm.normalise_url("https://github.com/example-a/")),  # match
        ("github.com/example-b", ""),                                                # missed
        ("", "github.com/someone"),                                                   # false value
        ("", ""),                                                                      # both empty
    ]
    r = pm.contact_accuracy(pairs)
    assert (r.n_resumes, r.n_with_field, r.correct_with_field, r.correct_all, r.false_present) == (4, 2, 1, 2, 1)
    assert r.accuracy_all == Fraction(1, 2)
    assert r.accuracy_with_field == Fraction(1, 2)


def test_timing_median_and_max():
    assert pm.timing_summary([0.2, 0.4, 0.3]) == (0.3, 0.4)
    assert pm.timing_summary([1.0, 3.0]) == (2.0, 3.0)
    assert pm.timing_summary([]) == (None, None)


def test_response_classification_before_and_after_optional_jd():
    import run_parsing_eval as r
    # FastAPI default body when `jd` is a required form field (pre-R-05)
    assert r._jd_required({"detail": [{"type": "missing", "loc": ["body", "jd"], "msg": "Field required"}]})
    # the service's own validation body (post-R-05 shape)
    assert r._jd_required({"error": "invalid_request", "fields": ["jd"]})
    assert not r._jd_required({"error": "invalid_request", "fields": ["resume"]})
    assert not r._jd_required({"detail": [{"type": "missing", "loc": ["body", "resume"]}]})
    # 422 unreadable_document, top level or wrapped in `detail`
    assert r._unreadable_reason({"error": "unreadable_document", "reason": "no_text_layer"}) == "no_text_layer"
    assert r._unreadable_reason({"detail": {"error": "unreadable_document", "reason": "empty"}}) == "empty"
    assert r._unreadable_reason({"error": "invalid_request"}) is None


def test_labeller_agreement_exact():
    # r1: A {python, django}, B {python, postgresql}: TP 1, FP 1, FN 1
    # r2: A {linux}, B {linux}: TP 1
    # micro F1 = 2*2 / (4 + 1 + 1) = 2/3; macro F1 = (1/2 + 1) / 2 = 3/4
    a = {"r1.pdf": ["python", "django"], "r2.pdf": ["linux"], "only_a.pdf": ["x"]}
    b = {"r1.pdf": ["Python", "postgres"], "r2.pdf": ["linux"]}
    micro, macro, only_a, only_b = pm.agreement(a, b, ALIASES)
    assert micro.f1 == Fraction(2, 3)
    assert macro.f1 == Fraction(3, 4)
    assert only_a == ["only_a.pdf"] and only_b == []
