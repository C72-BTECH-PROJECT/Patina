"""GitHub REST client and recorder in isolation (T-0011)."""
import asyncio
import json
import re
import time

import httpx
import pytest

from conftest import API_URL, TOKEN, RECORDINGS, load_recording, mount, mount_account, mount_details_stub

PAGE_Q = {"type": "owner", "sort": "pushed", "direction": "desc", "per_page": "100"}


def settings(**over):
    from app.config import Settings

    env = {"GITHUB_TOKEN": TOKEN, "GITHUB_API_URL": API_URL}
    env.update({k: str(v) for k, v in over.items()})
    return Settings.from_env(env)


def fetch(login, *, rate=None, **over):
    from app.github_client import GitHubClient, RateLimitState

    client = GitHubClient(settings(**over), rate or RateLimitState())
    return asyncio.run(client.fetch(login))


def error_of(login, **over):
    from app.github_client import GitHubError

    with pytest.raises(GitHubError) as err:
        fetch(login, **over)
    return err.value


# ---- config

def test_settings_defaults_and_errors():
    s = settings()
    assert (s.max_repos, s.http_timeout_s, s.deadline_s, s.min_remaining) == (100, 4.0, 6.0, 100)
    assert s.api_url == API_URL

    from app.config import ConfigError, Settings

    with pytest.raises(ConfigError) as err:
        Settings.from_env({"GITHUB_TOKEN": TOKEN, "GITHUB_MAX_REPOS": "lots"})
    assert "GITHUB_MAX_REPOS" in str(err.value)
    assert "lots" not in str(err.value) and TOKEN not in str(err.value)
    with pytest.raises(ConfigError):
        Settings.from_env({"GITHUB_TOKEN": TOKEN, "GITHUB_DEADLINE_S": "0"})


# ---- pagination

def test_link_header_next_detection():
    from app.github_client import has_next_page

    assert has_next_page('<https://x/a?page=2>; rel="next", <https://x/a?page=3>; rel="last"')
    assert has_next_page('<https://x/a?page=3>; rel="last",<https://x/a?page=2>;rel="next"')
    assert not has_next_page('<https://x/a?page=1>; rel="prev", <https://x/a?page=1>; rel="first"')
    assert not has_next_page(None)
    assert not has_next_page("")


def test_link_url_is_never_followed(gh):
    """The Link header only says that another page exists; its URL (and so our token) is never used."""
    evil = '<https://evil.example/steal?page=2>; rel="next"'
    mount(gh, "synthetic/many_user.json")
    mount(gh, "synthetic/many_repos_p1.json", headers={"link": evil})
    mount(gh, "synthetic/many_repos_p2.json")
    result = fetch("synth-many", GITHUB_MAX_REPOS=200)
    assert len(result.repos) == 150
    hosts = {c.request.url.host for c in gh.calls}
    assert hosts == {"github-stub.invalid"}


def test_exactly_cap_without_next_page_is_not_truncated(gh):
    mount(gh, "synthetic/many_user.json")
    mount(gh, "synthetic/many_repos_p1.json", headers={"link": ""})
    result = fetch("synth-many", GITHUB_MAX_REPOS=100)
    assert len(result.repos) == 100
    assert result.truncated is False


def test_cap_below_page_size_truncates(gh):
    mount(gh, "synthetic/many_user.json")
    mount(gh, "synthetic/many_repos_p1.json")
    result = fetch("synth-many", GITHUB_MAX_REPOS=30)
    assert len(result.repos) == 30
    assert result.truncated is True
    assert len([c for c in gh.calls if c.request.url.path.endswith("/repos")]) == 1


# ---- rate limits

def test_secondary_limit_short_wait_retries_once(gh):
    user = mount(gh, "synthetic/small_user.json")
    mount(gh, "synthetic/small_repos.json")
    ok = load_recording("synthetic/small_user.json")["response"]
    user.side_effect = [
        httpx.Response(429, headers={"retry-after": "1", "x-ratelimit-remaining": "4000"}, json={"message": "slow down"}),
        httpx.Response(200, headers=ok["headers"], json=ok["body"]),
    ]
    started = time.monotonic()
    result = fetch("synth-user")
    assert 0.9 <= time.monotonic() - started < 3
    assert user.call_count == 2
    assert len(result.repos) == 3


def test_secondary_limit_long_wait_is_not_retried(gh):
    mount(gh, "synthetic/secondary_limit_429.json")
    err = error_of("synth-user")
    assert err.code == "github_rate_limited" and err.retry_after == 60
    assert len(gh.calls) == 1


def test_low_water_block_ends_when_the_window_resets(gh):
    from app.github_client import RateLimitState

    mount(gh, "synthetic/small_user.json")
    mount(gh, "synthetic/small_repos.json")
    rate = RateLimitState()
    rate.remaining, rate.reset = 5, int(time.time()) - 10  # below the mark, but the window has reset
    result = fetch("synth-user", rate=rate)
    assert len(result.repos) == 3
    assert rate.remaining == 4990  # replaced by what GitHub said


def test_low_water_blocks_without_a_call(gh):
    from app.github_client import RateLimitState

    rate = RateLimitState()
    rate.remaining, rate.reset = 5, int(time.time()) + 120
    from app.github_client import GitHubClient, GitHubError

    with pytest.raises(GitHubError) as err:
        asyncio.run(GitHubClient(settings(), rate).fetch("synth-user"))
    assert err.value.code == "github_rate_limited"
    assert 118 <= err.value.retry_after <= 122
    assert len(gh.calls) == 0


def test_connection_error_is_retried_once(gh):
    user = mount(gh, "synthetic/small_user.json")
    user.side_effect = httpx.ConnectError("boom")
    err = error_of("synth-user")
    assert err.code == "github_upstream_error"
    assert user.call_count == 2
    assert "boom" not in repr(err) and "boom" not in str(err)


# ---- recorder

def test_recorder_scrubs_and_writes(gh, tmp_path):
    from tools.record_github import ALLOWED_HEADERS, record

    extra = {
        "set-cookie": "session=abc", "x-github-request-id": "ABCD:1234", "server": "github.com",
        "authorization": f"Bearer {TOKEN}", "etag": 'W/"abc"',
    }
    mount(gh, "synthetic/small_user.json", headers=extra)
    mount(gh, "synthetic/small_repos.json", headers=extra)
    mount_details_stub(gh, "synth-user")  # T-0012: the recorder also records the detail repos
    (tmp_path / "manifest.json").write_text(json.dumps({"files": []}), encoding="utf-8")

    written = asyncio.run(record("synth-user", tmp_path, settings(), today="2026-10-15"))

    assert sorted(p.name for p in written) == [
        "commits_alpha_p1.json", "commits_gamma_p1.json", "languages_alpha.json", "languages_gamma.json",
        "repos_p1.json", "user.json",
    ]
    for path in written:
        raw = path.read_text(encoding="utf-8")
        assert TOKEN not in raw and "set-cookie" not in raw and "bearer" not in raw.lower()
        rec = json.loads(raw)
        assert set(rec["request"]) == {"method", "path", "query"}
        assert all(h in ALLOWED_HEADERS or h.startswith("x-ratelimit-") for h in rec["response"]["headers"])
        if path.name in ("user.json", "repos_p1.json"):
            assert "etag" in rec["response"]["headers"]
    user = json.loads((tmp_path / "synth-user" / "user.json").read_text(encoding="utf-8"))
    assert user["request"]["path"] == "/users/synth-user"
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["files"] == [
        {"path": f"synth-user/{name}", "source": "recorded", "date": "2026-10-15"}
        for name in ("commits_alpha_p1.json", "commits_gamma_p1.json", "languages_alpha.json",
                     "languages_gamma.json", "repos_p1.json", "user.json")
    ]
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", manifest["accounts"]["synth-user"]["fetched_at"])
    # re-recording replaces the entries instead of duplicating them
    asyncio.run(record("synth-user", tmp_path, settings(), today="2026-10-16"))
    again = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert len(again["files"]) == 6 and {f["date"] for f in again["files"]} == {"2026-10-16"}
    assert RECORDINGS.joinpath("manifest.json").exists()  # the real manifest was not touched


def test_recorder_records_detail_files_with_the_pinned_clock(gh, tmp_path):
    """T-0012: languages and commit pages are recorded under the layout the tests mount, and the
    account's fetched_at (the clock the tests pin) goes to the manifest."""
    from datetime import datetime, timezone
    from tools.record_github import record

    mount_account(gh, "synthetic/active")
    now = datetime(2026, 10, 15, 12, 0, 0, tzinfo=timezone.utc)
    written = asyncio.run(record("synth-active", tmp_path, settings(), today="2026-10-15", now=now))

    names = sorted(p.name for p in written)
    assert names == sorted(f.name for f in (RECORDINGS / "synthetic" / "active").glob("*.json"))
    for name in names:
        mine = json.loads((tmp_path / "synth-active" / name).read_text(encoding="utf-8"))
        theirs = load_recording(f"synthetic/active/{name}")
        assert mine["request"] == theirs["request"], name
        assert mine["response"]["body"] == theirs["response"]["body"], name
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["accounts"]["synth-active"] == {"fetched_at": "2026-10-15T12:00:00Z"}
    assert all(f["source"] == "recorded" for f in manifest["files"])
