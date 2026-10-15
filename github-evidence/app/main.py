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
from typing import Callable, Mapping, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import metrics, scoring
from .claims import build_claims
from .config import Settings, get_logger, request_id_var
from .contract import (
    CONTRACT_VERSION, ERRORS, SERVICE_NAME, Claim, CommitActivity, Evidence, EvidenceRequest, Health,
    Language, Profile, RateLimit, Repositories, RepoItem, SubScore, error_body, is_valid_request_id,
)
from .github_client import DetailSpec, Fetched, GitHubClient, GitHubError, RateLimitState

log = get_logger()
DEFAULT_WINDOW_DAYS = metrics.DEFAULT_WINDOW_DAYS


def error_response(code: str, retry_after: Optional[int] = None, headers: Optional[Mapping[str, str]] = None) -> JSONResponse:
    out = dict(headers or {})
    if retry_after:
        out["Retry-After"] = str(retry_after)
    return JSONResponse(error_body(code), status_code=ERRORS[code].status, headers=out or None)


def _text_or_none(value) -> Optional[str]:
    return value if isinstance(value, str) else None


def _iso(epoch: Optional[int]) -> Optional[str]:
    return datetime.fromtimestamp(epoch, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if epoch is not None else None


def build_evidence(fetched: Fetched, *, body: EvidenceRequest, settings: Settings, weights: scoring.Weights,
                   now: datetime, window_days: int, request_id: str, rate: RateLimitState) -> Evidence:
    """Turn what GitHub returned into contract v1: metrics, claims, the sub-score, and the partial labels."""
    repos = fetched.repos
    owned = [r for r in repos if metrics.is_owned(r)]
    details = fetched.details
    failed = [n for n in fetched.selected if details[n].languages is None or details[n].commits is None]
    partial = bool(failed) or fetched.deadline_hit

    languages_by_repo = {n: d.languages for n, d in details.items() if d.languages is not None}
    breakdown = metrics.language_breakdown(languages_by_repo.values())
    commits_by_repo = {n: d.commits for n, d in details.items() if d.commits is not None}
    have_commits = bool(commits_by_repo)
    if have_commits:
        times = [t for ts in commits_by_repo.values() for t in ts]
        weekly = metrics.weekly_buckets(times, now)
        authored, active_weeks = len(times), sum(1 for n in weekly if n)
        with_commits = sum(1 for ts in commits_by_repo.values() if ts)
    else:
        weekly, authored, active_weeks, with_commits = None, None, None, None

    claims = build_claims(body.claimed_skills, owned, languages_by_repo, breakdown)
    sub_score = scoring.compute_subscore(
        owned_nonfork=len(owned), authored_commits=authored, active_weeks=active_weeks,
        owned_with_commits=with_commits,
        evidenced=sum(1 for c in claims if c["status"] == "evidenced"),
        not_found=sum(1 for c in claims if c["status"] == "not_found"),
        weights=weights, partial=partial,
    )

    limitations = ["deadline_reached"] if fetched.deadline_hit else []
    limitations.append("public_repositories_only")
    if fetched.selected:
        limitations += ["default_branch_only", "author_matched_by_login_or_email"]
    if fetched.truncated:
        limitations.append(f"repository_list_capped:{settings.max_repos}")
    if len(owned) > len(fetched.selected):
        limitations.append(f"detail_repos_capped:{settings.detail_repos}")
    limitations += [f"commit_pages_capped:{n}" for n in fetched.selected if details[n].commit_pages_capped]
    limitations += [f"repo_detail_failed:{n}" for n in failed]

    def item(r) -> RepoItem:
        d = details.get(r["name"])
        return RepoItem(
            name=r["name"], fork=bool(r.get("fork")), archived=bool(r.get("archived")),
            pushed_at=_text_or_none(r.get("pushed_at")), primary_language=_text_or_none(r.get("language")),
            authored_commits_window=len(d.commits) if d is not None and d.commits is not None else None,
            languages=d.languages if d is not None else None,
        )

    return Evidence(
        contract_version=CONTRACT_VERSION,
        request_id=request_id,
        username=body.username,
        status="partial" if partial else "complete",
        fetched_at=metrics.fmt_ts(now),
        profile=Profile(public_repos=fetched.profile["public_repos"], html_url=fetched.profile["html_url"]),
        repositories=Repositories(
            listed=len(repos),
            owned=len(owned),
            forked=len(repos) - len(owned),
            archived=sum(1 for r in repos if r.get("archived")),
            considered=len(owned),
            truncated=fetched.truncated,
            detailed=len(fetched.selected),
            with_authored_commits=with_commits,
            items=[item(r) for r in repos],
        ),
        languages=[Language(**x) for x in breakdown],
        commit_activity=CommitActivity(
            available=have_commits, window_days=window_days, authored_commits=authored,
            active_weeks=active_weeks, weeks=metrics.WEEKS, weekly=weekly,
        ),
        claims=[Claim(**c) for c in claims],
        sub_score=SubScore(**sub_score),
        limitations=limitations,
        rate_limit=RateLimit(remaining=rate.remaining, reset_at=_iso(rate.reset)),
    )


def create_app(environ: Optional[Mapping[str, str]] = None,
               clock: Optional[Callable[[], datetime]] = None) -> FastAPI:
    """Build the app. Raises ConfigError (naming the variable, never a value) if GITHUB_TOKEN is unset.

    `clock` returns the current time as an aware datetime. Tests pin it to a recording's `fetched_at`.
    """
    settings = Settings.from_env(os.environ if environ is None else environ)
    logging.basicConfig(format="%(asctime)s %(levelname)s %(name)s %(message)s")

    app = FastAPI(title=SERVICE_NAME, docs_url=None, redoc_url=None, openapi_url=None)
    app.state.settings = settings
    app.state.rate = RateLimitState()
    app.state.weights = scoring.load_weights(settings.subscore_weights)
    now_utc = clock or (lambda: datetime.now(timezone.utc))

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
        now = now_utc().astimezone(timezone.utc).replace(microsecond=0)
        window_days = body.window_days or DEFAULT_WINDOW_DAYS
        try:
            fetched = await GitHubClient(settings, rate).fetch(body.username, DetailSpec(now, window_days))
        except GitHubError as exc:
            log.info("evidence request_id=%s outcome=%s", request.state.request_id, exc.code)
            return error_response(exc.code, exc.retry_after)

        result = build_evidence(fetched, body=body, settings=settings, weights=app.state.weights, now=now,
                                window_days=window_days, request_id=request.state.request_id, rate=rate)
        log.info("evidence request_id=%s outcome=%s listed=%d detailed=%d truncated=%s",
                 request.state.request_id, result.status, len(fetched.repos), len(fetched.selected),
                 fetched.truncated)
        return result

    return app


# `uvicorn app.main:app` needs a module-level app. It is built at import, so a missing
# GITHUB_TOKEN stops the process at boot. The token may come from github-evidence/.env.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")
app = create_app()
