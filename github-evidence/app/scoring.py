"""The GitHub sub-score (T-0012): a documented, deterministic, graded formula. Never a pass/fail gate.

Four components, each in [0, 1]:
  activity      = min(1, ln(1 + authored_commits) / ln(1 + 200))
  consistency   = min(1, active_weeks / 26)
  ownership     = min(1, owned_repos_with_authored_commits / 5)
  corroboration = evidenced / (evidenced + not_found) over the checkable claims

Default weights 0.25 / 0.25 / 0.20 / 0.30 and the saturation points (200 commits, 26 weeks, 5 repos) are
PROVISIONAL starting values (owner, 2026-10-15). P3-12 calibrates them against human ratings.
The weights are renormalised over the components that are available. A component with no data is
unavailable (value null, weight 0), never 0 (GF-4).
"""
import json
import math
from dataclasses import dataclass
from typing import Mapping, Optional

from .config import get_logger

log = get_logger()

DEFAULT_WEIGHTS = {"activity": 0.25, "consistency": 0.25, "ownership": 0.20, "corroboration": 0.30}
KEYS = tuple(DEFAULT_WEIGHTS)
ACTIVITY_SATURATION_COMMITS = 200
CONSISTENCY_SATURATION_WEEKS = 26
OWNERSHIP_SATURATION_REPOS = 5


@dataclass(frozen=True)
class Weights:
    values: Mapping[str, float]
    source: str  # "env" when GITHUB_SUBSCORE_WEIGHTS changed at least one weight, else "default"


def _usable(value) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def load_weights(raw: Optional[str]) -> Weights:
    """Same fallback rules as CREDIBILITY_WEIGHTS (backend/Services/explainability.js readBaseWeights).

    Unknown keys and negative, non-numeric or non-finite values are ignored. A total <= 0 or invalid
    JSON falls back to the defaults, with a warning for invalid JSON.
    """
    default = Weights(dict(DEFAULT_WEIGHTS), "default")
    if raw is None or not raw.strip():
        return default
    try:
        parsed = json.loads(raw)
    except ValueError:
        log.warning("GITHUB_SUBSCORE_WEIGHTS is not valid JSON; using default weights.")
        return default
    if not isinstance(parsed, dict):
        log.warning("GITHUB_SUBSCORE_WEIGHTS is not a JSON object; using default weights.")
        return default
    merged = dict(DEFAULT_WEIGHTS)
    applied = 0
    for key in KEYS:
        if key in parsed and _usable(parsed[key]):
            merged[key] = float(parsed[key])
            applied += 1
    if applied == 0 or sum(merged.values()) <= 0:
        return default
    return Weights(merged, "env")


def activity(authored_commits: int) -> float:
    return min(1.0, math.log1p(authored_commits) / math.log1p(ACTIVITY_SATURATION_COMMITS))


def consistency(active_weeks: int) -> float:
    return min(1.0, active_weeks / CONSISTENCY_SATURATION_WEEKS)


def ownership(owned_with_commits: int) -> float:
    return min(1.0, owned_with_commits / OWNERSHIP_SATURATION_REPOS)


def corroboration(evidenced: int, not_found: int) -> Optional[float]:
    checkable = evidenced + not_found
    return evidenced / checkable if checkable else None


def compute_subscore(*, owned_nonfork: int, authored_commits: Optional[int], active_weeks: Optional[int],
                     owned_with_commits: Optional[int], evidenced: int, not_found: int,
                     weights: Weights, partial: bool = False) -> dict:
    """The `sub_score` object of contract v1. `None` commit data means it could not be fetched."""
    base = {"weights_source": weights.source, "partial": partial}
    if owned_nonfork <= 0:
        return {"available": False, "value": None, "reason_code": "no_public_repositories",
                "components": [], **base}

    have_commits = authored_commits is not None and active_weeks is not None and owned_with_commits is not None
    raw = {
        "activity": (activity(authored_commits) if have_commits else None, "no_commit_data"),
        "consistency": (consistency(active_weeks) if have_commits else None, "no_commit_data"),
        "ownership": (ownership(owned_with_commits) if have_commits else None, "no_commit_data"),
        "corroboration": (corroboration(evidenced, not_found), "no_checkable_claims"),
    }
    total = sum(weights.values[k] for k, (value, _) in raw.items() if value is not None)
    components = [{
        "key": key,
        "value": value,
        "weight": weights.values[key] / total if value is not None and total > 0 else 0,
        "available": value is not None,
        "reason": None if value is not None else reason,
    } for key, (value, reason) in raw.items()]
    if total <= 0:  # nothing available, or every available component has weight 0
        return {"available": False, "value": None, "reason_code": "insufficient_evidence",
                "components": components, **base}
    score = sum(c["value"] * c["weight"] for c in components if c["available"])
    return {"available": True, "value": score, "reason_code": None, "components": components, **base}
