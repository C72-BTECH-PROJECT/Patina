"""Environment settings and the request-scoped logger (T-0011)."""
import contextvars
import logging
from dataclasses import dataclass
from typing import Mapping

DEFAULT_API_URL = "https://api.github.com"

# The request id of the request being served, "-" outside a request. Set by the
# middleware in main.py and copied onto every log record by RequestIdFilter.
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


class ConfigError(RuntimeError):
    """A setting is missing or invalid. The message names the variable, never its value."""


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def get_logger() -> logging.Logger:
    log = logging.getLogger("github_evidence")
    if not any(isinstance(f, RequestIdFilter) for f in log.filters):
        log.addFilter(RequestIdFilter())
    log.setLevel(logging.INFO)
    return log


def _number(environ: Mapping[str, str], name: str, default: float, *, integer: bool, minimum: float) -> float:
    raw = environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw) if integer else float(raw)
    except ValueError:
        raise ConfigError(f"{name} must be a {'whole number' if integer else 'number'}") from None
    if value < minimum:
        raise ConfigError(f"{name} must be at least {minimum:g}")
    return value


@dataclass(frozen=True)
class Settings:
    token: str = ""
    api_url: str = DEFAULT_API_URL
    max_repos: int = 100
    http_timeout_s: float = 4.0
    deadline_s: float = 6.0
    min_remaining: int = 100

    def __repr__(self) -> str:  # the token must not reach a log through repr()
        return "Settings(token=<hidden>, ...)"

    @classmethod
    def from_env(cls, environ: Mapping[str, str]) -> "Settings":
        token = (environ.get("GITHUB_TOKEN") or "").strip()
        if not token:
            raise ConfigError("GITHUB_TOKEN is required and is not set")
        api_url = (environ.get("GITHUB_API_URL") or DEFAULT_API_URL).strip().rstrip("/")
        return cls(
            token=token,
            api_url=api_url,
            max_repos=int(_number(environ, "GITHUB_MAX_REPOS", 100, integer=True, minimum=1)),
            http_timeout_s=float(_number(environ, "GITHUB_HTTP_TIMEOUT_S", 4, integer=False, minimum=0.1)),
            deadline_s=float(_number(environ, "GITHUB_DEADLINE_S", 6, integer=False, minimum=0.1)),
            min_remaining=int(_number(environ, "GITHUB_MIN_REMAINING", 100, integer=True, minimum=0)),
        )
