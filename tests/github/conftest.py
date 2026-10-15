"""Shared fixtures for the github-evidence suite (T-0011).

Every test runs inside respx.mock(assert_all_mocked=True), so an unmocked GitHub
request fails the test, and run-suite passes --allow-hosts=127.0.0.1,::1 to
pytest-socket, so a real connection to anything but loopback raises.
"""
import json
import os
import sys
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
)


def load_recording(rel):
    return json.loads((RECORDINGS / rel).read_text(encoding="utf-8"))


def mount(router, rel, *, status=None, headers=None, base=API_URL):
    """Mount one recording file on the respx router; returns the route.

    `headers` overrides recorded response headers (the rate-limit reset time is
    relative to the test clock, so it cannot live in a file).
    """
    rec = load_recording(rel)
    req, resp = rec["request"], rec["response"]
    merged = dict(resp["headers"])
    merged.update(headers or {})
    return router.request(req["method"], f"{base}{req['path']}", params=req["query"] or None).mock(
        return_value=httpx.Response(status or resp["status"], headers=merged, json=resp["body"])
    )


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
    """make_client(GITHUB_MAX_REPOS="100", ...) -> TestClient over a fresh app (fresh rate-limit state)."""
    from fastapi.testclient import TestClient

    def factory(**env):
        for name, value in env.items():
            monkeypatch.setenv(name, str(value))
        from app.main import create_app
        return TestClient(create_app())

    return factory


@pytest.fixture
def client(make_client):
    return make_client()
