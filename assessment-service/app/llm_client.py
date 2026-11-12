"""Gemini client (R-07, D§6.1).

One loop over `config.GEMINI_MODELS`, one call per model, through Google's
OpenAI-compatible endpoint in JSON response mode. Every call is bounded on the
wall clock by the caller's deadline, so a generate request can never run past
`config.GENERATION_BUDGET_SECONDS`.

Errors name the model and the kind of failure. They never contain key material:
provider text is passed through `_sanitize` before it is kept.
"""
import json
import re
import threading
import time

from openai import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    OpenAI,
    RateLimitError,
)

from app import config

DEFAULT_SYSTEM_PROMPT = (
    "You generate technical assessments. Follow the user's instructions and "
    "return only valid JSON."
)

# Applied in order: Google API keys, "Bearer <x>", then "key=<x>" / "token: <x>".
_KEY_PATTERNS = (
    (re.compile(r"AIza[0-9A-Za-z_\-]{10,}"), "[redacted]"),
    (re.compile(r"(?i)\b(bearer)\s+[^\s&,;\"']+"), r"\1 [redacted]"),
    (re.compile(r"(?i)\b(api[_-]?key|key|token|authorization)(\s*[=:]\s*)[^\s&,;\"']+"), r"\1\2[redacted]"),
)


class AssessmentLLMError(Exception):
    """No usable LLM output. `code` is a plain token core can read."""

    status_code = 502

    def __init__(self, message: str, code: str = "llm_unavailable"):
        super().__init__(message)
        self.code = code


class LLMNotConfigured(AssessmentLLMError):
    status_code = 503

    def __init__(self, message: str):
        super().__init__(message, code="llm_not_configured")


class _WallClockTimeout(Exception):
    pass


def _sanitize(text: str, limit: int = 200) -> str:
    """One line, bounded, with anything key-shaped removed."""
    text = str(text or "")
    if config.GEMINI_API_KEY:
        text = text.replace(config.GEMINI_API_KEY, "[redacted]")
    for pattern, replacement in _KEY_PATTERNS:
        text = pattern.sub(replacement, text)
    text = " ".join(text.split())
    return text[:limit]


def _complete(model: str, messages: list[dict], timeout: float):
    """One chat completion in JSON mode. Returns (content, finish_reason).

    Tests replace this function with a fake; nothing else talks to the network.
    """
    client = OpenAI(
        api_key=config.GEMINI_API_KEY,
        base_url=config.GEMINI_BASE_URL,
        timeout=timeout,
        max_retries=0,
    )
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        choice = response.choices[0]
        return choice.message.content, choice.finish_reason
    finally:
        client.close()


def _run_with_deadline(fn, seconds: float):
    """Run fn in a daemon thread and stop waiting after `seconds`.

    The HTTP timeout is per socket phase, not total, so this is what makes the
    budget a hard wall-clock bound. An abandoned call ends on its own HTTP timeout.
    """
    outcome: dict = {}

    def target():
        try:
            outcome["value"] = fn()
        except BaseException as exc:  # handed back to the caller below
            outcome["error"] = exc

    worker = threading.Thread(target=target, daemon=True, name="gemini-call")
    worker.start()
    worker.join(seconds)
    if worker.is_alive():
        raise _WallClockTimeout()
    if "error" in outcome:
        raise outcome["error"]
    return outcome["value"]


def _describe(exc: BaseException, timeout: float) -> tuple[str, str]:
    """(kind, text) for one failed call. kind is 'output' or 'transport'."""
    if isinstance(exc, (_WallClockTimeout, APITimeoutError)):
        return "transport", f"timed out after {timeout:.0f}s"
    if isinstance(exc, RateLimitError):
        return "transport", f"HTTP 429 rate limit or quota: {_sanitize(exc.message)}"
    if isinstance(exc, APIStatusError):
        return "transport", f"HTTP {exc.status_code}: {_sanitize(exc.message)}"
    if isinstance(exc, APIConnectionError):
        return "transport", "connection to the Gemini endpoint failed"
    return "transport", f"{type(exc).__name__}: {_sanitize(str(exc))}"


def generate_json(
    prompt: str,
    *,
    system: str = DEFAULT_SYSTEM_PROMPT,
    deadline: float | None = None,
) -> tuple[dict, str]:
    """Return (parsed JSON object, model id) from the first model that gives one.

    `deadline` is a time.monotonic() value; by default the generation budget
    from now. Raises LLMNotConfigured or AssessmentLLMError naming each model's
    failure.
    """
    if not config.GEMINI_API_KEY:
        raise LLMNotConfigured(
            "No LLM is configured: GEMINI_API_KEY is empty in assessment-service/.env."
        )
    if not config.GEMINI_MODELS:
        raise LLMNotConfigured("No LLM is configured: GEMINI_MODELS is empty.")

    if deadline is None:
        deadline = time.monotonic() + config.GENERATION_BUDGET_SECONDS

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": prompt},
    ]
    failures: list[tuple[str, str]] = []

    for model in config.GEMINI_MODELS:
        remaining = deadline - time.monotonic()
        if remaining < config.MIN_CALL_SECONDS:
            failures.append(("transport", f"{model}: not tried, time budget used up"))
            break
        timeout = min(config.REQUEST_TIMEOUT_SECONDS, remaining)

        try:
            result = _run_with_deadline(
                lambda m=model, t=timeout: _complete(m, messages, t), timeout
            )
        except Exception as exc:
            kind, text = _describe(exc, timeout)
            failures.append((kind, f"{model}: {text}"))
            continue

        content, finish_reason = (
            result if isinstance(result, tuple) else (result, None)
        )
        if not content or not str(content).strip():
            failures.append(
                ("output", f"{model}: empty response (finish_reason={finish_reason})")
            )
            continue
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            truncated = " (output cut off at the token limit)" if finish_reason == "length" else ""
            failures.append(
                ("output", f"{model}: invalid JSON, {exc.msg} at char {exc.pos}{truncated}")
            )
            continue
        if not isinstance(parsed, dict):
            failures.append(
                ("output", f"{model}: JSON is a {type(parsed).__name__}, not an object")
            )
            continue
        return parsed, model

    code = (
        "llm_invalid_output"
        if failures and all(kind == "output" for kind, _ in failures)
        else "llm_unavailable"
    )
    raise AssessmentLLMError(
        "Every configured Gemini model failed. "
        + "; ".join(text for _, text in failures),
        code=code,
    )
