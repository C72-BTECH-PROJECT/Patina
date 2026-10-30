"""Regenerate tests/backend/fixtures/github-evidence-example-mokafor.json (T-0014).

SYNTHETIC. `example-mokafor` is the fixture login on tests/fixtures/f1_dev_github.pdf;
it is not a real GitHub account and nothing here calls GitHub. The response is
produced by the real github-evidence service, in process, replaying the synthetic
recording set `tests/github/recordings/synthetic/active` with its login
`synth-active` rewritten to `example-mokafor` in memory (the recordings on disk
are not touched). The clock is pinned to that set's `fetched_at` from the
manifest, and `claimed_skills` are f1's parsed skills from the NLP snapshot, so
the output is deterministic.

    github-evidence\\venv\\Scripts\\python tests\\backend\\fixtures\\make-github-evidence-fixture.py
"""
import json
import os
import sys
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
RECORDINGS = REPO / "tests" / "github" / "recordings"
ACCOUNT = "synthetic/active"
SOURCE_LOGIN = "synth-active"
LOGIN = "example-mokafor"
API_URL = "https://github-stub.invalid"
OUT = HERE / "github-evidence-example-mokafor.json"

# Before the service is imported: never load github-evidence/.env, never reach GitHub.
os.environ["GITHUB_TOKEN"] = "fixture-token-not-a-real-credential"
os.environ["GITHUB_API_URL"] = API_URL
os.environ["PYTHON_DOTENV_DISABLED"] = "1"
for name in ("GITHUB_MAX_REPOS", "GITHUB_HTTP_TIMEOUT_S", "GITHUB_DEADLINE_S", "GITHUB_MIN_REMAINING",
             "GITHUB_DETAIL_REPOS", "GITHUB_CONCURRENCY", "GITHUB_SUBSCORE_WEIGHTS"):
    os.environ.pop(name, None)
sys.path.insert(0, str(REPO / "github-evidence"))

import httpx  # noqa: E402
import respx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402


def main():
    manifest = json.loads((RECORDINGS / "manifest.json").read_text(encoding="utf-8"))
    fetched_at = datetime.fromisoformat(manifest["accounts"][ACCOUNT]["fetched_at"].replace("Z", "+00:00"))
    snapshot = json.loads((REPO / "tests/nlp/snapshots/current/f1_dev_github.json").read_text(encoding="utf-8"))
    skills = snapshot["entities"]["skills"]

    with respx.mock(assert_all_mocked=True, assert_all_called=False) as router:
        for f in sorted((RECORDINGS / ACCOUNT).glob("*.json")):
            rec = json.loads(f.read_text(encoding="utf-8").replace(SOURCE_LOGIN, LOGIN))
            req, resp = rec["request"], rec["response"]
            router.request(req["method"], f"{API_URL}{req['path']}", params=req["query"] or None).mock(
                return_value=httpx.Response(resp["status"], headers=resp["headers"], json=resp["body"]))
        client = TestClient(create_app(clock=lambda: fetched_at))
        r = client.post("/v1/evidence", headers={"X-Request-ID": "t0014-fixture"},
                        json={"username": LOGIN, "claimed_skills": skills, "window_days": 365})
    if r.status_code != 200:
        raise SystemExit(f"service answered {r.status_code}: {r.text}")

    body = {"_source": f"{ACCOUNT} via tests/backend/fixtures/make-github-evidence-fixture.py; "
                       "synthetic, not a real GitHub account", **r.json()}
    OUT.write_text(json.dumps(body, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT.relative_to(REPO)} (sub_score {body['sub_score']['value']}, status {body['status']})")


if __name__ == "__main__":
    main()
