"""Repository, language and commit-activity metrics (T-0012). Pure functions: no I/O, no clock.

Definitions (README, "Metrics"):
- owned = not a fork. Archived owned repos are the candidate's work and count.
- detail repos = the `cap` most recently pushed owned repos; only they get /languages and /commits.
- weekly = the last 52 weeks ending at `now`; bucket 51 is the most recent. A commit inside the window
  but older than 52 weeks counts in `authored_commits` only.
"""
from datetime import datetime, timedelta, timezone
from typing import Iterable, Mapping, Optional, Sequence

WEEKS = 52
DEFAULT_WINDOW_DAYS = 365
_EPOCH_MIN = datetime.min.replace(tzinfo=timezone.utc)


def parse_ts(value) -> Optional[datetime]:
    """An ISO 8601 UTC timestamp as GitHub writes it, or None if it is not one."""
    if not isinstance(value, str):
        return None
    try:
        moment = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    return moment if moment.tzinfo is not None else moment.replace(tzinfo=timezone.utc)


def fmt_ts(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def is_owned(repo: Mapping) -> bool:
    return not repo.get("fork")


def select_detail_repos(repos: Sequence[Mapping], cap: int) -> list:
    """Owned repos (archived included), most recently pushed first, at most `cap`. Stable for equal dates."""
    owned = [r for r in repos if is_owned(r)]
    owned.sort(key=lambda r: parse_ts(r.get("pushed_at")) or _EPOCH_MIN, reverse=True)
    return owned[:max(0, cap)]


def language_breakdown(languages_by_repo: Iterable[Mapping]) -> list:
    """Bytes summed per language over the repos given; `share` sums to 1. Biggest first, ties by name."""
    totals: dict = {}
    for languages in languages_by_repo:
        for name, count in languages.items():
            if isinstance(name, str) and type(count) is int and count > 0:
                totals[name] = totals.get(name, 0) + count
    grand = sum(totals.values())
    ordered = sorted(totals.items(), key=lambda kv: (-kv[1], kv[0]))
    return [{"name": n, "bytes": b, "share": round(b / grand, 6)} for n, b in ordered]


def commits_in_window(commit_times: Iterable[datetime], now: datetime, window_days: int) -> list:
    """The commit times inside [now - window_days, now]. GitHub filters with `since`; this is the second check."""
    since = now - timedelta(days=window_days)
    return [t for t in commit_times if since <= t <= now]


def weekly_buckets(commit_times: Iterable[datetime], now: datetime) -> list:
    """52 integers, oldest first. Bucket i covers [now - 7*(52-i) days, now - 7*(51-i) days)."""
    weekly = [0] * WEEKS
    week = timedelta(days=7)
    for t in commit_times:
        index = WEEKS - 1 - int((now - t) // week)
        if 0 <= index < WEEKS:
            weekly[index] += 1
    return weekly
