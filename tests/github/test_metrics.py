"""Languages, commit activity, ownership, claims, partial data and the call budget (T-0012).

Synthetic accounts live in tests/github/recordings/synthetic/<name>/ and pin their clock to
`fetched_at` in the manifest, so no test reads the real date. The octocat tests need the owner's
re-recording (recorder extended in T-0012) and skip with a PENDING message until it exists.
"""
import asyncio
import json
import math
import time
from pathlib import Path

import httpx
import pytest

from conftest import API_URL, RECORDINGS, account_fetched_at, load_recording, mount_account

HERE = Path(__file__).resolve().parent
ACTIVE = "synthetic/active"
FORKS = "synthetic/forks"
EMPTY = "synthetic/empty"
PARTIAL = "synthetic/partial"
ARCHIVED = "synthetic/archived"
VOLATILE = ("request_id", "fetched_at", "rate_limit")

# The expected numbers for synthetic/active are worked out by hand from the recording:
# app-main has 116 commits in the window over two pages (+1 older than 52 weeks, +1 before the window that
# must be ignored), lib-core has 4. See the generator notes in the Result section of T-0012.
ACTIVE_WEEKLY = [5] + [0] * 27 + [1, 0, 0, 0, 2] + [0] * 10 + [10] + [0] * 6 + [30, 71]
ACTIVE_CLAIMS = ["Python", "go", "Golang", "c++", "Rust", "react", "docker", "aws", "Ruby", "HTML", "Java"]


def call_paths(router):
    return [c.request.url.path for c in router.calls]


def evidence(make_client, gh, folder, login, *, skip=(), mutate=None, payload=None, **env):
    client = make_client(account=folder, **env)
    mount_account(gh, folder, skip=skip, mutate=mutate)
    resp = client.post("/v1/evidence", json={"username": login, **(payload or {})})
    assert resp.status_code == 200, resp.text
    return resp.json()


def active(make_client, gh, **kw):
    kw.setdefault("payload", {"claimed_skills": ACTIVE_CLAIMS})
    return evidence(make_client, gh, ACTIVE, "synth-active", **kw)


def component(body, key):
    return next(c for c in body["sub_score"]["components"] if c["key"] == key)


def stable(body):
    return {k: v for k, v in body.items() if k not in VOLATILE}


def test_pinned_clock_comes_from_the_manifest():
    assert account_fetched_at(ACTIVE) == "2026-10-15T12:00:00Z"


# ---- criterion 1

def test_language_breakdown(make_client, gh):
    body = active(make_client, gh)
    langs = body["languages"]
    assert [(x["name"], x["bytes"]) for x in langs] == [
        ("Python", 6000), ("Go", 4000), ("HTML", 2000), ("Ruby", 1000), ("Perl", 500),
    ]
    assert abs(sum(x["share"] for x in langs) - 1) <= 0.001
    assert langs[0]["share"] == pytest.approx(6000 / 13500, abs=1e-5)
    assert [x["bytes"] for x in langs] == sorted((x["bytes"] for x in langs), reverse=True)
    # a fork's language never counts, and a fork gets no detail call
    assert "Rust" not in {x["name"] for x in langs}


# ---- criterion 2

def test_commit_activity(make_client, gh):
    body = active(make_client, gh)
    act = body["commit_activity"]
    assert act["available"] is True
    assert act["window_days"] == 365 and act["weeks"] == 52
    assert len(act["weekly"]) == 52 and all(type(n) is int for n in act["weekly"])
    assert act["weekly"] == ACTIVE_WEEKLY
    # 119 in the 52 weekly buckets + 1 inside the window but older than 52 weeks; the commit before the window is ignored
    assert act["authored_commits"] == 120
    assert act["active_weeks"] == sum(1 for n in act["weekly"] if n) == 6
    items = {i["name"]: i for i in body["repositories"]["items"]}
    assert items["app-main"]["authored_commits_window"] == 116  # both pages counted
    assert items["lib-core"]["authored_commits_window"] == 4
    commit_calls = [c.request for c in gh.calls if c.request.url.path.endswith("/app-main/commits")]
    assert sorted(r.url.params["page"] for r in commit_calls) == ["1", "2"]
    assert all(r.url.params["author"] == "synth-active" and r.url.params["since"] == "2025-10-15T12:00:00Z"
               and r.url.params["per_page"] == "100" for r in commit_calls)


# ---- criterion 3

def test_ownership(make_client, gh):
    body = active(make_client, gh)
    repos = body["repositories"]
    assert {k: repos[k] for k in ("listed", "owned", "forked", "archived", "considered")} == {
        "listed": 5, "owned": 4, "forked": 1, "archived": 1, "considered": 4,
    }
    assert repos["detailed"] == 4 and repos["with_authored_commits"] == 2
    paths = call_paths(gh)
    assert not [p for p in paths if "/fork-rust/" in p], "a fork got a detail call"
    # archived owned repos are the candidate's work and do get them (owner decision, 2026-10-15)
    assert "/repos/synth-active/legacy-lib/languages" in paths
    assert "/repos/synth-active/legacy-lib/commits" in paths
    assert component(body, "ownership")["value"] == pytest.approx(2 / 5, abs=1e-9)


def test_all_archived(make_client, gh):
    body = evidence(make_client, gh, ARCHIVED, "synth-arch", payload={"claimed_skills": ["python"]})
    paths = call_paths(gh)
    for repo in ("arch-a", "arch-b"):
        assert f"/repos/synth-arch/{repo}/languages" in paths and f"/repos/synth-arch/{repo}/commits" in paths
    assert body["status"] == "complete"
    assert body["repositories"]["archived"] == 2 and body["repositories"]["detailed"] == 2
    assert body["commit_activity"]["authored_commits"] == 3 and body["commit_activity"]["active_weeks"] == 1
    sub = body["sub_score"]
    assert sub["available"] is True and sub["value"] is not None
    assert component(body, "activity")["value"] == pytest.approx(math.log(4) / math.log(201), abs=1e-9)
    assert component(body, "ownership")["value"] == pytest.approx(1 / 5, abs=1e-9)


def test_no_detail_repos(make_client, gh):
    """An empty detail set makes the commit-based components unavailable with a reason, never 0."""
    body = evidence(make_client, gh, ARCHIVED, "synth-arch", payload={"claimed_skills": ["python"]},
                    GITHUB_DETAIL_REPOS=0)
    assert not [p for p in call_paths(gh) if p.startswith("/repos/")], "no detail call may be made"
    act = body["commit_activity"]
    assert act["available"] is False
    assert act["authored_commits"] is None and act["active_weeks"] is None and act["weekly"] is None
    for key in ("activity", "consistency", "ownership"):
        c = component(body, key)
        assert (c["available"], c["value"], c["weight"]) == (False, None, 0), key
        assert c["reason"] == "no_commit_data", key
    corro = component(body, "corroboration")
    assert corro["available"] is True and corro["value"] == 1.0 and corro["weight"] == pytest.approx(1.0)
    assert body["sub_score"]["available"] is True and body["sub_score"]["value"] == pytest.approx(1.0)

    body = evidence(make_client, gh, ARCHIVED, "synth-arch", GITHUB_DETAIL_REPOS=0)  # and no claims either
    sub = body["sub_score"]
    assert (sub["available"], sub["value"], sub["reason_code"]) == (False, None, "insufficient_evidence")


# ---- criterion 4

def test_claims(make_client, gh):
    body = active(make_client, gh)
    claims = {c["skill"]: c for c in body["claims"]}
    assert [c["skill"] for c in body["claims"]] == ACTIVE_CLAIMS  # request order
    assert {c["status"] for c in claims.values()} <= {"evidenced", "not_found", "not_checkable"}

    py = claims["Python"]
    assert (py["language"], py["status"], py["repos"]) == ("Python", "evidenced", ["app-main"])
    assert py["share"] == pytest.approx(6000 / 13500, abs=1e-5)
    assert py["last_activity"] == "2026-10-10T08:00:00Z"
    for alias in ("go", "Golang"):
        assert (claims[alias]["language"], claims[alias]["status"]) == ("Go", "evidenced")
        assert claims[alias]["last_activity"] == "2026-06-01T08:00:00Z"
    # a secondary language that only /languages shows
    assert claims["HTML"]["status"] == "evidenced" and claims["HTML"]["repos"] == ["app-main"]
    # three years old, outside the window, no commits in it: still evidenced, with an old last_activity
    assert claims["Ruby"]["status"] == "evidenced" and claims["Ruby"]["last_activity"] == "2023-10-01T08:00:00Z"
    # used by no repo, and used only by a fork: not_found, and last_activity is null
    for skill, lang in (("c++", "C++"), ("Java", "Java"), ("Rust", "Rust")):
        c = claims[skill]
        assert (c["language"], c["status"], c["last_activity"], c["repos"]) == (lang, "not_found", None, []), skill
    # frameworks and tools are never counted against the candidate
    for skill in ("react", "docker", "aws"):
        c = claims[skill]
        assert (c["language"], c["status"], c["last_activity"]) == (None, "not_checkable", None), skill
    # 5 evidenced (Python, go, Golang, Ruby, HTML) / (5 + 3 not_found)
    assert component(body, "corroboration")["value"] == pytest.approx(5 / 8, abs=1e-9)


def test_claims_beyond_the_detail_cap_use_the_primary_language(make_client, gh):
    body = active(make_client, gh, GITHUB_DETAIL_REPOS=3)
    assert not [p for p in call_paths(gh) if "/old-tool/" in p], "old-tool is beyond the cap"
    assert "detail_repos_capped:3" in body["limitations"]
    ruby = next(c for c in body["claims"] if c["skill"] == "Ruby")
    assert ruby["status"] == "evidenced" and ruby["last_activity"] == "2023-10-01T08:00:00Z"
    assert ruby["share"] is None  # no byte data for that repo
    assert {"Ruby"}.isdisjoint(x["name"] for x in body["languages"])


def test_claim_status_ignores_pushed_at(make_client, gh):
    base = active(make_client, gh)
    gh.routes.clear()

    def touch(name, rec):
        if name == "repos_p1.json":
            for r in rec["response"]["body"]:
                if r["name"] == "old-tool":
                    r["pushed_at"] = "2026-10-01T08:00:00Z"
                if r["name"] == "lib-core":
                    r["pushed_at"] = "2020-01-01T08:00:00Z"

    moved = active(make_client, gh, mutate=touch)
    assert [(c["skill"], c["status"]) for c in moved["claims"]] == [(c["skill"], c["status"]) for c in base["claims"]]
    assert component(moved, "corroboration") == component(base, "corroboration")
    ruby = next(c for c in moved["claims"] if c["skill"] == "Ruby")
    assert ruby["last_activity"] == "2026-10-01T08:00:00Z"  # reported, not scored


def test_no_claims_means_corroboration_is_unavailable(make_client, gh):
    body = active(make_client, gh, payload={})
    assert body["claims"] == []
    c = component(body, "corroboration")
    assert (c["available"], c["value"], c["weight"]) == (False, None, 0)
    assert sum(x["weight"] for x in body["sub_score"]["components"]) == pytest.approx(1.0)


def test_skill_to_language_table():
    from app.skill_languages import language_for

    for skill, lang in (("C++", "C++"), ("c#", "C#"), ("C Sharp", "C#"), ("Golang", "Go"), ("go", "Go"),
                        ("JS", "JavaScript"), ("Java Script", "JavaScript"), ("TYPESCRIPT", "TypeScript"),
                        ("Objective-C", "Objective-C"), ("python3", "Python"), ("node_js", None)):
        assert language_for(skill) == lang, skill
    for tool in ("react", "docker", "aws", "kubernetes", "django", "", "   "):
        assert language_for(tool) is None, tool


# ---- criterion 8

def test_no_repos(make_client, gh):
    forks = evidence(make_client, gh, FORKS, "synth-forks", payload={"claimed_skills": ["Go", "react"]})
    assert len(gh.calls) == 2, "a forks-only user needs no detail call"
    empty_calls_before = len(gh.calls)
    empty = evidence(make_client, gh, EMPTY, "synth-empty")
    assert len(gh.calls) - empty_calls_before == 2
    for body in (forks, empty):
        sub = body["sub_score"]
        assert sub["available"] is False and sub["value"] is None
        assert sub["reason_code"] == "no_public_repositories"
        assert body["status"] == "complete"
    assert forks["repositories"]["forked"] == 2 and forks["repositories"]["owned"] == 0
    assert empty["repositories"]["listed"] == 0 and empty["languages"] == []
    # a language used only by a fork is not_found, and "react" is not_checkable
    assert [(c["skill"], c["status"]) for c in forks["claims"]] == [("Go", "not_found"), ("react", "not_checkable")]


# ---- criterion 9

def test_partial_upstream(make_client, gh):
    client = make_client(account=PARTIAL)
    routes = mount_account(gh, PARTIAL)
    resp = client.post("/v1/evidence", json={"username": "synth-part", "claimed_skills": ["python", "go"]})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "partial"
    assert "repo_detail_failed:bad" in body["limitations"]
    assert "repo_detail_failed:good" not in body["limitations"]
    bad_languages = [c for c in gh.calls if c.request.url.path == "/repos/synth-part/bad/languages"]
    assert len(bad_languages) == 2  # fails, is retried once, fails again
    assert routes  # the recordings were mounted
    sub = body["sub_score"]
    assert sub["available"] is True and sub["partial"] is True and sub["value"] is not None
    assert [x["name"] for x in body["languages"]] == ["Python"]  # computed from the rest
    assert body["commit_activity"]["authored_commits"] == 3
    items = {i["name"]: i for i in body["repositories"]["items"]}
    assert items["bad"]["languages"] is None and items["good"]["languages"] == {"Python": 3000}
    # the failed repo's primary language still corroborates its claim
    assert {c["skill"]: c["status"] for c in body["claims"]} == {"python": "evidenced", "go": "evidenced"}


def test_deadline_partial(make_client, gh):
    client = make_client(account=PARTIAL, GITHUB_DEADLINE_S=1)
    mount_account(gh, PARTIAL, skip=("languages_bad.json", "commits_bad_p1.json"))

    async def never_answers(request):
        await asyncio.sleep(3600)

    gh.get(f"{API_URL}/repos/synth-part/bad/languages").mock(side_effect=never_answers)
    gh.get(f"{API_URL}/repos/synth-part/bad/commits").mock(side_effect=never_answers)
    started = time.monotonic()
    resp = client.post("/v1/evidence", json={"username": "synth-part", "claimed_skills": ["python"]})
    assert time.monotonic() - started < 3
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "partial"
    assert body["limitations"][0] == "deadline_reached"
    assert "repo_detail_failed:bad" in body["limitations"]
    assert body["sub_score"]["available"] is True and body["sub_score"]["partial"] is True
    assert body["commit_activity"]["authored_commits"] == 3  # the repo that finished is kept


def test_deadline_before_the_repo_list_is_still_a_timeout(make_client, gh):
    client = make_client(account=PARTIAL, GITHUB_DEADLINE_S=1)

    async def never_answers(request):
        await asyncio.sleep(3600)

    gh.get(f"{API_URL}/users/synth-part").mock(side_effect=never_answers)
    resp = client.post("/v1/evidence", json={"username": "synth-part"})
    assert resp.status_code == 504 and resp.json()["error"] == "github_timeout"


def test_commit_pages_are_capped(make_client, gh):
    """A busy repo cannot cost unbounded calls: 5 pages of 100, then a limitation names the repo."""
    client = make_client(account=ACTIVE)
    user = load_recording(f"{ACTIVE}/user.json")["response"]
    gh.get(f"{API_URL}/users/synth-active").mock(return_value=httpx.Response(200, json={
        **user["body"], "public_repos": 1}))
    gh.get(f"{API_URL}/users/synth-active/repos").mock(return_value=httpx.Response(200, json=[{
        "name": "busy", "fork": False, "archived": False, "language": "Python", "pushed_at": "2026-10-14T08:00:00Z"}]))
    gh.get(f"{API_URL}/repos/synth-active/busy/languages").mock(return_value=httpx.Response(200, json={"Python": 10}))
    page = [{"sha": f"{i:040x}", "commit": {"author": {"date": "2026-10-14T09:00:00Z"}}} for i in range(100)]
    commits = gh.get(f"{API_URL}/repos/synth-active/busy/commits").mock(return_value=httpx.Response(
        200, json=page, headers={"link": f'<{API_URL}/x?page=9>; rel="next"'}))
    body = client.post("/v1/evidence", json={"username": "synth-active"}).json()
    assert commits.call_count == 5
    assert body["commit_activity"]["authored_commits"] == 500
    assert "commit_pages_capped:busy" in body["limitations"]


# ---- criterion 10

def test_call_budget_synthetic(make_client, gh):
    body = active(make_client, gh)
    pages = len(list((RECORDINGS / ACTIVE).glob("commits_*.json")))
    detail = body["repositories"]["detailed"]
    assert len(gh.calls) == 2 + detail + pages == 11
    assert len(gh.calls) <= 2 + 2 * detail + (pages - detail)


def test_readme_states_the_budget():
    text = (HERE.parents[1] / "github-evidence" / "README.md").read_text(encoding="utf-8")
    assert "calls per candidate" in text.lower()
    assert "candidates per hour" in text.lower()
    assert "5,000" in text


# ---- criterion 11

def test_determinism(make_client, gh):
    first = active(make_client, gh)
    second = active(make_client, gh)
    assert stable(first) == stable(second)
    assert json.dumps(stable(first), sort_keys=False) == json.dumps(stable(second), sort_keys=False)


# ---- the real octocat recording (needs the owner's re-recording)

def octocat_files():
    folder = RECORDINGS / "octocat"
    names = sorted(p.name for p in folder.glob("*.json")) if folder.is_dir() else []
    if account_fetched_at("octocat") is None or not any(n.startswith("languages_") for n in names):
        pytest.skip("PENDING owner step: re-record octocat with the T-0012 recorder "
                    "(github-evidence/tools/record_github.py octocat)")
    return names


def octocat(make_client, gh, **payload):
    octocat_files()
    client = make_client(account="octocat")
    mount_account(gh, "octocat")
    resp = client.post("/v1/evidence", json={"username": "octocat", **payload})
    assert resp.status_code == 200, resp.text
    return resp.json()


def recorded_languages():
    return {n[len("languages_"):-len(".json")]: load_recording(f"octocat/{n}")["response"]["body"]
            for n in octocat_files() if n.startswith("languages_")}


def test_octocat_repository_counts(make_client, gh):
    body = octocat(make_client, gh)
    items = [r for n in octocat_files() if n.startswith("repos_") for r in load_recording(f"octocat/{n}")["response"]["body"]]
    repos = body["repositories"]
    assert body["status"] == "complete"
    assert repos["listed"] == len(items)
    assert repos["forked"] == sum(1 for r in items if r["fork"])
    assert repos["owned"] == sum(1 for r in items if not r["fork"])


def test_octocat_language_breakdown(make_client, gh):
    body = octocat(make_client, gh)
    owned = {r["name"] for n in octocat_files() if n.startswith("repos_")
             for r in load_recording(f"octocat/{n}")["response"]["body"] if not r["fork"]}
    expected = {}
    for repo, langs in recorded_languages().items():
        assert repo in owned, "a fork was recorded"
        for name, n in langs.items():
            expected[name] = expected.get(name, 0) + n
    assert {x["name"]: x["bytes"] for x in body["languages"]} == expected
    if expected:
        assert abs(sum(x["share"] for x in body["languages"]) - 1) <= 0.001
        assert [x["bytes"] for x in body["languages"]] == sorted(expected.values(), reverse=True)


def test_octocat_is_an_inactive_account(make_client, gh):
    """Every octocat push is from 2024, so its 365-day window (pinned to the recording date) is empty."""
    body = octocat(make_client, gh)
    act = body["commit_activity"]
    assert act["available"] is True
    assert act["authored_commits"] == 0 and act["active_weeks"] == 0
    assert act["weekly"] == [0] * 52
    assert component(body, "activity")["value"] == 0.0 and component(body, "consistency")["value"] == 0.0
    assert body["sub_score"]["available"] is True


def test_octocat_languages_are_evidenced_at_any_age(make_client, gh):
    skills = ["html", "css", "javascript", "ruby", "python", "react"]
    body = octocat(make_client, gh, claimed_skills=skills)
    used = set()
    for langs in recorded_languages().values():
        used |= {n.lower() for n in langs}
    for n in octocat_files():
        if n.startswith("repos_"):
            for r in load_recording(f"octocat/{n}")["response"]["body"]:
                if not r["fork"] and r["language"]:
                    used.add(r["language"].lower())
    claims = {c["skill"]: c for c in body["claims"]}
    assert claims["react"]["status"] == "not_checkable"
    for skill in skills[:-1]:
        assert claims[skill]["status"] == ("evidenced" if skill in used else "not_found"), skill
    assert any(c["status"] == "evidenced" for c in claims.values()), "no octocat language was evidenced"
    for c in claims.values():
        if c["status"] == "evidenced":
            assert c["last_activity"] is not None and c["last_activity"] < "2025-01-01"  # old work, still evidence


def test_call_budget(make_client, gh):
    body = octocat(make_client, gh)
    detail = body["repositories"]["detailed"]
    pages = len([n for n in octocat_files() if n.startswith("commits_")])
    assert len(gh.calls) <= 2 + 2 * detail + max(0, pages - detail)


# ---- criterion 12

def test_contract_snapshot(make_client, gh):
    body = octocat(make_client, gh, claimed_skills=["html", "css", "javascript", "react"])
    snapshot = HERE / "snapshots" / "octocat.json"
    assert snapshot.exists(), f"{snapshot} is missing: write it from this response (reviewed in the T-0012 Result)"
    assert stable(body) == json.loads(snapshot.read_text(encoding="utf-8"))
