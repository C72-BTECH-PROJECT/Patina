"""HTTP-level behaviour of the github-evidence service (T-0011, criteria 2-14)."""
import asyncio
import logging
import re
import socket
import time
import uuid

import httpx
import pytest
from pytest_socket import SocketConnectBlockedError

from conftest import API_URL, RECORDINGS, TOKEN, load_recording, mount

PER_PAGE = {"type": "owner", "sort": "pushed", "direction": "desc", "per_page": "100"}


def call_paths(router):
    return [c.request.url.path for c in router.calls]


def list_calls(router):
    return [c for c in router.calls if c.request.url.path.endswith("/repos")]


def assert_error_shape(resp, status, code):
    assert resp.status_code == status, resp.text
    body = resp.json()
    assert set(body) == {"error", "message"}, body
    assert body["error"] == code
    assert isinstance(body["message"], str) and body["message"]


def mount_small(gh):
    mount(gh, "synthetic/small_user.json")
    mount(gh, "synthetic/small_repos.json")


# ---- criterion 2

def test_requires_token(monkeypatch):
    from app.main import create_app

    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    with pytest.raises(Exception) as err:
        create_app()
    assert "GITHUB_TOKEN" in str(err.value)

    monkeypatch.setenv("GITHUB_TOKEN", "   ")
    with pytest.raises(Exception) as err:
        create_app()
    assert "GITHUB_TOKEN" in str(err.value)
    assert TOKEN not in str(err.value)


# ---- criterion 3

def test_health(client, gh):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {
        "status": "ok", "service": "github-evidence", "contract_version": "1", "token_configured": True,
    }
    assert len(gh.calls) == 0


# ---- criterion 4 (PENDING until the owner records octocat)

def test_evidence_octocat(client, gh):
    folder = RECORDINGS / "octocat"
    files = sorted(folder.glob("*.json")) if folder.is_dir() else []
    if not files:
        pytest.skip("PENDING owner step: tests/github/recordings/octocat/ is not recorded yet (T-0011 criterion 4)")
    items = []
    for f in files:
        mount(gh, f"octocat/{f.name}")
        if f.name.startswith("repos"):
            items.extend(load_recording(f"octocat/{f.name}")["response"]["body"])
    resp = client.post("/v1/evidence", json={"username": "octocat"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "complete"
    repos = body["repositories"]
    assert repos["listed"] == len(items)
    assert repos["forked"] == sum(1 for r in items if r["fork"])
    assert repos["owned"] == sum(1 for r in items if not r["fork"])


def test_evidence_small_shape(client, gh):
    mount_small(gh)
    resp = client.post("/v1/evidence", json={"username": "synth-user"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["contract_version"] == "1"
    assert body["username"] == "synth-user"
    assert body["status"] == "complete"
    assert body["request_id"] == resp.headers["x-request-id"]
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", body["fetched_at"])
    assert body["profile"] == {"public_repos": 3, "html_url": "https://github.com/synth-user"}
    repos = body["repositories"]
    assert {k: repos[k] for k in ("listed", "owned", "forked", "archived", "considered", "truncated")} == {
        "listed": 3, "owned": 2, "forked": 1, "archived": 1, "considered": 2, "truncated": False,
    }
    assert [i["name"] for i in repos["items"]] == ["alpha", "beta", "gamma"]
    assert repos["items"][0] == {
        "name": "alpha", "fork": False, "archived": False,
        "pushed_at": "2026-09-30T08:00:00Z", "primary_language": "Python",
    }
    assert "public_repositories_only" in body["limitations"]
    assert body["rate_limit"]["remaining"] == 4990
    assert len(gh.calls) == 2


# ---- criterion 5

def test_pagination(make_client, gh):
    client = make_client(GITHUB_MAX_REPOS=200)
    mount(gh, "synthetic/many_user.json")
    mount(gh, "synthetic/many_repos_p1.json")
    mount(gh, "synthetic/many_repos_p2.json")
    resp = client.post("/v1/evidence", json={"username": "synth-many"})
    assert resp.status_code == 200, resp.text
    repos = resp.json()["repositories"]
    assert repos["listed"] == 150
    assert repos["truncated"] is False
    data = load_recording("synthetic/many_repos_p1.json")["response"]["body"] + \
        load_recording("synthetic/many_repos_p2.json")["response"]["body"]
    assert repos["forked"] == sum(1 for r in data if r["fork"])
    assert repos["owned"] == sum(1 for r in data if not r["fork"])
    assert len(list_calls(gh)) == 2
    assert [c.request.url.params["page"] for c in list_calls(gh)] == ["1", "2"]


def test_repo_cap(make_client, gh):
    client = make_client(GITHUB_MAX_REPOS=100)
    mount(gh, "synthetic/many_user.json")
    mount(gh, "synthetic/many_repos_p1.json")
    mount(gh, "synthetic/many_repos_p2.json")
    resp = client.post("/v1/evidence", json={"username": "synth-many"})
    assert resp.status_code == 200, resp.text
    repos = resp.json()["repositories"]
    assert repos["listed"] == 100
    assert repos["truncated"] is True
    assert len(list_calls(gh)) == 1  # page 2 is never requested
    assert len(gh.calls) == 2


# ---- criterion 6

@pytest.mark.parametrize("payload", [
    {"username": ""},
    {"username": "-alice"},
    {"username": "alice-"},
    {"username": "a--b"},
    {"username": "a" * 40},
    {"username": "github.com/alice"},
    {},
    {"username": 123},
    {"username": ["alice"]},
])
def test_invalid_username(client, gh, payload):
    resp = client.post("/v1/evidence", json=payload)
    assert_error_shape(resp, 400, "invalid_request")
    assert len(gh.calls) == 0


def test_invalid_body_is_400(client, gh):
    resp = client.post("/v1/evidence", content=b"not json", headers={"content-type": "application/json"})
    assert_error_shape(resp, 400, "invalid_request")
    resp = client.post("/v1/evidence", content=b"username=alice", headers={"content-type": "text/plain"})
    assert_error_shape(resp, 400, "invalid_request")
    assert len(gh.calls) == 0


@pytest.mark.parametrize("login", ["a", "a" * 39, "a-b", "Alice-99"])
def test_valid_username_boundaries(client, gh, login):
    route = gh.get(f"{API_URL}/users/{login}").mock(return_value=httpx.Response(404, json={"message": "Not Found"}))
    resp = client.post("/v1/evidence", json={"username": login})
    assert_error_shape(resp, 404, "github_user_not_found")
    assert route.call_count == 1


# ---- criterion 7

def test_user_not_found(client, gh):
    mount(gh, "synthetic/missing_user_404.json")
    resp = client.post("/v1/evidence", json={"username": "synth-missing"})
    assert_error_shape(resp, 404, "github_user_not_found")
    assert len(gh.calls) == 1


# ---- criterion 8

def test_rate_limit_primary(client, gh):
    mount(gh, "synthetic/primary_limit_403.json", headers={"x-ratelimit-reset": str(int(time.time()) + 600)})
    resp = client.post("/v1/evidence", json={"username": "synth-user"})
    assert_error_shape(resp, 503, "github_rate_limited")
    assert abs(int(resp.headers["retry-after"]) - 600) <= 2
    assert len(gh.calls) == 1


def test_rate_limit_secondary(client, gh):
    mount(gh, "synthetic/secondary_limit_429.json")
    started = time.monotonic()
    resp = client.post("/v1/evidence", json={"username": "synth-user"})
    assert time.monotonic() - started < 2
    assert_error_shape(resp, 503, "github_rate_limited")
    assert resp.headers["retry-after"] == "60"
    assert len(gh.calls) == 1


def test_rate_limit_low_water(client, gh):
    low = {"x-ratelimit-remaining": "50", "x-ratelimit-reset": str(int(time.time()) + 300)}
    mount(gh, "synthetic/small_user.json", headers=low)
    mount(gh, "synthetic/small_repos.json", headers=low)
    first = client.post("/v1/evidence", json={"username": "synth-user"})
    assert first.status_code == 200, first.text
    assert first.json()["rate_limit"]["remaining"] == 50
    calls_after_first = len(gh.calls)

    second = client.post("/v1/evidence", json={"username": "synth-user"})
    assert_error_shape(second, 503, "github_rate_limited")
    assert 1 <= int(second.headers["retry-after"]) <= 302
    assert len(gh.calls) == calls_after_first


# ---- criterion 9

def test_upstream_retry(client, gh):
    ok_user = load_recording("synthetic/small_user.json")["response"]
    user = mount(gh, "synthetic/small_user.json")
    repos = mount(gh, "synthetic/small_repos.json")

    user.side_effect = [httpx.Response(502, json={"message": "Server Error"}),
                        httpx.Response(200, headers=ok_user["headers"], json=ok_user["body"])]
    resp = client.post("/v1/evidence", json={"username": "synth-user"})
    assert resp.status_code == 200, resp.text
    assert user.call_count == 2  # the failing request is tried exactly twice
    assert repos.call_count == 1

    user_before, total_before = user.call_count, len(gh.calls)  # respx counters are cumulative
    user.side_effect = [httpx.Response(502, json={"message": "Server Error"}),
                        httpx.Response(502, json={"message": "Server Error"})]
    resp = client.post("/v1/evidence", json={"username": "synth-user"})
    assert_error_shape(resp, 502, "github_upstream_error")
    assert user.call_count - user_before == 2
    assert len(gh.calls) - total_before == 2


def test_other_client_error_is_upstream_error(client, gh):
    mount(gh, "synthetic/forbidden_403.json")
    resp = client.post("/v1/evidence", json={"username": "synth-user"})
    assert_error_shape(resp, 502, "github_upstream_error")
    assert len(gh.calls) == 1


def test_deadline(make_client, gh):
    client = make_client(GITHUB_DEADLINE_S=1)

    async def never_answers(request):
        await asyncio.sleep(3600)

    gh.get(f"{API_URL}/users/synth-user").mock(side_effect=never_answers)
    started = time.monotonic()
    resp = client.post("/v1/evidence", json={"username": "synth-user"})
    assert time.monotonic() - started < 2
    assert_error_shape(resp, 504, "github_timeout")


def test_auth_failed(client, gh):
    mount(gh, "synthetic/bad_credentials_401.json")
    resp = client.post("/v1/evidence", json={"username": "synth-user"})
    assert_error_shape(resp, 503, "github_auth_failed")
    assert len(gh.calls) == 1


# ---- criterion 10

def test_no_echo(client, gh, caplog):
    from app.contract import ERRORS

    caplog.set_level(logging.DEBUG)
    cases = [
        ("synthetic/missing_user_404.json", "synth-missing", 404, "github_user_not_found"),
        ("synthetic/bad_credentials_401.json", "synth-user", 503, "github_auth_failed"),
        ("synthetic/forbidden_403.json", "synth-user", 502, "github_upstream_error"),
        ("synthetic/secondary_limit_429.json", "synth-user", 503, "github_rate_limited"),
        ("synthetic/primary_limit_403.json", "synth-user", 503, "github_rate_limited"),
    ]
    for rel, login, status, code in cases:
        mount(gh, rel)
        resp = client.post("/v1/evidence", json={"username": login})
        assert_error_shape(resp, status, code)
        assert resp.json()["message"] == ERRORS[code].message
        gh.routes.clear()
    # a hard 502 (twice) and a malformed request too
    mount(gh, "synthetic/upstream_502.json")
    resp = client.post("/v1/evidence", json={"username": "synth-user"})
    assert_error_shape(resp, 502, "github_upstream_error")
    resp = client.post("/v1/evidence", json={"username": "-bad"})
    assert_error_shape(resp, 400, "invalid_request")
    gh.routes.clear()
    # and a success
    mount_small(gh)
    ok = client.post("/v1/evidence", json={"username": "synth-user"})
    assert ok.status_code == 200

    assert caplog.records, "no log records captured: the test would be vacuous"
    forbidden = (TOKEN, "GHBODY-MARKER", API_URL, "github-stub.invalid")
    for text in (caplog.text, ok.text):
        for needle in forbidden:
            assert needle not in text, f"{needle!r} leaked"


def test_unexpected_error_is_fixed_500(client, gh, monkeypatch):
    import app.main as main

    async def boom(*a, **kw):
        raise RuntimeError("secret detail " + TOKEN)

    monkeypatch.setattr(main.GitHubClient, "fetch", boom)
    resp = client.post("/v1/evidence", json={"username": "synth-user"})
    assert_error_shape(resp, 500, "internal_error")
    assert "secret detail" not in resp.text and TOKEN not in resp.text
    assert resp.headers["x-request-id"]


# ---- criterion 11

def test_auth_headers(client, gh):
    user_rec = load_recording("synthetic/small_user.json")["response"]["headers"]
    mount(gh, "synthetic/small_user.json", headers={**user_rec, "set-cookie": "session=abc; Path=/"})
    mount(gh, "synthetic/small_repos.json")
    resp = client.post(
        "/v1/evidence", json={"username": "synth-user"},
        headers={"Cookie": "caller=1", "Authorization": "Bearer caller-supplied"},
    )
    assert resp.status_code == 200, resp.text
    assert len(gh.calls) == 2
    for call in gh.calls:
        h = call.request.headers
        assert h["authorization"] == f"Bearer {TOKEN}"
        assert h["x-github-api-version"] == "2022-11-28"
        assert h["user-agent"] and "python-httpx" not in h["user-agent"]
        assert "cookie" not in h


# ---- criterion 12

def test_request_id(client, gh, caplog):
    caplog.set_level(logging.INFO)
    mount_small(gh)
    resp = client.post("/v1/evidence", json={"username": "synth-user"}, headers={"X-Request-ID": "req-abc-123"})
    assert resp.status_code == 200
    assert resp.headers["x-request-id"] == "req-abc-123"
    assert resp.json()["request_id"] == "req-abc-123"
    assert any(getattr(r, "request_id", None) == "req-abc-123" and "req-abc-123" in r.getMessage()
               for r in caplog.records)

    err = client.post("/v1/evidence", json={"username": "-x"}, headers={"X-Request-ID": "req-err-1"})
    assert err.headers["x-request-id"] == "req-err-1"

    for bad in ("bad id\n", "x" * 65, "has space", ""):
        resp = client.get("/health", headers={"X-Request-ID": bad})
        rid = resp.headers["x-request-id"]
        assert rid != bad
        assert str(uuid.UUID(rid)) == rid

    assert client.get("/health").headers["x-request-id"]


# ---- criterion 13

def test_no_cors_no_docs(client):
    resp = client.options("/v1/evidence", headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in resp.headers
    resp = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in resp.headers
    for path in ("/docs", "/redoc", "/openapi.json"):
        resp = client.get(path)
        assert resp.status_code == 404, path
        assert set(resp.json()) == {"error", "message"}


# ---- criterion 14

def test_live_call_blocked():
    """Needs run-suite's --allow-hosts=127.0.0.1,::1. The host name is passed to connect()
    directly: pytest-socket checks it before any DNS lookup, so this works offline."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        with pytest.raises(SocketConnectBlockedError):
            sock.connect(("api.github.com", 443))
    finally:
        sock.close()


# ---- criterion 15

ALLOWED_HEADERS = {"content-type", "link", "etag", "retry-after"}
FORBIDDEN_TEXT = ("authorization", "ghp_", "github_pat_", "gho_", "bearer")


def test_recordings_scrubbed():
    import json

    manifest = json.loads((RECORDINGS / "manifest.json").read_text(encoding="utf-8"))
    listed = {}
    for entry in manifest["files"]:
        assert set(entry) == {"path", "source", "date"}, entry
        assert entry["source"] in ("recorded", "synthetic"), entry
        assert re.fullmatch(r"\d{4}-\d\d-\d\d", entry["date"]), entry
        assert entry["path"] not in listed, f"duplicate manifest entry {entry['path']}"
        listed[entry["path"]] = entry

    on_disk = {p.relative_to(RECORDINGS).as_posix() for p in RECORDINGS.rglob("*.json")} - {"manifest.json"}
    assert on_disk == set(listed), f"manifest and files differ: {on_disk ^ set(listed)}"

    for rel in on_disk:
        assert (listed[rel]["source"] == "synthetic") == rel.startswith("synthetic/"), rel
        raw = (RECORDINGS / rel).read_text(encoding="utf-8")
        lowered = raw.lower()
        for needle in FORBIDDEN_TEXT:
            assert needle not in lowered, f"{rel} contains {needle!r}"
        rec = json.loads(raw)
        assert set(rec) == {"request", "response"}
        for name in rec["response"]["headers"]:
            assert name == name.lower(), (rel, name)
            assert name in ALLOWED_HEADERS or name.startswith("x-ratelimit-"), (rel, name)
