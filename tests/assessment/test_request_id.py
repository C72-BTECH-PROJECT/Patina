"""T-0031 (f): I-0062. assessment-service echoes a valid X-Request-ID and replaces
an invalid one, under the same rule as github-evidence (^[A-Za-z0-9-]{1,64}$).
"""
import re

import pytest

VALID = re.compile(r"^[A-Za-z0-9-]{1,64}$")


def test_valid_id_is_echoed(client):
    r = client.get("/", headers={"X-Request-ID": "req-t0031-AB"})
    assert r.headers["x-request-id"] == "req-t0031-AB"


@pytest.mark.parametrize("supplied", ["bad id!", "a" * 65, "semi;colon", ""])
def test_invalid_id_is_replaced(client, supplied):
    r = client.get("/", headers={"X-Request-ID": supplied})
    echoed = r.headers["x-request-id"]
    assert echoed != supplied
    assert VALID.match(echoed)


def test_missing_id_gets_one(client):
    assert VALID.match(client.get("/").headers["x-request-id"])


def test_a_failed_request_still_carries_the_id(client):
    r = client.post("/generate-assessment", json={}, headers={"X-Request-ID": "req-invalid-body"})
    assert r.status_code == 422
    assert r.headers["x-request-id"] == "req-invalid-body"
