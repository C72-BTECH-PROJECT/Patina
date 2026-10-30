"""Shared fixtures for the github-evidence suite (T-0011, extended in T-0012).

Every test runs inside respx.mock(assert_all_mocked=True), so an unmocked GitHub
request fails the test, and run-suite passes --allow-hosts=127.0.0.1,::1 to
pytest-socket, so a real connection to anything but loopback raises.
"""
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import httpx
import pytest
import respx

HERE = Path(__file__).resolve().parent
SERVICE_DIR = HERE.parents[1] / "github-evidence"
RECORDINGS = HERE / "recordings"

TOKEN = "test-token-ZZZ-not-a-real-credential"
API_URL = "https://github-stub.invalid"

# Set before the app package is imported: main.py builds a module-level app and
# loads github-evidence/.env, which must never happen in tests.
os.environ["GITHUB_TOKEN"] = TOKEN
os.environ["GITHUB_API_URL"] = API_URL
os.environ["PYTHON_DOTENV_DISABLED"] = "1"
sys.path.insert(0, str(SERVICE_DIR))

CONFIG_VARS = (
    "GITHUB_MAX_REPOS", "GITHUB_HTTP_TIMEOUT_S", "GITHUB_DEADLINE_S", "GITHUB_MIN_REMAINING",
    "GITHUB_DETAIL_REPOS", "GITHUB_CONCURRENCY", "GITHUB_SUBSCORE_WEIGHTS",
)


def load_recording(rel):
    return json.loads((RECORDINGS / rel).read_text(encoding="utf-8"))


def mount(router, rel, *, status=None, headers=None, base=API_URL, mutate=None):
    """Mount one recording file on the respx router; returns the route.

    `headers` overrides recorded response headers (the rate-limit reset time is
    relative to the test clock, so it cannot live in a file). `mutate(rec)` may edit
    the loaded recording in memory (the file on disk is never touched).
    """
    rec = load_recording(rel)
    if mutate is not None:
        mutate(rec)
    req, resp = rec["request"], rec["response"]
    merged = dict(resp["headers"])
    merged.update(headers or {})
    return router.request(req["method"], f"{base}{req['path']}", params=req["query"] or None).mock(
        return_value=httpx.Response(status or resp["status"], headers=merged, json=resp["body"])
    )


def mount_account(router, folder, *, skip=(), mutate=None):
    """Mount every recording of one account folder (profile, repo pages, languages, commits).

    `skip` holds file names to leave unmounted; `mutate(file_name, rec)` edits a recording in memory.
    """
    mounted = []
    for f in sorted((RECORDINGS / folder).glob("*.json")):
        if f.name in skip:
            continue
        edit = (lambda rec, name=f.name: mutate(name, rec)) if mutate else None
        mounted.append(mount(router, f"{folder}/{f.name}", mutate=edit))
    return mounted


def mount_details_stub(router, login):
    """Answer any /languages with {} and any /commits with [] for one login.

    For tests of the profile and repo list (T-0011) that do not care about detail repos.
    """
    pattern = re.escape(f"{API_URL}/repos/{login}/")
    router.get(url__regex=pattern + r"[^/]+/languages(\?.*)?$").mock(return_value=httpx.Response(200, json={}))
    router.get(url__regex=pattern + r"[^/]+/commits(\?.*)?$").mock(return_value=httpx.Response(200, json=[]))


def account_fetched_at(folder):
    """`fetched_at` of a recorded account, from the manifest. None if the account is not recorded."""
    manifest = json.loads((RECORDINGS / "manifest.json").read_text(encoding="utf-8"))
    entry = manifest.get("accounts", {}).get(folder)
    return entry["fetched_at"] if entry else None


def pinned_clock(folder):
    """A clock that always returns the account's recorded `fetched_at`. Tests never read the real clock."""
    moment = datetime.fromisoformat(account_fetched_at(folder).replace("Z", "+00:00"))
    return lambda: moment


@pytest.fixture(autouse=True)
def gh():
    """The respx router every test sees. Unused routes are fine; unmocked calls are not."""
    with respx.mock(assert_all_mocked=True, assert_all_called=False) as router:
        yield router


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", TOKEN)
    monkeypatch.setenv("GITHUB_API_URL", API_URL)
    for name in CONFIG_VARS:
        monkeypatch.delenv(name, raising=False)


@pytest.fixture
def make_client(monkeypatch):
    """make_client(GITHUB_MAX_REPOS="100", ...) -> TestClient over a fresh app (fresh rate-limit state).

    `account="synthetic/active"` pins the app's clock to that account's recorded `fetched_at`.
    """
    from fastapi.testclient import TestClient

    def factory(*, account=None, **env):
        for name, value in env.items():
            monkeypatch.setenv(name, str(value))
        from app.main import create_app
        return TestClient(create_app(clock=pinned_clock(account)) if account else create_app())

    return factory


@pytest.fixture
def client(make_client):
    return make_client()
