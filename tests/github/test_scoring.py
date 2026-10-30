"""The GitHub sub-score formula and GITHUB_SUBSCORE_WEIGHTS (T-0012, criteria 5-7).

The formula is provisional (owner, 2026-10-15): P3-12 calibrates it against human ratings.
"""
import logging
import math

import pytest

from conftest import mount_account

DEFAULTS = {"activity": 0.25, "consistency": 0.25, "ownership": 0.20, "corroboration": 0.30}
FIXED = dict(owned_nonfork=4, authored_commits=50, active_weeks=13, owned_with_commits=3, evidenced=3, not_found=1)


def subscore(raw=None, **over):
    from app import scoring

    args = {**FIXED, **over}
    return scoring.compute_subscore(weights=scoring.load_weights(raw), **args)


def by_key(sub):
    return {c["key"]: c for c in sub["components"]}


# ---- criterion 5

def test_subscore_formula():
    sub = subscore()
    parts = {
        "activity": math.log(51) / math.log(201),
        "consistency": 13 / 26,
        "ownership": 3 / 5,
        "corroboration": 3 / 4,
    }
    comps = by_key(sub)
    assert [c["key"] for c in sub["components"]] == ["activity", "consistency", "ownership", "corroboration"]
    for key, value in parts.items():
        assert comps[key]["value"] == pytest.approx(value, abs=1e-9), key
        assert comps[key]["weight"] == pytest.approx(DEFAULTS[key], abs=1e-9), key
        assert comps[key]["available"] is True, key
    expected = sum(DEFAULTS[k] * v for k, v in parts.items())
    assert sub["available"] is True and sub["reason_code"] is None
    assert sub["value"] == pytest.approx(expected, abs=1e-9)
    assert sub["weights_source"] == "default" and sub["partial"] is False


def test_saturation_points():
    sub = subscore(authored_commits=10_000, active_weeks=52, owned_with_commits=9)
    comps = by_key(sub)
    assert [comps[k]["value"] for k in ("activity", "consistency", "ownership")] == [1.0, 1.0, 1.0]
    assert subscore(authored_commits=200)["components"][0]["value"] == pytest.approx(1.0, abs=1e-9)
    assert subscore(authored_commits=0, active_weeks=0, owned_with_commits=0)["components"][0]["value"] == 0.0
    assert subscore(active_weeks=26)["components"][1]["value"] == pytest.approx(1.0, abs=1e-9)
    assert subscore(owned_with_commits=5)["components"][2]["value"] == pytest.approx(1.0, abs=1e-9)


def test_zero_is_a_value_but_missing_data_is_not():
    """An inactive account scores low; missing commit data is unavailable, never 0 (GF-4)."""
    inactive = subscore(authored_commits=0, active_weeks=0, owned_with_commits=0)
    assert inactive["available"] is True
    assert by_key(inactive)["activity"]["value"] == 0.0 and by_key(inactive)["activity"]["available"] is True

    unknown = subscore(authored_commits=None, active_weeks=None, owned_with_commits=None)
    for key in ("activity", "consistency", "ownership"):
        c = by_key(unknown)[key]
        assert (c["available"], c["value"], c["weight"], c["reason"]) == (False, None, 0, "no_commit_data")


# ---- criterion 6

def test_subscore_formula_without_corroboration():
    sub = subscore(evidenced=0, not_found=0)
    comps = by_key(sub)
    corro = comps["corroboration"]
    assert (corro["available"], corro["value"], corro["weight"]) == (False, None, 0)
    assert corro["reason"] == "no_checkable_claims"
    assert sum(c["weight"] for c in sub["components"]) == pytest.approx(1.0, abs=1e-9)
    for key in ("activity", "consistency"):
        assert comps[key]["weight"] == pytest.approx(0.25 / 0.70, abs=1e-9)
    assert comps["ownership"]["weight"] == pytest.approx(0.20 / 0.70, abs=1e-9)
    a, c, o = math.log(51) / math.log(201), 13 / 26, 3 / 5
    assert sub["value"] == pytest.approx((0.25 * a + 0.25 * c + 0.20 * o) / 0.70, abs=1e-9)


def test_nothing_available_is_not_a_zero():
    sub = subscore(authored_commits=None, active_weeks=None, owned_with_commits=None, evidenced=0, not_found=0)
    assert (sub["available"], sub["value"], sub["reason_code"]) == (False, None, "insufficient_evidence")


def test_no_owned_repository_is_no_evidence():
    sub = subscore(owned_nonfork=0, authored_commits=0, active_weeks=0, owned_with_commits=0)
    assert (sub["available"], sub["value"], sub["reason_code"]) == (False, None, "no_public_repositories")


def test_partial_flag_is_carried():
    assert subscore(partial=True)["partial"] is True


# ---- criterion 7

def test_subscore_weights_env(caplog):
    from app import scoring

    valid = '{"activity": 1, "consistency": 0, "ownership": 0, "corroboration": 1}'
    w = scoring.load_weights(valid)
    assert w.source == "env" and w.values == {"activity": 1.0, "consistency": 0.0, "ownership": 0.0, "corroboration": 1.0}
    sub = subscore(valid)
    assert sub["weights_source"] == "env"
    assert by_key(sub)["activity"]["weight"] == pytest.approx(0.5, abs=1e-9)
    assert by_key(sub)["consistency"]["weight"] == 0
    assert sub["value"] == pytest.approx(0.5 * math.log(51) / math.log(201) + 0.5 * 0.75, abs=1e-9)

    # a partial override merges over the defaults; unknown keys are ignored
    merged = scoring.load_weights('{"corroboration": 0.6, "nonsense": 9}')
    assert merged.source == "env" and merged.values == {**DEFAULTS, "corroboration": 0.6}

    caplog.set_level(logging.WARNING)
    for raw in ("not json", '{"activity": -1}', '{"activity": 0, "consistency": 0, "ownership": 0, "corroboration": 0}',
                '{"activity": NaN}', '{"activity": "abc"}', "[1, 2]", '{"nothing": 1}'):
        w = scoring.load_weights(raw)
        assert w.source == "default" and w.values == DEFAULTS, raw
        assert subscore(raw)["weights_source"] == "default", raw
    assert any("GITHUB_SUBSCORE_WEIGHTS" in r.getMessage() for r in caplog.records), "invalid JSON must warn"
    # a negative value is ignored while the other valid keys still apply
    mixed = scoring.load_weights('{"activity": -1, "consistency": 0.5}')
    assert mixed.source == "env" and mixed.values == {**DEFAULTS, "consistency": 0.5}
    assert scoring.load_weights(None).source == "default" and scoring.load_weights("").source == "default"


def test_weights_env_reaches_the_response(make_client, gh):
    mount_account(gh, "synthetic/active")
    payload = {"username": "synth-active", "claimed_skills": ["python"]}
    default = make_client(account="synthetic/active").post("/v1/evidence", json=payload).json()["sub_score"]
    assert default["weights_source"] == "default"
    env = make_client(account="synthetic/active", GITHUB_SUBSCORE_WEIGHTS='{"corroboration": 0}') \
        .post("/v1/evidence", json=payload).json()["sub_score"]
    assert env["weights_source"] == "env"
    assert {c["key"]: c["weight"] for c in env["components"]}["corroboration"] == 0
    assert env["value"] != default["value"]
    for raw in ("not json", '{"activity": -1}', '{"activity":0,"consistency":0,"ownership":0,"corroboration":0}'):
        sub = make_client(account="synthetic/active", GITHUB_SUBSCORE_WEIGHTS=raw) \
            .post("/v1/evidence", json=payload).json()["sub_score"]
        assert sub["weights_source"] == "default", raw
        assert sub["value"] == pytest.approx(default["value"], abs=1e-12), raw
