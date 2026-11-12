"""Pure metric code for the parsing evaluation (card R-20, DECISIONS 4.3).

No file or network I/O lives here, so every function can be unit-tested
without the NLP service (see tests/eval/test_metrics.py). All ratios are
exact `fractions.Fraction` values; callers round only for display.

Comparison rules follow eval/LABELLING_GUIDE.md section 6:
- a skill in both gold and prediction is a correct find (TP), a skill only in
  the prediction is a false find (FP), a skill only in gold is a miss (FN);
- one alias table maps spelling variants to one canonical name, applied to
  both sides;
- out-of-scope terms (guide 3.1 "do not label") are removed from the
  parser's output only, so they count neither for nor against it;
- contact fields are compared exactly after the minimal normalisation
  documented in `normalise_email` and `normalise_url`.
"""

from __future__ import annotations

import re
import statistics
from dataclasses import dataclass, field
from fractions import Fraction
from typing import Iterable, Mapping

# ---------------------------------------------------------------------------
# Skill normalisation
# ---------------------------------------------------------------------------


def normalise_skill(raw: object) -> str | None:
    """Lower-case, trim, collapse inner whitespace. Nothing else.

    Punctuation is kept on purpose: `.net`, `c#`, `c++`, `tcp/ip`, `node.js`
    must survive. Returns None for an empty value.
    """
    if raw is None:
        return None
    s = " ".join(str(raw).split()).lower()
    return s or None


def canonical_skill(raw: object, aliases: Mapping[str, str]) -> str | None:
    """normalise_skill, then map through the alias table (one hop)."""
    s = normalise_skill(raw)
    if s is None:
        return None
    return aliases.get(s, s)


def skill_set(
    raw_skills: Iterable[object],
    aliases: Mapping[str, str],
    out_of_scope: Iterable[str] | None = None,
) -> tuple[set[str], set[str]]:
    """Canonical skill set plus the set of terms removed as out of scope.

    A term is out of scope if its normalised form or its canonical form is on
    the list. Pass `out_of_scope=None` for the gold side (never filtered).
    """
    oos = {normalise_skill(t) for t in (out_of_scope or [])} - {None}
    kept: set[str] = set()
    removed: set[str] = set()
    for raw in raw_skills:
        norm = normalise_skill(raw)
        if norm is None:
            continue
        canon = aliases.get(norm, norm)
        if norm in oos or canon in oos:
            removed.add(canon)
            continue
        kept.add(canon)
    return kept, removed


def split_gold_skills(cell: str | None) -> list[str]:
    """Split the guide's `skills` cell: semicolon-separated, blanks ignored."""
    if not cell:
        return []
    return [part.strip() for part in cell.split(";") if part.strip()]


# ---------------------------------------------------------------------------
# Skill metrics
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SkillCounts:
    tp: int
    fp: int
    fn: int
    true_found: frozenset = field(default_factory=frozenset)
    false_found: frozenset = field(default_factory=frozenset)
    missed: frozenset = field(default_factory=frozenset)


def compare_skills(gold: set[str], predicted: set[str]) -> SkillCounts:
    tp = gold & predicted
    fp = predicted - gold
    fn = gold - predicted
    return SkillCounts(len(tp), len(fp), len(fn), frozenset(tp), frozenset(fp), frozenset(fn))


def _ratio(num: int, den: int) -> Fraction | None:
    return None if den == 0 else Fraction(num, den)


def f1_from_counts(tp: int, fp: int, fn: int) -> Fraction | None:
    """F1 = 2TP / (2TP + FP + FN). Equals the harmonic mean of P and R when
    both are defined, is 0 when TP = 0 and something was found or missed, and
    is undefined (None) only when gold and prediction are both empty."""
    return _ratio(2 * tp, 2 * tp + fp + fn)


@dataclass(frozen=True)
class PRF:
    precision: Fraction | None
    recall: Fraction | None
    f1: Fraction | None
    n_precision: int = 0  # resumes averaged for precision (macro only)
    n_recall: int = 0
    n_f1: int = 0


def micro_prf(counts: Iterable[SkillCounts]) -> PRF:
    counts = list(counts)
    tp = sum(c.tp for c in counts)
    fp = sum(c.fp for c in counts)
    fn = sum(c.fn for c in counts)
    n = len(counts)
    return PRF(_ratio(tp, tp + fp), _ratio(tp, tp + fn), f1_from_counts(tp, fp, fn), n, n, n)


def _mean(values: list[Fraction]) -> Fraction | None:
    return None if not values else sum(values, Fraction(0)) / len(values)


def macro_prf(counts: Iterable[SkillCounts]) -> PRF:
    """Per-resume average.

    - precision is averaged over resumes where the parser kept >= 1 skill
      (precision of an empty output is undefined, not 0);
    - recall over resumes whose gold has >= 1 skill;
    - F1 over resumes where gold or prediction is non-empty, using
      2TP/(2TP+FP+FN) per resume, so a resume with gold skills and an empty
      output (e.g. unreadable) contributes F1 = 0.
    The number of resumes behind each average is returned with it.
    """
    counts = list(counts)
    ps = [Fraction(c.tp, c.tp + c.fp) for c in counts if c.tp + c.fp > 0]
    rs = [Fraction(c.tp, c.tp + c.fn) for c in counts if c.tp + c.fn > 0]
    fs = [f1_from_counts(c.tp, c.fp, c.fn) for c in counts if c.tp + c.fp + c.fn > 0]
    return PRF(_mean(ps), _mean(rs), _mean(fs), len(ps), len(rs), len(fs))


# ---------------------------------------------------------------------------
# Contact fields
# ---------------------------------------------------------------------------

_SCHEME_RE = re.compile(r"^[a-z][a-z0-9+.-]*://")


def normalise_email(raw: object) -> str:
    """Trim and lower-case. Empty string means 'not present'."""
    if raw is None:
        return ""
    return str(raw).strip().lower()


def normalise_url(raw: object) -> str:
    """Minimal URL normalisation for GitHub / LinkedIn profile links:
    trim, lower-case (both sites treat handles case-insensitively), drop a
    leading scheme (`http://`, `https://`), drop a leading `www.`, drop
    trailing slashes. Nothing else: no query stripping, no path rewriting.
    Empty string means 'not present'."""
    if raw is None:
        return ""
    s = str(raw).strip().lower()
    s = _SCHEME_RE.sub("", s)
    if s.startswith("www."):
        s = s[4:]
    return s.rstrip("/")


@dataclass(frozen=True)
class ContactResult:
    n_resumes: int          # all resumes compared
    n_with_field: int       # resumes whose gold has the field
    correct_with_field: int  # of those, how many the parser got exactly
    correct_all: int        # over all resumes; empty gold + empty output counts as correct
    false_present: int      # gold empty but the parser returned a value

    @property
    def accuracy_all(self) -> Fraction | None:
        return _ratio(self.correct_all, self.n_resumes)

    @property
    def accuracy_with_field(self) -> Fraction | None:
        return _ratio(self.correct_with_field, self.n_with_field)


def contact_accuracy(pairs: Iterable[tuple[str, str]]) -> ContactResult:
    """`pairs` are (gold, predicted) values that are already normalised."""
    n = with_field = correct_with = correct_all = false_present = 0
    for gold, pred in pairs:
        n += 1
        same = gold == pred
        if same:
            correct_all += 1
        if gold:
            with_field += 1
            if same:
                correct_with += 1
        elif pred:
            false_present += 1
    return ContactResult(n, with_field, correct_with, correct_all, false_present)


# ---------------------------------------------------------------------------
# Timing and agreement
# ---------------------------------------------------------------------------


def timing_summary(seconds: Iterable[float]) -> tuple[float | None, float | None]:
    values = list(seconds)
    if not values:
        return None, None
    return statistics.median(values), max(values)


def agreement(
    a: Mapping[str, Iterable[str]],
    b: Mapping[str, Iterable[str]],
    aliases: Mapping[str, str],
) -> tuple[PRF, PRF, list[str], list[str]]:
    """Skill-level agreement between two labellers on the resumes both
    labelled. Labeller A is treated as reference; F1 is symmetric, so the
    choice does not change it. Aliases apply to both; no out-of-scope
    filtering (both sides are human labels). Returns (micro, macro,
    only_in_a, only_in_b) where the lists name resumes present in one file
    only."""
    shared = sorted(set(a) & set(b))
    counts = []
    for key in shared:
        sa, _ = skill_set(a[key], aliases)
        sb, _ = skill_set(b[key], aliases)
        counts.append(compare_skills(sa, sb))
    return micro_prf(counts), macro_prf(counts), sorted(set(a) - set(b)), sorted(set(b) - set(a))
