import os
from pathlib import Path

from dotenv import load_dotenv

SERVICE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(SERVICE_DIR / ".env")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "").strip()
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

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

PROMPT_VERSION = "assessment-v1"
SERVICE_NAME = "Patina AI Assessment Service"