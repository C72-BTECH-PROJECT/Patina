"""GitHub REST client: token, pagination, rate limits, one retry, a deadline (T-0011).

Rules come from ROADMAP §1.5 (now github-evidence/README.md). Nothing here puts a URL,
a GitHub response body or the token into an exception message or a log line.
"""
import asyncio
import logging
import math
import random
import re
import time
from dataclasses import dataclass, field
from http.cookiejar import DefaultCookiePolicy
from typing import Callable, Optional

import httpx

from .config import Settings, get_logger
from .contract import is_valid_login

API_VERSION = "2022-11-28"
USER_AGENT = "patina-github-evidence/1"
PAGE_SIZE = 100
RETRY_JITTER_S = (0.05, 0.25)
MAX_SECONDARY_WAIT_S = 1.0

log = get_logger()
# httpx logs every request URL at INFO. The URL is internal configuration: keep it out of the logs.
for _noisy in ("httpx", "httpcore"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

_NEXT = re.compile(r'<[^>]*>\s*;[^,]*?\brel="?next"?', re.IGNORECASE)


class GitHubError(Exception):
    """A failure with a contract error code. str() is the code only: no GitHub text, no URL."""

    def __init__(self, code: str, retry_after: Optional[int] = None):
        super().__init__(code)
        self.code = code
        self.retry_after = retry_after


def has_next_page(link_header: Optional[str]) -> bool:
    """True when the Link header announces a next page. The URL in it is never followed."""
    return bool(link_header) and _NEXT.search(link_header) is not None


def _int(value: Optional[str]) -> Optional[int]:
    try:
        return int(value) if value is not None and value.strip() != "" else None
    except ValueError:
        return None


def _seconds(value: Optional[str]) -> Optional[float]:
    try:
        number = float(value) if value is not None and value.strip() != "" else None
    except ValueError:
        return None
    return number if number is not None and number >= 0 else None


class RateLimitState:
    """What GitHub last said about our primary limit, kept in process (per app)."""

    def __init__(self) -> None:
        self.remaining: Optional[int] = None
        self.reset: Optional[int] = None

    def update(self, headers: httpx.Headers) -> None:
        remaining = _int(headers.get("x-ratelimit-remaining"))
        reset = _int(headers.get("x-ratelimit-reset"))
        if remaining is not None:
            self.remaining = remaining
        if reset is not None:
            self.reset = reset

    def blocked_for(self, min_remaining: int, now: float) -> Optional[int]:
        """Seconds to wait if we are below the low-water mark and the window has not reset yet."""
        if self.remaining is None or self.reset is None or self.remaining >= min_remaining:
            return None
        wait = self.reset - now
        return max(1, math.ceil(wait)) if wait > 0 else None

    def reset_in(self, now: float) -> Optional[int]:
        return max(1, math.ceil(self.reset - now)) if self.reset is not None else None


@dataclass
class Fetched:
    profile: dict
    repos: list = field(default_factory=list)
    truncated: bool = False


Observer = Callable[[httpx.Request, httpx.Response], None]


class GitHubClient:
    def __init__(self, settings: Settings, rate: RateLimitState, observer: Optional[Observer] = None):
        self.settings = settings
        self.rate = rate
        self.observer = observer

    # ---- public

    async def fetch(self, login: str) -> Fetched:
        """The profile and the repository list (up to max_repos) of a public GitHub user."""
        if not is_valid_login(login):
            raise ValueError("not a GitHub login")
        wait = self.rate.blocked_for(self.settings.min_remaining, time.time())
        if wait is not None:
            raise GitHubError("github_rate_limited", wait)
        deadline_at = asyncio.get_running_loop().time() + self.settings.deadline_s
        try:
            async with asyncio.timeout(self.settings.deadline_s):
                async with self._http() as http:
                    profile = await self._profile(http, login, deadline_at)
                    repos, truncated = await self._repos(http, login, deadline_at)
        except TimeoutError:
            raise GitHubError("github_timeout") from None
        return Fetched(profile=profile, repos=repos, truncated=truncated)

    # ---- calls

    def _http(self) -> httpx.AsyncClient:
        http = httpx.AsyncClient(
            base_url=self.settings.api_url,
            timeout=self.settings.http_timeout_s,
            headers={
                "Authorization": f"Bearer {self.settings.token}",
                "X-GitHub-Api-Version": API_VERSION,
                "Accept": "application/vnd.github+json",
                "User-Agent": USER_AGENT,
            },
            follow_redirects=False,
            trust_env=False,  # no proxy settings or ~/.netrc credentials
        )
        http.cookies.jar.set_policy(DefaultCookiePolicy(allowed_domains=[]))  # never store or send cookies
        return http

    async def _profile(self, http: httpx.AsyncClient, login: str, deadline_at: float) -> dict:
        data = await self._get_json(http, f"/users/{login}", None, deadline_at)
        if not isinstance(data, dict) or not isinstance(data.get("public_repos"), int) \
                or not isinstance(data.get("html_url"), str):
            raise GitHubError("github_upstream_error")
        return data

    async def _repos(self, http: httpx.AsyncClient, login: str, deadline_at: float):
        cap = self.settings.max_repos
        repos: list = []
        page = 1
        while True:
            params = {"type": "owner", "sort": "pushed", "direction": "desc", "per_page": PAGE_SIZE, "page": page}
            response = await self._get(http, f"/users/{login}/repos", params, deadline_at)
            items = self._json(response)
            if not isinstance(items, list) or not all(isinstance(i, dict) and isinstance(i.get("name"), str) for i in items):
                raise GitHubError("github_upstream_error")
            more = has_next_page(response.headers.get("link"))
            room = cap - len(repos)
            if len(items) >= room:
                repos.extend(items[:room])
                return repos, more or len(items) > room
            repos.extend(items)
            if not more or not items:
                return repos, False
            page += 1

    async def _get_json(self, http, path, params, deadline_at):
        return self._json(await self._get(http, path, params, deadline_at))

    @staticmethod
    def _json(response: httpx.Response):
        try:
            return response.json()
        except ValueError:
            raise GitHubError("github_upstream_error") from None

    async def _get(self, http: httpx.AsyncClient, path: str, params, deadline_at: float) -> httpx.Response:
        """One GET with at most one retry (5xx, connection error, or a short secondary-limit wait)."""
        loop = asyncio.get_running_loop()
        attempt = 0
        while True:
            attempt += 1
            try:
                response = await http.get(path, params=params)
            except httpx.TimeoutException:
                raise GitHubError("github_timeout") from None
            except httpx.TransportError as exc:
                if attempt == 1:
                    log.info("github retry reason=%s", type(exc).__name__)
                    await asyncio.sleep(random.uniform(*RETRY_JITTER_S))
                    continue
                raise GitHubError("github_upstream_error") from None

            self.rate.update(response.headers)
            if self.observer is not None:
                self.observer(response.request, response)
            status = response.status_code
            if status < 400:
                return response
            if status == 404:
                raise GitHubError("github_user_not_found")
            if status == 401:
                raise GitHubError("github_auth_failed")
            if status in (403, 429):
                if _int(response.headers.get("x-ratelimit-remaining")) == 0:
                    raise GitHubError("github_rate_limited", self.rate.reset_in(time.time()) or 60)
                wait = _seconds(response.headers.get("retry-after"))
                if wait is not None:
                    if attempt == 1 and wait <= MAX_SECONDARY_WAIT_S and loop.time() + wait < deadline_at:
                        log.info("github retry reason=secondary_limit")
                        await asyncio.sleep(wait)
                        continue
                    raise GitHubError("github_rate_limited", max(1, math.ceil(wait)))
                if status == 429:
                    raise GitHubError("github_rate_limited")
                raise GitHubError("github_upstream_error")
            if status >= 500 and attempt == 1:
                log.info("github retry reason=http_%d", status)
                await asyncio.sleep(random.uniform(*RETRY_JITTER_S))
                continue
            raise GitHubError("github_upstream_error")
