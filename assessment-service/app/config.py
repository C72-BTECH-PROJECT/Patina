import os
from pathlib import Path

from dotenv import load_dotenv

SERVICE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(SERVICE_DIR / ".env")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Gemini (primary). OpenAI-compatible endpoint.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_BASE_URL = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
GEMINI_MODELS = [
    m.strip()
    for m in os.getenv(
        "GEMINI_MODELS",
        os.getenv("GEMINI_MODEL", "gemini-3.8-flash"),
    ).split(",")
    if m.strip()
]

FREE_MODELS = [
    model.strip()
    for model in os.getenv(
        "OPENROUTER_FREE_MODELS",
        "openai/gpt-oss-20b:free,google/gemma-3-27b-it:free",
    ).split(",")
    if model.strip()
]

REQUEST_TIMEOUT_SECONDS = float(
    os.getenv("ASSESSMENT_REQUEST_TIMEOUT_SECONDS", "60")
)
MAX_RETRIES_PER_MODEL = int(
    os.getenv("ASSESSMENT_MAX_RETRIES_PER_MODEL", "2")
)

# T-0029 (I-0061, DEC-5): internal only. Core calls this service; the browser
# never does. Bind loopback on :8002 (the backend default, ASSESSMENT_SERVICE_URL)
# unless overridden; started with `python -m app` (app/__main__.py).
HOST = os.getenv("ASSESSMENT_HOST", "127.0.0.1").strip() or "127.0.0.1"
PORT = int(os.getenv("ASSESSMENT_PORT", "8002"))

PROMPT_VERSION = "assessment-v1"
SERVICE_NAME = "Patina AI Assessment Service"