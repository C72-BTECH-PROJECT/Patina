"""T-0029 criterion 4: assessment-service is internal only (I-0061, I-0066, I-0060).

- FastAPI's /docs, /redoc and /openapi.json are off (DEC-5, as github-evidence).
- The service binds 127.0.0.1:8002 by default, from app/config.py, through
  `python -m app` (app/__main__.py).
- Every start command in assessment-service/README.md binds 127.0.0.1 on :8002.
"""
import importlib
import re
import runpy

from conftest import SERVICE_DIR


def test_docs_are_off(client):
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404, path


def test_health_still_answers(client):
    assert client.get("/").status_code == 200


def test_default_bind_is_loopback_8002(monkeypatch):
    monkeypatch.delenv("ASSESSMENT_HOST", raising=False)
    monkeypatch.delenv("ASSESSMENT_PORT", raising=False)
    import app.config as config

    config = importlib.reload(config)
    assert config.HOST == "127.0.0.1"
    assert config.PORT == 8002


def test_python_dash_m_app_runs_uvicorn_on_the_configured_bind(monkeypatch):
    import uvicorn

    calls = []
    monkeypatch.setattr(uvicorn, "run", lambda *a, **kw: calls.append((a, kw)))
    runpy.run_module("app", run_name="__main__", alter_sys=False)
    assert len(calls) == 1
    _, kw = calls[0]
    assert kw.get("host") == "127.0.0.1"
    assert kw.get("port") == 8002


def test_readme_start_commands_bind_loopback_8002():
    readme = (SERVICE_DIR / "README.md").read_text(encoding="utf-8")
    commands = [
        line for line in readme.splitlines()
        if re.search(r"\buvicorn\b.*app\.main:app|python(\.exe)? -m app\b", line)
    ]
    assert commands, "README has no start command"
    for line in commands:
        assert "0.0.0.0" not in line, line
        if "--port" in line:
            assert "--port 8002" in line, line
        if "--host" in line:
            assert "--host 127.0.0.1" in line, line
    assert ":8000" not in readme, "README still points at :8000 (NLP's port)"
