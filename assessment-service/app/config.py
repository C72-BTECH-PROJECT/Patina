import os
from pathlib import Path

from dotenv import load_dotenv

SERVICE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(SERVICE_DIR / ".env")


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    return int(raw) if raw else default


def _float_env(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    return float(raw) if raw else default


# R-07 (D§6.1, Y3): Gemini is the only LLM provider, called through Google's
# OpenAI-compatible endpoint. The key is never logged, echoed or returned.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_BASE_URL = (
    os.getenv("GEMINI_BASE_URL", "").strip()
    or "https://generativelanguage.googleapis.com/v1beta/openai/"
)

# Tried in order, one call each per validation round. Both ids were confirmed on
# 2026-11-12 by listing models with the configured key and making a chat call in
# JSON mode (R-07). `gemini-2.5-flash` is listed by the API but answered 404.
DEFAULT_GEMINI_MODELS = "gemini-3.5-flash,gemini-3.1-flash-lite"
GEMINI_MODELS = [
    model.strip()
    for model in (os.getenv("GEMINI_MODELS", "").strip() or DEFAULT_GEMINI_MODELS).split(",")
    if model.strip()
]

# Time budget for one generate call (D§6.1, SvR 3.11). Core gives up at 300 s, so
# the whole generation (every model, every validation round) is capped below 240 s.
# Each LLM call gets min(ASSESSMENT_REQUEST_TIMEOUT_SECONDS, time left), enforced on
# the wall clock, and no call starts with less than MIN_CALL_SECONDS left.
MAX_GENERATION_BUDGET_SECONDS = 230.0
GENERATION_BUDGET_SECONDS = _float_env("ASSESSMENT_GENERATION_BUDGET_SECONDS", 210.0)
REQUEST_TIMEOUT_SECONDS = _float_env("ASSESSMENT_REQUEST_TIMEOUT_SECONDS", 120.0)
MIN_CALL_SECONDS = 10.0
MAX_VALIDATION_ROUNDS = _int_env("ASSESSMENT_MAX_VALIDATION_ROUNDS", 2)

if not 0 < GENERATION_BUDGET_SECONDS <= MAX_GENERATION_BUDGET_SECONDS:
    raise ValueError(
        "ASSESSMENT_GENERATION_BUDGET_SECONDS must be in (0, "
        f"{MAX_GENERATION_BUDGET_SECONDS:.0f}]; core times out at 300 s."
    )
if REQUEST_TIMEOUT_SECONDS <= 0:
    raise ValueError("ASSESSMENT_REQUEST_TIMEOUT_SECONDS must be positive.")
if MAX_VALIDATION_ROUNDS < 1:
    raise ValueError("ASSESSMENT_MAX_VALIDATION_ROUNDS must be at least 1.")

# Served draw (D§6.2): 20 questions are generated (10 MCQ, 10 short answer); a
# random 6 MCQ + 4 short answer are served. The rest are never sent.
GENERATED_MCQ = 10
GENERATED_SHORT = 10
SERVED_MCQ = _int_env("ASSESSMENT_SERVED_MCQ", 6)
SERVED_SHORT = _int_env("ASSESSMENT_SERVED_SHORT", 4)
if not 0 <= SERVED_MCQ <= GENERATED_MCQ or not 0 <= SERVED_SHORT <= GENERATED_SHORT:
    raise ValueError(
        f"ASSESSMENT_SERVED_MCQ must be 0-{GENERATED_MCQ} and "
        f"ASSESSMENT_SERVED_SHORT 0-{GENERATED_SHORT}."
    )
if SERVED_MCQ + SERVED_SHORT == 0:
    raise ValueError("At least one question must be served.")

# T-0029 (I-0061, DEC-5): internal only. Core calls this service; the browser
# never does. Bind loopback on :8002 (the backend default, ASSESSMENT_SERVICE_URL)
# unless overridden; started with `python -m app` (app/__main__.py).
HOST = os.getenv("ASSESSMENT_HOST", "127.0.0.1").strip() or "127.0.0.1"
PORT = int(os.getenv("ASSESSMENT_PORT", "8002"))

SERVICE_NAME = "Patina AI Assessment Service"


def llm_configured() -> bool:
    """True when a Gemini key and at least one model are configured. Never the key."""
    return bool(GEMINI_API_KEY) and bool(GEMINI_MODELS)
