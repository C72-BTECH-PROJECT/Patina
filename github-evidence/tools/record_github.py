"""Owner-run recorder: save a real GitHub account's responses as test recordings (T-0011, T-0012).

    github-evidence/venv/Scripts/python github-evidence/tools/record_github.py octocat

Needs GITHUB_TOKEN (a fine-grained token with public read only) in github-evidence/.env.
It calls the same endpoints as the service (profile, repo list, and the detail repos' languages and
commits) through the service's own client, keeps only allow-listed response headers, writes
tests/github/recordings/<login>/ and adds the files to tests/github/recordings/manifest.json as
`source: recorded`, with the run's `fetched_at` under `accounts` (the clock the tests pin). The
token is never written. If a detail call fails, nothing is written.
"""
import argparse
import asyncio
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

SERVICE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SERVICE_DIR))

import httpx  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

from app.config import ConfigError, Settings  # noqa: E402
from app.contract import is_valid_login  # noqa: E402
from app.github_client import DetailSpec, GitHubClient, GitHubError, RateLimitState  # noqa: E402
from app.metrics import DEFAULT_WINDOW_DAYS, fmt_ts  # noqa: E402

DEFAULT_ROOT = SERVICE_DIR.parent / "tests" / "github" / "recordings"
ALLOWED_HEADERS = ("content-type", "link", "etag", "retry-after")
ALLOWED_PREFIX = "x-ratelimit-"
FORBIDDEN_TEXT = ("authorization", "ghp_", "github_pat_", "gho_", "bearer")


def scrub_headers(headers) -> dict:
    return {
        name.lower(): value for name, value in headers.items()
        if name.lower() in ALLOWED_HEADERS or name.lower().startswith(ALLOWED_PREFIX)
    }


def recording_from(request: httpx.Request, response: httpx.Response) -> dict:
    return {
        "request": {"method": request.method, "path": request.url.path, "query": dict(request.url.params)},
        "response": {"status": response.status_code, "headers": scrub_headers(response.headers), "body": response.json()},
    }


def _file_name(rec: dict) -> str:
    """user.json, repos_p<N>.json, languages_<repo>.json, commits_<repo>_p<N>.json (T-0012)."""
    path, query = rec["request"]["path"], rec["request"]["query"]
    parts = path.strip("/").split("/")  # repos/<login>/<repo>/(languages|commits)
    if len(parts) == 4 and parts[0] == "repos" and parts[3] == "languages":
        return f"languages_{parts[2]}.json"
    if len(parts) == 4 and parts[0] == "repos" and parts[3] == "commits":
        return f"commits_{parts[2]}_p{query.get('page', '1')}.json"
    if path.endswith("/repos"):
        return f"repos_p{query.get('page', '1')}.json"
    return "user.json"


def _dump(rec: dict, token: str) -> str:
    text = json.dumps(rec, indent=2, sort_keys=True) + "\n"
    lowered = text.lower()
    if token in text or any(bad in lowered for bad in FORBIDDEN_TEXT):
        raise RuntimeError("refusing to write a recording that contains credential-like text")
    return text


def _update_manifest(root: Path, login: str, names: list, today: str, fetched_at: str) -> None:
    """Replace the account's entries. `accounts[login].fetched_at` is the clock the tests pin for it."""
    path = root / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {"files": []}
    kept = [f for f in manifest["files"] if not f["path"].startswith(f"{login}/")]
    kept += [{"path": f"{login}/{n}", "source": "recorded", "date": today} for n in names]
    manifest["files"] = sorted(kept, key=lambda f: f["path"])
    manifest.setdefault("accounts", {})[login] = {"fetched_at": fetched_at}
    manifest["accounts"] = dict(sorted(manifest["accounts"].items()))
    path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")


async def record(login: str, root: Path, settings: Settings, today: Optional[str] = None,
                 now: Optional[datetime] = None) -> list:
    """Record the profile, the repo list and the detail repos' languages and commits for one account.

    `now` is the clock of the run (default: the real time, to the second). It decides the `since` of the
    commit requests and is stored as the account's `fetched_at`, so the tests can pin their clock to it.
    """
    if not is_valid_login(login):
        raise ValueError("not a GitHub login")
    now = (now or datetime.now(timezone.utc)).astimezone(timezone.utc).replace(microsecond=0)
    captured = []

    def observer(request: httpx.Request, response: httpx.Response) -> None:
        if response.status_code < 400:  # retries and errors are not recordings
            captured.append(recording_from(request, response))

    fetched = await GitHubClient(settings, RateLimitState(), observer).fetch(login, DetailSpec(now, DEFAULT_WINDOW_DAYS))
    if fetched.deadline_hit or any(d.languages is None or d.commits is None for d in fetched.details.values()):
        raise GitHubError("github_upstream_error")  # an incomplete recording would make tests fail later

    texts = {_file_name(rec): _dump(rec, settings.token) for rec in captured}
    folder = Path(root) / login
    folder.mkdir(parents=True, exist_ok=True)
    for old in folder.glob("*.json"):
        old.unlink()
    written = []
    for name, text in sorted(texts.items()):
        (folder / name).write_text(text, encoding="utf-8", newline="\n")
        written.append(folder / name)
    _update_manifest(Path(root), login, sorted(texts), today or now.strftime("%Y-%m-%d"), fmt_ts(now))
    return written


def main(argv: Optional[list] = None) -> int:
    parser = argparse.ArgumentParser(description="Record a GitHub account's responses for the github test suite.")
    parser.add_argument("login")
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT, help="recordings folder (default: tests/github/recordings)")
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[A-Za-z0-9-]{1,39}", args.login) or not is_valid_login(args.login):
        print("error: not a valid GitHub login", file=sys.stderr)
        return 2
    load_dotenv(SERVICE_DIR / ".env")
    try:
        settings = Settings.from_env(os.environ)
        written = asyncio.run(record(args.login, args.root, settings))
    except ConfigError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except GitHubError as exc:
        print(f"error: GitHub call failed ({exc.code}); nothing was written", file=sys.stderr)
        return 1
    for path in written:
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
