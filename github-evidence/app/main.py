"""github-evidence service: contract v1 over FastAPI (T-0011).

Internal only (DEC-5): no CORS, no docs pages. Core calls it; the browser never does.
Start: uvicorn app.main:app --host 127.0.0.1 --port 8001
"""
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Mapping, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Settings, get_logger, request_id_var
from .contract import (
    CONTRACT_VERSION, ERRORS, SERVICE_NAME, Evidence, EvidenceRequest, Health, Profile,
    RateLimit, Repositories, RepoItem, error_body, is_valid_request_id,
)
from .github_client import GitHubClient, GitHubError, RateLimitState

log = get_logger()


def error_response(code: str, retry_after: Optional[int] = None, headers: Optional[Mapping[str, str]] = None) -> JSONResponse:
    out = dict(headers or {})
    if retry_after:
        out["Retry-After"] = str(retry_after)
    return JSONResponse(error_body(code), status_code=ERRORS[code].status, headers=out or None)


def _text_or_none(value) -> Optional[str]:
    return value if isinstance(value, str) else None


def _iso(epoch: Optional[int]) -> Optional[str]:
    return datetime.fromtimestamp(epoch, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if epoch is not None else None


def create_app(environ: Optional[Mapping[str, str]] = None) -> FastAPI:
    """Build the app. Raises ConfigError (naming the variable, never a value) if GITHUB_TOKEN is unset."""
    settings = Settings.from_env(os.environ if environ is None else environ)
    logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s %(message)s")

    app = FastAPI(title=SERVICE_NAME, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings = settings
    app.state.rate = RateLimitState()

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        supplied = request.headers.get("x-request-id", "")
        rid = supplied if is_valid_request_id(supplied) else str(uuid.uuid4())
        request.state.request_id = rid
        marker = request_id_var.set(rid)
        started = time.monotonic()
        try:
            try:
                response = await call_next(request)
            except Exception as exc:  # never show internals; the type name is enough for the log
                log.error("unhandled request_id=%s error=%s", rid, type(exc).__name__)
                response = error_response("internal_error")
            response.headers["X-Request-ID"] = rid
            log.info("request request_id=%s method=%s path=%s status=%d ms=%d", rid, request.method,
                     request.url.path, response.status_code, (time.monotonic() - started) * 1000)
            return response
        finally:
            request_id_var.reset(marker)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, exc: RequestValidationError):
        return error_response("invalid_request")

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "invalid_request")
        return error_response(code, headers=exc.headers)

    @app.get("/health")
    async def health() -> Health:
        return Health(status="ok", service=SERVICE_NAME, contract_version=CONTRACT_VERSION, token_configured=True)

    @app.post("/v1/evidence")
    async def evidence(body: EvidenceRequest, request: Request):
        rate = app.state.rate
        try:
            fetched = await GitHubClient(settings, rate).fetch(body.username)
        except GitHubError as exc:
            log.info("evidence request_id=%s outcome=%s", request.state.request_id, exc.code)
            return error_response(exc.code, exc.retry_after)

        repos = fetched.repos
        owned = [r for r in repos if not r.get("fork")]
        limitations = ["public_repositories_only"]
        if fetched.truncated:
            limitations.append(f"repository_list_capped:{settings.max_repos}")
        log.info("evidence request_id=%s outcome=complete listed=%d truncated=%s",
                 request.state.request_id, len(repos), fetched.truncated)
        return Evidence(
            contract_version=CONTRACT_VERSION,
            request_id=request.state.request_id,
            username=body.username,
            status="complete",
            fetched_at=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            profile=Profile(public_repos=fetched.profile["public_repos"], html_url=fetched.profile["html_url"]),
            repositories=Repositories(
                listed=len(repos),
                owned=len(owned),
                forked=len(repos) - len(owned),
                archived=sum(1 for r in repos if r.get("archived")),
                considered=len(owned),
                truncated=fetched.truncated,
                items=[RepoItem(name=r["name"], fork=bool(r.get("fork")), archived=bool(r.get("archived")),
                                pushed_at=_text_or_none(r.get("pushed_at")),
                                primary_language=_text_or_none(r.get("language"))) for r in repos],
            ),
            limitations=limitations,
            rate_limit=RateLimit(remaining=rate.remaining, reset_at=_iso(rate.reset)),
        )

    return app


# `uvicorn app.main:app` needs a module-level app. It is built at import, so a missing
# GITHUB_TOKEN stops the process at boot. The token may come from github-evidence/.env.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
app = create_app()
