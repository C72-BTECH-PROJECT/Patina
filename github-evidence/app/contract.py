"""Contract v1: request and response models and the error table (T-0011)."""
import re
from typing import NamedTuple, Optional

from pydantic import BaseModel, ConfigDict, Field, StrictInt, StrictStr, field_validator

CONTRACT_VERSION = "1"
SERVICE_NAME = "github-evidence"

# GitHub logins: 1-39 ASCII letters, digits and single hyphens, none at either end.
_LOGIN = re.compile(r"[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*")
_REQUEST_ID = re.compile(r"[A-Za-z0-9-]{1,64}")


def is_valid_login(value: str) -> bool:
    return len(value) <= 39 and _LOGIN.fullmatch(value) is not None


def is_valid_request_id(value: str) -> bool:
    return _REQUEST_ID.fullmatch(value) is not None


class ErrorSpec(NamedTuple):
    status: int
    message: str


# Messages are fixed text: never GitHub's body, the token or an internal URL.
ERRORS = {
    "invalid_request": ErrorSpec(400, "The request is not valid."),
    "not_found": ErrorSpec(404, "No such endpoint."),
    "method_not_allowed": ErrorSpec(405, "Method not allowed."),
    "github_user_not_found": ErrorSpec(404, "The GitHub user does not exist."),
    "github_rate_limited": ErrorSpec(503, "GitHub's request limit was reached."),
    "github_auth_failed": ErrorSpec(503, "The service's GitHub credentials were rejected."),
    "github_upstream_error": ErrorSpec(502, "GitHub did not return a usable answer."),
    "github_timeout": ErrorSpec(504, "GitHub did not answer in time."),
    "internal_error": ErrorSpec(500, "The service failed unexpectedly."),
}


def error_body(code: str) -> dict:
    return {"error": code, "message": ERRORS[code].message}


class EvidenceRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    username: StrictStr
    claimed_skills: Optional[list[StrictStr]] = Field(default=None, max_length=200)
    window_days: Optional[StrictInt] = Field(default=None, ge=1, le=730)

    @field_validator("username")
    @classmethod
    def _login(cls, value: str) -> str:
        if not is_valid_login(value):
            raise ValueError("not a GitHub login")
        return value


class Health(BaseModel):
    status: str
    service: str
    contract_version: str
    token_configured: bool


class Profile(BaseModel):
    public_repos: int
    html_url: str


class RepoItem(BaseModel):
    name: str
    fork: bool
    archived: bool
    pushed_at: Optional[str]
    primary_language: Optional[str]
    # T-0012: null unless the repo is a detail repo and the call succeeded.
    authored_commits_window: Optional[int] = None
    languages: Optional[dict[str, int]] = None


class Repositories(BaseModel):
    listed: int
    owned: int
    forked: int
    archived: int
    considered: int
    truncated: bool
    detailed: int = 0  # T-0012: detail repos selected (owned, archived included, GITHUB_DETAIL_REPOS most recent)
    with_authored_commits: Optional[int] = None  # detail repos with at least one authored commit; null without commit data
    items: list[RepoItem]


class Language(BaseModel):
    name: str
    bytes: int
    share: float


class CommitActivity(BaseModel):
    available: bool
    window_days: int
    authored_commits: Optional[int]
    active_weeks: Optional[int]
    weeks: int
    weekly: Optional[list[int]]


class Claim(BaseModel):
    skill: str
    language: Optional[str]
    status: str  # evidenced | not_found | not_checkable
    share: Optional[float]
    repos: list[str]
    last_activity: Optional[str]


class Component(BaseModel):
    key: str
    value: Optional[float]
    weight: float
    available: bool
    reason: Optional[str]


class SubScore(BaseModel):
    available: bool
    value: Optional[float]
    reason_code: Optional[str]
    weights_source: str
    partial: bool
    components: list[Component]


class RateLimit(BaseModel):
    remaining: Optional[int]
    reset_at: Optional[str]


class Evidence(BaseModel):
    contract_version: str
    request_id: str
    username: str
    status: str  # "complete" | "partial" (a detail call failed, or the deadline hit after the repo list)
    fetched_at: str
    profile: Profile
    repositories: Repositories
    languages: list[Language]
    commit_activity: CommitActivity
    claims: list[Claim]
    sub_score: SubScore
    limitations: list[str]
    rate_limit: RateLimit
