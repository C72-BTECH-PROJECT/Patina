"""Cross-check the languages a resume claims against the candidate's own repositories (T-0012).

Statuses (owner decision Q1, 2026-10-15):
- `evidenced`: any owned, non-fork repo uses the claimed language, at any age. The sources are the repo
  list's primary `language` (every owned repo, archived or not, even beyond the detail cap) and the
  `/languages` keys of the detail repos.
- `not_found`: a checkable language that no owned, non-fork repo uses. Never "too old".
- `not_checkable`: frameworks and tools that language statistics cannot show. Never counted against the candidate.

`last_activity` is the latest `pushed_at` among the repos using the language. It is reported only: it never
changes the status or the corroboration component.
"""
from typing import Mapping, Optional, Sequence

from .metrics import parse_ts
from .skill_languages import language_for, normalise


def _share(breakdown: Sequence[Mapping], language: str) -> Optional[float]:
    key = normalise(language)
    return next((item["share"] for item in breakdown if normalise(item["name"]) == key), None)


def build_claims(claimed_skills: Optional[Sequence[str]], owned_repos: Sequence[Mapping],
                 languages_by_repo: Mapping[str, Mapping[str, int]], breakdown: Sequence[Mapping]) -> list:
    """One entry per distinct claimed skill, in request order. `owned_repos` holds non-fork repos only."""
    used_by: dict = {}  # normalised language -> [(repo name, pushed_at)] in listing order
    for repo in owned_repos:
        names = {normalise(repo["language"])} if isinstance(repo.get("language"), str) else set()
        names |= {normalise(k) for k in languages_by_repo.get(repo["name"], {})}
        for name in names:
            used_by.setdefault(name, []).append((repo["name"], repo.get("pushed_at")))

    claims, seen = [], set()
    for skill in claimed_skills or []:
        label = skill.strip() if isinstance(skill, str) else ""
        if not label or label.lower() in seen:
            continue
        seen.add(label.lower())
        language = language_for(label)
        if language is None:
            claims.append({"skill": label, "language": None, "status": "not_checkable", "share": None,
                           "repos": [], "last_activity": None})
            continue
        users = used_by.get(normalise(language), [])
        stamps = [(parse_ts(pushed), pushed) for _, pushed in users if parse_ts(pushed) is not None]
        claims.append({
            "skill": label,
            "language": language,
            "status": "evidenced" if users else "not_found",
            "share": _share(breakdown, language) if users else None,
            "repos": [name for name, _ in users],
            "last_activity": max(stamps)[1] if stamps else None,
        })
    return claims
