"""Fixtures for the assessment-service suite (T-0029).

Runs in assessment-service's own venv with its own pytest call (run-suite.ps1),
because its `app` package would clash with github-evidence's `app` in one process.
No port, no LLM: the app is driven through FastAPI's TestClient, and generation
tests replace app.llm_client._complete with a fake (no network).
"""
import os
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
SERVICE_DIR = HERE.parents[1] / "assessment-service"

# Never read a developer's assessment-service/.env (it holds the Gemini key).
os.environ["PYTHON_DOTENV_DISABLED"] = "1"
for var in (
    "ASSESSMENT_HOST", "ASSESSMENT_PORT", "GEMINI_API_KEY", "GEMINI_MODELS",
    "ASSESSMENT_GENERATION_BUDGET_SECONDS", "ASSESSMENT_REQUEST_TIMEOUT_SECONDS",
    "ASSESSMENT_MAX_VALIDATION_ROUNDS", "ASSESSMENT_SERVED_MCQ", "ASSESSMENT_SERVED_SHORT",
    "ASSESSMENT_MCQ_MAX_LENGTH_RATIO", "ASSESSMENT_MCQ_MIN_LENGTH_GAP",
):
    os.environ.pop(var, None)
sys.path.insert(0, str(SERVICE_DIR))


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)
